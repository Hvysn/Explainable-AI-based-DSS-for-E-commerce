"""
Authentication & authorization dependencies for the FastAPI service.

The Node.js Express gateway is the single issuer of JWTs. This service only
verifies them (HS256) against the shared JWT_SECRET, so both tiers always agree
on identity without sharing sessions or databases.
"""

import hashlib
import hmac
import os
import threading
import time
from typing import Any, Dict, Iterable, Optional

import jwt
import requests
from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Load the root .env so local `uvicorn` runs pick up the same secrets as Docker.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(BASE_DIR, ".env"))

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ISSUER = os.getenv("JWT_ISSUER", "jhj-auth")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "jhj-dss")
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "jhj_token")
INGEST_API_KEY = os.getenv("INGEST_API_KEY", "")

# Token revocation check. The gateway knows the user's current token version;
# we ask it (with a very short cache) so password changes revoke FastAPI access
# almost immediately instead of waiting for the JWT to expire.
AUTH_GATEWAY_URL = os.getenv("AUTH_GATEWAY_URL", "http://localhost:5000").rstrip("/")
AUTH_INTROSPECTION_ENABLED = os.getenv("AUTH_INTROSPECTION_ENABLED", "true").lower() in (
    "1",
    "true",
    "yes",
)
AUTH_INTROSPECTION_TTL = int(os.getenv("AUTH_INTROSPECTION_TTL_SECONDS", "60"))

_introspection_cache: Dict[str, Any] = {}
_cache_lock = threading.Lock()
_CACHE_MAX_ENTRIES = 10_000

if not JWT_SECRET or len(JWT_SECRET) < 32:
    raise RuntimeError(
        "JWT_SECRET is missing or too short. Set a random value of at least 32 "
        "characters in .env (openssl rand -hex 32) so FastAPI can verify tokens "
        "issued by the auth gateway."
    )

if INGEST_API_KEY and len(INGEST_API_KEY) < 16:
    raise RuntimeError(
        "INGEST_API_KEY is too short. Generate one with: openssl rand -hex 32"
    )

bearer_scheme = HTTPBearer(auto_error=False)


def _extract_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    return request.cookies.get(AUTH_COOKIE_NAME)


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    """Validate the bearer token (or auth cookie) and return its claims."""
    token = _extract_token(request, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if claims.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )

    _verify_not_revoked(token, claims)
    return claims


def _verify_not_revoked(token: str, claims: Dict[str, Any]) -> None:
    """Confirm with the issuer that the session has not been revoked."""
    if not AUTH_INTROSPECTION_ENABLED:
        return

    cache_key = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = time.time()
    with _cache_lock:
        cached = _introspection_cache.get(cache_key)
        if cached and cached[0] > now:
            return
        if cached:
            _introspection_cache.pop(cache_key, None)

    try:
        response = requests.get(
            f"{AUTH_GATEWAY_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=2.5,
        )
    except requests.RequestException:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is unavailable.",
        )

    if response.status_code == status.HTTP_401_UNAUTHORIZED:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is unavailable.",
        )

    with _cache_lock:
        if len(_introspection_cache) >= _CACHE_MAX_ENTRIES:
            _introspection_cache.clear()
        _introspection_cache[cache_key] = (now + AUTH_INTROSPECTION_TTL, claims.get("sub"))


def require_roles(*roles: Iterable[str]):
    """Dependency factory enforcing one of the supplied roles."""
    allowed = {r.strip().lower() for r in roles}

    def _dependency(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        role = str(user.get("role", "")).lower()
        if role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient privileges.",
            )
        return user

    return _dependency


def require_ingest_access(
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
) -> str:
    """
    Server-to-server checkout ingress.

    Accepts a shared API key. If no key is configured, the endpoint is closed
    (fail-closed) rather than silently open.
    """
    if not INGEST_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Checkout ingress is not configured.",
        )
    if not x_api_key or not hmac.compare_digest(x_api_key, INGEST_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )
    return x_api_key
