import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AsciiArt } from '@/components/AsciiArt';
import LoginForm from '@/components/LoginForm';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import Profile from '@/pages/Profile';
import Lobby from '@/pages/Lobby';
import Interviews from '@/pages/Interviews';
import InterviewRoom from '@/pages/InterviewRoom';

function LoginPage() {
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <main className="w-screen h-screen min-h-screen overflow-x-hidden flex flex-col lg:flex-row bg-black">
      {/* Left side: Vignette Bloom ASCII Video from 21st.dev */}
      <section className="relative w-full lg:w-1/2 h-[42vh] lg:h-full bg-black overflow-hidden shrink-0">
        <AsciiArt className="absolute inset-0 w-full h-full object-cover" />

        {/* Top-left subtle back button */}
        <div className="absolute top-6 left-6 z-20">
          <button
            onClick={handleBack}
            aria-label="Go back"
            className="group flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-all shadow-lg active:scale-95"
          >
            <svg
              className="w-5 h-5 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </section>

      {/* Right side: Login / Signup Form matching the reference design */}
      <section className="w-full lg:w-1/2 min-h-[58vh] lg:h-full flex items-center justify-center bg-white shadow-2xl z-10 overflow-y-auto">
        <LoginForm />
      </section>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lobby"
              element={
                <ProtectedRoute>
                  <Lobby />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interviews"
              element={
                <ProtectedRoute>
                  <Interviews />
                </ProtectedRoute>
              }
            />
            <Route
              path="/room/:roomId"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <InterviewRoom />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Landing />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
