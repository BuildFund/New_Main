#!/usr/bin/env python3
"""
Management utility for the BuildFund Django project.

This script provides convenience commands for running the
development server, performing migrations, creating superusers and
other administrative tasks. It sets the default settings module
for the Django project and then executes Django’s command‑line
utility.

Usage examples:
    python manage.py runserver
    python manage.py makemigrations
    python manage.py migrate
"""
import os
import sys


def main() -> None:
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "buildfund_app.settings")
    try:
        from django.core.management import execute_from_command_line  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()