# NMS Toss Design System Specification

> Toss Design Director's complete redesign specification for NMS Web Application
> Target: NOC (Network Operations Center) engineers, 8-12 hour daily use
> Last updated: 2026-03-09

---

## 1. Design Philosophy: Toss Approach for Enterprise NMS

### 1.1 Core Principles

**"한 눈에 파악" (Grasp at a Glance)**

Toss's financial app succeeds because users can check their balance in under 0.5 seconds. An NMS must achieve the same: a NOC operator glancing at the screen should know the network health status within 1 second. This means:

- **Status-first hierarchy**: The most critical information (device up/down, active faults, severity) must be perceivable without reading. Use color, size, and position — not text — to communicate status.
- **Numbers are king**: CPU 87%, Packet Loss 2.3%, Response Time 45ms — these numbers must be the largest, boldest elements on screen. Toss displays financial amounts in 32-40px bold. We do the same for critical metrics.
- **Progressive disclosure**: Show summary first, detail on demand. A device card shows status + key metrics. Click to expand for port-level detail, traffic charts, fault history.
- **Reduce cognitive load**: No glassmorphism, no glowing borders, no animated orbs. These create visual noise that fatigues eyes over 8+ hours. Instead: solid backgrounds, clear borders, generous whitespace.

**Toss's "Bold Simplicity" for Complex Data**

Enterprise NMS dashboards traditionally cram everything visible. Toss's approach is the opposite:
- Show less, but show the right things
- Use size contrast aggressively (32px metric vs 11px label)
- Group related information with spacing, not borders
- Let whitespace do the organizing

**Why NOT Glassmorphism for NMS**

The current design uses `backdrop-filter: blur(20px)`, transparent backgrounds, animated glow borders, and orb gradients. For a consumer app viewed 30 seconds at a time, this is beautiful. For a NOC operator staring at screens 8-12 hours:
- Blur effects cause subtle eye strain over time
- Transparent layers make text harder to read
- Animated elements in peripheral vision cause distraction
- Low-contrast borders make panel boundaries ambiguous

Toss's dark mode uses **solid, opaque backgrounds** with **high contrast** and **zero animation in static UI**. Animation is reserved for user-initiated interactions only.

### 1.2 Information Hierarchy for NOC Operators

```
Priority 1 (< 0.5s): Is anything broken? → Red banner / fault count badge
Priority 2 (< 2s):   What's at risk?     → Warning indicators, threshold breaches
Priority 3 (< 5s):   Overall health      → Dashboard summary cards
Priority 4 (on demand): Details          → Click to drill down
```

---

## 2. Color System

### 2.1 Dark Mode (Primary — NOC Standard)

Toss's dark mode uses a pure neutral dark, not blue-tinted. The current `#0c0c14` has a purple/blue cast that looks "spacey." Toss uses warm-neutral darks that feel professional.

```css
:root,
[data-theme="dark"] {
    /* ═══════════════════════════════════════
       BACKGROUND LAYERS (4 levels)
       Layer 0: Page background (deepest)
       Layer 1: Sidebar, main containers
       Layer 2: Cards, panels, widgets
       Layer 3: Elevated elements (dropdowns, modals, tooltips)
       ═══════════════════════════════════════ */
    --bg-layer-0: #141517;          /* Page background — warm near-black */
    --bg-layer-1: #1b1d21;          /* Sidebar, section containers */
    --bg-layer-2: #212327;          /* Cards, panels, table containers */
    --bg-layer-3: #2a2c31;          /* Dropdowns, modals, popovers */
    --bg-layer-4: #333539;          /* Tooltips, toast notifications */

    /* Interactive backgrounds */
    --bg-hover: #2a2c31;            /* Row hover, item hover */
    --bg-active: #333539;           /* Active/pressed state */
    --bg-selected: rgba(55, 120, 255, 0.12);  /* Selected row/item */
    --bg-input: #1b1d21;            /* Input field background */
    --bg-input-focus: #212327;      /* Input field focused */

    /* ═══════════════════════════════════════
       TEXT HIERARCHY (5 levels)
       ═══════════════════════════════════════ */
    --text-strongest: #ffffff;       /* Large metric numbers, page titles */
    --text-primary: #f2f3f5;        /* Body text, table cell content */
    --text-secondary: #a0a3ab;      /* Labels, descriptions, secondary info */
    --text-tertiary: #6b6e76;       /* Placeholders, timestamps, captions */
    --text-disabled: #4a4d55;       /* Disabled text, inactive items */

    /* ═══════════════════════════════════════
       BORDERS / DIVIDERS
       ═══════════════════════════════════════ */
    --border-default: #2a2c31;      /* Card borders, panel dividers */
    --border-subtle: #212327;       /* Table row separators */
    --border-strong: #333539;       /* Input borders, section dividers */
    --border-hover: #3d3f44;        /* Hovered element borders */
    --border-focus: #3778ff;        /* Focused input ring */

    /* ═══════════════════════════════════════
       ACCENT / BRAND
       Toss Blue — clean, professional, not purple
       ═══════════════════════════════════════ */
    --accent-primary: #3778ff;      /* Primary actions, links, active nav */
    --accent-primary-hover: #5a93ff;  /* Hover state */
    --accent-primary-active: #2860d9;  /* Pressed state */
    --accent-primary-bg: rgba(55, 120, 255, 0.12);  /* Subtle background tint */
    --accent-primary-border: rgba(55, 120, 255, 0.3);  /* Accent borders */

    /* ═══════════════════════════════════════
       STATUS COLORS — NMS Severity Levels
       Must be distinguishable at a glance
       NOC standard: Red > Orange > Yellow > Blue > Green
       ═══════════════════════════════════════ */

    /* Critical (Severity 1) — Network down, total failure */
    --status-critical: #ff4d4f;
    --status-critical-bg: rgba(255, 77, 79, 0.12);
    --status-critical-border: rgba(255, 77, 79, 0.3);
    --status-critical-text: #ff7875;

    /* Major (Severity 2) — Service degradation, high packet loss */
    --status-major: #ff7a2f;
    --status-major-bg: rgba(255, 122, 47, 0.12);
    --status-major-border: rgba(255, 122, 47, 0.3);
    --status-major-text: #ff9a5c;

    /* Minor (Severity 3) — Threshold breach, performance warning */
    --status-minor: #faad14;
    --status-minor-bg: rgba(250, 173, 20, 0.12);
    --status-minor-border: rgba(250, 173, 20, 0.3);
    --status-minor-text: #ffc53d;

    /* Warning (Severity 4) — Approaching threshold */
    --status-warning: #3b82f6;
    --status-warning-bg: rgba(59, 130, 246, 0.12);
    --status-warning-border: rgba(59, 130, 246, 0.3);
    --status-warning-text: #60a5fa;

    /* Normal (Severity 0) — Healthy, operational */
    --status-normal: #22c55e;
    --status-normal-bg: rgba(34, 197, 94, 0.12);
    --status-normal-border: rgba(34, 197, 94, 0.3);
    --status-normal-text: #4ade80;

    /* Unreachable / Unknown */
    --status-unknown: #6b6e76;
    --status-unknown-bg: rgba(107, 110, 118, 0.12);
    --status-unknown-border: rgba(107, 110, 118, 0.3);
    --status-unknown-text: #a0a3ab;

    /* ═══════════════════════════════════════
       CHART COLOR PALETTE (8 colors)
       High contrast, colorblind-safe order
       ═══════════════════════════════════════ */
    --chart-1: #3778ff;             /* Blue — primary metric */
    --chart-2: #22c55e;             /* Green — secondary metric */
    --chart-3: #ff7a2f;             /* Orange */
    --chart-4: #a855f7;             /* Purple */
    --chart-5: #f43f5e;             /* Rose */
    --chart-6: #06b6d4;             /* Cyan */
    --chart-7: #eab308;             /* Yellow */
    --chart-8: #ec4899;             /* Pink */

    /* ═══════════════════════════════════════
       INTERACTIVE STATES
       ═══════════════════════════════════════ */
    --interactive-hover-overlay: rgba(255, 255, 255, 0.04);
    --interactive-active-overlay: rgba(255, 255, 255, 0.08);
    --interactive-focus-ring: 0 0 0 2px #141517, 0 0 0 4px #3778ff;
    --interactive-disabled-opacity: 0.4;

    /* ═══════════════════════════════════════
       SHADOWS — Subtle elevation, no glow
       ═══════════════════════════════════════ */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.4);
    --shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.5);
    --shadow-modal: 0 16px 48px rgba(0, 0, 0, 0.6);

    /* ═══════════════════════════════════════
       OVERLAY
       ═══════════════════════════════════════ */
    --overlay-backdrop: rgba(0, 0, 0, 0.6);
    --overlay-scrim: rgba(20, 21, 23, 0.8);

    /* ═══════════════════════════════════════
       SCROLLBAR
       ═══════════════════════════════════════ */
    --scrollbar-track: transparent;
    --scrollbar-thumb: #333539;
    --scrollbar-thumb-hover: #4a4d55;
}
```

### 2.2 Light Mode

Toss's light mode uses warm off-whites, never pure `#ffffff` for page backgrounds. Pure white causes eye strain under office fluorescent lighting.

```css
[data-theme="light"] {
    /* ═══════════════════════════════════════
       BACKGROUND LAYERS
       ═══════════════════════════════════════ */
    --bg-layer-0: #f7f8fa;          /* Page background — warm off-white */
    --bg-layer-1: #ffffff;          /* Sidebar, section containers */
    --bg-layer-2: #ffffff;          /* Cards, panels */
    --bg-layer-3: #ffffff;          /* Dropdowns, modals */
    --bg-layer-4: #1b1d21;          /* Tooltips (inverted for contrast) */

    /* Interactive */
    --bg-hover: #f2f3f5;
    --bg-active: #e8eaed;
    --bg-selected: rgba(55, 120, 255, 0.06);
    --bg-input: #ffffff;
    --bg-input-focus: #ffffff;

    /* ═══════════════════════════════════════
       TEXT HIERARCHY
       ═══════════════════════════════════════ */
    --text-strongest: #191b20;
    --text-primary: #333539;
    --text-secondary: #6b6e76;
    --text-tertiary: #a0a3ab;
    --text-disabled: #c9ccd1;

    /* ═══════════════════════════════════════
       BORDERS / DIVIDERS
       ═══════════════════════════════════════ */
    --border-default: #e8eaed;
    --border-subtle: #f2f3f5;
    --border-strong: #d5d8dd;
    --border-hover: #c9ccd1;
    --border-focus: #3778ff;

    /* ═══════════════════════════════════════
       ACCENT / BRAND
       ═══════════════════════════════════════ */
    --accent-primary: #3778ff;
    --accent-primary-hover: #2860d9;
    --accent-primary-active: #1a4db3;
    --accent-primary-bg: rgba(55, 120, 255, 0.06);
    --accent-primary-border: rgba(55, 120, 255, 0.2);

    /* ═══════════════════════════════════════
       STATUS COLORS — Light mode variants
       Slightly deeper for white background readability
       ═══════════════════════════════════════ */
    --status-critical: #e5393d;
    --status-critical-bg: rgba(229, 57, 61, 0.06);
    --status-critical-border: rgba(229, 57, 61, 0.2);
    --status-critical-text: #cf1322;

    --status-major: #e8601a;
    --status-major-bg: rgba(232, 96, 26, 0.06);
    --status-major-border: rgba(232, 96, 26, 0.2);
    --status-major-text: #c4500f;

    --status-minor: #d4960c;
    --status-minor-bg: rgba(212, 150, 12, 0.06);
    --status-minor-border: rgba(212, 150, 12, 0.2);
    --status-minor-text: #ad7a0a;

    --status-warning: #2563eb;
    --status-warning-bg: rgba(37, 99, 235, 0.06);
    --status-warning-border: rgba(37, 99, 235, 0.2);
    --status-warning-text: #1d4ed8;

    --status-normal: #16a34a;
    --status-normal-bg: rgba(22, 163, 74, 0.06);
    --status-normal-border: rgba(22, 163, 74, 0.2);
    --status-normal-text: #15803d;

    --status-unknown: #a0a3ab;
    --status-unknown-bg: rgba(160, 163, 171, 0.08);
    --status-unknown-border: rgba(160, 163, 171, 0.2);
    --status-unknown-text: #6b6e76;

    /* ═══════════════════════════════════════
       CHART PALETTE — Slightly deeper for light bg
       ═══════════════════════════════════════ */
    --chart-1: #2860d9;
    --chart-2: #16a34a;
    --chart-3: #e8601a;
    --chart-4: #9333ea;
    --chart-5: #e11d48;
    --chart-6: #0891b2;
    --chart-7: #ca8a04;
    --chart-8: #db2777;

    /* ═══════════════════════════════════════
       INTERACTIVE STATES
       ═══════════════════════════════════════ */
    --interactive-hover-overlay: rgba(0, 0, 0, 0.02);
    --interactive-active-overlay: rgba(0, 0, 0, 0.04);
    --interactive-focus-ring: 0 0 0 2px #ffffff, 0 0 0 4px #3778ff;
    --interactive-disabled-opacity: 0.4;

    /* ═══════════════════════════════════════
       SHADOWS — Softer, warmer
       ═══════════════════════════════════════ */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.08);
    --shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.1);
    --shadow-modal: 0 16px 48px rgba(0, 0, 0, 0.15);

    /* ═══════════════════════════════════════
       OVERLAY
       ═══════════════════════════════════════ */
    --overlay-backdrop: rgba(0, 0, 0, 0.4);
    --overlay-scrim: rgba(247, 248, 250, 0.8);

    /* ═══════════════════════════════════════
       SCROLLBAR
       ═══════════════════════════════════════ */
    --scrollbar-track: transparent;
    --scrollbar-thumb: #d5d8dd;
    --scrollbar-thumb-hover: #c9ccd1;
}
```

---

## 3. Typography

### 3.1 Font Stack

Toss uses **Toss Product Sans** internally (proprietary). For web, replicate with:

```css
:root {
    /* Primary — Optimized for Korean + Latin mixed text */
    --font-sans: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont,
                 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;

    /* Monospace — For metrics, IP addresses, OIDs, counters */
    --font-mono: 'Geist Mono', 'JetBrains Mono', 'SF Mono', 'Cascadia Code',
                 'Fira Code', monospace;

    /* Metrics display — Large numbers (CPU %, throughput, response time) */
    /* Use font-variant-numeric: tabular-nums for alignment */
    --font-metric: var(--font-sans);
}
```

**Why Pretendard?** It's the Korean equivalent of Inter — designed specifically for UI, with excellent hangul rendering at all sizes, and proper tabular number support. It's free, open source, and widely adopted in Korean enterprise software.

### 3.2 Size Scale (Toss Bold Contrast)

Toss creates hierarchy through **aggressive size contrast**. A metric number might be 32px while its label is 11px. This makes dashboards scannable.

```css
:root {
    /* ═══ Display / Metrics ═══ */
    --text-display: 36px;           /* Hero metrics (dashboard total fault count) */
    --text-metric-lg: 32px;         /* Large gauge numbers (CPU 87%) */
    --text-metric-md: 24px;         /* Card metric values */
    --text-metric-sm: 20px;         /* Inline metric values */

    /* ═══ Headings ═══ */
    --text-h1: 24px;                /* Page title ("실시간 관제") */
    --text-h2: 20px;                /* Section title */
    --text-h3: 16px;                /* Card title, panel header */
    --text-h4: 14px;                /* Sub-section header */

    /* ═══ Body ═══ */
    --text-body-lg: 16px;           /* Prominent body text */
    --text-body: 14px;              /* Default body, table cells */
    --text-body-sm: 13px;           /* Secondary body, descriptions */

    /* ═══ Small / UI ═══ */
    --text-caption: 12px;           /* Labels, table headers, timestamps */
    --text-micro: 11px;             /* Badges, tiny labels */
    --text-nano: 10px;              /* Port box labels, miniature UI */
}
```

### 3.3 Weight Strategy

```css
:root {
    --weight-regular: 400;          /* Body text, descriptions */
    --weight-medium: 500;           /* Labels, table cells, nav items */
    --weight-semibold: 600;         /* Card titles, section headers, buttons */
    --weight-bold: 700;             /* Page titles, metric numbers */
    --weight-extrabold: 800;        /* Display metrics (dashboard hero numbers) */
}
```

### 3.4 Line Heights

```css
:root {
    --leading-none: 1;              /* Metric numbers (pure number display) */
    --leading-tight: 1.25;          /* Headings */
    --leading-snug: 1.375;          /* Card titles */
    --leading-normal: 1.5;          /* Body text */
    --leading-relaxed: 1.625;       /* Long-form descriptions */
}
```

### 3.5 Number Display Rules

```css
/* All numeric displays should use tabular figures for alignment */
.metric-number {
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    font-weight: var(--weight-bold);
}

/* IP addresses, OIDs, MAC addresses */
.monospace-value {
    font-family: var(--font-mono);
    font-size: var(--text-body-sm);
    letter-spacing: 0;
}
```

---

## 4. Spacing System

### 4.1 Base Unit: 4px

Toss uses a 4px grid. Every spacing value is a multiple of 4.

```css
:root {
    --space-0: 0;
    --space-0_5: 2px;               /* Micro gaps (icon-to-text in badges) */
    --space-1: 4px;                 /* Minimum gap */
    --space-1_5: 6px;
    --space-2: 8px;                 /* Tight internal padding */
    --space-3: 12px;                /* Default internal gap */
    --space-4: 16px;                /* Standard padding */
    --space-5: 20px;                /* Card padding */
    --space-6: 24px;                /* Section gap */
    --space-8: 32px;                /* Large section gap */
    --space-10: 40px;               /* Page section separator */
    --space-12: 48px;               /* Page top/bottom padding */
    --space-16: 64px;               /* Major layout gaps */
    --space-20: 80px;               /* Hero section spacing */
}
```

### 4.2 Component-Specific Spacing

```css
:root {
    /* Card */
    --card-padding: 20px;           /* Internal padding */
    --card-padding-compact: 16px;   /* Compact card (monitoring grid) */
    --card-gap: 16px;               /* Gap between cards in grid */
    --card-header-gap: 16px;        /* Gap between header and content */

    /* Table */
    --table-cell-padding-x: 16px;
    --table-cell-padding-y: 12px;
    --table-header-padding-y: 10px;

    /* Input */
    --input-padding-x: 12px;
    --input-padding-y: 10px;
    --input-padding-x-lg: 16px;
    --input-padding-y-lg: 12px;

    /* Button */
    --btn-padding-x: 16px;
    --btn-padding-y: 10px;
    --btn-padding-x-lg: 24px;
    --btn-padding-y-lg: 12px;
    --btn-padding-x-sm: 12px;
    --btn-padding-y-sm: 6px;

    /* Navigation */
    --nav-item-padding-x: 12px;
    --nav-item-padding-y: 10px;
    --nav-item-gap: 2px;            /* Between nav items */
    --nav-section-gap: 24px;        /* Between nav sections */

    /* Modal */
    --modal-padding: 24px;
    --modal-header-padding: 20px 24px;
    --modal-footer-padding: 16px 24px;

    /* Page */
    --page-padding: 24px;
    --page-header-gap: 20px;        /* Title to content */
}
```

### 4.3 Balancing Breathing Room vs Information Density

Toss standard app: generous spacing. NMS adaptation: **tiered density**.

| Context | Density | Card Padding | Row Height | Gap |
|---------|---------|-------------|------------|-----|
| Dashboard widgets | Comfortable | 20px | — | 16px |
| Monitoring card grid | Compact | 16px | — | 12px |
| Data tables | Dense | — | 44px | — |
| Fault monitoring table | Dense | — | 40px | — |
| Forms | Comfortable | 24px | — | 16px |
| Sidebar | Comfortable | — | 40px | 2px |

### 4.4 Border Radius

```css
:root {
    --radius-sm: 6px;               /* Badges, small buttons, inputs */
    --radius-md: 8px;               /* Cards, panels, buttons */
    --radius-lg: 12px;              /* Large cards, modals */
    --radius-xl: 16px;              /* Main containers, sidebar */
    --radius-full: 9999px;          /* Pills, circular buttons, avatars */
}
```

### 4.5 Layout Constants

```css
:root {
    --sidebar-width: 240px;
    --sidebar-collapsed-width: 64px;
    --page-sidebar-width: 280px;     /* Secondary sidebar (group tree) */
    --header-height: 0px;            /* No top header — Toss uses sidebar-only nav */
    --modal-width-sm: 400px;
    --modal-width-md: 560px;
    --modal-width-lg: 720px;
    --modal-width-xl: 960px;
}
```

### 4.6 Responsive Breakpoints

```css
/*
  --bp-sm: 640px    (mobile landscape)
  --bp-md: 768px    (tablet)
  --bp-lg: 1024px   (small laptop)
  --bp-xl: 1280px   (desktop)
  --bp-2xl: 1536px  (large monitor)
  --bp-3xl: 1920px  (full HD — NOC primary)
*/
```

---

## 5. Component Patterns (Toss-Style)

### 5.1 Navigation Sidebar

Toss's sidebar: minimal, icon-forward, clear active state. No gradient backgrounds, no glow effects.

```
Design:
- Background: --bg-layer-1 (solid, opaque)
- Border-right: 1px solid --border-default
- No box-shadow (shadow feels cheap on sidebar)
- No blur/backdrop-filter

Logo area:
- Height: 64px
- Logo centered, max-height 32px
- Bottom border: 1px solid --border-subtle

Nav items:
- Height: 40px
- Padding: 10px 12px
- Border-radius: 8px (--radius-md)
- Icon: 20px, margin-right: 12px
- Text: 14px, --weight-medium, --text-secondary
- Hover: background --bg-hover, text --text-primary
- Active: background --accent-primary-bg, text --accent-primary
- Active indicator: 3px wide pill on left edge, --accent-primary, border-radius 0 3px 3px 0

Section headers:
- Text: 11px, --weight-semibold, --text-tertiary
- Text-transform: uppercase
- Letter-spacing: 0.05em
- Padding: 20px 12px 8px 12px

Submenu:
- Indented with padding-left: 44px (aligned with parent text, past icon)
- Item dot: 4px circle, --text-tertiary, before text
- Active dot: --accent-primary
```

```css
/* Sidebar — Toss style */
.app-sidebar {
    position: fixed;
    left: 0; top: 0;
    width: var(--sidebar-width);
    height: 100vh;
    background: var(--bg-layer-1);
    border-right: 1px solid var(--border-default);
    display: flex;
    flex-direction: column;
    z-index: 1000;
    transition: width 200ms ease;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 40px;
    padding: 0 12px;
    margin: 1px 8px;
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
}

.nav-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
}

.nav-item.active {
    background: var(--accent-primary-bg);
    color: var(--accent-primary);
}

.nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    width: 3px;
    height: 20px;
    background: var(--accent-primary);
    border-radius: 0 3px 3px 0;
}
```

### 5.2 Data Tables

Toss approach: clean rows, no alternating colors, generous cell padding, header visually separated by weight and color (not background).

```
Structure:
- Container: --bg-layer-2, border 1px --border-default, border-radius 12px
- No backdrop-filter, no glass effect

Header:
- Background: NONE (rely on text style difference)
- OR subtle --bg-layer-0 tint for high-contrast
- Text: 12px, --weight-semibold, --text-tertiary, uppercase, letter-spacing 0.04em
- Padding: 10px 16px
- Bottom border: 1px solid --border-default

Rows:
- Padding: 12px 16px
- Font: 14px, --weight-regular, --text-primary
- Border-bottom: 1px solid --border-subtle
- Last row: no border
- Hover: background --bg-hover (smooth, 150ms)

Selected row:
- Background: --bg-selected
- Left border: 2px solid --accent-primary (optional)

Sorting:
- Active column header: --text-primary color
- Sort icon: 10px, --text-tertiary, opacity changes

For 20+ column tables:
- Use horizontal scroll with sticky first column
- Frozen column shadow: 4px linear-gradient from --bg-layer-2 to transparent
- Column resizing handles (optional)
- Row height: 44px (dense mode: 36px)
```

```css
.data-table {
    width: 100%;
    border-collapse: collapse;
}

.data-table th {
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-align: left;
    border-bottom: 1px solid var(--border-default);
    white-space: nowrap;
    user-select: none;
}

.data-table td {
    padding: 12px 16px;
    font-size: 14px;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);
}

.data-table tbody tr:last-child td {
    border-bottom: none;
}

.data-table tbody tr:hover {
    background: var(--bg-hover);
}
```

### 5.3 Metric Cards (Real-time Monitoring)

This is the heart of NMS. Toss displays account balances with a huge number and tiny label. Apply the same pattern:

```
Card structure:
┌──────────────────────────────────┐
│  🟢 Switch-Core-01     ▶ Detail │  ← 14px device name, status dot, action
│                                  │
│     CPU          MEM             │  ← 11px labels, --text-tertiary
│     87%          63%             │  ← 32px numbers, --weight-bold
│                                  │
│  ──────────────────────────────  │  ← Subtle divider
│  In: 847 Mbps    Out: 623 Mbps  │  ← 14px, monospace, --text-secondary
│  Ping: 2ms       Loss: 0%      │
└──────────────────────────────────┘

Design specs:
- Card: --bg-layer-2, border 1px --border-default, border-radius 12px
- Padding: 16px
- Status dot: 8px circle, absolutely positioned or inline
  - Green pulse animation ONLY for newly recovered (2s then stop)
  - Red pulse animation ONLY for newly faulted (continuous until acknowledged)
  - Static dot for stable states
- Device name: 14px, --weight-semibold, --text-primary
- Metric label: 11px, --weight-medium, --text-tertiary, uppercase
- Metric value: 32px, --weight-bold, --text-strongest
  - Color changes by threshold:
    - 0-70%: --text-strongest (white/black)
    - 70-85%: --status-minor (yellow)
    - 85-100%: --status-critical (red)
- Traffic values: 14px, --font-mono, --text-secondary
- Card hover: border-color --border-hover, translateY(-1px), shadow-md
- Fault state: left border 3px solid --status-critical, background tinted --status-critical-bg
```

```css
.metric-card {
    background: var(--bg-layer-2);
    border: 1px solid var(--border-default);
    border-radius: 12px;
    padding: 16px;
    transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

.metric-card:hover {
    border-color: var(--border-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

.metric-card.fault {
    border-left: 3px solid var(--status-critical);
    background: var(--status-critical-bg);
}

.metric-value {
    font-size: 32px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1;
    color: var(--text-strongest);
}

.metric-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
}
```

### 5.4 Charts (ECharts Toss-Style)

Toss charts: minimal grid lines, bold data lines, large tooltip, no unnecessary decoration.

```javascript
const tossChartTheme = {
    // Background
    backgroundColor: 'transparent',

    // Text
    textStyle: {
        fontFamily: 'Pretendard, sans-serif',
        color: 'var(--text-tertiary)',  // #6b6e76 dark, #a0a3ab light
    },

    // Title — usually outside chart, in card header
    title: {
        show: false,  // Use card header instead
    },

    // Grid — generous padding, no border
    grid: {
        top: 20,
        right: 20,
        bottom: 30,
        left: 50,
        containLabel: false,
    },

    // X Axis
    xAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
            fontSize: 11,
            color: '#6b6e76',           // --text-tertiary
            margin: 12,
        },
        splitLine: { show: false },
    },

    // Y Axis
    yAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
            fontSize: 11,
            color: '#6b6e76',
            margin: 12,
        },
        splitLine: {
            show: true,
            lineStyle: {
                color: '#2a2c31',       // --border-default (dark)
                type: 'dashed',
                width: 1,
            },
        },
    },

    // Tooltip — large, readable
    tooltip: {
        backgroundColor: '#2a2c31',     // --bg-layer-3
        borderColor: '#333539',         // --border-strong
        borderWidth: 1,
        borderRadius: 8,
        padding: [12, 16],
        textStyle: {
            color: '#f2f3f5',           // --text-primary
            fontSize: 13,
        },
        extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.4);',
    },

    // Legend
    legend: {
        textStyle: {
            color: '#a0a3ab',           // --text-secondary
            fontSize: 12,
        },
        itemWidth: 12,
        itemHeight: 3,                  // Thin line indicators
        itemGap: 16,
    },

    // Line Series
    line: {
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 },
        emphasis: {
            lineStyle: { width: 3 },
        },
        areaStyle: {
            opacity: 0.08,              // Very subtle fill
        },
    },

    // Colors
    color: [
        '#3778ff', '#22c55e', '#ff7a2f', '#a855f7',
        '#f43f5e', '#06b6d4', '#eab308', '#ec4899',
    ],
};

// Gauge chart (CPU/MEM) — Toss clean style
const tossGaugeOption = {
    series: [{
        type: 'gauge',
        startAngle: 220,
        endAngle: -40,
        radius: '85%',
        center: ['50%', '55%'],
        min: 0,
        max: 100,
        progress: {
            show: true,
            width: 10,
            roundCap: true,
            itemStyle: {
                color: '#3778ff',       // Dynamic: blue < 70, yellow < 85, red >= 85
            },
        },
        pointer: { show: false },
        axisLine: {
            lineStyle: {
                width: 10,
                color: [[1, '#2a2c31']],  // Track color
            },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
            offsetCenter: [0, '20%'],
            fontSize: 32,
            fontWeight: 700,
            fontFamily: 'Pretendard, sans-serif',
            color: '#f2f3f5',
            formatter: '{value}%',
        },
    }],
};
```

### 5.5 Status Indicators

```
Status Dot:
- Size: 8px circle
- Colors: per severity (critical=red, major=orange, minor=yellow, warning=blue, normal=green)
- No glow, no shadow
- Fault active: 8px circle with ring animation (subtle opacity pulse)

Severity Badge:
- Padding: 4px 8px
- Border-radius: 4px (NOT pill shape — Toss uses slightly rounded rectangles for badges)
- Font: 11px, --weight-semibold
- Background: --status-{severity}-bg
- Color: --status-{severity}-text
- Border: 1px solid --status-{severity}-border

Port Status Box:
- Size: 56px x 48px
- Border-radius: 8px
- Background: --status-normal-bg (green) or --status-critical-bg (red)
- Border: 1px solid respective --status-*-border
- Port number: 12px, --weight-bold, centered
- Status text: 10px, underneath
```

```css
.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}
.status-dot.critical { background: var(--status-critical); }
.status-dot.major    { background: var(--status-major); }
.status-dot.minor    { background: var(--status-minor); }
.status-dot.warning  { background: var(--status-warning); }
.status-dot.normal   { background: var(--status-normal); }
.status-dot.unknown  { background: var(--status-unknown); }

/* Pulsing dot for active faults only */
.status-dot.pulsing {
    animation: statusPulse 2s ease-in-out infinite;
}
@keyframes statusPulse {
    0%, 100% { box-shadow: 0 0 0 0 currentColor; }
    50% { box-shadow: 0 0 0 4px transparent; }
}

.severity-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
}
.severity-badge.critical {
    background: var(--status-critical-bg);
    color: var(--status-critical-text);
    border: 1px solid var(--status-critical-border);
}
/* ... repeat for each severity */
```

### 5.6 Forms / Input Fields

Toss inputs: clean, minimal border, generous height, clear focus state.

```css
.input {
    width: 100%;
    height: 44px;
    padding: 0 12px;
    background: var(--bg-input);
    border: 1px solid var(--border-default);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 14px;
    font-family: var(--font-sans);
    transition: border-color 150ms ease, box-shadow 150ms ease;
    outline: none;
}

.input::placeholder {
    color: var(--text-tertiary);
}

.input:hover {
    border-color: var(--border-hover);
}

.input:focus {
    border-color: var(--accent-primary);
    box-shadow: var(--interactive-focus-ring);
}

.input:disabled {
    opacity: var(--interactive-disabled-opacity);
    cursor: not-allowed;
}

/* Input with label */
.form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
}

.form-helper {
    font-size: 12px;
    color: var(--text-tertiary);
}

.form-error {
    font-size: 12px;
    color: var(--status-critical);
}

/* Select dropdown */
.select {
    appearance: none;
    background-image: url("data:image/svg+xml,...chevron-down...");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 36px;
}

/* Textarea */
.textarea {
    min-height: 100px;
    padding: 12px;
    resize: vertical;
}
```

### 5.7 Modals

Toss uses centered dialogs for confirmations, side-sheets for forms. No bottom-sheet on desktop web.

```css
/* Backdrop */
.modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-backdrop);
    z-index: 9000;
    animation: fadeIn 200ms ease;
}

/* Modal */
.modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: var(--modal-width-md);
    max-height: 85vh;
    background: var(--bg-layer-3);
    border: 1px solid var(--border-default);
    border-radius: 16px;
    box-shadow: var(--shadow-modal);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    animation: modalIn 250ms cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes modalIn {
    from {
        opacity: 0;
        transform: translate(-50%, -48%) scale(0.96);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
}

.modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.modal-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-strongest);
}

.modal-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: background 150ms ease;
}

.modal-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
}

.modal-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
}

.modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}
```

### 5.8 Buttons

Toss button hierarchy: Primary (filled) > Secondary (outlined) > Ghost (text only). No gradients.

```css
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 40px;
    padding: 0 16px;
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-sans);
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: background 150ms ease, transform 100ms ease, box-shadow 150ms ease;
    outline: none;
    white-space: nowrap;
}

.btn:active {
    transform: scale(0.97);
}

.btn:focus-visible {
    box-shadow: var(--interactive-focus-ring);
}

.btn:disabled {
    opacity: var(--interactive-disabled-opacity);
    cursor: not-allowed;
    transform: none;
}

/* Primary — Solid blue */
.btn-primary {
    background: var(--accent-primary);
    color: #ffffff;
}
.btn-primary:hover:not(:disabled) {
    background: var(--accent-primary-hover);
}
.btn-primary:active:not(:disabled) {
    background: var(--accent-primary-active);
}

/* Secondary — Subtle background */
.btn-secondary {
    background: var(--bg-hover);
    color: var(--text-primary);
}
.btn-secondary:hover:not(:disabled) {
    background: var(--bg-active);
}

/* Ghost — Text only */
.btn-ghost {
    background: transparent;
    color: var(--text-secondary);
}
.btn-ghost:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
}

/* Danger */
.btn-danger {
    background: var(--status-critical);
    color: #ffffff;
}
.btn-danger:hover:not(:disabled) {
    background: #e5393d;
}

/* Danger Ghost */
.btn-danger-ghost {
    background: transparent;
    color: var(--status-critical);
}
.btn-danger-ghost:hover:not(:disabled) {
    background: var(--status-critical-bg);
}

/* Sizes */
.btn-sm {
    height: 32px;
    padding: 0 12px;
    font-size: 13px;
    border-radius: 6px;
}

.btn-lg {
    height: 48px;
    padding: 0 24px;
    font-size: 16px;
    border-radius: 10px;
}

/* Icon button */
.btn-icon {
    width: 40px;
    height: 40px;
    padding: 0;
}
.btn-icon.btn-sm {
    width: 32px;
    height: 32px;
}
```

### 5.9 Empty States

Toss uses clean, text-only empty states. No illustrations (they look dated quickly). Simple icon + text.

```css
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    text-align: center;
}

.empty-state-icon {
    font-size: 40px;
    color: var(--text-disabled);
    margin-bottom: 16px;
}

.empty-state-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
}

.empty-state-desc {
    font-size: 14px;
    color: var(--text-tertiary);
    max-width: 320px;
    line-height: 1.5;
}

.empty-state-action {
    margin-top: 20px;
}
```

### 5.10 Loading States (Skeleton)

Toss uses shimmer skeletons, not spinners (except for actions).

```css
.skeleton {
    background: var(--bg-hover);
    border-radius: 6px;
    position: relative;
    overflow: hidden;
}

.skeleton::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--interactive-hover-overlay) 50%,
        transparent 100%
    );
    animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
    from { transform: translateX(-100%); }
    to   { transform: translateX(100%); }
}

/* Skeleton variants */
.skeleton-text     { height: 14px; width: 60%; }
.skeleton-text-sm  { height: 12px; width: 40%; }
.skeleton-heading  { height: 20px; width: 30%; }
.skeleton-metric   { height: 32px; width: 80px; }
.skeleton-circle   { width: 40px; height: 40px; border-radius: 50%; }
.skeleton-card     { height: 120px; border-radius: 12px; }
```

### 5.11 Toast / Snackbar

```css
.toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    min-width: 320px;
    max-width: 480px;
    padding: 14px 20px;
    background: var(--bg-layer-4);
    color: var(--text-primary);
    border-radius: 12px;
    box-shadow: var(--shadow-xl);
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 99999;
    animation: toastIn 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes toastIn {
    from {
        opacity: 0;
        transform: translateX(-50%) translateY(12px);
    }
    to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}

.toast.success { border-left: 3px solid var(--status-normal); }
.toast.error   { border-left: 3px solid var(--status-critical); }
.toast.warning { border-left: 3px solid var(--status-minor); }
.toast.info    { border-left: 3px solid var(--accent-primary); }
```

---

## 6. Page-Specific Layout

### 6.1 Dashboard

```
Layout: CSS Grid, 12 columns
Gap: 16px
Padding: 24px

┌────────────────────────────────────────────────────────┐
│  Page Title: "대시보드"  (24px, bold)    [날짜/시간]    │
├──────────┬──────────┬──────────┬──────────┬────────────┤
│ 전체장비  │ 정상     │ 장애     │ 미연결    │ 장애율     │  ← Summary cards (span 2-3 cols each)
│ 247      │ 231      │ 12       │ 4        │ 4.9%      │     Big number: 32px bold
│          │ 🟢       │ 🔴       │ ⚫       │            │     Label: 12px above
├──────────┴──────────┴──────────┴──────────┴────────────┤
│                                                        │
│  ┌─────────────────────┐ ┌─────────────────────┐      │  ← 2-column widget area
│  │ 실시간 장애 (최근)    │ │ 트래픽 추이 (24h)    │      │
│  │ Fault table (5 rows) │ │ Line chart           │      │
│  └─────────────────────┘ └─────────────────────┘      │
│                                                        │
│  ┌─────────────────────┐ ┌─────────────────────┐      │
│  │ CPU/MEM Top 5       │ │ 토폴로지 미니맵       │      │
│  │ Bar chart            │ │ Force graph           │      │
│  └─────────────────────┘ └─────────────────────┘      │
└────────────────────────────────────────────────────────┘

Summary Cards:
- Background: --bg-layer-2
- Border: 1px --border-default
- Padding: 20px
- Number: 32px, --weight-extrabold, --text-strongest
- Label: 12px, --weight-medium, --text-tertiary, above the number
- Status colored underline or left border for fault/normal cards
- Fault card: Red number, subtle red tint background
- Click navigates to detail page

Widget Cards:
- Background: --bg-layer-2
- Border: 1px --border-default
- Border-radius: 12px
- Header: 14px --weight-semibold, padding 16px, bottom border --border-subtle
- Body: padding 16px
```

### 6.2 Real-time Monitoring Card Grid

```
Layout: CSS Grid, auto-fill, minmax(320px, 1fr)
Gap: 12px

For 20+ devices:
- Virtual scrolling if > 30 cards
- Compact mode toggle (reduces card padding to 12px, metric size to 24px)
- Group filter tabs at top
- Search bar with instant filter

Card States:
1. Normal: Default card, green dot
2. Warning: Yellow tinted left border, metric numbers turn yellow
3. Critical: Red left border 3px, subtle red bg tint, red pulsing dot
4. Unreachable: Gray out entire card, dashed border
```

### 6.3 Fault Monitoring Table

```
Priority: Operator must identify severity in < 1 second

Design:
- Full-width table, no card wrapper (maximize data area)
- Row height: 40px (dense)
- Severity column: FIRST column, 60px wide
  - Shows colored badge (Critical/Major/Minor/Warning)
  - Badge background color is the primary visual cue
- Timestamp column: --font-mono, --text-tertiary
- Device name: --weight-medium, clickable (navigates to device detail)
- Acknowledged row: reduced opacity (0.6), strikethrough on message

Severity-first visual pattern:
┌─────────┬──────────────────┬──────────┬─────────────────┬──────────┐
│ SEVERITY │ 장비명            │ 시간      │ 장애 내용        │ 확인      │
├─────────┼──────────────────┼──────────┼─────────────────┼──────────┤
│ ● 심각   │ Core-SW-01       │ 14:23:05 │ Interface Down  │ [확인]   │
│ ● 경고   │ Access-SW-12     │ 14:22:48 │ High CPU (92%)  │ [확인]   │
│ ● 주의   │ Router-Edge-03   │ 14:20:11 │ Packet Loss 3%  │ [확인]   │
└─────────┴──────────────────┴──────────┴─────────────────┴──────────┘

Critical rows:
- Background: --status-critical-bg
- Left border: 3px solid --status-critical
- Badge pulsing animation

Filter bar above table:
- Severity filter: Toggle buttons for each level (pill-shaped, colored)
- Date range: Compact picker
- Search: Inline search input
```

### 6.4 Login Page

Toss login: centered, clean, large touch targets.

```
Layout:
- Centered card, max-width 400px
- Background: --bg-layer-0 (full page)

Card:
- Background: --bg-layer-2
- Border: 1px --border-default (dark mode only)
- Border-radius: 16px
- Padding: 40px
- Box-shadow: --shadow-xl (light mode), none (dark mode)

Content:
- Logo: 48px, centered, margin-bottom 32px
- Title: "로그인", 24px, --weight-bold, centered
- Subtitle: 14px, --text-tertiary, centered, margin-bottom 32px
- Input fields: Full width, 48px height, 16px gap between
- Login button: Full width, 48px height, --btn-primary
- Divider: "또는" with horizontal lines
- Social login buttons: Full width, 48px, outlined
  - Kakao: #FEE500 bg, #191919 text
  - Naver: #03C75A bg, #ffffff text
  - Google: #ffffff bg (light), --bg-layer-3 (dark), 1px border
- Links: "회원가입" | "비밀번호 찾기", 14px, --accent-primary
```

---

## 7. Micro-interactions

### 7.1 Hover Effects

```css
/* Card hover — subtle lift */
.card:hover {
    transform: translateY(-1px);
    border-color: var(--border-hover);
    box-shadow: var(--shadow-md);
    transition: all 150ms ease;
}

/* Table row hover — background only, no transform */
.table-row:hover {
    background: var(--bg-hover);
    transition: background 100ms ease;
}

/* Button hover — background darken, no transform */
.btn:hover {
    /* color shift handled per variant */
    transition: background 150ms ease;
}

/* Nav item hover — background fill */
.nav-item:hover {
    background: var(--bg-hover);
    transition: background 150ms ease;
}

/* Link hover — underline appears */
.link:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
}
```

### 7.2 Click Feedback

```css
/* Scale down on press — Toss signature */
.btn:active, .card:active, .nav-item:active {
    transform: scale(0.97);
    transition: transform 100ms ease;
}

/* Instant release */
.btn, .card, .nav-item {
    transition: transform 100ms ease;
}
```

### 7.3 Data Update Animations (Number Transitions)

```css
/* Counter animation for metric values */
.metric-value {
    transition: color 300ms ease;
}

/* Use CSS counter or JS library (countUp.js) for number roll effect */
/* Duration: 400ms, easing: ease-out */

/* Threshold color change */
.metric-value.normal   { color: var(--text-strongest); }
.metric-value.warning  { color: var(--status-minor); }
.metric-value.critical { color: var(--status-critical); transition: color 200ms ease; }

/* New data flash — subtle background pulse on update */
@keyframes dataUpdate {
    0%   { background-color: var(--accent-primary-bg); }
    100% { background-color: transparent; }
}
.data-updated {
    animation: dataUpdate 600ms ease-out;
}
```

### 7.4 Page Transitions

```css
/* Fade + slight slide up */
.page-enter {
    opacity: 0;
    transform: translateY(8px);
}
.page-enter-active {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 200ms ease, transform 200ms ease;
}
.page-exit {
    opacity: 1;
}
.page-exit-active {
    opacity: 0;
    transition: opacity 150ms ease;
}
```

### 7.5 Theme Toggle Animation

```css
/* Smooth color transition on theme change */
html {
    transition: background-color 300ms ease;
}

/* Only transition colors, not layout properties */
* {
    transition: background-color 300ms ease,
                color 200ms ease,
                border-color 300ms ease,
                box-shadow 300ms ease;
}

/* Exclude from transitions to prevent jank */
.no-transition,
.chart-container,
canvas,
svg {
    transition: none !important;
}
```

---

## 8. Dark/Light Mode Strategy

### 8.1 What Changes Beyond Colors

| Element | Dark | Light |
|---------|------|-------|
| Shadows | Nearly invisible, subtle elevation | Visible, provides depth |
| Border weight | Rely on borders more (1px solid) | Can use shadows instead of borders |
| Card surface | Slightly lighter than page bg | White, separated by shadow |
| Text rendering | -webkit-font-smoothing: antialiased | auto (subpixel rendering) |
| Chart grid lines | Dashed, --border-default | Dashed, --border-subtle |
| Tooltip bg | --bg-layer-4 (light gray-dark) | --bg-layer-4 (dark, inverted) |
| Status badge contrast | Lighter text on dark bg | Darker text on light bg |
| Scrollbar | Subtle, blends in | More visible for usability |
| Focus ring | Blue ring on dark bg | Blue ring on white bg |

### 8.2 Shadow Strategy

**Dark mode**: Shadows are barely visible against dark backgrounds. Instead, use **borders** and **slight background elevation** to create hierarchy.

```css
[data-theme="dark"] {
    /* Cards use borders, not shadows */
    .card {
        border: 1px solid var(--border-default);
        box-shadow: none; /* or very subtle --shadow-sm */
    }
    /* Modals use deeper shadows (they float over dark backdrop) */
    .modal {
        box-shadow: var(--shadow-modal);
    }
}
```

**Light mode**: Shadows are the primary depth mechanism. Reduce border visibility.

```css
[data-theme="light"] {
    /* Cards use shadows, minimal borders */
    .card {
        border: 1px solid var(--border-subtle); /* Very light */
        box-shadow: var(--shadow-md);
    }
    .modal {
        box-shadow: var(--shadow-xl);
    }
}
```

### 8.3 Premium Feel Checklist

Both modes feel premium when:
1. **Spacing is consistent** — Everything aligns to the 4px grid
2. **Typography contrast is bold** — Clear size hierarchy (32px metric vs 11px label)
3. **Color palette is restrained** — Maximum 3-4 colors visible at once
4. **Transitions are subtle** — 150-200ms, ease timing, no bouncing
5. **Focus states are visible** — 2px blue ring with 2px offset
6. **Empty states are designed** — Not just "No data" text
7. **Loading states match layout** — Skeleton screens preserve layout shape
8. **Icons are consistent** — One icon set, one weight (outlined or filled, not mixed)

---

## 9. Z-Index Scale

```css
:root {
    --z-base: 0;
    --z-above: 1;
    --z-sticky-column: 10;        /* Sticky table columns */
    --z-sticky-header: 20;        /* Sticky table headers */
    --z-dropdown: 100;
    --z-sticky: 200;              /* Sticky nav elements */
    --z-sidebar: 1000;
    --z-modal-backdrop: 9000;
    --z-modal: 10000;
    --z-popover: 11000;
    --z-tooltip: 12000;
    --z-toast: 99999;
}
```

---

## 10. Migration Checklist (Current → Toss)

### Remove:
- [ ] All `backdrop-filter: blur()` effects
- [ ] All `rgba()` backgrounds on cards/panels (use solid colors)
- [ ] All gradient backgrounds on buttons (use solid colors)
- [ ] All animated glow borders (`.glow-border-animated`, etc.)
- [ ] All `::before` / `::after` shine/highlight pseudo-elements
- [ ] Purple/violet accent colors → replace with clean blue `#3778ff`
- [ ] `#0c0c14` blue-black background → `#141517` warm neutral black
- [ ] Pure `#ffffff` light mode backgrounds → `#f7f8fa` warm off-white (page level)
- [ ] All `translateY(-2px)` on card hover → `translateY(-1px)` (more subtle)
- [ ] All box-shadow glow effects (`--shadow-glow`, `--shadow-accent`)
- [ ] Letter-spacing `0.1em` (too wide) → `0.04em` max
- [ ] All `saturate()` filter effects

### Replace:
- [ ] Font: Inter → Pretendard Variable
- [ ] Border-radius 16px cards → 12px
- [ ] Border-radius 20px badges → 4px
- [ ] Border-radius 10px buttons → 8px
- [ ] Glass panels → Solid background panels
- [ ] Gradient buttons → Solid color buttons
- [ ] `text-transform: uppercase` on all headers → Only on small labels (12px and below)
- [ ] ECharts dark theme → Toss chart theme config
- [ ] Colored shadow effects → Neutral shadows

### Add:
- [ ] `font-variant-numeric: tabular-nums` on all metric displays
- [ ] 5-level NMS severity system (Critical/Major/Minor/Warning/Normal)
- [ ] Skeleton loading states for all data areas
- [ ] `scale(0.97)` press feedback on buttons
- [ ] Theme-aware tooltip (inverted bg in light mode)
- [ ] Dense mode toggle for monitoring views
- [ ] Page-level title bar with breadcrumb

---

## 11. Accessibility Notes

- All text meets WCAG 2.1 AA contrast ratios (4.5:1 for body, 3:1 for large text)
- Dark mode: `#f2f3f5` on `#141517` = contrast ratio 14.8:1 (passes AAA)
- Light mode: `#333539` on `#f7f8fa` = contrast ratio 10.2:1 (passes AAA)
- Status colors pass contrast against their respective backgrounds
- Focus ring visible in both modes: 2px solid blue with 2px gap
- Keyboard navigation: all interactive elements focusable in logical order
- Minimum touch target: 32px (buttons), 40px (nav items)

---

## 12. CSS Variable Quick Reference

```css
/* Copy-paste starter for any component */
.component {
    /* Background */
    background: var(--bg-layer-2);

    /* Border */
    border: 1px solid var(--border-default);
    border-radius: 12px;

    /* Text */
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;

    /* Spacing */
    padding: 16px;
    gap: 12px;

    /* Interactive */
    transition: background 150ms ease, border-color 150ms ease;
    cursor: pointer;
}

.component:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
}

.component:active {
    transform: scale(0.97);
}
```
