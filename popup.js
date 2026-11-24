document.addEventListener('DOMContentLoaded', async () => {
  const providerEl = document.getElementById('provider');
  const apiKeyEl = document.getElementById('apiKey');
  const baseUrlEl = document.getElementById('baseUrl');
  const modelEl = document.getElementById('model');
  const toneEl = document.getElementById('tone');
  const autoFunnyEl = document.getElementById('autoFunny');
  const showButtonEl = document.getElementById('showButton');
  const customUrlGroup = document.getElementById('customUrlGroup');
  const statusEl = document.getElementById('status');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');

  // Load saved settings
  const data = await chrome.storage.sync.get({
    provider: 'xai',
    apiKey: '',
    baseUrl: '',
    model: 'grok-3',
    tone: 'strategic',
    autoFunny: true,
    showButton: true
  });

  providerEl.value = data.provider;
  apiKeyEl.value = data.apiKey;
  baseUrlEl.value = data.baseUrl;
  modelEl.value = data.model;
  toneEl.value = data.tone;
  autoFunnyEl.checked = data.autoFunny;
  showButtonEl.checked = data.showButton;
  toggleCustomUrl();

  providerEl.addEventListener('change', () => {
    toggleCustomUrl();
    // Suggest default model
    if (providerEl.value === 'xai') modelEl.value = 'grok-3';
    else if (providerEl.value === 'openai') modelEl.value = 'gpt-4o-mini';
  });

  function toggleCustomUrl() {
    customUrlGroup.style.display = providerEl.value === 'custom' ? 'block' : 'none';
  }

  function showStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.className = 'status ' + (isError ? 'error' : 'success');
    setTimeout(() => { statusEl.className = 'status'; }, 4000);
  }

  saveBtn.addEventListener('click', async () => {
    const settings = {
      provider: providerEl.value,
      apiKey: apiKeyEl.value.trim(),
      baseUrl: baseUrlEl.value.trim(),
      model: modelEl.value.trim() || 'grok-3',
      tone: toneEl.value,
      autoFunny: autoFunnyEl.checked,
      showButton: showButtonEl.checked
    };
    await chrome.storage.sync.set(settings);
    showStatus('Settings saved!');
  });

  testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyEl.value.trim();
    if (!apiKey) {
      showStatus('Please enter an API key first.', true);
      return;
    }
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';

    try {
      const provider = providerEl.value;
      let url, headers, body;

      if (provider === 'xai') {
        url = 'https://api.x.ai/v1/chat/completions';
      } else if (provider === 'openai') {
        url = 'https://api.openai.com/v1/chat/completions';
      } else {
        url = (baseUrlEl.value.trim() || 'https://api.openai.com/v1') + '/chat/completions';
      }

      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };

      body = JSON.stringify({
        model: modelEl.value.trim() || 'grok-3',
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 10,
        temperature: 0
      });

      const res = await fetch(url, { method: 'POST', headers, body });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || `HTTP ${res.status}`);
      }

      showStatus('Connection successful! Ready to use.');
    } catch (err) {
      showStatus('Error: ' + err.message, true);
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
    }
  });
});
