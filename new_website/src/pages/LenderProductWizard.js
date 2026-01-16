import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Wizard from '../components/Wizard';
import Input from '../components/Input';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import Button from '../components/Button';

function LenderProductWizard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    funding_type: 'mortgage',
    property_type: 'residential',
    repayment_structure: 'interest_only',
    min_loan_amount: '',
    max_loan_amount: '',
    interest_rate_min: '',
    interest_rate_max: '',
    term_min_months: '',
    term_max_months: '',
    max_ltv_ratio: '',
    arrangement_fee: '',
    admin_fee: '',
    chaps_fee: '',
    surveyor_fee: '',
    insurance_fee: '',
    exit_fee: '',
    eligibility_criteria: '',
  });

  const isPropertyBasedFunding = (fundingType) => {
    const propertyBasedTypes = [
      'development_finance', 'senior_debt', 'commercial_mortgage', 
      'mortgage', 'equity'
    ];
    return propertyBasedTypes.includes(fundingType);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    
    // If funding type changes to non-property, set property_type to N/A
    if (name === 'funding_type' && !isPropertyBasedFunding(value)) {
      newFormData.property_type = 'n/a';
    } else if (name === 'funding_type' && isPropertyBasedFunding(value) && formData.property_type === 'n/a') {
      // If changing to property-based, set default property type
      newFormData.property_type = 'residential';
    }
    
    setFormData(newFormData);
  };

  useEffect(() => {
    if (isEditing) {
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    setLoadingProduct(true);
    try {
      const response = await api.get(`/api/products/${id}/`);
      const product = response.data;
      setFormData({
        name: product.name || '',
        description: product.description || '',
        funding_type: product.funding_type || 'mortgage',
        property_type: product.property_type || 'residential',
        repayment_structure: product.repayment_structure || 'interest_only',
        min_loan_amount: product.min_loan_amount || '',
        max_loan_amount: product.max_loan_amount || '',
        interest_rate_min: product.interest_rate_min || '',
        interest_rate_max: product.interest_rate_max || '',
        term_min_months: product.term_min_months || '',
        term_max_months: product.term_max_months || '',
        max_ltv_ratio: product.max_ltv_ratio || '',
        arrangement_fee: '',
        admin_fee: '',
        chaps_fee: '',
        surveyor_fee: '',
        insurance_fee: '',
        exit_fee: '',
        eligibility_criteria: product.eligibility_criteria || '',
      });
    } catch (err) {
      console.error('Failed to load product:', err);
      setError('Failed to load product details');
    } finally {
      setLoadingProduct(false);
    }
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        funding_type: formData.funding_type,
        property_type: isPropertyBasedFunding(formData.funding_type) ? formData.property_type : 'n/a',
        repayment_structure: formData.repayment_structure,
        min_loan_amount: formData.min_loan_amount,
        max_loan_amount: formData.max_loan_amount,
        interest_rate_min: formData.interest_rate_min,
        interest_rate_max: formData.interest_rate_max,
        term_min_months: formData.term_min_months,
        term_max_months: formData.term_max_months,
        max_ltv_ratio: formData.max_ltv_ratio,
        eligibility_criteria: formData.eligibility_criteria,
      };
      
      if (isEditing) {
        await api.patch(`/api/products/${id}/`, payload);
      } else {
        await api.post('/api/products/', payload);
      }
      navigate('/lender/products');
    } catch (err) {
      console.error('Product save error:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || `Failed to ${isEditing ? 'update' : 'create'} product`);
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Basic Information', 'Loan Parameters', 'Fees & Eligibility'];

  return (
    <Wizard steps={steps} currentStep={step}>
      <div style={{ padding: theme.spacing.xl }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
          margin: `0 0 ${theme.spacing.lg} 0`,
          color: theme.colors.textPrimary,
        }}>
          {isEditing ? 'Edit Product' : 'Create New Product'}
        </h1>

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

        {step === 1 && (
          <div>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.xl} 0`,
              color: theme.colors.textPrimary,
            }}>
              Basic Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
              <Input
                label="Product Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter product name"
                style={{ gridColumn: '1 / -1' }}
              />

              <Select
                label="Funding Type"
                name="funding_type"
                value={formData.funding_type}
                onChange={handleChange}
                required
              >
                <optgroup label="Property & Development Finance">
                  <option value="development_finance">Development Finance</option>
                  <option value="senior_debt">Senior Debt/Development Finance</option>
                  <option value="commercial_mortgage">Commercial Mortgages</option>
                  <option value="mortgage">Mortgage Finance</option>
                  <option value="equity">Equity Finance</option>
                </optgroup>
                <optgroup label="Alternative Business Finance">
                  <option value="revenue_based">Revenue Based Funding</option>
                  <option value="merchant_cash_advance">Merchant Cash Advance</option>
                  <option value="term_loan_p2p">Term Loans (Peer-to-Peer)</option>
                  <option value="bank_overdraft">Bank Overdraft</option>
                  <option value="business_credit_card">Business Credit Cards</option>
                </optgroup>
                <optgroup label="Asset-Based Finance">
                  <option value="ip_funding">Intellectual Property (IP) Funding</option>
                  <option value="stock_finance">Stock Finance</option>
                  <option value="asset_finance">Asset Finance</option>
                  <option value="factoring">Factoring / Invoice Discounting</option>
                </optgroup>
                <optgroup label="Trade & Export Finance">
                  <option value="trade_finance">Trade Finance</option>
                  <option value="export_finance">Export Finance</option>
                </optgroup>
                <optgroup label="Public Sector">
                  <option value="public_sector_startup">Public Sector Funding (Start Up Loan)</option>
                </optgroup>
              </Select>

              <Select
                label="Property Type"
                name="property_type"
                value={formData.property_type}
                onChange={handleChange}
                required
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="mixed">Mixed</option>
                <option value="industrial">Industrial</option>
              </Select>

              <Select
                label="Repayment Structure"
                name="repayment_structure"
                value={formData.repayment_structure}
                onChange={handleChange}
              >
                <option value="interest_only">Interest Only</option>
                <option value="amortising">Amortising</option>
              </Select>
            </div>

            <Textarea
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the product..."
              style={{ marginTop: theme.spacing.lg }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
              <Button variant="primary" size="lg" onClick={nextStep}>
                Next →
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.xl} 0`,
              color: theme.colors.textPrimary,
            }}>
              Loan Parameters
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
              <Input
                label="Minimum Loan Amount (£)"
                type="number"
                name="min_loan_amount"
                value={formData.min_loan_amount}
                onChange={handleChange}
                required
                placeholder="0.00"
              />

              <Input
                label="Maximum Loan Amount (£)"
                type="number"
                name="max_loan_amount"
                value={formData.max_loan_amount}
                onChange={handleChange}
                required
                placeholder="0.00"
              />

              <Input
                label="Interest Rate Minimum (%)"
                type="number"
                step="0.01"
                name="interest_rate_min"
                value={formData.interest_rate_min}
                onChange={handleChange}
                required
                placeholder="0.00"
              />

              <Input
                label="Interest Rate Maximum (%)"
                type="number"
                step="0.01"
                name="interest_rate_max"
                value={formData.interest_rate_max}
                onChange={handleChange}
                required
                placeholder="0.00"
              />

              <Input
                label="Term Minimum (months)"
                type="number"
                name="term_min_months"
                value={formData.term_min_months}
                onChange={handleChange}
                required
                placeholder="12"
              />

              <Input
                label="Term Maximum (months)"
                type="number"
                name="term_max_months"
                value={formData.term_max_months}
                onChange={handleChange}
                required
                placeholder="60"
              />

              <Input
                label="Maximum LTV Ratio (%)"
                type="number"
                step="0.01"
                name="max_ltv_ratio"
                value={formData.max_ltv_ratio}
                onChange={handleChange}
                required
                placeholder="0.00"
                style={{ gridColumn: '1 / -1' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
              <Button variant="outline" size="lg" onClick={prevStep}>
                ← Back
              </Button>
              <Button variant="primary" size="lg" onClick={nextStep}>
                Next →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: `0 0 ${theme.spacing.xl} 0`,
              color: theme.colors.textPrimary,
            }}>
              Fees & Eligibility
            </h2>

            <div style={{ 
              marginBottom: theme.spacing.lg, 
              padding: theme.spacing.lg, 
              background: theme.colors.gray50,
              borderRadius: theme.borderRadius.md,
            }}>
              <h3 style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
                margin: `0 0 ${theme.spacing.md} 0`,
              }}>
                Fees (Optional)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
                <Input
                  label="Arrangement Fee (£)"
                  type="number"
                  step="0.01"
                  name="arrangement_fee"
                  value={formData.arrangement_fee}
                  onChange={handleChange}
                  placeholder="0.00"
                />

                <Input
                  label="Admin Fee (£)"
                  type="number"
                  step="0.01"
                  name="admin_fee"
                  value={formData.admin_fee}
                  onChange={handleChange}
                  placeholder="0.00"
                />

                <Input
                  label="CHAPS Fee (£)"
                  type="number"
                  step="0.01"
                  name="chaps_fee"
                  value={formData.chaps_fee}
                  onChange={handleChange}
                  placeholder="0.00"
                />

                <Input
                  label="Surveyor Fee (£)"
                  type="number"
                  step="0.01"
                  name="surveyor_fee"
                  value={formData.surveyor_fee}
                  onChange={handleChange}
                  placeholder="0.00"
                />

                <Input
                  label="Insurance Fee (£)"
                  type="number"
                  step="0.01"
                  name="insurance_fee"
                  value={formData.insurance_fee}
                  onChange={handleChange}
                  placeholder="0.00"
                />

                <Input
                  label="Exit Fee (£)"
                  type="number"
                  step="0.01"
                  name="exit_fee"
                  value={formData.exit_fee}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
            </div>

            <Textarea
              label="Eligibility Criteria"
              name="eligibility_criteria"
              value={formData.eligibility_criteria}
              onChange={handleChange}
              rows={6}
              placeholder="Describe the eligibility criteria for this product..."
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
              <Button variant="outline" size="lg" onClick={prevStep}>
                ← Back
              </Button>
              <Button variant="primary" size="lg" onClick={handleSubmit} loading={loading}>
                {loading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Product' : 'Create Product')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Wizard>
  );
}

export default LenderProductWizard;
