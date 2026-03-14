let socket: WebSocket | null = null
let connectionId = 0

function getVoiceSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const host = window.location.hostname || "localhost"

  return `${protocol}//${host}:4000`
}

export function connectVoice(
  onAudio: (data: ArrayBuffer) => void,
  onStatusChange?: (connected: boolean) => void,
  sessionInit?: { role: "driver" | "manager"; driver_id?: string }
) {
  const statusHandler = onStatusChange ?? null
  const sessionPayload = sessionInit ? { type: "session_init", ...sessionInit } : null

  if (socket && socket.readyState <= WebSocket.OPEN) {
    disconnectVoice()
  }

  const nextSocket = new WebSocket(getVoiceSocketUrl())
  const nextConnectionId = ++connectionId
  nextSocket.binaryType = "arraybuffer"
  socket = nextSocket

  nextSocket.onopen = () => {
    if (connectionId !== nextConnectionId) {
      return
    }

    console.log("Voice socket connected")
    if (sessionPayload) {
      nextSocket.send(JSON.stringify(sessionPayload))
    }
    statusHandler?.(true)
  }

  nextSocket.onerror = (error) => {
    console.error("WebSocket error", error)
  }

  nextSocket.onmessage = (event) => {
    if (connectionId !== nextConnectionId) {
      return
    }

    if (event.data instanceof ArrayBuffer) {
      console.log("Received audio bytes:", event.data.byteLength)
      onAudio(event.data)
      return
    }

    if (event.data instanceof Blob) {
      void event.data.arrayBuffer().then((data) => {
        if (connectionId === nextConnectionId) {
          console.log("Received audio bytes:", data.byteLength)
          onAudio(data)
        }
      })
    }
  }

  nextSocket.onclose = () => {
    console.log("Voice socket closed")

    if (connectionId === nextConnectionId) {
      statusHandler?.(false)
      socket = null
    }
  }

  return nextSocket
}

export function sendAudio(data: ArrayBuffer) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(data)
  }
}

export function isVoiceConnected() {
  return socket?.readyState === WebSocket.OPEN
}

export function disconnectVoice() {
  const activeSocket = socket
  const activeConnectionId = connectionId

  if (activeSocket && activeSocket.readyState <= WebSocket.OPEN) {
    activeSocket.close()
  }

  if (socket === activeSocket) {
    connectionId = activeConnectionId + 1
    socket = null
  }
}
