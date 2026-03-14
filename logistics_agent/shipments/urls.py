from django.urls import path
from . import views

urlpatterns = [
    path('drivers', views.list_drivers),
    path('update-shipment-status', views.update_shipment_status),
    path('report-delay', views.report_delay),
    path('report-incident', views.report_incident),
    path('shipment-status/<str:shipment_id>/', views.get_shipment_status),
    path('next-delivery/<str:driver_id>/', views.get_next_delivery),
    path('assigned-shipments', views.get_assigned_shipments),
    path('query-shipments', views.query_shipments),
    path('query-incidents', views.query_incidents),
    path('assign-driver', views.assign_driver),
    path('assign-incident-technician', views.assign_incident_technician),
    path('agent-tools/', views.agent_tools),
    path('dashboard', views.dashboard_stats),
    path('dashboard/stats', views.dashboard_stats),
    path('resolve-incident/', views.resolve_incident),
]
