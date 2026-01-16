# CHUNK 11: Operational Reporting and SLA Metrics for Providers - Test Checklist

## Summary
Added operational reporting and SLA metrics for providers, allowing lenders and admins to track provider performance including quote response times, acceptance rates, deliverable delivery times, rework counts, and appointment lead times.

## Backend Changes

✅ **Extended PerformanceMetric Model** (`buildfund_webapp/deals/models.py`)
- Added provider-specific metric types:
  - `quote_response_time` - Time from enquiry sent to quote submitted (hours)
  - `quote_acceptance_rate` - Percentage of quotes accepted
  - `deliverable_delivery_time` - Time from instruction to deliverable approved (days)
  - `deliverable_rework_count` - Number of rejected/revised deliverables
  - `appointment_lead_time` - Time from proposal to confirmation (hours)
  - `time_to_completion_impact` - Days added/subtracted from deal completion
- Added `provider_firm` ForeignKey to link metrics to consultant profiles
- Added `role_type` field to track which role the metrics are for

✅ **Created ProviderMetricsService** (`buildfund_webapp/deals/provider_metrics_service.py`)
- `calculate_quote_response_time()` - Calculates average, median, min, max response times
- `calculate_quote_acceptance_rate()` - Calculates acceptance percentage
- `calculate_deliverable_delivery_time()` - Calculates average delivery time from instruction to approval
- `calculate_deliverable_rework_count()` - Counts rejected/revised deliverables
- `calculate_appointment_lead_time()` - Calculates average time from proposal to confirmation
- `calculate_provider_metrics_for_deal()` - Comprehensive metrics for a specific deal
- `generate_performance_metrics()` - Generates and saves PerformanceMetric records

✅ **Added ProviderMetricsViewSet** (`buildfund_webapp/deals/views.py`)
- `deal_metrics` action: `GET /api/deals/provider-metrics/deal/{deal_id}/`
  - Returns metrics for all providers on a specific deal
  - Lender/admin only
- `provider_metrics` action: `GET /api/deals/provider-metrics/provider/{provider_id}/`
  - Returns aggregated metrics for a provider firm
  - Supports role_type and period_days query parameters
  - Provider, lender (for their deals), or admin can view

## Frontend Changes

✅ **Added Reporting Tab to Lender Deal Room** (`new_website/src/components/DealConsultants.js`)
- Added "Reporting" tab to lender sub-tabs
- Added state: `providerMetrics`, `loadingMetrics`
- Added `loadProviderMetrics()` function
- Displays metrics in cards showing:
  - Provider firm name and role
  - Quote response time (hours/days)
  - Quote status (submitted/accepted)
  - Deliverables (approved/total, rejected count, average delivery time)
  - Appointments (confirmed/total, average lead time)
- Shows loading state and empty state messages

## Manual Test Checklist

### 1. Backend - Metrics Calculation
- [ ] Login as lender
- [ ] Create a deal with provider selections
- [ ] Send quote requests to providers
- [ ] Providers submit quotes
- [ ] Providers upload deliverables
- [ ] Providers create appointments
- [ ] Call `GET /api/deals/provider-metrics/deal/{deal_id}/`
- [ ] Verify metrics are calculated correctly:
  - [ ] Quote response time is calculated (enquiry sent to quote submitted)
  - [ ] Quote acceptance status is shown
  - [ ] Deliverable counts and delivery times are shown
  - [ ] Appointment counts and lead times are shown

### 2. Frontend - Reporting Tab Display
- [ ] Login as lender
- [ ] Navigate to Deal Room
- [ ] Click "Consultants" tab
- [ ] Click "Reporting" sub-tab
- [ ] Verify metrics are displayed for each selected provider:
  - [ ] Provider name and role are shown
  - [ ] Quote response time is displayed (if quote submitted)
  - [ ] Quote status is shown
  - [ ] Deliverable metrics are shown (if deliverables exist)
  - [ ] Appointment metrics are shown (if appointments exist)
- [ ] Verify empty state when no providers selected
- [ ] Verify loading state while fetching metrics

### 3. Provider Metrics Endpoint
- [ ] Login as lender
- [ ] Call `GET /api/deals/provider-metrics/provider/{provider_id}/`
- [ ] Verify aggregated metrics are returned:
  - [ ] Quote response time (average, median, min, max, count)
  - [ ] Quote acceptance rate
  - [ ] Deliverable delivery time
  - [ ] Deliverable rework count
  - [ ] Appointment lead time
- [ ] Test with `role_type` query parameter
- [ ] Test with `period_days` query parameter (default 90 days)

### 4. Permissions
- [ ] Login as lender - verify can see metrics for their deals
- [ ] Login as borrower - verify cannot access reporting tab
- [ ] Login as consultant - verify cannot access reporting tab
- [ ] Login as admin - verify can see all metrics

### 5. Edge Cases
- [ ] Deal with no providers selected - shows empty state
- [ ] Provider with no quotes - quote metrics not shown
- [ ] Provider with no deliverables - deliverable metrics not shown
- [ ] Provider with no appointments - appointment metrics not shown
- [ ] Provider with rejected deliverables - rework count shown

## Expected Results

1. **Lender Deal Room Reporting Tab**:
   - Shows performance metrics for all selected providers
   - Displays key metrics in easy-to-read cards
   - Updates automatically when providers complete actions

2. **Metrics Accuracy**:
   - Quote response times calculated from enquiry sent to quote submitted
   - Delivery times calculated from provider selection to deliverable approval
   - Appointment lead times calculated from proposal to confirmation
   - All metrics show appropriate units (hours/days)

3. **User Experience**:
   - Clear visual presentation of metrics
   - Loading states during data fetch
   - Helpful empty states when no data available
   - Responsive grid layout for metric cards

## Files Modified

- `buildfund_webapp/deals/models.py` - Extended PerformanceMetric model
- `buildfund_webapp/deals/provider_metrics_service.py` - New service for metrics calculation
- `buildfund_webapp/deals/views.py` - Added ProviderMetricsViewSet
- `buildfund_webapp/deals/urls.py` - Registered provider-metrics endpoint
- `new_website/src/components/DealConsultants.js` - Added Reporting tab and metrics display

## Migration

Created migration: `0008_add_provider_metrics_to_performance.py`
- Adds `provider_firm` ForeignKey to PerformanceMetric
- Adds `role_type` field to PerformanceMetric
- Updates `metric_type` choices to include provider-specific metrics
