# LinkedIn AI Commenter

Chrome extension that reads LinkedIn posts and generates **smart, strategic comments** using AI.  
If the post is funny / humorous, it switches to **short Gen-Z style** comments.

## Features

- **One-click AI Comment button** on every post in your feed
- Automatically detects whether a post is funny
  - Funny → short, casual Gen-Z comment (emojis ok, under ~15-20 words)
  - Serious → strategic / engaging / professional / curious / supportive comment
- Supports **xAI Grok** (recommended), OpenAI, or any OpenAI-compatible API
- Inserts the comment directly into LinkedIn’s comment box
- Copy / Regenerate options
- All API keys stay in your browser (chrome.storage.sync)
- No data sent to any third-party server except the AI provider you choose

## Installation (Developer Mode)

1. Download or clone this folder (`linkedin-ai-commenter`)
2. Open Chrome → go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `linkedin-ai-commenter` folder
6. Pin the extension if you like

## Setup

1. Click the extension icon
2. Choose provider:
   - **xAI Grok** → get key at [console.x.ai](https://console.x.ai)
   - **OpenAI** → get key at [platform.openai.com](https://platform.openai.com)
   - Custom (any compatible endpoint)
3. Paste your API key
4. (Optional) Change model (e.g. `grok-3`, `gpt-4o-mini`)
5. Choose default tone for non-funny posts
6. Click **Save Settings** → **Test Connection**

## How to use

1. Go to LinkedIn feed (`linkedin.com/feed`)
2. You will see a blue **AI Comment** button on posts (next to Like / Comment / Repost)
3. Click it → AI analyzes the post and generates a comment
4. Review the suggestion
5. Click **Insert into comment box** (or Copy)
6. Edit if needed → Post

## Notes & Tips

- LinkedIn changes its DOM frequently. If the button disappears or text extraction fails, refresh the page or re-load the extension.
- Best results with Grok or GPT-4o-mini / GPT-4o.
- The extension never auto-posts. You always review and click Post yourself.
- For privacy: only the post text is sent to the AI provider you configured.

## Folder structure

```
linkedin-ai-commenter/
├── manifest.json
├── popup.html / popup.js
├── background.js          # API calls
├── content.js             # LinkedIn DOM interaction
├── content.css
├── icons/
└── README.md
```

## Disclaimer

This is an unofficial tool. Use responsibly and in accordance with LinkedIn’s Terms of Service.  
Do not spam or post low-quality comments at scale.

---

Made for personal productivity. Enjoy better LinkedIn engagement!
