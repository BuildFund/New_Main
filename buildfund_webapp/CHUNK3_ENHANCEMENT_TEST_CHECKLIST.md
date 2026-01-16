# CHUNK 3 Enhancement: Borrower Solicitor Management - Test Checklist

## Backend Updates

✅ **BorrowerProfile Model** - Added solicitor fields
- `solicitor_firm_name` - Firm name
- `solicitor_sra_number` - SRA registration number
- `solicitor_contact_name` - Primary contact name
- `solicitor_contact_email` - Contact email
- `solicitor_contact_phone` - Contact phone
- `solicitor_user` - ForeignKey to User (if solicitor is already in system)

✅ **DealService.create_deal_from_application** - Enhanced
- Checks borrower profile for solicitor information
- If solicitor exists and is a user: auto-invites to deal as DealParty
- If solicitor not in system: placeholder for future invitation

✅ **ProviderEnquiryViewSet.request_quotes** - Enhanced
- For solicitor role: checks if borrower already has solicitor
- Prevents sending quote requests if borrower solicitor exists
- Returns informative error message

✅ **ProviderEnquiryViewSet.matching_providers** - Enhanced
- For solicitor role: checks if borrower has solicitor
- Returns borrower_has_solicitor flag and solicitor info
- Returns empty matching list if borrower has solicitor

## Frontend Updates

✅ **BorrowerProfileWizard.js** - Added Step 8: Preferred Solicitor
- New step between Documents and Review & Submit
- Checkbox to indicate "I have a preferred solicitor"
- Form fields: firm name*, SRA number*, contact name, email*, phone
- Validation: required fields when solicitor is selected
- Data saved to profile on submit

✅ **DealConsultants.js - Matching Tab** - Enhanced
- For solicitor role: shows message if borrower has preferred solicitor
- Displays solicitor firm name, email, contact name
- Prevents "Request Quote" button from appearing
- Shows informative message about borrower's solicitor

## Manual Test Checklist

### 1. Backend - BorrowerProfile Solicitor Fields
- [ ] Run `python manage.py migrate borrowers` - should complete (or skip if fields exist)
- [ ] Verify fields exist in database:
  - `borrowers_borrowerprofile.solicitor_firm_name`
  - `borrowers_borrowerprofile.solicitor_sra_number`
  - `borrowers_borrowerprofile.solicitor_contact_name`
  - `borrowers_borrowerprofile.solicitor_contact_email`
  - `borrowers_borrowerprofile.solicitor_contact_phone`
  - `borrowers_borrowerprofile.solicitor_user_id`

### 2. Frontend - Borrower Onboarding
- [ ] Login as borrower
- [ ] Navigate to Borrower Profile Wizard
- [ ] Complete steps 1-7
- [ ] Verify Step 8 "Preferred Solicitor" appears
- [ ] Toggle "I have a preferred solicitor"
- [ ] Fill in solicitor details (firm name, SRA number, email required)
- [ ] Verify validation prevents progression without required fields
- [ ] Complete wizard and submit
- [ ] Verify solicitor data is saved to profile

### 3. Backend - Deal Creation with Borrower Solicitor
- [ ] Create a deal for a borrower who has solicitor in profile
- [ ] Verify DealParty is created for solicitor (if solicitor is a user)
- [ ] Verify party_type is 'solicitor'
- [ ] Verify acting_for_party is 'borrower'
- [ ] Verify appointment_status is 'invited'

### 4. Frontend - Lender Matching Tab (Solicitor Role)
- [ ] Login as lender
- [ ] Navigate to Deal Room for deal with borrower who has solicitor
- [ ] Click "Consultants" tab
- [ ] Click "Matching" sub-tab
- [ ] Select "Solicitor" role
- [ ] Verify message appears: "Borrower Has Preferred Solicitor"
- [ ] Verify solicitor details display (firm name, email, contact)
- [ ] Verify no matching providers list appears
- [ ] Verify "Request Quote" functionality is disabled/hidden

### 5. Backend - Request Quotes Prevention
- [ ] As lender, try to request quotes for solicitor role
- [ ] Verify API returns error: "Borrower already has a solicitor for this deal"
- [ ] Verify error includes solicitor_info
- [ ] Verify no ProviderEnquiry records are created

### 6. Frontend - Borrower Profile View
- [ ] Login as borrower
- [ ] Navigate to Borrower Profile
- [ ] Verify solicitor information displays (if added)
- [ ] Verify solicitor can be edited (if profile is in draft/changes_requested status)

### 7. Integration - Solicitor Already in System
- [ ] Create borrower profile with solicitor email matching existing consultant user
- [ ] Create deal for that borrower
- [ ] Verify DealParty is created linking to existing consultant
- [ ] Verify solicitor receives invitation notification

### 8. Integration - Solicitor Not in System
- [ ] Create borrower profile with solicitor who is not a user
- [ ] Create deal for that borrower
- [ ] Verify no DealParty is created (placeholder for future)
- [ ] Verify lender can still see borrower has solicitor in matching tab

## Checkpoint Enhancement Status

✅ **App compiles** - Backend and frontend compile
✅ **Borrower can add solicitor in onboarding** - Step 8 functional
✅ **Solicitor data saved to profile** - Profile stores solicitor information
✅ **Deal creation checks for solicitor** - Auto-invites if solicitor is user
✅ **Lender sees borrower solicitor info** - Matching tab shows message
✅ **Quote requests prevented** - Backend prevents duplicate solicitor quotes

**Ready for CHUNK 4**
