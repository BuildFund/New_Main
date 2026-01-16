# CHUNK 3: Borrower Deal Room - Show Quotes & Selection Workflow - Test Checklist

## Backend Updates

✅ **DealProviderSelectionViewSet.perform_create** - Enhanced
- Rejects other quotes for the same role when a selection is made
- Creates DealParty membership with scoped permissions
- Initializes ProviderStageInstance
- Updates quote status to 'accepted'

## Frontend Updates

✅ **DealConsultants.js - Quotes Tab (Borrower)**
- Quotes grouped by role (Valuer, Monitoring Surveyor, Solicitor)
- Shows "Selected" badge for already-selected roles
- "Select" button for each quote (borrower only, when not already selected)
- Visual distinction for selected quotes (green border/background)

✅ **DealConsultants.js - Selection Tab**
- Shows all selected providers
- Displays lender approval status
- Shows acting_for_party information

✅ **Select Provider Modal**
- Shows quote details (provider, price, lead time, scope)
- "Use my own solicitor" checkbox (for solicitor role only)
- Own solicitor form (firm name, SRA number, contact details)
- "Require lender approval" toggle
- Confirms selection and creates DealProviderSelection

## Manual Test Checklist

### 1. Backend - Quote Rejection
- [ ] Create multiple quotes for the same role
- [ ] Select one quote via API
- [ ] Verify other quotes for that role are marked as 'declined'
- [ ] Verify selected quote is marked as 'accepted'

### 2. Frontend - Borrower Quotes Tab
- [ ] Login as borrower
- [ ] Navigate to Deal Room
- [ ] Click "Consultants" tab
- [ ] Click "Quotes" sub-tab
- [ ] Verify quotes are grouped by role (Valuer, Monitoring Surveyor, Solicitor)
- [ ] Verify each quote shows provider name, price, lead time, scope
- [ ] Verify "Select" button appears for each quote (when status is 'submitted')
- [ ] Verify quotes show status badges

### 3. Frontend - Borrower Selection Workflow
- [ ] Click "Select" on a quote
- [ ] Verify modal opens with quote details
- [ ] For solicitor role: verify "Use my own solicitor" checkbox appears
- [ ] Toggle "Use my own solicitor" - verify form fields appear
- [ ] Toggle "Require lender approval"
- [ ] Click "Confirm Selection"
- [ ] Verify success message
- [ ] Verify quote status updates (selected quote becomes 'accepted', others become 'declined')
- [ ] Verify selection appears in "Selection" tab

### 4. Frontend - Selection Tab
- [ ] After selecting providers, click "Selection" tab
- [ ] Verify all selected providers are listed
- [ ] Verify role badges display correctly
- [ ] Verify lender approval status badges (if applicable)
- [ ] Verify quote amounts display
- [ ] Verify selection dates and selected_by information

### 5. Frontend - Lender View
- [ ] Login as lender
- [ ] Navigate to Deal Room
- [ ] Click "Consultants" tab
- [ ] Click "Quotes" sub-tab
- [ ] Verify quotes display in flat list (not grouped)
- [ ] Verify quotes show updated statuses after borrower selection
- [ ] Click "Selection" tab
- [ ] Verify selected providers are visible
- [ ] If lender_approval_required: verify "Pending Lender Approval" badge

### 6. Backend - DealParty Creation
- [ ] After borrower selection, verify DealParty record created
- [ ] Verify party_type matches role_type
- [ ] Verify acting_for_party is 'borrower'
- [ ] Verify appointment_status is 'invited'

### 7. Backend - ProviderStageInstance Creation
- [ ] After borrower selection, verify ProviderStageInstance created
- [ ] Verify current_stage is 'instructed'
- [ ] Verify deal, role_type, and provider_firm are correct

### 8. Error Handling
- [ ] Test selection with invalid quote ID - should show error
- [ ] Test selection when quote already selected - should prevent duplicate
- [ ] Test "Use own solicitor" without required fields - should show validation error
- [ ] Test selection when enquiry not found - should show error

## Checkpoint 3 Status

✅ **App compiles** - Backend and frontend compile
✅ **Borrower sees quotes grouped by role** - Quotes tab displays correctly
✅ **Borrower can select providers** - Selection workflow functional
✅ **Other quotes rejected** - Backend rejects other quotes on selection
✅ **DealParty and ProviderStageInstance created** - Workflow initialized

**Ready for CHUNK 4**
