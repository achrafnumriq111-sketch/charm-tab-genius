import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

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
        // Auros palette — abyssal observatory
        abyss: "hsl(var(--auros-abyss))",
        trench: "hsl(var(--auros-trench))",
        reef: "hsl(var(--auros-reef))",
        fog: "hsl(var(--auros-fog))",
        ice: "hsl(var(--auros-ice))",
        snow: "hsl(var(--auros-snow))",
        lilac: "hsl(var(--auros-lilac))",
        teal: "hsl(var(--auros-teal))",
        cyan: "hsl(var(--auros-cyan))",
        // Legacy aliases (kept so older components don't break)
        bubblegum: "hsl(var(--auros-trench))",
        lavender: "hsl(var(--auros-lilac))",
        skyglass: "hsl(var(--auros-cyan))",
        ink: "hsl(var(--auros-snow))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "16px",
        "2xl": "16px",
        "3xl": "24px",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", ...fontFamily.sans],
        matter: ["Inter", "ui-sans-serif", "system-ui", ...fontFamily.sans],
      },
      fontSize: {
        eyebrow: ["10px", { lineHeight: "1.4", letterSpacing: "0.24em" }],
        caption: ["12px", { lineHeight: "1.4", letterSpacing: "0.12em" }],
        "body-auros": ["14px", { lineHeight: "1.5", letterSpacing: "0.055em" }],
        subheading: ["20px", { lineHeight: "1.4" }],
        "heading-sm": ["24px", { lineHeight: "1.4", letterSpacing: "-0.012em" }],
        heading: ["36px", { lineHeight: "1.3", letterSpacing: "-0.013em" }],
        "heading-lg": ["61px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        display: ["96px", { lineHeight: "1", letterSpacing: "-0.04em" }],
        "display-xl": ["295px", { lineHeight: "1", letterSpacing: "-0.046em" }],
      },
      boxShadow: {
        // No drop shadows in Auros — depth comes from tonal contrast.
        // Kept as soft glows for hero accents only.
        glow: "0 24px 80px hsl(var(--auros-teal) / 0.22)",
        "glow-strong": "0 32px 120px hsl(var(--auros-teal) / 0.32)",
      },
      backgroundImage: {
        "gradient-current": "linear-gradient(90deg, #00827c 0%, #cbfffc 100%)",
        "gradient-aurora": "linear-gradient(90deg, #cbfffc 0%, #edfffe 26%, #fffdfa 48%, #fad1ff 89%)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
