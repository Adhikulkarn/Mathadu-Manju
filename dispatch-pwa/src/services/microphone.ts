import { sendAudio } from "./voiceSocket"

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let loggedChunkFormat = false

function getRecorderMimeType() {
  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus"
  ]

  for (const mimeType of preferredTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }

  return undefined
}

export async function startMic() {
  if (recorder && recorder.state === "recording") {
    return
  }

  stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = getRecorderMimeType()
  recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

  console.log("Mic recorder mimeType:", recorder.mimeType || mimeType || "browser-default")
  loggedChunkFormat = false

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      if (!loggedChunkFormat) {
        console.log("Mic chunk format:", {
          type: event.data.type,
          size: event.data.size
        })
        loggedChunkFormat = true
      }

      sendAudio(event.data)
    }
  }

  recorder.start(250)
}

export function stopMic() {
  if (recorder) {
    recorder.stop()
    recorder = null
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
    stream = null
  }
}
