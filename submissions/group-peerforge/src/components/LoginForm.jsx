import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginForm() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    // Clear errors when user types
    if (errorMessage) setErrorMessage('');
  };

  const handleToggleMode = () => {
    setIsSignUp(prev => !prev);
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (isSignUp && formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const res = await register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        });

        if (res.success) {
          setSuccessMessage('Account created successfully! Welcome to PeerForge.');
          setTimeout(() => {
            navigate('/dashboard');
          }, 600);
        } else {
          setErrorMessage(res.error || 'Failed to create account');
        }
      } else {
        const res = await login({
          email: formData.email,
          password: formData.password,
        });

        if (res.success) {
          setSuccessMessage('Signed in successfully! Welcome back.');
          setTimeout(() => {
            navigate('/dashboard');
          }, 600);
        } else {
          setErrorMessage(res.error || 'Invalid email or password');
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-center items-center px-6 sm:px-10 lg:px-14 py-10 bg-white">
      <div className="w-full max-w-[420px] mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 font-sans">
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500 font-normal">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={handleToggleMode}
              className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors focus:outline-none"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Sign Up Name Field */}
          {isSignUp && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="block text-sm font-medium text-neutral-700">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 sm:py-3 text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all placeholder:text-neutral-400"
              />
            </div>
          )}

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="Email Address"
              className="w-full px-4 py-2.5 sm:py-3 text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all placeholder:text-neutral-400"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="Password (min 6 characters)"
                className="w-full px-4 py-2.5 sm:py-3 pr-11 text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all placeholder:text-neutral-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 focus:outline-none transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                ) : (
                  <Eye className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password for Sign Up */}
          {isSignUp && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="block text-sm font-medium text-neutral-700">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm Password"
                  className="w-full px-4 py-2.5 sm:py-3 pr-11 text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all placeholder:text-neutral-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 focus:outline-none transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Remember me & Forgot password row */}
          {!isSignUp && (
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 accent-neutral-900 cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-neutral-600">Remember me</span>
              </label>
              <a
                href="#forgot"
                onClick={(e) => { e.preventDefault(); }}
                className="text-xs sm:text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                Forgot password?
              </a>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white font-medium text-sm transition-all duration-150 shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
