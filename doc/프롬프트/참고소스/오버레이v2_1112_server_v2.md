// server_v2.0.js  (1.8 호환 리팩토링)
/////////////////////////////////////////////////////////////////////////////////////
// --- import 영역 ---
import dotenv from "dotenv";
import express from "express";
import { exec } from "child_process";
import cors from "cors";
import multer from "multer";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import * as mm from "music-metadata";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import iconv from "iconv-lite";

dotenv.config();

/////////////////////////////////////////////////////////////////////////////////////
import { convertWavToMp3 } from "./modules/convertToMp3.js";

/////////////////////////////////////////////////////////////////////////////////////
// --- 기본 상수 / 초기화 ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHAT_ROLE = "assistant";
const LABEL = "GPT";
const AUTH_TOKEN = process.env.RELAY_TOKEN || "lyri_secret_1234";

/////////////////////////////////////////////////////////////////////////////////////
// --- Express 인스턴스 ---
const app = express();

/////////////////////////////////////////////////////////////////////////////////////
// --- CORS (가장 위에서 실행) ---
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8787",
    "https://overlay.lyrisudabang.com",
    "https://api.lyrisudabang.com",
    "https://gpt.lyrisudabang.com"
  ],
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options(/.*/, (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.sendStatus(200);
});

/////////////////////////////////////////////////////////////////////////////////////
// ===============================================
// 💡 파일명 디코딩 헬퍼
// ===============================================
function decodeFilename(name) {
  let decoded = name;
  try {
    // Step 1: latin1 → utf8 (윈도우/크롬 대부분 케이스)
    decoded = Buffer.from(name, "latin1").toString("utf8");
    // Step 2: 깨짐 문자 존재 시 binary → utf8 재시도
    if (/�/.test(decoded)) {
      decoded = iconv.decode(Buffer.from(name, "binary"), "utf8");
    }
    // Step 3: 퍼센트 인코딩 케이스도 처리 (macOS, 사파리)
    if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
      decoded = decodeURIComponent(decoded);
    }
  } catch (err) {
    console.warn("⚠ decodeFilename 실패:", err.message);
  }
  return decoded;
}

// ===============================================
// 📦 Multer Storage 설정
// ===============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "./uploads"));
  },
  filename: (req, file, cb) => {
    const original = file.originalname;
    const decoded = decodeFilename(original);
    const cleaned = decoded.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    const safeName = `${Date.now()}_${cleaned}`;
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 업로드 파일 수신");
    console.log("▶ original :", original);
    console.log("▶ decoded  :", decoded);
    console.log("▶ safeName :", safeName);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500, files: 100 },
});

/////////////////////////////////////////////////////////////////////////////////////
// --- JSON Body 파서 (multer 뒤로 이동) ---
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));

/////////////////////////////////////////////////////////////////////////////////////
// --- 정적 파일 서빙 ---
app.use(express.static(path.join(__dirname, "./public"), {
  dotfiles: "allow",
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}));

/////////////////////////////////////////////////////////////////////////////////////
// --- DB 연결 풀 ---
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT || 3307,
  user: process.env.DB_USER || "overlay_lyri",
  password: process.env.DB_PASS || "kwang760!@3",
  database: process.env.DB_NAME || "overlay_db",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});


/////////////////////////////////////////////////////////////////////////////////////
// --- HTTP + WebSocket 서버 ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set();

/////////////////////////////////////////////////////////////////////////////////////
// --- SPA 엔트리 포인트 ---
app.get(["/", "/overlay", "/notice", "/chatOverlay.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "./public/chatOverlay_v2.0.html"));
});

// --- ai-plugin.json ---
app.get("/.well-known/ai-plugin.json", (req, res) => {
  res.sendFile(path.join(__dirname, "./public", ".well-known", "ai-plugin.json"));
});

/////////////////////////////////////////////////////////////////////////////////////
app.post("/convert-mp3", (req, res) => {
  const { inputDir, outputDir } = req.body;

  if (!inputDir || !outputDir) {
    return res.status(400).json({ success: false, message: "경로 누락" });
  }

  const cmd = `node ./batch_mp3_converter.js "${inputDir}" "${outputDir}"`;

  console.log(`🎧 변환 실행: ${cmd}`);

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ 변환 오류:", stderr);
      return res.json({ success: false, message: stderr });
    }

    // 파일 개수 추정 (stdout 로그에서 “✅ 변환 완료” 카운트)
    const count = (stdout.match(/✅ 변환 완료/g) || []).length;
    console.log(stdout);
    res.json({ success: true, count });
  });
});
// ========================================================
// ✅ (2) WebSocket 브로드캐스트 수신 시 repeat 이벤트 처리
// ========================================================
wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("⚡ WebSocket 클라이언트 접속");

  // 🆕 추가: 제어판 → 서버 → 오버레이 명령 릴레이
  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);

      // 🟢 기존 broadcast 처리 유지
      if (data.type === "broadcast") {
        const payload = data.payload;

        // 🔁 반복 모드 브로드캐스트 (추가)
        if (payload.type === "repeat") {
          console.log(`🔁 [Repeat Mode 변경]: ${payload.value}`);

          // ✅ DB에 repeat_mode 업데이트 (현재 now_playing 상태 유지)
          try {
            const [rows] = await pool.query("SELECT id FROM tb_now_playing LIMIT 1");
            if (rows.length > 0) {
              await pool.query(
                "UPDATE tb_now_playing SET repeat_mode=?, updated_at=NOW() WHERE id=?",
                [payload.value, rows[0].id]
              );
              console.log(`✅ DB repeat_mode → ${payload.value}`);
            }
          } catch (dbErr) {
            console.error("❌ repeat_mode DB 업데이트 실패:", dbErr.message);
          }
        }

        // 기존 코드: 다른 클라이언트로 브로드캐스트
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(payload));
          }
        });
      }
    } catch (err) {
      console.error("❌ WS 메시지 처리 오류:", err);
    }
  });

  ws.on("close", () => clients.delete(ws));
});



// ✅ 브로드캐스트 함수
// =============================
// 🎯 Overlay Broadcast Helper
// =============================
function cast(payload) {
  //console.log("📡 cast() 호출됨:", payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      //console.log("📨 WS 송신 성공");
      client.send(JSON.stringify(payload));
    } else {
      //console.log("⚪ WS 비활성 상태:", client.readyState);
    }
  });
}

// ✅ 인증 미들웨어
function auth(req, res, next) {
  
  const h = req.headers.authorization || "";
  console.log("✅ 인증 미들웨어 : ",h);
  if (!AUTH_TOKEN) return res.status(500).json({ ok: false, err: "server token not set" });
  if (h === `Bearer ${AUTH_TOKEN}`) return next();
  return res.status(401).json({ ok: false, err: "unauthorized" });
}

// ✅ 메시지 저장 API (v1.8 동일)
app.post("/message/save", auth, async (req, res) => {
  const {
    text,
    role = "assistant",
    imoji = null,
    overlay_date = null,
    broadcast_ymd = null,
    seq = null,
    priority = 10,
    type = "chat",
    session_id = "live",
    repeatable = "N",
    with_promo = "N"
  } = req.body || {};

  if (!text) return res.status(400).json({ ok: false, err: "text required" });

  try {
    const [result] = await pool.query(
      `INSERT INTO tb_overlay_message
       (text, role, imoji, overlay_date, broadcast_ymd, seq, priority, type, session_id, repeatable, with_promo, sent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N')`,
      [text, role, imoji, overlay_date, broadcast_ymd, seq, priority, type, session_id, repeatable, with_promo]
    );

    console.log("📝 DB 저장 성공:", { id: result.insertId, text });

    // 1) 즉시 브로드캐스트
    cast({
      type: "append",
      line: {
        id: result.insertId,
        role,
        text,
        ts: new Date().toISOString(),
        type
      }
    });
    // 2) 바로 sent='Y' 마킹(중복 송출 방지)
    await pool.query(
      `UPDATE tb_overlay_message SET sent='Y', delivered_at=NOW() WHERE id=?`,
      [result.insertId]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("❌ DB 저장 실패:", err.message);
    res.status(500).json({ ok: false, err: err.message });
  }
});

// ✅ 미발송 메시지 송출 워커 (2초 주기)
setInterval(async () => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM tb_overlay_message WHERE sent='N' ORDER BY priority ASC, id ASC LIMIT 10`
    );

    for (const row of rows) {
      const msg = {
        id: row.id,
        role: row.role,
        text: row.text,
        ts: row.ts,
        type: row.type
      };

      cast({ type: "append", line: msg });
      await pool.query(
        `UPDATE tb_overlay_message SET sent='Y', delivered_at=NOW() WHERE id=?`,
        [row.id]
      );
      console.log("✅ 메시지 송출 완료:", row.id);
    }
  } catch (err) {
    console.error("❌ 송출 워커 에러:", err.message);
  }
}, 2000);

// ✅ 전체 클리어
app.post("/clear", auth, (_req, res) => {
  cast({ type: "clear" });
  res.json({ ok: true });
});

// ✅ 헬스체크
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ✅ Notice API (v1.8 완전 동일)
app.get("/notice/list", async (_req, res) => {
  const [rows] = await pool.query(
    "SELECT id, text, slot, is_active FROM tb_overlay_notice ORDER BY id DESC"
  );
  res.json(rows);
});

//공지사항
app.post("/notice/add", auth, async (req, res) => {
  const { text, slot = "top" } = req.body || {};
  const valid = ["title", "top", "bottom"];

  // 1️⃣ 유효성 검증
  if (!text) return res.status(400).json({ ok: false, err: "text required" });
  if (!valid.includes(slot)) return res.status(400).json({ ok: false, err: "invalid slot" });

  try {
    // 2️⃣ DB 입력
    await pool.query(
      "INSERT INTO tb_overlay_notice (text, slot, is_active) VALUES (?, ?, 'N')",
      [text, slot]
    );
    res.json({ ok: true });

  } catch (err) {
    // 3️⃣ 에러 처리: 서버 다운 방지 + 메시지 반환
    console.error("❌ /notice/add DB Error:", err.message);
    res.status(500).json({ ok: false, err: err.message || "DB insert failed" });
  }
});


app.post("/notice/updateActive", auth, async (req, res) => {
  try {
    const { ids = [] } = req.body || {};
    const cleanIds = ids.map(x => Number(x)).filter(x => !isNaN(x));

    console.log('--- [UPDATE ACTIVE] ---');
    console.log('받은 ids:', cleanIds);

    // 1️⃣ 전체 비활성화
    const [resetResult] = await pool.query(
      "UPDATE tb_overlay_notice SET is_active='N'"
    );
    console.log(`🟤 전체 비활성화 ${resetResult.affectedRows}건`);

    // 2️⃣ 선택된 항목만 활성화
    if (cleanIds.length) {
      const [activeResult] = await pool.query(
        `UPDATE tb_overlay_notice SET is_active='Y' WHERE id IN (${cleanIds.map(() => "?").join(",")})`,
        cleanIds
      );
      console.log(`🟢 활성화된 공지 ${activeResult.affectedRows}건`);
    } else {
      console.warn("⚠️ ids가 비어있습니다. 활성화 없음.");
    }

    res.json({ ok: true });

  } catch (err) {
    console.error("❌ /notice/updateActive 오류:", err);
    res.status(500).json({ ok: false, msg: "서버 오류", error: err.message });
  }
});

// ✅ Notice 삭제 API
app.post("/notice/delete", auth, async (req, res) => {
  try {
    const { ids = [] } = req.body || {};
    const cleanIds = ids.map(x => Number(x)).filter(x => !isNaN(x));

    if (!cleanIds.length)
      return res.status(400).json({ ok: false, msg: "삭제할 ID가 없습니다." });

    const [result] = await pool.query(
      `DELETE FROM tb_overlay_notice WHERE id IN (${cleanIds.map(() => "?").join(",")})`,
      cleanIds
    );

    console.log(`🗑 공지 삭제 완료 ${result.affectedRows}건`);
    res.json({ ok: true, count: result.affectedRows });
  } catch (err) {
    console.error("❌ /notice/delete 오류:", err);
    res.status(500).json({ ok: false, msg: "서버 오류", error: err.message });
  }
});


// ✅ Notice Active API (수정 버전)
app.get("/notice/active", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT text, slot FROM tb_overlay_notice WHERE is_active = 'Y' ORDER BY id ASC"
    );

    const out = { title: [], top: [], bottom: [] };

    // 🔁 안전한 분류
    for (const r of rows) {
      const slot = r.slot || "top";
      if (out[slot]) out[slot].push(r.text);
    }

    console.log("📡 Notice active rows:", rows.length);
    res.json(out);
  } catch (err) {
    console.error("❌ /notice/active DB Error:", err.message);
    res.status(500).json({ ok: false, err: err.message });
  }
});


// ✅ 서버 헬스체크용 엔드포인트
app.get("/ping", (req, res) => {
  res.json({
    status: "ok",
    message: "Overlay v2.0 (1.8 compatible) is alive",
    time: new Date().toISOString()
  });
});

async function waitDbReady() {
  for (let i of [0, 2000, 5000]) {
    if (i) await new Promise(r => setTimeout(r, i));
    try {
      const conn = await pool.getConnection();
      await conn.query('SELECT 1');
      conn.release();
      console.log('✅ DB OK');
      return;
    } catch (e) {
      console.log('❌ DB fail:', e.code);
    }
  }
  process.exit(1);
}

await waitDbReady();

/**
 * Control Panel
 */

// 트랙 목록
app.get("/tracks/list", async (_req, res) => {
  const [rows] = await pool.query(
    "SELECT id, title, artist, duration_sec, file_path, track_no FROM tb_tracks ORDER BY track_no ASC"
  );
  res.json(rows);
});


// ============================================================
// 🎵 [멀티 트랙 업로드 + 메타추출] Track Upload API
// ============================================================
// ===============================================
// 🚀 /tracks/upload
// ===============================================
// ============================================================
// 🎵 [멀티 트랙 업로드 + WAV→MP3 변환 + 메타추출] Track Upload API
// ============================================================
app.post("/tracks/upload", auth, upload.array("file"), async (req, res) => {
  try {
    const files = req.files;
    if (!files?.length) return res.status(400).json({ ok: false, err: "no files uploaded" });

    const jobs = files.map(async (f, idx) => {
      console.log(`\n🎧 [${idx + 1}] 업로드 처리 시작`);
      console.log("──────────────────────────────");

      // ✅ 파일명 디코딩
      let original = decodeFilename(f.originalname);
      console.log("원본 복구:", original);

      const parsed = path.parse(original);
      const title = parsed.name;
      let fileExt = (parsed.ext || ".wav").slice(1).toLowerCase();

      // ✅ WAV → MP3 변환
      if (fileExt === "wav") {
        console.log(`🎧 [${title}] WAV 감지 → MP3 변환 시도`);
        try {
          const newPath = await convertWavToMp3(f.path);
          f.path = newPath;
          f.filename = path.basename(newPath);
          fileExt = "mp3";
          console.log(`✅ [${title}] 변환 완료 → ${f.filename}`);
        } catch (convErr) {
          console.warn(`⚠ [${title}] 변환 실패, 원본 유지:`, convErr.message);
        }
      }

      const fileStored = f.filename;
      const fileOriginal = original;
      const filePath = `/uploads/${f.filename}`;

      console.log("파일 파싱 정보:");
      console.log("  ┣ title       :", title);
      console.log("  ┣ fileStored  :", fileStored);
      console.log("  ┣ fileOriginal:", fileOriginal);
      console.log("  ┣ filePath    :", filePath);
      console.log("  ┗ fileExt     :", fileExt);

      // ✅ 메타데이터 추출
      let duration_sec = 0, sampleRate = null, bitRate = null, codec = null;
      try {
        const meta = await mm.parseFile(f.path).catch(() => ({}));
        duration_sec = Math.round(meta?.format?.duration || 0);
        sampleRate = meta?.format?.sampleRate || null;
        bitRate = meta?.format?.bitrate ? Math.round(meta.format.bitrate / 1000) : null;
        codec = meta?.format?.codec || null;
        console.log("메타데이터 추출 성공:", { duration_sec, sampleRate, bitRate, codec });
      } catch (metaErr) {
        console.warn("⚠ 메타데이터 추출 실패:", metaErr.message);
      }

      // ✅ DB Insert
      try {
        await pool.query(`
          INSERT INTO tb_tracks
            (title, artist, album, file_stored, file_original, file_path, file_ext, duration_sec, lufs, peak, emotion, status, track_no)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT IFNULL(MAX(track_no),0)+1 FROM tb_tracks))
        `, [title, "Brian", null, fileStored, fileOriginal, filePath, fileExt, duration_sec, null, null, "custom", "active"]);
        console.log(`✅ [DB 등록 완료] ${title} (${duration_sec}s, ${bitRate}kbps)`);
      } catch (dbErr) {
        console.error("❌ DB 등록 실패:", dbErr.message);
      }

      console.log("──────────────────────────────\n");
    });

    //await Promise.all(jobs);
    for (const f of files) {
      await saveToDB(f)
    }

    res.json({ ok: true, count: files.length });
    console.log(`🎉 [업로드 완료] 총 ${files.length}개 파일`);
  } catch (e) {
    console.error("🚨 [업로드 오류]:", e.message);
    res.status(500).json({ ok: false, err: e.message });
  }
});


// ============================================================
// 🗑 트랙 삭제 (단일 or 전체 삭제 지원)
// ============================================================
app.post("/tracks/delete", auth, async (req, res) => {
  try {
    const { id, all } = req.body || {};
    const allMode = all === true || all === "true"; // ← 문자열도 true로 처리

    if (allMode) {
      // ✅ 전체 삭제: DB에서 파일 경로 먼저 조회
      const [rows] = await pool.query("SELECT file_path FROM tb_tracks");
      for (const r of rows) {
        const filePath = path.join(__dirname, r.file_path.replace(/^\//, ""));
        try { fs.unlinkSync(filePath); } catch {}
      }

      const [result] = await pool.query("DELETE FROM tb_tracks");
      console.log(`🗑 [전체 삭제] ${result.affectedRows} tracks deleted`);
      return res.json({ ok: true, deleted: result.affectedRows, mode: "all" });
    }

    if (!id) {
      return res.status(400).json({ ok: false, err: "id required (or all=true)" });
    }
    // ✅ 단일 삭제: 파일 먼저 찾아서 지우기
    const [[track]] = await pool.query("SELECT file_path FROM tb_tracks WHERE id=?", [id]);
    if (track?.file_path) {
      const filePath = path.join(__dirname, track.file_path.replace(/^\//, ""));
      try {
        fs.unlinkSync(filePath);
        console.log("🧹 파일 삭제 완료:", filePath);
      } catch (err) {
        console.warn("⚠️ 파일 삭제 실패:", err.message);
      }
    }
  // DB 삭제    
    const [result] = await pool.query("DELETE FROM tb_tracks WHERE id=?", [id]);
    console.log(`🗑 [단일 삭제] id=${id}, ${result.affectedRows} rows`);
    res.json({ ok: true, deleted: result.affectedRows, mode: "single" });

  } catch (err) {
    console.error("❌ [트랙 삭제 오류]:", err.message);
    res.status(500).json({ ok: false, err: err.message });
  }
});

app.use("/uploads", express.static(path.join(__dirname, "./uploads"), {
  etag: false, maxAge: 0,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
}));

// 🎯 추가 시작: 트랙 제목 수정 기능
app.post("/tracks/updateTitle", auth, async (req, res) => {
  const { id, title } = req.body || {};
  if (!id || !title) return res.status(400).json({ ok: false, err: "id/title required" });

  try {
    const [result] = await pool.query(
      "UPDATE tb_tracks SET title=?, updated_at=NOW() WHERE id=?",
      [title, id]
    );
    console.log(`✏️ [트랙 제목 수정] id=${id}, title=${title}`);
    res.json({ ok: true, affected: result.affectedRows });
  } catch (err) {
    console.error("❌ [트랙 제목 수정 오류]:", err.message);
    res.status(500).json({ ok: false, err: err.message });
  }
});
// 🎯 추가 끝
// 🎯 추가 시작: 트랙 순서 변경 기능 (드래그/버튼식 재정렬)
app.post("/tracks/reorder", auth, async (req, res) => {
  const { order = [] } = req.body || {};
  if (!order.length)
    return res.status(400).json({ ok: false, err: "empty order array" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 순서 배열을 기준으로 트랙번호(track_no) 업데이트
    for (let i = 0; i < order.length; i++) {
      const trackId = order[i];
      const trackNo = i + 1;
      await conn.query("UPDATE tb_tracks SET track_no=? WHERE id=?", [
        trackNo,
        trackId,
      ]);
    }

    await conn.commit();
    console.log("🔢 [트랙 순서 재정렬 완료]", order);
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error("❌ [트랙 순서 재정렬 오류]:", err.message);
    res.status(500).json({ ok: false, err: err.message });
  } finally {
    conn.release();
  }
});
// 🎯 추가 끝


app.options("/tracks/upload", cors());
// NowPlaying 적용 (선택)
// NowPlaying 적용 (수정완료 버전)
// ==========================
// 🛰 NowPlaying 업데이트 (DB 반영)
// ==========================
// 🛰 NowPlaying 업데이트 (서버)
// ============================================================
// 🛰 NowPlaying 업데이트 (서버)
// ============================================================
app.post("/nowplaying/update", async (req, res) => {
  try {
    const {
      track_id,
      track_title,
      album = null,
      file_path = "",
      duration_sec = 0,
      current_pos_sec = 0,
      is_playing = "Y",
      emotion = "custom",
      repeat_mode 
    } = req.body || {};

    if (!track_id) return res.status(400).json({ ok: false, err: "track_id required" });

    // ----------------------------------------
    // 🧩 현재 now_playing 존재 여부 체크
    // ----------------------------------------
    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS cnt FROM tb_now_playing`);
    const exists = countRow.cnt > 0;

    // ----------------------------------------
    // 🎧 트랙 정보 조회
    // ----------------------------------------
    const [[t]] = await pool.query(
      "SELECT title, duration_sec, artist, album, file_path FROM tb_tracks WHERE id=?",
      [track_id]
    );
    if (!t) throw new Error(`트랙 ID ${track_id} not found in tb_tracks`);

    const safeTitle = track_title || t.title;
    const safeDur = duration_sec || t.duration_sec || 0;
    const safeRepeat = repeat_mode || "none" ;

    // ----------------------------------------
    // ✏️ 존재하면 UPDATE / 없으면 INSERT
    // ----------------------------------------
    if (exists) {
      console.log("🟡 기존 now_playing 존재 → UPDATE 실행");

      await pool.query(`
        UPDATE tb_now_playing
           SET track_id=?,
               track_title=?,
               artist=?,
               album=?,
               file_path=?,
               duration_sec=?,
               current_pos_sec=?,
               is_playing=?,
               emotion=?,
               last_action='play',
               
               updated_at=NOW(),
               started_at=NOW()
         WHERE 1=1
      `, [
        track_id, safeTitle, t.artist || "Lyri", t.album, t.file_path,
        safeDur, current_pos_sec, is_playing, emotion
      ]);

    } else {
      console.log("🆕 now_playing 비어있음 → INSERT 실행");

      await pool.query(`
        INSERT INTO tb_now_playing
          (track_id, track_title, artist, album, file_path,
           duration_sec, current_pos_sec, is_playing, emotion,
           last_action, updated_at, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'play', NOW(), NOW())
      `, [
        track_id, safeTitle, t.artist || "Lyri", t.album, t.file_path,
        safeDur, current_pos_sec, is_playing, emotion
      ]);
    }

    // ----------------------------------------
    // 🌐 실시간 브로드캐스트
    // ----------------------------------------
    cast({
      type: "nowplaying_update",
      data: {
        track_id,
        track_title: safeTitle,
        artist: t.artist || "Lyri",
        album: t.album,
        file_path: t.file_path,
        duration_sec: safeDur,
        current_pos_sec,
        is_playing,
        repeat_mode: safeRepeat,
        emotion
      }
    });

    console.log(`✅ NowPlaying ${exists ? "UPDATE" : "INSERT"} 완료 → ${safeTitle}`);
    res.json({ ok: true, mode: exists ? "update" : "insert" });

  } catch (err) {
    console.error("🚨 [NowPlaying UPDATE 오류]:", err.message);
    res.status(500).json({ ok: false, err: err.message });
  }
});

let lastTick = 0;
// ========================================================
// 🎵 NowPlaying 상태 워커 (3초 주기)
// ========================================================
setInterval(async () => {
  const nowTick = Date.now();
  console.log(`[⏱️ 워커] tick interval = ${nowTick - lastTick}ms`);
  lastTick = nowTick;

  try {
    const [rows] = await pool.query(`
      SELECT np.*, t.title, 
             CASE WHEN np.duration_sec IS NULL OR np.duration_sec=0 THEN t.duration_sec ELSE np.duration_sec END AS eff_duration_sec
      FROM tb_now_playing np
      LEFT JOIN tb_tracks t ON t.id = np.track_id
      LIMIT 1
    `)

    if (rows.length === 0) return
    const row = rows[0]
    const { id, title,track_id, current_pos_sec, repeat_mode, is_playing , file_path} = row
    const duration_sec = Number(row.eff_duration_sec) || 0

    if (is_playing !== "Y") return
    if (!duration_sec || duration_sec <= 0) return

    // 로그 디버깅은 잠깐만
    console.log(">>>>>🎵 NowPlaying 상태 워커>>>> track_id=", track_id,"repeat_mode=", repeat_mode, "pos=", current_pos_sec, "dur=", duration_sec)
    // ✅ (1) 여기 추가: 일반 진행 중일 때 pos 3초씩 증가
    if (is_playing === "Y" && current_pos_sec < duration_sec - 3) {
      await pool.query(
        "UPDATE tb_now_playing SET current_pos_sec=?, updated_at=NOW() WHERE id=?",
        [current_pos_sec + 3, id]
      );
      // ❌ cast() 호출 제거 (워커에서 반복 송출 금지)
      return; // 곡이 끝나지 않았으면 여기서 끝
    }

    if (current_pos_sec >= duration_sec - 3) {
      if (repeat_mode === "none") {
        console.log(">>>>>>none :","track_id=", track_id, "repeat_mode=", repeat_mode, "pos=", current_pos_sec, "dur=", duration_sec)
        await pool.query(`
          UPDATE tb_now_playing 
          SET track_title=?,
              is_playing='N',
              ended_at=NOW(),
              last_action='stop',
              updated_at=NOW()
          WHERE id=?`, [title, id])  // ⚠️ repeat_mode = 'none' 제거
      } else if (repeat_mode === "one") {
        console.log(">>>>>>one :","track_id=", track_id,"repeat_mode=", repeat_mode, "pos=", current_pos_sec, "dur=", duration_sec)
        await pool.query(`
          UPDATE tb_now_playing
          SET track_title=? 
          , is_playing='Y'
          , current_pos_sec=0
          , started_at=NOW()
          , updated_at=NOW()
          WHERE id=?`, [title,id])

        const [[current]] = await pool.query(`SELECT   track_id,
                                                    track_title,
                                                    artist,
                                                    album,
                                                    file_path,
                                                    current_pos_sec,
                                                    duration_sec,
                                                    repeat_mode,
                                                    is_playing,
                                                    emotion,
                                                    updated_at
                                              FROM tb_now_playing WHERE track_id=? LIMIT 1`, [track_id])
        cast({
          type: "same_track_updated",
          data: {
            track_id: current.track_id,
            track_title: current.track_title,
            artist: current.artist || "Lyri",
            album: current.album || null,
            file_path: current.file_path,
            duration_sec: current.duration_sec,
            current_pos_sec: 0,
            is_playing: "Y",
            repeat_mode: "one",
            emotion: "custom"
          }
        });

      } else if (repeat_mode === "all") {
        console.log(">>>>>>all :","track_id=", track_id,"repeat_mode=", repeat_mode, "pos=", current_pos_sec, "dur=", duration_sec)

        const [[current]] = await pool.query("SELECT track_no FROM tb_tracks WHERE id=?", [track_id])
        const [[next]] = await pool.query(
          "SELECT id FROM tb_tracks WHERE track_no > ? ORDER BY track_no ASC LIMIT 1",
          [current?.track_no || 0]
        )
        let nextTrackId = next?.id
        if (!nextTrackId) {
          const [[first]] = await pool.query("SELECT id FROM tb_tracks ORDER BY track_no ASC LIMIT 1")
          nextTrackId = first?.id
        }

        const [[nextInfo]] = await pool.query("SELECT * FROM tb_tracks WHERE id=?", [nextTrackId])

        console.log(">>>>>>all :","[NP] switch → next:", {
          id: nextInfo?.id,
          title: nextInfo?.title,
          duration_in_tracks: nextInfo?.duration_sec
        });

        // 이상치 방어 (0 또는 10000초 이상 등은 0으로 보내고 프론트가 갱신)
        const safeDuration = (nextInfo?.duration_sec && nextInfo.duration_sec > 0 && nextInfo.duration_sec < 10000)
          ? nextInfo.duration_sec
          : 0;
        // 🎯 기존 repeat_mode 그대로 유지
        const currentRepeat = repeat_mode || 'all';  
        await pool.query("DELETE FROM tb_now_playing")
        await pool.query(`
          INSERT INTO tb_now_playing
            (track_id, track_title, artist, album, file_path,
            duration_sec, current_pos_sec, is_playing, emotion,
            last_action, repeat_mode, lufs, peak, updated_at, started_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, 'Y', ?, 'play', ?, ?, ?, NOW(), NOW())
        `, [
          nextInfo.id,
          nextInfo.title,
          nextInfo.artist || "Lyri",
          nextInfo.album,
          nextInfo.file_path,
          safeDuration,            // ✅ 방어된 duration
          "custom",
          "all",
          null,
          null
        ]);
        console.log(">>>>>>all :",`[NP] switched → ${nextInfo.title}, duration=${safeDuration}`);
        console.time('cast_send');
        cast({
          type: "nowplaying_update",
          data: {
            track_id: nextInfo.id,
            track_title: nextInfo.title,
            artist: nextInfo.artist || "Lyri",
            album: nextInfo.album || null,
            file_path: nextInfo.file_path,
            duration_sec: safeDuration,
            current_pos_sec: 0,
            is_playing: "Y",
            repeat_mode: "all",
            emotion: "custom"
          }
        });
        console.timeEnd('cast_send');
      }
    }

  } catch (err) {
    console.error("❌ [NowPlaying 워커 오류]:", err.message)
  }
}, 3000)
// ========================================================
// 🎵 NowPlaying 상태 워커 (루프 타임라인 로그 강화판)
// ========================================================
// async function loopNowPlaying() {
//   const loopStart = Date.now();
//   const tickLabel = `[🕐 워커 ${new Date().toISOString()}]`;

//   try {
//     //console.log(`${tickLabel} 🔄 루프 시작`);
//     const [rows] = await pool.query(`
//       SELECT np.*, t.title, 
//              CASE WHEN np.duration_sec IS NULL OR np.duration_sec=0 THEN t.duration_sec ELSE np.duration_sec END AS eff_duration_sec
//       FROM tb_now_playing np
//       LEFT JOIN tb_tracks t ON t.id = np.track_id
//       LIMIT 1
//     `);
//     //console.log(`${tickLabel} 📦 DB 조회 완료 (${rows.length} rows)`);

//     if (!rows.length) return scheduleNext(loopStart);
//     const row = rows[0];
//     const { id, title, track_id, current_pos_sec, repeat_mode, is_playing, file_path } = row;
//     const duration_sec = Number(row.eff_duration_sec) || 0;

//     //console.log(`${tickLabel} 🎵 상태: track=${title}, repeat=${repeat_mode}, pos=${current_pos_sec}/${duration_sec}, playing=${is_playing}`);

//     if (is_playing !== "Y" || !duration_sec) return scheduleNext(loopStart);

//     // ✅ 일반 진행 중
//     if (current_pos_sec < duration_sec - 3) {
//       await pool.query(
//         "UPDATE tb_now_playing SET current_pos_sec=?, updated_at=NOW() WHERE id=?",
//         [current_pos_sec + 3, id]
//       );
//       //console.log(`${tickLabel} ⏩ 진행 pos=${current_pos_sec + 3}/${duration_sec}`);
//       return scheduleNext(loopStart);
//     }

//     // 🎯 종료 처리
//     if (current_pos_sec >= duration_sec - 3) {
//       //console.log(`${tickLabel} ⏹ 종료 감지: repeat_mode=${repeat_mode}`);
//       switch (repeat_mode) {
//         case "none":
//           await pool.query(`
//             UPDATE tb_now_playing 
//             SET is_playing='N', ended_at=NOW(), last_action='stop', updated_at=NOW()
//             WHERE id=?`, [id]);
//           console.log(`${tickLabel} 💤 재생 중지 완료`);
//           break;

//         case "one":
//           await pool.query(`
//             UPDATE tb_now_playing
//             SET current_pos_sec=0, started_at=NOW(), updated_at=NOW()
//             WHERE id=?`, [id]);
//             //console.log(`${tickLabel} 🔁 동일 트랙 반복 시작`);
//           castSafe({
//             type: "same_track_updated",
//             data: { track_id, track_title: title, file_path, duration_sec, current_pos_sec: 0, repeat_mode }
//           });
//           break;

//         case "all":
//           //console.time(`${tickLabel} 🔄 switch`);
//           const [[cur]] = await pool.query("SELECT track_no FROM tb_tracks WHERE id=?", [track_id]);
//           const [[next]] = await pool.query(
//             "SELECT id FROM tb_tracks WHERE track_no > ? ORDER BY track_no ASC LIMIT 1",
//             [cur?.track_no || 0]
//           );
//           const nextId = next?.id || (await pool.query("SELECT id FROM tb_tracks ORDER BY track_no ASC LIMIT 1"))[0][0].id;
//           const [[nextInfo]] = await pool.query("SELECT * FROM tb_tracks WHERE id=?", [nextId]);
//           //console.log(`${tickLabel} 🎶 다음 트랙: ${nextInfo.title}`);
// //
//           await pool.query("DELETE FROM tb_now_playing");
//           await pool.query(`
//             INSERT INTO tb_now_playing
//               (track_id, track_title, artist, album, file_path, duration_sec, current_pos_sec, is_playing, emotion, last_action, repeat_mode, updated_at, started_at)
//             VALUES (?, ?, ?, ?, ?, ?, 0, 'Y', 'custom', 'play', ?, NOW(), NOW())
//           `, [nextInfo.id, nextInfo.title, nextInfo.artist || "Lyri", nextInfo.album, nextInfo.file_path, nextInfo.duration_sec, repeat_mode]);

//           //console.log(`${tickLabel} ✅ DB nextTrack 반영 완료`);
//           castSafe({
//             type: "nowplaying_update",
//             data: { track_id: nextInfo.id, track_title: nextInfo.title, duration_sec: nextInfo.duration_sec, repeat_mode }
//           });
//           //console.timeEnd(`${tickLabel} 🔄 switch`);
//           // 🪄 추가: 클라이언트가 끊겼을 가능성 대비
//           castSafe({ type: "force_play_next", data: { track_id: nextInfo.id } });
//           break;
//       }
//     }

//   } catch (err) {
//     console.error(`${tickLabel} ❌ [NowPlaying 워커 오류]:`, err.message);
//   } finally {
//     scheduleNext(loopStart);
//   }
// }

// function scheduleNext(startTime) {
//   const elapsed = Date.now() - startTime;
//   //console.log(`[⏱] 워커 루프 종료 (${elapsed}ms 경과), 다음 루프 예약`);
//   const nextDelay = Math.max(500, 3000 - elapsed);

//   setTimeout(() => {
//     // next tick으로 완전히 분리
//     setImmediate(loopNowPlaying);
//   }, nextDelay);
// }

// function castSafe(payload) {
//   const msg = JSON.stringify(payload);
//   //console.log(`[📤 castSafe] 브로드캐스트 시작 type=${payload.type}`);
//   wss.clients.forEach(c => {
//     if (c.readyState === WebSocket.OPEN) {
//       try {
//         c.send(msg);
//       } catch (err) {
//         console.warn(`[⚠️ castSafe] 송신 실패: ${err.message}`);
//       }
//     }
//   });
//   //console.log(`[📤 castSafe] 브로드캐스트 완료`);
// }

// loopNowPlaying();
/////////////////////////////////////////////////////////////////////////////////////////
// =============================================
// 🎵 tracks 테이블 duration 보정 API
// =============================================
app.post("/tracks/setDuration", async (req, res) => {
  try {
    const { id, duration_sec } = req.body;
    if (!id || !duration_sec) {
      return res.status(400).json({ ok: false, reason: "invalid_param" });
    }
    await pool.query("UPDATE tb_tracks SET duration_sec=? WHERE id=?", [duration_sec, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ /tracks/setDuration 오류:", err.message);
    res.status(500).json({ ok: false, err: err.message });
  }
});

// ================================
// 🎧 NowPlaying 조회 API
// ================================
app.get("/nowplaying", async (req, res) => {
  try {
    //console.log(">>>>>>🎧 NowPlaying 조회 API")
    const [rows] = await pool.query(`
      SELECT np.*, t.title AS track_title, t.artist, t.album, t.file_path
      FROM tb_now_playing np
      LEFT JOIN tb_tracks t ON t.id = np.track_id
      ORDER BY np.updated_at DESC
      LIMIT 1
    `)
    if (rows.length === 0) {
      return res.json(null)
    }
    res.json(rows[0])
  } catch (err) {
    console.error("❌ NowPlaying 조회 오류:", err.message)
    res.status(500).json({ ok: false, err: err.message })
  }
})

// ================================
// 🎧  오디오재생 - 오버레이/제어판
// ================================
app.post("/play/source", async (req, res) => {
   
  try {
    const { play_source } = req.body;
    console.log(">>>play_source =",play_source) 
    if (!play_source) {
      return res.status(400).json({ ok: false, reason: "play_source invalid_param" });
    }
    await pool.query('UPDATE tb_now_playing SET play_source=? WHERE 1=1 LIMIT 1', [play_source])
    
    //cast({ type: 'play_source_update', data: { play_source } })
    res.json({ ok: true })
  } catch (err) {
    console.error("❌ /play/source 오류:", err.message);
    res.status(500).json({ ok: false, err: err.message });
  }


})

// ✅ 서버 시작
const PORT = process.env.PORT || 8787;
server.listen(PORT, () =>
  console.log("🚀 Overlay v2.0 (1.8 compatible) on http://127.0.0.1:8787 (WS same port)")
);
