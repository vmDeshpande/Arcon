# Arcon V1 Training Monitor
# Usage: .\monitor_training.ps1

$procId = 26312
$logPath = "C:\Projects\Arcon\training\outputs\arcon-v1\training-log.txt"

Write-Host "=== Arcon V1 Training Monitor ===" -ForegroundColor Cyan
Write-Host "Monitoring PID: $procId" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Gray

while ($true) {
    Clear-Host
    
    # Header
    Write-Host "=== Arcon V1 Training Monitor ===" -ForegroundColor Cyan
    Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host ""
    
    # Process status
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Status: RUNNING (PID $procId)" -ForegroundColor Green
        Write-Host "CPU Time: $([math]::Round($proc.CPU, 2))s" -ForegroundColor Gray
        Write-Host "RAM: $([math]::Round($proc.WorkingSet64 / 1MB, 0)) MB" -ForegroundColor Gray
    } else {
        Write-Host "Status: STOPPED" -ForegroundColor Red
    }
    
    Write-Host ""
    
    # GPU stats
    Write-Host "--- GPU ---" -ForegroundColor Yellow
    try {
        $gpu = nvidia-smi --query-gpu=memory.used,memory.total,memory.free --format=csv,noheader,nounits 2>$null
        if ($gpu) {
            Write-Host "VRAM: $gpu MB" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "GPU info unavailable" -ForegroundColor Red
    }
    
    Write-Host ""
    
    # Training log
    Write-Host "--- Training Log (last 15 lines) ---" -ForegroundColor Yellow
    if (Test-Path $logPath) {
        $lines = Get-Content $logPath -Tail 15
        if ($lines) {
            $lines | ForEach-Object { Write-Host $_ }
        } else {
            Write-Host "Log file is empty" -ForegroundColor Red
        }
    } else {
        Write-Host "Log file not found" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "--- Latest Step Info ---" -ForegroundColor Magenta
    
    # Try to get latest step from background process
    $latestStep = ""
    try {
        # This would need to be updated with actual method to get latest step
        Write-Host "Check Kilo background process status for latest step" -ForegroundColor Gray
    } catch {
        Write-Host "Unable to fetch latest step" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Refreshing in 5 seconds..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 5
}
