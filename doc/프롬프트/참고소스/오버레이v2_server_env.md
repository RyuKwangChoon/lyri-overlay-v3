---
# =============================
# 🌐 Overlay v2.1 Environment
# =============================

# SERVER CONFIG (relay_v2.0.js)
---

```
PORT=8787
RELAY_TOKEN=lyri_secret_1234

DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=overlay_lyri
DB_PASS=kwang760!@3
DB_NAME=overlay_db
```
# GATE CONFIG (gate_v2.1.js)
```
GATE_PORT=8788
RELAY_URL=http://127.0.0.1:8787
ALLOW_ORIGINS=http://localhost:5173,https://overlay.lyrisudabang.com,https://gpt.lyrisudabang.com
```
# Optional
```
FORCE_ROLE_MAP=1
LOG_LEVEL=info
```
