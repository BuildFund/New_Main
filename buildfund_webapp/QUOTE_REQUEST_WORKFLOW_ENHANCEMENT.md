# Quote Request Workflow Enhancement

## Summary
Redesigned the consultant quote request workflow to be more intuitive and match the actual process consultants go through when preparing quotes.

## Problem
The previous workflow was "clumsy" with unclear status transitions and no clear step-by-step process for consultants.

## Solution

### New Status Workflow

1. **Sent** → Initial state when lender sends quote request
2. **Received** → Consultant marks as received
3. **Acknowledged** → Consultant acknowledges and provides expected quote date
4. **Preparing Quote** → Consultant is actively preparing the quote
5. **Queries Raised** → Consultant has questions before quoting (can return to preparing)
6. **Ready to Submit** → Quote is prepared and ready to submit
7. **Quoted** → Quote has been submitted

### Backend Changes

1. **Enhanced Status Choices** (`ProviderEnquiry.STATUS_CHOICES`):
   - Added: `received`, `acknowledged`, `preparing_quote`, `queries_raised`, `ready_to_submit`
   - Kept: `sent`, `quoted`, `declined`, `expired`

2. **Updated `mark_viewed` endpoint**:
   - Now sets status to `received` (instead of `viewed`)
   - Records `viewed_at` timestamp

3. **Updated `acknowledge` endpoint**:
   - Now sets status to `acknowledged` (instead of keeping previous status)
   - Records acknowledgment details

4. **New `update_status` endpoint**:
   - `POST /api/deals/provider-enquiries/{id}/update-status/`
   - Allows consultants to update status through workflow
   - Validates status transitions
   - Supports notes for queries

### Frontend Changes

1. **Visual Progress Indicator**:
   - Shows 5-step progress bar:
     - Received (✓ when completed)
     - Acknowledged (✓ when completed)
     - Preparing Quote (active when in this stage)
     - Ready to Submit (active when ready)
     - Quote Submitted (✓ when completed)
   - Color-coded: gray (not started), primary (current), success (completed)

2. **Contextual Actions**:
   - **Sent**: "Mark as Received" button
   - **Received**: "Acknowledge Quote Request" form (expected date + notes)
   - **Acknowledged**: "Start Preparing Quote" or "Raise Queries" buttons
   - **Preparing Quote**: "Mark as Ready to Submit" or "Raise Queries" buttons
   - **Queries Raised**: "Continue Preparing Quote" button
   - **Ready to Submit**: "Submit Quote" button (navigates to quote form)
   - **Quoted**: "View Submitted Quote" button

3. **Queries Feature**:
   - Consultants can raise queries at any time during preparation
   - Queries stored in `acknowledgment_notes` field
   - Can return to "Preparing Quote" after raising queries

4. **Acknowledgment Details Display**:
   - Shows acknowledgment date, expected quote date, and notes
   - Displayed in a summary card when acknowledged

## Workflow Flow

```
Sent → [Mark as Received] → Received
Received → [Acknowledge] → Acknowledged
Acknowledged → [Start Preparing] → Preparing Quote
Acknowledged → [Raise Queries] → Queries Raised
Preparing Quote → [Mark Ready] → Ready to Submit
Preparing Quote → [Raise Queries] → Queries Raised
Queries Raised → [Continue Preparing] → Preparing Quote
Ready to Submit → [Submit Quote] → Quoted
```

## Migration

Created migration: `0007_add_enquiry_workflow_statuses.py`
- Updates `ProviderEnquiry.status` field choices
- Existing records with `viewed` status will need manual update (or can be migrated)

## Testing

### Manual Test Checklist

1. **Mark as Received**:
   - [ ] Login as consultant
   - [ ] View quote request with status "sent"
   - [ ] Click "Mark as Received"
   - [ ] Verify status changes to "received"
   - [ ] Verify progress indicator shows step 1 completed

2. **Acknowledge**:
   - [ ] From "received" status, click "Acknowledge Quote Request"
   - [ ] Fill in expected quote date and notes
   - [ ] Submit acknowledgment
   - [ ] Verify status changes to "acknowledged"
   - [ ] Verify acknowledgment details displayed
   - [ ] Verify progress indicator shows step 2 completed

3. **Start Preparing Quote**:
   - [ ] From "acknowledged" status, click "Start Preparing Quote"
   - [ ] Verify status changes to "preparing_quote"
   - [ ] Verify progress indicator shows step 3 active

4. **Raise Queries**:
   - [ ] From "acknowledged" or "preparing_quote", click "Raise Queries"
   - [ ] Enter query text
   - [ ] Submit queries
   - [ ] Verify status changes to "queries_raised"
   - [ ] Verify queries stored in acknowledgment_notes

5. **Continue After Queries**:
   - [ ] From "queries_raised", click "Continue Preparing Quote"
   - [ ] Verify status changes back to "preparing_quote"

6. **Mark Ready to Submit**:
   - [ ] From "preparing_quote", click "Mark as Ready to Submit"
   - [ ] Verify status changes to "ready_to_submit"
   - [ ] Verify progress indicator shows step 4 active

7. **Submit Quote**:
   - [ ] From "ready_to_submit", click "Submit Quote"
   - [ ] Complete quote form
   - [ ] Submit quote
   - [ ] Verify status changes to "quoted"
   - [ ] Verify progress indicator shows all steps completed

## Benefits

1. **Clear Process**: Consultants see exactly where they are in the workflow
2. **Intuitive Actions**: Each stage has appropriate actions available
3. **Flexibility**: Can raise queries and return to preparation
4. **Visibility**: Progress indicator shows completion status
5. **Professional**: Matches real-world consultant workflow
