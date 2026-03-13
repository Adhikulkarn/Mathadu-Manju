from django.contrib import admin
from .models import Driver, Shipment, DelayReport, Incident


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ("driver_id", "name", "phone", "vehicle_number")
    search_fields = ("name", "driver_id")


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ("shipment_id", "destination", "driver", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("shipment_id", "destination")


@admin.register(DelayReport)
class DelayReportAdmin(admin.ModelAdmin):
    list_display = ("shipment", "reason", "reported_at")
    search_fields = ("shipment__shipment_id",)


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ("shipment", "incident_type", "reported_at")
    search_fields = ("shipment__shipment_id",)