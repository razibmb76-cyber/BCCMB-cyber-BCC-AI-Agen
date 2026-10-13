import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Increase body parser limit for base64 screenshots and images (up to 20MB)
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Ensure data folder exists for message persistence
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface StoredMessage {
  id: string;
  userId: string;
  chatId: string;
  role: 'user' | 'assistant';
  text: string;
  meta?: string;
  image?: string;
  timestamp: number;
}

interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  picture?: string;
}

interface AppDatabase {
  users: Record<string, StoredUser>;
  messages: StoredMessage[];
}

function loadDb(): AppDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
  return { users: {}, messages: [] };
}

function saveDb(data: AppDatabase) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

// Global cooldown tracker for providers (e.g. rate limits)
const coolMap = new Map<string, number>();
const isCooled = (provider: string, model: string) => {
  const pTime = coolMap.get(provider) || 0;
  const mTime = coolMap.get(`${provider}:${model}`) || 0;
  return pTime > Date.now() || mTime > Date.now();
};
const penalize = (provider: string, model: string, durationMs = 30000) => {
  coolMap.set(`${provider}:${model}`, Date.now() + durationMs);
};

// Default Admin
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'razibmb76@gmail.com').trim().toLowerCase();

// Gemini Client initialization with recommended header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not defined in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const SYSTEMS: Record<string, string> = {
  code: "You are a senior software engineer. Provide clean, production-grade, working code with a concise and insightful explanation. Follow the user's requested language (Bangla or English). If not specified, respond in the language of the user's prompt.",
  chat: "You are BCC AI Agent, a helpful, polite, and highly accurate AI assistant created for Bangladeshi and global users. Always follow the language requested by the user. If the user asks for English, answer in English. If the user asks for Bengali, answer in Bengali. If no language is specified, reply in the language of the user's latest message. Follow the user's other instructions carefully. Do not invent facts; clearly state when unsure.",
  analyze: "Analyze the given material, screenshot, or image carefully and present structured, sharp findings with key takeaways. Reply in the user's language (Bangla or English).",
  video: "You are a professional video producer and creative director. Output: 1) High-level Concept 2) Scene-by-scene Storyboard with duration and audio/dialogue cues 3) One detailed, cinematic English text-to-video prompt per scene (ready for Veo, Hailuo, Kling, Runway, or Higgsfield). Reply in Bengali for explanations and English for prompt blocks.",
};

const COMPUTER_SYSTEM = `You operate a Windows or Mac computer by looking at one screenshot at a time.
Coordinates are integers 0-1000 (x: left to right, y: top to bottom) relative to the screenshot.
1) If a previous action exists, judge from the new screenshot whether it had the intended effect: verdict "ok" or "failed". If failed, try a different approach.
2) Choose ONE next action, or finish.
Rules: Never enter passwords, payment data or OTPs; never delete critical files, send unapproved messages, submit forms or buy anything unless the user's goal explicitly demands it; if login, CAPTCHA, payment or any risky step is needed, return status "needs_user".
Return JSON ONLY:
{
  "verdict": "ok|failed|none",
  "thought": "<one short sentence in Bengali explaining what you see and why this action is taken>",
  "status": "continue|done|needs_user|failed",
  "action": {
    "type": "click|double_click|right_click|type|key|scroll|wait",
    "x": 500,
    "y": 500,
    "text": "",
    "key": "",
    "dy": 0
  }
}
Action must be null unless status is "continue". For "type": click the field first, then type. scroll: dy positive = up, negative = down.`;

const KEYWORDS: [string, string[]][] = [
  ["video", ["ভিডিও", "video", "reel", "রিল", "animation", "অ্যানিমেশন", "storyboard", "স্টোরিবোর্ড"]],
  ["image", ["ছবি আঁক", "ছবি বানা", "ছবি তৈরি", "ছবি জেনারেট", "ব্যানার", "পোস্টার", "লোগো", "generate image", "draw ", "poster", "banner", "logo", "illustration", "image of"]],
  ["code", ["কোড", "code", "python", "javascript", "html", "css", "sql", "bug", "error", "function", "script", "typescript", "react", "programming"]],
  ["analyze", ["analyze", "analyse", "এনালাইজ", "বিশ্লেষণ", "summarize", "সারসংক্ষেপ", "compare", "স্ক্রিন", "screen", "পড়ো", "দেখো"]],
];

function heuristicClassify(prompt: string, hasImage: boolean): string {
  const low = prompt.toLowerCase();
  for (const [route, words] of KEYWORDS) {
    if (words.some((w) => low.includes(w))) return route;
  }
  return hasImage ? "analyze" : "chat";
}

// Token Verification Cache
interface TokenCacheItem {
  id: string;
  email: string;
  name: string;
  picture?: string;
  exp: number;
}
const tokenCache = new Map<string, TokenCacheItem>();

async function verifyGoogleToken(token: string): Promise<TokenCacheItem> {
  const hit = tokenCache.get(token);
  if (hit && hit.exp > Math.floor(Date.now() / 1000) + 30) {
    return hit;
  }

  // Check if it's a simulated dev session token
  if (token.startsWith('dev_session_')) {
    const raw = Buffer.from(token.replace('dev_session_', ''), 'base64').toString('utf-8');
    const parsed = JSON.parse(raw);
    const item: TokenCacheItem = {
      id: parsed.id || 'dev_user_1',
      email: parsed.email || DEFAULT_ADMIN_EMAIL,
      name: parsed.name || 'BCC Developer',
      picture: parsed.picture,
      exp: Math.floor(Date.now() / 1000) + 86400,
    };
    tokenCache.set(token, item);
    return item;
  }

  // Real Google Token Verification via Google OAuth tokeninfo
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    throw new Error('Google টোকেন যাচাই ব্যর্থ হয়েছে');
  }
  const info = await res.json();
  if (!info.email) {
    throw new Error('Google অ্যাকাউন্টে ইমেইল পাওয়া যায়নি');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId && info.aud !== clientId) {
    console.warn(`Token aud (${info.aud}) does not match configured GOOGLE_CLIENT_ID (${clientId}). Allowing in dev.`);
  }

  const item: TokenCacheItem = {
    id: info.sub || info.user_id,
    email: String(info.email).toLowerCase(),
    name: info.name || info.given_name || 'BCC AI ব্যবহারকারী',
    picture: info.picture,
    exp: Number(info.exp || Math.floor(Date.now() / 1000) + 3600),
  };
  tokenCache.set(token, item);
  return item;
}

// Auth Middleware
async function authenticateRequest(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'অনুমোদন প্রয়োজন (লগইন করুন)' });
  }
  const token = authHeader.slice(7).trim();
  try {
    const googleUser = await verifyGoogleToken(token);
    const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase();
    const role: 'admin' | 'user' = googleUser.email === adminEmail ? 'admin' : 'user';

    const allowed = (process.env.ALLOWED_EMAILS || '')
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (allowed.length && role !== 'admin' && !allowed.includes(googleUser.email)) {
      return res.status(403).json({ error: 'এই অ্যাকাউন্টের ব্যবহারের অনুমতি নেই' });
    }

    const db = loadDb();
    db.users[googleUser.email] = {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      role,
      picture: googleUser.picture,
    };
    saveDb(db);

    (req as any).user = {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      role,
      picture: googleUser.picture,
    };
    next();
  } catch (err: any) {
    return res.status(401).json({ error: err.message || 'টোকেন মেয়াদোত্তীর্ণ বা অকার্যকর' });
  }
}

// ---------------- API ROUTES ----------------

// Config endpoint
app.get('/api/config', (req: Request, res: Response) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    adminEmail: process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
    hasGemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    hasGroq: !!process.env.GROQ_API_KEY,
    hasOpenRouter: !!process.env.OPENROUTER_API_KEY,
    defaultModels: {
      gemini: 'gemini-3.8-flash',
      geminiLite: 'gemini-2.5-flash-lite',
      groq: process.env.MODEL_GROQ || 'llama-3.3-70b-versatile',
      openrouter: process.env.MODEL_OPENROUTER_CHAT || 'openrouter/free',
    },
  });
});

// Google Authentication
app.post('/api/auth/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'ক্রেডেনশিয়াল পাওয়া যায়নি' });
    }
    const userItem = await verifyGoogleToken(credential);
    const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase();
    const role = userItem.email === adminEmail ? 'admin' : 'user';

    const db = loadDb();
    db.users[userItem.email] = {
      id: userItem.id,
      email: userItem.email,
      name: userItem.name,
      role,
      picture: userItem.picture,
    };
    saveDb(db);

    res.json({
      ok: true,
      user: {
        id: userItem.id,
        email: userItem.email,
        name: userItem.name,
        role,
        picture: userItem.picture,
      },
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Google লগইন যাচাই ব্যর্থ হয়েছে' });
  }
});

// Dev Quick Sign-In (For local development or when Google Client ID is not configured)
app.post('/api/auth/dev-login', (req: Request, res: Response) => {
  const email = (req.body.email || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const name = req.body.name || (email.split('@')[0].toUpperCase() + ' (ব্যবহারকারী)');
  const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase();
  const role: 'admin' | 'user' = email === adminEmail ? 'admin' : 'user';

  const userObj: StoredUser = {
    id: 'user_' + Buffer.from(email).toString('hex').slice(0, 12),
    email,
    name,
    role,
    picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
  };

  const token = 'dev_session_' + Buffer.from(JSON.stringify(userObj)).toString('base64');
  tokenCache.set(token, {
    ...userObj,
    exp: Math.floor(Date.now() / 1000) + 86400,
  });

  const db = loadDb();
  db.users[email] = userObj;
  saveDb(db);

  res.json({
    ok: true,
    token,
    user: userObj,
  });
});

// Current User info
app.get('/api/me', authenticateRequest, (req: Request, res: Response) => {
  res.json({ ok: true, user: (req as any).user });
});

// Chat history
app.get('/api/history', authenticateRequest, (req: Request, res: Response) => {
  const user = (req as any).user;
  const chatId = String(req.query.chat || '');
  if (!chatId) return res.json([]);

  const db = loadDb();
  const userMsgs = db.messages
    .filter((m) => m.userId === user.id && m.chatId === chatId)
    .sort((a, b) => a.timestamp - b.timestamp);
  res.json(userMsgs);
});

// Delete chat history
app.delete('/api/history', authenticateRequest, (req: Request, res: Response) => {
  const user = (req as any).user;
  const chatId = String(req.query.chat || '');
  if (!chatId) return res.json({ ok: true });

  const db = loadDb();
  db.messages = db.messages.filter((m) => !(m.userId === user.id && m.chatId === chatId));
  saveDb(db);
  res.json({ ok: true });
});

// System Status (Admin Only)
app.get('/api/status', authenticateRequest, (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'শুধুমাত্র অ্যাডমিনের জন্য অনুমোদিত' });
  }

  const db = loadDb();
  res.json({
    ok: true,
    service: 'BCC AI Agent Core',
    currentTime: new Date().toISOString(),
    keys: {
      gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      openrouter: !!process.env.OPENROUTER_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      googleClientId: !!process.env.GOOGLE_CLIENT_ID,
    },
    adminEmail: process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
    stats: {
      totalUsers: Object.keys(db.users).length,
      totalMessages: db.messages.length,
      cooledProvidersCount: coolMap.size,
    },
    routes: ['chat', 'code', 'image', 'video', 'analyze', 'computer'],
  });
});

// --- AI Agent Core Execution Function ---
async function executeAgentTurn({
  prompt,
  image_b64,
  mime = 'image/jpeg',
  history = [],
  forceRoute,
}: {
  prompt: string;
  image_b64?: string;
  mime?: string;
  history: Array<{ role: string; text: string }>;
  forceRoute?: string;
}) {
  const hasImage = !!image_b64;
  const ai = getGeminiClient();

  // Route Classification
  let route = forceRoute;
  if (!route || !['code', 'image', 'video', 'analyze', 'chat'].includes(route)) {
    // Try smart classification or fallback heuristic
    try {
      const classRes = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Classify the user's request into exactly one route:
code: programming, debugging, scripts, websites, SQL, automation
image: user wants a NEW picture/poster/banner/logo/illustration generated
video: user wants a NEW video/reel/animation made, or a video script/storyboard
analyze: user wants an attached image/screenshot/file/data/text examined, summarised or compared
chat: anything else (writing, translation, general questions, advice, marketing)

Has attached image: ${hasImage}
User Prompt: ${prompt}

Return JSON only: {"route": "code|image|video|analyze|chat", "reason": "brief"}`,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const parsed = JSON.parse(classRes.text || '{}');
      if (parsed.route && ['code', 'image', 'video', 'analyze', 'chat'].includes(parsed.route)) {
        route = parsed.route;
      }
    } catch {
      // Heuristic fallback
    }
    if (!route) {
      route = heuristicClassify(prompt, hasImage);
    }
  }

  // Handle IMAGE Route
  if (route === 'image') {
    // 1. Polish prompt into high-fidelity image description using Gemini
    let enhancedPrompt = prompt;
    try {
      const pRes = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Rewrite the following user prompt into one detailed English image-generation prompt (subject, art style, lighting, composition, 8k quality). Output ONLY the English prompt, no other text:\n${prompt}`,
      });
      enhancedPrompt = (pRes.text || prompt).trim();
    } catch (e) {
      enhancedPrompt = prompt;
    }

    // 2. High-Quality FLUX Image Generation (Matches Workers AI FLUX from original Cloudflare design)
    try {
      const encodedPrompt = encodeURIComponent(enhancedPrompt.slice(0, 400));
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=800&nologo=true&model=flux`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const imgRes = await fetch(imageUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'BCC-AI-Agent/1.0' },
      });
      clearTimeout(timeoutId);

      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        if (arrayBuf.byteLength > 1000) {
          const imgBase64 = Buffer.from(arrayBuf).toString('base64');
          return {
            route: 'image',
            agent: 'flux',
            model: 'flux-1-schnell',
            type: 'image',
            reply: `🎨 ছবি সফলভাবে তৈরি করা হয়েছে!\n\nইংরেজি প্রম্পট: ${enhancedPrompt}`,
            prompt_used: enhancedPrompt,
            image_b64: imgBase64,
            mime: 'image/jpeg',
          };
        }
      }
    } catch (fluxErr: any) {
      console.warn('FLUX pipeline fallback engaged:', fluxErr.message);
    }

    // 3. High fidelity SVG / Artistic Illustration Generation fallback using standard Gemini
    try {
      const svgRes = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Create a clean, visually stunning, fully self-contained SVG graphic based on this prompt: "${enhancedPrompt}".
Requirements:
1. Valid <svg viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">...</svg>
2. Beautiful modern gradients, crisp shapes, rich details, high aesthetic value.
3. Include an insightful Bengali summary caption underneath in text.
Return ONLY valid JSON:
{
  "svg": "<svg ...>...</svg>",
  "caption": "বাংলা ক্যাপশন ও বর্ণনা",
  "prompt": "${enhancedPrompt.replace(/"/g, '\\"')}"
}`,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsedSvg = JSON.parse(svgRes.text || '{}');
      if (parsedSvg.svg) {
        const svgBase64 = Buffer.from(parsedSvg.svg).toString('base64');
        return {
          route: 'image',
          agent: 'gemini',
          model: 'gemini-3.8-flash (vector-art)',
          type: 'image',
          reply: `🎨 ভেক্টর আর্ট ও ইমেজ কনসেপ্ট তৈরি সম্পন্ন!\n${parsedSvg.caption || ''}\n\nইংরেজি প্রম্পট: ${enhancedPrompt}`,
          prompt_used: enhancedPrompt,
          image_b64: svgBase64,
          mime: 'image/svg+xml',
        };
      }
    } catch (svgErr: any) {
      console.warn('SVG generation fallback failed:', svgErr.message);
    }

    return {
      route: 'image',
      agent: 'gemini',
      model: 'gemini-3.8-flash',
      type: 'text',
      reply: `🎨 আপনার ইমেজের বিস্তারিত প্রম্পট প্রস্তুত:\n\n**${enhancedPrompt}**\n\n(টিপস: এটি মিডজার্নি বা যেকোনো ইমেজ জেনারেটরে সরাসরি ব্যবহার করতে পারেন।)`,
    };
  }

  // Handle TEXT, CODE, VIDEO, ANALYZE routes
  const systemInstruction = SYSTEMS[route] || SYSTEMS.chat;

  // Build contents payload
  const contentsPayload: any[] = [];

  // Add conversation history
  for (const h of history.slice(-8)) {
    if (h && h.text) {
      contentsPayload.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.text }],
      });
    }
  }

  // Add current turn
  const currentParts: any[] = [];
  if (hasImage && image_b64) {
    currentParts.push({
      inlineData: {
        mimeType: mime,
        data: image_b64,
      },
    });
  }
  currentParts.push({ text: prompt });

  contentsPayload.push({
    role: 'user',
    parts: currentParts,
  });

  // Call Gemini Model with resilient fallback cascade across supported models
  const modelCandidates = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let replyText = '';
  let successfulModel = 'gemini-3.8-flash';
  let lastError: any = null;

  for (const candidate of modelCandidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: candidate,
          contents: contentsPayload,
          config: {
            systemInstruction,
          },
        });
        if (response.text) {
          replyText = response.text;
          successfulModel = candidate;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${candidate} (attempt ${attempt + 1}) error: ${err.message}`);
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }
    if (replyText) break;
  }

  if (!replyText) {
    throw lastError || new Error('সকল এআই মডেল সাময়িকভাবে ব্যস্ত। কিছুক্ষণ পর পুনরায় চেষ্টা করুন।');
  }

  return {
    route,
    agent: 'gemini',
    model: successfulModel,
    type: 'text',
    reply: replyText,
  };
}

// Agent interaction endpoint
app.post('/api/agent', authenticateRequest, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { prompt, image_b64, mime, history, chat_id, force } = req.body;

  if (!prompt && !image_b64) {
    return res.status(400).json({ error: 'অনুগ্রহ করে প্রশ্ন বা ছবি পাঠান' });
  }

  try {
    const result = await executeAgentTurn({
      prompt: String(prompt || 'এই ছবি বা স্ক্রিনশটটি বিশ্লেষণ করো'),
      image_b64,
      mime: mime || 'image/jpeg',
      history: Array.isArray(history) ? history : [],
      forceRoute: force,
    });

    // Save to Database
    if (chat_id) {
      const db = loadDb();
      const now = Date.now();
      const meta = `${result.route} · ${result.agent} · ${result.model}`;

      // User message
      db.messages.push({
        id: 'msg_' + Math.random().toString(36).substring(2, 9),
        userId: user.id,
        chatId: chat_id,
        role: 'user',
        text: prompt || '(ছবি বা স্ক্রিনশট)',
        image: image_b64 ? `data:${mime || 'image/jpeg'};base64,${image_b64.slice(0, 500)}...` : undefined,
        timestamp: now,
      });

      // Assistant message
      db.messages.push({
        id: 'msg_' + Math.random().toString(36).substring(2, 9),
        userId: user.id,
        chatId: chat_id,
        role: 'assistant',
        text: result.reply,
        meta,
        image: result.type === 'image' && result.image_b64 ? `data:${result.mime || 'image/jpeg'};base64,${result.image_b64}` : undefined,
        timestamp: now + 1,
      });

      saveDb(db);
    }

    res.json({
      ...result,
      userRole: user.role,
    });
  } catch (err: any) {
    console.error('Agent error:', err);
    res.status(500).json({
      error: 'AI সেবা থেকে উত্তর তৈরিতে সমস্যা হয়েছে: ' + (err.message || String(err)),
    });
  }
});

// --- Computer Control: Step Planner ---
app.post('/api/computer/step', authenticateRequest, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'কম্পিউটার কন্ট্রোল শুধুমাত্র অ্যাডমিনের জন্য অনুমোদিত' });
  }

  const { goal, screenshot_b64, steps } = req.body;
  if (!goal) {
    return res.status(400).json({ error: 'লক্ষ্য (Goal) নির্দিষ্ট করুন' });
  }
  if (!screenshot_b64) {
    return res.status(400).json({ error: 'স্ক্রিনশট অনুপস্থিত' });
  }

  const stepList = Array.isArray(steps) ? steps : [];
  if (stepList.length >= 25) {
    return res.json({
      verdict: 'none',
      thought: 'সর্বোচ্চ পদক্ষেপের সীমা (25 ধাপ) অতিক্রম করেছে।',
      status: 'failed',
      action: null,
    });
  }

  const logText = stepList
    .map((s: any, idx: number) => `${idx + 1}. ${s.thought} -> ${JSON.stringify(s.action)} [${s.verdict || 'pending'}]`)
    .join('\n') || 'None';

  const promptText = `User Goal: ${goal}
Prior Steps executed:
${logText}

Analyze this current computer screenshot. Judge the outcome of previous step if any, and decide the next single action to achieve the user's goal safely.`;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: screenshot_b64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        systemInstruction: COMPUTER_SYSTEM,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const validActions = new Set(['click', 'double_click', 'right_click', 'type', 'key', 'scroll', 'wait']);
    let action = parsed.action;

    if (action && !validActions.has(action.type)) {
      action = null;
    }
    if (action) {
      action.x = Math.max(0, Math.min(1000, Number(action.x) || 500));
      action.y = Math.max(0, Math.min(1000, Number(action.y) || 500));
    }

    res.json({
      verdict: parsed.verdict || 'none',
      thought: parsed.thought || 'পরবর্তী ধাপ বিশ্লেষণ করা হচ্ছে...',
      status: parsed.status || 'continue',
      action: parsed.status === 'continue' ? action : null,
    });
  } catch (err: any) {
    console.error('Computer step error:', err);
    res.status(500).json({ error: 'কম্পিউটার বিশ্লেষণ ত্রুটি: ' + err.message });
  }
});

// --- Computer Control: Final Report ---
app.post('/api/computer/report', authenticateRequest, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'কম্পিউটার কন্ট্রোল শুধুমাত্র অ্যাডমিনের জন্য অনুমোদিত' });
  }

  const { goal, status, steps } = req.body;
  const stepList = Array.isArray(steps) ? steps : [];
  const logText = stepList
    .map((s: any, idx: number) => `${idx + 1}. ${s.thought} -> ${JSON.stringify(s.action)} [${s.verdict || 'none'}]`)
    .join('\n') || 'None';

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Write a clear, structured final task report in Bengali for this computer automation session.
User Goal: ${goal}
Final Status: ${status}
Steps log:
${logText}

Structure:
1. কাজের লক্ষ্য
2. গৃহীত পদক্ষেপসমূহ
3. চূড়ান্ত ফলাফল (সফল / আংশিক / ব্যর্থ)
4. ব্যবহারকারীর জন্য পরবর্তী পরামর্শ`,
    });

    res.json({
      report: response.text || 'রিপোর্ট তৈরি করা যায়নি।',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'রিপোর্ট তৈরিতে সমস্যা: ' + err.message });
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BCC AI Agent Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
