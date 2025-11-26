import express from "express";
// import { testHandler } from "./test.js";
import { mp3ConvertHandler } from "../ffmpeg/convert.js";

const router = express.Router();

// 기본 API 테스트
// router.get("/test", testHandler);

// WAV → MP3 변환 엔드포인트
router.post("/convert-mp3", mp3ConvertHandler);

export default router;
