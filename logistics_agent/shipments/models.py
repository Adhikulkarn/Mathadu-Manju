from django.db import models

# Create your models here.
from django.db import models


class Driver(models.Model):
    driver_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    vehicle_number = models.CharField(max_length=20)

    def __str__(self):
        return f"{self.name} ({self.driver_id})"


class Shipment(models.Model):

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_transit', 'In Transit'),
        ('delivered', 'Delivered'),
        ('delayed', 'Delayed'),
        ('incident', 'Incident'),
    ]

    shipment_id = models.CharField(max_length=20, unique=True)
    destination = models.CharField(max_length=200)

    driver = models.ForeignKey(
        Driver,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.shipment_id


class DelayReport(models.Model):
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE
    )

    reason = models.TextField()
    reported_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Delay - {self.shipment.shipment_id}"


class Incident(models.Model):
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE
    )

    incident_type = models.CharField(max_length=100)
    description = models.TextField()
    reported_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Incident - {self.shipment.shipment_id}"