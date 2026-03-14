import http from "http"
import path from "path"
import { fileURLToPath } from "url"
import WebSocket, { WebSocketServer } from "ws"
import dotenv from "dotenv"

import { runAgent } from "./agentController.js"
import { speak } from "./streamingTTS.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, ".env") })

const server = http.createServer()
const wss = new WebSocketServer({ server })
const STT_URL =
  "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&audio_format=pcm_16000&language_code=en&commit_strategy=vad&include_timestamps=true&include_language_detection=false"

console.log("Voice server ready")

function parseSocketMessage(message) {
  if (typeof message === "string") {
    try {
      return JSON.parse(message)
    } catch {
      return null
    }
  }

  if (Buffer.isBuffer(message)) {
    try {
      return JSON.parse(message.toString("utf8"))
    } catch {
      return null
    }
  }

  return null
}

wss.on("connection", (ws) => {
  console.log("Voice client connected")

  ws.role = "manager"
  ws.driver_id = null

  let sttSocket = null
  let sttReady = false
  let pendingAudioChunks = []
  let reconnectTimer = null
  let closedByClient = false
  let responseInFlight = false
  let lastHandledTranscript = ""
  let lastHandledAt = 0
  let lastResponseSentAt = 0
  let lastPartialTranscript = ""
  let lastPartialAt = 0
  let audioChunkCount = 0

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("ELEVENLABS_API_KEY is missing")
  }

  function sendAudioChunk(audioBuffer) {
    if (!sttSocket || sttSocket.readyState !== WebSocket.OPEN) {
      return false
    }

    sttSocket.send(JSON.stringify({
      message_type: "input_audio_chunk",
      audio_base_64: audioBuffer.toString("base64"),
      sample_rate: 16000
    }))

    return true
  }

  function connectStt() {
    if (closedByClient) {
      return
    }

    sttSocket = new WebSocket(STT_URL, {
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY
      }
    })

    sttSocket.on("open", () => {
      sttReady = true
      console.log("STT socket connected")

      for (const audioBuffer of pendingAudioChunks) {
        sendAudioChunk(audioBuffer)
      }

      pendingAudioChunks = []
    })

    sttSocket.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString())

        if (msg.message_type === "error" || msg.message_type?.endsWith("_error")) {
          console.error("STT error:", msg.message ?? msg.error ?? msg)
          return
        }

        if (
          msg.message_type === "partial_transcript" ||
          msg.message_type === "partial_transcript_with_timestamps"
        ) {
          if (msg.text?.trim()) {
            const partialText = msg.text.trim()
            console.log("Partial transcript:", partialText)
            lastPartialTranscript = partialText.toLowerCase()
            lastPartialAt = Date.now()
          }
          return
        }

        if (msg.message_type && msg.message_type !== "audio" && msg.message_type !== "ping") {
          console.log("STT event:", msg.message_type)
        }

        if (msg.message_type === "committed_transcript_with_timestamps") {
          return
        }

        if (msg.message_type !== "committed_transcript") {
          return
        }

        if (!msg.text || msg.text.length <= 2) {
          return
        }

        const transcript = msg.text.toLowerCase().trim()
        const now = Date.now()
        const hasRecentMatchingPartial =
          !!lastPartialTranscript &&
          now - lastPartialAt < 4000 &&
          (
            lastPartialTranscript === transcript ||
            lastPartialTranscript.endsWith(transcript) ||
            transcript.endsWith(lastPartialTranscript)
          )

        if (
          responseInFlight ||
          now - lastResponseSentAt < 2500 ||
          (!hasRecentMatchingPartial && now - lastHandledAt < 6000) ||
          (transcript === lastHandledTranscript && now - lastHandledAt < 3000)
        ) {
          return
        }

        responseInFlight = true
        lastHandledTranscript = transcript
        lastHandledAt = now
        lastPartialTranscript = ""
        lastPartialAt = 0

        console.log("Transcript:", transcript)
        console.log("Role:", ws.role)
        console.log("Driver ID:", ws.driver_id)

        try {
          const response = await runAgent({
            message: transcript,
            role: ws.role,
            driver_id: ws.driver_id
          })

          console.log("Agent response:", response)

          const audio = await speak(response)
          console.log("TTS audio bytes:", audio.byteLength)

          if (ws.readyState === ws.OPEN) {
            ws.send(audio)
            lastResponseSentAt = Date.now()
          }
        } catch (error) {
          console.error("TTS failed:", error?.message ?? error)
        } finally {
          responseInFlight = false
        }
      } catch {
        // Ignore malformed STT events.
      }
    })

    sttSocket.on("close", () => {
      sttReady = false
      console.log("STT socket closed")

      if (closedByClient) {
        return
      }

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connectStt()
      }, 500)
    })

    sttSocket.on("error", (error) => {
      sttReady = false
      console.error("STT socket error:", error.message)
      // Close handler will reconnect.
    })
  }

  connectStt()

  ws.on("message", (message) => {
    const payload = parseSocketMessage(message)

    if (payload?.type === "session_init") {
      ws.role = payload.role ?? "manager"
      ws.driver_id = payload.driver_id ?? null
      console.log("Session initialized:", ws.role, ws.driver_id)
      return
    }

    let audioBuffer

    if (Buffer.isBuffer(message)) {
      audioBuffer = message
    } else if (message instanceof ArrayBuffer) {
      audioBuffer = Buffer.from(message)
    } else if (ArrayBuffer.isView(message)) {
      audioBuffer = Buffer.from(message.buffer, message.byteOffset, message.byteLength)
    } else {
      return
    }

    audioChunkCount += 1

    if (audioChunkCount === 1 || audioChunkCount % 25 === 0) {
      console.log("Received audio chunks:", audioChunkCount)
    }

    if (sttReady && sendAudioChunk(audioBuffer)) {
      return
    }

    pendingAudioChunks.push(audioBuffer)

    if (pendingAudioChunks.length > 32) {
      pendingAudioChunks.shift()
    }
  })

  ws.on("close", () => {
    closedByClient = true
    sttReady = false
    pendingAudioChunks = []

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (sttSocket && sttSocket.readyState <= WebSocket.OPEN) {
      sttSocket.close()
    }
  })
})

server.listen(4000, () => {
  console.log("Voice pipeline running on port 4000")
})
