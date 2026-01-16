import React, { useState } from 'react';
import api from '../api';
import { theme } from '../styles/theme';
import Input from './Input';
import Button from './Button';

/**
 * Step-up authentication component for accessing sensitive data
 * Requires password re-entry for security
 */
function StepUpAuth({ onAuthenticated, onCancel, purpose = 'access sensitive information' }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Verify password with backend using step-up authentication endpoint
      const res = await api.post('/api/borrowers/wizard/step_up_authenticate/', {
        password: password,
        purpose: purpose,
      });

      if (res.data.success && res.data.session_key) {
        // Store session key for future requests
        localStorage.setItem('stepUpSessionKey', res.data.session_key);
        localStorage.setItem('stepUpExpiresAt', res.data.expires_at);
        onAuthenticated();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Password verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        background: theme.colors.white,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.xl,
        maxWidth: '400px',
        width: '90%',
        boxShadow: theme.shadows.xl,
      }}>
        <h2 style={{
          margin: `0 0 ${theme.spacing.md} 0`,
          fontSize: theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.semibold,
        }}>
          🔒 Step-Up Authentication Required
        </h2>
        <p style={{
          color: theme.colors.textSecondary,
          margin: `0 0 ${theme.spacing.lg} 0`,
          fontSize: theme.typography.fontSize.sm,
        }}>
          For security reasons, please re-enter your password to {purpose}.
        </p>

        {error && (
          <div style={{
            background: theme.colors.errorLight,
            color: theme.colors.errorDark,
            padding: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.md,
            fontSize: theme.typography.fontSize.sm,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            style={{ marginBottom: theme.spacing.lg }}
          />

          <div style={{
            display: 'flex',
            gap: theme.spacing.md,
            justifyContent: 'flex-end',
          }}>
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              type="submit"
              loading={loading}
            >
              Verify
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StepUpAuth;
