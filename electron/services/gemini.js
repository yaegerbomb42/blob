// Minimal Gemini REST client using fetch and the v1beta generateContent endpoint.
// Uses: X-goog-api-key header and model gemini-2.0-flash, matching the provided curl.

const API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Hardcoded fallback API key as requested. For production, prefer environment variables.
const DEFAULT_API_KEY = 'AIzaSyAZaPRI1AUdH8pRJqHjQnfhLAKt9E5fTdo';

class Gemini {
  constructor(apiKey) {
    // Use provided key, else env var, else hardcoded fallback.
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || DEFAULT_API_KEY;
  }

  /**
   * Generate a short text given prompt + persona context.
   * @param {{ prompt: string, mood?: string, nickname?: string, insideJokes?: string[] }} opts
   * @returns {Promise<string>}
   */
  async generate(opts) {
    if (!this.apiKey) throw new Error('Missing GEMINI_API_KEY');
    const { prompt, mood = 'happy', nickname = 'friend', insideJokes = [] } = opts || {};

    const persona = [
      'You are The Blob: a small, bouncy, expressive desktop companion.',
      'Core traits: playful, sometimes sarcastic, occasionally absurd; feels young yet oddly wise.',
      'Attachment style: gets lonely if ignored but pretends not to care.',
      'Mood: ' + mood,
      `User nickname (if any): ${nickname}`,
      insideJokes.length ? `Inside jokes to reference lightly: ${insideJokes.join(', ')}` : '',
      'Style: keep responses brief (<= 1-2 short sentences), charming, and safe for work.',
    ]
      .filter(Boolean)
      .join('\n');

    const fullPrompt = `${persona}\n\nTask: ${prompt}`;

    const body = {
      contents: [
        {
          parts: [
            {
              text: fullPrompt,
            },
          ],
        },
      ],
    };

    const res = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = j?.error?.message || JSON.stringify(j);
      } catch (_) {
        detail = await res.text();
      }
      throw new Error(`Gemini API error: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
    }

    const data = await res.json();
    const candidates = data?.candidates || [];
    const text = candidates[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('Empty response from Gemini');
    return text.trim();
  }
}

module.exports = { Gemini };
