# Worklog — Claude Sidebar Investigation

Date: 2026-02-13
Project: `ai-nav-extension`

## Objective
Make Claude's native in-chat sidebar (left rail + top-left toggle) reliably available inside the Firefox extension iframe, matching native web behavior.

## Conclusion (Today)
Claude native in-chat sidebar is not reliably stable in this iframe setup.

- Native controls/rail can appear briefly.
- Claude re-renders and state/layout desynchronizes in iframe mode.
- Both approaches (direct native toggle forcing and style/state reconciliation) remained unstable.
- Reliable native in-chat persistence was not achieved after repeated selector/state/style attempts.

## What Was Confirmed
- Native toggle exists when present: `button[data-testid="pin-sidebar-toggle"]` with `aria` switching `Open sidebar`/`Close sidebar`.
- Native rail exists in DOM at times (`nav` left rail), but visual persistence is inconsistent after hydration/rerenders.
- Generic selector paths can falsely hit composer `+` menu; those were removed.
- Bridge button now avoids generic menu matching.

## Current Behavior
- Code has been restored to the original custom Claude fallback helper (pre-investigation baseline):
  - `setupClaudeSidebarHelper()` builds a custom sidebar from captured Claude nav links.
  - Custom toggle button `#ai-claude-sidebar-btn` is used for that fallback behavior.
- Experimental native-only bridge/reconcile code from today was reverted from active code.
- Final architecture-level trial (wide virtual viewport + Rail/Split/Chat modes) was also tested and reverted after failure to keep native rail access stable.

## Key Decision
Treat native Claude in-chat rail persistence as non-reliable for now. Keep the custom fallback sidebar approach as the practical path.

## Files Touched
- `content.js`
- `content.css`
- `sidebar.html`
- `CHANGELOG.md`
- `TROUBLESHOOTING.md`
- `WORKLOG.md` (this file)

## Resume Commands
```bash
cd /home/joonj14/Desktop/side-projects/firefox-sidebar-extension/ai-nav-extension
git status
```

Reload extension:
1. Firefox `about:debugging` → This Firefox
2. Reload `AI Conversation Navigator`

## Recommended Next Steps
1. Keep custom Claude fallback menu as official behavior until a durable native method is found.
2. If revisiting native approach later, start from today’s findings in `TROUBLESHOOTING.md` (pin toggle/rerender evidence).
3. Document Claude limitation + fallback clearly in `README.md`.
4. Keep prior experimental fallback patch as historical reference:
   - `../previous-code-versions/claude-fallback-bridge.patch`
