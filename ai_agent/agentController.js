import groq from "./groqClient.js"
import { getTools } from "./toolLoader.js"
import { executeTool, formatToolResult } from "./toolExecutor.js"

const SYSTEM_PROMPT = "You are a logistics dispatch assistant. Always use tools when answering shipment or delivery questions."
const OPERATIONAL_QUERY_REGEX = /\b(shipment|delivery|incident|delay)\b/i
const SAFE_OPERATIONAL_FALLBACK = "I need to retrieve that information from the logistics system."

function stripToolNarration(text = "") {
  return text
    .replace(/\b(?:calling|executing|running tool)\b[^.!?\n]*[.!?\n]*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

export async function runAgent(message) {

  const tools = getTools()

  const response = await groq.chat.completions.create({

    model: "llama-3.1-8b-instant",

    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
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

    const toolName = toolCalls[0].function.name
    const args = JSON.parse(toolCalls[0].function.arguments)

    console.log("LLM decision:", toolName)
    console.log("Tool args:", args)

    const result = await executeTool(toolName, args)

    return formatToolResult(result)
  }

  const responseText = stripToolNarration(response.choices[0].message.content ?? "")

  if (OPERATIONAL_QUERY_REGEX.test(message)) {
    return SAFE_OPERATIONAL_FALLBACK
  }

  return responseText || SAFE_OPERATIONAL_FALLBACK
}
