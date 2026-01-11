# Supabase Architecture Audit Report

**Generated:** 2026-01-09  
**Project:** LCL (Hyper-Local Social App)  
**Auditor:** Lead Backend Architect (Autonomous Audit)

---

## Executive Summary

This comprehensive audit examines the current Supabase integration across authentication, database, storage, and potential edge functions. The analysis identifies security gaps, performance bottlenecks, silent failure points, and provides a detailed hardening plan.

### Current Integration Score: 7/10 ⚠️

**Strengths:**
- ✅ Clean separation of concerns (dedicated service files)
- ✅ Comprehensive database schema with proper indexes
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Real authentication implementation (no mock data)
- ✅ TypeScript type safety with generated database types
- ✅ Proper foreign key relationships and cascade behaviors

**Critical Gaps:**
- ❌ Non-singleton client pattern (potential connection issues)
- ⚠️ RLS policies need hardening for production
- ⚠️ Silent error handling in multiple locations
- ⚠️ Storage bucket may not be configured
- ❌ No Edge Functions (may be needed for complex operations)
- ⚠️ Missing retry logic for transient failures
- ⚠️ No connection health monitoring

---

## 1. Authentication Audit

### Current Implementation

**Location:** `src/contexts/AuthContext.tsx`, `src/lib/supabase.ts`

**Features Implemented:**
- Email/password sign up and sign in
- Google OAuth integration
- Session persistence
- Auto-refresh tokens
- Profile creation on signup
- User context management

**Authentication Flow:**
```typescript
// Sign Up Flow
1. User signs up → Supabase Auth creates user
2. AuthContext creates profile record with user_id
3. Profile marked as incomplete (profile_complete: false)
4. User directed to ProfileSetupView for onboarding

// Sign In Flow
1. User signs in → Supabase Auth validates
2. AuthContext fetches profile using user_id
3. Session established with auto-refresh
4. User directed to feed or profile setup
```

### 🔴 Security Gaps

#### 1.1 Profile Creation Race Condition
**Location:** `AuthContext.tsx:105-116`
```typescript
if (data.user) {
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: data.user.id,
      full_name: fullName,
      profile_complete: false,
    });
  // Error logged but not propagated to user
}
```
**Issue:** Silent failure if profile creation fails. User gets authenticated but has no profile.

**Severity:** HIGH  
**Impact:** User stuck in broken state, cannot use app

#### 1.2 Missing Auth.uid() Synchronization
**Location:** Multiple RLS policies
**Issue:** Profiles table uses `id` field but RLS policies check `auth.uid()`. The schema has both `id` and `user_id` fields causing confusion.

**Schema Issue:**
```sql
-- profiles table has BOTH:
id uuid PRIMARY KEY  -- Used as profile_id in relationships
user_id uuid REFERENCES auth.users(id)  -- Links to Supabase Auth

-- But RLS policies check:
USING (id = auth.uid())  -- WRONG! Should be user_id = auth.uid()
```

**Severity:** CRITICAL  
**Impact:** RLS policies may not work correctly, allowing unauthorized access

#### 1.3 OAuth Profile Creation Not Handled
**Location:** `AuthContext.tsx:124-136`
```typescript
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}` }
  });
  return { error };
};
```
**Issue:** No profile creation logic for OAuth users. First-time Google users won't have a profile.

**Severity:** HIGH  
**Impact:** OAuth users stuck without profile

### 🟡 Silent Failures

#### 1.4 Profile Fetch Errors Not Surfaced
**Location:** `AuthContext.tsx:29-43`
```typescript
const fetchProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) throw error;
    setProfile(data);
    return data;
  } catch (error) {
    console.error('Error fetching profile:', error);  // Only logged
    return null;  // User not notified
  }
};
```
**Severity:** MEDIUM  
**Impact:** User experience degraded, no feedback on profile issues

### ✅ Good Practices Observed
- Auto-refresh tokens enabled
- Session persistence configured
- Proper TypeScript typing
- Context-based state management
- Cleanup of subscriptions on unmount

---

## 2. Database Schema & RLS Audit

### Current Schema

**Tables:** 5 total
1. `profiles` - User profiles with reliability scores
2. `persona_stats` - Per-persona statistics (family/gamer)
3. `persona_badges` - Achievement badges
4. `events` - All events (anchors, forks, signals)
5. `event_attendees` - Many-to-many attendance tracking

### 🔴 Security Issues

#### 2.1 Overly Permissive Anonymous Access
**Location:** `supabase/schema.sql:172-175`, `migrations/20260109034123`

```sql
-- Allow anonymous read access for development/testing
CREATE POLICY "Allow read access for development"
  ON profiles
  FOR SELECT
  TO anon
  USING (true);
```
**Issue:** Production schema includes development-only policy

**Severity:** HIGH  
**Impact:** Anyone can read all profiles without authentication

**Similar Issues Found:**
- All tables allow anonymous SELECT (development pattern)
- Event creation allows any authenticated user without verification
- Persona stats/badges can be read by anyone

#### 2.2 Incorrect RLS Policy Checks
**Location:** `supabase/migrations/20260109032347_create_lcl_social_app_schema.sql:186-191`

```sql
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())  -- WRONG FIELD!
  WITH CHECK (id = auth.uid());  -- WRONG FIELD!
```
**Issue:** Compares `id` (profile ID) with `auth.uid()` (auth user ID). These are different values!

**Correct Implementation:**
```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

**Severity:** CRITICAL  
**Impact:** Users cannot update their own profiles OR can update any profile

#### 2.3 Missing Foreign Key Constraints
**Location:** Schema analysis

**Current:** Events reference profiles via `created_by uuid REFERENCES profiles(id)`
**Issue:** Should reference `auth.users(id)` or have proper cascade handling

#### 2.4 No Capacity Enforcement at Table Level
**Location:** `events` table
```sql
CREATE TABLE events (
  -- ... other fields
  max_attendees int,  -- No constraint checking
);
```
**Issue:** Application-level checking only (race conditions possible)

**Note:** Migration `20260109120000_add_atomic_join_event_rpc.sql` adds a stored procedure for this, but not enforced at constraint level.

### 🟡 Performance Bottlenecks

#### 2.5 Missing Composite Indexes
**Current Indexes:**
```sql
CREATE INDEX idx_events_location ON events USING GIST(location);
CREATE INDEX idx_events_parent ON events(parent_event_id);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_type ON events(event_type);
```

**Missing Indexes:**
```sql
-- For common query: Get upcoming events by category
CREATE INDEX idx_events_date_category ON events(event_date, category) 
  WHERE event_date > now();

-- For user's events
CREATE INDEX idx_event_attendees_profile_status ON event_attendees(profile_id, status)
  INCLUDE (event_id);

-- For event detail page
CREATE INDEX idx_events_with_creator ON events(id)
  INCLUDE (created_by, title, description);
```

#### 2.6 N+1 Query Potential
**Location:** `src/lib/hooks.ts:134-139`
```typescript
let query = supabase
  .from('events')
  .select(`
    *,
    attendee_count:event_attendees(count)  // Subquery per row
  `)
```
**Issue:** Could be optimized with proper JOINs or materialized views

### ✅ Good Schema Practices
- PostGIS extension for geospatial queries
- Proper geography type (POINT, 4326 SRID)
- GIST indexes on geography columns
- Foreign key cascade behaviors defined
- CHECK constraints for data integrity
- Updated_at triggers implemented
- Unique constraints on logical keys

### 🟢 Database Integrity

**Strong Points:**
- All foreign keys properly defined with ON DELETE CASCADE
- Check constraints on enum-like fields (category, event_type, status)
- Numeric constraints (reliability_score 0-100)
- Unique constraints prevent duplicate attendance
- NOT NULL on required fields

**Weak Points:**
- No CHECK constraint for event dates (can create past events)
- No CHECK constraint for max_attendees > 0
- Missing validation for location coordinates (valid lat/lng)

---

## 3. Storage Audit

### Current Implementation

**Location:** `src/lib/storageService.ts`

**Bucket:** `public-assets`  
**Folders:** `avatars/`, `events/`, `badges/`

**Features:**
- Image upload with validation (type, size)
- Automatic compression (1200px max, 80% quality)
- Client-side canvas-based optimization
- Public URL generation
- File deletion

### 🔴 Critical Issues

#### 3.1 Bucket May Not Exist
**Evidence:** No bucket creation in migrations or schema
**Location:** `DEPLOYMENT_GUIDE.md:94-107` mentions manual setup

```sql
-- From DEPLOYMENT_GUIDE.md (manual step)
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true);
```
**Issue:** Application assumes bucket exists but doesn't create it

**Severity:** HIGH  
**Impact:** All image uploads fail silently

#### 3.2 No Storage RLS Policies in Migrations
**Expected Policies:**
```sql
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public-assets');

CREATE POLICY "Authenticated uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'public-assets');
```
**Status:** Not found in migrations

**Severity:** HIGH  
**Impact:** Uploads may fail or be unrestricted

#### 3.3 File Size Validation Client-Side Only
**Location:** `storageService.ts:26-29`
```typescript
const maxSize = 5 * 1024 * 1024;
if (file.size > maxSize) {
  throw new Error('File size must be less than 5MB');
}
```
**Issue:** Can be bypassed by direct API calls

**Severity:** MEDIUM  
**Impact:** Potential abuse, storage costs

### 🟡 Silent Failures

#### 3.4 Upload Errors Not Properly Handled
**Location:** `storageService.ts:35-52`
```typescript
const { error } = await supabase.storage
  .from(STORAGE_BUCKET)
  .upload(filePath, file, { cacheControl: '3600', upsert: false });

if (error) throw error;  // Generic error

return { url: urlData.publicUrl, path: filePath, error: null };
```
**Issues:**
- No specific error messages for different failure types
- No retry logic for transient failures
- Upsert disabled but no duplicate handling

### 🟢 Good Practices
- File type validation
- Client-side compression reduces bandwidth
- Unique filename generation (userId + timestamp)
- Organized folder structure
- Proper error object returns

---

## 4. Edge Functions Audit

### Current State: ❌ NO EDGE FUNCTIONS FOUND

**Search Results:** No `functions/` directory in `supabase/` folder

### 🟡 Potential Use Cases

#### 4.1 Event Capacity Management
**Current:** Application-level checking with race conditions  
**Better:** Edge function with database transaction

```typescript
// Potential edge function: join-event
export const handler = async (req: Request) => {
  const { eventId, userId } = await req.json();
  
  // Atomic transaction
  const result = await supabase.rpc('join_event_atomic', {
    p_event_id: eventId,
    p_profile_id: userId
  });
  
  return new Response(JSON.stringify(result));
};
```

**Status:** RPC function exists (`join_event_atomic`) but no Edge Function wrapper

#### 4.2 Image Processing
**Current:** Client-side compression  
**Better:** Server-side processing, thumbnail generation

#### 4.3 Email Notifications
**Current:** None  
**Potential:** Event reminders, attendance confirmations

#### 4.4 Webhook Handlers
**Current:** None  
**Potential:** OAuth callbacks, payment processing

### Decision: ✅ Edge Functions NOT Critical
**Reasoning:**
- RPC functions handle atomic operations
- Client-side compression works well
- No payment processing yet
- Email can be added later

**Recommendation:** Defer Edge Functions to Phase 2

---

## 5. Error Handling & Resilience Audit

### Current Patterns

#### 5.1 Inconsistent Error Handling
**Pattern Analysis:**

**Good Example** (`eventService.ts`):
```typescript
export async function joinEvent({ eventId, profileId, status }: JoinEventParams) {
  try {
    // ... operation
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error joining event:', error);
    return { data: null, error: error as Error };
  }
}
```

**Bad Example** (`AuthContext.tsx`):
```typescript
const fetchProfile = async (userId: string) => {
  try {
    // ... operation
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;  // Error not returned, caller doesn't know what failed
  }
};
```

#### 5.2 No Retry Logic
**Location:** All service files
**Issue:** Network failures result in immediate failure

**Impact:**
- Poor mobile experience (spotty connections)
- Silent failures on temporary network issues
- No exponential backoff

#### 5.3 Silent Supabase Client Creation
**Location:** `src/lib/supabase.ts:14-23`
```typescript
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

**Issues:**
1. **Not a Singleton:** New import = new client (though module caching helps)
2. **No Connection Validation:** Doesn't verify connection works
3. **No Error Handling:** Throws generic error
4. **No Timeout Configuration:** Uses defaults
5. **No Retry Configuration:** Uses defaults

### 🔴 Critical Gaps

#### 5.4 No Health Checks
**Missing:**
- Database connection health
- Auth service availability
- Storage service availability
- Realtime connection status

#### 5.5 No Request Timeout Configuration
**Current:** Uses Supabase defaults (no explicit timeout)
**Risk:** Long-running queries block UI indefinitely

#### 5.6 Realtime Subscriptions Disabled
**Location:** `App.tsx:36-58` (commented out)
```typescript
// Realtime subscription temporarily disabled due to WebSocket timeout issues
```
**Issue:** Feature disabled due to unresolved timeout problems

**Severity:** MEDIUM  
**Impact:** No live updates, stale data

---

## 6. Migration from Mock to Real Data

### Current Status: ✅ COMPLETE

**Findings:**
- ✅ No mock data files found
- ✅ All components use real Supabase hooks
- ✅ useEvents, useProfile, usePersonaStats all query database
- ✅ Seed data in migrations provides test data
- ✅ Event creation, joining fully functional

**Evidence:**
```typescript
// src/lib/hooks.ts - All real queries
export function useEvents(options?: {...}) {
  const [events, setEvents] = useState<EventWithAttendees[]>([]);
  
  useEffect(() => {
    async function fetchEvents() {
      let query = supabase.from('events').select(...)  // Real query
      const { data, error } = await query;
      setEvents(data || []);
    }
    fetchEvents();
  }, [...]);
  
  return { events, loading };
}
```

**Remaining Work:** None - fully migrated

---

## Hardening Plan Summary

### Phase 1: Critical Security Fixes (Priority: IMMEDIATE)

| Issue | Impact | Effort | Status |
|-------|--------|--------|--------|
| Fix RLS policy field checks (id → user_id) | CRITICAL | 2h | 🔴 Required |
| Remove anonymous access policies | HIGH | 1h | 🔴 Required |
| Add profile creation for OAuth users | HIGH | 3h | 🔴 Required |
| Handle profile creation failures | HIGH | 2h | 🔴 Required |
| Create storage bucket and policies | HIGH | 2h | 🔴 Required |
| Fix profile-auth synchronization | CRITICAL | 4h | 🔴 Required |

**Total Effort:** ~14 hours  
**Must Complete Before Production:** YES

### Phase 2: Resilience & Performance (Priority: HIGH)

| Task | Impact | Effort | Status |
|------|--------|--------|--------|
| Implement singleton client pattern | MEDIUM | 3h | 🟡 Recommended |
| Add connection health checks | MEDIUM | 4h | 🟡 Recommended |
| Add retry logic with exponential backoff | HIGH | 5h | 🟡 Recommended |
| Add missing composite indexes | MEDIUM | 2h | 🟡 Recommended |
| Optimize N+1 queries | LOW | 3h | 🟢 Optional |
| Re-enable Realtime subscriptions | MEDIUM | 4h | 🟡 Recommended |
| Add request timeout configuration | MEDIUM | 2h | 🟡 Recommended |

**Total Effort:** ~23 hours  
**Must Complete Before Production:** HIGHLY RECOMMENDED

### Phase 3: Integrity & Constraints (Priority: MEDIUM)

| Task | Impact | Effort | Status |
|------|--------|--------|--------|
| Add database constraints (dates, coords) | MEDIUM | 3h | 🟢 Optional |
| Add table-level capacity enforcement | LOW | 4h | 🟢 Optional |
| Add server-side file validation | MEDIUM | 3h | 🟡 Recommended |
| Enhance error messages | LOW | 2h | 🟢 Optional |

**Total Effort:** ~12 hours  
**Must Complete Before Production:** NICE TO HAVE

### Phase 4: Documentation (Priority: LOW)

| Task | Effort |
|------|--------|
| Document Supabase integration patterns | 3h |
| Create RLS policy documentation | 2h |
| Update security best practices | 2h |
| Add troubleshooting guide | 2h |

**Total Effort:** ~9 hours

---

## Clarification Questions

Before proceeding with hardening implementation, please clarify the following business logic requirements:

### 1. Event Creation Permissions
**Question:** Can anyone create an event, or only verified residents?

**Current Implementation:** Any authenticated user can create events
```sql
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
```

**Options:**
- A) Any authenticated user (current)
- B) Only verified_resident = true users
- C) Users with minimum reliability_score (e.g., > 50)
- D) Custom approval workflow

**Recommendation:** Option B (verified residents only) for quality control

---

### 2. Profile Visibility
**Question:** Should profiles be publicly visible or only to authenticated users?

**Current Implementation:** Public access (including anonymous)
```sql
CREATE POLICY "Allow read access for development"
  ON profiles FOR SELECT TO anon USING (true);
```

**Options:**
- A) Public (anyone can view)
- B) Authenticated only (must be logged in)
- C) Connection-based (only friends/connections)
- D) Event-based (only profiles of event attendees)

**Recommendation:** Option B for privacy, or Option D for social context

---

### 3. Event Capacity Management
**Question:** How should we handle events reaching capacity?

**Current Implementation:** Application-level check with RPC function
```sql
-- join_event_atomic checks capacity but allows race conditions
IF v_current_count >= v_max_attendees THEN
  RETURN jsonb_build_object('status', 'full', ...);
END IF;
```

**Options:**
- A) Hard limit (reject when full)
- B) Waitlist (allow "interested" status)
- C) No limit (unlimited capacity)
- D) Overflow to new event instance

**Recommendation:** Option B (waitlist) for better UX

---

### 4. Persona Stats Update Permissions
**Question:** Who can update persona stats (rallies_hosted, host_rating, etc.)?

**Current Implementation:** Users can update their own stats
```sql
CREATE POLICY "Users can update own persona stats"
  ON persona_stats FOR UPDATE TO authenticated
  USING (profile_id = auth.uid());
```

**Options:**
- A) User self-service (current, easily gamed)
- B) System-only (calculated automatically)
- C) Event-triggered (updated by event completion)
- D) Peer-verified (other users can rate)

**Recommendation:** Option B or C to prevent gaming the system

---

### 5. File Upload Restrictions
**Question:** What are the file upload restrictions for production?

**Current Implementation:** Client-side only (5MB, images only)
```typescript
if (file.size > maxSize) throw new Error('...');
if (!file.type.startsWith('image/')) throw new Error('...');
```

**Options:**
- A) Current (5MB, any image type)
- B) Strict (2MB, JPEG/PNG only)
- C) Premium users get more (10MB for verified)
- D) Server-side validation + virus scanning

**Recommendation:** Option D for production security

---

## Conclusion

The LCL Supabase integration is well-architected with good separation of concerns and modern patterns. However, several **critical security issues** must be addressed before production:

1. **RLS Policies are broken** (checking wrong fields)
2. **Anonymous access is too permissive** (development policies in production)
3. **OAuth users have no profile creation** (broken user flow)
4. **Storage bucket may not exist** (uploads will fail)
5. **No singleton pattern** (potential connection issues)
6. **Silent error handling** (poor user experience)

**Estimated Total Effort:** 58 hours (Critical + Recommended)  
**Minimum Viable:** 14 hours (Critical only)  
**Production Ready:** 37 hours (Critical + High Priority)

**Next Step:** Await business logic clarifications, then proceed to implementation phase.

---

*End of Audit Report*
