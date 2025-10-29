import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Poll profile for students who are logged in but not yet admin-verified.
  // This ensures that when an admin accepts/rejects a proof, the student's UI updates
  // without requiring a manual refresh.
  useEffect(() => {
    let intervalId = null;
    const shouldPoll = user && user.user_type === 'student' && !user.admin_verified;
    if (shouldPoll) {
      const poll = async () => {
        try {
          const res = await authAPI.getProfile();
          if (res.data && res.data.user) {
            const updated = res.data.user;
            // If admin_verified changed or other important fields changed, update local user
            if (JSON.stringify(updated) !== JSON.stringify(user)) {
              setUser(updated);
              localStorage.setItem('user', JSON.stringify(updated));
            }
          }
        } catch (e) {
          // ignore errors (token may have expired)
        }
      };
      // Poll immediately and then every 15s
      poll();
      intervalId = setInterval(poll, 15000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [user]);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      const { access_token, user } = response.data;
      
      setToken(access_token);
      setUser(user);
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return { success: true, user };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Registration failed' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateLocalUser = (newUser) => {
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      isAuthenticated: !!token,
      isAdmin: user?.user_type === 'admin',
      isStudent: user?.user_type === 'student',
      login, logout, register,
      updateLocalUser
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
