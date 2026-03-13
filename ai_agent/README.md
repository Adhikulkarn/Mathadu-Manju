# AI Agent

## Project Summary

This project is a lightweight Node.js and Express service that acts as an AI-agent bridge for a Django backend. It loads tool definitions from Django at startup, exposes endpoints to inspect available tools, and executes mapped backend actions through HTTP requests.

The current implementation is intentionally simple and uses placeholder routing logic in the `/voice-agent` endpoint. When an incoming message contains the word `delivered`, the service calls the `update_shipment_status` tool with hardcoded arguments. All other messages currently return a generic acknowledgement.

## Core Flow

1. The server starts with Express and enables CORS and JSON request parsing.
2. On startup, it fetches tool metadata from the Django API.
3. Clients can query the loaded tools through `GET /tools`.
4. Clients can send a message to `POST /voice-agent`.
5. The agent applies temporary message-based logic and, if matched, calls a mapped Django tool endpoint.

## API Endpoints

### `GET /health`

Returns the service health status.

### `GET /tools`

Returns the tool definitions loaded from the Django backend.

### `POST /voice-agent`

Accepts a JSON payload like:

```json
{
  "message": "shipment delivered"
}
```

Current behavior:

- If the message includes `delivered`, it executes `update_shipment_status` with:
  - `shipment_id: "A101"`
  - `status: "delivered"`
- Otherwise it returns `"Command received"`.

## Tool Integration

The service currently maps these logical tool names to Django API routes:

- `update_shipment_status` -> `/api/update-shipment-status`
- `report_delay` -> `/api/report-delay`
- `report_incident` -> `/api/report-incident`
- `resolve_incident` -> `/api/resolve-incident`
- `get_shipment_status` -> `/api/shipment-status`
- `get_next_delivery` -> `/api/next-delivery`

## Environment Variables

Create a `.env` file with:

```env
DJANGO_API=http://your-django-server
PORT=5000
```

- `DJANGO_API`: Base URL of the Django backend that provides tool metadata and action endpoints.
- `PORT`: Port used by this Express server. Defaults to `5000`.

## Installation And Run

```bash
npm install
npm start
```

The app entry point is `server.js`.

## Dependencies

- `express`: HTTP server and routing
- `cors`: Cross-origin request support
- `axios`: Outbound HTTP client for Django API calls
- `dotenv`: Environment variable loading

## File Structure

```text
ai_agent/
|-- .env
|-- README.md
|-- config.js
|-- package.json
|-- package-lock.json
|-- server.js
|-- toolExecutor.js
|-- toolLoader.js
`-- node_modules/
```

## File Responsibilities

- `server.js`: Starts the Express app, loads tools on boot, and exposes the HTTP endpoints.
- `toolLoader.js`: Fetches available tool definitions from the Django backend and stores them in memory.
- `toolExecutor.js`: Maps logical tool names to Django endpoints and executes those calls.
- `config.js`: Loads environment variables and exports runtime configuration.
- `package.json`: Project metadata, dependencies, and start script.
- `.env`: Local environment configuration.

## Current Limitations

- No LLM integration yet; tool execution uses hardcoded keyword matching.
- Error handling is basic and mostly returns a generic `500` response.
- Tool metadata is only loaded once at startup.
- No tests or validation layer are present in the current codebase.
