import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { dbPool, logger, saveMessage, saveNotice, getNowPlaying, updateNowPlaying } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// 🔧 CONFIGURATION
// ========================================
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const SERVER_PORT = process.env.SERVER_PORT || 8787;
const NOWPLAYING_INTERVAL = parseInt(process.env.NOWPLAYING_INTERVAL || '3000');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ========================================
// 🔄 BROADCAST UTILITY
// ========================================
const broadcast = (eventType, payload) => {
  const message = JSON.stringify({
    event: eventType,
    data: payload,
    timestamp: new Date().toISOString(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });

  logger.debug(`📡 Broadcast [${eventType}]: ${message.substring(0, 50)}...`);
};

// ========================================
// 🎵 NOWPLAYING WORKER
// ========================================
let nowPlayingWorker = null;

const startNowPlayingWorker = () => {
  if (nowPlayingWorker) clearInterval(nowPlayingWorker);

  nowPlayingWorker = setInterval(async () => {
    try {
      const connection = await dbPool.getConnection();
      
      // Query current track from tb_now_playing (1 ROW ONLY)
      const [rows] = await connection.query(
        `SELECT np.*, t.title, t.duration_sec as track_duration
         FROM tb_now_playing np
         LEFT JOIN tb_tracks t ON t.id = np.track_id
         LIMIT 1`
      );

      if (rows.length === 0) {
        connection.release();
        return;
      }

      const np = rows[0];
      const trackDuration = np.duration_sec || np.track_duration || 0;
      const currentPos = np.current_pos_sec || 0;
      const repeatMode = np.repeat_mode || 'none';
      const isPlaying = np.is_playing || 'N';

      // Only process if playing
      if (isPlaying !== 'Y' || trackDuration <= 0) {
        connection.release();
        return;
      }

      // ✅ Track is still playing (not finished)
      if (currentPos < trackDuration - 3) {
        await connection.query(
          `UPDATE tb_now_playing SET current_pos_sec = current_pos_sec + 3, updated_at = NOW() WHERE id = ?`,
          [np.id]
        );

        broadcast('now_playing_update', {
          track_id: np.track_id,
          track_title: np.track_title,
          current_pos_sec: currentPos + 3,
          duration_sec: trackDuration,
          progress: Math.floor(((currentPos + 3) / trackDuration) * 100),
        });

        connection.release();
        return;
      }

      // 🎯 Track finished - handle repeat modes
      if (currentPos >= trackDuration - 3) {
        if (repeatMode === 'none') {
          // Stop playing
          await connection.query(
            `UPDATE tb_now_playing SET is_playing = 'N', ended_at = NOW(), updated_at = NOW() WHERE id = ?`,
            [np.id]
          );

          logger.info(`⏹ Track ended (no repeat): ${np.track_title}`);

          broadcast('track_ended', {
            track_id: np.track_id,
            reason: 'repeat_none',
          });
        } else if (repeatMode === 'one') {
          // Repeat same track
          await connection.query(
            `UPDATE tb_now_playing SET current_pos_sec = 0, started_at = NOW(), updated_at = NOW() WHERE id = ?`,
            [np.id]
          );

          logger.info(`🔁 Repeating one: ${np.track_title}`);

          broadcast('track_restarted', {
            track_id: np.track_id,
            track_title: np.track_title,
            repeat_mode: 'one',
          });
        } else if (repeatMode === 'all') {
          // Get next track
          const [[curTrack]] = await connection.query(
            `SELECT track_no FROM tb_tracks WHERE id = ?`,
            [np.track_id]
          );

          const [[nextTrack]] = await connection.query(
            `SELECT id FROM tb_tracks WHERE track_no > ? ORDER BY track_no ASC LIMIT 1`,
            [curTrack?.track_no || 0]
          );

          let nextId = nextTrack?.id;

          // If no next track, loop to first
          if (!nextId) {
            const [[firstTrack]] = await connection.query(
              `SELECT id FROM tb_tracks ORDER BY track_no ASC LIMIT 1`
            );
            nextId = firstTrack?.id;
          }

          if (nextId) {
            // Get next track info
            const [[nextInfo]] = await connection.query(
              `SELECT id, title, artist, album, file_path, duration_sec FROM tb_tracks WHERE id = ?`,
              [nextId]
            );

            // Update now_playing with next track
            await connection.query(
              `UPDATE tb_now_playing
               SET track_id = ?, track_title = ?, file_path = ?, duration_sec = ?, current_pos_sec = 0,
                   started_at = NOW(), updated_at = NOW()
               WHERE id = ?`,
              [nextInfo.id, nextInfo.title, nextInfo.file_path, nextInfo.duration_sec, np.id]
            );

            logger.info(`🎵 Next track (repeat all): ${nextInfo.title}`);

            broadcast('track_changed', {
              track_id: nextInfo.id,
              track_title: nextInfo.title,
              duration_sec: nextInfo.duration_sec,
              repeat_mode: 'all',
            });
          }
        }
      }

      connection.release();
    } catch (error) {
      logger.error(`NowPlaying worker error: ${error.message}`);
    }
  }, NOWPLAYING_INTERVAL);

  logger.info(`⏱️  NowPlaying worker started (${NOWPLAYING_INTERVAL}ms interval)`);
};

// ========================================
// 🌐 REST ENDPOINTS
// ========================================

// POST /message/save - Save overlay message
app.post('/message/save', async (req, res) => {
  try {
    const { text, role = 'assistant', ...options } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing text field' });
    }

    const result = await saveMessage(text, role, options);

    broadcast('overlay_message', {
      id: result.id,
      text,
      role,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Message saved',
      id: result.id,
    });
  } catch (error) {
    logger.error(`POST /message/save error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /notice/update - Update notice/ticker
app.post('/notice/update', async (req, res) => {
  try {
    const { notice, slot = 'top', is_active = 'N' } = req.body;

    if (!notice) {
      return res.status(400).json({ error: 'Missing notice text' });
    }

    const result = await saveNotice(notice, slot, is_active);

    broadcast('ticker_update', {
      id: result.id,
      notice,
      slot,
      is_active,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, id: result.id });
  } catch (error) {
    logger.error(`POST /notice/update error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /tracks/update - Update track list
app.post('/tracks/update', async (req, res) => {
  try {
    const { tracks } = req.body;

    if (!Array.isArray(tracks)) {
      return res.status(400).json({ error: 'tracks must be an array' });
    }

    const connection = await dbPool.getConnection();

    // Insert new tracks (preserve existing ones)
    for (const track of tracks) {
      await connection.query(
        `INSERT INTO tb_tracks 
         (title, artist, album, file_original, file_stored, file_path, file_ext, duration_sec, track_no, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', NOW())`,
        [
          track.title || 'Unknown',
          track.artist || 'Brian',
          track.album || null,
          track.file_original || null,
          track.file_stored || null,
          track.file_path || null,
          track.file_ext || 'mp3',
          track.duration || 0,
          track.order || 0
        ]
      );
    }

    connection.release();

    logger.info(`🎵 Track list updated: ${tracks.length} tracks`);

    broadcast('track_order_changed', {
      count: tracks.length,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, count: tracks.length });
  } catch (error) {
    logger.error(`Tracks update error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /nowplaying/update - Update now playing
app.post('/nowplaying/update', async (req, res) => {
  try {
    const {
      track_id,
      track_title,
      album = null,
      file_path = '',
      duration_sec = 0,
      current_pos_sec = 0,
      is_playing = 'Y',
      emotion = 'custom',
      repeat_mode = 'none'
    } = req.body;

    if (!track_id) {
      return res.status(400).json({ error: 'Missing trackId' });
    }

    const connection = await dbPool.getConnection();

    // Check if now_playing row exists (1 ROW ONLY)
    const [[countRow]] = await connection.query(`SELECT COUNT(*) AS cnt FROM tb_now_playing`);
    const exists = countRow.cnt > 0;

    if (exists) {
      // UPDATE existing row
      await connection.query(
        `UPDATE tb_now_playing
         SET track_id=?, track_title=?, file_path=?, duration_sec=?, current_pos_sec=?,
             is_playing=?, emotion=?, repeat_mode=?, updated_at=NOW()
         WHERE id=1`,
        [track_id, track_title || 'Unknown', file_path, duration_sec, current_pos_sec, is_playing, emotion, repeat_mode]
      );

      logger.info(`▶️  NowPlaying updated: trackId=${track_id}`);
    } else {
      // INSERT new row
      await connection.query(
        `INSERT INTO tb_now_playing
         (track_id, track_title, file_path, duration_sec, current_pos_sec, is_playing, emotion, repeat_mode, started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [track_id, track_title || 'Unknown', file_path, duration_sec, current_pos_sec, is_playing, emotion, repeat_mode]
      );

      logger.info(`✅ NowPlaying created: trackId=${track_id}`);
    }

    connection.release();

    broadcast('now_playing_update', {
      track_id,
      track_title,
      duration_sec,
      current_pos_sec,
      repeat_mode,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, mode: exists ? 'update' : 'insert' });
  } catch (error) {
    logger.error(`NowPlaying update error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /health - Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'relay-server-v3',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    websockets: wss.clients.size,
  });
});

// ========================================
// 💬 WEBSOCKET HANDLERS
// ========================================
wss.on('connection', (ws) => {
  logger.info(`✅ Client connected (total: ${wss.clients.size})`);

  // Send alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) {
      ws.ping();
    }
  }, 30000);

  ws.on('pong', () => {
    logger.debug('🏓 Pong received');
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      logger.debug(`📥 WS message: ${message.event || 'unknown'}`);
      // Handle incoming messages if needed
    } catch (error) {
      logger.error(`WS message parse error: ${error.message}`);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    logger.info(`❌ Client disconnected (total: ${wss.clients.size})`);
  });

  ws.on('error', (error) => {
    logger.error(`WS error: ${error.message}`);
  });
});

// ========================================
// 🚀 START SERVER
// ========================================
httpServer.listen(SERVER_PORT, async () => {
  try {
    // Test database connection
    const connection = await dbPool.getConnection();
    await connection.query('SELECT 1');
    connection.release();

    logger.info(`✅ Database connection verified`);

    // Start workers
    startNowPlayingWorker();

    const dbUser = process.env.DB_USER || 'overlay_lyri';
    const dbHost = process.env.DB_HOST || '127.0.0.1';
    const dbPort = process.env.DB_PORT || 3307;

    console.log(`
🚀 =====================================
   RELAY SERVER V3 STARTED
🚀 =====================================
   REST API Port: ${SERVER_PORT}
   WebSocket: ws://127.0.0.1:${SERVER_PORT}
   Database: ${dbUser}@${dbHost}:${dbPort}
   NowPlaying Interval: ${NOWPLAYING_INTERVAL}ms
   Status: http://localhost:${SERVER_PORT}/health
🚀 =====================================
    `);
  } catch (error) {
    logger.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Shutting down...');
  if (nowPlayingWorker) clearInterval(nowPlayingWorker);
  wss.close();
  httpServer.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

export default httpServer;
