export async function speak(text) {
  const response = await fetch(
    "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
    {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error("Deepgram TTS error: " + err)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}