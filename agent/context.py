"""Shared context variables for the agent."""

from contextvars import ContextVar
from typing import Optional

# SME ID extracted from auth token - used for multi-tenant filtering
_current_user_id: ContextVar[Optional[str]] = ContextVar(
    "_current_user_id", default=None
)
