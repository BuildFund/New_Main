import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Input from '../components/Input';
import Textarea from '../components/Textarea';
import Button from '../components/Button';
import Badge from '../components/Badge';

function ConsultantEnquiryQuoteForm() {
  const { enquiryId } = useParams();
  const navigate = useNavigate();
  const [enquiry, setEnquiry] = useState(null);
  const [formData, setFormData] = useState({
    price_gbp: '',
    lead_time_days: '',
    earliest_available_date: '',
    scope_summary: '',
    assumptions: '',
    deliverables: '',
    validity_days: '30',
    payment_terms: '',
    provider_notes: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingEnquiry, setLoadingEnquiry] = useState(true);

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
      setLoadingEnquiry(false);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate enquiry is loaded
      if (!enquiry) {
        setError('Enquiry details not loaded. Please refresh the page.');
        setLoading(false);
        return;
      }

      // Validate required fields
      if (!formData.price_gbp || !formData.lead_time_days || !formData.scope_summary) {
        setError('Please fill in all required fields (Price, Lead Time, Scope Summary).');
        setLoading(false);
        return;
      }

      // Parse deliverables if it's a string (comma-separated)
      let deliverablesList = [];
      if (formData.deliverables) {
        deliverablesList = formData.deliverables.split(',').map(d => d.trim()).filter(d => d);
      }

      const payload = {
        enquiry: parseInt(enquiryId), // Ensure it's an integer
        role_type: enquiry.role_type,
        price_gbp: parseFloat(formData.price_gbp),
        lead_time_days: parseInt(formData.lead_time_days),
        earliest_available_date: formData.earliest_available_date || null,
        scope_summary: formData.scope_summary.trim(),
        assumptions: (formData.assumptions || '').trim(),
        deliverables: deliverablesList,
        validity_days: parseInt(formData.validity_days) || 30,
        payment_terms: (formData.payment_terms || '').trim(),
        provider_notes: (formData.provider_notes || '').trim(),
      };

      // Validate numeric values
      if (isNaN(payload.price_gbp) || payload.price_gbp <= 0) {
        setError('Please enter a valid quote price.');
        setLoading(false);
        return;
      }

      if (isNaN(payload.lead_time_days) || payload.lead_time_days <= 0) {
        setError('Please enter a valid lead time in days.');
        setLoading(false);
        return;
      }

      console.log('Submitting quote with payload:', payload);
      const response = await api.post('/api/deals/provider-quotes/', payload);
      console.log('Quote submission response:', response.data);
      
      navigate('/consultant/dashboard', {
        state: { message: 'Quote submitted successfully!', activeTab: 'quotes' }
      });
    } catch (err) {
      console.error('Quote submission error:', err);
      console.error('Error response:', err.response);
      
      // Extract detailed error message
      let errorMessage = 'Failed to submit quote';
      if (err.response) {
        if (err.response.data) {
          if (typeof err.response.data === 'string') {
            errorMessage = err.response.data;
          } else if (err.response.data.detail) {
            errorMessage = err.response.data.detail;
          } else if (err.response.data.error) {
            errorMessage = err.response.data.error;
          } else if (err.response.data.non_field_errors) {
            errorMessage = err.response.data.non_field_errors.join(', ');
          } else {
            // Try to extract field-specific errors
            const fieldErrors = Object.entries(err.response.data)
              .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
              .join('; ');
            if (fieldErrors) {
              errorMessage = fieldErrors;
            }
          }
        } else {
          errorMessage = `Server error: ${err.response.status} ${err.response.statusText}`;
        }
      } else if (err.request) {
        errorMessage = 'Network error: Could not connect to server. Please check your connection.';
      } else {
        errorMessage = err.message || 'Unknown error occurred';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingEnquiry) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
        <p>Loading enquiry details...</p>
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

  return (
    <div style={{ padding: theme.spacing.xl }}>
      <div style={{ marginBottom: theme.spacing.xl }}>
        <Button variant="outline" onClick={() => navigate('/consultant/dashboard')}>
          ← Back to Dashboard
        </Button>
      </div>

      <div style={commonStyles.card}>
        <h1 style={{ marginBottom: theme.spacing.lg }}>Submit Quote</h1>

        {/* Enquiry Details */}
        <div style={{
          padding: theme.spacing.md,
          background: theme.colors.gray50,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
        }}>
          <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0` }}>Enquiry Details</h3>
          <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap', marginBottom: theme.spacing.sm }}>
            <Badge variant="info">
              {enquiry.role_type_display || enquiry.role_type || 'N/A'}
            </Badge>
            <Badge variant={getStatusVariant(enquiry.status)}>
              {enquiry.status_display || enquiry.status || 'N/A'}
            </Badge>
            {isExpired && (
              <Badge variant="error">Expired</Badge>
            )}
          </div>
          <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
            <strong>Deal:</strong> {enquiry.deal_id_display || enquiry.deal}
          </p>
          {enquiry.quote_due_at && (
            <p style={{ margin: `${theme.spacing.xs} 0`, color: isExpired ? theme.colors.error : theme.colors.textSecondary }}>
              <strong>Quote Due:</strong> {new Date(enquiry.quote_due_at).toLocaleDateString()}
            </p>
          )}
          {enquiry.deal_summary_snapshot && Object.keys(enquiry.deal_summary_snapshot).length > 0 && (
            <div style={{ marginTop: theme.spacing.sm }}>
              <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                <strong>Deal Summary:</strong>
              </p>
              <pre style={{
                fontSize: theme.typography.fontSize.sm,
                background: theme.colors.white,
                padding: theme.spacing.sm,
                borderRadius: theme.borderRadius.sm,
                overflow: 'auto',
              }}>
                {JSON.stringify(enquiry.deal_summary_snapshot, null, 2)}
              </pre>
            </div>
          )}
          {enquiry.lender_notes && (
            <p style={{ margin: `${theme.spacing.sm} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>
              <strong>Lender Notes:</strong> {enquiry.lender_notes}
            </p>
          )}
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

        {isExpired && (
          <div style={{
            padding: theme.spacing.md,
            background: theme.colors.warningLight,
            color: theme.colors.warningDark,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
          }}>
            This enquiry has expired. You can still submit a quote, but it may not be considered.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Quote Price (GBP) *"
            name="price_gbp"
            type="number"
            step="0.01"
            value={formData.price_gbp}
            onChange={handleChange}
            placeholder="0.00"
            required
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Input
            label="Lead Time (days) *"
            name="lead_time_days"
            type="number"
            value={formData.lead_time_days}
            onChange={handleChange}
            placeholder="e.g., 14"
            required
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Input
            label="Earliest Available Date"
            name="earliest_available_date"
            type="date"
            value={formData.earliest_available_date}
            onChange={handleChange}
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Textarea
            label="Scope Summary *"
            name="scope_summary"
            value={formData.scope_summary}
            onChange={handleChange}
            rows={4}
            placeholder="Summary of services included in this quote"
            required
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Textarea
            label="Assumptions & Exclusions"
            name="assumptions"
            value={formData.assumptions}
            onChange={handleChange}
            rows={3}
            placeholder="Any assumptions or exclusions to note"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Input
            label="Deliverables (comma-separated)"
            name="deliverables"
            type="text"
            value={formData.deliverables}
            onChange={handleChange}
            placeholder="e.g., Valuation Report, Site Visit, Final Report"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Input
            label="Validity Period (days)"
            name="validity_days"
            type="number"
            value={formData.validity_days}
            onChange={handleChange}
            placeholder="30"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Textarea
            label="Payment Terms"
            name="payment_terms"
            value={formData.payment_terms}
            onChange={handleChange}
            rows={2}
            placeholder="Payment terms and schedule"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Textarea
            label="Additional Notes"
            name="provider_notes"
            value={formData.provider_notes}
            onChange={handleChange}
            rows={3}
            placeholder="Any additional information or internal notes"
            style={{ marginBottom: theme.spacing.xl }}
          />

          <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/consultant/dashboard')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={isExpired}
            >
              {loading ? 'Submitting...' : 'Submit Quote'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  function getStatusVariant(status) {
    if (!status) return 'info';
    const variantMap = {
      sent: 'info',
      received: 'info',
      acknowledged: 'info',
      preparing_quote: 'warning',
      queries_raised: 'warning',
      ready_to_submit: 'success',
      quoted: 'success',
      declined: 'error',
      expired: 'error',
    };
    return variantMap[status] || 'info';
  }
}

export default ConsultantEnquiryQuoteForm;
