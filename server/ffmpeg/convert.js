import { exec } from "child_process";
import path from "path";

export function mp3ConvertHandler(req, res) {
  const input = req.body.input;
  const output = req.body.output;

  if (!input || !output) {
    return res.status(400).json({ error: "input/output 경로 필요" });
  }

  const cmd = `ffmpeg -i "${input}" -codec:a libmp3lame -b:a 320k "${output}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error("ffmpeg 변환 오류:", err);
      return res.status(500).json({ error: "변환 실패" });
    }
    res.json({
      ok: true,
      input,
      output,
      message: "MP3 변환 완료 🎧"
    });
  });
}
