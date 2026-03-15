# Color & Contrast Reference

## Color Format
- **Use OKLCH** — equal steps in lightness *look* equal (HSL does not)
- Tint neutrals with subtle brand hue (chroma 0.01–0.02 creates cohesion without being obvious)
- 60-30-10 rule: 60% dominant neutral, 30% secondary, 10% accent

## Palettes
- Primary: brand action color (CTAs, active states)
- Neutral: tinted with brand hue — never pure grey
- Semantic: success (green), error (red), warning (amber), info (blue)
- Surface: layered depths (background → card → elevated)

## Contrast Requirements (WCAG AA)
- Body text: **4.5:1** minimum
- Large text (18pt+ or 14pt bold): **3:1** minimum
- UI components and focus indicators: **3:1** minimum
- Placeholder text still requires 4.5:1 — not exempt
- Check with WebAIM Contrast Checker or DevTools vision deficiency emulation

## Dark Mode (JobHub uses dark)
- Not inverted light mode — different depth strategy
- Lighter surface layers create depth (slate-950 → slate-900 → slate-800)
- Desaturated accents — fully saturated colours feel harsh on dark backgrounds
- Shadows are nearly invisible — use borders and subtle background shifts instead

## Anti-patterns
- Pure `#000000` or `#ffffff` backgrounds
- Cyan-to-purple gradients (AI slop signature)
- Neon accent colours on dark backgrounds
- Using colour as the only differentiator (accessibility failure)
