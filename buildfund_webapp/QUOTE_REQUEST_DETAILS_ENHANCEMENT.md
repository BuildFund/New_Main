# Quote Request Details Enhancement - For Consultants/Solicitors

## Issue
Consultants (especially solicitors) were only seeing basic quote request information and needed comprehensive deal details to provide informed quotations.

## Solution

### Backend Enhancements

1. **Enhanced Transaction Structure** (for solicitors):
   - Added `borrower_entity_type_display`
   - Added `deal_structure_display`
   - Added `transaction_type` (Development Finance, Term Loan, Bridge Finance)
   - Added `jurisdiction`
   - Added `complexity_indicators`:
     - `has_intercreditor`: Whether intercreditor arrangements may be required
     - `requires_planning_condition_satisfaction`: Whether planning conditions need satisfaction
     - `has_guarantees`: Whether personal/company guarantees are involved
     - `has_multiple_securities`: Whether multiple security properties exist
   - Added `expected_completion_timeline`: Term in months

2. **New Endpoint: Refresh Deal Summary Snapshot**:
   - `POST /api/deals/provider-enquiries/{id}/refresh-summary/`
   - Allows lender/admin to refresh the `deal_summary_snapshot` for existing enquiries
   - Useful for enquiries created before the comprehensive snapshot was implemented
   - Rebuilds the snapshot using the same comprehensive logic as `request_quotes`

### Frontend Enhancements

1. **Enhanced Transaction Structure Display**:
   - Now shows all transaction structure details including:
     - Borrower entity type (with display name)
     - Deal structure (with display name)
     - Transaction type
     - Jurisdiction
     - Complexity indicators (as a structured list)
     - Expected completion timeline

2. **Missing Information Warning**:
   - Added warning message when deal summary snapshot is missing or incomplete
   - Alerts consultants that they may need to contact the lender for additional details
   - Helps identify enquiries that need the snapshot refreshed

## Information Now Available to Consultants

### For Solicitors (Comprehensive):
- **Project Information**: Property type, address, planning details, GIA, purchase price, build cost, GDV
- **Borrower Information**: Company name, entity type, experience level
- **Lender Information**: Organisation name, contact details, description
- **Product Information**: Funding type, loan amount ranges, interest rate ranges, term ranges, LTV, eligibility criteria
- **Deal Commercial Terms**: Proposed loan amount range, term, LTV range, interest rate range
- **Security Structure**: Primary security type, security type (first charge)
- **Transaction Structure**: 
  - Borrower entity type
  - Deal structure (development/term/bridge)
  - Transaction type
  - Jurisdiction
  - Complexity indicators (intercreditor, planning conditions, guarantees, multiple securities)
  - Expected completion timeline

### For Valuers:
- All project information
- Commercial terms (ranges)
- Security structure
- Borrower experience level (anonymized)

### For Monitoring Surveyors:
- All of the above plus development-specific details

## Usage

### For Existing Enquiries with Missing Information:
1. Lender/admin can call `POST /api/deals/provider-enquiries/{id}/refresh-summary/` to refresh the snapshot
2. Consultant will see a warning if information is missing
3. Consultant can contact lender for additional details if needed

### For New Enquiries:
- All new enquiries created via `request_quotes` will automatically include the comprehensive deal summary snapshot

## Privacy Protection

- Exact loan amounts converted to ranges (< £100k, £100k-£500k, etc.)
- Exact LTV converted to ranges (< 50%, 50-65%, etc.)
- Exact interest rates converted to ranges (< 5%, 5-8%, etc.)
- No personal borrower data (only company information)
- Borrower experience level is anonymized (based on incorporation date)
