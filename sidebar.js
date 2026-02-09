// Sidebar panel script — handles provider switching and UI state

(function() {
  'use strict';

  const frame = document.getElementById('ai-frame');
  const loadingBar = document.getElementById('loading-bar');
  const buttons = document.querySelectorAll('.provider-btn');

  const COLORS = {
    claude: '#d97706',
    chatgpt: '#888888',
    grok: '#dc2626',
    gemini: '#4285f4'
  };

  let currentProvider = 'claude';

  function updateLoadingColor(provider) {
    const color = COLORS[provider] || '#d97706';
    loadingBar.style.background = 'linear-gradient(90deg, #333 0%, ' + color + ' 50%, #333 100%)';
    loadingBar.style.backgroundSize = '200% 100%';
  }

  buttons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      const provider = btn.getAttribute('data-provider');
      const url = btn.getAttribute('data-url');
      if (provider === currentProvider) return;

      buttons.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      loadingBar.classList.add('active');
      updateLoadingColor(provider);
      currentProvider = provider;
      frame.src = url;
    });
  });

  frame.addEventListener('load', function() {
    loadingBar.classList.remove('active');
  });

  updateLoadingColor('claude');

  document.getElementById('settings-btn').addEventListener('click', function() {
    console.log('Settings clicked — coming soon!');
  });

  const NEW_CHAT_URLS = {
    claude: 'https://claude.ai/new',
    chatgpt: 'https://chatgpt.com/',
    grok: 'https://grok.com/',
    gemini: 'https://gemini.google.com/app'
  };

  const FULL_URLS = {
    claude: 'https://claude.ai',
    chatgpt: 'https://chatgpt.com',
    grok: 'https://grok.com',
    gemini: 'https://gemini.google.com'
  };

  document.getElementById('new-chat-btn').addEventListener('click', function() {
    let url = NEW_CHAT_URLS[currentProvider] || 'https://claude.ai/new';
    loadingBar.classList.add('active');
    updateLoadingColor(currentProvider);
    frame.src = url;
  });

  document.getElementById('open-tab-btn').addEventListener('click', function() {
    let url = FULL_URLS[currentProvider] || 'https://claude.ai';
    browser.tabs.create({ url: url });
  });

  console.log('AI Sidebar panel script loaded');
})();
