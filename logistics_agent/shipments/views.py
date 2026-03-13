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

    return Response(serializer.errors, status=400)


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

    return Response(serializer.errors, status=400)


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

    return Response(serializer.errors, status=400)


# Get Shipment Status
@api_view(['GET'])
def get_shipment_status(request, shipment_id):

    try:
        shipment = Shipment.objects.get(shipment_id=shipment_id)
    except Shipment.DoesNotExist:
        return Response({"error": "Shipment not found"}, status=404)

    serializer = ShipmentSerializer(shipment)

    return Response(serializer.data)


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

    return Response(serializer.data)