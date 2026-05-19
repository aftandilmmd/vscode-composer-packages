import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function hasArtisanCommand(root: string, publishTag?: string): boolean {
  return fs.existsSync(path.join(root, "artisan"));
}

function detectPublishTag(packageName: string): string | undefined {
  // Common Laravel packages that need vendor:publish
  const known: Record<string, string> = {
    "laravel/sanctum": "sanctum",
    "laravel/passport": "passport",
    "laravel/horizon": "horizon",
    "laravel/telescope": "telescope",
    "laravel/cashier": "cashier",
    "spatie/laravel-permission": "permission",
    "spatie/laravel-medialibrary": "medialibrary",
    "barryvdh/laravel-debugbar": "debugbar",
  };
  return known[packageName];
}

export async function installPackage(packageName: string): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  if (!fs.existsSync(path.join(root, "composer.json"))) {
    vscode.window.showErrorMessage("No composer.json found in workspace root.");
    return;
  }

  const terminal = vscode.window.createTerminal({
    name: `Packagist: ${packageName}`,
    cwd: root,
  });
  terminal.show();

  terminal.sendText(`composer require ${packageName}`);

  const isLaravel = hasArtisanCommand(root);
  if (isLaravel) {
    const tag = detectPublishTag(packageName);
    if (tag) {
      terminal.sendText(`php artisan vendor:publish --tag=${tag}`);
    } else {
      // Prompt user if they want to run vendor:publish
      const choice = await vscode.window.showInformationMessage(
        `${packageName} installed. Run php artisan vendor:publish?`,
        "Yes, run vendor:publish",
        "No"
      );
      if (choice === "Yes, run vendor:publish") {
        terminal.sendText(`php artisan vendor:publish --provider="${providerGuess(packageName)}"`);
      }
    }
  }
}

function providerGuess(packageName: string): string {
  const [vendor, pkg] = packageName.split("/");
  const vendorPascal = toPascal(vendor);
  const pkgPascal = toPascal(pkg.replace(/^laravel-/, "").replace(/-/g, "-"));
  return `${vendorPascal}\\${pkgPascal}\\${pkgPascal}ServiceProvider`;
}

function toPascal(str: string): string {
  return str
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}
