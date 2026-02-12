// AI Conversation Navigator v7.0 — Firefox Extension Content Script
// Injects navigation UI into AI chat sites (both regular tabs and sidebar iframe)

(function() {
    'use strict';

    // Prevent double-injection
    if (window.__aiNavLoaded) return;
    window.__aiNavLoaded = true;

    // ============================================================
    // SITE DETECTION
    // ============================================================

    const SITE = {
        CLAUDE: 'claude',
        CHATGPT: 'chatgpt',
        GROK: 'grok',
        GEMINI: 'gemini'
    };

    function detectSite() {
        const hostname = window.location.hostname;
        if (hostname.includes('claude.ai')) return SITE.CLAUDE;
        if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) return SITE.CHATGPT;
        if (hostname.includes('grok.com')) return SITE.GROK;
        if (hostname.includes('gemini.google.com')) return SITE.GEMINI;
        return null;
    }

    const currentSite = detectSite();
    if (!currentSite) return;

    // Detect if we're inside our sidebar iframe
    const isInSidebar = (window !== window.top);

    // ============================================================
    // THEME & ICONS (definitions only — DOM injection deferred to init)
    // ============================================================

    const THEME = {
        [SITE.CLAUDE]:  { accent: '#d97706', accentHover: '#b45309', textColor: 'white' },
        [SITE.CHATGPT]: { accent: '#6e6e6e', accentHover: '#555555', textColor: 'white' },
        [SITE.GROK]:    { accent: '#dc2626', accentHover: '#b91c1c', textColor: 'white' },
        [SITE.GEMINI]:  { accent: '#4285f4', accentHover: '#3367d6', textColor: 'white' }
    };

    const ICONS = {
        [SITE.CLAUDE]:  '\u2733',  // ✳
        [SITE.CHATGPT]: '\u23E3',  // ⏣
        [SITE.GROK]:    'X',
        [SITE.GEMINI]:  '\u2726'   // ✦
    };

    const TITLES = {
        [SITE.CLAUDE]:  'Claude',
        [SITE.CHATGPT]: 'ChatGPT',
        [SITE.GROK]:    'Grok',
        [SITE.GEMINI]:  'Gemini'
    };

    const theme = THEME[currentSite];
    const siteIcon = ICONS[currentSite];
    const siteTitle = TITLES[currentSite];

    // ============================================================
    // APPLY DYNAMIC THEME COLORS VIA INLINE STYLE ELEMENT
    // (CSS file handles layout, this handles per-site colors)
    // ============================================================

    const themeStyle = document.createElement('style');
    themeStyle.textContent = `
        #ai-nav-toggle {
            background: ${theme.accent} !important;
            color: ${theme.textColor} !important;
        }
        #ai-nav-toggle:hover {
            background: ${theme.accentHover} !important;
        }
        .ai-nav-item {
            border-left-color: ${theme.accent} !important;
        }
        .ai-nav-item:hover {
            border-left-color: ${theme.accentHover} !important;
        }
        .ai-nav-number {
            color: ${theme.accent} !important;
        }
        @keyframes ai-nav-highlight {
            0% { outline-color: ${theme.accent}; }
            100% { outline-color: transparent; }
        }
    `;

    // ============================================================
    // DOM CREATION HELPER (Trusted Types safe — no innerHTML)
    // ============================================================
    // DOM CREATION HELPER (Trusted Types safe — no innerHTML)
    // ============================================================

    function createElement(tag, attrs, children) {
        const el = document.createElement(tag);
        if (attrs) {
            for (const [key, value] of Object.entries(attrs)) {
                if (key === 'className') {
                    el.className = value;
                } else if (key === 'textContent') {
                    el.textContent = value;
                } else if (key.startsWith('on') && typeof value === 'function') {
                    el.addEventListener(key.substring(2).toLowerCase(), value);
                } else {
                    el.setAttribute(key, value);
                }
            }
        }
        if (children) {
            if (!Array.isArray(children)) children = [children];
            for (const child of children) {
                if (typeof child === 'string') {
                    el.appendChild(document.createTextNode(child));
                } else if (child) {
                    el.appendChild(child);
                }
            }
        }
        return el;
    }

    // ============================================================
    // GET USER MESSAGES (platform-specific selectors)
    // ============================================================

    function getUserMessages() {
        let messages = [];

        if (currentSite === SITE.CLAUDE) {
            // Primary: current data-testid attribute for user messages
            messages = document.querySelectorAll('[data-testid="user-message"]');
            // Fallback: class-based selector used in some Claude UI versions
            if (messages.length === 0) {
                messages = document.querySelectorAll('.font-user-message');
            }
            // Fallback: older indexed data-testid (user-human-turn-0, user-human-turn-1, etc.)
            if (messages.length === 0) {
                messages = document.querySelectorAll('[data-testid^="user-human-turn"]');
            }
        }
        else if (currentSite === SITE.CHATGPT) {
            messages = document.querySelectorAll('[data-message-author-role="user"]');
        }
        else if (currentSite === SITE.GROK) {
            // Primary: Grok uses Tailwind classes — user messages have items-end alignment
            messages = document.querySelectorAll('div.message-row.items-end');
            // Fallback: try broader message-row detection if Tailwind classes change
            if (messages.length === 0) {
                var allRows = document.querySelectorAll('div.message-row');
                var userRows = [];
                allRows.forEach(function(row) {
                    // User messages are right-aligned (items-end) or lack bot indicators
                    if (!row.classList.contains('items-start')) {
                        userRows.push(row);
                    }
                });
                if (userRows.length > 0) messages = userRows;
            }
            // Fallback: older message-bubble selector
            if (messages.length === 0) {
                messages = document.querySelectorAll('div.message-bubble');
            }
        }
        else if (currentSite === SITE.GEMINI) {
            messages = document.querySelectorAll('div.query-text');
            if (messages.length === 0) {
                messages = document.querySelectorAll('.query-text-line');
            }
            if (messages.length === 0) {
                messages = document.querySelectorAll('p.query-text-line');
            }
        }

        return messages;
    }

    // ============================================================
    // TEXT EXTRACTION & SUMMARY
    // ============================================================

    function extractSummary(text, maxLength) {
        maxLength = maxLength || 80;
        text = text.trim().replace(/\s+/g, ' ');

        // Try to find a question
        const questionMatch = text.match(/[^.!?]*\?/);
        if (questionMatch && questionMatch[0].trim().length > 10) {
            let q = questionMatch[0].trim();
            return q.length > maxLength ? q.substring(0, maxLength) + '...' : q;
        }

        // First meaningful sentence
        const firstSentence = text.split(/[.!?\n]/)[0].trim();
        if (firstSentence.length > 10) {
            return firstSentence.length > maxLength ? firstSentence.substring(0, maxLength) + '...' : firstSentence;
        }

        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // ============================================================
    // UI COMPONENTS
    // ============================================================

    let isOpen = false;

    function handleToggleClick() {
        isOpen = !isOpen;
        const toggle = document.getElementById('ai-nav-toggle');
        const panel = document.getElementById('ai-nav-panel');
        if (toggle) toggle.classList.toggle('open', isOpen);
        if (panel) panel.classList.toggle('open', isOpen);
        if (isOpen) scanConversation();
    }

    function createToggle() {
        return createElement('button', { id: 'ai-nav-toggle', onClick: handleToggleClick }, [
            document.createTextNode(siteIcon),
            createElement('span', { className: 'ai-nav-expand-text', textContent: 'Navigate' })
        ]);
    }

    function createPanel() {
        const header = createElement('div', { id: 'ai-nav-header' }, [
            createElement('h3', null, [siteIcon + ' ' + siteTitle + ' Navigator']),
            createElement('button', {
                id: 'ai-nav-refresh',
                textContent: '\u21BB Refresh',
                onClick: scanConversation
            })
        ]);

        const stats = createElement('div', { id: 'ai-nav-stats', textContent: 'Click to scan conversation' });
        const list = createElement('div', { id: 'ai-nav-list' });

        return createElement('div', { id: 'ai-nav-panel' }, [header, stats, list]);
    }

    function createNavItem(messageEl, index, text) {
        const summary = extractSummary(text);
        const item = createElement('div', {
            className: 'ai-nav-item',
            onClick: function() {
                messageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                messageEl.classList.remove('ai-nav-highlight');
                void messageEl.offsetWidth; // Force reflow
                messageEl.classList.add('ai-nav-highlight');
            }
        }, [
            createElement('span', { className: 'ai-nav-number', textContent: 'Q' + (index + 1) }),
            createElement('span', { className: 'ai-nav-text', textContent: summary })
        ]);
        return item;
    }

    // ============================================================
    // SCAN CONVERSATION
    // ============================================================

    function scanConversation() {
        const list = document.getElementById('ai-nav-list');
        const stats = document.getElementById('ai-nav-stats');
        if (!list || !stats) return;

        // Clear existing items
        while (list.firstChild) {
            list.removeChild(list.firstChild);
        }

        const messages = getUserMessages();

        if (messages.length === 0) {
            const emptyMsg = createElement('div', { id: 'ai-nav-empty' });
            emptyMsg.appendChild(document.createTextNode('No messages found yet.'));
            emptyMsg.appendChild(createElement('br'));
            emptyMsg.appendChild(createElement('br'));
            emptyMsg.appendChild(document.createTextNode('Start a conversation and click refresh!'));
            emptyMsg.appendChild(createElement('br'));
            emptyMsg.appendChild(createElement('br'));
            emptyMsg.appendChild(createElement('small', null, [
                'If messages exist but aren\'t detected,',
                createElement('br'),
                'the site\'s structure may have changed.'
            ]));
            list.appendChild(emptyMsg);
            stats.textContent = '0 questions found';
            return;
        }

        stats.textContent = messages.length + ' question' + (messages.length !== 1 ? 's' : '') + ' found';

        messages.forEach(function(msg, index) {
            const text = msg.textContent || msg.innerText || '';
            if (!text.trim()) return;
            list.appendChild(createNavItem(msg, index, text));
        });
    }

    // ============================================================
    // DOM GUARDIAN (critical for Gemini SPA behavior)
    // ============================================================

    function ensureElementsExist() {
        if (!document.body) return;

        var toggle = document.getElementById('ai-nav-toggle');
        var panel = document.getElementById('ai-nav-panel');

        if (!toggle) {
            toggle = createToggle();
            // Restore open state if panel is still there and open
            if (isOpen) toggle.classList.add('open');
            document.body.appendChild(toggle);
        }

        if (!panel) {
            panel = createPanel();
            if (isOpen) {
                panel.classList.add('open');
                // Re-scan since we rebuilt the panel
                setTimeout(scanConversation, 300);
            }
            document.body.appendChild(panel);
        }
    }

    function startDOMGuardian() {
        // Watch for our elements being removed from body
        const observer = new MutationObserver(function(mutations) {
            let needsCheck = false;
            for (const mutation of mutations) {
                for (const removed of mutation.removedNodes) {
                    if (removed.id === 'ai-nav-toggle' || removed.id === 'ai-nav-panel' ||
                        (removed.querySelector && (removed.querySelector('#ai-nav-toggle') || removed.querySelector('#ai-nav-panel')))) {
                        needsCheck = true;
                        break;
                    }
                }
                if (needsCheck) break;
            }
            if (needsCheck) {
                setTimeout(ensureElementsExist, 50);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Also watch documentElement in case body itself is replaced
        const docObserver = new MutationObserver(function() {
            if (document.body && !document.getElementById('ai-nav-toggle')) {
                setTimeout(ensureElementsExist, 50);
            }
        });

        docObserver.observe(document.documentElement, { childList: true });
    }

    // ============================================================
    // CLAUDE SIDEBAR HELPER (sidebar iframe mode only)
    // In narrow iframes, Claude collapses its sidebar. We find it using
    // the confirmed selector `nav.flex` (from Claude-QoL extension) and
    // force it visible as an overlay when our hamburger is clicked.
    // Fallback: click Claude's recents link if nav isn't in the DOM.
    // ============================================================

    function setupClaudeSidebarHelper() {
        if (currentSite !== SITE.CLAUDE || !isInSidebar) return;

        console.log('[AI Nav] Claude sidebar helper active');

        var claudeSidebarOpen = false;
        var overlayEl = null;

        function getClaudeNav() {
            // Confirmed selector: Claude's sidebar root is nav.flex
            // It contains .overflow-y-auto with Starred & Recents sections
            var navs = document.querySelectorAll('nav');
            for (var i = 0; i < navs.length; i++) {
                // The sidebar nav contains a scrollable area with conversation links
                if (navs[i].classList.contains('flex') &&
                    navs[i].querySelector('.overflow-y-auto, [class*="overflow"]')) {
                    return navs[i];
                }
            }
            // Fallback: any nav.flex
            var navFlex = document.querySelector('nav.flex');
            if (navFlex) return navFlex;

            // Broader fallback: nav with multiple links (conversation history)
            for (var i = 0; i < navs.length; i++) {
                if (navs[i].querySelectorAll('a').length > 3) {
                    return navs[i];
                }
            }
            return null;
        }

        function openClaudeSidebar() {
            var nav = getClaudeNav();
            if (nav) {
                claudeSidebarOpen = true;
                nav.classList.add('ai-sidebar-forced-open');
                showOverlay();
                updateToggleIcon();
                console.log('[AI Nav] Claude sidebar opened via CSS force');
                return;
            }

            // Fallback: try clicking Claude's own recents link in the icon rail
            var recentsLink = document.querySelector('a[href="/recents"]') ||
                              document.querySelector('a[href*="recents"]');
            if (recentsLink) {
                console.log('[AI Nav] Clicking Claude recents link');
                recentsLink.click();
                return;
            }

            console.warn('[AI Nav] Claude sidebar nav not found in DOM');
        }

        function closeClaudeSidebar() {
            var nav = getClaudeNav();
            if (nav) {
                nav.classList.remove('ai-sidebar-forced-open');
            }
            claudeSidebarOpen = false;
            hideOverlay();
            updateToggleIcon();
        }

        function toggleClaudeSidebar() {
            if (claudeSidebarOpen) {
                closeClaudeSidebar();
            } else {
                openClaudeSidebar();
            }
        }

        function showOverlay() {
            ensureOverlay();
            if (overlayEl) overlayEl.classList.add('visible');
        }

        function hideOverlay() {
            if (overlayEl) overlayEl.classList.remove('visible');
        }

        function updateToggleIcon() {
            var btn = document.getElementById('ai-claude-sidebar-btn');
            if (btn) {
                btn.textContent = claudeSidebarOpen ? '\u2715' : '\u2630';
            }
        }

        function ensureToggle() {
            if (document.getElementById('ai-claude-sidebar-btn')) return;
            if (!document.body) return;

            var btn = createElement('button', {
                id: 'ai-claude-sidebar-btn',
                textContent: '\u2630',
                onClick: function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleClaudeSidebar();
                }
            });

            document.body.appendChild(btn);
            console.log('[AI Nav] Claude sidebar toggle button injected');
        }

        function ensureOverlay() {
            if (document.getElementById('ai-claude-sidebar-overlay')) {
                overlayEl = document.getElementById('ai-claude-sidebar-overlay');
                return;
            }
            if (!document.body) return;

            overlayEl = document.createElement('div');
            overlayEl.id = 'ai-claude-sidebar-overlay';
            overlayEl.addEventListener('click', closeClaudeSidebar);
            document.body.appendChild(overlayEl);
        }

        // Watch for Claude re-rendering (React may remove our button)
        var navObserver = new MutationObserver(function() {
            ensureToggle();
            // Re-apply forced-open if sidebar should be open
            if (claudeSidebarOpen) {
                var nav = getClaudeNav();
                if (nav && !nav.classList.contains('ai-sidebar-forced-open')) {
                    nav.classList.add('ai-sidebar-forced-open');
                }
            }
        });

        if (document.body) {
            navObserver.observe(document.body, { childList: true, subtree: true });
        }

        // Auto-close when user clicks a conversation link inside the sidebar
        document.addEventListener('click', function(e) {
            if (!claudeSidebarOpen) return;
            var nav = getClaudeNav();
            if (!nav) return;
            if (nav.contains(e.target) && e.target.closest('a')) {
                setTimeout(closeClaudeSidebar, 300);
            }
        });

        // Initial setup
        ensureToggle();
        ensureOverlay();

        // Periodic health check
        setInterval(function() {
            ensureToggle();
            if (!document.getElementById('ai-claude-sidebar-overlay')) {
                ensureOverlay();
            }
        }, 2000);

        // Visible diagnostic — shows debug info on page since sidebar
        // iframe can't be right-click inspected. Remove after debugging.
        setTimeout(function() {
            var info = [];
            var nav = getClaudeNav();
            if (nav) {
                var computed = window.getComputedStyle(nav);
                var rect = nav.getBoundingClientRect();
                info.push('FOUND nav.flex!');
                info.push('classes: ' + nav.className.substring(0, 80));
                info.push('display: ' + computed.display);
                info.push('visibility: ' + computed.visibility);
                info.push('transform: ' + computed.transform);
                info.push('width: ' + computed.width);
                info.push('rect: ' + Math.round(rect.left) + ',' + Math.round(rect.top) + ' ' + Math.round(rect.width) + 'x' + Math.round(rect.height));
            } else {
                info.push('nav.flex NOT FOUND');
                var navs = document.querySelectorAll('nav');
                info.push('Total <nav> elements: ' + navs.length);
                for (var i = 0; i < navs.length; i++) {
                    var r = navs[i].getBoundingClientRect();
                    info.push('nav[' + i + ']: cls="' + navs[i].className.substring(0, 60) + '" children=' + navs[i].children.length + ' links=' + navs[i].querySelectorAll('a').length + ' rect=' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
                }
                // Also check for aside elements and any sidebar-like containers
                var asides = document.querySelectorAll('aside');
                info.push('Total <aside> elements: ' + asides.length);
                for (var i = 0; i < asides.length; i++) {
                    var r = asides[i].getBoundingClientRect();
                    info.push('aside[' + i + ']: cls="' + asides[i].className.substring(0, 60) + '" children=' + asides[i].children.length + ' rect=' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
                }
                // Check for recents links
                var recents = document.querySelector('a[href*="recents"]');
                info.push('a[href*="recents"]: ' + (recents ? 'FOUND href=' + recents.getAttribute('href') : 'NOT FOUND'));
            }

            // Show as a visible overlay on the page
            var debugEl = document.createElement('div');
            debugEl.id = 'ai-nav-debug';
            debugEl.style.cssText = 'position:fixed;bottom:10px;left:10px;right:10px;z-index:2147483647;background:#000;color:#0f0;font:11px/1.5 monospace;padding:10px;border-radius:6px;max-height:40vh;overflow-y:auto;white-space:pre-wrap;opacity:0.95;pointer-events:auto;';
            debugEl.textContent = '[AI Nav Debug]\n' + info.join('\n');
            // Add close button
            var closeBtn = document.createElement('span');
            closeBtn.textContent = ' [X close]';
            closeBtn.style.cssText = 'color:#f55;cursor:pointer;float:right;';
            closeBtn.onclick = function() { debugEl.remove(); };
            debugEl.prepend(closeBtn);
            document.body.appendChild(debugEl);
        }, 3000);
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    function init() {
        if (!document.body) {
            setTimeout(init, 200);
            return;
        }

        // Inject theme styles and mark sidebar mode
        document.head.appendChild(themeStyle);
        if (isInSidebar) {
            document.body.classList.add('ai-nav-in-sidebar');
        }

        document.body.appendChild(createToggle());
        document.body.appendChild(createPanel());

        // Start DOM Guardian
        startDOMGuardian();

        // Claude sidebar helper (only runs on Claude + sidebar mode)
        setupClaudeSidebarHelper();

        // SPA navigation hooks (all platforms — React/SPA apps can wipe our elements)
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function() {
            originalPushState.apply(this, arguments);
            setTimeout(ensureElementsExist, 500);
        };
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            setTimeout(ensureElementsExist, 500);
        };

        window.addEventListener('popstate', function() {
            setTimeout(ensureElementsExist, 500);
        });

        // Periodic health check for ALL platforms
        // More frequent in sidebar mode since Claude is more aggressive about re-rendering there
        var healthCheckInterval = isInSidebar ? 1500 : 3000;
        setInterval(ensureElementsExist, healthCheckInterval);

        // Initial scan after page settles
        setTimeout(scanConversation, 2000);

        console.log('AI Conversation Navigator v7.0 loaded for ' + siteTitle +
                    (isInSidebar ? ' (sidebar mode)' : ' (tab mode)') + '!');
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
