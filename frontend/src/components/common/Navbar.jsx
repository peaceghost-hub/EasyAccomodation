import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const handleLogout = () => {
    logout();
    navigate('/login');
    closeMenu();
  };

  // Close the mobile menu when route changes or ESC is pressed
  useEffect(() => {
    closeMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const AuthenticatedLinks = ({ variant }) => {
    const linkClass = variant === 'mobile'
      ? 'w-full flex items-center gap-2 rounded-lg px-4 py-2 bg-white/5 text-white font-medium shadow-sm hover:bg-white/10 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-white'
      : 'btn btn-ghost text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-white';

    const logoutClass = variant === 'mobile'
      ? 'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 bg-white text-black font-medium shadow hover:bg-gray-200 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-white'
      : 'btn btn-secondary text-sm shadow-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-white';

    return (
      <>
        <div className={variant === 'mobile' ? 'flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10' : 'hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10'}>
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black text-sm font-bold">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-white truncate">{user?.full_name}</span>
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
    <nav className="sticky top-0 z-50 border-b border-white/20 bg-black/90 supports-[backdrop-filter]:backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-lg" onClick={closeMenu}>
          <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-lg flex items-center justify-center text-xl md:text-2xl shadow-md transform group-hover:scale-105 transition-all duration-200">
            🏠
          </div>
          <span className="text-xl md:text-2xl font-bold text-white">
            EasyAccommodation
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden p-2 rounded-lg border border-white/20 text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <AuthenticatedLinks variant="desktop" />
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-white">
                  Login
                </Link>
                <Link to="/register" className="btn btn-primary text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-white">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Animated mobile menu with smooth collapse/expand */}
      <div
        id="mobile-menu"
        className={`md:hidden overflow-hidden border-t border-white/10 bg-black/90 supports-[backdrop-filter]:backdrop-blur-sm transition-[max-height,opacity] duration-300 ease-out ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
        style={{ maxHeight: menuOpen ? '480px' : '0px' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3">
          {isAuthenticated ? (
            <AuthenticatedLinks variant="mobile" />
          ) : (
            <>
              <Link
                to="/login"
                onClick={closeMenu}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 bg-white/5 text-white font-medium shadow-sm hover:bg-white/10 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={closeMenu}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 bg-white text-black font-medium shadow hover:bg-gray-200 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
