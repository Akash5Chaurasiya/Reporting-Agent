"""Predefined dashboard queries executed directly via toolbox — no LLM needed.

Each slot has a MongoDB aggregation pipeline and chart configuration.
The toolbox_client calls the MCP Toolbox server to execute queries.
Includes TTL-based caching so multiple users get instant responses.
"""

from __future__ import annotations

import copy
import json
import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from context import _current_user_id

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SME ID helpers
# ---------------------------------------------------------------------------


def get_current_sme_id() -> Optional[int]:
    """Get the current SME ID from the context variable.

    Returns:
        SME ID as integer if available, None otherwise.
    """
    try:
        sme_id = _current_user_id.get()
        logger.debug("Raw SME ID from context: %s, type: %s", sme_id, type(sme_id))
        if sme_id:
            return int(sme_id)
    except (LookupError, ValueError, TypeError) as e:
        logger.debug("Error getting SME ID: %s", e)
    return None


# ---------------------------------------------------------------------------
# Query result cache (thread-safe, TTL-based)
# ---------------------------------------------------------------------------

CACHE_TTL_SECONDS = 300  # 5 minutes

_cache_lock = threading.Lock()
_cache: dict[str, tuple[float, Any]] = {}


def _get_cached(key: str) -> Any | None:
    """Return cached value if within TTL, else None."""
    with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        ts, data = entry
        if time.time() - ts < CACHE_TTL_SECONDS:
            return copy.deepcopy(data)
        del _cache[key]
    return None


def _set_cache(key: str, data: Any) -> None:
    with _cache_lock:
        _cache[key] = (time.time(), copy.deepcopy(data))


# ---------------------------------------------------------------------------
# Date range helpers
# ---------------------------------------------------------------------------

# Map tool_name → date field used for filtering
_DATE_FIELDS: dict[str, str] = {
    "aggregate_calling_cdr": "start_date_time",
    "aggregate_customer_cdr": "start_date",
    "aggregate_customer_followup": "reminder_date_time",
}

# Tools/collections that have sme_id field for multi-tenant filtering
_SME_ID_COLLECTIONS: set[str] = {
    "aggregate_calling_cdr",
    "aggregate_customer_cdr",
    "aggregate_address_book",
}

# Map date range option to number of days
_DATE_RANGE_DAYS: dict[str, int] = {
    "1d": 1,
    "7d": 7,
    "14d": 14,
    "30d": 30,
}


def _date_range_from_option(option: str = "30d") -> tuple[str, str]:
    """Return (start_iso, end_iso) for the given date range option in UTC."""
    days = _DATE_RANGE_DAYS.get(option, 30)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    return (
        start.strftime("%Y-%m-%dT00:00:00Z"),
        end.strftime("%Y-%m-%dT23:59:59Z"),
    )


def _date_range_30d() -> tuple[str, str]:
    """Return (start_iso, end_iso) for the last 30 days in UTC."""
    return _date_range_from_option("30d")


def _date_range_label(start_iso: str, end_iso: str) -> str:
    """Format date range as 'Jan 8 – Feb 7, 2025'."""
    s = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    e = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
    if s.year == e.year:
        return f"{s.strftime('%b %d')} – {e.strftime('%b %d, %Y')}"
    return f"{s.strftime('%b %d, %Y')} – {e.strftime('%b %d, %Y')}"


def _inject_date_filter(
    tool_name: str,
    pipeline: list,
    start_iso: str,
    end_iso: str,
    sme_id: Optional[int] = None,
) -> list:
    """Add date filter to the pipeline using $date extended JSON syntax.

    NOTE: SME ID is passed as parameter to tool, not in pipeline.

    Args:
        tool_name: Name of the tool (determines which date field to use)
        pipeline: The aggregation pipeline to modify
        start_iso: Start date in ISO format
        end_iso: End date in ISO format
        sme_id: Deprecated - ignored (SME ID passed as param to tool)
    """
    # Get the date field for this tool
    date_field = _DATE_FIELDS.get(tool_name)
    if not date_field or not start_iso or not end_iso:
        return pipeline

    # Build date filter using $date extended JSON syntax
    date_filter = {
        date_field: {"$gte": {"$date": start_iso}, "$lte": {"$date": end_iso}}
    }

    # Prepend date filter to pipeline
    return [{"$match": date_filter}] + pipeline


# ---------------------------------------------------------------------------
# Pretty-print helpers
# ---------------------------------------------------------------------------

_CAMPAIGN_LABELS: dict[str, str] = {
    "click_to_call_campaign": "Click to Call",
    "power_dialer": "Power Dialer",
    "preview_manual": "Preview Manual",
    "preview_auto": "Preview Auto",
    "predictive_dialer": "Predictive",
    "progressive_dialer": "Progressive",
    "manual_dialer": "Manual Dialer",
}


def _prettify_campaign(records: list[dict]) -> list[dict]:
    """Replace raw campaign_type slugs with human-friendly labels."""
    for r in records:
        raw = r.get("campaign", "") or ""
        r["campaign"] = _CAMPAIGN_LABELS.get(raw, raw.replace("_", " ").title())
    return records


# ---------------------------------------------------------------------------
# Slot query definitions
# ---------------------------------------------------------------------------

SLOT_DEFINITIONS: dict[str, dict[str, Any]] = {
    "slot1": {
        "tool_name": "aggregate_calling_cdr",
        "pipeline": [
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$start_date_time",
                        }
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
            {"$project": {"date": "$_id", "count": 1, "_id": 0}},
        ],
        "config": {
            "chartType": "area",
            "title": "Call Volume Trends",
            "description": "Daily call volume",
            "indexKey": "date",
            "categories": ["count"],
            "xAxisLabel": "Date",
            "yAxisLabel": "Calls",
        },
    },
    "slot2": {
        "tool_name": "aggregate_calling_cdr",
        "pipeline": [
            {"$match": {"agent_name": {"$nin": [None, ""]}}},
            {"$group": {"_id": "$agent_name", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10},
            {"$project": {"agent_name": "$_id", "count": 1, "_id": 0}},
        ],
        "config": {
            "chartType": "bar",
            "title": "Top Agents by Call Volume",
            "description": "Top 10 agents by number of calls",
            "indexKey": "agent_name",
            "categories": ["count"],
            "xAxisLabel": "Agent Name",
            "yAxisLabel": "Call Count",
        },
    },
    "slot3": {
        "tool_name": "aggregate_calling_cdr",
        "pipeline": [
            {"$match": {"final_status": {"$nin": [None, ""]}}},
            {"$group": {"_id": "$final_status", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$project": {"status": "$_id", "count": 1, "_id": 0}},
        ],
        "config": {
            "chartType": "donut",
            "title": "Call Status Distribution",
            "description": "Breakdown by final call status",
            "indexKey": "status",
            "categories": ["count"],
        },
    },
    "slot4": {
        "tool_name": "aggregate_customer_followup",
        "pipeline": [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            {
                "$project": {
                    "status": {"$cond": [{"$eq": ["$_id", 0]}, "Pending", "Completed"]},
                    "count": 1,
                    "_id": 0,
                }
            },
        ],
        "config": {
            "chartType": "bar",
            "title": "Followup Status",
            "description": "Pending vs completed followups",
            "indexKey": "status",
            "categories": ["count"],
            "xAxisLabel": "Status",
            "yAxisLabel": "Count",
        },
    },
    "slot5": {
        "tool_name": "aggregate_calling_cdr",
        "pipeline": [
            {"$match": {"campaign_type": {"$nin": [None, ""]}}},
            {
                "$group": {
                    "_id": "$campaign_type",
                    "total_calls": {"$sum": 1},
                }
            },
            {
                "$project": {
                    "campaign": "$_id",
                    "total_calls": 1,
                    "_id": 0,
                }
            },
            {"$sort": {"total_calls": -1}},
        ],
        "post_process": _prettify_campaign,
        "config": {
            "chartType": "bar",
            "title": "Campaign Performance",
            "description": "Total calls by campaign type",
            "indexKey": "campaign",
            "categories": ["total_calls"],
            "xAxisLabel": "Campaign",
            "yAxisLabel": "Total Calls",
        },
    },
    "slot6": {
        "tool_name": "aggregate_calling_cdr",
        "pipeline": [
            {"$group": {"_id": "$call_direction", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {
                "$project": {
                    "direction": {"$ifNull": ["$_id", "Unknown"]},
                    "count": 1,
                    "_id": 0,
                }
            },
        ],
        "config": {
            "chartType": "pie",
            "title": "Incoming vs Outgoing Calls",
            "description": "Number of incoming and outgoing calls",
            "indexKey": "direction",
            "categories": ["count"],
        },
    },
}

# ---------------------------------------------------------------------------
# Metric query definitions
# ---------------------------------------------------------------------------

METRIC_DEFINITIONS: list[dict[str, Any]] = [
    {
        "label": "Total Contacts",
        "tool_name": "aggregate_address_book",
        "pipeline": [{"$count": "count"}],
        "format": lambda r: f"{r[0]['count']:,}" if r else "0",
    },
    {
        "label": "Total Calls",
        "tool_name": "aggregate_calling_cdr",
        "pipeline": [
            {"$count": "count"},
        ],
        "format": lambda r: f"{r[0]['count']:,}" if r else "0",
    },
    {
        "label": "Avg Duration",
        "tool_name": "aggregate_calling_cdr",
        "pipeline": [
            {"$match": {"connected_duration": {"$gt": 0}}},
            {"$group": {"_id": None, "avg": {"$avg": "$connected_duration"}}},
        ],
        "format": lambda r: f"{r[0]['avg']:.0f}s" if r and r[0].get("avg") else "0s",
    },
    {
        "label": "Pending Followups",
        "tool_name": "aggregate_customer_followup",
        "pipeline": [{"$match": {"status": 0}}, {"$count": "count"}],
        "format": lambda r: f"{r[0]['count']:,}" if r else "0",
    },
    {
        "label": "Completed Followups",
        "tool_name": "aggregate_customer_followup",
        "pipeline": [{"$match": {"status": 1}}, {"$count": "count"}],
        "format": lambda r: f"{r[0]['count']:,}" if r else "0",
    },
    {
        "label": "Active Customers",
        "tool_name": "aggregate_customer_cdr",
        "pipeline": [
            {"$group": {"_id": "$customer_number"}},
            {"$count": "count"},
        ],
        "format": lambda r: f"{r[0]['count']:,}" if r else "0",
    },
]

# ---------------------------------------------------------------------------
# Tool execution helpers
# ---------------------------------------------------------------------------

_tool_cache: dict[str, Any] = {}


def _get_tool(toolbox_client: Any, tool_name: str) -> Any:
    """Load and cache a toolbox tool by name."""
    if tool_name not in _tool_cache:
        _tool_cache[tool_name] = toolbox_client.load_tool(tool_name)
    return _tool_cache[tool_name]


def _parse_result(raw: Any) -> list[dict]:
    """Normalize tool output into a list of dicts."""
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else [parsed] if parsed else []
        except (json.JSONDecodeError, TypeError):
            return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        inner = raw.get("result", raw.get("data", raw))
        if isinstance(inner, str):
            try:
                parsed = json.loads(inner)
                return parsed if isinstance(parsed, list) else [parsed]
            except (json.JSONDecodeError, TypeError):
                return []
        if isinstance(inner, list):
            return inner
        return [inner] if inner else []
    return []


def _call_tool(toolbox_client: Any, tool_name: str, pipeline: list) -> list[dict]:
    """Execute a toolbox aggregation tool and return parsed results.

    For tools that support SME ID filtering, the SME ID is passed as a parameter.
    Date filtering is in the pipeline.
    """
    # Get the tool
    tool = _get_tool(toolbox_client, tool_name)

    # Get SME ID for tools that support it - pass as parameter, NOT in pipeline
    sme_id = get_current_sme_id() if tool_name in _SME_ID_COLLECTIONS else None

    logger.debug("Tool: %s, SME ID: %s, Pipeline: %s", tool_name, sme_id, pipeline)

    # Format pipeline as comma-separated JSON objects (no outer brackets)
    # Tool expects: {"$match": {...}}, {"$group": {...}}
    pipeline_str = ", ".join(json.dumps(stage) for stage in pipeline)

    if sme_id is not None:
        # Pass SME ID as string - tool (tools.yaml) adds the $match internally
        raw = tool(pipeline=pipeline_str, sme_id=str(sme_id))
    else:
        raw = tool(pipeline=pipeline_str)

    return _parse_result(raw)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def execute_slot_query(
    toolbox_client: Any, slot_id: str, date_range: str = "30d"
) -> dict[str, Any]:
    """Execute a single slot query. Returns {config, data, record_count}.

    Results are cached for CACHE_TTL_SECONDS to speed up repeat requests.
    A date filter and SME ID filter are injected for collections that have these fields.
    The SME ID is automatically extracted from the current user's session.
    """
    defn = SLOT_DEFINITIONS.get(slot_id)
    if not defn:
        return {"error": f"Unknown slot: {slot_id}"}

    # Get SME ID from context for caching
    sme_id = get_current_sme_id()

    # Check cache first (include sme_id and date_range in cache key)
    cache_key = f"slot:{slot_id}:{date_range}:sme_{sme_id or 'none'}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        # Compute date range and inject filter
        start_iso, end_iso = _date_range_from_option(date_range)
        date_label = _date_range_label(start_iso, end_iso)
        pipeline = _inject_date_filter(
            defn["tool_name"], defn["pipeline"], start_iso, end_iso
        )

        data = _call_tool(toolbox_client, defn["tool_name"], pipeline)
        post_process = defn.get("post_process")
        if post_process:
            data = post_process(data)

        # Build config with date range metadata
        config = {
            **defn["config"],
            "description": f"{defn['config']['description']} ({date_label})",
            "dateRange": {"from": start_iso[:10], "to": end_iso[:10]},
        }

        result = {
            "config": config,
            "data": data,
            "record_count": len(data),
            "query": defn["pipeline"],
        }
        _set_cache(cache_key, result)
        return result
    except Exception as e:
        logger.exception("Failed to execute query for %s", slot_id)
        return {
            "error": str(e),
            "config": defn["config"],
            "data": [],
            "record_count": 0,
        }


def execute_metrics(
    toolbox_client: Any, date_range: str = "30d"
) -> list[dict[str, str]]:
    """Execute all metric queries. Returns [{label, value}, ...].

    Results are cached for CACHE_TTL_SECONDS.
    Metric queries get both date filter and SME ID filter where applicable.
    The SME ID is automatically extracted from the current user's session.
    """
    # Get SME ID from context for caching
    sme_id = get_current_sme_id()

    # Check cache first (include sme_id and date_range in cache key)
    cache_key = f"metrics:{date_range}:sme_{sme_id or 'none'}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    start_iso, end_iso = _date_range_from_option(date_range)
    results = []
    for defn in METRIC_DEFINITIONS:
        try:
            pipeline = _inject_date_filter(
                defn["tool_name"], defn["pipeline"], start_iso, end_iso
            )
            data = _call_tool(toolbox_client, defn["tool_name"], pipeline)
            value = defn["format"](data)
            results.append({"label": defn["label"], "value": value})
        except Exception:
            logger.exception("Failed metric query: %s", defn["label"])
            results.append({"label": defn["label"], "value": "Error"})

    _set_cache(cache_key, results)
    return results
