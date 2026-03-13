import axios from "axios"
import { DJANGO_API } from "./config.js"

let tools = []

export async function loadTools() {

    try {

        const res = await axios.get(`${DJANGO_API}/api/agent-tools`)

        // Django returns array directly
        tools = res.data

        console.log(
            "Loaded tools:",
            tools.map(t => t.function.name)
        )

    } catch (err) {

        console.error("Failed to load tools:", err.message)

    }

}

export function getTools() {
    return tools
}