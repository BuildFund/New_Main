"""
WSGI config for the BuildFund project.

This module exposes the WSGI callable as a module-level variable
named ``application``.  It is used by Djangoâ€™s development server
and by WSGI servers like Gunicorn to serve the project.  For more
information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""
from __future__ import annotations

import os

from django.core.wsgi import get_wsgi_application  # type: ignore


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "buildfund_app.settings")

application = get_wsgi_application()
