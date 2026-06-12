# AutoBiology Docs UI Redesign Spec

## 1. Background
The current AutoBiology usage documentation (hosted on GitHub Pages) uses an outdated UI layout and typography that feels unpolished and user-unfriendly. The goal is to refactor the UI to a "Professional & Rigorous" style (inspired by Stripe/Notion), improving readability, trust, and usability.

## 2. Design Principles
- **Style**: Stripe/Notion-inspired. High contrast, clean, professional.
- **Layout**: Sticky top navigation bar + fixed left sidebar.
- **Typography**: System sans-serif fonts, optimized line heights, and distinct heading hierarchy.
- **Visuals**: Removal of heavy box shadows, using subtle borders (`1px solid #e6e6e6`) and large amounts of whitespace for separation.

## 3. Implementation Details

### 3.1 Color Palette & CSS Variables
The `style.css` will be rewritten using a new set of CSS variables:
- **Backgrounds**: `--bg-main: #ffffff`, `--bg-sidebar: #f7f9fc`, `--bg-code: #f4f6f8`
- **Text**: `--text-primary: #0a2540`, `--text-secondary: #425466`, `--text-muted: #8792a2`
- **Accents**: `--accent: #635bff` (Indigo/Purple), `--border: #e6e6e6`, `--border-light: #f0f0f0`
- **Fonts**: `--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

### 3.2 HTML Layout (`_layouts/default.html`)
- **Header (`.site-header`)**:
  - Sticky at the top (`position: sticky`).
  - Contains Brand Logo on the left.
  - Contains navigation links (English, 中文, npm, GitHub) on the right.
  - Subtle bottom border, no heavy shadow.
- **Container (`.page-shell`)**:
  - Max width constrained (e.g., `1200px`) and centered.
  - Two columns: Sidebar (`250px`) and Content (`minmax(0, 1fr)`).
- **Sidebar (`.sidebar`)**:
  - Fixed position relative to viewport or sticky container.
  - Links have subtle hover states (`background-color: #f0f5fa`).
  - Active links (current page) have a left-border highlight using `--accent`.
- **Content (`.content`)**:
  - Max reading width applied to text blocks (e.g., `800px`) to prevent eye fatigue.
  - Padding adjusted for spacious reading experience.

### 3.3 Typography and Markdown Elements (`style.css`)
- **Headings (h1 - h4)**: Darker color (`--text-primary`), tighter letter spacing.
- **Paragraphs/Lists**: High legibility with `line-height: 1.7` and color `--text-secondary`.
- **Code Blocks (`pre`, `code`)**:
  - Inline code: Light gray background, slightly smaller text, maybe an accent color.
  - Block code: Clean light-gray/off-white background with subtle border, OR pure dark `#0d1117` background. (We will use a clean light theme for code blocks to match the Notion vibe, or dark if it provides better contrast).
- **Blockquotes**: Left border highlighted with `--accent`, subtle gray background.
- **Tables**: Full width, `border-collapse`, light borders, zebra striping or distinct header background.
- **Responsive Design**: On mobile (`max-width: 768px`), sidebar becomes a top-level section or is hidden behind a menu, header items wrap gracefully.

## 4. Scope & Dependencies
- **Files Affected**:
  - `docs/_layouts/default.html`
  - `docs/assets/css/style.css`
- **No new dependencies**: This is a pure HTML/CSS refactoring of the existing Jekyll setup.
- **Content untouched**: Markdown files in `docs/` and `docs/zh/` remain unmodified.
