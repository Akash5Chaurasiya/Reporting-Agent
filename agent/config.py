"""Shared configuration: logging, environment, tracing, and toolbox client.

Importing this module triggers side effects (dotenv loading, Langfuse init,
OpenTelemetry setup, toolbox client connection) that must happen once at
startup. Every other module should import from here rather than repeating
these setup steps.
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from langfuse import get_client
from openinference.instrumentation.google_adk import GoogleADKInstrumentor
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from dashboard_queries import get_current_sme_id
from toolbox_core import ToolboxSyncClient

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.ERROR, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Suppress noisy OpenTelemetry context-detach errors (known issue with
# async generators + Python 3.14 contextvars in Google ADK).
logging.getLogger("opentelemetry").setLevel(logging.CRITICAL)

# ---------------------------------------------------------------------------
# Langfuse tracing
# ---------------------------------------------------------------------------
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY", "")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY", "")
LANGFUSE_BASE_URL = os.getenv("LANGFUSE_BASE_URL", "")

langfuse = None
if LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY:
    langfuse = get_client()
    if langfuse.auth_check():
        logger.info("Langfuse client is authenticated and ready!")
        try:
            GoogleADKInstrumentor().instrument()
        except Exception as e:
            logger.warning("GoogleADKInstrumentor failed (version mismatch): %s", e)
    else:
        logger.warning("Langfuse authentication failed. Please check credentials.")

# ---------------------------------------------------------------------------
# OpenTelemetry tracing (for Langfuse)
# ---------------------------------------------------------------------------
if langfuse:
    # Langfuse handles tracing via the instrumentor above
    # This sets up a basic tracer for additional custom spans if needed
    tracer_provider = trace_sdk.TracerProvider()
    trace.set_tracer_provider(tracer_provider)

# ---------------------------------------------------------------------------
# MCP Toolbox client
# ---------------------------------------------------------------------------
TOOLBOX_URL = os.getenv("TOOLBOX_URL", "http://127.0.0.1:5000")
toolbox_client = ToolboxSyncClient(TOOLBOX_URL)

# Bound params are hidden from the model - values are injected at tool execution time
# The callable is invoked within the request context where SME ID is available
def get_sme_id_bound():
    """Get SME ID for bound_params - called at tool execution time."""
    sme_id = get_current_sme_id()
    if sme_id is None:
        return None
    return str(sme_id)  # Convert to string - toolbox expects string type

toolbox_tools = toolbox_client.load_toolset(
    bound_params={"sme_id": get_sme_id_bound}
)
