export const tools = [
    {
        type: "function",
        function: {
            name: "update_shipment_status",
            description: "Update shipment delivery status such as delivered or delayed",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string",
                        description: "Shipment ID like A001"
                    },
                    status: {
                        type: "string",
                        enum: ["delivered", "delayed", "in_transit"]
                    }
                },
                required: ["shipment_id", "status"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "report_delay",
            description: "Report that a shipment is delayed because of traffic or another issue",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string",
                        description: "Shipment ID like A001"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for the delay"
                    }
                },
                required: ["shipment_id", "reason"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "report_incident",
            description: "Report a shipment incident such as a puncture, breakdown, or damage",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string",
                        description: "Shipment ID like A001"
                    },
                    incident_type: {
                        type: "string",
                        description: "Short incident type label"
                    },
                    description: {
                        type: "string",
                        description: "Description of the incident"
                    }
                },
                required: ["shipment_id", "incident_type", "description"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_shipment_status",
            description: "Retrieve the status and destination of a shipment",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string"
                    }
                },
                required: ["shipment_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "dashboard_stats",
            description: "Get dashboard statistics for deliveries",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    }
]

export async function loadTools() {
    console.log(
        "Loaded tools:",
        tools.map((tool) => tool.function.name)
    )
}

export function getTools() {
    return tools
}
