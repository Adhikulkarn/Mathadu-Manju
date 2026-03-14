export async function speak(text) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.8,
          similarity_boost: 0.9,
          style: 0,
          speed: 1,
          use_speaker_boost: true
        }
      })
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error("ElevenLabs TTS HTTP error:", {
      status: response.status,
      statusText: response.statusText,
      body: err
    })
    throw new Error("ElevenLabs TTS error: " + err)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
