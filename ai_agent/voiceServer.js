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

wss.on("connection", (ws) => {

    console.log("Driver connected")

    const sttStream = createSTTStream(async (transcript) => {

        console.log("------------------------------------------------")
        console.log("Transcript:", transcript)

        try {

            const startTime = Date.now()

            const aiResponse = await runAgent(transcript)

            const latency = Date.now() - startTime

            console.log("AI:", aiResponse)
            console.log("Agent latency:", latency, "ms")

            const audioStream = await speak(aiResponse)

            // Stream audio chunks to client
            audioStream.on("data", (chunk) => {

                if (ws.readyState === ws.OPEN) {
                    ws.send(chunk)
                }

            })

            audioStream.on("error", (err) => {

                console.error("TTS stream error:", err)

            })

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