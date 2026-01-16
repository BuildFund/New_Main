"""Generate a secure Django secret key for production."""
from django.core.management.utils import get_random_secret_key

print("Generated Django Secret Key:")
print(get_random_secret_key())
print("\nAdd this to your .env file as:")
print("DJANGO_SECRET_KEY=<generated-key-above>")
