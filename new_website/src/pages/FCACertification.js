import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Input from '../components/Input';
import Button from '../components/Button';
import Checkbox from '../components/Checkbox';

function FCACertification({ onComplete }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isCertified, setIsCertified] = useState(false);
  
  const [formData, setFormData] = useState({
    certification_type: 'sophisticated',
    is_high_net_worth: false,
    is_sophisticated: false,
    understands_risks: false,
    understands_illiquidity: false,
    can_afford_loss: false,
    has_received_advice: false,
    annual_income: '',
    net_assets: '',
    investment_experience_years: '',
  });

  useEffect(() => {
    checkCertificationStatus();
  }, []);

  async function checkCertificationStatus() {
    try {
      const res = await api.get('/api/private-equity/certification/status/');
      if (res.data.is_certified && res.data.is_valid) {
        setIsCertified(true);
        if (onComplete) {
          onComplete();
        }
      }
    } catch (err) {
      console.error('Failed to check certification status:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Validate all required checkboxes are checked
    const requiredCheckboxes = [
      'understands_risks',
      'understands_illiquidity',
      'can_afford_loss',
      'has_received_advice',
    ];

    if (!requiredCheckboxes.every(field => formData[field])) {
      setError('Please confirm all required declarations');
      setSubmitting(false);
      return;
    }

    // Type-specific validation
    if (formData.certification_type === 'high_net_worth' && !formData.is_high_net_worth) {
      setError('Please confirm you are a high net worth individual');
      setSubmitting(false);
      return;
    }

    if (['sophisticated', 'certified'].includes(formData.certification_type) && !formData.is_sophisticated) {
      setError('Please confirm you are a sophisticated investor');
      setSubmitting(false);
      return;
    }

    // Submit certification
    const payload = {
      ...formData,
      annual_income: formData.annual_income ? parseFloat(formData.annual_income) : null,
      net_assets: formData.net_assets ? parseFloat(formData.net_assets) : null,
      investment_experience_years: formData.investment_experience_years ? parseInt(formData.investment_experience_years) : null,
    };

    api.post('/api/private-equity/certification/submit/', payload)
      .then(() => {
        setIsCertified(true);
        if (onComplete) {
          onComplete();
        }
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to submit certification. Please try again.');
        setSubmitting(false);
      });
  }

  if (loading) {
    return (
      <div style={{ ...commonStyles.container, textAlign: 'center', padding: theme.spacing['3xl'] }}>
        <p style={{ color: theme.colors.textSecondary }}>Loading...</p>
      </div>
    );
  }

  if (isCertified) {
    return (
      <div style={{ ...commonStyles.container, textAlign: 'center', padding: theme.spacing['3xl'] }}>
        <div style={{
          ...commonStyles.card,
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          <div style={{ fontSize: '48px', marginBottom: theme.spacing.md }}>✅</div>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.md} 0`,
          }}>
            Certification Complete
          </h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            You have successfully completed FCA self-certification. You can now access Private Equity opportunities.
          </p>
          <Button variant="primary" onClick={() => navigate('/lender/private-equity')}>
            Continue to Private Equity
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...commonStyles.container, maxWidth: '800px', margin: '0 auto', padding: theme.spacing.xl }}>
      <div style={{ marginBottom: theme.spacing['2xl'] }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.bold,
          margin: `0 0 ${theme.spacing.sm} 0`,
        }}>
          FCA Self-Certification
        </h1>
        <p style={{ color: theme.colors.textSecondary }}>
          To access Private Equity opportunities, you must self-certify in accordance with FCA requirements.
          This is a one-time process.
        </p>
      </div>

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

      <form onSubmit={handleSubmit} style={commonStyles.card}>
        <div style={{ marginBottom: theme.spacing.xl }}>
          <h3 style={{
            fontSize: theme.typography.fontSize.xl,
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.md} 0`,
          }}>
            Certification Type
          </h3>
          <select
            name="certification_type"
            value={formData.certification_type}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: theme.spacing.sm,
              border: `1px solid ${theme.colors.gray300}`,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.fontSize.base,
            }}
          >
            <option value="sophisticated">Sophisticated Investor</option>
            <option value="high_net_worth">High Net Worth Individual</option>
            <option value="certified">Certified Sophisticated Investor</option>
            <option value="restricted">Restricted Investor</option>
          </select>
        </div>

        {/* Type-specific declarations */}
        {formData.certification_type === 'high_net_worth' && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <Checkbox
              name="is_high_net_worth"
              checked={formData.is_high_net_worth}
              onChange={handleChange}
              label="I confirm I am a high net worth individual (annual income > £100,000 or net assets > £250,000)"
            />
            <div style={{ marginTop: theme.spacing.md, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
              <Input
                label="Annual Income (GBP)"
                name="annual_income"
                type="number"
                value={formData.annual_income}
                onChange={handleChange}
                placeholder="Optional"
              />
              <Input
                label="Net Assets (GBP)"
                name="net_assets"
                type="number"
                value={formData.net_assets}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>
          </div>
        )}

        {['sophisticated', 'certified'].includes(formData.certification_type) && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <Checkbox
              name="is_sophisticated"
              checked={formData.is_sophisticated}
              onChange={handleChange}
              label="I confirm I am a sophisticated investor with knowledge and experience in unlisted securities"
            />
            <div style={{ marginTop: theme.spacing.md }}>
              <Input
                label="Years of Investment Experience (Optional)"
                name="investment_experience_years"
                type="number"
                value={formData.investment_experience_years}
                onChange={handleChange}
                placeholder="e.g., 5"
              />
            </div>
          </div>
        )}

        {/* Required declarations */}
        <div style={{ marginBottom: theme.spacing.xl }}>
          <h3 style={{
            fontSize: theme.typography.fontSize.xl,
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.md} 0`,
          }}>
            Required Declarations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
            <Checkbox
              name="understands_risks"
              checked={formData.understands_risks}
              onChange={handleChange}
              label="I understand that investments in unlisted securities carry significant risks"
              required
            />
            <Checkbox
              name="understands_illiquidity"
              checked={formData.understands_illiquidity}
              onChange={handleChange}
              label="I understand that these investments may be difficult to sell and may lose value"
              required
            />
            <Checkbox
              name="can_afford_loss"
              checked={formData.can_afford_loss}
              onChange={handleChange}
              label="I can afford to lose my entire investment without affecting my standard of living"
              required
            />
            <Checkbox
              name="has_received_advice"
              checked={formData.has_received_advice}
              onChange={handleChange}
              label="I have received appropriate advice or have sufficient experience to make this decision"
              required
            />
          </div>
        </div>

        <div style={{
          background: theme.colors.gray50,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.xl,
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.textSecondary,
        }}>
          <strong>Important:</strong> This self-certification is recorded for compliance purposes. 
          Your IP address and submission details are logged. You will not need to repeat this process.
        </div>

        <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Certification'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default FCACertification;
