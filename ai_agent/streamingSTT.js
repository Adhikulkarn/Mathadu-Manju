import WebSocket from "ws"

export function createSTTStream(onTranscript) {

    const url =
        "wss://api.deepgram.com/v1/listen?model=nova-3&interim_results=true&smart_format=true"

    const connection = new WebSocket(url, {
        headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`
        }
    })

    connection.on("open", () => {
        console.log("Deepgram STT connected")
    })

    connection.on("message", (data) => {

    const msg = JSON.parse(data)

    const transcript = msg.channel?.alternatives?.[0]?.transcript
    const isFinal = msg.is_final

    if (isFinal && transcript && transcript.length > 0) {
        onTranscript(transcript)
    }

    })
    
    connection.on("error", (err) => {
        console.error("Deepgram error:", err)
    })

    return {
        send: (audioChunk) => {
            if (connection.readyState === WebSocket.OPEN) {
                connection.send(audioChunk)
            }
        },

        finish: () => {
            connection.close()
        }
    }
}