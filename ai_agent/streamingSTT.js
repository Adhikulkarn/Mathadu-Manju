import WebSocket from "ws"

export function createSTTStream(onTranscript, onReady) {
    const pendingChunks = []
    let finalized = false
    let heartbeat = null

    const url =
        "wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=48000&channels=1"

    const connection = new WebSocket(url, {
        headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`
        }
    })

    connection.on("open", () => {
        console.log("Deepgram STT connected")

        if (onReady) {
            onReady()
        }

        heartbeat = setInterval(() => {
            if (connection.readyState === WebSocket.OPEN) {
                connection.ping?.()
            }
        }, 10000)

        while (pendingChunks.length > 0 && connection.readyState === WebSocket.OPEN) {
            connection.send(pendingChunks.shift())
        }
    })

    connection.on("message", (data) => {
        const msg = JSON.parse(data)

        const transcript = msg.channel?.alternatives?.[0]?.transcript
        const isFinal = msg.is_final
        if (msg.type && msg.type !== "Results") {
            console.log("Deepgram STT event:", msg.type, msg)
        }

        if (transcript && transcript.length > 0 && isFinal) {
            onTranscript(transcript)
        }

    })
    
    connection.on("error", (err) => {
        console.error("Deepgram error:", err)
    })

    connection.on("close", (code, reason) => {
        if (heartbeat) {
            clearInterval(heartbeat)
            heartbeat = null
        }

        const closeReason = Buffer.isBuffer(reason) ? reason.toString("utf8") : String(reason || "")
        console.log("Deepgram STT closed:", { code, reason: closeReason })
    })

    return {
        send: (audioChunk) => {
            if (connection.readyState === WebSocket.OPEN) {
                connection.send(audioChunk)
                return
            }

            if (!finalized && connection.readyState === WebSocket.CONNECTING) {
                pendingChunks.push(audioChunk)
            }
        },

        finish: () => {
            finalized = true

            if (connection.readyState === WebSocket.OPEN) {
                connection.send(JSON.stringify({ type: "Finalize" }))

                setTimeout(() => {
                    if (connection.readyState === WebSocket.OPEN) {
                        connection.close()
                    }
                }, 250)

                return
            }

            pendingChunks.length = 0
            connection.close()
        }
    }
}
