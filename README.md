# Composer Packages

Browse, search, and install [Packagist](https://packagist.org) packages directly from the VS Code sidebar — without leaving your editor.

![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue?logo=visual-studio-code)
![License](https://img.shields.io/github/license/aftandilmmd/vscode-composer-packages)

---

## Features

- **Browse popular packages** — Opens with a curated list of the most downloaded Packagist packages, with infinite scroll
- **Search** — Find any package by name or keyword; results load incrementally as you scroll
- **Package details** — Click any package to open a detail panel with version, download stats, and rendered README
- **Install via Composer** — Run `composer require` for any package directly from the extension
- **Open on Packagist** — Jump to the package's Packagist page in your browser with one click

## Installation

### From VS Code Marketplace

1. Open the **Extensions** view (`Ctrl+Shift+X`)
2. Search for **Composer Packages**
3. Click **Install**

### From VSIX

```bash
code --install-extension composer-packages-*.vsix
```

## Usage

1. Click the **Composer** icon in the Activity Bar
2. The sidebar loads popular packages automatically
3. Use the search box to find a specific package
4. Click a package card to view its README and details
5. Click **+ Install** to run `composer require <package>` in your workspace terminal
6. Click the link icon (↗) on any card to open the Packagist page in your browser

## Requirements

- VS Code `1.85` or later
- [Composer](https://getcomposer.org) installed and available in your `PATH` (required for the install feature)

## Extension Settings

This extension has no configurable settings.

## Known Limitations

- README rendering supports basic Markdown only (no HTML or images)
- Packages hosted outside GitHub (GitLab, Bitbucket, etc.) will not show a README in the detail panel

## Contributing

1. Fork the repository
2. Clone and install dependencies:
   ```bash
   git clone https://github.com/aftandilmmd/vscode-composer-packages
   cd vscode-composer-packages
   npm install
   ```
3. Open in VS Code and press `F5` to launch the Extension Development Host
4. Make your changes, then open a pull request

## Author

Made by [Aftandil MMD](https://github.com/aftandilmmd)

## License

[MIT](LICENSE)
