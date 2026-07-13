<#
FreeX — Claude Code Watchdog
Перезапускает Claude Code (неинтерактивный режим --print) при сетевых
обрывах ("Connection closed mid-response" и подобных). Использует только
реальные флаги из `claude --help`: -p/--print, -c/--continue,
--permission-mode. Ничего не придумывает сверх официального CLI.

Что этот скрипт НИКОГДА не делает:
- не выполняет git reset / checkout -- / force push;
- не удаляет пользовательские данные;
- не включает --dangerously-skip-permissions / --allow-dangerously-skip-permissions;
- не запускает CLI в bypassPermissions.

Если после успешного ответа Claude checkpoint-freex.ps1 находит
синтаксическую ошибку JS или подозрение на секрет — watchdog немедленно
останавливается и ничего дальше не делает: разбираться должен человек.
#>

param(
    [int]$MaxRetries = 5,
    [int]$WaitSeconds = 20
)

$ErrorActionPreference = 'Stop'

function Write-Section($title) {
    Write-Host ""
    Write-Host "=== $title ===" -ForegroundColor Cyan
}

$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Host "Ошибка: Git не найден в PATH." -ForegroundColor Red
    exit 1
}
$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
    Write-Host "Ошибка: Claude Code CLI не найден в PATH (команда 'claude')." -ForegroundColor Red
    Write-Host "Установи его согласно официальной документации и повтори." -ForegroundColor Red
    exit 1
}

try {
    $repoRoot = (git rev-parse --show-toplevel 2>$null)
} catch {
    $repoRoot = $null
}
if (-not $repoRoot) {
    Write-Host "Ошибка: текущая папка не является Git-репозиторием FreeX." -ForegroundColor Red
    exit 1
}
$repoRoot = ($repoRoot -replace '/', '\').Trim()
Set-Location $repoRoot

Write-Host "FreeX: Claude Code Watchdog" -ForegroundColor Green
Write-Host "Проект: $repoRoot"
Write-Host "Макс. попыток: $MaxRetries, пауза между попытками: ${WaitSeconds}с"

# --- Построить промпт продолжения из AI_RESUME.md (та же логика, что и в resume-freex.ps1) ---
function Get-CurrentStepField {
    param([string]$SectionText, [string]$FieldName)
    $m = [regex]::Match($SectionText, "(?m)^-\s*$FieldName\s*:\s*(.+)$")
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    return $null
}

function Get-ContinuationPrompt {
    $resumeFile = Join-Path $repoRoot 'AI_RESUME.md'
    $task = $null; $step = $null; $status = $null; $nextStep = $null
    if (Test-Path $resumeFile) {
        $content = Get-Content -Raw -Path $resumeFile -Encoding UTF8
        $sectionMatch = [regex]::Match($content, '(?s)## Текущий шаг\r?\n(.*?)(\r?\n## |\z)')
        if ($sectionMatch.Success) {
            $sectionText = $sectionMatch.Groups[1].Value
            $task = Get-CurrentStepField -SectionText $sectionText -FieldName 'task'
            $step = Get-CurrentStepField -SectionText $sectionText -FieldName 'step'
            $status = Get-CurrentStepField -SectionText $sectionText -FieldName 'status'
            $nextStep = Get-CurrentStepField -SectionText $sectionText -FieldName 'next_step'
        }
    }

    $prompt = "Продолжаем FreeX. Прочитай AI_RESUME.md (раздел «Текущий шаг») и " +
        "PROJECT_STATUS.md, сверь их с фактическим состоянием файлов и git status. "
    if ($status -eq 'completed') {
        $prompt += "Последний шаг завершён (status: completed) — не повторяй его, " +
            "выполни next_step: $nextStep. "
    } elseif ($status) {
        $prompt += "Текущий шаг имеет статус '$status' (task: $task; step: $step) — " +
            "проверь, что реально сделано, и продолжи именно с этого места, не начиная " +
            "задачу заново. "
    } else {
        $prompt += "Блок «Текущий шаг» не найден или пуст — сначала разберись в " +
            "фактическом состоянии, не выдумывай задачу. "
    }
    $prompt += "Перед началом нового шага запиши status: running и план в AI_RESUME.md, " +
        "после завершения — status: completed и факты. Не выполняй git reset, " +
        "checkout --, force push и не удаляй пользовательские данные без отдельного " +
        "явного разрешения."
    return $prompt
}

# --- Основной цикл повторов ---
$attempt = 0
$success = $false
$stopReason = $null

while ($attempt -lt $MaxRetries -and -not $success) {
    $attempt++
    $prompt = Get-ContinuationPrompt

    Write-Section "Попытка $attempt из $MaxRetries"
    Write-Host "Промпт продолжения:" -ForegroundColor DarkGray
    Write-Host "  $prompt" -ForegroundColor DarkGray
    Write-Host ""

    # -p/--print: неинтерактивный запуск, печатает ответ и завершается.
    # -c/--continue: продолжает последнюю беседу в этой директории (официальный флаг).
    # --permission-mode default: обычные проверки разрешений (не bypass).
    $output = & claude --print --continue --permission-mode default $prompt 2>&1
    $exitCode = $LASTEXITCODE
    $outText = ($output | Out-String)
    Write-Host $outText

    if ($exitCode -eq 0) {
        $success = $true
    } else {
        $isNetworkError = $outText -match '(?i)(connection closed|econnreset|etimedout|network error|fetch failed|timed? ?out|enotfound|socket hang up|getaddrinfo)'
        if ($isNetworkError -and $attempt -lt $MaxRetries) {
            Write-Host "Похоже на сетевой обрыв. Жду $WaitSeconds секунд перед повтором..." -ForegroundColor Yellow
            Start-Sleep -Seconds $WaitSeconds
        } else {
            $stopReason = "Claude Code завершился с ошибкой (exit $exitCode), не похожей на сетевую, " +
                "или исчерпаны попытки. Останавливаюсь — нужна проверка человеком."
            break
        }
    }
}

if (-not $success) {
    Write-Section "Остановка"
    if ($stopReason) {
        Write-Host $stopReason -ForegroundColor Red
    } else {
        Write-Host "Не удалось получить успешный ответ за $MaxRetries попыток." -ForegroundColor Red
    }
    exit 1
}

Write-Section "Ответ получен — проверка безопасности перед завершением"
$checkpointScript = Join-Path $repoRoot 'scripts\checkpoint-freex.ps1'
if (Test-Path $checkpointScript) {
    $checkpointOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File $checkpointScript 2>&1
    $checkpointText = ($checkpointOutput | Out-String)
    Write-Host $checkpointText

    $hasJsError = $checkpointText -match '(?i)\[ошибка\]'
    $hasSecret = $checkpointText -match '(?i)\[внимание\]'
    if ($hasJsError -or $hasSecret) {
        Write-Section "Остановка"
        Write-Host "checkpoint-freex.ps1 нашёл проблему (синтаксис JS или похожее на секрет)." -ForegroundColor Red
        Write-Host "Дальше не продолжаю — нужна ручная проверка." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "scripts/checkpoint-freex.ps1 не найден — пропускаю проверку." -ForegroundColor Yellow
}

Write-Section "Готово"
Write-Host "Claude Code успешно продолжил работу, проверка безопасности пройдена." -ForegroundColor Green
Write-Host "commit/push этот скрипт не выполняет — сделай вручную после ревью." -ForegroundColor Green
