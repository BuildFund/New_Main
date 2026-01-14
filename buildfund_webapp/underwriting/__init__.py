"""
Underwriting reports app.

This app provides models and API endpoints for generating and
persisting AI‑powered underwriting reports.  Reports are
produced by calling the OpenAI ChatGPT API on the server side
using the project, borrower and lender data as context.

See `views.py` for the implementation of the report generation
endpoint and `models.py` for the report model.
"""
