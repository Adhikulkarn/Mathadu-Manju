from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Shipment, Driver, DelayReport, Incident
from .serializers import (
    ShipmentStatusUpdateSerializer,
    DelayReportSerializer,
    IncidentSerializer,
    ShipmentSerializer
)
from django.db.models import Count


# Update Shipment Status
@api_view(['POST'])
def update_shipment_status(request):

    serializer = ShipmentStatusUpdateSerializer(data=request.data)

    if serializer.is_valid():

        shipment_id = serializer.validated_data['shipment_id']
        status = serializer.validated_data['status']

        try:
            shipment = Shipment.objects.get(shipment_id=shipment_id)
        except Shipment.DoesNotExist:
            return Response({"error": "Shipment not found"}, status=404)

        shipment.status = status
        shipment.save()

        return Response({"message": "Shipment updated successfully"})

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

    if serializer.is_valid():

        shipment_id = serializer.validated_data['shipment_id']
        reason = serializer.validated_data['reason']

        try:
            shipment = Shipment.objects.get(shipment_id=shipment_id)
        except Shipment.DoesNotExist:
            return Response({"error": "Shipment not found"}, status=404)

        DelayReport.objects.create(
            shipment=shipment,
            reason=reason
        )

        shipment.status = "delayed"
        shipment.save()

        return Response({"message": "Delay reported successfully"})

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

    if serializer.is_valid():

        shipment_id = serializer.validated_data['shipment_id']
        incident_type = serializer.validated_data['incident_type']
        description = serializer.validated_data['description']

        try:
            shipment = Shipment.objects.get(shipment_id=shipment_id)
        except Shipment.DoesNotExist:
            return Response({"error": "Shipment not found"}, status=404)

        Incident.objects.create(
            shipment=shipment,
            incident_type=incident_type,
            description=description
        )

        shipment.status = "incident"
        shipment.save()

        return Response({"message": "Incident reported successfully"})

    return Response({
    "success": True,
    "action": "report_incident",
    "shipment_id": shipment.shipment_id,
    "incident_type": incident_type,
    "status": shipment.status,
    "message": f"Incident recorded for shipment {shipment.shipment_id}"
    })


# Get Shipment Status
@api_view(['GET'])
def get_shipment_status(request, shipment_id):

    try:
        shipment = Shipment.objects.get(shipment_id=shipment_id)
    except Shipment.DoesNotExist:
        return Response({"error": "Shipment not found"}, status=404)

    serializer = ShipmentSerializer(shipment)

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

    try:
        driver = Driver.objects.get(driver_id=driver_id)
    except Driver.DoesNotExist:
        return Response({"error": "Driver not found"}, status=404)

    shipment = Shipment.objects.filter(
        driver=driver,
        status="in_transit"
    ).first()

    if not shipment:
        return Response({"message": "No active deliveries"})

    serializer = ShipmentSerializer(shipment)

    return Response({
    "success": True,
    "action": "get_next_delivery",
    "shipment_id": shipment.shipment_id,
    "destination": shipment.destination,
    "status": shipment.status
    })

@api_view(['GET'])
def agent_tools(request):

    tools = [
        {
            "name": "update_shipment_status",
            "description": "Update shipment delivery status",
            "parameters": {
                "shipment_id": "string",
                "status": "string"
            }
        },
        {
            "name": "report_delay",
            "description": "Report shipment delay",
            "parameters": {
                "shipment_id": "string",
                "reason": "string"
            }
        },
        {
            "name": "report_incident",
            "description": "Report shipment incident",
            "parameters": {
                "shipment_id": "string",
                "incident_type": "string",
                "description": "string"
            }
        },
        {
            "name": "get_shipment_status",
            "description": "Get shipment status",
            "parameters": {
                "shipment_id": "string"
            }
        }
    ]

    return Response(tools)

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