## Главный доказанный вывод
Для FreeX Development Machine лучше не “ломать” Windows 11, а сделать её **минимально шумной, но штатной**: удалить явный мусор, оставить защиту и обновления, а спорные твики применять только после измерений.[1][2][3]

## Подтверждено
- **WinGet связан с App Installer** и в Windows 11 идёт через него; App Installer обновляется через Store или вручную.[3][1]
- **Edge Startup Boost** реально держит процессы в фоне ради более быстрого старта, и его можно отключить в настройках Edge.[2][4]
- **WebView2 Runtime — отдельный компонент от браузера Edge**; это платформа для приложений, а не сам браузер.[5][6][7]
- **OneDrive опасен для папок разработки**, если синхронизирует живые исходники и меняет пути.[8][9]

## Вероятно полезно
- Удалять встроенные consumer-приложения, если вы ими не пользуетесь: Xbox, Clipchamp, Widgets, News, Weather, Solitaire, Tips, Feedback Hub, Get Help, Power Automate. Это снижает визуальный шум и немного уменьшает фоновые хвосты, но не даст “магического” ускорения.  
- Отключить автозапуск OneDrive, Teams, Copilot/Widgets, если они не нужны постоянно.  
- Оставить Defender, Firewall, UAC, SmartScreen, WinRE, точки восстановления и обновления.  

## Зависит от сценария
- **OneDrive**: для кодовой базы лучше не использовать синхронизируемую папку проекта; для личных документов — можно оставить.  
- **Windows Search, SysMain, Print Spooler, Bluetooth, Fax, Remote Registry, VSS**: отключать только если функция точно не нужна.  
- **Телеметрия, история активности, облачный поиск, Recall**: это прежде всего вопрос приватности, а не скорости.  
- **8 ГБ RAM**: сильнее всего помогают не твики служб, а сокращение браузерных вкладок, расширений и фоновых приложений.  

## Мифы и устаревшие советы
- “Отключить Defender ради скорости” — плохой совет для dev-машины.  
- “Отключить UAC для удобства” — тоже плохой совет.  
- “Чистка реестра ускоряет Windows” — почти всегда миф.  
- “Отключить все службы и получить заметный прирост” — устаревшая идея; вред обычно выше пользы.  
- “Кастомный ISO решит всё” — часто ломает обновления, Store, WinRE и поддержку.  

## Удалить
- Явные consumer-приложения, которые вы не используете: Xbox bundle, Widgets/News/Weather, Clipchamp, Solitaire, Tips, Feedback Hub, Power Automate, Dev Home.  
- Дублирующие OEM-утилиты, если они не нужны для драйверов, питания или функциональных клавиш.  
- Лишние предустановленные trial/рекламные приложения.  

## Отключить
- Startup Boost в Edge, если браузер не нужен сразу после входа.[4][2]
- Автозапуск OneDrive на рабочей машине разработки.[9][8]
- Widgets, Copilot, Teams consumer, Phone Link, если не используются.  
- Историю активности, рекламный ID, персонализированные предложения, облачный контент-поиск — если приоритет приватность.  

## Оставить обязательно
- Microsoft Defender, Firewall, SmartScreen, UAC, WinRE, точки восстановления.  
- Edge/WebView2 Runtime, App Installer, Microsoft Store.[6][7][3][5]
- Windows Update, BITS, Cryptographic Services, Task Scheduler, Windows Time.  
- Git, VS Code, Node.js LTS, Windows Terminal, PowerShell.  

## Не делать
- Не отключать Defender и Firewall “на постоянку”.  
- Не ставить очистители реестра и “ускорители”.  
- Не применять агрессивные debloat-скрипты без точечного отката.  
- Не хранить живой код в OneDrive-синхронизируемых папках.[8][9]

## Минимальный набор FreeX
- **Сразу:** браузер, Git, GitHub CLI, VS Code, Node.js LTS, Windows Terminal, PowerShell, 7-Zip, RustDesk, WinGet/App Installer.[1][3]
- **После подтверждения:** Python, WSL2, Docker Desktop, Claude Code, Kilo Code, GitHub Copilot, Obsidian/Notion.  
- **Не устанавливать:** сторонний антивирус, менеджеры драйверов, универсальные оптимизаторы, кастомные Windows-сборки.  

## План измерений
1. Зафиксировать старт: RAM idle, boot time, CPU idle, время запуска VS Code, размер `node_modules`, статус Update/Store/winget.  
2. Сделать одно изменение.  
3. Перезагрузить.  
4. Повторить измерения.  
5. Проверить: Wi‑Fi, Bluetooth, звук, камера, сон, RustDesk, Git, Node.js, локальный FreeX, Store, Update.  
6. Оставить только изменения, дающие измеримый выигрыш без поломок.  

## Пять самых надёжных источников
- **Microsoft Learn: WinGet** — подтверждает связь WinGet с App Installer и штатный путь установки/обновления.[3][1]
- **Microsoft Support: Edge Startup Boost** — описывает работу фоновых процессов и отключение.[2][4]
- **Microsoft Learn: WebView2** — доказывает, что WebView2 отдельно от браузера и нужен приложениям.[7][5][6]
- **Microsoft Defender docs** — показывает, что исключения должны быть узкими и обоснованными.[10][11][12]
- **Microsoft security post про вредоносные npm-пакеты** — подтверждает реальный риск для dev-машины при слишком широких исключениях.[13]

## Один личный совет
Я бы сделал эту машину **строгой, но не “раздетой”**: убрать шум, оставить безопасность, и каждый твик проверять экспериментом, а не верой.

## Итоговый вердикт
**Умеренная ручная настройка**.  
Для FreeX это лучший баланс: система остаётся обновляемой, безопасной и предсказуемой, но без лишнего мусора и фонового шума.

Источники
[1] Use WinGet to install and manage applications https://learn.microsoft.com/en-us/windows/package-manager/winget/
[2] Get help with startup boost https://support.microsoft.com/en-us/edge/get-help-with-startup-boost
[3] Install and update the App Installer - MSIX https://learn.microsoft.com/en-us/windows/msix/app-installer/install-update-app-installer
[4] Startup boost https://www.microsoft.com/en-us/edge/features/startup-boost?form=AWRE&cs=3090232544
[5] WebView2 in WinUI 3 - Windows apps | Microsoft Learn https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/webview2
[6] WebView2 documentation - Microsoft Edge Developer documentation https://learn.microsoft.com/en-us/microsoft-edge/webview2/landing/
[7] Distribute your app and the WebView2 Runtime - Microsoft Edge Developer documentation https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution?tabs=dotnetcsharp
[8] OneDrive broke my development environment https://www.linkedin.com/posts/philbd_devops-python-onedrive-activity-7325433347713736704-KDPu
[9] OneDrive and Version Controlled and/or Source Code Directories · Issue #75 · microsoft/Windows-Dev-Performance https://github.com/microsoft/Windows-Dev-Performance/issues/75
[10] Contextual file and folder exclusions - Microsoft Defender for Endpoint https://learn.microsoft.com/en-us/defender-endpoint/configure-contextual-file-folder-exclusions-microsoft-defender-antivirus
[11] Microsoft Defender Antivirus exclusions design — Solving Microsoft 365 https://www.solvingmicrosoft365.com/guides/defender-antivirus-exclusions
[12] defender-docs/defender-endpoint/common-exclusion-mistakes-microsoft-defender-antivirus.md at public · MicrosoftDocs/defender-docs https://github.com/MicrosoftDocs/defender-docs/blob/public/defender-endpoint/common-exclusion-mistakes-microsoft-defender-antivirus.md
[13] Malicious npm packages abuse dependency confusion to ... https://www.microsoft.com/en-us/security/blog/2026/05/29/33-malicious-npm-packages-abuse-dependency-confusion-profile-developer-environments/
[14] Оптимизация Windows 11 без программ! Часть 1 - Начинающий уровень https://www.youtube.com/watch?v=sJSXM8Q_U5w
[15] Полная оптимизация Windows 11 за час это самая быстрая настройка системы от статтеров и микрофризов https://rutube.ru/video/345dd6418f9bd07c56b292e67f3e1ed4/
[16] Чистый способ установки Windows 11 без дополнительного программного обеспечения или раздражающих приложений https://www.a7la-home.com/ru/how-to-install-windows-11-without-bloatware/
[17] Как оптимизировать Windows 11 на максимум: полное руководство 2024 https://www.tecnoloblog.com/ru/%D0%BA%D0%B0%D0%BA-%D0%BE%D0%BF%D1%82%D0%B8%D0%BC%D0%B8%D0%B7%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D1%82%D1%8C-%D0%B2%D0%B8%D0%BD%D0%B4%D0%BE%D0%B2%D1%81-11/
[18] Как ускорить Windows 11 и сделать ее более оптимизированной https://habr.com/ru/articles/960612/
[19] Оптимизация Windows 11: настройка для максимальной производительности Виндовс 11, отключение ненужных служб, как ускорить систему на ноутбуке и компьютере, оптимизировать параметры быстродействия и повысить скорость работы https://help-komp.ru/optimizaciya-windows-11
[20] Как установить чистую Windows 11 без мусора - Кейсофт https://keysoft.store/news/kak-ustanovit-chistuyu-windows-11
[21] Настройка Windows 11 для ускорения ПК за счет компромиссов ... https://techtoday.in.ua/ru/tips-ru/nastrojka-windows-11-dlya-uskorenyya-pk-za-schet-kompromyssov-bezopasnosty-193328.html
[22] Как включить максимальную производительность Windows 11 https://www.youtube.com/watch?v=Ef8InDwu1WM
[23] Как оптимизировать Windows 11 для максимальной ... https://usnotebook.ru/kak-optimizirovat-windows-11-dlya-maksimalnoy-proizvoditelnosti-na-novom-noutbuke.html
[24] Verwendung von WinGet zur Installation und Verwaltung ... https://learn.microsoft.com/de-de/windows/package-manager/winget/
[25] WinGet https://learn.microsoft.com/en-us/windows/package-manager/
[26] 시작 부스트에 대한 도움말 보기 - Microsoft Support https://support.microsoft.com/ko-kr/edge/get-help-with-startup-boost
[27] WebView2 in WinForms apps - Microsoft Edge Developer documentation https://learn.microsoft.com/en-us/microsoft-edge/webview2/platforms/winforms
[28] Introduction to Microsoft Edge WebView2 - Microsoft Edge Developer documentation https://learn.microsoft.com/en-us/microsoft-edge/webview2/
[29] Установка и обновление установщика приложений - MSIX https://learn.microsoft.com/ru-ru/windows/msix/app-installer/install-update-app-installer
[30] How to Update Microsoft Store or install App installer Manually (not ... https://learn.microsoft.com/en-au/answers/questions/5625424/how-to-update-microsoft-store-or-install-app-insta
