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

**1. Brand & Action (Interaction)**

- **Brand Primary**: `#6366F1` (Electric Indigo) — Active icons, links, primary
  buttons.
- **Brand Secondary**: `#4F46E5` (Indigo-700) — Hover states.

#### Semantic Mappings

| Usage              | Token Class          | Color Value |
| :----------------- | :------------------- | :---------- |
| **Active Icon**    | `text-brand-primary` | Indigo      |
| **Text Link**      | `text-brand-primary` | Indigo      |
| **Primary Button** | `bg-brand-primary`   | Indigo      |
| **Body Text**      | `text-text-primary`  | Black       |
| **Heading**        | `text-text-primary`  | Black       |

**2. Content & Text (Readability)**

- **Text Primary**: `#1A1A1A` (Deep Charcoal) — Headings, body text.
- **Text Secondary**: `#4B5563` (Neutral Gray) — Metadata.
- **Background**: `#FFFFFF` (Pure White).
- **Surface**: `#F9FAFB` (Soft Slate).
- **Border**: `#E5E7EB` (Solid Neutral Divider).

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

## 5. High-Impact Vibrancy (Max Interaction)

For discovery and exploration surfaces, we employ "Max Vibrancy" to create energy and movement. This is reserved for headers and major section landmarks.

### A. Typography Scale

Deeply impactful sections use **Extra Large** typography to anchor the view.

- **Header Token**: `text-3xl` (30px)
- **Weight**: `font-bold`
- **Tracking**: `tight`

### B. Color Saturation & Gradients

We shift from functional neutral colors to high-energy 500-level saturated gradients.

- **Level**: Tailwind `500` (e.g., `indigo-500`, `amber-500`, `rose-500`)
- **Visual Mapping**:
  - **Personalized**: Indigo/Violet (Trust & Magic)
  - **Ritual/Weekly**: Amber/Orange (Warmth & Continuity)
  - **Urgent/Weekend**: Rose/Pink (Excitement & Action)
  - **Location**: Blue/Cyan (Clarity & Freshness)

### C. Thematic Depth (Atmospheric Glow)

Surfaces should feel "atmospheric" through soft color leakage.

- **Backdrop Intensity**: `/15` (15% opacity) matching the theme color.
- **Application**: Applied as a background tint to the rail container to fill the space and add "life" even in empty states.

### D. Enhanced Iconography

Icons accompanying vibrant headers must match the visual weight.

- **Size**: `w-7 h-7`
- **Coloring**: Direct match to the header's primary gradient color.
