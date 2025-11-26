# ============================
# Vite Dev 서버 자동 종료 + 재시작
# ============================

Write-Host "🔍 기존 Vite 서버 확인 중 (port 5173)..."

$proc = netstat -ano | findstr 5173 | Select-String "LISTENING"

if ($proc) {
    # 프로세스 ID(PID) 추출
    $pid = ($proc -split "\s+")[-1]

    Write-Host "⚠ 기존 Vite Dev 서버 실행중 → PID: $pid"
    Write-Host "🔫 프로세스 종료 중..."

    taskkill /PID $pid /F | Out-Null

    Write-Host "🟢 기존 프로세스 종료 완료."
} else {
    Write-Host "✅ 포트 5173은 비어 있음."
}

Write-Host "🚀 새 Vite Dev 서버 실행..."

npm run dev
