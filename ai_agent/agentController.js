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

Your role is to help delivery drivers manage shipment operations.

If an operation is requested, call the appropriate tool.
After a tool executes, summarize the result clearly for the driver.
`
      },
      {
        role: "user",
        content: message
      }
    ],

    tools: tools,
    tool_choice: "auto",

    temperature: 0.2,
    max_tokens: 60,
    top_p: 0.9

  })

  const msg = completion.choices[0].message

  /* TOOL CALL */

  if (msg.tool_calls) {

    const toolCall = msg.tool_calls[0]

    const toolName = toolCall.function.name
    const args = JSON.parse(toolCall.function.arguments)

    const toolResult = await executeTool(toolName, args)

    /* SECOND LLM CALL — generate natural response */

    const finalResponse = await groq.chat.completions.create({

      model: "llama-3.3-70b-versatile",

      messages: [

        {
          role: "system",
          content: "You are a logistics dispatch AI that confirms actions clearly."
        },

        {
          role: "user",
          content: message
        },

        {
          role: "tool",
          name: toolName,
          content: JSON.stringify(toolResult)
        }

      ],

      temperature: 0.2,
      max_tokens: 60
    })

    return finalResponse.choices[0].message.content
  }

  /* NORMAL RESPONSE */

  return msg.content
}