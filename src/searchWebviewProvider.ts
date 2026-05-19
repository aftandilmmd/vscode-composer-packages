import * as vscode from "vscode";
import { searchPackages, getPackageInfo, getPopularPackages, getPackageReadme, PackagistPackage } from "./packagistApi";
import { installPackage } from "./composerInstaller";

export class SearchWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "packagistSearch";

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    // Load popular packages on open
    getPopularPackages()
      .then((result) => {
        webviewView.webview.postMessage({ type: "exploreData", packages: result.packages, nextUrl: result.next });
      })
      .catch(() => {
        webviewView.webview.postMessage({ type: "exploreError" });
      });

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "search": {
          try {
            const result = await searchPackages(message.query, message.page ?? 1);
            webviewView.webview.postMessage({ type: "searchResults", data: result });
          } catch {
            webviewView.webview.postMessage({ type: "error", message: "Search failed." });
          }
          break;
        }
        case "openPackage": {
          const panel = vscode.window.createWebviewPanel(
            "packagistPackage",
            message.name,
            vscode.ViewColumn.One,
            { enableScripts: true }
          );
          try {
            const info = await getPackageInfo(message.name);
            const readme = await getPackageReadme(info.repository);
            panel.webview.html = getPackageDetailHtml(info, readme ?? "");
            panel.webview.onDidReceiveMessage(async (msg) => {
              if (msg.type === "install") {
                await installPackage(msg.name);
              } else if (msg.type === "openExternal") {
                vscode.env.openExternal(vscode.Uri.parse(msg.url));
              }
            });
          } catch {
            panel.webview.html = `<body style="font-family:sans-serif;padding:20px">Failed to load package info.</body>`;
          }
          break;
        }
        case "loadMore": {
          try {
            const result = await getPopularPackages(message.nextUrl);
            webviewView.webview.postMessage({ type: "moreData", packages: result.packages, nextUrl: result.next });
          } catch {
            webviewView.webview.postMessage({ type: "moreError" });
          }
          break;
        }
        case "loadMoreSearch": {
          try {
            const result = await searchPackages(message.query, message.page);
            webviewView.webview.postMessage({ type: "moreSearchResults", data: result });
          } catch {
            webviewView.webview.postMessage({ type: "error", message: "Search failed." });
          }
          break;
        }
        case "openExternal": {
          vscode.env.openExternal(vscode.Uri.parse(message.url));
          break;
        }
        case "install": {
          await installPackage(message.name);
          break;
        }
      }
    });
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); padding: 10px 8px; }

    #search-box { display: flex; gap: 6px; margin-bottom: 12px; }
    #query-wrap { flex: 1; position: relative; display: flex; align-items: center; }
    #query { width: 100%; padding: 6px 28px 6px 10px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 6px; font-size: 12px; outline: none; transition: border-color 0.15s; }
    #query:focus { border-color: var(--vscode-focusBorder); }
    #clear-btn { position: absolute; right: 6px; background: none; border: none; cursor: pointer; color: var(--vscode-descriptionForeground); padding: 0; line-height: 1; display: none; }
    #clear-btn:hover { color: var(--vscode-foreground); }
    #search-btn { padding: 6px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; }
    #search-btn:hover { background: var(--vscode-button-hoverBackground); }
    #sort-bar { display: none; align-items: center; gap: 6px; margin-bottom: 8px; }
    #sort-bar label { font-size: 10px; color: var(--vscode-descriptionForeground); white-space: nowrap; }
    #sort-select { flex: 1; padding: 3px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 4px; font-size: 11px; outline: none; cursor: pointer; }

    .section-title { font-size: 10px; font-weight: 700; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.8px; margin: 4px 2px 8px; }

    .package { display: flex; gap: 10px; align-items: flex-start; padding: 10px; margin-bottom: 4px; background: var(--vscode-editor-background, var(--vscode-list-inactiveSelectionBackground)); border-radius: 8px; cursor: pointer; border: 1px solid var(--vscode-widget-border, transparent); transition: border-color 0.12s, background 0.12s; }
    .package:hover { border-color: var(--vscode-focusBorder); background: var(--vscode-list-hoverBackground); }

    .pkg-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--vscode-button-background); color: var(--vscode-button-foreground); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; opacity: 0.85; user-select: none; }

    .pkg-body { flex: 1; min-width: 0; }
    .pkg-header { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
    .pkg-name { font-weight: 600; font-size: 12px; color: var(--vscode-textLink-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pkg-vendor { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 1px; }
    .pkg-desc { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.4; }
    .pkg-footer { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
    .pkg-badge { font-size: 10px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 3px; }
    .pkg-badge svg { opacity: 0.7; }
    .spacer { flex: 1; }
    .install-btn { padding: 3px 9px; font-size: 10px; font-weight: 500; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; opacity: 0; transition: opacity 0.12s; white-space: nowrap; }
    .package:hover .install-btn { opacity: 1; }
    .install-btn:hover { background: var(--vscode-button-hoverBackground); }

    .pkg-link { flex-shrink: 0; opacity: 0; background: none; border: none; padding: 2px; cursor: pointer; color: var(--vscode-textLink-foreground); line-height: 1; border-radius: 3px; transition: opacity 0.12s; }
    .package:hover .pkg-link { opacity: 0.6; }
    .pkg-link:hover { opacity: 1 !important; }

    #status { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; padding: 0 2px; }
    .sentinel { height: 1px; }
    .loading-more { text-align: center; font-size: 11px; color: var(--vscode-descriptionForeground); padding: 8px 0; }

    #explore { display: block; }
    #search-view { display: none; }
  </style>
</head>
<body>
  <div id="search-box">
    <div id="query-wrap">
      <input id="query" type="text" placeholder="Search packages..." />
      <button id="clear-btn" title="Clear">&#x2715;</button>
    </div>
    <button id="search-btn">Search</button>
  </div>
  <div id="explore">
    <div id="explore-status" class="section-title">Loading...</div>
    <div id="popular-section" style="display:none">
      <div class="section-title">⭐ Popular Packages</div>
      <div id="popular-list"></div>
    </div>
  </div>
  <div id="search-view">
    <div id="sort-bar">
      <label>Sort by</label>
      <select id="sort-select">
        <option value="relevance">Relevance</option>
        <option value="downloads">Install Count</option>
        <option value="favers">Rating</option>
        <option value="name">Name</option>
      </select>
    </div>
    <div id="status"></div>
    <div id="results"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let currentQuery = '';
    let currentPage = 1;
    let totalResults = 0;
    let searchLoading = false;
    let exploreNextUrl = null;
    let exploreLoading = false;
    let allSearchResults = [];
    let currentSort = 'relevance';

    let debounceTimer = null;

    document.getElementById('search-btn').addEventListener('click', () => doSearch());
    document.getElementById('query').addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(debounceTimer); doSearch(); }
    });
    document.getElementById('query').addEventListener('input', () => {
      const q = document.getElementById('query').value;
      document.getElementById('clear-btn').style.display = q ? 'block' : 'none';
      clearTimeout(debounceTimer);
      if (!q) {
        document.getElementById('explore').style.display = 'block';
        document.getElementById('search-view').style.display = 'none';
        document.getElementById('results').innerHTML = '';
        return;
      }
      debounceTimer = setTimeout(() => doSearch(), 400);
    });
    document.getElementById('clear-btn').addEventListener('click', () => {
      clearTimeout(debounceTimer);
      document.getElementById('query').value = '';
      document.getElementById('clear-btn').style.display = 'none';
      document.getElementById('explore').style.display = 'block';
      document.getElementById('search-view').style.display = 'none';
      document.getElementById('sort-bar').style.display = 'none';
      document.getElementById('results').innerHTML = '';
      allSearchResults = [];
    });

    document.getElementById('sort-select').addEventListener('change', () => {
      currentSort = document.getElementById('sort-select').value;
      renderSortedResults();
    });

    function showSearchView() {
      document.getElementById('explore').style.display = 'none';
      document.getElementById('search-view').style.display = 'block';
      document.getElementById('sort-bar').style.display = 'flex';
    }

    function sortResults(results) {
      if (currentSort === 'downloads') return [...results].sort((a, b) => b.downloads - a.downloads);
      if (currentSort === 'favers') return [...results].sort((a, b) => b.favers - a.favers);
      if (currentSort === 'name') return [...results].sort((a, b) => a.name.localeCompare(b.name));
      return results; // relevance — original order
    }

    function renderSortedResults() {
      const container = document.getElementById('results');
      container.innerHTML = '';
      const sorted = sortResults(allSearchResults);
      sorted.forEach(pkg => container.appendChild(buildPackageCard(pkg)));
      attachSearchSentinel();
    }

    function doSearch() {
      const q = document.getElementById('query').value.trim();
      if (!q) return;
      currentQuery = q;
      currentPage = 1;
      totalResults = 0;
      searchLoading = false;
      allSearchResults = [];
      showSearchView();
      document.getElementById('status').textContent = 'Searching...';
      document.getElementById('results').innerHTML = '';
      vscode.postMessage({ type: 'search', query: q, page: 1 });
    }

    // Sentinel for explore (popular) list
    function attachExploreSentinel() {
      const old = document.getElementById('explore-sentinel');
      if (old) old.remove();
      if (!exploreNextUrl) return;
      const sentinel = document.createElement('div');
      sentinel.id = 'explore-sentinel';
      sentinel.className = 'sentinel';
      document.getElementById('popular-list').appendChild(sentinel);
      const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && exploreNextUrl && !exploreLoading) {
          exploreLoading = true;
          vscode.postMessage({ type: 'loadMore', nextUrl: exploreNextUrl });
          observer.disconnect();
        }
      }, { rootMargin: '100px' });
      observer.observe(sentinel);
    }

    // Sentinel for search results
    function attachSearchSentinel() {
      const old = document.getElementById('search-sentinel');
      if (old) old.remove();
      const loaded = currentPage * 20;
      if (loaded >= totalResults) return;
      const sentinel = document.createElement('div');
      sentinel.id = 'search-sentinel';
      sentinel.className = 'sentinel';
      document.getElementById('results').appendChild(sentinel);
      const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !searchLoading) {
          searchLoading = true;
          currentPage++;
          vscode.postMessage({ type: 'loadMoreSearch', query: currentQuery, page: currentPage });
          observer.disconnect();
        }
      }, { rootMargin: '100px' });
      observer.observe(sentinel);
    }

    function fmtNum(n) {
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return String(n);
    }

    const SVG_NS = 'http://www.w3.org/2000/svg';
    function makeSvgPath(viewBox, ...pathDs) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('width', '11'); svg.setAttribute('height', '11');
      svg.setAttribute('viewBox', viewBox); svg.setAttribute('fill', 'currentColor');
      pathDs.forEach(d => {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', d); svg.appendChild(p);
      });
      return svg;
    }

    function makeBadge(svg, text) {
      const span = document.createElement('span');
      span.className = 'pkg-badge';
      span.appendChild(svg);
      span.appendChild(document.createTextNode(' ' + text));
      return span;
    }

    const AVATAR_COLORS = [
      '#4e9bf5','#e06c75','#56b6c2','#98c379','#c678dd','#e5c07b','#61afef','#d19a66'
    ];
    function avatarColor(name) {
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
      return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
    }

    function buildPackageCard(pkg) {
      const parts = pkg.name.split('/');
      const vendor = parts[0] || '';
      const pkgShort = parts[1] || pkg.name;
      const letter = vendor.charAt(0).toUpperCase();
      const color = avatarColor(vendor);

      const div = document.createElement('div');
      div.className = 'package';

      // Avatar
      const avatar = document.createElement('div');
      avatar.className = 'pkg-avatar';
      avatar.textContent = letter;
      avatar.style.background = color;

      // Body
      const body = document.createElement('div');
      body.className = 'pkg-body';

      // Header row: name + link icon
      const headerEl = document.createElement('div');
      headerEl.className = 'pkg-header';

      const nameEl = document.createElement('div');
      nameEl.className = 'pkg-name';
      nameEl.textContent = pkg.name;
      nameEl.title = pkg.name;

      const linkBtn = document.createElement('button');
      linkBtn.className = 'pkg-link';
      linkBtn.title = 'Open on Packagist';
      linkBtn.dataset.url = pkg.url;
      linkBtn.appendChild(makeSvgPath('0 0 16 16',
        'M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z',
        'M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z'
      ));

      headerEl.appendChild(nameEl);
      headerEl.appendChild(linkBtn);

      // Description
      const descEl = document.createElement('div');
      descEl.className = 'pkg-desc';
      descEl.textContent = pkg.description || '';

      // Footer: stats + install btn
      const footer = document.createElement('div');
      footer.className = 'pkg-footer';

      const dlBadge = makeBadge(
        makeSvgPath('0 0 16 16',
          'M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z',
          'M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z'
        ), fmtNum(pkg.downloads)
      );

      const starBadge = makeBadge(
        makeSvgPath('0 0 16 16',
          'M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z'
        ), fmtNum(pkg.favers)
      );

      const spacer = document.createElement('span');
      spacer.className = 'spacer';

      const installBtn = document.createElement('button');
      installBtn.className = 'install-btn';
      installBtn.textContent = '+ Install';
      installBtn.dataset.name = pkg.name;

      footer.appendChild(dlBadge);
      footer.appendChild(starBadge);
      footer.appendChild(spacer);
      footer.appendChild(installBtn);

      body.appendChild(headerEl);
      body.appendChild(descEl);
      body.appendChild(footer);

      div.appendChild(avatar);
      div.appendChild(body);

      div.addEventListener('click', ev => {
        if (ev.target.closest('.pkg-link')) {
          const url = ev.target.closest('.pkg-link').dataset.url;
          vscode.postMessage({ type: 'openExternal', url });
        } else if (ev.target.closest('.install-btn')) {
          vscode.postMessage({ type: 'install', name: ev.target.closest('.install-btn').dataset.name });
        } else {
          vscode.postMessage({ type: 'openPackage', name: pkg.name });
        }
      });
      return div;
    }

    window.addEventListener('message', e => {
      const msg = e.data;
      if (msg.type === 'exploreData') {
        document.getElementById('explore-status').style.display = 'none';
        const popularList = document.getElementById('popular-list');
        msg.packages.forEach(pkg => popularList.appendChild(buildPackageCard(pkg)));
        document.getElementById('popular-section').style.display = 'block';
        exploreNextUrl = msg.nextUrl || null;
        exploreLoading = false;
        attachExploreSentinel();
      } else if (msg.type === 'moreData') {
        const popularList = document.getElementById('popular-list');
        msg.packages.forEach(pkg => popularList.appendChild(buildPackageCard(pkg)));
        exploreNextUrl = msg.nextUrl || null;
        exploreLoading = false;
        attachExploreSentinel();
      } else if (msg.type === 'exploreError') {
        document.getElementById('explore-status').textContent = 'Failed to load packages.';
      } else if (msg.type === 'searchResults') {
        totalResults = msg.data.total;
        document.getElementById('status').textContent = totalResults + ' packages found';
        allSearchResults = msg.data.results;
        searchLoading = false;
        renderSortedResults();
      } else if (msg.type === 'moreSearchResults') {
        allSearchResults = allSearchResults.concat(msg.data.results);
        searchLoading = false;
        renderSortedResults();
      } else if (msg.type === 'error') {
        document.getElementById('status').textContent = msg.message;
      }
    });

    function esc(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
  </script>
</body>
</html>`;
  }
}

function renderMarkdown(md: string): string {
  // Strip HTML tags first, keep inner text
  let text = md.replace(/<[^>]+>/g, "");

  // Fenced code blocks (extract before escaping)
  const codeBlocks: string[] = [];
  text = text.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(code);
    return `\x00CODE${codeBlocks.length - 1}\x00`;
  });

  // Escape remaining text
  let html = esc(text);

  // Restore code blocks
  html = html.replace(/\x00CODE(\d+)\x00/g, (_, i) =>
    `<pre><code>${esc(codeBlocks[Number(i)])}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Headings
  html = html.replace(/^#{6}\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#{5}\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#{4}\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^#{3}\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^#{2}\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#{1}\s+(.+)$/gm, "<h1>$1</h1>");
  // Bold / italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Images — strip
  html = html.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="#">$1</a>');
  // Blockquote
  html = html.replace(/^&gt;\s*(.+)$/gm, "<blockquote>$1</blockquote>");
  // Unordered list items
  html = html.replace(/^\s*[-*+]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
  // Horizontal rule
  html = html.replace(/^[-*_]{3,}$/gm, "<hr>");
  // Paragraphs
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (/^<(h[1-6]|pre|ul|blockquote|hr|li)/.test(trimmed)) { return trimmed; }
      if (!trimmed) { return ""; }
      return `<p>${trimmed.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");

  return html;
}

function getPackageDetailHtml(
  info: {
    name: string;
    description: string;
    latestVersion: string;
    downloads: number;
    favers: number;
    repository: string;
    url: string;
  },
  readme: string
): string {
  const nonce = getNonce();
  const readmeHtml = readme ? renderMarkdown(readme) : "<p>No README available.</p>";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    * { box-sizing: border-box; }
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 0; }
    .header { padding: 16px 20px; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-panel-border); }
    .pkg-name { font-size: 18px; font-weight: 700; color: var(--vscode-textLink-foreground); }
    .pkg-meta { display: flex; gap: 16px; margin-top: 6px; font-size: 11px; color: var(--vscode-descriptionForeground); }
    .pkg-desc { font-size: 12px; margin-top: 6px; }
    .btn-row { display: flex; gap: 8px; margin-top: 12px; }
    .install-btn { padding: 6px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; cursor: pointer; font-size: 12px; }
    .install-btn:hover { background: var(--vscode-button-hoverBackground); }
    .require-box { margin-top: 10px; font-size: 11px; background: var(--vscode-textCodeBlock-background, #1e1e1e); padding: 6px 10px; border-radius: 3px; font-family: var(--vscode-editor-font-family, monospace); color: var(--vscode-textPreformat-foreground); }
    .readme { padding: 20px; max-width: 860px; line-height: 1.6; }
    .readme h1 { font-size: 1.6em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 6px; margin-top: 20px; }
    .readme h2 { font-size: 1.3em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; margin-top: 18px; }
    .readme h3 { font-size: 1.1em; margin-top: 14px; }
    .readme h4, .readme h5, .readme h6 { margin-top: 12px; }
    .readme pre { background: var(--vscode-textCodeBlock-background, #1e1e1e); padding: 12px 16px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
    .readme code { background: var(--vscode-textCodeBlock-background, #1e1e1e); padding: 1px 5px; border-radius: 3px; font-size: 12px; font-family: var(--vscode-editor-font-family, monospace); }
    .readme pre code { background: none; padding: 0; }
    .readme blockquote { border-left: 3px solid var(--vscode-textLink-foreground); margin: 0; padding-left: 12px; color: var(--vscode-descriptionForeground); }
    .readme ul { padding-left: 20px; }
    .readme a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    .readme hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 16px 0; }
    .readme p { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div class="pkg-name">${esc(info.name)}</div>
    <div class="pkg-meta">
      <span>v${esc(info.latestVersion)}</span>
      <span>⬇ ${fmtNum(info.downloads)}</span>
      <span>★ ${fmtNum(info.favers)}</span>
    </div>
    <div class="pkg-desc">${esc(info.description)}</div>
    <div class="require-box">composer require ${esc(info.name)}</div>
    <div class="btn-row">
      <button class="install-btn" id="install-btn">Install via Composer</button>
    </div>
  </div>
  <div class="readme">${readmeHtml}</div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('install-btn').addEventListener('click', () => {
      vscode.postMessage({ type: 'install', name: '${esc(info.name)}' });
    });
  </script>
</body>
</html>`;
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
