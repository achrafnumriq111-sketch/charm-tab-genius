---
name: Auros theme tokens
description: Global Auros (abyssal observatory) dark teal theme — palette, gradients, surfaces, fonts, radius
type: design
---
Global theme is **Auros — abyssal observatory** (dark teal trading-terminal aesthetic). Replaces the previous 3D luxury pastel/glassmorphism.

## Surfaces (HSL, depth via tonal contrast — NEVER drop shadows)
- `--background` abyss `#012624` (177 94% 8%)
- `--card` trench `#011d1c` (178 93% 6%)
- `--secondary`/`--primary` reef `#003734` (176 100% 11%)

## Text
- `--foreground` snow `#ffffff`
- `--muted-foreground` fog veil `#bbc7c6` (178 9% 76%)
- `--accent` aurora cyan `#cbfffc`

## Rationed accents
- Lilac `#fde9ff` ONLY as border tint / hover whisper, never as fill.
- Mint dot `#00827c` 6px circle prefixes eyebrow labels.
- Gradients live in `bg-gradient-current` (teal→cyan, primary CTA only) and `bg-gradient-aurora` (cyan→white→lavender, ghost button borders only).

## Typography
- Font: **Inter** (Matter substitute), loaded via Google Fonts in `src/index.css`.
- Weights: 400 default, 500 for emphasized labels/CTAs. Never 600+.
- Tailwind sizes: `text-eyebrow` (10px, tracking 0.24em, uppercase), `text-caption`, `text-heading-sm/heading/heading-lg/display`.
- Headings use tight negative letter-spacing (-0.02 to -0.04em).

## Radius
- `--radius: 0.5rem` (8px) global. Cards use 16px via `.card-auros`. Buttons/inputs 6px.

## Component utilities (in `src/index.css` @layer components)
- `.btn-current` — primary teal→cyan CTA
- `.btn-ghost-aurora` — ghost button with gradient border
- `.eyebrow-dot` — mint dot + uppercase tracked label
- `.card-auros` — trench surface, 16px radius, no shadow
- `.glass` redefined to render as trench (backwards-compat for older code)

## Don'ts
- No drop shadows on cards/buttons.
- No saturated bright colors as fills.
- No 600+ font weights.
- No visible borders on cards over the abyss canvas.
