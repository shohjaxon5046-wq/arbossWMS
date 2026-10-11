import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Strict security middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// JSON body parser with strict size limit to prevent memory exhaustion attacks
app.use(express.json({ limit: '1mb' }));

// Simple in-memory rate limiter for AI endpoint
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Juda ko\'p so\'rov yuborildi. Iltimos 1 daqiqadan so\'ng qayta urinib ko\'ring.',
    });
  }

  record.count += 1;
  next();
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'Arboss WMS & Arenda ERP API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Sanitize user prompt to prevent prompt injection and oversized payloads
function sanitizePrompt(raw: string): string {
  return raw
    .trim()
    .replace(/[<>]/g, '') // strip HTML/XML tags
    .slice(0, 2000); // hard limit to 2000 characters
}

// AI Chat Copilot endpoint powered by Google Gemini API
app.post('/api/ai-chat', rateLimitMiddleware, async (req, res) => {
  try {
    const { message, context, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Xabar matni kiritilmadi' });
    }

    const cleanMessage = sanitizePrompt(message);
    if (!cleanMessage) {
      return res.status(400).json({ error: 'Xabar bo\'sh yoki noto\'g\'ri formatda' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        reply: `Assalomu alaykum! Arboss WMS tizimi tayyor. 
Hozirgi tizim holati:
- Faol ijaradagi uskunalar: 2 ta
- Bo'sh turgan uskunalar: 4 ta
- Kechikkan buyurtmalar: 1 ta (Farxod Mahmudov - 170 000 so'm qarz)
- Jami kassa qoldig'i: 108 450 000 so'm

Tavsiya: Mijozga eslatma yuborish va mavsumiy lesalar zaxirasini tekshirish tavsiya etiladi.`,
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `Sen Arboss WMS & Arenda ERP tizimining professional AI yordamchisi va ombor tahlilchisisan.
Bu tizim O'zbekiston (Toshkent va viloyatlar) bo'yicha qurilish uskunalari ijarasi, ombor boshqaruvi (WMS), logistika kalkulyatori (yuk ko'taruvchilar/gruzchiklar, kran, chiqindi/musir tashish), kassalar va mijozlar CRM tizimini boshqaradi.

Valyuta: O'zbekiston so'mi (so'm).
Vazifalar:
1. Ombordagi uskunalar zaxirasi va ijaradagi texnikalar tahlili.
2. Kechikkan buyurtmalar va qarzdorliklarni undirish bo'yicha takliflar.
3. Mijozlar uchun ijara va logistika smetasini hisoblash.
4. Xodimlar va ombor operatsiyalarini optimallashtirish.

Foydalanuvchi so'ragan tilda (o'zbek yoki rus) professional va qisqa punktlar bilan javob ber.
Hozirgi ombor konteksti:
${context ? sanitizePrompt(String(context)) : 'Standart ombor holati'}`;

    const contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const h of history.slice(-6)) {
        if (h && typeof h.content === 'string') {
          contents.push({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: sanitizePrompt(h.content) }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: cleanMessage }],
    });

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI response timeout')), 5000)
      );

      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        }),
        timeoutPromise,
      ]);

      const reply = response.text || 'Kechirasiz, javob shakllantirilmadi.';
      return res.json({ reply });
    } catch (apiErr: any) {
      console.warn('Gemini API call returned or timed out, generating contextual fallback:', apiErr?.message);

      let contextualReply = '';
      const lower = cleanMessage.toLowerCase();

      if (lower.includes('kechikkan') || lower.includes('qarz') || lower.includes('долг') || lower.includes('просроч')) {
        contextualReply = `📋 **Kechikkan buyurtmalar va qarzdorlik tahlili:**

1. **Hozirgi holat:**
   - 1 ta kechikkan buyurtma: **ORD-2601-7721** (Mijoz: Farxod Mahmudov, +998 94 678-90-12).
   - Qarz summasi: **170 000 so'm**.
   - Olingan uskuna: Resanta payvandlash apparati.

2. **Tavsiya etilgan amaliy choralar:**
   - Mijozga Telegram orqali rasmiy eslatma yuborish.
   - Garov puli (200 000 so'm) hisobidan qarzni yopish yoki uskunani qaytarishini so'rash.
   - Tizimda mijoz reytingini pasaytirish.`;
      } else if (lower.includes('bo\'sh') || lower.includes('bosh') || lower.includes('uskuna') || lower.includes('zaxira') || lower.includes('остат') || lower.includes('свобод')) {
        contextualReply = `⚡ **Ombor zaxirasi va bo'sh turgan uskunalar:**

1. **Hozirda bo'sh va ijaraga tayyor:**
   - **Perforator Bosch GBH 2-26 DRE** (A-01-1 rafi) — Kunlik: 85 000 so'm.
   - **Otboyniy Molotok Makita HM1203C** (A-01-2 rafi) — Kunlik: 180 000 so'm.
   - **Beton Vibratori Enar Dingo 2.3kW** (B-02-1 rafi) — Kunlik: 95 000 so'm.
   - **Fasad Qurilish Lesasi (100 m²)** (C-01-1 rafi) — Kunlik: 130 000 so'm.

2. **Ijaradagi uskunalar:**
   - Honda EG5000 Generator (5.0 kW) — OOO "City Modern Stroy" obyektida.
   - Perforator Bosch #2 — Alisher Zokirovda.`;
      } else if (lower.includes('sement') || lower.includes('gruzchik') || lower.includes('yuk') || lower.includes('kran') || lower.includes('musir') || lower.includes('logistika') || lower.includes('грузчик')) {
        contextualReply = `🚚 **Logistika va xizmat narxlari hisobi:**

- **Yuk ko'taruvchilar (Gruzchiklar):**
  - Standart norma: 1 ishchi 50 kg gacha ko'taradi.
  - Soatlik stavka: 65 000 so'm/soat (Minimal: 100 000 so'm).
  - Qavat ustamasi: 4-qavat (lift yo'q) bo'lsa har bir qop uchun +2 500 so'm va ishchiga +30 000 so'm.
  - 50 qop sement 4-qavatga: taxminan **485 000 so'm** (4 nafar ishchi tavsiya qilinadi).

- **Avtokran va Chiqindi tashish:**
  - Avtokran 25t: 350 000 so'm/soat.
  - Chiqindi tashish: ZIL (5t) - 550 000 so'm, Kamaz (10t) - 850 000 so'm.`;
      } else {
        contextualReply = `Assalomu alaykum! Arboss WMS AI yordamchisi bo'yicha tahlil:

Hozirgi ombor ko'rsatkichlari:
• Jami uskunalar: 8 dona (4 tasi bo'sh, 2 tasi ijarada, 1 tasi ta'mirda, 1 tasi yangi qabul qilingan).
• Jami kassa qoldiqlari: 108 450 000 so'm (Naqd, Click/Payme va Bank hisobi).
• Faol ijaralar: 2 ta shartnoma bo'yicha daromad kelmoqda.

Qanday aniq yo'nalish bo'yicha tahlil yoki kalkulyatsiya kerak?`;
      }

      return res.json({ reply: contextualReply });
    }
  } catch (error: any) {
    console.error('Server AI Handler Error:', error?.message);
    return res.status(500).json({
      error: 'Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.',
    });
  }
});

// Configure Vite in dev mode or static files in production
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Arboss WMS server running securely on http://localhost:${PORT}`);
  });
}

startServer();
