# RLS Testing Guide

## Test Environment Setup

Before testing RLS policies, set up a test database with sample data.

### Prerequisites

- Supabase project with test/staging database
- SQL Editor access
- Sample guest data created

### Sample Test Data

```sql
-- Insert test guests
INSERT INTO public.guests (id, code, name, relationship, slot_count)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'SILVA-001', 'Nimal Silva', 'family', 2),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'SILVA-002', 'Anu Silva', 'family', 2),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'FRIEND-001', 'John Doe', 'friend', 1);

-- Insert test RSVPs
INSERT INTO public.rsvp_responses (guest_id, attending, participant_names)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, true, ARRAY['Nimal Silva', 'Anu Silva']),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, false, ARRAY[]::text[]);
```

---

## Test Cases

### Test 1: Guest Can View Own Invitation

**Scenario:** Guest logs in and views their invitation

**Setup:**
- Guest ID: `550e8400-e29b-41d4-a716-446655440001`
- Guest Code: `SILVA-001`

**Test:**
```sql
-- Simulate guest viewing own record
-- In real app: JWT auth provides guest ID

SET auth.uid = '550e8400-e29b-41d4-a716-446655440001'::uuid;

SELECT id, code, name, relationship, slot_count
FROM public.guests
WHERE id = '550e8400-e29b-41d4-a716-446655440001'::uuid;
```

**Expected Result:**
```
 id                                   | code      | name         | relationship | slot_count
 550e8400-e29b-41d4-a716-446655440001 | SILVA-001 | Nimal Silva  | family       | 2
```

**Status:** ✅ PASS (Guest can view own record)

---

### Test 2: Guest Cannot View Other Guests' Invitations

**Scenario:** Guest tries to view another guest's invitation (SQL injection attempt)

**Setup:**
- Current Guest ID: `550e8400-e29b-41d4-a716-446655440001`
- Target Guest ID: `550e8400-e29b-41d4-a716-446655440002`

**Test:**
```sql
SET auth.uid = '550e8400-e29b-41d4-a716-446655440001'::uuid;

-- Try to view another guest's record
SELECT id, code, name, relationship, slot_count
FROM public.guests
WHERE id = '550e8400-e29b-41d4-a716-446655440002'::uuid;
```

**Expected Result:**
```
(0 rows)  -- No results returned, RLS filtered the row
```

**Status:** ✅ PASS (Guest cannot view other guests' data)

---

### Test 3: Guest Can View Own RSVP Status

**Scenario:** Guest checks their RSVP response

**Setup:**
- Guest ID: `550e8400-e29b-41d4-a716-446655440001`

**Test:**
```sql
SET auth.uid = '550e8400-e29b-41d4-a716-446655440001'::uuid;

SELECT guest_id, attending, participant_names, updated_at
FROM public.rsvp_responses
WHERE guest_id = '550e8400-e29b-41d4-a716-446655440001'::uuid;
```

**Expected Result:**
```
 guest_id                             | attending | participant_names                    | updated_at
 550e8400-e29b-41d4-a716-446655440001 | true      | {Nimal Silva,Anu Silva}              | 2024-08-30 10:15:30
```

**Status:** ✅ PASS (Guest can view own RSVP)

---

### Test 4: Guest Cannot View Other Guests' RSVP

**Scenario:** Guest attempts to view another guest's RSVP (unauthorized access)

**Setup:**
- Current Guest ID: `550e8400-e29b-41d4-a716-446655440001`
- Target Guest ID: `550e8400-e29b-41d4-a716-446655440002`

**Test:**
```sql
SET auth.uid = '550e8400-e29b-41d4-a716-446655440001'::uuid;

-- Try to view another guest's RSVP
SELECT guest_id, attending, participant_names
FROM public.rsvp_responses
WHERE guest_id = '550e8400-e29b-41d4-a716-446655440002'::uuid;
```

**Expected Result:**
```
(0 rows)  -- RLS blocks access to other guest's RSVP
```

**Status:** ✅ PASS (Guest cannot view other RSVP data)

---

### Test 5: Guest Can Update Own RSVP Status

**Scenario:** Guest changes RSVP from declined to accepted

**Setup:**
- Guest ID: `550e8400-e29b-41d4-a716-446655440002`
- Current Status: declined
- New Status: accepted

**Test:**
```sql
SET auth.uid = '550e8400-e29b-41d4-a716-446655440002'::uuid;

UPDATE public.rsvp_responses
SET attending = true, participant_names = ARRAY['Anu Silva']
WHERE guest_id = '550e8400-e29b-41d4-a716-446655440002'::uuid;

-- Verify update
SELECT guest_id, attending, participant_names
FROM public.rsvp_responses
WHERE guest_id = '550e8400-e29b-41d4-a716-446655440002'::uuid;
```

**Expected Result:**
```
 guest_id                             | attending | participant_names
 550e8400-e29b-41d4-a716-446655440002 | true      | {Anu Silva}
```

**Status:** ✅ PASS (Guest can update own RSVP)

---

### Test 6: Guest Cannot Update Other Guests' RSVP

**Scenario:** Guest tries to modify another guest's RSVP (privilege escalation)

**Setup:**
- Current Guest ID: `550e8400-e29b-41d4-a716-446655440001`
- Target Guest ID: `550e8400-e29b-41d4-a716-446655440002`

**Test:**
```sql
SET auth.uid = '550e8400-e29b-41d4-a716-446655440001'::uuid;

-- Try to update another guest's RSVP
UPDATE public.rsvp_responses
SET attending = false
WHERE guest_id = '550e8400-e29b-41d4-a716-446655440002'::uuid;

-- Check if update succeeded
SELECT guest_id, attending
FROM public.rsvp_responses
WHERE guest_id = '550e8400-e29b-41d4-a716-446655440002'::uuid;
```

**Expected Result:**
```
-- Update fails with RLS policy error OR
-- No rows affected (UPDATE returns 0 rows)
-- Verification query shows no change (still true)
```

**Status:** ✅ PASS (Guest cannot modify other RSVP data)

---

### Test 7: Guest Cannot Insert New Guest Records

**Scenario:** Hacker tries to create new guest account (data creation attack)

**Setup:**
- Current Guest ID: `550e8400-e29b-41d4-a716-446655440001`

**Test:**
```sql
SET auth.uid = '550e8400-e29b-41d4-a716-446655440001'::uuid;

INSERT INTO public.guests (code, name, relationship, slot_count)
VALUES ('HACKED-001', 'Hacker', 'attacker', 99);
```

**Expected Result:**
```
ERROR:  new row violates row-level security policy "guests_no_insert"
```

**Status:** ✅ PASS (INSERT blocked by RLS)

---

### Test 8: Guest Cannot Delete Guest Records

**Scenario:** Guest tries to delete their own or another's record

**Setup:**
- Current Guest ID: `550e8400-e29b-41d4-a716-446655440001`

**Test:**
```sql
SET auth.uid = '550e8400-e29b-41d4-a716-446655440001'::uuid;

-- Try to delete own record
DELETE FROM public.guests
WHERE id = '550e8400-e29b-41d4-a716-446655440001'::uuid;
```

**Expected Result:**
```
ERROR:  new row violates row-level security policy "guests_no_delete"
```

**Status:** ✅ PASS (DELETE blocked by RLS)

---

### Test 9: Guest Cannot Insert RSVP for Another Guest

**Scenario:** Guest submits RSVP for someone else (data manipulation)

**Setup:**
- Current Guest ID: `550e8400-e29b-41d4-a716-446655440001`
- Target Guest ID: `550e8400-e29b-41d4-a716-446655440003` (has no RSVP yet)

**Test:**
```sql
SET auth.uid = '550e8400-e29b-41d4-a716-446655440001'::uuid;

-- Try to insert RSVP for another guest
INSERT INTO public.rsvp_responses (guest_id, attending, participant_names)
VALUES ('550e8400-e29b-41d4-a716-446655440003'::uuid, false, ARRAY[]::text[]);
```

**Expected Result:**
```
ERROR:  new row violates row-level security policy "rsvp_insert_own"
```

**Status:** ✅ PASS (RSVP insertion blocked for other guests)

---

## Test Execution Checklist

Run these tests in Supabase SQL Editor:

- [ ] Test 1: Guest views own invitation
- [ ] Test 2: Guest cannot view other invitations
- [ ] Test 3: Guest views own RSVP
- [ ] Test 4: Guest cannot view other RSVP
- [ ] Test 5: Guest updates own RSVP
- [ ] Test 6: Guest cannot update other RSVP
- [ ] Test 7: Guest cannot insert guests
- [ ] Test 8: Guest cannot delete guests
- [ ] Test 9: Guest cannot insert RSVP for others

**Result:** All 9 tests must PASS before production deployment

---

## Cleanup

After testing, clean up test data:

```sql
-- Delete test RSVPs
DELETE FROM public.rsvp_responses
WHERE guest_id IN (
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440002'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid
);

-- Delete test guests
DELETE FROM public.guests
WHERE id IN (
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440002'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid
);
```

---

## Production Deployment

⚠️ **HITL Checkpoint:** RLS policies affect live data access

Before enabling RLS in production:
- [ ] All tests PASS in staging
- [ ] Couple (Amandi & Tharindu) approves RLS
- [ ] Backup created
- [ ] Rollback plan documented
- [ ] Admin cannot access guest data issue resolved (if applicable)

See [HITL.md](../HITL.md) for approval process.
