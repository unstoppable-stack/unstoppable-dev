import { isAbsolute, relative, resolve, sep } from 'node:path'

export const APP_SCHEME = 'unstoppable-node'
export const APP_HOST = 'app'
export const APP_ENTRY_URL = `${APP_SCHEME}://${APP_HOST}/index.html`

export function resolveAppRequest (requestUrl, appRoot) {
  // WHATWG URL parsing normalizes encoded dot segments before exposing the
  // pathname. Reject them up front so traversal attempts never become valid
  // in-root URLs through normalization.
  if (/%2e/i.test(requestUrl)) throw new Error('Application path escapes its root')
  const url = new URL(requestUrl)
  if (url.protocol !== `${APP_SCHEME}:` || url.hostname !== APP_HOST) {
    throw new Error('Untrusted application URL')
  }

  const pathname = decodeURIComponent(url.pathname)
  if (pathname.includes('\0')) throw new Error('Invalid application path')
  const root = resolve(appRoot)
  const target = resolve(root, `.${pathname}`)
  const fromRoot = relative(root, target)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error('Application path escapes its root')
  }
  return target
}
