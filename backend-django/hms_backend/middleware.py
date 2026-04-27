"""
SEO & Security HTTP Headers Middleware for MediCore HMS.

Adds:
  - X-Frame-Options (clickjacking protection)
  - X-Content-Type-Options (MIME sniffing protection)
  - Referrer-Policy
  - Permissions-Policy
  - Cache-Control for API responses
  - Strict-Transport-Security (HSTS) for production
  - Content-Language based on Accept-Language header
"""
from django.conf import settings


class SEOSecurityHeadersMiddleware:
    """Attach SEO-relevant and security HTTP response headers."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # ── Clickjacking protection
        response["X-Frame-Options"] = "SAMEORIGIN"

        # ── MIME type sniffing protection
        response["X-Content-Type-Options"] = "nosniff"

        # ── Referrer policy
        response["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # ── Permissions policy — restrict powerful browser features
        response["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        # ── XSS protection (legacy browsers)
        response["X-XSS-Protection"] = "1; mode=block"

        # ── HSTS in production only
        if not settings.DEBUG:
            response["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # ── Content language from Accept-Language header
        accept_lang = request.META.get("HTTP_ACCEPT_LANGUAGE", "en")
        lang = "ar" if accept_lang.startswith("ar") else "en"
        response["Content-Language"] = lang

        # ── Cache-Control for API endpoints
        if request.path.startswith("/api/"):
            response["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response["Pragma"] = "no-cache"

        # ── Allow search engines to index public pages
        if request.path in ("/", "/robots.txt", "/sitemap.xml"):
            response["Cache-Control"] = "public, max-age=86400"  # 1 day

        return response
