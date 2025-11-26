import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import apiRouter from "./api/index.js";
import { setupWsHandlers } from "./ws/wsHandlers.js";

const PORT = 8787;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Router
app.use("/api", apiRouter);

// HTTP + WebSocket
const server = createServer(app);
const wss = new WebSocketServer({ server });

// WS Handler
setupWsHandlers(wss);

server.listen(PORT, () => { 
  console.log(`🟢 API 서버 실행됨: http://localhost:${PORT}`);
});
