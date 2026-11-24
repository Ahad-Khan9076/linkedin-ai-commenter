(function () {
  'use strict';

  const BUTTON_CLASS = 'li-ai-comment-btn';
  const PROCESSED_ATTR = 'data-li-ai-processed';
  let settings = { showButton: true };

  // Load settings
  chrome.storage.sync.get({ showButton: true }, (data) => {
    settings = data;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.showButton) settings.showButton = changes.showButton.newValue;
  });

  // ========== Post detection & button injection ==========

  function findPostContainers() {
    // Common LinkedIn post selectors (they change often – keep multiple)
    const selectors = [
      '.feed-shared-update-v2',
      '.occludable-update',
      'div[data-urn*="activity"]',
      'div[data-urn*="ugcPost"]',
      '.update-components-actor',
      'article.feed-shared-update-v2'
    ];

    const posts = new Set();
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        // Climb to a reasonable container
        let container = el.closest('.feed-shared-update-v2, .occludable-update, div[data-urn]') || el;
        if (container && !container.hasAttribute(PROCESSED_ATTR)) {
          posts.add(container);
        }
      });
    });
    return Array.from(posts);
  }

  function extractPostText(container) {
    // Try multiple places LinkedIn puts the text
    const textSelectors = [
      '.feed-shared-update-v2__description',
      '.update-components-text',
      '.feed-shared-text',
      '.break-words',
      'span[dir="ltr"]',
      '.update-components-update-v2__commentary',
      '.feed-shared-inline-show-more-text'
    ];

    let bestText = '';
    for (const sel of textSelectors) {
      const els = container.querySelectorAll(sel);
      els.forEach(el => {
        // Skip if it's inside a comment section
        if (el.closest('.comments-comment-item, .comments-comments-list, .social-details-social-activity')) return;
        const t = el.innerText?.trim();
        if (t && t.length > bestText.length) bestText = t;
      });
    }

    // Fallback: any substantial text block
    if (bestText.length < 20) {
      const allText = container.innerText || '';
      // Take first reasonable chunk
      bestText = allText.split('\n').filter(l => l.trim().length > 30).slice(0, 8).join('\n').trim();
    }

    return bestText.slice(0, 3000);
  }

  function extractAuthorName(container) {
    const nameSelectors = [
      '.update-components-actor__title span[aria-hidden="true"]',
      '.update-components-actor__name',
      '.feed-shared-actor__name',
      'span.update-components-actor__title',
      'a.app-aware-link span[dir="ltr"]'
    ];
    for (const sel of nameSelectors) {
      const el = container.querySelector(sel);
      if (el) {
        const name = el.innerText?.trim().split('\n')[0];
        if (name && name.length > 1 && name.length < 80) return name;
      }
    }
    return '';
  }

  function findActionBar(container) {
    // The row with Like / Comment / Repost / Send
    return (
      container.querySelector('.feed-shared-social-action-bar') ||
      container.querySelector('.social-details-social-activity') ||
      container.querySelector('.feed-shared-social-actions') ||
      container.querySelector('[class*="social-actions"]') ||
      container.querySelector('.update-v2-social-activity')
    );
  }

  function createButton(container) {
    if (container.querySelector('.' + BUTTON_CLASS)) return;

    const btn = document.createElement('button');
    btn.className = BUTTON_CLASS;
    btn.type = 'button';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right:4px;vertical-align:-2px">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
      </svg>
      AI Comment
    `;
    btn.title = 'Generate AI comment for this post';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleGenerate(container, btn);
    });

    const actionBar = findActionBar(container);
    if (actionBar) {
      // Insert at the end of the action bar
      const wrapper = document.createElement('div');
      wrapper.className = 'li-ai-btn-wrapper';
      wrapper.appendChild(btn);
      actionBar.appendChild(wrapper);
    } else {
      // Fallback: put near the top of the post
      const header = container.querySelector('.update-components-actor, .feed-shared-actor');
      if (header) {
        header.style.position = 'relative';
        btn.style.position = 'absolute';
        btn.style.right = '8px';
        btn.style.top = '8px';
        header.appendChild(btn);
      } else {
        container.prepend(btn);
      }
    }
  }

  function processPosts() {
    if (!settings.showButton) return;
    const posts = findPostContainers();
    posts.forEach(post => {
      post.setAttribute(PROCESSED_ATTR, '1');
      createButton(post);
    });
  }

  // ========== Generate & insert ==========

  async function handleGenerate(container, btn) {
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="li-ai-spinner"></span> Thinking...`;

    try {
      const postText = extractPostText(container);
      if (!postText || postText.length < 15) {
        throw new Error('Could not read post text. Try scrolling so the full post is visible.');
      }

      const authorName = extractAuthorName(container);

      const response = await chrome.runtime.sendMessage({
        action: 'generateComment',
        postText,
        authorName
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Unknown error from background');
      }

      const { comment, isFunny } = response;

      // Show result modal / insert into comment box
      showResultUI(container, comment, isFunny, btn);

    } catch (err) {
      console.error('[LI AI Commenter]', err);
      showToast(err.message || 'Failed to generate comment', true);
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  function showResultUI(container, comment, isFunny, originalBtn) {
    // Remove any existing result panel
    container.querySelectorAll('.li-ai-result-panel').forEach(el => el.remove());

    const panel = document.createElement('div');
    panel.className = 'li-ai-result-panel';
    panel.innerHTML = `
      <div class="li-ai-result-header">
        <span>${isFunny ? '😂 Gen-Z Comment' : '💡 Smart Comment'}</span>
        <button class="li-ai-close" title="Close">×</button>
      </div>
      <div class="li-ai-result-text">${escapeHtml(comment)}</div>
      <div class="li-ai-result-actions">
        <button class="li-ai-insert-btn">Insert into comment box</button>
        <button class="li-ai-copy-btn">Copy</button>
        <button class="li-ai-regen-btn">Regenerate</button>
      </div>
    `;

    // Place after the action bar or at bottom of post
    const actionBar = findActionBar(container);
    if (actionBar) {
      actionBar.parentNode.insertBefore(panel, actionBar.nextSibling);
    } else {
      container.appendChild(panel);
    }

    // Reset original button
    originalBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right:4px;vertical-align:-2px">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
      </svg>
      AI Comment
    `;
    originalBtn.disabled = false;

    // Event listeners
    panel.querySelector('.li-ai-close').addEventListener('click', () => panel.remove());

    panel.querySelector('.li-ai-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(comment).then(() => {
        showToast('Copied to clipboard!');
      });
    });

    panel.querySelector('.li-ai-insert-btn').addEventListener('click', () => {
      insertIntoCommentBox(container, comment);
      panel.remove();
    });

    panel.querySelector('.li-ai-regen-btn').addEventListener('click', () => {
      panel.remove();
      handleGenerate(container, originalBtn);
    });
  }

  function insertIntoCommentBox(container, text) {
    // Try to open the comment box if not already open
    const commentBtn = container.querySelector(
      'button.comment-button, button[aria-label*="Comment"], .feed-shared-social-action-bar button:nth-child(2)'
    );
    if (commentBtn) {
      commentBtn.click();
    }

    // Wait a moment for the editor to appear
    setTimeout(() => {
      // LinkedIn uses contenteditable divs for comments
      const editors = container.querySelectorAll(
        'div.ql-editor[contenteditable="true"], ' +
        'div[role="textbox"][contenteditable="true"], ' +
        '.comments-comment-box-comment__text-editor div[contenteditable], ' +
        '.editor-content div[contenteditable], ' +
        'div.comments-comment-texteditor div[contenteditable]'
      );

      let editor = null;
      // Prefer the one inside this container that is visible
      for (const ed of editors) {
        if (ed.offsetParent !== null && container.contains(ed)) {
          editor = ed;
          break;
        }
      }
      // Global fallback
      if (!editor) {
        editor = document.querySelector('div.ql-editor[contenteditable="true"]:not([data-placeholder*="Start a post"])');
      }

      if (editor) {
        editor.focus();
        // Clear existing
        editor.innerHTML = '';
        // Insert text
        document.execCommand('insertText', false, text);
        // Also set textContent as backup
        if (!editor.textContent.trim()) {
          editor.textContent = text;
        }
        // Trigger input events so LinkedIn detects the change
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
        showToast('Comment inserted! Review and post.');
      } else {
        // Fallback to clipboard
        navigator.clipboard.writeText(text).then(() => {
          showToast('Could not find comment box. Comment copied to clipboard – paste it yourself.');
        });
      }
    }, 400);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg, isError = false) {
    let toast = document.querySelector('.li-ai-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'li-ai-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'li-ai-toast ' + (isError ? 'error' : 'success');
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }

  // ========== Mutation observer for infinite scroll ==========

  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processPosts, 600);
  });

  function start() {
    processPosts();
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Start when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Also re-process on SPA navigation (LinkedIn is SPA)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Clear processed flags so buttons reappear on new views
      document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => el.removeAttribute(PROCESSED_ATTR));
      setTimeout(processPosts, 800);
    }
  }, 1000);
})();
