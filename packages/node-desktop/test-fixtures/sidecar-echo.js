let buffer = ''

Bare.IPC.on('data', (data) => {
  buffer += data.toString()
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''

  for (const line of lines) {
    if (!line.trim()) continue
    const message = JSON.parse(line)
    if (message.type === 'shutdown') Bare.exit()
    else Bare.IPC.write(JSON.stringify(message) + '\n')
  }
})
