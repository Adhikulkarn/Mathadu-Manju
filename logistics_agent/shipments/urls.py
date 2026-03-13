from django.urls import path
from . import views

urlpatterns = [
    path('update-shipment-status', views.update_shipment_status),
    path('report-delay', views.report_delay),
    path('report-incident', views.report_incident),
    path('shipment-status/<str:shipment_id>/', views.get_shipment_status),
    path('next-delivery/<str:driver_id>/', views.get_next_delivery),
    path('agent-tools/', views.agent_tools),
    path('dashboard/stats', views.dashboard_stats),
    path('resolve-incident/', views.resolve_incident),
]