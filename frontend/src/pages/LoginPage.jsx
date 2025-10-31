import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side phone validation when identifier looks like a phone.
    // If the identifier contains an '@' we treat it as an email and skip phone checks.
    const raw = (identifier || '').trim();
    const isEmail = raw.includes('@');
    const digits = raw.replace(/\D/g, '');
    const isPhoneLike = !isEmail && (/^\d+$/.test(digits) || raw.startsWith('07'));
    if (isPhoneLike && !/^07(1|7|8)\d{7}$/.test(digits)) {
      setError('Phone must be 10 digits and start with 071, 077, or 078');
      return;
    }

    const result = await login({ email: identifier, password });
    
    if (result.success) {
  const userType = result.user.user_type;
  navigate(userType === 'admin' ? '/admin' : userType === 'student' ? '/student' : '/owner/house');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen house-pattern-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Animated gradient overlay */}
      <div className="gradient-overlay"></div>
      
      {/* Floating house decorations */}
      <div className="absolute top-20 left-20 text-8xl opacity-10 float-animation">🏠</div>
      <div className="absolute bottom-32 right-32 text-7xl opacity-10 float-animation" style={{animationDelay: '1.5s'}}>🏘️</div>
      <div className="absolute top-1/3 right-20 text-6xl opacity-10 float-animation" style={{animationDelay: '3s'}}>🏡</div>
      <div className="max-w-md w-full relative z-10">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl shadow-xl transform hover:rotate-6 transition-transform duration-300">
              🏠
            </div>
          </div>
          <h2 className="text-4xl font-extrabold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent mb-2">
            Welcome Back!
          </h2>
          <p className="text-gray-600 text-lg">Sign in to access your dashboard</p>
        </div>
        
        <div className="glass rounded-2xl shadow-2xl border-2 border-white/50 p-8">
          {error && (
            <div className="mb-6 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 rounded-lg p-4 shadow-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="identifier" className="block text-sm font-bold text-gray-700 mb-2">
                📧 Email or Phone
              </label>
              <div className="relative">
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="input"
                  placeholder="e.g. user@example.com or 0771234567"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500 italic">
                💡 Phone must be 10 digits starting with 071, 077, or 078
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
                🔒 Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="Enter your password"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105"
              >
                <span>Sign In</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <a href="/register" className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                Create one now →
              </a>
            </p>
          </div>
        </div>
        
        {/* Trust badges */}
        <div className="mt-8 flex justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span className="text-green-500 text-lg">🔒</span>
            <span>Secure Login</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-500 text-lg">✓</span>
            <span>Verified Platform</span>
          </div>
        </div>
      </div>
    </div>
  );
}
