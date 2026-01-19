# Social Air 6.0 — "Liquid Solid" Design System

**Design DNA**: Airbnb (Visual Clarity) + iOS 26 (Fluid Motion)

## 1. Executive Summary

LCL-Local is evolving into Social Air 6.0. This update marks a departure from
Apple-standard glassmorphism (transparency/blurs) toward a proprietary "Liquid
Solid" architecture. We are adopting the visual clarity and high-contrast
surfaces of the Airbnb Design Language System, while maintaining the
cutting-edge feel of iOS 26 motion design—where solid, grounded elements move
with elastic, organic momentum.

## 2. Visual Foundation

### A. Color Palette (Indigo & White)

- **Primary (Action Indigo)**: `#6366F1` (Electric Indigo) — The Brand Hero.
- **Background**: `#FFFFFF` (Pure White).
- **Surface (Subtle)**: `#F9FAFB` (Soft Slate) — For secondary background
  sections.
- **Border**: `#E5E7EB` (Solid Neutral Divider) — Replaces all translucent/glass
  borders.
- **Text (Primary)**: `#1A1A1A` (Deep Charcoal) — Maximum legibility.
- **Text (Secondary)**: `#4B5563` (Neutral Gray).

### B. Depth & Elevation

Depth is achieved through Subtle Elevation Shadows, not blurs.

- **Card Shadow**: `0 6px 16px rgba(0,0,0,0.08)`
- **Interactive/Active Shadow**: `0 2px 4px rgba(0,0,0,0.18)`

## 3. Motion DNA (iOS 26 "Liquid Solid")

The UI must feel "alive" through physics-based interactions.

- **Elastic Morphing**: Transitioning between states must use gel-like
  elasticity.
- **Spring Physics**:
  - Stiffness: 350
  - Damping: 25
  - Mass: 0.8
- **Visual Haptics**: On tap-down, cards and buttons scale scale to **0.96**.

## 4. Components

- **Search Bar**: Solid white, 1px neutral border, card shadow. No blur.
- **Navigation**: Solid white. fluidly shrinks on scroll.
- **Badges/Pills**: High contrast solid badges. White text on Indigo when
  active.
- **Cards**: Solid gradient scrims for text over images (Netflix style).
  `bg-gradient-to-t from-black/70 via-black/20 to-transparent`.
