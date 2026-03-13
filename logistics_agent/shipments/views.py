from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Shipment, Driver, DelayReport, Incident
from .serializers import (
    ShipmentStatusUpdateSerializer,
    DelayReportSerializer,
    IncidentSerializer,
    ShipmentSerializer
)


# Update Shipment Status
@api_view(['POST'])
def update_shipment_status(request):

    serializer = ShipmentStatusUpdateSerializer(data=request.data)

    if not serializer.is_valid():
        return Response({
            "success": False,
            "error": serializer.errors
        }, status=400)

    shipment_id = serializer.validated_data['shipment_id']
    status = serializer.validated_data['status']

    try:
        shipment = Shipment.objects.get(shipment_id=shipment_id)
    except Shipment.DoesNotExist:
        return Response({
            "success": False,
            "error": "Shipment not found"
        }, status=404)

    shipment.status = status
    shipment.save()

    return Response({
        "success": True,
        "action": "update_shipment_status",
        "shipment_id": shipment.shipment_id,
        "status": shipment.status,
        "message": f"Shipment {shipment.shipment_id} marked as {shipment.status}"
    })


# Report Delay
@api_view(['POST'])
def report_delay(request):

    serializer = DelayReportSerializer(data=request.data)

    if not serializer.is_valid():
        return Response({
            "success": False,
            "error": serializer.errors
        }, status=400)

    shipment_id = serializer.validated_data['shipment_id']
    reason = serializer.validated_data['reason']

    try:
        shipment = Shipment.objects.get(shipment_id=shipment_id)
    except Shipment.DoesNotExist:
        return Response({
            "success": False,
            "error": "Shipment not found"
        }, status=404)

    DelayReport.objects.create(
        shipment=shipment,
        reason=reason
    )

    shipment.status = "delayed"
    shipment.save()

    return Response({
        "success": True,
        "action": "report_delay",
        "shipment_id": shipment.shipment_id,
        "status": shipment.status,
        "reason": reason,
        "message": f"Delay recorded for shipment {shipment.shipment_id}"
    })


# Report Incident
@api_view(['POST'])
def report_incident(request):

    serializer = IncidentSerializer(data=request.data)

    if not serializer.is_valid():
        return Response({
            "success": False,
            "error": serializer.errors
        }, status=400)

    shipment_id = serializer.validated_data['shipment_id']
    incident_type = serializer.validated_data['incident_type']
    description = serializer.validated_data['description']

    try:
        shipment = Shipment.objects.get(shipment_id=shipment_id)
    except Shipment.DoesNotExist:
        return Response({
            "success": False,
            "error": "Shipment not found"
        }, status=404)

    # Default support assignment
    support_person = None
    eta_minutes = None
    response_message = ""

    if incident_type == "tire_puncture":
        support_person = "Ramesh (Technician)"
        eta_minutes = 20
        response_message = f"Tire puncture reported. Technician {support_person} will reach you in {eta_minutes} minutes."

    elif incident_type == "engine_failure":
        support_person = "Mahesh (Recovery Vehicle)"
        eta_minutes = 40
        response_message = f"Engine failure reported. Recovery vehicle driven by {support_person} will reach you in {eta_minutes} minutes."

    elif incident_type == "package_damage":
        response_message = "Package damage reported. Please secure the package. Warehouse support has been notified and will contact you shortly."

    else:
        response_message = "Incident reported. Support team has been notified."

    incident = Incident.objects.create(
        shipment=shipment,
        incident_type=incident_type,
        description=description,
        status="assistance_dispatched" if support_person else "reported",
        support_person=support_person,
        eta_minutes=eta_minutes
    )

    shipment.status = "incident"
    shipment.save()

    return Response({
        "success": True,
        "action": "report_incident",
        "shipment_id": shipment.shipment_id,
        "incident_type": incident_type,
        "support_person": support_person,
        "eta_minutes": eta_minutes,
        "message": response_message
    })


@api_view(['POST'])
def resolve_incident(request):

    shipment_id = request.data.get("shipment_id")

    if not shipment_id:
        return Response({
            "success": False,
            "error": "shipment_id is required"
        }, status=400)

    try:
        shipment = Shipment.objects.get(shipment_id=shipment_id)
    except Shipment.DoesNotExist:
        return Response({
            "success": False,
            "error": "Shipment not found"
        }, status=404)

    incident = Incident.objects.filter(
        shipment=shipment,
        status__in=["reported", "assistance_dispatched"]
    ).order_by("-reported_at").first()

    if not incident:
        return Response({
            "success": False,
            "message": "No active incident found for this shipment"
        })

    incident.status = "resolved"
    incident.save()

    shipment.status = "in_transit"
    shipment.save()

    return Response({
        "success": True,
        "action": "resolve_incident",
        "shipment_id": shipment.shipment_id,
        "message": "Incident resolved. Delivery has resumed."
    })

# Get Shipment Status
@api_view(['GET'])
def get_shipment_status(request, shipment_id):

    try:
        shipment = Shipment.objects.get(shipment_id=shipment_id)
    except Shipment.DoesNotExist:
        return Response({
            "success": False,
            "error": "Shipment not found"
        }, status=404)

    return Response({
        "success": True,
        "action": "get_shipment_status",
        "shipment_id": shipment.shipment_id,
        "status": shipment.status,
        "destination": shipment.destination
    })


# Get Next Delivery
@api_view(['GET'])
def get_next_delivery(request, driver_id):

    shipment = Shipment.objects.filter(
        driver__driver_id=driver_id
    ).exclude(
        status__in=["delivered", "incident"]
    ).order_by("created_at").first()

    if not shipment:
        return Response({
            "success": False,
            "action": "get_next_delivery",
            "message": "No pending deliveries for this driver"
        })

    return Response({
        "success": True,
        "action": "get_next_delivery",
        "driver_id": driver_id,
        "shipment_id": shipment.shipment_id,
        "destination": shipment.destination,
        "status": shipment.status
    })


# Agent Tool Definitions
@api_view(['GET'])
def agent_tools(request):

    tools = [
        {
            "type": "function",
            "function": {
                "name": "update_shipment_status",
                "description": "Update shipment delivery status",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "shipment_id": {
                            "type": "string",
                            "description": "Shipment ID like A101"
                        },
                        "status": {
                            "type": "string",
                            "enum": ["pending", "in_transit", "delivered", "delayed"]
                        }
                    },
                    "required": ["shipment_id", "status"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "report_delay",
                "description": "Report shipment delay",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "shipment_id": {"type": "string"},
                        "reason": {"type": "string"}
                    },
                    "required": ["shipment_id", "reason"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "report_incident",
                "description": "Report shipment incident",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "shipment_id": {"type": "string"},
                        "incident_type": {"type": "string"},
                        "description": {"type": "string"}
                    },
                    "required": ["shipment_id", "incident_type", "description"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_shipment_status",
                "description": "Retrieve the current status of a shipment",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "shipment_id": {"type": "string"}
                    },
                    "required": ["shipment_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_next_delivery",
                "description": "Retrieve the next delivery assigned to a driver",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "driver_id": {"type": "string"}
                    },
                    "required": ["driver_id"]
                }
            }
        }
    ]

    return Response(tools)


# Dashboard Stats
@api_view(['GET'])
def dashboard_stats(request):

    total_shipments = Shipment.objects.count()
    delivered = Shipment.objects.filter(status="delivered").count()
    delayed = Shipment.objects.filter(status="delayed").count()
    incidents = Incident.objects.count()

    return Response({
        "success": True,
        "action": "dashboard_stats",
        "total_shipments": total_shipments,
        "delivered": delivered,
        "delayed": delayed,
        "incidents": incidents
    })