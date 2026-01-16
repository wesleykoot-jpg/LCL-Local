import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Action Color
        action: {
          DEFAULT: "hsl(var(--action))",
          foreground: "hsl(var(--action-foreground))",
        },
        surface: {
          base: "hsl(var(--surface-base))",
          elevated: "hsl(var(--surface-elevated))",
          overlay: "hsl(var(--surface-overlay))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "1.75rem",
      },
      // 2026 Apple-Inspired Shadow System
      boxShadow: {
        "card": "0 2px 12px rgba(0, 0, 0, 0.04)",
        "card-hover": "0 8px 24px rgba(0, 0, 0, 0.08)",
        "card-elevated": "0 4px 20px rgba(0, 0, 0, 0.06)",
        "float": "0 8px 32px rgba(0, 0, 0, 0.12)",
        "nav": "0 4px 24px rgba(0, 0, 0, 0.25)",
        "glass": "0 4px 24px rgba(0, 0, 0, 0.06)",
        "up-sheet": "0 -8px 32px rgba(0, 0, 0, 0.12)",
        // Apple 2026 shadow utilities
        "apple-sm": "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        "apple-md": "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        "apple-lg": "0 4px 16px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.08)",
        "apple-xl": "0 8px 24px rgba(0,0,0,0.08), 0 24px 64px rgba(0,0,0,0.12)",
      },
      // 2026 Backdrop Blur System
      backdropBlur: {
        xs: "2px",
        "3xl": "64px",
        "4xl": "80px",
      },
      // Touch Target Spacing
      spacing: {
        "11": "2.75rem",
        "13": "3.25rem", 
        "15": "3.75rem",
      },
      // Touch Target Min Sizes (Apple HIG compliant)
      minHeight: {
        "touch": "44px",
        "touch-lg": "48px",
        "touch-xl": "56px",
      },
      minWidth: {
        "touch": "44px",
        "touch-lg": "48px",
        "touch-xl": "56px",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        // IO26 Liquid Glass keyframes
        "liquid-pulse": {
          "0%, 100%": {
            opacity: "0.8",
            transform: "scale(1)",
          },
          "50%": {
            opacity: "1",
            transform: "scale(1.02)",
          },
        },
        "proximity-glow": {
          "0%": {
            boxShadow: "0 0 0 0 rgba(var(--primary), 0.4)",
          },
          "100%": {
            boxShadow: "0 0 12px 4px rgba(var(--primary), 0.6)",
          },
        },
        "refraction-glide": {
          "0%": {
            backgroundPosition: "0% 50%",
          },
          "50%": {
            backgroundPosition: "100% 50%",
          },
          "100%": {
            backgroundPosition: "0% 50%",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // IO26 Liquid Glass animations
        "liquid-pulse": "liquid-pulse 8s ease-in-out infinite",
        "proximity-glow": "proximity-glow 2s ease-in-out alternate infinite",
        "refraction-glide": "refraction-glide 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
