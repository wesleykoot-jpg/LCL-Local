# iOS Mobile UX Checklist ✅

**Print this and put it on your wall!**

---

## 🎯 BEFORE YOU COMMIT - CHECK THESE 5 RULES

### 1. ❌ NO HOVER ON MOBILE
```
❌ hover:bg-blue    (Won't work on touch!)
✅ active:bg-blue   (Works on touch!)
✅ active:bg-blue md:hover:bg-blue   (Best: both!)
```

**Quick Test**: Can you see visual feedback when you tap? If no → FIX IT

---

### 2. 👆 TOUCH TARGETS = 44px MINIMUM
```
❌ <button className="p-1"><Icon size={16} /></button>
✅ <button className="min-w-touch min-h-touch"><Icon /></button>
```

**Quick Test**: Can you tap it with your thumb without precision? If no → MAKE IT BIGGER

---

### 3. 📝 INPUT FONT = 16px MINIMUM
```
❌ <input className="text-sm" />   (Will zoom!)
✅ <input className="text-base" />  (No zoom!)
```

**Quick Test**: Does tapping the input zoom the screen? If yes → USE text-base

---

### 4. 📱 SAFE AREAS FOR NOTCH & HOME BAR
```
❌ <header className="fixed top-0">
✅ <header className="fixed top-0 pt-safe">

❌ <nav className="fixed bottom-0">
✅ <nav className="fixed bottom-0 pb-safe">
```

**Quick Test**: On iPhone 14 Pro, is content hidden by notch? If yes → ADD SAFE AREA

---

### 5. ✨ REMOVE TAP HIGHLIGHT
```
❌ (nothing) - Gray flash appears
✅ * { -webkit-tap-highlight-color: transparent; }
```

**Quick Test**: Do you see a gray box when tapping? If yes → ADD TO CSS

---

## 📋 FULL COMPONENT CHECKLIST

### When Creating a Button:
- [ ] Has `active:` state for visual feedback
- [ ] Min size is 44x44px (use `min-w-touch min-h-touch`)
- [ ] Has transition for smooth animation
- [ ] Optional: Add `md:hover:` for desktop
- [ ] Optional: Add haptic feedback

### When Creating an Input:
- [ ] Font size is `text-base` (16px) minimum
- [ ] Has focus states
- [ ] Has proper placeholder
- [ ] Has appropriate `type` attribute
- [ ] Works without auto-zoom

### When Creating a Fixed/Sticky Element:
- [ ] Top elements have `pt-safe`
- [ ] Bottom elements have `pb-safe`
- [ ] Tested on iPhone with notch
- [ ] Works in portrait AND landscape

### When Creating a Scrollable Container:
- [ ] Has `overflow-y-auto`
- [ ] Has `overscroll-none` or `overscroll-y-none`
- [ ] Scrolls smoothly
- [ ] Doesn't rubber-band unexpectedly

---

## 🧪 TESTING CHECKLIST (Every PR)

### Device Testing:
- [ ] Tested on iPhone 14 Pro simulator (notch)
- [ ] Tested on iPhone SE simulator (home button)
- [ ] Tested in portrait mode
- [ ] Tested in landscape mode
- [ ] Tested with one hand (thumb reach)

### Interaction Testing:
- [ ] All buttons give visual feedback when tapped
- [ ] No auto-zoom when tapping inputs
- [ ] No gray flash when tapping elements
- [ ] All interactive elements are easy to tap
- [ ] Content doesn't hide behind notch/home bar

### Edge Case Testing:
- [ ] Works with large text (accessibility setting)
- [ ] Works with VoiceOver enabled
- [ ] Works in dark mode
- [ ] Works in light mode (if implemented)
- [ ] Works with slow network (loading states)

---

## 🔴 RED FLAGS - FIX IMMEDIATELY

| You See This | Fix It Like This |
|--------------|------------------|
| `hover:` without `active:` | Add `active:` before `hover:` |
| Button smaller than thumb | Add `min-w-touch min-h-touch` |
| Input has `text-sm` | Change to `text-base` |
| Fixed header, no safe area | Add `pt-safe` |
| Fixed nav, no safe area | Add `pb-safe` |
| Gray flash when tapping | Add tap highlight CSS |
| Hover scale on mobile | Replace with `whileTap={{ scale: 0.95 }}` |

---

## 💚 GREEN FLAGS - GOOD JOB!

| You See This | Status |
|--------------|--------|
| `active:scale-95 transition-all` | ✅ Perfect! |
| `min-w-[48px] min-h-[48px]` | ✅ Excellent! |
| `text-base` on inputs | ✅ Great! |
| `pt-safe` on top, `pb-safe` on bottom | ✅ Nailed it! |
| `whileTap={{ scale: 0.95 }}` | ✅ Native feel! |
| Haptic feedback on action | ✅ iOS pro! |

---

## 🎨 COPY-PASTE PATTERNS

### Standard Button
```tsx
<motion.button
  whileTap={{ scale: 0.95 }}
  className="min-w-touch min-h-touch px-6 py-3 bg-white text-zinc-900 rounded-xl active:bg-zinc-100 transition-all md:hover:bg-zinc-50"
  onClick={handleAction}
>
  Button Text
</motion.button>
```

### Icon-Only Button
```tsx
<button className="min-w-touch min-h-touch flex items-center justify-center rounded-full active:bg-white/10 active:scale-95 transition-all md:hover:bg-white/5">
  <Icon size={20} />
</button>
```

### Text Input
```tsx
<input
  type="email"
  className="w-full text-base bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
  placeholder="your@email.com"
/>
```

### Fixed Header
```tsx
<header className="sticky top-0 pt-safe bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 z-40">
  {/* content */}
</header>
```

### Fixed Navigation
```tsx
<nav className="fixed bottom-0 left-0 right-0 pb-safe flex items-center justify-around bg-zinc-900/90 backdrop-blur-xl border-t border-white/10">
  {/* nav items */}
</nav>
```

---

## 📊 QUICK REFERENCE TABLE

| Element Type | Min Size | Font Size | Feedback | Safe Area |
|--------------|----------|-----------|----------|-----------|
| Button | 44x44px | Any | active: | - |
| Icon Button | 44x44px | - | active: | - |
| Input | - | 16px | focus: | - |
| Top Nav | - | - | - | pt-safe |
| Bottom Nav | - | - | - | pb-safe |
| Link | 44px tall | Any | active: | - |
| Filter Pill | 44px tall | Any | active: | - |

---

## 🎯 THE GOLDEN RULES

1. **Mobile First**: Design for touch, enhance for mouse
2. **Thumb Friendly**: 44px minimum, 48px comfortable
3. **No Zoom**: 16px minimum font on inputs
4. **Safe Areas**: Notch and home bar are real
5. **Visual Feedback**: Every tap should feel responsive

---

## 🏆 SUCCESS = NATIVE FEEL

### Your app should feel like:
- ✅ Apple's own apps
- ✅ Instagram
- ✅ Twitter
- ✅ WhatsApp

### Not like:
- ❌ A website in a browser
- ❌ An Android app
- ❌ A desktop app on mobile

---

## 🤔 WHEN IN DOUBT, ASK:

1. **"Would Apple approve this?"** - If no, fix it
2. **"Can I tap this with my thumb while walking?"** - If no, make it bigger
3. **"Does this feel like a native iOS app?"** - If no, add active states
4. **"Does this work on iPhone 14 Pro?"** - If no, add safe areas
5. **"Can I see what I'm tapping?"** - If no, add visual feedback

---

## 📞 NEED HELP?

Check these docs:
- 📄 `IOS_MOBILE_UX_ANALYSIS.md` - Full analysis
- 📄 `IOS_MOBILE_QUICK_REFERENCE.md` - Detailed guide
- 🍎 [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/ios)

---

## ⚡️ ONE-MINUTE CODE REVIEW

Before committing, search your code for:

```bash
# Find hover without active
grep -r "hover:" src/ | grep -v "active:"

# Find small buttons
grep -r "w-8\|h-8\|w-10\|h-10" src/

# Find small text inputs
grep -r "text-sm\|text-xs" src/ | grep "input"

# Find fixed elements without safe area
grep -r "fixed top\|fixed bottom" src/ | grep -v "safe"
```

If you find any matches → Fix before commit!

---

## 🎓 LEARN BY EXAMPLE

**Good Examples in Codebase:**
- ✅ `FloatingNav.tsx` - Touch targets
- ✅ `EventCard.tsx` - Tap feedback
- ✅ `Input.tsx` - Font sizing

**Study these and replicate the patterns!**

---

## 🚀 YOUR MISSION

Make LCL Local feel **indistinguishable from a native iOS app**.

Every component you touch should:
1. Work great with a thumb
2. Provide instant visual feedback
3. Respect the notch and home bar
4. Feel smooth and responsive
5. Make users say "wow, this is nice!"

---

**Last Updated**: January 11, 2026  
**Version**: 1.0

---

## 🎯 TL;DR - MEMORIZE THESE 5 LINES

```tsx
// 1. Touch targets
className="min-w-touch min-h-touch"

// 2. Tap feedback
className="active:scale-95 active:bg-white/20 transition-all"

// 3. Input font
className="text-base"

// 4. Safe area top
className="pt-safe"

// 5. Safe area bottom
className="pb-safe"
```

**Use these everywhere. Your users will love you.** ❤️

---

**Print this. Post it. Live it.** 🚀
