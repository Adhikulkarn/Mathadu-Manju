import { useEffect, useRef, useState } from "react"

import CallButton from "./components/CallButton"
import StatusIndicator from "./components/StatusIndicator"
import { startMic, stopMic } from "./services/microphone"
import { connectVoice, disconnectVoice, isVoiceConnected } from "./services/voiceSocket"

let currentAudio: HTMLAudioElement | null = null
let playbackCleanupTimer: number | null = null

type Role = "driver" | "manager"
type Screen = "landing" | "driver-select" | "voice"
type DriverOption = {
  driver_id: string
  name: string
  phone: string
  vehicle_number: string
}

function getDjangoApiBaseUrl() {
  const protocol = window.location.protocol
  const host = window.location.hostname || "localhost"

  return `${protocol}//${host}:8000`
}

async function fetchDrivers() {
  const response = await fetch(`${getDjangoApiBaseUrl()}/api/drivers`)

  if (!response.ok) {
    throw new Error(`Failed to load drivers: ${response.status}`)
  }

  const payload = await response.json()
  return (payload.drivers ?? []) as DriverOption[]
}

function playAudio(
  data: ArrayBuffer,
  onPlaybackStart?: () => void,
  onPlaybackEnd?: () => void
) {
  if (currentAudio) {
    currentAudio.pause()
    URL.revokeObjectURL(currentAudio.src)
  }

  if (playbackCleanupTimer) {
    window.clearTimeout(playbackCleanupTimer)
    playbackCleanupTimer = null
  }

  console.log("Playing audio bytes:", data.byteLength)
  const blob = new Blob([data], { type: "audio/mpeg" })
  const url = URL.createObjectURL(blob)

  currentAudio = new Audio(url)
  currentAudio.preload = "auto"
  currentAudio.autoplay = false

  const finishPlayback = () => {
    if (playbackCleanupTimer) {
      window.clearTimeout(playbackCleanupTimer)
      playbackCleanupTimer = null
    }

    onPlaybackEnd?.()
  }

  const resumePlayback = () => {
    if (!currentAudio) {
      return
    }

    const duration = Number.isFinite(currentAudio.duration) ? currentAudio.duration : 0
    const remaining = duration - currentAudio.currentTime

    if (remaining <= 0.25 || !currentAudio.paused) {
      return
    }

    void currentAudio.play().catch((err) => {
      console.error("Audio resume failed", err)
    })
  }

  currentAudio.onloadedmetadata = () => {
    console.log("Audio duration:", currentAudio?.duration)
  }
  onPlaybackStart?.()
  currentAudio.onerror = () => {
    console.error("Audio playback failed")
    URL.revokeObjectURL(url)
    finishPlayback()
  }
  currentAudio.onpause = () => {
    console.log("Audio paused at:", currentAudio?.currentTime)
    playbackCleanupTimer = window.setTimeout(() => {
      resumePlayback()
    }, 100)
  }
  currentAudio.onstalled = () => {
    console.warn("Audio playback stalled")
    resumePlayback()
  }
  currentAudio.onended = () => {
    console.log("Audio ended at:", currentAudio?.currentTime)
    URL.revokeObjectURL(url)
    finishPlayback()
  }
  void currentAudio.play().catch((err) => {
    console.error("Audio play() failed", err)
    URL.revokeObjectURL(url)
    onPlaybackEnd?.()
  })
}

function App() {
  const [screen, setScreen] = useState<Screen>("landing")
  const [role, setRole] = useState<Role | null>(null)
  const [driverId, setDriverId] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [driversLoading, setDriversLoading] = useState(false)
  const [driversError, setDriversError] = useState<string | null>(null)
  const [callActive, setCallActive] = useState(false)
  const [connected, setConnected] = useState(false)
  const callActiveRef = useRef(false)
  const resumeAfterPlaybackRef = useRef(false)

  useEffect(() => {
    callActiveRef.current = callActive
  }, [callActive])

  useEffect(() => {
    if (screen !== "driver-select") {
      return
    }

    let cancelled = false

    setDriversLoading(true)
    setDriversError(null)

    void fetchDrivers()
      .then((items) => {
        if (!cancelled) {
          setDrivers(items)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch drivers", err)
          setDriversError("Could not load drivers.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDriversLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [screen])

  useEffect(() => {
    if (screen !== "voice" || !role) {
      disconnectVoice()
      setConnected(false)
      return
    }

    connectVoice(
      (data) =>
        playAudio(
          data,
          () => {
            if (!callActiveRef.current) {
              return
            }

            resumeAfterPlaybackRef.current = true
            stopMic()
            setCallActive(false)
          },
          () => {
            if (!resumeAfterPlaybackRef.current || !isVoiceConnected()) {
              resumeAfterPlaybackRef.current = false
              return
            }

            void startMic()
              .then(() => {
                setCallActive(true)
              })
              .catch((err) => {
                console.error("Microphone resume failed", err)
              })
              .finally(() => {
                resumeAfterPlaybackRef.current = false
              })
          }
        ),
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
      resumeAfterPlaybackRef.current = false
    }
  }, [connected, callActive])

  async function toggleCall() {
    if (callActive) {
      stopMic()
      setCallActive(false)
      resumeAfterPlaybackRef.current = false
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
    resumeAfterPlaybackRef.current = false
    setRole("driver")
    setDriverId(null)
    setScreen("driver-select")
  }

  function openManagerVoice() {
    stopMic()
    setCallActive(false)
    resumeAfterPlaybackRef.current = false
    setRole("manager")
    setDriverId(null)
    setScreen("voice")
  }

  function openDriverVoice(selectedDriverId: string) {
    stopMic()
    setCallActive(false)
    resumeAfterPlaybackRef.current = false
    setRole("driver")
    setDriverId(selectedDriverId)
    setScreen("voice")
  }

  function goBack() {
    stopMic()
    setCallActive(false)
    resumeAfterPlaybackRef.current = false

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
            {driversLoading ? <p className="text-sm text-slate-300">Loading drivers...</p> : null}
            {driversError ? <p className="text-sm text-rose-300">{driversError}</p> : null}
            {!driversLoading && !driversError && drivers.length === 0 ? (
              <p className="text-sm text-slate-300">No drivers available.</p>
            ) : null}
            {drivers.map((driver) => (
              <button
                key={driver.driver_id}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left text-lg font-medium transition hover:border-cyan-300/60 hover:bg-white/10"
                onClick={() => openDriverVoice(driver.driver_id)}
              >
                <div>Driver {driver.driver_id}</div>
                <div className="mt-1 text-sm text-slate-300">{driver.name}</div>
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
