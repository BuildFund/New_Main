import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import BorrowerDashboard from './BorrowerDashboard';
import LenderDashboard from './LenderDashboard';
import AdminDashboard from './AdminDashboard';
import OnboardingLanding from './OnboardingLanding';
import Chatbot from '../components/Chatbot';
import api from '../api';

function Dashboard({ role, onLogout }) {
  const [showChatbot, setShowChatbot] = useState(false);
  const [showOnboardingLanding, setShowOnboardingLanding] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState(null);

  useEffect(() => {
    checkOnboardingProgress();
  }, [role]);

  async function checkOnboardingProgress() {
    try {
      const res = await api.get('/api/onboarding/progress/');
      setOnboardingProgress(res.data);
      console.log('Onboarding progress:', res.data); // Debug log
      // No automatic redirect - user must click progress bar to continue onboarding
    } catch (err) {
      console.error('Failed to check onboarding progress:', err);
      // If progress check fails (CORS, network, or server error), set a default progress
      // This ensures users can still access the dashboard even if API fails
      // Don't log out on this error - it's not an authentication issue
      setOnboardingProgress({
        is_complete: false,
        completion_percentage: 0,
      });
    }
  }

  function handleStartOnboarding() {
    setShowOnboardingLanding(true);
  }

  function handleOnboardingComplete() {
    setShowOnboardingLanding(false);
    setShowChatbot(false);
    checkOnboardingProgress();
  }

  function handleChatbotComplete() {
    setShowChatbot(false);
    checkOnboardingProgress();
  }

  const dashboardContent = (() => {
    if (role === 'Borrower') {
      return <BorrowerDashboard 
        onboardingProgress={onboardingProgress} 
        onStartOnboarding={handleStartOnboarding}
        onStartChatbot={() => setShowChatbot(true)}
      />;
    }
    if (role === 'Lender') {
      return <LenderDashboard 
        onboardingProgress={onboardingProgress} 
        onStartOnboarding={handleStartOnboarding}
        onStartChatbot={() => setShowChatbot(true)}
      />;
    }
    if (role === 'Admin') {
      return <AdminDashboard />;
    }
    if (role === 'Consultant') {
      return <Navigate to="/consultant/dashboard" />;
    }
    
    // Fallback for unknown roles
    return (
      <div style={{ padding: '1rem' }}>
        <h2>Dashboard</h2>
        <p>You are logged in as <strong>{role || 'User'}</strong>.</p>
      </div>
    );
  })();

  // Show onboarding landing page if incomplete
  if (showOnboardingLanding && onboardingProgress && !onboardingProgress.is_complete) {
    return (
      <Layout role={role} onLogout={onLogout}>
        <OnboardingLanding
          role={role}
          onComplete={handleOnboardingComplete}
        />
      </Layout>
    );
  }

  return (
    <Layout role={role} onLogout={onLogout}>
      {dashboardContent}
      {showChatbot && (
        <Chatbot
          onComplete={handleChatbotComplete}
          onClose={() => setShowChatbot(false)}
        />
      )}
    </Layout>
  );
}

export default Dashboard;