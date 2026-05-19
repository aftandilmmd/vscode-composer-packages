import * as vscode from "vscode";
import { SearchWebviewProvider } from "./searchWebviewProvider";
import { installPackage } from "./composerInstaller";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new SearchWebviewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SearchWebviewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("packagist.installPackage", async () => {
      const input = await vscode.window.showInputBox({
        prompt: "Enter package name (e.g. vendor/package)",
        placeHolder: "vendor/package",
      });
      if (input) {
        await installPackage(input.trim());
      }
    })
  );
}

export function deactivate(): void {}
