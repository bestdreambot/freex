# FreeX VS Code Extension

Personal work continuation system integrated into VS Code.

## Version

v0.1.0 (Stage 1: Foundation)

## Features

### Stage 1 (Current)
- ✅ Webview panel "FreeX" 
- ✅ Command `FreeX: Open Panel`
- ✅ Status indicator
- ✅ Connection check button

### Stage 2 (Planned)
- 🔲 DeepSeek integration
- 🔲 Secure API key storage
- 🔲 First message capability

### Stage 3 (Planned)
- 🔲 Conference mode
- 🔲 Memory system
- 🔲 Multi-provider support

## Installation (Development)

### Prerequisites
- Node.js 16+
- npm

### Steps

1. Navigate to extension directory:
```bash
cd c:\Users\Андрей\Freex\freex\freex-vscode-extension
```

2. Install dependencies:
```bash
npm install
```

3. Compile TypeScript:
```bash
npm run compile
```

4. Package as .vsix:
```bash
npm run vscode:prepublish
npx vsce package
```

5. Install in VS Code:
- Open VS Code
- Go to Extensions → Install from VSIX
- Select `freex-0.1.0.vsix`

## Usage

### Open FreeX Panel
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
2. Type: `FreeX: Open Panel`
3. Press Enter

Panel opens in sidebar next to Chat and Claude Code.

## Development

### Compile in Watch Mode
```bash
npm run watch
```

### Run Extension in Debug Mode
- Press `F5` in VS Code (in the extension directory)
- New VS Code window opens with extension active

### Structure
```
src/
├── extension.ts       # Entry point
├── webview.ts        # Webview panel management
└── views/
    └── freex-panel.html  # UI
```

## Building .vsix

### One-time build:
```bash
npm run vscode:prepublish && npx vsce package
```

Output: `freex-0.1.0.vsix`

### Install from file:
1. VS Code → Extensions → `...` → Install from VSIX
2. Select the `.vsix` file
3. Reload VS Code

## Notes

- Extension is part of FreeX repository
- Stored in `freex-vscode-extension/`
- Independent from main FreeX web app
- Can be published to VS Code Marketplace later
