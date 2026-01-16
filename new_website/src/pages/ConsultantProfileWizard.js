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

function ConsultantProfileWizard() {
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
    address_line_1: '',
    address_line_2: '',
    city: '',
    county: '',
    postcode: '',
    country: 'United Kingdom',
  });

  // Step 5: Services & Qualifications (renumbered from step 2)
  const [step5Data, setStep5Data] = useState({
    primary_service: '',
    services_offered: [],
    qualifications: [],
    professional_registration_numbers: {
      rics: '',
      sra: '',
      cilex: '',
    },
  });

  // Step 6: Service Details (renumbered from step 4)
  const [step6Data, setStep6Data] = useState({
    service_description: '',
    years_of_experience: '',
    team_size: '',
    key_personnel: [],
    geographic_coverage: [],
  });

  // Step 7: Capacity & Availability (renumbered from step 5)
  const [step7Data, setStep7Data] = useState({
    current_capacity: '10',
    max_capacity: '20',
    average_response_time_days: '3',
  });

  // Step 8: Insurance & Compliance (renumbered from step 6)
  const [step8Data, setStep8Data] = useState({
    insurance_details: {
      provider: '',
      policy_number: '',
      expiry_date: '',
      coverage_amount: '',
    },
    compliance_certifications: [],
  });

  const steps = [
    'Account & Consent',
    'Company Verification',
    'Company Personnel',
    'Key Contact Details',
    'Services & Qualifications',
    'Service Details',
    'Capacity & Availability',
    'Insurance & Compliance',
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/consultants/profiles/');
      const data = Array.isArray(response.data) ? response.data[0] : response.data;
      if (data) {
        setProfile(data);
        // Pre-fill form data
        setStep1Data({
          email: data.contact_email || '',
          mobile_number: data.contact_phone || '',
          mfa_enabled: data.mfa_enabled || false,
          consent_privacy: data.consent_privacy || false,
          consent_terms: data.consent_terms || false,
          consent_credit_search: data.consent_credit_search || false,
        });
        setStep2Data({
          company_number: data.company_registration_number || '',
          company_name: data.organisation_name || '',
          company_search_type: 'number',
          company_data: data.company_data || null,
          company_search_results: [],
          show_search_results: false,
          trading_address: data.trading_address || '',
          primary_contact_email: data.contact_email || '',
          primary_contact_phone: data.contact_phone || '',
          confirmed: !!data.company_registration_number,
        });
        setStep3Data({
          directors: data.directors_data || [],
          shareholders: data.shareholders_data || [],
          key_personnel_confirmed: data.key_personnel || [],
          account_holder_is_director: data.account_holder_is_director || false,
          account_holder_name: data.account_holder_name || '',
          account_holder_role: data.account_holder_role || '',
        });
        setStep4Data({
          primary_contact_email: data.contact_email || '',
          primary_contact_phone: data.contact_phone || '',
          website: data.website || '',
          address_line_1: data.address_line_1 || '',
          address_line_2: data.address_line_2 || '',
          city: data.city || '',
          county: data.county || '',
          postcode: data.postcode || '',
          country: data.country || 'United Kingdom',
        });
        setStep5Data({
          primary_service: data.primary_service || '',
          services_offered: data.services_offered || [],
          qualifications: data.qualifications || [],
          professional_registration_numbers: data.professional_registration_numbers || {
            rics: '',
            sra: '',
            cilex: '',
          },
        });
        setStep6Data({
          service_description: data.service_description || '',
          years_of_experience: data.years_of_experience?.toString() || '',
          team_size: data.team_size?.toString() || '',
          key_personnel: data.key_personnel || [],
          geographic_coverage: data.geographic_coverage || [],
        });
        setStep7Data({
          current_capacity: data.current_capacity?.toString() || '10',
          max_capacity: data.max_capacity?.toString() || '20',
          average_response_time_days: data.average_response_time_days?.toString() || '3',
        });
        setStep8Data({
          insurance_details: data.insurance_details || {
            provider: '',
            policy_number: '',
            expiry_date: '',
            coverage_amount: '',
          },
          compliance_certifications: data.compliance_certifications || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      if (err.response?.status !== 404) {
        setError('Failed to load profile');
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

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const payload = buildPayload();
      if (profile) {
        await api.put(`/api/consultants/profiles/${profile.id}/`, payload);
        setMessage('Profile updated successfully');
      } else {
        await api.post('/api/consultants/profiles/', payload);
        setMessage('Profile created successfully');
      }
      setTimeout(() => {
        navigate('/consultant/profile');
      }, 1500);
    } catch (err) {
      console.error('Submit failed:', err);
      setError(err.response?.data?.detail || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = () => {
    // Clean up professional registration numbers - only include non-empty values
    const regNumbers = {};
    if (step5Data.professional_registration_numbers.rics) {
      regNumbers.rics = step5Data.professional_registration_numbers.rics;
    }
    if (step5Data.professional_registration_numbers.sra) {
      regNumbers.sra = step5Data.professional_registration_numbers.sra;
    }
    if (step5Data.professional_registration_numbers.cilex) {
      regNumbers.cilex = step5Data.professional_registration_numbers.cilex;
    }

    return {
      organisation_name: step2Data.company_name,
      company_registration_number: step2Data.company_number,
      company_data: step2Data.company_data,
      trading_address: step2Data.trading_address,
      directors_data: step3Data.directors,
      shareholders_data: step3Data.shareholders,
      account_holder_is_director: step3Data.account_holder_is_director,
      account_holder_name: step3Data.account_holder_name,
      account_holder_role: step3Data.account_holder_role,
      primary_service: step5Data.primary_service,
      services_offered: step5Data.services_offered,
      qualifications: step5Data.qualifications,
      professional_registration_numbers: regNumbers,
      contact_email: step4Data.primary_contact_email || step1Data.email,
      contact_phone: step4Data.primary_contact_phone || step1Data.mobile_number,
      website: step4Data.website,
      address_line_1: step4Data.address_line_1,
      address_line_2: step4Data.address_line_2,
      city: step4Data.city,
      county: step4Data.county,
      postcode: step4Data.postcode,
      country: step4Data.country,
      geographic_coverage: step6Data.geographic_coverage,
      service_description: step6Data.service_description,
      years_of_experience: step6Data.years_of_experience ? parseInt(step6Data.years_of_experience) : null,
      team_size: step6Data.team_size ? parseInt(step6Data.team_size) : null,
      key_personnel: step3Data.key_personnel_confirmed.length > 0 
        ? step3Data.key_personnel_confirmed 
        : step6Data.key_personnel,
      current_capacity: parseInt(step7Data.current_capacity),
      max_capacity: parseInt(step7Data.max_capacity),
      average_response_time_days: parseInt(step7Data.average_response_time_days),
      insurance_details: step8Data.insurance_details,
      compliance_certifications: step8Data.compliance_certifications,
      mobile_number: step1Data.mobile_number,
      mfa_enabled: step1Data.mfa_enabled,
      consent_privacy: step1Data.consent_privacy,
      consent_terms: step1Data.consent_terms,
      consent_credit_search: step1Data.consent_credit_search,
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
    if (stepNumber <= step) return true;
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
                    you can still manage the consultant profile on behalf of the company.
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
                        placeholder="e.g., Operations Manager, Practice Manager"
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
                label="Address Line 1"
                value={step4Data.address_line_1}
                onChange={(e) => setStep4Data({ ...step4Data, address_line_1: e.target.value })}
              />
              <Input
                label="Address Line 2"
                value={step4Data.address_line_2}
                onChange={(e) => setStep4Data({ ...step4Data, address_line_2: e.target.value })}
              />
              <Input
                label="City"
                value={step4Data.city}
                onChange={(e) => setStep4Data({ ...step4Data, city: e.target.value })}
              />
              <Input
                label="County"
                value={step4Data.county}
                onChange={(e) => setStep4Data({ ...step4Data, county: e.target.value })}
              />
              <Input
                label="Postcode"
                value={step4Data.postcode}
                onChange={(e) => setStep4Data({ ...step4Data, postcode: e.target.value })}
              />
              <Input
                label="Country"
                value={step4Data.country}
                onChange={(e) => setStep4Data({ ...step4Data, country: e.target.value })}
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
                Next: Services & Qualifications
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Services & Qualifications */}
        {step === 5 && (
          <div>
            <h2 style={{ marginBottom: theme.spacing.lg }}>Services & Qualifications</h2>
            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              <Select
                label="Primary Service Type *"
                name="primary_service"
                value={step5Data.primary_service}
                onChange={(e) => setStep5Data({ ...step5Data, primary_service: e.target.value })}
                options={[
                  { value: '', label: 'Select your primary role' },
                  { value: 'valuation_and_monitoring_surveyor', label: 'Valuation & Monitoring Surveyor' },
                  { value: 'monitoring_surveyor', label: 'Monitoring Surveyor' },
                  { value: 'valuation_surveyor', label: 'Valuation Surveyor' },
                  { value: 'solicitor', label: 'Solicitor' },
                  { value: 'other', label: 'Other Professional Service' },
                ]}
                required
              />
              <div>
                <label style={{ ...commonStyles.label, marginBottom: theme.spacing.sm, display: 'block' }}>
                  Services Offered * (Select all that apply)
                </label>
                <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>
                  Select all service types you can provide. This determines which opportunities you'll see.
                </p>
                {[
                  { value: 'valuation_and_monitoring_surveyor', label: 'Valuation & Monitoring Surveyor' },
                  { value: 'monitoring_surveyor', label: 'Monitoring Surveyor' },
                  { value: 'valuation_surveyor', label: 'Valuation Surveyor' },
                  { value: 'solicitor', label: 'Solicitor' },
                  { value: 'other', label: 'Other Professional Service' },
                ].map((service) => (
                  <Checkbox
                    key={service.value}
                    label={service.label}
                    checked={step5Data.services_offered.includes(service.value)}
                    onChange={(e) => {
                      const services = e.target.checked
                        ? [...step5Data.services_offered, service.value]
                        : step5Data.services_offered.filter(s => s !== service.value);
                      setStep5Data({ ...step5Data, services_offered: services });
                    }}
                  />
                ))}
              </div>
              <div>
                <label style={{ ...commonStyles.label, marginBottom: theme.spacing.sm, display: 'block' }}>
                  Qualifications
                </label>
                {['rics', 'rics_monitoring', 'rics_valuation', 'sra', 'cilex', 'other'].map((qual) => (
                  <Checkbox
                    key={qual}
                    label={qual.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    checked={step5Data.qualifications.includes(qual)}
                    onChange={(e) => {
                      const quals = e.target.checked
                        ? [...step5Data.qualifications, qual]
                        : step5Data.qualifications.filter(q => q !== qual);
                      setStep5Data({ ...step5Data, qualifications: quals });
                    }}
                  />
                ))}
              </div>
              <Input
                label="RICS Number"
                name="rics_number"
                value={step5Data.professional_registration_numbers.rics}
                onChange={(e) => setStep5Data({
                  ...step5Data,
                  professional_registration_numbers: {
                    ...step5Data.professional_registration_numbers,
                    rics: e.target.value,
                  },
                })}
              />
              <Input
                label="SRA Number"
                name="sra_number"
                value={step5Data.professional_registration_numbers.sra}
                onChange={(e) => setStep5Data({
                  ...step5Data,
                  professional_registration_numbers: {
                    ...step5Data.professional_registration_numbers,
                    sra: e.target.value,
                  },
                })}
              />
              <Input
                label="CILEX Number"
                name="cilex_number"
                value={step5Data.professional_registration_numbers.cilex}
                onChange={(e) => setStep5Data({
                  ...step5Data,
                  professional_registration_numbers: {
                    ...step5Data.professional_registration_numbers,
                    cilex: e.target.value,
                  },
                })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
              <Button variant="outline" onClick={prevStep}>
                Previous
              </Button>
              <Button variant="primary" onClick={nextStep}>
                Next: Service Details
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Service Details */}
        {step === 6 && (
          <div>
            <h2 style={{ marginBottom: theme.spacing.lg }}>Service Details</h2>
            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              <Textarea
                label="Service Description"
                name="service_description"
                value={step6Data.service_description}
                onChange={(e) => setStep6Data({ ...step6Data, service_description: e.target.value })}
                rows={6}
              />
              <Input
                label="Years of Experience"
                name="years_of_experience"
                type="number"
                value={step6Data.years_of_experience}
                onChange={(e) => setStep6Data({ ...step6Data, years_of_experience: e.target.value })}
              />
              <Input
                label="Team Size"
                name="team_size"
                type="number"
                value={step6Data.team_size}
                onChange={(e) => setStep6Data({ ...step6Data, team_size: e.target.value })}
              />
              <div>
                <label style={{ ...commonStyles.label, marginBottom: theme.spacing.sm, display: 'block' }}>
                  Geographic Coverage * (Select all regions you cover)
                </label>
                <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>
                  Select the regions/counties where you provide services. This helps match you with relevant opportunities.
                </p>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                  gap: theme.spacing.sm,
                  maxHeight: '300px',
                  overflowY: 'auto',
                  padding: theme.spacing.sm,
                  border: `1px solid ${theme.colors.gray200}`,
                  borderRadius: theme.borderRadius.md,
                }}>
                  {[
                    'Greater London', 'South East', 'South West', 'East of England',
                    'West Midlands', 'East Midlands', 'Yorkshire and the Humber',
                    'North West', 'North East', 'Wales', 'Scotland', 'Northern Ireland',
                    'Greater Manchester', 'Merseyside', 'West Yorkshire', 'South Yorkshire',
                    'Tyne and Wear', 'West Midlands (County)', 'Essex', 'Kent',
                    'Hampshire', 'Surrey', 'Hertfordshire', 'Lancashire',
                    'Nationwide', 'International',
                  ].map((region) => (
                    <Checkbox
                      key={region}
                      label={region}
                      checked={step6Data.geographic_coverage.includes(region)}
                      onChange={(e) => {
                        const coverage = e.target.checked
                          ? [...step6Data.geographic_coverage, region]
                          : step6Data.geographic_coverage.filter(r => r !== region);
                        setStep6Data({ ...step6Data, geographic_coverage: coverage });
                      }}
                    />
                  ))}
                </div>
                <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginTop: theme.spacing.sm, fontStyle: 'italic' }}>
                  Or enter custom locations (one per line):
                </p>
                <Textarea
                  name="geographic_coverage_custom"
                  value={step6Data.geographic_coverage.filter(r => ![
                    'Greater London', 'South East', 'South West', 'East of England',
                    'West Midlands', 'East Midlands', 'Yorkshire and the Humber',
                    'North West', 'North East', 'Wales', 'Scotland', 'Northern Ireland',
                    'Greater Manchester', 'Merseyside', 'West Yorkshire', 'South Yorkshire',
                    'Tyne and Wear', 'West Midlands (County)', 'Essex', 'Kent',
                    'Hampshire', 'Surrey', 'Hertfordshire', 'Lancashire',
                    'Nationwide', 'International',
                  ].includes(r)).join('\n')}
                  onChange={(e) => {
                    const customRegions = e.target.value.split('\n').filter(line => line.trim());
                    const standardRegions = step6Data.geographic_coverage.filter(r => [
                      'Greater London', 'South East', 'South West', 'East of England',
                      'West Midlands', 'East Midlands', 'Yorkshire and the Humber',
                      'North West', 'North East', 'Wales', 'Scotland', 'Northern Ireland',
                      'Greater Manchester', 'Merseyside', 'West Yorkshire', 'South Yorkshire',
                      'Tyne and Wear', 'West Midlands (County)', 'Essex', 'Kent',
                      'Hampshire', 'Surrey', 'Hertfordshire', 'Lancashire',
                      'Nationwide', 'International',
                    ].includes(r));
                    setStep6Data({ ...step6Data, geographic_coverage: [...standardRegions, ...customRegions] });
                  }}
                  rows={3}
                  placeholder="e.g., Birmingham, Manchester, Leeds..."
                />
              </div>
              <Textarea
                label="Key Personnel (JSON format)"
                name="key_personnel"
                value={JSON.stringify(step6Data.key_personnel, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setStep6Data({ ...step6Data, key_personnel: Array.isArray(parsed) ? parsed : [] });
                  } catch (err) {
                    // Invalid JSON, keep as is
                  }
                }}
                rows={6}
                placeholder='[{"name": "John Doe", "role": "Senior Partner", "qualifications": "RICS"}]'
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
              <Button variant="outline" onClick={prevStep}>
                Previous
              </Button>
              <Button variant="primary" onClick={nextStep}>
                Next: Capacity & Availability
              </Button>
            </div>
          </div>
        )}

        {/* Step 7: Capacity & Availability */}
        {step === 7 && (
          <div>
            <h2 style={{ marginBottom: theme.spacing.lg }}>Capacity & Availability</h2>
            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              <Input
                label="Current Capacity (active projects)"
                name="current_capacity"
                type="number"
                value={step7Data.current_capacity}
                onChange={(e) => setStep7Data({ ...step7Data, current_capacity: e.target.value })}
              />
              <Input
                label="Maximum Capacity"
                name="max_capacity"
                type="number"
                value={step7Data.max_capacity}
                onChange={(e) => setStep7Data({ ...step7Data, max_capacity: e.target.value })}
              />
              <Input
                label="Average Response Time (days)"
                name="average_response_time_days"
                type="number"
                value={step7Data.average_response_time_days}
                onChange={(e) => setStep7Data({ ...step7Data, average_response_time_days: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
              <Button variant="outline" onClick={prevStep}>
                Previous
              </Button>
              <Button variant="primary" onClick={nextStep}>
                Next: Insurance & Compliance
              </Button>
            </div>
          </div>
        )}

        {/* Step 8: Insurance & Compliance */}
        {step === 8 && (
          <div>
            <h2 style={{ marginBottom: theme.spacing.lg }}>Insurance & Compliance</h2>
            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              <h3 style={{ fontSize: theme.typography.fontSize.lg, marginBottom: theme.spacing.md }}>
                Professional Indemnity Insurance
              </h3>
              <Input
                label="Insurance Provider"
                name="insurance_provider"
                value={step8Data.insurance_details.provider}
                onChange={(e) => setStep8Data({
                  ...step8Data,
                  insurance_details: { ...step8Data.insurance_details, provider: e.target.value },
                })}
              />
              <Input
                label="Policy Number"
                name="policy_number"
                value={step8Data.insurance_details.policy_number}
                onChange={(e) => setStep8Data({
                  ...step8Data,
                  insurance_details: { ...step8Data.insurance_details, policy_number: e.target.value },
                })}
              />
              <Input
                label="Expiry Date"
                name="expiry_date"
                type="date"
                value={step8Data.insurance_details.expiry_date}
                onChange={(e) => setStep8Data({
                  ...step8Data,
                  insurance_details: { ...step8Data.insurance_details, expiry_date: e.target.value },
                })}
              />
              <Input
                label="Coverage Amount"
                name="coverage_amount"
                value={step8Data.insurance_details.coverage_amount}
                onChange={(e) => setStep8Data({
                  ...step8Data,
                  insurance_details: { ...step8Data.insurance_details, coverage_amount: e.target.value },
                })}
              />
              <Textarea
                label="Compliance Certifications (one per line)"
                name="compliance_certifications"
                value={step8Data.compliance_certifications.join('\n')}
                onChange={(e) => setStep8Data({
                  ...step8Data,
                  compliance_certifications: e.target.value.split('\n').filter(line => line.trim()),
                })}
                rows={4}
                placeholder="e.g., ISO 9001, FCA Authorised"
              />
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

export default ConsultantProfileWizard;
