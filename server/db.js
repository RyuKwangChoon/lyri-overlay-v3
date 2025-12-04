import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// ========================================
// 🗄️ DATABASE POOL CONFIGURATION
// ========================================
const dbPool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3307,
  user: process.env.DB_USER || 'overlay_lyri',
  password: process.env.DB_PASSWORD || 'kwang760!@3',
  database: process.env.DB_DATABASE || 'overlay_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ========================================
// 📊 LOGGER
// ========================================
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const logger = {
  info: (msg) => LOG_LEVEL !== 'silent' && console.log(`ℹ️  ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  debug: (msg) => LOG_LEVEL === 'debug' && console.log(`🐛 ${msg}`),
};

// ========================================
// 💾 DATABASE QUERIES
// ========================================

/**
 * 메시지 저장
 */
export const saveMessage = async (text, role, options = {}) => {
  try {
    const {
      imoji = null,
      overlay_date = null,
      broadcast_ymd = null,
      seq = null,
      priority = 10,
      type = 'chat',
      session_id = 'live',
      repeatable = 'N',
      with_promo = 'N',
    } = options;

    const connection = await dbPool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO tb_overlay_message
       (text, role, imoji, overlay_date, broadcast_ymd, seq, priority, type, session_id, repeatable, with_promo, sent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N')`,
      [text, role, imoji, overlay_date, broadcast_ymd, seq, priority, type, session_id, repeatable, with_promo]
    );

    // 즉시 sent='Y' 마킹
    await connection.query(
      `UPDATE tb_overlay_message SET sent='Y', delivered_at=NOW() WHERE id=?`,
      [result.insertId]
    );

    connection.release();

    logger.info(`💬 Message saved [${role}]: ${text.substring(0, 30)}...`);
    return { id: result.insertId, success: true };
  } catch (error) {
    logger.error(`Message save error: ${error.message}`);
    throw error;
  }
};

/**
 * 공지 저장
 */
export const saveNotice = async (notice, slot = 'top', is_active = 'N') => {
  try {
    const connection = await dbPool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO tb_overlay_notice (text, slot, is_active) VALUES (?, ?, ?)`,
      [notice, slot, is_active]
    );
    connection.release();

    logger.info(`📢 Notice saved: ${notice.substring(0, 30)}...`);
    return { id: result.insertId, success: true };
  } catch (error) {
    logger.error(`Notice save error: ${error.message}`);
    throw error;
  }
};

/**
 * 공지 목록 조회
 */
export const getNotices = async () => {
  try {
    const connection = await dbPool.getConnection();
    const [rows] = await connection.query(
      `SELECT id, text, slot, is_active FROM tb_overlay_notice ORDER BY id DESC`
    );
    connection.release();

    return rows;
  } catch (error) {
    logger.error(`Get notices error: ${error.message}`);
    throw error;
  }
};

/**
 * 공지 활성화 업데이트
 */
export const updateNoticeActive = async (ids = []) => {
  try {
    const connection = await dbPool.getConnection();

    // 전체 비활성화
    await connection.query(`UPDATE tb_overlay_notice SET is_active='N'`);

    // 선택된 항목만 활성화
    if (ids.length > 0) {
      const cleanIds = ids.map((x) => Number(x)).filter((x) => !isNaN(x));
      if (cleanIds.length > 0) {
        await connection.query(
          `UPDATE tb_overlay_notice SET is_active='Y' WHERE id IN (${cleanIds
            .map(() => '?')
            .join(',')})`,
          cleanIds
        );
      }
    }

    connection.release();

    logger.info(`📢 Notice active updated: ${ids.length} items`);
    return { success: true };
  } catch (error) {
    logger.error(`Update notice active error: ${error.message}`);
    throw error;
  }
};

/**
 * 트랙 목록 조회
 */
export const getTracks = async () => {
  try {
    const connection = await dbPool.getConnection();
    const [rows] = await connection.query(
      `SELECT id, title, artist, duration_sec, file_path, track_no FROM tb_tracks ORDER BY track_no ASC`
    );
    connection.release();

    return rows;
  } catch (error) {
    logger.error(`Get tracks error: ${error.message}`);
    throw error;
  }
};

/**
 * 현재 재생곡 조회
 */
export const getNowPlaying = async () => {
  try {
    const connection = await dbPool.getConnection();
    const [rows] = await connection.query(
      `SELECT np.*, t.title, t.duration_sec as track_duration
       FROM tb_now_playing np
       LEFT JOIN tb_tracks t ON t.id = np.track_id
       LIMIT 1`
    );
    connection.release();

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Get now playing error: ${error.message}`);
    throw error;
  }
};

/**
 * 현재 재생곡 업데이트
 */
export const updateNowPlaying = async (trackId, trackTitle, options = {}) => {
  try {
    const {
      album = null,
      file_path = '',
      duration_sec = 0,
      current_pos_sec = 0,
      is_playing = 'Y',
      emotion = 'custom',
      repeat_mode = 'none',
    } = options;

    const connection = await dbPool.getConnection();

    // 기존 row 확인
    const [[countRow]] = await connection.query(`SELECT COUNT(*) AS cnt FROM tb_now_playing`);
    const exists = countRow.cnt > 0;

    if (exists) {
      // UPDATE
      await connection.query(
        `UPDATE tb_now_playing
         SET track_id=?, track_title=?, file_path=?, duration_sec=?, current_pos_sec=?,
             is_playing=?, emotion=?, repeat_mode=?, updated_at=NOW()
         WHERE id=1`,
        [trackId, trackTitle, file_path, duration_sec, current_pos_sec, is_playing, emotion, repeat_mode]
      );
    } else {
      // INSERT
      await connection.query(
        `INSERT INTO tb_now_playing
         (track_id, track_title, file_path, duration_sec, current_pos_sec, is_playing, emotion, repeat_mode, started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [trackId, trackTitle, file_path, duration_sec, current_pos_sec, is_playing, emotion, repeat_mode]
      );
    }

    connection.release();

    logger.info(`▶️  NowPlaying ${exists ? 'updated' : 'created'}: ${trackTitle}`);
    return { success: true, mode: exists ? 'update' : 'insert' };
  } catch (error) {
    logger.error(`Update now playing error: ${error.message}`);
    throw error;
  }
};

/**
 * 데이터베이스 연결 테스트
 */
export const testConnection = async () => {
  try {
    const connection = await dbPool.getConnection();
    await connection.query('SELECT 1');
    connection.release();

    logger.info(`✅ Database connection verified`);
    return true;
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    return false;
  }
};

export { dbPool, logger };
