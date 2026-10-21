import { peerRows } from './render.js'

export function simpleHomeModel(status) {
  const apps = peerRows(status).map(row => {
    const resources = [...row.cores, ...row.drives]
    let state, title, detail
    if (row.quotaExceeded) {
      state = 'attention'; title = 'Storage limit reached'
      detail = status?.storage?.quotas?.global?.exceeded
        ? 'This computer’s total storage limit is reached. Check the storage settings in Advanced.'
        : 'Copying is paused. Increase the storage limit, then resume copying.'
    } else if (resources.some(resource => resource.protection?.state === 'error')) {
      state = 'attention'; title = 'Some data could not be copied'
      detail = 'Open Advanced to check the problem before trying again.'
    } else if (resources.some(resource => resource.paused)) {
      state = 'paused'; title = row.allPaused ? 'Copying is paused' : 'Some copying is paused'
      detail = 'Copies already on this computer remain available.'
    } else if (!resources.length) {
      state = 'empty'; title = 'No data shared yet'
      detail = 'Use the app to choose what it shares with this computer.'
    } else if (resources.every(resource => resource.protection?.mode === 'mirror' && resource.protection?.state === 'protected')) {
      state = 'copied'; title = 'Latest shared data copied'
      detail = row.online ? 'The last shared version is verified on this computer.' : 'This app is not connected. Its last shared data is still available here.'
    } else {
      state = 'waiting'; title = row.online ? 'Copying shared data' : 'Waiting for the app'
      detail = row.online ? 'Some shared data is not fully copied yet.' : 'Open the app and connect it to finish copying its shared data.'
      if (resources.every(resource => resource.protection?.mode === 'metadata-only')) {
        title = 'Full data copy not requested'
        detail = 'This app shares information about its data, but has not requested a full copy.'
      }
    }
    const copiedTimes = resources.map(resource => {
      const time = resource.protection?.caughtUpAt
      return typeof time === 'string' ? Date.parse(time) : time
    })
    return {
      ...row, state, title, detail,
      copiedAt: state === 'copied' && copiedTimes.every(time => Number.isFinite(time) && time > 0) ? Math.min(...copiedTimes) : null,
      canShare: (row.grants?.sync || []).includes('manifest.replace')
    }
  })
  const needsAttention = apps.some(app => app.state === 'attention') || !!status?.storage?.quotas?.global?.exceeded
  const title = !status ? 'Checking your apps…'
    : !apps.length ? 'A home for your apps’ shared data'
      : needsAttention ? 'Some apps need your attention'
        : apps.some(app => app.state === 'paused') ? 'Some copying is paused'
          : apps.every(app => app.state === 'copied') ? 'Your shared data is copied here'
            : 'Some shared data is not fully copied yet'
  return { apps, title, bytes: status?.storage?.total || 0, ai: status?.ai || {}, needsAttention }
}
