import os
import httpx
from functools import lru_cache
from jose import jwt, JWTError
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

AUTH0_DOMAIN   = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "https://api.ecolens.app")
M2M_CLIENT_ID  = os.getenv("AUTH0_M2M_CLIENT_ID", "")
M2M_CLIENT_SECRET = os.getenv("AUTH0_M2M_CLIENT_SECRET", "")

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    resp = httpx.get(url, timeout=5)
    resp.raise_for_status()
    return resp.json()


def validate_user_jwt(token: str) -> dict:
    jwks = _get_jwks()
    try:
        header = jwt.get_unverified_header(token)
        key = next(k for k in jwks["keys"] if k["kid"] == header["kid"])
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/",
        )
        return payload
    except (JWTError, StopIteration) as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict | None:
    """FastAPI dependency. Returns payload dict or None for unauthenticated/expired-token guests."""
    if credentials is None:
        return None
    try:
        return validate_user_jwt(credentials.credentials)
    except HTTPException:
        # Expired or invalid token — treat as an unauthenticated guest rather than
        # blocking the request. The client should clear its stored token.
        return None


async def get_m2m_token(scope: str) -> str:
    """Fetch a short-lived M2M access token for the given scope."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://{AUTH0_DOMAIN}/oauth/token",
            json={
                "grant_type": "client_credentials",
                "client_id": M2M_CLIENT_ID,
                "client_secret": M2M_CLIENT_SECRET,
                "audience": AUTH0_AUDIENCE,
                "scope": scope,
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]
