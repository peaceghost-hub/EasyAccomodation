import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { authAPI } from '../services/api';
import { houseAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [userType, setUserType] = useState('student');
  const [studentId, setStudentId] = useState('');
  const [institution, setInstitution] = useState('');
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { register: ctxRegister, login: ctxLogin } = useAuth();

  useEffect(() => {
    // Fetch public houses list and areas
    const fetch = async () => {
      try {
        const res = await houseAPI.getAreas();
        if (res.data?.areas) setAreas(res.data.areas);
      } catch (e) {
        // ignore
      }
    };
    fetch();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate and normalize phone number on client side
    const digits = (phone || '').replace(/\D/g, '');
    if (!/^07(1|7|8)\d{7}$/.test(digits)) {
      setError('Phone number must be 10 digits and start with 071, 077, or 078');
      return;
    }

    const payload = {
      email,
      password,
      full_name: fullName,
      phone_number: digits,
      user_type: userType
    };

    if (userType === 'house_owner') {
      // require house details to match an admin-created house
      if (!houseNumber || !streetAddress || !selectedAreaId) {
        setError('Please provide house number, street address and residential area');
        return;
      }
      payload.house_number = houseNumber;
      payload.street_address = streetAddress;
      payload.residential_area = selectedAreaId; // can be id or name; backend accepts id or name
    }

    if (userType === 'student') {
      if (studentId) payload.student_id = studentId;
      if (institution) payload.institution = institution;
    }

    try {
      // Use AuthContext register so behavior stays consistent
      const res = await ctxRegister(payload);
      if (res.success) {
        // For students: Show email verification message and redirect to login
        if (userType === 'student') {
          setError(''); // Clear any errors
          alert('Registration successful! Please check your email (' + email + ') for a verification link. You must verify your email before you can login.');
          navigate('/login');
          return;
        }
        
        // For house owners and admins: Auto-login them
        const loginRes = await ctxLogin({ email, password });
        if (loginRes.success) {
          const user = loginRes.user;
          if (user.user_type === 'admin') navigate('/admin');
          else if (user.user_type === 'house_owner') navigate('/owner/house');
          else navigate('/student');
        } else {
          // If auto-login failed, send user to login page with message
          setError(loginRes.message || 'Registered but failed to login. Please login manually.');
          navigate('/login');
        }
      } else {
        setError(res.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen house-pattern-bg py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Animated gradient overlay */}
      <div className="gradient-overlay"></div>
      
      {/* Floating house decorations */}
      <div className="absolute top-20 left-10 text-7xl opacity-10 float-animation">🏠</div>
      <div className="absolute bottom-20 right-10 text-6xl opacity-10 float-animation" style={{animationDelay: '2s'}}>🏘️</div>
      <div className="absolute top-1/2 left-1/4 text-5xl opacity-10 float-animation" style={{animationDelay: '4s'}}>🏡</div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl shadow-xl transform hover:rotate-6 transition-transform duration-300">
              🏠
            </div>
          </div>
          <h2 className="text-4xl font-extrabold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent mb-2">
            Create Your Account
          </h2>
          <p className="text-gray-600 text-lg">Join EasyAccommodation today and find your perfect home</p>
        </div>

        <div className="glass rounded-2xl shadow-2xl border-2 border-white/50 p-8">
          {error && (
            <div className="mb-6 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 rounded-lg p-4 shadow-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* User Type Selector */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">I am registering as:</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setUserType('student')}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                    userType === 'student'
                      ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="text-3xl mb-2">🎓</div>
                  <div className="font-semibold text-gray-800">Student</div>
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('house_owner')}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                    userType === 'house_owner'
                      ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="text-3xl mb-2">🏠</div>
                  <div className="font-semibold text-gray-800">House Owner</div>
                </button>
              </div>
            </div>

            {/* Basic Information */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-bold text-gray-700 mb-2">
                  👤 Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                  📧 Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-2">
                  📱 Phone Number
                </label>
                <input
                  id="phone"
                  type="text"
                  placeholder="0771234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 italic">
                  Must start with 071, 077, or 078
                </p>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
                  🔒 Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>

            {/* House Owner Specific Fields */}
            {userType === 'house_owner' && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <span>🏘️</span>
                  House Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">House Number</label>
                    <input
                      className="input"
                      placeholder="e.g., 12A"
                      value={houseNumber}
                      onChange={(e) => setHouseNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Street Address</label>
                    <input
                      className="input"
                      placeholder="e.g., Main Street"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Residential Area</label>
                    <select
                      className="input"
                      value={selectedAreaId}
                      onChange={(e) => setSelectedAreaId(e.target.value)}
                    >
                      <option value="">-- Select an area --</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-blue-700 bg-blue-100 p-3 rounded-lg">
                    💡 Your house must be registered by an admin before you can claim it
                  </p>
                </div>
              </div>
            )}

            {/* Student Specific Fields */}
            {userType === 'student' && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <span>🎓</span>
                  Student Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Student ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., S12345"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Institution (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., University of Zimbabwe"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105"
              >
                <span>Create Account</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                Sign in here →
              </a>
            </p>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span className="text-green-500 text-lg">🔒</span>
            <span>Secure Registration</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-500 text-lg">✓</span>
            <span>Email Verification</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-500 text-lg">⚡</span>
            <span>Quick Setup</span>
          </div>
        </div>
      </div>
    </div>
  );
}
