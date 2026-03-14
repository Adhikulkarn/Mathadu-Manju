import { sendAudio } from "./voiceSocket"

let stream: MediaStream | null = null
let audioContext: AudioContext | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let workletNode: AudioWorkletNode | null = null
let scriptProcessorNode: ScriptProcessorNode | null = null
let sinkNode: GainNode | null = null
let pendingPcmChunk: Float32Array | null = null

const TARGET_CHUNK_MS = 200

function downsampleTo16k(input: Float32Array, inputSampleRate: number) {
  if (inputSampleRate === 16000) {
    return input
  }

  const sampleRateRatio = inputSampleRate / 16000
  const outputLength = Math.max(1, Math.round(input.length / sampleRateRatio))
  const output = new Float32Array(outputLength)

  let outputIndex = 0
  let inputIndex = 0

  while (outputIndex < outputLength) {
    const nextInputIndex = Math.min(input.length, Math.round((outputIndex + 1) * sampleRateRatio))
    let sum = 0
    let count = 0

    for (let i = inputIndex; i < nextInputIndex; i += 1) {
      sum += input[i]
      count += 1
    }

    output[outputIndex] = count > 0 ? sum / count : input[inputIndex] ?? 0
    outputIndex += 1
    inputIndex = nextInputIndex
  }

  return output
}

function floatTo16BitPcm(input: Float32Array) {
  const buffer = new ArrayBuffer(input.length * 2)
  const view = new DataView(buffer)

  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }

  return buffer
}

function sendPcmFrame(floatData: Float32Array) {
  const downsampled = downsampleTo16k(floatData, audioContext?.sampleRate ?? 48000)
  const existingLength = pendingPcmChunk?.length ?? 0
  const combined = new Float32Array(existingLength + downsampled.length)

  if (pendingPcmChunk) {
    combined.set(pendingPcmChunk, 0)
  }

  combined.set(downsampled, existingLength)

  const targetSamples = Math.round((16000 * TARGET_CHUNK_MS) / 1000)

  if (combined.length < targetSamples) {
    pendingPcmChunk = combined
    return
  }

  const sendLength = combined.length - (combined.length % targetSamples)
  const pcmBuffer = floatTo16BitPcm(combined.subarray(0, sendLength))
  pendingPcmChunk = combined.length > sendLength ? combined.slice(sendLength) : null

  sendAudio(pcmBuffer)
}

function flushPendingPcmChunk() {
  if (!pendingPcmChunk || pendingPcmChunk.length === 0) {
    pendingPcmChunk = null
    return
  }

  sendAudio(floatTo16BitPcm(pendingPcmChunk))
  pendingPcmChunk = null
}

async function setupWorkletProcessor() {
  if (!audioContext || !sourceNode) {
    return false
  }

  if (typeof AudioWorkletNode === "undefined") {
    return false
  }

  try {
    await audioContext.audioWorklet.addModule(
      new URL("./pcmProcessor.worklet.js", import.meta.url)
    )

    workletNode = new AudioWorkletNode(audioContext, "pcm-processor")
    workletNode.port.onmessage = (event) => {
      const floatData = new Float32Array(event.data)
      sendPcmFrame(floatData)
    }

    sourceNode.connect(workletNode)
    workletNode.connect(sinkNode!)
    console.log("Microphone capture using AudioWorklet")
    return true
  } catch (err) {
    console.warn("AudioWorklet unavailable, falling back to ScriptProcessor", err)
    return false
  }
}

function setupScriptProcessor() {
  if (!audioContext || !sourceNode) {
    return
  }

  scriptProcessorNode = audioContext.createScriptProcessor(4096, 1, 1)
  scriptProcessorNode.onaudioprocess = (event) => {
    const channelData = event.inputBuffer.getChannelData(0)
    sendPcmFrame(channelData)
  }

  sourceNode.connect(scriptProcessorNode)
  scriptProcessorNode.connect(sinkNode!)
  console.log("Microphone capture using ScriptProcessor fallback")
}

export async function startMic() {
  if (audioContext && audioContext.state !== "closed") {
    return
  }

  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  })

  audioContext = new AudioContext()
  await audioContext.resume()

  sourceNode = audioContext.createMediaStreamSource(stream)
  sinkNode = audioContext.createGain()
  sinkNode.gain.value = 0
  sinkNode.connect(audioContext.destination)

  console.log("Mic input sample rate:", audioContext.sampleRate)

  const usingWorklet = await setupWorkletProcessor()

  if (!usingWorklet) {
    setupScriptProcessor()
  }
}

export function stopMic() {
  flushPendingPcmChunk()

  if (workletNode) {
    workletNode.port.onmessage = null
    workletNode.disconnect()
    workletNode = null
  }

  if (scriptProcessorNode) {
    scriptProcessorNode.onaudioprocess = null
    scriptProcessorNode.disconnect()
    scriptProcessorNode = null
  }

  if (sourceNode) {
    sourceNode.disconnect()
    sourceNode = null
  }

  if (sinkNode) {
    sinkNode.disconnect()
    sinkNode = null
  }

  if (audioContext) {
    void audioContext.close()
    audioContext = null
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
    stream = null
  }
}
