"""Database connections for report downloads.

This module provides direct connections to MongoDB and MariaDB databases
for fetching report data. Uses pymongo for MongoDB and mysql-connector-python
for MariaDB.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Generator, Optional

from dotenv import load_dotenv
from mysql.connector import MySQLConnection
from mysql.connector.connection import MySQLConnection as MySQLConnectionType
from pymongo import MongoClient
from pymongo.client_session import ClientSession as MongoSession
from pymongo.database import Database as MongoDatabase

# Load environment variables
load_dotenv()

# MongoDB Configuration
MDB_CONNECTION_STRING = os.getenv("MDB_CONNECTION_STRING")

# MariaDB/MySQL Configuration
MYSQL_HOST = os.getenv("MYSQL_HOST")
MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASS = os.getenv("MYSQL_PASS")
MYSQL_DB_NAME = os.getenv("MYSQL_DB_NAME")


# ---------------------------------------------------------------------------
# MongoDB Connection
# ---------------------------------------------------------------------------

_mongo_client: Optional[MongoClient] = None


def get_mongo_client() -> MongoClient:
    """Get or create a MongoDB client connection."""
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(MDB_CONNECTION_STRING)
    return _mongo_client


def get_mongo_db(database_name: str = "ccs_prod") -> MongoDatabase:
    """Get the MongoDB database instance."""
    client = get_mongo_client()
    return client[database_name]


@contextmanager
def mongo_session(database_name: str = "ccs_prod") -> Generator[MongoSession, None, None]:
    """Context manager for MongoDB sessions."""
    client = get_mongo_client()
    with client.start_session() as session:
        yield session


def get_mongo_collection(collection_name: str, database_name: str = "ccs_prod"):
    """Get a MongoDB collection."""
    db = get_mongo_db(database_name)
    return db[collection_name]


# ---------------------------------------------------------------------------
# MariaDB/MySQL Connection
# ---------------------------------------------------------------------------

def get_mysql_connection() -> MySQLConnectionType:
    """Create a new MySQL/MariaDB connection."""
    return MySQLConnection(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASS,
        database=MYSQL_DB_NAME
    )


@contextmanager
def mysql_connection() -> Generator[MySQLConnection, None, None]:
    """Context manager for MySQL/MariaDB connections."""
    conn = get_mysql_connection()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def mysql_cursor(dictionary: bool = False) -> Generator[Any, None, None]:
    """Context manager for MySQL cursor."""
    with mysql_connection() as conn:
        cursor = conn.cursor(dictionary=dictionary)
        try:
            yield cursor
        finally:
            cursor.close()


# ---------------------------------------------------------------------------
# Connection Health Checks
# ---------------------------------------------------------------------------

def check_mongo_connection() -> bool:
    """Check if MongoDB connection is alive."""
    try:
        client = get_mongo_client()
        client.admin.command("ping")
        return True
    except Exception:
        return False


def check_mysql_connection() -> bool:
    """Check if MySQL connection is alive."""
    try:
        with mysql_connection() as conn:
            return conn.is_connected()
    except Exception:
        return False
