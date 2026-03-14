from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shipments", "0002_incident_eta_minutes_incident_status_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="shipment",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("in_transit", "In Transit"),
                    ("delivered", "Delivered"),
                    ("delayed", "Delayed"),
                    ("delay_due_to_incident", "Delay Due To Incident"),
                    ("incident", "Incident"),
                ],
                default="pending",
                max_length=32,
            ),
        ),
    ]
