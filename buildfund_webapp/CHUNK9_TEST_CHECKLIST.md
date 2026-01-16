# CHUNK 9: Private Communications Threads (Role and Party Scoped) - Test Checklist

## Backend Updates

✅ **DealMessageThread Model** - Enhanced with scoping
- Added `created_by`: ForeignKey to User (who created the thread)
- Added `visible_to_roles`: JSONField for role-based scoping (e.g., ['lender', 'borrower', 'valuer'])
- Added `is_private`: Boolean flag for private threads
- `visible_to_parties`: ManyToManyField (existing, enhanced usage)

✅ **DealMessageThreadViewSet.get_queryset()** - Enhanced
- Filters threads by user's deal access
- Filters by party visibility (user's party must be in `visible_to_parties` OR thread is not private)
- Uses `prefetch_related` for efficient party loading

✅ **DealMessageThreadViewSet.perform_create()** - Enhanced
- Sets `created_by` to current user
- Auto-configures visibility based on `thread_type`:
  - `general`: Borrower + Lender (not private)
  - `legal`: Lender + Lender Solicitor + Borrower Solicitor (private)
  - `valuation`: Lender + Valuer (private)
  - `ims`: Lender + Monitoring Surveyor (private)
- Adds creator's party to visible parties
- Sets `visible_to_roles` based on thread type

✅ **DealMessageViewSet.get_queryset()** - Enhanced
- Filters messages by thread access (user must have access to thread)
- Supports filtering by `thread_id` or `deal_id`
- Only shows messages from accessible threads

✅ **DealMessageViewSet.perform_create()** - Enhanced
- Finds user's `DealParty` for the deal
- Sets `sender` to user's party (not user directly)
- Sets `sender_user` to current user
- Updates thread's `last_message_at` timestamp

✅ **DealMessageThreadSerializer** - Enhanced
- Added `message_count`: Count of messages in thread
- Added `unread_count`: Placeholder for read tracking (returns 0 for now)
- Added `visible_to_party_names`: List of party names that can see thread

✅ **DealMessageSerializer** - Enhanced
- Added `sender_role`: Party type/role of sender
- Added `is_own_message`: Boolean indicating if message is from current user
- Enhanced `sender_name` to handle consultant profiles

## Frontend Updates

✅ **DealConsultants.js - Messages Tab** - Implemented
- Added `messageThreads`, `selectedThread`, `threadMessages`, `newMessageText`, `createThreadModal` state
- Added `loadMessageThreads()`, `loadThreadMessages()`, `sendMessage()`, `createThread()` functions
- Messages tab displays:
  - **Thread List** (left sidebar):
    - List of all accessible threads
    - Thread type badge, private badge
    - Subject, visible parties, last message time, message count
    - Click to select thread
  - **Message View** (right panel):
    - Thread header with subject and participants
    - Message list (WhatsApp-style, own messages on right, others on left)
    - Message input form at bottom
    - Real-time message sending
  - **Create Thread Modal**:
    - Thread type selector (General, Legal, Valuation, IMS)
    - Subject input
    - Creates thread with auto-configured visibility

## Manual Test Checklist

### 1. Backend - Create Thread
- [ ] Login as lender
- [ ] Call `POST /api/deals/deal-message-threads/` with:
  - `deal`: Deal ID
  - `thread_type`: 'general', 'legal', 'valuation', or 'ims'
  - `subject`: Thread subject
- [ ] Verify:
  - Thread created with `created_by` = current user
  - `visible_to_parties` set correctly based on thread type
  - `visible_to_roles` set correctly
  - `is_private` set correctly (general=false, others=true)

### 2. Backend - Thread Visibility Scoping
- [ ] Create 'general' thread (should be visible to borrower and lender)
- [ ] Create 'valuation' thread (should be visible only to lender and valuer)
- [ ] Create 'legal' thread (should be visible to lender and solicitors)
- [ ] Login as borrower - verify:
  - Can see 'general' thread
  - Cannot see 'valuation' or 'legal' threads
- [ ] Login as valuer - verify:
  - Can see 'valuation' thread (if selected for deal)
  - Cannot see 'general' or 'legal' threads

### 3. Backend - Send Message
- [ ] Login as lender
- [ ] Call `POST /api/deals/deal-messages/` with:
  - `thread`: Thread ID
  - `message`: Message text
- [ ] Verify:
  - Message created with `sender` = user's DealParty
  - `sender_user` = current user
  - Thread's `last_message_at` updated
- [ ] Try sending to thread user doesn't have access to - should return 403

### 4. Backend - Message Filtering
- [ ] Login as borrower
- [ ] Call `GET /api/deals/deal-messages/?deal_id={dealId}`
- [ ] Verify:
  - Only messages from threads borrower can access are returned
  - Messages from private threads borrower is not part of are excluded

### 5. Frontend - View Threads
- [ ] Login as lender
- [ ] Navigate to Deal Room → Consultants tab → Messages sub-tab
- [ ] Verify:
  - Thread list displays all accessible threads
  - Threads show type badge, subject, participants, last message time
  - Private threads marked with "Private" badge

### 6. Frontend - Create Thread
- [ ] Login as lender
- [ ] Navigate to Deal Room → Consultants tab → Messages sub-tab
- [ ] Click "New Thread"
- [ ] Select thread type (e.g., "Valuation")
- [ ] Enter subject
- [ ] Click "Create Thread"
- [ ] Verify:
  - Thread appears in list
  - Thread automatically selected
  - Visibility configured correctly based on type

### 7. Frontend - Send Message
- [ ] Select a thread
- [ ] Type message in input
- [ ] Click "Send"
- [ ] Verify:
  - Message appears in message list
  - Own messages appear on right (primary color)
  - Other messages appear on left (gray)
  - Message shows sender name and role
  - Timestamp displayed

### 8. Frontend - Thread Types and Visibility
- [ ] As lender, create 'general' thread
- [ ] As borrower, verify can see and participate
- [ ] As lender, create 'valuation' thread
- [ ] As valuer (if selected), verify can see and participate
- [ ] As borrower, verify cannot see 'valuation' thread
- [ ] As lender, create 'legal' thread
- [ ] As solicitor (if selected), verify can see and participate

### 9. Integration - End-to-End Flow
- [ ] As lender, create 'valuation' thread
- [ ] As lender, send message in thread
- [ ] As valuer, view Deal Room → Consultants → Messages
- [ ] As valuer, verify can see 'valuation' thread
- [ ] As valuer, send reply
- [ ] As lender, verify can see valuer's reply
- [ ] As borrower, verify cannot see 'valuation' thread

### 10. Edge Cases
- [ ] Test creating thread without subject - should show error
- [ ] Test sending message without text - should show error
- [ ] Test accessing thread user doesn't have access to - should not appear
- [ ] Test sending message to thread user lost access to - should fail
- [ ] Test multiple threads - verify all accessible threads shown
- [ ] Test thread with no messages - should show "No messages yet"

## Checkpoint Status

✅ **App compiles** - Backend and frontend compile without errors
✅ **Thread scoping** - Role and party-based scoping implemented
✅ **Thread creation** - Auto-configures visibility based on type
✅ **Message sending** - Messages linked to user's DealParty
✅ **UI implementation** - Full messaging interface with thread list and message view

**Ready for CHUNK 10: Workflow Gating from Accepted to Completion (Integration)**
