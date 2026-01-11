# iOS Mobile UX - Quick Reference Guide

**For developers making changes to LCL Local**

---

## 🚫 DON'T DO THIS

### ❌ Hover States on Mobile
```tsx
// BAD
<button className="hover:bg-blue-500">Click</button>
<button className="hover:scale-105">Click</button>
```

### ❌ Small Touch Targets
```tsx
// BAD
<button className="p-1">
  <X size={16} />
</button>
```

### ❌ Small Input Font Sizes
```tsx
// BAD
<input className="text-sm" />  // Causes auto-zoom!
<input className="text-xs" />  // Even worse!
```

### ❌ Ignoring Safe Areas
```tsx
// BAD
<div className="fixed top-0">Header</div>
<div className="fixed bottom-0">Nav</div>
```

### ❌ No Visual Feedback
```tsx
// BAD - No feedback when user taps
<button onClick={handleClick}>
  Submit
</button>
```

---

## ✅ DO THIS INSTEAD

### ✅ Active States for Mobile (with Desktop Hover)
```tsx
// GOOD
<button className="active:bg-blue-500 md:hover:bg-blue-500">
  Click
</button>

// BETTER - with scale and transition
<button className="active:scale-95 active:bg-blue-600 transition-all md:hover:bg-blue-500">
  Click
</button>

// BEST - using Framer Motion
<motion.button
  whileTap={{ scale: 0.95 }}
  className="bg-blue-500 active:bg-blue-600"
>
  Click
</motion.button>
```

### ✅ Proper Touch Targets (44x44px minimum)
```tsx
// GOOD
<button className="w-12 h-12 flex items-center justify-center">
  <X size={16} />
</button>

// BETTER - using tailwind config
<button className="min-w-touch min-h-touch flex items-center justify-center">
  <X size={20} />
</button>

// BEST - FloatingNav example (already in codebase!)
<button className="min-w-[48px] min-h-[48px] flex items-center justify-center">
  <Home size={22} />
</button>
```

### ✅ Input Font Sizes (16px minimum)
```tsx
// GOOD
<input className="text-base" />  // 16px - no zoom

// BETTER - explicit
<input className="text-base sm:text-base md:text-base" />

// BEST - with proper styling
<input 
  className="text-base bg-white/5 border border-white/10 rounded-xl py-3 px-4"
  placeholder="your@email.com"
/>
```

### ✅ Safe Area Awareness
```tsx
// GOOD (after adding utilities)
<header className="sticky top-0 pt-safe">
  Header Content
</header>

<nav className="fixed bottom-0 pb-safe">
  Navigation
</nav>

// BETTER - with content padding
<main className="pb-safe-nav">  // Accounts for nav + safe area
  Main Content
</main>
```

### ✅ Visual Feedback Pattern
```tsx
// GOOD
<button className="active:opacity-80 transition-opacity">
  Submit
</button>

// BETTER
<button className="active:scale-95 active:bg-white/20 transition-all">
  Submit
</button>

// BEST - with haptics
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const handlePress = async () => {
  await Haptics.impact({ style: ImpactStyle.Light });
  // your action
};

<motion.button
  whileTap={{ scale: 0.95 }}
  onClick={handlePress}
  className="active:bg-white/20 transition-all"
>
  Submit
</motion.button>
```

---

## 📏 iOS DESIGN CONSTANTS

### Touch Targets
```typescript
const TOUCH_TARGETS = {
  minimum: 44,      // Apple HIG minimum
  comfortable: 48,  // Recommended
  large: 56,        // For primary actions
}
```

### Font Sizes (for inputs)
```typescript
const INPUT_FONT_SIZES = {
  minimum: 16,  // Prevents iOS auto-zoom
  comfortable: 18,
}
```

### Safe Areas
```typescript
// Use these CSS custom properties
const SAFE_AREAS = {
  top: 'env(safe-area-inset-top)',
  bottom: 'env(safe-area-inset-bottom)',
  left: 'env(safe-area-inset-left)',
  right: 'env(safe-area-inset-right)',
}
```

---

## 🎨 COMMON PATTERNS

### Interactive Button
```tsx
<motion.button
  whileTap={{ scale: 0.95 }}
  className="
    min-w-touch min-h-touch
    px-6 py-3
    bg-white text-zinc-900
    rounded-xl
    active:bg-zinc-100
    transition-all
    md:hover:bg-zinc-50
  "
  onClick={handleAction}
>
  Action
</motion.button>
```

### Icon-Only Button
```tsx
<button className="
  min-w-touch min-h-touch
  flex items-center justify-center
  rounded-full
  active:bg-white/10 active:scale-95
  transition-all
  md:hover:bg-white/5
">
  <Icon size={20} />
</button>
```

### Form Input
```tsx
<input
  type="email"
  className="
    w-full
    text-base
    bg-white/5
    border border-white/10
    rounded-xl
    py-3 px-4
    focus:outline-none
    focus:ring-2
    focus:ring-blue-500
  "
  placeholder="your@email.com"
/>
```

### Filter Pill (Category)
```tsx
<button
  className={cn(
    'min-h-[44px] px-4 rounded-full',
    'text-sm font-medium transition-all',
    'border',
    isActive
      ? 'bg-white text-zinc-900 border-white'
      : 'bg-white/5 text-zinc-400 border-white/10 active:border-white/20'
  )}
  onClick={handleToggle}
>
  {label}
</button>
```

### Fixed Navigation with Safe Area
```tsx
<nav className="
  fixed bottom-0 left-0 right-0
  pb-safe
  flex items-center justify-around
  bg-zinc-900/90 backdrop-blur-xl
  border-t border-white/10
">
  {/* nav items */}
</nav>
```

### Header with Safe Area
```tsx
<header className="
  sticky top-0
  pt-safe
  bg-zinc-950/80 backdrop-blur-xl
  border-b border-white/5
  z-40
">
  {/* header content */}
</header>
```

---

## 🧪 TESTING CHECKLIST

When you make changes, test:

- [ ] Tap the element on iPhone simulator - does it give visual feedback?
- [ ] Can you easily tap it without precision aiming? (thumb test)
- [ ] Does tapping an input field cause unwanted zoom?
- [ ] On iPhone 14 Pro simulator, is content visible under the notch?
- [ ] Is the bottom navigation visible above the home indicator?
- [ ] Does the element have the gray tap flash? (should not)
- [ ] Does it work equally well in portrait and landscape?

---

## 🔧 CSS UTILITIES TO ADD

Add these to your Tailwind config or global CSS:

### Safe Area Plugin (tailwind.config.ts)
```typescript
import plugin from 'tailwindcss/plugin'

plugins: [
  plugin(function({ addUtilities }) {
    addUtilities({
      '.pt-safe': {
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
      },
      '.pb-safe': {
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      },
      '.pb-safe-nav': {
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
      },
    })
  })
]
```

### Tap Highlight Removal (index.css)
```css
@layer base {
  * {
    -webkit-tap-highlight-color: transparent;
  }
}
```

### Overscroll Prevention (utility class)
```css
@layer utilities {
  .overscroll-none {
    overscroll-behavior: none;
  }
  .overscroll-y-none {
    overscroll-behavior-y: none;
  }
}
```

---

## 🎯 QUICK DECISION TREE

**"Should I use hover: or active:?"**
- Mobile-first app? → Use `active:` (and optionally `md:hover:`)
- Desktop-only? → Use `hover:`
- Both? → Use `active:` for mobile, add `md:hover:` for desktop

**"How big should this button be?"**
- Icon only? → `min-w-touch min-h-touch` (44x44px)
- Text button? → `min-h-touch` with appropriate padding
- Primary action? → Consider `min-h-touch-lg` (48x48px)

**"What font size for this input?"**
- Is it an input/textarea/select? → `text-base` minimum (16px)
- Just display text? → Any size is fine

**"Where do I add safe area padding?"**
- Fixed/sticky at top? → `pt-safe`
- Fixed/sticky at bottom? → `pb-safe`
- Content that needs space from bottom nav? → `pb-safe-nav`

---

## 📚 EXAMPLES FROM CODEBASE

### ✅ Good Examples (Follow These)

**FloatingNav.tsx** - Touch targets:
```tsx
<button className="min-w-[48px] min-h-[48px] flex items-center justify-center">
```

**EventCard.tsx** - Tap feedback:
```tsx
<motion.div
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
>
```

**Input Component** - Font size:
```tsx
className="...text-base...md:text-sm..."
```

### ⚠️ Needs Improvement

**LoginView.tsx** - Hover instead of active:
```tsx
// Current (needs fix)
className="hover:bg-gray-50 hover:scale-105"

// Should be
className="active:bg-gray-50 active:scale-95 md:hover:bg-gray-50"
```

**Feed.tsx** - Missing safe area:
```tsx
// Current (needs fix)
<header className="sticky top-0 z-40">

// Should be  
<header className="sticky top-0 pt-safe z-40">
```

---

## 💡 PRO TIPS

1. **Test on real devices** - Simulators are good, but real iPhone testing is essential
2. **Use the iPhone 14 Pro simulator** - It has the notch/Dynamic Island
3. **Test with one hand** - Can you reach all buttons with your thumb?
4. **Use VoiceOver** - Ensures accessibility and proper labeling
5. **Check in both orientations** - Portrait AND landscape
6. **Test the extremes** - Smallest iPhone SE and largest Pro Max
7. **Use Safari Web Inspector** - Debug on real device

---

## 🆘 COMMON MISTAKES

### Mistake #1: "But hover works in the iOS simulator!"
**Reality**: The simulator has a cursor (mouse). Real iPhones don't. Always test with touch input.

### Mistake #2: "44px looks too big for my design"
**Reality**: Apple's guideline exists for accessibility. 44px is minimum, 48px is better. Users will thank you.

### Mistake #3: "I'll add safe areas later"
**Reality**: Safe areas should be part of your initial layout. Retrofitting is harder.

### Mistake #4: "Text-sm looks better in my input"
**Reality**: iOS will auto-zoom the input, breaking your layout. Always use text-base (16px) minimum.

### Mistake #5: "The gray flash doesn't bother me"
**Reality**: It screams "web app" not "native app". Remove it with one line of CSS.

---

## 🎓 LEARN MORE

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/ios)
- [Capacitor iOS Best Practices](https://capacitorjs.com/docs/ios)
- [Tailwind CSS Mobile-First](https://tailwindcss.com/docs/responsive-design)
- [Framer Motion Gestures](https://www.framer.com/motion/gestures/)

---

**Keep this guide handy when developing! 🚀**

Last Updated: January 11, 2026
