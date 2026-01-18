# Profile-Discovery Alignment Validation Checklist

## Manual Testing Guide

### Visual Consistency Tests

#### 1. Section Headers
- [ ] Navigate to Profile page
- [ ] Verify "Your Journey" header uses same style as Discovery rails
- [ ] Check header typography (should be text-xl, not text-2xl)
- [ ] Verify header has proper tracking-tight

#### 2. Padding Consistency
- [ ] Check left/right padding of all sections
- [ ] Should be 24px (px-6) throughout
- [ ] Compare with Discovery page sections
- [ ] No visible padding differences

#### 3. Section Spacing
- [ ] Verify spacing between sections
- [ ] Should have consistent 48px (space-y-12) gaps
- [ ] Compare with Discovery page rail spacing

#### 4. Empty States
- [ ] View Passport tab with no events
- [ ] Verify empty state has:
  - [ ] Centered illustration
  - [ ] Bold title (text-xl)
  - [ ] Muted description
  - [ ] CTA button with icon
  - [ ] Matches Discovery empty state style

### Accessibility Tests

#### 5. Tab Navigation (Mouse)
- [ ] Click on each tab (Passport, Wishlist, Settings)
- [ ] Verify tab highlights correctly
- [ ] Verify correct panel shows
- [ ] Check smooth animation transition

#### 6. Tab Navigation (Keyboard)
- [ ] Tab to the tab bar
- [ ] Press Enter on focused tab
- [ ] Press Space on focused tab
- [ ] Press ArrowRight - should move to next tab
- [ ] Press ArrowLeft - should move to previous tab
- [ ] From last tab, ArrowRight should wrap to first
- [ ] From first tab, ArrowLeft should wrap to last

#### 7. ARIA Attributes (DevTools)
- [ ] Open browser DevTools
- [ ] Inspect tab container
- [ ] Verify `role="tablist"` present
- [ ] Verify `aria-label="Profile sections"` present
- [ ] Inspect each tab button
- [ ] Verify `role="tab"` present
- [ ] Verify `aria-selected="true"` on active tab
- [ ] Verify `aria-selected="false"` on inactive tabs
- [ ] Verify `aria-controls` matches panel id
- [ ] Inspect panel
- [ ] Verify `role="tabpanel"` present
- [ ] Verify `id` matches tab's aria-controls
- [ ] Verify `aria-labelledby` matches tab id

#### 8. Touch Targets
- [ ] Use mobile device or responsive mode
- [ ] Tap each tab
- [ ] Verify easy to tap (44px minimum)
- [ ] No mis-taps or difficulty selecting

### Hero Layout Tests

#### 9. IdentityCard Position
- [ ] Check IdentityCard has proper padding
- [ ] Should have 24px left/right padding
- [ ] Compare with Discovery hero padding
- [ ] Verify consistent visual alignment

#### 10. Aurora Background
- [ ] Verify animated background blobs visible
- [ ] Check background doesn't interfere with content
- [ ] Verify backdrop layering correct

### Component Integration Tests

#### 11. DiscoveryRail Integration
- [ ] Check Passport section uses DiscoveryRail
- [ ] Check Wishlist section uses DiscoveryRail
- [ ] Check Settings section uses DiscoveryRail
- [ ] Verify all have proper title prop
- [ ] Verify content renders correctly inside rail

#### 12. PassportGrid Rendering
- [ ] Navigate to Passport tab
- [ ] Verify grid renders correctly
- [ ] Check no double padding issues
- [ ] Verify images display properly
- [ ] Check stamp overlays visible

#### 13. SettingsDeck Rendering
- [ ] Navigate to Settings tab
- [ ] Verify settings panels render
- [ ] Check toggle switches work
- [ ] Verify max-width centering works
- [ ] Check app version displays at bottom

### Cross-Page Consistency Tests

#### 14. Discovery vs Profile Comparison
- [ ] Open Discovery page in one tab
- [ ] Open Profile page in another tab
- [ ] Compare section header typography
- [ ] Compare padding (use DevTools to measure)
- [ ] Compare spacing between sections
- [ ] Compare empty state styling
- [ ] Verify overall visual harmony

### Automated Testing

#### 15. Unit Tests
```bash
npm test src/features/profile/pages/__tests__/Profile.accessibility.test.tsx
```
- [ ] All tests pass
- [ ] ARIA role tests pass
- [ ] Keyboard navigation tests pass
- [ ] Touch target tests pass

#### 16. Type Checking
```bash
npx tsc --noEmit --project tsconfig.json
```
- [ ] No TypeScript errors in Profile.tsx
- [ ] No TypeScript errors in PassportGrid.tsx
- [ ] All imports resolve correctly

#### 17. Linting
```bash
npm run lint
```
- [ ] No ESLint errors
- [ ] No ESLint warnings
- [ ] Code follows project conventions

#### 18. Build Test
```bash
npm run build
```
- [ ] Build completes successfully
- [ ] No build errors
- [ ] No build warnings

### Browser Compatibility Tests

#### 19. Chrome/Edge
- [ ] All features work
- [ ] Animations smooth
- [ ] Keyboard navigation works
- [ ] Touch targets work

#### 20. Safari
- [ ] All features work
- [ ] Animations smooth
- [ ] Keyboard navigation works
- [ ] Touch targets work

#### 21. Firefox
- [ ] All features work
- [ ] Animations smooth
- [ ] Keyboard navigation works
- [ ] Touch targets work

### Mobile Device Tests

#### 22. iOS Safari
- [ ] Touch targets work correctly
- [ ] Haptic feedback works
- [ ] Animations smooth
- [ ] No layout issues

#### 23. Android Chrome
- [ ] Touch targets work correctly
- [ ] Animations smooth
- [ ] No layout issues

### Screen Reader Tests

#### 24. VoiceOver (macOS/iOS)
- [ ] Tab bar announced as "tablist"
- [ ] Tabs announced with selected state
- [ ] Panel content accessible
- [ ] Navigation makes sense

#### 25. NVDA (Windows)
- [ ] Tab bar announced correctly
- [ ] Selected state announced
- [ ] Panel content accessible

## Performance Checks

#### 26. Animation Performance
- [ ] Tab transitions smooth (no jank)
- [ ] Scroll performance good
- [ ] No layout thrashing
- [ ] 60fps maintained

#### 27. Memory Usage
- [ ] No memory leaks on tab switching
- [ ] Component cleanup proper
- [ ] Event listeners cleaned up

## Regression Tests

#### 28. Existing Functionality
- [ ] Sign out still works
- [ ] Navigation to other pages works
- [ ] FloatingNav still works
- [ ] Profile data loads correctly

#### 29. IdentityCard Features
- [ ] 3D tilt effect works
- [ ] Holographic sheen animates
- [ ] Avatar displays correctly
- [ ] Stats display correctly

#### 30. PassportGrid Features
- [ ] Past events display
- [ ] Stamp overlays render
- [ ] Image loading works
- [ ] Grid layout correct

## Documentation Checks

#### 31. Code Comments
- [ ] Updated comments reflect new structure
- [ ] DiscoveryRail usage documented
- [ ] Accessibility features documented

#### 32. Implementation Docs
- [ ] PROFILE_DISCOVERY_ALIGNMENT.md complete
- [ ] VISUAL_COMPARISON.md accurate
- [ ] All code examples correct

## Final Sign-Off

- [ ] All visual consistency tests pass
- [ ] All accessibility tests pass
- [ ] All automated tests pass
- [ ] All browser compatibility tests pass
- [ ] All mobile device tests pass
- [ ] Performance is acceptable
- [ ] No regressions found
- [ ] Documentation is complete

## Issues Found

Record any issues discovered during testing:

1. _[Issue description]_
   - Expected: _[What should happen]_
   - Actual: _[What actually happened]_
   - Severity: _[Critical/High/Medium/Low]_
   - Fix: _[How to fix]_

---

**Tested by:** _______________
**Date:** _______________
**Environment:** _______________
**Build Version:** _______________
