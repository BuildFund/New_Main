# Quote Request Information Enhancement

## Summary
Enhanced the `deal_summary_snapshot` sent to consultants when requesting quotes to include comprehensive information needed for professional quotation preparation.

## Backend Enhancements

### Enhanced `deal_summary_snapshot` in `request_quotes` action:

1. **Project Information** (Enhanced):
   - Added: `purchase_costs`, `funding_type`, `funding_type_display`, `repayment_method_display`, `term_required_months`
   - All existing project fields retained

2. **Borrower Information** (Enhanced):
   - Added: `company_type` (from company_data), `company_type_display`
   - Added: `experience_summary` with anonymized experience level based on company incorporation date
   - No personal data included (privacy maintained)

3. **Lender Information** (Enhanced):
   - Added: `description` (lender description, truncated to 500 chars)

4. **Product Information** (Comprehensive):
   - Added: `property_type`, `property_type_display`
   - Added: `repayment_structure`, `repayment_structure_display`
   - Added: `min_loan_amount`, `max_loan_amount`
   - Added: `interest_rate_min`, `interest_rate_max`
   - Added: `term_min_months`, `term_max_months`
   - Added: `max_ltv_ratio`
   - Added: `eligibility_criteria` (truncated to 1000 chars)
   - Description increased from 500 to 1000 chars

5. **Application Terms** (New Section):
   - `proposed_loan_amount_range`: Range for this specific deal
   - `proposed_term_months`: Term for this deal
   - `proposed_ltv_range`: LTV range for this deal
   - `proposed_interest_rate_range`: Interest rate range for this deal

6. **Commercial Indicators** (Enhanced):
   - Added: `interest_rate_range` (new helper function)
   - Added: `repayment_structure`

7. **Security Structure** (New Section):
   - `primary_security`: Type of security (e.g., "Property")
   - `security_type`: Type of charge (e.g., "First charge")

8. **Transaction Structure** (New Section - for solicitors):
   - `borrower_entity_type`: Company type
   - `deal_structure`: Facility type

### New Helper Functions:
- `get_interest_rate_range()`: Converts exact interest rate to privacy-preserving range
- `get_borrower_experience_summary()`: Extracts anonymized experience level from company incorporation date

## Frontend Enhancements

### `ConsultantEnquiryDetail.js` - Enhanced Display:

1. **Project Information**:
   - Now displays: funding_type, repayment_method, term_required_months, purchase_costs

2. **Borrower Information**:
   - Now displays: company_type, experience_level

3. **Lender Information**:
   - Now displays: description (about the lender)

4. **Product Information** (Comprehensive):
   - Now displays: property_type, repayment_structure, loan amount range, interest rate range, term range, max LTV, eligibility criteria

5. **Deal Commercial Terms** (Enhanced):
   - Split into "Proposed Terms" (for this deal) and "Commercial Indicators" (general)
   - Now displays: interest_rate_range, repayment_structure

6. **Security & Transaction Structure** (New Section):
   - Displays security details and transaction structure information

## Information Provided to Consultants

### For Valuers:
- Complete property details (type, address, planning, GIA, purchase price, build cost, GDV)
- Loan amount range, LTV range, term, interest rate range
- Repayment structure
- Security structure
- Borrower experience level (anonymized)
- Product terms and eligibility

### For Monitoring Surveyors:
- All of the above plus:
- Development extent and construction details
- Project timeline information
- Build cost breakdown

### For Solicitors:
- All of the above plus:
- Transaction structure
- Borrower entity type
- Security structure details
- Legal requirements context

## Privacy Protection

- Exact loan amounts converted to ranges (< £100k, £100k-£500k, etc.)
- Exact LTV converted to ranges (< 50%, 50-65%, etc.)
- Exact interest rates converted to ranges (< 5%, 5-8%, etc.)
- No personal borrower data (names, addresses, financial details)
- Borrower experience anonymized (experience level only, not exact years)
- Company data limited to public information

## Testing

Consultants should now be able to:
1. View comprehensive deal information in quote request details
2. Understand project scope, terms, and requirements
3. Make informed quotation decisions
4. See all relevant product and lender information
5. Understand security and transaction structure
