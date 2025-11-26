# 🧭 MCP 설치 가이드 v1.0

## 1. 사전 준비
- Node.js 18+
- Python 3.10+
- Git 최신 버전

## 2. MCP란?
AI가 실제 파일 시스템을 읽고 쓰고 실행할 수 있게 하는 OS 확장 구조.

## 3. MCP 런타임 설치
```bash
npm install -g @modelcontextprotocol/command
mcp --version
```

## 4. Cursor에서 MCP 활성화
1) Settings → AI Tools → Model Context Protocol  
2) FileSystem / Terminal / Git / Process / Browser Tools 허용  
3) 프로젝트 폴더 자동 인덱싱

## 5. 로컬 LLM 연결 (Optional)
### Ollama 설치
```bash
ollama pull llama3.1
```

## 6. MCP 테스트
```bash
신입아, src/components/player/FullPlayer.vue 파일 만들어줘.
```

## 7. 설치 후 가능한 기능
- 파일 생성/수정
- 터미널 실행
- Git 작업
- 서버/게이트/vite 자동 수정

## 8. 설치 요약
```
1) npm install -g MCP
2) Cursor → MCP ON
3) Tools 허용
4) 파일 생성 테스트
```
