import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Helper to issue JWT and set secure HTTP-only cookie
const sendTokenResponse = (user, statusCode, res) => {
  const secret = process.env.JWT_SECRET || "peerforge_development_secret_key_123456789";
  const token = jwt.sign({ id: user._id }, secret, {
    expiresIn: "7d",
  });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  res.status(statusCode).cookie("auth_token", token, cookieOptions).json({
    success: true,
    token, // Provided for WebSocket and non-cookie environments
    user: {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      profile: user.profile,
    },
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user with default profile
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      profile: {
        bio: "",
        targetRoles: [],
        skills: [],
        timeZone: "UTC",
      },
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide an email and password",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
export const logout = async (req, res) => {
  res
    .status(200)
    .cookie("auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      expires: new Date(0),
    })
    .json({
      success: true,
      message: "Logged out successfully",
    });
};

// @desc    Get currently authenticated user
// @route   GET /api/auth/me
export const getCurrentUser = async (req, res) => {
  const secret = process.env.JWT_SECRET || "peerforge_development_secret_key_123456789";
  const token = jwt.sign({ id: req.user._id }, secret, { expiresIn: "7d" });

  res.status(200).json({
    success: true,
    token,
    user: req.user,
  });
};

