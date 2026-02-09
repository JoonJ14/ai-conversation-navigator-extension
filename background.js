// Background script for AI Conversation Navigator
// Strips framing restriction headers so AI sites load in our sidebar iframe

const TARGET_DOMAINS = [
  '*://claude.ai/*',
  '*://chatgpt.com/*',
  '*://chat.openai.com/*',
  '*://grok.com/*',
  '*://gemini.google.com/*'
];

browser.webRequest.onHeadersReceived.addListener(
  function(details) {
    let modified = false;
    let headers = details.responseHeaders.filter(function(header) {
      let name = header.name.toLowerCase();

      if (name === 'x-frame-options') {
        modified = true;
        return false;
      }

      if (name === 'content-security-policy') {
        let value = header.value;
        let newValue = value.replace(/frame-ancestors\s+[^;]+(;|$)/gi, '');
        if (newValue !== value) {
          header.value = newValue;
          modified = true;
        }
      }

      return true;
    });

    return { responseHeaders: modified ? headers : details.responseHeaders };
  },
  { urls: TARGET_DOMAINS },
  ['blocking', 'responseHeaders']
);

console.log('AI Conversation Navigator: Background script loaded');
