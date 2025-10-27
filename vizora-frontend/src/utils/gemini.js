// Gemini API utility for chat title analysis
// Usage: await analyzeChatTitle(messages)

// Use REACT_APP_GEMINI_API_KEYS for Create React App compatibility
const GEMINI_API_KEYS = process.env.REACT_APP_GEMINI_API_KEYS || '';
// Support multiple keys separated by comma, use the first one
const GEMINI_API_KEY = GEMINI_API_KEYS.split(',')[0].trim();
const GEMINI_API_URL = GEMINI_API_KEY ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + GEMINI_API_KEY : null;

function simpleFallbackTitle(messages) {
  // Very small heuristic: take the most common meaningful words from user messages
  const text = (messages || []).filter(m => m && m.sender === 'user').map(m => m.text || '').join(' ');
  if (!text) return 'Conversation';
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 3 && !['please','thank','thanks','would','could'].includes(w));
  const freq = {};
  words.forEach(w => freq[w] = (freq[w]||0) + 1);
  const sorted = Object.keys(freq).sort((a,b) => freq[b]-freq[a]);
  const title = sorted.slice(0,3).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  return title || 'Conversation';
}

export async function analyzeChatTitle(messages) {
  // If no API key is configured, return a heuristic fallback immediately
  if (!GEMINI_API_URL) {
    return simpleFallbackTitle(messages);
  }
  // Filter out empty, system, or non-informative messages
  const filtered = (messages || []).filter(m => {
    if (!m || typeof m.text !== 'string' || !m.text.trim()) return false;
    const sysSenders = ['system', 'typing', ''];
    return !sysSenders.includes((m.sender || '').toLowerCase());
  });

  // Use a more context-rich prompt
  const prompt = `You are an expert assistant. Given the following chat conversation between a user and an AI assistant, generate a concise, highly relevant, and descriptive title (max 5 words) that summarizes the main topic or purpose of the conversation. Do NOT use generic titles like 'Conversation' or 'Chat'.\n\nChat transcript:\n${filtered.map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}\n\nTitle:`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  try {
    const res = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.warn('Gemini API returned non-OK status', res.status);
      return simpleFallbackTitle(messages);
    }
    const data = await res.json();
    // Gemini returns: { candidates: [ { content: { parts: [ { text: ... } ] } } ] }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!text) return simpleFallbackTitle(messages);
    return text;
  } catch (err) {
    console.error('Gemini title generation failed', err);
    return simpleFallbackTitle(messages);
  }
}
