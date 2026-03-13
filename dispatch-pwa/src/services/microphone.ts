import { sendAudio } from "./voiceSocket"

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null

export async function startMic() {
  if (recorder && recorder.state === "recording") {
    return
  }

  stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  recorder = new MediaRecorder(stream)

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
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
