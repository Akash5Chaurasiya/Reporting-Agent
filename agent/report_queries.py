"""Report generation functions for downloading reports as CSV.

This module provides functions to execute MongoDB and MariaDB queries
and return results in CSV format for download.
"""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId

from db_connections import get_mongo_collection, mysql_cursor

# Load query configurations
def load_queries() -> Dict[str, Any]:
    """Load MongoDB query configurations."""
    with open("config/queries.json", "r") as f:
        return json.load(f)


def load_mariadb_queries() -> Dict[str, Any]:
    """Load MariaDB query configurations."""
    with open("config/mariadb_queries.json", "r") as f:
        return json.load(f)


# Date range helpers
def parse_date_range(date_preset: str) -> tuple[str, str]:
    """Parse date preset to get start and end dates.

    Args:
        date_preset: One of 'today', 'last7days', 'last30days', or ISO date string

    Returns:
        Tuple of (start_date, end_date) in YYYY-MM-DD format
    """
    today = datetime.now()
    today_str = today.strftime("%Y-%m-%d")

    if date_preset == "today":
        return (today_str, today_str)
    elif date_preset == "last7days":
        from datetime import timedelta
        start = today - timedelta(days=7)
        return (start.strftime("%Y-%m-%d"), today_str)
    elif date_preset == "last30days":
        from datetime import timedelta
        start = today - timedelta(days=30)
        return (start.strftime("%Y-%m-%d"), today_str)
    else:
        # Assume it's already a date or date range string
        return (date_preset, today_str)


def convert_mongo_date(date_val: Any) -> str:
    """Convert MongoDB date to ISO string."""
    if isinstance(date_val, datetime):
        return date_val.isoformat()
    elif isinstance(date_val, str):
        return date_val
    return str(date_val)


def sanitize_value(value: Any) -> str:
    """Sanitize value for CSV output."""
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return json.dumps(value)
    if isinstance(value, list):
        return json.dumps(value)
    return str(value)


def dict_to_csv(data: List[Dict[str, Any]]) -> str:
    """Convert list of dictionaries to CSV string."""
    if not data:
        return ""

    output = io.StringIO()

    # Collect all unique fieldnames from all rows
    all_fieldnames = set()
    for row in data:
        all_fieldnames.update(row.keys())

    # Sort fieldnames for consistent output
    fieldnames = sorted(all_fieldnames)

    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')

    writer.writeheader()
    for row in data:
        # Sanitize each value
        sanitized_row = {k: sanitize_value(v) for k, v in row.items()}
        writer.writerow(sanitized_row)

    return output.getvalue()


# MongoDB Report Functions
def get_incoming_calls_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate Incoming Calls report from MongoDB.

    Args:
        sme_id: SME ID to filter by (empty string = all SMEs)
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        limit: Maximum number of records

    Returns:
        CSV string of the report data
    """
    queries = load_queries()
    query_config = queries.get("calling_cdr_incoming", {})

    # Build the MongoDB pipeline with actual values
    collection = get_mongo_collection("calling_cdr")

    # Convert dates to datetime for MongoDB query
    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    # Build match conditions
    match_conditions = {
        "call_direction": "INCOMING",
        "start_date_time": {
            "$gte": start_dt,
            "$lte": end_dt
        }
    }

    # If SME ID is provided and not empty, filter by it
    # Try as number first, then as string (MongoDB might store either)
    if sme_id and sme_id.strip():
        try:
            # Try as number
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            # Try as string if not a number
            match_conditions["sme_id"] = sme_id

        # Also add an OR condition to match both string and number
        # This handles cases where MongoDB might store sme_id differently
        original_value = match_conditions["sme_id"]
        match_conditions["$or"] = [
            {"sme_id": original_value},
            {"sme_id": str(original_value) if isinstance(original_value, int) else original_value},
            {"sme_id": int(sme_id) if sme_id.isdigit() else original_value}
        ]
        # Remove the direct sme_id filter since we have $or now
        del match_conditions["sme_id"]

    # Debug: Print the final MongoDB query
    print(f"=== MONGODB QUERY ===")
    print(f"Collection: calling_cdr")
    print(f"Match Conditions: {match_conditions}")
    print(f"=====================")

    pipeline = [
        {
            "$match": match_conditions
        },
        {
            "$project": {
                "start_date_time": 1,
                "session_id": 1,
                "longcode": 1,
                "campaign_name": 1,
                "queue_name": 1,
                "call_flow_name": 1,
                "final_status": 1,
                "customer_number": 1,
                "agent_number": 1,
                "agent_name": 1,
                "customer_ringing_duration": 1,
                "duration": 1,
                "recording_path": 1,
                "disposition_form_name": 1,
                "disconnected_by": 1,
                "remarks": 1,
                "ivr_duration": 1,
                "after_call_wrapup_time": 1,
                "conferenceDuration": 1,
                "on_call_hold_time": 1,
                "mute_duration": 1,
                "agent_ringing_duration": 1,
                "customer_hangup_cause": 1,
                "agent_hangup_cause": 1,
                "queue_wait_duration": 1,
                "final_dtmf": 1
            }
        },
        {"$sort": {"start_date_time": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "address_book",
                "localField": "customer_number",
                "foreignField": "customer_number_primary",
                "as": "address_book"
            }
        },
        {
            "$unwind": {
                "path": "$address_book",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "Date & Time": "$start_date_time",
                "Session Id": "$session_id",
                "VMN": "$longcode",
                "Campaign Name": "$campaign_name",
                "Queue Name": "$queue_name",
                "Call Flow": "$call_flow_name",
                "Call Status": "$final_status",
                "Customer Number": "$customer_number",
                "Customer Name": "$address_book.customer_name",
                "Agent Number": "$agent_number",
                "Agent Name": "$agent_name",
                "Customer Ringing Duration": "$customer_ringing_duration",
                "Call Duration": "$duration",
                "Recording": "$recording_path",
                "Disposition": "$disposition_form_name",
                "Disconnected By": "$disconnected_by",
                "Remark": "$remarks",
                "IVR Duration": "$ivr_duration",
                "Wrapup Time": "$after_call_wrapup_time",
                "Conference Duration": "$conferenceDuration",
                "Total Hold Time": "$on_call_hold_time",
                "Total Mute Time": "$mute_duration",
                "Agent Ringing Duration": "$agent_ringing_duration",
                "Customer Hangup Cause": "$customer_hangup_cause",
                "Agent Hangup Cause": "$agent_hangup_cause",
                "Queue Wait Time": "$queue_wait_duration",
                "DTMFS": "$final_dtmf"
            }
        }
    ]

    results = list(collection.aggregate(pipeline))

    # Convert dates to strings for CSV
    for row in results:
        if "Date & Time" in row:
            row["Date & Time"] = convert_mongo_date(row["Date & Time"])

    return dict_to_csv(results)


def get_outgoing_calls_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate Outgoing Calls report from MongoDB."""
    queries = load_queries()
    query_config = queries.get("calling_cdr_outgoing", {})

    collection = get_mongo_collection("calling_cdr")

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    # Build match conditions
    match_conditions = {
        "call_direction": "OUTGOING",
        "start_date_time": {
            "$gte": start_dt,
            "$lte": end_dt
        }
    }

    # If SME ID is provided and not empty, filter by it
    if sme_id and sme_id.strip():
        try:
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            match_conditions["sme_id"] = sme_id

    pipeline = [
        {
            "$match": match_conditions
        },
        {
            "$project": {
                "start_date_time": 1,
                "session_id": 1,
                "longcode": 1,
                "campaign_name": 1,
                "queue_name": 1,
                "call_flow_name": 1,
                "final_status": 1,
                "customer_number": 1,
                "agent_number": 1,
                "agent_name": 1,
                "customer_ringing_duration": 1,
                "duration": 1,
                "recording_path": 1,
                "disposition_form_name": 1,
                "disconnected_by": 1,
                "remarks": 1,
                "ivr_duration": 1,
                "after_call_wrapup_time": 1,
                "conferenceDuration": 1,
                "on_call_hold_time": 1,
                "mute_duration": 1,
                "agent_ringing_duration": 1,
                "customer_hangup_cause": 1,
                "agent_hangup_cause": 1,
                "queue_wait_duration": 1,
                "final_dtmf": 1
            }
        },
        {"$sort": {"start_date_time": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "address_book",
                "localField": "customer_number",
                "foreignField": "customer_number_primary",
                "as": "address_book"
            }
        },
        {
            "$unwind": {
                "path": "$address_book",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "Date & Time": "$start_date_time",
                "Session Id": "$session_id",
                "VMN": "$longcode",
                "Campaign Name": "$campaign_name",
                "Queue Name": "$queue_name",
                "Call Flow": "$call_flow_name",
                "Call Status": "$final_status",
                "Customer Number": "$customer_number",
                "Customer Name": "$address_book.customer_name",
                "Agent Number": "$agent_number",
                "Agent Name": "$agent_name",
                "Customer Ringing Duration": "$customer_ringing_duration",
                "Call Duration": "$duration",
                "Recording": "$recording_path",
                "Disposition": "$disposition_form_name",
                "Disconnected By": "$disconnected_by",
                "Remark": "$remarks",
                "IVR Duration": "$ivr_duration",
                "Wrapup Time": "$after_call_wrapup_time",
                "Conference Duration": "$conferenceDuration",
                "Total Hold Time": "$on_call_hold_time",
                "Total Mute Time": "$mute_duration",
                "Agent Ringing Duration": "$agent_ringing_duration",
                "Customer Hangup Cause": "$customer_hangup_cause",
                "Agent Hangup Cause": "$agent_hangup_cause",
                "Queue Wait Time": "$queue_wait_duration",
                "DTMFS": "$final_dtmf"
            }
        }
    ]

    results = list(collection.aggregate(pipeline))

    for row in results:
        if "Date & Time" in row:
            row["Date & Time"] = convert_mongo_date(row["Date & Time"])

    return dict_to_csv(results)


# MariaDB Report Functions
def get_agent_activity_report(
    sme_id: int,
    start_date: str,
    end_date: str
) -> str:
    """Generate Agent Activity report from MariaDB.

    Args:
        sme_id: SME ID to filter by
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format

    Returns:
        CSV string of the report data
    """
    import logging
    logger = logging.getLogger(__name__)

    queries = load_mariadb_queries()
    query_template = queries.get("agent_activity", {}).get("query", "")

    if not query_template:
        return "Error: Agent activity query not found"

    # Replace placeholders in query
    query = query_template.replace("{{start_date}}", start_date)
    query = query.replace("{{end_date}}", end_date)
    query = query.replace("{{sme_id}}", str(sme_id))

    # Debug: Print the full SQL query with replaced SME ID
    print(f"=== MARIADB QUERY ===")
    print(f"Report: agent_activity")
    print(f"SME ID: {sme_id}")
    print(f"Query: {query}")
    print(f"=====================")

    try:
        with mysql_cursor() as cursor:
            cursor.execute(query)
            columns = [desc[0] for desc in cursor.description]
            results = cursor.fetchall()

        logger.error(f"Agent Activity results: {len(results)} rows")
        # Convert to list of dicts
        data = [dict(zip(columns, row)) for row in results]
        return dict_to_csv(data)
    except Exception as e:
        logger.error(f"Agent Activity error: {e}")
        return f"Error: {str(e)}"


# ---------------------------------------------------------------------------
# Additional MongoDB Report Functions
# ---------------------------------------------------------------------------

def get_manual_outbound_calls_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate Manual Outbound Calls report from MongoDB."""
    collection = get_mongo_collection("calling_cdr")

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    # Build match conditions
    match_conditions = {
        "call_mode": 3,  # Manual outbound
        "start_date_time": {
            "$gte": start_dt,
            "$lte": end_dt
        }
    }

    # Add SME ID filter if provided
    if sme_id and sme_id.strip():
        try:
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            match_conditions["sme_id"] = sme_id

    pipeline = [
        {"$match": match_conditions},
        {
            "$project": {
                "start_date_time": 1, "session_id": 1, "longcode": 1,
                "campaign_name": 1, "queue_name": 1, "call_flow_name": 1,
                "final_status": 1, "customer_number": 1, "agent_number": 1,
                "agent_name": 1, "agent_ringing_duration": 1,
                "customer_ringing_duration": 1, "on_call_hold_time": 1,
                "after_call_wrapup_time": 1, "duration": 1, "recording_path": 1,
                "disposition_form_name": 1, "disconnected_by": 1, "remarks": 1
            }
        },
        {"$sort": {"start_date_time": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "address_book",
                "localField": "customer_number",
                "foreignField": "customer_number_primary",
                "as": "address_book"
            }
        },
        {
            "$unwind": {
                "path": "$address_book",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "Date & Time": "$start_date_time", "Session Id": "$session_id",
                "VMN": "$longcode", "Campaign Name": "$campaign_name",
                "Queue Name": "$queue_name", "Call Flow": "$call_flow_name",
                "Call Status": "$final_status", "Customer Number": "$customer_number",
                "Customer Name": "$address_book.customer_name",
                "Agent Number": "$agent_number", "Agent Name": "$agent_name",
                "Agent Ring Time": "$agent_ringing_duration",
                "Customer Ringing Time": "$customer_ringing_duration",
                "Hold Time": "$on_call_hold_time", "Wrapup Time": "$after_call_wrapup_time",
                "Call Duration": "$duration", "Recording": "$recording_path",
                "Disposition": "$disposition_form_name",
                "Disconnected By": "$disconnected_by", "Remark": "$remarks"
            }
        }
    ]

    results = list(collection.aggregate(pipeline))
    for row in results:
        if "Date & Time" in row:
            row["Date & Time"] = convert_mongo_date(row["Date & Time"])

    return dict_to_csv(results)


def get_failed_calls_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate Failed Calls (not patched) report from MongoDB."""
    collection = get_mongo_collection("calling_cdr")

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    match_conditions = {
        "final_status": "notpatched",
        "start_date_time": {"$gte": start_dt, "$lte": end_dt}
    }

    if sme_id and sme_id.strip():
        try:
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            match_conditions["sme_id"] = sme_id

    pipeline = [
        {"$match": match_conditions},
        {
            "$project": {
                "start_date_time": 1, "session_id": 1, "longcode": 1,
                "call_direction": 1, "campaign_name": 1, "queue_name": 1,
                "call_flow_name": 1, "queue_wait_duration": 1, "customer_number": 1,
                "agent_number": 1, "agent_name": 1, "voicemail_duration": 1,
                "voicemail_recording_path": 1, "agent_hangup_cause": 1,
                "customer_hangup_cause": 1, "remarks": 1
            }
        },
        {"$sort": {"start_date_time": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "address_book",
                "localField": "customer_number",
                "foreignField": "customer_number_primary",
                "as": "address_book"
            }
        },
        {
            "$unwind": {
                "path": "$address_book",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "Date & Time": "$start_date_time", "Session Id": "$session_id",
                "VMN": "$longcode", "Call Type": "$call_direction",
                "Campaign Name": "$campaign_name", "Queue Name": "$queue_name",
                "Call Flow": "$call_flow_name",
                "Queue Wait Time(Sec)": "$queue_wait_duration",
                "Customer Number": "$customer_number",
                "Customer Name": "$address_book.customer_name",
                "Agent Number": "$agent_number", "Agent Name": "$agent_name",
                "Voice Mail Duration": "$voicemail_duration",
                "Voicemail Recording": "$voicemail_recording_path",
                "Agent Hangup Cause": "$agent_hangup_cause",
                "Customer Hangup Cause": "$customer_hangup_cause",
                "Remark": "$remarks"
            }
        }
    ]

    results = list(collection.aggregate(pipeline))
    for row in results:
        if "Date & Time" in row:
            row["Date & Time"] = convert_mongo_date(row["Date & Time"])

    return dict_to_csv(results)


def get_abandoned_calls_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate Abandoned Calls report from MongoDB."""
    collection = get_mongo_collection("calling_cdr")

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    match_conditions = {
        "final_status": "abandoned",
        "start_date_time": {"$gte": start_dt, "$lte": end_dt}
    }

    if sme_id and sme_id.strip():
        try:
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            match_conditions["sme_id"] = sme_id

    pipeline = [
        {"$match": match_conditions},
        {
            "$project": {
                "start_date_time": 1, "session_id": 1, "longcode": 1,
                "call_direction": 1, "campaign_name": 1, "campaign_type": 1,
                "queue_name": 1, "call_flow_name": 1, "final_status": 1,
                "queue_wait_duration": 1, "customer_number": 1, "agent_number": 1,
                "agent_name": 1, "voicemail_duration": 1,
                "voicemail_recording_path": 1, "agent_hangup_cause": 1,
                "customer_hangup_cause": 1, "customer_ringing_duration": 1, "remarks": 1
            }
        },
        {"$sort": {"start_date_time": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "address_book",
                "localField": "customer_number",
                "foreignField": "customer_number_primary",
                "as": "address_book"
            }
        },
        {
            "$unwind": {
                "path": "$address_book",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "Date & Time": "$start_date_time", "Session Id": "$session_id",
                "VMN": "$longcode", "Call Type": "$call_direction",
                "Campaign Name": "$campaign_name", "Campaign Type": "$campaign_type",
                "Queue Name": "$queue_name", "Call Flow": "$call_flow_name",
                "Call Status": "$final_status",
                "Queue Wait Time(Sec)": "$queue_wait_duration",
                "Customer Number": "$customer_number",
                "Customer Name": "$address_book.customer_name",
                "Agent Number": "$agent_number", "Agent Name": "$agent_name",
                "Voice Mail Duration": "$voicemail_duration",
                "Voicemail Recording": "$voicemail_recording_path",
                "Agent Hangup Cause": "$agent_hangup_cause",
                "Customer Hangup Cause": "$customer_hangup_cause",
                "Customer Ringing Duration": "$customer_ringing_duration",
                "Remark": "$remarks"
            }
        }
    ]

    results = list(collection.aggregate(pipeline))
    for row in results:
        if "Date & Time" in row:
            row["Date & Time"] = convert_mongo_date(row["Date & Time"])

    return dict_to_csv(results)


def get_missed_calls_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate Missed Calls report from MongoDB."""
    collection = get_mongo_collection("calling_cdr")

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    match_conditions = {
        "call_direction": "INCOMING",
        "final_status": "abandoned",
        "abandoned_reason": {
            "$in": [
                "abandoned_in_queue", "abandoned_in_ivr",
                "abandoned_in_agent", "abandoned_non_working_hour",
                "abandoned_non_working_day"
            ]
        },
        "start_date_time": {"$gte": start_dt, "$lte": end_dt}
    }

    if sme_id and sme_id.strip():
        try:
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            match_conditions["sme_id"] = sme_id

    pipeline = [
        {"$match": match_conditions},
        {
            "$project": {
                "start_date_time": 1, "session_id": 1, "longcode": 1,
                "campaign_name": 1, "campaign_type": 1, "queue_name": 1,
                "call_flow_name": 1, "queue_wait_duration": 1, "customer_number": 1,
                "agent_number": 1, "agent_name": 1, "voicemail_duration": 1,
                "voicemail_recording_path": 1, "agent_hangup_cause": 1,
                "customer_hangup_cause": 1
            }
        },
        {"$sort": {"start_date_time": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "address_book",
                "localField": "customer_number",
                "foreignField": "customer_number_primary",
                "as": "address_book"
            }
        },
        {
            "$unwind": {
                "path": "$address_book",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "Date & Time": "$start_date_time", "Session Id": "$session_id",
                "VMN": "$longcode", "Campaign Name": "$campaign_name",
                "Campaign Type": "$campaign_type", "Queue Name": "$queue_name",
                "Call Flow": "$call_flow_name",
                "Queue Wait Duration (Sec)": "$queue_wait_duration",
                "Customer Number": "$customer_number",
                "Customer Name": "$address_book.customer_name",
                "Agent Number": "$agent_number", "Agent Name": "$agent_name",
                "Voice Mail Duration": "$voicemail_duration",
                "Voicemail Recording": "$voicemail_recording_path",
                "Agent Hangup Cause": "$agent_hangup_cause",
                "Customer Hangup Cause": "$customer_hangup_cause"
            }
        }
    ]

    results = list(collection.aggregate(pipeline))
    for row in results:
        if "Date & Time" in row:
            row["Date & Time"] = convert_mongo_date(row["Date & Time"])

    return dict_to_csv(results)


def get_first_call_resolution_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate First Call Resolution report from MongoDB."""
    collection = get_mongo_collection("calling_cdr")

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    match_conditions = {
        "final_status": "patched",
        "start_date_time": {"$gte": start_dt, "$lte": end_dt}
    }

    if sme_id and sme_id.strip():
        try:
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            match_conditions["sme_id"] = sme_id

    pipeline = [
        {"$match": match_conditions},
        {
            "$project": {
                "start_date_time": 1, "session_id": 1, "longcode": 1,
                "campaign_name": 1, "campaign_type": 1, "queue_name": 1,
                "call_flow_name": 1, "call_direction": 1, "customer_number": 1,
                "agent_number": 1, "agent_name": 1, "agent_ringing_duration": 1,
                "customer_ringing_duration": 1, "on_call_hold_time": 1, "duration": 1,
                "recording_path": 1, "disposition_form_name": 1,
                "disconnected_by": 1, "customer_feedback": 1, "remarks": 1
            }
        },
        {
            "$group": {
                "_id": {
                    "day": {"$dayOfYear": "$start_date_time"},
                    "year": {"$year": "$start_date_time"},
                    "customer_number": "$customer_number"
                },
                "count": {"$sum": 1},
                "doc": {"$first": "$$ROOT"}
            }
        },
        {"$match": {"count": 1}},
        {"$replaceRoot": {"newRoot": "$doc"}},
        {"$sort": {"start_date_time": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "address_book",
                "localField": "customer_number",
                "foreignField": "customer_number_primary",
                "as": "address_book"
            }
        },
        {
            "$unwind": {
                "path": "$address_book",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "Date & Time": "$start_date_time", "Session Id": "$session_id",
                "VMN": "$longcode", "Campaign Name": "$campaign_name",
                "Campaign Type": "$campaign_type", "Queue Name": "$queue_name",
                "Call Flow": "$call_flow_name", "Call Type": "$call_direction",
                "Customer Number": "$customer_number",
                "Customer Name": "$address_book.customer_name",
                "Agent Number": "$agent_number", "Agent Name": "$agent_name",
                "Agent Ring Time": "$agent_ringing_duration",
                "Customer Ringing Time": "$customer_ringing_duration",
                "Total Hold Time": "$on_call_hold_time",
                "Call Duration": "$duration", "Recording": "$recording_path",
                "Disposition": "$disposition_form_name",
                "Disconnected By": "$disconnected_by",
                "Customer Feedback": "$customer_feedback", "Remark": "$remarks"
            }
        }
    ]

    results = list(collection.aggregate(pipeline))
    for row in results:
        if "Date & Time" in row:
            row["Date & Time"] = convert_mongo_date(row["Date & Time"])

    return dict_to_csv(results)


def get_auto_call_distribution_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate Auto Call Distribution report from MongoDB."""
    collection = get_mongo_collection("calling_cdr")

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    match_conditions = {
        "campaign_type": {
            "$in": ["power_dialer", "progressive_dialer", "predictive_dialer", "preview_auto"]
        },
        "final_status": {"$nin": ["na"]},
        "start_date_time": {"$gte": start_dt, "$lte": end_dt}
    }

    if sme_id and sme_id.strip():
        try:
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            match_conditions["sme_id"] = sme_id

    pipeline = [
        {"$match": match_conditions},
        {
            "$project": {
                "start_date_time": 1, "session_id": 1, "longcode": 1,
                "campaign_name": 1, "campaign_type": 1, "queue_name": 1,
                "call_flow_name": 1, "queue_wait_duration": 1, "final_status": 1,
                "customer_number": 1, "agent_number": 1, "agent_name": 1,
                "duration": 1, "recording_path": 1, "disposition_form_name": 1,
                "disconnected_by": 1, "transferStatus": 1, "conferenceStatus": 1,
                "on_call_hold_time": 1, "mute_duration": 1, "remarks": 1
            }
        },
        {"$sort": {"start_date_time": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "address_book",
                "localField": "customer_number",
                "foreignField": "customer_number_primary",
                "as": "address_book"
            }
        },
        {
            "$unwind": {
                "path": "$address_book",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "Date & Time": "$start_date_time", "Session Id": "$session_id",
                "VMN": "$longcode", "Campaign Name": "$campaign_name",
                "Campaign Type": "$campaign_type", "Queue Name": "$queue_name",
                "Call Flow": "$call_flow_name",
                "Queue Wait Time(Sec)": "$queue_wait_duration",
                "Call Status": "$final_status", "Customer Number": "$customer_number",
                "Customer Name": "$address_book.customer_name",
                "Agent Number": "$agent_number", "Agent Name": "$agent_name",
                "Call Duration": "$duration", "Recording": "$recording_path",
                "Disposition": "$disposition_form_name",
                "Disconnected By": "$disconnected_by",
                "Transfer Status": "$transferStatus",
                "Conference Status": "$conferenceStatus",
                "Hold Time": "$on_call_hold_time",
                "Mute Time": "$mute_duration", "Remark": "$remarks"
            }
        }
    ]

    results = list(collection.aggregate(pipeline))
    for row in results:
        if "Date & Time" in row:
            row["Date & Time"] = convert_mongo_date(row["Date & Time"])

    return dict_to_csv(results)


def get_transfer_conference_calls_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate Transfer & Conference Calls report from MongoDB."""
    collection = get_mongo_collection("calling_cdr")

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    match_conditions = {
        "final_status": {"$nin": ["na"]},
        "start_date_time": {"$gte": start_dt, "$lte": end_dt},
        "$or": [
            {"transferStatus": "1"},
            {"conferenceStatus": "1"}
        ]
    }

    if sme_id and sme_id.strip():
        try:
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            match_conditions["sme_id"] = sme_id

    pipeline = [
        {"$match": match_conditions},
        {
            "$project": {
                "start_date_time": 1, "session_id": 1, "longcode": 1,
                "campaign_name": 1, "campaign_type": 1, "queue_name": 1,
                "call_flow_name": 1, "call_direction": 1, "final_status": 1,
                "transferStatus": 1, "conferenceStatus": 1,
                "queue_wait_duration": 1, "customer_number": 1, "agent_number": 1,
                "agent_name": 1, "duration": 1, "mute_duration": 1,
                "on_call_hold_time": 1, "remarks": 1
            }
        },
        {"$sort": {"start_date_time": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "address_book",
                "localField": "customer_number",
                "foreignField": "customer_number_primary",
                "as": "address_book"
            }
        },
        {
            "$unwind": {
                "path": "$address_book",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "Date & Time": "$start_date_time", "Session Id": "$session_id",
                "VMN": "$longcode", "Campaign Name": "$campaign_name",
                "Campaign Type": "$campaign_type", "Queue Name": "$queue_name",
                "Call Flow": "$call_flow_name", "Call Type": "$call_direction",
                "Call Status": "$final_status",
                "Category": {
                    "$cond": {
                        "if": {"$eq": ["$transferStatus", "1"]},
                        "then": "Transferred",
                        "else": {
                            "$cond": {
                                "if": {"$eq": ["$conferenceStatus", "1"]},
                                "then": "Conference",
                                "else": ""
                            }
                        }
                    }
                },
                "Queue Wait Time(Sec)": "$queue_wait_duration",
                "Customer Number": "$customer_number",
                "Customer Name": "$address_book.customer_name",
                "Agent Number": "$agent_number", "Agent Name": "$agent_name",
                "Total call duration": "$duration",
                "Mute Time": "$mute_duration", "Hold Time": "$on_call_hold_time",
                "Remark": "$remarks"
            }
        }
    ]

    results = list(collection.aggregate(pipeline))
    for row in results:
        if "Date & Time" in row:
            row["Date & Time"] = convert_mongo_date(row["Date & Time"])

    return dict_to_csv(results)


def get_callback_followup_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate Callback & Follow-up report from MongoDB."""
    from db_connections import get_mongo_db

    db = get_mongo_db()
    collection = db["customer_followup"]

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    match_conditions = {
        "reminder_date_time": {"$gte": start_dt, "$lt": end_dt}
    }

    if sme_id and sme_id.strip():
        try:
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            match_conditions["sme_id"] = sme_id

    pipeline = [
        {"$match": match_conditions},
        {
            "$project": {
                "session_id": 1, "sme_id": 1, "customer_number": 1,
                "customer_name": 1, "agent_name": 1, "agent_number": 1,
                "insert_date_time": 1, "reminder_date_time": 1
            }
        },
        {"$sort": {"reminder_date_time": 1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "calling_cdr",
                "let": {"cc_session_id": "$session_id", "smeId": "$sme_id"},
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$and": [
                                    {"$eq": ["$session_id", "$$cc_session_id"]},
                                    {"$eq": ["$sme_id", "$$smeId"]}
                                ]
                            }
                        }
                    },
                    {
                        "$project": {
                            "campaign_name": 1, "campaign_type": 1,
                            "queue_name": 1, "call_flow_name": 1,
                            "start_date_time": 1, "end_date_time": 1,
                            "final_status": 1, "disposition_form_name": 1,
                            "disconnected_by": 1, "agent_hangup_cause": 1, "remarks": 1
                        }
                    }
                ],
                "as": "calling_cdr"
            }
        },
        {
            "$unwind": {
                "path": "$calling_cdr",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "Date & Time": "$calling_cdr.start_date_time",
                "Session Id": "$session_id",
                "Campaign Name": "$calling_cdr.campaign_name",
                "Queue Name": "$calling_cdr.queue_name",
                "Campaign Type": "$calling_cdr.campaign_type",
                "Call Flow": "$calling_cdr.call_flow_name",
                "Customer Number": "$customer_number",
                "Customer Name": "$customer_name",
                "Agent Number": "$agent_number", "Agent Name": "$agent_name",
                "Call Back Set Time": "$insert_date_time",
                "Scheduled Call Back Time": "$reminder_date_time",
                "Status": "$calling_cdr.final_status",
                "Call Start Time": "$calling_cdr.start_date_time",
                "Call End Time": "$calling_cdr.end_date_time",
                "Disposition": "$calling_cdr.disposition_form_name",
                "Disconnected By": "$calling_cdr.disconnected_by",
                "Hang up Cause": "$calling_cdr.agent_hangup_cause",
                "Remark": "$calling_cdr.remarks"
            }
        }
    ]

    results = list(collection.aggregate(pipeline))
    for row in results:
        for field in ["Date & Time", "Call Back Set Time", "Scheduled Call Back Time", "Call Start Time", "Call End Time"]:
            if field in row:
                row[field] = convert_mongo_date(row[field])

    return dict_to_csv(results)


def get_list_wise_dialing_status_report(
    sme_id: str,
    start_date: str,
    end_date: str,
    limit: int = 10000
) -> str:
    """Generate List Wise Dialing Status report from MongoDB."""
    from db_connections import get_mongo_db

    db = get_mongo_db()
    collection = db["calling_cdr"]

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    match_conditions = {
        "start_date_time": {"$gte": start_dt, "$lt": end_dt}
    }

    if sme_id and sme_id.strip():
        try:
            match_conditions["sme_id"] = int(sme_id)
        except ValueError:
            match_conditions["sme_id"] = sme_id

    pipeline = [
        {"$match": match_conditions},
        {
            "$project": {
                "file_id": 1,
                "file_name": 1,
                "campaign_name": 1,
                "campaign_id": 1,
                "final_status": 1,
                "retry_count": 1
            }
        },
        {
            "$group": {
                "_id": {
                    "file_id": "$file_id",
                    "final_status": {"$ifNull": ["$final_status", "Unknown"]}
                },
                "count": {"$sum": 1},
                "file_name": {"$first": "$file_name"},
                "campaign_name": {"$first": "$campaign_name"},
                "campaign_id": {"$first": "$campaign_id"},
                "retry_count": {"$sum": "$retry_count"}
            }
        },
        {
            "$group": {
                "_id": "$_id.file_id",
                "file_name": {"$first": "$file_name"},
                "campaign_name": {"$first": "$campaign_name"},
                "campaign_id": {"$first": "$campaign_id"},
                "statuses": {
                    "$push": {"k": "$_id.final_status", "v": "$count"}
                },
                "total_count": {"$sum": "$count"},
                "total_retry_count": {"$sum": "$retry_count"}
            }
        },
        {
            "$addFields": {
                "statuses": {"$arrayToObject": "$statuses"},
                "dialable_count": 0
            }
        },
        {
            "$lookup": {
                "from": "tbl_dialer_profile_files",
                "localField": "_id",
                "foreignField": "_id",
                "pipeline": [
                    {
                        "$project": {
                            "status": 1,
                            "insert_date_time": 1,
                            "total_count": 1,
                            "invalid_count": 1,
                            "duplicate_count": 1,
                            "dnc_count": 1,
                            "dnd_count": 1,
                            "valid_count": 1,
                            "executed": 1,
                            "pending_count": 1
                        }
                    }
                ],
                "as": "profile_file"
            }
        },
        {
            "$unwind": {
                "path": "$profile_file",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$project": {
                "File ID": "$_id",
                "File Name": "$file_name",
                "Campaign Name": "$campaign_name",
                "Campaign ID": "$campaign_id",
                "Total Calls": "$total_count",
                "Total Retry Count": "$total_retry_count",
                "Profile File Status": "$profile_file.status",
                "Insert Date Time": "$profile_file.insert_date_time",
                "Total Count": "$profile_file.total_count",
                "Invalid Count": "$profile_file.invalid_count",
                "Duplicate Count": "$profile_file.duplicate_count",
                "DNC Count": "$profile_file.dnc_count",
                "DND Count": "$profile_file.dnd_count",
                "Valid Count": "$profile_file.valid_count",
                "Executed": "$profile_file.executed",
                "Pending Count": "$profile_file.pending_count",
                "statuses": 1
            }
        },
        {"$limit": limit}
    ]

    results = list(collection.aggregate(pipeline))

    # Flatten status dictionaries into separate columns
    for row in results:
        if "statuses" in row and row["statuses"]:
            for status_key, status_value in row["statuses"].items():
                safe_key = f"Status: {status_key}"
                row[safe_key] = status_value
            del row["statuses"]
        if "Insert Date Time" in row:
            row["Insert Date Time"] = convert_mongo_date(row["Insert Date Time"])

    return dict_to_csv(results)


# ---------------------------------------------------------------------------
# Additional MariaDB Report Functions
# ---------------------------------------------------------------------------

def get_agent_status_report(
    sme_id: int,
    start_date: str,
    end_date: str
) -> str:
    """Generate Agent Status Report from MariaDB."""
    queries = load_mariadb_queries()
    query_template = queries.get("agent_status_report", {}).get("query", "")

    if not query_template:
        return "Error: Agent status report query not found"

    query = query_template.replace("{{start_date}}", start_date)
    query = query.replace("{{end_date}}", end_date)
    query = query.replace("{{sme_id}}", str(sme_id))

    with mysql_cursor() as cursor:
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()

    data = [dict(zip(columns, row)) for row in results]
    return dict_to_csv(data)


def get_agent_call_duration_summary_report(
    sme_id: int,
    start_date: str,
    end_date: str
) -> str:
    """Generate Agent Call Duration Summary from MariaDB."""
    queries = load_mariadb_queries()
    query_template = queries.get("agent_call_duration_summary", {}).get("query", "")

    if not query_template:
        return "Error: Agent call duration summary query not found"

    query = query_template.replace("{{start_date}}", start_date)
    query = query.replace("{{end_date}}", end_date)
    query = query.replace("{{sme_id}}", str(sme_id))
    query = query.replace("{{sort_order}}", "DESC")

    with mysql_cursor() as cursor:
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()

    data = [dict(zip(columns, row)) for row in results]
    return dict_to_csv(data)


def get_sms_report(
    sme_id: int,
    start_date: str,
    end_date: str
) -> str:
    """Generate SMS Report from MariaDB."""
    import logging
    logger = logging.getLogger(__name__)

    # First, check what tables exist
    try:
        with mysql_cursor() as cursor:
            cursor.execute("SHOW TABLES LIKE '%Report%'")
            tables = cursor.fetchall()
            logger.error(f"Tables with 'Report': {tables}")
    except Exception as e:
        logger.error(f"Error checking tables: {e}")

    queries = load_mariadb_queries()
    query_template = queries.get("sms_report", {}).get("query", "")

    if not query_template:
        return "Error: SMS report query not found"

    query = query_template.replace("{{start_date}}", start_date)
    query = query_template.replace("{{end_date}}", end_date)
    query = query.replace("{{sme_id}}", str(sme_id))

    # Debug: Print the full SQL query with replaced SME ID
    print(f"=== MARIADB QUERY ===")
    print(f"Report: sms_report")
    print(f"SME ID: {sme_id}")
    print(f"Query: {query}")
    print(f"=====================")

    try:
        with mysql_cursor() as cursor:
            cursor.execute(query)
            columns = [desc[0] for desc in cursor.description]
            results = cursor.fetchall()

        logger.error(f"SMS Report results count: {len(results)}")
        data = [dict(zip(columns, row)) for row in results]
        return dict_to_csv(data)
    except Exception as e:
        logger.error(f"SMS Report error: {e}")
        return f"Error: {str(e)}"


def get_whatsapp_report(
    sme_id: int,
    start_date: str,
    end_date: str
) -> str:
    """Generate WhatsApp Report from MariaDB."""
    queries = load_mariadb_queries()
    query_template = queries.get("whatsapp_report", {}).get("query", "")

    if not query_template:
        return "Error: WhatsApp report query not found"

    query = query_template.replace("{{start_date}}", start_date)
    query = query.replace("{{end_date}}", end_date)

    with mysql_cursor() as cursor:
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        results = cursor.fetchall()

    data = [dict(zip(columns, row)) for row in results]
    return dict_to_csv(data)


# Main report dispatcher
def generate_report(
    report_id: str,
    sme_id: str,
    date_preset: str,
    custom_start_date: Optional[str] = None,
    custom_end_date: Optional[str] = None
) -> tuple[str, str]:
    """Generate a report based on report ID.

    Args:
        report_id: The report identifier (e.g., 'calling_cdr_incoming')
        sme_id: SME ID to filter by
        date_preset: Date preset ('today', 'last7days', 'last30days', 'custom')
        custom_start_date: Start date for custom range
        custom_end_date: End date for custom range

    Returns:
        Tuple of (csv_content, filename)
    """
    # Debug: Log the incoming parameters
    print(f"=== REPORT QUERY DEBUG ===")
    print(f"Report ID: {report_id}")
    print(f"SME ID: {sme_id}")
    print(f"Date Preset: {date_preset}")
    if custom_start_date and custom_end_date:
        print(f"Custom Date Range: {custom_start_date} to {custom_end_date}")
    print(f"==========================")

    # Parse date range
    if date_preset == "custom" and custom_start_date and custom_end_date:
        start_date = custom_start_date
        end_date = custom_end_date
    else:
        start_date, end_date = parse_date_range(date_preset)

    # Determine if we should apply SME filter
    # Empty string = admin (no filter), otherwise use the SME ID
    apply_sme_filter = bool(sme_id and sme_id.strip())

    # Convert SME ID to int for MariaDB reports
    try:
        sme_id_int = int(sme_id) if apply_sme_filter else 0
    except ValueError:
        sme_id_int = 0

    # Dispatch to appropriate report generator
    # MongoDB Reports
    if report_id == "calling_cdr_incoming":
        csv_content = get_incoming_calls_report(sme_id, start_date, end_date)
        filename = f"incoming_calls_{start_date}_to_{end_date}.csv"
    elif report_id == "calling_cdr_outgoing":
        csv_content = get_outgoing_calls_report(sme_id, start_date, end_date)
        filename = f"outgoing_calls_{start_date}_to_{end_date}.csv"
    elif report_id == "manual_outbound_calls":
        csv_content = get_manual_outbound_calls_report(sme_id, start_date, end_date)
        filename = f"manual_outbound_calls_{start_date}_to_{end_date}.csv"
    elif report_id == "failed_calls":
        csv_content = get_failed_calls_report(sme_id, start_date, end_date)
        filename = f"failed_calls_{start_date}_to_{end_date}.csv"
    elif report_id == "abandoned_calls":
        csv_content = get_abandoned_calls_report(sme_id, start_date, end_date)
        filename = f"abandoned_calls_{start_date}_to_{end_date}.csv"
    elif report_id == "missed_calls":
        csv_content = get_missed_calls_report(sme_id, start_date, end_date)
        filename = f"missed_calls_{start_date}_to_{end_date}.csv"
    elif report_id == "first_call_resolution":
        csv_content = get_first_call_resolution_report(sme_id, start_date, end_date)
        filename = f"first_call_resolution_{start_date}_to_{end_date}.csv"
    elif report_id == "auto_call_distribution":
        csv_content = get_auto_call_distribution_report(sme_id, start_date, end_date)
        filename = f"auto_call_distribution_{start_date}_to_{end_date}.csv"
    elif report_id == "transfer_conference_calls":
        csv_content = get_transfer_conference_calls_report(sme_id, start_date, end_date)
        filename = f"transfer_conference_calls_{start_date}_to_{end_date}.csv"
    elif report_id == "callback_followup":
        csv_content = get_callback_followup_report(sme_id, start_date, end_date)
        filename = f"callback_followup_{start_date}_to_{end_date}.csv"
    elif report_id == "list_wise_dialing_status":
        csv_content = get_list_wise_dialing_status_report(sme_id, start_date, end_date)
        filename = f"list_wise_dialing_status_{start_date}_to_{end_date}.csv"
    # MariaDB Reports
    elif report_id == "agent_activity":
        csv_content = get_agent_activity_report(sme_id_int, start_date, end_date)
        filename = f"agent_activity_{start_date}_to_{end_date}.csv"
    elif report_id == "agent_status_report":
        csv_content = get_agent_status_report(sme_id_int, start_date, end_date)
        filename = f"agent_status_{start_date}_to_{end_date}.csv"
    elif report_id == "agent_call_duration_summary":
        csv_content = get_agent_call_duration_summary_report(sme_id_int, start_date, end_date)
        filename = f"agent_call_duration_summary_{start_date}_to_{end_date}.csv"
    elif report_id == "sms_report":
        csv_content = get_sms_report(sme_id_int, start_date, end_date)
        filename = f"sms_report_{start_date}_to_{end_date}.csv"
    elif report_id == "whatsapp_report":
        csv_content = get_whatsapp_report(sme_id_int, start_date, end_date)
        filename = f"whatsapp_report_{start_date}_to_{end_date}.csv"
    else:
        csv_content = f"Error: Report '{report_id}' not implemented yet"
        filename = "error.csv"

    return csv_content, filename
