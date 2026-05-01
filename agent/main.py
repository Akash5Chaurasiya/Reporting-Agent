"""Data Analysis Agent — FastAPI entry point.

Wires the LlmAgent with callbacks, wraps it in an ADKAgent, and exposes
the FastAPI application with data-serving and dashboard endpoints.
"""

from __future__ import annotations

import base64
import os
from typing import Optional

from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from callbacks import (
    after_model_modifier,
    after_tool_callback,
    before_model_modifier,
    on_before_agent,
)
from config import logger, toolbox_client, toolbox_tools
from context import _current_user_id  # Re-export for backward compatibility
from dashboard_queries import execute_metrics, execute_slot_query
from data_store import data_store
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from prompts import AGENT_INSTRUCTION
from report_queries import generate_report
from starlette.middleware.base import BaseHTTPMiddleware


def extract_sme_id_from_token(token: str) -> str:
    """Extract SME ID from auth token.

    Args:
        token: Base64 encoded token (format: sme_id:timestamp)

    Returns:
        SME ID string, or empty string if admin (no filter)
    """
    if not token:
        return ""

    try:
        decoded = base64.b64decode(token).decode("utf-8")
        sme_id = decoded.split(":")[0]
        return sme_id if sme_id else ""
    except Exception as e:
        logger.error(f"Error extracting SME ID from token: {e}")
        return ""


class AuthMiddleware(BaseHTTPMiddleware):
    """Extract user ID from auth headers and set in request context."""

    async def dispatch(self, request, call_next):
        # Try x-user-id header first (direct), then fall back to token
        user_id = request.headers.get("x-user-id")

        if not user_id:
            # Extract from auth token
            auth_token = request.headers.get("x-auth-token")
            if auth_token:
                user_id = extract_sme_id_from_token(auth_token)

        # Set in context var for this request
        token = _current_user_id.set(user_id)

        try:
            response = await call_next(request)
            return response
        finally:
            _current_user_id.reset(token)


def get_user_id(_input_data) -> str:
    """Extract user ID for ADKAgent - returns actual user ID or rejects request."""
    user_id = _current_user_id.get()
    if not user_id:
        # For production: reject or use a default - here we reject unauthorized
        raise ValueError("No user ID provided - authentication required")
    return user_id


# ---------------------------------------------------------------------------
# Agent creation
# ---------------------------------------------------------------------------
# Load model configuration from environment variables
# Format: "provider/model" e.g., "gemini/gemini-3.1-pro-preview", "openai/gpt-4o"
MODEL_NAME = os.getenv("MODEL_NAME", "gemini/gemini-3-flash-preview")

data_agent = LlmAgent(
    name="DataAnalystAgent",
    model=LiteLlm(model=MODEL_NAME),  # Wrap with LiteLlm
    instruction=AGENT_INSTRUCTION,
    tools=toolbox_tools,
    before_agent_callback=on_before_agent,
    before_model_callback=before_model_modifier,
    after_model_callback=after_model_modifier,
    after_tool_callback=after_tool_callback,
)

adk_agent = ADKAgent(
    adk_agent=data_agent,
    user_id_extractor=get_user_id,
    session_timeout_seconds=3600,
    use_in_memory_services=True,
)

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(title="Data Analysis Agent")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
# Allow all origins if CORS_ORIGINS is set to "*"
if CORS_ORIGINS == "*":
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGINS = CORS_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Add auth middleware to extract user ID from headers
app.add_middleware(AuthMiddleware)


@app.get("/data/{data_id}")
async def get_data(data_id: str):
    """Serve stored query results to the frontend."""
    entry = data_store.get(data_id)
    if entry is None:
        return JSONResponse(
            status_code=404, content={"error": "Data not found or expired"}
        )
    return JSONResponse(
        content={
            "data": entry["data"],
            "tool_name": entry["tool_name"],
            "query": entry.get("query"),
            "record_count": entry["record_count"],
        }
    )


@app.get("/api/dashboard/metrics")
def get_dashboard_metrics(date_range: Optional[str] = "30d"):
    """Return refreshed metric card values."""
    metrics = execute_metrics(toolbox_client, date_range=date_range)
    return JSONResponse(content={"metrics": metrics})


@app.get("/api/dashboard/{slot_id}")
def get_dashboard_slot(slot_id: str, date_range: Optional[str] = "30d"):
    """Return a single refreshed dashboard slot."""
    result = execute_slot_query(toolbox_client, slot_id, date_range=date_range)
    return JSONResponse(content=result)


# ---------------------------------------------------------------------------
# Report Download Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/reports/download")
def download_report(
    report_id: str,
    token: str = "",
    date_preset: str = "last7days",
    custom_start_date: Optional[str] = None,
    custom_end_date: Optional[str] = None,
):
    """Download a report as CSV file.

    Args:
        report_id: The report identifier (e.g., 'calling_cdr_incoming', 'agent_activity')
        token: Auth token (base64 encoded SME ID)
        date_preset: Date preset ('today', 'last7days', 'last30days', 'custom')
        custom_start_date: Start date for custom range (YYYY-MM-DD)
        custom_end_date: End date for custom range (YYYY-MM-DD)

    Returns:
        CSV file response
    """
    # Extract SME ID from token instead of accepting it directly
    sme_id = extract_sme_id_from_token(token)

    # Debug log
    print("=== BACKEND TOKEN DEBUG ===")
    print(f"Report ID: {report_id}")
    print(f"Token: {token}")
    print(f"Extracted SME ID: {sme_id}")
    print("===========================")
    try:
        csv_content, filename = generate_report(
            report_id=report_id,
            sme_id=sme_id,
            date_preset=date_preset,
            custom_start_date=custom_start_date,
            custom_end_date=custom_end_date,
        )

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        logger.error(f"Error generating report {report_id}: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)


add_adk_fastapi_endpoint(app, adk_agent, path="/")

if __name__ == "__main__":
    import uvicorn

    # Check for API key - LiteLLM expects specific env vars per provider
    if MODEL_NAME.startswith("gemini/") and not os.getenv("GOOGLE_API_KEY"):
        logger.error("GOOGLE_API_KEY not set for gemini model!")
    elif MODEL_NAME.startswith("openai/") and not os.getenv("OPENAI_API_KEY"):
        logger.error("OPENAI_API_KEY not set for openai model!")
    elif MODEL_NAME.startswith("anthropic/") and not os.getenv("ANTHROPIC_API_KEY"):
        logger.error("ANTHROPIC_API_KEY not set for anthropic model!")

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
