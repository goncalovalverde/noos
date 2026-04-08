from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds OWASP-recommended HTTP security headers to every response.

    Header rationale:
      X-Content-Type-Options    — prevents MIME-sniffing attacks
      X-Frame-Options           — blocks clickjacking via <iframe>
      X-XSS-Protection          — legacy header; set to '0' so old browsers
                                  defer entirely to the CSP instead of their
                                  broken built-in XSS filter
      Referrer-Policy           — limits referrer leakage to same origin only
      Permissions-Policy        — disables browser features not needed by this app
      Content-Security-Policy   — restricts what the browser may execute/load;
                                  API-only responses can use 'default-src none'
      Strict-Transport-Security — HSTS; only set in production where TLS is
                                  guaranteed (never over plain HTTP — the header
                                  would be ignored anyway and HSTS-preload
                                  requires HTTPS to be meaningful)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )

        # The API returns only JSON and binary file downloads — no scripts,
        # styles or frames are ever served from this origin.
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; "
            "frame-ancestors 'none'"
        )

        # HSTS must only be sent over HTTPS; on localhost/dev HTTP it is
        # meaningless and can cause hard-to-debug issues with browser preload.
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains"  # 2 years
            )

        return response
