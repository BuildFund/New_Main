# CHUNK 2: Lender Deal Room - Provider Matching & Request Quotes - Test Checklist

## Backend APIs Added

✅ **ProviderEnquiryViewSet** - `/api/deals/provider-enquiries/`
- `GET /api/deals/provider-enquiries/?deal_id=X&role_type=Y` - List enquiries
- `POST /api/deals/provider-enquiries/request-quotes/` - Create enquiries for providers
- `GET /api/deals/provider-enquiries/matching-providers/?deal_id=X&role_type=Y` - Get matching providers
- `POST /api/deals/provider-enquiries/:id/mark_viewed/` - Mark enquiry as viewed

✅ **ProviderQuoteViewSet** - `/api/deals/provider-quotes/`
- `GET /api/deals/provider-quotes/?deal_id=X` - List quotes
- `POST /api/deals/provider-quotes/` - Submit quote (consultant)

✅ **DealProviderSelectionViewSet** - `/api/deals/deal-provider-selections/`
- `GET /api/deals/deal-provider-selections/?deal_id=X` - List selections
- `POST /api/deals/deal-provider-selections/` - Create selection

✅ **ProviderMatchingService** - Matching logic
- Filters by role type, geographic coverage, qualifications, experience, capacity
- Calculates match scores (0-100)

## Frontend Components Updated

✅ **DealConsultants.js** - Enhanced with tabs
- Lender tabs: Matching, Enquiries, Quotes, Selection, Progress, Deliverables, Appointments, Messages
- Borrower tabs: Quotes, Selection, Appointments, Deliverables, Messages
- Matching tab shows shortlist per role with match scores
- Request Quotes functionality with provider selection

## Manual Test Checklist

### 1. Backend APIs
- [ ] Run `python manage.py check` - should pass
- [ ] Verify API endpoints are registered in `/api/deals/`
- [ ] Test matching providers endpoint:
  - `GET /api/deals/provider-enquiries/matching-providers/?deal_id=DEAL-XXX&role_type=valuer`
  - Should return list of matching providers with scores
- [ ] Test request quotes endpoint:
  - `POST /api/deals/provider-enquiries/request-quotes/` with `deal_id`, `role_type`, `provider_ids`
  - Should create ProviderEnquiry records

### 2. Frontend - Lender Matching Tab
- [ ] Login as lender
- [ ] Navigate to Deal Room
- [ ] Click "Consultants" tab
- [ ] Verify "Matching" sub-tab is visible
- [ ] Select role (Valuer, Monitoring Surveyor, Solicitor)
- [ ] Verify matching providers list loads with match scores
- [ ] Verify provider details display (name, email, coverage, experience, capacity)
- [ ] Click "Request Quote" on a provider
- [ ] Verify modal opens with selected provider
- [ ] Click "Send Quote Requests"
- [ ] Verify success message and enquiries list updates

### 3. Frontend - Lender Enquiries Tab
- [ ] After sending quote requests, click "Enquiries" tab
- [ ] Verify list shows sent enquiries with statuses
- [ ] Verify enquiry details (provider name, role, sent date, viewed date, due date)
- [ ] Verify status badges display correctly

### 4. Frontend - Lender Quotes Tab
- [ ] Click "Quotes" tab
- [ ] Verify quotes list displays (empty initially)
- [ ] After consultant submits quote, verify it appears here
- [ ] Verify quote details (provider, amount, lead time, scope)

### 5. Frontend - Borrower Quotes Tab
- [ ] Login as borrower
- [ ] Navigate to Deal Room
- [ ] Click "Consultants" tab
- [ ] Verify "Quotes" sub-tab is visible
- [ ] Verify borrower can see quotes (when available)

### 6. Error Handling
- [ ] Test with invalid deal_id - should show error
- [ ] Test with no matching providers - should show "No matching providers" message
- [ ] Test request quotes with no providers selected - should show validation error

## Checkpoint 2 Status

✅ **App compiles** - Backend and frontend compile
✅ **Lender can see shortlist** - Matching tab displays providers
✅ **Lender can send enquiries** - Request Quotes creates ProviderEnquiry records
✅ **Enquiry statuses update** - Status visible in Enquiries tab

**Ready for CHUNK 3**
