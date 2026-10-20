# Brand Guidelines - Topi

## Visual Identity
Topi is a premium personal finance application designed to be vibrant, clean, and highly intuitive. The design language focuses on clarity, trust, and a modern aesthetic.

## Color Palette

### Primary Colors
- **Topi Blue**: `#5266EB`
  - Used for primary buttons, active states, and branding accents.
- **Background Slate**: `bg-slate-50` / `bg-white`
  - Used for page backgrounds and cards to maintain a clean look.

### Semantic Colors
- **Income (Green)**: `text-green-600` / `bg-green-50`
  - Used for income transactions, positive balances, and "Ingresos" labels.
- **Expense (Red)**: `text-red-600` / `bg-red-50`
  - Used for expense transactions, limits, and "Gastos" labels.
- **Grays**:
  - `text-gray-900`: Headings and primary text.
  - `text-gray-500`: Secondary text and labels.
  - `border-gray-100/200`: Subtle borders for cards and dividers.

## Typography
- **Primary Font**: **Inter**
  - A clean, sans-serif typeface that ensures readability across all devices.
  - Weights: `font-medium` for buttons, `font-bold/black` for numbers and headings.

## UI Components & Patterns

### Cards & Containers
- **Border Radius**: Always use rounded corners.
  - `rounded-2xl` (16px) for main cards and dashboard sections.
  - `rounded-xl` (12px) for buttons and smaller containers.
- **Shadows**: Use subtle shadows (`shadow-sm` or `shadow-md`) to create depth without clutter.

### Icons & Imagery
- **Icons**: Use **Heroicons** (Solid v20 for small actions, Outline v24 for navigation/status).
- **Emojis**: Use **Apple-style emojis** (via `emoji-picker-react`) for category identification to add a personal and friendly touch.

### Interactions
- **Micro-animations**: Elements should feel alive. Use `transition-all duration-200` with subtle transforms like `hover:-translate-y-1` or `hover:shadow-lg`.
- **Active States**: Mobile elements should use `active:bg-slate-50` or similar for immediate haptic-like feedback.

## Design Principles
1. **Clarity First**: Financial data must be easy to scan. Use large, bold numbers (`text-2xl font-black`) for totals.
2. **Whitespace**: Don't crowd the interface. Use generous padding (`p-6`, `p-8`) to let the data breathe.
3. **Consistency**: Follow the existing modal and grid patterns found in the dashboard components.
