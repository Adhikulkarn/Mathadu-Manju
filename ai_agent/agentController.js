import groq from "./groqClient.js"
import { getTools } from "./toolLoader.js"
import { executeTool } from "./toolExecutor.js"

export async function runAgent(message) {

  const tools = getTools()

  const completion = await groq.chat.completions.create({

    model: "llama-3.3-70b-versatile",

    messages: [
      {
        role: "system",
        content: `
You are an AI logistics dispatch assistant.

Your role is to help delivery drivers and warehouse staff manage shipment operations.

When the user requests an operational action, ALWAYS use the appropriate tool instead of replying with text.

Available operations include:
- updating shipment delivery status
- reporting shipment delays
- reporting incidents (puncture, damage, breakdown)
- resolving incidents
- retrieving shipment status
- retrieving next delivery
- retrieving warehouse dashboard statistics

Rules:
- Prefer tool calls whenever an operation exists.
- Extract parameters from the user message.
- Do not invent shipment IDs or driver IDs.
- Only return text if no tool applies.
`
      },
      {
        role: "user",
        content: message
      }
    ],

    tools: tools,

    tool_choice: "auto",

    /* Latency optimization */

    temperature: 0.2,
    max_tokens: 40,
    top_p: 0.9

  })

  const msg = completion.choices[0].message

  /* If LLM decided to call a tool */

  if (msg.tool_calls) {

    const toolCall = msg.tool_calls[0]

    const toolName = toolCall.function.name

    const args = JSON.parse(toolCall.function.arguments)

    const toolResult = await executeTool(toolName, args)

    return toolResult.message || JSON.stringify(toolResult)

  }

  /* If LLM replied normally */

  return msg.content
}