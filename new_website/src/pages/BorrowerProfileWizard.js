import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Wizard from '../components/Wizard';
import Input from '../components/Input';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import Checkbox from '../components/Checkbox';
import Button from '../components/Button';
import Badge from '../components/Badge';
import CompanyDetails from '../components/CompanyDetails';

function BorrowerProfileWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [profileStatus, setProfileStatus] = useState(null);
  const [profileData, setProfileData] = useState(null); // Store full profile data including charges
  const [stepUpAuth, setStepUpAuth] = useState({ required: false, verified: false });
  const [stepUpPassword, setStepUpPassword] = useState('');
  const fileInputRef = useRef(null);
  const companyDetailsSaveRef = useRef(null);
  const [selectedCompanyDocuments, setSelectedCompanyDocuments] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  // Step 1: Account setup and consent
  const [step1Data, setStep1Data] = useState({
    email: '',
    mobile_number: '',
    mfa_enabled: false,
    consent_privacy: false,
    consent_terms: false,
    consent_credit_search: false,
  });

  // Step 2: Company verification
  const [step2Data, setStep2Data] = useState({
    company_number: '',
    company_name: '',
    company_search_type: 'number', // 'number' or 'name'
    company_data: null,
    company_search_results: [], // For storing search results when searching by name
    show_search_results: false, // Whether to show the search results list
    trading_address: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    confirmed: false,
  });

  // Step 3: Directors and shareholders
  const [step3Data, setStep3Data] = useState({
    directors: [],
    shareholders: [],
    applicants_required: [],
  });

  // Step 4: Applicant personal details
  const [step4Data, setStep4Data] = useState({
    applicants: [], // Array of applicant objects
  });

  // Step 5: Financial snapshot
  const [step5Data, setStep5Data] = useState({
    mode: 'quick', // 'quick' or 'detailed'
    income_total: '',
    expenditure_total: '',
    assets_total: '',
    liabilities_total: '',
    income_breakdown: [],
    expenditure_breakdown: [],
    assets_breakdown: [],
    liabilities_breakdown: [],
  });

  // Step 6: Bank data
  const [step6Data, setStep6Data] = useState({
    method: 'open_banking', // 'open_banking' or 'pdf_upload'
    open_banking_connected: false,
    open_banking_provider: '',
    accounts: [],
    pdf_statements: [],
  });

  // Step 7: Documents
  const [step7Data, setStep7Data] = useState({
    company_documents: {
      statutory_accounts: [],
      management_accounts: [],
    },
    personal_documents: {
      photo_id: [],
    },
  });

  // Step 8: Preferred Solicitor (optional)
  const [step8Data, setStep8Data] = useState({
    has_solicitor: false,
    solicitor_firm_name: '',
    solicitor_sra_number: '',
    solicitor_contact_name: '',
    solicitor_contact_email: '',
    solicitor_contact_phone: '',
  });

  const steps = [
    'Account & Consent',
    'Company Verification',
    'Directors & Shareholders',
    'Applicant Details',
    'Financial Snapshot',
    'Bank Data',
    'Documents',
    'Preferred Solicitor',
    'Review & Submit',
  ];

  useEffect(() => {
    loadProfileStatus();
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const res = await api.get('/api/borrowers/profiles/');
      const data = Array.isArray(res.data) ? res.data[0] : res.data;
      setProfileData(data);
      
      // Load solicitor data if exists
      if (data && (data.solicitor_firm_name || data.solicitor_sra_number || data.solicitor_contact_email)) {
        setStep8Data({
          has_solicitor: true,
          solicitor_firm_name: data.solicitor_firm_name || '',
          solicitor_sra_number: data.solicitor_sra_number || '',
          solicitor_contact_name: data.solicitor_contact_name || '',
          solicitor_contact_email: data.solicitor_contact_email || '',
          solicitor_contact_phone: data.solicitor_contact_phone || '',
        });
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
    }
  };

  const loadProfileStatus = async () => {
    try {
      const res = await api.get('/api/borrowers/profiles/status/');
      setProfileStatus(res.data);
      if (res.data.status === 'approved') {
        setMessage('Your profile has been approved. You can now create projects.');
      } else if (res.data.status === 'under_review') {
        setMessage('Your profile is under review. You will be notified when it is approved.');
      } else if (res.data.status === 'changes_requested') {
        setMessage('Changes have been requested. Please review and update your profile.');
      }
    } catch (err) {
      console.error('Failed to load profile status:', err);
    }
  };

  const checkStepUpAuth = async (section) => {
    // Check if step-up auth is required and not recently verified
    const lastAuth = localStorage.getItem('stepUpAuthTimestamp');
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;

    if (!lastAuth || (now - parseInt(lastAuth)) > tenMinutes) {
      setStepUpAuth({ required: true, verified: false, section });
      return false;
    }
    return true;
  };

  const verifyStepUpAuth = async () => {
    try {
      const res = await api.post('/api/auth/verify-password/', {
        password: stepUpPassword,
      });
      if (res.data.verified) {
        setStepUpAuth({ required: false, verified: true });
        localStorage.setItem('stepUpAuthTimestamp', Date.now().toString());
        setStepUpPassword('');
        return true;
      } else {
        setError('Incorrect password. Please try again.');
        return false;
      }
    } catch (err) {
      setError('Password verification failed. Please try again.');
      return false;
    }
  };

  const handleCompanySearch = async () => {
    if (step2Data.company_search_type === 'number') {
      // Search by company number - direct lookup
      if (!step2Data.company_number) {
        setError('Please enter a company number');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/api/verification/company/get_full_company_details/', {
          params: { company_number: step2Data.company_number },
        });

        if (res.data.error) {
          setError(res.data.error);
        } else {
          setStep2Data({
            ...step2Data,
            company_data: res.data,
            company_number: res.data.company_number || step2Data.company_number,
            company_name: res.data.company_name || step2Data.company_name,
            show_search_results: false,
          });
          // Initialize step3Data with directors and PSCs from company data
          const directors = (res.data.active_directors || res.data.directors || []).map(d => ({ ...d, confirmed: false }));
          const pscs = (res.data.pscs || []).map(p => ({ ...p, confirmed: false }));
          setStep3Data(prev => ({
            ...prev,
            directors: directors,
            shareholders: pscs,
            applicants_required: [],
          }));
          setMessage('Company found! Please review and confirm the details.');
        }
      } catch (err) {
        console.error('Company search error:', err);
        setError(err.response?.data?.error || 'Failed to search company. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      // Search by company name - show list of matches
      if (!step2Data.company_name) {
        setError('Please enter a company name');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/api/verification/company/search_companies/', {
          params: { company_name: step2Data.company_name },
        });

        if (res.data.error) {
          setError(res.data.error);
        } else if (res.data.companies && res.data.companies.length > 0) {
          if (res.data.companies.length === 1) {
            // Only one result - automatically select it
            await handleSelectCompany(res.data.companies[0].company_number);
          } else {
            // Multiple results - show list
            setStep2Data({
              ...step2Data,
              company_search_results: res.data.companies,
              show_search_results: true,
            });
            setMessage(`Found ${res.data.companies.length} matching companies. Please select one:`);
          }
        } else {
          setError('No companies found matching that name. Please try a different search term.');
        }
      } catch (err) {
        console.error('Company search error:', err);
        setError(err.response?.data?.error || 'Failed to search company. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSelectCompany = async (companyNumber) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/verification/company/get_full_company_details/', {
        params: { company_number: companyNumber },
      });

      if (res.data.error) {
        setError(res.data.error);
      } else {
        setStep2Data({
          ...step2Data,
          company_data: res.data,
          company_number: res.data.company_number,
          company_name: res.data.company_name,
          company_search_results: [],
          show_search_results: false,
        });
        // Initialize step3Data with directors and PSCs from company data
        const directors = (res.data.active_directors || res.data.directors || []).map(d => ({ ...d, confirmed: false }));
        const pscs = (res.data.pscs || []).map(p => ({ ...p, confirmed: false }));
        setStep3Data(prev => ({
          ...prev,
          directors: directors,
          shareholders: pscs,
          applicants_required: [],
        }));
        setMessage('Company found! Please review and confirm the details.');
      }
    } catch (err) {
      console.error('Failed to load company details:', err);
      setError(err.response?.data?.error || 'Failed to load company details. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  // Helper function to normalize names for matching
  const normalizeName = (name) => {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  // Helper function to check if two names match (fuzzy matching)
  const namesMatch = (name1, name2) => {
    const n1 = normalizeName(name1);
    const n2 = normalizeName(name2);
    // Exact match
    if (n1 === n2) return true;
    // Check if one contains the other (for cases like "John Smith" vs "John A Smith")
    if (n1.includes(n2) || n2.includes(n1)) {
      // Only match if the shorter name is at least 10 characters or if it's a clear substring
      const shorter = n1.length < n2.length ? n1 : n2;
      const longer = n1.length >= n2.length ? n1 : n2;
      // Split into words and check if all words from shorter are in longer
      const shorterWords = shorter.split(' ').filter(w => w.length > 2); // Ignore initials
      const longerWords = longer.split(' ');
      return shorterWords.every(word => longerWords.some(lw => lw.includes(word) || word.includes(lw)));
    }
    return false;
  };

  const handleDirectorsUpdate = (directors, shareholders) => {
    // Auto-flag applicants required
    const applicantsRequired = [];
    const matchedPscIds = new Set(); // Track which PSCs have been matched to directors
    
    // Process directors first
    directors.forEach(dir => {
      if (!dir.resigned_on && dir.confirmed) {
        // Check if this director is also a PSC
        let matchedPsc = null;
        let ownershipPercentage = null;
        
        shareholders.forEach((psc, pscIndex) => {
          if (namesMatch(dir.name, psc.name)) {
            matchedPsc = psc;
            matchedPscIds.add(pscIndex);
            // Get ownership percentage
            ownershipPercentage = parseFloat(
              psc.ownership_percentage || 
              psc.natures_of_control?.[0]?.percentage || 
              0
            );
          }
        });

        // Create applicant entry (one per person, even if director + PSC)
        applicantsRequired.push({
          person_id: dir.id || dir.name,
          name: dir.name,
          role: matchedPsc ? 'Director & Shareholder' : 'Director',
          ownership_percentage: ownershipPercentage,
          is_director: true,
          is_psc: !!matchedPsc,
          required: true,
        });
      }
    });

    // Process unmatched PSCs (those not matched to directors)
    shareholders.forEach((psc, pscIndex) => {
      if (matchedPscIds.has(pscIndex)) {
        return; // Skip if already matched to a director
      }

      // Check if PSC is confirmed and has >=25% ownership
      const ownership = parseFloat(
        psc.ownership_percentage || 
        psc.natures_of_control?.[0]?.percentage || 
        0
      );
      
      if (psc.confirmed && ownership >= 25) {
        // Check if this PSC matches any director (shouldn't happen, but double-check)
        const matchesDirector = directors.some(dir => 
          !dir.resigned_on && namesMatch(dir.name, psc.name)
        );

        if (!matchesDirector) {
          // This is a PSC-only person (not a director)
          applicantsRequired.push({
            person_id: psc.id || psc.name,
            name: psc.name,
            role: 'Shareholder/PSC',
            ownership_percentage: ownership,
            is_director: false,
            is_psc: true,
            required: true,
          });
        }
      }
    });

    setStep3Data({
      directors: directors,
      shareholders: shareholders,
      applicants_required: applicantsRequired,
    });
  };

  const handleConnectOpenBanking = async () => {
    setLoading(true);
    setError(null);
    try {
      // This would integrate with Open Banking provider
      // For now, simulate the connection
      const res = await api.post('/api/borrowers/profiles/connect-open-banking/', {
        provider: step6Data.open_banking_provider,
      });
      
      setStep6Data({
        ...step6Data,
        open_banking_connected: true,
        accounts: res.data.accounts || [],
        method: 'open_banking',
      });
      setMessage('Open Banking connected successfully');
    } catch (err) {
      console.error('Open Banking connection error:', err);
      setError(err.response?.data?.error || 'Failed to connect Open Banking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files, documentType, category) => {
    if (!files || files.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      formData.append('document_type', documentType);
      formData.append('category', category);

      const res = await api.post('/api/borrowers/profiles/documents/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Update step 7 data
      const updatedDocs = { ...step7Data };
      if (category === 'company') {
        if (documentType === 'statutory_accounts') {
          updatedDocs.company_documents.statutory_accounts = [
            ...updatedDocs.company_documents.statutory_accounts,
            ...res.data.documents,
          ];
        } else if (documentType === 'management_accounts') {
          updatedDocs.company_documents.management_accounts = [
            ...updatedDocs.company_documents.management_accounts,
            ...res.data.documents,
          ];
        }
      } else if (category === 'personal' && documentType === 'photo_id') {
        updatedDocs.personal_documents.photo_id = [
          ...updatedDocs.personal_documents.photo_id,
          ...res.data.documents,
        ];
      }

      setStep7Data(updatedDocs);
      setMessage(`Successfully uploaded ${files.length} file(s)`);
    } catch (err) {
      console.error('File upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload files');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForReview = async () => {
    // Validate all required consents before submission
    if (!step1Data.consent_privacy) {
      setError('You must consent to the Privacy Policy to submit your profile.');
      setStep(1); // Navigate back to consent step
      return;
    }
    if (!step1Data.consent_terms) {
      setError('You must accept the Terms and Conditions to submit your profile.');
      setStep(1); // Navigate back to consent step
      return;
    }
    if (!step1Data.consent_credit_search) {
      setError('You must consent to credit search permission to submit your profile.');
      setStep(1); // Navigate back to consent step
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const payload = {
        step1: step1Data,
        step2: step2Data,
        step3: step3Data,
        step4: step4Data,
        step5: step5Data,
        step6: step6Data,
        step7: step7Data,
      };

      const res = await api.post('/api/borrowers/profiles/submit-for-review/', payload);
      setMessage('Profile submitted for review successfully!');
      await loadProfileStatus();
      // Don't navigate away - keep wizard open so user can see confirmation
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.response?.data?.error || 'Failed to submit profile for review');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    if (step < steps.length) {
      // If on step 2 (company verification) and there are selected documents, save them
      if (step === 2 && companyDetailsSaveRef.current && selectedCompanyDocuments.length > 0) {
        setLoading(true);
        try {
          const docResults = await companyDetailsSaveRef.current();
          if (docResults.failed > 0) {
            // Show warning but allow progression
            setMessage(`Note: ${docResults.saved} document(s) saved. ${docResults.failed} document(s) could not be saved but you can continue.`);
            setTimeout(() => setMessage(null), 5000);
          } else if (docResults.saved > 0) {
            setMessage(`${docResults.saved} document(s) saved to your profile.`);
            setTimeout(() => setMessage(null), 3000);
          }
        } catch (err) {
          console.error('Error saving documents:', err);
          // Don't block progression - just log the error
          setMessage('Some documents could not be saved, but you can continue. You can try saving them again later.');
          setTimeout(() => setMessage(null), 5000);
        } finally {
          setLoading(false);
        }
      }
      
      setStep(step + 1);
      setError(null);
      // Don't clear message immediately - let it show for a bit
      setTimeout(() => setMessage(null), 3000);
      saveProgress(); // Auto-save when moving forward
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
      setError(null);
      setMessage(null);
    }
  };

  const handleStepClick = (stepNumber) => {
    // Allow navigation to any completed step or the next step
    if (stepNumber <= step + 1) {
      setStep(stepNumber);
      setError(null);
      setMessage(null);
      if (stepNumber > step) {
        saveProgress(); // Auto-save when moving forward
      }
    }
  };

  const canNavigateToStep = (stepNumber) => {
    // Allow navigation to any step up to the current step + 1
    return stepNumber <= step + 1;
  };

  const saveProgress = async () => {
    try {
      // Save all step data to backend
      const profileData = {
        email: step1Data.email,
        mobile_number: step1Data.mobile_number,
        mfa_enabled: step1Data.mfa_enabled,
        consent_privacy: step1Data.consent_privacy,
        consent_terms: step1Data.consent_terms,
        consent_credit_search: step1Data.consent_credit_search,
        company_registration_number: step2Data.company_number,
        organisation_name: step2Data.company_name,
        trading_address: step2Data.trading_address,
        primary_contact_email: step2Data.primary_contact_email,
        primary_contact_phone: step2Data.primary_contact_phone,
        company_data: step2Data.company_data,
        directors_data: step3Data.directors,
        shareholders_data: step3Data.shareholders,
        applicants_data: step4Data.applicants,
        financial_data: step5Data,
        bank_data: step6Data,
        company_documents: step7Data.company_documents,
        personal_documents: step7Data.personal_documents,
        solicitor_firm_name: step8Data.has_solicitor ? step8Data.solicitor_firm_name : '',
        solicitor_sra_number: step8Data.has_solicitor ? step8Data.solicitor_sra_number : '',
        solicitor_contact_name: step8Data.has_solicitor ? step8Data.solicitor_contact_name : '',
        solicitor_contact_email: step8Data.has_solicitor ? step8Data.solicitor_contact_email : '',
        solicitor_contact_phone: step8Data.has_solicitor ? step8Data.solicitor_contact_phone : '',
      };

      await api.patch('/api/borrowers/profiles/me/', profileData);
      // Don't show message for auto-save to avoid UI clutter
    } catch (err) {
      console.error('Failed to save progress:', err);
      // Don't show error to user for auto-save, only log it
    }
  };

  // Step-up authentication modal
  if (stepUpAuth.required && !stepUpAuth.verified) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}>
        <div style={{
          ...commonStyles.card,
          maxWidth: '400px',
          padding: theme.spacing.xl,
        }}>
          <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Step-Up Authentication Required</h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            Please enter your password to access this section.
          </p>
          <Input
            type="password"
            label="Password"
            value={stepUpPassword}
            onChange={(e) => setStepUpPassword(e.target.value)}
            style={{ marginBottom: theme.spacing.md }}
          />
          {error && (
            <p style={{ color: theme.colors.error, fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing.md }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: theme.spacing.sm }}>
            <Button
              variant="primary"
              onClick={async () => {
                const verified = await verifyStepUpAuth();
                if (verified) {
                  setError(null);
                }
              }}
            >
              Verify
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStepUpAuth({ required: false, verified: false });
                setStepUpPassword('');
                prevStep();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Wizard 
      steps={steps} 
      currentStep={step}
      onStepClick={handleStepClick}
      canNavigateToStep={canNavigateToStep}
    >
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

      {message && (
        <div style={{
          background: theme.colors.successLight,
          color: theme.colors.successDark,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
          border: `1px solid ${theme.colors.success}`,
        }}>
          {message}
        </div>
      )}

      {/* Step 1: Account setup and consent */}
      {step === 1 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Account Setup & Consent
          </h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            Please provide your contact details and confirm your consents.
          </p>

          <div style={{ display: 'grid', gap: theme.spacing.lg, marginBottom: theme.spacing.xl }}>
            <Input
              label="Email Address"
              type="email"
              value={step1Data.email}
              onChange={(e) => setStep1Data({ ...step1Data, email: e.target.value })}
              required
            />
            <Input
              label="Mobile Number"
              type="tel"
              value={step1Data.mobile_number}
              onChange={(e) => setStep1Data({ ...step1Data, mobile_number: e.target.value })}
              required
            />
            <Checkbox
              label="Enable Multi-Factor Authentication (MFA)"
              checked={step1Data.mfa_enabled}
              onChange={(e) => setStep1Data({ ...step1Data, mfa_enabled: e.target.checked })}
            />
          </div>

          <div style={{
            ...commonStyles.card,
            padding: theme.spacing.lg,
            marginBottom: theme.spacing.xl,
            background: theme.colors.gray50,
            border: `2px solid ${(!step1Data.consent_privacy || !step1Data.consent_terms || !step1Data.consent_credit_search) ? theme.colors.warning : theme.colors.gray200}`,
          }}>
            <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Required Consents</h3>
            <p style={{ 
              fontSize: theme.typography.fontSize.sm, 
              color: theme.colors.textSecondary,
              marginBottom: theme.spacing.md,
            }}>
              You must agree to all of the following to proceed with your profile setup.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: theme.spacing.sm }}>
                <Checkbox
                  label=""
                  checked={step1Data.consent_privacy}
                  onChange={(e) => setStep1Data({ ...step1Data, consent_privacy: e.target.checked })}
                  required
                />
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    cursor: 'pointer',
                    fontWeight: step1Data.consent_privacy ? theme.typography.fontWeight.normal : theme.typography.fontWeight.medium,
                  }}>
                    I consent to the{' '}
                    <a 
                      href="/privacy-policy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: theme.colors.primary, textDecoration: 'underline' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </a>
                  </label>
                  {!step1Data.consent_privacy && (
                    <p style={{ 
                      margin: `${theme.spacing.xs} 0 0 0`, 
                      fontSize: theme.typography.fontSize.xs, 
                      color: theme.colors.error 
                    }}>
                      This consent is required
                    </p>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'start', gap: theme.spacing.sm }}>
                <Checkbox
                  label=""
                  checked={step1Data.consent_terms}
                  onChange={(e) => setStep1Data({ ...step1Data, consent_terms: e.target.checked })}
                  required
                />
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    cursor: 'pointer',
                    fontWeight: step1Data.consent_terms ? theme.typography.fontWeight.normal : theme.typography.fontWeight.medium,
                  }}>
                    I accept the{' '}
                    <a 
                      href="/terms-and-conditions" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: theme.colors.primary, textDecoration: 'underline' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms and Conditions
                    </a>
                  </label>
                  {!step1Data.consent_terms && (
                    <p style={{ 
                      margin: `${theme.spacing.xs} 0 0 0`, 
                      fontSize: theme.typography.fontSize.xs, 
                      color: theme.colors.error 
                    }}>
                      This consent is required
                    </p>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'start', gap: theme.spacing.sm }}>
                <Checkbox
                  label=""
                  checked={step1Data.consent_credit_search}
                  onChange={(e) => setStep1Data({ ...step1Data, consent_credit_search: e.target.checked })}
                  required
                />
                <div style={{ flex: 1 }}>
                  <label style={{ cursor: 'pointer' }}>
                    I consent to credit search permission
                  </label>
                  <p style={{ 
                    margin: `${theme.spacing.xs} 0 0 0`, 
                    fontSize: theme.typography.fontSize.xs, 
                    color: theme.colors.textSecondary 
                  }}>
                    We may perform credit checks as part of the application process
                  </p>
                  {!step1Data.consent_credit_search && (
                    <p style={{ 
                      margin: `${theme.spacing.xs} 0 0 0`, 
                      fontSize: theme.typography.fontSize.xs, 
                      color: theme.colors.error 
                    }}>
                      This consent is required
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: theme.spacing.xl }}>
            <Button
              variant="primary"
              onClick={nextStep}
              disabled={!step1Data.consent_privacy || !step1Data.consent_terms || !step1Data.consent_credit_search}
            >
              Next: Company Verification
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Company verification */}
      {step === 2 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Company Verification (UK Only)
          </h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            Search for your company using Companies House.
          </p>

          <div style={{ marginBottom: theme.spacing.lg }}>
            <Select
              label="Search By"
              value={step2Data.company_search_type}
              onChange={(e) => setStep2Data({ ...step2Data, company_search_type: e.target.value })}
            >
              <option value="number">Company Number</option>
              <option value="name">Company Name</option>
            </Select>

            {step2Data.company_search_type === 'number' ? (
              <Input
                label="Company Number"
                value={step2Data.company_number}
                onChange={(e) => setStep2Data({ ...step2Data, company_number: e.target.value })}
                placeholder="e.g., 12345678"
                style={{ marginTop: theme.spacing.md }}
              />
            ) : (
              <Input
                label="Company Name"
                value={step2Data.company_name}
                onChange={(e) => setStep2Data({ ...step2Data, company_name: e.target.value })}
                placeholder="e.g., Example Company Ltd"
                style={{ marginTop: theme.spacing.md }}
              />
            )}

            <Button
              variant="primary"
              onClick={handleCompanySearch}
              loading={loading}
              style={{ marginTop: theme.spacing.md }}
            >
              Search Company
            </Button>
          </div>

          {/* Search Results List - shown when searching by name and multiple matches found */}
          {step2Data.show_search_results && step2Data.company_search_results.length > 0 && (
            <div style={{ marginBottom: theme.spacing.xl }}>
              <h3 style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
                margin: `0 0 ${theme.spacing.md} 0`,
              }}>
                Select Company ({step2Data.company_search_results.length} found)
              </h3>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: theme.spacing.sm,
                maxHeight: '400px',
                overflowY: 'auto',
                border: `1px solid ${theme.colors.gray200}`,
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing.md,
                background: theme.colors.gray50,
              }}>
                {step2Data.company_search_results.map((company) => (
                  <div
                    key={company.company_number}
                    onClick={() => handleSelectCompany(company.company_number)}
                    style={{
                      padding: theme.spacing.md,
                      border: `1px solid ${theme.colors.gray200}`,
                      borderRadius: theme.borderRadius.md,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: theme.colors.white,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = theme.colors.primaryLight;
                      e.currentTarget.style.borderColor = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = theme.colors.white;
                      e.currentTarget.style.borderColor = theme.colors.gray200;
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{
                          margin: 0,
                          fontWeight: theme.typography.fontWeight.semibold,
                          fontSize: theme.typography.fontSize.base,
                          color: theme.colors.textPrimary,
                        }}>
                          {company.company_name}
                        </p>
                        <p style={{
                          margin: `${theme.spacing.xs} 0 0 0`,
                          fontSize: theme.typography.fontSize.sm,
                          color: theme.colors.textSecondary,
                        }}>
                          Company Number: {company.company_number}
                        </p>
                        {company.address_snippet && (
                          <p style={{
                            margin: `${theme.spacing.xs} 0 0 0`,
                            fontSize: theme.typography.fontSize.sm,
                            color: theme.colors.textSecondary,
                          }}>
                            {company.address_snippet}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.xs, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Badge variant={company.company_status === 'active' ? 'success' : company.company_status === 'dissolved' ? 'warning' : 'error'}>
                            {company.company_status || 'Unknown'}
                          </Badge>
                          {company.company_type && (
                            <Badge variant="info">
                              {company.company_type}
                            </Badge>
                          )}
                          {company.date_of_creation && (
                            <span style={{
                              fontSize: theme.typography.fontSize.xs,
                              color: theme.colors.textSecondary,
                            }}>
                              Incorporated: {new Date(company.date_of_creation).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCompany(company.company_number);
                        }}
                        style={{ marginLeft: theme.spacing.md }}
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step2Data.company_data && (
            <div style={{ marginBottom: theme.spacing.xl }}>
              <CompanyDetails 
                companyNumber={step2Data.company_data.company_number}
                saveSelectedDocumentsRef={companyDetailsSaveRef}
                onSelectedDocumentsChange={(documents) => {
                  setSelectedCompanyDocuments(documents);
                }}
                onAutoImport={async (result) => {
                  // Refresh profile status and data after auto-import
                  await loadProfileStatus();
                  await loadProfileData(); // Refresh to get charges_summary
                  setMessage('Company data imported successfully! Directors, shareholders, accounts, and charges have been automatically saved.');
                  // Update step2Data with imported data
                  if (result && result.results) {
                    setStep2Data(prev => ({
                      ...prev,
                      confirmed: true,
                      company_data: {
                        ...prev.company_data,
                        charges_summary: result.results.charges_summary || prev.company_data?.charges_summary,
                      },
                    }));
                    // Update step3Data with imported directors and shareholders
                    try {
                      const profileRes = await api.get('/api/borrowers/profiles/');
                      const profileData = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data;
                      if (profileData) {
                        setProfileData(profileData); // Update profileData state
                        setStep3Data({
                          directors: profileData.directors_data || [],
                          shareholders: profileData.shareholders_data || [],
                          applicants_required: profileData.applicants_required || [],
                        });
                      }
                    } catch (err) {
                      console.error('Failed to refresh profile data:', err);
                    }
                  }
                }}
              />
              
              <div style={{ marginTop: theme.spacing.lg }}>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Additional Information</h3>
                <Input
                  label="Trading Address (if different)"
                  value={step2Data.trading_address}
                  onChange={(e) => setStep2Data({ ...step2Data, trading_address: e.target.value })}
                  style={{ marginBottom: theme.spacing.md }}
                />
                <Input
                  label="Primary Contact Email"
                  type="email"
                  value={step2Data.primary_contact_email}
                  onChange={(e) => setStep2Data({ ...step2Data, primary_contact_email: e.target.value })}
                  style={{ marginBottom: theme.spacing.md }}
                />
                <Input
                  label="Primary Contact Phone"
                  type="tel"
                  value={step2Data.primary_contact_phone}
                  onChange={(e) => setStep2Data({ ...step2Data, primary_contact_phone: e.target.value })}
                />
              </div>

              <div style={{ marginTop: theme.spacing.lg }}>
                <Checkbox
                  label="I confirm these company details are correct"
                  checked={step2Data.confirmed}
                  onChange={(e) => setStep2Data({ ...step2Data, confirmed: e.target.checked })}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (step2Data.confirmed) {
                  nextStep();
                } else {
                  setError('Please confirm the company details before proceeding');
                }
              }}
              disabled={!step2Data.confirmed}
            >
              Next: Directors & Shareholders
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Directors and shareholders */}
      {step === 3 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Directors & Shareholders (>=25%)
          </h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            Review and confirm directors and persons with significant control. All directors and shareholders with 25%+ ownership will be required to complete applicant details.
          </p>

          {step2Data.company_data && (() => {
            // Match PSCs with directors
            // API returns 'active_directors' and 'pscs'
            const directors = step2Data.company_data.active_directors || step2Data.company_data.directors || [];
            const pscs = step2Data.company_data.pscs || [];
            const matchedPscIndices = new Set();
            
            // Find which PSCs match directors
            directors.forEach((director, dirIndex) => {
              pscs.forEach((psc, pscIndex) => {
                if (namesMatch(director.name, psc.name)) {
                  matchedPscIndices.add(pscIndex);
                }
              });
            });

            // Separate matched and unmatched PSCs
            const matchedPscs = pscs.filter((_, index) => matchedPscIndices.has(index));
            const unmatchedPscs = pscs.filter((_, index) => !matchedPscIndices.has(index));

            return (
              <>
                {/* Directors (with shareholding if they're also PSCs) */}
                {directors.length > 0 && (
                  <div style={{ marginBottom: theme.spacing.xl }}>
                    <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Directors</h3>
                    <p style={{ 
                      fontSize: theme.typography.fontSize.sm, 
                      color: theme.colors.textSecondary,
                      marginBottom: theme.spacing.md,
                    }}>
                      All directors are required to complete applicant details. If a director is also a shareholder, please confirm their shareholding percentage.
                    </p>
                    <div style={{ display: 'grid', gap: theme.spacing.md }}>
                      {directors.map((director, index) => {
                        // Find matching PSC for this director
                        const matchingPsc = matchedPscs.find(psc => namesMatch(director.name, psc.name));
                        const ownershipPercentage = matchingPsc 
                          ? parseFloat(matchingPsc.ownership_percentage || matchingPsc.natures_of_control?.[0]?.percentage || 0)
                          : null;

                        return (
                          <div key={index} style={{
                            ...commonStyles.card,
                            padding: theme.spacing.md,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: theme.spacing.sm,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.medium }}>
                                  {director.name}
                                </p>
                                {director.nationality && (
                                  <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                    Nationality: {director.nationality}
                                  </p>
                                )}
                                {matchingPsc && (
                                  <div style={{ marginTop: theme.spacing.xs }}>
                                    <Badge variant="info" style={{ marginRight: theme.spacing.xs }}>
                                      Also a Shareholder
                                    </Badge>
                                  </div>
                                )}
                                <Badge variant="warning" style={{ marginTop: theme.spacing.xs }}>
                                  Applicant Required
                                </Badge>
                              </div>
                              <Checkbox
                                label="Confirm"
                                checked={director.confirmed || false}
                                onChange={(e) => {
                                  const updated = [...directors];
                                  updated[index].confirmed = e.target.checked;
                                  setStep2Data({
                                    ...step2Data,
                                    company_data: { ...step2Data.company_data, directors: updated },
                                  });
                                  handleDirectorsUpdate(updated, pscs);
                                }}
                              />
                            </div>
                            
                            {/* Show shareholding input if director is also a PSC */}
                            {matchingPsc && (
                              <div style={{ 
                                marginTop: theme.spacing.sm, 
                                padding: theme.spacing.sm, 
                                background: theme.colors.gray50,
                                borderRadius: theme.borderRadius.md,
                              }}>
                                <label style={{ 
                                  fontSize: theme.typography.fontSize.sm, 
                                  fontWeight: theme.typography.fontWeight.medium,
                                  display: 'block',
                                  marginBottom: theme.spacing.xs,
                                }}>
                                  Shareholding Percentage:
                                </label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  placeholder="Enter %"
                                  value={matchingPsc.ownership_percentage || ownershipPercentage || ''}
                                  onChange={(e) => {
                                    const updatedPscs = [...pscs];
                                    const pscIndex = pscs.findIndex(p => namesMatch(p.name, director.name));
                                    if (pscIndex >= 0) {
                                      updatedPscs[pscIndex].ownership_percentage = parseFloat(e.target.value) || 0;
                                      // Update both step2Data and step3Data
                                      setStep2Data({
                                        ...step2Data,
                                        company_data: { ...step2Data.company_data, pscs: updatedPscs },
                                      });
                                      setStep3Data(prev => ({
                                        ...prev,
                                        shareholders: updatedPscs,
                                      }));
                                      handleDirectorsUpdate(directors, updatedPscs);
                                    }
                                  }}
                                  style={{ width: '150px' }}
                                />
                                <p style={{ 
                                  margin: `${theme.spacing.xs} 0 0 0`, 
                                  fontSize: theme.typography.fontSize.xs, 
                                  color: theme.colors.textSecondary,
                                }}>
                                  This person will be required to complete applicant details as both Director and Shareholder.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Unmatched PSCs (those who are not directors) */}
                {unmatchedPscs.length > 0 && (
                  <div style={{ marginBottom: theme.spacing.xl }}>
                    <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Additional Shareholders (Not Directors)</h3>
                    <p style={{ 
                      fontSize: theme.typography.fontSize.sm, 
                      color: theme.colors.textSecondary,
                      marginBottom: theme.spacing.md,
                    }}>
                      The following persons have significant control but are not directors. If they own 25% or more, you can choose to add them as applicants.
                    </p>
                    <div style={{ display: 'grid', gap: theme.spacing.md }}>
                      {unmatchedPscs.map((psc, index) => {
                        // Find the original index in the full pscs array
                        const originalIndex = pscs.findIndex(p => p.name === psc.name);
                        const ownership = parseFloat(
                          psc.ownership_percentage || 
                          psc.natures_of_control?.[0]?.percentage || 
                          0
                        );
                        const isRequired = ownership >= 25;
                        
                        return (
                          <div key={originalIndex} style={{
                            ...commonStyles.card,
                            padding: theme.spacing.md,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: theme.spacing.sm,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.medium }}>
                                  {psc.name}
                                </p>
                                <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                  Current Ownership: {ownership}%
                                </p>
                                {isRequired && (
                                  <Badge variant="warning" style={{ marginTop: theme.spacing.xs }}>
                                    Applicant Required (>=25%)
                                  </Badge>
                                )}
                                {!isRequired && ownership > 0 && (
                                  <Badge variant="info" style={{ marginTop: theme.spacing.xs }}>
                                    Ownership: {ownership}% (below 25% threshold)
                                  </Badge>
                                )}
                              </div>
                              <Checkbox
                                label="Add as Applicant"
                                checked={psc.confirmed || false}
                                onChange={(e) => {
                                  const updated = [...pscs];
                                  updated[originalIndex].confirmed = e.target.checked;
                                  // Update both step2Data and step3Data
                                  setStep2Data({
                                    ...step2Data,
                                    company_data: { ...step2Data.company_data, pscs: updated },
                                  });
                                  setStep3Data(prev => ({
                                    ...prev,
                                    shareholders: updated,
                                  }));
                                  handleDirectorsUpdate(directors, updated);
                                }}
                              />
                            </div>
                            
                            {/* Ownership percentage input */}
                            <div style={{ 
                              marginTop: theme.spacing.sm, 
                              padding: theme.spacing.sm, 
                              background: theme.colors.gray50,
                              borderRadius: theme.borderRadius.md,
                            }}>
                              <label style={{ 
                                fontSize: theme.typography.fontSize.sm, 
                                fontWeight: theme.typography.fontWeight.medium,
                                display: 'block',
                                marginBottom: theme.spacing.xs,
                              }}>
                                Shareholding Percentage:
                              </label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                placeholder="Enter %"
                                value={psc.ownership_percentage || ownership || ''}
                                onChange={(e) => {
                                  const updated = [...pscs];
                                  updated[originalIndex].ownership_percentage = parseFloat(e.target.value) || 0;
                                  // Update both step2Data and step3Data
                                  setStep2Data({
                                    ...step2Data,
                                    company_data: { ...step2Data.company_data, pscs: updated },
                                  });
                                  setStep3Data(prev => ({
                                    ...prev,
                                    shareholders: updated,
                                  }));
                                  handleDirectorsUpdate(directors, updated);
                                }}
                                style={{ width: '150px' }}
                              />
                              {parseFloat(psc.ownership_percentage || ownership || 0) >= 25 && (
                                <p style={{ 
                                  margin: `${theme.spacing.xs} 0 0 0`, 
                                  fontSize: theme.typography.fontSize.xs, 
                                  color: theme.colors.warning,
                                  fontWeight: theme.typography.fontWeight.medium,
                                }}>
                                  This person owns 25% or more and will be required to complete applicant details.
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Applicants Required Summary */}
          {step3Data.applicants_required.length > 0 && (
            <div style={{
              ...commonStyles.card,
              padding: theme.spacing.md,
              background: theme.colors.warningLight,
              marginBottom: theme.spacing.lg,
            }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0` }}>Applicants Required</h3>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                The following {step3Data.applicants_required.length} person(s) will need to complete applicant details in the next step:
              </p>
              <ul style={{ margin: `${theme.spacing.sm} 0 0 0`, paddingLeft: theme.spacing.lg }}>
                {step3Data.applicants_required.map((app, idx) => (
                  <li key={idx} style={{ marginBottom: theme.spacing.xs }}>
                    {app.name} ({app.role})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button
              variant="primary"
              onClick={nextStep}
              disabled={step3Data.applicants_required.length === 0}
            >
              Next: Applicant Details
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Applicant personal details */}
      {step === 4 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Applicant Personal Details
          </h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            Complete details for each required applicant.
          </p>

          {step3Data.applicants_required.map((applicant, applicantIndex) => {
            const applicantData = step4Data.applicants[applicantIndex] || {
              person_id: applicant.person_id,
              name: applicant.name,
              role: applicant.role,
              first_name: '',
              last_name: '',
              date_of_birth: '',
              nationality: '',
              email: '',
              phone: '',
              current_address: '',
              previous_address: '',
              employment_status: '',
              occupation: '',
              employment_start_date: '',
              net_monthly_income: '',
              experience_tier: '',
              adverse_credit_band: '',
              source_of_deposit: '',
              exit_strategy: '',
            };

            return (
              <div key={applicantIndex} style={{
                ...commonStyles.card,
                padding: theme.spacing.xl,
                marginBottom: theme.spacing.xl,
              }}>
                <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>
                  {applicant.name} - {applicant.role}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
                  <Input
                    label="First Name"
                    value={applicantData.first_name}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, first_name: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                    required
                  />
                  <Input
                    label="Last Name"
                    value={applicantData.last_name}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, last_name: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                    required
                  />
                  <Input
                    label="Date of Birth"
                    type="date"
                    value={applicantData.date_of_birth}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, date_of_birth: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                    required
                  />
                  <Input
                    label="Nationality"
                    value={applicantData.nationality}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, nationality: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={applicantData.email}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, email: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    value={applicantData.phone}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, phone: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  />
                </div>

                <h4 style={{ margin: `${theme.spacing.lg} 0 ${theme.spacing.md} 0` }}>Address</h4>
                <div style={{ marginBottom: theme.spacing.lg }}>
                  <Textarea
                    label="Current Address"
                    value={applicantData.current_address}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, current_address: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                    rows={3}
                    required
                  />
                  <Textarea
                    label="Previous Address (only if current address < 3 years)"
                    value={applicantData.previous_address}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, previous_address: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                    rows={3}
                    style={{ marginTop: theme.spacing.md }}
                  />
                </div>

                <h4 style={{ margin: `${theme.spacing.lg} 0 ${theme.spacing.md} 0` }}>Employment</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
                  <Select
                    label="Employment Status"
                    value={applicantData.employment_status}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, employment_status: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="employed">Employed</option>
                    <option value="self_employed">Self-Employed</option>
                    <option value="retired">Retired</option>
                    <option value="unemployed">Unemployed</option>
                  </Select>
                  <Input
                    label="Occupation"
                    value={applicantData.occupation}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, occupation: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  />
                  <Input
                    label="Employment Start Date"
                    type="date"
                    value={applicantData.employment_start_date}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, employment_start_date: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  />
                  <Input
                    label="Net Monthly Income"
                    type="number"
                    value={applicantData.net_monthly_income}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, net_monthly_income: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  />
                </div>

                <h4 style={{ margin: `${theme.spacing.lg} 0 ${theme.spacing.md} 0` }}>Underwriting Flags</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.md }}>
                  <Select
                    label="Borrower Experience Tier"
                    value={applicantData.experience_tier}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, experience_tier: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="0">0 deals</option>
                    <option value="1-3">1-3 deals</option>
                    <option value="4-10">4-10 deals</option>
                    <option value="10+">10+ deals</option>
                  </Select>
                  <Select
                    label="Adverse Credit Band"
                    value={applicantData.adverse_credit_band}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, adverse_credit_band: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="none">None</option>
                    <option value="minor">Minor</option>
                    <option value="significant">Significant</option>
                  </Select>
                  <Select
                    label="Source of Deposit"
                    value={applicantData.source_of_deposit}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, source_of_deposit: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="savings">Savings</option>
                    <option value="sale_of_property">Sale of Property</option>
                    <option value="gift">Gift</option>
                    <option value="inheritance">Inheritance</option>
                    <option value="other">Other</option>
                  </Select>
                  <Select
                    label="Intended Exit Strategy"
                    value={applicantData.exit_strategy}
                    onChange={(e) => {
                      const updated = [...step4Data.applicants];
                      updated[applicantIndex] = { ...applicantData, exit_strategy: e.target.value };
                      setStep4Data({ ...step4Data, applicants: updated });
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="sale">Sale</option>
                    <option value="refinance">Refinance</option>
                    <option value="rental_income">Rental Income</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={nextStep}>
              Next: Financial Snapshot
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Financial snapshot */}
      {step === 5 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Financial Snapshot
          </h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            Provide your financial information. You can choose quick mode (totals only) or detailed mode (line-item breakdown).
          </p>

          <div style={{ marginBottom: theme.spacing.lg }}>
            <Select
              label="Mode"
              value={step5Data.mode}
              onChange={(e) => setStep5Data({ ...step5Data, mode: e.target.value })}
            >
              <option value="quick">Quick Mode (Totals Only)</option>
              <option value="detailed">Detailed Mode (Line-Item Breakdown)</option>
            </Select>
          </div>

          {step5Data.mode === 'quick' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
              <Input
                label="Total Income"
                type="number"
                value={step5Data.income_total}
                onChange={(e) => setStep5Data({ ...step5Data, income_total: e.target.value })}
              />
              <Input
                label="Total Expenditure"
                type="number"
                value={step5Data.expenditure_total}
                onChange={(e) => setStep5Data({ ...step5Data, expenditure_total: e.target.value })}
              />
              <Input
                label="Total Assets"
                type="number"
                value={step5Data.assets_total}
                onChange={(e) => setStep5Data({ ...step5Data, assets_total: e.target.value })}
              />
              <Input
                label="Total Liabilities"
                type="number"
                value={step5Data.liabilities_total}
                onChange={(e) => setStep5Data({ ...step5Data, liabilities_total: e.target.value })}
              />
            </div>
          ) : (
            <div>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Income Breakdown</h3>
              <div style={{ marginBottom: theme.spacing.lg }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep5Data({
                      ...step5Data,
                      income_breakdown: [...step5Data.income_breakdown, { description: '', amount: '' }],
                    });
                  }}
                >
                  + Add Income Item
                </Button>
                {step5Data.income_breakdown.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...step5Data.income_breakdown];
                        updated[index].description = e.target.value;
                        setStep5Data({ ...step5Data, income_breakdown: updated });
                      }}
                      style={{ flex: 1 }}
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) => {
                        const updated = [...step5Data.income_breakdown];
                        updated[index].amount = e.target.value;
                        setStep5Data({ ...step5Data, income_breakdown: updated });
                      }}
                      style={{ width: '150px' }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStep5Data({
                          ...step5Data,
                          income_breakdown: step5Data.income_breakdown.filter((_, i) => i !== index),
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <h3 style={{ margin: `${theme.spacing.lg} 0 ${theme.spacing.md} 0` }}>Expenditure Breakdown</h3>
              <div style={{ marginBottom: theme.spacing.lg }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep5Data({
                      ...step5Data,
                      expenditure_breakdown: [...step5Data.expenditure_breakdown, { description: '', amount: '' }],
                    });
                  }}
                >
                  + Add Expenditure Item
                </Button>
                {step5Data.expenditure_breakdown.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...step5Data.expenditure_breakdown];
                        updated[index].description = e.target.value;
                        setStep5Data({ ...step5Data, expenditure_breakdown: updated });
                      }}
                      style={{ flex: 1 }}
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) => {
                        const updated = [...step5Data.expenditure_breakdown];
                        updated[index].amount = e.target.value;
                        setStep5Data({ ...step5Data, expenditure_breakdown: updated });
                      }}
                      style={{ width: '150px' }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStep5Data({
                          ...step5Data,
                          expenditure_breakdown: step5Data.expenditure_breakdown.filter((_, i) => i !== index),
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <h3 style={{ margin: `${theme.spacing.lg} 0 ${theme.spacing.md} 0` }}>Assets Breakdown</h3>
              <div style={{ marginBottom: theme.spacing.lg }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep5Data({
                      ...step5Data,
                      assets_breakdown: [...step5Data.assets_breakdown, { description: '', amount: '' }],
                    });
                  }}
                >
                  + Add Asset Item
                </Button>
                {step5Data.assets_breakdown.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...step5Data.assets_breakdown];
                        updated[index].description = e.target.value;
                        setStep5Data({ ...step5Data, assets_breakdown: updated });
                      }}
                      style={{ flex: 1 }}
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) => {
                        const updated = [...step5Data.assets_breakdown];
                        updated[index].amount = e.target.value;
                        setStep5Data({ ...step5Data, assets_breakdown: updated });
                      }}
                      style={{ width: '150px' }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStep5Data({
                          ...step5Data,
                          assets_breakdown: step5Data.assets_breakdown.filter((_, i) => i !== index),
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <h3 style={{ margin: `${theme.spacing.lg} 0 ${theme.spacing.md} 0` }}>Liabilities Breakdown</h3>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep5Data({
                      ...step5Data,
                      liabilities_breakdown: [...step5Data.liabilities_breakdown, { description: '', amount: '' }],
                    });
                  }}
                >
                  + Add Liability Item
                </Button>
                {step5Data.liabilities_breakdown.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...step5Data.liabilities_breakdown];
                        updated[index].description = e.target.value;
                        setStep5Data({ ...step5Data, liabilities_breakdown: updated });
                      }}
                      style={{ flex: 1 }}
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) => {
                        const updated = [...step5Data.liabilities_breakdown];
                        updated[index].amount = e.target.value;
                        setStep5Data({ ...step5Data, liabilities_breakdown: updated });
                      }}
                      style={{ width: '150px' }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStep5Data({
                          ...step5Data,
                          liabilities_breakdown: step5Data.liabilities_breakdown.filter((_, i) => i !== index),
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company Charges Display */}
          {((profileData?.charges_summary && profileData.charges_summary.total_charges > 0) || 
           (step2Data.company_data?.charges_summary && step2Data.company_data.charges_summary.total_charges > 0)) && (
            <div style={{
              ...commonStyles.card,
              marginTop: theme.spacing.xl,
              padding: theme.spacing.lg,
              background: theme.colors.gray50,
            }}>
              <h3 style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
                marginBottom: theme.spacing.md,
              }}>
                Company Charges (from Companies House)
              </h3>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.textSecondary,
                marginBottom: theme.spacing.md,
              }}>
                The following charges are registered against your company. These are automatically included in your financial profile and will be visible to lenders when you submit applications.
              </p>
              {(() => {
                const charges = profileData?.charges_summary || step2Data.company_data?.charges_summary || {};
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Total Charges</p>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                        {charges.total_charges || 0}
                      </p>
                    </div>
                    {charges.active_charges > 0 && (
                      <div>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Active Charges</p>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.warning }}>
                          {charges.active_charges || 0}
                        </p>
                      </div>
                    )}
                    {charges.satisfied_charges > 0 && (
                      <div>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Satisfied Charges</p>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.success }}>
                          {charges.satisfied_charges || 0}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
              {(() => {
                const charges = profileData?.charges_summary || step2Data.company_data?.charges_summary || {};
                if (charges.charges_summary?.active && charges.charges_summary.active.length > 0) {
                  return (
                    <div style={{ marginTop: theme.spacing.md }}>
                      <h4 style={{
                        fontSize: theme.typography.fontSize.base,
                        fontWeight: theme.typography.fontWeight.semibold,
                        marginBottom: theme.spacing.sm,
                        color: theme.colors.warning,
                      }}>
                        Active Charges
                      </h4>
                      <div style={{ display: 'grid', gap: theme.spacing.sm }}>
                        {charges.charges_summary.active.slice(0, 3).map((charge, idx) => (
                          <div key={idx} style={{
                            padding: theme.spacing.sm,
                            background: theme.colors.white,
                            borderRadius: theme.borderRadius.md,
                            borderLeft: `3px solid ${theme.colors.warning}`,
                          }}>
                            <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.medium, fontSize: theme.typography.fontSize.sm }}>
                              {charge.charge_code || charge.charge_number || `Charge ${idx + 1}`}
                            </p>
                            {charge.created_on && (
                              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                                Created: {new Date(charge.created_on).toLocaleDateString('en-GB')}
                              </p>
                            )}
                          </div>
                        ))}
                        {charges.charges_summary.active.length > 3 && (
                          <p style={{ 
                            margin: `${theme.spacing.xs} 0 0 0`, 
                            fontSize: theme.typography.fontSize.xs, 
                            color: theme.colors.textSecondary,
                            fontStyle: 'italic',
                          }}>
                            ... and {charges.charges_summary.active.length - 3} more active charge(s)
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={nextStep}>
              Next: Bank Data
            </Button>
          </div>
        </div>
      )}

      {/* Step 6: Bank data */}
      {step === 6 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Bank Data
          </h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            Connect your bank account via Open Banking or upload PDF statements.
          </p>

          <div style={{ marginBottom: theme.spacing.xl }}>
            <Select
              label="Method"
              value={step6Data.method}
              onChange={(e) => setStep6Data({ ...step6Data, method: e.target.value })}
            >
              <option value="open_banking">Open Banking (Recommended)</option>
              <option value="pdf_upload">Upload PDF Statements</option>
            </Select>
          </div>

          {step6Data.method === 'open_banking' ? (
            <div>
              {!step6Data.open_banking_connected ? (
                <div>
                  <p style={{ marginBottom: theme.spacing.md }}>
                    Connect your business bank account via Open Banking. We support business accounts first, with personal accounts as an option if business accounts are unavailable.
                  </p>
                  <Select
                    label="Bank Provider"
                    value={step6Data.open_banking_provider}
                    onChange={(e) => setStep6Data({ ...step6Data, open_banking_provider: e.target.value })}
                    style={{ marginBottom: theme.spacing.md }}
                  >
                    <option value="">Select your bank...</option>
                    <option value="barclays">Barclays</option>
                    <option value="hsbc">HSBC</option>
                    <option value="lloyds">Lloyds</option>
                    <option value="natwest">NatWest</option>
                    <option value="santander">Santander</option>
                    <option value="other">Other</option>
                  </Select>
                  <Button
                    variant="primary"
                    onClick={handleConnectOpenBanking}
                    loading={loading}
                    disabled={!step6Data.open_banking_provider}
                  >
                    Connect Open Banking
                  </Button>
                </div>
              ) : (
                <div style={{
                  ...commonStyles.card,
                  padding: theme.spacing.lg,
                  background: theme.colors.successLight,
                }}>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.medium }}>
                    ✓ Open Banking Connected
                  </p>
                  <p style={{ margin: `${theme.spacing.sm} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>
                    {step6Data.accounts.length} account(s) connected
                  </p>
                  {step6Data.accounts.map((account, index) => (
                    <div key={index} style={{
                      marginTop: theme.spacing.md,
                      padding: theme.spacing.md,
                      background: theme.colors.white,
                      borderRadius: theme.borderRadius.md,
                    }}>
                      <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.medium }}>
                        {account.account_name || 'Account'} - ****{account.account_number?.slice(-4) || '****'}
                      </p>
                      <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                        Balance: £{parseFloat(account.balance || 0).toLocaleString('en-GB')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: theme.spacing.md }}>
                Upload your last 3 months of bank statements (PDF format only).
              </p>
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files, 'bank_statement', 'bank');
                  }
                }}
                style={{
                  padding: theme.spacing.xl,
                  border: `2px dashed ${dragActive ? theme.colors.primary : theme.colors.gray300}`,
                  borderRadius: theme.borderRadius.md,
                  textAlign: 'center',
                  background: dragActive ? theme.colors.primaryLight : theme.colors.gray50,
                  cursor: 'pointer',
                  marginBottom: theme.spacing.md,
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files, 'bank_statement', 'bank');
                    }
                  }}
                />
                <div style={{ fontSize: '48px', marginBottom: theme.spacing.sm }}>📄</div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                  Drag and drop PDF statements here
                </p>
                <p style={{ margin: 0, color: theme.colors.textSecondary }}>
                  or click to browse • PDF only • Max 10MB per file
                </p>
              </div>
              {step6Data.pdf_statements.length > 0 && (
                <div>
                  <p style={{ marginBottom: theme.spacing.sm }}>Uploaded Statements:</p>
                  {step6Data.pdf_statements.map((file, index) => (
                    <div key={index} style={{
                      padding: theme.spacing.sm,
                      background: theme.colors.gray50,
                      borderRadius: theme.borderRadius.md,
                      marginBottom: theme.spacing.xs,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span>{file.name || `Statement ${index + 1}`}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStep6Data({
                            ...step6Data,
                            pdf_statements: step6Data.pdf_statements.filter((_, i) => i !== index),
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={nextStep}>
              Next: Documents
            </Button>
          </div>
        </div>
      )}

      {/* Step 7: Documents */}
      {step === 7 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Documents
          </h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            Upload required company and personal documents. You can mark documents as "not available yet" with a reason.
          </p>

          {/* Company Documents */}
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Company Documents</h3>
            
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h4 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.base }}>
                Statutory Accounts (Last 2 Years)
              </h4>
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files, 'statutory_accounts', 'company');
                  }
                }}
                style={{
                  padding: theme.spacing.lg,
                  border: `2px dashed ${dragActive ? theme.colors.primary : theme.colors.gray300}`,
                  borderRadius: theme.borderRadius.md,
                  textAlign: 'center',
                  background: dragActive ? theme.colors.primaryLight : theme.colors.gray50,
                  cursor: 'pointer',
                  marginBottom: theme.spacing.sm,
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = '.pdf,.jpg,.jpeg,.png';
                  input.onchange = (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files, 'statutory_accounts', 'company');
                    }
                  };
                  input.click();
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: theme.spacing.xs }}>📎</div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                  Drag and drop or click to upload • PDF, JPG, PNG • Max 10MB per file
                </p>
              </div>
              {step7Data.company_documents.statutory_accounts.length > 0 && (
                <div style={{ marginTop: theme.spacing.sm }}>
                  {step7Data.company_documents.statutory_accounts.map((doc, index) => (
                    <div key={index} style={{
                      padding: theme.spacing.sm,
                      background: theme.colors.gray50,
                      borderRadius: theme.borderRadius.md,
                      marginBottom: theme.spacing.xs,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: theme.typography.fontSize.sm }}>
                        {doc.file_name || `Document ${index + 1}`}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = { ...step7Data };
                          updated.company_documents.statutory_accounts = updated.company_documents.statutory_accounts.filter((_, i) => i !== index);
                          setStep7Data(updated);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.base }}>
                Management Accounts (if available)
              </h4>
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files, 'management_accounts', 'company');
                  }
                }}
                style={{
                  padding: theme.spacing.lg,
                  border: `2px dashed ${dragActive ? theme.colors.primary : theme.colors.gray300}`,
                  borderRadius: theme.borderRadius.md,
                  textAlign: 'center',
                  background: dragActive ? theme.colors.primaryLight : theme.colors.gray50,
                  cursor: 'pointer',
                  marginBottom: theme.spacing.sm,
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = '.pdf,.jpg,.jpeg,.png';
                  input.onchange = (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files, 'management_accounts', 'company');
                    }
                  };
                  input.click();
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: theme.spacing.xs }}>📎</div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                  Drag and drop or click to upload • PDF, JPG, PNG • Max 10MB per file
                </p>
              </div>
              {step7Data.company_documents.management_accounts.length > 0 && (
                <div style={{ marginTop: theme.spacing.sm }}>
                  {step7Data.company_documents.management_accounts.map((doc, index) => (
                    <div key={index} style={{
                      padding: theme.spacing.sm,
                      background: theme.colors.gray50,
                      borderRadius: theme.borderRadius.md,
                      marginBottom: theme.spacing.xs,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: theme.typography.fontSize.sm }}>
                        {doc.file_name || `Document ${index + 1}`}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = { ...step7Data };
                          updated.company_documents.management_accounts = updated.company_documents.management_accounts.filter((_, i) => i !== index);
                          setStep7Data(updated);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Personal Documents (for applicants) */}
          {step4Data.applicants.length > 0 && (
            <div>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Personal Documents (Applicants)</h3>
              <div>
                <h4 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.base }}>
                  Photo ID
                </h4>
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleFileUpload(e.dataTransfer.files, 'photo_id', 'personal');
                    }
                  }}
                  style={{
                    padding: theme.spacing.lg,
                    border: `2px dashed ${dragActive ? theme.colors.primary : theme.colors.gray300}`,
                    borderRadius: theme.borderRadius.md,
                    textAlign: 'center',
                    background: dragActive ? theme.colors.primaryLight : theme.colors.gray50,
                    cursor: 'pointer',
                    marginBottom: theme.spacing.sm,
                  }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = '.pdf,.jpg,.jpeg,.png';
                    input.onchange = (e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files, 'photo_id', 'personal');
                      }
                    };
                    input.click();
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: theme.spacing.xs }}>📎</div>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                    Drag and drop or click to upload • PDF, JPG, PNG • Max 10MB per file
                  </p>
                </div>
                {step7Data.personal_documents.photo_id.length > 0 && (
                  <div style={{ marginTop: theme.spacing.sm }}>
                    {step7Data.personal_documents.photo_id.map((doc, index) => (
                      <div key={index} style={{
                        padding: theme.spacing.sm,
                        background: theme.colors.gray50,
                        borderRadius: theme.borderRadius.md,
                        marginBottom: theme.spacing.xs,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: theme.typography.fontSize.sm }}>
                          {doc.file_name || `Document ${index + 1}`}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updated = { ...step7Data };
                            updated.personal_documents.photo_id = updated.personal_documents.photo_id.filter((_, i) => i !== index);
                            setStep7Data(updated);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={nextStep}>
              Next: Preferred Solicitor
            </Button>
          </div>
        </div>
      )}

      {/* Step 8: Preferred Solicitor */}
      {step === 8 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Preferred Solicitor
          </h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            If you have a preferred solicitor, you can add them here. They will be automatically invited to deals. 
            If you don't have one, we'll help you find a suitable solicitor when needed.
          </p>

          <div style={commonStyles.card}>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={step8Data.has_solicitor}
                  onChange={(e) => setStep8Data(prev => ({ ...prev, has_solicitor: e.target.checked }))}
                />
                <span style={{ fontWeight: theme.typography.fontWeight.medium }}>
                  I have a preferred solicitor
                </span>
              </label>
            </div>

            {step8Data.has_solicitor && (
              <div style={{ marginTop: theme.spacing.lg, display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                <div>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                    Firm Name *
                  </label>
                  <Input
                    value={step8Data.solicitor_firm_name}
                    onChange={(e) => setStep8Data(prev => ({ ...prev, solicitor_firm_name: e.target.value }))}
                    placeholder="Solicitor firm name"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                    SRA Number *
                  </label>
                  <Input
                    value={step8Data.solicitor_sra_number}
                    onChange={(e) => setStep8Data(prev => ({ ...prev, solicitor_sra_number: e.target.value }))}
                    placeholder="SRA registration number"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                    Contact Name
                  </label>
                  <Input
                    value={step8Data.solicitor_contact_name}
                    onChange={(e) => setStep8Data(prev => ({ ...prev, solicitor_contact_name: e.target.value }))}
                    placeholder="Primary contact name"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                    Contact Email *
                  </label>
                  <Input
                    type="email"
                    value={step8Data.solicitor_contact_email}
                    onChange={(e) => setStep8Data(prev => ({ ...prev, solicitor_contact_email: e.target.value }))}
                    placeholder="contact@firm.com"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                    Contact Phone
                  </label>
                  <Input
                    value={step8Data.solicitor_contact_phone}
                    onChange={(e) => setStep8Data(prev => ({ ...prev, solicitor_contact_phone: e.target.value }))}
                    placeholder="+44 20 1234 5678"
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button 
              variant="primary" 
              onClick={nextStep}
              disabled={step8Data.has_solicitor && (!step8Data.solicitor_firm_name || !step8Data.solicitor_sra_number || !step8Data.solicitor_contact_email)}
            >
              Next: Review & Submit
            </Button>
          </div>
        </div>
      )}

      {/* Step 9: Review and submit */}
      {step === 9 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Review & Submit
          </h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            Please review all information before submitting your borrower profile for review.
          </p>

          <div style={{ display: 'grid', gap: theme.spacing.lg, marginBottom: theme.spacing.xl }}>
            {/* Step 1 Summary */}
            <div style={commonStyles.card}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Account & Consent</h3>
              <p><strong>Email:</strong> {step1Data.email}</p>
              <p><strong>Mobile:</strong> {step1Data.mobile_number}</p>
              <p><strong>MFA Enabled:</strong> {step1Data.mfa_enabled ? 'Yes' : 'No'}</p>
              <p><strong>Consents:</strong> All confirmed</p>
            </div>

            {/* Step 2 Summary */}
            {step2Data.company_data && (
              <div style={commonStyles.card}>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Company</h3>
                <p><strong>Company Name:</strong> {step2Data.company_data.company_name}</p>
                <p><strong>Company Number:</strong> {step2Data.company_data.company_number}</p>
                <p><strong>Status:</strong> {step2Data.company_data.company_status}</p>
              </div>
            )}

            {/* Step 3 Summary */}
            {step3Data.applicants_required.length > 0 && (
              <div style={commonStyles.card}>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Applicants Required</h3>
                <p>{step3Data.applicants_required.length} applicant(s) will need to complete details</p>
              </div>
            )}

            {/* Step 4 Summary */}
            {step4Data.applicants.length > 0 && (
              <div style={commonStyles.card}>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Applicants</h3>
                <p>{step4Data.applicants.length} applicant(s) details completed</p>
              </div>
            )}

            {/* Step 5 Summary */}
            <div style={commonStyles.card}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Financial Snapshot</h3>
              <p><strong>Mode:</strong> {step5Data.mode === 'quick' ? 'Quick (Totals Only)' : 'Detailed (Line-Item)'}</p>
              {step5Data.mode === 'quick' ? (
                <>
                  <p><strong>Total Income:</strong> £{parseFloat(step5Data.income_total || 0).toLocaleString('en-GB')}</p>
                  <p><strong>Total Expenditure:</strong> £{parseFloat(step5Data.expenditure_total || 0).toLocaleString('en-GB')}</p>
                  <p><strong>Total Assets:</strong> £{parseFloat(step5Data.assets_total || 0).toLocaleString('en-GB')}</p>
                  <p><strong>Total Liabilities:</strong> £{parseFloat(step5Data.liabilities_total || 0).toLocaleString('en-GB')}</p>
                </>
              ) : (
                <p>Detailed breakdown provided</p>
              )}
            </div>

            {/* Step 6 Summary */}
            <div style={commonStyles.card}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Bank Data</h3>
              <p><strong>Method:</strong> {step6Data.method === 'open_banking' ? 'Open Banking' : 'PDF Upload'}</p>
              {step6Data.open_banking_connected && (
                <p><strong>Accounts Connected:</strong> {step6Data.accounts.length}</p>
              )}
              {step6Data.pdf_statements.length > 0 && (
                <p><strong>PDF Statements:</strong> {step6Data.pdf_statements.length} file(s)</p>
              )}
            </div>

            {/* Step 7 Summary */}
            <div style={commonStyles.card}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Documents</h3>
              <p><strong>Statutory Accounts:</strong> {step7Data.company_documents.statutory_accounts.length} file(s)</p>
              <p><strong>Management Accounts:</strong> {step7Data.company_documents.management_accounts.length} file(s)</p>
              <p><strong>Photo ID:</strong> {step7Data.personal_documents.photo_id.length} file(s)</p>
            </div>

            {/* Step 8 Summary */}
            {step8Data.has_solicitor && (
              <div style={commonStyles.card}>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Preferred Solicitor</h3>
                <p><strong>Firm:</strong> {step8Data.solicitor_firm_name}</p>
                <p><strong>SRA Number:</strong> {step8Data.solicitor_sra_number}</p>
                {step8Data.solicitor_contact_name && (
                  <p><strong>Contact:</strong> {step8Data.solicitor_contact_name}</p>
                )}
                <p><strong>Email:</strong> {step8Data.solicitor_contact_email}</p>
              </div>
            )}
          </div>

          <div style={{
            ...commonStyles.card,
            padding: theme.spacing.lg,
            background: theme.colors.warningLight,
            marginBottom: theme.spacing.xl,
          }}>
            <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.medium }}>
              ⚠️ Once submitted, your profile will be locked for editing until admin review is complete.
            </p>
            <p style={{ margin: `${theme.spacing.sm} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>
              You will be able to make changes only if admin requests them.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitForReview}
              loading={loading}
              disabled={!step1Data.consent_privacy || !step1Data.consent_terms || !step1Data.consent_credit_search}
            >
              Submit for Review
            </Button>
          </div>
        </div>
      )}
    </Wizard>
  );
}

export default BorrowerProfileWizard;
