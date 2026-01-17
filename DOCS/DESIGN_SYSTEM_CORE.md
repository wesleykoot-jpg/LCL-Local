# LCL CORE 2026: Design System Specification (v4.0)

## 1. Vision & Core Philosophy
* **Standalone Identity**: LCL is a dedicated social planning ecosystem that feels professional, reliable, and warm.
* **The 90/10 Rule**: 90% of the UI is defined by LCL's unique branding (solid surfaces, bespoke color, and structured layouts); 10% is defined by **iOS 26 System Logic** (native motion physics, depth hierarchy, and haptics).
* **Anti-Clutter**: Remove all "Liquid Glass" transparency. Depth is achieved through **layered shadows** and **tonal shifts**, ensuring maximum legibility (WCAG AA) across the 18–55 age demographic.

## 2. Foundations (Global Styles)

### A. Solid Surface Palette
| Token | Role | implementation |
| :--- | :--- | :--- |
| `--brand-action` | Primary Action | **LCL Radiant Coral** (`#FF385C`) for "Join" and "Create" buttons. |
| `--surface-primary` | Main Surface | **Pure White** (`#FFFFFF`) or **Deep Zinc** (`#09090B`) in Dark Mode. |
| `--surface-muted` | Background | **Cool Gray** (`#F8F9FA`) to provide high-contrast separation for white cards. |
| `--text-primary` | High Contrast | **Zinc 950** (`#09090B`) for maximum readability. |

### B. Depth Hierarchy (Shadow-Led)
* **Level 0 (Base)**: Flat background surfaces (`--surface-muted`).
* **Level 1 (Cards)**: `shadow-apple-md` — Used for main feed events.
* **Level 2 (Floating)**: `shadow-nav` — Reserved for the bottom pill navigation.
* **Level 3 (Modal)**: `shadow-apple-xl` — Used for critical overlays.

### C. Spacing & Grid (The 8pt Rule)
* **Base Unit**: 8px.
* **Internal Padding**: 16px (2 units) or 24px (3 units).
* **Section Gaps**: Standardize to **mb-6** (24px) for all feed headers.

## 3. Component Standards

### A. The "Professional Social" Event Card
* **Surface**: Solid white background with a **24px (3xl) radius**.
* **Imagery**: High-impact photography with a **4:3 aspect ratio**.
* **Metadata Area**: Solid footer containing Title (**SF Pro Display**) and Metrics (**SF Pro Text**).
* **Facepile**: Overlapping friend avatars in the bottom-right corner of the image area.

### B. The Floating Bottom Navigation (LCL Pill)
* **Design**: A solid **Zinc 950** (Black) pill shape with **0% transparency**.
* **Compliance**: Each icon represents a **48x48pt** touch target.

## 4. Motion & Haptics (10% iOS 26 Logic)
* **Spring Physics**: All card expansions use **Framer Motion** spring logic (`stiffness: 300`, `damping: 30`).
* **Haptic Mapping**: Light Impact (Selection), Heavy Impact (Commitment), Notification (Success/Error).

## 5. Implementation Guidelines

### Color Usage
- **Primary Action**: Always use `bg-brand-action` for CTAs like "Join Event" or "Create Event"
- **Text Hierarchy**: 
  - Primary text: `text-text-primary` (Zinc 950)
  - Secondary text: `text-text-secondary` (Zinc 600)
  - Muted text: `text-text-muted` (Zinc 500)
- **Surfaces**:
  - Page backgrounds: `bg-surface-base` (Cool Gray #F8F9FA)
  - Card surfaces: `bg-surface-primary` (Pure White)
  - Muted sections: `bg-surface-muted`

### Shadow System
Use the Apple 2026 shadow utilities for consistent depth:
- `shadow-apple-sm`: Subtle elevation (badges, chips)
- `shadow-apple-md`: Standard cards (event cards, content cards)
- `shadow-apple-lg`: Elevated UI (dropdowns, popovers)
- `shadow-apple-xl`: Modal overlays
- `shadow-nav`: Floating navigation elements

### Border Radius
- Cards: `rounded-3xl` (24px)
- Large UI elements: `rounded-4xl` (32px)
- Buttons: `rounded-2xl` (16px)
- Pills: `rounded-full`

### Spacing
Follow the 8pt grid system:
- Component gaps: `gap-4` (16px) or `gap-6` (24px)
- Card padding: `p-4` (16px) or `p-6` (24px)
- Section margins: `mb-6` (24px)
- Touch targets: Minimum `h-touch` (48px) for interactive elements

## 6. Accessibility Standards

### WCAG AA Compliance
- Text contrast ratio minimum: 4.5:1 for normal text
- Large text contrast ratio minimum: 3:1
- Interactive elements: 3:1 contrast against adjacent colors

### Touch Targets
- Minimum: 44x44px (use `min-h-touch` and `min-w-touch`)
- Recommended for primary actions: 48x48px (use `h-touch` and `w-touch`)

### Focus States
- All interactive elements must have visible focus indicators
- Use `ring-2 ring-offset-2 ring-brand-action` for focus states

## 7. Component Patterns

### Event Cards
```tsx
// Standard event card structure
<motion.div className="bg-surface-primary rounded-3xl overflow-hidden shadow-apple-md">
  <div className="relative aspect-[4/3]">
    {/* Image with facepile overlay */}
  </div>
  <div className="p-4 space-y-3">
    {/* Title, metadata, and action button */}
  </div>
</motion.div>
```

### Action Buttons
```tsx
// Primary action button
<button className="w-full h-touch bg-brand-action text-white font-bold rounded-2xl 
  shadow-apple-sm active:opacity-90 transition-all">
  Join Event
</button>
```

### Navigation Pill
```tsx
// Floating bottom navigation
<nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-950 rounded-full 
  shadow-nav px-4 py-2 flex gap-2">
  {/* Navigation items with 48x48px touch targets */}
</nav>
```

## 8. Future Updates

This design system is centralized in `/DOCS/DESIGN_SYSTEM_CORE.md` for easy access and updates. When receiving new design system instructions:

1. Update this document with new specifications
2. Update `tailwind.config.ts` with new tokens if needed
3. Create or update component templates in `src/components/`
4. Document changes in a separate migration guide if breaking changes are introduced

## 9. Related Files

- **Tailwind Configuration**: `tailwind.config.ts` - Contains all design tokens
- **Component Templates**: `src/components/EventCard.tsx` - Reference implementation
- **Legacy Design Spec**: `DESIGN_SPEC_2.0.json` - Previous design system (deprecated)
- **Architecture**: `ARCHITECTURE.md` - System architecture and patterns

## 10. Migration Notes

This v4.0 design system represents a shift from the "Liquid Glass" aesthetic to a solid surface approach:
- **Deprecated**: Glass morphism effects (`backdrop-blur`, transparency overlays)
- **New**: Solid surfaces with shadow-based depth hierarchy
- **Action Color Changed**: From `#B4FF39` (neon green) to `#FF385C` (radiant coral)
- **Typography**: Standardized on system fonts (SF Pro Display/Text on iOS)
- **Motion**: Retained Framer Motion spring physics, removed liquid animations

To migrate existing components:
1. Replace glass effects with solid backgrounds and appropriate shadows
2. Update action colors from green to coral
3. Ensure all touch targets meet 48x48px minimum
4. Apply 8pt grid spacing consistently
