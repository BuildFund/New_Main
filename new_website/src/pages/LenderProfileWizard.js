import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

function LenderProfileWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [profile, setProfile] = useState(null);

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
    company_search_type: 'number',
    company_data: null,
    company_search_results: [],
    show_search_results: false,
    trading_address: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    confirmed: false,
  });

  // Step 3: Directors and shareholders (for reference, user assignment)
  const [step3Data, setStep3Data] = useState({
    directors: [],
    shareholders: [],
    key_personnel_confirmed: [],
    account_holder_is_director: false,
    account_holder_name: '',
    account_holder_role: '',
  });

  // Step 4: Key contact details
  const [step4Data, setStep4Data] = useState({
    primary_contact_email: '',
    primary_contact_phone: '',
    website: '',
    fca_registration_number: '',
    financial_licences: '',
    membership_bodies: '',
  });

  // Step 5: Additional lender details (existing)
  const [step5Data, setStep5Data] = useState({
    organisation_name: '',
    company_story: '',
    number_of_employees: '',
    key_personnel: [],
    risk_compliance_details: {},
  });

  const steps = [
    'Account & Consent',
    'Company Verification',
    'Company Personnel',
    'Key Contact Details',
    'Additional Information',
    'Review',
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/api/lenders/profiles/');
      const data = Array.isArray(res.data) ? res.data[0] : res.data;
      if (data) {
        setProfile(data);
        // Pre-populate form data
        setStep1Data({
          email: data.contact_email || '',
          mobile_number: data.contact_phone || '',
          mfa_enabled: false,
          consent_privacy: data.consent_privacy || false,
          consent_terms: data.consent_terms || false,
          consent_credit_search: data.consent_credit_search || false,
        });
        setStep2Data({
          company_number: data.company_number || '',
          company_name: data.organisation_name || '',
          company_search_type: 'number',
          company_data: null,
          company_search_results: [],
          show_search_results: false,
          trading_address: '',
          primary_contact_email: data.contact_email || '',
          primary_contact_phone: data.contact_phone || '',
          confirmed: !!data.company_number,
        });
        setStep4Data({
          primary_contact_email: data.contact_email || '',
          primary_contact_phone: data.contact_phone || '',
          website: data.website || '',
          fca_registration_number: data.fca_registration_number || '',
          financial_licences: data.financial_licences || '',
          membership_bodies: data.membership_bodies || '',
        });
        setStep5Data({
          organisation_name: data.organisation_name || '',
          company_story: data.company_story || '',
          number_of_employees: data.number_of_employees || '',
          key_personnel: data.key_personnel || [],
          risk_compliance_details: data.risk_compliance_details || {},
        });
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status !== 404) {
        setError('Failed to load lender profile');
      }
    }
  };

  const handleCompanySearch = async () => {
    if (step2Data.company_search_type === 'number') {
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
          setMessage('Company found! Please review and confirm the details.');
        }
      } catch (err) {
        console.error('Company search error:', err);
        setError(err.response?.data?.error || 'Failed to search company. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
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
            await handleSelectCompany(res.data.companies[0].company_number);
          } else {
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
        setMessage('Company found! Please review and confirm the details.');
        // Auto-populate step 3 with directors
        if (res.data.directors) {
          setStep3Data(prev => ({
            ...prev,
            directors: res.data.directors.map(d => ({ ...d, confirmed: false })),
          }));
        }
        if (res.data.pscs) {
          setStep3Data(prev => ({
            ...prev,
            shareholders: res.data.pscs.map(p => ({ ...p, confirmed: false })),
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load company details:', err);
      setError(err.response?.data?.error || 'Failed to load company details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndContinue = async () => {
    setError(null);
    setMessage(null);

    if (step < steps.length) {
      try {
        const payload = buildPayload();
        if (profile) {
          await api.put(`/api/lenders/profiles/${profile.id}/`, payload);
        } else {
          const response = await api.post('/api/lenders/profiles/', payload);
          setProfile(response.data);
        }
        setStep(step + 1);
      } catch (err) {
        console.error('Save failed:', err);
        setError(err.response?.data?.detail || 'Failed to save profile');
      }
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const payload = buildPayload();
      if (profile) {
        await api.put(`/api/lenders/profiles/${profile.id}/`, payload);
        setMessage('Profile updated successfully');
      } else {
        await api.post('/api/lenders/profiles/', payload);
        setMessage('Profile created successfully');
      }
      setTimeout(() => {
        navigate('/lender/profile');
      }, 1500);
    } catch (err) {
      console.error('Submit failed:', err);
      setError(err.response?.data?.detail || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = () => {
    return {
      organisation_name: step2Data.company_name || step5Data.organisation_name,
      company_number: step2Data.company_number,
      contact_email: step4Data.primary_contact_email || step1Data.email,
      contact_phone: step4Data.primary_contact_phone || step1Data.mobile_number,
      website: step4Data.website,
      fca_registration_number: step4Data.fca_registration_number,
      financial_licences: step4Data.financial_licences,
      membership_bodies: step4Data.membership_bodies,
      company_story: step5Data.company_story,
      number_of_employees: step5Data.number_of_employees || null,
      key_personnel: step3Data.key_personnel_confirmed.length > 0 
        ? step3Data.key_personnel_confirmed 
        : step5Data.key_personnel,
      risk_compliance_details: step5Data.risk_compliance_details,
      consent_privacy: step1Data.consent_privacy,
      consent_terms: step1Data.consent_terms,
      consent_credit_search: step1Data.consent_credit_search,
      mobile_number: step1Data.mobile_number,
      mfa_enabled: step1Data.mfa_enabled,
    };
  };

  const nextStep = () => {
    if (step < steps.length) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const canNavigateToStep = (stepNumber) => {
    // Allow navigation to completed steps
    if (stepNumber <= step) return true;
    // Allow navigation if previous steps are complete
    if (stepNumber === 2 && step1Data.consent_privacy && step1Data.consent_terms && step1Data.consent_credit_search) return true;
    if (stepNumber === 3 && step2Data.company_data) return true;
    if (stepNumber === 4 && step3Data.key_personnel_confirmed.length > 0) return true;
    return false;
  };

  const handleStepClick = (stepNumber) => {
    if (canNavigateToStep(stepNumber)) {
      setStep(stepNumber);
    }
  };

  return (
    <div style={{ ...commonStyles.container, padding: theme.spacing.xl }}>
      {error && (
        <div style={{
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
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
        }}>
          {message}
        </div>
      )}

      <Wizard
        steps={steps}
        currentStep={step}
        onStepClick={handleStepClick}
        canNavigateToStep={canNavigateToStep}
      >
        {/* Step 1: Account & Consent */}
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
                    <label style={{ cursor: 'pointer' }}>
                      I consent to the{' '}
                      <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.primary, textDecoration: 'underline' }}>
                        Privacy Policy
                      </a>
                    </label>
                    {!step1Data.consent_privacy && (
                      <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.error }}>
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
                    <label style={{ cursor: 'pointer' }}>
                      I accept the{' '}
                      <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.primary, textDecoration: 'underline' }}>
                        Terms and Conditions
                      </a>
                    </label>
                    {!step1Data.consent_terms && (
                      <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.error }}>
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
                    <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                      We may perform credit checks as part of the verification process
                    </p>
                    {!step1Data.consent_credit_search && (
                      <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.error }}>
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

            {/* Search Results List */}
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
                  onAutoImport={async (result) => {
                    setMessage('Company data imported successfully!');
                    if (result && result.results) {
                      setStep3Data(prev => ({
                        ...prev,
                        directors: result.results.directors || prev.directors,
                        shareholders: result.results.shareholders || prev.shareholders,
                      }));
                    }
                  }}
                />
                <div style={{ marginTop: theme.spacing.lg }}>
                  <Input
                    label="Trading Address (if different from registered address)"
                    value={step2Data.trading_address}
                    onChange={(e) => setStep2Data({ ...step2Data, trading_address: e.target.value })}
                    placeholder="Enter trading address if different"
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
                onClick={nextStep}
                disabled={!step2Data.company_data}
              >
                Next: Company Personnel
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Directors and shareholders (with user assignment) */}
        {step === 3 && (
          <div>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.lg} 0`,
            }}>
              Company Personnel & Account Assignment
            </h2>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
              Review the company directors and shareholders. Confirm key personnel and assign this account to the appropriate user.
            </p>

            <div style={{
              ...commonStyles.card,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.lg,
              background: theme.colors.primaryLight,
              border: `1px solid ${theme.colors.primary}`,
            }}>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                <strong>Note:</strong> The person using this account may be different from the company directors. 
                You can confirm company personnel for reference, but this account will be assigned to you (the current user).
              </p>
            </div>

            {step2Data.company_data && (
              <div>
                {/* Directors */}
                {step3Data.directors.length > 0 && (
                  <div style={{ marginBottom: theme.spacing.xl }}>
                    <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Directors</h3>
                    <div style={{ display: 'grid', gap: theme.spacing.md }}>
                      {step3Data.directors.map((director, index) => (
                        <div key={index} style={{
                          ...commonStyles.card,
                          padding: theme.spacing.md,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.medium }}>
                              {director.name}
                            </p>
                            {director.nationality && (
                              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                Nationality: {director.nationality}
                              </p>
                            )}
                          </div>
                          <Checkbox
                            label="Confirm as Key Personnel"
                            checked={director.confirmed || false}
                            onChange={(e) => {
                              const updated = [...step3Data.directors];
                              updated[index].confirmed = e.target.checked;
                              const confirmed = updated.filter(d => d.confirmed);
                              setStep3Data({
                                ...step3Data,
                                directors: updated,
                                key_personnel_confirmed: [
                                  ...step3Data.shareholders.filter(s => s.confirmed),
                                  ...confirmed,
                                ],
                              });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shareholders/PSCs */}
                {step3Data.shareholders.length > 0 && (
                  <div style={{ marginBottom: theme.spacing.xl }}>
                    <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Persons with Significant Control</h3>
                    <div style={{ display: 'grid', gap: theme.spacing.md }}>
                      {step3Data.shareholders.map((shareholder, index) => (
                        <div key={index} style={{
                          ...commonStyles.card,
                          padding: theme.spacing.md,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.medium }}>
                              {shareholder.name}
                            </p>
                            {shareholder.natures_of_control && (
                              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                Control: {shareholder.natures_of_control.join(', ')}
                              </p>
                            )}
                          </div>
                          <Checkbox
                            label="Confirm as Key Personnel"
                            checked={shareholder.confirmed || false}
                            onChange={(e) => {
                              const updated = [...step3Data.shareholders];
                              updated[index].confirmed = e.target.checked;
                              const confirmed = updated.filter(s => s.confirmed);
                              setStep3Data({
                                ...step3Data,
                                shareholders: updated,
                                key_personnel_confirmed: [
                                  ...step3Data.directors.filter(d => d.confirmed),
                                  ...confirmed,
                                ],
                              });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Account Assignment */}
                <div style={{
                  ...commonStyles.card,
                  padding: theme.spacing.lg,
                  marginTop: theme.spacing.xl,
                  background: theme.colors.gray50,
                }}>
                  <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Account Assignment</h3>
                  <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
                    This account will be assigned to you (the current logged-in user). If you are not a director, 
                    you can still manage the lender profile on behalf of the company.
                  </p>
                  <Checkbox
                    label="I am a director of this company"
                    checked={step3Data.account_holder_is_director}
                    onChange={(e) => setStep3Data({ ...step3Data, account_holder_is_director: e.target.checked })}
                  />
                  {!step3Data.account_holder_is_director && (
                    <div style={{ marginTop: theme.spacing.md }}>
                      <Input
                        label="Your Name"
                        value={step3Data.account_holder_name}
                        onChange={(e) => setStep3Data({ ...step3Data, account_holder_name: e.target.value })}
                        placeholder="Enter your full name"
                      />
                      <Input
                        label="Your Role"
                        value={step3Data.account_holder_role}
                        onChange={(e) => setStep3Data({ ...step3Data, account_holder_role: e.target.value })}
                        placeholder="e.g., Operations Manager, Finance Director"
                        style={{ marginTop: theme.spacing.md }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
              <Button variant="outline" onClick={prevStep}>
                Previous
              </Button>
              <Button
                variant="primary"
                onClick={nextStep}
              >
                Next: Key Contact Details
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Key contact details */}
        {step === 4 && (
          <div>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.lg} 0`,
            }}>
              Key Contact Details
            </h2>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
              Provide the primary contact information for your organisation.
            </p>

            <div style={{ display: 'grid', gap: theme.spacing.lg, marginBottom: theme.spacing.xl }}>
              <Input
                label="Primary Contact Email *"
                type="email"
                value={step4Data.primary_contact_email}
                onChange={(e) => setStep4Data({ ...step4Data, primary_contact_email: e.target.value })}
                required
              />
              <Input
                label="Primary Contact Phone *"
                type="tel"
                value={step4Data.primary_contact_phone}
                onChange={(e) => setStep4Data({ ...step4Data, primary_contact_phone: e.target.value })}
                required
              />
              <Input
                label="Website"
                type="url"
                value={step4Data.website}
                onChange={(e) => setStep4Data({ ...step4Data, website: e.target.value })}
                placeholder="https://example.com"
              />
              <Input
                label="FCA Registration Number"
                value={step4Data.fca_registration_number}
                onChange={(e) => setStep4Data({ ...step4Data, fca_registration_number: e.target.value })}
                placeholder="If applicable"
              />
              <Input
                label="Financial Licences"
                value={step4Data.financial_licences}
                onChange={(e) => setStep4Data({ ...step4Data, financial_licences: e.target.value })}
                placeholder="Comma-separated list of licences"
              />
              <Input
                label="Membership Bodies"
                value={step4Data.membership_bodies}
                onChange={(e) => setStep4Data({ ...step4Data, membership_bodies: e.target.value })}
                placeholder="e.g., UK Finance, BBA"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
              <Button variant="outline" onClick={prevStep}>
                Previous
              </Button>
              <Button
                variant="primary"
                onClick={nextStep}
                disabled={!step4Data.primary_contact_email || !step4Data.primary_contact_phone}
              >
                Next: Additional Information
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Additional lender details */}
        {step === 5 && (
          <div>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.lg} 0`,
            }}>
              Additional Information
            </h2>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
              Provide additional details about your organisation (optional).
            </p>

            <div style={{ display: 'grid', gap: theme.spacing.lg, marginBottom: theme.spacing.xl }}>
              <Input
                label="Organisation Name"
                value={step5Data.organisation_name || step2Data.company_name}
                onChange={(e) => setStep5Data({ ...step5Data, organisation_name: e.target.value })}
                disabled={!!step2Data.company_name}
                helperText={step2Data.company_name ? "Auto-filled from company verification" : ""}
              />
              <Input
                label="Number of Employees"
                type="number"
                value={step5Data.number_of_employees}
                onChange={(e) => setStep5Data({ ...step5Data, number_of_employees: e.target.value })}
              />
              <Textarea
                label="Company Story"
                value={step5Data.company_story}
                onChange={(e) => setStep5Data({ ...step5Data, company_story: e.target.value })}
                rows={4}
                placeholder="Tell us about your organisation..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
              <Button variant="outline" onClick={prevStep}>
                Previous
              </Button>
              <Button
                variant="primary"
                onClick={nextStep}
              >
                Next: Review
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Review */}
        {step === 6 && (
          <div>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.lg} 0`,
            }}>
              Review Your Information
            </h2>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
              Please review all information before submitting.
            </p>

            <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Account & Consent</h3>
              <p><strong>Email:</strong> {step1Data.email}</p>
              <p><strong>Mobile:</strong> {step1Data.mobile_number}</p>
              <p><strong>MFA Enabled:</strong> {step1Data.mfa_enabled ? 'Yes' : 'No'}</p>
              <p><strong>Consents:</strong> All confirmed</p>
            </div>

            {step2Data.company_data && (
              <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Company</h3>
                <p><strong>Name:</strong> {step2Data.company_data.company_name}</p>
                <p><strong>Number:</strong> {step2Data.company_data.company_number}</p>
                <p><strong>Status:</strong> {step2Data.company_data.company_status}</p>
              </div>
            )}

            <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Contact</h3>
              <p><strong>Email:</strong> {step4Data.primary_contact_email}</p>
              <p><strong>Phone:</strong> {step4Data.primary_contact_phone}</p>
              <p><strong>Website:</strong> {step4Data.website || 'Not provided'}</p>
              <p><strong>FCA Registration:</strong> {step4Data.fca_registration_number || 'Not provided'}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
              <Button variant="outline" onClick={prevStep}>
                Previous
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
              >
                {loading ? 'Saving...' : 'Complete Profile'}
              </Button>
            </div>
          </div>
        )}
      </Wizard>
    </div>
  );
}

export default LenderProfileWizard;
