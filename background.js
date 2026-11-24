// Background service worker – handles AI API calls

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateComment') {
    handleGenerate(request)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async
  }
});

async function handleGenerate({ postText, authorName, tone, autoFunny }) {
  const settings = await chrome.storage.sync.get({
    provider: 'xai',
    apiKey: '',
    baseUrl: '',
    model: 'grok-3',
    tone: 'strategic',
    autoFunny: true
  });

  if (!settings.apiKey) {
    throw new Error('No API key set. Open the extension popup and add your key.');
  }

  const effectiveTone = tone || settings.tone;
  const useFunny = autoFunny !== false && settings.autoFunny;

  // Step 1: Analyze if the post is funny / humorous
  let isFunny = false;
  if (useFunny) {
    isFunny = await analyzeHumor(postText, settings);
  }

  // Step 2: Generate the appropriate comment
  const comment = await generateComment(postText, authorName, isFunny, effectiveTone, settings);

  return { comment, isFunny };
}

async function analyzeHumor(postText, settings) {
  const prompt = `Analyze this LinkedIn post and decide if it is primarily funny, humorous, witty, meme-like, or light-hearted comedy.

Reply with ONLY one word: "FUNNY" or "SERIOUS".

Post:
"""
${postText.slice(0, 1500)}
"""`;

  const result = await callAI(prompt, settings, 10, 0);
  return result.toUpperCase().includes('FUNNY');
}

async function generateComment(postText, authorName, isFunny, tone, settings) {
  let systemPrompt, userPrompt;

  if (isFunny) {
    systemPrompt = `You are a Gen-Z LinkedIn commenter. Write short, authentic, funny comments that sound like a real young professional on LinkedIn.

Rules:
- Keep it under 15 words ideally, max 25 words.
- Use casual Gen-Z language, light slang, emojis sparingly (max 1-2).
- Be witty, not try-hard. Sound natural.
- Never start with "Haha" or "Lol this is so funny".
- No corporate speak. No "Great post!".
- Match the energy of the post.
- Do NOT put the comment in quotes.`;

    userPrompt = `Write one short Gen-Z style comment for this funny LinkedIn post by ${authorName || 'someone'}:

"""
${postText.slice(0, 1800)}
"""`;
  } else {
    const toneInstructions = {
      strategic: 'Add genuine value, a unique insight, or a thoughtful observation that advances the conversation. Be strategic and memorable.',
      engaging: 'Write a warm, conversational comment that invites further discussion. Sound human and interested.',
      professional: 'Keep a polished, professional tone. Thoughtful and respectful.',
      curious: 'Ask a smart, open-ended question that shows you read the post carefully.',
      supportive: 'Offer genuine encouragement or validation while adding a small personal touch.'
    };

    systemPrompt = `You are an expert LinkedIn engagement specialist. Write high-quality comments that help the commenter build presence and relationships.

Rules:
- 1 to 3 short sentences maximum.
- Never start with "Great post", "Thanks for sharing", "Awesome", or generic praise.
- Reference something specific from the post so it feels authentic.
- Sound like a real human professional, not AI.
- No hashtags unless they appear in the original post.
- Do NOT put the comment in quotes.
- Avoid em-dashes if possible.
- ${toneInstructions[tone] || toneInstructions.strategic}`;

    userPrompt = `Write one high-quality LinkedIn comment for this post by ${authorName || 'the author'}:

"""
${postText.slice(0, 2000)}
"""`;
  }

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  return await callAI(fullPrompt, settings, isFunny ? 60 : 120, 0.7);
}

async function callAI(prompt, settings, maxTokens = 100, temperature = 0.7) {
  let url;
  if (settings.provider === 'xai') {
    url = 'https://api.x.ai/v1/chat/completions';
  } else if (settings.provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions';
  } else {
    const base = settings.baseUrl.replace(/\/$/, '') || 'https://api.openai.com/v1';
    url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || 'grok-3',
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `API error ${response.status}`);
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from AI');

  // Clean up possible quotes or prefixes
  return text
    .replace(/^["']|["']$/g, '')
    .replace(/^(Comment:|Here's a comment:|Sure:?)\s*/i, '')
    .trim();
}
