import { escape, formatBytes } from './render.js'

const technicalField = key => /^(id|.*Id|schemaVersion|schema_version|source|sourceKey|source_key|publicKey|public_key|key|descriptor)$/.test(key)
const isObject = value => value && typeof value === 'object' && !Array.isArray(value)

function textHtml(value) {
  const text = String(value)
  if (text.includes('\uFFFD') || /[\x00-\x08]/.test(text)) return '<p>Preview unavailable for this format. Open it in its app.</p>'
  return `<p class="saved-text">${escape(text)}</p>`
}

function valueHtml(value, depth = 0) {
  if (depth > 6) return '<p>Open this item in its app to explore more.</p>'
  if (value === null) return '<span class="dim">Empty</span>'
  if (Array.isArray(value)) return value.length
    ? value.map(item => `<div class="saved-item">${valueHtml(item, depth + 1)}</div>`).join('')
    : '<p class="dim">No items</p>'
  if (isObject(value)) {
    return Object.entries(value).filter(([key]) => !technicalField(key)).map(([key, item]) => {
      const label = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ')
      return `<div class="saved-field"><strong>${escape(label)}</strong>${valueHtml(item, depth + 1)}</div>`
    }).join('')
  }
  return textHtml(value)
}

function recordCard(entry) {
  if (technicalField(entry.key)) return ''
  const value = entry.value
  if (isObject(value) && typeof value.title === 'string' && typeof value.body === 'string') {
    return `<article class="saved-item saved-note"><p class="saved-kind">Note</p><h3>${escape(value.title || 'Untitled note')}</h3>${textHtml(value.body)}</article>`
  }
  if (isObject(value) && Array.isArray(value.items) && value.items.every(item => isObject(item) && typeof item.title === 'string' && typeof item.excerpt === 'string')) {
    return `<article class="saved-item saved-report"><p class="saved-kind">Report · ${value.items.length} ${value.items.length === 1 ? 'note' : 'notes'}</p><h3>${escape(typeof value.title === 'string' && value.title ? value.title : 'Saved briefing')}</h3>${value.items.length ? value.items.map(item => `<section class="saved-excerpt"><h4>${escape(item.title || 'Untitled note')}</h4>${textHtml(item.excerpt)}</section>`).join('') : '<p class="dim">No notes in this report yet.</p>'}</article>`
  }
  const content = valueHtml(value)
  return content ? `<article class="saved-item"><p class="saved-kind">Saved item</p>${content}</article>` : ''
}

export function savedDataHtml(result, kind) {
  if (!result) return '<p>The saved data is not available yet. Try again after copying finishes.</p>'
  if (result.error) return `<p>${escape(result.error)}</p>`
  if (kind === 'drive') return '<p>Saved files (up to 50). File contents open in their app.</p>' +
    (result.entries?.map(entry => `<article class="saved-item"><strong>${escape(entry.key)}</strong><p>${entry.type === 'file' ? formatBytes(entry.size || 0) : 'Folder'}</p></article>`).join('') || '<p>No files saved yet.</p>')
  if (!result.entries) return '<p>This app uses a format that cannot be previewed here yet. Open the app to explore its data, or use the inspector in Advanced.</p>'
  const cards = result.entries.map(recordCard).join('')
  return '<p class="saved-intro">Your saved copy. Refresh to see newly synced changes.</p><div class="saved-cards">' +
    (cards || `<p>${result.entries.length ? 'Only technical information is saved here. You can inspect it in Advanced.' : 'No items saved yet.'}</p>`) + '</div>' +
    (result.more ? '<p>Showing a limited preview. Open the app to explore all its data.</p>' : '')
}
