
// ============================================================================
// gate_v2.1.js  — Lyri Sudabang Overlay (Gate: GPT → Relay)
// Author: Lyri (GPT-5 Thinking), Date: 20251008
// Purpose:
//   - Receive messages from CustomGPT at /fromGpt
//   - Relay to Overlay Server (/message/save) with Bearer auth
//   - Automatic retry (3 attempts, exponential backoff)
//   - Fallback queue (logs/unsent.json) on final failure
//   - Health checks: /ping, /relay/ping, /relay/health
//   - NO DB connection here (pure gateway)
//
// Run: node gate_v2.1.js  (PORT=8788 by default)
//
// Env (.env):
//   PORT=8788
//   RELAY_URL=https://api.lyrisudabang.com
//   RELAY_TOKEN=lyri_secret_1234
//   ALLOW_ORIGINS=https://overlay.lyrisudabang.com,https://gpt.lyrisudabang.com
//   FORCE_ROLE_MAP=1   (optional: force role mapping rules below)
//
// ============================================================================
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Node 18+: global fetch is available. If not, fallback to node-fetch (dynamic import).
let _fetch = globalThis.fetch;
async function ensureFetch(...args) {
  if (!_fetch) {
    const mod = await import("node-fetch");
    _fetch = mod.default;
  }
  return _fetch(...args);
}

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Config ----------
const PORT = Number(process.env.GATE_PORT || 8788);
const RELAY_URL = (process.env.RELAY_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const RELAY_TOKEN = process.env.RELAY_TOKEN || "lyri_secret_1234";
const FORCE_ROLE_MAP = process.env.FORCE_ROLE_MAP === "1"; // optional strict mapping

// Allow list (CSV) → array
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS || [
  "http://localhost:5173",
  "https://overlay.lyrisudabang.com",
  "https://api.lyrisudabang.com",
  "https://gpt.lyrisudabang.com"
].join(",")).split(",").map(s => s.trim()).filter(Boolean);

// ---------- Paths (logs/fallback queue) ----------
const LOG_DIR = path.join(__dirname, "./logs");
const FALLBACK_FILE = path.join(LOG_DIR, "unsent.json");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(FALLBACK_FILE)) fs.writeFileSync(FALLBACK_FILE, "[]", "utf-8");

// ---------- Express ----------
const app = express();

// CORS (allow-list)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / local
    return cb(null, ALLOW_ORIGINS.includes(origin));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ type: ["application/json", "application/json; charset=utf-8"] }));

// ---------- Helpers ----------
function mapRoleLabel(input) {
  // Normalize any 'lyri/assistant' to 'assistant', 'brian/user' to 'brian'
  const s = String(input || "").toLowerCase();
  if (FORCE_ROLE_MAP) {
    if (/(assistant|lyri|리리)/.test(s)) return "assistant";
    return "brian";
  }
  // default: pass-through common labels
  if (/(assistant|lyri|리리)/.test(s)) return "assistant";
  if (/(brian|user|브라이언)/.test(s)) return "brian";
  return s || "assistant";
}

async function relayMessage(payload) {
  // payload: { text, role, type, session_id, priority }
  const url = RELAY_URL + "/message/save";
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${RELAY_TOKEN}`
  };
  const res = await ensureFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Relay HTTP ${res.status} ${res.statusText}: ${body}`);
  }
  return res.json().catch(() => ({ ok: true }));
}

function pushFallbackQueue(item) {
  try {
    const arr = JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf-8"));
    arr.push(item);
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("❌ fallback queue write error:", e.message);
  }
}

async function resendFallbackQueue() {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf-8"));
  } catch (e) {
    console.error("❌ fallback queue read error:", e.message);
    return { ok: false, count: 0 };
  }
  if (!Array.isArray(arr) || arr.length === 0) return { ok: true, count: 0 };

  const remain = [];
  let sent = 0;
  for (const item of arr) {
    try {
      await relayMessage(item);
      sent++;
    } catch (e) {
      remain.push(item);
    }
  }
  fs.writeFileSync(FALLBACK_FILE, JSON.stringify(remain, null, 2), "utf-8");
  return { ok: true, count: sent, remain: remain.length };
}

// ---------- Routes ----------

// GPT → Gate → Relay
app.post("/fromGpt", async (req, res) => {
  const brianRaw = (req.body?.brian ?? "").toString().trim();
  const lyriRaw  = (req.body?.lyri  ?? "").toString().trim();
  const session_id = (req.body?.session_id ?? "live").toString();
  const priority = Number(req.body?.priority ?? 10);
  const type = (req.body?.type ?? "chat").toString();

  if (!brianRaw && !lyriRaw) return res.status(400).json({ ok: false, err: "empty message" });

  const jobs = [];
  if (brianRaw) jobs.push({ text: brianRaw, role: "brian", type, session_id, priority });
  if (lyriRaw)  jobs.push({ text: lyriRaw, role: "assistant", type, session_id, priority });

  const results = [];
  for (const payload of jobs) {
    // sanity normalize
    payload.role = mapRoleLabel(payload.role);
    // retry up to 3 with exponential backoff (0ms, 400ms, 1200ms)
    const delays = [0, 400, 1200];
    let ok = false, lastErr = null;

    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
      try {
        const r = await relayMessage(payload);
        results.push({ ok: true, data: r });
        ok = true;
        break;
      } catch (e) {
        lastErr = e;
        console.error("⚠️ relay attempt failed:", e.message);
      }
    }

    if (!ok) {
      // fallback write
      pushFallbackQueue({
        ...payload,
        failed_at: new Date().toISOString()
      });
      results.push({ ok: false, err: lastErr?.message || "relay failed, queued" });
    }
  }

  res.json({ ok: true, results });
});

// Manual append (for local tests or legacy callers)
app.post("/append", async (req, res) => {
  const text = (req.body?.text ?? "").toString().trim();
  const from = (req.body?.from ?? "").toString().trim();
  if (!text) return res.status(400).json({ ok: false, err: "Missing text" });

  const payload = {
    text,
    role: mapRoleLabel(from || "brian"),
    type: (req.body?.type ?? "chat").toString(),
    session_id: (req.body?.session_id ?? "live").toString(),
    priority: Number(req.body?.priority ?? 10)
  };

  try {
    const r = await relayMessage(payload);
    return res.json({ ok: true, data: r });
  } catch (e) {
    pushFallbackQueue({
      ...payload,
      failed_at: new Date().toISOString()
    });
    return res.status(502).json({ ok: false, err: e.message, queued: true });
  }
});

// Fallback resend (manual)
app.post("/resend-fallback", async (_req, res) => {
  const r = await resendFallbackQueue();
  res.json(r);
});

// Health: Gate
app.get("/ping", (_req, res) => {
  res.json({
    status: "ok",
    gate: "v2.1",
    time: new Date().toISOString(),
    relay: RELAY_URL
  });
});

// Health: Relay /ping passthrough
app.get("/relay/ping", async (_req, res) => {
  try {
    const r = await ensureFetch(RELAY_URL + "/ping");
    const j = await r.json().catch(() => ({}));
    res.json({ ok: true, status: r.status, body: j });
  } catch (e) {
    res.status(502).json({ ok: false, err: e.message });
  }
});

// Health: Relay status
app.get("/relay/health", async (_req, res) => {
  try {
    const r = await ensureFetch(RELAY_URL + "/healthz");
    const t = await r.text();
    res.json({ ok: r.ok, status: r.status, text: t });
  } catch (e) {
    res.status(502).json({ ok: false, err: e.message });
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`🌀 Gate v2.1 on http://127.0.0.1:${PORT}`);
  console.log(`➡️ Relay target: ${RELAY_URL}`);
  console.log(`🔐 Bearer: ${RELAY_TOKEN ? "[set]" : "[missing]"}`);
  console.log(`🌐 CORS allow:`, ALLOW_ORIGINS);
});
