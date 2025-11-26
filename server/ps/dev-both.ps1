# dev-both.ps1
Write-Host "🚀 Starting CLIENT & SERVER ..."

# ===========================================
# CLIENT (vite)
# ===========================================
$client = Start-Process powershell.exe `
    -ArgumentList "-NoExit", "-Command npm run dev" `
    -WorkingDirectory "../../client" `
    -WindowStyle Hidden `
    -PassThru

if (-not $client) {
    Write-Host "❌ CLIENT 실행 실패!"
    exit 1
}

# ===========================================
# SERVER (node)
# ===========================================
$server = Start-Process powershell.exe `
    -ArgumentList "-NoExit", "-Command node index.js" `
    -WorkingDirectory ".." `
    -WindowStyle Hidden `
    -PassThru
    
if (-not $server) {
    Write-Host "❌ SERVER 실행 실패!"
    exit 1
}

Write-Host "🔥 Started!"
Write-Host "   CLIENT PID = $($client.Id)"
Write-Host "   SERVER PID = $($server.Id)"

# ===========================================
# PID 저장 (2줄)
# ===========================================
@(
    $client.Id
    $server.Id
) | Set-Content -Path "./dev-both.pid" -Encoding UTF8

Write-Host "📌 PID saved to dev-both.pid"
