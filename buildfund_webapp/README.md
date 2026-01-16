# BuildFund Web Application

This repository contains a skeleton implementation of the BuildFund platform.  It is designed to demonstrate the overall structure and flow described in the accompanying specification and report.  It is **not a complete production system**, but it includes the core models, serializers, viewsets and URL routing for borrowers, lenders, products, projects and applications.  Developers can use this as a starting point for building out the full application.

## Requirements

- Python 3.10 or later
- Django 4.x
- Django REST Framework
- django‑cors‑headers

Install dependencies into a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Environment variables

Copy `.env.example` to `.env` and set appropriate values:

```env
DJANGO_SECRET_KEY=your_secret_key_here
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=yourdomain.com
DRF_RATE_LIMIT_ANON=100/day
DRF_RATE_LIMIT_USER=1000/day
CORS_ALLOWED_ORIGINS=https://yourfrontend.com
DB_ENGINE=django.db.backends.postgresql
DB_NAME=buildfund
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=127.0.0.1
DB_PORT=5432

# External API keys

# You must provide API keys for the OpenAI ChatGPT service (used for underwriting
# report generation) and for the Google Maps Platform (used for address
# autocomplete and geocoding).  These keys must be kept secret and never
# exposed in client‑side code.  Set them in your `.env` file as shown below:

OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_maps_key
```

## Running migrations

From the project root:

```bash
python manage.py makemigrations
python manage.py migrate
```

## Starting the development server

Run:

```bash
python manage.py runserver
```

Access the API at `http://localhost:8000/api/`.

## Admin

Create a superuser for administrative tasks:

```bash
python manage.py createsuperuser
```

Log in at `http://localhost:8000/admin/` to manage users, roles, projects and products.

## Security considerations

This skeleton includes baseline security measures:

- **Rate limiting** via Django REST Framework (100 requests per day for anonymous users and 1 000 requests per day for authenticated users).  Configure via `DRF_RATE_LIMIT_ANON` and `DRF_RATE_LIMIT_USER` in your environment.
- **Token‑based authentication** for API calls.  Obtain a token via `/api/auth/token/` using your username and password.
- **CORS restrictions**: only requests from domains defined in `CORS_ALLOWED_ORIGINS` are permitted.
- **No API keys in client code**: the front‑end should store tokens securely (e.g. HTTP‑only cookies) and never expose sensitive keys.
- **Input validation**: the serializers validate incoming data; complex validation (e.g. address lookup) should be added where needed.  Always sanitise user input to prevent SQL injection or prompt injection.

## Next steps

1. Implement user registration UIs on the front‑end and integrate with the `/api/accounts/register/` endpoint.
2. Complete the multi‑step wizards for project creation and product creation on the front‑end, posting to `/api/projects/` and `/api/products/` respectively.
3. Build a matching service on the back‑end to return products matching a project’s criteria.
4. Add file upload handling using S3 or another storage service.  The `documents` app currently stores only metadata.
5. Write unit and integration tests covering all endpoints.

This repository is meant as a starting point; your development team should extend and refine it, incorporating additional security, validation and features as described in the specification.