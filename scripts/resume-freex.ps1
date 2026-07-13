<#
FreeX — Resume Work
Только чтение. Не выполняет commit, push, merge, reset или checkout.
Показывает состояние проекта и обновляет AUTO-блоки в PROJECT_STATUS.md /
AI_RESUME.md (только между маркерами AUTO:START / AUTO:END).
#>

$ErrorActionPreference = 'Stop'

function Write-Section($title) {
    Write-Host ""
    Write-Host "=== $title ===" -ForegroundColor Cyan
}

# 1-2. Найти корень репозитория, проверить наличие Git
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Host "Ошибка: Git не найден в PATH. Установи Git и повтори." -ForegroundColor Red
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

Write-Host "FreeX: восстановление рабочего процесса" -ForegroundColor Green
Write-Host "Проект: $repoRoot"

# 3. git fetch (без изменения рабочих файлов)
Write-Section "Синхронизация с GitHub"
git fetch origin --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Не удалось выполнить git fetch (нет сети или доступа). Показываю локальные данные." -ForegroundColor Yellow
} else {
    Write-Host "git fetch origin — выполнено."
}

# 4. Данные Git
$branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()

Write-Section "Текущая ветка"
Write-Host $branch

Write-Section "git status"
$statusShort = git status --short
$changedCount = 0
if ($statusShort) {
    $changedCount = ($statusShort | Measure-Object).Count
    $statusShort | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "Рабочая копия чистая, изменений нет."
}

Write-Section "Последние 5 коммитов"
$log5 = git log -5 --pretty=format:'%h  %ad  %s' --date=format:'%Y-%m-%d %H:%M'
$log5 | ForEach-Object { Write-Host "  $_" }

$lastTag = (git describe --tags --abbrev=0 2>$null)
if (-not $lastTag) { $lastTag = "(тегов нет)" }
Write-Section "Последний тег"
Write-Host $lastTag

Write-Section "Состояние origin/$branch"
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
    Write-Host "Локально впереди на $unpushedCount, позади на $behindCount (относительно $remoteRef)"
} else {
    Write-Host "Нет upstream-ветки для сравнения."
}

Write-Section "Итоги"
Write-Host "Изменённых файлов (не закоммичено): $changedCount"
Write-Host "Незапушенных коммитов: $unpushedCount"

# 5. Текущая версия FreeX
$version = "неизвестна"
$versionFile = Join-Path $repoRoot 'js\config.js'
if (Test-Path $versionFile) {
    $m = Select-String -Path $versionFile -Pattern "APP_VERSION\s*=\s*'([^']+)'" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $version = $m.Matches[0].Groups[1].Value }
}
Write-Section "Версия FreeX"
Write-Host $version

# 6. Проверка ключевых документов
Write-Section "Ключевые документы"
$docs = @('start.md', 'agents\gpt.md', 'PROJECT_STATUS.md', 'CHANGELOG.md', 'AI_RESUME.md', 'START_PROMPT.md')
foreach ($doc in $docs) {
    $p = Join-Path $repoRoot $doc
    if (Test-Path $p) {
        Write-Host "  [OK]  $doc"
    } else {
        Write-Host "  [НЕТ] $doc" -ForegroundColor Yellow
    }
}

# 7-8. Секреты не читаем, деструктивных команд не выполняем (по конструкции скрипта).

# --- Автообновление AUTO-блока ---
function Update-AutoBlock {
    param(
        [string]$FilePath,
        [string]$AutoContent
    )
    if (-not (Test-Path $FilePath)) {
        Write-Host "  Пропуск обновления: $FilePath не найден (создаётся отдельно, не этим шагом)." -ForegroundColor Yellow
        return
    }
    $content = Get-Content -Raw -Path $FilePath -Encoding UTF8
    $pattern = '(?s)<!-- AUTO:START -->.*?<!-- AUTO:END -->'
    $newBlock = "<!-- AUTO:START -->`r`n$AutoContent`r`n<!-- AUTO:END -->"
    $rx = New-Object System.Text.RegularExpressions.Regex($pattern)
    if ($rx.Match($content).Success) {
        $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $newBlock }
        # Ограничиваем замену ОДНИМ (первым) совпадением, чтобы случайное упоминание
        # маркеров где-то в тексте документа не превратилось во второе "совпадение".
        $updated = $rx.Replace($content, $evaluator, 1)
        Set-Content -Path $FilePath -Value $updated -NoNewline -Encoding UTF8
        Write-Host "  Обновлён AUTO-блок: $FilePath"
    } else {
        Write-Host "  В файле $FilePath не найдены маркеры AUTO:START/AUTO:END — пропуск." -ForegroundColor Yellow
    }
}

$now = Get-Date -Format 'yyyy-MM-dd HH:mm'
$lastCommitLine = (git log -1 --pretty=format:'%h — %s (%ad)' --date=format:'%Y-%m-%d %H:%M')

$deployNote = "Vercel деплоит ветку 'main' автоматически (freex-eta.vercel.app)"
if ($unpushedCount -gt 0) {
    $deployNote += "; на проде ещё нет $unpushedCount незапушенных коммитов"
}

$statusAuto = @"
**Обновлено:** $now
**Версия FreeX:** $version
**Ветка:** $branch
**Последний коммит:** $lastCommitLine
**Последний тег:** $lastTag
**Синхронизация с GitHub:** локально впереди на $unpushedCount, позади на $behindCount
**Изменённые файлы (не закоммичено):** $changedCount
**Незапушенные коммиты:** $unpushedCount
**Состояние деплоя:** $deployNote
"@

$resumeAuto = @"
**Обновлено:** $now
**Версия FreeX:** $version
**Ветка:** $branch
"@

Write-Section "Обновление AUTO-блоков"
Update-AutoBlock -FilePath (Join-Path $repoRoot 'PROJECT_STATUS.md') -AutoContent $statusAuto
Update-AutoBlock -FilePath (Join-Path $repoRoot 'AI_RESUME.md') -AutoContent $resumeAuto

# --- Разбор структурированного блока "Текущий шаг" из AI_RESUME.md ---
function Get-CurrentStepField {
    param([string]$SectionText, [string]$FieldName)
    $m = [regex]::Match($SectionText, "(?m)^-\s*$FieldName\s*:\s*(.+)$")
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    return $null
}

$task = $null; $step = $null; $stepStatus = $null; $nextStep = $null
$resumeFile = Join-Path $repoRoot 'AI_RESUME.md'
if (Test-Path $resumeFile) {
    $resumeContent = Get-Content -Raw -Path $resumeFile -Encoding UTF8
    $sectionMatch = [regex]::Match($resumeContent, '(?s)## Текущий шаг\r?\n(.*?)(\r?\n## |\z)')
    if ($sectionMatch.Success) {
        $sectionText = $sectionMatch.Groups[1].Value
        $task = Get-CurrentStepField -SectionText $sectionText -FieldName 'task'
        $step = Get-CurrentStepField -SectionText $sectionText -FieldName 'step'
        $stepStatus = Get-CurrentStepField -SectionText $sectionText -FieldName 'status'
        $nextStep = Get-CurrentStepField -SectionText $sectionText -FieldName 'next_step'
    }
}

# --- Краткое резюме ---
Write-Section "Резюме"
Write-Host "Проект:        FreeX $version"
Write-Host "Ветка:         $branch"
Write-Host "Изменений:     $changedCount незакоммиченных, $unpushedCount незапушенных"
Write-Host "Последний шаг: $lastCommitLine"

if ($task -or $step) {
    Write-Section "Команда «ок» продолжит"
    if ($task) { Write-Host "Задача:        $task" }
    if ($step) { Write-Host "Шаг:           $step" }
    if ($stepStatus) { Write-Host "Статус шага:   $stepStatus" }
    if ($stepStatus -eq 'completed' -and $nextStep) {
        Write-Host "Шаг завершён — продолжение возьмёт из next_step:"
        Write-Host "               $nextStep"
    } elseif ($stepStatus -eq 'running' -or $stepStatus -eq 'interrupted') {
        Write-Host "Шаг не завершён — продолжение сверит файлы с описанием и" -ForegroundColor Yellow
        Write-Host "               доделает именно этот шаг, не начиная заново." -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Готовая команда для чата с ИИ-агентом:" -ForegroundColor Green
    Write-Host "  ок"
} else {
    Write-Host ""
    Write-Host "В AI_RESUME.md не найден блок «Текущий шаг» — команда «ок» пока не сможет" -ForegroundColor Yellow
    Write-Host "определить, что продолжать. Заполни AI_RESUME.md вручную." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Дальше: открой PROJECT_STATUS.md и AI_RESUME.md, там — текущая задача и следующий шаг." -ForegroundColor Green
