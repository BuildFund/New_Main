import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Input from '../components/Input';
import Button from '../components/Button';
import Badge from '../components/Badge';

function LenderPrivateEquity() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [investmentData, setInvestmentData] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingCertification, setCheckingCertification] = useState(true);
  const [isCertified, setIsCertified] = useState(false);

  useEffect(() => {
    checkCertification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkCertification() {
    try {
      const res = await api.get('/api/private-equity/certification/status/');
      if (res.data.is_certified && res.data.is_valid) {
        setIsCertified(true);
        fetchOpportunities();
        fetchInvestments();
      } else {
        // Redirect to certification page
        navigate('/fca-certification');
      }
    } catch (err) {
      // If error, assume not certified and redirect
      if (err.response?.status === 404 || err.response?.status === 403) {
        navigate('/fca-certification');
      } else {
        setError('Failed to verify certification status');
      }
    } finally {
      setCheckingCertification(false);
    }
  }

  async function fetchOpportunities() {
    try {
      const res = await api.get('/api/private-equity/opportunities/');
      setOpportunities(res.data || []);
    } catch (err) {
      if (err.response?.status === 403) {
        // Permission denied - not certified
        navigate('/fca-certification');
      } else {
        setError('Failed to load opportunities');
      }
    }
  }

  async function fetchInvestments() {
    try {
      const res = await api.get('/api/private-equity/investments/');
      setInvestments(res.data || []);
    } catch (err) {
      // No need to set error here
    }
  }

  const handleChange = (id, e) => {
    const { name, value } = e.target;
    setInvestmentData({
      ...investmentData,
      [id]: {
        ...investmentData[id],
        [name]: value,
      },
    });
  };

  const handleInvest = async (id) => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    const data = investmentData[id] || {};
    if (!data.amount || !data.share) {
      setError('Please enter both amount and share');
      setLoading(false);
      return;
    }
    try {
      await api.post('/api/private-equity/investments/', {
        opportunity: id,
        amount: parseFloat(data.amount),
        share: parseFloat(data.share),
        notes: data.notes || '',
      });
      setSuccess('Investment submitted successfully');
      fetchInvestments();
      setInvestmentData({ ...investmentData, [id]: {} });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit investment');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      approved: { variant: 'success', label: 'Approved' },
      pending: { variant: 'warning', label: 'Pending' },
      accepted: { variant: 'success', label: 'Accepted' },
      rejected: { variant: 'error', label: 'Rejected' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (checkingCertification) {
    return (
      <div style={{ ...commonStyles.container, textAlign: 'center', padding: theme.spacing['3xl'] }}>
        <p style={{ color: theme.colors.textSecondary }}>Verifying certification...</p>
      </div>
    );
  }

  if (!isCertified) {
    return null; // Will redirect to certification
  }

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: theme.spacing.xl }}>
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
          Browse and invest in approved private equity opportunities
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

      {success && (
        <div style={{
          background: theme.colors.successLight,
          color: theme.colors.successDark,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
          border: `1px solid ${theme.colors.success}`,
        }}>
          {success}
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
            No approved opportunities available.
          </p>
        </div>
      ) : (
        <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden', marginBottom: theme.spacing['2xl'] }}>
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
                  <th style={commonStyles.tableCell}>Action</th>
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
                    <td style={commonStyles.tableCell}>
                      {opp.status !== 'approved' ? (
                        <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                          Not available
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: theme.spacing.xs, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="number"
                            name="amount"
                            placeholder="Amount (£)"
                            value={(investmentData[opp.id] && investmentData[opp.id].amount) || ''}
                            onChange={(e) => handleChange(opp.id, e)}
                            style={{
                              ...commonStyles.input,
                              width: '120px',
                              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                              fontSize: theme.typography.fontSize.sm,
                            }}
                          />
                          <input
                            type="number"
                            step="0.01"
                            name="share"
                            placeholder="Share (%)"
                            value={(investmentData[opp.id] && investmentData[opp.id].share) || ''}
                            onChange={(e) => handleChange(opp.id, e)}
                            style={{
                              ...commonStyles.input,
                              width: '100px',
                              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                              fontSize: theme.typography.fontSize.sm,
                            }}
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleInvest(opp.id)}
                            loading={loading}
                          >
                            Invest
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginBottom: theme.spacing.xl }}>
        <h2 style={{
          fontSize: theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.semibold,
          margin: `0 0 ${theme.spacing.lg} 0`,
          color: theme.colors.textPrimary,
        }}>
          My Investments
        </h2>
        {investments.length === 0 ? (
          <div style={{
            ...commonStyles.card,
            textAlign: 'center',
            padding: theme.spacing['2xl'],
          }}>
            <p style={{ 
              color: theme.colors.textSecondary, 
              fontSize: theme.typography.fontSize.lg,
              margin: 0,
            }}>
              No investments made yet.
            </p>
          </div>
        ) : (
          <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={commonStyles.table}>
                <thead style={commonStyles.tableHeader}>
                  <tr>
                    <th style={commonStyles.tableCell}>Opportunity</th>
                    <th style={commonStyles.tableCell}>Amount (£)</th>
                    <th style={commonStyles.tableCell}>Share (%)</th>
                    <th style={commonStyles.tableCell}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: `1px solid ${theme.colors.gray200}` }}>
                      <td style={commonStyles.tableCell}>{inv.opportunity || 'N/A'}</td>
                      <td style={commonStyles.tableCell}>£{parseFloat(inv.amount || 0).toLocaleString()}</td>
                      <td style={commonStyles.tableCell}>{inv.share}%</td>
                      <td style={commonStyles.tableCell}>{getStatusBadge(inv.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LenderPrivateEquity;
