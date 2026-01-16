import React from 'react';
import { theme, commonStyles } from '../styles/theme';

function Wizard({ steps, currentStep, onStepClick, children, canNavigateToStep }) {
  // Default function to allow navigation to any completed step or the next step
  const defaultCanNavigateToStep = (stepNumber) => {
    if (!canNavigateToStep) return true; // If no function provided, allow all navigation
    return canNavigateToStep(stepNumber);
  };

  const handleStepClick = (stepNumber) => {
    if (onStepClick && defaultCanNavigateToStep(stepNumber)) {
      onStepClick(stepNumber);
    }
  };

  return (
    <div style={commonStyles.container}>
      {/* Progress Indicator */}
      <div style={{ marginBottom: theme.spacing['2xl'] }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          marginBottom: theme.spacing.lg,
        }}>
          {/* Progress Line */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: 0,
            right: 0,
            height: '2px',
            background: theme.colors.gray200,
            zIndex: 0,
          }} />
          <div style={{
            position: 'absolute',
            top: '20px',
            left: 0,
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
            height: '2px',
            background: theme.colors.primary,
            zIndex: 1,
            transition: `width ${theme.transitions.normal}`,
          }} />
          
          {/* Step Indicators */}
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;
            const canNavigate = defaultCanNavigateToStep(stepNumber);
            const isClickable = onStepClick && canNavigate;
            
            return (
              <div key={index} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                position: 'relative',
                zIndex: 2,
              }}>
                <div 
                  onClick={() => isClickable && handleStepClick(stepNumber)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: theme.borderRadius.full,
                    background: isCompleted || isActive ? theme.colors.primary : theme.colors.gray200,
                    color: isCompleted || isActive ? theme.colors.white : theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: theme.typography.fontWeight.bold,
                    fontSize: theme.typography.fontSize.base,
                    boxShadow: isActive ? theme.shadows.md : 'none',
                    transition: `all ${theme.transitions.normal}`,
                    cursor: isClickable ? 'pointer' : 'default',
                    opacity: isClickable ? 1 : (isActive ? 1 : 0.6),
                  }}
                  title={isClickable ? `Click to go to step ${stepNumber}` : (isActive ? `Current step` : 'Complete previous steps first')}
                >
                  {isCompleted ? '✓' : stepNumber}
                </div>
                <div 
                  onClick={() => isClickable && handleStepClick(stepNumber)}
                  style={{
                    marginTop: theme.spacing.sm,
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: isActive ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.normal,
                    color: isActive || isCompleted ? theme.colors.primary : theme.colors.textSecondary,
                    textAlign: 'center',
                    cursor: isClickable ? 'pointer' : 'default',
                    opacity: isClickable ? 1 : (isActive ? 1 : 0.6),
                  }}
                  title={isClickable ? `Click to go to step ${stepNumber}` : ''}
                >
                  {step}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard Content */}
      <div style={{
        ...commonStyles.card,
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        {children}
      </div>
    </div>
  );
}

export default Wizard;
