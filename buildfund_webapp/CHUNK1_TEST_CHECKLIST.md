# CHUNK 1: Data Model Extensions - Test Checklist

## Models Added

✅ **ProviderEnquiry** - Quote requests sent to providers
- Fields: deal, role_type, provider_firm, status, sent_at, viewed_at, quote_due_at, deal_summary_snapshot
- Statuses: sent, viewed, quoted, declined, expired

✅ **ProviderQuote** - Quotes submitted by providers
- Fields: enquiry, role_type, price_gbp, lead_time_days, earliest_available_date, scope_summary, assumptions, deliverables, validity_days, status, version
- Statuses: submitted, under_review, accepted, declined, withdrawn, expired

✅ **DealProviderSelection** - Selection of provider for a role
- Fields: deal, role_type, provider_firm, quote, selected_by, selected_at, lender_approval_required, lender_approved_at
- Unique constraint: one provider per role per deal

✅ **ProviderStageInstance** - Stage tracking for providers
- Fields: deal, role_type, provider_firm, current_stage, stage_history, instructed_at, started_at, completed_at
- Tracks stage progression with history

✅ **ProviderDeliverable** - Documents/reports uploaded by providers
- Fields: deal, role_type, provider_firm, deliverable_type, status, version, document, uploaded_at, reviewed_by, review_notes
- Types: valuation_report, reliance_letter, ims_initial_report, monitoring_report, drawdown_certificate, legal_doc_pack, cp_evidence, completion_statement
- Statuses: uploaded, under_review, approved, rejected, revised

✅ **ProviderAppointment** - Appointments (site visits, meetings)
- Fields: deal, role_type, provider_firm, status, date_time, location, notes, proposed_slots
- Statuses: proposed, confirmed, rescheduled, cancelled, completed

## Manual Test Checklist

### 1. Database Schema
- [ ] Run `python manage.py migrate` - should complete without errors
- [ ] Verify tables created in database:
  - `deals_providerenquiry`
  - `deals_providerquote`
  - `deals_dealproviderselection`
  - `deals_providerstageinstance`
  - `deals_providerdeliverable`
  - `deals_providerappointment`

### 2. Model Validation
- [ ] Run `python manage.py check` - should pass with no errors
- [ ] Verify no related_name conflicts

### 3. Model Relationships
- [ ] Verify ProviderEnquiry links to Deal and ConsultantProfile
- [ ] Verify ProviderQuote links to ProviderEnquiry
- [ ] Verify DealProviderSelection enforces unique constraint (one provider per role per deal)
- [ ] Verify ProviderStageInstance tracks stage history
- [ ] Verify ProviderDeliverable links to Document model
- [ ] Verify ProviderAppointment supports proposed_slots JSON field

### 4. Indexes
- [ ] Verify indexes created for:
  - ProviderEnquiry: (deal, role_type, status), (provider_firm, status)
  - ProviderQuote: (enquiry, status)
  - DealProviderSelection: (deal, role_type), (provider_firm)
  - ProviderStageInstance: (deal, role_type), (provider_firm, current_stage)
  - ProviderDeliverable: (deal, role_type, status), (provider_firm, status)
  - ProviderAppointment: (deal, role_type, status), (provider_firm, date_time)

## Checkpoint 1 Status

✅ **App compiles** - `python manage.py check` passes
✅ **Migrations run cleanly** - `python manage.py migrate` completes
✅ **No UI changes yet** - Models only, no views/serializers

**Ready for CHUNK 2**
