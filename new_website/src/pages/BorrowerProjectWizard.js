import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Wizard from '../components/Wizard';
import Input from '../components/Input';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import Checkbox from '../components/Checkbox';
import Button from '../components/Button';

function BorrowerProjectWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    funding_type: 'mortgage',
    property_type: 'residential',
    address: '',
    town: '',
    county: '',
    postcode: '',
    description: '',
    purpose: '', // For non-property funding
    development_extent: 'light_refurb',
    tenure: 'freehold',
    planning_permission: false,
    planning_authority: '',
    planning_reference: '',
    planning_description: '',
    loan_amount_required: '',
    term_required_months: '',
    repayment_method: 'sale',
    unit_counts: '',
    gross_internal_area: '',
    purchase_price: '',
    purchase_costs: '',
    build_cost: '',
    current_market_value: '',
    gross_development_value: '',
    funds_provided_by_applicant: '',
    source_of_funds: '',
    existing_mortgage: false,
    mortgage_company: '',
    mortgage_balance: '',
  });

  const isPropertyBasedFunding = (fundingType) => {
    const propertyBasedTypes = [
      'development_finance', 'senior_debt', 'commercial_mortgage', 
      'mortgage', 'equity'
    ];
    return propertyBasedTypes.includes(fundingType);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newFormData = { ...formData, [name]: type === 'checkbox' ? checked : value };
    
    // If funding type changes, update form visibility
    if (name === 'funding_type') {
      // For non-property funding, some fields may not be required
      // This will be handled in the UI conditionally
    }
    
    setFormData(newFormData);
  };

  const nextStep = () => {
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      let unitCounts = {};
      if (formData.unit_counts) {
        const units = parseInt(formData.unit_counts, 10);
        if (!isNaN(units)) {
          unitCounts.total = units;
        }
      }
      // For non-property funding types, use defaults for property fields
      const isPropertyBased = isPropertyBasedFunding(formData.funding_type);
      
      const payload = {
        funding_type: formData.funding_type,
        property_type: isPropertyBased ? formData.property_type : 'commercial', // Default for non-property
        address: isPropertyBased ? formData.address : 'N/A - Business Finance',
        town: isPropertyBased ? formData.town : 'N/A',
        county: isPropertyBased ? formData.county : 'N/A',
        postcode: isPropertyBased ? formData.postcode : 'N/A',
        description: formData.description || formData.purpose || 'Business Finance Request',
        development_extent: isPropertyBased ? formData.development_extent : 'new_build',
        tenure: isPropertyBased ? formData.tenure : 'freehold',
        planning_permission: formData.planning_permission,
        planning_authority: formData.planning_authority,
        planning_reference: formData.planning_reference,
        planning_description: formData.planning_description,
        loan_amount_required: formData.loan_amount_required,
        term_required_months: formData.term_required_months,
        repayment_method: formData.repayment_method,
        unit_counts: unitCounts,
        gross_internal_area: formData.gross_internal_area || null,
        purchase_price: formData.purchase_price || null,
        purchase_costs: formData.purchase_costs || null,
        build_cost: formData.build_cost || null,
        current_market_value: formData.current_market_value || null,
        gross_development_value: formData.gross_development_value || null,
        funds_provided_by_applicant: formData.funds_provided_by_applicant || null,
        source_of_funds: formData.source_of_funds,
        existing_mortgage: formData.existing_mortgage,
        mortgage_company: formData.mortgage_company,
        mortgage_balance: formData.mortgage_balance || null,
      };
      await api.post('/api/projects/', payload);
      navigate('/borrower/projects');
    } catch (err) {
      console.error('Project creation error:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Property Information', 'Planning & Loan Details', 'Development & Financials'];

  return (
    <Wizard steps={steps} currentStep={step}>
      <div style={{ padding: theme.spacing.xl }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
          margin: `0 0 ${theme.spacing.lg} 0`,
          color: theme.colors.textPrimary,
        }}>
          Create New Project
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
              {isPropertyBasedFunding(formData.funding_type) ? 'Property Information' : 'Funding Request Information'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
              <Select
                label="Funding Type"
                name="funding_type"
                value={formData.funding_type}
                onChange={handleChange}
                required
                style={{ gridColumn: '1 / -1' }}
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

              {isPropertyBasedFunding(formData.funding_type) ? (
                <>
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

                  <Input
                    label="Address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                    placeholder="Enter property address"
                    style={{ gridColumn: '1 / -1' }}
                  />

                  <Input
                    label="Town"
                    name="town"
                    value={formData.town}
                    onChange={handleChange}
                    required
                    placeholder="Enter town"
                  />

                  <Input
                    label="County"
                    name="county"
                    value={formData.county}
                    onChange={handleChange}
                    required
                    placeholder="Enter county"
                  />

                  <Input
                    label="Postcode"
                    name="postcode"
                    value={formData.postcode}
                    onChange={handleChange}
                    required
                    placeholder="Enter postcode"
                  />

                  <Select
                    label="Development Extent"
                    name="development_extent"
                    value={formData.development_extent}
                    onChange={handleChange}
                  >
                    <option value="light_refurb">Light Refurb</option>
                    <option value="heavy_refurb">Heavy Refurb</option>
                    <option value="conversion">Conversion</option>
                    <option value="new_build">New Build</option>
                  </Select>

                  <Select
                    label="Tenure"
                    name="tenure"
                    value={formData.tenure}
                    onChange={handleChange}
                  >
                    <option value="freehold">Freehold</option>
                    <option value="leasehold">Leasehold</option>
                  </Select>

                  <Textarea
                    label="Project Description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Describe the project..."
                    style={{ gridColumn: '1 / -1', marginTop: theme.spacing.lg }}
                  />
                </>
              ) : (
                <>
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    padding: theme.spacing.lg, 
                    background: theme.colors.infoLight, 
                    borderRadius: theme.borderRadius.md,
                    marginBottom: theme.spacing.md,
                  }}>
                    <p style={{ margin: 0, color: theme.colors.infoDark }}>
                      <strong>Note:</strong> This funding type does not require property details. 
                      You'll be asked for funding-specific information instead.
                    </p>
                  </div>

                  <Textarea
                    label="Purpose of Funding"
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Describe the purpose of this funding request..."
                    style={{ gridColumn: '1 / -1' }}
                    required
                  />

                  <Textarea
                    label="Additional Description (Optional)"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Any additional information about your funding request..."
                    style={{ gridColumn: '1 / -1' }}
                  />
                </>
              )}
            </div>

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
              {isPropertyBasedFunding(formData.funding_type) ? 'Planning & Loan Details' : 'Loan Details'}
            </h2>

            {isPropertyBasedFunding(formData.funding_type) && (
              <>
                <Checkbox
                  label="Has Planning Permission"
                  name="planning_permission"
                  checked={formData.planning_permission}
                  onChange={handleChange}
                />

                {formData.planning_permission && (
              <div style={{ 
                marginTop: theme.spacing.lg, 
                padding: theme.spacing.lg, 
                background: theme.colors.gray50,
                borderRadius: theme.borderRadius.md,
              }}>
                <h3 style={{
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.semibold,
                  margin: `0 0 ${theme.spacing.md} 0`,
                }}>
                  Planning Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
                  <Input
                    label="Planning Authority"
                    name="planning_authority"
                    value={formData.planning_authority}
                    onChange={handleChange}
                    placeholder="Enter planning authority"
                  />

                  <Input
                    label="Reference Number"
                    name="planning_reference"
                    value={formData.planning_reference}
                    onChange={handleChange}
                    placeholder="Enter reference number"
                  />
                </div>

                <Textarea
                  label="Planning Description"
                  name="planning_description"
                  value={formData.planning_description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describe the planning permission..."
                />
              </div>
                )}
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
              <Input
                label="Loan Amount Required (£)"
                type="number"
                name="loan_amount_required"
                value={formData.loan_amount_required}
                onChange={handleChange}
                required
                placeholder="0.00"
              />

              <Input
                label="Term Required (months)"
                type="number"
                name="term_required_months"
                value={formData.term_required_months}
                onChange={handleChange}
                required={isPropertyBasedFunding(formData.funding_type)}
                placeholder="12"
              />

              {isPropertyBasedFunding(formData.funding_type) && (
                <Select
                  label="Repayment Method"
                  name="repayment_method"
                  value={formData.repayment_method}
                  onChange={handleChange}
                >
                  <option value="sale">Sale</option>
                  <option value="refinance">Refinance</option>
                </Select>
              )}
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
              {isPropertyBasedFunding(formData.funding_type) ? 'Development & Financials' : 'Financial Information'}
            </h2>

            {isPropertyBasedFunding(formData.funding_type) ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
                  <Input
                    label="Total Units"
                    type="number"
                    name="unit_counts"
                    value={formData.unit_counts}
                    onChange={handleChange}
                    placeholder="0"
                  />

                  <Input
                    label="Gross Internal Area (sq ft)"
                    type="number"
                    step="0.01"
                    name="gross_internal_area"
                    value={formData.gross_internal_area}
                    onChange={handleChange}
                    placeholder="0.00"
                  />

                  <Input
                    label="Purchase Price (£)"
                    type="number"
                    name="purchase_price"
                    value={formData.purchase_price}
                    onChange={handleChange}
                    placeholder="0.00"
                  />

                  <Input
                    label="Purchase Costs (£)"
                    type="number"
                    name="purchase_costs"
                    value={formData.purchase_costs}
                    onChange={handleChange}
                    placeholder="0.00"
                  />

                  <Input
                    label="Build Cost (£)"
                    type="number"
                    name="build_cost"
                    value={formData.build_cost}
                    onChange={handleChange}
                    placeholder="0.00"
                  />

                  <Input
                    label="Current Market Value (£)"
                    type="number"
                    name="current_market_value"
                    value={formData.current_market_value}
                    onChange={handleChange}
                    placeholder="0.00"
                  />

                  <Input
                    label="Gross Development Value (£)"
                    type="number"
                    name="gross_development_value"
                    value={formData.gross_development_value}
                    onChange={handleChange}
                    placeholder="0.00"
                  />

                  <Input
                    label="Funds Provided by Applicant (£)"
                    type="number"
                    name="funds_provided_by_applicant"
                    value={formData.funds_provided_by_applicant}
                    onChange={handleChange}
                    placeholder="0.00"
                  />

                  <Input
                    label="Source of Funds"
                    name="source_of_funds"
                    value={formData.source_of_funds}
                    onChange={handleChange}
                    placeholder="Describe source of funds"
                    style={{ gridColumn: '1 / -1' }}
                  />
                </div>

                <Checkbox
                  label="Existing Mortgage"
                  name="existing_mortgage"
                  checked={formData.existing_mortgage}
                  onChange={handleChange}
                  style={{ marginTop: theme.spacing.lg }}
                />

                {formData.existing_mortgage && (
                  <div style={{ 
                    marginTop: theme.spacing.lg, 
                    padding: theme.spacing.lg, 
                    background: theme.colors.gray50,
                    borderRadius: theme.borderRadius.md,
                  }}>
                    <h3 style={{
                      fontSize: theme.typography.fontSize.lg,
                      fontWeight: theme.typography.fontWeight.semibold,
                      margin: `0 0 ${theme.spacing.md} 0`,
                    }}>
                      Mortgage Details
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
                      <Input
                        label="Mortgage Company"
                        name="mortgage_company"
                        value={formData.mortgage_company}
                        onChange={handleChange}
                        placeholder="Enter mortgage company"
                      />

                      <Input
                        label="Mortgage Balance (£)"
                        type="number"
                        name="mortgage_balance"
                        value={formData.mortgage_balance}
                        onChange={handleChange}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.lg }}>
                <Input
                  label="Source of Funds"
                  name="source_of_funds"
                  value={formData.source_of_funds}
                  onChange={handleChange}
                  placeholder="Describe source of funds"
                  style={{ gridColumn: '1 / -1' }}
                />
                <div style={{ 
                  gridColumn: '1 / -1', 
                  padding: theme.spacing.lg, 
                  background: theme.colors.gray50,
                  borderRadius: theme.borderRadius.md,
                }}>
                  <p style={{ margin: 0, color: theme.colors.textSecondary }}>
                    For non-property funding types, additional financial details will be collected during the application process.
                  </p>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: theme.spacing.xl }}>
              <Button variant="outline" size="lg" onClick={prevStep}>
                ← Back
              </Button>
              <Button variant="primary" size="lg" onClick={handleSubmit} loading={loading}>
                {loading ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Wizard>
  );
}

export default BorrowerProjectWizard;
