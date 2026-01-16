import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Chatbot from '../components/Chatbot';

function OnboardingLanding({ role, onComplete }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const navigate = useNavigate();

  const handleSelectMethod = (method) => {
    setSelectedMethod(method);
    if (method === 'chatbot') {
      setShowChatbot(true);
    } else if (method === 'form') {
      // Navigate to form-based onboarding wizard
      if (role === 'Borrower') {
        navigate('/borrower/profile/wizard');
      } else if (role === 'Lender') {
        navigate('/lender/profile/wizard');
      } else if (role === 'Consultant') {
        navigate('/consultant/profile/wizard');
      }
    }
  };

  const handleChatbotComplete = () => {
    setShowChatbot(false);
    if (onComplete) {
      onComplete();
    }
  };

  if (showChatbot) {
    return (
      <Chatbot
        onComplete={handleChatbotComplete}
        onClose={() => setShowChatbot(false)}
      />
    );
  }

  return (
    <div style={{
      ...commonStyles.container,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      textAlign: 'center',
    }}>
      <div style={{
        ...commonStyles.card,
        maxWidth: '600px',
        padding: theme.spacing['3xl'],
      }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.bold,
          margin: `0 0 ${theme.spacing.md} 0`,
          color: theme.colors.textPrimary,
        }}>
          Complete Your Profile
        </h1>
        <p style={{
          fontSize: theme.typography.fontSize.lg,
          color: theme.colors.textSecondary,
          margin: `0 0 ${theme.spacing['2xl']} 0`,
        }}>
          Choose how you'd like to complete your onboarding
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: theme.spacing.xl,
          marginBottom: theme.spacing.xl,
        }}>
          {/* Chatbot Option */}
          <div
            onClick={() => handleSelectMethod('chatbot')}
            style={{
              ...commonStyles.card,
              padding: theme.spacing.xl,
              cursor: 'pointer',
              border: `2px solid ${selectedMethod === 'chatbot' ? theme.colors.primary : theme.colors.gray200}`,
              background: selectedMethod === 'chatbot' ? theme.colors.primaryLight : 'transparent',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedMethod !== 'chatbot') {
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.background = theme.colors.gray50;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedMethod !== 'chatbot') {
                e.currentTarget.style.borderColor = theme.colors.gray200;
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: theme.spacing.md }}>💬</div>
            <h2 style={{
              fontSize: theme.typography.fontSize.xl,
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.sm} 0`,
            }}>
              Chatbot Guide
            </h2>
            <p style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.textSecondary,
              margin: 0,
            }}>
              Interactive conversation that guides you through each step. Perfect if you prefer a guided experience.
            </p>
          </div>

          {/* Form Option */}
          <div
            onClick={() => handleSelectMethod('form')}
            style={{
              ...commonStyles.card,
              padding: theme.spacing.xl,
              cursor: 'pointer',
              border: `2px solid ${selectedMethod === 'form' ? theme.colors.primary : theme.colors.gray200}`,
              background: selectedMethod === 'form' ? theme.colors.primaryLight : 'transparent',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedMethod !== 'form') {
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.background = theme.colors.gray50;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedMethod !== 'form') {
                e.currentTarget.style.borderColor = theme.colors.gray200;
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: theme.spacing.md }}>📝</div>
            <h2 style={{
              fontSize: theme.typography.fontSize.xl,
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.sm} 0`,
            }}>
              Form Wizard
            </h2>
            <p style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.textSecondary,
              margin: 0,
            }}>
              Step-by-step form with all fields organized into stages. Perfect if you prefer to fill everything at once.
            </p>
          </div>
        </div>

        {selectedMethod && (
          <Button
            variant="primary"
            size="lg"
            onClick={() => handleSelectMethod(selectedMethod)}
            style={{ width: '100%' }}
          >
            Continue with {selectedMethod === 'chatbot' ? 'Chatbot' : 'Form'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default OnboardingLanding;
