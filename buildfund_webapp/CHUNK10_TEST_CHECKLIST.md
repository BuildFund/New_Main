# CHUNK 10: Workflow Gating from Accepted to Completion (Integration) - Test Checklist

## Backend Updates

✅ **DealService.calculate_completion_readiness_score()** - Enhanced
- Added provider deliverables check (weight: 20 points):
  - Valuation report approved: 8 points (if valuer selected)
  - IMS initial report approved: 7 points (if IMS selected for development finance)
- Breakdown now includes provider deliverable status
- Score calculation includes provider deliverables in total (max 100 points)

✅ **DealService.check_completion_readiness()** - New method
- Checks if deal is ready to complete by verifying:
  - Final valuation report approved (if valuer selected)
  - IMS initial report approved (if IMS selected for development finance)
  - All mandatory CPs satisfied
  - All requisitions closed (if solicitor selected)
- Returns `{'ready': bool, 'blockers': list}`

✅ **WorkflowEngine._evaluate_criterion()** - Enhanced
- Added checks for provider deliverables:
  - "valuation final issued" / "valuation approved" → checks for approved valuation_report
  - "IMS initial report issued" / "IMS initial report approved" → checks for approved ims_initial_report (development only)
  - "legal CPs satisfied" / "legal ready" → checks all mandatory CPs satisfied
  - "drawdown certificate" → checks if IMS is selected (certificate check at drawdown level)

✅ **DealViewSet.completion_readiness()** - New endpoint
- `GET /api/deals/deals/{id}/completion-readiness/`
- Returns completion readiness check with blockers
- Also updates and returns completion readiness score

✅ **DealViewSet.readiness_score()** - Updated
- Now uses `DealService.update_completion_readiness()` instead of model method
- Ensures score includes provider deliverables

✅ **Deal.calculate_readiness_score()** - Updated
- Now calls `DealService.update_completion_readiness()` to use service logic

## Integration Points

✅ **Completion Readiness Gating**
- Deal cannot reach "Ready to Complete" status without:
  - Final valuation report approved (if valuer selected)
  - IMS initial report approved (if IMS selected for development finance)
  - All mandatory CPs satisfied
  - All requisitions closed

✅ **Stage Exit Criteria**
- Stage exit criteria now check for provider deliverables
- Criteria like "valuation final issued" will block stage progression until deliverable is approved

✅ **Completion Readiness Score**
- Score now includes provider deliverables (20 points total)
- Breakdown shows missing deliverables as blockers

## Manual Test Checklist

### 1. Backend - Completion Readiness Score with Provider Deliverables
- [ ] Create a deal with valuer selected
- [ ] Call `GET /api/deals/deals/{id}/readiness-score/`
- [ ] Verify score is < 100 (missing valuation report)
- [ ] Upload and approve valuation report
- [ ] Call readiness score again
- [ ] Verify score increased by 8 points (valuation report weight)

### 2. Backend - Completion Readiness Check
- [ ] Create a deal with valuer and IMS selected (development finance)
- [ ] Call `GET /api/deals/deals/{id}/completion-readiness/`
- [ ] Verify `ready: false` and blockers include:
  - "Final valuation report must be approved"
  - "IMS initial report must be approved"
- [ ] Upload and approve valuation report
- [ ] Upload and approve IMS initial report
- [ ] Call completion readiness again
- [ ] Verify `ready: true` (if all other requirements met)

### 3. Backend - Stage Exit Criteria with Provider Deliverables
- [ ] Create a deal and advance to stage that requires "valuation final issued"
- [ ] Try to advance to next stage
- [ ] Verify advancement blocked (exit criteria not met)
- [ ] Upload and approve valuation report
- [ ] Try to advance again
- [ ] Verify advancement succeeds

### 4. Backend - Workflow Criterion Evaluation
- [ ] Test criterion: "valuation final issued"
  - [ ] Without approved valuation report → returns False
  - [ ] With approved valuation report → returns True
- [ ] Test criterion: "IMS initial report issued" (development finance)
  - [ ] Without approved IMS report → returns False
  - [ ] With approved IMS report → returns True
  - [ ] For non-development deal → returns True (not required)
- [ ] Test criterion: "legal CPs satisfied"
  - [ ] With unsatisfied mandatory CPs → returns False
  - [ ] With all mandatory CPs satisfied → returns True

### 5. Frontend - Completion Readiness Display
- [ ] Login as lender
- [ ] Navigate to Deal Room → Overview tab
- [ ] Verify completion readiness score displayed
- [ ] Verify breakdown shows provider deliverables status
- [ ] Verify blockers shown if deal not ready to complete

### 6. Frontend - Provider Deliverables Integration
- [ ] As valuer, upload valuation report
- [ ] As lender, approve valuation report
- [ ] Verify completion readiness score updates
- [ ] Verify deal can now advance to next stage (if other criteria met)

### 7. Integration - End-to-End Flow
- [ ] **Request Quotes**: Lender requests quotes for valuer, IMS, solicitor
- [ ] **Quote**: Consultants submit quotes via consultant dashboard
- [ ] **Select**: Borrower selects providers
- [ ] **Stages**: Providers progress through stages
- [ ] **Deliverables**: 
  - Valuer uploads and lender approves valuation report
  - IMS uploads and lender approves initial report (development)
  - Solicitor marks CPs as satisfied
- [ ] **Ready to Complete**: 
  - Check completion readiness → should show `ready: true`
  - Completion readiness score → should be 100 (or close to it)
  - Deal can advance to completion stage

### 8. Edge Cases
- [ ] Test deal without valuer selected → valuation report not required
- [ ] Test deal without IMS selected → IMS report not required
- [ ] Test non-development deal → IMS report not required
- [ ] Test deal with multiple deliverables → all must be approved
- [ ] Test deliverable rejection → score decreases, blockers appear
- [ ] Test deliverable revision → new version must be approved

### 9. Drawdown Workflow (Partial Integration)
- [ ] Note: Drawdown certificates are tracked separately via Drawdown.ims_certificate_document
- [ ] IMS can upload drawdown certificate as ProviderDeliverable (type: drawdown_certificate)
- [ ] Drawdown approval workflow checks MS approval (existing logic)
- [ ] Future enhancement: Link drawdown certificates to ProviderDeliverable for unified tracking

## Checkpoint Status

✅ **App compiles** - Backend compiles without errors
✅ **Completion readiness** - Includes provider deliverables in score calculation
✅ **Workflow gating** - Stage exit criteria check provider deliverables
✅ **API endpoints** - Completion readiness check endpoint available
✅ **Integration** - Provider deliverables block completion until approved

**Ready for CHUNK 11: Operational Reporting and SLA Metrics for Providers**
