# Mathadu-Manju

Mathadu-Manju is a voice-enabled logistics operations system built as three cooperating parts:

1. A Django backend in `logistics_agent/` that owns shipments, drivers, delays, incidents, and dashboard data.
2. A Node.js AI/voice orchestration layer in `ai_agent/` that handles LLM tool-calling, speech-to-text, and text-to-speech.
3. A React + Vite frontend in `dispatch-pwa/` that provides the browser voice interface for drivers and warehouse managers.

The core architectural rule is simple: logistics facts should come from backend APIs, not from free-form model output.

## System Overview

At runtime, the project supports both text and voice interactions.

### Text path

```text
Client
  -> ai_agent/server.js
  -> runAgent()
  -> Groq tool call when needed
  -> toolExecutor.js
  -> Django REST API
  -> formatted text response
```

### Voice path

```text
Browser microphone
  -> MediaRecorder chunks
  -> WebSocket to ai_agent/voiceServer.js
  -> Deepgram Streaming STT
  -> transcript normalization
  -> runAgent()
  -> Django API tool execution when needed
  -> response text
  -> Deepgram TTS
  -> WAV audio bytes
  -> browser playback
```

## Repository Structure

```text
.
├── README.md
├── prompt.txt
├── ai_agent/
│   ├── agentController.js
│   ├── config.js
│   ├── groqClient.js
│   ├── intentParser.js
│   ├── package.json
│   ├── README.md
│   ├── server.js
│   ├── streamingSTT.js
│   ├── streamingTTS.js
│   ├── toolExecutor.js
│   ├── toolLoader.js
│   ├── toolRouter.js
│   └── voiceServer.js
├── dispatch-pwa/
│   ├── package.json
│   ├── public/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── services/
│   └── vite.config.ts
├── logistics_agent/
│   ├── logistics_agent/
│   ├── manage.py
│   ├── requirements.txt
│   └── shipments/
└── test_clients/
    └── voice_test.html
```

## Frontend: `dispatch-pwa/`

The frontend is a React 18 application built with Vite, TypeScript, Tailwind CSS, and `vite-plugin-pwa`.

### Frontend responsibilities

- Presents a role-based voice UI for drivers and warehouse managers.
- Connects to the Node WebSocket voice server.
- Captures microphone audio from the browser.
- Receives synthesized speech audio and plays it back.
- Initializes the server-side session with role and optional `driver_id`.

### Main frontend files

#### `dispatch-pwa/src/App.tsx`

This is the application shell and voice session controller.

It handles:

- role selection between `driver` and `manager`
- driver selection for predefined demo drivers `D001`, `D002`, and `D003`
- WebSocket connect/disconnect lifecycle
- microphone start/stop state
- returned audio playback using `HTMLAudioElement`

Important behavior:

- When the user enters the voice screen, the app opens the WebSocket connection automatically.
- The frontend sends a session initialization payload immediately after socket open.
- Audio returned from the server is expected as WAV bytes and played with `Blob(..., { type: "audio/wav" })`.
- When the user leaves the voice screen, the app closes the socket and stops the mic.

#### `dispatch-pwa/src/services/voiceSocket.ts`

This module is the browser-side transport layer for voice.

It is responsible for:

- building the WebSocket URL using the current page hostname and port `4000`
- opening the connection to the voice server
- sending a `session_init` JSON message such as:

```json
{
  "type": "session_init",
  "role": "driver",
  "driver_id": "D001"
}
```

- routing binary audio responses back to the UI
- tracking connection state

The frontend expects the voice server to run at `ws://<host>:4000` or `wss://<host>:4000`.

#### `dispatch-pwa/src/services/microphone.ts`

This module captures and streams microphone audio.

Implementation details:

- Uses `navigator.mediaDevices.getUserMedia({ audio: true })`
- Uses `MediaRecorder`
- Prefers `audio/webm;codecs=opus`, then `audio/webm`, then `audio/ogg;codecs=opus`
- Emits audio every `250` ms
- Sends each audio blob directly to the voice WebSocket

This format choice matters because the STT server is configured to expect Opus audio in a WebM container.

#### UI components

- `CallButton.tsx`: large push-to-start / push-to-end call button
- `StatusIndicator.tsx`: simple connected/connecting state indicator
- `index.css`: project-wide visual styling, gradient background, font selection, and base layout

### Frontend runtime flow

1. User selects `Driver` or `Warehouse Manager`.
2. Frontend opens a WebSocket connection to port `4000`.
3. Frontend sends role context using `session_init`.
4. User starts the call.
5. Browser captures mic input and sends media chunks.
6. Returned server audio is played in the browser.

### Frontend setup

```bash
cd dispatch-pwa
npm install
npm run dev
```

The app is configured as a PWA through [`dispatch-pwa/vite.config.ts`](/home/spidy/Desktop/projects/Mathadu-Manju/dispatch-pwa/vite.config.ts).

## Backend: `logistics_agent/`

The Django application is the source of truth for all logistics state. The Node agent reads from and writes to this backend through explicit APIs.

### Backend stack

- Django 6.0.3
- Django REST Framework 3.16.1
- `django-cors-headers`
- SQLite

Dependencies are listed in [`logistics_agent/requirements.txt`](/home/spidy/Desktop/projects/Mathadu-Manju/logistics_agent/requirements.txt).

### Django project configuration

The project package is `logistics_agent/logistics_agent/`.

Relevant files:

- [`logistics_agent/logistics_agent/settings.py`](/home/spidy/Desktop/projects/Mathadu-Manju/logistics_agent/logistics_agent/settings.py)
- [`logistics_agent/logistics_agent/urls.py`](/home/spidy/Desktop/projects/Mathadu-Manju/logistics_agent/logistics_agent/urls.py)
- [`logistics_agent/shipments/urls.py`](/home/spidy/Desktop/projects/Mathadu-Manju/logistics_agent/shipments/urls.py)

The root URL config mounts shipment APIs under `/api/`.

### Domain model

The logistics domain lives in [`logistics_agent/shipments/models.py`](/home/spidy/Desktop/projects/Mathadu-Manju/logistics_agent/shipments/models.py).

#### `Driver`

Fields:

- `driver_id`
- `name`
- `phone`
- `vehicle_number`

This model represents a delivery driver and can be assigned to many shipments.

#### `Shipment`

Fields:

- `shipment_id`
- `destination`
- `driver`
- `status`
- `created_at`
- `updated_at`

Supported statuses:

- `pending`
- `in_transit`
- `delivered`
- `delayed`
- `incident`

This is the central operational entity in the system.

#### `DelayReport`

Fields:

- `shipment`
- `reason`
- `reported_at`

Creating a delay report is coupled with updating the linked shipment status to `delayed`.

#### `Incident`

Fields:

- `shipment`
- `incident_type`
- `description`
- `status`
- `support_person`
- `eta_minutes`
- `reported_at`

Supported incident statuses:

- `reported`
- `assistance_dispatched`
- `resolved`

This model stores operational disruptions such as punctures, engine failures, or package damage.

### Serializers

Validation lives in [`logistics_agent/shipments/serializers.py`](/home/spidy/Desktop/projects/Mathadu-Manju/logistics_agent/shipments/serializers.py).

Key serializers:

- `ShipmentStatusUpdateSerializer`
- `DelayReportSerializer`
- `IncidentSerializer`
- `ShipmentSerializer`

These serializers are lightweight and mostly validate request payload structure.

### API surface

The APIs are implemented in [`logistics_agent/shipments/views.py`](/home/spidy/Desktop/projects/Mathadu-Manju/logistics_agent/shipments/views.py).

#### `POST /api/update-shipment-status`

Updates a shipment status.

Example:

```json
{
  "shipment_id": "A101",
  "status": "delivered"
}
```

#### `POST /api/report-delay`

Creates a `DelayReport` and sets shipment status to `delayed`.

Example:

```json
{
  "shipment_id": "A102",
  "reason": "Traffic congestion"
}
```

#### `POST /api/report-incident`

Creates an incident and updates shipment status to `incident`.

Example:

```json
{
  "shipment_id": "A103",
  "incident_type": "tire_puncture",
  "description": "Rear tire puncture on highway"
}
```

Current backend business rules:

- `tire_puncture` assigns `Ramesh (Technician)` with ETA `20`
- `engine_failure` assigns `Mahesh (Recovery Vehicle)` with ETA `40`
- `package_damage` returns a warehouse support message without field technician assignment
- all other incident types return a generic support message

#### `POST /api/resolve-incident/`

Finds the latest active incident for a shipment, marks it `resolved`, and sets the shipment back to `in_transit`.

#### `GET /api/shipment-status/<shipment_id>/`

Returns shipment status and destination.

#### `GET /api/next-delivery/<driver_id>/`

Returns the earliest assigned shipment for a driver, excluding `delivered` and `incident`.

#### `GET /api/assigned-shipments?driver_id=<id>&limit=<n>`

Returns a list of assigned shipments for a driver.

#### `GET /api/query-shipments`

Supports optional filters:

- `status`
- `driver_id`
- `limit`

This is mainly intended for manager workflows.

#### `GET /api/query-incidents`

Supports optional filters:

- `status`
- `driver_id`
- `limit`

#### `POST /api/assign-driver`

Assigns or reassigns a driver to a shipment.

Example:

```json
{
  "shipment_id": "A104",
  "driver_id": "D001"
}
```

#### `GET /api/dashboard` and `GET /api/dashboard/stats`

Both routes return:

- `total_shipments`
- `delivered`
- `delayed`
- `incidents`

#### `GET /api/agent-tools/`

Returns tool definitions in tool-calling schema form for the AI layer.

This endpoint is important because it documents the backend-approved tool contract. Even though the current Node implementation defines tools locally in code, this backend route still acts as the canonical tool inventory for the project design.

### Seed data

Demo data is generated by [`logistics_agent/shipments/management/commands/seed_data.py`](/home/spidy/Desktop/projects/Mathadu-Manju/logistics_agent/shipments/management/commands/seed_data.py).

It creates:

- 5 drivers: `D001` to `D005`
- 20 shipments: `A001` to `A020`
- random destinations like `Warehouse 1` to `Warehouse 5`
- random statuses from `pending`, `in_transit`, `delivered`, `delayed`

### Backend setup

```bash
cd logistics_agent
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

### Backend testing state

[`logistics_agent/shipments/tests.py`](/home/spidy/Desktop/projects/Mathadu-Manju/logistics_agent/shipments/tests.py) is currently a placeholder, so the backend does not yet have meaningful automated coverage.

## AI and Voice Layer: `ai_agent/`

The Node application is the bridge between user input and logistics APIs. It exposes:

- an HTTP agent service in `server.js`
- a dedicated voice WebSocket server in `voiceServer.js`

### AI layer stack

Dependencies in [`ai_agent/package.json`](/home/spidy/Desktop/projects/Mathadu-Manju/ai_agent/package.json):

- `express`
- `cors`
- `axios`
- `dotenv`
- `groq-sdk`
- `ws`
- `@deepgram/sdk`

The project uses ES modules via `"type": "module"`.

### Configuration

[`ai_agent/config.js`](/home/spidy/Desktop/projects/Mathadu-Manju/ai_agent/config.js) loads:

- `DJANGO_API`
- `PORT`

Additional required environment variables:

- `GROQ_API_KEY`
- `DEEPGRAM_API_KEY`

Example `ai_agent/.env`:

```env
DJANGO_API=http://127.0.0.1:8000
PORT=5000
GROQ_API_KEY=your_groq_key
DEEPGRAM_API_KEY=your_deepgram_key
```

### Main AI modules

#### `ai_agent/server.js`

This is the HTTP service.

Routes:

- `GET /health`
- `GET /tools`
- `POST /voice-agent`

`POST /voice-agent` accepts:

```json
{
  "message": "what is the status of shipment A001",
  "role": "manager"
}
```

or:

```json
{
  "message": "what is my next delivery",
  "role": "driver",
  "driver_id": "D001"
}
```

This route is useful for text-level testing without running the full voice pipeline.

#### `ai_agent/agentController.js`

This file contains the main LLM orchestration logic.

Responsibilities:

- chooses the system prompt based on `role`
- passes the allowed tool definitions to Groq
- lets the model decide whether to emit a tool call
- executes the first returned tool call
- formats backend results into short spoken text
- blocks unsafe free-text operational responses

Current model:

- `llama-3.1-8b-instant`

Current safeguards:

- low-signal utterances like `hi`, `ok`, `again` are rejected
- operational words like `shipment`, `delivery`, `incident`, `delay` trigger a safe fallback if Groq does not return a tool call
- after a tool executes, the final user-facing text is generated locally by `formatToolResult()`, not by a second LLM round

This is the main anti-hallucination control point in the project.

#### `ai_agent/toolLoader.js`

This module defines the tool schemas available to each role.

Driver tools:

- `get_next_delivery`
- `get_assigned_shipments`
- `get_shipment_status`
- `update_shipment_status`
- `report_delay`
- `report_incident`
- `resolve_incident`

Manager tools:

- `dashboard_stats`
- `query_shipments`
- `query_incidents`
- `update_shipment_status`
- `assign_driver`

The current implementation loads tools from local definitions rather than fetching them from Django at runtime.

#### `ai_agent/toolExecutor.js`

This module maps tool names to Django endpoints and executes them via Axios.

Important behavior:

- enforces role-based access control before calling Django
- automatically injects `driver_id` for driver role requests
- handles both `GET` and `POST` endpoint patterns
- turns structured backend results into compact spoken responses

Examples of formatted output:

- `Shipment A001 has been marked as delivered.`
- `Your next delivery is shipment A004 to Warehouse 2.`
- `There are 3 deliveries completed, 1 delayed shipments, and 2 incidents.`

#### `ai_agent/groqClient.js`

Initializes the Groq SDK using `GROQ_API_KEY`.

#### `ai_agent/voiceServer.js`

This is the real-time voice gateway for the browser client.

Responsibilities:

- accepts browser WebSocket connections on port `4000`
- stores role and `driver_id` on the WebSocket session
- receives binary microphone chunks
- forwards those chunks to Deepgram STT
- normalizes the returned transcript
- calls `runAgent()`
- converts response text to speech
- sends synthesized audio back to the browser

The `session_init` message is important here because it binds the voice stream to either:

- a driver session with `driver_id`
- a manager session without driver identity

The server also de-duplicates repeated transcripts so the same final utterance is not handled twice.

## Detailed Audio Pipeline

This is the most important technical path in the project.

### Audio to text: browser mic to transcript

The speech-to-text flow is implemented across:

- [`dispatch-pwa/src/services/microphone.ts`](/home/spidy/Desktop/projects/Mathadu-Manju/dispatch-pwa/src/services/microphone.ts)
- [`dispatch-pwa/src/services/voiceSocket.ts`](/home/spidy/Desktop/projects/Mathadu-Manju/dispatch-pwa/src/services/voiceSocket.ts)
- [`ai_agent/voiceServer.js`](/home/spidy/Desktop/projects/Mathadu-Manju/ai_agent/voiceServer.js)
- [`ai_agent/streamingSTT.js`](/home/spidy/Desktop/projects/Mathadu-Manju/ai_agent/streamingSTT.js)

#### Step 1: browser captures audio

When the user starts a call, the frontend:

- requests microphone permission
- creates a `MediaRecorder`
- uses an Opus-capable MIME type if available
- emits chunks every `250` milliseconds

Each emitted `Blob` is sent directly over the active WebSocket.

#### Step 2: browser sends audio over WebSocket

The frontend sends raw binary blobs to the voice server. No client-side speech processing happens in the browser.

This keeps the frontend lightweight and puts the speech logic on the server side.

#### Step 3: Node voice server receives chunks

In `voiceServer.js`, every non-JSON socket message is treated as an audio chunk.

The server:

- counts incoming chunks for logging
- converts each message to a `Buffer`
- forwards it to the live STT stream object created by `createSTTStream(...)`

The voice server also accepts JSON messages for session control. Right now the key control message is `session_init`.

#### Step 4: Deepgram streaming STT connection

`streamingSTT.js` opens a live WebSocket connection to Deepgram using:

- model: `nova-3`
- language: `en-US`
- `numerals=true`
- `smart_format=true`
- `interim_results=true`
- `encoding=opus`
- `container=webm`
- `channels=1`

These parameters matter:

- `encoding=opus` and `container=webm` align with the browser `MediaRecorder` output
- `numerals=true` helps convert spoken number sequences into machine-friendly forms
- `smart_format=true` improves transcription readability

If browser audio arrives before Deepgram is fully open, the code temporarily stores chunks in `pendingChunks` and flushes them after connection open.

#### Step 5: transcript finalization

The STT handler listens for Deepgram `Results` messages and extracts:

- `msg.channel.alternatives[0].transcript`
- `msg.is_final`
- `msg.speech_final`

Only final or speech-final transcripts are forwarded to the agent callback. This avoids responding to every partial interim result.

#### Step 6: transcript normalization

Before the text is given to the agent, `voiceServer.js` normalizes common speech-recognition issues:

- `ship ment` -> `shipment`
- `shipping` -> `shipment`
- `soupment` -> `shipment`
- `shipment id` -> `shipment`
- `shipment number` -> `shipment`
- `a 0 0 4` -> `a004`
- `a 1 0 4` -> `a104`
- filler words such as `please`, `hey`, `ok`, `okay`, `can you`, `could you` are removed

This normalization step is important because shipment IDs and operational commands are short and easy for STT systems to mis-segment.

#### Step 7: agent processing after transcription

After normalization, the transcript is sent to `runAgent()` with:

- `message`
- `role`
- `driver_id`

That means the same transcript can lead to different allowed actions depending on whether the session belongs to a driver or a manager.

### Text to audio: response text to spoken reply

The text-to-speech flow is implemented across:

- [`ai_agent/agentController.js`](/home/spidy/Desktop/projects/Mathadu-Manju/ai_agent/agentController.js)
- [`ai_agent/streamingTTS.js`](/home/spidy/Desktop/projects/Mathadu-Manju/ai_agent/streamingTTS.js)
- [`ai_agent/voiceServer.js`](/home/spidy/Desktop/projects/Mathadu-Manju/ai_agent/voiceServer.js)
- [`dispatch-pwa/src/App.tsx`](/home/spidy/Desktop/projects/Mathadu-Manju/dispatch-pwa/src/App.tsx)

#### Step 1: agent returns final response text

`runAgent()` returns a plain string, for example:

- `Shipment A001 has been marked as delivered.`
- `Your next delivery is shipment A004 to Warehouse 2.`
- `I need to retrieve that information from the logistics system.`

This string is the only thing passed into TTS.

#### Step 2: Node calls Deepgram Speak API

`streamingTTS.js` sends an HTTP `POST` request to:

```text
https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&container=wav
```

Request body:

```json
{
  "text": "Shipment A001 has been marked as delivered."
}
```

The request includes:

- `Authorization: Token <DEEPGRAM_API_KEY>`
- `Content-Type: application/json`

#### Step 3: TTS response format

Deepgram returns synthesized audio as binary data.

The code:

- reads it with `response.arrayBuffer()`
- converts it to a Node `Buffer`
- logs byte length for debugging

The chosen output format is:

- audio encoding: `linear16`
- container: `wav`

This choice makes browser playback straightforward because WAV is easy to hand back to `Audio(...)`.

#### Step 4: server sends audio bytes back to the browser

`voiceServer.js` sends the TTS buffer directly over the same WebSocket connection.

The browser treats incoming binary data as an `ArrayBuffer` or `Blob`, converts it into a WAV blob, creates an object URL, and plays it.

#### Step 5: browser playback

In `App.tsx`, the client:

- stops and cleans up any previously playing audio
- creates a new `Audio` object from the returned WAV blob
- plays it using `audio.play()`

This gives the app a full duplex-feeling experience even though the current implementation is turn-based:

- user speaks
- server waits for final transcript
- agent responds
- server returns synthesized reply audio

### Audio pipeline summary

```text
Mic
-> MediaRecorder (webm/opus)
-> WebSocket
-> Node voice server
-> Deepgram STT
-> normalized transcript
-> runAgent()
-> backend tool execution if needed
-> final text
-> Deepgram TTS (wav/linear16)
-> WebSocket
-> browser audio playback
```

## Role Model and Access Control

The system has two roles.

### Driver role

Drivers can:

- get next delivery
- get assigned shipments
- check shipment status
- mark shipments delivered or in transit
- report delays
- report incidents
- resolve incidents

Drivers cannot:

- access dashboard analytics
- query warehouse-wide incidents
- assign drivers

This restriction is enforced in `toolExecutor.js`, not only in prompts.

### Manager role

Managers can:

- view dashboard stats
- query shipments
- query incidents
- update shipment status
- assign drivers

## End-to-End Examples

### Example 1: driver marks a shipment delivered

Spoken input:

```text
Shipment A001 delivered
```

Flow:

1. Browser records and streams audio.
2. Deepgram returns final transcript.
3. Transcript is normalized.
4. `runAgent()` asks Groq to choose a tool.
5. Groq emits `update_shipment_status`.
6. Node calls Django `POST /api/update-shipment-status`.
7. Django updates the shipment.
8. Node formats the result text.
9. Deepgram synthesizes the text.
10. Browser plays the reply audio.

### Example 2: driver reports a puncture

Spoken input:

```text
There is a puncture in shipment A103
```

Flow:

1. Transcript reaches the agent.
2. Groq chooses `report_incident`.
3. Django creates an `Incident`.
4. Backend assigns technician support for `tire_puncture` if that exact incident type is sent.
5. Result is formatted into spoken text and returned as audio.

### Example 3: manager asks for dashboard stats

Spoken input:

```text
Give me the dashboard stats
```

Flow:

1. Manager session transcript reaches `runAgent()`.
2. Groq chooses `dashboard_stats`.
3. Node calls Django dashboard API.
4. Response is formatted into a short summary.
5. TTS converts the summary into audio.

## Manual Testing

### Run the backend

```bash
cd logistics_agent
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

### Run the AI HTTP service

```bash
cd ai_agent
npm install
node server.js
```

### Run the voice WebSocket server

```bash
cd ai_agent
node voiceServer.js
```

### Run the frontend

```bash
cd dispatch-pwa
npm install
npm run dev
```

### Minimal voice client

[`test_clients/voice_test.html`](/home/spidy/Desktop/projects/Mathadu-Manju/test_clients/voice_test.html) is a stripped-down browser client for microphone streaming tests. It is useful for quick connection checks, but it does not implement the full session setup or playback behavior of the React app.

## Current Implementation Notes

- The root README previously described some older behavior; this version reflects the current code.
- `intentParser.js` and `toolRouter.js` contain transcript parsing helpers, but they are not on the active runtime path in the current `voiceServer.js` and `server.js` flow.
- `toolLoader.js` currently defines tools locally instead of fetching them from Django at startup.
- The backend test file is still a placeholder.
- `shipments/models.py` contains duplicated `Incident` field declarations at the bottom of the class; Django migration state is still the effective source of truth, but the file should be cleaned up.
- The voice pipeline is turn-based, not full duplex conversational streaming.
- Browser driver selection currently exposes only three hardcoded driver choices in the UI even though seed data creates five drivers.

## Improvement Opportunities

- Add backend API tests for shipment, delay, and incident flows.
- Add integration tests for WebSocket voice sessions.
- Remove unused agent helper files or wire them in intentionally.
- Align `toolLoader.js` with the backend `agent-tools` endpoint if a single source of truth is desired.
- Add stronger serializer validation for allowed incident types and shipment statuses.
- Persist conversation/session history if multi-turn voice interactions are required.
- Add better UI feedback for recording state, STT state, and agent processing state.

## Summary

Mathadu-Manju is a practical logistics voice agent architecture where Django owns the operational truth, Node owns orchestration and speech integration, and the React frontend provides the user-facing call experience. The most important implementation detail is the audio pipeline: browser audio is captured as WebM/Opus, transcribed by Deepgram STT, normalized and routed through the agent/tool layer, converted back to speech with Deepgram TTS as WAV, and played in the browser as the final response.
