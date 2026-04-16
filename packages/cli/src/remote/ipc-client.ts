import { connect } from 'net'
import { existsSync, readFileSync } from 'fs'
import { getSockPath, getPidPath } from './daemon.js'

export function sendCommand(cmd: Record<string, unknown>, timeout = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const sock = connect(getSockPath())
    let buffer = ''
    const timer = setTimeout(() => {
      sock.destroy()
      reject(new Error('Daemon did not respond in time'))
    }, timeout)

    sock.on('connect', () => {
      sock.write(JSON.stringify(cmd) + '\n')
    })

    sock.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          clearTimeout(timer)
          const resp = JSON.parse(line)
          sock.destroy()
          resolve(resp)
        } catch {}
      }
    })

    sock.on('error', (err: any) => {
      clearTimeout(timer)
      if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
        reject(new Error('Daemon is not running. Start it with: us remote start'))
      } else {
        reject(err)
      }
    })
  })
}

export function isDaemonRunning(): boolean {
  try {
    const pidPath = getPidPath()
    if (!existsSync(pidPath)) return false
    const pid = parseInt(readFileSync(pidPath, 'utf-8'))
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
