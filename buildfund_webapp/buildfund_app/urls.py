"""URL configuration for the BuildFund project.

This module routes incoming HTTP requests to the appropriate app
endpoints.  It includes API URLs for each of the local apps and
the Django admin interface.  Authentication endpoints (login,
logout, token obtain) are provided via Django REST Framework.
"""
from __future__ import annotations

from django.contrib import admin
from django.urls import include, path
from accounts.auth_views import CustomObtainAuthToken
from buildfund_app.api_views import api_root

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api_root, name="api-root"),
    path("api/auth/token/", CustomObtainAuthToken.as_view(), name="api-token"),
    path("api/accounts/", include("accounts.urls")),
    path("api/borrowers/", include("borrowers.urls")),
    path("api/lenders/", include("lenders.urls")),
    path("api/products/", include("products.urls")),
    path("api/projects/", include("projects.urls")),
    path("api/applications/", include("applications.urls")),
    path("api/documents/", include("documents.urls")),
    path("api/underwriting/", include("underwriting.urls")),
    path("api/mapping/", include("mapping.urls")),
    path("api/private-equity/", include("private_equity.urls")),
    path("api/verification/", include("verification.urls")),
    path("api/messaging/", include("messaging.urls")),
    path("api/onboarding/", include("onboarding.urls")),
    path("api/consultants/", include("consultants.urls")),
    path("api/funding-requests/", include("funding_requests.urls")),
    path("api/deals/", include("deals.urls")),
]
