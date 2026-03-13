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
Keep driver responses short and operational.`,
  manager: `You are a warehouse operations assistant.

You help managers:
view dashboard statistics
list shipments
list incidents
update shipment status
assign drivers

Use tools for shipment, incident, assignment, and analytics requests.`
}
const OPERATIONAL_QUERY_REGEX = /\b(shipment|delivery|incident|delay)\b/i
const SAFE_OPERATIONAL_FALLBACK = "I need to retrieve that information from the logistics system."
const LOW_SIGNAL_MESSAGE_REGEX = /^(?:hi|hello|hey|okay|ok|yes|no|hmm|uh|um|repeat|again)\b[\s.!?]*$/i

function stripToolNarration(text = "") {
  return text
    .replace(/\b(?:calling|executing|running tool)\b[^.!?\n]*[.!?\n]*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function getSystemPrompt(role) {
  return SYSTEM_PROMPTS[role] ?? SYSTEM_PROMPTS.manager
}

export async function runAgent({ message, role, driver_id }) {
  role = role ?? "manager"
  message = (message ?? "").trim()

  if (!message || message.length < 5 || LOW_SIGNAL_MESSAGE_REGEX.test(message)) {
    return "I did not understand the request. Please repeat."
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

      return formatToolResult(result, { role })
    } catch (err) {
      console.error("Tool execution failed:", err)
      return "The system encountered an error while executing the request."
    }
  }

  const responseText = stripToolNarration(response.choices[0].message.content ?? "")

  if (OPERATIONAL_QUERY_REGEX.test(message)) {
    return SAFE_OPERATIONAL_FALLBACK
  }

  return responseText || SAFE_OPERATIONAL_FALLBACK
}
