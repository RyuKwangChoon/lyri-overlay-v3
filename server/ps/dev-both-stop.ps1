# dev-both-stop.ps1
Write-Host "🛑 Stopping CLIENT & SERVER ..."

$pids = Get-Content "./dev-both.pid"

foreach ($line in $pids) {
    if ($line -match '^\d+$') {
        Write-Host "🔪 Killing PID $line ..."
        taskkill /PID $line /F > $null 2>&1
    }
}

Write-Host "☑ dev-both processes terminated!"
