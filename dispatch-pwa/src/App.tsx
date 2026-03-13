import { useEffect, useState } from "react"

import CallButton from "./components/CallButton"
import StatusIndicator from "./components/StatusIndicator"
import { startMic, stopMic } from "./services/microphone"
import { connectVoice, disconnectVoice, isVoiceConnected } from "./services/voiceSocket"

let currentAudio: HTMLAudioElement | null = null
const DRIVERS = ["D001", "D002", "D003"] as const

type Role = "driver" | "manager"
type Screen = "landing" | "driver-select" | "voice"

function playAudio(data: ArrayBuffer) {
  if (currentAudio) {
    currentAudio.pause()
    URL.revokeObjectURL(currentAudio.src)
  }

  console.log("Playing audio bytes:", data.byteLength)
  const blob = new Blob([data], { type: "audio/wav" })
  const url = URL.createObjectURL(blob)

  currentAudio = new Audio(url)
  currentAudio.onerror = () => {
    console.error("Audio playback failed")
    URL.revokeObjectURL(url)
  }
  currentAudio.onended = () => {
    URL.revokeObjectURL(url)
  }
  void currentAudio.play().catch((err) => {
    console.error("Audio play() failed", err)
    URL.revokeObjectURL(url)
  })
}

function App() {
  const [screen, setScreen] = useState<Screen>("landing")
  const [role, setRole] = useState<Role | null>(null)
  const [driverId, setDriverId] = useState<string | null>(null)
  const [callActive, setCallActive] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (screen !== "voice" || !role) {
      disconnectVoice()
      setConnected(false)
      return
    }

    connectVoice(
      playAudio,
      setConnected,
      role === "driver" && driverId
        ? { role: "driver", driver_id: driverId }
        : { role: "manager" }
    )

    return () => {
      disconnectVoice()
      setConnected(false)
    }
  }, [screen, role, driverId])

  useEffect(() => {
    if (!connected && callActive) {
      stopMic()
      setCallActive(false)
    }
  }, [connected, callActive])

  async function toggleCall() {
    if (callActive) {
      stopMic()
      setCallActive(false)
      return
    }

    if (!isVoiceConnected()) {
      console.error("Voice socket is not connected")
      return
    }

    await startMic()
    setCallActive(true)
  }

  function openDriverSelection() {
    stopMic()
    setCallActive(false)
    setRole("driver")
    setDriverId(null)
    setScreen("driver-select")
  }

  function openManagerVoice() {
    stopMic()
    setCallActive(false)
    setRole("manager")
    setDriverId(null)
    setScreen("voice")
  }

  function openDriverVoice(selectedDriverId: string) {
    stopMic()
    setCallActive(false)
    setRole("driver")
    setDriverId(selectedDriverId)
    setScreen("voice")
  }

  function goBack() {
    stopMic()
    setCallActive(false)

    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }

    if (screen === "driver-select") {
      setRole(null)
      setScreen("landing")
      return
    }

    if (role === "driver") {
      setScreen("driver-select")
      return
    }

    setRole(null)
    setDriverId(null)
    setScreen("landing")
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 text-center shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Voice Ops</p>
          <h1 className="mt-3 text-3xl font-bold">Logistics Dispatch AI</h1>
        </div>

        {screen === "landing" ? (
          <div className="space-y-4">
            <button
              className="w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-lg font-semibold transition hover:border-cyan-300 hover:bg-cyan-300/20"
              onClick={openDriverSelection}
            >
              Driver
            </button>
            <button
              className="w-full rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-lg font-semibold transition hover:border-amber-300 hover:bg-amber-300/20"
              onClick={openManagerVoice}
            >
              Warehouse Manager
            </button>
          </div>
        ) : null}

        {screen === "driver-select" ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Select Driver</h2>
              <p className="mt-2 text-sm text-slate-300">Choose the active driver before starting voice mode.</p>
            </div>
            {DRIVERS.map((driver) => (
              <button
                key={driver}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left text-lg font-medium transition hover:border-cyan-300/60 hover:bg-white/10"
                onClick={() => openDriverVoice(driver)}
              >
                Driver {driver}
              </button>
            ))}
            <button className="pt-3 text-sm text-slate-300 underline underline-offset-4" onClick={goBack}>
              Back
            </button>
          </div>
        ) : null}

        {screen === "voice" ? (
          <div>
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                {role === "driver" ? "Driver Session" : "Manager Session"}
              </p>
              <p className="mt-2 text-lg font-medium">
                {role === "driver" && driverId ? `Driver ${driverId}` : "Warehouse Manager"}
              </p>
            </div>

            <div className="flex justify-center">
              <CallButton
                active={callActive}
                disabled={!connected && !callActive}
                onToggle={toggleCall}
              />
            </div>

            <StatusIndicator connected={connected} />
            {callActive ? <p className="mt-3 text-sm text-gray-300">Listening...</p> : null}
            <button className="mt-6 text-sm text-slate-300 underline underline-offset-4" onClick={goBack}>
              Change role
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default App
