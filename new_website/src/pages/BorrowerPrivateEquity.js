import React, { useEffect, useState } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Input from '../components/Input';
import Textarea from '../components/Textarea';
import Button from '../components/Button';
import Badge from '../components/Badge';

function BorrowerPrivateEquity() {
  const [opportunities, setOpportunities] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    industry: '',
    funding_required: '',
    valuation: '',
    share_offered: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        const res = await api.get('/api/private-equity/opportunities/');
        setOpportunities(res.data || []);
      } catch (err) {
        setError('Failed to load opportunities');
      }
    }
    fetchOpportunities();
  }, []);

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
        title: formData.title,
        description: formData.description,
        industry: formData.industry,
        funding_required: parseFloat(formData.funding_required) || 0,
        valuation: formData.valuation ? parseFloat(formData.valuation) : null,
        share_offered: parseFloat(formData.share_offered) || 0,
      };
      const res = await api.post('/api/private-equity/opportunities/', payload);
      setOpportunities([...opportunities, res.data]);
      setFormData({
        title: '',
        description: '',
        industry: '',
        funding_required: '',
        valuation: '',
        share_offered: '',
      });
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create opportunity');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      approved: { variant: 'success', label: 'Approved' },
      pending_review: { variant: 'warning', label: 'Pending Review' },
      draft: { variant: 'info', label: 'Draft' },
      declined: { variant: 'error', label: 'Declined' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div style={commonStyles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xl }}>
        <div>
          <h1 style={{
            fontSize: theme.typography.fontSize['4xl'],
            fontWeight: theme.typography.fontWeight.bold,
            margin: `0 0 ${theme.spacing.sm} 0`,
            color: theme.colors.textPrimary,
          }}>
            Private Equity Opportunities
          </h1>
          <p style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.base,
            margin: 0,
          }}>
            Create and manage your private equity opportunities
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Opportunity'}
        </Button>
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

      {showForm && (
        <div style={{
          ...commonStyles.card,
          marginBottom: theme.spacing.xl,
        }}>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            Create New Opportunity
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
              <Input
                label="Title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="Enter opportunity title"
                style={{ gridColumn: '1 / -1' }}
              />
              <Input
                label="Industry"
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                placeholder="e.g., Technology, Healthcare"
              />
              <Input
                label="Funding Required (£)"
                type="number"
                step="0.01"
                name="funding_required"
                value={formData.funding_required}
                onChange={handleChange}
                required
                placeholder="0.00"
              />
              <Input
                label="Valuation (£)"
                type="number"
                step="0.01"
                name="valuation"
                value={formData.valuation}
                onChange={handleChange}
                placeholder="0.00"
              />
              <Input
                label="Share Offered (%)"
                type="number"
                step="0.01"
                name="share_offered"
                value={formData.share_offered}
                onChange={handleChange}
                required
                placeholder="0.00"
              />
            </div>
            <Textarea
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={5}
              placeholder="Describe the opportunity..."
              style={{ marginTop: theme.spacing.lg }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
              <Button variant="outline" size="lg" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="lg" type="submit" loading={loading}>
                {loading ? 'Creating...' : 'Create Opportunity'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {opportunities.length === 0 ? (
        <div style={{
          ...commonStyles.card,
          textAlign: 'center',
          padding: theme.spacing['3xl'],
        }}>
          <p style={{ 
            color: theme.colors.textSecondary, 
            fontSize: theme.typography.fontSize.lg,
            margin: 0,
          }}>
            No private equity opportunities found.
          </p>
        </div>
      ) : (
        <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={commonStyles.table}>
              <thead style={commonStyles.tableHeader}>
                <tr>
                  <th style={commonStyles.tableCell}>Title</th>
                  <th style={commonStyles.tableCell}>Industry</th>
                  <th style={commonStyles.tableCell}>Funding Required (£)</th>
                  <th style={commonStyles.tableCell}>Valuation (£)</th>
                  <th style={commonStyles.tableCell}>Share Offered (%)</th>
                  <th style={commonStyles.tableCell}>Status</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => (
                  <tr key={opp.id} style={{ borderBottom: `1px solid ${theme.colors.gray200}` }}>
                    <td style={{ ...commonStyles.tableCell, fontWeight: theme.typography.fontWeight.semibold }}>
                      {opp.title}
                    </td>
                    <td style={commonStyles.tableCell}>{opp.industry || '—'}</td>
                    <td style={commonStyles.tableCell}>£{parseFloat(opp.funding_required || 0).toLocaleString()}</td>
                    <td style={commonStyles.tableCell}>{opp.valuation ? `£${parseFloat(opp.valuation).toLocaleString()}` : '—'}</td>
                    <td style={commonStyles.tableCell}>{opp.share_offered}%</td>
                    <td style={commonStyles.tableCell}>{getStatusBadge(opp.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default BorrowerPrivateEquity;
