# CHUNK 4 Enhancement: Detailed Enquiry Information & Acknowledgment - Test Checklist

## Backend Updates

✅ **ProviderEnquiry Model** - Added acknowledgment fields
- `acknowledged_at` - DateTime when provider acknowledged
- `expected_quote_date` - Date provider expects to submit quote
- `acknowledgment_notes` - Provider's notes when acknowledging

✅ **ProviderEnquirySerializer** - Enhanced
- Added `has_quote` field to check if enquiry has associated quote
- Added `acknowledged_at`, `expected_quote_date`, `acknowledgment_notes` fields

✅ **ProviderEnquiryViewSet** - Added acknowledge action
- `POST /api/deals/provider-enquiries/{id}/acknowledge/` - Allows consultant to acknowledge enquiry
- Requires `expected_quote_date` (required)
- Optional `acknowledgment_notes`
- Updates `acknowledged_at` timestamp
- Only provider can acknowledge their own enquiries

✅ **Deal Summary Snapshot** - Enhanced with comprehensive information
- **Project Information**: property_type, description, address, town, county, postcode, development_extent, tenure, planning_permission, planning_reference, planning_description, unit_counts, gross_internal_area, purchase_price, build_cost, current_market_value, gross_development_value, repayment_method
- **Borrower Information**: company_name, trading_name (non-sensitive - no personal data)
- **Lender Information**: organisation_name, contact_email, contact_phone, website (public info only)
- **Product Information**: name, funding_type, description (truncated to 500 chars)
- **Commercial Indicators**: loan_amount_range (privacy ranges), term_months, ltv_range (privacy ranges)
- All sensitive financial data converted to ranges for privacy

✅ **ProviderQuoteSerializer** - Enhanced
- Added `enquiry_acknowledged_at`, `enquiry_expected_quote_date`, `enquiry_acknowledgment_notes` fields
- Allows borrower/lender to see acknowledgment status on quotes

## Frontend Updates

✅ **ConsultantEnquiryDetail.js** - New detailed enquiry view page
- Displays comprehensive deal summary information:
  - Project details (property type, address, description, development extent, tenure, planning, unit counts, GIA, purchase price, build cost, GDV, current market value)
  - Borrower company information (company name, trading name)
  - Lender information (organisation name, contact details, website)
  - Product information (name, funding type, description)
  - Deal overview (facility type, loan amount range, term, LTV range)
- Shows lender notes
- Acknowledgment section:
  - If acknowledged: shows acknowledgment date, expected quote date, notes
  - If not acknowledged: shows "Acknowledge Quote Request" button
- Acknowledge form:
  - Expected Quote Date (required)
  - Notes (optional)
  - Submits to `/api/deals/provider-enquiries/{id}/acknowledge/`
- Actions:
  - "Mark as Viewed" button (if not viewed)
  - "Submit Quote" button (navigates to quote form)
  - "View Submitted Quote" button (if quote exists)

✅ **ConsultantDashboard.js** - Enhanced
- "View Details" button on each enquiry card
- Navigates to `/consultant/enquiries/{id}` for detailed view

✅ **DealConsultants.js - Enquiries Tab** - Enhanced for lenders
- Shows acknowledgment information for each enquiry:
  - Acknowledgment badge with date
  - Expected quote date
  - Acknowledgment notes (if provided)
- Visual indicator (green background) for acknowledged enquiries

✅ **DealConsultants.js - Quotes Tab** - Enhanced for borrowers/lenders
- Shows acknowledgment information on quotes:
  - "Provider acknowledged" message with date
  - Expected quote date
- Visual indicator (green background) for acknowledged quotes

✅ **App.js** - Added route
- Route: `/consultant/enquiries/:enquiryId` → `ConsultantEnquiryDetail`

## Manual Test Checklist

### 1. Backend - Enhanced Deal Summary Snapshot
- [ ] As lender, request quotes for a role on a deal
- [ ] Verify `deal_summary_snapshot` includes:
  - Project information (property type, address, description, development details, planning, unit counts, financials)
  - Borrower company name and trading name
  - Lender organisation name, contact email, phone, website
  - Product name, funding type, description
  - Commercial indicators (loan amount range, term, LTV range)
- [ ] Verify sensitive data is redacted (exact loan amounts converted to ranges)

### 2. Backend - Acknowledge Action
- [ ] Login as consultant
- [ ] Call `POST /api/deals/provider-enquiries/{id}/acknowledge/` with:
  - `expected_quote_date`: "2026-01-25"
  - `acknowledgment_notes`: "Will review and provide quote within 5 days"
- [ ] Verify enquiry `acknowledged_at` is set
- [ ] Verify `expected_quote_date` is saved
- [ ] Verify `acknowledgment_notes` is saved
- [ ] Try to acknowledge another consultant's enquiry - should fail with 403

### 3. Frontend - Consultant Enquiry Detail Page
- [ ] Login as consultant
- [ ] Navigate to Consultant Dashboard → Enquiries tab
- [ ] Click "View Details" on an enquiry
- [ ] Verify detailed page loads with:
  - Project Information section (all project details)
  - Borrower Information section (company name, trading name)
  - Lender Information section (organisation, contact details, website)
  - Product Information section (name, funding type, description)
  - Deal Overview section (facility type, loan range, term, LTV range)
  - Lender Notes section (if present)
- [ ] Verify all information is displayed clearly and formatted

### 4. Frontend - Acknowledge Quote Request
- [ ] On enquiry detail page, click "Acknowledge Quote Request"
- [ ] Fill in form:
  - Expected Quote Date: Select a future date
  - Notes: "Will review project details and provide competitive quote within 5 business days"
- [ ] Submit acknowledgment
- [ ] Verify success message
- [ ] Verify acknowledgment section now shows:
  - Acknowledgment date
  - Expected quote date
  - Notes
- [ ] Verify "Acknowledge Quote Request" button is replaced with acknowledgment info

### 5. Frontend - Lender Dashboard - Enquiries Tab
- [ ] Login as lender
- [ ] Navigate to Deal Room → Consultants tab → Enquiries sub-tab
- [ ] Verify enquiries show acknowledgment information:
  - Green badge/box for acknowledged enquiries
  - "✓ Acknowledged: [date]"
  - "Expected Quote: [date]"
  - Acknowledgment notes (if provided)
- [ ] Verify non-acknowledged enquiries don't show acknowledgment info

### 6. Frontend - Borrower/Lender Dashboard - Quotes Tab
- [ ] Login as borrower or lender
- [ ] Navigate to Deal Room → Consultants tab → Quotes sub-tab
- [ ] Verify quotes show acknowledgment information:
  - Green indicator for quotes from acknowledged enquiries
  - "✓ Provider acknowledged [date]"
  - "Expected: [date]"
- [ ] Verify quotes from non-acknowledged enquiries don't show acknowledgment info

### 7. Integration - End-to-End Flow
- [ ] As lender, create a deal
- [ ] As lender, request quotes for a role (e.g., Valuer)
- [ ] As consultant, verify enquiry appears in "My Enquiries"
- [ ] As consultant, click "View Details" on enquiry
- [ ] As consultant, verify all project/borrower/lender/product information is visible
- [ ] As consultant, acknowledge the enquiry with expected quote date
- [ ] As lender, verify acknowledgment appears in Deal Room → Enquiries tab
- [ ] As borrower, verify acknowledgment appears in Deal Room → Quotes tab (when quote is submitted)
- [ ] As consultant, submit quote
- [ ] As lender/borrower, verify quote shows acknowledgment information

### 8. Privacy & Data Protection
- [ ] Verify no personal borrower information (names, DOB, addresses) in deal summary
- [ ] Verify no exact loan amounts (only ranges)
- [ ] Verify no exact LTV ratios (only ranges)
- [ ] Verify company information only (no personal data)
- [ ] Verify lender contact info is public information only

### 9. Edge Cases
- [ ] Test acknowledging enquiry without notes
- [ ] Test acknowledging enquiry with very long notes
- [ ] Test acknowledging enquiry with past expected_quote_date (should still work)
- [ ] Test viewing enquiry detail page for expired enquiry
- [ ] Test viewing enquiry detail page for declined enquiry
- [ ] Test acknowledging enquiry that already has a quote
- [ ] Test viewing enquiry with missing project information
- [ ] Test viewing enquiry with missing borrower/lender/product information

## Checkpoint Status

✅ **App compiles** - Backend and frontend compile without errors
✅ **Migration applied** - Acknowledgment fields added to database
✅ **Enhanced deal summary** - Comprehensive non-sensitive information included
✅ **Acknowledge functionality** - Consultants can acknowledge with expected date
✅ **Detailed view page** - Consultants can see all necessary information
✅ **Dashboard updates** - Borrower/lender see acknowledgments
✅ **Privacy maintained** - No sensitive personal/financial data exposed

**Ready for CHUNK 5: Consultant Dashboard "My Deals" with Scoped Deal Room View**
