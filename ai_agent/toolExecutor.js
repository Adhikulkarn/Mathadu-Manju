import axios from "axios"
import { DJANGO_API } from "./config.js"
import { DRIVER_TOOL_NAMES, MANAGER_TOOL_NAMES } from "./toolLoader.js"

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
    get_assigned_shipments: {
        method: "GET",
        url: "/api/assigned-shipments"
    },

    dashboard_stats: {
        method: "GET",
        url: "/api/dashboard"
    },

    query_shipments: {
        method: "GET",
        url: "/api/query-shipments"
    },

    query_incidents: {
        method: "GET",
        url: "/api/query-incidents"
    },

    assign_driver: {
        method: "POST",
        url: "/api/assign-driver"
    },

    assign_incident_technician: {
        method: "POST",
        url: "/api/assign-incident-technician"
    }

}

const BLOCKED_DRIVER_MESSAGE = "Drivers cannot access warehouse analytics."

function buildQueryParams(args = {}) {
    const params = {}

    for (const [key, value] of Object.entries(args)) {
        if (value !== undefined && value !== null && value !== "") {
            params[key] = value
        }
    }

    return params
}

function roleCanUseTool(role, toolName) {
    if (role === "driver") {
        return DRIVER_TOOL_NAMES.includes(toolName)
    }

    if (role === "manager") {
        return MANAGER_TOOL_NAMES.includes(toolName)
    }

    return false
}

function formatStatusLabel(status = "") {
    return status.replace(/_/g, " ")
}

function pickIncidentForQuestion(incidents, questionText = "") {
    if (!incidents?.length) {
        return null
    }

    const normalizedQuestion = (questionText || "").toLowerCase()

    if (/\b(technician|support|eta|who is coming|who will fix|who is assigned)\b/.test(normalizedQuestion)) {
        return (
            incidents.find((incident) => incident.support_person) ||
            incidents.find((incident) => typeof incident.eta_minutes === "number") ||
            incidents[0]
        )
    }

    return (
        incidents.find(
            (incident) => incident.status === "reported" || incident.status === "assistance_dispatched"
        ) ||
        incidents[0]
    )
}

export function formatToolResult(result, { role, queryText } = {}) {

    if (!result) return "Operation completed."
    if (result.message === BLOCKED_DRIVER_MESSAGE) return BLOCKED_DRIVER_MESSAGE

    if (result.action === "update_shipment_status") {
        return `Shipment ${result.shipment_id} has been marked as ${formatStatusLabel(result.status)}.`
    }

    if (result.action === "get_shipment_status") {
        return `Shipment ${result.shipment_id} is currently ${formatStatusLabel(result.status)} and heading to ${result.destination}.`
    }

    if (result.action === "dashboard_stats") {
        const delayDueToIncident = result.delay_due_to_incident ?? 0
        return `There are ${result.delivered} deliveries completed, ${result.delayed} delayed shipments, ${delayDueToIncident} delayed due to incident, and ${result.incidents} active incidents.`
    }

    if (result.action === "get_next_delivery") {
        return `Your next delivery is shipment ${result.shipment_id} to ${result.destination}.`
    }

    if (result.action === "get_assigned_shipments") {
        if (!result.shipments?.length) {
            return "You have no assigned shipments."
        }

        const shipments = result.shipments
            .map((shipment) => `${shipment.shipment_id} ${shipment.status}`)
            .join(", ")

        return `Assigned shipments: ${shipments}.`
    }

    if (result.action === "query_shipments") {
        if (!result.shipments?.length) {
            return "No shipments matched that filter."
        }

        if (result.shipments.length === 1) {
            const shipment = result.shipments[0]
            return `Shipment ${shipment.shipment_id} is currently ${formatStatusLabel(shipment.status)} and heading to ${shipment.destination}.`
        }

        if (role === "driver") {
            return `Found ${result.shipments.length} shipments.`
        }

        const shipments = result.shipments
            .map((shipment) => shipment.shipment_id)
            .join(", ")

        return `There are ${result.shipments.length} shipments: ${shipments}.`
    }

    if (result.action === "query_incidents") {
        if (!result.incidents?.length) {
            return "There are no incidents matching that filter."
        }

        const formatIncidentDetails = (incident) => {
            const description = incident.description
                ? ` Reason: ${incident.description}.`
                : ""
            const supportInfo = incident.support_person
                ? ` Technician assigned: ${incident.support_person}.`
                : ""
            const etaInfo = typeof incident.eta_minutes === "number"
                ? ` ETA ${incident.eta_minutes} minutes.`
                : ""

            return `Shipment ${incident.shipment_id} has a ${incident.incident_type} incident with status ${incident.status}.${description}${supportInfo}${etaInfo}`
                .replace(/\s+/g, " ")
                .trim()
        }

        if (result.incidents.length === 1) {
            return formatIncidentDetails(result.incidents[0])
        }

        const uniqueShipmentIds = [...new Set(result.incidents.map((incident) => incident.shipment_id))]

        if (uniqueShipmentIds.length === 1) {
            const primaryIncident = pickIncidentForQuestion(result.incidents, queryText)
            return formatIncidentDetails(primaryIncident)
        }

        const incidents = result.incidents
            .map((incident) => `${incident.shipment_id} ${incident.incident_type} ${incident.status}`)
            .join(", ")

        return `There are ${result.incidents.length} incidents: ${incidents}.`
    }

    if (result.action === "resolve_incident") {
        return `Incident resolved for shipment ${result.shipment_id}. The shipment is now marked as ${formatStatusLabel(result.status)}.`
    }

    if (result.action === "assign_incident_technician") {
        const etaInfo = typeof result.eta_minutes === "number"
            ? ` ETA ${result.eta_minutes} minutes.`
            : ""
        return `Technician ${result.support_person} has been assigned to shipment ${result.shipment_id}.${etaInfo}`
    }

    return result.message || "Operation completed."
}

export async function executeTool(toolName, args = {}, context = {}) {
    const { role, driver_id } = context
    args = args || {}

    if (!roleCanUseTool(role, toolName)) {
        return {
            success: false,
            message: role === "driver" ? BLOCKED_DRIVER_MESSAGE : "This tool is not available for the current role."
        }
    }

    if (role === "driver") {
        args.driver_id = driver_id
    }

    const tool = TOOL_ENDPOINTS[toolName]

    if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`)
    }

    const start = Date.now()

    try {

        let res
        let url = typeof tool.url === "function" ? tool.url(args) : tool.url

        if (tool.method === "POST") {

            res = await api.post(url, args)

        } else if (tool.method === "GET") {

            res = await api.get(url, { params: buildQueryParams(args) })

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
