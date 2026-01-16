import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { theme, commonStyles } from '../styles/theme';

function Layout({ children, role, onLogout }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const navigation = {
    Borrower: [
      { path: '/', label: 'Dashboard', icon: '📊' },
      { path: '/borrower/projects', label: 'Projects', icon: '🏗️' },
      { path: '/borrower/matches', label: 'Matches', icon: '🔍' },
      { path: '/borrower/applications', label: 'Applications', icon: '📝' },
      { path: '/borrower/messages', label: 'Messages', icon: '💬' },
      { path: '/borrower/private-equity', label: 'Private Equity', icon: '💼' },
      { path: '/borrower/documents', label: 'Documents', icon: '📄' },
      { path: '/borrower/profile', label: 'Profile', icon: '👤' },
      { path: '/account/settings', label: 'Account Settings', icon: '⚙️' },
    ],
    Lender: [
      { path: '/', label: 'Dashboard', icon: '📊' },
      { path: '/lender/products', label: 'Products', icon: '💼' },
      { path: '/lender/applications', label: 'Applications', icon: '📝' },
      { path: '/lender/deals', label: 'Deal Room', icon: '🏢' },
      { path: '/lender/messages', label: 'Messages', icon: '💬' },
      { path: '/lender/private-equity', label: 'Private Equity', icon: '💼' },
      { path: '/lender/documents', label: 'Documents', icon: '📄' },
      { path: '/lender/profile', label: 'Profile', icon: '👤' },
      { path: '/account/settings', label: 'Account Settings', icon: '⚙️' },
    ],
    Admin: [
      { path: '/', label: 'Dashboard', icon: '📊' },
      { path: '/admin/private-equity', label: 'Private Equity', icon: '💼' },
      { path: '/account/settings', label: 'Account Settings', icon: '⚙️' },
    ],
    Consultant: [
      { path: '/consultant/dashboard', label: 'Dashboard', icon: '📊' },
      { path: '/consultant/services', label: 'Service Opportunities', icon: '🔍' },
      { path: '/consultant/quotes', label: 'My Quotes', icon: '💰' },
      { path: '/consultant/appointments', label: 'Appointments', icon: '📅' },
      { path: '/consultant/profile', label: 'Profile', icon: '👤' },
      { path: '/account/settings', label: 'Account Settings', icon: '⚙️' },
    ],
  };

  const navItems = navigation[role] || [];
  const sidebarWidth = sidebarOpen ? '240px' : '64px';

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: theme.colors.gray50,
      display: 'flex',
      fontFamily: theme.typography.fontFamily,
    }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarWidth,
        background: theme.colors.white,
        borderRight: `1px solid ${theme.colors.gray200}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 1000,
        transition: `width ${theme.transitions.normal}`,
        boxShadow: theme.shadows.sm,
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.gray200}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '64px',
        }}>
          {sidebarOpen && (
            <Link to="/" style={{ 
              textDecoration: 'none',
              color: theme.colors.primary,
              fontSize: theme.typography.fontSize.xl,
              fontWeight: theme.typography.fontWeight.bold,
            }}>
              BuildFund
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: theme.spacing.xs,
              borderRadius: theme.borderRadius.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.lg,
            }}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1,
          padding: theme.spacing.md,
          overflowY: 'auto',
        }}>
          {navItems.map((item) => {
            // Check if current path matches or starts with item path (for nested routes)
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.xs,
                  borderRadius: theme.borderRadius.md,
                  textDecoration: 'none',
                  color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                  background: isActive ? theme.colors.primary + '10' : 'transparent',
                  fontWeight: isActive ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.normal,
                  transition: `all ${theme.transitions.fast}`,
                  borderLeft: isActive ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = theme.colors.gray50;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: '20px', minWidth: '24px', textAlign: 'center' }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div style={{
          padding: theme.spacing.md,
          borderTop: `1px solid ${theme.colors.gray200}`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.md,
            marginBottom: theme.spacing.md,
            padding: theme.spacing.sm,
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.sm,
          }}>
            <span style={{ fontSize: '16px' }}>👤</span>
            {sidebarOpen && <span>{role}</span>}
          </div>
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              ...commonStyles.button,
              ...commonStyles.buttonOutline,
              padding: theme.spacing.sm,
              fontSize: theme.typography.fontSize.sm,
            }}
          >
            {sidebarOpen ? 'Logout' : '🚪'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{
        marginLeft: sidebarWidth,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transition: `margin-left ${theme.transitions.normal}`,
        minHeight: '100vh',
      }}>
        {/* Top Header Bar */}
        <header style={{
          background: theme.colors.white,
          borderBottom: `1px solid ${theme.colors.gray200}`,
          boxShadow: theme.shadows.sm,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: `${theme.spacing.md} ${theme.spacing.xl}`,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.colors.textPrimary,
            }}>
              {navItems.find(item => item.path === location.pathname)?.label || 'BuildFund'}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}>
              <span style={{ 
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.sm,
              }}>
                {role}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main style={{ 
          flex: 1, 
          padding: theme.spacing.xl,
          maxWidth: '1400px',
          width: '100%',
          margin: '0 auto',
        }}>
          {children}
        </main>

        {/* Footer */}
        <footer style={{
          background: theme.colors.white,
          borderTop: `1px solid ${theme.colors.gray200}`,
          padding: theme.spacing.lg,
          marginTop: 'auto',
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            textAlign: 'center',
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.sm,
          }}>
            © {new Date().getFullYear()} BuildFund. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Layout;
