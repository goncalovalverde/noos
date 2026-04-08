from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from app.db.base import Base


class UsedRefreshToken(Base):
    """
    Denylist of consumed refresh token JTI (JWT ID) values.

    Every refresh token contains a unique `jti` claim. When a client presents a
    refresh token at POST /auth/refresh, the JTI is checked against this table:
    - If present → token already used (or replayed) → reject with 401.
    - If absent  → store the JTI and issue new token pair.

    Rows are safe to purge after `expires_at` has passed (expired tokens are
    cryptographically invalid anyway). A scheduled cleanup task should run
    periodically to prevent unbounded table growth.
    """
    __tablename__ = "used_refresh_tokens"

    jti = Column(String, primary_key=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
