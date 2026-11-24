import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authFetch, safeJson } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Pre-hydrate user immediately from localStorage to eliminate flicker / refresh redirect
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("auth_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // If we already have token and user in localStorage, don't block the screen with full-page loader
  const [loading, setLoading] = useState(() => {
    return Boolean(localStorage.getItem("auth_token") && !localStorage.getItem("auth_user"));
  });
  const [error, setError] = useState(null);

  // Check current session from backend using Bearer token + cookie
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await authFetch("/api/auth/me");

      if (res.ok) {
        const data = await safeJson(res);
        if (data.token) {
          localStorage.setItem("auth_token", data.token);
        }
        if (data.user) {
          localStorage.setItem("auth_user", JSON.stringify(data.user));
          setUser(data.user);
        }
      } else if (res.status === 401) {
        // Only clear credentials if token was explicitly invalid/expired
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setUser(null);
      }
    } catch (err) {
      console.warn("[Auth] Session validation notice:", err.message);
      // On temporary network hiccup, do NOT immediately log out the user if they have cached credentials
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login action
  const login = async ({ email, password }) => {
    try {
      setError(null);
      const res = await authFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await safeJson(res, "Failed to log in");
      if (!res.ok) {
        throw new Error(data.message || "Failed to log in");
      }

      if (data.token) {
        localStorage.setItem("auth_token", data.token);
      }
      if (data.user) {
        localStorage.setItem("auth_user", JSON.stringify(data.user));
        setUser(data.user);
      }
      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Register action
  const register = async ({ name, email, password }) => {
    try {
      setError(null);
      const res = await authFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });

      const data = await safeJson(res, "Failed to create account");
      if (!res.ok) {
        throw new Error(data.message || "Failed to create account");
      }

      if (data.token) {
        localStorage.setItem("auth_token", data.token);
      }
      if (data.user) {
        localStorage.setItem("auth_user", JSON.stringify(data.user));
        setUser(data.user);
      }
      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Logout action
  const logout = async () => {
    try {
      await authFetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (err) {
      console.error("[Auth] Logout failed:", err);
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      setUser(null);
      setError(null);
    }
  };

  // Update Profile action
  const updateProfile = async (profileData) => {
    try {
      setError(null);
      const res = await authFetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify(profileData),
      });

      const data = await safeJson(res, "Failed to update profile");
      if (!res.ok) {
        throw new Error(data.message || "Failed to update profile");
      }

      if (data.user) {
        localStorage.setItem("auth_user", JSON.stringify(data.user));
        setUser(data.user);
      }
      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;

