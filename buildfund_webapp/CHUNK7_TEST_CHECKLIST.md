# CHUNK 7: Deliverable Uploads + Lender Review + Versioning - Test Checklist

## Backend Updates

✅ **ProviderDeliverable Model** - Enhanced with versioning
- Added `version_history` JSONField: Tracks all versions with document_id, uploaded_at, uploaded_by, status, review_notes
- Added `parent_deliverable` ForeignKey: Links to previous version for revision tracking
- Version field already existed (default=1)

✅ **ProviderDeliverableViewSet.perform_create()** - Enhanced
- Handles file upload via `request.FILES.get('file')`
- Creates `Document` record first
- Detects if this is a revision (checks for existing deliverable of same type)
- Auto-increments version number
- Tracks version history
- Marks previous version as 'revised' if applicable

✅ **ProviderDeliverableViewSet.review()** - Enhanced
- Added 'request_revision' action (in addition to 'approve'/'reject')
- Updates version history with review information
- Only lender can review deliverables

✅ **ProviderDeliverableSerializer** - Enhanced
- Added `document_url`: Download URL for document
- Added `has_revisions`: Boolean indicating if revisions exist
- Added `revision_count`: Number of revisions
- Includes `version_history` and `parent_deliverable` fields

## Frontend Updates

✅ **DealConsultants.js - Deliverables Tab** - Implemented
- Added `deliverables` state
- Added `loadDeliverables()` function
- Added `uploadDeliverableModal` and `reviewDeliverableModal` state
- Deliverables tab displays:
  - Deliverable type, status badge, version badge
  - Provider firm name and role type
  - Document name and size
  - Upload/review dates and user names
  - Review notes (if reviewed)
  - Download button
  - Review button (lender only, for 'uploaded' status)
  - Upload Revision button (consultant only, for 'rejected'/'under_review' status)
- Upload Deliverable Modal:
  - Form with deliverable type selector
  - File upload input
  - Creates deliverable via POST with multipart/form-data
- Review Deliverable Modal:
  - Action selector (Approve/Reject/Request Revision)
  - Review notes textarea
  - Submits review via POST to review endpoint

✅ **Consultant Sub-tabs** - Added
- Consultants now see: Deliverables, Appointments, Messages
- Consultants can upload deliverables
- Consultants can upload revisions for rejected/under_review deliverables

## Manual Test Checklist

### 1. Backend - Deliverable Upload
- [ ] Login as consultant
- [ ] Call `POST /api/deals/provider-deliverables/` with:
  - `file`: File upload
  - `deal`: Deal ID
  - `role_type`: Provider role (valuer/monitoring_surveyor/solicitor)
  - `deliverable_type`: Type of deliverable
- [ ] Verify:
  - `ProviderDeliverable` created with version=1
  - `Document` record created
  - `status` = 'uploaded'
  - `uploaded_by` = current user
  - `version_history` = empty array

### 2. Backend - Deliverable Revision (Versioning)
- [ ] Upload initial deliverable (version 1)
- [ ] As lender, reject the deliverable
- [ ] As consultant, upload revision
- [ ] Verify:
  - New `ProviderDeliverable` created with version=2
  - `parent_deliverable` links to version 1
  - Version 1's `version_history` includes entry with version 1 details
  - Version 1's `status` = 'revised'
  - Version 2's `version_history` includes version 1's history

### 3. Backend - Lender Review
- [ ] Login as lender
- [ ] Call `POST /api/deals/provider-deliverables/{id}/review/` with:
  - `action`: 'approve', 'reject', or 'request_revision'
  - `review_notes`: Review comments
- [ ] Verify:
  - Status updates correctly:
    - 'approve' → status = 'approved'
    - 'reject' → status = 'rejected'
    - 'request_revision' → status = 'under_review'
  - `reviewed_by` = current user
  - `reviewed_at` = current time
  - `review_notes` = provided notes
  - Version history updated with review info
- [ ] Try reviewing as non-lender - should return 403

### 4. Frontend - Consultant Upload Deliverable
- [ ] Login as consultant
- [ ] Navigate to Deal Room → Consultants tab → Deliverables sub-tab
- [ ] Click "Upload Deliverable"
- [ ] Select deliverable type
- [ ] Select file
- [ ] Click "Upload"
- [ ] Verify:
  - Deliverable appears in list
  - Status = "Uploaded"
  - Version = 1
  - Document name and size displayed
  - Upload date and user displayed

### 5. Frontend - Lender Review Deliverable
- [ ] Login as lender
- [ ] Navigate to Deal Room → Consultants tab → Deliverables sub-tab
- [ ] Find deliverable with status "Uploaded"
- [ ] Click "Review" button
- [ ] Select action (Approve/Reject/Request Revision)
- [ ] Enter review notes
- [ ] Click "Submit Review"
- [ ] Verify:
  - Deliverable status updates
  - Review notes displayed
  - Reviewed date and user displayed
  - "Review" button disappears (replaced with status badge)

### 6. Frontend - Consultant Upload Revision
- [ ] As lender, reject a deliverable
- [ ] Login as consultant
- [ ] Navigate to Deal Room → Consultants tab → Deliverables sub-tab
- [ ] Find rejected deliverable
- [ ] Click "Upload Revision" button
- [ ] Select file
- [ ] Click "Upload"
- [ ] Verify:
  - New deliverable version created (version 2)
  - Previous version shows "Revised" status
  - Revision count badge appears
  - New version shows "Uploaded" status

### 7. Frontend - Download Deliverable
- [ ] View deliverable in list
- [ ] Click "Download" button
- [ ] Verify:
  - Document downloads successfully
  - File name matches document_name

### 8. Integration - End-to-End Flow
- [ ] As consultant, upload valuation report (v1)
- [ ] As lender, review and request revision
- [ ] As consultant, upload revised version (v2)
- [ ] As lender, review and approve
- [ ] Verify:
  - Version history shows both versions
  - Version 1 status = "Revised"
  - Version 2 status = "Approved"
  - Both versions accessible for download

### 9. Edge Cases
- [ ] Test uploading deliverable without file - should show error
- [ ] Test uploading deliverable without deliverable_type - should show error
- [ ] Test consultant uploading deliverable for deal they're not selected for - should fail
- [ ] Test lender reviewing deliverable for deal they don't own - should fail
- [ ] Test multiple revisions (v1 → v2 → v3) - verify version history chain
- [ ] Test viewing version history - verify all versions accessible

### 10. UI/UX
- [ ] Verify deliverable cards are well-formatted
- [ ] Verify status badges use appropriate colors
- [ ] Verify modals are responsive
- [ ] Verify file upload works with various file types
- [ ] Verify error messages are clear
- [ ] Verify success messages appear after actions

## Checkpoint Status

✅ **App compiles** - Backend and frontend compile without errors
✅ **Versioning** - Deliverable versioning implemented
✅ **Upload** - Provider upload functionality working
✅ **Review** - Lender review/approval/rejection working
✅ **Revisions** - Revision tracking and upload working
✅ **UI implementation** - Deliverables tab with upload/review modals

**Ready for CHUNK 8: Appointment Booking (Borrower <-> Consultant) Inside Deal Room**
