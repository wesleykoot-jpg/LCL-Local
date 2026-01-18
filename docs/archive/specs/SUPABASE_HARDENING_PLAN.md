# Supabase Hardening Plan - Quick Reference

**Status:** ⏸️ AWAITING BUSINESS LOGIC CLARIFICATIONS  
**Generated:** 2026-01-09  
**Full Audit:** See [SUPABASE_AUDIT.md](./SUPABASE_AUDIT.md)

---

## Current State Summary

### ✅ What's Working Well
- Clean TypeScript architecture with generated types
- All 5 tables properly structured with foreign keys
- PostGIS geospatial queries functioning
- Authentication flow complete (email + OAuth)
- Real data integration (no mock data)
- Comprehensive error boundaries

### 🔴 Critical Issues (MUST FIX)
1. **RLS policies check wrong field** - `id` instead of `user_id`
2. **Anonymous access too permissive** - Production includes dev policies
3. **OAuth users get no profile** - Broken signup flow
4. **Storage bucket missing** - Uploads will fail
5. **Profile creation failures silent** - Users stuck in broken state

### 🟡 Important Gaps (SHOULD FIX)
1. Non-singleton Supabase client pattern
2. No retry logic for failed requests
3. No connection health monitoring
4. Realtime subscriptions disabled
5. Missing composite database indexes
6. Client-side only file validation

---

## Hardening Plan Overview

### Phase 1: Security Fixes (14 hours) 🔴 REQUIRED

| Task | Files Affected | Priority |
|------|---------------|----------|
| Fix RLS policy checks (id → user_id) | `supabase/migrations/*.sql`, `supabase/schema.sql` | CRITICAL |
| Remove anonymous access | `supabase/migrations/*.sql` | HIGH |
| Add OAuth profile creation | `src/contexts/AuthContext.tsx` | HIGH |
| Handle profile creation errors | `src/contexts/AuthContext.tsx` | HIGH |
| Create storage bucket + policies | New migration file | HIGH |
| Synchronize profile/auth IDs | Multiple files | CRITICAL |

**Deliverables:**
- ✅ RLS policies correctly enforce user ownership
- ✅ No anonymous access to user data
- ✅ OAuth users get profiles automatically
- ✅ Profile creation errors shown to users
- ✅ Storage bucket exists with proper policies
- ✅ Profile IDs match auth user IDs

---

### Phase 2: Resilience (23 hours) 🟡 RECOMMENDED

| Task | Files Affected | Priority |
|------|---------------|----------|
| Singleton client pattern | `src/lib/supabase.ts` | MEDIUM |
| Connection health checks | `src/lib/supabase.ts` | MEDIUM |
| Retry logic + exponential backoff | All service files | HIGH |
| Add composite indexes | New migration | MEDIUM |
| Fix N+1 queries | `src/lib/hooks.ts` | LOW |
| Re-enable Realtime | `src/App.tsx` | MEDIUM |
| Request timeout config | `src/lib/supabase.ts` | MEDIUM |

**Deliverables:**
- ✅ Single Supabase client instance
- ✅ Network failure resilience
- ✅ Connection status monitoring
- ✅ Live updates working
- ✅ Optimized database queries

---

### Phase 3: Data Integrity (12 hours) 🟢 OPTIONAL

| Task | Files Affected | Priority |
|------|---------------|----------|
| Database date/coordinate constraints | New migration | MEDIUM |
| Table-level capacity enforcement | `events` table | LOW |
| Server-side file validation | New edge function or migration | MEDIUM |
| Better error messages | All service files | LOW |

**Deliverables:**
- ✅ Database prevents invalid data
- ✅ Event capacity enforced at DB level
- ✅ Files validated server-side
- ✅ Clear error messages for users

---

### Phase 4: Documentation (9 hours) 🟢 NICE-TO-HAVE

- Document all Supabase patterns
- Create RLS policy guide
- Update security best practices
- Add troubleshooting guide

---

## Security Risk Matrix

| Issue | Severity | Impact | Likelihood | Risk Score |
|-------|----------|--------|------------|------------|
| RLS policies broken | CRITICAL | Data leak | HIGH | 🔴 9/10 |
| Anonymous access | HIGH | Privacy breach | MEDIUM | 🟡 7/10 |
| OAuth no profile | HIGH | Broken UX | HIGH | 🟡 8/10 |
| Storage missing | HIGH | Feature broken | HIGH | 🟡 8/10 |
| No singleton | MEDIUM | Connection issues | MEDIUM | 🟡 5/10 |
| Silent errors | MEDIUM | Poor UX | HIGH | 🟡 6/10 |
| No retry logic | MEDIUM | Failed requests | MEDIUM | 🟡 5/10 |
| Client validation only | LOW | Abuse potential | LOW | 🟢 3/10 |

---

## Implementation Roadmap

### Week 1: Critical Fixes (Phase 1)
**Goal:** Production-safe security

```
Day 1-2: RLS Policy Fixes
- Fix all policies to use user_id instead of id
- Remove anonymous access policies
- Test with authenticated users

Day 3: OAuth Integration
- Add profile creation hook for OAuth
- Test Google sign-in flow
- Handle edge cases

Day 4: Storage Setup
- Create bucket via migration
- Add storage RLS policies
- Test image upload flow

Day 5: Error Handling
- Surface profile creation errors
- Add user-friendly error messages
- Test failure scenarios
```

### Week 2: Resilience (Phase 2)
**Goal:** Production-grade reliability

```
Day 1: Client Refactor
- Implement singleton pattern
- Add health checks
- Add timeout configuration

Day 2-3: Retry Logic
- Add exponential backoff
- Test network failure scenarios
- Add request caching

Day 4: Performance
- Add composite indexes
- Optimize N+1 queries
- Benchmark improvements

Day 5: Realtime
- Fix WebSocket timeout issues
- Re-enable subscriptions
- Test live updates
```

### Week 3: Polish (Phase 3 + 4)
**Goal:** Production-excellent

```
Day 1-2: Data Integrity
- Add database constraints
- Implement capacity enforcement
- Add server-side validation

Day 3-5: Documentation
- Document all patterns
- Create troubleshooting guide
- Update deployment docs
```

---

## Testing Checklist

### Security Testing
- [ ] Test RLS policies with different user roles
- [ ] Verify anonymous users cannot access private data
- [ ] Test OAuth signup and profile creation
- [ ] Verify users can only modify own data
- [ ] Test storage bucket permissions

### Resilience Testing
- [ ] Simulate network failures
- [ ] Test retry logic with flaky connection
- [ ] Monitor connection health
- [ ] Test Realtime subscriptions
- [ ] Load test with concurrent users

### Data Integrity Testing
- [ ] Try to create invalid events (past dates, bad coords)
- [ ] Test event capacity limits
- [ ] Upload invalid files (wrong type, too large)
- [ ] Test foreign key cascades
- [ ] Verify unique constraints

### User Experience Testing
- [ ] Verify error messages are user-friendly
- [ ] Test profile creation flow end-to-end
- [ ] Test event creation and joining
- [ ] Test image upload and display
- [ ] Test persona switching

---

## Success Criteria

### Security ✅
- ✅ RLS policies block unauthorized access (0 leaks in audit)
- ✅ Anonymous users cannot read private data
- ✅ OAuth users successfully create profiles
- ✅ Storage bucket has proper policies

### Reliability ✅
- ✅ Network failures retry automatically
- ✅ Connection health monitored
- ✅ Realtime updates work consistently
- ✅ No silent failures (all errors surfaced)

### Performance ✅
- ✅ Database queries < 100ms (95th percentile)
- ✅ No N+1 query patterns
- ✅ All common queries use indexes
- ✅ Image uploads < 2 seconds

### User Experience ✅
- ✅ Clear error messages for all failures
- ✅ Loading states for all async operations
- ✅ Profile creation success rate > 99%
- ✅ Event joining success rate > 99%

---

## Risk Mitigation

### Deployment Risk
**Risk:** Breaking changes to production database  
**Mitigation:**
- Test all migrations on staging first
- Use transactions for migration batches
- Keep rollback scripts ready
- Deploy during low-traffic window

### Data Migration Risk
**Risk:** Existing users break with profile changes  
**Mitigation:**
- Add fields as nullable first
- Backfill data in separate migration
- Make NOT NULL after backfill
- Verify all users have valid profiles

### Performance Risk
**Risk:** New indexes slow down writes  
**Mitigation:**
- Add indexes concurrently (CONCURRENTLY keyword)
- Monitor write performance
- Use partial indexes where possible
- Test on production-scale data

---

## Dependencies & Blockers

### External Dependencies
- ✅ Supabase project access (available)
- ✅ Database migration permissions (available)
- ✅ Storage bucket quota (need to verify)
- ⏸️ Business logic decisions (awaiting)

### Technical Blockers
- ⏸️ Clarification on event creation permissions
- ⏸️ Clarification on profile visibility rules
- ⏸️ Clarification on capacity management
- ⏸️ Clarification on persona stats updates
- ⏸️ Clarification on file upload restrictions

### Team Blockers
- None identified (autonomous implementation)

---

## Next Actions

### Immediate (Before Code Changes)
1. ⏸️ **WAIT for answers to 5 clarification questions** (see below)
2. Review audit findings with stakeholders
3. Prioritize which phases to implement
4. Set up staging environment for testing

### After Clarifications
1. Create feature branch for Phase 1
2. Write failing tests for security issues
3. Implement fixes one by one
4. Run full test suite
5. Deploy to staging
6. Get stakeholder sign-off
7. Deploy to production

---

## 5 Critical Clarification Questions

Before implementing the hardening plan, please answer these questions about intended business logic:

### 1️⃣ Event Creation Permissions
**Question:** Can anyone create an event, or only verified residents?

**Current:** Any authenticated user can create events  
**Options:**
- A) Any authenticated user (easiest, current)
- B) Only `verified_resident = true` (quality control)
- C) Minimum `reliability_score > 50` (earned trust)
- D) Custom approval workflow (most control)

**Your Answer:** _________________

---

### 2️⃣ Profile Visibility
**Question:** Should profiles be publicly visible or restricted?

**Current:** Public access (even anonymous users)  
**Options:**
- A) Public to everyone (most open)
- B) Authenticated users only (login required)
- C) Connection-based (friends only)
- D) Event-based (only co-attendees)

**Your Answer:** _________________

---

### 3️⃣ Event Capacity Management
**Question:** How should we handle events reaching capacity?

**Current:** Hard reject when full  
**Options:**
- A) Hard limit, reject when full (current)
- B) Waitlist (allow "interested" status)
- C) No limit (unlimited capacity)
- D) Overflow (create new instance)

**Your Answer:** _________________

---

### 4️⃣ Persona Stats Updates
**Question:** Who can update persona stats (rallies_hosted, host_rating)?

**Current:** Users can update their own stats (easily gamed)  
**Options:**
- A) User self-service (current, trust-based)
- B) System-only (calculated automatically)
- C) Event-triggered (updated on completion)
- D) Peer-verified (other users rate)

**Your Answer:** _________________

---

### 5️⃣ File Upload Restrictions
**Question:** What are production file upload restrictions?

**Current:** Client-side (5MB, any image)  
**Options:**
- A) Current (5MB, any image type)
- B) Strict (2MB, JPEG/PNG only)
- C) Tiered (premium users get 10MB)
- D) Server validation + virus scan

**Your Answer:** _________________

---

## Contact & Support

**Questions:** Open an issue in the repository  
**Urgent Security Issues:** Contact project maintainer immediately  
**Implementation Updates:** Track via PR comments

---

*This is a stop-point document. No code will be written until the 5 clarification questions are answered.*
