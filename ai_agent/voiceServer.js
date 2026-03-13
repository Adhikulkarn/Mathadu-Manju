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

wss.on("connection", (ws) => {

    console.log("Driver connected")

    let lastTranscript = ""

    const sttStream = createSTTStream(async (transcript) => {

        transcript = transcript.trim()

        if (!transcript) return

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

            const responseText = await runAgent(transcript)

            console.log("Agent latency:", Date.now() - startTime, "ms")
            console.log("AI:", responseText)

            const audio = await speak(responseText)

            if (ws.readyState === ws.OPEN) {
                ws.send(audio)
            }

        } catch (err) {

            console.error("Voice pipeline error:", err)

        }

        console.log("------------------------------------------------")

    })

    ws.on("message", (audioChunk) => {

        if (!sttStream) return

        try {

            const buffer = Buffer.from(audioChunk)

            sttStream.send(buffer)

        } catch (err) {

            console.error("Audio stream error:", err)

        }

    })

    ws.on("close", () => {

        console.log("Driver disconnected")

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
