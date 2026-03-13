import axios from "axios"
import { DJANGO_API } from "./config.js"

const api = axios.create({
    baseURL: DJANGO_API,
    timeout: 1000
})

const TOOL_ENDPOINTS = {

    update_shipment_status: {
        method: "POST",
        url: "/api/update-shipment-status"
    },

    report_delay: {
        method: "POST",
        url: "/api/report-delay"
    },

    report_incident: {
        method: "POST",
        url: "/api/report-incident"
    },

    resolve_incident: {
        method: "POST",
        url: "/api/resolve-incident/"
    },

    get_shipment_status: {
        method: "GET",
        url: (args) => `/api/shipment-status/${args.shipment_id}/`
    },

    get_next_delivery: {
        method: "GET",
        url: (args) => `/api/next-delivery/${args.driver_id}/`
    },

    dashboard_stats: {
        method: "GET",
        url: "/api/dashboard/stats"
    }

}

export function formatToolResult(result) {

    if (!result) return "Operation completed."

    if (result.action === "update_shipment_status") {
        return `Shipment ${result.shipment_id} has been marked as ${result.status}.`
    }

    if (result.action === "get_shipment_status") {
        return `Shipment ${result.shipment_id} is currently ${result.status} and heading to ${result.destination}.`
    }

    if (result.action === "dashboard_stats") {
        return `There are ${result.delivered} deliveries completed and ${result.delayed} delayed shipments.`
    }

    return result.message || "Operation completed."
}

export async function executeTool(toolName, args = {}) {

    const tool = TOOL_ENDPOINTS[toolName]

    if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`)
    }

    console.log("------------------------------------------------")
    console.log("Executing tool:", toolName)
    console.log("Arguments:", args)

    const start = Date.now()

    try {

        let res
        let url = typeof tool.url === "function" ? tool.url(args) : tool.url

        if (tool.method === "POST") {

            res = await api.post(url, args)

        } else if (tool.method === "GET") {

            res = await api.get(url)

        } else {

            throw new Error(`Unsupported method: ${tool.method}`)

        }

        const latency = Date.now() - start

        console.log(`Tool ${toolName} executed in ${latency} ms`)
        console.log("Tool result:", res.data)
        console.log("------------------------------------------------")

        return res.data

    } catch (err) {

        console.error(`Tool execution failed: ${toolName}`)

        if (err.response) {
            console.error("Django error:", err.response.data)
        } else {
            console.error(err.message)
        }

        return {
            success: false,
            message: "Tool execution failed"
        }

    }

}
