import React, { useEffect, useState } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Wizard from '../components/Wizard';
import Input from '../components/Input';
import Textarea from '../components/Textarea';
import Button from '../components/Button';
import Badge from '../components/Badge';
import CompanyDetails from '../components/CompanyDetails';

function BorrowerProfile() {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    company_name: '',
    registration_number: '',
    trading_name: '',
    phone_number: '',
    address_1: '',
    address_2: '',
    city: '',
    county: '',
    postcode: '',
    country: '',
    experience_description: '',
    income_details: '',
    expenses_details: '',
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const steps = ['Personal Info', 'Contact Details', 'Address', 'Company Info', 'Financial Details', 'Review'];

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
      let income = {};
      let expenses = {};
      try {
        income = formData.income_details ? JSON.parse(formData.income_details) : {};
      } catch (err) {
        setMessage('Income details must be valid JSON');
        setLoading(false);
        return;
      }
      try {
        expenses = formData.expenses_details ? JSON.parse(formData.expenses_details) : {};
      } catch (err) {
        setMessage('Expenses details must be valid JSON');
        setLoading(false);
        return;
      }
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth || null,
        company_name: formData.company_name,
        registration_number: formData.registration_number,
        trading_name: formData.trading_name,
        phone_number: formData.phone_number,
        address_1: formData.address_1,
        address_2: formData.address_2,
        city: formData.city,
        county: formData.county,
        postcode: formData.postcode,
        country: formData.country,
        experience_description: formData.experience_description,
        income_details: income,
        expenses_details: expenses,
      };
      await api.put(`/api/borrowers/profiles/${profile.id}/`, payload);
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
          let income = {};
          let expenses = {};
          try {
            income = formData.income_details ? JSON.parse(formData.income_details) : {};
          } catch (err) {
            // Invalid JSON, continue anyway
          }
          try {
            expenses = formData.expenses_details ? JSON.parse(formData.expenses_details) : {};
          } catch (err) {
            // Invalid JSON, continue anyway
          }
          const payload = {
            first_name: formData.first_name,
            last_name: formData.last_name,
            date_of_birth: formData.date_of_birth || null,
            company_name: formData.company_name,
            registration_number: formData.registration_number,
            trading_name: formData.trading_name,
            phone_number: formData.phone_number,
            address_1: formData.address_1,
            address_2: formData.address_2,
            city: formData.city,
            county: formData.county,
            postcode: formData.postcode,
            country: formData.country,
            experience_description: formData.experience_description,
            income_details: income,
            expenses_details: expenses,
          };
          await api.put(`/api/borrowers/profiles/${profile.id}/`, payload);
          await fetchProfile();
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
      }
      nextStep();
    } else {
      // On last step, just save - don't auto-close editor
      await handleSubmit(new Event('submit'));
      // Keep editor open - user can manually close with "Back to Profile" button
      setStep(1); // Reset to first step but stay in edit mode
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get('/api/borrowers/profiles/');
      const data = Array.isArray(res.data) ? res.data[0] : res.data;
      if (data) {
        setProfile(data);
        // Extract company number from registration_number or company_data
        const companyNumber = data.registration_number || 
                             (data.company_data && typeof data.company_data === 'object' && data.company_data.company_number) ||
                             '';
        // Extract company name from company_data if available
        const companyName = (data.company_data && typeof data.company_data === 'object' && data.company_data.company_name) ||
                           data.company_name || '';
        setFormData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          date_of_birth: data.date_of_birth || '',
          company_name: companyName,
          registration_number: companyNumber,
          trading_name: data.trading_name || '',
          phone_number: data.phone_number || '',
          address_1: data.address_1 || '',
          address_2: data.address_2 || '',
          city: data.city || '',
          county: data.county || '',
          postcode: data.postcode || '',
          country: data.country || '',
          experience_description: data.experience_description || '',
          income_details: data.income_details
            ? JSON.stringify(data.income_details, null, 2)
            : '',
          expenses_details: data.expenses_details
            ? JSON.stringify(data.expenses_details, null, 2)
            : '',
        });
      }
    } catch (err) {
      console.error(err);
      setMessage('Failed to load profile');
    }
  };

  // LinkedIn-style Profile View
  if (!isEditing && profile) {
    const fullName = `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'Your Name';
    const location = [formData.city, formData.county, formData.country].filter(Boolean).join(', ') || 'Location not set';
    const address = [formData.address_1, formData.address_2, formData.city, formData.postcode].filter(Boolean).join(', ');
    const income = formData.income_details ? (() => {
      try {
        return JSON.parse(formData.income_details);
      } catch {
        return {};
      }
    })() : {};
    const expenses = formData.expenses_details ? (() => {
      try {
        return JSON.parse(formData.expenses_details);
      } catch {
        return {};
      }
    })() : {};

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
            {fullName.charAt(0).toUpperCase()}
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
                {fullName}
              </h1>
              <p style={{
                fontSize: theme.typography.fontSize.lg,
                color: theme.colors.textSecondary,
                margin: `0 0 ${theme.spacing.xs} 0`,
              }}>
                {formData.company_name || 'Company Name'}
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.textSecondary,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.xs,
              }}>
                📍 {location}
              </p>
            </div>
            <Button variant="primary" onClick={() => setIsEditing(true)}>
              ✏️ Edit Profile
            </Button>
          </div>
        </div>

        {/* About Section */}
        {formData.experience_description && (
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
              {formData.experience_description}
            </p>
          </div>
        )}

        {/* Company Information - LinkedIn Style */}
        {(formData.company_name || formData.registration_number || profile?.company_data) && (
          <div style={{
            ...commonStyles.card,
            marginTop: theme.spacing.lg,
            padding: theme.spacing.xl,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
              <h2 style={{
                fontSize: theme.typography.fontSize['2xl'],
                fontWeight: theme.typography.fontWeight.semibold,
                margin: 0,
              }}>
                Company Information
              </h2>
              {profile?.company_verified_at && (
                <Badge variant="success">✓ Verified via Companies House</Badge>
              )}
            </div>

            {/* Company Header - LinkedIn Style */}
            {profile?.company_data && Object.keys(profile.company_data).length > 0 ? (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: theme.spacing.lg,
                  marginBottom: theme.spacing.xl,
                  paddingBottom: theme.spacing.xl,
                  borderBottom: `1px solid ${theme.colors.gray200}`,
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: theme.borderRadius.md,
                    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.primary} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    color: theme.colors.white,
                    fontWeight: theme.typography.fontWeight.bold,
                    flexShrink: 0,
                  }}>
                    {profile.company_data.company_name?.charAt(0).toUpperCase() || '🏢'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: theme.typography.fontSize['2xl'],
                      fontWeight: theme.typography.fontWeight.bold,
                      margin: `0 0 ${theme.spacing.xs} 0`,
                      color: theme.colors.textPrimary,
                    }}>
                      {profile.company_data.company_name || formData.company_name || 'Company Name'}
                    </h3>
                    {profile.company_data.company_number && (
                      <p style={{
                        fontSize: theme.typography.fontSize.base,
                        color: theme.colors.textSecondary,
                        margin: `0 0 ${theme.spacing.xs} 0`,
                      }}>
                        Company Number: {profile.company_data.company_number}
                      </p>
                    )}
                    {profile.company_data.company_status && (
                      <Badge 
                        variant={profile.company_data.company_status === 'active' ? 'success' : 'warning'}
                        style={{ marginTop: theme.spacing.xs }}
                      >
                        {profile.company_data.company_status.charAt(0).toUpperCase() + profile.company_data.company_status.slice(1)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Company Details Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                  gap: theme.spacing.lg,
                  marginBottom: theme.spacing.xl,
                }}>
                  {profile.company_data.date_of_creation && (
                    <div>
                      <p style={{ 
                        margin: 0, 
                        fontSize: theme.typography.fontSize.sm, 
                        color: theme.colors.textSecondary,
                        marginBottom: theme.spacing.xs,
                      }}>
                        📅 Incorporation Date
                      </p>
                      <p style={{ 
                        margin: 0, 
                        fontSize: theme.typography.fontSize.base, 
                        fontWeight: theme.typography.fontWeight.medium 
                      }}>
                        {new Date(profile.company_data.date_of_creation).toLocaleDateString('en-GB', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  )}
                  {profile.company_data.company_type && (
                    <div>
                      <p style={{ 
                        margin: 0, 
                        fontSize: theme.typography.fontSize.sm, 
                        color: theme.colors.textSecondary,
                        marginBottom: theme.spacing.xs,
                      }}>
                        🏛️ Company Type
                      </p>
                      <p style={{ 
                        margin: 0, 
                        fontSize: theme.typography.fontSize.base, 
                        fontWeight: theme.typography.fontWeight.medium 
                      }}>
                        {profile.company_data.company_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                  )}
                  {profile.company_data.registered_office_address && (
                    <div>
                      <p style={{ 
                        margin: 0, 
                        fontSize: theme.typography.fontSize.sm, 
                        color: theme.colors.textSecondary,
                        marginBottom: theme.spacing.xs,
                      }}>
                        📍 Registered Address
                      </p>
                      <p style={{ 
                        margin: 0, 
                        fontSize: theme.typography.fontSize.base, 
                        fontWeight: theme.typography.fontWeight.medium,
                        lineHeight: theme.typography.lineHeight.relaxed,
                      }}>
                        {(() => {
                          const addr = profile.company_data.registered_office_address;
                          if (typeof addr === 'string') return addr;
                          return [
                            addr.address_line_1,
                            addr.address_line_2,
                            addr.locality,
                            addr.postal_code,
                            addr.country,
                          ].filter(Boolean).join(', ');
                        })()}
                      </p>
                    </div>
                  )}
                  {profile.company_data.sic_codes && profile.company_data.sic_codes.length > 0 && (
                    <div>
                      <p style={{ 
                        margin: 0, 
                        fontSize: theme.typography.fontSize.sm, 
                        color: theme.colors.textSecondary,
                        marginBottom: theme.spacing.xs,
                      }}>
                        🏷️ SIC Codes
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                        {profile.company_data.sic_codes.map((sic, idx) => (
                          <Badge key={idx} variant="outline" style={{ fontSize: theme.typography.fontSize.sm }}>
                            {sic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Directors Section */}
                {profile.directors_data && profile.directors_data.length > 0 && (
                  <div style={{
                    marginTop: theme.spacing.xl,
                    paddingTop: theme.spacing.xl,
                    borderTop: `1px solid ${theme.colors.gray200}`,
                  }}>
                    <h3 style={{
                      fontSize: theme.typography.fontSize.lg,
                      fontWeight: theme.typography.fontWeight.semibold,
                      margin: `0 0 ${theme.spacing.md} 0`,
                    }}>
                      👥 Directors ({profile.directors_data.length})
                    </h3>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                      gap: theme.spacing.md 
                    }}>
                      {profile.directors_data.filter(d => d.confirmed !== false).map((director, idx) => (
                        <div key={idx} style={{
                          padding: theme.spacing.md,
                          background: theme.colors.gray50,
                          borderRadius: theme.borderRadius.md,
                          border: `1px solid ${theme.colors.gray200}`,
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: theme.borderRadius.full,
                            background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.primary} 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: theme.colors.white,
                            fontWeight: theme.typography.fontWeight.bold,
                            marginBottom: theme.spacing.sm,
                          }}>
                            {director.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <p style={{
                            margin: 0,
                            fontWeight: theme.typography.fontWeight.semibold,
                            fontSize: theme.typography.fontSize.base,
                          }}>
                            {director.name || 'N/A'}
                          </p>
                          {director.nationality && (
                            <p style={{
                              margin: `${theme.spacing.xs} 0 0 0`,
                              fontSize: theme.typography.fontSize.sm,
                              color: theme.colors.textSecondary,
                            }}>
                              {director.nationality}
                            </p>
                          )}
                          {director.occupation && (
                            <p style={{
                              margin: `${theme.spacing.xs} 0 0 0`,
                              fontSize: theme.typography.fontSize.sm,
                              color: theme.colors.textSecondary,
                            }}>
                              {director.occupation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shareholders/PSCs Section */}
                {profile.shareholders_data && profile.shareholders_data.length > 0 && (
                  <div style={{
                    marginTop: theme.spacing.xl,
                    paddingTop: theme.spacing.xl,
                    borderTop: `1px solid ${theme.colors.gray200}`,
                  }}>
                    <h3 style={{
                      fontSize: theme.typography.fontSize.lg,
                      fontWeight: theme.typography.fontWeight.semibold,
                      margin: `0 0 ${theme.spacing.md} 0`,
                    }}>
                      💼 Persons with Significant Control ({profile.shareholders_data.length})
                    </h3>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                      gap: theme.spacing.md 
                    }}>
                      {profile.shareholders_data.map((psc, idx) => (
                        <div key={idx} style={{
                          padding: theme.spacing.md,
                          background: theme.colors.gray50,
                          borderRadius: theme.borderRadius.md,
                          border: `1px solid ${theme.colors.gray200}`,
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: theme.borderRadius.full,
                            background: `linear-gradient(135deg, ${theme.colors.secondary || theme.colors.primary} 0%, ${theme.colors.primary} 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: theme.colors.white,
                            fontWeight: theme.typography.fontWeight.bold,
                            marginBottom: theme.spacing.sm,
                          }}>
                            {psc.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <p style={{
                            margin: 0,
                            fontWeight: theme.typography.fontWeight.semibold,
                            fontSize: theme.typography.fontSize.base,
                          }}>
                            {psc.name || 'N/A'}
                          </p>
                          {psc.kind && (
                            <p style={{
                              margin: `${theme.spacing.xs} 0 0 0`,
                              fontSize: theme.typography.fontSize.sm,
                              color: theme.colors.textSecondary,
                            }}>
                              {psc.kind.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                          )}
                          {psc.natures_of_control && psc.natures_of_control.length > 0 && (
                            <div style={{ marginTop: theme.spacing.xs }}>
                              {psc.natures_of_control.map((nature, nIdx) => (
                                <Badge key={nIdx} variant="outline" style={{ 
                                  fontSize: theme.typography.fontSize.xs,
                                  marginRight: theme.spacing.xs,
                                  marginTop: theme.spacing.xs,
                                }}>
                                  {nature.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Fallback to basic company info if no Companies House data */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.md }}>
                {formData.company_name && (
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Company Name</p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium }}>
                      {formData.company_name}
                    </p>
                  </div>
                )}
                {formData.registration_number && (
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Registration Number</p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium }}>
                      {formData.registration_number}
                    </p>
                  </div>
                )}
                {formData.trading_name && (
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Trading Name</p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium }}>
                      {formData.trading_name}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Company Details Component for lookup/import */}
            {formData.registration_number && (
              <div style={{ marginTop: theme.spacing.xl }}>
                <CompanyDetails 
                  companyNumber={formData.registration_number}
                  hideAutoImport={!!profile?.company_data && Object.keys(profile.company_data).length > 0}
                  onAutoImport={(result) => {
                    // Refresh profile after auto-import
                    fetchProfile();
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Charges Summary */}
        {profile?.charges_summary && Object.keys(profile.charges_summary).length > 0 && (
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
              Company Charges Summary
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Total Charges</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                  {profile.charges_summary.total_charges || 0}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Active Charges</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.warning }}>
                  {profile.charges_summary.active_charges || 0}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Satisfied Charges</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.success }}>
                  {profile.charges_summary.satisfied_charges || 0}
                </p>
              </div>
            </div>
            
            {profile.charges_summary.charges_summary?.active && profile.charges_summary.charges_summary.active.length > 0 && (
              <div style={{ marginTop: theme.spacing.lg }}>
                <h3 style={{
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.semibold,
                  marginBottom: theme.spacing.md,
                }}>
                  Active Charges
                </h3>
                <div style={{ display: 'grid', gap: theme.spacing.sm }}>
                  {profile.charges_summary.charges_summary.active.map((charge, idx) => (
                    <div key={idx} style={{
                      padding: theme.spacing.md,
                      background: theme.colors.warningLight,
                      borderRadius: theme.borderRadius.md,
                      borderLeft: `4px solid ${theme.colors.warning}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                            Charge {charge.charge_number || charge.charge_code || idx + 1}
                          </p>
                          <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            Created: {charge.created_on ? new Date(charge.created_on).toLocaleDateString('en-GB') : 'N/A'}
                          </p>
                          {charge.persons_entitled && charge.persons_entitled.length > 0 && (
                            <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>
                              <strong>Charged to:</strong> {charge.persons_entitled.map(p => p.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <Badge variant="warning">Active</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contact & Location */}
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
            Contact & Location
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.md }}>
            {formData.phone_number && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Phone</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{formData.phone_number}</p>
              </div>
            )}
            {address && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Address</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{address}</p>
              </div>
            )}
            {formData.date_of_birth && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Date of Birth</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>
                  {new Date(formData.date_of_birth).toLocaleDateString('en-GB')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        {(Object.keys(income).length > 0 || Object.keys(expenses).length > 0 || (profile.charges_summary && profile.charges_summary.total_charges > 0)) && (
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
              Financial Summary
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md }}>
              {income.annual_income && (
                <div>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Annual Income</p>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                    £{parseFloat(income.annual_income).toLocaleString('en-GB')}
                  </p>
                </div>
              )}
              {expenses.monthly_expenses && (
                <div>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Monthly Expenses</p>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                    £{parseFloat(expenses.monthly_expenses).toLocaleString('en-GB')}
                  </p>
                </div>
              )}
              {profile.charges_summary && profile.charges_summary.total_charges > 0 && (
                <>
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Total Charges</p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                      {profile.charges_summary.total_charges || 0}
                    </p>
                  </div>
                  {profile.charges_summary.active_charges > 0 && (
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Active Charges</p>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.warning }}>
                        {profile.charges_summary.active_charges || 0}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Company Charges Details in Financial Section */}
            {profile.charges_summary && profile.charges_summary.total_charges > 0 && (
              <div style={{ marginTop: theme.spacing.lg, paddingTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.gray200}` }}>
                <h3 style={{
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.semibold,
                  marginBottom: theme.spacing.md,
                }}>
                  Company Charges
                </h3>
                <p style={{ 
                  fontSize: theme.typography.fontSize.sm, 
                  color: theme.colors.textSecondary,
                  marginBottom: theme.spacing.md,
                }}>
                  Registered charges (mortgages, debentures) against the company from Companies House.
                </p>
                {profile.charges_summary.charges_summary?.active && profile.charges_summary.charges_summary.active.length > 0 && (
                  <div style={{ marginTop: theme.spacing.md }}>
                    <h4 style={{
                      fontSize: theme.typography.fontSize.base,
                      fontWeight: theme.typography.fontWeight.semibold,
                      marginBottom: theme.spacing.sm,
                      color: theme.colors.warning,
                    }}>
                      Active Charges ({profile.charges_summary.charges_summary.active.length})
                    </h4>
                    <div style={{ display: 'grid', gap: theme.spacing.sm }}>
                      {profile.charges_summary.charges_summary.active.map((charge, idx) => (
                        <div key={idx} style={{
                          padding: theme.spacing.md,
                          background: theme.colors.warningLight,
                          borderRadius: theme.borderRadius.md,
                          borderLeft: `4px solid ${theme.colors.warning}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                              <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                                {charge.charge_code || charge.charge_number || `Charge ${idx + 1}`}
                              </p>
                              {charge.created_on && (
                                <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                  Created: {new Date(charge.created_on).toLocaleDateString('en-GB')}
                                </p>
                              )}
                              {charge.persons_entitled && charge.persons_entitled.length > 0 && (
                                <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>
                                  <strong>Charged to:</strong> {charge.persons_entitled.map(p => p.name).join(', ')}
                                </p>
                              )}
                            </div>
                            <Badge variant="warning">Active</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {profile.charges_summary.charges_summary?.satisfied && profile.charges_summary.charges_summary.satisfied.length > 0 && (
                  <div style={{ marginTop: theme.spacing.md }}>
                    <h4 style={{
                      fontSize: theme.typography.fontSize.base,
                      fontWeight: theme.typography.fontWeight.semibold,
                      marginBottom: theme.spacing.sm,
                      color: theme.colors.success,
                    }}>
                      Satisfied Charges ({profile.charges_summary.charges_summary.satisfied.length})
                    </h4>
                    <div style={{ display: 'grid', gap: theme.spacing.sm }}>
                      {profile.charges_summary.charges_summary.satisfied.slice(0, 5).map((charge, idx) => (
                        <div key={idx} style={{
                          padding: theme.spacing.md,
                          background: theme.colors.gray50,
                          borderRadius: theme.borderRadius.md,
                          borderLeft: `4px solid ${theme.colors.success}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                              <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.medium }}>
                                {charge.charge_code || charge.charge_number || `Charge ${idx + 1}`}
                              </p>
                              {charge.satisfied_on && (
                                <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                  Satisfied: {new Date(charge.satisfied_on).toLocaleDateString('en-GB')}
                                </p>
                              )}
                            </div>
                            <Badge variant="success">Satisfied</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

      {/* Step 1: Personal Information */}
      {step === 1 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Personal Information
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
            <Input
              label="First Name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
            <Input
              label="Last Name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
            <Input
              label="Date of Birth"
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleChange}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: theme.spacing.xl }}>
            <Button variant="primary" onClick={handleSaveAndContinue}>
              Next: Contact Details
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Contact Details */}
      {step === 2 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Contact Details
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
            <Input
              label="Phone Number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="+44 20 1234 5678"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={handleSaveAndContinue}>
              Next: Address
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Address */}
      {step === 3 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Address Information
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
            <Input
              label="Address Line 1"
              name="address_1"
              value={formData.address_1}
              onChange={handleChange}
              style={{ gridColumn: '1 / -1' }}
            />
            <Input
              label="Address Line 2"
              name="address_2"
              value={formData.address_2}
              onChange={handleChange}
              style={{ gridColumn: '1 / -1' }}
            />
            <Input
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
            />
            <Input
              label="County"
              name="county"
              value={formData.county}
              onChange={handleChange}
            />
            <Input
              label="Postcode"
              name="postcode"
              value={formData.postcode}
              onChange={handleChange}
            />
            <Input
              label="Country"
              name="country"
              value={formData.country}
              onChange={handleChange}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={handleSaveAndContinue}>
              Next: Company Info
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Company Information */}
      {step === 4 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Company Information
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
            <Input
              label="Company Name"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              style={{ gridColumn: '1 / -1' }}
            />
            <Input
              label="Registration Number"
              name="registration_number"
              value={formData.registration_number}
              onChange={handleChange}
            />
            <Input
              label="Trading Name"
              name="trading_name"
              value={formData.trading_name}
              onChange={handleChange}
            />
          </div>
          
          {/* Company Details Component */}
          {(formData.registration_number || (profile && profile.company_data && profile.company_data.company_number)) && (
            <div style={{ marginTop: theme.spacing.xl }}>
              <CompanyDetails 
                companyNumber={formData.registration_number || (profile?.company_data?.company_number)} 
              />
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
            <Button variant="outline" onClick={prevStep}>
              Previous
            </Button>
            <Button variant="primary" onClick={handleSaveAndContinue}>
              Next: Financial Details
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Financial Details */}
      {step === 5 && (
        <div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Financial & Experience Details
          </h2>
          <Textarea
            label="Experience Description"
            name="experience_description"
            value={formData.experience_description}
            onChange={handleChange}
            rows={4}
            placeholder="Describe your experience..."
          />
          <Textarea
            label="Income Details (JSON)"
            name="income_details"
            value={formData.income_details}
            onChange={handleChange}
            rows={6}
            placeholder='{"annual_income": 50000, "source": "salary"}'
            helperText="Enter valid JSON format"
          />
          <Textarea
            label="Expenses Details (JSON)"
            name="expenses_details"
            value={formData.expenses_details}
            onChange={handleChange}
            rows={6}
            placeholder='{"monthly_expenses": 2000, "categories": ["rent", "utilities"]}'
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
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Personal Information</h3>
            <p><strong>Name:</strong> {formData.first_name} {formData.last_name}</p>
            <p><strong>Date of Birth:</strong> {formData.date_of_birth || 'Not provided'}</p>
            <p><strong>Phone:</strong> {formData.phone_number || 'Not provided'}</p>
          </div>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Address</h3>
            <p>{formData.address_1}</p>
            {formData.address_2 && <p>{formData.address_2}</p>}
            <p>{formData.city}, {formData.county} {formData.postcode}</p>
            <p>{formData.country}</p>
          </div>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Company</h3>
            <p><strong>Company Name:</strong> {formData.company_name || 'Not provided'}</p>
            <p><strong>Registration Number:</strong> {formData.registration_number || 'Not provided'}</p>
            <p><strong>Trading Name:</strong> {formData.trading_name || 'Not provided'}</p>
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

export default BorrowerProfile;
