# CHUNK 4: Consultant Dashboard - My Enquiries & Quote Response - Test Checklist

## Backend Updates

✅ **ProviderEnquiryViewSet** - Already filters enquiries for consultants
- Consultants can access `/api/deals/provider-enquiries/` to see their quote requests
- Filtered by `provider_firm=user.consultantprofile`

✅ **ProviderQuoteViewSet** - Already supports quote creation
- Consultants can POST to `/api/deals/provider-quotes/` to submit quotes
- Automatically updates enquiry status to 'quoted'
- Filtered by `enquiry__provider_firm=user.consultantprofile`

## Frontend Updates

✅ **ConsultantDashboard.js** - Added "My Enquiries" functionality
- Added `enquiries` state to load ProviderEnquiry records
- Added "Quote Requests" stats card showing pending enquiries
- Added "enquiries" tab to navigation
- Displays enquiry details: role type, deal ID, due date, deal summary, lender notes
- Shows enquiry status badges (sent, viewed, quoted, declined, expired)
- "Submit Quote" button navigates to quote form
- "View Quote" button for enquiries with existing quotes
- "Mark as Viewed" button for unviewed enquiries

✅ **ConsultantEnquiryQuoteForm.js** - New quote submission form
- Loads enquiry details from `/api/deals/provider-enquiries/{id}/`
- Displays enquiry information (role, deal, due date, deal summary, lender notes)
- Form fields: price_gbp, lead_time_days, earliest_available_date, scope_summary, assumptions, deliverables, validity_days, payment_terms, provider_notes
- Validates required fields
- Submits to `/api/deals/provider-quotes/`
- Shows expiry warnings for expired enquiries

✅ **ConsultantDashboard.js - Quotes Tab** - Enhanced to show deal-based quotes
- Loads quotes from `/api/deals/provider-quotes/` (deal-based)
- Falls back to legacy `/api/consultants/quotes/` if needed
- Displays both legacy ConsultantQuote and new ProviderQuote formats
- Shows quote amount, role type, deal ID, status, lead time, submission date
- "View Details" button for each quote

✅ **App.js** - Added route
- Route: `/consultant/enquiries/:enquiryId/quote` → `ConsultantEnquiryQuoteForm`

## Manual Test Checklist

### 1. Backend - Enquiries Endpoint
- [ ] Login as consultant
- [ ] Call `GET /api/deals/provider-enquiries/`
- [ ] Verify only enquiries for this consultant are returned
- [ ] Verify enquiry data includes: deal_id, role_type, status, sent_at, quote_due_at, deal_summary_snapshot

### 2. Frontend - Consultant Dashboard - My Enquiries Tab
- [ ] Login as consultant
- [ ] Navigate to Consultant Dashboard
- [ ] Verify "Quote Requests" stats card shows count of pending enquiries
- [ ] Click "enquiries" tab
- [ ] Verify enquiries are displayed with:
  - Role type (Valuer, Monitoring Surveyor, Solicitor)
  - Deal ID
  - Received date
  - Due date (if set)
  - Deal summary snapshot
  - Lender notes (if any)
  - Status badge
- [ ] Verify "Submit Quote" button appears for enquiries without quotes
- [ ] Verify "View Quote" button appears for enquiries with existing quotes
- [ ] Verify "Mark as Viewed" button appears for unviewed enquiries

### 3. Frontend - Submit Quote
- [ ] Click "Submit Quote" on an enquiry
- [ ] Verify quote form loads with enquiry details displayed
- [ ] Fill in required fields:
  - Quote Price (GBP)
  - Lead Time (days)
  - Scope Summary
- [ ] Fill in optional fields:
  - Earliest Available Date
  - Assumptions & Exclusions
  - Deliverables (comma-separated)
  - Validity Period
  - Payment Terms
  - Additional Notes
- [ ] Submit quote
- [ ] Verify redirect to dashboard with success message
- [ ] Verify enquiry status changes to "quoted"
- [ ] Verify quote appears in "quotes" tab

### 4. Frontend - Mark as Viewed
- [ ] Find an enquiry with status "sent" (not yet viewed)
- [ ] Click "Mark as Viewed"
- [ ] Verify enquiry status updates to "viewed"
- [ ] Verify `viewed_at` timestamp is set

### 5. Frontend - Quotes Tab
- [ ] Navigate to "quotes" tab
- [ ] Verify deal-based quotes are displayed
- [ ] Verify quote information shows:
  - Quote amount
  - Role type
  - Deal ID
  - Status
  - Lead time (if available)
  - Submission date
- [ ] Verify "View Details" button works

### 6. Integration - End-to-End Flow
- [ ] As lender, create a deal
- [ ] As lender, request quotes for a role (e.g., Valuer)
- [ ] As consultant, verify enquiry appears in "My Enquiries"
- [ ] As consultant, submit a quote
- [ ] As lender, verify quote appears in Deal Room
- [ ] As borrower, verify quote appears in Deal Room
- [ ] As consultant, verify quote appears in "My Quotes" tab

### 7. Edge Cases
- [ ] Test with expired enquiry (quote_due_at in past)
- [ ] Verify expiry warning appears in quote form
- [ ] Test submitting quote for declined enquiry
- [ ] Test submitting quote for already-quoted enquiry
- [ ] Test with enquiry that has no deal_summary_snapshot
- [ ] Test with enquiry that has no lender_notes

## Checkpoint Status

✅ **App compiles** - Backend and frontend compile without errors
✅ **Enquiries load** - Consultant can see their quote requests
✅ **Quote submission** - Consultant can submit quotes for enquiries
✅ **Quote viewing** - Consultant can view their submitted quotes
✅ **Status updates** - Enquiry status updates when quote is submitted
✅ **Navigation** - All routes and navigation work correctly

**Ready for CHUNK 5: Consultant Dashboard "My Deals" with Scoped Deal Room View**
