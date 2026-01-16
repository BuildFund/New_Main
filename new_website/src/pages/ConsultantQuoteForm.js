import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Input from '../components/Input';
import Textarea from '../components/Textarea';
import Button from '../components/Button';

function ConsultantQuoteForm() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [formData, setFormData] = useState({
    quote_amount: '',
    quote_breakdown: '',
    estimated_completion_date: '',
    payment_terms: '',
    service_description: '',
    deliverables: '',
    timeline: '',
    terms_and_conditions: '',
    validity_period_days: '30',
    notes: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingService, setLoadingService] = useState(true);

  useEffect(() => {
    loadService();
  }, [serviceId]);

  async function loadService() {
    try {
      const res = await api.get(`/api/consultants/services/${serviceId}/`);
      setService(res.data);
    } catch (err) {
      setError('Failed to load service details');
      console.error(err);
    } finally {
      setLoadingService(false);
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
      const payload = {
        service: serviceId,
        quote_amount: parseFloat(formData.quote_amount),
        quote_breakdown: formData.quote_breakdown || null,
        estimated_completion_date: formData.estimated_completion_date || null,
        payment_terms: formData.payment_terms || null,
        service_description: formData.service_description || null,
        deliverables: formData.deliverables || null,
        timeline: formData.timeline || null,
        terms_and_conditions: formData.terms_and_conditions || null,
        validity_period_days: parseInt(formData.validity_period_days) || 30,
        notes: formData.notes || null,
      };

      await api.post('/api/consultants/quotes/', payload);
      navigate('/consultant/dashboard', {
        state: { message: 'Quote submitted successfully!' }
      });
    } catch (err) {
      console.error('Quote submission error:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to submit quote');
    } finally {
      setLoading(false);
    }
  };

  if (loadingService) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
        <p>Loading service details...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <div style={commonStyles.card}>
          <h2>Service Not Found</h2>
          <p>The service you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/consultant/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: theme.spacing.xl }}>
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1 style={{ ...theme.typography.h1, marginBottom: theme.spacing.sm }}>
          Submit Quote
        </h1>
        <p style={{ color: theme.colors.textSecondary }}>
          Service: {service.service_type_display || service.service_type} - Application #{service.application_id}
        </p>
      </div>

      {error && (
        <div style={{
          ...commonStyles.card,
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          marginBottom: theme.spacing.lg,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={commonStyles.card}>
          <h2 style={{ marginBottom: theme.spacing.lg }}>Quote Details</h2>

          <Input
            label="Quote Amount (£)"
            name="quote_amount"
            type="number"
            step="0.01"
            value={formData.quote_amount}
            onChange={handleChange}
            required
            placeholder="0.00"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Textarea
            label="Quote Breakdown"
            name="quote_breakdown"
            value={formData.quote_breakdown}
            onChange={handleChange}
            rows={4}
            placeholder="Break down the costs (e.g., Survey fee: £500, Report fee: £300, etc.)"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Input
            label="Estimated Completion Date"
            name="estimated_completion_date"
            type="date"
            value={formData.estimated_completion_date}
            onChange={handleChange}
            required
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Input
            label="Payment Terms"
            name="payment_terms"
            type="text"
            value={formData.payment_terms}
            onChange={handleChange}
            placeholder="e.g., 50% upfront, 50% on completion"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Textarea
            label="Service Description"
            name="service_description"
            value={formData.service_description}
            onChange={handleChange}
            rows={3}
            placeholder="Describe the service you will provide"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Textarea
            label="Deliverables"
            name="deliverables"
            value={formData.deliverables}
            onChange={handleChange}
            rows={3}
            placeholder="List what will be delivered (e.g., Survey report, Valuation certificate, etc.)"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Textarea
            label="Timeline"
            name="timeline"
            value={formData.timeline}
            onChange={handleChange}
            rows={2}
            placeholder="Expected timeline for completion"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Textarea
            label="Terms and Conditions"
            name="terms_and_conditions"
            value={formData.terms_and_conditions}
            onChange={handleChange}
            rows={4}
            placeholder="Any specific terms and conditions"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Input
            label="Validity Period (days)"
            name="validity_period_days"
            type="number"
            value={formData.validity_period_days}
            onChange={handleChange}
            placeholder="30"
            style={{ marginBottom: theme.spacing.lg }}
          />

          <Textarea
            label="Additional Notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Any additional information"
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
            >
              {loading ? 'Submitting...' : 'Submit Quote'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default ConsultantQuoteForm;
