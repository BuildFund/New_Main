#!/usr/bin/env python
"""Fix migration dependency issue."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Check if documents migration exists
    cursor.execute("SELECT COUNT(*) FROM django_migrations WHERE app='documents' AND name='0001_initial'")
    exists = cursor.fetchone()[0] > 0
    
    if not exists:
        # Insert the documents migration record
        cursor.execute(
            "INSERT INTO django_migrations (app, name, applied) VALUES ('documents', '0001_initial', datetime('now'))"
        )
        print("Documents migration marked as applied")
    else:
        print("Documents migration already exists")
    
    connection.commit()
    print("Migration fix complete")
