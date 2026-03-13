import "dotenv/config"

import express from "express"
import http from "http"
import { WebSocketServer } from "ws"

import { createSTTStream } from "./streamingSTT.js"
import { runAgent } from "./agentController.js"
import { speak } from "./streamingTTS.js"

const app = express()
const server = http.createServer(app)

const wss = new WebSocketServer({ server })

console.log("Voice server ready")

function normalizeTranscript(text) {
    return text
        .toLowerCase()
        .replace(/ship\s?ment/g, "shipment")
        .replace(/shipping/g, "shipment")
        .replace(/soupment/g, "shipment")
        .replace(/shipment id/g, "shipment")
        .replace(/shipment number/g, "shipment")
        .replace(/\ba\s+0\s+0\s+(\d)\b/g, "a00$1")
        .replace(/\ba\s+(\d)\s+(\d)\s+(\d)\b/g, "a$1$2$3")
        .replace(/\ba\s+(\d{3})\b/g, "a$1")
        .replace(/\b(please|hey|ok|okay|can you|could you)\b/g, "")
        .replace(/\s+/g, " ")
        .trim()
}

function parseSocketMessage(rawMessage) {
    if (typeof rawMessage === "string") {
        try {
            return JSON.parse(rawMessage)
        } catch {
            return null
        }
    }

    if (Buffer.isBuffer(rawMessage)) {
        const asText = rawMessage.toString("utf8")

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
    let audioChunkCount = 0

    let lastTranscript = ""

    const sttStream = createSTTStream(async (transcript) => {
        transcript = (transcript ?? "").trim()

        if (!transcript || transcript.length < 5) return

        if (transcript === lastTranscript) {
            console.log("Duplicate transcript ignored")
            return
        }

        lastTranscript = transcript

        console.log("------------------------------------------------")
        console.log("Transcript:", transcript)

        try {

            const startTime = Date.now()

            transcript = normalizeTranscript(transcript)

            if (!transcript || transcript.length < 5) {
                return
            }

            const responseText = await runAgent({
                message: transcript,
                role: ws.role,
                driver_id: ws.driver_id
            })

            console.log("Agent latency:", Date.now() - startTime, "ms")
            console.log("AI:", responseText)

            const audio = await speak(responseText)

            if (ws.readyState === ws.OPEN) {
                console.log("Sending audio bytes:", audio.length)
                ws.send(audio)
            }

        } catch (err) {

            console.error("Voice pipeline error:", err)

        }

        console.log("------------------------------------------------")

    })

    ws.on("message", (message) => {

        if (!sttStream) return

        try {

            const payload = parseSocketMessage(message)

            if (payload?.type === "session_init") {
                ws.role = payload.role ?? "manager"
                ws.driver_id = payload.driver_id ?? null

                console.log("Role:", ws.role)
                console.log("Driver ID:", ws.driver_id)
                return
            }

            const buffer = Buffer.from(message)
            audioChunkCount += 1

            if (audioChunkCount === 1 || audioChunkCount % 20 === 0) {
                console.log("Audio chunks received:", audioChunkCount)
            }

            sttStream.send(buffer)

        } catch (err) {

            console.error("Audio stream error:", err)

        }

    })

    ws.on("close", () => {

        console.log("Voice client disconnected")

        if (sttStream) {
            sttStream.finish()
        }

    })

    ws.on("error", (err) => {

        console.error("WebSocket error:", err)

    })

})

server.listen(4000, () => {

    console.log("Voice pipeline running on port 4000")

})
