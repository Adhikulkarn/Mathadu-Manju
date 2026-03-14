import "dotenv/config"

import http from "http"
import { WebSocketServer } from "ws"

import { runAgent } from "./agentController.js"
import { speak } from "./streamingTTS.js"
import { transcribeAudio } from "./whisperSTT.js"

const server = http.createServer()
const wss = new WebSocketServer({ server })

console.log("Voice server ready")

function normalizeTranscript(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function parseSocketMessage(message) {
  if (typeof message === "string") {
    try {
      return JSON.parse(message)
    } catch {
      return null
    }
  }

  if (Buffer.isBuffer(message)) {
    const asText = message.toString("utf8")

    if (asText.startsWith("{")) {
      try {
        return JSON.parse(asText)
      } catch {
        return null
      }
    }
  }

  return null
}

wss.on("connection", (ws) => {

  console.log("Voice client connected")

  ws.role = "manager"
  ws.driver_id = null

  let audioChunks = []
  let chunkTimer = null
  let processing = false

  ws.on("message", async (message) => {

    try {

      const payload = parseSocketMessage(message)

      if (payload?.type === "session_init") {
        ws.role = payload.role ?? "manager"
        ws.driver_id = payload.driver_id ?? null

        console.log("Role:", ws.role)
        console.log("Driver ID:", ws.driver_id)
        return
      }

      let buffer

      if (Buffer.isBuffer(message)) {
        buffer = message
      } else if (message instanceof ArrayBuffer) {
        buffer = Buffer.from(message)
      } else if (ArrayBuffer.isView(message)) {
        buffer = Buffer.from(message.buffer, message.byteOffset, message.byteLength)
      } else {
        return
      }

      if (buffer.length <= 500) {
        return
      }

      audioChunks.push(buffer)

      if (!chunkTimer) {

        chunkTimer = setTimeout(async () => {

          const audioBuffer = Buffer.concat(audioChunks)

          audioChunks = []
          chunkTimer = null

          if (audioBuffer.length < 10000 || processing) {
            return
          }

          processing = true

          try {

            const transcript = await transcribeAudio(audioBuffer)

            if (!transcript || transcript.length < 2) {
              return
            }

            const normalized = normalizeTranscript(transcript)

            console.log("Transcript:", normalized)
            console.log("Role:", ws.role)
            console.log("Driver ID:", ws.driver_id)

            const responseText = await runAgent({
              message: normalized,
              role: ws.role,
              driver_id: ws.driver_id
            })

            console.log("Agent response:", responseText)

            const audio = await speak(responseText)

            if (ws.readyState === ws.OPEN) {
              ws.send(audio)
            }

          } catch (err) {

            console.error("Voice processing failed")

          } finally {
            processing = false
          }

        }, 3000)

      }

    } catch (err) {

      console.error("Message handling failed")

    }

  })

  ws.on("close", () => {
    if (chunkTimer) {
      clearTimeout(chunkTimer)
      chunkTimer = null
    }

    audioChunks = []
    processing = false
    console.log("Voice client disconnected")
  })

})

server.listen(4000, () => {
  console.log("Voice pipeline running on port 4000")
})
