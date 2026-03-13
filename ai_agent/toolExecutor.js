import axios from "axios"
import { DJANGO_API } from "./config.js"

const api = axios.create({
    baseURL: DJANGO_API,
    timeout: 1000
})

const TOOL_ENDPOINTS = {

    update_shipment_status: {
        method: "POST",
        url: "/api/update-shipment-status/"
    },

    report_delay: {
        method: "POST",
        url: "/api/report-delay/"
    },

    report_incident: {
        method: "POST",
        url: "/api/report-incident/"
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
    }

}

export async function executeTool(toolName, args = {}) {

    const tool = TOOL_ENDPOINTS[toolName]

    if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`)
    }

    if (tool.method === "POST") {

        const res = await api.post(tool.url, args)
        return res.data

    }

    if (tool.method === "GET") {

        const url = typeof tool.url === "function" ? tool.url(args) : tool.url
        const res = await api.get(url)

        return res.data
    }

}