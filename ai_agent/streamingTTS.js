export async function speak(text) {
  const response = await fetch(
    "https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&container=wav",
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
    console.error("Deepgram TTS HTTP error:", {
      status: response.status,
      statusText: response.statusText,
      body: err
    })
    throw new Error("Deepgram TTS error: " + err)
  }

  const arrayBuffer = await response.arrayBuffer()
  console.log("TTS bytes:", arrayBuffer.byteLength)
  return Buffer.from(arrayBuffer)
}
