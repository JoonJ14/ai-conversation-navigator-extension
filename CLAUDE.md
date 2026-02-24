# CLAUDE.md — AI Assistant Guide

This file provides context for AI assistants working on the AI Conversation Navigator Firefox Extension codebase.

## Project Overview

A Firefox sidebar extension that loads Claude, ChatGPT, Grok, and Gemini in a tabbed iframe panel, with a conversation navigator overlay that lists all user questions and lets you jump to any one. Current version: **7.0** (manifest), with changelog entries through **7.2**.

- **License:** MIT
- **Author:** joonj14
- **Manifest version:** V2 (Firefox's required format for `sidebar_action`)
- **Companion project:** [AI Conversation Navigator userscript](https://github.com/joonj14/ai-conversation-navigator) — same nav functionality as a Tampermonkey/Greasemonkey script

## Repository Structure

```
ai-conversation-navigator-extension/
├── manifest.json          # Extension manifest (permissions, content_scripts, sidebar_action)
├── background.js          # Strips X-Frame-Options / CSP frame-ancestors headers
├── sidebar.html           # Sidebar panel UI — provider tabs, toolbar, iframe
├── sidebar.js             # Provider switching, loading bar, toolbar buttons
├── content.js             # Navigator UI injected into AI chat pages (all platforms)
├── content.css            # Navigator styles + sidebar-mode compact overrides
├── icons/
│   ├── icon-16.png        # "Four Dots" logo at various sizes
│   ├── icon-32.png
│   └── icon-48.png
├── .github/workflows/
│   ├── claude.yml          # Claude Code PR assistant (responds to @claude mentions)
│   └── claude-code-review.yml  # Auto code review on PRs
├── README.md              # User-facing docs
├── CHANGELOG.md           # Detailed version history with architecture decisions
├── TROUBLESHOOTING.md     # Exhaustive engineering log of every approach tried
├── WORKLOG.md             # Session-specific investigation notes
└── LICENSE                # MIT
```

## Architecture

### Two main components

1. **Sidebar Panel** (`sidebar.html` + `sidebar.js`)
   - Tabbed header with four provider buttons (Claude, ChatGPT, Grok, Gemini)
   - Single `<iframe id="ai-frame">` that loads whichever AI site is selected
   - Toolbar: "+ New Chat" and "↗ Open in Tab" buttons
   - Animated loading bar colored per-provider

2. **Content Script** (`content.js` + `content.css`)
   - Injected into all matched AI sites via `manifest.json` (`all_frames: true`)
   - Works in both regular browser tabs and the sidebar iframe
   - Detects platform via hostname, applies per-site theme and selectors
   - Creates a hover-expand toggle button on the right viewport edge
   - Opens a 280px navigation panel listing all user messages
   - Click any item to smooth-scroll + highlight animation

### Header Stripping (`background.js`)

AI sites set `X-Frame-Options` and `Content-Security-Policy: frame-ancestors` to block iframe embedding. The background script intercepts responses via `webRequest.onHeadersReceived` with `blocking` and strips these headers so sites load inside the sidebar iframe.

### Platform Detection and Selectors

| Platform | Hostname match | User message selectors (in priority order) | Theme color |
|----------|---------------|---------------------------------------------|-------------|
| Claude | `claude.ai` | `[data-testid="user-message"]` → `.font-user-message` → `[data-testid^="user-human-turn"]` | `#d97706` amber |
| ChatGPT | `chatgpt.com`, `chat.openai.com` | `[data-message-author-role="user"]` | `#6e6e6e` gray |
| Grok | `grok.com` | `div.message-row.items-end` → non-`items-start` rows → `div.message-bubble` | `#dc2626` red |
| Gemini | `gemini.google.com` | `div.query-text` → `.query-text-line` → `p.query-text-line` | `#4285f4` blue |

Selectors use a **cascading fallback** pattern — primary selector first, then fallbacks for older or alternate UI versions. When selectors break due to site updates, check the current DOM structure using browser DevTools and update `getUserMessages()` in `content.js`.

### Sidebar vs Tab Mode

The content script detects sidebar mode with `window !== window.top`. When in sidebar mode:
- Adds `ai-nav-in-sidebar` class to `<body>` for compact CSS overrides
- Runs health checks more frequently (1.5s vs 3s)
- On Claude: activates the Claude Sidebar Helper (hamburger menu + custom sidebar)

### DOM Guardian

A `MutationObserver` watches for the extension's injected elements being removed (critical for Gemini's aggressive SPA DOM rebuilding). If removed, elements are re-injected after 50ms. Also hooks `history.pushState`, `history.replaceState`, and `popstate` to survive SPA navigations. A periodic health check (`setInterval`) serves as a fallback.

### Claude Sidebar Helper

Claude's native sidebar collapses in narrow iframes. After 12 approaches (documented extensively in `TROUBLESHOOTING.md`), the working solution is:
- Extract link data (href + text) from Claude's `<nav>` during the ~1.2s window before React unmounts it
- Build a custom sidebar overlay with fresh `document.createElement()` calls and inline styles
- Toggle via a `☰` hamburger button at top-left
- This avoids all Tailwind CSS conflicts and dead React event handlers

### Trusted Types Compliance

Gemini enforces Trusted Types CSP. **All DOM manipulation must use `document.createElement()` — never use `innerHTML` or `insertAdjacentHTML`.** The `createElement(tag, attrs, children)` helper in `content.js` handles this.

## Key Conventions

### Code Style
- **Vanilla JavaScript only** — no build tools, no bundler, no TypeScript, no frameworks
- Plain CSS — no preprocessors
- All content script code wrapped in an IIFE with `'use strict'`
- Double-injection guard: `window.__aiNavLoaded`
- `var` used in the Claude Sidebar Helper section (legacy pattern); `const`/`let` elsewhere
- DOM creation via the `createElement(tag, attrs, children)` helper — avoids innerHTML everywhere
- Inline styles preferred for injected UI that must resist external CSS interference
- `!important` on all content script CSS rules to win specificity wars with host sites

### File Conventions
- **No build step.** Files are loaded directly by Firefox as-is.
- Extension is loaded as a temporary add-on via `about:debugging` during development.
- No `package.json`, no `node_modules`, no tests, no linter config.
- All styling for the content script is split: layout in `content.css`, per-site dynamic colors in a `<style>` element created by `content.js`.

### Documentation Conventions
- `CHANGELOG.md` records every version with detailed architecture decisions and "what was tried" narratives
- `TROUBLESHOOTING.md` serves as both user troubleshooting guide and deep engineering reference — every approach tried is documented with code examples, results, and learnings
- `WORKLOG.md` captures session-specific investigation notes

## Development Workflow

### Loading the extension
1. Open Firefox, navigate to `about:debugging`
2. Click "This Firefox" → "Load Temporary Add-on"
3. Select `manifest.json` from the project root
4. Open the sidebar via the Four Dots icon

### Testing changes
- Edit files directly; reload extension at `about:debugging` to pick up changes
- For `content.js`/`content.css` changes: reload the AI site tab or sidebar iframe
- For `background.js` changes: reload the extension itself
- For `sidebar.html`/`sidebar.js` changes: close and reopen the sidebar
- Use Browser Console (`Ctrl+Shift+J`) to check for errors
- Look for log messages prefixed with `AI Conversation Navigator` or `[AI Nav]`

### No build/test/lint commands
There are no build, test, or lint commands. The project has no `package.json` and no build tooling. All files are loaded directly by Firefox.

### GitHub Actions
- `.github/workflows/claude.yml` — Claude Code action that responds to `@claude` mentions in issues/PRs
- `.github/workflows/claude-code-review.yml` — Automatic Claude code review on PRs

## Common Modification Scenarios

### Adding a new AI platform
1. Add URL pattern to `manifest.json` → `content_scripts.matches` and `background.js` → `TARGET_DOMAINS`
2. Add site constant and detection in `content.js` → `SITE` enum and `detectSite()`
3. Add theme colors, icon, and title to `THEME`, `ICONS`, `TITLES` objects
4. Add user message selector logic in `getUserMessages()`
5. Add provider button in `sidebar.html` header with `data-provider` and `data-url`
6. Add URLs to `NEW_CHAT_URLS` and `FULL_URLS` in `sidebar.js`
7. Add provider color to `COLORS` in `sidebar.js` and `.provider-btn.active` CSS in `sidebar.html`

### Updating a broken selector
1. Open the AI site in a regular browser tab
2. Use DevTools to inspect user message elements and find the current selector
3. Update the relevant branch in `getUserMessages()` in `content.js`
4. Keep old selectors as fallbacks below the new primary selector
5. Update the selector table in `TROUBLESHOOTING.md`

### Modifying the navigator UI
- Layout and structure: `content.css`
- Dynamic per-site colors: theme `<style>` element in `content.js`
- DOM creation: `createToggle()`, `createPanel()`, `createNavItem()` in `content.js`
- Sidebar-mode compact overrides: `.ai-nav-in-sidebar` rules in `content.css`

## Known Limitations

- **Claude sidebar collapse:** Claude's native sidebar is inaccessible in narrow iframes. The custom sidebar helper is the workaround. See `TROUBLESHOOTING.md` Section 2 for the full 12-approach investigation.
- **Temporary add-on:** Must be reloaded after each Firefox restart until published on AMO.
- **Manifest V2 only:** Firefox requires V2 for `sidebar_action`. A Chrome/Chromium port would need V3 migration.
- **Selector fragility:** AI platforms can change their DOM structure at any time, breaking message detection. Fallback selectors mitigate this but cannot prevent all breakage.
- **No cross-origin DOM access:** The sidebar panel (`moz-extension://`) cannot access the iframe's DOM directly due to same-origin policy. All interaction happens through the content script.
