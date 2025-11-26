export function setupWsHandlers(wss) {
  console.log("🛰 WebSocket 서버 준비됨");

  wss.on("connection", (ws) => {
    console.log("🟢 클라이언트 접속됨");

    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg);
        console.log("📩 받은 WS 메시지:", parsed);

        // 전체 브로드캐스트
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify(parsed));
          }
        });

      } catch (err) {
        console.error("WS 메시지 처리 오류:", err);
      }
    });

    ws.on("close", () => {
      console.log("🔴 클라이언트 연결 종료");
    });
  });
}
