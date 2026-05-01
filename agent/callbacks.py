"""Agent callbacks for the Data Analyst Agent.

Contains lifecycle callbacks (before/after agent, model, and tool) plus the
reflect-and-retry failure tracking and large-result interception logic.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from data_store import data_store
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import BaseTool
from google.adk.tools.tool_context import ToolContext
from google.genai import types
from context import _current_user_id
from prompts import build_context_prefix

# ---------------------------------------------------------------------------
# Reflect & Retry state
# ---------------------------------------------------------------------------
_tool_failure_counts: dict[str, int] = {}
MAX_RETRIES = 3

# Database tools whose results should be stored for frontend fetching
_DATA_TOOLS = {
    "find_contact_in_address_book",
    "search_call_logs",
    "find_calls_by_date",
    "search_customer_call_history",
    "aggregate_address_book",
    "aggregate_calling_cdr",
    "aggregate_customer_cdr",
    "aggregate_customer_followup",
    "mariadb_execute_sql",
    # Common query tools
    "call_success_rate_last_month",
    "ping",
}


# ---------------------------------------------------------------------------
# Callbacks
# ---------------------------------------------------------------------------
# NOTE: SME ID injection is now handled via bound_params in config.py
# This is more secure as it's hidden from the model

def on_before_agent(callback_context: CallbackContext) -> None:
    """Initialize agent state on first run."""
    if "query_history" not in callback_context.state:
        callback_context.state["query_history"] = []
    return None


def before_model_modifier(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> Optional[LlmResponse]:
    """Inject context into the system prompt before each model call."""
    if callback_context.agent_name != "DataAnalystAgent":
        return None

    # Build query history context
    query_history = callback_context.state.get("query_history", [])
    history_text = ""
    if query_history:
        recent = query_history[-5:]
        history_text = "\n\nRecent query history:\n" + "\n".join(
            f"- {q}" for q in recent
        )

    context_prefix = build_context_prefix(history_text)

    # Get existing instruction text
    original_instruction = llm_request.config.system_instruction
    if original_instruction is None:
        original_text = ""
    elif hasattr(original_instruction, 'parts') and original_instruction.parts:
        original_text = original_instruction.parts[0].text or ""
    else:
        original_text = str(original_instruction)

    # Combine with context prefix
    modified_text = context_prefix + original_text

    # Set instruction
    llm_request.config.system_instruction = types.Content(
        role="system", parts=[types.Part(text=modified_text)]
    )

    return None


def after_model_modifier(
    callback_context: CallbackContext, llm_response: LlmResponse
) -> Optional[LlmResponse]:
    """Handle tool failures with reflect-and-retry logic."""
    if callback_context.agent_name != "DataAnalystAgent":
        return None

    if llm_response.error_message:
        tool_key = f"{callback_context.agent_name}_error"
        _tool_failure_counts[tool_key] = _tool_failure_counts.get(tool_key, 0) + 1

        if _tool_failure_counts[tool_key] <= MAX_RETRIES:
            return None
        # Max retries exceeded -- reset counter and let it fail
        _tool_failure_counts[tool_key] = 0
        return None

    # Only clear failure counts on successful response - don't auto-end invocation
    # Let the agent continue running to process tool results
    if llm_response.content and llm_response.content.parts:
        has_function_call = any(
            getattr(part, 'function_call', None) is not None
            for part in llm_response.content.parts
        )
        if llm_response.content.role == "model" and llm_response.content.parts[0].text and not has_function_call:
            _tool_failure_counts.clear()
            # Don't set end_invocation = True - let the agent continue

    return None


def after_tool_callback(
    tool: BaseTool, args: dict[str, Any], tool_context: ToolContext, tool_response: dict
) -> Optional[dict]:
    """Intercept database tool results: store full data, send summary to LLM."""
    tool_name = tool.name if hasattr(tool, "name") else str(tool)
    if tool_name not in _DATA_TOOLS:
        return None

    result_data = tool_response
    if isinstance(tool_response, dict):
        result_data = tool_response.get(
            "result", tool_response.get("data", tool_response)
        )

    if isinstance(result_data, str):
        try:
            result_data = json.loads(result_data)
        except (json.JSONDecodeError, TypeError):
            return None

    if not isinstance(result_data, list):
        result_data = [result_data] if result_data else []

    if not result_data:
        return None

    # Extract query from tool args for display
    query = args.get("query") or args.get("pipeline") or args.get("aggregation")
    data_id = data_store.put(result_data, tool_name, query)
    record_count = len(result_data)

    sample = result_data[:3]
    field_names = (
        list(result_data[0].keys()) if isinstance(result_data[0], dict) else []
    )

    return {
        "data_id": data_id,
        "tool_name": tool_name,
        "record_count": record_count,
        "fields": field_names,
        "sample_records": sample,
        "note": (
            f"Full {record_count} records stored with data_id='{data_id}'. "
            f"Use this data_id when calling update_dashboard_slot or display_data_cards. "
            f"The frontend will fetch the complete dataset from the backend."
        ),
    }
