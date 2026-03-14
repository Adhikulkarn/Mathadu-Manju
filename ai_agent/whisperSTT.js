import fetch from "node-fetch"
import FormData from "form-data"

export async function transcribeAudio(audioBuffer) {

  const form = new FormData()

  form.append("file", audioBuffer, {
    filename: "audio.webm",
    contentType: "audio/webm"
  })

  form.append("model", "whisper-large-v3-turbo")

  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: form
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error("Groq Whisper API error:", err)
    return null
  }

  const data = await response.json()

  return data.text
}
