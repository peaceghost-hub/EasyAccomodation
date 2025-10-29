import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="glass border-b-2 border-blue-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-2xl shadow-lg transform group-hover:rotate-6 transition-all duration-300">
            🏠
          </div>
          <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
            EasyAccommodation
          </span>
        </Link>
        
        <div className="flex items-center space-x-3">
          {isAuthenticated ? (
            <>
              {/* User Badge */}
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {user?.full_name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-gray-800">{user?.full_name}</span>
              </div>

              {/* Admin Links */}
              {user?.user_type === 'admin' && (
                <>
                  <Link to="/admin/profile" className="btn btn-ghost text-sm">
                    👤 Profile
                  </Link>
                  <Link to="/admin/create" className="btn btn-ghost text-sm">
                    ➕ Create Admin
                  </Link>
                  <Link to="/admin/audits" className="btn btn-ghost text-sm">
                    📋 Audits
                  </Link>
                </>
              )}

              {/* Student Links */}
              {user?.user_type === 'student' && (
                <Link to="/student/profile" className="btn btn-ghost text-sm">
                  👤 My Profile
                </Link>
              )}

              {/* House Owner Links */}
              {user?.user_type === 'house_owner' && (
                <Link to="/owner/profile" className="btn btn-ghost text-sm">
                  👤 My Profile
                </Link>
              )}

              {/* Logout Button */}
              <button 
                onClick={() => { logout(); navigate('/login'); }} 
                className="btn btn-secondary text-sm shadow-md"
              >
                🚪 Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost text-sm">
                🔑 Login
              </Link>
              <Link to="/register" className="btn btn-primary text-sm">
                🚀 Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
