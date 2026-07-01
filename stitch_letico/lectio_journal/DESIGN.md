# Design System: The Tactile Pause

## 1. Overview & Creative North Star
The North Star for this design system is **"The Tactile Pause."** 

Most digital tools are designed for speed, urgency, and dopamine loops. This system is designed for the opposite: the deliberate slow-down of a physical bullet journal. We are moving away from the "app-like" rigidity of standard Material or Human Interface guidelines toward a **High-End Editorial** experience. 

This design system breaks the template through **Intentional Asymmetry**. We utilize a bento-grid foundation but interrupt it with "breathing" white space—areas where the UI intentionally does nothing, allowing the user's thoughts to take center stage. The layout should feel like a well-curated gallery: balanced but never perfectly symmetrical.

## 2. Colors & Chromatic Harmony
Our palette is rooted in organic, earthy tones that mimic physical materials—linen, paper, and moss.

- **Background & Surface:** We use `#faf9f6` (`surface`) as our canvas. It is warmer than pure white, reducing eye strain and feeling more like premium stationary.
- **Primary & Accent:** The `primary` soft olive (#4d614f) provides a grounded, botanical feel, while the `tertiary` muted blue (#4b5f6a) acts as a "cool" counterpoint for secondary actions.

### The "No-Line" Rule
To achieve a high-end, seamless feel, **1px solid borders are strictly prohibited** for sectioning. Structural boundaries must be defined through:
1.  **Background Color Shifts:** Use `surface-container-low` for large content areas sitting on a `surface` background.
2.  **Tonal Transitions:** Use `surface-container-highest` for small callouts.
3.  **Spatial Separation:** Utilize the `8` (2.75rem) or `10` (3.5rem) spacing tokens to let elements exist in their own "orbit."

### Surface Hierarchy & Nesting
Think of the UI as a series of stacked sheets of fine vellum. 
- **The Base:** `surface` (#faf9f6).
- **The Section:** `surface-container-low` (#f4f3f0).
- **The Interactive Card:** `surface-container-lowest` (#ffffff).
- **Floating UI (Navigation/Modals):** Use "Glassmorphism" by applying `surface` at 85% opacity with a `20px` backdrop blur. This allows the soft olive and sand tones to bleed through the UI, making the app feel like a single, cohesive ecosystem.

## 3. Typography: The Editorial Voice
Our typography is designed to be whispered, not shouted. 

- **The lowercase Philosophy:** All `headline`, `title`, and `label` styles should be rendered in lowercase. This removes the "authority" of the UI and makes the app feel like a personal, private space for the user.
- **Display & Headlines:** We use **Manrope** for `display-lg` through `headline-sm`. Its organic curves provide a "signature" feel that standard system fonts lack. 
- **Body & Utility:** We use **Inter** for all `body` and `label` styles. To maintain the "light" feel, never exceed a `regular` (400) weight. 

**Hierarchy Tip:** Use extreme scale contrast. A `display-md` headline (lowercase) paired with a `body-sm` label creates a sophisticated, editorial look that feels custom-designed.

## 4. Elevation & Depth
Depth is conveyed through **Tonal Layering** rather than shadows. We want the UI to feel "flush" and tactile, like an embossed journal.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container` background to create a "lift" of only a few millimeters.
- **Ambient Shadows:** Shadows should only be used on floating elements (e.s., FABs or floating nav). Use the `on-surface` color (#1b1c1a) at **4% opacity** with a blur value of `32px` or higher. It should look like a soft glow of light, not a drop shadow.
- **The "Ghost Border" Fallback:** In high-density areas where color shifts aren't enough, use the `outline-variant` token at **15% opacity**. It should be felt rather than seen.

## 5. Components

### Cards (The Bento Unit)
- **Geometry:** Use `xl` (1.5rem/24px) for outer containers and `lg` (1rem/16px) for nested internal elements.
- **Layout:** Use the bento-grid approach. Mix widths (e.g., one card at 66% width, one at 33%) to create visual interest.
- **Constraint:** No dividers. Use `3` (1rem) spacing to separate content within the card.

### Buttons (The Soft Action)
- **Primary:** `primary` (#4d614f) background with `on-primary` (#ffffff) text. Use `full` rounding (pill-shape).
- **Secondary:** `secondary-container` (#e8ded3) with `on-secondary-container` (#686259) text.
- **Signature Touch:** Use a subtle linear gradient from `primary` to `primary_container` for the main CTA to add "soul" and depth.

### Input Fields (The Personal Entry)
- **Style:** Underline only, using `outline-variant` at 20% opacity. 
- **Typography:** Placeholder text should use `body-lg` in lowercase, colored with `on-surface-variant`.
- **Interaction:** On focus, the underline transitions to `primary` olive with a 2px thickness.

### Lists
- **Structure:** Remove all horizontal lines. 
- **Separation:** Use a `surface-container-low` background on every second item, or simply use `2.5` (0.85rem) of vertical padding to create distinction through "nothingness."

## 6. Do's and Don'ts

### Do:
- **Embrace Lowercase:** Use it for everything except proper nouns and the start of long-form body paragraphs.
- **Generous Margins:** Always use at least `5` (1.7rem) for horizontal screen margins.
- **Thin-Line Icons:** Use 1px or 1.5px stroke weights to match the light typography.
- **Tonal Depth:** Always check if a background color change can replace a border.

### Don't:
- **No Bold/Heavy Weights:** Never use `bold` or `black` weights; they disrupt the "quiet" atmosphere.
- **No Pure Black:** Use `on-surface` (#1b1c1a) for text to keep the contrast soft.
- **No Gamification:** Avoid badges, pulsing animations, or high-saturation "alert" colors. 
- **No Standard Grids:** Avoid perfectly symmetrical 2x2 grids. Try a 1x2 or a staggered bento layout to keep the eye moving.