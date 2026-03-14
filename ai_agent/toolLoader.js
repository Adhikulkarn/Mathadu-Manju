const TOOL_DEFINITIONS = {
    get_next_delivery: {
        type: "function",
        function: {
            name: "get_next_delivery",
            description: "Retrieve the next delivery assigned to the active driver. Use for requests like 'what is my next delivery', 'what is my next stop', or 'where should I go next'.",
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
            description: "List the shipments assigned to the active driver. Use for requests like 'what deliveries do I have today', 'which orders should I do today', 'show my assigned shipments', or 'give me today's delivery updates'.",
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
            description: "Retrieve the status and destination of a shipment. Use when the user asks where a shipment is going, what its current status is, or asks for an exact update on a specific shipment.",
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
            description: "Update shipment delivery status such as delivered, delayed, or in transit. Use when a driver or manager says a shipment was delivered, completed, finished, delayed, or should be moved to a new status.",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string",
                        description: "Shipment ID like A001"
                    },
                    status: {
                        type: "string",
                        enum: ["delivered", "delayed", "delay_due_to_incident", "in_transit"]
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
            description: "Report that a shipment is delayed because of traffic or another issue. Use when the driver says a delivery is late, delayed, or stuck.",
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
            description: "Report a shipment incident such as a puncture, breakdown, or package damage. Use when the driver mentions an accident, puncture, breakdown, or other incident.",
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
            description: "Resolve an incident when help has arrived and delivery can resume. Use for requests like 'close the incident on A001', 'mark the incident resolved', or 'the incident has been fixed'.",
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
            description: "Get warehouse dashboard statistics for deliveries and incidents. Use for manager requests about totals, counts, delayed shipments, delivered shipments, or overall dashboard state.",
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
            description: "Query shipments using optional shipment ID, status, or driver filters. Use this for manager requests like 'where is shipment A007 going', 'show shipment A007', or 'list delayed shipments'.",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string",
                        description: "Shipment ID like A007"
                    },
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
            description: "List incidents using optional shipment ID, incident status, or driver filters. Use this for manager requests like 'what incident happened on A004', 'show incident details for A001', or 'list open incidents'.",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string",
                        description: "Shipment ID like A004"
                    },
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
            description: "Assign or reassign a driver to a shipment. Use for manager requests about ownership or changing who handles a shipment.",
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
    },
    assign_incident_technician: {
        type: "function",
        function: {
            name: "assign_incident_technician",
            description: "Assign a technician or support person to the active incident on a shipment. Use for manager requests like 'assign Ramesh to A004 incident' or 'send a technician to shipment A004'.",
            parameters: {
                type: "object",
                properties: {
                    shipment_id: {
                        type: "string",
                        description: "Shipment ID like A004"
                    },
                    support_person: {
                        type: "string",
                        description: "Technician or support person name"
                    },
                    eta_minutes: {
                        type: "integer",
                        description: "Estimated arrival time in minutes"
                    }
                },
                required: ["shipment_id", "support_person"]
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
    "get_shipment_status",
    "query_shipments",
    "query_incidents",
    "update_shipment_status",
    "assign_driver",
    "assign_incident_technician",
    "resolve_incident"
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
