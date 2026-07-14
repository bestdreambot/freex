import * as vscode from 'vscode';
import { FreeXPanel } from './webview';

let freeXPanel: FreeXPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('FreeX extension activated');

  const openPanelCommand = vscode.commands.registerCommand(
    'freex.openPanel',
    () => {
      if (freeXPanel) {
        freeXPanel.reveal();
      } else {
        freeXPanel = new FreeXPanel(context.extensionUri);
        freeXPanel.onDispose(() => {
          freeXPanel = undefined;
        });
      }
    }
  );

  context.subscriptions.push(openPanelCommand);
}

export function deactivate() {
  console.log('FreeX extension deactivated');
}
