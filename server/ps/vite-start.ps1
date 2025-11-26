# ==============================
# Vite Dev 서버 자동 종료 + 재시작
# ==============================

Write-Host "🔍 Checking Vite dev server on port 5173..."

$procLine = netstat -ano | findstr 5173 | Select-String "LISTENING" -ErrorAction SilentlyContinue

if ($procLine) {
    $pid = ($procLine -split "\s+")[-1]
    Write-Host "⚠ Existing Vite process found. Killing PID $pid..."
    taskkill /PID $pid /F | Out-Null
    Write-Host "🟢 Old Vite process terminated."
}
else {
    Write-Host "✅ No existing Vite process on 5173."
}

# ------------------------------
# 📂 client 디렉토리로 이동 후 npm run dev
# ------------------------------
# $PSScriptRoot = 이 ps1 파일이 있는 폴더 (server/ps)
$serverDir  = Split-Path $PSScriptRoot -Parent       # server
$clientDir  = Join-Path $serverDir "..\client" | Resolve-Path

Write-Host "📂 Changing directory to client: $clientDir"
Push-Location $clientDir

Write-Host "🚀 Starting Vite dev server (npm run dev)..."
npm run dev

# dev 서버가 끝난 후 원래 위치 복귀
Pop-Location
