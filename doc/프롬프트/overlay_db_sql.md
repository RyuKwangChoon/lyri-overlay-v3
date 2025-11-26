---
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=overlay_lyri
DB_PASS=kwang760!@3
DB_NAME=overlay_db
---

## tb_now_playing
- TB_NOW_PLAYING 테이블은 1 ROW ONLY
```sql
CREATE TABLE `tb_now_playing` (
	`id` INT(11) NOT NULL AUTO_INCREMENT COMMENT 'PK',
	`track_id` INT(11) NOT NULL COMMENT '연결된 트랙 ID',
	`track_title` VARCHAR(255) NOT NULL COMMENT '현재 재생 중 곡명' COLLATE 'utf8mb4_unicode_ci',
	`artist` VARCHAR(100) NULL DEFAULT 'Lyri' COMMENT '아티스트' COLLATE 'utf8mb4_unicode_ci',
	`album` VARCHAR(100) NULL DEFAULT NULL COMMENT '앨범명' COLLATE 'utf8mb4_unicode_ci',
	`file_path` VARCHAR(255) NULL DEFAULT NULL COMMENT '파일 경로' COLLATE 'utf8mb4_unicode_ci',
	`duration_sec` INT(11) NULL DEFAULT '0' COMMENT '총 재생 길이(초)',
	`current_pos_sec` INT(11) NULL DEFAULT '0' COMMENT '현재 재생 위치(초)',
	`is_playing` CHAR(1) NULL DEFAULT 'N' COMMENT '재생 여부 (\'Y\'/\'N\')' COLLATE 'utf8mb4_unicode_ci',
	`emotion` ENUM('calm','melancholy','happy','passionate','custom') NULL DEFAULT 'custom' COMMENT '감정 태그' COLLATE 'utf8mb4_unicode_ci',
	`last_action` ENUM('play','pause','stop','seek') NULL DEFAULT 'play' COMMENT '최근 이벤트 상태' COLLATE 'utf8mb4_unicode_ci',
	`repeat_mode` ENUM('none','one','all') NULL DEFAULT 'none' COMMENT '반복모드' COLLATE 'utf8mb4_unicode_ci',
	`lufs` FLOAT NULL DEFAULT NULL COMMENT 'LUFS (표시용)',
	`peak` FLOAT NULL DEFAULT NULL COMMENT '피크 dB',
	`updated_at` DATETIME NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '수정 시각',
	`started_at` DATETIME NULL DEFAULT current_timestamp() COMMENT '재생 시작 시각',
	`ended_at` DATETIME NULL DEFAULT NULL COMMENT '종료 시각',
	`play_source` ENUM('control','overlay') NULL DEFAULT 'overlay' COMMENT '오버레이오디오재생여부' COLLATE 'utf8mb4_unicode_ci',
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `track_id` (`track_id`) USING BTREE,
	CONSTRAINT `tb_now_playing_ibfk_1` FOREIGN KEY (`track_id`) REFERENCES `tb_tracks` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
AUTO_INCREMENT=21963
;
```
## tb_tracks

```sql
CREATE TABLE `tb_tracks` (
	`id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '트랙 고유 ID',
	`album_id` INT(11) NULL DEFAULT NULL COMMENT '앨범 단위 구분용',
	`track_no` INT(11) NULL DEFAULT '0' COMMENT '트랙 순서 번호 (자동 갱신)',
	`title` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`artist` VARCHAR(255) NULL DEFAULT 'Brian' COMMENT '아티스트' COLLATE 'utf8mb4_unicode_ci',
	`album` VARCHAR(255) NULL DEFAULT NULL COMMENT '앨범명' COLLATE 'utf8mb4_unicode_ci',
	`version_label` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`file_original` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`file_stored` VARCHAR(255) NULL DEFAULT NULL COMMENT '실제 서버 저장 파일명 (UUID 등)' COLLATE 'utf8mb4_unicode_ci',
	`file_path` VARCHAR(255) NULL DEFAULT NULL COMMENT '절대/상대 경로' COLLATE 'utf8mb4_unicode_ci',
	`file_ext` VARCHAR(10) NULL DEFAULT 'wav' COMMENT '확장자' COLLATE 'utf8mb4_unicode_ci',
	`duration_sec` INT(11) NULL DEFAULT '0' COMMENT '전체 재생시간(초)',
	`lufs` FLOAT NULL DEFAULT NULL COMMENT '음압 (LUFS)',
	`peak` FLOAT NULL DEFAULT NULL COMMENT '피크 레벨',
	`emotion` ENUM('calm','melancholy','happy','passionate','custom') NULL DEFAULT 'custom' COMMENT '감정선' COLLATE 'utf8mb4_unicode_ci',
	`genre_tag` ENUM('jazz','acoustic','cinematic','pop','ballad','custom') NULL DEFAULT 'jazz' COMMENT '장르' COLLATE 'utf8mb4_unicode_ci',
	`mood_desc` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`is_active` CHAR(1) NULL DEFAULT 'Y' COMMENT '활성여부' COLLATE 'utf8mb4_unicode_ci',
	`is_loopable` CHAR(1) NULL DEFAULT 'N' COMMENT '반복여부' COLLATE 'utf8mb4_unicode_ci',
	`status` VARCHAR(50) NULL DEFAULT 'ready' COMMENT '상태 관리' COLLATE 'utf8mb4_unicode_ci',
	`play_count` INT(11) NULL DEFAULT '0' COMMENT '재생횟수',
	`last_played_at` DATETIME NULL DEFAULT NULL COMMENT '최근재생시각',
	`created_at` TIMESTAMP NULL DEFAULT current_timestamp(),
	`updated_at` TIMESTAMP NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
	`codec` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`bitrate` INT(11) NULL DEFAULT NULL,
	`samplerate` INT(11) NULL DEFAULT NULL,
	PRIMARY KEY (`id`) USING BTREE
)
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
AUTO_INCREMENT=317
;
```
## tb_overlay_notice
- TB_OVERLAY_NOTICE 테이블은 데이타를 삭제하지 않고 유지한다.
- 삭제는 UI에서만 한다.

```sql
CREATE TABLE `tb_overlay_notice` (
	`id` INT(11) NOT NULL AUTO_INCREMENT,
	`text` VARCHAR(512) NOT NULL COLLATE 'utf8mb4_general_ci',
	`slot` ENUM('title','top','bottom') NULL DEFAULT 'top' COLLATE 'utf8mb4_general_ci',
	`is_active` CHAR(1) NULL DEFAULT 'N' COLLATE 'utf8mb4_general_ci',
	`created_at` TIMESTAMP NULL DEFAULT current_timestamp(),
	PRIMARY KEY (`id`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=39
;
```

## tb_overlay_message
- TB_OVERLAY_MESSAGE 테이블은 데이타를 삭제하지 않고 유지한다.

```sql
CREATE TABLE `tb_overlay_message` (
	`id` INT(11) NOT NULL AUTO_INCREMENT,
	`text` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`role` VARCHAR(10) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`imoji` VARCHAR(4) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`ts` DATETIME NULL DEFAULT current_timestamp(),
	`overlay_date` VARCHAR(14) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`broadcast_ymd` VARCHAR(8) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`seq` INT(11) NULL DEFAULT NULL,
	`sent` CHAR(1) NULL DEFAULT 'N' COLLATE 'utf8mb4_unicode_ci',
	`priority` INT(11) NULL DEFAULT '10',
	`type` VARCHAR(10) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`session_id` VARCHAR(64) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`repeatable` CHAR(1) NULL DEFAULT 'N' COLLATE 'utf8mb4_unicode_ci',
	`with_promo` CHAR(1) NULL DEFAULT 'N' COLLATE 'utf8mb4_unicode_ci',
	`delivered_at` DATETIME NULL DEFAULT NULL,
	`error_flag` CHAR(1) NULL DEFAULT 'N' COLLATE 'utf8mb4_unicode_ci',
	`retry_count` INT(11) NULL DEFAULT '0',
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `idx_broadcast_ymd` (`broadcast_ymd`) USING BTREE,
	INDEX `idx_session_id` (`session_id`) USING BTREE,
	INDEX `idx_sent` (`sent`) USING BTREE
)
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
AUTO_INCREMENT=295
;
```

