# Visual Comparison: Profile Page Before & After

## Section Headers

### Before
```
┌─────────────────────────────────────┐
│  [px-5 padding]                     │
│  Your Journey (text-2xl font-bold) │
│  Events you've attended...          │
│  [PassportGrid with px-5]           │
└─────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────┐
│  [DiscoveryRail provides px-6]      │
│  Your Journey (text-xl font-bold    │
│                tracking-tight)       │
│  Events you've attended...          │
│  [PassportGrid no extra padding]    │
└─────────────────────────────────────┘
```

## Tab Navigation

### Before
```
┌────────────────────────────────────┐
│ [Passport] [Wishlist] [Settings]   │
│ • Basic buttons                     │
│ • No ARIA attributes               │
│ • No keyboard navigation           │
│ • px-5 padding                     │
└────────────────────────────────────┘
```

### After
```
┌────────────────────────────────────┐
│ [Passport] [Wishlist] [Settings]   │
│ • role="tablist"                   │
│ • aria-selected for active state   │
│ • aria-controls linking            │
│ • Keyboard navigation (← →)        │
│ • min-h-[44px] touch targets       │
│ • px-6 padding                     │
└────────────────────────────────────┘
```

## Component Hierarchy

### Profile Page Structure

```
AuroraBackground (animated background blobs)
└── div.min-h-screen.text-white
    ├── div.relative.pt-24 (Hero Section)
    │   └── IdentityCard (has px-6 py-8 built-in)
    │
    ├── div.sticky (Tab Header)
    │   └── div.px-6
    │       └── div[role="tablist"]
    │           ├── button[role="tab"] Passport
    │           ├── button[role="tab"] Wishlist  
    │           └── button[role="tab"] Settings
    │
    └── div.pb-32.space-y-12 (Content)
        └── AnimatePresence
            ├── motion.div[role="tabpanel"] (Passport)
            │   └── DiscoveryRail title="Your Journey"
            │       ├── p (description)
            │       └── PassportGrid
            │
            ├── motion.div[role="tabpanel"] (Wishlist)
            │   └── DiscoveryRail title="Wishlist"
            │       └── div (empty state)
            │
            └── motion.div[role="tabpanel"] (Settings)
                └── DiscoveryRail title="Settings"
                    ├── SettingsDeck
                    └── div (app version)
```

### DiscoveryRail Internal Structure

```
DiscoveryRail
└── motion.section.overflow-x-hidden
    ├── div.flex.px-6.mb-4 (Header)
    │   ├── h2.text-xl.font-bold.tracking-tight
    │   └── button (See all - optional)
    │
    └── div.px-6.-mx-6 (Content wrapper)
        └── div.px-6
            └── {children}
```

## Padding Analysis

### Before
- Profile sections: `px-5` (20px)
- PassportGrid: additional `px-5` wrapper (total 40px)
- Inconsistent with Discovery's `px-6` (24px)

### After
- All sections: `px-6` via DiscoveryRail (24px)
- PassportGrid: no wrapper (relies on parent padding)
- Consistent with Discovery page pattern

## Typography Comparison

| Element | Before | After | Discovery |
|---------|--------|-------|-----------|
| Section Headers | text-2xl font-bold | text-xl font-bold tracking-tight | text-xl font-bold tracking-tight |
| Tab Labels | font-bold | font-bold min-h-[44px] | N/A (Discovery has no tabs) |
| Body Text | text-sm text-white/60 | text-sm text-white/60 | text-sm text-muted-foreground |
| Empty State Title | text-xl font-bold | text-xl font-bold | text-xl font-bold |

## Accessibility Improvements

### Tab Navigation ARIA Tree

```
div[role="tablist"][aria-label="Profile sections"]
├── button[role="tab"][id="passport-tab"]
│   ├── aria-selected="true" (when active)
│   ├── aria-controls="passport-panel"
│   └── className includes "min-h-[44px]"
│
├── button[role="tab"][id="wishlist-tab"]
│   ├── aria-selected="false"
│   └── aria-controls="wishlist-panel"
│
└── button[role="tab"][id="settings-tab"]
    ├── aria-selected="false"
    └── aria-controls="settings-panel"

motion.div[role="tabpanel"][id="passport-panel"]
└── aria-labelledby="passport-tab"
```

### Keyboard Navigation Flow

```
User on Passport tab
    ├── Press → : Move to Wishlist
    ├── Press ← : Move to Settings (wraps around)
    ├── Press Enter: Activate current tab
    └── Press Space: Activate current tab

User on Wishlist tab
    ├── Press → : Move to Settings
    └── Press ← : Move to Passport

User on Settings tab
    ├── Press → : Move to Passport (wraps around)
    └── Press ← : Move to Wishlist
```

## Touch Target Sizing

### Before
```
Tab buttons:
┌─────────────┐
│   Passport  │ height: implicit from py-3
│             │ (approximately 36-40px)
└─────────────┘
```

### After
```
Tab buttons:
┌─────────────┐
│   Passport  │ min-height: 44px (explicit)
│             │ Meets iOS/Android guidelines
└─────────────┘
```

## Code Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Profile.tsx LOC | 200 | 241 | +41 (accessibility) |
| PassportGrid.tsx LOC | 169 | 166 | -3 (removed wrapper) |
| Duplicated Header Logic | Yes | No | Moved to DiscoveryRail |
| ARIA Attributes | 0 | 10+ | Full accessibility |
| Keyboard Handlers | 0 | 1 | Arrow key navigation |

## Visual Consistency Score

| Aspect | Before | After |
|--------|--------|-------|
| Padding Pattern | ❌ Inconsistent (px-5) | ✅ Consistent (px-6) |
| Section Headers | ❌ Manual styling | ✅ DiscoveryRail |
| Typography | ⚠️ Close (text-2xl) | ✅ Exact (text-xl) |
| Spacing | ⚠️ Manual | ✅ space-y-12 |
| Touch Targets | ⚠️ Implicit | ✅ Explicit 44px |
| Accessibility | ❌ Basic | ✅ Full ARIA |
| Empty States | ✅ Good | ✅ Excellent |
| Overall Score | 3/7 | 7/7 |
