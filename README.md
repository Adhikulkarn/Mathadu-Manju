# Mathadu-Manju

Mathadu-Manju is a logistics voice-agent project split into two cooperating applications:

1. A Django REST backend in `logistics_agent/` that stores shipment, driver, delay, and incident data in SQLite and exposes operational APIs.
2. A Node.js AI and voice layer in `ai_agent/` that accepts driver messages, decides whether to use a direct intent shortcut or the Groq LLM, calls backend tools, and returns spoken responses through Deepgram TTS.

The core design goal of the project is operational safety: shipment data, delivery assignments, incident details, and dashboard metrics must come from Django APIs, not from free-form LLM text.

## High-Level Architecture

The system is organized around a hybrid agent pattern:

```text
Driver Voice / Text
        |
        v
Deepgram Streaming STT or HTTP message input
        |
        v
Intent Shortcut Layer (regex-based)
        |
        +--> direct tool execution for simple operational commands
        |
        v
Groq LLM reasoning for non-trivial requests
        |
        v
Tool execution layer in Node.js
        |
        v
Django REST API
        |
        v
SQLite database
        |
        v
Structured backend response
        |
        v
Local response formatter in Node.js
        |
        v
Deepgram TTS audio buffer
```

There are two important safety rules in the current implementation:

- Simple operational commands should bypass the LLM entirely and go straight to backend tools.
- If the LLM receives an operational query but does not return a valid tool call, the Node agent blocks the answer instead of allowing logistics hallucinations.

## Repository Layout

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
│   └── voiceServer.js
├── logistics_agent/
│   ├── db.sqlite3
│   ├── logistics_agent/
│   │   ├── asgi.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── manage.py
│   ├── requirements.txt
│   └── shipments/
│       ├── admin.py
│       ├── apps.py
│       ├── management/commands/seed_data.py
│       ├── migrations/
│       ├── models.py
│       ├── serializers.py
│       ├── tests.py
│       ├── urls.py
│       └── views.py
└── test_clients/
    └── voice_test.html
```

## Django Backend: `logistics_agent/`

The Django application is the source of truth for all logistics state. It contains the database models, request validation, business rules, and REST endpoints that the Node agent calls.

### Backend Stack

- Django 6
- Django REST Framework
- `django-cors-headers`
- SQLite

Dependencies are listed in `logistics_agent/requirements.txt`.

### Django Project Configuration

The Django project package is `logistics_agent/logistics_agent/`.

- `settings.py` enables `rest_framework`, `corsheaders`, and the local `shipments` app.
- `CORS_ALLOW_ALL_ORIGINS = True` allows the Node layer and browser-based test clients to call the API during development.
- The default database is SQLite at `logistics_agent/db.sqlite3`.
- Root URL routing in `logistics_agent/logistics_agent/urls.py` mounts all shipment endpoints under `/api/`.

### Data Model

The logistics domain is implemented in `logistics_agent/shipments/models.py`.

#### `Driver`

Represents a delivery driver and stores:

- `driver_id`
- `name`
- `phone`
- `vehicle_number`

Each `Shipment` can be assigned to a `Driver`.

#### `Shipment`

Represents a delivery item or job and stores:

- `shipment_id`
- `destination`
- `driver`
- `status`
- timestamps for creation and update

Supported shipment statuses are:

- `pending`
- `in_transit`
- `delivered`
- `delayed`
- `incident`

This is the central object used by most APIs.

#### `DelayReport`

Represents an operational delay reported against a shipment. It stores:

- a foreign key to `Shipment`
- `reason`
- `reported_at`

When a delay is reported, the shipment status is also updated to `delayed`.

#### `Incident`

Represents operational problems such as punctures or package damage. It stores:

- a foreign key to `Shipment`
- `incident_type`
- `description`
- `status`
- `support_person`
- `eta_minutes`
- `reported_at`

Supported incident statuses are:

- `reported`
- `assistance_dispatched`
- `resolved`

When incidents are reported, the backend may also attach support assignment details such as a technician name and ETA.

### Serializers

Request validation lives in `logistics_agent/shipments/serializers.py`.

- `ShipmentStatusUpdateSerializer` validates `shipment_id` and `status`
- `DelayReportSerializer` validates `shipment_id` and `reason`
- `IncidentSerializer` validates `shipment_id`, `incident_type`, and `description`
- `ShipmentSerializer` exposes the full shipment model when needed

The serializers are intentionally simple and act mainly as input validation for API endpoints.

### API Endpoints

All backend endpoints are defined in `logistics_agent/shipments/views.py` and routed in `logistics_agent/shipments/urls.py`.

#### `POST /api/update-shipment-status`

Purpose:
- Marks a shipment with a new status.

Expected payload:

```json
{
  "shipment_id": "A101",
  "status": "delivered"
}
```

Behavior:
- validates the request
- looks up the shipment
- updates `Shipment.status`
- returns a success response with the action performed

#### `POST /api/report-delay`

Purpose:
- Records a delay and updates the shipment status to `delayed`.

Expected payload:

```json
{
  "shipment_id": "A102",
  "reason": "Traffic congestion"
}
```

Behavior:
- validates input
- creates a `DelayReport`
- marks the shipment as `delayed`
- returns confirmation data

#### `POST /api/report-incident`

Purpose:
- Records operational incidents.

Expected payload:

```json
{
  "shipment_id": "A103",
  "incident_type": "tire_puncture",
  "description": "Rear tire puncture on highway"
}
```

Behavior:
- validates the request
- finds the shipment
- creates an `Incident`
- updates shipment status to `incident`
- applies simple business rules for support dispatch

Current incident-specific logic includes:

- `tire_puncture` -> assigns `Ramesh (Technician)` with ETA `20`
- `engine_failure` -> assigns `Mahesh (Recovery Vehicle)` with ETA `40`
- `package_damage` -> returns a warehouse-support message
- any other type -> generic support notification message

#### `POST /api/resolve-incident/`

Purpose:
- Marks the most recent active incident as resolved and resumes the shipment.

Expected payload:

```json
{
  "shipment_id": "A103"
}
```

Behavior:
- finds the shipment
- locates the latest incident with status `reported` or `assistance_dispatched`
- updates the incident to `resolved`
- changes the shipment back to `in_transit`

#### `GET /api/shipment-status/<shipment_id>/`

Purpose:
- Returns the current status and destination of a specific shipment.

Example response shape:

```json
{
  "success": true,
  "action": "get_shipment_status",
  "shipment_id": "A101",
  "status": "in_transit",
  "destination": "Warehouse 2"
}
```

#### `GET /api/next-delivery/<driver_id>/`

Purpose:
- Returns the next non-delivered and non-incident shipment assigned to a driver.

Behavior:
- filters shipments for the given driver
- excludes shipments with status `delivered` and `incident`
- orders by `created_at`
- returns the first matching shipment

If nothing is pending, the API returns a message indicating no pending deliveries.

#### `GET /api/dashboard/stats`

Purpose:
- Provides simple operational summary counts for the dashboard.

Returned metrics:

- `total_shipments`
- `delivered`
- `delayed`
- `incidents`

#### `GET /api/agent-tools/`

Purpose:
- Returns tool definitions in LLM function-calling format.

This endpoint is critical because the Node agent loads it at startup and uses it as the tool catalog for Groq. It describes:

- `update_shipment_status`
- `report_delay`
- `report_incident`
- `resolve_incident`
- `get_shipment_status`
- `get_next_delivery`
- `dashboard_stats`

### Seed Data

Demo data generation is implemented in `logistics_agent/shipments/management/commands/seed_data.py`.

The command:

- creates 5 drivers with IDs `D001` to `D005`
- creates 20 shipments with IDs `A001` to `A020`
- assigns random statuses from `pending`, `in_transit`, `delivered`, and `delayed`
- randomly assigns those shipments to created drivers

This is useful for local testing of the voice and tool flows.

Typical usage:

```bash
cd logistics_agent
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

### Backend Testing State

`logistics_agent/shipments/tests.py` currently contains only the default placeholder test file, so the backend does not yet have meaningful automated coverage.

## Node AI Layer: `ai_agent/`

The Node application is the orchestration layer between user input and the Django backend. It has two modes:

- an HTTP agent service in `server.js`
- a WebSocket voice pipeline in `voiceServer.js`

### Node Stack

Dependencies in `ai_agent/package.json` include:

- `express`
- `cors`
- `axios`
- `dotenv`
- `groq-sdk`
- `ws`
- `@deepgram/sdk`

The project uses ES modules via `"type": "module"`.

### Configuration

`ai_agent/config.js` loads environment variables and exports:

- `DJANGO_API`
- `PORT`

Other required environment variables used across the voice layer are:

- `GROQ_API_KEY`
- `DEEPGRAM_API_KEY`

### Core Node Modules

#### `toolLoader.js`

Responsibilities:

- fetches the tool catalog from `GET <DJANGO_API>/api/agent-tools`
- stores the loaded tool definitions in memory
- exposes `loadTools()` and `getTools()`

This module lets the LLM operate against the exact tool inventory declared by Django rather than a hardcoded copy in Node.

#### `toolExecutor.js`

Responsibilities:

- maps logical tool names to Django endpoints
- performs HTTP requests with Axios
- logs each execution for traceability

Current tool mapping includes:

- `update_shipment_status` -> `POST /api/update-shipment-status`
- `report_delay` -> `POST /api/report-delay`
- `report_incident` -> `POST /api/report-incident`
- `resolve_incident` -> `POST /api/resolve-incident/`
- `get_shipment_status` -> `GET /api/shipment-status/<shipment_id>/`
- `get_next_delivery` -> `GET /api/next-delivery/<driver_id>/`
- `dashboard_stats` -> `GET /api/dashboard/stats`

Important runtime logging now includes:

- `Executing tool: <toolName>`
- `Arguments: <args>`
- `Tool result: <response.data>`

Those logs are important when verifying that Django APIs are truly being hit instead of the LLM fabricating answers.

#### `intentParser.js`

Responsibilities:

- normalizes STT transcripts
- detects simple operational commands
- returns direct tool invocations without consulting the LLM

Normalization currently handles:

- spoken digits `zero` through `nine`
- common STT mistakes such as `soupment` -> `shipment`
- split-word recognition such as `ship ment` -> `shipment`
- spoken shipment forms like `a one zero three` -> `a103`

Intent rules currently cover:

- `shipment <id> delivered` -> `update_shipment_status`
- `shipment <id> delayed` -> `report_delay`
- `puncture` or `incident` with a shipment ID -> `report_incident`
- `next delivery` -> `get_next_delivery`
- `shipment status <id>` and `shipment <id> status` -> `get_shipment_status`
- `dashboard update` and `dashboard stats` -> `dashboard_stats`

This file is central to low-latency, non-LLM operational handling.

#### `agentController.js`

Responsibilities:

- sends non-shortcut messages to Groq
- passes the Django tool schema to the model
- executes returned tool calls
- blocks unsafe operational free-text responses
- formats backend tool results into spoken text locally

This file is the core anti-hallucination control point.

Important safety behavior in the current version:

- operational keywords are detected with `shipment`, `delivery`, `incident`, `delay`, and `dashboard`
- if Groq returns no `tool_calls` for an operational query, the agent returns the safe fallback:
  - `I need to retrieve that information from the logistics system.`
- after a tool call is executed, the response is generated by local formatting code, not by a second LLM pass

This means the current implementation no longer allows the LLM to invent logistics facts after tool execution.

#### `groqClient.js`

Responsibilities:

- initializes the Groq SDK
- reads the API key from `GROQ_API_KEY`
- exports the reusable client instance

#### `server.js`

Responsibilities:

- starts an Express API service
- loads Django tool definitions at startup
- exposes:
  - `GET /health`
  - `GET /tools`
  - `POST /voice-agent`

`POST /voice-agent` accepts a JSON body with a `message`, forwards it to `runAgent()`, and returns a JSON reply.

This is useful for text-level testing without running the voice pipeline.

#### `streamingSTT.js`

Responsibilities:

- connects to Deepgram’s live transcription WebSocket
- forwards audio chunks from the browser or client
- listens for final transcripts only
- invokes the provided callback with final transcript text

The current Deepgram model configured here is `nova-3`.

#### `streamingTTS.js`

Responsibilities:

- sends text to Deepgram’s `speak` endpoint
- receives synthesized audio
- returns it as a `Buffer`

This is important because the voice server must treat TTS output as a buffer, not as a Node stream.

#### `voiceServer.js`

Responsibilities:

- accepts incoming WebSocket audio from a client
- streams audio to Deepgram STT
- de-duplicates repeated transcripts
- runs `detectIntent()` first
- calls Django tools directly for shortcut intents
- falls back to `runAgent()` only when no shortcut matches
- converts the final response text to audio with Deepgram TTS
- sends the audio buffer back to the client

Current behavior:

- shortcut flow: direct Django API execution and local formatting
- complex flow: Groq tool call, Django API execution, local formatting
- operational no-tool LLM response: blocked

### Test Client

`test_clients/voice_test.html` is a minimal browser client for manual microphone testing.

It:

- opens a WebSocket connection to `ws://localhost:4000`
- requests microphone access
- streams audio chunks using `MediaRecorder`

This file is useful for quick manual verification of the voice server path.

## End-to-End Runtime Flow

### Text Mode

Used when interacting with the HTTP service in `ai_agent/server.js`.

```text
Client -> POST /voice-agent -> runAgent() -> tool call if needed -> Django API -> JSON reply
```

### Voice Mode

Used when interacting with `ai_agent/voiceServer.js`.

```text
Browser mic
-> WebSocket audio
-> Deepgram STT
-> transcript
-> detectIntent()
-> direct tool execution or runAgent()
-> Django API
-> local response formatting
-> Deepgram TTS
-> audio buffer back to client
```

### Example Flows

#### Simple operational command

Input:

```text
Shipment A101 delivered
```

Expected route:

```text
STT -> intentParser -> update_shipment_status -> Django -> TTS
```

#### Shipment lookup

Input:

```text
What is the shipment status A103?
```

Expected route:

```text
STT -> intentParser -> get_shipment_status -> Django -> TTS
```

#### Incident report

Input:

```text
There is a tire puncture in shipment A103
```

Possible route:

```text
STT -> intentParser or LLM tool call -> report_incident -> Django -> TTS
```

#### Dashboard query

Input:

```text
Give me the dashboard stats
```

Expected route:

```text
STT -> intentParser -> dashboard_stats -> Django -> TTS
```

## Current Hallucination Controls

The project has explicit safeguards to stop fake logistics outputs:

- direct regex shortcuts for common operational commands
- Groq tool schemas loaded from Django
- strict operational keyword block when no tool call is returned
- no second LLM summarization after tool execution
- deterministic response formatting from backend payloads
- tool execution logs in Node for auditing

This means the LLM is still present for reasoning, but logistics facts should be sourced from APIs rather than model memory.

## Local Setup

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

### Node agent setup

Create `ai_agent/.env` with values similar to:

```env
DJANGO_API=http://127.0.0.1:8000
PORT=5000
GROQ_API_KEY=your_groq_key
DEEPGRAM_API_KEY=your_deepgram_key
```

Then install and run:

```bash
cd ai_agent
npm install
npm start
```

### Voice server setup

Run the dedicated voice server separately when testing streaming audio:

```bash
cd ai_agent
node voiceServer.js
```

Then open `test_clients/voice_test.html` in a browser and start microphone streaming.

## Current Limitations And Notes

- The backend test suite is effectively empty.
- The project uses SQLite and development-oriented settings.
- `ALLOWED_HOSTS` is empty and `DEBUG` is enabled, so the Django setup is not production-ready.
- The root project contains both a text agent service and a separate voice WebSocket service in Node.
- `get_next_delivery` currently uses a hardcoded driver ID `D001` in the shortcut parser.
- `shipments/models.py` contains duplicated field declarations at the bottom of `Incident`; Django migration state is authoritative, but the file would benefit from cleanup.

## Recommended Next Improvements

- add proper backend and Node integration tests
- remove hardcoded driver assumptions from `intentParser.js`
- add structured response templates per tool instead of generic key-value formatting
- improve frontend or test-client playback so returned TTS audio is played automatically
- harden production configuration, secrets, CORS, and deployment settings
- add explicit validation for supported incident types at the serializer layer

## Summary

Mathadu-Manju is a hybrid logistics voice assistant where Django owns the operational data and Node owns orchestration, voice integration, and controlled LLM usage. The project is already structured around a sound principle: logistics facts should come from backend tools, while the LLM should be limited to tool selection and limited reasoning only when direct intent shortcuts do not apply.
