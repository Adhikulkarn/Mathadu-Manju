import groq from "./groqClient.js"
import { getToolsForRole } from "./toolLoader.js"
import { executeTool, formatToolResult } from "./toolExecutor.js"

const SYSTEM_PROMPTS = {
  driver: `You are a logistics assistant helping a delivery driver.

You can:
show assigned shipments
get next delivery
update shipment status
report delays
report incidents
resume delivery after incidents

Drivers cannot access warehouse analytics.
Interpret natural driver language and use tools whenever a request maps to an operational action.

Examples:
- "which deliveries do i need to make today" -> get_assigned_shipments
- "what are my deliveries for today" -> get_assigned_shipments
- "what is my next stop" -> get_next_delivery
- "i delivered order a001" -> update_shipment_status with delivered
- "order a005 is delayed because of traffic" -> report_delay
- "there is a puncture on a001" -> report_incident
- "the incident on a001 is solved" -> resolve_incident

If a request is about deliveries, shipments, orders, status, delays, or incidents, prefer tool use over a generic text reply.
Keep driver responses short and operational.`,
  manager: `You are a warehouse operations assistant.

You help managers:
view dashboard statistics
list shipments
list incidents
inspect exact shipment status and destination
inspect exact incident details and reasons
update shipment status
assign drivers
assign technicians to incidents
resolve incidents

Interpret natural manager language and use tools whenever a request maps to operational or dashboard data.

Examples:
- "what is happening on the dashboard right now" -> dashboard_stats
- "how many delayed shipments do we have" -> dashboard_stats or query_shipments with delayed filter
- "where is shipment a007 going" -> get_shipment_status or query_shipments with shipment_id
- "what is the exact incident on a004" -> query_incidents with shipment_id
- "who is handling shipment a001" -> query_shipments with shipment_id
- "assign shipment a004 to driver d002" -> assign_driver
- "assign technician ramesh to the incident on a004" -> assign_incident_technician
- "mark shipment a004 as delivered" -> update_shipment_status
- "mark shipment a001 delivered" -> update_shipment_status
- "has the incident on a001 been resolved" -> query_incidents with shipment_id
- "resolve the incident on a001" -> resolve_incident

If a request asks for any dashboard detail, shipment detail, incident detail, assignment detail, delay detail, or operational count, prefer tool use over a generic text reply.
If one tool does not contain enough information, choose the closest relevant tool and answer from its result.`
}
const OPERATIONAL_QUERY_REGEX =
  /\b(shipment|shipments|order|orders|delivery|deliver\w*|dispatch\w*|incident|delay(?:ed)?|status|assigned|next|traffic|puncture|breakdown|damage)\b/i
const SAFE_OPERATIONAL_FALLBACK = "I need to retrieve that information from the logistics system."
const LOW_SIGNAL_MESSAGE_REGEX =
  /^(?:hi|hello|hey|okay|ok|yes|no|hmm|hm|uh|um|repeat|again|haan|ha|hmm+|ah|oh)\b[\s.!?]*$/i
const SPOKEN_DIGIT_MAP = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9"
}

const TECHNICIAN_NAME_REGEX =
  /\b(?:assign|assigned|send)\s+([a-z][a-z\s().-]*?)\s+(?:as\s+)?(?:support person|support|technician)\b/i

function stripToolNarration(text = "") {
  return text
    .replace(/\b(?:calling|executing|running tool)\b[^.!?\n]*[.!?\n]*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function getSystemPrompt(role) {
  return SYSTEM_PROMPTS[role] ?? SYSTEM_PROMPTS.manager
}

function normalizeVoiceMessage(message = "") {
  let text = message.toLowerCase().trim()

  text = text.replace(/^(?:okay|ok|hey|hello|so|well)\b[\s,.-]*/g, "")
  text = text.replace(/\bactive ingredients\b/g, "active incidents")
  text = text.replace(/\bingredients\b/g, "incidents")
  text = text.replace(/\bdelivary\b/g, "delivery")
  text = text.replace(/\bdelivaries\b/g, "deliveries")
  text = text.replace(/\bdeliverys\b/g, "deliveries")
  text = text.replace(/\bdispatment\b/g, "dispatch")
  text = text.replace(/\bdispatchment\b/g, "dispatch")
  text = text.replace(/\b(order|shipment)\s+number\b/g, "$1")
  text = text.replace(/\ba\s+is\s+(\d{3})\b/g, "a$1")
  text = text.replace(/\ba\s+0\s+0\s+(\d)\b/g, "a00$1")
  text = text.replace(/\ba\s+(\d)\s+(\d)\s+(\d)\b/g, "a$1$2$3")

  text = text.replace(
    /\ba\s+(zero|oh|one|two|three|four|five|six|seven|eight|nine)\s+(zero|oh|one|two|three|four|five|six|seven|eight|nine)\s+(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g,
    (_, d1, d2, d3) => `a${SPOKEN_DIGIT_MAP[d1]}${SPOKEN_DIGIT_MAP[d2]}${SPOKEN_DIGIT_MAP[d3]}`
  )

  text = text.replace(/\s+/g, " ").trim()
  return text
}

function extractShipmentId(message = "") {
  const upperText = message.toUpperCase()
  const directMatch = upperText.match(/\b[A-Z]\d{3}\b/)

  if (directMatch) {
    return directMatch[0]
  }

  const compactMatch = upperText.match(/\b([A-Z])[\s-]?(\d)[\s-]?(\d)[\s-]?(\d)\b/)

  if (compactMatch) {
    return `${compactMatch[1]}${compactMatch[2]}${compactMatch[3]}${compactMatch[4]}`
  }

  return null
}

function extractTechnicianName(message = "") {
  const match = message.match(TECHNICIAN_NAME_REGEX)

  if (!match) {
    return null
  }

  return match[1]
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function isLowSignalMessage(message, role) {
  if (!message || message.length < 3 || LOW_SIGNAL_MESSAGE_REGEX.test(message)) {
    return true
  }

  const shipmentId = extractShipmentId(message)
  const hasOperationalKeywords = OPERATIONAL_QUERY_REGEX.test(message)
  const wordCount = message.split(/\s+/).filter(Boolean).length

  if (shipmentId || hasOperationalKeywords) {
    return false
  }

  if (wordCount <= 4) {
    return true
  }

  return false
}

function inferDirectIntent(message, role, driver_id) {
  const shipmentId = extractShipmentId(message)

  if (
    role === "manager" &&
    shipmentId &&
    /\b(incident|issue|problem)\b/.test(message) &&
    /\b(resolved|solve[sd]?|fixed|closed)\b/.test(message)
  ) {
    return {
      toolName: "resolve_incident",
      args: {
        shipment_id: shipmentId
      }
    }
  }

  if (
    role === "manager" &&
    shipmentId &&
    /\b(assign|assigned|send)\b/.test(message) &&
    /\b(technician|support person|support)\b/.test(message)
  ) {
    const supportPerson = extractTechnicianName(message)

    if (supportPerson) {
      return {
        toolName: "assign_incident_technician",
        args: {
          shipment_id: shipmentId,
          support_person: supportPerson
        }
      }
    }
  }

  if (
    role === "manager" &&
    shipmentId &&
    /\b(incident|reason|cause|why|technician|support|eta|details?)\b/.test(message)
  ) {
    return {
      toolName: "query_incidents",
      args: {
        shipment_id: shipmentId,
        limit: 10
      }
    }
  }

  if (
    role === "manager" &&
    /\b(active\s+incidents?|incidents?|incident reports?)\b/.test(message)
  ) {
    return {
      toolName: "query_incidents",
      args: /\b(active|open)\b/.test(message)
        ? {
            status: "open",
            limit: 10
          }
        : {
            limit: 10
          }
    }
  }

  if (role !== "driver") {
    return null
  }

  if (
    /\b(today'?s|my|assigned)\s+(deliver(?:y|ies)|shipments|orders)\b/.test(message) ||
    /\b(updates?|status)\s+on\s+(today'?s|my)\s+(deliver(?:y|ies)|shipments|orders)\b/.test(message) ||
    /\bwhat\s+are\s+the\s+(deliver(?:ies|y)|shipments|orders)\b.*\b(today|today's)\b/.test(message) ||
    /\bwhich\s+(deliver(?:ies|y)|shipments|orders)\b.*\b(today|today's)\b/.test(message) ||
    /\b(deliver(?:ies|y)|shipments|orders)\b.*\b(i need to make|i should do|for today|today)\b/.test(message)
  ) {
    return {
      toolName: "get_assigned_shipments",
      args: {
        driver_id,
        limit: 10
      }
    }
  }

  if (/\bnext\s+(deliver(?:y|ies)|shipment|order)\b/.test(message)) {
    return {
      toolName: "get_next_delivery",
      args: { driver_id }
    }
  }

  if (
    shipmentId &&
    /\b(mark|marked|set|update)\b/.test(message) &&
    /\bdelayed due to incident\b/.test(message)
  ) {
    return {
      toolName: "update_shipment_status",
      args: {
        shipment_id: shipmentId,
        status: "delay_due_to_incident",
        driver_id
      }
    }
  }

  if (
    shipmentId &&
    /\b(incident|issue|problem)\b/.test(message) &&
    /\b(resolved|solve[sd]?|fixed|completed|closed)\b/.test(message)
  ) {
    return {
      toolName: "resolve_incident",
      args: {
        shipment_id: shipmentId,
        driver_id
      }
    }
  }

  if (
    shipmentId &&
    /\b(delivered|completed|finished|done)\b/.test(message)
  ) {
    return {
      toolName: "update_shipment_status",
      args: {
        shipment_id: shipmentId,
        status: "delivered",
        driver_id
      }
    }
  }

  if (
    shipmentId &&
    /\b(delayed|running late|late)\b/.test(message)
  ) {
    return {
      toolName: "report_delay",
      args: {
        shipment_id: shipmentId,
        reason: "reported by driver",
        driver_id
      }
    }
  }

  return null
}

export async function runAgent({ message, role, driver_id }) {
  role = role ?? "manager"
  message = normalizeVoiceMessage(message ?? "")

  if (isLowSignalMessage(message, role)) {
    return "I did not understand the request. Please repeat."
  }

  const directIntent = inferDirectIntent(message, role, driver_id)

  if (directIntent) {
    try {
      console.log("Direct tool:", directIntent.toolName)
      console.log("Direct args:", directIntent.args)
      const result = await executeTool(directIntent.toolName, directIntent.args, { role, driver_id })
      return formatToolResult(result, { role, queryText: message })
    } catch (err) {
      console.error("Direct tool execution failed:", err)
      return "The system encountered an error while executing the request."
    }
  }

  const tools = getToolsForRole(role)

  console.log("Role:", role)

  const response = await groq.chat.completions.create({

    model: "llama-3.1-8b-instant",

    messages: [
      {
        role: "system",
        content: getSystemPrompt(role)
      },
      {
        role: "user",
        content: message
      }
    ],

    tools,
    tool_choice: "auto",
    temperature: 0

  })

  const toolCalls = response.choices[0].message.tool_calls ?? []

  if (toolCalls.length > 0) {
    const toolCall = toolCalls[0]

    if (!toolCall || !toolCall.function) {
      return "I did not understand the request. Please repeat."
    }

    const toolName = toolCall.function.name
    let args = {}

    try {
      args = toolCall.function.arguments
        ? JSON.parse(toolCall.function.arguments)
        : {}
    } catch (e) {
      console.error("Tool arg parse error:", e)
      args = {}
    }

    args = args || {}

    if (role === "driver") {
      args.driver_id = driver_id
    }

    console.log("LLM tool:", toolName)
    console.log("Tool args:", args)

    try {
      const result = await executeTool(toolName, args, { role, driver_id })

      return formatToolResult(result, { role, queryText: message })
    } catch (err) {
      console.error("Tool execution failed:", err)
      return "The system encountered an error while executing the request."
    }
  }

  const responseText = stripToolNarration(response.choices[0].message.content ?? "")

  if (OPERATIONAL_QUERY_REGEX.test(message) || extractShipmentId(message)) {
    return SAFE_OPERATIONAL_FALLBACK
  }

  return responseText || SAFE_OPERATIONAL_FALLBACK
}
