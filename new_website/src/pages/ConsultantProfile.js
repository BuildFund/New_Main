import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';
import CompanyDetails from '../components/CompanyDetails';

function ConsultantProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/consultants/profiles/');
      const data = Array.isArray(response.data) ? response.data[0] : response.data;
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Failed to load profile');
    }
  };

  if (!profile && !error) {
    return (
      <div style={{ ...commonStyles.container, padding: theme.spacing.xl }}>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div style={{ ...commonStyles.container, padding: theme.spacing.xl }}>
        <p style={{ color: theme.colors.error }}>{error}</p>
        <Button onClick={() => navigate('/consultant/profile/wizard')}>
          Create Profile
        </Button>
      </div>
    );
  }

  const organisationName = profile.organisation_name || 'Consultant';
  const location = [
    profile.city,
    profile.county,
    profile.postcode,
    profile.country,
  ].filter(Boolean).join(', ') || 'Location not specified';

  const address = [
    profile.address_line_1,
    profile.address_line_2,
    profile.city,
    profile.county,
    profile.postcode,
    profile.country,
  ].filter(Boolean).join(', ');

  return (
    <div style={commonStyles.container}>
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
          {organisationName.charAt(0).toUpperCase()}
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
              {organisationName}
            </h1>
            {profile.trading_name && (
              <p style={{
                fontSize: theme.typography.fontSize.lg,
                color: theme.colors.textSecondary,
                margin: `0 0 ${theme.spacing.xs} 0`,
              }}>
                Trading as: {profile.trading_name}
              </p>
            )}
            <p style={{
              fontSize: theme.typography.fontSize.base,
              color: theme.colors.textSecondary,
              margin: `0 0 ${theme.spacing.xs} 0`,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}>
              <span>{profile.get_primary_service_display || profile.primary_service || 'Consultant'}</span>
              {profile.is_verified && <Badge variant="success">Verified</Badge>}
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
          <Button variant="primary" onClick={() => navigate('/consultant/profile/wizard')}>
            ✏️ Edit Profile
          </Button>
        </div>
      </div>

      {/* Service Description */}
      {profile.service_description && (
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
            {profile.service_description}
          </p>
        </div>
      )}

      {/* Company Information */}
      {profile.company_registration_number && (
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
            Company Information
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.md }}>
            {profile.company_registration_number && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Company Number</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium }}>
                  {profile.company_registration_number}
                </p>
              </div>
            )}
          </div>
          {profile.company_registration_number && (
            <div style={{ marginTop: theme.spacing.xl }}>
              <CompanyDetails 
                companyNumber={profile.company_registration_number}
                apiBasePath="/api/verification/company"
              />
            </div>
          )}
        </div>
      )}

      {/* Services & Qualifications */}
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
          Services & Qualifications
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.md }}>
          {profile.primary_service && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Primary Service</p>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium }}>
                {profile.primary_service.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            </div>
          )}
          {profile.services_offered && profile.services_offered.length > 0 && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Services Offered</p>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>
                {profile.services_offered.map(s => s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
              </p>
            </div>
          )}
          {profile.qualifications && profile.qualifications.length > 0 && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Qualifications</p>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>
                {profile.qualifications.map(q => q.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
              </p>
            </div>
          )}
          {profile.professional_registration_numbers && Object.keys(profile.professional_registration_numbers).length > 0 && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Registration Numbers</p>
              <div style={{ marginTop: theme.spacing.xs }}>
                {Object.entries(profile.professional_registration_numbers).map(([key, value]) => (
                  <p key={key} style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.base }}>
                    <strong>{key.toUpperCase()}:</strong> {value}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Experience & Capacity */}
      {(profile.years_of_experience || profile.team_size || profile.current_capacity) && (
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
            Experience & Capacity
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md }}>
            {profile.years_of_experience && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Years of Experience</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                  {profile.years_of_experience}
                </p>
              </div>
            )}
            {profile.team_size && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Team Size</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                  {profile.team_size}
                </p>
              </div>
            )}
            {profile.current_capacity !== undefined && profile.max_capacity && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Capacity</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                  {profile.current_capacity} / {profile.max_capacity}
                </p>
              </div>
            )}
            {profile.average_response_time_days && (
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Avg Response Time</p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                  {profile.average_response_time_days} days
                </p>
              </div>
            )}
          </div>
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
          {profile.contact_email && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Email</p>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{profile.contact_email}</p>
            </div>
          )}
          {profile.contact_phone && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Phone</p>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{profile.contact_phone}</p>
            </div>
          )}
          {profile.website && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Website</p>
              <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{
                color: theme.colors.primary,
                textDecoration: 'none',
              }}>
                {profile.website}
              </a>
            </div>
          )}
          {address && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Address</p>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{address}</p>
            </div>
          )}
        </div>
        {profile.geographic_coverage && profile.geographic_coverage.length > 0 && (
          <div style={{ marginTop: theme.spacing.md }}>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Geographic Coverage</p>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>
              {profile.geographic_coverage.join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Insurance & Compliance */}
      {(profile.insurance_details || (profile.compliance_certifications && profile.compliance_certifications.length > 0)) && (
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
            Insurance & Compliance
          </h2>
          {profile.insurance_details && Object.keys(profile.insurance_details).length > 0 && (
            <div style={{ marginBottom: theme.spacing.md }}>
              <h3 style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
                marginBottom: theme.spacing.sm,
              }}>
                Professional Indemnity Insurance
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md }}>
                {profile.insurance_details.provider && (
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Provider</p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{profile.insurance_details.provider}</p>
                  </div>
                )}
                {profile.insurance_details.policy_number && (
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Policy Number</p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{profile.insurance_details.policy_number}</p>
                  </div>
                )}
                {profile.insurance_details.expiry_date && (
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Expiry Date</p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>
                      {new Date(profile.insurance_details.expiry_date).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                )}
                {profile.insurance_details.coverage_amount && (
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Coverage Amount</p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>{profile.insurance_details.coverage_amount}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {profile.compliance_certifications && profile.compliance_certifications.length > 0 && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Compliance Certifications</p>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.base }}>
                {profile.compliance_certifications.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConsultantProfile;
