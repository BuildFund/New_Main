"""URL configuration for the accounts app."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoleListView, UserRegistrationView, CurrentUserView
from .admin_views import AdminUserManagementViewSet
from .account_views import AccountManagementViewSet
from .auth_views import verify_password

router = DefaultRouter()
router.register(r"admin/users", AdminUserManagementViewSet, basename="admin-users")
router.register(r"account", AccountManagementViewSet, basename="account")

urlpatterns = [
    path("register/", UserRegistrationView.as_view(), name="user-register"),
    path("roles/", RoleListView.as_view(), name="role-list"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("verify-password/", verify_password, name="verify-password"),
    path("", include(router.urls)),
]