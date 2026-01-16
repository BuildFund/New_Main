import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Input from '../components/Input';
import Textarea from '../components/Textarea';

function ConsultantEnquiryDetail() {
  const { enquiryId } = useParams();
  const navigate = useNavigate();
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [showAcknowledgeForm, setShowAcknowledgeForm] = useState(false);
  const [acknowledgeData, setAcknowledgeData] = useState({
    expected_quote_date: '',
    acknowledgment_notes: '',
  });

  useEffect(() => {
    loadEnquiry();
  }, [enquiryId]);

  async function loadEnquiry() {
    try {
      const res = await api.get(`/api/deals/provider-enquiries/${enquiryId}/`);
      setEnquiry(res.data);
    } catch (err) {
      setError('Failed to load enquiry details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    setAcknowledging(true);
    setError(null);

    try {
      await api.post(`/api/deals/provider-enquiries/${enquiryId}/acknowledge/`, {
        expected_quote_date: acknowledgeData.expected_quote_date,
        acknowledgment_notes: acknowledgeData.acknowledgment_notes,
      });
      await loadEnquiry();
      setShowAcknowledgeForm(false);
      setAcknowledgeData({ expected_quote_date: '', acknowledgment_notes: '' });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to acknowledge enquiry');
    } finally {
      setAcknowledging(false);
    }
  };

  const handleMarkViewed = async () => {
    try {
      await api.post(`/api/deals/provider-enquiries/${enquiryId}/mark_viewed/`);
      await loadEnquiry();
    } catch (err) {
      console.error('Failed to mark as viewed:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
        <p>Loading enquiry details...</p>
      </div>
    );
  }

  if (error && !enquiry) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <div style={commonStyles.card}>
          <h2>Error</h2>
          <p>{error}</p>
          <Button onClick={() => navigate('/consultant/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <div style={commonStyles.card}>
          <h2>Enquiry Not Found</h2>
          <p>The enquiry you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/consultant/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const isExpired = enquiry.quote_due_at && new Date(enquiry.quote_due_at) < new Date();
  const dealSummary = enquiry.deal_summary_snapshot || {};
  const project = dealSummary.project || {};
  const borrower = dealSummary.borrower || {};
  const lender = dealSummary.lender || {};
  const product = dealSummary.product || {};
  const commercialIndicators = dealSummary.commercial_indicators || {};

  return (
    <div style={{ padding: theme.spacing.xl }}>
      <div style={{ marginBottom: theme.spacing.lg }}>
        <Button variant="outline" onClick={() => navigate('/consultant/dashboard')}>
          ← Back to Dashboard
        </Button>
      </div>

      <div style={commonStyles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.lg }}>
          <div>
            <h1 style={{ margin: 0 }}>Quote Request Details</h1>
            <p style={{ color: theme.colors.textSecondary, margin: `${theme.spacing.xs} 0 0 0` }}>
              Deal {enquiry.deal_id_display || enquiry.deal}
            </p>
          </div>
          <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <Badge color={theme.colors.primary}>
              {enquiry.role_type_display || enquiry.role_type}
            </Badge>
            <Badge color={getStatusColor(enquiry.status)}>
              {enquiry.status_display || enquiry.status}
            </Badge>
            {isExpired && (
              <Badge color={theme.colors.error}>Expired</Badge>
            )}
            {enquiry.acknowledged_at && (
              <Badge color={theme.colors.success}>Acknowledged</Badge>
            )}
          </div>
        </div>

        {error && (
          <div style={{
            padding: theme.spacing.md,
            background: theme.colors.errorLight,
            color: theme.colors.errorDark,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
          }}>
            {error}
          </div>
        )}

        {/* Key Information Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.xl,
        }}>
          <div style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.md }}>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Received</p>
            <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontWeight: theme.typography.fontWeight.semibold }}>
              {new Date(enquiry.sent_at).toLocaleDateString()}
            </p>
          </div>
          {enquiry.quote_due_at && (
            <div style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.md }}>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Quote Due</p>
              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontWeight: theme.typography.fontWeight.semibold, color: isExpired ? theme.colors.error : 'inherit' }}>
                {new Date(enquiry.quote_due_at).toLocaleDateString()}
              </p>
            </div>
          )}
          {enquiry.expected_quote_date && (
            <div style={{ padding: theme.spacing.md, background: theme.colors.successLight, borderRadius: theme.borderRadius.md }}>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Expected Quote Date</p>
              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontWeight: theme.typography.fontWeight.semibold }}>
                {new Date(enquiry.expected_quote_date).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Project Information */}
        {Object.keys(project).length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Project Information</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {project.property_type_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Property Type:</strong> {project.property_type_display}
                </div>
              )}
              {project.address && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Address:</strong> {project.address}
                  {project.town && `, ${project.town}`}
                  {project.county && `, ${project.county}`}
                  {project.postcode && ` ${project.postcode}`}
                </div>
              )}
              {project.description && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Description:</strong>
                  <p style={{ margin: `${theme.spacing.xs} 0 0 0`, whiteSpace: 'pre-wrap' }}>{project.description}</p>
                </div>
              )}
              {project.development_extent_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Development Extent:</strong> {project.development_extent_display}
                </div>
              )}
              {project.tenure_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Tenure:</strong> {project.tenure_display}
                </div>
              )}
              {project.planning_permission !== undefined && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Planning Permission:</strong> {project.planning_permission ? 'Yes' : 'No'}
                  {project.planning_reference && ` (Ref: ${project.planning_reference})`}
                </div>
              )}
              {project.planning_description && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Planning Description:</strong>
                  <p style={{ margin: `${theme.spacing.xs} 0 0 0` }}>{project.planning_description}</p>
                </div>
              )}
              {project.unit_counts && Object.keys(project.unit_counts).length > 0 && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Unit Counts:</strong> {JSON.stringify(project.unit_counts)}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                {project.gross_internal_area && (
                  <div>
                    <strong>GIA:</strong> {project.gross_internal_area.toLocaleString()} sq ft
                  </div>
                )}
                {project.purchase_price && (
                  <div>
                    <strong>Purchase Price:</strong> £{project.purchase_price.toLocaleString()}
                  </div>
                )}
                {project.build_cost && (
                  <div>
                    <strong>Build Cost:</strong> £{project.build_cost.toLocaleString()}
                  </div>
                )}
                {project.current_market_value && (
                  <div>
                    <strong>Current Market Value:</strong> £{project.current_market_value.toLocaleString()}
                  </div>
                )}
                {project.gross_development_value && (
                  <div>
                    <strong>GDV:</strong> £{project.gross_development_value.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Borrower Information */}
        {Object.keys(borrower).length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Borrower Information</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {borrower.company_name && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Company Name:</strong> {borrower.company_name}
                </div>
              )}
              {borrower.trading_name && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Trading Name:</strong> {borrower.trading_name}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lender Information */}
        {Object.keys(lender).length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Lender Information</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {lender.organisation_name && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Lender:</strong> {lender.organisation_name}
                </div>
              )}
              {lender.contact_email && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Contact Email:</strong> {lender.contact_email}
                </div>
              )}
              {lender.contact_phone && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Contact Phone:</strong> {lender.contact_phone}
                </div>
              )}
              {lender.website && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Website:</strong> <a href={lender.website} target="_blank" rel="noopener noreferrer">{lender.website}</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Product Information */}
        {Object.keys(product).length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Product Information</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {product.name && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Product Name:</strong> {product.name}
                </div>
              )}
              {product.funding_type_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Funding Type:</strong> {product.funding_type_display}
                </div>
              )}
              {product.description && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Description:</strong>
                  <p style={{ margin: `${theme.spacing.xs} 0 0 0` }}>{product.description}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Commercial Indicators */}
        {Object.keys(commercialIndicators).length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Deal Overview</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {dealSummary.facility_type_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Facility Type:</strong> {dealSummary.facility_type_display}
                </div>
              )}
              {commercialIndicators.loan_amount_range && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Loan Amount Range:</strong> {commercialIndicators.loan_amount_range}
                </div>
              )}
              {commercialIndicators.term_months && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Term:</strong> {commercialIndicators.term_months} months
                </div>
              )}
              {commercialIndicators.ltv_range && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>LTV Range:</strong> {commercialIndicators.ltv_range}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lender Notes */}
        {enquiry.lender_notes && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Lender Notes</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.infoLight }}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{enquiry.lender_notes}</p>
            </div>
          </div>
        )}

        {/* Acknowledgment Section */}
        {enquiry.acknowledged_at ? (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Your Acknowledgment</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.successLight }}>
              <p style={{ margin: `0 0 ${theme.spacing.sm} 0` }}>
                <strong>Acknowledged:</strong> {new Date(enquiry.acknowledged_at).toLocaleString()}
              </p>
              {enquiry.expected_quote_date && (
                <p style={{ margin: `0 0 ${theme.spacing.sm} 0` }}>
                  <strong>Expected Quote Date:</strong> {new Date(enquiry.expected_quote_date).toLocaleDateString()}
                </p>
              )}
              {enquiry.acknowledgment_notes && (
                <div style={{ marginTop: theme.spacing.sm }}>
                  <strong>Your Notes:</strong>
                  <p style={{ margin: `${theme.spacing.xs} 0 0 0`, whiteSpace: 'pre-wrap' }}>{enquiry.acknowledgment_notes}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          !showAcknowledgeForm && (
            <div style={{ marginBottom: theme.spacing.xl }}>
              <Button
                variant="primary"
                onClick={() => setShowAcknowledgeForm(true)}
              >
                Acknowledge Quote Request
              </Button>
            </div>
          )
        )}

        {/* Acknowledge Form */}
        {showAcknowledgeForm && !enquiry.acknowledged_at && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Acknowledge Quote Request</h2>
            <div style={commonStyles.card}>
              <form onSubmit={handleAcknowledge}>
                <Input
                  label="Expected Quote Date *"
                  name="expected_quote_date"
                  type="date"
                  value={acknowledgeData.expected_quote_date}
                  onChange={(e) => setAcknowledgeData({ ...acknowledgeData, expected_quote_date: e.target.value })}
                  required
                  style={{ marginBottom: theme.spacing.lg }}
                />
                <Textarea
                  label="Notes (Optional)"
                  name="acknowledgment_notes"
                  value={acknowledgeData.acknowledgment_notes}
                  onChange={(e) => setAcknowledgeData({ ...acknowledgeData, acknowledgment_notes: e.target.value })}
                  rows={4}
                  placeholder="Any notes about timeline, questions, or requirements..."
                  style={{ marginBottom: theme.spacing.lg }}
                />
                <div style={{ display: 'flex', gap: theme.spacing.md }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAcknowledgeForm(false);
                      setAcknowledgeData({ expected_quote_date: '', acknowledgment_notes: '' });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={acknowledging}
                  >
                    {acknowledging ? 'Acknowledging...' : 'Acknowledge'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
          {enquiry.status === 'sent' && !enquiry.viewed_at && (
            <Button
              variant="outline"
              onClick={handleMarkViewed}
            >
              Mark as Viewed
            </Button>
          )}
          {!enquiry.has_quote && enquiry.status !== 'declined' && (
            <Button
              variant="primary"
              onClick={() => navigate(`/consultant/enquiries/${enquiryId}/quote`)}
            >
              {enquiry.acknowledged_at ? 'Submit Quote' : 'Submit Quote (Without Acknowledgment)'}
            </Button>
          )}
          {enquiry.has_quote && (
            <Button
              variant="outline"
              onClick={() => navigate('/consultant/dashboard', { state: { activeTab: 'quotes' } })}
            >
              View Submitted Quote
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  function getStatusColor(status) {
    const colors = {
      sent: theme.colors.info,
      viewed: theme.colors.primary,
      quoted: theme.colors.success,
      declined: theme.colors.error,
      expired: theme.colors.error,
    };
    return colors[status] || theme.colors.gray500;
  }
}

export default ConsultantEnquiryDetail;
