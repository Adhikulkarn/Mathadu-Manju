import axios from "axios"
import { DJANGO_API } from "./config.js"

const TOOL_ENDPOINTS = {

    update_shipment_status: "/api/update-shipment-status",
    report_delay: "/api/report-delay",
    report_incident: "/api/report-incident",
    resolve_incident: "/api/resolve-incident",
    get_shipment_status: "/api/shipment-status",
    get_next_delivery: "/api/next-delivery"

}

export async function executeTool(toolName, args) {

    const endpoint = TOOL_ENDPOINTS[toolName]

    if (!endpoint) {
        throw new Error(`Unknown tool: ${toolName}`)
    }

    const res = await axios.post(`${DJANGO_API}${endpoint}`, args)

    return res.data
}