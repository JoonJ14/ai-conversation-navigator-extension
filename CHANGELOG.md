# Changelog

All notable changes to the AI Conversation Navigator Firefox Extension are documented here.

This extension is a separate project from the [Tampermonkey userscript version](https://github.com/joonj14/ai-conversation-navigator). The extension adds a multi-AI sidebar panel on top of the core navigation functionality.

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
