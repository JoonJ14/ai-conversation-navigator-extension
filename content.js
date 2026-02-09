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
            messages = document.querySelectorAll('[data-testid="user-human-turn"]');
        }
        else if (currentSite === SITE.CHATGPT) {
            messages = document.querySelectorAll('[data-message-author-role="user"]');
        }
        else if (currentSite === SITE.GROK) {
            const allBubbles = document.querySelectorAll('div.message-bubble');
            messages = [];
            allBubbles.forEach(function(bubble) {
                const container = bubble.closest('[class*="message"]');
                if (container) {
                    const isBot = container.querySelector('[class*="bot"]') ||
                                  container.querySelector('[class*="assistant"]') ||
                                  container.querySelector('[class*="grok"]');
                    if (!isBot) messages.push(bubble);
                } else {
                    messages.push(bubble);
                }
            });
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
