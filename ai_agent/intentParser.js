const SPOKEN_DIGIT_MAP = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9"
}

funfunction normalizeTranscript(text) {

  if (!text) return ""

  text = text.toLowerCase()

  // fix STT word splits
  text = text.replace(/ship\s?ment/g, "shipment")
  text = text.replace(/shipping/g, "shipment")
  text = text.replace(/soupment/g, "shipment")

  // normalize shipment phrases
  text = text.replace(/shipment id/g, "shipment")
  text = text.replace(/shipment number/g, "shipment")

  // fix spaced shipment IDs like "a 0 0 4"
  text = text.replace(/\ba\s+0\s+0\s+(\d)\b/g, "a00$1")

  // fix "a 004"
  text = text.replace(/\ba\s+(\d{3})\b/g, "a$1")

  // remove filler
  text = text.replace(/\b(please|hey|ok|okay|can you|could you)\b/g, "")

  return text.trim()
}
function extractShipmentId(text) {

    const shipmentPatterns = [
        /\bshipment status\s+([a-z]+\d+|\d+[a-z]+|[a-z0-9]+)\b/i,
        /\bshipment\s+([a-z]+\d+|\d+[a-z]+|[a-z0-9]+)\s+status\b/i,
        /\bshipment\s+([a-z]+\d+|\d+[a-z]+|[a-z0-9]+)\b/i
    ]

    for (const pattern of shipmentPatterns) {
        const shipmentMatch = text.match(pattern)

        if (shipmentMatch) {
            return shipmentMatch[1].toUpperCase()
        }
    }

    return null
}

export function detectIntent(text) {

    text = normalizeTranscript(text)

    const shipmentId = extractShipmentId(text)

    if (shipmentId && /\bshipment\s+[a-z0-9]+\s+delivered\b/.test(text)) {
        return {
            tool: "update_shipment_status",
            args: {
                shipment_id: shipmentId,
                status: "delivered"
            }
        }
    }

    if (shipmentId && /\bshipment\s+[a-z0-9]+\s+delayed\b/.test(text)) {
        return {
            tool: "report_delay",
            args: {
                shipment_id: shipmentId,
                reason: "reported by driver"
            }
        }
    }

    if (shipmentId && /\b(puncture|incident)\b/.test(text)) {
        return {
            tool: "report_incident",
            args: {
                shipment_id: shipmentId,
                incident_type: "driver_reported",
                description: text
            }
        }
    }

    if (/\bnext delivery\b/.test(text)) {
        return {
            tool: "get_next_delivery",
            args: { driver_id: "D001" }
        }
    }

    if (shipmentId && /\b(shipment status|status)\b/.test(text)) {
        return {
            tool: "get_shipment_status",
            args: {
                shipment_id: shipmentId
            }
        }
    }

    if (/\bdashboard (update|stats)\b/.test(text)) {
        return {
            tool: "dashboard_stats",
            args: {}
        }
    }

    if (
        /\bhow many\b/.test(text) &&
        /\b(deliveries|delivery|orders|order)\b/.test(text) &&
        /\b(left|remaining|yet to be delivered)\b/.test(text)
    ) {
        return {
            tool: "dashboard_stats",
            args: {}
        }
    }

    if (/\b(deliveries|orders) remaining\b/.test(text)) {
        return {
            tool: "dashboard_stats",
            args: {}
        }
    }

    return null
}
