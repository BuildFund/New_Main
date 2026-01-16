import React, { useState } from 'react';
import api from '../api';
import { tokenStorage } from '../utils/tokenStorage';
import { theme, commonStyles } from '../styles/theme';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', username.trim());
      formData.append('password', password);
      
      const response = await api.post('/api/auth/token/', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      const token = response.data.token;
      
      if (!token) {
        throw new Error('No token received');
      }
      
      tokenStorage.setToken(token);
      
      // Try to get user info, but don't fail login if this fails
      let userRole = 'User';
      let usernameToStore = username;
      try {
        const meResp = await api.get('/api/accounts/me/');
        const roles = meResp.data.roles || [];
        if (roles.includes('Admin')) userRole = 'Admin';
        else if (roles.includes('Lender')) userRole = 'Lender';
        else if (roles.includes('Borrower')) userRole = 'Borrower';
        else if (roles.includes('Consultant')) userRole = 'Consultant';
        usernameToStore = meResp.data.username || username;
      } catch (meError) {
        console.warn('Failed to fetch user details, but login succeeded. Error:', meError);
        // Login succeeded, but couldn't fetch user details
        // This might be a network issue or the endpoint might not be available
        // Continue with default role - user can still access the system
        // The role will be determined when they access role-specific pages
      }
      
      tokenStorage.setRole(userRole);
      tokenStorage.setUsername(usernameToStore);
      
      onLogin(token, userRole);
    } catch (e) {
      console.error('Login error:', e);
      
      if (e.response?.status === 400) {
        const errorData = e.response.data;
        if (errorData.non_field_errors) {
          setError(errorData.non_field_errors[0]);
        } else if (errorData.username) {
          setError(errorData.username[0]);
        } else if (errorData.password) {
          setError(errorData.password[0]);
        } else {
          setError('Invalid credentials. Please check your username and password.');
        }
      } else if (e.response?.status === 401) {
        setError('Authentication failed. Please check your credentials.');
      } else if (e.response?.status === 0 || !e.response) {
        setError('Cannot connect to server. Please make sure the backend is running.');
      } else {
        setError(e.response?.data?.error || e.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      fontFamily: theme.typography.fontFamily,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`,
      padding: theme.spacing.xl,
    }}>
      <div style={{
        ...commonStyles.card,
        maxWidth: '440px',
        width: '100%',
        padding: theme.spacing['2xl'],
      }}>
        <div style={{ textAlign: 'center', marginBottom: theme.spacing.xl }}>
          <h1 style={{
            fontSize: theme.typography.fontSize['3xl'],
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.textPrimary,
            margin: `0 0 ${theme.spacing.sm} 0`,
          }}>
            BuildFund
          </h1>
          <p style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.base,
            margin: 0,
          }}>
            Sign in to your account
          </p>
        </div>

        {error && (
          <div style={{
            background: theme.colors.errorLight,
            color: theme.colors.errorDark,
            padding: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
            border: `1px solid ${theme.colors.error}`,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={commonStyles.formGroup}>
            <label style={commonStyles.label}>Email or username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              style={commonStyles.input}
              placeholder="Enter your username or email"
            />
          </div>
          
          <div style={commonStyles.formGroup}>
            <label style={commonStyles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              style={commonStyles.input}
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...commonStyles.button,
              ...commonStyles.buttonPrimary,
              width: '100%',
              padding: theme.spacing.md,
              fontSize: theme.typography.fontSize.base,
              marginTop: theme.spacing.md,
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;