import { useEffect, useState } from "react"

import CallButton from "./components/CallButton"
import StatusIndicator from "./components/StatusIndicator"
import { startMic, stopMic } from "./services/microphone"
import { connectVoice } from "./services/voiceSocket"

let currentAudio: HTMLAudioElement | null = null

function playAudio(data: ArrayBuffer) {
  if (currentAudio) {
    currentAudio.pause()
    URL.revokeObjectURL(currentAudio.src)
  }

  const blob = new Blob([data], { type: "audio/wav" })
  const url = URL.createObjectURL(blob)

  currentAudio = new Audio(url)
  currentAudio.onended = () => {
    URL.revokeObjectURL(url)
  }
  void currentAudio.play()
}

function App() {
  const [callActive, setCallActive] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    connectVoice(playAudio, setConnected)
  }, [])

  async function toggleCall() {
    if (callActive) {
      stopMic()
      setCallActive(false)
      return
    }

    await startMic()
    setCallActive(true)
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900 px-4 text-white">
      <div className="text-center">
        <div className="mb-10">
          <div>
            <h1 className="text-3xl font-bold">Logistics Dispatch</h1>
          </div>
        </div>

        <div className="flex justify-center">
          <CallButton
            active={callActive}
            onToggle={toggleCall}
          />
        </div>

        <StatusIndicator connected={connected} />
        {callActive ? <p className="mt-3 text-sm text-gray-300">Listening...</p> : null}
      </div>
    </div>
  )
}

export default App
