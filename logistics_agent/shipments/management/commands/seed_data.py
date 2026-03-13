from django.core.management.base import BaseCommand
from shipments.models import Driver, Shipment
import random


class Command(BaseCommand):
    help = "Seed demo logistics data"


    def handle(self, *args, **kwargs):

        drivers = []

        # Create Drivers
        for i in range(1, 6):

            driver = Driver.objects.create(
                driver_id=f"D{i:03}",
                name=f"Driver {i}",
                phone=f"98765432{i:02}",
                vehicle_number=f"KA01AB{i:03}"
            )

            drivers.append(driver)


        statuses = ["pending", "in_transit", "delivered", "delayed"]


        # Create Shipments
        for i in range(1, 21):

            Shipment.objects.create(
                shipment_id=f"A{i:03}",
                destination=f"Warehouse {random.randint(1,5)}",
                driver=random.choice(drivers),
                status=random.choice(statuses)
            )


        self.stdout.write(self.style.SUCCESS("Demo data created successfully"))