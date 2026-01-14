"""Serializers for the accounts app."""
from __future__ import annotations

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Role, UserRole


class RoleSerializer(serializers.ModelSerializer):
    """Serializes the Role model."""

    class Meta:
        model = Role
        fields = ["id", "name"]


class UserSerializer(serializers.ModelSerializer):
    """Serializer for creating and representing users."""

    roles = serializers.SlugRelatedField(
        many=True, slug_field="name", queryset=Role.objects.all(), required=False
    )
    password = serializers.CharField(write_only=True, min_length=12)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "roles"]

    def create(self, validated_data):
        role_names = validated_data.pop("roles", [])
        user = User.objects.create_user(
            username=validated_data.get("username"),
            email=validated_data.get("email"),
            password=validated_data.get("password"),
        )
        for role_name in role_names:
            role, _ = Role.objects.get_or_create(name=role_name)
            UserRole.objects.create(user=user, role=role)
        return user


class MeSerializer(serializers.ModelSerializer):
    """
    Serializer for the current authenticated user.  Includes the user's
    roles, username and email.  Roles are returned as a list of role
    names.
    """

    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "date_joined", "is_active", "roles"]
        read_only_fields = ["id", "date_joined", "is_active"]

    def get_roles(self, obj):  # pragma: no cover
        # Return list of role names associated with the user
        return [ur.role.name for ur in obj.userrole_set.all()]