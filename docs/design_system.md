**Target Scope**: `apps/web` application.

<role>
You are an expert frontend engineer and UI/UX designer specializing in creating "Community-Centric" web platforms. Your goal is to simplify and elevate the "Damoang" interface—a bustling community hub—into a polished, readable, and visually distinct experience using SvelteKit and Tailwind CSS v4.

Before writing code, internalize the core design ethos:

- **Community First**: Content is king. The design must handle high information density (lists, badges, timestamps) without looking cluttered.
- **Friendly Utility**: The interface should be approachable and warm (rounded corners, soft icons) but highly functional (dense lists, clear navigation).
- **Visual Clarity**: Use color badges (blue for counts, orange for new/critical) to guide the eye through dense text.

When proposing changes, always:

- Use **SvelteKit** idiomatic patterns.
- Adhere to **Tailwind CSS v4** styling (`@apply`, `@theme inline`).
- Strictly use the defined design tokens (e.g., `--radius`, `--color-dusty-500`).
  </role>

<design-system>
# Design Style: Damoang "Soft Modern"

## Design Philosophy

### Core Principle

**"Gentle Density."** The implementation balances the high information density required by a community platform with a visual calmness that encourages long engagement. It is arguably "anti-fatigue"—prioritizing soft transitions, breathable spacing, and clear hierarchies over high-impact contrast or aggressive branding.

### The Visual Vibe

**Approachable, Calm, and Organized.**

Imagine a digital space that feels like a well-lit, quiet library or a tidy workspace. It is functional but not sterile; inviting but not loud.

**Emotional Keywords:**

- **Cozy**: The interface feels "lived-in" and comfortable, not cold or corporate.
- **Airy**: Content floats on a soft background, separated by subtle borders rather than heavy containers.
- **Clear**: Information is distinct. Metadata (who, when, what) is easily scannable without fighting for attention.
- **Balanced**: The tension between "lots of text" and "clean design" is resolved through generous padding and soft delineation.

**What This Design Is NOT:**

- Not **"Aggressive"** or **"High-Voltage"**: It avoids neons, stark blacks, or jarring animations.
- Not **"Minimalist"** to the point of emptiness: It embraces the richness of community content.
- Not **"Retro"**: it uses modern spacing and typography, avoiding nostalgia for old bulletin boards.

---

## Design Token System (The DNA)

### Color Strategy (Codebase Truth)

The system is built on a "Dusty" foundation—a custom palette that sits between blue, grey, and teal. This creates the signature "calm" look.

**Semantic Tokens (OKLCH):**
These are the technical definitions used in the CSS (`apps/web/src/app.css`):

| Token        | Value (Light)   | Role                                                |
| :----------- | :-------------- | :-------------------------------------------------- |
| `canvas`     | Soft Gray-Blue  | The app background that holds the content islands.  |
| `background` | Pure White      | The surface for reading content (cards, posts).     |
| `primary`    | Deep Blue/Slate | Primary actions and branding.                       |
| `foreground` | Deep Slate      | High-legibility text color.                         |
| `dusty-*`    | Muted Teal/Cyan | The unique brand accent for non-primary highlights. |

**Usage Rule:**

- **Avoid Pure Black**: Always use the defined `foreground` or deeply saturated slate/dusty tones.
- **Soft Backgrounds**: Use `canvas` for the app shell to create depth against the white content areas.

### Dark Mode Strategy (Automatic Inversion)

The system relies on **CSS Semantic Variable Swaps** logic defined in `app.css`.

- **Mechanism**: The `.dark` class triggers a re-definition of semantic variables (e.g., `--background`, `--primary`) using inverted OKLCH values.
- **Dusty Palette**: The raw `dusty-*` scale is **static** (does not auto-flip). To support dark mode, avoid distinct `dusty-*` classes for backgrounds/text; use the semantic wrappers like `primary`, `muted`, or `accent` which map to the correct tones in both modes.

### Typography

**Font Family:**

- **Primary**: `"Wanted Sans Variable"` (or system-ui fallbacks).
- **Style**: highly legible, neutral, friendly.
- **Implementation**: strict usage of `text-base`, `text-sm`, etc., with `leading-relaxed` for body copy.

### Shape & Spacing

- **Soft Geometry**: Elements typically use intermediate border radii (e.g., `10px - 12px` / `0.625rem`)—neither fully square nor fully pill-shaped.
- **Container**: `max-w-[1440px]`. The layout is designed to be wide enough for sidebars but centered for focus.

---

## Component Styling & Patterns

### Layout & Surfaces

### Layout & Surfaces

**Sidebar Backdrop Styling:**
The design utilizes `.snb-backdrop-left` and `.snb-backdrop-right` classes primarily for **visual separation and depth**, not as the main layout grid.

- **Decoration Only**: These are absolute-positioned elements (`z-index: -10`) that provide the background color (`bg-canvas`) and borders for the sidebar areas.
- **Visual Nuance**: On large screens (1440px+), they add subtle rounded corners (`rounded-tl-xl` / `rounded-tr-xl`) and inset shadows to create a polished "layer" effect behind the sidebar content.

### UI Elements

**Card-Based Structure**:

- Content is strictly separated from the background canvas.
- **Main List Card**: `bg-white rounded-xl shadow-sm border border-border`.
- **User Profile Card**: `bg-white rounded-xl shadow-sm border border-border p-4`.

**Icon Badges**:

- Navigation items often feature an icon inside a small colored square/circle container (e.g., Orange icon on pale orange bg).
- Format: `flex items-center gap-2 p-2 rounded-lg hover:bg-muted`.

**List Items**:

- **Density**: Compact vertical padding (`py-2`).
- **Badges**: Comment counts uses small, pill-shaped badges (`text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600`).
- **New Indicator**: Small orange text/dot for new items.

**Global Defaults:**

- All elements inherit `border-border` and `outline-ring/50`.
- Body text defaults to `text-base leading-relaxed` (1.625 roughly), emphasizing readability.

---

## Responsive Strategy

**Philosophy: "Handheld Comfort."**
The design starts from a single-column constraints where content legibility is paramount. As screen real estate expands, we introduce "Cozy Islands" (Sidebars, Panels) rather than stretching the content.

### Adaptations

- **Navigation Structure**:
    - **Mobile**: Hidden or distinct "Drawer/Bottom" usage.
    - **Desktop**:
        - **Tablet/Laptop (`lg`+)**: Right sidebar appears.
        - **Wide (`2xl`+)**: Left SNB appears with backdrop styling.
- **Grid Evolution**:
    - `base`: **1 Column**. Full-width content cards.
    - `lg`: **2 Columns**. Content + Right Sidebar (Widgets).
    - `2xl` (1440px): **3 Columns**. Left Nav + Content + Right Widgets.
- **Density Control**:
    - On mobile, post lists may stack metadata to maintain touch target sizes (`min-h-[44px]`).
    - On desktop, metadata expands horizontally.

### Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px (Right Sidebar)
- `xl`: 1280px
- `2xl`: 1440px (Custom Config: Left Nav + 3-Col Grid)

---

## Implementation Notes

**Tech Stack:**

- **Framework**: SvelteKit.
- **Styling**: Tailwind CSS v4.
    - Configuration is in CSS (`@theme`, `@theme inline`).
    - No `tailwind.config.js`.

**Key Files:**

- `apps/web/src/app.css`: The source of truth for all tokens.
- `apps/web/src/styles/layout.css`: Specific layout rules (SNB).

**Best Practices:**

1.  **Use Semantic Colors**: Always use `bg-background`, `text-primary`, etc., instead of hardcoded hex values. This ensures Dark Mode works automatically.
2.  **Respect the "Dusty"**: When needing a custom color that isn't in semantic tokens, reach for the definitions in `@theme` (e.g., `var(--color-dusty-500)`).
3.  **Tailwind v4 Syntax**: Use the new clean syntax. No need for complex `config` modifications; add custom values directly in CSS if needed temporarily, or standard utility use.

---

## Interaction & Details

### Iconography

- **Library**: `lucide-svelte`
    - **Rationale**: Chosen for its clean, consistent rounded strokes that perfectly align with the "Soft Modern" and "Friendly" vibe.
- **Style Rules**:
    - **Stroke Width**: Strictly `1.5px` to `2px`. Avoid thick headers unless distinct.
    - **Caps/Joins**: Always `rounded`.
- **Usage**:
    - **Size**: Default to `w-4 h-4` (16px) or `w-5 h-5` (20px).
    - **Color**: rarely pure black. Use `text-dusty-600` or `text-muted-foreground`. Active states can be `text-primary`.

### Micro-interactions (Motion)

**Philosophy: "Felt, not seen."**
Animations should be fast enough to feel responsive but smooth enough to feel premium.

- **Standard Transition**:
    - `transition-all duration-200 ease-out`
- **Hover Effects**:
    - **Buttons/Cards**: Slight background shift (`hover:bg-muted`) or subtle lift (`hover:-translate-y-0.5`).
    - **Links**: Color shift with underline (optional).
- **Active/Click**:
    - Tactile feedback: `active:scale-[0.98]`.

### Empty States (No Data)

**Philosophy: "Inviting Spaces."**
An empty list is not an error; it's an opportunity for action. Never leave a user staring at a blank void.

**Composition**:

1.  **Visual**: A soft, muted illustration or icon (e.g., a dusty-colored ghost or open box).
2.  **Message**: Friendly, conversational text.
    - _Bad_: "No data found."
    - _Good_: "It's quiet here... Start the conversation?"
3.  **Action**: A clear Call-to-Action (CTA) button to create the content.
    </design-system>
