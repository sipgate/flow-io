# Design Tokens — Flow-IO Carbon + Lime

Alle Tokens sind als Tailwind-Utility-Klassen angegeben und direkt nutzbar.
CSS-Custom-Properties zeigen die exakten OKLCH-Werte für native CSS-Definitionen.

---

## Farbsystem

### Philosophie

Das Flow-IO-Farbsystem hat drei Ebenen:
1. **Brand** — Lime-Grün: steht für Aktion, Erfolg, "Active"
2. **Accent** — Violett: sekundäre Highlights, spezielle Features
3. **Neutral** — Carbon-Skala: alle strukturellen Elemente (Hintergründe, Borders, Text)

**Light Mode ist primär** für den eingeloggten Bereich. Carbon/Dark-Mode für Präferenz und zukünftige Features.

---

### Brand-Farben (Lime)

| Token | Light Tailwind | Dark Tailwind | OKLCH (Light) | OKLCH (Dark) | Verwendung |
|-------|--------------|-------------|--------------|-------------|-----------|
| `brand-50` | `bg-lime-50` | `dark:bg-lime-950` | `oklch(0.98 0.04 140)` | `oklch(0.12 0.04 140)` | Sehr heller Hintergrund |
| `brand-100` | `bg-lime-100` | `dark:bg-lime-900` | `oklch(0.96 0.07 140)` | `oklch(0.16 0.06 140)` | Leichter Hintergrund |
| `brand-200` | `bg-lime-200` | `dark:bg-lime-800` | `oklch(0.92 0.12 140)` | `oklch(0.22 0.09 140)` | Hover-Hintergrund |
| `brand-400` | `bg-lime-400` | `dark:bg-lime-400` | `oklch(0.78 0.22 136)` | `oklch(0.78 0.22 136)` | Dark-Mode-Akzent |
| `brand-500` | `bg-lime-500` | `dark:bg-lime-500` | `oklch(0.68 0.22 136)` | `oklch(0.68 0.22 136)` | Light-Mode Primary |
| `brand-600` | `bg-lime-600` | `dark:bg-lime-600` | `oklch(0.58 0.20 136)` | `oklch(0.58 0.20 136)` | Hover-State |
| `brand-700` | `text-lime-700` | `dark:text-lime-400` | — | — | Text auf hellem BG |

**Verwendungsregeln für Brand:**
- `bg-lime-500` + `text-white` → Primär-Button (Light Mode)
- `bg-lime-400` + `text-black` → Primär-Button (Dark Mode)
- `bg-lime-500/10 text-lime-700` → Status-Badge "Active" (Light)
- `dark:bg-lime-400/10 dark:text-lime-400` → Status-Badge "Active" (Dark)
- Nie für dekorative Flächen verwenden — nur für semantische Aktionen/Status

---

### Accent-Farben (Purple)

| Token | Light Tailwind | Dark Tailwind | Verwendung |
|-------|--------------|-------------|-----------|
| `accent-400` | `text-purple-400` | `dark:text-purple-400` | — |
| `accent-500` | `text-purple-500` | `dark:text-purple-500` | Dark-Mode Akzent |
| `accent-600` | `text-purple-600` | `dark:text-purple-400` | Light-Mode Akzent |
| `accent-bg` | `bg-purple-500/10` | `dark:bg-purple-400/10` | Accent-Hintergrund |

**Verwendungsregeln für Accent:**
- Entry-Point-Badges, besondere Features
- Nie für Status (nur Brand/Lime für "Active")
- Sparsam einsetzen — max. 2-3 Elemente pro Seite

---

### Neutral-Farben (Carbon-Skala)

#### Hintergründe (Light)
```
bg-white          surface-1  (Cards, Panels)
bg-neutral-50     surface-2  (Page-Hintergrund, Alternierende Rows)
bg-neutral-100    surface-3  (Hover, Tooltips, Popovers)
bg-neutral-200    surface-4  (Disabled, Strikethrough)
```

#### Hintergründe (Dark)
```
dark:bg-neutral-950    base       (#090909 — Page Background)
dark:bg-neutral-900    surface-1  (#111111 — Cards)
dark:bg-neutral-800    surface-2  (#1a1a1a — Elevated Cards)
dark:bg-neutral-700    surface-3  (#222222 — Tooltips, Popovers)
```

#### Text
```
text-neutral-950    primary    (Headlines, wichtige Werte)
text-neutral-700    body       (Standard-Fließtext)
text-neutral-500    secondary  (Beschreibungen, Labels)
text-neutral-400    muted      (Placeholder, Captions, Timestamps)

dark:text-neutral-50    primary
dark:text-neutral-300   body
dark:text-neutral-400   secondary
dark:text-neutral-600   muted
```

#### Borders
```
border-neutral-200    subtle   (sehr subtile Trenner)
border-neutral-300    default  (Standard-Card-Border)
border-neutral-400    strong   (Fokus-sichtbar, aber dezent)

dark:border-neutral-800    subtle
dark:border-neutral-700    default
dark:border-neutral-600    strong
```

---

### Semantische Farben

#### Status-Farben
| Status | Hintergrund | Text (Light) | Text (Dark) | Icon |
|--------|------------|-------------|------------|------|
| Active / Success | `bg-lime-500/10` | `text-lime-700` | `dark:text-lime-400` | `text-lime-600` |
| Warning / Pending | `bg-amber-500/10` | `text-amber-700` | `dark:text-amber-400` | `text-amber-500` |
| Error / Danger | `bg-red-500/10` | `text-red-600` | `dark:text-red-400` | `text-red-500` |
| Info / Processing | `bg-blue-500/10` | `text-blue-600` | `dark:text-blue-400` | `text-blue-500` |
| Inactive / Muted | `bg-neutral-100` | `text-neutral-600` | `dark:text-neutral-400` | `text-neutral-400` |

#### Chart-Farben (Recharts)
```
chart-1: oklch(0.68 0.22 136)   Lime    (Brand)
chart-2: oklch(0.56 0.28 295)   Purple  (Accent)
chart-3: oklch(0.62 0.16 240)   Blue    (Info)
chart-4: oklch(0.72 0.16 75)    Amber   (Warning)
chart-5: oklch(0.58 0.22 20)    Coral   (Danger)
```

#### Datenvisualisierung — Icon-Farben
```
text-green-500    activeCalls, live status
text-blue-500     callsToday, volume
text-purple-500   weeklyStats, trends
text-orange-500   avgDuration, performance
text-indigo-500   assistants, AI elements
text-teal-500     phoneNumbers, connectivity
text-amber-500    knowledgeDocs, documents
text-pink-500     variables, data fields
```

---

### Gradient Tokens

```css
/* Brand-Gradient (Lime → Purple) */
background: linear-gradient(135deg,
  oklch(0.68 0.22 136),   /* lime-500 */
  oklch(0.56 0.28 295)    /* purple-600 */
);

/* Soft Brand-Overlay */
background: linear-gradient(135deg,
  oklch(0.68 0.22 136 / 0.08),
  oklch(0.56 0.28 295 / 0.08)
);

/* Surface Gradient */
background: linear-gradient(180deg, #ffffff, #f5f5f5);
dark: linear-gradient(180deg, #111111, #1a1a1a);

/* Hero / Page Header */
background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);
dark: linear-gradient(135deg, #090909 0%, #111111 100%);
```

**Tailwind-Klassen für Brand-Gradient:**
```
bg-gradient-to-br from-lime-500 to-purple-600
```

---

## Typografie

### Font-Familie
```
--font-sans:  var(--font-geist-sans)    # Geist Sans — alle UI-Texte
--font-mono:  var(--font-geist-mono)    # Geist Mono — Code, Metriken, IDs
--font-serif: var(--font-playfair)      # Playfair — Marketing, Quotes (selten)
```

### Typografie-Skala

| Token | px | rem | Weight | Line-Height | Letter-Spacing | Tailwind |
|-------|----|-----|--------|------------|----------------|---------|
| `display-lg` | 48 | 3 | 700 | 1.10 | -0.03em | `text-5xl font-bold tracking-[-0.03em] leading-[1.10]` |
| `display-sm` | 36 | 2.25 | 700 | 1.15 | -0.025em | `text-4xl font-bold tracking-[-0.025em] leading-[1.15]` |
| `heading-xl` | 30 | 1.875 | 700 | 1.20 | -0.02em | `text-3xl font-bold tracking-tight` |
| `heading-lg` | 24 | 1.5 | 600 | 1.25 | -0.015em | `text-2xl font-semibold tracking-tight` |
| `heading-md` | 20 | 1.25 | 600 | 1.30 | -0.01em | `text-xl font-semibold` |
| `heading-sm` | 18 | 1.125 | 600 | 1.35 | -0.005em | `text-lg font-semibold` |
| `body-lg` | 16 | 1 | 400 | 1.60 | 0 | `text-base` |
| `body-md` | 14 | 0.875 | 400 | 1.55 | 0 | `text-sm` |
| `body-sm` | 13 | 0.8125 | 400 | 1.50 | 0.005em | `text-[13px]` |
| `label-lg` | 14 | 0.875 | 500 | 1.40 | 0.01em | `text-sm font-medium` |
| `label-md` | 13 | 0.8125 | 500 | 1.40 | 0.015em | `text-[13px] font-medium` |
| `label-sm` | 12 | 0.75 | 500 | 1.35 | 0.02em | `text-xs font-medium` |
| `caption` | 11 | 0.6875 | 400 | 1.30 | 0.02em | `text-[11px] text-neutral-400` |
| `mono-md` | 13 | 0.8125 | 400 | 1.50 | 0 | `text-[13px] font-mono` |
| `mono-sm` | 12 | 0.75 | 400 | 1.45 | 0 | `text-xs font-mono` |

### Verwendungsregeln

```
Page Title (h1):       heading-xl  →  text-3xl font-bold
Section Header (h2):   heading-lg  →  text-2xl font-semibold
Component Header (h3): heading-md  →  text-xl font-semibold
Card Title:            heading-sm  →  text-lg font-semibold
Body Text:             body-md     →  text-sm
Description/Hint:      body-sm     →  text-[13px] text-neutral-500
Form Label:            label-lg    →  text-sm font-medium
Table Header:          label-sm    →  text-xs font-medium uppercase tracking-wider
Badge Text:            label-sm    →  text-xs font-medium
Metric/Stat Value:     heading-lg  →  text-2xl font-bold (monospace für Zahlen)
Timestamp/Meta:        caption     →  text-[11px] text-neutral-400
Code/ID:               mono-sm     →  text-xs font-mono
```

---

## Spacing

### Basis-System (4px-Raster)

| Token | px | Tailwind | Verwendung |
|-------|----|---------|-----------|
| `space-1` | 4 | `p-1 gap-1 m-1` | Micro-Abstände (Icon-Text) |
| `space-2` | 8 | `p-2 gap-2 m-2` | Enge Komponenten (Badge-Padding) |
| `space-3` | 12 | `p-3 gap-3 m-3` | Kompakte Elemente |
| `space-4` | 16 | `p-4 gap-4 m-4` | Standard-Innenabstand |
| `space-5` | 20 | `p-5 gap-5 m-5` | — |
| `space-6` | 24 | `p-6 gap-6 m-6` | Card-Padding, Section-Gap |
| `space-8` | 32 | `p-8 gap-8 m-8` | Page-Padding, große Gaps |
| `space-10` | 40 | `p-10 gap-10` | — |
| `space-12` | 48 | `p-12 gap-12` | Section-Trenner |
| `space-16` | 64 | `p-16 gap-16` | — |

### Layout-Abstände

```
Page Wrapper:     p-6 lg:p-8
Max-Width:        max-w-7xl mx-auto
Section Gap:      space-y-6
Card Gap (Liste): space-y-4
Card Gap (Grid):  gap-4 lg:gap-6
Form Field Gap:   space-y-2
Form Section Gap: space-y-4
```

---

## Border Radius

| Token | px | Tailwind | Verwendung |
|-------|----|---------|-----------|
| `radius-xs` | 4 | `rounded` | Badges, Tags |
| `radius-sm` | 6 | `rounded-md` | Buttons, Inputs |
| `radius-md` | 8 | `rounded-lg` | Standard-Cards |
| `radius-lg` | 12 | `rounded-xl` | Feature-Cards, Panels |
| `radius-xl` | 16 | `rounded-2xl` | Modal-Cards, Dialogs |
| `radius-2xl` | 20 | `rounded-[20px]` | Hero-Elemente |
| `radius-full` | 9999 | `rounded-full` | Avatare, Chips |

---

## Schatten

| Token | CSS-Wert | Tailwind | Verwendung |
|-------|---------|---------|-----------|
| `shadow-xs` | `0 1px 2px rgb(0 0 0 / 0.04)` | `shadow-xs` | Buttons |
| `shadow-sm` | `0 1px 3px rgb(0 0 0 / 0.08)` | `shadow-sm` | Cards (Light Mode) |
| `shadow-md` | `0 4px 6px rgb(0 0 0 / 0.07)` | `shadow-md` | Elevated Cards |
| `shadow-lg` | `0 10px 15px rgb(0 0 0 / 0.09)` | `shadow-lg` | Modals, Dropdowns |
| `shadow-brand` | `0 4px 16px oklch(0.68 0.22 136 / 0.30)` | — | Brand-Buttons (Hover) |
| `shadow-accent` | `0 4px 16px oklch(0.56 0.28 295 / 0.25)` | — | Accent-Elemente |

**Dark Mode:** Keine Schatten auf Cards — Borders statt Schatten für Tiefe.
```
dark:shadow-none dark:border dark:border-neutral-800
```

---

## Motion

### Easing-Funktionen

| Token | CSS | Verwendung |
|-------|-----|-----------|
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Elemente erscheinen (fade in, slide in) |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Elemente verschwinden |
| `ease-inout` | `cubic-bezier(0.4, 0, 0.2, 1)` | Zustandsänderungen |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bounce-Effekte, Toggles |

### Dauer

| Token | ms | Tailwind | Verwendung |
|-------|----|---------|---------|
| `dur-instant` | 0 | `duration-0` | Fokus-Ringe |
| `dur-fast` | 120 | `duration-[120ms]` | Hover-States, Color-Transitions |
| `dur-base` | 200 | `duration-200` | Standard UI-Transitions |
| `dur-slow` | 350 | `duration-[350ms]` | Page-Transitions, Animationen |

### Standard-Transition-Klassen

```
transition-colors duration-[120ms]            Hover-Farbwechsel
transition-all duration-200 ease-out          Standard-UI
transition-transform duration-200 ease-out    Slide-Animationen
transition-opacity duration-[120ms]           Fade-Effekte
```

---

## Glassmorphism

Nur an semantisch sinnvollen Stellen (Overlays, Sticky-Headers mit Scroll, Tooltips über Inhalten).

```css
/* Light Mode Glass */
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(20px);
border: 1px solid rgba(0, 0, 0, 0.08);

/* Dark Mode Glass */
background: rgba(17, 17, 17, 0.85);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.06);
```

**Tailwind:**
```
bg-white/85 backdrop-blur-xl border border-black/[0.08]
dark:bg-neutral-900/85 dark:border-white/[0.06]
```
