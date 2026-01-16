import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { tokenStorage } from './utils/tokenStorage';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import BorrowerProjects from './pages/BorrowerProjects';
import LenderProducts from './pages/LenderProducts';
import BorrowerMatches from './pages/BorrowerMatches';
import LenderApplications from './pages/LenderApplications';
import AdminDashboard from './pages/AdminDashboard';
import BorrowerProjectWizard from './pages/BorrowerProjectWizard';
import LenderProductWizard from './pages/LenderProductWizard';
import BorrowerPrivateEquity from './pages/BorrowerPrivateEquity';
import LenderPrivateEquity from './pages/LenderPrivateEquity';
import AdminPrivateEquity from './pages/AdminPrivateEquity';
import BorrowerProfile from './pages/BorrowerProfile';
import BorrowerProfileWizard from './pages/BorrowerProfileWizard';
import BorrowerApplications from './pages/BorrowerApplications';
import Documents from './pages/Documents';
import LenderProfile from './pages/LenderProfile';
import LenderProfileWizard from './pages/LenderProfileWizard';
import Messages from './pages/Messages';
import ProjectDetail from './pages/ProjectDetail';
import ProductDetail from './pages/ProductDetail';
import BorrowerProductDetail from './pages/BorrowerProductDetail';
import ApplicationDetail from './pages/ApplicationDetail';
import BorrowerInformation from './pages/BorrowerInformation';
import AccountSettings from './pages/AccountSettings';
import FCACertification from './pages/FCACertification';
import ConsultantDashboard from './pages/ConsultantDashboard';
import ConsultantProfile from './pages/ConsultantProfile';
import ConsultantProfileWizard from './pages/ConsultantProfileWizard';
import Register from './pages/Register';
import ConsultantQuoteForm from './pages/ConsultantQuoteForm';
import ConsultantEnquiryQuoteForm from './pages/ConsultantEnquiryQuoteForm';
import ConsultantEnquiryDetail from './pages/ConsultantEnquiryDetail';
import ConsultantAppointmentDetail from './pages/ConsultantAppointmentDetail';
import DealsList from './pages/DealsList';
import DealRoom from './pages/DealRoom';
import QuoteDetail from './pages/QuoteDetail';

function App() {
  // Migrate from localStorage on mount (before state initialization)
  // This ensures tokens are loaded into memory before the component checks for them
  tokenStorage.migrateFromLocalStorage();

  const [token, setToken] = React.useState(() => tokenStorage.getToken());
  const [role, setRole] = React.useState(() => tokenStorage.getRole());

  const handleLogin = (tok, userRole) => {
    tokenStorage.setToken(tok);
    tokenStorage.setRole(userRole);
    setToken(tok);
    setRole(userRole);
  };

  const handleLogout = () => {
    tokenStorage.clearAll();
    setToken(null);
    setRole(null);
  };

  if (!token) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    );
  }

  // Wrapper component for routes that need Layout
  const LayoutWrapper = ({ children }) => (
    <Layout role={role} onLogout={handleLogout}>
      {children}
    </Layout>
  );

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard role={role} onLogout={handleLogout} />} />
        <Route path="/borrower/projects" element={<LayoutWrapper><BorrowerProjects /></LayoutWrapper>} />
        <Route path="/borrower/projects/:id" element={<LayoutWrapper><ProjectDetail /></LayoutWrapper>} />
        <Route path="/borrower/projects/new" element={<LayoutWrapper><BorrowerProjectWizard /></LayoutWrapper>} />
        <Route path="/borrower/matches" element={<LayoutWrapper><BorrowerMatches /></LayoutWrapper>} />
        <Route path="/borrower/products/:id" element={<LayoutWrapper><BorrowerProductDetail /></LayoutWrapper>} />
        <Route path="/borrower/applications" element={<LayoutWrapper><BorrowerApplications /></LayoutWrapper>} />
        <Route path="/borrower/applications/:id" element={<LayoutWrapper><ApplicationDetail /></LayoutWrapper>} />
        <Route path="/borrower/deals" element={<LayoutWrapper><DealsList /></LayoutWrapper>} />
        <Route path="/borrower/documents" element={<LayoutWrapper><Documents /></LayoutWrapper>} />
        <Route path="/borrower/private-equity" element={<LayoutWrapper><BorrowerPrivateEquity /></LayoutWrapper>} />
        <Route path="/borrower/profile" element={<LayoutWrapper><BorrowerProfile /></LayoutWrapper>} />
        <Route path="/borrower/profile/wizard" element={<LayoutWrapper><BorrowerProfileWizard /></LayoutWrapper>} />
        <Route path="/borrower/messages" element={<LayoutWrapper><Messages /></LayoutWrapper>} />
        <Route path="/lender/products" element={<LayoutWrapper><LenderProducts /></LayoutWrapper>} />
        <Route path="/lender/products/:id" element={<LayoutWrapper><ProductDetail /></LayoutWrapper>} />
        <Route path="/lender/products/:id/edit" element={<LayoutWrapper><LenderProductWizard /></LayoutWrapper>} />
        <Route path="/lender/products/new" element={<LayoutWrapper><LenderProductWizard /></LayoutWrapper>} />
        <Route path="/lender/applications" element={<LayoutWrapper><LenderApplications /></LayoutWrapper>} />
        <Route path="/lender/applications/:id" element={<LayoutWrapper><ApplicationDetail /></LayoutWrapper>} />
        <Route path="/lender/applications/:id/borrower-info" element={<LayoutWrapper><BorrowerInformation /></LayoutWrapper>} />
        <Route path="/lender/deals" element={<LayoutWrapper><DealsList /></LayoutWrapper>} />
        <Route path="/deals/:dealId" element={<LayoutWrapper><DealRoom /></LayoutWrapper>} />
        <Route path="/deals/:dealId/quotes/:quoteId" element={<LayoutWrapper><QuoteDetail /></LayoutWrapper>} />
        <Route path="/lender/documents" element={<LayoutWrapper><Documents /></LayoutWrapper>} />
        <Route path="/lender/messages" element={<LayoutWrapper><Messages /></LayoutWrapper>} />
        <Route path="/lender/private-equity" element={<LayoutWrapper><LenderPrivateEquity /></LayoutWrapper>} />
        <Route path="/fca-certification" element={<LayoutWrapper><FCACertification /></LayoutWrapper>} />
        <Route path="/lender/profile" element={<LayoutWrapper><LenderProfile /></LayoutWrapper>} />
        <Route path="/lender/profile/wizard" element={<LayoutWrapper><LenderProfileWizard /></LayoutWrapper>} />
        <Route path="/admin/dashboard" element={<LayoutWrapper><AdminDashboard /></LayoutWrapper>} />
        <Route path="/admin/private-equity" element={<LayoutWrapper><AdminPrivateEquity /></LayoutWrapper>} />
        <Route path="/account/settings" element={<LayoutWrapper><AccountSettings /></LayoutWrapper>} />
        <Route path="/consultant/dashboard" element={<LayoutWrapper><ConsultantDashboard /></LayoutWrapper>} />
        <Route path="/consultant/services" element={<LayoutWrapper><ConsultantDashboard defaultTab="opportunities" /></LayoutWrapper>} />
        <Route path="/consultant/quotes" element={<LayoutWrapper><ConsultantDashboard defaultTab="quotes" /></LayoutWrapper>} />
        <Route path="/consultant/appointments" element={<LayoutWrapper><ConsultantDashboard defaultTab="appointments" /></LayoutWrapper>} />
        <Route path="/consultant/profile" element={<LayoutWrapper><ConsultantProfile /></LayoutWrapper>} />
        <Route path="/consultant/profile/wizard" element={<LayoutWrapper><ConsultantProfileWizard /></LayoutWrapper>} />
        <Route path="/consultant/services/:serviceId/quote" element={<LayoutWrapper><ConsultantQuoteForm /></LayoutWrapper>} />
        <Route path="/consultant/enquiries/:enquiryId" element={<LayoutWrapper><ConsultantEnquiryDetail /></LayoutWrapper>} />
        <Route path="/consultant/enquiries/:enquiryId/quote" element={<LayoutWrapper><ConsultantEnquiryQuoteForm /></LayoutWrapper>} />
        <Route path="/consultant/appointments/:appointmentId" element={<LayoutWrapper><ConsultantAppointmentDetail /></LayoutWrapper>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;