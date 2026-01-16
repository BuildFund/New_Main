import React from 'react';
import { theme, commonStyles } from '../styles/theme';
import Button from './Button';

function OnboardingChoice({ onSelectChatbot, onSelectForm }) {
  return (
    <div style={{
      ...commonStyles.container,
      maxWidth: '800px',
      margin: '0 auto',
      padding: theme.spacing['2xl'],
    }}>
      <div style={{
        ...commonStyles.card,
        padding: theme.spacing['2xl'],
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.textPrimary,
          margin: `0 0 ${theme.spacing.lg} 0`,
        }}>
          Complete Your Profile
        </h1>
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.lg,
          margin: `0 0 ${theme.spacing['2xl']} 0`,
        }}>
          Choose how you'd like to complete your profile information
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: theme.spacing.xl,
          marginTop: theme.spacing['2xl'],
        }}>
          {/* Chatbot Option */}
          <div style={{
            ...commonStyles.card,
            padding: theme.spacing.xl,
            border: `2px solid ${theme.colors.gray200}`,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.colors.primary;
            e.currentTarget.style.boxShadow = theme.shadows.lg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = theme.colors.gray200;
            e.currentTarget.style.boxShadow = 'none';
          }}
          onClick={onSelectChatbot}
          >
            <div style={{
              fontSize: '48px',
              marginBottom: theme.spacing.md,
            }}>
              🤖
            </div>
            <h2 style={{
              fontSize: theme.typography.fontSize.xl,
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.sm} 0`,
              color: theme.colors.textPrimary,
            }}>
              Chatbot Assistant
            </h2>
            <p style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
              margin: `0 0 ${theme.spacing.md} 0`,
            }}>
              Get guided through the process step-by-step with our friendly chatbot. Perfect if you prefer a conversational approach.
            </p>
            <ul style={{
              textAlign: 'left',
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
              paddingLeft: theme.spacing.lg,
              margin: `${theme.spacing.md} 0`,
            }}>
              <li>Step-by-step guidance</li>
              <li>Helpful tips and explanations</li>
              <li>Save progress anytime</li>
            </ul>
            <Button variant="primary" style={{ width: '100%', marginTop: theme.spacing.md }}>
              Start with Chatbot
            </Button>
          </div>

          {/* Form Option */}
          <div style={{
            ...commonStyles.card,
            padding: theme.spacing.xl,
            border: `2px solid ${theme.colors.gray200}`,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.colors.primary;
            e.currentTarget.style.boxShadow = theme.shadows.lg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = theme.colors.gray200;
            e.currentTarget.style.boxShadow = 'none';
          }}
          onClick={onSelectForm}
          >
            <div style={{
              fontSize: '48px',
              marginBottom: theme.spacing.md,
            }}>
              📋
            </div>
            <h2 style={{
              fontSize: theme.typography.fontSize.xl,
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.sm} 0`,
              color: theme.colors.textPrimary,
            }}>
              Complete Form
            </h2>
            <p style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
              margin: `0 0 ${theme.spacing.md} 0`,
            }}>
              Fill out all your information at once using our comprehensive form. Perfect if you prefer to see everything at once.
            </p>
            <ul style={{
              textAlign: 'left',
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
              paddingLeft: theme.spacing.lg,
              margin: `${theme.spacing.md} 0`,
            }}>
              <li>See all fields at once</li>
              <li>Drag & drop file uploads</li>
              <li>Save and continue later</li>
            </ul>
            <Button variant="primary" style={{ width: '100%', marginTop: theme.spacing.md }}>
              Start with Form
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingChoice;
