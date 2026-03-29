# lectio — design system

**Version:** 1.0  
**North Star:** "The Tactile Pause"  
**Last Updated:** 2026-03-28

---

## 1. philosophy

Most digital tools are built for speed, urgency, and dopamine loops. Lectio is designed for the opposite: the deliberate slow-down of a physical bullet journal. The UI should feel like a well-curated gallery — balanced but never perfectly symmetrical. **Intentional asymmetry** is a feature, not a bug.

Every design decision asks: does this create calm, or does it create anxiety? If it creates anxiety, do not ship it.

---

## 2. colour palette

All colours are defined as CSS custom properties via `buildCssTokenString()` in `packages/types/src/tokens.ts`. **No hardcoded hex values in component files.**

### 2.1 surface hierarchy

Think of the UI as stacked sheets of fine vellum:

| level | token | hex | usage |
|---|---|---|---|
| Base canvas | `--color-bg-page` | `#faf9f6` | Page background, body |
| Section | `--color-bg-surface` | `#f4f3f0` | Cards, today card, settings rows |
| Interactive card | `--color-bg-elevated` | `#ffffff` | Modal, verse selector |
| Floating UI | `#faf9f6` at 85% opacity + 20px blur | — | Nav bar, top bar (glassmorphism) |

### 2.2 primary palette

| role | token | hex | usage |
|---|---|---|---|
| Primary | `--color-primary` | `#4d614f` | Read tiles, CTA buttons, links, icons |
| Primary container | — | `#657a67` | Selected plan option background |
| Primary fixed | — | `#d2e8d1` | Partial tile fill, verse dot (read) |
| On primary | — | `#ffffff` | Text on primary backgrounds |

### 2.3 text colours

| role | token | hex | usage |
|---|---|---|---|
| Primary text | `--color-text-primary` | `#1b1c1a` | All body text, headings |
| Secondary text | `--color-text-secondary` | `#434842` | Labels, captions, meta |
| Muted text | `--color-text-muted` | `#a8a29e` | Disabled, placeholder, timestamps |

**rule: never use pure black (`#000000`).** Use `#1b1c1a` (on-surface) for maximum contrast text.

### 2.4 tertiary (cool accent)

| role | hex | usage |
|---|---|---|
| Tertiary | `#4b5f6a` | Note icons, journal accents, secondary actions |
| Tertiary fixed | `#d1e5f3` | Note card background |

### 2.5 state colours

| state | background | text/icon |
|---|---|---|
| Read chapter tile | `#4d614f` (primary) | `#ffffff` |
| Partial chapter tile | `#f4f3f0` with `rgba(77,97,79,0.15)` fill | `#4d614f` |
| Unread chapter tile | `#ffffff` + `rgba(77,97,79,0.1)` border | `#434842` |
| Success (day complete) | Transition: replace button with check icon + 100% bar | `#4d614f` |

### 2.6 the no-line rule

**1px solid borders are strictly prohibited for sectioning content.**

Structural boundaries must be defined through:
1. Background colour shifts (`surface-container-low` on `surface`)
2. Tonal transitions (`surface-container-highest` for callouts)
3. Spatial separation (use `space-8` or `space-10` tokens)

The only permitted border usage:
- `0.5px solid rgba(195,200,192,0.2)` — the "ghost border" fallback in high-density areas
- `2px solid` — accent border for the selected plan option only

---

## 3. typography

### 3.1 font families

| role | font | token |
|---|---|---|
| Headlines, labels, UI chrome | Manrope | `var(--font-headline)` |
| Body text, verse text | Inter | `var(--font-body)` |

Both fonts loaded from Google Fonts via `next/font/google` in root layout. Variable font axis: `wght 200..800`.

### 3.2 the lowercase philosophy

**All headline, title, and label text is rendered in lowercase.** This removes the "authority" of the UI and makes the app feel like a personal, private space.

- CSS: `text-transform: lowercase` applied via the `<Text>` component
- Exceptions: proper nouns within Bible verse text (verse text is never transformed)
- The `<Text>` component accepts a `lowercase={false}` prop for the rare exception

### 3.3 type scale

| variant | font | size | weight | line-height | usage |
|---|---|---|---|---|---|
| display | Manrope | 2rem (32px) | 600 | 1.25 | Page titles ("lectio") |
| heading | Manrope | 1.5rem (24px) | 600 | 1.25 | Screen headings |
| subheading | Manrope | 1.25rem (20px) | 500 | 1.25 | Chapter labels, card headings |
| body | Inter | 1rem (16px) | 400 | 1.5 | Default prose |
| verse | Inter | 1.125rem (18px) | 400 | 1.75 | Reading comfort, external link label |
| label | Manrope | 0.875rem (14px) | 500 | 1.25 | UI labels, meta, buttons |
| caption | Inter | 0.75rem (12px) | 400 | 1.5 | Timestamps, fine print |

**rule: never exceed weight 500 in UI chrome.** Never use `bold` (700) or `black` (900). They disrupt the quiet atmosphere. The `<Text>` component enforces this.

### 3.4 hierarchy tip

Use extreme scale contrast. A `display` headline (lowercase, 32px, weight 300) paired with a `caption` label (12px, muted) creates the sophisticated editorial look — not multiple bold elements competing for attention.

---

## 4. spacing

Base unit: 4px. All spacing must use tokens.

| token | rem | px |
|---|---|---|
| `--space-1` | 0.25rem | 4px |
| `--space-2` | 0.5rem | 8px |
| `--space-3` | 0.75rem | 12px |
| `--space-4` | 1rem | 16px |
| `--space-5` | 1.25rem | 20px |
| `--space-6` | 1.5rem | 24px |
| `--space-8` | 2rem | 32px |
| `--space-10` | 2.5rem | 40px |
| `--space-12` | 3rem | 48px |
| `--space-16` | 4rem | 64px |

**minimum horizontal screen margin:** `--space-6` (24px). Never less.

---

## 5. border radius

| token | value | usage |
|---|---|---|
| `--radius-sm` | 4px | Tags, small chips, verse dots |
| `--radius-md` | 8px | Inputs, small cards, chapter tiles |
| `--radius-lg` | 12px | Main cards, today card, modals |
| `--radius-xl` | 16px | Today card outer container |
| `--radius-full` | 9999px | Buttons (pill), continue pill, nav pills |

---

## 6. elevation & shadows

Depth is conveyed through **tonal layering**, not shadows.

- **For content:** place a `bg-elevated` (#fff) card on a `bg-surface` (#f4f3f0) background to create a "lift"
- **For floating elements only** (nav bar, continue pill, modal): use `box-shadow: 0 8px 40px rgba(27,28,26,0.08)` — soft glow, not a drop shadow
- Shadows must use `#1b1c1a` (on-surface) at **4–8% opacity** with ≥ 24px blur. Never a hard shadow.

---

## 7. components

### 7.1 text

The only way to render text in Lectio. Enforces font, size, weight, and token-based colour.

```tsx
<Text variant="display">lectio</Text>
<Text variant="label" color="secondary">day 42</Text>
<Text variant="verse" lowercase={false}>In the beginning...</Text>
```

Props: `variant`, `color`, `as`, `lowercase`, `className`, `style`.

### 7.2 button

Three variants. All pill-shaped (radius-full) for primary and secondary. Text variant has no background.

```tsx
<Button variant="primary">mark day 42 complete</Button>
<Button variant="ghost">open in jw.org</Button>
<Button variant="text">cancel</Button>
```

**primary button gradient:** linear-gradient from `#4d614f` to `#657a67`. Adds "soul" without violating the calm aesthetic.

### 7.3 chapter tile

States: `read`, `partial`, `unread`, `locked` (future days, low opacity).

- `read`: filled `#4d614f` background, white chapter number, check icon top-right
- `partial`: `#f4f3f0` background + `rgba(77,97,79,0.15)` bottom-half fill, `#4d614f` number
- `unread`: white background, `rgba(77,97,79,0.1)` border, `#434842` number
- `locked`: `opacity: 0.35`, `cursor: default`

Interaction:
- Short tap (< 600ms): mark full chapter read
- Long press (≥ 600ms): open verse selector modal
- CSS: `user-select: none; touch-action: manipulation` (prevents text selection on long-press)

### 7.4 verse selector modal

Bottom sheet. Appears on long-press of a chapter tile.

- Header: close button (left), title "genesis 12 · verses" (centre), save (right)
- Chapter label + "hold and drag to select a verse range" hint
- Range slider (start–end)
- Verse dot grid (6 columns): read (filled primary), selected (filled primary), unread (surface-container-high)
- Primary action: "mark full chapter" (pill, primary)
- Secondary action: "save selected range" (pill, secondary-container)

### 7.5 today card

- Background: `bg-surface` (#f4f3f0)
- Border radius: `--radius-xl` (16px)
- Contains: day label, passage heading (Manrope 28px weight 300), progress bar, mark-day-complete button
- After mark-day-complete: success state (check icon + "day 42 complete" + 100% bar)

### 7.6 continue pill

Floating. Sticks above bottom nav. Always visible on home screen.

- Background: `#4d614f`
- Text: white, Manrope, lowercase
- Arrow icon: right-aligned
- Shadow: `0 8px 40px rgba(77,97,79,0.25)`

### 7.7 stat card (analytics)

- Background: `rgba(227,226,223,0.35)` — very subtle tonal surface
- No border
- Label: 10px uppercase, `letter-spacing: 0.18em`, muted
- Value: Manrope, 40px, weight 300
- No bold numbers. No colours on the value itself.

### 7.8 navigation bar

Sticky to bottom. Three items: reading, analytics, settings.

- Background: `#faf9f6` at 85% opacity, `backdrop-filter: blur(20px)`
- Active item: `#4d614f`, filled icon variant
- Inactive item: `#9ca3af`, 60% opacity
- No border — floats above content with shadow

### 7.9 top bar

Same glassmorphism treatment as nav bar. Contains logo + nav links (desktop) or overflow menu (mobile).

---

## 8. layout principles

### 8.1 bento grid (chapter grid)

Use asymmetric bento grids. The chapter grid is a 4-column grid but deliberately breaks symmetry with a 2-column "upcoming" card mixed in. Avoid perfectly symmetrical 2×2 grids.

```
[ch 12 ✓] [ch 13 ✓] [ch 14 ~] [ch 15 □]
[upcoming reflection — 2 cols] [ch 16 □] [ch 17 □]
```

**Chapter count extremes — implementation spec:**

Books range from 1 chapter (Obadiah, Philemon, 2 John, 3 John, Jude) to 150 chapters (Psalms). The grid must handle both ends without layout breaks.

| Chapter count | Layout rule |
|---|---|
| 1 chapter | Single full-width tile (spans all 4 columns). No asymmetry card needed — the tile IS the grid. |
| 2–3 chapters | Tiles fill normally from left; no "upcoming" asymmetry card injected (not enough tiles to offset it). |
| 4–11 chapters | Standard 4-column grid; inject asymmetry card after the first full row (after tile 4). |
| 12–149 chapters | Standard 4-column grid with asymmetry card after row 1. Grid scrolls vertically — no pagination. |
| 150 chapters (Psalms) | Standard 4-column grid, 38 rows. No pagination — the grid is a continuous scroll within the page. Tiles are 48×48px minimum; at 4 columns the Psalms grid is ~450px tall which is acceptable. |

**Tile sizing:** Fixed at `min 44×44px` (touch target minimum). On narrow viewports (< 360px), switch to a 3-column grid rather than shrinking tiles below 44px.

**The "upcoming" asymmetry card:** Only injected when the book has ≥ 4 chapters AND at least one tile in the first row is unread. Never injected for single-chapter books. Its label is the plan day label (e.g., "today · day 42") or omitted if the book is not in today's plan range.

### 8.2 quick action cards

2-column grid. Left card: flat bg-surface. Right card: tertiary-fixed tint. Minimum height 120px. Content aligned to bottom.

### 8.3 page max-width

All screens: `max-width: 48rem` (768px), `margin: 0 auto`. On mobile, full width with `padding: 0 var(--space-6)`.

---

## 9. animation

| property | value | usage |
|---|---|---|
| `--duration-fast` | 100ms | Tap feedback |
| `--duration-base` | 200ms | State transitions (tile read) |
| `--duration-slow` | 300ms | Modal enter/exit |
| `--easing-standard` | `cubic-bezier(0.4,0,0.2,1)` | All transitions |

**rules:**
- No bouncing, elastic, or spring animations — they feel playful, not calm
- No pulsing or looping animations — this is not a game
- Scale on active/tap: `transform: scale(0.94)` — feels tactile, not bouncy
- Modal: slides up from bottom (`translateY(100%)` → `translateY(0)`)

---

## 10. do's and don'ts

### do
- Use lowercase for all UI text (headlines, labels, buttons, nav)
- Use Manrope for all UI chrome (labels, buttons, headings)
- Use Inter for all reading text (verse labels, body)
- Define depth through background colour shifts, not borders
- Use tonal layering (surface → surface-container-low → white) for hierarchy
- Use thin (300 wght) Manrope for large display numbers — creates editorial feel
- Keep horizontal margins at minimum 24px

### don't
- Never hardcode a hex value in a component file
- Never use `font-weight: bold`, `700`, or `800` in UI chrome
- Never use pure black (`#000000`) — use `#1b1c1a`
- Never use 1px solid borders for structural separation
- Never add badges, pulsing effects, fire emojis, or streak celebrations
- Never use "you're behind" or "you missed" language anywhere
- Never use a perfectly symmetrical 2×2 grid — always break the pattern
- Never render Bible verse text inline in Lectio — all reading happens in jw.org

---

## 11. accessibility

- All interactive elements: `aria-label` describing the action
- Focus ring: `outline: 2px solid var(--color-primary); outline-offset: 2px` (focus-visible only)
- Colour contrast: all text/background combinations must meet WCAG 2.1 AA (4.5:1 for body, 3:1 for large text)
- Touch targets: minimum 44×44px for all tappable elements
- Long-press: must also be triggerable via keyboard (Alt+Enter or context menu key)
- Screen readers: chapter tile state must be announced ("genesis 12, read" / "genesis 14, partially read")

---

## 12. theming

Three themes, toggled in settings and persisted in localStorage:

| theme | bg-page | bg-surface | primary |
|---|---|---|---|
| light (default) | `#faf9f6` | `#f4f3f0` | `#4d614f` |
| dark | `#1b1c1a` | `#2f312f` | `#b6ccb6` |
| sepia | `#f5f0e8` | `#ede8dc` | `#5c6b3a` |

CSS custom properties are re-defined on `:root[data-theme="dark"]` etc. Components use tokens only — they never need to know which theme is active.

---

## 13. version history

| version | date | notes |
|---|---|---|
| 1.0 | 2026-03-28 | Initial draft, based on stitch_letico reference designs |
