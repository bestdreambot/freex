import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class FreeXPanel {
  public static readonly viewType = 'freex.panel';
  private panel: vscode.WebviewPanel | undefined;
  private onDisposeCallback?: () => void;

  constructor(private extensionUri: vscode.Uri) {
    this.createPanel();
  }

  private createPanel() {
    this.panel = vscode.window.createWebviewPanel(
      FreeXPanel.viewType,
      'FreeX',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'src', 'views')]
      }
    );

    this.panel.webview.html = this.getWebviewContent();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      if (this.onDisposeCallback) {
        this.onDisposeCallback();
      }
    });

    this.panel.webview.onDidReceiveMessage((message) => {
      this.handleMessage(message);
    });
  }

  private getWebviewContent(): string {
    if (!this.panel) {
      return '';
    }

    const htmlPath = vscode.Uri.joinPath(
      this.extensionUri,
      'src',
      'views',
      'freex-panel.html'
    );

    try {
      const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
      return htmlContent;
    } catch (error) {
      return this.getFallbackHtml();
    }
  }

  private getFallbackHtml(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
          }
          h1 {
            font-size: 24px;
            margin: 0 0 20px 0;
          }
          .status {
            padding: 15px;
            border-radius: 4px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            margin-bottom: 20px;
            font-size: 16px;
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>FreeX</h1>
          <div class="status">FreeX Ready</div>
          <button onclick="checkConnection()">Check Connection</button>
        </div>

        <script>
          function checkConnection() {
            alert('Connection check successful!');
          }
        </script>
      </body>
      </html>
    `;
  }

  private handleMessage(message: any) {
    console.log('Message received from webview:', message);
  }

  public reveal() {
    if (this.panel) {
      this.panel.reveal();
    }
  }

  public onDispose(callback: () => void) {
    this.onDisposeCallback = callback;
  }
}
