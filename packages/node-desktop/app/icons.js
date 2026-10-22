// Browser-only, bundled icons. No fonts, network requests, or runtime dependency.
const paths = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  apps: '<rect x="8" y="3" width="8" height="6" rx="1"/><path d="M12 9v5M5 14h14M5 14v3m14-3v3"/><rect x="2" y="17" width="6" height="4" rx="1"/><rect x="16" y="17" width="6" height="4" rx="1"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  laptop: '<rect x="5" y="3" width="14" height="12" rx="1"/><path d="m5 15-3 5h20l-3-5"/>',
  ai: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>',
  settings: '<path d="M3 6h18M3 12h18M3 18h18"/><path d="M8 3v6m8 0v6M9 15v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  app: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/>'
}

export function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.app}</svg>`
}
