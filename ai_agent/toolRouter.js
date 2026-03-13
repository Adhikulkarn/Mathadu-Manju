function normalizeTranscript(text) {
  if (!text) return ""

  text = text.toLowerCase()

  text = text.replace(/ship\s?ment/g, "shipment")
  text = text.replace(/shipping/g, "shipment")
  text = text.replace(/soupment/g, "shipment")

  text = text.replace(/shipment id/g, "shipment")
  text = text.replace(/shipment number/g, "shipment")

  text = text.replace(/\ba\s+0\s+0\s+(\d)\b/g, "a00$1")
  text = text.replace(/\ba\s+(\d)\s+(\d)\s+(\d)\b/g, "a$1$2$3")
  text = text.replace(/\ba\s+(\d{3})\b/g, "a$1")

  text = text.replace(/\b(please|hey|ok|okay|can you|could you)\b/g, "")

  return text.replace(/\s+/g, " ").trim()
}

function extractShipmentId(text) {
  if (!text) return null

  const upperText = text.toUpperCase()

  let match = upperText.match(/\b[A-Z]\d{3}\b/)
  if (match) return match[0]

  match = upperText.match(/\b([A-Z])\s+(\d{3})\b/)
  if (match) return match[1] + match[2]

  match = upperText.match(/\b8(\d{3})\b/)
  if (match) return "A" + match[1]

  return null
}

function inferIncidentType(text) {
  if (text.includes("puncture")) {
    return "tire_puncture"
  }

  if (text.includes("breakdown")) {
    return "engine_failure"
  }

  if (text.includes("damage")) {
    return "package_damage"
  }

  return "driver_reported"
}

export function routeRequest(text) {
  console.log("RAW:", text)
  text = normalizeTranscript(text)
  console.log("Normalized transcript:", text)

  const shipmentId = extractShipmentId(text)

  console.log("Extracted shipment ID:", shipmentId)

  if (/\bshipment\s+[a-z0-9]+\s+delivered\b/.test(text)) {
    if (!shipmentId) {
      return {
        type: "missing_param",
        param: "shipment_id"
      }
    }

    return {
      type: "tool",
      tool: "update_shipment_status",
      args: {
        shipment_id: shipmentId,
        status: "delivered"
      }
    }
  }

  if (/\b(delayed|traffic|running late)\b/.test(text)) {
    if (!shipmentId) {
      return {
        type: "missing_param",
        param: "shipment_id"
      }
    }

    return {
      type: "tool",
      tool: "report_delay",
      args: {
        shipment_id: shipmentId,
        reason: "traffic delay"
      }
    }
  }

  if (
    text.includes("status") ||
    text.includes("where is shipment") ||
    text.includes("shipment status")
  ) {
    return shipmentId
      ? {
          type: "tool",
          tool: "get_shipment_status",
          args: { shipment_id: shipmentId }
        }
      : {
          type: "missing_param",
          param: "shipment_id"
        }
  }

  if (
    text.includes("how many deliveries") ||
    text.includes("how many orders") ||
    text.includes("orders remaining") ||
    text.includes("deliveries remaining") ||
    text.includes("dashboard")
  ) {
    return {
      type: "tool",
      tool: "dashboard_stats",
      args: {}
    }
  }

  if (/\b(puncture|breakdown|damage|incident)\b/.test(text)) {
    if (!shipmentId) {
      return {
        type: "missing_param",
        param: "shipment_id"
      }
    }

    return {
      type: "tool",
      tool: "report_incident",
      args: {
        shipment_id: shipmentId,
        incident_type: inferIncidentType(text),
        description: text
      }
    }
  }

  return {
    type: "llm"
  }
}
