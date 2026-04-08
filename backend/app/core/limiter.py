from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared limiter instance imported by main.py (registered on app.state)
# and by individual route modules that need per-endpoint limits.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
