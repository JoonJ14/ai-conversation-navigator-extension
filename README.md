# AI Conversation Navigator — Firefox Sidebar Extension

A Firefox extension that puts Claude, ChatGPT, Grok, and Gemini in your sidebar with a built-in conversation navigator. Quickly jump to any question in long AI conversations without scrolling.

I love firefox web browser's AI sidebar feature. Almost to a point it has became my primary interaction with those chat AI models, because I love being able to have them up on my side screen and look up something else it is referring to, follow guidelines it provided, multitask, or do something else as I am waiting for its response. Original plan was to just add the chat history navigate button we have created in another project, but I ran into challenges as it is firefox's own feature and it was hard to inject our separate code into it. So I just made a new extension. 

Right now, I am still working on some bugs and fixes, and when I deem it is up to my own standard, I will eventually turn this into real extension, not temporary add in as it is now. I do wonder if there would be easier way to do this all across different web browsers, because if I make it into extension, then people have to download it separately for firefox, chrome, safari, and others, so maybe there is better way. Maybe a program that could run all across differnet platforms, web browsers, or an application, or maybe a whole browser.. who knows. Anyway, stay tuned. 

## What It Does

- **Multi-AI Sidebar** — Switch between Claude, ChatGPT, Grok, and Gemini from a tabbed sidebar panel
- **Conversation Navigator** — Hover-expand button that opens a panel listing all your questions, click to jump to any one
- **Platform-Specific Theming** — Each AI provider gets its own accent color and icon
- **Toolbar Utilities** — "New Chat" and "Open in Tab" buttons for quick access

## Screenshots

*(Coming soon)*

## Installation

### From Source (Temporary Add-on)

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click **"This Firefox"** → **"Load Temporary Add-on"**
4. Select the `manifest.json` file from the downloaded folder
5. Click the extension icon in the sidebar to open **AI Chat**

### File Structure

```
ai-conversation-navigator-extension/
├── manifest.json        # Extension configuration
├── background.js        # Strips framing headers for iframe loading
├── sidebar.html         # Sidebar panel with provider tabs
├── sidebar.js           # Provider switching and toolbar logic
├── content.js           # Navigator UI injection (all platforms)
├── content.css          # Navigator styling with sidebar overrides
├── icons/
│   ├── icon-16.png      # Toolbar icon
│   ├── icon-32.png      # Menu icon
│   └── icon-48.png      # Add-ons manager icon
├── README.md
├── CHANGELOG.md
├── TROUBLESHOOTING.md
└── LICENSE
```

## How It Works

### Architecture

The extension has two main components:

**1. Sidebar Panel** (`sidebar.html` + `sidebar.js`)
- Provides a tabbed interface to switch between AI providers
- Loads each AI site in an iframe within the sidebar
- Includes toolbar with "New Chat" and "Open in Tab" buttons
- Loading bar animates in each provider's brand color

**2. Content Script** (`content.js` + `content.css`)
- Injected into all AI chat sites (both regular tabs and sidebar iframe)
- Detects which AI platform is loaded via hostname
- Creates a hover-expand toggle button on the right edge of the viewport
- Opens a navigation panel listing all user messages in the conversation
- Click any question to smooth-scroll to it with a highlight animation

### Header Stripping (`background.js`)

AI sites like Claude and ChatGPT set `X-Frame-Options` and `Content-Security-Policy: frame-ancestors` headers that prevent loading in iframes. The background script intercepts these responses and removes the framing restrictions so the sites can load in our sidebar iframe.

### Platform Detection

| Platform | Hostname | User Message Selector | Theme Color |
|----------|----------|----------------------|-------------|
| Claude | `claude.ai` | `[data-testid="user-human-turn"]` | `#d97706` (amber) |
| ChatGPT | `chatgpt.com` | `[data-message-author-role="user"]` | `#6e6e6e` (gray) |
| Grok | `grok.com` | `div.message-bubble` (filtered) | `#dc2626` (red) |
| Gemini | `gemini.google.com` | `div.query-text` | `#4285f4` (blue) |

### Gemini-Specific Handling

Gemini is a Single Page Application (SPA) that aggressively rebuilds its DOM during navigation. The extension includes:
- **DOM Guardian** — A MutationObserver that detects when our navigator elements are removed and re-injects them
- **SPA Navigation Hooks** — Intercepts `history.pushState` and `popstate` events to re-check element presence
- **Periodic Health Check** — Every 3 seconds, verifies elements still exist
- **Trusted Types Compliance** — All DOM manipulation uses `document.createElement()` instead of `innerHTML` to comply with Gemini's Content Security Policy

### Icon Choices

Each platform uses a Unicode symbol rather than official logos to avoid trademark issues:

| Platform | Icon | Reasoning |
|----------|------|-----------|
| Claude | ✳ (U+2733) | Eight-spoked asterisk — evokes Anthropic's starburst |
| ChatGPT | ⏣ (U+23E3) | Benzene ring — evokes OpenAI's hexagonal logo |
| Grok | X | Matches xAI / X branding |
| Gemini | ✦ (U+2726) | Four-pointed star — evokes Gemini's sparkle |

### Extension Icon

The extension uses a "Four Dots" logo — a dark rounded square containing four colored circles, one for each supported AI provider (blue for Gemini, red for Grok, amber for Claude, gray for ChatGPT).

## Usage

1. **Open the sidebar** — Click the Four Dots icon in Firefox's sidebar
2. **Switch providers** — Click the tabs at the top (✳ Claude, ⏣ ChatGPT, X Grok, ✦ Gemini)
3. **Navigate conversations** — Hover over the colored button on the right edge, click to open the navigator panel
4. **Jump to questions** — Click any listed question to scroll directly to it
5. **New Chat** — Click "+ New Chat" in the toolbar
6. **Open in Tab** — Click "↗ Open in Tab" to open the current AI in a full browser tab

## Compatibility

- **Firefox 109+** (requires `sidebar_action` API support)
- **Manifest V2** (Firefox's preferred format for sidebar extensions)
- Works on macOS, Linux, and Windows

## Relationship to Tampermonkey Version

This extension is a companion to the [AI Conversation Navigator userscript](https://github.com/joonj14/ai-conversation-navigator), which provides the same navigation functionality as a Tampermonkey/Greasemonkey userscript for use in regular browser tabs. The extension version adds the sidebar panel with multi-provider switching.

Features developed in the userscript version can be ported to this extension's `content.js`, and vice versa.

## Known Issues

- **Claude's sidebar panel collapses** in the extension iframe due to responsive CSS detecting narrow viewport width. Claude enters "mobile mode" and hides its chat history sidebar. The chat input and conversation still work normally. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for full details.
- **Temporary add-on** — Must be re-loaded after each Firefox restart (until published on AMO)

## Future Plans

- Publish on Firefox Add-ons (AMO) for permanent installation
- Add Search functionality to find text within conversations
- Add Settings panel for customization
- Investigate Claude sidebar toggle button visibility in iframe
- Chrome/Chromium port (would require Manifest V3 migration)

## License

MIT License — see [LICENSE](LICENSE) file.
