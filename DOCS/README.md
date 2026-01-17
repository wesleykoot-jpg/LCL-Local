# LCL Design System Documentation

This directory contains the centralized design system documentation for LCL.

## 📍 Quick Access

**Main Design System**: [`DESIGN_SYSTEM_CORE.md`](./DESIGN_SYSTEM_CORE.md)

This is the **single source of truth** for LCL's design system (v4.0 - 2026). All design decisions, component patterns, color tokens, spacing rules, and accessibility guidelines are documented here.

## 🎨 What's Included

- **Vision & Philosophy**: LCL's standalone identity and the 90/10 rule
- **Foundations**: Solid Surface Palette, Shadow-Led Depth Hierarchy, 8pt Grid System
- **Component Standards**: Event cards, navigation pills, buttons, and more
- **Motion & Haptics**: iOS 26 native interactions
- **Implementation Guidelines**: Color usage, shadows, spacing, accessibility
- **Component Patterns**: Code examples and best practices

## 🔄 Future Updates

When you receive updated design system instructions:

1. **Update** [`DESIGN_SYSTEM_CORE.md`](./DESIGN_SYSTEM_CORE.md) with the new specifications
2. **Sync** `tailwind.config.ts` with any new design tokens
3. **Create/Update** component templates in `src/components/`
4. **Document** breaking changes in a migration guide if needed

## 📂 Related Files

| File | Purpose |
|------|---------|
| [`DESIGN_SYSTEM_CORE.md`](./DESIGN_SYSTEM_CORE.md) | Complete design system specification |
| [`../tailwind.config.ts`](../tailwind.config.ts) | Tailwind configuration with design tokens |
| [`../src/components/EventCard.tsx`](../src/components/EventCard.tsx) | Reference implementation of design system |
| [`../DESIGN_SPEC_2.0.json`](../DESIGN_SPEC_2.0.json) | Legacy design spec (deprecated) |

## 🎯 Key Design Tokens

### Colors
- **Brand Action**: `#FF385C` (LCL Radiant Coral)
- **Surface Primary**: `#FFFFFF` (Pure White)
- **Surface Base**: `#F8F9FA` (Cool Gray)
- **Text Primary**: `#09090B` (Zinc 950)

### Shadows
- `shadow-apple-sm`: Subtle elevation
- `shadow-apple-md`: Standard cards
- `shadow-apple-lg`: Elevated UI
- `shadow-apple-xl`: Modal overlays
- `shadow-nav`: Floating navigation

### Spacing
- Base unit: 8px
- Touch target: 48px (`h-touch`)
- Card padding: 16px or 24px
- Section gaps: 24px (`mb-6`)

### Border Radius
- Cards: 24px (`rounded-3xl`)
- Large UI: 32px (`rounded-4xl`)
- Buttons: 16px (`rounded-2xl`)

## 📖 Design Philosophy

LCL Core 2026 follows the **90/10 Rule**:
- **90%** LCL's unique branding (solid surfaces, bespoke colors, structured layouts)
- **10%** iOS 26 System Logic (native motion physics, depth hierarchy, haptics)

### Anti-Clutter Principle
We've removed all "Liquid Glass" transparency. Depth is achieved through **layered shadows** and **tonal shifts**, ensuring maximum legibility (WCAG AA) for our 18–55 age demographic.

## 🚀 Quick Start

To use the design system in a new component:

```tsx
import { motion } from "framer-motion";

// Use solid surfaces with shadow-based depth
<motion.div 
  className="bg-surface-primary rounded-3xl shadow-apple-md"
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
>
  {/* Your content */}
  <button className="h-touch bg-brand-action text-white rounded-2xl">
    Action
  </button>
</motion.div>
```

## 📝 Version History

- **v4.0** (2026-01): Solid Surface Design System - Removed glass morphism, introduced LCL Radiant Coral, Apple 2026 shadows, strict 8pt grid
- **v2.0** (2024): Liquid Glass aesthetic with neon green brand color
- **v1.0**: Initial design system

---

**Need help?** Check the [Architecture docs](../ARCHITECTURE.md) or [AI Context](../AI_CONTEXT.md) for integration patterns.
