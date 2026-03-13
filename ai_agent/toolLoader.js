const TOOL_DEFINITIONS = {
    get_next_delivery: {
        type: "function",
        function: {
            name: "get_next_delivery",
            description: "Retrieve the next delivery assigned to the active driver",
            parameters: {
                type: "object",
                properties: {
                    driver_id: {
                        type: "string",
                        description: "Driver ID like D001"
                    }
                }
            }
        }
    },
    get_assigned_shipments: {
        type: "function",
        function: {
            name: "get_assigned_shipments",
            description: "List the shipments assigned to the active driver",
            parameters: {
                type: "object",
                properties: {
                    driver_id: {
                        type: "string",
                        description: "Driver ID like D001"
                    },
                    limit: {
                        type: "integer",
                        description: "Maximum number of shipments to return"
                    }
                }
            }
        }
    },
    get_shipment_status: {
        type: "function",
        function: {
            name: "get_shipment_status",
            description: "Retrieve the status and destination of a shipment",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string",
                        description: "Shipment ID like A001"
                    }
                },
                required: ["shipment_id"]
            }
        }
    },
    update_shipment_status: {
        type: "function",
        function: {
            name: "update_shipment_status",
            description: "Update shipment delivery status such as delivered, delayed, or in transit",
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
    report_delay: {
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
    report_incident: {
        type: "function",
        function: {
            name: "report_incident",
            description: "Report a shipment incident such as a puncture, breakdown, or package damage",
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
    resolve_incident: {
        type: "function",
        function: {
            name: "resolve_incident",
            description: "Resolve an incident when help has arrived and delivery can resume",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string",
                        description: "Shipment ID like A001"
                    }
                },
                required: ["shipment_id"]
            }
        }
    },
    dashboard_stats: {
        type: "function",
        function: {
            name: "dashboard_stats",
            description: "Get warehouse dashboard statistics for deliveries and incidents",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    },
    query_shipments: {
        type: "function",
        function: {
            name: "query_shipments",
            description: "Query shipments using optional status or driver filters",
            parameters: {
                type: "object",
                properties: {
                    status: {
                        type: "string",
                        description: "Shipment status filter"
                    },
                    driver_id: {
                        type: "string",
                        description: "Driver ID like D001"
                    },
                    limit: {
                        type: "integer",
                        description: "Maximum number of shipments to return"
                    }
                }
            }
        }
    },
    query_incidents: {
        type: "function",
        function: {
            name: "query_incidents",
            description: "List incidents with optional filters for status or driver",
            parameters: {
                type: "object",
                properties: {
                    status: {
                        type: "string",
                        description: "Incident status filter"
                    },
                    driver_id: {
                        type: "string",
                        description: "Driver ID like D001"
                    },
                    limit: {
                        type: "integer",
                        description: "Maximum number of incidents to return"
                    }
                }
            }
        }
    },
    assign_driver: {
        type: "function",
        function: {
            name: "assign_driver",
            description: "Assign or reassign a driver to a shipment",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string",
                        description: "Shipment ID like A001"
                    },
                    driver_id: {
                        type: "string",
                        description: "Driver ID like D001"
                    }
                },
                required: ["shipment_id", "driver_id"]
            }
        }
    }
}

export const DRIVER_TOOL_NAMES = [
    "get_next_delivery",
    "get_assigned_shipments",
    "get_shipment_status",
    "update_shipment_status",
    "report_delay",
    "report_incident",
    "resolve_incident"
]

export const MANAGER_TOOL_NAMES = [
    "dashboard_stats",
    "query_shipments",
    "query_incidents",
    "update_shipment_status",
    "assign_driver"
]

export async function loadTools() {
    console.log(
        "Loaded tools:",
        Object.keys(TOOL_DEFINITIONS)
    )
}

export function getToolsForRole(role) {
    if (role === "driver") {
        return DRIVER_TOOL_NAMES.map((toolName) => TOOL_DEFINITIONS[toolName])
    }

    if (role === "manager") {
        return MANAGER_TOOL_NAMES.map((toolName) => TOOL_DEFINITIONS[toolName])
    }

    return []
}

export function getTools(role = "manager") {
    return getToolsForRole(role)
}
