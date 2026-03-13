import express from "express"
import cors from "cors"

import { PORT } from "./config.js"
import { loadTools, getTools } from "./toolLoader.js"
import { executeTool } from "./toolExecutor.js"
import { runAgent } from "./agentController.js"

const app = express()

app.use(cors())
app.use(express.json())

/* load tools at startup */

await loadTools()

app.get("/health", (req, res) => {
    res.json({ status: "AI agent running" })
})

app.get("/tools", (req, res) => {
    res.json({ tools: getTools() })
})

app.post("/voice-agent", async (req, res) => {

  const { message } = req.body

  console.log("Driver:", message)

  try {

    const reply = await runAgent(message)

    res.json({
      reply
    })

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: "Agent failed"
    })

  }

})

app.listen(PORT, () => {
    console.log(`AI Agent running on port ${PORT}`)
})