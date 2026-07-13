<#
FreeX — Create Checkpoint
Только диагностика. Не выполняет commit, push, merge, reset или checkout.
Проверяет синтаксис JS, ищет вероятные секреты в незакоммиченных изменениях,
показывает diff --stat, обновляет AUTO-блок PROJECT_STATUS.md и предлагает
текст commit-сообщения (сам не коммитит).
#>

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

Write-Host "FreeX: контрольная точка (checkpoint)" -ForegroundColor Green
Write-Host "Проект: $repoRoot"

# 1-2. Синтаксическая проверка JS (node --check), включая api/chat.js
Write-Section "Синтаксис JavaScript (node --check)"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$jsOk = $true
if (-not $nodeCmd) {
    Write-Host "Node.js не найден в PATH — синтаксическая проверка пропущена." -ForegroundColor Yellow
} else {
    $jsFiles = @()
    $jsFiles += Get-ChildItem -Path (Join-Path $repoRoot 'js') -Filter '*.js' -File -ErrorAction SilentlyContinue
    $apiChat = Join-Path $repoRoot 'api\chat.js'
    if (Test-Path $apiChat) { $jsFiles += Get-Item $apiChat }

    if ($jsFiles.Count -eq 0) {
        Write-Host "JS-файлы не найдены." -ForegroundColor Yellow
    }
    foreach ($f in $jsFiles) {
        $rel = $f.FullName.Substring($repoRoot.Length + 1)
        $out = & node --check $f.FullName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK]    $rel"
        } else {
            $jsOk = $false
            Write-Host "  [ОШИБКА] $rel" -ForegroundColor Red
            $out | ForEach-Object { Write-Host "           $_" -ForegroundColor Red }
        }
    }
}

# 3. Поиск вероятных секретов в незакоммиченных изменениях (по шаблонам, без вывода значений)
Write-Section "Проверка на секреты в изменениях"
$secretPatterns = @(
    @{ Name = 'DeepSeek/OpenAI-подобный ключ (sk-...)'; Regex = 'sk-[A-Za-z0-9]{10,}' },
    @{ Name = 'ENV-переменная вида API_KEY='; Regex = '(API|SECRET)_?KEY\s*=\s*[''"]?[A-Za-z0-9_\-]{10,}' },
    @{ Name = 'Bearer-токен с реальным значением'; Regex = 'Bearer\s+[A-Za-z0-9\-_\.]{15,}' },
    @{ Name = 'GitHub Personal Access Token'; Regex = '(ghp_|github_pat_)[A-Za-z0-9_]{20,}' }
)

$changedEntries = git status --porcelain
$secretsFound = $false
if ($changedEntries) {
    foreach ($entry in $changedEntries) {
        $path = $entry.Substring(3).Trim().Trim('"')
        # На всякий случай явно пропускаем .env* — даже если бы такой файл попал в список
        if ($path -match '^\.env') { continue }
        $fullPath = Join-Path $repoRoot $path
        if (-not (Test-Path $fullPath -PathType Leaf)) { continue }

        $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
        $textExt = @('.js', '.md', '.json', '.html', '.css', '.ps1', '.cmd', '.txt', '.yml', '.yaml')
        if ($textExt -notcontains $ext) { continue }

        $lines = Get-Content -Path $fullPath -ErrorAction SilentlyContinue
        if (-not $lines) { continue }
        for ($i = 0; $i -lt $lines.Count; $i++) {
            foreach ($p in $secretPatterns) {
                if ($lines[$i] -match $p.Regex) {
                    $secretsFound = $true
                    $matchValue = $Matches[0]
                    $redacted = $matchValue.Substring(0, [Math]::Min(4, $matchValue.Length)) + '…(скрыто)'
                    Write-Host "  [ВНИМАНИЕ] $path`:$($i+1) — похоже на «$($p.Name)»: $redacted" -ForegroundColor Red
                }
            }
        }
    }
}
if (-not $secretsFound) {
    Write-Host "Совпадений с шаблонами секретов не найдено."
} else {
    Write-Host ""
    Write-Host "Проверь отмеченные строки вручную перед коммитом." -ForegroundColor Yellow
}

# 4. git diff --stat
Write-Section "git diff --stat"
$diffStat = git diff --stat
if ($diffStat) {
    $diffStat | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "Нет изменений в отслеживаемых файлах (diff пуст)."
}

# 5. Изменённые файлы
Write-Section "Изменённые файлы (git status --short)"
$statusShort = git status --short
if ($statusShort) {
    $statusShort | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "Рабочая копия чистая."
}

# 6. Обновление AUTO-блока PROJECT_STATUS.md
function Update-AutoBlock {
    param([string]$FilePath, [string]$AutoContent)
    if (-not (Test-Path $FilePath)) {
        Write-Host "  Пропуск: $FilePath не найден." -ForegroundColor Yellow
        return
    }
    $content = Get-Content -Raw -Path $FilePath -Encoding UTF8
    $pattern = '(?s)<!-- AUTO:START -->.*?<!-- AUTO:END -->'
    $newBlock = "<!-- AUTO:START -->`r`n$AutoContent`r`n<!-- AUTO:END -->"
    $rx = New-Object System.Text.RegularExpressions.Regex($pattern)
    if ($rx.Match($content).Success) {
        $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $newBlock }
        $updated = $rx.Replace($content, $evaluator, 1)
        Set-Content -Path $FilePath -Value $updated -NoNewline -Encoding UTF8
        Write-Host "  Обновлён AUTO-блок: $FilePath"
    } else {
        Write-Host "  В файле $FilePath не найдены маркеры AUTO:START/AUTO:END — пропуск." -ForegroundColor Yellow
    }
}

$branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
$version = "неизвестна"
$versionFile = Join-Path $repoRoot 'js\config.js'
if (Test-Path $versionFile) {
    $m = Select-String -Path $versionFile -Pattern "APP_VERSION\s*=\s*'([^']+)'" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $version = $m.Matches[0].Groups[1].Value }
}
$lastTag = (git describe --tags --abbrev=0 2>$null)
if (-not $lastTag) { $lastTag = "(тегов нет)" }
$lastCommitLine = (git log -1 --pretty=format:'%h — %s (%ad)' --date=format:'%Y-%m-%d %H:%M')
$changedCount = 0
if ($statusShort) { $changedCount = ($statusShort | Measure-Object).Count }
$unpushedCount = 0
$behindCount = 0
$remoteRef = git rev-parse --abbrev-ref "$branch@{upstream}" 2>$null
if ($remoteRef) {
    $counts = git rev-list --left-right --count "$remoteRef...$branch" 2>$null
    if ($counts) {
        $parts = ($counts -split '\s+')
        $behindCount = [int]$parts[0]
        $unpushedCount = [int]$parts[1]
    }
}
$now = Get-Date -Format 'yyyy-MM-dd HH:mm'
$deployNote = "Vercel деплоит ветку main автоматически (freex-eta.vercel.app)"
if ($unpushedCount -gt 0) {
    $deployNote += "; на проде ещё нет $unpushedCount незапушенных коммитов"
}
$statusAuto = @"
**Обновлено:** $now (checkpoint)
**Версия FreeX:** $version
**Ветка:** $branch
**Последний коммит:** $lastCommitLine
**Последний тег:** $lastTag
**Синхронизация с GitHub:** локально впереди на $unpushedCount, позади на $behindCount
**Изменённые файлы (не закоммичено):** $changedCount
**Незапушенные коммиты:** $unpushedCount
**Состояние деплоя:** $deployNote
"@

Write-Section "Обновление AUTO-блока"
Update-AutoBlock -FilePath (Join-Path $repoRoot 'PROJECT_STATUS.md') -AutoContent $statusAuto

# 7. Черновик commit-сообщения (только текст, ничего не коммитим)
Write-Section "Предлагаемое commit-сообщение"
$changedPaths = @()
if ($statusShort) {
    $changedPaths = $statusShort | ForEach-Object { $_.Substring(3).Trim().Trim('"') }
}
$automationPattern = '^(scripts/|\.vscode/|CHANGELOG\.md|PROJECT_STATUS\.md|AI_RESUME\.md|START_PROMPT\.md|Resume FreeX\.cmd)'
$isAutomationOnly = ($changedPaths.Count -gt 0) -and (-not ($changedPaths | Where-Object { $_ -notmatch $automationPattern }))
$touchesCode = $changedPaths | Where-Object { $_ -match '^(js/|api/|index\.html|style\.css)' }

if ($changedPaths.Count -eq 0) {
    Write-Host "Изменений нет — коммитить нечего."
} elseif ($isAutomationOnly) {
    Write-Host "chore: automate FreeX work recovery"
} elseif ($touchesCode) {
    Write-Host "fix: <опиши суть изменения в коде>"
    Write-Host "(изменены файлы приложения — не смешивай с автоматизацией восстановления)" -ForegroundColor Yellow
} else {
    Write-Host "chore: update FreeX project files"
}
Write-Host ""
Write-Host "Изменённые файлы:"
$changedPaths | ForEach-Object { Write-Host "  - $_" }

# 8. Ничего не коммитим и не пушим — только вывод.
Write-Section "Итог"
if (-not $jsOk) {
    Write-Host "Есть синтаксические ошибки JS — исправь перед коммитом." -ForegroundColor Red
} elseif ($secretsFound) {
    Write-Host "Есть подозрения на секреты в изменениях — проверь перед коммитом." -ForegroundColor Yellow
} else {
    Write-Host "Синтаксис в порядке, секретов по шаблонам не найдено." -ForegroundColor Green
}
