
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { T, TabBar } from './ui/HardwareControls';

// ─── Documentation content ────────────────────────────────────────────────────
// Written with the actual history behind each technique — most of these
// effects are decades (sometimes a century-plus) older than the software
// reproducing them, and knowing why they look the way they do is what makes
// them usable rather than just "a slider that does a thing."

interface DocEntry { title: string; body: string; }
interface DocSection { heading: string; entries: DocEntry[]; }

const DOCS: DocSection[] = [
  {
    heading: 'Dithering',
    entries: [
      {
        title: 'Bayer (Ordered Dither)',
        body: `Named for Bryce Bayer's 1973 paper at Kodak on optimal thresholding for two-level image reproduction — the same engineer who, a few years later, invented the color filter array that still sits on top of nearly every digital camera sensor. The technique places a fixed repeating threshold matrix over the image; each pixel is compared against its matrix value rather than a flat cutoff, which is what produces the crosshatch/checkerboard texture instead of harsh banding. It was the workhorse of 1-bit and 4-bit display eras — early Mac and Amiga graphics, dot-matrix printers — for the same reason it's useful here: it's fast, deterministic, and the pattern itself becomes part of the image's character. Matrix size controls how fine that repeating tile is; 2×2 gives you the blocky, almost pixel-art coarseness, 16×16 approaches photographic smoothness.`,
      },
      {
        title: 'Floyd–Steinberg & Atkinson',
        body: `Error diffusion, not ordered thresholding — a genuinely different family of algorithm. Floyd–Steinberg (1976, Robert Floyd and Louis Steinberg) quantizes a pixel, then pushes the rounding error into its neighbours, so mistakes get corrected by the surrounding pixels rather than repeating in a grid. The result reads as organic noise rather than pattern, and it's still the default dithering algorithm inside most image-quantization software today. Atkinson dithering is the Mac-specific variant — Bill Atkinson wrote it for MacPaint on the original 1984 Macintosh, and deliberately propagated only 6/8 of the error instead of the full amount. That "incomplete" diffusion is why Atkinson dither looks lighter and more open than Floyd–Steinberg at the same settings — it was a stylistic choice as much as a technical one, and it's the reason early Mac black-and-white graphics have that distinctive high-contrast, airy look.`,
      },
      {
        title: 'Duotone Dither',
        body: `Takes either dithering family and maps the quantised tone through two ink colors instead of black and white. This is exactly how halftone screen printing has worked industrially for over a century: you never actually print "grey," you print varying densities of one or two flat colors and let the eye blend them at a distance. Levels controls how many discrete density steps sit between your two colors — at 2 you get a classic hard duotone; push it higher for a richer, more photographic gradient while still only ever using two flat inks.`,
      },
      {
        title: 'ASCII Dither',
        body: `The oldest form of "computer art" in this list by a wide margin. Line printers in the 1960s and 70s couldn't print anything but characters, so density ramps of text glyphs became the only way to represent a photographic image on paper — light-to-dark mapped to sparse-to-dense characters. That constraint outlived the hardware: ASCII art became a defining visual language of BBS and demoscene culture through the 80s and 90s, and it's had a steady resurgence in glitch and generative art since. Duotone-off renders each character in its own sampled source color (closer to modern colour-ASCII/BBS art); Duotone-on renders flat ink-on-paper, closer to the original terminal aesthetic.`,
      },
    ],
  },
  {
    heading: 'Print & Reproduction',
    entries: [
      {
        title: 'Halftone — Dot, Line, Crosshatch',
        body: `Halftone printing is the single technique that made photographic reproduction in mass media possible — Frederic Ives and Stephen Horgan's breakthrough in the 1880s let newspapers and books print photographs using nothing but ink dots of varying size. Dot pattern is the classic newspaper-plate look. Line screen goes back further still, echoing copper and steel engraving traditions that predate photography entirely — tonal variation created by the spacing and weight of parallel lines rather than dots. Crosshatch overlays two line screens at 90° — the same cross-hatching technique an etcher or engraver would use by hand to build up shadow density, now automated at any angle. Duotone mode flattens the photo to two flat inks entirely — a background color plus a dot-color, with no original photo color left showing through — the poster/screen-print look rather than a tinted photograph.`,
      },
      {
        title: 'CMYK Separation',
        body: `The actual production technique behind essentially all mass-printed color material for the last seventy-plus years. An image is split into four ink plates — cyan, magenta, yellow and black — each printed as its own halftone screen. The angles here (cyan 15°, magenta 75°, yellow 0°, black 45°) aren't arbitrary or decorative: real offset presses stagger each plate's screen angle specifically to prevent moiré interference between the four overlapping dot grids. It's a solved engineering problem from decades of print production, and the resulting visible dot structure — usually invisible at normal reading distance on a real press — becomes the whole point when you deliberately expose it at this scale.`,
      },
      {
        title: 'Riso Print',
        body: `The Risograph, built by Riso Kagaku Corporation in Japan starting in the 1980s, was designed as a cheap, fast stencil duplicator for schools and offices — not an art tool. It became one anyway. Riso printing runs each ink color through the machine as a separate pass, and the master stencil never registers with pixel-perfect precision — the slight offset between passes, the visible grain of the ink deposit, the limited palette of vivid spot-color inks, all of it is mechanical imperfection that the zine and independent-print scene adopted as an aesthetic in its own right, specifically in contrast to the flawless precision of CMYK offset. Misregistration and Grain here are simulating exactly that imperfection on purpose.`,
      },
      {
        title: 'Silkscreen',
        body: `Flat spot-ink printing is the language of the great 1970s movie posters — think Dirty Harry — as well as vintage book plates and comics: tight printing budgets meant every poster was an exercise in reduction, an entire scene rebuilt from a paper ground, two or three ink colors, and a black "key" plate carrying the silhouettes and linework. HeroKit's version works the same way: each pixel is assigned to the nearest of your chosen inks, anything darker than the Key plate threshold prints solid black, and Stipple breaks tonal boundaries into speckle — the way sparse ink coverage actually behaves at the edge of a screen-printed region, and the same reason those old posters feel hand-made instead of computed.`,
      },
      {
        title: 'Postcard',
        body: `Two eras of the same trick. Linen postcards of the 1930s-50s — the "Greetings from…" golden age — were printed on embossed, cloth-textured card stock with wildly idealized color: skies bluer, sunsets hotter, everything more saturated than life, with the weave of the linen visible across every inch. Forty years later, 90s videogame artists were solving the same problem from the other direction — faking rich color from a hardware-limited palette using ordered dithering. Postcard runs both: a saturation-and-warmth push toward that idealized-America palette, per-channel color quantization, and an ordered texture whose Texture control sweeps the result from fine linen weave to chunky VGA-era dither. Same mechanics, decades apart.`,
      },
    ],
  },
  {
    heading: 'Color & Tone',
    entries: [
      {
        title: 'Split Tone',
        body: `A darkroom technique before it was a slider — photographers have been split-toning silver gelatin prints with selenium and sepia chemistry for most of the 20th century, applying different tones to a print's shadows versus its highlights during processing. Digital color grading inherited the idea wholesale; the "teal and orange" look that dominates contemporary film and photo post-production is, structurally, exactly this — cool shadows, warm highlights, pushed hard.`,
      },
      {
        title: 'Color Grade Presets',
        body: `Several of these presets reference specific analog processes rather than generic filters. Cross-Process replicates deliberately developing slide film in negative chemistry (or vice versa) — a 1990s alternative-photography technique that produces unpredictable, heavily shifted colors, prized specifically because you couldn't fully control it. Kodachrome nods to the film stock, discontinued in 2009, whose saturated warmth defined most of the 20th century's color photography. VHS leans into consumer analog video's actual signal limitations — chroma bleed, contrast crush — as a texture rather than a flaw.`,
      },
      {
        title: 'Chromatic Aberration / RGB Shift',
        body: `A real optical defect before it was a stylistic choice: different wavelengths of light bend at slightly different angles passing through a lens, so red, green and blue focus at slightly different points and you get color fringing at high-contrast edges. Cheap or vintage lenses show it badly; expensive ones are ground specifically to minimise it. Deliberately exaggerating it here draws equally on that lens-defect history and on the more recent glitch-art tradition of pushing RGB channels apart as a purely digital signal-corruption effect.`,
      },
    ],
  },
  {
    heading: 'Distortion & Glitch',
    entries: [
      {
        title: 'Pixel Sort',
        body: `Unlike almost everything else on this list, pixel sorting has no analog precedent — it's a native digital art form, and a fairly recent one. Artist Kim Asendorf popularized the technique around 2010: sort a row or column of pixels by brightness, hue or saturation instead of leaving them in raster order, and the image streaks and melts along that axis. It became one of the defining techniques of 2010s glitch art specifically because it could only ever have existed as code — there's no darkroom or print-press equivalent.`,
      },
      {
        title: 'Displacement Warp',
        body: `Displacement mapping is a much older idea from 3D rendering and VFX — using one image's values to physically push and pull the pixels of another. Applied to a flat 2D image it produces the same liquify, melt and swirl distortions a compositor would reach for, but it's also a legitimate texture-mapping technique going back decades in offline rendering, repurposed here as a direct, real-time 2D effect.`,
      },
      {
        title: 'Dispersion',
        body: `The particle-disintegration look popularized by mobile photo-editing apps in the mid-2010s, itself descended from much older dust and smoke dissolve transitions used in film editing long before compositing software existed. The direction and spread controls are standing in for what used to require an actual particle simulation.`,
      },
      {
        title: 'Image Glitch — Digital, Corrupt, Signal',
        body: `Datamoshing and glitch art as a deliberate practice — corrupting a file's compression data on purpose — has been a recognised art movement since the 2000s, with artists like Rosa Menkman writing about "glitch aesthetics" as a way of exposing the usually-invisible machinery of digital compression. Signal style leans instead on analog broadcast and VHS signal degradation — a slightly different lineage (hardware failure rather than file corruption) that happens to land in a similar visual place.`,
      },
    ],
  },
  {
    heading: 'Blur & Optics',
    entries: [
      {
        title: 'Motion Blur',
        body: `Long-exposure photography's oldest side effect — anything moving during a slow shutter speed streaks across the frame. It's been a deliberate creative tool since at least the Futurists' photography experiments in the early 1900s, well before it became a standard post-production effect.`,
      },
      {
        title: 'Spot Blur',
        body: `Mimics the shallow depth of field a large-aperture lens produces optically — the subject sharp, everything else falling into soft bokeh. Selective/spot blur in software has been standard practice since portrait photographers first started faking a wider aperture than they actually shot with.`,
      },
      {
        title: 'Edge Glow / Neon',
        body: `Built on Sobel edge detection — a 1968 computer vision technique from Irwin Sobel, still one of the most widely used edge-finding algorithms in image processing — repurposed decoratively rather than analytically. The neon treatment on top of those detected edges borrows its visual language from synthwave and vaporwave's revival of 1980s neon signage.`,
      },
    ],
  },
  {
    heading: 'Selective Editing',
    entries: [
      {
        title: 'Effect Mask',
        body: `Long before Photoshop had layer masks, print production artists cut selective masks by hand from rubylith — a thin red or orange acetate film that blocks UV light but lets a technician see through it to trace an image underneath. A specific area would be cut and peeled away, exposing only that region to the next photographic or printing step. Digital layer masking (introduced properly in Photoshop 3 in 1994) replaced the X-Acto knife with a paintbrush, but the underlying idea is identical: restrict an operation to a hand-defined region, non-destructively, so you can always repaint or undo it. Effect Mask here restricts your entire active effect stack — every toggle you've enabled above — to whatever you paint, with a feathered edge instead of rubylith's hard-cut line.`,
      },
    ],
  },
];

// ─── Changelog ─────────────────────────────────────────────────────────────────

interface ChangeEntry { version: string; date: string; items: string[]; }

const CHANGELOG: ChangeEntry[] = [
  {
    version: '3.7', date: '16 Jul 2026',
    items: [
      'Added: the Dice — a shuffle button beside the canvas that rolls a random, tasteful effect stack from the full effects rack. A genuine discovery mechanic for effects you might never have tried, not just a fixed set of looks. A big rotating die shows over the canvas while the new stack computes, so it\'s obvious something\'s happening',
    ],
  },
  {
    version: '3.6', date: '16 Jul 2026',
    items: [
      'Added: Unsplash as a third image source, alongside Curated and Pexels — searchable from both the Source panel and the Layer 2/3 picker, with a persistent photographer credit shown under the thumbnail for as long as that photo is in use',
    ],
  },
  {
    version: '3.5', date: '16 Jul 2026',
    items: [
      'Added: flip horizontal/vertical for the primary image and each of Layer 2/3, independently',
      'Added: free rotation for Layer 2/3 — drag the handle above the layer to spin it to any angle (hold Shift to snap to 15° steps, double-click to reset)',
      'Added: resize handles on all four corners of a layer\'s box, not just the bottom-right — resize from whichever corner is convenient',
      'Added: an eye icon on Layer 2/3 to actually hide the layer from the render (and export) without deleting it — separate from expanding/collapsing the card, which is now a plain caret',
      'Improved: layer delete is now a trash icon instead of an X, so it reads unambiguously as destructive',
      'Improved: the Source panel now shows a large thumbnail of the loaded image/video with hover Change/Clear, instead of a dropzone that kept saying "Drop or click to upload" even after you\'d already loaded one',
      'Added: hovering a gallery or Pexels thumbnail now shows a large, un-cropped preview beside the sidebar — much easier to judge a shot before picking it than the tiny cropped squares alone',
    ],
  },
  {
    version: '3.4', date: '15 Jul 2026',
    items: [
      'Added: reposition and resize Layer 2/3 directly on the canvas — click "Move / Resize" on a layer, drag it into place, drag the corner handle to resize (locked to the image\'s own aspect ratio). Previously every layer was locked to full-bleed cover with no way to tuck a second image alongside the primary one',
      'Added: cut out a layer — click "Cut Out / Erase" and paint the part of a layer you want to keep (a subject on a busy background, say); everything else is removed cleanly, with no hard box edge. Toggle to "Paint to Remove" for the inverse',
      'Improved: the paint pad (Effect Mask and layer cut-out alike) — a centered expand icon instead of a small corner button, no more instruction text competing with the description below, and a zoomed magnifier loupe that follows the brush while actively painting in the expanded view, for tracing fine subject edges precisely',
    ],
  },
  {
    version: '3.3', date: '13 Jul 2026',
    items: [
      'Added: dark/light text toggle in Preview in Context — ink-colored type for light backgrounds (pale Silkscreen paper, bright Postcard skies) where white type was unreadable',
      'Added: drop your own logo into the preview nav — click the logo slot to upload a PNG/SVG, hover to remove. Persists across sessions, so the preview always opens as your brand',
      'Added: the preview now switches to a real mobile hero layout automatically when the canvas is narrow (9:16 and similar) — compact nav, stacked type, full-width CTAs — instead of cramming the desktop layout into a phone-shaped frame',
      'Added: remove optional preview elements — hover the brand label, eyebrow, subhead, any button or the nav CTA and click its ✕ to take it out of the mock entirely; the layout collapses the space. Only the headline is permanent. The toolbar reset brings everything back',
    ],
  },
  {
    version: '3.2', date: '13 Jul 2026',
    items: [
      'Added: Postcard effect — oversaturated limited-palette color with a fine ordered texture. Sweep the Texture control from vintage linen travel postcard to 90s videogame dither: same mechanics, decades apart',
    ],
  },
  {
    version: '3.1', date: '13 Jul 2026',
    items: [
      'Added: Silkscreen effect — flat spot-ink posterization with a paper ground, three pickable inks, a black key plate for silhouettes and linework, and stipple noise at tonal boundaries. The 70s-movie-poster / book-plate / comic look',
      'Added: editable copy in Preview in Context — click the brand name, headline, sub-copy or any button label and type your own, straight onto the preview. Enter commits, Escape reverts, custom copy follows you across layouts and sessions, and a reset control in the preview toolbar restores the sample text',
    ],
  },
  {
    version: '3.0', date: '12 Jul 2026',
    items: [
      'Added: the HeroKit landing page — a proper front door at herokit.app introducing the tool: gallery of example outputs with full-size lightbox, the effects rack, workflow tour, Preview-in-Context and ratio-selector features, testimonials and the maker\'s plate. The app itself now lives at herokit.app/?app (shared Look links still jump straight into the tool)',
    ],
  },
  {
    version: '2.9', date: '3 Jul 2026',
    items: [
      'Hidden: the AI "Generate" background source (Replicate/Flux) — parked until it has a rate limit or paywall in front of it, since it\'s the first feature with a real per-use cost. Code kept intact behind the Source panel\'s upload/generate toggle',
    ],
  },
  {
    version: '2.8', date: '2 Jul 2026',
    items: [
      'Added: Duotone mode for Halftone — flattens the photo to a background color plus a dot-ink color instead of multiply-blending one ink over the photo, for a flat two-color screen-print/poster look rather than a tinted photograph',
    ],
  },
  {
    version: '2.7', date: '2 Jul 2026',
    items: [
      'Hidden: share link on Looks — links were still too long for platforms like X to accept even after the diff-from-default fix. Will return backed by a proper short-link service',
    ],
  },
  {
    version: '2.6', date: '2 Jul 2026',
    items: [
      'Fixed: Looks share links were often too large for X and other platforms to accept — every field in BackgroundState (150+ now) was being embedded regardless of whether it differed from default. Saved Looks and share links now only include fields that actually differ from default, typically shrinking a link by an order of magnitude. Applies retroactively to Looks saved before this fix, too',
    ],
  },
  {
    version: '2.5', date: '2 Jul 2026',
    items: [
      'Effect Mask\'s Brush size and Feather values are now editable LCD-style fields (click to type an exact number), matching every other numeric readout in the app — were previously plain, non-editable text',
    ],
  },
  {
    version: '2.4', date: '2 Jul 2026',
    items: [
      'Added Effect Mask — paint a region to restrict every active effect to just that area, with a feathered edge; everywhere else stays as the original image',
      'Effect Mask supports Invert (restrict effects to everywhere except what you paint), adjustable brush size and feather, and a live paint overlay',
      'Effect Mask gained an expand view for precision painting on a larger canvas, with its own brush/feather/invert controls',
      'Effect Mask\'s paint hint now fades on hover instead of sitting over the image while you work',
      'Effect Mask now shows a live brush-size cursor while painting instead of a generic crosshair',
      'Fixed: Effect Mask lag while painting — the effect pipeline was re-running on every single mouse-move; it now only recomputes once painting settles, with a "Processing…" indicator during that window',
      'Increased Effect Mask\'s paint-preview opacity — was reading as too faint, especially in the expanded view',
      'Fixed: Halftone didn\'t respect Effect Mask — it was rendered as a separate overlay layer entirely outside the main effect pipeline. Rewired as a proper pipeline effect, so it\'s now maskable like everything else (and reacts correctly to Color Grade and other effects stacked before it, which it previously ignored)',
      'Fixed: Nav logo and CTA in Preview in Context now align with the headline\'s own inset, resolving an overlap with the app\'s fixed Eye/Fullscreen buttons',
    ],
  },
  {
    version: '2.3', date: '2 Jul 2026',
    items: [
      'Preview in Context gained a headline font toggle (Sans / Playfair Display serif) to better match a given design',
      'Fixed: the Guide modal was rendering inside the sidebar\'s compositor layer instead of over the full viewport — it\'s now portalled to escape that and sits centred over the whole app, and is wider',
      'Fixed: Save button and Look-name input height mismatch in the Looks modal',
      'Swapped the hamburger menu icon for an info icon — a hamburger implies navigation, this opens an About/Guide modal',
      'Increased spacing between the sidebar header and the first section label',
      'Fixed: Mask fades revealed the empty-canvas backdrop color (light, from the theme redesign) with no way to change it — Mask now has its own dedicated color, defaulting dark, with a contextual swatch that only appears when a mask is active',
    ],
  },
  {
    version: '2.2', date: '2 Jul 2026',
    items: [
      'Fixed: Looks silently failing to persist on the live site — layer images were never stripped before writing to localStorage, exhausting the origin\'s storage quota',
      'LooksPanel restyled to match the light hardware UI throughout, with a visible error message and one-click "Clear History" if storage ever fills up again',
      'Layer 2/3 upload dropzones now match the primary Source dropzone styling, with an expandable image grid',
      'Added in-app Guide — Effects documentation, Changelog and About',
    ],
  },
  {
    version: '2.1', date: '2 Jul 2026',
    items: [
      'Added Riso Print — dual-plate duotone with misregistration and grain',
      'Added CMYK Separation — four-plate halftone at classic press screen angles, rewritten from Canvas2D draw calls to direct pixel rasterisation for performance',
      'Halftone gained Line and Crosshatch pattern modes with adjustable screen angle',
      'Bayer dithering matrix size is now adjustable (2×2 – 16×16), with dot size properly decoupled from matrix size',
    ],
  },
  {
    version: '2.0', date: '2 Jul 2026',
    items: [
      'Full UI redesign — Dieter Rams / Braun / Teenage Engineering-inspired hardware aesthetic, light theme',
      'New control system: tactile knobs, sliding-pill toggles and segments, raised pattern-grid buttons, LCD-style editable value displays',
      'Added Duotone Dither and ASCII Dither',
      'Canvas area restyled to match the light sidebar',
    ],
  },
  {
    version: '1.3', date: '28 Jun 2026',
    items: [
      'Interface clean-up — simplified preset copy, removed emojis from preset names',
      'Hid the Copy PNG button while the Figma plugin export path is finalised',
    ],
  },
  {
    version: '1.2', date: '26 Jun 2026',
    items: [
      'Added Presets, Edge Glow and Split Tone',
      'Shipped the Figma plugin',
    ],
  },
  {
    version: '1.1', date: '25 Jun 2026',
    items: [
      'Image layer compositing — up to 2 layers with 6 blend modes',
      'Layer UX improvements — Gallery/Pexels picker, collapse, Export moved up',
      'Simplified to image-only mode while the Effects and Video Export pipelines matured',
    ],
  },
  {
    version: '1.0', date: '24 Jun 2026',
    items: [
      'HeroKit launches — a hero background generator for Figma & Framer',
      'HeroKit logomark, sidebar header and adaptive favicon',
      'Canvas-based dithering — Bayer, Floyd–Steinberg, Atkinson',
      'MP4/WebM video export via MediaRecorder, with resolution multiplier and speed control',
      'Smart video export — direct download vs re-record depending on whether effects are active',
    ],
  },
];

// ─── Panel ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  initialTab?: 'about' | 'docs' | 'changelog';
}

const DocsPanel: React.FC<Props> = ({ onClose, initialTab = 'about' }) => {
  const [tab, setTab] = useState<'about' | 'docs' | 'changelog'>(initialTab);

  // Rendered via a portal directly into document.body — RightPanel sits inside
  // a `transform: translateZ(0)` wrapper (a compositor-layer optimisation for
  // the sidebar's width animation), and any CSS transform on an ancestor
  // creates a new containing block for `position: fixed` descendants. Without
  // the portal this modal would be trapped inside that 310px sidebar box
  // instead of centering over the full viewport.
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="control-panel rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)' }}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 rounded-sm" style={{
              width: 22, height: 13,
              background: 'repeating-linear-gradient(-45deg, rgba(26,25,23,0.28) 0, rgba(26,25,23,0.28) 1.5px, transparent 1.5px, transparent 5.5px)',
            }} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: T.text }}>Guide</span>
          </div>
          <button onClick={onClose} className="transition-colors" style={{ color: T.muted }}
            onMouseEnter={e => (e.currentTarget.style.color = T.text)}
            onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
            <i className="ph ph-x text-lg" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-6 py-3 border-b shrink-0" style={{ borderColor: T.border }}>
          <TabBar
            options={[
              { id: 'about', label: 'About' },
              { id: 'docs', label: 'Effects Guide' },
              { id: 'changelog', label: 'Changelog' },
            ]}
            value={tab}
            onChange={v => setTab(v as 'about' | 'docs' | 'changelog')}
          />
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5" style={{ scrollbarWidth: 'none' }}>

          {tab === 'about' && (
            <div className="space-y-5 max-w-md">
              <div className="flex items-center gap-3">
                <img src="/herokit_logomark_dark.png" alt="" className="w-9 h-9 object-contain" />
                <div>
                  <p className="text-[15px] font-bold" style={{ color: T.text }}>HeroKit</p>
                  <p className="text-[10px] font-medium" style={{ color: T.accent }}>ヒーロー</p>
                </div>
              </div>
              <p className="text-[12.5px] leading-relaxed" style={{ color: T.muted }}>
                A free Hero background generator for designers who want premium, print-inspired
                imagery without hopping between different tools. Pro-grade effects. Zero fluff.
                Create something truly original.
              </p>
              <p className="text-[12.5px] leading-relaxed" style={{ color: T.muted }}>
                Built and maintained independently by Marc Andrew. If you build something with
                it, or just want to say hello, find me on X.
              </p>
              <a
                href="https://x.com/mrcndrw"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[12px] font-semibold transition-all"
                style={{ borderColor: T.border, color: T.text, background: T.panel }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = T.text)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
              >
                <i className="ph ph-x-logo text-sm" />
                @mrcndrw
              </a>
            </div>
          )}

          {tab === 'docs' && (
            <div className="space-y-6">
              {DOCS.map(section => (
                <div key={section.heading}>
                  <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-2.5" style={{ color: T.accent }}>
                    {section.heading}
                  </p>
                  <div className="space-y-4">
                    {section.entries.map(entry => (
                      <div key={entry.title}>
                        <p className="text-[13px] font-bold mb-1" style={{ color: T.text }}>{entry.title}</p>
                        <p className="text-[11.5px] leading-relaxed" style={{ color: T.muted }}>{entry.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'changelog' && (
            <div className="space-y-5">
              {CHANGELOG.map(entry => (
                <div key={entry.version}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded"
                      style={{ background: T.text, color: T.bg }}>v{entry.version}</span>
                    <span className="text-[10px] font-medium" style={{ color: T.dim }}>{entry.date}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {entry.items.map((item, i) => (
                      <li key={i} className="text-[11.5px] leading-relaxed flex gap-2" style={{ color: T.muted }}>
                        <span style={{ color: T.border }}>—</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DocsPanel;
