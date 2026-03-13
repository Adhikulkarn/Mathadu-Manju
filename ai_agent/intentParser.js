function normalizeShipmentId(text) {

    return text
        .replace(/zero/g, "0")
        .replace(/one/g, "1")
        .replace(/two/g, "2")
        .replace(/three/g, "3")
        .replace(/four/g, "4")
        .replace(/five/g, "5")
        .replace(/six/g, "6")
        .replace(/seven/g, "7")
        .replace(/eight/g, "8")
        .replace(/nine/g, "9")
}

export function detectIntent(text) {

    text = text.toLowerCase()

    // Normalize spoken numbers
    text = normalizeShipmentId(text)

    const shipmentMatch = text.match(/shipment\s+([a-z0-9]+)/)

    if (shipmentMatch && text.includes("delivered")) {
        return {
            tool: "update_shipment_status",
            args: {
                shipment_id: shipmentMatch[1].toUpperCase(),
                status: "delivered"
            }
        }
    }

    if (shipmentMatch && text.includes("delay")) {
        return {
            tool: "report_delay",
            args: {
                shipment_id: shipmentMatch[1].toUpperCase(),
                reason: "reported by driver"
            }
        }
    }

    if (shipmentMatch && (text.includes("puncture") || text.includes("incident"))) {
        return {
            tool: "report_incident",
            args: {
                shipment_id: shipmentMatch[1].toUpperCase(),
                incident_type: "driver_reported",
                description: text
            }
        }
    }

    if (text.includes("next delivery")) {
        return {
            tool: "get_next_delivery",
            args: { driver_id: "D001" }
        }
    }

    if (shipmentMatch && text.includes("status")) {
        return {
            tool: "get_shipment_status",
            args: {
                shipment_id: shipmentMatch[1].toUpperCase()
            }
        }
    }

    return null
}