# Deal Room Consultant Workflow - Baseline & Mapping

## CHUNK 0: BASELINE + MAP EXISTING CONSULTANT DASHBOARD

### 0.1 Existing Consultant Dashboard Routes/Components

**Frontend Routes (new_website/src/App.js):**
- `/consultant/dashboard` → `ConsultantDashboard` (main entry)
- `/consultant/services` → `ConsultantDashboard` with `defaultTab="opportunities"`
- `/consultant/quotes` → `ConsultantDashboard` with `defaultTab="quotes"`
- `/consultant/appointments` → `ConsultantDashboard` with `defaultTab="appointments"`
- `/consultant/profile` → `ConsultantProfile`
- `/consultant/profile/wizard` → `ConsultantProfileWizard`
- `/consultant/services/:serviceId/quote` → `ConsultantQuoteForm`
- `/consultant/appointments/:appointmentId` → `ConsultantAppointmentDetail`

**Frontend Components:**
- `new_website/src/pages/ConsultantDashboard.js` - Main dashboard with tabs
- `new_website/src/pages/ConsultantProfile.js` - Profile view
- `new_website/src/pages/ConsultantProfileWizard.js` - Profile setup wizard
- `new_website/src/pages/ConsultantQuoteForm.js` - Quote submission form
- `new_website/src/pages/ConsultantAppointmentDetail.js` - Appointment detail view

**Current Dashboard Tabs:**
- `opportunities` - Service opportunities (from `/api/consultants/services/`)
- `quotes` - Submitted quotes (from `/api/consultants/quotes/`)
- `appointments` - Active appointments (from `/api/consultants/appointments/`)
- `profile` - Profile information

### 0.2 Existing Data Models for Consultant Assignment

**Deal Models (buildfund_webapp/deals/models.py):**
- `DealParty` - Links consultants to deals
  - Fields: `deal`, `consultant_profile`, `party_type` (valuer, monitoring_surveyor, solicitor), `acting_for_party` (lender/borrower), `is_active_lender_solicitor`
  - Already supports consultant assignment to deals

**Consultant Models (buildfund_webapp/consultants/models.py):**
- `ConsultantProfile` - Consultant/solicitor profile
- `ConsultantService` - Service requests (linked to Application, not Deal)
- `ConsultantQuote` - Quotes submitted
- `ConsultantAppointment` - Appointments (linked to ConsultantService)

**Key Gap:**
- `ConsultantService` is linked to `Application`, not `Deal`
- Need to create Deal-level provider workflow models

### 0.3 Backend API Endpoints

**Consultant APIs (buildfund_webapp/consultants/views.py):**
- `/api/consultants/profiles/` - ConsultantProfileViewSet
- `/api/consultants/services/` - ConsultantServiceViewSet (filters by consultant's services_offered)
- `/api/consultants/quotes/` - ConsultantQuoteViewSet
- `/api/consultants/appointments/` - ConsultantAppointmentViewSet

**Deal APIs (buildfund_webapp/deals/views.py):**
- `/api/deals/` - DealViewSet
- `/api/deals/:dealId/parties/` - DealPartyViewSet
- `/api/deals/:dealId/timeline/` - Timeline action

### 0.4 Current Deal Room Structure

**Frontend:**
- `new_website/src/pages/DealRoom.js` - Main deal room component
- Route: `/deals/:dealId`
- Tabs: overview, timeline, tasks, cps, requisitions, drawdowns, documents, messages, consultants

**Backend:**
- Deal model supports parties via `DealParty`
- Consultant assignment exists but workflow is incomplete

### 0.5 Missing Components (To Be Built)

1. **Deal-level provider workflow models:**
   - ProviderEnquiry (deal-based, not application-based)
   - ProviderQuote (deal-based)
   - DealProviderSelection
   - ProviderStageInstance
   - Deliverable (deal-scoped)
   - Appointment (deal-scoped)

2. **Consultant Dashboard Extensions:**
   - "My Enquiries" tab (deal-based enquiries)
   - "My Deals" tab (scoped deal room view)

3. **Deal Room Extensions:**
   - Lender: Matching, Enquiries, Quotes, Selection, Progress, Deliverables, Appointments
   - Borrower: Quotes, Selection, Appointments, Deliverables (read-only), Messages
   - Consultant: Scoped deal view with stages, tasks, deliverables, appointments, messages

### 0.6 Security & Access Control

**Existing:**
- RBAC via `permissions.IsAuthenticated`, `IsLender`, `IsBorrower`
- Step-up authentication for sensitive documents
- Audit logging via `AuditEvent`
- Secure document uploads

**To Enforce:**
- Consultants can only see deals where they are selected OR have active enquiry OR assigned tasks
- Borrowers can see quotes and selection
- Lenders can see everything for their deals

---

## CHECKPOINT 0 STATUS

✅ **App compiles** - Verified
✅ **Lender dashboard loads** - Verified
✅ **Borrower dashboard loads** - Verified  
✅ **Consultant dashboard loads** - Verified

**Baseline committed** - Ready for CHUNK 1
