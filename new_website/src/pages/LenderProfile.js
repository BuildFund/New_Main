import React, { useEffect, useState } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Wizard from '../components/Wizard';
import Input from '../components/Input';
import Textarea from '../components/Textarea';
import Button from '../components/Button';
import CompanyDetails from '../components/CompanyDetails';

function LenderProfile() {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    organisation_name: '',
    company_number: '',
    fca_registration_number: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    company_story: '',
    number_of_employees: '',
    financial_licences: '',
    membership_bodies: '',
    key_personnel: '',
    risk_compliance_details: '',
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const steps = ['Organisation', 'Contact', 'Company Details', 'FCA & Compliance', 'Review'];

  const fetchProfile = async () => {
    try {
      const res = await api.get('/api/lenders/profiles/');
      const data = Array.isArray(res.data) ? res.data[0] : res.data;
      if (data) {
        setProfile(data);
        setFormData({
          organisation_name: data.organisation_name || '',
          company_number: data.company_number || '',
          fca_registration_number: data.fca_registration_number || '',
          contact_email: data.contact_email || '',
          contact_phone: data.contact_phone || '',
          website: data.website || '',
          company_story: data.company_story || '',
          number_of_employees: data.number_of_employees || '',
          financial_licences: data.financial_licences || '',
          membership_bodies: data.membership_bodies || '',
          key_personnel: data.key_personnel
            ? JSON.stringify(data.key_personnel, null, 2)
            : '',
          risk_compliance_details: data.risk_compliance_details
            ? JSON.stringify(data.risk_compliance_details, null, 2)
            : '',
        });
      }
    } catch (err) {
      console.error(err);
      setMessage('Failed to load lender profile');
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile) return;
    setMessage(null);
    setLoading(true);
    try {
      let keyPersonnel = [];
      let riskDetails = {};
      try {
        keyPersonnel = formData.key_personnel ? JSON.parse(formData.key_personnel) : [];
      } catch (err) {
        setMessage('Key personnel must be valid JSON');
        setLoading(false);
        return;
      }
      try {
        riskDetails = formData.risk_compliance_details ? JSON.parse(formData.risk_compliance_details) : {};
      } catch (err) {
        setMessage('Risk compliance details must be valid JSON');
        setLoading(false);
        return;
      }
      const payload = {
        organisation_name: formData.organisation_name,
        company_number: formData.company_number,
        fca_registration_number: formData.fca_registration_number,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        website: formData.website,
        company_story: formData.company_story,
        number_of_employees: formData.number_of_employees || null,
        financial_licences: formData.financial_licences,
        membership_bodies: formData.membership_bodies,
        key_personnel: keyPersonnel,
        risk_compliance_details: riskDetails,
      };
      await api.put(`/api/lenders/profiles/${profile.id}/`, payload);
      setMessage('Profile updated successfully');
      await fetchProfile();
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
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

  const handleSaveAndContinue = async () => {
    if (step < steps.length) {
      // Auto-save on step change
      if (profile) {
        try {
          let keyPersonnel = [];
          let riskDetails = {};
          try {
            keyPersonnel = formData.key_personnel ? JSON.parse(formData.key_personnel) : [];
          } catch (err) {
            // Invalid JSON, continue anyway
          }
          try {
            riskDetails = formData.risk_compliance_details ? JSON.parse(formData.risk_compliance_details) : {};
          } catch (err) {
            // Invalid JSON, continue anyway
          }
          const payload = {
            organisation_name: formData.organisation_name,
            company_number: formData.company_number,
            fca_registration_number: formData.fca_registration_number,
            contact_email: formData.contact_email,
            contact_phone: formData.contact_phone,
            website: formData.website,
            company_story: formData.company_story,
            number_of_employees: formData.number_of_employees || null,
            financial_licences: formData.financial_licences,
            membership_bodies: formData.membership_bodies,
            key_personnel: keyPersonnel,
            risk_compliance_details: riskDetails,
          };
          await api.put(`/api/lenders/profiles/${profile.id}/`, payload);
          await fetchProfile();
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
      }
      nextStep();
    } else {
      await handleSubmit(new Event('submit'));
      setIsEditing(false);
      setStep(1);
    }
  };

  // LinkedIn-style Profile View
  if (!isEditing && profile) {
    const keyPersonnel = formData.key_personnel ? (() => {
      try {
        return JSON.parse(formData.key_personnel);
      } catch {
        return [];
      }
    })() : [];

    return (
      <div style={commonStyles.container}>
        {message && (
          <div style={{
            background: message.includes('success') ? theme.colors.successLight : theme.colors.errorLight,
            color: message.includes('success') ? theme.colors.successDark : theme.colors.errorDark,
            padding: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
            border: `1px solid ${message.includes('success') ? theme.colors.success : theme.colors.error}`,
          }}>
            {message}
          </div>
        )}

        {/* Cover Photo Section */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '200px',
          background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.primary} 100%)`,
          borderRadius: theme.borderRadius.lg,
          marginBottom: '100px',
          overflow: 'hidden',
        }}>
          {/* Profile Picture */}
          <div style={{
            position: 'absolute',
            bottom: '-80px',
            left: theme.spacing.xl,
            width: '160px',
            height: '160px',
            borderRadius: theme.borderRadius.full,
            background: theme.colors.white,
            border: `4px solid ${theme.colors.white}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '64px',
            color: theme.colors.primary,
            boxShadow: theme.shadows.lg,
          }}>
            {formData.organisation_name ? formData.organisation_name.charAt(0).toUpperCase() : 'L'}
          </div>
        </div>

        {/* Profile Header */}
        <div style={{
          ...commonStyles.card,
          marginTop: theme.spacing.xl,
          padding: theme.spacing.xl,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.lg }}>
            <div>
              <h1 style={{
                fontSize: theme.typography.fontSize['4xl'],
                fontWeight: theme.typography.fontWeight.bold,
                margin: `0 0 ${theme.spacing.xs} 0`,
                color: theme.colors.textPrimary,
              }}>
                {formData.organisation_name || 'Organisation Name'}
              </h1>
              <p style={{
                fontSize: theme.typography.fontSize.lg,
                color: theme.colors.textSecondary,
                margin: `0 0 ${theme.spacing.xs} 0`,
              }}>
                Financial Services Provider
              </p>
              {formData.website && (
                <p style={{
                  fontSize: theme.typography.fontSize.base,
                  color: theme.colors.primary,
                  margin: 0,
                  textDecoration: 'none',
                }}>
                  🌐 <a href={formData.website} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                    {formData.website}
                  </a>
                </p>
              )}
            </div>
            <Button variant="primary" onClick={() => setIsEditing(true)}>
              ✏️ Edit Profile
            </Button>
          </div>
        </div>

        {/* About Section */}
        {formData.company_story && (
          <div style={{
            ...commonStyles.card,
            marginTop: theme.spacing.lg,
            padding: theme.spacing.xl,
          }}>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.md} 0`,
            }}>
              About
            </h2>
            <p style={{
              fontSize: theme.typography.fontSize.base,
              lineHeight: theme.typography.lineHeight.relaxed,
              color: theme.colors.textPrimary,
              whiteSpace: 'pre-wrap',
            }}>
              {formData.company_story}
            </p>
          </div>
        )}

        {/* Company Information */}
        <div style={{
          ...commonStyles.card,
          marginTop: theme.spacing.lg,
          padding: theme.spacing.xl,
        }}>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.md} 0`,
          }}>
            Organisation Details
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.md }}>
            {formData.company_number && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Company Number</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium }}>
                  {formData.company_number}
                </p>
              </div>
            )}
            {formData.number_of_employees && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Employees</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium }}>
                  {formData.number_of_employees}
                </p>
              </div>
            )}
            {formData.fca_registration_number && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>FCA Registration</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium }}>
                  {formData.fca_registration_number}
                </p>
              </div>
            )}
          </div>
          {formData.company_number && (
            <div style={{ marginTop: theme.spacing.xl }}>
              <CompanyDetails companyNumber={formData.company_number} />
            </div>
          )}
        </div>

        {/* Contact Information */}
        <div style={{
          ...commonStyles.card,
          marginTop: theme.spacing.lg,
          padding: theme.spacing.xl,
        }}>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.md} 0`,
          }}>
            Contact Information
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.md }}>
            {formData.contact_email && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Email</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{formData.contact_email}</p>
              </div>
            )}
            {formData.contact_phone && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Phone</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{formData.contact_phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Key Personnel */}
        {keyPersonnel.length > 0 && (
          <div style={{
            ...commonStyles.card,
            marginTop: theme.spacing.lg,
            padding: theme.spacing.xl,
          }}>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.md} 0`,
            }}>
              Key Personnel
            </h2>
            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              {keyPersonnel.map((person, index) => (
                <div key={index} style={{
                  padding: theme.spacing.md,
                  background: theme.colors.gray50,
                  borderRadius: theme.borderRadius.md,
                }}>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium }}>
                    {person.name || 'Name not provided'}
                  </p>
                  {person.role && (
                    <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      {person.role}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Licences & Memberships */}
        {(formData.financial_licences || formData.membership_bodies) && (
          <div style={{
            ...commonStyles.card,
            marginTop: theme.spacing.lg,
            padding: theme.spacing.xl,
          }}>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.md} 0`,
            }}>
              Licences & Memberships
            </h2>
            {formData.financial_licences && (
              <div style={{ marginBottom: theme.spacing.md }}>
                <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                  Financial Licences
                </p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{formData.financial_licences}</p>
              </div>
            )}
            {formData.membership_bodies && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                  Membership Bodies
                </p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{formData.membership_bodies}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Edit Mode - Wizard
  return (
    <Wizard steps={steps} currentStep={step}>
      {message && (
        <div style={{
          background: message.includes('success') ? theme.colors.successLight : theme.colors.errorLight,
          color: message.includes('success') ? theme.colors.successDark : theme.colors.errorDark,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
          border: `1px solid ${message.includes('success') ? theme.colors.success : theme.colors.error}`,
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
          margin: 0,
        }}>
          Edit Profile
        </h1>
        <Button variant="outline" onClick={() => { setIsEditing(false); setStep(1); }}>
          ← Back to Profile
        </Button>
      </div>

      {/* Step 1: Organisation Details */}
      {step === 1 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Organisation Details
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
            <Input
              label="Organisation Name"
              name="organisation_name"
              value={formData.organisation_name}
              onChange={handleChange}
              required
              style={{ gridColumn: '1 / -1' }}
            />
            <Input
              label="Company Number"
              name="company_number"
              value={formData.company_number}
              onChange={handleChange}
            />
            <Input
              label="Number of Employees"
              type="number"
              name="number_of_employees"
              value={formData.number_of_employees}
              onChange={handleChange}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: theme.spacing.xl }}>
            <Button variant="primary" onClick={handleSaveAndContinue}>
              Next: Contact
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Contact Information */}
      {step === 2 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Contact Information
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
            <Input
              label="Contact Email"
              type="email"
              name="contact_email"
              value={formData.contact_email}
              onChange={handleChange}
              required
            />
            <Input
              label="Contact Phone"
              name="contact_phone"
              value={formData.contact_phone}
              onChange={handleChange}
            />
            <Input
              label="Website"
              type="url"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://example.com"
              style={{ gridColumn: '1 / -1' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={handleSaveAndContinue}>
              Next: Company Details
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Company Details */}
      {step === 3 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Company Information
          </h2>
          <Textarea
            label="Company Story"
            name="company_story"
            value={formData.company_story}
            onChange={handleChange}
            rows={4}
            placeholder="Tell us about your organisation..."
          />
          
          {/* Company Details Component */}
          {formData.company_number && (
            <div style={{ marginTop: theme.spacing.xl }}>
              <CompanyDetails companyNumber={formData.company_number} />
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={handleSaveAndContinue}>
              Next: FCA & Compliance
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: FCA & Compliance */}
      {step === 4 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            FCA Registration & Compliance
          </h2>
          <Input
            label="FCA Registration Number"
            name="fca_registration_number"
            value={formData.fca_registration_number}
            onChange={handleChange}
          />
          <Input
            label="Financial Licences"
            name="financial_licences"
            value={formData.financial_licences}
            onChange={handleChange}
            placeholder="Comma-separated list of licences"
          />
          <Input
            label="Membership Bodies"
            name="membership_bodies"
            value={formData.membership_bodies}
            onChange={handleChange}
            placeholder="Comma-separated list of memberships"
          />
          <Textarea
            label="Key Personnel (JSON)"
            name="key_personnel"
            value={formData.key_personnel}
            onChange={handleChange}
            rows={6}
            placeholder='[{"name": "John Doe", "role": "CEO"}]'
            helperText="Enter valid JSON array format"
          />
          <Textarea
            label="Risk & Compliance Details (JSON)"
            name="risk_compliance_details"
            value={formData.risk_compliance_details}
            onChange={handleChange}
            rows={6}
            placeholder='{"risk_rating": "low", "compliance_status": "compliant"}'
            helperText="Enter valid JSON format"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={handleSaveAndContinue}>
              Next: Review
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Review Your Information
          </h2>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Organisation</h3>
            <p><strong>Name:</strong> {formData.organisation_name}</p>
            <p><strong>Company Number:</strong> {formData.company_number || 'Not provided'}</p>
            <p><strong>Employees:</strong> {formData.number_of_employees || 'Not provided'}</p>
          </div>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Contact</h3>
            <p><strong>Email:</strong> {formData.contact_email}</p>
            <p><strong>Phone:</strong> {formData.contact_phone || 'Not provided'}</p>
            <p><strong>Website:</strong> {formData.website || 'Not provided'}</p>
          </div>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>FCA & Compliance</h3>
            <p><strong>FCA Registration:</strong> {formData.fca_registration_number || 'Not provided'}</p>
            <p><strong>Financial Licences:</strong> {formData.financial_licences || 'Not provided'}</p>
            <p><strong>Membership Bodies:</strong> {formData.membership_bodies || 'Not provided'}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={handleSubmit} loading={loading}>
              {loading ? 'Saving...' : 'Complete Profile'}
            </Button>
          </div>
        </div>
      )}
    </Wizard>
  );
}

export default LenderProfile;
