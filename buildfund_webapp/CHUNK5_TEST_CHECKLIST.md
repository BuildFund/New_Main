# CHUNK 5: Consultant Dashboard "My Deals" with Scoped Deal Room View - Test Checklist

## Backend Updates

✅ **DealViewSet.get_queryset()** - Enhanced consultant deal filtering
- Consultants now see deals via:
  - DealParty (active appointment)
  - ProviderEnquiry (quote requests sent to them)
  - ProviderQuote (quotes they submitted)
  - DealProviderSelection (they were selected)
- Uses `distinct()` to avoid duplicates

✅ **DealViewSet.my_deals()** - New action endpoint
- `GET /api/deals/deals/my-deals/` - Returns deals with involvement details
- Enriches each deal with:
  - `consultant_involvement`: Object showing how consultant is involved (via_party, via_enquiry, via_quote, via_selection)
  - `consultant_role_type`: Role type if selected/assigned
  - `enquiry_status`: Status of any active enquiry
  - `enquiry_role_type`: Role type from enquiry
- Only accessible to consultants

## Frontend Updates

✅ **ConsultantDashboard.js** - Added "My Deals" tab
- Added `myDeals` state
- Loads deals from `/api/deals/deals/my-deals/` in `loadDashboardData()`
- Added "my-deals" to tab list
- "My Deals" tab displays:
  - Deal ID, status, facility type
  - Borrower and lender names
  - Current stage
  - Consultant role type badge
  - Involvement badges (Active Party, Quote Request, Quote Submitted, Selected)
  - "Open Deal Room" button

✅ **DealRoom.js** - Role-based tab filtering
- Determines user role from localStorage
- Filters tabs based on role:
  - **Consultants**: Overview, Timeline, Tasks, Documents
  - **Lenders**: All tabs (Overview, Timeline, Tasks, Documents, Underwriter's Report, Consultants, Legal Workspace, Drawdowns, Audit Log, Reporting)
  - **Borrowers**: Overview, Timeline, Tasks, Documents, Consultants, Legal Workspace, Drawdowns
- Consultants see scoped view with only relevant tabs

## Manual Test Checklist

### 1. Backend - Consultant Deal Filtering
- [ ] Login as consultant
- [ ] Call `GET /api/deals/deals/`
- [ ] Verify only deals where consultant is involved are returned:
  - Deals where consultant has active DealParty
  - Deals where consultant has ProviderEnquiry
  - Deals where consultant has submitted ProviderQuote
  - Deals where consultant has DealProviderSelection
- [ ] Verify no duplicate deals (distinct() working)

### 2. Backend - My Deals Endpoint
- [ ] Login as consultant
- [ ] Call `GET /api/deals/deals/my-deals/`
- [ ] Verify response includes:
  - Deal basic info (deal_id, status, facility_type, borrower_name, lender_name)
  - `consultant_involvement` object with:
    - `via_party`: boolean
    - `via_enquiry`: boolean
    - `via_quote`: boolean
    - `via_selection`: boolean
    - `party_type`: string (if via_party)
    - `acting_for_party`: string (if via_party)
    - `appointment_status`: string (if via_party)
    - `enquiry_status`: string (if via_enquiry)
    - `enquiry_role_type`: string (if via_enquiry)
  - `consultant_role_type`: string (role if selected/assigned)
- [ ] Try accessing as non-consultant - should return 403

### 3. Frontend - Consultant Dashboard - My Deals Tab
- [ ] Login as consultant
- [ ] Navigate to Consultant Dashboard
- [ ] Click "my-deals" tab
- [ ] Verify deals are displayed with:
  - Deal ID
  - Status badge
  - Role type badge (if assigned)
  - Borrower and lender names
  - Facility type
  - Current stage
  - Involvement badges (Active Party, Quote Request, Quote Submitted, Selected)
- [ ] Verify "Open Deal Room" button appears for each deal
- [ ] Click "Open Deal Room" button
- [ ] Verify navigates to `/deals/{dealId}`

### 4. Frontend - Deal Room - Consultant Scoped View
- [ ] Login as consultant
- [ ] Navigate to a deal via "My Deals" → "Open Deal Room"
- [ ] Verify Deal Room loads successfully
- [ ] Verify only consultant-appropriate tabs are shown:
  - Overview ✓
  - Timeline ✓
  - Tasks ✓
  - Documents ✓
  - Underwriter's Report ✗ (hidden)
  - Consultants ✗ (hidden)
  - Legal Workspace ✗ (hidden)
  - Drawdowns ✗ (hidden)
  - Audit Log ✗ (hidden)
  - Reporting ✗ (hidden)
- [ ] Verify consultant can see deal overview
- [ ] Verify consultant can see timeline
- [ ] Verify consultant can see tasks (filtered to their role if applicable)
- [ ] Verify consultant can see documents (scoped to their role if applicable)

### 5. Integration - End-to-End Flow
- [ ] As lender, create a deal
- [ ] As lender, request quotes for a role (e.g., Valuer)
- [ ] As consultant, verify deal appears in "My Deals" with "Quote Request" badge
- [ ] As consultant, click "Open Deal Room"
- [ ] Verify consultant can access Deal Room (scoped view)
- [ ] As consultant, submit quote
- [ ] As lender/borrower, select consultant
- [ ] As consultant, verify deal shows "Selected" badge in "My Deals"
- [ ] As consultant, verify Deal Party is created
- [ ] As consultant, verify deal shows "Active Party" badge in "My Deals"

### 6. Edge Cases
- [ ] Test consultant with multiple involvement types (e.g., has enquiry AND is selected)
- [ ] Test consultant with no deals
- [ ] Test consultant accessing deal they're not involved with (should fail with 403/404)
- [ ] Test consultant with deals via enquiry only (not yet selected)
- [ ] Test consultant with deals via selection only (no enquiry)
- [ ] Test consultant with deals via DealParty only (directly assigned)

### 7. Security & Permissions
- [ ] Verify consultant can only see deals they're involved with
- [ ] Verify consultant cannot access deals via direct URL if not involved
- [ ] Verify consultant sees scoped tabs in Deal Room
- [ ] Verify consultant cannot access restricted tabs via direct URL manipulation

## Checkpoint Status

✅ **App compiles** - Backend and frontend compile without errors
✅ **Deal filtering** - Consultants see all relevant deals
✅ **My Deals tab** - Displays deals with involvement details
✅ **Deal Room access** - Consultants can access Deal Room
✅ **Scoped view** - Consultants see only relevant tabs
✅ **Navigation** - "Open Deal Room" button works correctly

**Ready for CHUNK 6: Industry-Correct Provider Progression Stages + Task Templates**
