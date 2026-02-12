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

        // In narrow/iframe viewports, Claude uses a mobile layout with no
        // persistent <nav>. The conversation list is behind Claude's own
        // "Toggle menu" button (aria-label="Toggle menu"). We proxy our
        // ☰ button to click Claude's native toggle instead of trying to
        // force a nonexistent nav element visible via CSS.

        // DEBUG: Interactive button tester.
        // Shows all buttons with [CLICK] links to test each one.
        var cachedBtnList = [];

        function dumpAllButtons() {
            var allBtns = document.querySelectorAll('button');
            cachedBtnList = [];
            for (var i = 0; i < allBtns.length; i++) {
                var b = allBtns[i];
                var r = b.getBoundingClientRect();
                if (r.width === 0 && r.height === 0) continue;
                // Skip our own buttons
                if (b.id === 'ai-claude-sidebar-btn' || b.id === 'ai-nav-toggle' || b.id === 'ai-nav-refresh') continue;
                cachedBtnList.push(b);
            }

            // Sort by Y then X
            cachedBtnList.sort(function(a, b) {
                var ra = a.getBoundingClientRect();
                var rb = b.getBoundingClientRect();
                return ra.top === rb.top ? ra.left - rb.left : ra.top - rb.top;
            });

            showInteractiveDebug();
        }

        function showInteractiveDebug() {
            var old = document.getElementById('ai-nav-debug');
            if (old) old.remove();

            var debugEl = document.createElement('div');
            debugEl.id = 'ai-nav-debug';
            debugEl.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#000;color:#0f0;font:11px/1.5 monospace;padding:10px;overflow-y:auto;';

            var closeBtn = document.createElement('div');
            closeBtn.textContent = '[X CLOSE]';
            closeBtn.style.cssText = 'color:#f55;cursor:pointer;font-size:14px;margin-bottom:8px;';
            closeBtn.onclick = function() { debugEl.remove(); };
            debugEl.appendChild(closeBtn);

            var title = document.createElement('div');
            title.textContent = 'Tap [CLICK #] to test a button. Close overlay first, then result shows after 800ms.';
            title.style.cssText = 'color:#ff0;margin-bottom:10px;';
            debugEl.appendChild(title);

            for (var i = 0; i < cachedBtnList.length; i++) {
                var b = cachedBtnList[i];
                var r = b.getBoundingClientRect();
                var text = (b.textContent || '').trim().substring(0, 25);
                var aria = b.getAttribute('aria-label') || '';

                var row = document.createElement('div');
                row.style.cssText = 'margin-bottom:6px;border-bottom:1px solid #333;padding-bottom:4px;';

                var clickLink = document.createElement('span');
                clickLink.textContent = '[CLICK ' + i + ']';
                clickLink.style.cssText = 'color:#0ff;cursor:pointer;text-decoration:underline;margin-right:8px;font-size:13px;';
                clickLink.setAttribute('data-idx', String(i));
                clickLink.onclick = function() {
                    var idx = parseInt(this.getAttribute('data-idx'));
                    testClickButton(idx);
                };
                row.appendChild(clickLink);

                var info = document.createElement('span');
                info.textContent = 'pos=' + Math.round(r.left) + ',' + Math.round(r.top) +
                    ' ' + Math.round(r.width) + 'x' + Math.round(r.height) +
                    ' text="' + text + '" aria="' + aria + '"';
                row.appendChild(info);

                debugEl.appendChild(row);
            }

            document.body.appendChild(debugEl);
        }

        function testClickButton(idx) {
            if (idx < 0 || idx >= cachedBtnList.length) return;

            // Close overlay first so we can see what happens
            var overlay = document.getElementById('ai-nav-debug');
            if (overlay) overlay.remove();

            // Snapshot before
            var beforeNavs = document.querySelectorAll('nav').length;
            var beforeLinks = document.querySelectorAll('a').length;
            var beforeHTML = document.body.innerHTML.length;

            // Click the target button
            cachedBtnList[idx].click();

            // Wait and report what changed
            setTimeout(function() {
                var afterNavs = document.querySelectorAll('nav').length;
                var afterLinks = document.querySelectorAll('a').length;
                var afterHTML = document.body.innerHTML.length;

                var info = [];
                info.push('CLICKED btn[' + idx + ']');
                info.push('nav: ' + beforeNavs + '->' + afterNavs);
                info.push('links: ' + beforeLinks + '->' + afterLinks);
                info.push('HTML diff: ' + (afterHTML - beforeHTML));

                // Show new elements
                var navs = document.querySelectorAll('nav');
                for (var i = 0; i < navs.length; i++) {
                    var nr = navs[i].getBoundingClientRect();
                    info.push('nav[' + i + ']: ' + Math.round(nr.width) + 'x' + Math.round(nr.height) + ' cls="' + (navs[i].className || '').substring(0, 50) + '"');
                }

                var links = document.querySelectorAll('a');
                if (links.length > 0) {
                    info.push('Links (' + links.length + '):');
                    for (var i = 0; i < links.length && i < 8; i++) {
                        info.push('  "' + (links[i].textContent || '').trim().substring(0, 30) + '" -> ' + (links[i].getAttribute('href') || '').substring(0, 40));
                    }
                }

                var specials = document.querySelectorAll('[role="dialog"], [role="menu"], [role="navigation"]');
                if (specials.length > 0) {
                    info.push('Dialogs/Menus: ' + specials.length);
                    for (var i = 0; i < specials.length; i++) {
                        var sr = specials[i].getBoundingClientRect();
                        info.push('  ' + specials[i].tagName + '[role=' + specials[i].getAttribute('role') + '] ' + Math.round(sr.width) + 'x' + Math.round(sr.height));
                    }
                }

                showResultOverlay(info);
            }, 800);
        }

        function showResultOverlay(info) {
            var old = document.getElementById('ai-nav-debug');
            if (old) old.remove();
            var debugEl = document.createElement('div');
            debugEl.id = 'ai-nav-debug';
            debugEl.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#000;color:#0f0;font:12px/1.6 monospace;padding:12px;overflow-y:auto;white-space:pre-wrap;';
            debugEl.textContent = '[Result]\n' + info.join('\n');
            var closeBtn = document.createElement('div');
            closeBtn.textContent = '[X CLOSE]';
            closeBtn.style.cssText = 'color:#f55;cursor:pointer;font-size:14px;margin-bottom:8px;';
            closeBtn.onclick = function() { debugEl.remove(); };
            debugEl.prepend(closeBtn);
            document.body.appendChild(debugEl);
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
                    dumpAllButtons();
                }
            });

            document.body.appendChild(btn);
            console.log('[AI Nav] Claude sidebar toggle button injected');
        }

        // Watch for Claude re-rendering (React may remove elements)
        var navObserver = new MutationObserver(function() {
            ensureToggle();
        });

        if (document.body) {
            navObserver.observe(document.body, { childList: true, subtree: true });
        }

        // Initial setup
        ensureToggle();

        // Periodic health check
        setInterval(function() {
            ensureToggle();
        }, 2000);

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
