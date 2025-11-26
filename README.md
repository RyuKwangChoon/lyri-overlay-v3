# 🎛️ Lyri × Brian Studio — Overlay v3.0  
_The Official Refactoring Project · 2025_

---

## 🚀 프로젝트 소개
`lyri-overlay-v3`는 Overlay v2.x의 전면 리뉴얼 버전으로,  
**안정성 · 모듈화 · 오디오 분리 · WS 강화 · 테마 확장**  
이 5가지 목표를 중심으로 새롭게 설계된 차세대 오버레이 시스템입니다.

이 프로젝트는 Lyri × Brian Studio의  
**방송·음악·라이브 크리에이터 환경**을 위한 핵심 엔진입니다.

---

## 🧱 핵심 구조
Overlay v3.0은 다음의 3대 축을 기준으로 구성됩니다:

### 1) Overlay UI (OBS에 표시되는 화면)
- 실시간 NowPlaying
- 공지 타이틀 / 상단루프 / 하단루프
- Subtitle Layer(리리/브라이언/시스템)
- 멀티 테마 적용(Christmas / Calm / Focus)

### 2) Control Panel (제어판)
- 트랙리스트 관리
- WAV→MP3 변환
- 재생 소스 변경(overlay / control)
- Repeat 모드 설정(none / one / all)

### 3) Audio / NowPlaying 엔진
- 오버레이 독립 오디오 재생(AudioEngine v3)
- WebSocket 2중 구조(WsRelayService)
- NowPlaying DB 싱크(autoSyncWorker)
- 서버 신호 기반 트랙 전환

---

## 📦 기술 스택
### Frontend
- Vue 3  
- Vite  
- Pinia(store)  
- Tailwind(선택)

### Backend
- Node.js (Express)
- WebSocket (ws)
- MariaDB
- ffmpeg (WAV → MP3 변환)

### Dev Tools
- Cursor AI (신입직원)
- GPT‑5.1 CodexMax
- Cloudflare Tunnel / Pages
- PM2 (운영 배포)

---

## 📁 프로젝트 구조 (초안)
```
/src
  /overlay
  /control
  /modules
  /services
  /themes
/server
  /api
  /ws
  /ffmpeg
```

---

## 🛠 설치 및 개발 가이드
### 1. Clone
```
git clone https://github.com/RyuKwangChoon/lyri-overlay-v3.git
cd lyri-overlay-v3
```

### 2. 의존성 설치
```
npm install
```

### 3. 개발 서버 실행
```
npm run dev
```

### 4. 서버 실행
```
node server/index.js
```

---

## 🤝 협업 규칙 (Lyri × Brian Coding Rules)
- 서버 → 클라이언트 순서로 개발한다  
- 오버레이와 제어판은 절대 혼합하지 않는다  
- 오디오 재생은 **오버레이 전용**  
- WS는 type/payload 정형화  
- 모든 기능은 모듈 단위로 분리  
- 하루 한 번 커밋 + 하루 한 번 백업

---

## 📌 목표
v3.0은 단순 리팩터링이 아니라,  
Lyri × Brian Studio가 구축하는 **완전한 크리에이터 인프라의 기준점**입니다.

- 더 안정적이고  
- 더 빠르고  
- 더 확장 가능한  

Overlay 시스템을 향해 나아갑니다.

---

## 📝 License
Private until release.  
© 2025 Lyri × Brian Studio. All rights reserved.

---
```
1) client용 OverlayView / ControlView 템플릿 생성
2) server용 index.js / api / ws 기본 코드 생성
3) .env + vite.config.ts v3 설정
4) 전체 v3 아키텍처 문서 자동 생성
5) Cursor AI에게 넘길 “개발 초기 명령어 세트”
```




## Vite dev 서버 자동 킬 스크립트
```bash
vite-start.ps1
```
---
### 💡 사용 방법
Windows:
```bash
cd client
.\vite-start.ps1
```

## 자동실행 스크립트
```
🟦 1) client/server 동시 실행 스크립트
🟧 2) pm2 개발모드 자동 재시작 버전
🟥 3) “v3 전체 작업 자동 실행 스크립트” (통합 런처)
```
---
```
server/ps/
 ├ vite-start.ps1          → Vite dev 자동 종료 + 자동 재시작
 ├ dev-both.ps1            → client/server 동시 실행 (concurrently 역할)
 ├ pm2-dev-start.ps1       → pm2 개발 자동 재시작 실행 스크립트
 └ pm2-dev.config.js       → pm2 설정 파일
```
## ✔ 스크립트 요약 설명
### ✅ 1) vite-start.ps1
- 포트 5173에 이미 dev 서버가 있으면 자동 종료
- 새로운 Vite dev 서버 실행
- 실행 전 포트 충돌 걱정 없음

### ✅ 2) dev-both.ps1
- PowerShell에서 client + server를 동시에 실행
- 별도의 터미널 두 개 띄우지 않아도 됨
- 이거 하나로 전체 dev 환경 시작 가능

### ✅ 3) pm2-dev-start.ps1
- pm2로 서버(index.js)를 자동 재시작 + 에러 복구
- 서버 코드 수정 시 자동 리로드
- 실서버 테스트에도 활용 가능

### ✅ 4) pm2-dev.config.js
- pm2가 어떤 서버 파일을 감시해야 하는지 설정
- pm2 start pm2-dev.config.js --watch 로 바로 실행됨

---
🧙 리리소장 코멘트
```
"server/ps 폴더를 기준으로 전체 실행 스크립트 세트 완성.
이제 Overlay v3 개발환경 완전 자동화 준비 끝났다 파트너."
```
