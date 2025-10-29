import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Verifying your email...');
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setMessage('Invalid verification link. Please check your email and try again.');
      setStatus('error');
      return;
    }

    (async () => {
      try {
        const res = await authAPI.verifyEmail(token);
        if (res.data && res.data.success) {
          setMessage('Email verified successfully! You can now login to access your dashboard.');
          setStatus('success');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setMessage(res.data?.message || 'Verification failed. Please try again or contact support.');
          setStatus('error');
        }
      } catch (e) {
        setMessage(e.response?.data?.message || 'Verification failed. Please try again or contact support.');
        setStatus('error');
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          {status === 'loading' && (
            <div className="mb-4">
              <svg className="animate-spin h-12 w-12 text-orange-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
          
          {status === 'success' && (
            <div className="mb-4">
              <svg className="h-16 w-16 text-green-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          
          {status === 'error' && (
            <div className="mb-4">
              <svg className="h-16 w-16 text-red-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Email Verification</h3>
          <p className="text-gray-600">{message}</p>
          
          {status === 'success' && (
            <div className="mt-6">
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}
          
          {status === 'error' && (
            <div className="mt-6 space-y-3">
              <button
                onClick={() => navigate('/register')}
                className="w-full px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
              >
                Register Again
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Try Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
