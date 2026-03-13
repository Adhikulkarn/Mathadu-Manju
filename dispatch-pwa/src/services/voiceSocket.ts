let socket: WebSocket | null = null
let audioHandler: ((data: ArrayBuffer) => void) | null = null
let statusHandler: ((connected: boolean) => void) | null = null

export function connectVoice(
  onAudio: (data: ArrayBuffer) => void,
  onStatusChange?: (connected: boolean) => void
) {
  audioHandler = onAudio
  statusHandler = onStatusChange ?? null

  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return socket
  }

  socket = new WebSocket("ws://localhost:4000")
  socket.binaryType = "arraybuffer"

  socket.onopen = () => {
    console.log("Voice socket connected")
    statusHandler?.(true)
  }

  socket.onerror = (error) => {
    console.error("WebSocket error", error)
  }

  socket.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      audioHandler?.(event.data)
      return
    }

    if (event.data instanceof Blob) {
      void event.data.arrayBuffer().then((data) => {
        audioHandler?.(data)
      })
    }
  }

  socket.onclose = () => {
    console.log("Voice socket closed")
    statusHandler?.(false)
    socket = null
  }

  return socket
}

export function sendAudio(data: Blob) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(data)
  }
}

export function disconnectVoice() {
  if (socket && socket.readyState <= WebSocket.OPEN) {
    socket.close()
  }

  socket = null
  audioHandler = null
  statusHandler = null
}
