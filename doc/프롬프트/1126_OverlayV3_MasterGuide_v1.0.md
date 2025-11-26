# 🎛️ Overlay V3 Master Guide v1.0 (초안)

## 1. Overview
Overlay V3는 Lyri × Brian Studio가 개발하는 완전 모듈형·확장형 오디오 오버레이 시스템이다.  
App.vue 상단에 독립 오디오 엔진을 상주시켜, router-view 전환에도 재생이 끊기지 않는 구조를 목표로 한다.

---

## 2. Architectural Principles
- 단일 오디오 엔진(App.vue 최상단)
- 상태 = modules, UI = components
- WebSocket은 이벤트 브로드캐스트만 수행
- 버튼·핸들 위주 조작 (스와이프 금지)
- 컴포넌트 단일책임 원칙

---

## 3. Folder Structure (Unified)
```
src/
 ├─ components/
 │    ├─ player/
 │    │    ├─ MiniPlayer.vue
 │    │    ├─ FullPlayer.vue
 │    │    ├─ PlayerBar.vue
 │    │    ├─ PlayerButtons.vue
 │    │    └─ TrackItem.vue
 │    ├─ overlay/
 │    │    ├─ OverlayTitle.vue
 │    │    ├─ TopTicker.vue
 │    │    ├─ BottomTicker.vue
 │    │    └─ ChatBubble.vue
 │    └─ layout/
 │         └─ OverlayFrame.vue
 ├─ modules/
 │    ├─ audioEngine.ts
 │    ├─ nowPlaying.ts
 │    ├─ ws.ts
 │    └─ trackOrder.ts
 ├─ views/
 │    ├─ TrackListView.vue
 │    ├─ NowPlayingView.vue
 │    ├─ AlbumInfoView.vue
 │    └─ SettingsView.vue
 ├─ services/api.ts
 ├─ themes/
 │    ├─ default.css
 │    ├─ theme-xmas.css
 │    └─ theme-dark.css
 ├─ App.vue
 ├─ main.ts
 └─ router/index.ts
```

---

## 4. Version Naming Rules
```
Component_v1.vue
Component_v2_xmas.vue
```
메타데이터 블록 포함:
```
<!--
Component: OverlayTitle
Version: v1.2
Updated: 2025-11-21
-->
```

---

## 5. Audio Engine Architecture
- Audio 객체는 App.vue에서 1회 생성
- 상태 흐름: IDLE → LOADING → PLAYING → PAUSED → ENDED
- track load, auto next, progress tick, ws sync, repeat/shuffle 처리
- UI는 audioEngine.ts를 직접 제어하지 않음

---

## 6. WebSocket Architecture
메시지 예:
```
{
  "type": "play",
  "payload": { "trackId": 22 }
}
```
역할:
- 상태 전파
- overlay message, ticker message  
하지 않는 것:
- 직접 재생 제어  
→ audioEngine.ts 담당

---

## 7. Component Architecture
### Player
- MiniPlayer.vue  
- FullPlayer.vue  
- PlayerButtons.vue  
- TrackItem.vue

### Overlay
- OverlayTitle.vue  
- TopTicker.vue  
- BottomTicker.vue  
- ChatBubble.vue  

### Layout
- OverlayFrame.vue  

---

## 8. Views & Routing Strategy
- router-view는 UI 변경만 담당  
- 오디오 엔진은 App.vue 최상단 고정  
- 페이지:
  - TrackListView
  - NowPlayingView
  - AlbumInfoView
  - SettingsView

---

## 9. UI/UX Rules
- 드래그 = 오른쪽 손잡이  
- 선택 = 왼쪽 체크박스  
- 펼치기/접기 = 버튼  
- 스와이프 금지  
- Overlay 레이어는 항상 고정

---

## 10. Coding Rules
- style 최소화, theme 분리
- ref 남용 금지
- 상태는 modules에서만 수정
- 이벤트 흐름:
```
UI → module 호출 → 상태 업데이트 → UI 반영
```
- 로그는 DEV 모드에서만

---

## 11. Theming System
- default.css  
- theme-xmas.css  
- theme-dark.css  

CSS 변수 기반:
```
:root {
  --primary: #fff;
  --accent: #ff4949;
}
```

---

## 12. Server API Specification
```
GET  /api/tracks
POST /api/track-order
GET  /api/now-playing
POST /api/overlay/message
POST /api/ticker/update
```
WS endpoint:
```
ws://{domain}/ws
```

---

## 13. Deployment Rules
### dev
```
npm run dev-both
```
### prod
```
npm run build
pm2 start pm2-dev.config.js
```
도메인:
- overlay.lyrisudabang.com
- api.lyrisudabang.com

---

## 14. Roadmap & Release Plan
### 2025 Q4
- Overlay V3 구조 구현  
- 오디오엔진 완성  
- 컴포넌트 스캐폴딩

### 2026 Q1
- WS 안정화  
- 시즌 테마 시스템 확장

### 2026 Q2
- 자동화 기능  
- 에이전시형 AI 통합

---

## 15. Glossary
- Engine: audioEngine.ts  
- State: nowPlaying, repeatMode  
- Overlay: OBS용 장면  
- Player: 오디오 UI  
- Ticker: 공지  
- Bubble: 말풍선  
