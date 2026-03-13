import express from "express"
import cors from "cors"

import { PORT } from "./config.js"
import { loadTools, getTools } from "./toolLoader.js"
import { executeTool } from "./toolExecutor.js"

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

        /* temporary logic before LLM */

        if (message.toLowerCase().includes("delivered")) {

            const result = await executeTool(
                "update_shipment_status",
                {
                    shipment_id: "A101",
                    status: "delivered"
                }
            )

            return res.json({
                reply: result.message
            })

        }

        res.json({
            reply: "Command received"
        })

    } catch (err) {

        console.error(err)

        res.status(500).json({
            error: "Agent error"
        })

    }

})

app.listen(PORT, () => {
    console.log(`AI Agent running on port ${PORT}`)
})