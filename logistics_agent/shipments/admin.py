from django.contrib import admin
from .models import Driver, Shipment, DelayReport, Incident


admin.site.register(Driver)
admin.site.register(Shipment)
admin.site.register(DelayReport)
admin.site.register(Incident)