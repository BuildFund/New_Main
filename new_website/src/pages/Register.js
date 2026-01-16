import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Input from '../components/Input';
import Button from '../components/Button';
import Select from '../components/Select';

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'borrower', // borrower, lender, professional
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.password.length < 12) {
      setError('Password must be at least 12 characters long');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Map userType to role
      let roleName = 'Borrower';
      if (formData.userType === 'lender') {
        roleName = 'Lender';
      } else if (formData.userType === 'professional') {
        roleName = 'Consultant';
      }

      const payload = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        roles: [roleName],
      };

      await api.post('/api/accounts/register/', payload);
      
      // Redirect to login
      navigate('/login', { 
        state: { 
          message: 'Registration successful! Please log in to continue.' 
        } 
      });
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
      padding: theme.spacing.xl,
    }}>
      <div style={{
        ...commonStyles.card,
        maxWidth: '500px',
        width: '100%',
        padding: theme.spacing['2xl'],
      }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
          margin: `0 0 ${theme.spacing.lg} 0`,
          textAlign: 'center',
          color: theme.colors.textPrimary,
        }}>
          Create Account
        </h1>

        <p style={{
          textAlign: 'center',
          color: theme.colors.textSecondary,
          marginBottom: theme.spacing.xl,
        }}>
          Join BuildFund to access funding opportunities
        </p>

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
          <Select
            label="I am a..."
            name="userType"
            value={formData.userType}
            onChange={handleChange}
            required
            style={{ marginBottom: theme.spacing.lg }}
          >
            <option value="borrower">Borrower - Seeking Funding</option>
            <option value="lender">Lender - Providing Funding</option>
            <option value="professional">Non Borrower / Professional - Consultant/Solicitor</option>
          </Select>

          <Input
            label="Username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            required
            placeholder="Choose a username"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="your.email@example.com"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Input
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="Minimum 12 characters"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            placeholder="Re-enter your password"
            style={{ marginBottom: theme.spacing.xl }}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            style={{ width: '100%', marginBottom: theme.spacing.md }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: theme.colors.textSecondary, margin: 0 }}>
              Already have an account?{' '}
              <a
                href="/login"
                style={{
                  color: theme.colors.primary,
                  textDecoration: 'none',
                  fontWeight: theme.typography.fontWeight.semibold,
                }}
              >
                Log in
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;
