import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  // API route for Sermon Plan generation via Gemini
  app.post('/api/generate-sermon-plan', async (req, res) => {
    try {
      const { captionSegments, questionsPerBreak, includeAnecdote, apiKey: clientApiKey } = req.body;
      const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'GEMINI_API_KEY is not configured. Please enter your Gemini API key below or configure GEMINI_API_KEY on the server.' });
      }

      if (!Array.isArray(captionSegments) || captionSegments.length === 0) {
        return res.status(400).json({ error: 'No caption segments provided.' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const results = [];

      for (let i = 0; i < captionSegments.length; i++) {
        const seg = captionSegments[i];
        const prompt = `You are a theological assistant creating engaging, accurate quiz questions and anecdotes from a sermon caption segment.
Caption text: "${seg.text}"

Generate JSON with:
1. "questions": Array of ${questionsPerBreak || 2} questions. Each question must have:
   - "prompt": string (question text based strictly on facts in this caption segment)
   - "options": array of exactly 3 strings (A, B, C)
   - "correct_index": number (0, 1, or 2)
   - "explanation": string (one-line explanation)
2. "anecdote": string (${includeAnecdote !== false ? '40 to 70 words illustrating the scene, starting with "Illustration: "' : '""'})

Rules:
- Use ONLY facts in that segment's caption text. Never invent scripture references, quotes, or doctrine.
- Rotate question types across segments (recall, application, true/false, scripture reference).
- Return valid JSON only, without markdown code fences.`;

        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            }
          });

          const jsonText = response.text || '{}';
          const cleanJson = jsonText.replace(/^```json\s*|^```\s*|\s*```$/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          results.push({
            segmentIndex: i,
            startTime: seg.startTime,
            endTime: seg.endTime,
            questions: parsed.questions || [],
            anecdote: parsed.anecdote || ''
          });
        } catch (err: any) {
          console.error('AI generation error for segment', i, err);
          results.push({
            segmentIndex: i,
            startTime: seg.startTime,
            endTime: seg.endTime,
            questions: [{
              prompt: "What was the core truth emphasized in this segment of the message?",
              options: ["Living out faith daily", "Historical background", "Denominational history"],
              correct_index: 0,
              explanation: "Based on the sermon text."
            }],
            anecdote: "Illustration: Walking in faith and applying God's word daily."
          });
        }
      }

      res.json({ breaks: results });
    } catch (err: any) {
      console.error('Sermon plan API error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate sermon plan' });
    }
  });

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
