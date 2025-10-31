import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const handleLogout = () => {
    logout();
    navigate('/login');
    closeMenu();
  };

  const AuthenticatedLinks = ({ variant }) => {
    const linkClass = variant === 'mobile'
      ? 'w-full flex items-center gap-2 rounded-lg px-4 py-2 bg-white/90 text-blue-700 font-semibold shadow-sm hover:bg-blue-50 transition'
      : 'btn btn-ghost text-sm';

    const logoutClass = variant === 'mobile'
      ? 'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 bg-red-500 text-white font-semibold shadow hover:bg-red-600 transition'
      : 'btn btn-secondary text-sm shadow-md';

    return (
      <>
        <div className={variant === 'mobile' ? 'flex items-center gap-3 p-3 bg-blue-50 rounded-lg' : 'hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200'}>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-gray-800 truncate">{user?.full_name}</span>
        </div>

        {user?.user_type === 'admin' && (
          <>
            <Link to="/admin/profile" onClick={closeMenu} className={linkClass}>
              👤 Profile
            </Link>
            <Link to="/admin/create" onClick={closeMenu} className={linkClass}>
              ➕ Create Admin
            </Link>
            <Link to="/admin/audits" onClick={closeMenu} className={linkClass}>
              📋 Audits
            </Link>
          </>
        )}

        {user?.user_type === 'student' && (
          <Link to="/student/profile" onClick={closeMenu} className={linkClass}>
            👤 My Profile
          </Link>
        )}

        {user?.user_type === 'house_owner' && (
          <Link to="/owner/profile" onClick={closeMenu} className={linkClass}>
            👤 My Profile
          </Link>
        )}

        <button onClick={handleLogout} className={logoutClass}>
          🚪 Logout
        </button>
      </>
    );
  };

  return (
    <nav className="glass border-b-2 border-blue-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group" onClick={closeMenu}>
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-2xl shadow-lg transform group-hover:rotate-6 transition-all duration-300">
            🏠
          </div>
          <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
            EasyAccommodation
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden p-2 rounded-lg border border-blue-200 text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label="Toggle navigation"
          >
            {menuOpen ? '✕' : '☰'}
          </button>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <AuthenticatedLinks variant="desktop" />
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
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-blue-100 bg-white/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3">
            {isAuthenticated ? (
              <AuthenticatedLinks variant="mobile" />
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 bg-white text-blue-700 font-semibold shadow-sm hover:bg-blue-50 transition"
                >
                  🔑 Login
                </Link>
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition"
                >
                  🚀 Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
