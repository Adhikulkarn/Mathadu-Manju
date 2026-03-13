import "dotenv/config"

import express from "express"
import http from "http"
import { WebSocketServer } from "ws"

import { createSTTStream } from "./streamingSTT.js"
import { runAgent } from "./agentController.js"
import { speak } from "./streamingTTS.js"
import { detectIntent } from "./intentParser.js"
import { executeTool } from "./toolExecutor.js"

const app = express()
const server = http.createServer(app)

const wss = new WebSocketServer({ server })

console.log("Voice server ready")

wss.on("connection", (ws) => {

    console.log("Driver connected")

    // Prevent duplicate tool calls from repeated transcripts
    let lastTranscript = ""

    const sttStream = createSTTStream(async (transcript) => {

        transcript = transcript.trim()

        if (!transcript) return

        // Prevent STT jitter duplicates
        if (transcript === lastTranscript) {
            console.log("Duplicate transcript ignored")
            return
        }

        lastTranscript = transcript

        console.log("------------------------------------------------")
        console.log("Transcript:", transcript)

        try {

            const startTime = Date.now()

            const intent = detectIntent(transcript)

            let responseText

            if (intent) {

                console.log("Shortcut intent detected:", intent.tool)

                const result = await executeTool(intent.tool, intent.args)

                responseText = result.message || JSON.stringify(result)

                console.log("Shortcut latency:", Date.now() - startTime, "ms")

            } else {

                console.log("No shortcut match → using LLM")

                responseText = await runAgent(transcript)

                console.log("Agent latency:", Date.now() - startTime, "ms")

            }

            console.log("AI:", responseText)

            // Convert response to speech
            const audio = await speak(responseText)

            if (ws.readyState === ws.OPEN) {

                // Send audio buffer back to client
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