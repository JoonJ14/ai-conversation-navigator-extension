# Changelog

All notable changes to the AI Conversation Navigator Firefox Extension are documented here.

This extension is a separate project from the [Tampermonkey userscript version](https://github.com/joonj14/ai-conversation-navigator). The extension adds a multi-AI sidebar panel on top of the core navigation functionality.

## [7.1] — 2026-02-12

### Claude Sidebar Navigation — Custom UI Approach

#### Problem
When Claude.ai loads inside the extension's narrow sidebar iframe, Claude's native sidebar (chat history, navigation links) collapses into mobile mode and becomes inaccessible. Previous approaches (documented in TROUBLESHOOTING.md, Approaches 1-8) tried to force the sidebar open or spoof viewport width, all of which failed or were too fragile.

#### What Was Tried This Session

**Approach 9 — Standalone toggle button:**
Injected a ☰ hamburger button that tried to trigger Claude's native sidebar by programmatically clicking Claude's own toggle button or force-showing the `<nav>` element. Failed because React synthetic events don't respond to programmatic `.click()` calls, and making the nav visible without React state produced an empty shell.

**Approach 10 — Deep clone of nav DOM:**
Used `MutationObserver` to detect and `cloneNode(true)` Claude's `<nav>` during the ~1.2 second window when it's fully rendered before collapse. Injected the clone as a fixed overlay sidebar. The clone looked **pixel-perfect** — visually identical to Claude's native sidebar. However, **no buttons or links worked**. Root cause: `cloneNode` copies DOM structure and CSS classes but NOT React event handlers. Claude's Tailwind CSS (thousands of utility classes) also continued applying to the cloned elements, creating multiple layers of click-blocking behavior (pointer-events:none, z-index stacking, pseudo-elements, overflow clipping) that couldn't be fully overridden even with aggressive cleanup.

**Approach 11 — Custom UI from extracted link data (shipped):**
Instead of cloning the DOM, extract only the link data (href + text) from the nav during the 1.2s window, then build a completely new sidebar using fresh `document.createElement()` calls with pure inline styles. Zero Tailwind class inheritance, zero dead React handlers. All links are real `<a>` tags with real `href` attributes that use standard browser navigation.

#### Changes
- Replaced nav DOM cloning logic with link data extraction (`captureNavLinks()`)
- Built custom sidebar UI generator (`showSidebar()`) with:
  - Fixed panel (260px, dark theme, scrollable)
  - "Claude" header
  - Navigation links extracted from Claude's nav (e.g., `/new`, `/recents`, `/projects`)
  - Hover effects via inline event handlers
  - Backdrop overlay that closes sidebar on click
  - Auto-close after clicking a link
- Hamburger toggle button (☰) positioned at top-left of Claude pages in sidebar mode
- Updated TROUBLESHOOTING.md with Approaches 9, 10, 11 and 5 new technical learnings

#### Architecture Decision
Chose custom UI over native nav cloning because:
1. **URL routes are stable** — `/new`, `/recents`, `/projects` are part of Claude's app architecture and change far less often than CSS classes or DOM structure
2. **Zero CSS conflicts** — fresh elements with inline styles are immune to Tailwind interference
3. **Full control** — can match Claude's visual design on our own terms without fighting inherited styles
4. **No React dependency** — doesn't rely on React state, synthetic events, or component lifecycle

#### Status
Functionally complete — all navigation links work. Visual polish (matching Claude's exact sidebar design, adding icons, profile button) planned for next session before merging to main.

---
## [7.2] — 2026-02-13

### Claude Sidebar Investigation + Baseline Restore

#### Investigation Work
- Deep investigation into Claude's iframe behavior was performed in extension sidebar mode.
- Confirmed that Claude native elements (`pin-sidebar-toggle`, left rail `nav`) can appear, but are unstable across hydration/rerender cycles.
- Tested multiple native-only approaches:
  - toggle selector targeting and ranking
  - state reconciliation (`Open sidebar`/`Close sidebar`)
  - keyboard shortcut fallback
  - visibility hit-testing and rail forcing
  - frame-context filtering and deep DOM lookup
- Result: native in-chat rail persistence in `/new` remains unreliable in this iframe context.

#### Product Decision
- Restored the previously stable custom Claude fallback helper as active behavior.
- Kept investigation outcomes documented in `WORKLOG.md` and `TROUBLESHOOTING.md` for future attempts.

## [7.0] — 2026-02-09

### Initial Extension Release

This is the first release of the Firefox sidebar extension, built on top of the v6.0 userscript navigation code.

#### Features
- **Multi-AI Sidebar Panel** — Tabbed interface to switch between Claude, ChatGPT, Grok, and Gemini
- **Conversation Navigator** — Hover-expand button with full question listing and smooth scroll-to navigation
- **Platform-Specific Themes** — Each AI provider has its own accent color (amber, gray, red, blue)
- **Platform-Specific Icons** — Unicode symbols for each platform (✳ ⏣ X ✦) avoiding trademark issues
- **Toolbar** — "New Chat" and "Open in Tab" utility buttons
- **Loading Bar** — Animated color bar matching current provider's brand color
- **DOM Guardian** — MutationObserver-based protection against Gemini's aggressive DOM rebuilding
- **SPA Navigation Hooks** — `pushState`/`popstate` interception for Gemini page transitions
- **Trusted Types Compliance** — All DOM creation uses `createElement()` for Gemini CSP compatibility
- **Header Stripping** — Background script removes `X-Frame-Options` and CSP `frame-ancestors` to enable iframe loading
- **Sidebar-Aware Layout** — Navigator panel uses compact 280px width in sidebar mode vs 280px in tab mode
- **Four Dots Logo** — Dark rounded square with four colored dots representing each AI provider

#### Architecture Decisions
- Used Firefox's `sidebar_action` API (Manifest V2) for native sidebar integration
- Content scripts injected with `all_frames: true` to work inside sidebar iframe
- Shared `content.js` codebase between tab mode and sidebar mode, with `ai-nav-in-sidebar` CSS class for layout differences
- Background script uses `webRequest.onHeadersReceived` with `blocking` to modify response headers before browser processes them

#### Files
- `manifest.json` — Extension manifest with sidebar_action, permissions, content_scripts
- `background.js` — Response header modification for iframe compatibility
- `sidebar.html` — Sidebar panel UI with provider tabs and toolbar
- `sidebar.js` — Provider switching, loading state, toolbar button handlers
- `content.js` — Full navigator ported from userscript v6.0 with sidebar awareness
- `content.css` — Navigator styles with sidebar-specific compact overrides
- `icons/` — Four Dots logo at 16px, 32px, 48px

---

## Version History (Userscript Origins)

The navigation functionality was originally developed as a Tampermonkey userscript through versions 1.0–6.0 before being adapted into this extension.

### v6.0 (Userscript) — 2026-02-07
- Hover-expand button design (icon-only → reveals "Navigate" on hover)
- Platform-specific Unicode icons replacing generic 📍 emoji
- Design chosen for future multi-button scalability (Search, Settings planned)

### v5.0 (Userscript) — 2026-02-07
- Fixed Gemini on Chrome: Trusted Types CSP blocking `innerHTML`
- Rewrote all DOM manipulation to use `createElement()` programmatically
- Added DOM Guardian with MutationObserver for Gemini SPA resilience
- Added `history.pushState`/`popstate` hooks for SPA navigation

### v4.0 (Userscript) — 2026-02-06
- Full multi-platform support: Claude, ChatGPT, Grok, Gemini
- Platform-specific DOM selectors for user message detection
- Platform-specific color themes
- Smart summary generation (extracts questions or first sentences)
- Auto-refresh and smooth scrolling with highlight animation

### v3.0 (Userscript) — 2026-02-06
- Added Grok and Gemini support
- Improved message detection with fallback selectors

### v2.0 (Userscript) — 2026-02-06
- Added ChatGPT support alongside Claude

### v1.0 (Userscript) — 2026-02-05
- Initial release, Claude-only
- Basic sidebar panel with question bookmarks
