from rest_framework import serializers
from .models import Shipment, DelayReport, Incident


class ShipmentStatusUpdateSerializer(serializers.Serializer):
    shipment_id = serializers.CharField()
    status = serializers.CharField()


class DelayReportSerializer(serializers.Serializer):
    shipment_id = serializers.CharField()
    reason = serializers.CharField()


class IncidentSerializer(serializers.Serializer):
    shipment_id = serializers.CharField()
    incident_type = serializers.CharField()
    description = serializers.CharField()


class ShipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shipment
        fields = '__all__'