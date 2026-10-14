// The homepage and installed Platform use this same release manifest.
function selectDesktopRelease(value) {
  if (!value || value.schemaVersion !== 1 || value.product !== 'platform' || value.channel !== 'preview' ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version) ||
      value.releaseId !== 'platform-preview-' + value.version || !Array.isArray(value.artifacts)) return null;
  const artifacts = {};
  for (const item of value.artifacts) {
    const key = item.platform + '-' + item.arch;
    if (!['win32-x64', 'darwin-arm64', 'darwin-x64'].includes(key) || artifacts[key]) return null;
    const suffix = item.platform === 'win32' ? '.exe' : '.dmg';
    let url;
    try { url = new URL(item.url); } catch { return null; }
    if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash ||
        !url.pathname.startsWith('/unmet23-lab/synk-policy/releases/download/' + value.releaseId + '/') ||
        !/^SYNK-Platform-Preview-[\d.]+-[A-Za-z0-9-]+\.(exe|dmg)$/.test(url.pathname.split('/').pop()) ||
        !url.pathname.endsWith(suffix) || !Number.isSafeInteger(item.bytes) || item.bytes <= 0 ||
        !/^[a-f0-9]{64}$/.test(item.sha256) || !/^[a-f0-9]{64}$/.test(item.asarSHA256)) return null;
    artifacts[key] = item.url;
  }
  if (Object.keys(artifacts).length !== 3) return null;
  return { version: value.version, releaseId: value.releaseId, artifacts,
    releaseUrl: 'https://github.com/unmet23-lab/synk-policy/releases/tag/' + value.releaseId };
}

async function refreshDesktopReleaseLinks() {
  if (!document.querySelector('[data-platform-downloads]')) return;
  try {
    const response = await fetch('/desktop/releases/preview.json', {cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000)});
    if (!response.ok) return;
    const text = await response.text();
    if (text.length > 65536) return;
    const release = selectDesktopRelease(JSON.parse(text));
    if (!release) return; // Offline or invalid feed keeps the checked links in the HTML.
    const section = document.getElementById('platform');
    const current = section?.dataset.platformVersion;
    if (current && /^\d+\.\d+\.\d+$/.test(current)) {
      const a = release.version.split('.').map(Number), b = current.split('.').map(Number);
      const difference = a.map((part, index) => part - b[index]).find(value => value !== 0) || 0;
      if (difference < 0) return; // A lagging CDN response must not downgrade newer HTML.
    }
    const roots = [document, ...document.querySelectorAll('template')].map(root => root.content || root);
    for (const root of roots) {
      for (const link of root.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href');
        if (!href.startsWith('https://github.com/unmet23-lab/synk-policy/releases/')) continue;
        let key;
        if (/SYNK-Platform-Preview-.*-win-x64\.exe$/.test(href)) key = 'win32-x64';
        if (/SYNK-Platform-Preview-.*-mac-arm64\.dmg$/.test(href)) key = 'darwin-arm64';
        if (/SYNK-Platform-Preview-.*-mac-x64\.dmg$/.test(href)) key = 'darwin-x64';
        if (key) link.href = release.artifacts[key];
        else if (/\/releases\/tag\/platform-preview-/.test(href)) link.href = release.releaseUrl;
      }
    }
    document.querySelectorAll('[data-platform-release]').forEach(el => { el.textContent = 'Preview ' + release.version; });
    if (section) {
      const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) walker.currentNode.textContent = walker.currentNode.textContent.replace(/Preview \d+\.\d+\.\d+/g, 'Preview ' + release.version);
      section.dataset.platformVersion = release.version;
    }
  } catch { /* Keep the last published, working download links. */ }
}
if (typeof document !== 'undefined') void refreshDesktopReleaseLinks();
