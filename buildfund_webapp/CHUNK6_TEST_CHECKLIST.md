# CHUNK 6: Industry-Correct Provider Progression Stages + Task Templates - Test Checklist

## Backend Updates

✅ **provider_workflow_templates.py** - New file with industry-standard provider stages
- **Valuer Stages**: instructed → inspection_scheduled → inspection_completed → draft_report → final_report → accepted
- **Monitoring Surveyor Stages**: instructed → kickoff_meeting → document_review → initial_report → monitoring_ongoing → completion
- **Solicitor Stages**: instructed → cp_checklist_prepared → cps_satisfied → legal_docs_prepared → completion_ready → completed
- Each stage includes:
  - Display name, description
  - SLA days
  - Entry/exit criteria
  - Task templates with priority, SLA hours, descriptions

✅ **DealProviderSelectionViewSet.perform_create()** - Enhanced
- Auto-creates `ProviderStageInstance` with initial stage from templates
- Auto-creates tasks for initial stage from task templates
- Links tasks to provider's `DealParty`
- Sets due dates based on SLA hours

✅ **ProviderStageInstanceViewSet** - Enhanced
- Changed from `ReadOnlyModelViewSet` to `ModelViewSet` (allows updates)
- Added `advance_stage` action: `POST /api/deals/provider-stages/{id}/advance_stage/`
- Advances provider to next stage
- Creates tasks for new stage automatically
- Updates stage history
- Only provider, lender, or admin can advance stages

✅ **ProviderStageInstanceSerializer** - Enhanced
- Added `current_stage_display`: Human-readable stage name
- Added `next_stage`: Next stage name if available
- Added `tasks`: List of tasks for this provider stage instance
- Tasks are filtered by provider's `DealParty`

## Frontend Updates

✅ **DealConsultants.js - Progress Tab** - Implemented
- Added `providerStages` state
- Added `loadProviderStages()` function
- Progress tab displays:
  - Provider role and current stage
  - Progress bar (completed tasks / total tasks)
  - List of tasks with:
    - Title, description, priority badge
    - Due date (with overdue indicator)
    - Status (completed badge)
    - "Mark Complete" button
  - "Advance to Next Stage" button (if next stage available)
- Shows provider firm name
- Shows stage entered date

✅ **DealRoom.js - My Progress Tab** - Added for consultants
- Added "My Progress" tab (consultants only)
- Added `providerStages` state
- Added `loadProviderStages()` function
- Displays same information as Progress tab in DealConsultants
- Consultants can:
  - View their current stage
  - See their assigned tasks
  - Mark tasks as complete
  - Advance to next stage

## Manual Test Checklist

### 1. Backend - Provider Stage Templates
- [ ] Verify `provider_workflow_templates.py` contains:
  - Valuer: 6 stages (instructed → accepted)
  - Monitoring Surveyor: 6 stages (instructed → completion)
  - Solicitor: 6 stages (instructed → completed)
- [ ] Verify each stage has:
  - Display name, description
  - SLA days
  - Entry/exit criteria
  - Task templates with priority and SLA hours

### 2. Backend - Auto-Create Stages and Tasks
- [ ] As lender, select a provider (via DealProviderSelection)
- [ ] Verify `ProviderStageInstance` is created with:
  - `current_stage`: 'instructed' (or appropriate initial stage)
  - `instructed_at`: Set to current time
  - `started_at`: Set to current time
- [ ] Verify tasks are created for initial stage:
  - Tasks linked to provider's `DealParty`
  - Tasks have correct title, description, priority
  - Tasks have due dates based on SLA hours
  - Tasks have status 'pending'

### 3. Backend - Advance Stage Action
- [ ] Login as consultant
- [ ] Call `POST /api/deals/provider-stages/{id}/advance_stage/`
- [ ] Verify:
  - `current_stage` updates to next stage
  - `stage_entered_at` updates to current time
  - Stage history is updated
  - Tasks for new stage are created
- [ ] Try advancing from final stage - should return error
- [ ] Try advancing as non-provider/non-lender - should return 403

### 4. Frontend - Lender Deal Room - Progress Tab
- [ ] Login as lender
- [ ] Navigate to Deal Room → Consultants tab → Progress sub-tab
- [ ] Verify provider stages are displayed:
  - Role type (Valuer, Monitoring Surveyor, Solicitor)
  - Current stage with display name
  - Provider firm name
  - Stage entered date
  - Progress bar (tasks completed / total)
- [ ] Verify tasks are displayed:
  - Task title, description
  - Priority badge
  - Due date (with overdue indicator if applicable)
  - Status badge
  - "Mark Complete" button (for lender to mark tasks complete)
- [ ] Verify "Advance to Next Stage" button appears (if next stage available)
- [ ] Click "Advance to Next Stage"
- [ ] Verify stage advances and new tasks are created

### 5. Frontend - Consultant Deal Room - My Progress Tab
- [ ] Login as consultant
- [ ] Navigate to Deal Room (via "My Deals" → "Open Deal Room")
- [ ] Verify "My Progress" tab appears in tab list
- [ ] Click "My Progress" tab
- [ ] Verify same information as lender Progress tab:
  - Current stage
  - Tasks list
  - Progress bar
- [ ] Click "Mark Complete" on a task
- [ ] Verify task status updates to 'completed'
- [ ] Verify progress bar updates
- [ ] Click "Advance to Next Stage"
- [ ] Verify stage advances and new tasks appear

### 6. Integration - End-to-End Flow
- [ ] As lender, create a deal
- [ ] As lender, request quotes for Valuer
- [ ] As consultant (valuer), submit quote
- [ ] As lender, select consultant
- [ ] Verify ProviderStageInstance created with 'instructed' stage
- [ ] Verify initial tasks created (Acknowledge instruction, Review instruction pack)
- [ ] As consultant, view Deal Room → My Progress
- [ ] As consultant, mark tasks as complete
- [ ] As consultant, advance to 'inspection_scheduled' stage
- [ ] Verify new tasks created (Schedule site inspection, Confirm inspection details)
- [ ] As lender, view Deal Room → Consultants → Progress
- [ ] Verify lender can see consultant's progress and stage

### 7. Stage Progression - Valuer
- [ ] Select a valuer
- [ ] Verify initial stage: 'instructed'
- [ ] Complete tasks and advance through stages:
  - instructed → inspection_scheduled
  - inspection_scheduled → inspection_completed
  - inspection_completed → draft_report
  - draft_report → final_report
  - final_report → accepted
- [ ] Verify tasks are created for each stage
- [ ] Verify final stage shows 'accepted' with completed_at timestamp

### 8. Stage Progression - Monitoring Surveyor
- [ ] Select a monitoring surveyor
- [ ] Verify initial stage: 'instructed'
- [ ] Complete tasks and advance through stages:
  - instructed → kickoff_meeting
  - kickoff_meeting → document_review
  - document_review → initial_report
  - initial_report → monitoring_ongoing (ongoing stage)
  - monitoring_ongoing → completion (when project completes)
- [ ] Verify recurring tasks (site visits, drawdown reviews) are created

### 9. Stage Progression - Solicitor
- [ ] Select a solicitor
- [ ] Verify initial stage: 'instructed'
- [ ] Complete tasks and advance through stages:
  - instructed → cp_checklist_prepared
  - cp_checklist_prepared → cps_satisfied
  - cps_satisfied → legal_docs_prepared
  - legal_docs_prepared → completion_ready
  - completion_ready → completed
- [ ] Verify tasks are created for each stage

### 10. Edge Cases
- [ ] Test provider with no tasks (should show 0% progress)
- [ ] Test provider with all tasks completed (should show 100% progress)
- [ ] Test advancing stage when tasks are incomplete (should still work)
- [ ] Test provider accessing deal they're not selected for (should not see stages)
- [ ] Test multiple providers on same deal (each should have own stage instance)
- [ ] Test provider stage history (verify history is recorded)

## Checkpoint Status

✅ **App compiles** - Backend and frontend compile without errors
✅ **Provider templates** - Industry-standard stages defined for all roles
✅ **Auto-creation** - Stages and tasks auto-created on selection
✅ **Stage advancement** - Providers can advance through stages
✅ **Task management** - Tasks created per stage with priorities and SLAs
✅ **Progress tracking** - Progress bars and task completion tracking
✅ **UI implementation** - Progress tab in Deal Room for lenders and consultants

**Ready for CHUNK 7: Deliverable Uploads + Lender Review + Versioning**
