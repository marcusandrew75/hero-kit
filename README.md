# ⊙ HeroKit

**Hero background generator for Figma & Framer.**

Upload a photo or pick from the gallery, apply stunning visual effects, preview in context, and export a pixel-perfect background ready to drop straight into your design tool.

---

## Features

### Image Effects (canvas pixel-level)
- **Color Grade** — 12 cinematic & vintage presets (Teal & Orange, Golden Hour, Arctic, Noir, Kodachrome, VHS and more)
- **Dispersion** — Sobel edge detection + particle scatter (the "Thanos" effect). Styles: Up / Radial / Chaos
- **Pixel Sort** — luminance / hue / saturation sort in any direction
- **RGB Channel Smear** — R, G, B sorted independently in different directions. Coloured trails radiate from the subject
- **Displacement Warp** — fBm Perlin noise pixel displacement. Styles: Warp / Swirl / Flow
- **Image Glitch** — pixel-level row displacement + RGB split. Styles: Digital / Corrupt / Signal
- **Halftone** — image-brightness-driven dot scatter (canvas-rendered, exports correctly)
- **Spot Blur** — selective focus with up to 4 draggable focus points
- **Motion Blur** — directional (H / V) and zoom burst
- **RGB Shift** — radial chromatic aberration, strongest at corners

### Atmosphere / Shader Effects
- WebGL shaders: **Fluid Mesh**, **Volumetric Fog** (FBM domain warp), **Molten Orb**
- Canvas 2D: **Kinetic Flow** (particle trails), **Generative** (orbital / particles / matrix / fluid-grid / noise-field)
- CSS: **Aurora**, **Shimmer**, **Light Leak**, **Glitch**, **Animated Mesh**, **Glow**, **Fade**

### Overlays & Post-Processing
- Film grain (canvas-based, export-correct)
- Pattern overlays: Grid, Dot, ISO, Scanline, Hex, Waves, Plus
- Vignette, dark overlay, ambient light
- Dithering: Bayer / Noise

### Workflow
- **Gallery** — 46 curated images (Super Visuals by Ahmed Hassan) + Pexels search (millions of photos)
- **Looks** — save named effect stacks, share via URL, export / import JSON, auto-history
- **Preview in context** — Left / Centre / Right hero layout overlay with dim slider
- **Aspect ratio lock** — Free / 16:9 / 4:3 / 1:1 / 9:16 / 21:9 for exact frame matching
- **Export** — PNG / WebP / JPG at 1× / 2× / 4× resolution

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Add your Pexels API key (free at pexels.com/api)
echo "VITE_PEXELS_API_KEY=your_key_here" > .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add environment variable: `VITE_PEXELS_API_KEY` = your Pexels API key
4. Build command: `npm run build` · Output: `dist` · Framework: Vite
5. Deploy

---

## Tech Stack

React 19 · TypeScript · Vite · Tailwind CSS · WebGL · Canvas 2D · html-to-image

---

## Image Credits

**Curated gallery** — [Super Visuals](https://x.com/uihssn) by Ahmed Hassan. The images in `/public/super-visuals-ahmed-hassan/` are © Ahmed Hassan and are **not** covered by the MIT licence. They are included for demonstration purposes only.

**Pexels search** — photos provided by [Pexels](https://www.pexels.com). Each photo remains the property of its respective photographer.

---

## Licence

MIT — see [LICENSE](LICENSE) for details. Image assets excluded (see above).
