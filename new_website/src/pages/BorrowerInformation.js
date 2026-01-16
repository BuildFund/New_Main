import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';

function BorrowerInformation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [borrowerInfo, setBorrowerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    loadBorrowerInformation();
  }, [id]);

  async function loadBorrowerInformation() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/applications/${id}/borrower_information/`);
      setBorrowerInfo(res.data);
    } catch (err) {
      console.error('Failed to load borrower information:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load borrower information';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return `£${parseFloat(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const getValidationBadge = (status, score) => {
    if (status === 'valid') {
      return <Badge variant="success">✓ Valid {score !== null && `(${score}/100)`}</Badge>;
    } else if (status === 'invalid') {
      return <Badge variant="error">✗ Invalid {score !== null && `(${score}/100)`}</Badge>;
    } else {
      return <Badge variant="warning">⏳ Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div style={{ ...commonStyles.container, textAlign: 'center', padding: theme.spacing['3xl'] }}>
        <p style={{ color: theme.colors.textSecondary }}>Loading borrower information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={commonStyles.container}>
        <div style={{
          ...commonStyles.card,
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.xl,
        }}>
          <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Unable to View Borrower Information</h2>
          <p style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>{error}</p>
          <Link to={`/lender/applications/${id}`}>
            <Button variant="primary">Back to Application</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!borrowerInfo) {
    return null;
  }

  const sections = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'personal', label: 'Personal', icon: '👤' },
    { id: 'company', label: 'Company', icon: '🏢' },
    { id: 'financial', label: 'Financial', icon: '💰' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'project', label: 'Project', icon: '🏗️' },
    { id: 'underwriting', label: 'Assessment', icon: '🤖' },
  ];

  return (
    <div style={commonStyles.container}>
      {/* Header */}
      <div style={{ marginBottom: theme.spacing.xl }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md }}>
          <div>
            <h1 style={{
              fontSize: theme.typography.fontSize['4xl'],
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.textPrimary,
              margin: `0 0 ${theme.spacing.sm} 0`,
            }}>
              Borrower Information
            </h1>
            <p style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.base,
              margin: 0,
            }}>
              Comprehensive borrower profile and documentation
            </p>
          </div>
          <Link to={`/lender/applications/${id}`}>
            <Button variant="outline">← Back to Application</Button>
          </Link>
        </div>

        {/* Section Navigation */}
        <div style={{
          display: 'flex',
          gap: theme.spacing.sm,
          flexWrap: 'wrap',
          borderBottom: `2px solid ${theme.colors.gray200}`,
          paddingBottom: theme.spacing.sm,
        }}>
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                border: 'none',
                background: activeSection === section.id ? theme.colors.primary : 'transparent',
                color: activeSection === section.id ? theme.colors.white : theme.colors.textPrimary,
                borderRadius: theme.borderRadius.md,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                transition: 'all 0.2s',
              }}
            >
              {section.icon} {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Section */}
      {activeSection === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: theme.spacing.lg, marginBottom: theme.spacing.lg }}>
            {/* Personal Summary */}
            <div style={commonStyles.card}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0`, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                👤 Personal Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                <p style={{ margin: 0 }}>
                  <strong>Name:</strong> {borrowerInfo.personal.first_name} {borrowerInfo.personal.last_name}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Date of Birth:</strong> {formatDate(borrowerInfo.personal.date_of_birth)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Email:</strong> {borrowerInfo.personal.email}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Phone:</strong> {borrowerInfo.personal.phone_number || 'N/A'}
                </p>
              </div>
            </div>

            {/* Company Summary */}
            <div style={commonStyles.card}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0`, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                🏢 Company Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                <p style={{ margin: 0 }}>
                  <strong>Company Name:</strong> {borrowerInfo.company.company_name || 'N/A'}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Registration:</strong> {borrowerInfo.company.registration_number || 'N/A'}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Status:</strong> {borrowerInfo.company.company_status || 'N/A'}
                </p>
              </div>
            </div>

            {/* Financial Summary */}
            <div style={commonStyles.card}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0`, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                💰 Financial Summary
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                <p style={{ margin: 0 }}>
                  <strong>Annual Income:</strong> {formatCurrency(borrowerInfo.financial.annual_income)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Monthly Expenses:</strong> {formatCurrency(borrowerInfo.financial.monthly_expenses)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Total Assets:</strong> {formatCurrency(borrowerInfo.financial.total_assets)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Existing Debts:</strong> {formatCurrency(borrowerInfo.financial.existing_debts)}
                </p>
              </div>
            </div>

            {/* Application Summary */}
            <div style={commonStyles.card}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0`, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                📋 Application Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                <p style={{ margin: 0 }}>
                  <strong>Loan Amount:</strong> {formatCurrency(borrowerInfo.application.loan_amount)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Interest Rate:</strong> {borrowerInfo.application.interest_rate ? `${borrowerInfo.application.interest_rate}%` : 'N/A'}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Term:</strong> {borrowerInfo.application.term_months} months
                </p>
                <p style={{ margin: 0 }}>
                  <strong>LTV:</strong> {borrowerInfo.application.ltv_ratio ? `${borrowerInfo.application.ltv_ratio}%` : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Documents Summary */}
          <div style={commonStyles.card}>
            <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Documents Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md }}>
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold }}>
                  {borrowerInfo.documents.application_documents.length}
                </p>
                <p style={{ margin: 0, color: theme.colors.textSecondary }}>Application Documents</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold }}>
                  {borrowerInfo.documents.application_documents.filter(d => d.validation_status === 'valid').length}
                </p>
                <p style={{ margin: 0, color: theme.colors.textSecondary }}>Validated Documents</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold }}>
                  {borrowerInfo.documents.borrower_documents.length}
                </p>
                <p style={{ margin: 0, color: theme.colors.textSecondary }}>Borrower Documents</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Personal Information Section */}
      {activeSection === 'personal' && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Personal Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
            <div>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Basic Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>First Name</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.personal.first_name}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Last Name</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.personal.last_name}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Date of Birth</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{formatDate(borrowerInfo.personal.date_of_birth)}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Nationality</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.kyc.nationality || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>National Insurance Number</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.kyc.national_insurance_number || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Contact Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Email</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.personal.email}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Phone Number</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.personal.phone_number || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Address</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                    {borrowerInfo.contact.address_line_1 || 'N/A'}<br />
                    {borrowerInfo.contact.address_line_2 && `${borrowerInfo.contact.address_line_2}<br />`}
                    {borrowerInfo.contact.city || ''} {borrowerInfo.contact.county || ''}<br />
                    {borrowerInfo.contact.postcode || ''}<br />
                    {borrowerInfo.contact.country || 'United Kingdom'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Information Section */}
      {activeSection === 'company' && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Company Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
            <div>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Company Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Company Name</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.company.company_name || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Trading Name</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.company.trading_name || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Registration Number</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.company.registration_number || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Company Type</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.company.company_type || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Company Status</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.company.company_status || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Incorporation Date</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{formatDate(borrowerInfo.company.incorporation_date)}</p>
                </div>
              </div>
            </div>
            {borrowerInfo.directors && borrowerInfo.directors.length > 0 && (
              <div>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Directors</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                  {borrowerInfo.directors.map((director, idx) => (
                    <div key={idx} style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.md }}>
                      <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{director.name || 'N/A'}</p>
                      {director.date_of_birth && (
                        <p style={{ margin: `${theme.spacing.xs} 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          DOB: {formatDate(director.date_of_birth)}
                        </p>
                      )}
                      {director.nationality && (
                        <p style={{ margin: `${theme.spacing.xs} 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          Nationality: {director.nationality}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financial Information Section */}
      {activeSection === 'financial' && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Financial Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
            <div>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Income & Employment</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Annual Income</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.lg }}>
                    {formatCurrency(borrowerInfo.financial.annual_income)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Employment Status</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.financial.employment_status || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Employer</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.financial.employment_company || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Position</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.financial.employment_position || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Source of Funds</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.financial.source_of_funds || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Expenses & Assets</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Monthly Expenses</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.lg }}>
                    {formatCurrency(borrowerInfo.financial.monthly_expenses)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Total Assets</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.lg }}>
                    {formatCurrency(borrowerInfo.financial.total_assets)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Existing Debts</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.lg }}>
                    {formatCurrency(borrowerInfo.financial.existing_debts)}
                  </p>
                </div>
                {borrowerInfo.financial.annual_income && borrowerInfo.financial.monthly_expenses && (
                  <div style={{ marginTop: theme.spacing.md, padding: theme.spacing.md, background: theme.colors.infoLight, borderRadius: theme.borderRadius.md }}>
                    <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Monthly Income (approx)</p>
                    <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                      {formatCurrency(borrowerInfo.financial.annual_income / 12)}
                    </p>
                    <p style={{ margin: `${theme.spacing.xs} 0 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Disposable Income (approx)</p>
                    <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                      {formatCurrency((borrowerInfo.financial.annual_income / 12) - (borrowerInfo.financial.monthly_expenses || 0))}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documents Section */}
      {activeSection === 'documents' && (
        <div>
          {/* Application Documents */}
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Application Documents</h2>
            {borrowerInfo.documents.application_documents.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary }}>No application documents uploaded.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: theme.spacing.md }}>
                {borrowerInfo.documents.application_documents.map(doc => (
                  <div key={doc.id} style={{
                    padding: theme.spacing.md,
                    border: `1px solid ${theme.colors.gray200}`,
                    borderRadius: theme.borderRadius.md,
                    background: doc.validation_status === 'valid' ? theme.colors.successLight : 
                               doc.validation_status === 'invalid' ? theme.colors.errorLight : 
                               theme.colors.gray50,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{doc.file_name}</p>
                        {doc.document_type && (
                          <Badge variant="info" style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.fontSize.xs }}>
                            {doc.document_type}
                          </Badge>
                        )}
                      </div>
                      {getValidationBadge(doc.validation_status, doc.validation_score)}
                    </div>
                    {doc.description && (
                      <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                        {doc.description}
                      </p>
                    )}
                    <p style={{ margin: `${theme.spacing.xs} 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textMuted }}>
                      {(doc.file_size / 1024).toFixed(2)} KB • {formatDate(doc.uploaded_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Borrower Documents */}
          {borrowerInfo.documents.borrower_documents.length > 0 && (
            <div style={commonStyles.card}>
              <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Additional Borrower Documents</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: theme.spacing.md }}>
                {borrowerInfo.documents.borrower_documents.map(doc => (
                  <div key={doc.id} style={{
                    padding: theme.spacing.md,
                    border: `1px solid ${theme.colors.gray200}`,
                    borderRadius: theme.borderRadius.md,
                  }}>
                    <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{doc.file_name}</p>
                    {doc.document_type && (
                      <Badge variant="info" style={{ marginTop: theme.spacing.xs, fontSize: theme.typography.fontSize.xs }}>
                        {doc.document_type}
                      </Badge>
                    )}
                    <p style={{ margin: `${theme.spacing.xs} 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textMuted }}>
                      {(doc.file_size / 1024).toFixed(2)} KB • {formatDate(doc.uploaded_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Project Section */}
      {activeSection === 'project' && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Project Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
            <div>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Project Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Project Reference</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.project.project_reference || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Property Type</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.project.property_type || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Funding Type</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerInfo.project.funding_type || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Loan Amount Required</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.lg }}>
                    {formatCurrency(borrowerInfo.project.loan_amount_required)}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Property Address</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                  {borrowerInfo.project.address || 'N/A'}<br />
                  {borrowerInfo.project.town || ''} {borrowerInfo.project.county || ''}<br />
                  {borrowerInfo.project.postcode || ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Underwriting Assessment Section */}
      {activeSection === 'underwriting' && borrowerInfo.underwriting && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>AI Underwriting Assessment</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg, marginBottom: theme.spacing.lg }}>
            <div>
              <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Risk Score</p>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize['3xl'], fontWeight: theme.typography.fontWeight.bold }}>
                {borrowerInfo.underwriting.risk_score || 'N/A'}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>Recommendation</p>
              <Badge 
                variant={borrowerInfo.underwriting.recommendation === 'approve' ? 'success' : 
                        borrowerInfo.underwriting.recommendation === 'decline' ? 'error' : 'warning'}
                style={{ fontSize: theme.typography.fontSize.lg, padding: theme.spacing.sm }}
              >
                {borrowerInfo.underwriting.recommendation || 'Pending'}
              </Badge>
            </div>
          </div>
          
          {borrowerInfo.underwriting.summary && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Summary</h3>
              <p style={{ margin: 0, lineHeight: theme.typography.lineHeight.relaxed }}>
                {borrowerInfo.underwriting.summary}
              </p>
            </div>
          )}

          {borrowerInfo.underwriting.strengths && borrowerInfo.underwriting.strengths.length > 0 && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Strengths</h3>
              <ul style={{ margin: 0, paddingLeft: theme.spacing.lg }}>
                {borrowerInfo.underwriting.strengths.map((strength, idx) => (
                  <li key={idx} style={{ marginBottom: theme.spacing.xs }}>{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {borrowerInfo.underwriting.concerns && borrowerInfo.underwriting.concerns.length > 0 && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Concerns</h3>
              <ul style={{ margin: 0, paddingLeft: theme.spacing.lg }}>
                {borrowerInfo.underwriting.concerns.map((concern, idx) => (
                  <li key={idx} style={{ marginBottom: theme.spacing.xs }}>{concern}</li>
                ))}
              </ul>
            </div>
          )}

          {borrowerInfo.underwriting.key_findings && borrowerInfo.underwriting.key_findings.length > 0 && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Key Findings</h3>
              <ul style={{ margin: 0, paddingLeft: theme.spacing.lg }}>
                {borrowerInfo.underwriting.key_findings.map((finding, idx) => (
                  <li key={idx} style={{ marginBottom: theme.spacing.xs }}>{finding}</li>
                ))}
              </ul>
            </div>
          )}

          {borrowerInfo.underwriting.recommendations && (
            <div>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Recommendations</h3>
              <p style={{ margin: 0, lineHeight: theme.typography.lineHeight.relaxed }}>
                {borrowerInfo.underwriting.recommendations}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BorrowerInformation;
