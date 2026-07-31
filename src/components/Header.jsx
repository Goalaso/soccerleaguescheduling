import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '../navItems';
import { IoIosFootball } from 'react-icons/io';
import { useAuth } from '../context/AuthContext';

function Header({ menuOpen, onToggleMenu }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const visibleNavItems = user
    ? NAV_ITEMS.filter((item) => !item.adminOnly || user.role === 'admin')
    : [];

  return (
    <header className="header">
      <div className="header-bar">
        <button
          className="hamburger-btn"
          aria-label="Toggle menu"
          onClick={onToggleMenu}
        >
          <span />
          <span />
          <span />
        </button>

        <Link className="logo-badge" to="/">
          <IoIosFootball className="icon-svg" />
          <span className="logo-badge-text">BISL</span>
        </Link>

        <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
          {visibleNavItems.map((item) => (
            <Link
              key={item.id}
              className={`nav-link ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              to={item.path}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-auth">
          {user ? (
            <>
              <Link className="header-auth-name" to="/profile">
                {user.name}
              </Link>
              <button className="nav-link" onClick={handleLogout}>
                Log Out
              </button>
            </>
          ) : (
            <Link className="nav-link" to="/login">
              Log In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
