# lectio — component library

**Version:** 1.0  
**Last Updated:** 2026-03-28

---

## overview

Every UI element in Lectio is built from this component library. Components are:
- Token-enforced (no hardcoded values)
- Documented in Storybook
- Accessible (WCAG 2.1 AA)
- Tested for key interaction paths

---

## primitives (ui/)

### Text

The only way to render text in Lectio.

| prop | type | default | description |
|---|---|---|---|
| `variant` | `'display' \| 'heading' \| 'subheading' \| 'body' \| 'verse' \| 'label' \| 'caption'` | `'body'` | Typography scale variant |
| `color` | `'primary' \| 'secondary' \| 'muted' \| 'inverse'` | `'primary'` | Text colour token |
| `as` | keyof JSX.IntrinsicElements | variant default | Semantic HTML element override |
| `lowercase` | boolean | `true` | Applies `text-transform: lowercase` |

**storybook stories:** Display, Heading, Subheading, Body, Verse, Label, Caption, AllVariants, ColorVariations

---

### Button

| prop | type | default | description |
|---|---|---|---|
| `variant` | `'primary' \| 'ghost' \| 'text'` | `'primary'` | Visual variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size preset |
| `fullWidth` | boolean | `false` | Width 100% |
| `disabled` | boolean | `false` | Disabled state (opacity 0.45) |

**primary button** uses a gradient: `linear-gradient(135deg, #4d614f, #657a67)`

**storybook stories:** Primary, Ghost, TextVariant, Sizes, Disabled

---

### ProgressBar

| prop | type | description |
|---|---|---|
| `value` | number (0–100) | Current percentage |
| `label` | string (optional) | Label shown to the right of the bar |
| `height` | `'sm' \| 'md'` | Bar height (3px or 6px) |

**storybook stories:** Empty, Half, Full, WithLabel, Small

---

## reader components (reader/)

### TodayCard

| prop | type | description |
|---|---|---|
| `dayNumber` | number | Current plan day number |
| `label` | string | Passage label e.g. "genesis 12–15" |
| `completionPct` | number | 0–100 for progress bar |
| `onMarkDayComplete` | () => void | Called when button is tapped |
| `isComplete` | boolean | If true, shows success state |

**states:** Initial (button visible), Success (check icon + 100% bar)

---

### ChapterGrid

| prop | type | description |
|---|---|---|
| `chapters` | ChapterGridItem[] | Array of chapter data + read state |
| `onTap` | (chapterId: number) => void | Short tap handler |
| `onLongPress` | (chapterId: number) => void | Long press handler |
| `upcomingLabel` | string (optional) | Label for the upcoming reflection card |

**ChapterGridItem:**
```typescript
interface ChapterGridItem {
  id: number;
  number: number;
  readState: 'read' | 'partial' | 'unread' | 'locked';
  isToday?: boolean;
}
```

**Extreme chapter count behaviour:**

| Chapter count | Layout |
|---|---|
| 1 | Single full-width tile spanning all 4 columns. No asymmetry card. |
| 2–3 | Tiles fill left-to-right; asymmetry card not injected. |
| 4–149 | Standard 4-column grid; asymmetry card injected after row 1 if ≥ 1 unread tile exists in row 1. |
| 150 (Psalms) | Standard 4-column grid, 38 rows, continuous vertical scroll — no pagination. |

On viewports narrower than 360px, switch to a 3-column grid rather than shrinking tiles below 44×44px. The `upcomingLabel` prop is only rendered when `chapters.length ≥ 4`.

---

### ChapterTile

| prop | type | description |
|---|---|---|
| `chapterNumber` | number | Display number |
| `readState` | `'read' \| 'partial' \| 'unread' \| 'locked'` | Visual state |
| `onTap` | () => void | Short tap callback |
| `onLongPress` | () => void | Long press (≥600ms) callback |

**interaction rules:**
- Short tap (mousedown → mouseup in < 600ms): calls `onTap`
- Long press (mousedown held ≥ 600ms): calls `onLongPress`, cancels tap
- `user-select: none`, `touch-action: manipulation` prevents text selection
- On hover: hint label "hold to select verses" fades in (opacity 0 → 1)
- On tap: `transform: scale(0.94)` feedback

---

### OpenInJWButton

| prop | type | description |
|---|---|---|
| `book` | string | USFM code e.g. "GEN" |
| `chapter` | number | Chapter number |
| `label` | string | Display text e.g. "genesis 12" |

Constructs the jw.org deep-link and opens it in an external browser tab. Link is built via `lib/jwLink.ts`.

**URL format:** `https://www.jw.org/finder?wtlocale=E&bible={BB}{CCC}&pub=nwt` where `{BB}` = `book.sort_order` zero-padded to 2 digits and `{CCC}` = chapter number zero-padded to 3 digits. For verse-level links (continue reading): append `{VVV}` = verse number zero-padded to 3 digits. The pattern must live in a single constant in `jwLink.ts` — never constructed inline in this component. Verified example: Genesis 1 → `01001`.

---

### ContinuePill

| prop | type | description |
|---|---|---|
| `position` | ContinuePosition \| null | Where to continue from |
| `onClick` | () => void | Navigate to position |

If `position` is null, the pill reads "you've finished — well done" with muted styling. No celebration animations.

---

## modals (modals/)

### VerseSelectorModal

| prop | type | description |
|---|---|---|
| `isOpen` | boolean | Controls visibility |
| `chapterName` | string | e.g. "genesis 12" |
| `totalVerses` | number | Total verse count for chapter |
| `readVerseIds` | Set\<number\> | Already-read verses (shown as filled dots) |
| `onMarkFull` | () => void | "mark full chapter" tapped |
| `onSaveRange` | (startVerse: number, endVerse: number) => void | "save selected range" tapped |
| `onClose` | () => void | Dismiss modal |

**entry animation:** slide up from bottom (`translateY(100%)` → `translateY(0)`, 280ms ease)  
**overlay:** `rgba(27,28,26,0.25)` + `backdrop-filter: blur(2px)`. Tap overlay to close.  
**verse dots:** 6-column grid. Filled primary = read, lighter primary = selected, surface-container-high = unread.

---

## plan components (plan/)

### PlanDayRow

| prop | type | description |
|---|---|---|
| `dayNumber` | number | Plan day number |
| `label` | string | e.g. "genesis 12" |
| `completionPct` | number | 0–100 |
| `isToday` | boolean | Highlights with today colour |
| `offsetFromToday` | number | Negative = past, 0 = today, positive = future |
| `onClick` | () => void | Navigate to this day's chapter grid |

---

## analytics components (analytics/)

### StatCard

| prop | type | description |
|---|---|---|
| `label` | string | e.g. "completion", "streak" |
| `value` | string | e.g. "32%", "5 days" |

**value typography:** Manrope, 40px, weight 300. Never bold.

---

### ProgressGraph

| prop | type | description |
|---|---|---|
| `data` | Array<{ date: string; count: number }> | 7 data points |

SVG line chart, 100% width, 100px height. Dots at each data point. X-axis: day abbreviations (mon, tue...). Muted line colour (`#4d614f` at 50% opacity).

---

### StatusCard

| prop | type | description |
|---|---|---|
| `aheadBehindVerses` | number \| null | Positive = ahead, negative = behind |
| `daysAheadBehind` | number \| null | Derived label for display |

**language rules:**
- Ahead: "currently X days ahead of your reading intention"
- Behind: "currently X days behind your reading intention" — never "you missed" or "you're late"
- On plan: "you're right on track with your reading intention"
- No plan: show completion % only, no ahead/behind

---

## navigation (providers/)

### BottomNav

Fixed to bottom. Three items: reading, analytics, settings.

| prop | type | description |
|---|---|---|
| `activePath` | `'reading' \| 'analytics' \| 'settings'` | Current active tab |

Active item: `#4d614f`, filled icon variant (Material Symbols `FILL: 1`).  
Inactive: `#9ca3af`, 60% opacity, `FILL: 0`.

---

### TopBar

| prop | type | description |
|---|---|---|
| `activePage` | string | Highlights correct nav link |

Desktop: shows reading, analytics, settings links inline.  
Mobile: shows overflow menu (three-dot).

---

## component file template

```tsx
/**
 * ComponentName.tsx
 *
 * One-line description of what this component does.
 * Any important interaction notes.
 */

import type { CSSProperties } from 'react';

interface ComponentNameProps {
  // props here
}

/**
 * Brief description for JSDoc.
 */
export function ComponentName({ ...props }: ComponentNameProps) {
  return (
    <div style={{ /* tokens only */ }}>
      {/* content */}
    </div>
  );
}
```

---

## version history

| version | date | notes |
|---|---|---|
| 1.0 | 2026-03-28 | Initial draft |
