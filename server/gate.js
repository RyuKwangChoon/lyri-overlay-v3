import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// 🔧 CONFIGURATION
// ========================================
const app = express();
const GATE_PORT = process.env.GATE_PORT || 8788;
const RELAY_URL = process.env.RELAY_URL || 'http://127.0.0.1:8787';
const RELAY_TOKEN = process.env.RELAY_TOKEN || 'lyri_secret_1234';
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS || 'http://localhost:5173').split(',');
const FALLBACK_DIR = './logs';

// Middleware
app.use(express.json());

// ========================================
// 🔒 CORS MIDDLEWARE
// ========================================
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOW_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ========================================
// 🔐 BEARER TOKEN VALIDATION
// ========================================
const validateBearerToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  if (token !== RELAY_TOKEN) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  next();
};

// ========================================
// 📁 FALLBACK UTILITIES
// ========================================
const ensureFallbackDir = () => {
  if (!fs.existsSync(FALLBACK_DIR)) {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });
  }
};

const saveFallback = (data) => {
  ensureFallbackDir();
  const filename = path.join(FALLBACK_DIR, 'unsent.json');
  let fallbackData = [];
  if (fs.existsSync(filename)) {
    try {
      fallbackData = JSON.parse(fs.readFileSync(filename, 'utf-8'));
    } catch (e) {
      console.error('❌ Failed to parse fallback file:', e.message);
    }
  }
  fallbackData.push({
    timestamp: new Date().toISOString(),
    data: data,
  });
  fs.writeFileSync(filename, JSON.stringify(fallbackData, null, 2), 'utf-8');
  console.log(`💾 Fallback saved (total: ${fallbackData.length})`);
};

// ========================================
// 📡 POST /fromGpt - Receive GPT Message
// ========================================
app.post('/fromGpt', validateBearerToken, async (req, res) => {
  try {
    const { text, role } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing text field' });
    }

    // Role mapping (brian/assistant)
    const mappedRole = role === 'brian' ? 'brian' : 'assistant';

    const payload = {
      text,
      role: mappedRole,
      timestamp: new Date().toISOString(),
    };

    console.log(`📨 Received from GPT: role=${mappedRole}, text=${text.substring(0, 50)}...`);

    // Forward to Relay Server
    const relayResponse = await fetch(`${RELAY_URL}/message/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RELAY_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!relayResponse.ok) {
      throw new Error(`Relay responded with status ${relayResponse.status}`);
    }

    const result = await relayResponse.json();
    console.log(`✅ Message forwarded to Relay: ${result.message || 'OK'}`);

    res.json({
      success: true,
      message: 'Message received and forwarded',
      data: result,
    });
  } catch (error) {
    console.error(`❌ Error forwarding to Relay: ${error.message}`);

    // Save to fallback if Relay is down
    saveFallback(req.body);

    res.status(202).json({
      success: false,
      message: 'Relay unavailable, message saved to fallback',
      error: error.message,
    });
  }
});

// ========================================
// 🔄 POST /resend-fallback - Resend Unsent Messages
// ========================================
app.post('/resend-fallback', validateBearerToken, async (req, res) => {
  try {
    ensureFallbackDir();
    const filename = path.join(FALLBACK_DIR, 'unsent.json');

    if (!fs.existsSync(filename)) {
      return res.status(404).json({ message: 'No fallback messages found' });
    }

    let fallbackData = JSON.parse(fs.readFileSync(filename, 'utf-8'));
    const originalCount = fallbackData.length;
    const failedMessages = [];

    for (const item of fallbackData) {
      try {
        const relayResponse = await fetch(`${RELAY_URL}/message/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RELAY_TOKEN}`,
          },
          body: JSON.stringify(item.data),
        });

        if (!relayResponse.ok) {
          failedMessages.push(item);
        }
      } catch (error) {
        console.error(`⚠️  Failed to resend: ${error.message}`);
        failedMessages.push(item);
      }
    }

    // Update fallback file with failed messages only
    if (failedMessages.length > 0) {
      fs.writeFileSync(filename, JSON.stringify(failedMessages, null, 2), 'utf-8');
    } else {
      fs.unlinkSync(filename);
    }

    res.json({
      success: true,
      totalRetried: originalCount,
      failedCount: failedMessages.length,
      message: `Resent ${originalCount - failedMessages.length} messages`,
    });
  } catch (error) {
    console.error(`❌ Error during resend: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ========================================
// 🏥 GET /health - Gate Health Check
// ========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'gate-v3',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ========================================
// 🔌 GET /relay/ping - Relay Connectivity
// ========================================
app.get('/relay/ping', async (req, res) => {
  try {
    const relayResponse = await fetch(`${RELAY_URL}/health`, {
      method: 'GET',
      timeout: 5000,
    });

    if (relayResponse.ok) {
      const data = await relayResponse.json();
      res.json({
        status: 'connected',
        relay: data,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'relay-error',
        code: relayResponse.status,
        message: 'Relay server returned an error',
      });
    }
  } catch (error) {
    console.error(`❌ Relay ping failed: ${error.message}`);
    res.status(503).json({
      status: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ========================================
// 🔌 GET /relay/health - Detailed Relay Check
// ========================================
app.get('/relay/health', async (req, res) => {
  try {
    const relayResponse = await fetch(`${RELAY_URL}/health`);
    const data = await relayResponse.json();
    res.json({
      status: 'ok',
      relay: data,
      gate: {
        port: GATE_PORT,
        uptime: process.uptime(),
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
    });
  }
});

// ========================================
// 🚨 ERROR HANDLING
// ========================================
app.use((err, req, res, next) => {
  console.error(`❌ Unhandled error: ${err.message}`);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ========================================
// 🚀 START SERVER
// ========================================
app.listen(GATE_PORT, () => {
  console.log(`
🚀 =====================================
   GATE SERVER V3 STARTED
🚀 =====================================
   Port: ${GATE_PORT}
   Relay URL: ${RELAY_URL}
   Allowed Origins: ${ALLOW_ORIGINS.join(', ')}
   Status: https://localhost:${GATE_PORT}/health
🚀 =====================================
  `);
});

export default app;
