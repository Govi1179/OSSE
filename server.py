test
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import sys
import csv
import io
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "data" / "tracking.db"
BACKUP_DIR = BASE_DIR / "data" / "backups"

HOST = "127.0.0.1"
PORT = 8080
SESSION_DAYS = 7
SESSION_INACTIVITY_HOURS = 2
CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
FORGOT_PASSWORD_MAX_ATTEMPTS = int(os.getenv("FORGOT_PASSWORD_MAX_ATTEMPTS", "5"))
FORGOT_PASSWORD_LOCK_MINUTES = int(os.getenv("FORGOT_PASSWORD_LOCK_MINUTES", "15"))
SECURE_COOKIES_ENABLED = os.getenv("SECURE_COOKIES", "").strip().lower() in {"1", "true", "yes", "on"}
MAX_REQUEST_BODY_BYTES = 512 * 1024  # 512 KB hard cap
BACKUP_IMPORT_MAX_BYTES = 20 * 1024 * 1024  # 20 MB for uploaded backup imports
DELIVERY_SEQUENCE_MAX = int(os.getenv("DELIVERY_SEQUENCE_MAX", "1000"))
ITEM_WARNING_MAX_CYCLES = int(os.getenv("ITEM_WARNING_MAX_CYCLES", "100"))
ITEM_WARNING_MAX_YEARS = float(os.getenv("ITEM_WARNING_MAX_YEARS", "5"))
SUPER_ADMIN_USER_CODE = "0001"
ALLOWED_ROLES = {"SUPER_ADMIN", "ADMIN", "DELIVERY_PARTNER", "EXTERNAL_PARTNER", "FILLER", "CUSTOMER"}
ALLOWED_ITEM_STATUS = {"WITH_ME", "WITH_CLIENT", "IN_SHOP", "IN_FACTORY", "IN_TRANSIT", "LOST", "DAMAGED", "ARCHIVED"}
ITEM_STATUS_SEQUENCE = ["WITH_ME", "WITH_CLIENT", "IN_SHOP", "IN_FACTORY", "IN_TRANSIT", "LOST", "DAMAGED", "ARCHIVED"]
ITEM_STATUS_TRANSITIONS = {
    "WITH_ME": {"WITH_CLIENT", "IN_SHOP", "IN_FACTORY", "IN_TRANSIT", "LOST", "DAMAGED", "ARCHIVED"},
    "WITH_CLIENT": {"WITH_ME", "IN_TRANSIT", "IN_SHOP", "IN_FACTORY", "LOST", "DAMAGED", "ARCHIVED"},
    "IN_SHOP": {"WITH_ME", "IN_FACTORY", "IN_TRANSIT", "LOST", "DAMAGED", "ARCHIVED"},
    "IN_FACTORY": {"IN_SHOP", "WITH_ME", "IN_TRANSIT", "LOST", "DAMAGED", "ARCHIVED"},
    "IN_TRANSIT": {"WITH_ME", "WITH_CLIENT", "IN_SHOP", "IN_FACTORY", "LOST", "DAMAGED", "ARCHIVED"},
    "LOST": {"WITH_ME", "ARCHIVED"},
    "DAMAGED": {"IN_SHOP", "IN_FACTORY", "ARCHIVED"},
    "ARCHIVED": set(),
}
ALLOWED_FILL_STATE = {"FULL", "EMPTY"}
ALLOWED_ITEM_TYPES = {"CONTAINER", "CYLINDER", "OTHER"}
ALLOWED_CYLINDER_VOLUME_UNITS = {"LITERS", "CUBIC_METERS", "MILLILITERS"}
ALLOWED_ITEM_OWNERSHIP = {"OURS", "EXTERNAL"}
ALLOWED_TRANSITION_SOURCE = {"SELF", "EMPLOYEE", "FILLER", "CUSTOMER", "TRANSIT"}
ALLOWED_TRANSITION_ACTION = {"TAKING", "GIVING"}
CAPACITY_DECIMAL_STEP = Decimal("0.01")
CAPACITY_SCALE = 100
BACKUP_FORMAT = "tracking-system-backup"
BACKUP_VERSION = 1
BACKUP_TABLES = [
    "users",
    "companies",
    "company_locations",
    "items",
    "custom_item_ids",
    "item_categories",
    "volume_units",
    "item_category_sequences",
    "dc_books",
    "transition_processes",
    "transition_target_policies",
    "item_transfers",
    "customer_orders",
    "notifications",
    "user_sessions",
    "navigation_events",
    "login_system_controls",
    "activity_logs",
    "audit_logs",
    "item_code_sequence",
    "user_code_sequence",
    "delivery_no_sequence",
]
BACKUP_DELETE_ORDER = [
    "item_transfers",
    "custom_item_ids",
    "transition_target_policies",
    "transition_processes",
    "customer_orders",
    "notifications",
    "dc_books",
    "company_locations",
    "companies",
    "navigation_events",
    "login_system_controls",
    "user_sessions",
    "activity_logs",
    "audit_logs",
    "volume_units",
    "item_category_sequences",
    "item_categories",
    "items",
    "users",
    "item_code_sequence",
    "user_code_sequence",
    "delivery_no_sequence",
]

TRANSITION_ROLE_SOURCE_RULES = {
    "SUPER_ADMIN": {"TAKING": {"SELF", "EMPLOYEE", "FILLER", "CUSTOMER", "TRANSIT"}, "GIVING": {"SELF", "TRANSIT"}},
    "ADMIN": {"TAKING": {"SELF", "EMPLOYEE", "FILLER", "CUSTOMER", "TRANSIT"}, "GIVING": {"SELF", "TRANSIT"}},
    "DELIVERY_PARTNER": {"TAKING": {"SELF", "EMPLOYEE", "TRANSIT"}, "GIVING": {"SELF", "TRANSIT"}},
    "EXTERNAL_PARTNER": {"TAKING": {"SELF", "EMPLOYEE", "TRANSIT"}, "GIVING": {"SELF", "TRANSIT"}},
    "FILLER": {"TAKING": {"SELF", "FILLER", "TRANSIT"}, "GIVING": {"SELF", "TRANSIT"}},
    "CUSTOMER": {"TAKING": {"SELF", "CUSTOMER", "TRANSIT"}, "GIVING": {"SELF", "TRANSIT"}},
}

TRANSITION_ROLE_OWN_SOURCE = {
    "DELIVERY_PARTNER": "EMPLOYEE",
    "EXTERNAL_PARTNER": "EMPLOYEE",
    "FILLER": "FILLER",
    "CUSTOMER": "CUSTOMER",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def parse_iso_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value)


def hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def is_valid_email(email: str) -> bool:
    if len(email) < 5 or len(email) > 254:
        return False
    if "@" not in email or email.count("@") != 1:
        return False
    local, domain = email.split("@", 1)
    if not local or not domain or "." not in domain:
        return False
    return True


def normalize_role_value(value: Any) -> str:
    normalized = re.sub(r"[\s-]+", "_", str(value or "").strip().upper())
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    if normalized == "EXTERNALPARTNER":
        return "EXTERNAL_PARTNER"
    if normalized == "DELIVERYPARTNER":
        return "DELIVERY_PARTNER"
    if normalized in {"USER", "CUSTOMER"}:
        return "CUSTOMER"
    if normalized in {"MANAGER", "AUDITOR"}:
        return "ADMIN"
    return normalized


def get_transition_allowed_sources(session_role: str, action: str) -> set[str]:
    normalized_role = normalize_role_value(session_role)
    normalized_action = str(action or "").strip().upper()
    role_rules = TRANSITION_ROLE_SOURCE_RULES.get(normalized_role)
    if role_rules is None:
        return set()
    return set(role_rules.get(normalized_action, set()))


def is_transition_source_allowed_for_user(session_user: dict[str, Any], action: str, source_type: str, source_user_id: str = "") -> bool:
    normalized_role = normalize_role_value(session_user.get("role"))
    normalized_action = str(action or "").strip().upper()
    normalized_source = str(source_type or "").strip().upper()
    allowed_sources = get_transition_allowed_sources(normalized_role, normalized_action)
    if normalized_source not in allowed_sources:
        return False
    own_source = TRANSITION_ROLE_OWN_SOURCE.get(normalized_role)
    if own_source and normalized_source == own_source:
        return str(source_user_id or "").strip() == str(session_user.get("id") or "").strip()
    return True


def validate_password(password: str) -> str | None:
    if len(password) < 8 or len(password) > 128:
        return "Password must be between 8 and 128 characters"
    has_upper = any(char.isupper() for char in password)
    has_lower = any(char.islower() for char in password)
    has_digit = any(char.isdigit() for char in password)
    has_symbol = any(not char.isalnum() for char in password)
    if not (has_upper and has_lower and has_digit and has_symbol):
        return "Password must include upper, lower, number and symbol"
    return None


def normalize_mac_address(value: str) -> str:
    cleaned = re.sub(r"[^0-9A-Fa-f]", "", value or "")
    if len(cleaned) != 12:
        return ""
    chunks = [cleaned[index : index + 2].upper() for index in range(0, 12, 2)]
    return ":".join(chunks)


def is_valid_mac_address(value: str) -> bool:
    return bool(re.fullmatch(r"[0-9A-F]{2}(?::[0-9A-F]{2}){5}", value))


def normalize_dc_book_id(value: Any) -> str:
    raw = str(value or "").strip().upper()
    if not raw:
        return ""
    normalized = re.sub(r"\s+", "-", raw)
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9._-]{0,59}", normalized):
        return ""
    return normalized


def evaluate_item_warning(cycle_count: int, created_at_iso: str) -> tuple[bool, str, float]:
    created_at = parse_iso_datetime(created_at_iso)
    age_years = max(0.0, (utc_now() - created_at).total_seconds() / (365.25 * 24 * 60 * 60))
    cycle_reached = cycle_count >= ITEM_WARNING_MAX_CYCLES
    years_reached = age_years >= ITEM_WARNING_MAX_YEARS
    if cycle_reached and years_reached:
        return True, "CYCLE_LIMIT,YEAR_LIMIT", age_years
    if cycle_reached:
        return True, "CYCLE_LIMIT", age_years
    if years_reached:
        return True, "YEAR_LIMIT", age_years
    return False, "", age_years


def compute_next_cycle_count(previous_fill_state: str, new_fill_state: str, current_cycle_count: int) -> int:
    if previous_fill_state == "FULL" and new_fill_state == "EMPTY":
        return current_cycle_count + 1
    return current_cycle_count


def is_valid_status_transition(from_status: str, to_status: str) -> bool:
    if from_status == to_status:
        return True
    allowed_next = ITEM_STATUS_TRANSITIONS.get(from_status)
    if allowed_next is None:
        return False
    return to_status in allowed_next


def is_valid_item_code(item_code: str) -> bool:
    if len(item_code) < 3 or len(item_code) > 30:
        return False
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-")
    return all(char in allowed for char in item_code)


def parse_capacity_units(value: Any) -> int:
    raw_value = str(value).strip()
    if not raw_value:
        raise ValueError("Capacity must be a valid number")
    try:
        decimal_value = Decimal(raw_value)
    except InvalidOperation as exc:
        raise ValueError("Capacity must be a valid number") from exc
    if not decimal_value.is_finite():
        raise ValueError("Capacity must be a valid number")
    quantized_value = decimal_value.quantize(CAPACITY_DECIMAL_STEP, rounding=ROUND_HALF_UP)
    if quantized_value != decimal_value:
        raise ValueError("Capacity can have at most 2 decimal places")
    scaled_value = int(quantized_value * CAPACITY_SCALE)
    if scaled_value <= 0:
        raise ValueError("Capacity must be greater than 0")
    return scaled_value


def normalize_item_type(value: Any) -> str:
    raw = str(value or "CONTAINER").strip().upper()
    if raw == "CYLENDER":
        return "CYLINDER"
    return raw


def get_allowed_cylinder_volume_units(conn: sqlite3.Connection) -> set[str]:
    cur = conn.cursor()
    cur.execute("SELECT unit_name FROM volume_units WHERE is_active = 1 ORDER BY unit_name ASC")
    rows = cur.fetchall()
    units = {str(row["unit_name"] or "").strip().upper() for row in rows}
    units = {value for value in units if value}
    return units or set(ALLOWED_CYLINDER_VOLUME_UNITS)


def validate_item_type_capacity(*, item_type: str, volume_unit: str | None, allowed_volume_units: set[str] | None = None) -> tuple[str, str | None]:
    normalized_type = normalize_item_type(item_type)
    if normalized_type not in ALLOWED_ITEM_TYPES:
        raise ValueError("Item type must be CONTAINER, CYLINDER, or OTHER")
    normalized_unit = str(volume_unit or "").strip().upper() or None

    if normalized_type == "CYLINDER":
        allowed_units = set(allowed_volume_units or ALLOWED_CYLINDER_VOLUME_UNITS)
        if normalized_unit not in allowed_units:
            raise ValueError("Cylinder volume unit is invalid")
    else:
        normalized_unit = None

    return normalized_type, normalized_unit


def format_capacity_units(value: int | None) -> str | None:
    if value is None:
        return None
    absolute_value = abs(int(value))
    whole = absolute_value // CAPACITY_SCALE
    fraction = absolute_value % CAPACITY_SCALE
    prefix = "-" if int(value) < 0 else ""
    return f"{prefix}{whole}.{fraction:02d}"


def get_row_capacity_units(row: sqlite3.Row) -> int | None:
    raw_units = row["capacity_units"] if "capacity_units" in row.keys() else None
    if raw_units is not None:
        return int(raw_units)
    legacy_capacity = row["capacity"] if "capacity" in row.keys() else None
    if legacy_capacity is None:
        return None
    try:
        return int(Decimal(str(legacy_capacity)).quantize(CAPACITY_DECIMAL_STEP, rounding=ROUND_HALF_UP) * CAPACITY_SCALE)
    except (InvalidOperation, ValueError):
        return None


def extract_numeric_suffix(value: str) -> int | None:
    match = re.search(r"(\d+)$", value)
    if not match:
        return None
    return int(match.group(1))


def normalize_category_name(value: Any) -> str:
    normalized = re.sub(r"\s+", " ", str(value or "").strip())
    return normalized or "General"


def normalize_category_type(value: Any) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    normalized = normalize_item_type(raw)
    if normalized not in ALLOWED_ITEM_TYPES:
        raise ValueError("Category type must be CONTAINER, CYLINDER, or OTHER")
    return normalized


def category_key_from_name(name: str) -> str:
    key = re.sub(r"[^A-Z0-9]+", "_", normalize_category_name(name).upper()).strip("_")
    return key[:60] if key else "GENERAL"


def category_prefix_from_name(name: str) -> str:
    prefix = re.sub(r"[^A-Z0-9]+", "", normalize_category_name(name).upper())
    if not prefix:
        return "GEN"
    return prefix[:10]


def normalize_code_prefix(value: Any) -> str:
    prefix = re.sub(r"[^A-Z0-9]+", "", str(value or "").strip().upper())
    if not prefix:
        raise ValueError("Code prefix must contain at least one letter or number")
    if len(prefix) > 10:
        raise ValueError("Code prefix must be at most 10 characters")
    return prefix


def normalize_custom_id(value: Any) -> str:
    custom_id = str(value or "").strip().upper()
    if len(custom_id) < 2 or len(custom_id) > 50:
        raise ValueError("custom_id must be between 2 and 50 characters")
    if not re.fullmatch(r"[A-Z0-9_-]+", custom_id):
        raise ValueError("custom_id can contain only A-Z, 0-9, dash, and underscore")
    return custom_id


def normalize_prefix_list(prefixes: Any, fallback_prefix: str) -> list[str]:
    if not isinstance(prefixes, list):
        return [fallback_prefix]
    normalized: list[str] = []
    for raw in prefixes:
        try:
            prefix = normalize_code_prefix(raw)
        except ValueError:
            continue
        if prefix not in normalized:
            normalized.append(prefix)
    return normalized or [fallback_prefix]


def parse_positive_int_or_none(value: Any, field_name: str) -> int | None:
    if value in {None, ""}:
        return None
    try:
        parsed = int(str(value).strip())
    except ValueError as exc:
        raise ValueError(f"{field_name} must be a positive integer") from exc
    if parsed <= 0:
        raise ValueError(f"{field_name} must be a positive integer")
    return parsed


def normalize_item_category_prefix_rows(cur: sqlite3.Cursor, *, now_iso: str | None = None) -> None:
    timestamp = now_iso or utc_now_iso()
    cur.execute("SELECT category_key, code_prefix, code_prefixes_json FROM item_categories")
    rows = cur.fetchall()
    for row in rows:
        fallback_prefix = str(row["code_prefix"] or "").strip().upper()
        if not fallback_prefix:
            fallback_prefix = "GEN"
        try:
            raw_prefixes = json.loads(str(row["code_prefixes_json"] or "[]"))
        except Exception:
            raw_prefixes = []
        prefix_list = normalize_prefix_list(raw_prefixes, fallback_prefix)
        active_prefix = fallback_prefix if fallback_prefix in prefix_list else prefix_list[0]
        if active_prefix != str(row["code_prefix"] or "") or prefix_list != raw_prefixes:
            cur.execute(
                "UPDATE item_categories SET code_prefix = ?, code_prefixes_json = ?, updated_at = ? WHERE category_key = ?",
                (active_prefix, json.dumps(prefix_list, separators=(",", ":"), sort_keys=False), timestamp, row["category_key"]),
            )


def ensure_item_category(
    conn: sqlite3.Connection,
    category_name: str,
    *,
    category_type: str | None = None,
    enforce_existing_type: bool = True,
    now_iso: str | None = None,
) -> tuple[str, str, str, list[str], int | None, int | None]:
    cur = conn.cursor()
    normalized_name = normalize_category_name(category_name)
    normalized_type = normalize_category_type(category_type)
    category_key = category_key_from_name(normalized_name)
    fallback_prefix = category_prefix_from_name(normalized_name)
    timestamp = now_iso or utc_now_iso()
    cur.execute(
        "SELECT category_key, category_name, item_type, code_prefix, code_prefixes_json, range_start, range_end FROM item_categories WHERE category_key = ?",
        (category_key,),
    )
    row = cur.fetchone()
    if row is None:
        prefixes_json = json.dumps([fallback_prefix], separators=(",", ":"), sort_keys=False)
        cur.execute(
            """
            INSERT INTO item_categories (category_key, category_name, item_type, code_prefix, code_prefixes_json, range_start, range_end, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NULL, NULL, 1, ?, ?)
            """,
            (category_key, normalized_name, normalized_type, fallback_prefix, prefixes_json, timestamp, timestamp),
        )
        return category_key, fallback_prefix, normalized_name, [fallback_prefix], None, None

    existing_name = str(row["category_name"] or "").strip() or normalized_name
    existing_type = normalize_category_type(row["item_type"]) if row["item_type"] is not None else None
    if enforce_existing_type and normalized_type and existing_type and normalized_type != existing_type:
        raise ValueError(f"Category '{normalized_name}' is configured for {existing_type}, not {normalized_type}")
    resolved_type = normalized_type or existing_type
    existing_prefix = str(row["code_prefix"] or "").strip().upper() or fallback_prefix
    try:
        raw_prefixes = json.loads(str(row["code_prefixes_json"] or "[]"))
    except Exception:
        raw_prefixes = []
    prefix_list = normalize_prefix_list(raw_prefixes, existing_prefix)
    if existing_prefix not in prefix_list:
        prefix_list.insert(0, existing_prefix)

    needs_update = (
        existing_name != normalized_name
        or existing_type != resolved_type
        or existing_prefix != str(row["code_prefix"] or "")
        or prefix_list != normalize_prefix_list(raw_prefixes, existing_prefix)
    )
    if needs_update:
        cur.execute(
            "UPDATE item_categories SET category_name = ?, item_type = ?, code_prefix = ?, code_prefixes_json = ?, updated_at = ? WHERE category_key = ?",
            (normalized_name, resolved_type, existing_prefix, json.dumps(prefix_list, separators=(",", ":"), sort_keys=False), timestamp, category_key),
        )
    range_start = int(row["range_start"]) if row["range_start"] is not None else None
    range_end = int(row["range_end"]) if row["range_end"] is not None else None
    return category_key, existing_prefix, normalized_name, prefix_list, range_start, range_end


def generate_next_item_code_for_category(
    conn: sqlite3.Connection,
    category_name: str,
    override_prefix: str | None = None,
    category_type: str | None = None,
) -> tuple[str, str, str, str]:
    now = utc_now_iso()
    category_key, code_prefix, normalized_name, prefix_list, range_start, range_end = ensure_item_category(
        conn,
        category_name,
        category_type=category_type,
        now_iso=now,
    )
    if override_prefix:
        try:
            candidate_prefix = normalize_code_prefix(override_prefix)
            allowed_upper = [str(p or "").strip().upper() for p in prefix_list]
            if candidate_prefix in allowed_upper or not allowed_upper:
                code_prefix = candidate_prefix
        except ValueError:
            pass  # fall back to category prefix
    cur = conn.cursor()
    cur.execute("SELECT next_value FROM item_category_sequences WHERE category_key = ?", (category_key,))
    row = cur.fetchone()
    if row is None:
        next_value = range_start if range_start is not None else 1
        cur.execute(
            "INSERT INTO item_category_sequences (category_key, next_value, updated_at) VALUES (?, ?, ?)",
            (category_key, next_value, now),
        )
    else:
        next_value = int(row["next_value"])
        if range_start is not None and next_value < range_start:
            next_value = range_start

    if range_end is not None and next_value > range_end:
        raise ValueError(f"Category code range exhausted for {normalized_name}")

    while True:
        if range_end is not None and next_value > range_end:
            raise ValueError(f"Category code range exhausted for {normalized_name}")
        candidate = f"{code_prefix}-{next_value:05d}"
        cur.execute("SELECT id FROM items WHERE item_code = ?", (candidate,))
        exists = cur.fetchone() is not None
        if not exists:
            cur.execute(
                "UPDATE item_category_sequences SET next_value = ?, updated_at = ? WHERE category_key = ?",
                (next_value + 1, now, category_key),
            )
            return candidate, category_key, code_prefix, normalized_name
        next_value += 1


def preview_next_item_code_for_category(
    conn: sqlite3.Connection,
    category_name: str,
    override_prefix: str | None = None,
    category_type: str | None = None,
) -> str:
    normalized_name = normalize_category_name(category_name)
    normalized_type = normalize_category_type(category_type)
    category_key = category_key_from_name(normalized_name)
    fallback_prefix = category_prefix_from_name(normalized_name)
    cur = conn.cursor()
    cur.execute("SELECT item_type, code_prefix, code_prefixes_json, range_start, range_end FROM item_categories WHERE category_key = ?", (category_key,))
    row = cur.fetchone()
    existing_type = normalize_category_type(row["item_type"]) if row is not None and row["item_type"] is not None else None
    if normalized_type and existing_type and normalized_type != existing_type:
        raise ValueError(f"Category '{normalized_name}' is configured for {existing_type}, not {normalized_type}")
    code_prefix = str(row["code_prefix"] or "").strip().upper() if row is not None else fallback_prefix
    range_start = int(row["range_start"]) if row is not None and row["range_start"] is not None else None
    range_end = int(row["range_end"]) if row is not None and row["range_end"] is not None else None
    if not code_prefix:
        code_prefix = fallback_prefix
    if override_prefix:
        try:
            candidate_prefix = normalize_code_prefix(override_prefix)
            # Validate the override is in the category's allowed prefix list
            if row is not None:
                try:
                    allowed = json.loads(str(row["code_prefixes_json"] or "[]"))
                except Exception:
                    allowed = [code_prefix]
                if not isinstance(allowed, list):
                    allowed = [code_prefix]
                allowed_upper = [str(p or "").strip().upper() for p in allowed]
                if candidate_prefix in allowed_upper or not allowed_upper:
                    code_prefix = candidate_prefix
            else:
                code_prefix = candidate_prefix
        except ValueError:
            pass  # fall back to category prefix
    cur.execute("SELECT next_value FROM item_category_sequences WHERE category_key = ?", (category_key,))
    sequence_row = cur.fetchone()
    next_value = int(sequence_row["next_value"]) if sequence_row is not None else (range_start if range_start is not None else 1)
    if range_start is not None and next_value < range_start:
        next_value = range_start
    while True:
        if range_end is not None and next_value > range_end:
            raise ValueError(f"Category code range exhausted for {normalized_name}")
        candidate = f"{code_prefix}-{next_value:05d}"
        cur.execute("SELECT id FROM items WHERE item_code = ?", (candidate,))
        if cur.fetchone() is None:
            return candidate
        next_value += 1


def sync_item_category_state(conn: sqlite3.Connection, *, now_iso: str | None = None) -> None:
    cur = conn.cursor()
    timestamp = now_iso or utc_now_iso()
    cur.execute("SELECT DISTINCT category, item_type FROM items")
    category_rows = cur.fetchall()
    for category_row in category_rows:
        category_value = category_row["category"] if isinstance(category_row, sqlite3.Row) else category_row[0]
        category_type_raw = category_row["item_type"] if isinstance(category_row, sqlite3.Row) else category_row[1]
        category_type_normalized = normalize_item_type(category_type_raw)
        category_type = category_type_normalized if category_type_normalized in ALLOWED_ITEM_TYPES else None
        if str(category_value or "").strip():
            ensure_item_category(conn, str(category_value), category_type=category_type, enforce_existing_type=False, now_iso=timestamp)

    cur.execute("SELECT category_key, code_prefix, range_start, range_end FROM item_categories")
    category_rules = {
        str(row["category_key"]): {
            "prefix": str(row["code_prefix"] or "").strip().upper(),
            "range_start": int(row["range_start"]) if row["range_start"] is not None else None,
            "range_end": int(row["range_end"]) if row["range_end"] is not None else None,
        }
        for row in cur.fetchall()
    }
    prefix_by_key = {key: rule["prefix"] for key, rule in category_rules.items()}
    max_suffix_by_key: dict[str, int] = {key: 0 for key in prefix_by_key.keys()}
    cur.execute("SELECT category, item_code FROM items")
    for row in cur.fetchall():
        category_name = normalize_category_name(row["category"] if isinstance(row, sqlite3.Row) else row[0])
        item_code = str((row["item_code"] if isinstance(row, sqlite3.Row) else row[1]) or "").strip().upper()
        category_key = category_key_from_name(category_name)
        prefix = prefix_by_key.get(category_key) or category_prefix_from_name(category_name)
        match = re.fullmatch(rf"{re.escape(prefix)}-(\d+)", item_code)
        if not match:
            continue
        suffix = int(match.group(1))
        previous_max = max_suffix_by_key.get(category_key, 0)
        if suffix > previous_max:
            max_suffix_by_key[category_key] = suffix

    for category_key, max_suffix in max_suffix_by_key.items():
        range_start = category_rules.get(category_key, {}).get("range_start")
        range_end = category_rules.get(category_key, {}).get("range_end")
        next_value = max_suffix + 1 if max_suffix > 0 else (range_start if range_start is not None else 1)
        if range_start is not None and next_value < range_start:
            next_value = range_start
        if range_end is not None and next_value > range_end + 1:
            next_value = range_end + 1
        cur.execute("SELECT next_value FROM item_category_sequences WHERE category_key = ?", (category_key,))
        row = cur.fetchone()
        if row is None:
            cur.execute(
                "INSERT INTO item_category_sequences (category_key, next_value, updated_at) VALUES (?, ?, ?)",
                (category_key, next_value, timestamp),
            )
        elif int(row["next_value"]) <= max_suffix:
            cur.execute(
                "UPDATE item_category_sequences SET next_value = ?, updated_at = ? WHERE category_key = ?",
                (next_value, timestamp, category_key),
            )


def generate_next_item_code(conn: sqlite3.Connection) -> str:
    item_code, _, _, _ = generate_next_item_code_for_category(conn, "General")
    return item_code


def preview_next_item_code(conn: sqlite3.Connection) -> str:
    return preview_next_item_code_for_category(conn, "General")


def generate_next_user_code(conn: sqlite3.Connection) -> str:
    cur = conn.cursor()
    cur.execute("SELECT next_value FROM user_code_sequence WHERE id = 1")
    row = cur.fetchone()
    if row is None:
        next_value = 1
        cur.execute("INSERT INTO user_code_sequence (id, next_value) VALUES (1, ?)", (next_value,))
    else:
        next_value = int(row["next_value"])

    while True:
        candidate = f"{next_value:04d}"
        cur.execute("SELECT id FROM users WHERE user_code = ?", (candidate,))
        exists = cur.fetchone() is not None
        if not exists:
            cur.execute("UPDATE user_code_sequence SET next_value = ? WHERE id = 1", (next_value + 1,))
            return candidate
        next_value += 1


def enforce_system_super_admin_user_code(conn: sqlite3.Connection, *, super_admin_email: str, now_iso: str) -> None:
    cur = conn.cursor()
    cur.execute("SELECT id, user_code FROM users WHERE email = ?", (super_admin_email,))
    super_admin_row = cur.fetchone()
    if super_admin_row is None:
        return

    cur.execute(
        "SELECT id FROM users WHERE user_code = ? AND id != ?",
        (SUPER_ADMIN_USER_CODE, super_admin_row["id"]),
    )
    conflicting_row = cur.fetchone()
    if conflicting_row is not None:
        reassigned_code = generate_next_user_code(conn)
        cur.execute(
            "UPDATE users SET user_code = ?, updated_at = ? WHERE id = ?",
            (reassigned_code, now_iso, conflicting_row["id"]),
        )

    if super_admin_row["user_code"] != SUPER_ADMIN_USER_CODE:
        cur.execute(
            "UPDATE users SET user_code = ?, updated_at = ? WHERE id = ?",
            (SUPER_ADMIN_USER_CODE, now_iso, super_admin_row["id"]),
        )


def enforce_single_super_admin_role(conn: sqlite3.Connection, *, super_admin_email: str, now_iso: str) -> None:
    cur = conn.cursor()

    # Keep configured super admin account fixed to SUPER_ADMIN.
    cur.execute(
        "UPDATE users SET role = 'SUPER_ADMIN', is_active = 1, updated_at = ? WHERE email = ?",
        (now_iso, super_admin_email),
    )

    # Any additional SUPER_ADMIN users are downgraded to ADMIN.
    cur.execute(
        """
        UPDATE users
        SET role = 'ADMIN', updated_at = ?
        WHERE role = 'SUPER_ADMIN' AND email != ?
        """,
        (now_iso, super_admin_email),
    )


def get_delivery_sequence_max() -> int:
    return DELIVERY_SEQUENCE_MAX if DELIVERY_SEQUENCE_MAX > 0 else 1000


def generate_next_delivery_no(conn: sqlite3.Connection) -> int:
    cur = conn.cursor()
    max_value = get_delivery_sequence_max()
    cur.execute("SELECT next_value FROM delivery_no_sequence WHERE id = 1")
    row = cur.fetchone()
    if row is None:
        next_value = 1
        cur.execute("INSERT INTO delivery_no_sequence (id, next_value) VALUES (1, ?)", (2 if max_value > 1 else 1,))
        return next_value

    next_value = int(row["next_value"])
    if next_value < 1 or next_value > max_value:
        next_value = 1

    following = next_value + 1
    if following > max_value:
        following = 1

    cur.execute("UPDATE delivery_no_sequence SET next_value = ? WHERE id = 1", (following,))
    return next_value


def ensure_column_exists(cur: sqlite3.Cursor, table_name: str, column_name: str, column_definition: str) -> None:
    cur.execute(f"PRAGMA table_info({table_name})")
    columns = {row[1] for row in cur.fetchall()}
    if column_name not in columns:
        cur.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_definition}")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        # Current format: "<salt>$<pbkdf2_hex>"
        if "$" in password_hash:
            salt, expected = password_hash.split("$", 1)
            digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000)
            return hmac.compare_digest(expected, digest.hex())

        # Legacy compatibility: unsalted SHA-256 hex
        if re.fullmatch(r"[a-fA-F0-9]{64}", password_hash or ""):
            legacy_digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
            return hmac.compare_digest(password_hash.lower(), legacy_digest)

        # Unknown/invalid stored format
        return False
    except Exception:
        return False


def hash_security_key(value: str) -> str:
    return hash_password(value.strip())


def verify_security_key(value: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    return verify_password(value.strip(), stored_hash)


def parse_security_keys(payload: dict[str, Any]) -> tuple[str, str, str]:
    key_1 = str(payload.get("security_key_1", "")).strip()
    key_2 = str(payload.get("security_key_2", "")).strip()
    key_3 = str(payload.get("security_key_3", "")).strip()
    return key_1, key_2, key_3


def parse_boolean_field(payload: dict[str, Any], field_name: str, *, default: bool = False) -> bool:
    value = payload.get(field_name, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if int(value) in {0, 1}:
            return int(value) == 1
        raise ValueError(f"{field_name} must be true or false")
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off", ""}:
            return False
        raise ValueError(f"{field_name} must be true or false")
    raise ValueError(f"{field_name} must be true or false")


def validate_security_keys(keys: tuple[str, str, str], required: bool) -> str | None:
    provided = [key for key in keys if key]
    if required and len(provided) != 3:
        return "All 3 security keys are required"
    if not required and len(provided) not in {0, 3}:
        return "Provide all 3 security keys or leave all empty"
    if len(provided) == 3:
        for key in provided:
            if len(key) < 3 or len(key) > 120:
                return "Each security key must be between 3 and 120 characters"
    return None


def canonical_json(data: Any) -> str:
    return json.dumps(data, separators=(",", ":"), sort_keys=True)


def log_checksum(previous_checksum: str, action: str, entity_type: str, entity_id: str, payload_json: str) -> str:
    source = f"{previous_checksum}|{action}|{entity_type}|{entity_id}|{payload_json}"
    return hash_text(source)


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript(
        """
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            user_code TEXT UNIQUE,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_by_user_id TEXT,
            created_by_mode TEXT NOT NULL DEFAULT 'SYSTEM',
            is_active INTEGER NOT NULL DEFAULT 1,
            reject_empty_items INTEGER NOT NULL DEFAULT 0,
            reject_full_items INTEGER NOT NULL DEFAULT 0,
            failed_login_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until TEXT,
            last_login_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            company_name TEXT NOT NULL,
            contact_info TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by_user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS company_locations (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            location_name TEXT NOT NULL,
            address_line TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by_user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(company_id, location_name)
        );

        CREATE TABLE IF NOT EXISTS customer_locations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            location_name TEXT NOT NULL,
            address_line TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by_user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, location_name)
        );

        CREATE TABLE IF NOT EXISTS filler_locations (
            id TEXT PRIMARY KEY,
            filler_user_id TEXT NOT NULL,
            location_name TEXT NOT NULL,
            address_line TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by_user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(filler_user_id, location_name)
        );

        CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            item_code TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            category TEXT,
            ownership_type TEXT NOT NULL DEFAULT 'OURS',
            owner_name TEXT,
            company_location_id TEXT,
            item_type TEXT NOT NULL DEFAULT 'CONTAINER',
            volume_unit TEXT,
            capacity REAL,
            capacity_units INTEGER,
            fill_state TEXT NOT NULL DEFAULT 'EMPTY',
            cycle_count INTEGER NOT NULL DEFAULT 0,
            warning_active INTEGER NOT NULL DEFAULT 0,
            warning_reason TEXT,
            status TEXT NOT NULL,
            current_holder_user_id TEXT,
            current_location TEXT,
            created_by_user_id TEXT,
            created_by_mode TEXT NOT NULL DEFAULT 'SYSTEM',
            updated_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS custom_item_ids (
            item_id TEXT PRIMARY KEY,
            custom_id TEXT UNIQUE NOT NULL,
            created_by_user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS item_transfers (
            id TEXT PRIMARY KEY,
            transition_process_id TEXT,
            delivery_no INTEGER,
            item_id TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            from_location TEXT,
            to_location TEXT,
            dc_book_id TEXT,
            dc_number INTEGER,
            linked_taking_at TEXT,
            linked_taking_by TEXT,
            linked_taking_process_id TEXT,
            linked_taking_delivery_no INTEGER,
            linked_taking_source_type TEXT,
            linked_taking_source_user_id TEXT,
            linked_taking_to_status TEXT,
            linked_taking_to_location TEXT,
            linked_taking_fill_state TEXT,
            reason TEXT,
            transferred_by TEXT,
            transferred_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transition_processes (
            id TEXT PRIMARY KEY,
            created_by_user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transition_target_policies (
            target_type TEXT NOT NULL,
            target_key TEXT NOT NULL,
            reject_empty_items INTEGER NOT NULL DEFAULT 0,
            created_by_user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (target_type, target_key)
        );

        CREATE TABLE IF NOT EXISTS dc_books (
            book_id TEXT PRIMARY KEY,
            range_start INTEGER NOT NULL DEFAULT 0,
            range_end INTEGER NOT NULL DEFAULT 100,
            next_dc_number INTEGER NOT NULL DEFAULT 1,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by_user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_fingerprint TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS navigation_events (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            path TEXT NOT NULL,
            title TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS login_system_controls (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            system_name TEXT,
            mac_address TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by_user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, mac_address)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            actor_user_id TEXT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            payload_json TEXT NOT NULL,
            previous_checksum TEXT NOT NULL,
            checksum TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            delivery_no INTEGER,
            from_user_id TEXT,
            from_user_name TEXT,
            to_user_id TEXT,
            to_user_name TEXT,
            to_role TEXT,
            item_id TEXT,
            item_code TEXT,
            item_title TEXT,
            is_read INTEGER NOT NULL DEFAULT 0,
            meta_json TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS customer_orders (
            id TEXT PRIMARY KEY,
            delivery_no INTEGER,
            item_id TEXT,
            item_code TEXT,
            item_title TEXT,
            customer_name TEXT NOT NULL,
            customer_contact TEXT,
            quantity INTEGER NOT NULL DEFAULT 1,
            notes TEXT,
            status TEXT NOT NULL,
            created_by_user_id TEXT NOT NULL,
            created_by_user_name TEXT,
            approved_by_user_id TEXT,
            approved_by_user_name TEXT,
            delivery_user_id TEXT,
            delivery_user_name TEXT,
            delivered_by_user_id TEXT,
            delivered_by_user_name TEXT,
            delivered_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS item_categories (
            category_key TEXT PRIMARY KEY,
            category_name TEXT NOT NULL,
            item_type TEXT,
            code_prefix TEXT NOT NULL,
            code_prefixes_json TEXT NOT NULL DEFAULT '[]',
            range_start INTEGER,
            range_end INTEGER,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS volume_units (
            unit_name TEXT PRIMARY KEY,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by_user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS item_category_sequences (
            category_key TEXT PRIMARY KEY,
            next_value INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS item_code_sequence (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            next_value INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_code_sequence (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            next_value INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS delivery_no_sequence (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            next_value INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON user_sessions(user_id, is_active, last_seen_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_active ON user_sessions(expires_at, is_active);
        CREATE INDEX IF NOT EXISTS idx_items_holder_status ON items(current_holder_user_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_items_status_updated ON items(status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_custom_item_ids_custom_id ON custom_item_ids(custom_id);
        CREATE INDEX IF NOT EXISTS idx_transfers_item_time ON item_transfers(item_id, transferred_at);
        CREATE INDEX IF NOT EXISTS idx_transition_processes_owner_updated ON transition_processes(created_by_user_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_transition_target_policy_type_key ON transition_target_policies(target_type, target_key);
        CREATE INDEX IF NOT EXISTS idx_orders_status_updated ON customer_orders(status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_notifications_read_time ON notifications(is_read, created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);

        CREATE TABLE IF NOT EXISTS activity_logs (
            id TEXT PRIMARY KEY,
            actor_user_id TEXT,
            actor_name TEXT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            entity_label TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_logs(created_at);
        """
    )

    ensure_column_exists(cur, "users", "created_by_user_id", "created_by_user_id TEXT")
    ensure_column_exists(cur, "users", "created_by_mode", "created_by_mode TEXT NOT NULL DEFAULT 'SYSTEM'")
    ensure_column_exists(cur, "users", "user_code", "user_code TEXT")
    ensure_column_exists(cur, "users", "security_key_1_hash", "security_key_1_hash TEXT")
    ensure_column_exists(cur, "users", "security_key_2_hash", "security_key_2_hash TEXT")
    ensure_column_exists(cur, "users", "security_key_3_hash", "security_key_3_hash TEXT")
    ensure_column_exists(cur, "users", "reject_empty_items", "reject_empty_items INTEGER NOT NULL DEFAULT 0")
    ensure_column_exists(cur, "users", "reject_full_items", "reject_full_items INTEGER NOT NULL DEFAULT 0")
    ensure_column_exists(cur, "items", "company_location_id", "company_location_id TEXT")
    ensure_column_exists(cur, "items", "created_by_user_id", "created_by_user_id TEXT")
    ensure_column_exists(cur, "items", "created_by_mode", "created_by_mode TEXT NOT NULL DEFAULT 'SYSTEM'")
    ensure_column_exists(cur, "items", "category", "category TEXT")
    ensure_column_exists(cur, "items", "ownership_type", "ownership_type TEXT NOT NULL DEFAULT 'OURS'")
    ensure_column_exists(cur, "items", "owner_name", "owner_name TEXT")
    ensure_column_exists(cur, "items", "item_type", "item_type TEXT NOT NULL DEFAULT 'CONTAINER'")
    ensure_column_exists(cur, "items", "volume_unit", "volume_unit TEXT")
    ensure_column_exists(cur, "items", "capacity", "capacity REAL")
    ensure_column_exists(cur, "items", "capacity_units", "capacity_units INTEGER")
    ensure_column_exists(cur, "items", "fill_state", "fill_state TEXT NOT NULL DEFAULT 'EMPTY'")
    ensure_column_exists(cur, "items", "cycle_count", "cycle_count INTEGER NOT NULL DEFAULT 0")
    ensure_column_exists(cur, "items", "warning_active", "warning_active INTEGER NOT NULL DEFAULT 0")
    ensure_column_exists(cur, "items", "warning_reason", "warning_reason TEXT")
    ensure_column_exists(cur, "item_categories", "code_prefixes_json", "code_prefixes_json TEXT NOT NULL DEFAULT '[]'")
    ensure_column_exists(cur, "item_categories", "item_type", "item_type TEXT")
    ensure_column_exists(cur, "item_categories", "range_start", "range_start INTEGER")
    ensure_column_exists(cur, "item_categories", "range_end", "range_end INTEGER")
    ensure_column_exists(cur, "item_transfers", "transition_process_id", "transition_process_id TEXT")
    ensure_column_exists(cur, "item_transfers", "delivery_no", "delivery_no INTEGER")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_transfers_process_time ON item_transfers(transition_process_id, transferred_at)")
    ensure_column_exists(cur, "item_transfers", "dc_book_id", "dc_book_id TEXT")
    ensure_column_exists(cur, "item_transfers", "dc_number", "dc_number INTEGER")
    ensure_column_exists(cur, "item_transfers", "linked_taking_at", "linked_taking_at TEXT")
    ensure_column_exists(cur, "item_transfers", "linked_taking_by", "linked_taking_by TEXT")
    ensure_column_exists(cur, "item_transfers", "linked_taking_process_id", "linked_taking_process_id TEXT")
    ensure_column_exists(cur, "item_transfers", "linked_taking_delivery_no", "linked_taking_delivery_no INTEGER")
    ensure_column_exists(cur, "item_transfers", "linked_taking_source_type", "linked_taking_source_type TEXT")
    ensure_column_exists(cur, "item_transfers", "linked_taking_source_user_id", "linked_taking_source_user_id TEXT")
    ensure_column_exists(cur, "item_transfers", "linked_taking_to_status", "linked_taking_to_status TEXT")
    ensure_column_exists(cur, "item_transfers", "linked_taking_to_location", "linked_taking_to_location TEXT")
    ensure_column_exists(cur, "item_transfers", "linked_taking_fill_state", "linked_taking_fill_state TEXT")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_transfers_dc_link_open ON item_transfers(dc_book_id, dc_number, linked_taking_at, transferred_at)")
    ensure_column_exists(cur, "dc_books", "is_active", "is_active INTEGER NOT NULL DEFAULT 1")
    ensure_column_exists(cur, "notifications", "type", "type TEXT NOT NULL DEFAULT 'INFO'")
    ensure_column_exists(cur, "notifications", "delivery_no", "delivery_no INTEGER")
    ensure_column_exists(cur, "notifications", "title", "title TEXT NOT NULL DEFAULT 'Notification'")
    ensure_column_exists(cur, "notifications", "message", "message TEXT NOT NULL DEFAULT ''")
    ensure_column_exists(cur, "notifications", "from_user_id", "from_user_id TEXT")
    ensure_column_exists(cur, "notifications", "from_user_name", "from_user_name TEXT")
    ensure_column_exists(cur, "notifications", "to_user_id", "to_user_id TEXT")
    ensure_column_exists(cur, "notifications", "to_user_name", "to_user_name TEXT")
    ensure_column_exists(cur, "notifications", "to_role", "to_role TEXT")
    ensure_column_exists(cur, "notifications", "item_id", "item_id TEXT")
    ensure_column_exists(cur, "notifications", "item_code", "item_code TEXT")
    ensure_column_exists(cur, "notifications", "item_title", "item_title TEXT")
    ensure_column_exists(cur, "notifications", "is_read", "is_read INTEGER NOT NULL DEFAULT 0")
    ensure_column_exists(cur, "notifications", "meta_json", "meta_json TEXT")
    ensure_column_exists(cur, "customer_orders", "status", "status TEXT NOT NULL DEFAULT 'PENDING_ADMIN'")
    ensure_column_exists(cur, "customer_orders", "delivery_no", "delivery_no INTEGER")
    ensure_column_exists(cur, "customer_orders", "updated_at", "updated_at TEXT NOT NULL DEFAULT ''")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_companies_name_active ON companies(company_name, is_active)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_company_locations_company_active ON company_locations(company_id, is_active)")
    cur.execute("UPDATE items SET fill_state = 'EMPTY' WHERE fill_state IS NULL OR TRIM(fill_state) = ''")
    cur.execute("UPDATE users SET reject_empty_items = 0 WHERE reject_empty_items IS NULL")
    # Migrate customer_locations: replace customer_name column with user_id if needed
    cur.execute("PRAGMA table_info(customer_locations)")
    cl_cols = {row[1] for row in cur.fetchall()}
    if "customer_name" in cl_cols:
        cur.execute("DROP TABLE IF EXISTS customer_locations")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS customer_locations (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                location_name TEXT NOT NULL,
                address_line TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_by_user_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(user_id, location_name)
            )
        """)
    cur.execute("UPDATE users SET reject_full_items = 0 WHERE reject_full_items IS NULL")
    cur.execute("UPDATE users SET role = 'CUSTOMER' WHERE role = 'USER'")
    cur.execute("UPDATE users SET role = 'ADMIN' WHERE role IN ('MANAGER', 'AUDITOR')")
    cur.execute("UPDATE items SET item_type = 'CONTAINER' WHERE item_type IS NULL OR TRIM(item_type) = ''")
    cur.execute("UPDATE items SET item_type = 'CYLINDER' WHERE UPPER(TRIM(item_type)) = 'CYLENDER'")
    cur.execute("UPDATE items SET volume_unit = UPPER(TRIM(volume_unit)) WHERE volume_unit IS NOT NULL")
    cur.execute("UPDATE items SET volume_unit = 'LITERS' WHERE item_type = 'CYLINDER' AND (volume_unit IS NULL OR TRIM(volume_unit) = '')")
    cur.execute("UPDATE items SET volume_unit = NULL WHERE item_type != 'CYLINDER'")
    cur.execute("UPDATE items SET cycle_count = 0 WHERE cycle_count IS NULL")
    cur.execute("UPDATE items SET warning_active = 0 WHERE warning_active IS NULL")
    cur.execute("UPDATE item_categories SET item_type = UPPER(TRIM(item_type)) WHERE item_type IS NOT NULL")
    cur.execute("UPDATE item_categories SET item_type = 'CYLINDER' WHERE item_type = 'CYLENDER'")
    cur.execute("UPDATE item_categories SET item_type = NULL WHERE item_type NOT IN ('CONTAINER', 'CYLINDER', 'OTHER')")
    normalize_item_category_prefix_rows(cur)
    seed_now = utc_now_iso()
    for default_unit in sorted(ALLOWED_CYLINDER_VOLUME_UNITS):
        cur.execute(
            """
            INSERT INTO volume_units (unit_name, is_active, created_by_user_id, created_at, updated_at)
            VALUES (?, 1, NULL, ?, ?)
            ON CONFLICT(unit_name) DO NOTHING
            """,
            (default_unit, seed_now, seed_now),
        )
    cur.execute(
        """
        UPDATE items
        SET capacity_units = CAST(ROUND(capacity * 100.0, 0) AS INTEGER)
        WHERE capacity_units IS NULL AND capacity IS NOT NULL
        """
    )
    cur.execute(
        """
        UPDATE items
        SET capacity = CAST(capacity_units AS REAL) / 100.0
        WHERE capacity_units IS NOT NULL
        """
    )

    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "superadmin@example.com").strip().lower()
    super_admin_password = os.getenv("SUPER_ADMIN_PASSWORD", "SuperAdmin@123").strip()
    cur.execute("SELECT id FROM users WHERE email = ?", (super_admin_email,))
    super_admin_row = cur.fetchone()
    now = utc_now_iso()
    if super_admin_row is None:
        super_admin_id = secrets.token_hex(16)
        cur.execute(
            """
            INSERT INTO users (id, user_code, email, full_name, role, password_hash, created_by_user_id, created_by_mode, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'SUPER_ADMIN', ?, NULL, 'SYSTEM', 1, ?, ?)
            """,
            (super_admin_id, SUPER_ADMIN_USER_CODE, super_admin_email, "System Super Admin", hash_password(super_admin_password), now, now),
        )

    enforce_system_super_admin_user_code(conn, super_admin_email=super_admin_email, now_iso=now)
    enforce_single_super_admin_role(conn, super_admin_email=super_admin_email, now_iso=now)

    admin_email = os.getenv("ADMIN_EMAIL", "admin@example.com").strip().lower()
    admin_password = os.getenv("ADMIN_PASSWORD", "ChangeThisNow!").strip()
    cur.execute("SELECT id FROM users WHERE email = ?", (admin_email,))
    row = cur.fetchone()
    if row is None:
        user_id = secrets.token_hex(16)
        user_code = generate_next_user_code(conn)
        cur.execute(
            """
            INSERT INTO users (id, user_code, email, full_name, role, password_hash, created_by_user_id, created_by_mode, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'ADMIN', ?, NULL, 'SYSTEM', 1, ?, ?)
            """,
            (user_id, user_code, admin_email, "System Admin", hash_password(admin_password), now, now),
        )

    cur.execute("SELECT user_code FROM users WHERE user_code IS NOT NULL AND TRIM(user_code) != ''")
    user_code_rows = cur.fetchall()
    max_user_code_number = 0
    for user_code_row in user_code_rows:
        numeric_value = extract_numeric_suffix(user_code_row["user_code"])
        if numeric_value is not None and numeric_value > max_user_code_number:
            max_user_code_number = numeric_value

    cur.execute("SELECT next_value FROM user_code_sequence WHERE id = 1")
    user_sequence_row = cur.fetchone()
    next_user_value = max_user_code_number + 1 if max_user_code_number > 0 else 1
    if user_sequence_row is None:
        cur.execute("INSERT INTO user_code_sequence (id, next_value) VALUES (1, ?)", (next_user_value,))
    elif int(user_sequence_row["next_value"]) <= max_user_code_number:
        cur.execute("UPDATE user_code_sequence SET next_value = ? WHERE id = 1", (next_user_value,))

    delivery_max_value = get_delivery_sequence_max()
    cur.execute("SELECT next_value FROM delivery_no_sequence WHERE id = 1")
    delivery_sequence_row = cur.fetchone()
    if delivery_sequence_row is None:
        cur.execute("INSERT INTO delivery_no_sequence (id, next_value) VALUES (1, 1)")
    else:
        current_delivery_next = int(delivery_sequence_row["next_value"])
        if current_delivery_next < 1 or current_delivery_next > delivery_max_value:
            cur.execute("UPDATE delivery_no_sequence SET next_value = 1 WHERE id = 1")

    cur.execute(
        """
        SELECT id FROM users
        WHERE user_code IS NULL OR TRIM(user_code) = ''
        ORDER BY created_at ASC
        """
    )
    users_missing_code = cur.fetchall()
    for user_row in users_missing_code:
        generated_user_code = generate_next_user_code(conn)
        cur.execute(
            "UPDATE users SET user_code = ?, updated_at = ? WHERE id = ?",
            (generated_user_code, now, user_row["id"]),
        )

    cur.execute("SELECT COUNT(1) AS count FROM items")
    item_count = int(cur.fetchone()["count"])
    if item_count == 0:
        sample_items = [
            (secrets.token_hex(16), "ITM-1001", "Router Device", "Network", 1.0, 100, "FULL", 0, 0, None, "WITH_ME", None, "Office A", None, "SYSTEM", now, now),
            (secrets.token_hex(16), "ITM-1002", "Tablet Unit", "Electronics", 1.0, 100, "EMPTY", 0, 0, None, "IN_SHOP", None, "Shop 1", None, "SYSTEM", now, now),
            (secrets.token_hex(16), "ITM-1003", "Sensor Pack", "IoT", 10.0, 1000, "FULL", 0, 0, None, "IN_TRANSIT", None, "On Route", None, "SYSTEM", now, now),
        ]
        cur.executemany(
            """
            INSERT INTO items (
                id, item_code, title, category, capacity, capacity_units, fill_state, cycle_count, warning_active, warning_reason, status, current_holder_user_id,
                current_location, created_by_user_id, created_by_mode, updated_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            sample_items,
        )

    cur.execute("SELECT item_code FROM items")
    item_rows = cur.fetchall()
    max_code_number = 0
    for item_row in item_rows:
        numeric_value = extract_numeric_suffix(item_row["item_code"])
        if numeric_value is not None and numeric_value > max_code_number:
            max_code_number = numeric_value

    cur.execute("SELECT next_value FROM item_code_sequence WHERE id = 1")
    sequence_row = cur.fetchone()
    next_value = max_code_number + 1 if max_code_number > 0 else 1
    if sequence_row is None:
        cur.execute("INSERT INTO item_code_sequence (id, next_value) VALUES (1, ?)", (next_value,))
    elif int(sequence_row["next_value"]) <= max_code_number:
        cur.execute("UPDATE item_code_sequence SET next_value = ? WHERE id = 1", (next_value,))

    sync_item_category_state(conn, now_iso=now)

    conn.commit()
    conn.close()


def parse_cookie(headers: Any) -> dict[str, str]:
    cookie_header = headers.get("Cookie")
    if not cookie_header:
        return {}
    cookie = SimpleCookie()
    cookie.load(cookie_header)
    return {k: v.value for k, v in cookie.items()}


def build_set_cookie_value(
    name: str,
    value: str,
    *,
    http_only: bool,
    max_age: int | None = None,
) -> str:
    parts = [f"{name}={value}", "SameSite=Lax", "Path=/"]
    if http_only:
        parts.append("HttpOnly")
    if max_age is not None:
        parts.append(f"Max-Age={int(max_age)}")
    if SECURE_COOKIES_ENABLED:
        parts.append("Secure")
    return "; ".join(parts)


def get_or_create_csrf_token(handler: BaseHTTPRequestHandler) -> tuple[str, bool]:
    cookies = parse_cookie(handler.headers)
    existing = str(cookies.get(CSRF_COOKIE_NAME, "")).strip()
    if re.fullmatch(r"[a-f0-9]{32,128}", existing):
        return existing, False
    return secrets.token_hex(24), True


def validate_csrf(handler: BaseHTTPRequestHandler) -> bool:
    cookies = parse_cookie(handler.headers)
    cookie_token = str(cookies.get(CSRF_COOKIE_NAME, "")).strip()
    header_token = str(handler.headers.get(CSRF_HEADER_NAME, "")).strip()
    if not cookie_token or not header_token:
        return False
    return hmac.compare_digest(cookie_token, header_token)


def parse_json_body_with_limit(handler: BaseHTTPRequestHandler, max_body_bytes: int) -> dict[str, Any]:
    content_length = int(handler.headers.get("Content-Length", "0"))
    if content_length <= 0:
        return {}
    if content_length > max_body_bytes:
        raise ValueError("Request body too large")
    raw = handler.rfile.read(content_length)
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise ValueError("Invalid JSON") from exc
    if not isinstance(payload, dict):
        raise ValueError("JSON body must be an object")
    return payload


CASE_PRESERVE_FIELD_TOKENS = {
    "email",
    "password",
    "secret",
    "security",
    "token",
    "csrf",
    "session",
    "cookie",
    "hash",
    "salt",
    "key",
    "otp",
    "id",
    "created_at",
    "updated_at",
    "last_seen_at",
    "locked_until",
    "expires_at",
    "expires_in",
    "issued_at",
}


def should_preserve_payload_string_case(field_path: tuple[str, ...]) -> bool:
    if not field_path:
        return False
    field_name = str(field_path[-1] or "").strip().lower()
    if not field_name:
        return False
    if field_name in CASE_PRESERVE_FIELD_TOKENS:
        return True
    if field_name.endswith("_id") or field_name.endswith("_ids"):
        return True
    for token in CASE_PRESERVE_FIELD_TOKENS:
        if token in field_name:
            return True
    return False


def normalize_payload_text_to_uppercase(value: Any, field_path: tuple[str, ...] = ()) -> Any:
    if isinstance(value, dict):
        return {key: normalize_payload_text_to_uppercase(inner, field_path + (str(key),)) for key, inner in value.items()}
    if isinstance(value, list):
        return [normalize_payload_text_to_uppercase(inner, field_path) for inner in value]
    if isinstance(value, str):
        if should_preserve_payload_string_case(field_path):
            return value
        return value.upper()
    return value


def parse_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    return parse_json_body_with_limit(handler, MAX_REQUEST_BODY_BYTES)


def validate_payload_fields(
    payload: dict[str, Any],
    *,
    allowed_fields: set[str],
    required_fields: set[str] | None = None,
) -> None:
    unknown_fields = set(payload.keys()) - allowed_fields
    if unknown_fields:
        raise ValueError(f"Unknown fields: {', '.join(sorted(unknown_fields))}")

    if required_fields:
        missing = [field_name for field_name in sorted(required_fields) if field_name not in payload]
        if missing:
            raise ValueError(f"Missing required fields: {', '.join(missing)}")


def send_json(handler: BaseHTTPRequestHandler, payload: dict[str, Any], status_code: int = 200) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("X-Frame-Options", "DENY")
    handler.send_header("Referrer-Policy", "same-origin")
    handler.send_header("Cross-Origin-Opener-Policy", "same-origin")
    handler.end_headers()
    handler.wfile.write(body)


def send_csv(handler: BaseHTTPRequestHandler, filename: str, rows: list[dict[str, Any]], status_code: int = 200) -> None:
    output = io.StringIO()
    fieldnames = list(rows[0].keys()) if rows else ["message"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    if rows:
        writer.writerows(rows)
    else:
        writer.writerow({"message": "No data"})

    body = output.getvalue().encode("utf-8-sig")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "text/csv; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Content-Disposition", f'attachment; filename="{filename}"')
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.end_headers()
    handler.wfile.write(body)


def send_download_bytes(
    handler: BaseHTTPRequestHandler,
    body: bytes,
    *,
    filename: str,
    content_type: str,
    status_code: int = 200,
) -> None:
    handler.send_response(status_code)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Content-Disposition", f'attachment; filename="{filename}"')
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.end_headers()
    handler.wfile.write(body)


def get_device_fingerprint(handler: BaseHTTPRequestHandler) -> str:
    ua = handler.headers.get("User-Agent", "")
    language = handler.headers.get("Accept-Language", "")
    return hash_text(f"{ua}|{language}")[:24]


def write_audit(conn: sqlite3.Connection, actor_user_id: str | None, action: str, entity_type: str, entity_id: str, payload: dict[str, Any], handler: BaseHTTPRequestHandler) -> None:
    payload_json = canonical_json(payload)
    cur = conn.cursor()
    cur.execute("SELECT checksum FROM audit_logs ORDER BY rowid DESC LIMIT 1")
    row = cur.fetchone()
    previous_checksum = row["checksum"] if row else "GENESIS"
    checksum = log_checksum(previous_checksum, action, entity_type, entity_id, payload_json)
    cur.execute(
        """
        INSERT INTO audit_logs (
            id, actor_user_id, action, entity_type, entity_id, payload_json,
            previous_checksum, checksum, ip_address, user_agent, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            secrets.token_hex(16),
            actor_user_id,
            action,
            entity_type,
            entity_id,
            payload_json,
            previous_checksum,
            checksum,
            handler.client_address[0] if handler.client_address else "0.0.0.0",
            handler.headers.get("User-Agent", ""),
            utc_now_iso(),
        ),
    )


def write_activity(
    conn: sqlite3.Connection,
    actor_user_id: str | None,
    actor_name: str,
    action: str,
    entity_type: str,
    entity_id: str = "",
    entity_label: str = "",
) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO activity_logs (id, actor_user_id, actor_name, action, entity_type, entity_id, entity_label, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            secrets.token_hex(16),
            actor_user_id,
            actor_name,
            action,
            entity_type,
            entity_id or "",
            entity_label or "",
            utc_now_iso(),
        ),
    )


def get_current_user(handler: BaseHTTPRequestHandler, conn: sqlite3.Connection) -> sqlite3.Row | None:
    cookies = parse_cookie(handler.headers)
    session_id = cookies.get("session_id")
    if not session_id:
        return None
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            s.id AS session_id,
            s.user_id,
            s.expires_at,
            s.last_seen_at,
            u.id,
            u.user_code,
            u.email,
            u.full_name,
            u.role,
            u.is_active,
            u.created_at,
            u.updated_at,
            u.last_login_at
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.is_active = 1
        """,
        (session_id,),
    )
    session = cur.fetchone()
    if session is None:
        return None
    expires_at = datetime.fromisoformat(session["expires_at"])
    now = utc_now()
    if expires_at <= now:
        cur.execute("UPDATE user_sessions SET is_active = 0 WHERE id = ?", (session_id,))
        conn.commit()
        return None

    last_seen_at = datetime.fromisoformat(session["last_seen_at"])
    if (now - last_seen_at) > timedelta(hours=SESSION_INACTIVITY_HOURS):
        cur.execute("UPDATE user_sessions SET is_active = 0 WHERE id = ?", (session_id,))
        conn.commit()
        return None

    cur.execute("UPDATE user_sessions SET last_seen_at = ? WHERE id = ?", (utc_now_iso(), session_id))
    conn.commit()
    return session


def role_allowed(user_role: str, allowed: set[str]) -> bool:
    return user_role in allowed


def ensure_backup_dir() -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def sanitize_backup_token(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "").strip())
    cleaned = cleaned.strip("-._")
    return cleaned or "backup"


def get_table_columns(conn: sqlite3.Connection, table_name: str) -> list[str]:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table_name})")
    return [str(row[1]) for row in cur.fetchall()]


def fetch_table_rows(
    conn: sqlite3.Connection,
    table_name: str,
    where_clause: str = "",
    params: tuple[Any, ...] = (),
) -> list[dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(f"SELECT * FROM {table_name} {where_clause}", params)
    return [dict(row) for row in cur.fetchall()]


def fetch_rows_by_ids(conn: sqlite3.Connection, table_name: str, id_column: str, ids: list[str]) -> list[dict[str, Any]]:
    if not ids:
        return []
    placeholders = ",".join("?" for _ in ids)
    return fetch_table_rows(conn, table_name, f"WHERE {id_column} IN ({placeholders})", tuple(ids))


def dedupe_backup_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique_rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        row_id = row.get("id")
        key = f"id:{row_id}" if row_id is not None else canonical_json(row)
        if key in seen:
            continue
        seen.add(key)
        unique_rows.append(row)
    return unique_rows


def summarize_backup_data(data: dict[str, list[dict[str, Any]]]) -> dict[str, int]:
    return {table_name: len(rows) for table_name, rows in data.items()}


def build_backup_metadata(payload: dict[str, Any], file_name: str, size_bytes: int) -> dict[str, Any]:
    summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
    generated_by = payload.get("generated_by") if isinstance(payload.get("generated_by"), dict) else {}
    total_records = 0
    for value in summary.values():
        try:
            total_records += int(value)
        except Exception:
            continue
    return {
        "file_name": file_name,
        "backup_kind": str(payload.get("backup_kind", "UNKNOWN")),
        "scope": str(payload.get("scope", "UNKNOWN")),
        "generated_at": str(payload.get("generated_at", "")),
        "generated_by": str(generated_by.get("email") or generated_by.get("role") or "SYSTEM"),
        "filters": payload.get("filters") if isinstance(payload.get("filters"), dict) else {},
        "summary": summary,
        "total_records": total_records,
        "size_bytes": size_bytes,
    }


def create_backup_payload(
    *,
    backup_kind: str,
    scope: str,
    generated_by: dict[str, Any],
    data: dict[str, list[dict[str, Any]]],
    filters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "backup_kind": backup_kind,
        "scope": scope,
        "generated_at": utc_now_iso(),
        "generated_by": generated_by,
        "filters": filters or {},
        "summary": summarize_backup_data(data),
        "data": data,
    }


def save_backup_payload(payload: dict[str, Any], *, file_hint: str = "") -> dict[str, Any]:
    ensure_backup_dir()
    timestamp_token = utc_now().strftime("%Y%m%dT%H%M%SZ")
    tokens = [
        "tracking",
        sanitize_backup_token(str(payload.get("backup_kind", "backup")).lower()),
        sanitize_backup_token(str(payload.get("scope", "scope")).lower()),
    ]
    if file_hint:
        tokens.append(sanitize_backup_token(file_hint.lower()))
    tokens.append(timestamp_token)
    file_name = "_".join(tokens) + ".json"
    path = BACKUP_DIR / file_name
    body = json.dumps(payload, indent=2, sort_keys=True).encode("utf-8")
    path.write_bytes(body)
    return build_backup_metadata(payload, file_name, len(body))


def load_backup_payload_from_file(file_name: str) -> tuple[dict[str, Any], Path, int]:
    ensure_backup_dir()
    if not re.fullmatch(r"[A-Za-z0-9._-]+\.json", file_name or ""):
        raise ValueError("Invalid backup file name")
    path = (BACKUP_DIR / file_name).resolve()
    if not str(path).startswith(str(BACKUP_DIR.resolve())):
        raise ValueError("Invalid backup file name")
    if not path.is_file():
        raise ValueError("Backup file not found")
    body = path.read_bytes()
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception as exc:
        raise ValueError("Backup file contains invalid JSON") from exc
    if not isinstance(payload, dict):
        raise ValueError("Backup file must contain a JSON object")
    return payload, path, len(body)


def list_backup_files() -> list[dict[str, Any]]:
    ensure_backup_dir()
    backups: list[dict[str, Any]] = []
    for path in sorted(BACKUP_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(payload, dict):
            continue
        backups.append(build_backup_metadata(payload, path.name, path.stat().st_size))
    return backups


def build_full_backup_data(conn: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    return {table_name: fetch_table_rows(conn, table_name) for table_name in BACKUP_TABLES}


def build_user_backup_data(conn: sqlite3.Connection, target_user_id: str) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    user_rows = fetch_table_rows(conn, "users", "WHERE id = ?", (target_user_id,))
    if not user_rows:
        raise ValueError("Target user not found")
    user_row = user_rows[0]

    orders = fetch_table_rows(
        conn,
        "customer_orders",
        "WHERE created_by_user_id = ? OR approved_by_user_id = ? OR delivery_user_id = ? OR delivered_by_user_id = ?",
        (target_user_id, target_user_id, target_user_id, target_user_id),
    )
    notifications = fetch_table_rows(
        conn,
        "notifications",
        "WHERE from_user_id = ? OR to_user_id = ?",
        (target_user_id, target_user_id),
    )
    transfers_by_user = fetch_table_rows(conn, "item_transfers", "WHERE transferred_by = ?", (target_user_id,))
    direct_items = fetch_table_rows(
        conn,
        "items",
        "WHERE current_holder_user_id = ? OR created_by_user_id = ?",
        (target_user_id, target_user_id),
    )

    related_item_ids = {
        str(row.get("item_id"))
        for row in [*orders, *notifications, *transfers_by_user, *direct_items]
        if row.get("item_id")
    }
    related_items = fetch_rows_by_ids(conn, "items", "id", sorted(related_item_ids))
    transfers = dedupe_backup_rows(transfers_by_user + fetch_rows_by_ids(conn, "item_transfers", "item_id", sorted(related_item_ids)))

    data = {
        "users": user_rows,
        "items": dedupe_backup_rows(direct_items + related_items),
        "item_transfers": transfers,
        "customer_orders": orders,
        "notifications": notifications,
        "user_sessions": fetch_table_rows(conn, "user_sessions", "WHERE user_id = ?", (target_user_id,)),
        "navigation_events": fetch_table_rows(conn, "navigation_events", "WHERE user_id = ?", (target_user_id,)),
        "login_system_controls": fetch_table_rows(conn, "login_system_controls", "WHERE user_id = ?", (target_user_id,)),
        "audit_logs": fetch_table_rows(conn, "audit_logs", "WHERE actor_user_id = ?", (target_user_id,)),
        "item_code_sequence": fetch_table_rows(conn, "item_code_sequence"),
        "user_code_sequence": fetch_table_rows(conn, "user_code_sequence"),
        "delivery_no_sequence": fetch_table_rows(conn, "delivery_no_sequence"),
    }
    return data, user_row


def export_full_backup(conn: sqlite3.Connection, session_user: sqlite3.Row, *, backup_kind: str, file_hint: str = "") -> dict[str, Any]:
    payload = create_backup_payload(
        backup_kind=backup_kind,
        scope="FULL",
        generated_by={
            "id": session_user["id"],
            "email": session_user["email"],
            "role": session_user["role"],
        },
        data=build_full_backup_data(conn),
    )
    return save_backup_payload(payload, file_hint=file_hint)


def export_user_backup(
    conn: sqlite3.Connection,
    session_user: sqlite3.Row,
    *,
    target_user_id: str,
    backup_kind: str,
    file_hint: str = "",
) -> tuple[dict[str, Any], dict[str, Any]]:
    data, target_user = build_user_backup_data(conn, target_user_id)
    payload = create_backup_payload(
        backup_kind=backup_kind,
        scope="USER",
        generated_by={
            "id": session_user["id"],
            "email": session_user["email"],
            "role": session_user["role"],
        },
        data=data,
        filters={"target_user_id": target_user_id, "target_user_email": target_user.get("email")},
    )
    return save_backup_payload(payload, file_hint=file_hint), target_user


def sync_imported_backup_state(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    now = utc_now_iso()
    cur.execute("UPDATE items SET fill_state = 'EMPTY' WHERE fill_state IS NULL OR TRIM(fill_state) = ''")
    cur.execute("UPDATE items SET item_type = 'CONTAINER' WHERE item_type IS NULL OR TRIM(item_type) = ''")
    cur.execute("UPDATE items SET item_type = 'CYLINDER' WHERE UPPER(TRIM(item_type)) = 'CYLENDER'")
    cur.execute("UPDATE items SET volume_unit = UPPER(TRIM(volume_unit)) WHERE volume_unit IS NOT NULL")
    cur.execute("UPDATE items SET volume_unit = 'LITERS' WHERE item_type = 'CYLINDER' AND (volume_unit IS NULL OR TRIM(volume_unit) = '')")
    cur.execute("UPDATE items SET volume_unit = NULL WHERE item_type != 'CYLINDER'")
    cur.execute("UPDATE items SET cycle_count = 0 WHERE cycle_count IS NULL")
    cur.execute("UPDATE items SET warning_active = 0 WHERE warning_active IS NULL")
    cur.execute(
        """
        UPDATE items
        SET capacity_units = CAST(ROUND(capacity * 100.0, 0) AS INTEGER)
        WHERE capacity_units IS NULL AND capacity IS NOT NULL
        """
    )
    cur.execute(
        """
        UPDATE items
        SET capacity = CAST(capacity_units AS REAL) / 100.0
        WHERE capacity_units IS NOT NULL
        """
    )

    normalize_item_category_prefix_rows(cur, now_iso=now)
    sync_item_category_state(conn, now_iso=now)

    enforce_system_super_admin_user_code(
        conn,
        super_admin_email=os.getenv("SUPER_ADMIN_EMAIL", "superadmin@example.com").strip().lower(),
        now_iso=now,
    )

    cur.execute("SELECT user_code FROM users WHERE user_code IS NOT NULL AND TRIM(user_code) != ''")
    user_code_rows = cur.fetchall()
    max_user_code_number = 0
    for user_code_row in user_code_rows:
        numeric_value = extract_numeric_suffix(user_code_row["user_code"])
        if numeric_value is not None and numeric_value > max_user_code_number:
            max_user_code_number = numeric_value
    cur.execute("SELECT next_value FROM user_code_sequence WHERE id = 1")
    user_sequence_row = cur.fetchone()
    next_user_value = max_user_code_number + 1 if max_user_code_number > 0 else 1
    if user_sequence_row is None:
        cur.execute("INSERT INTO user_code_sequence (id, next_value) VALUES (1, ?)", (next_user_value,))
    elif int(user_sequence_row["next_value"]) <= max_user_code_number:
        cur.execute("UPDATE user_code_sequence SET next_value = ? WHERE id = 1", (next_user_value,))

    cur.execute("SELECT item_code FROM items")
    item_rows = cur.fetchall()
    max_code_number = 0
    for item_row in item_rows:
        numeric_value = extract_numeric_suffix(item_row["item_code"])
        if numeric_value is not None and numeric_value > max_code_number:
            max_code_number = numeric_value
    cur.execute("SELECT next_value FROM item_code_sequence WHERE id = 1")
    item_sequence_row = cur.fetchone()
    next_item_value = max_code_number + 1 if max_code_number > 0 else 1
    if item_sequence_row is None:
        cur.execute("INSERT INTO item_code_sequence (id, next_value) VALUES (1, ?)", (next_item_value,))
    elif int(item_sequence_row["next_value"]) <= max_code_number:
        cur.execute("UPDATE item_code_sequence SET next_value = ? WHERE id = 1", (next_item_value,))

    delivery_max_value = get_delivery_sequence_max()
    cur.execute("SELECT next_value FROM delivery_no_sequence WHERE id = 1")
    delivery_sequence_row = cur.fetchone()
    if delivery_sequence_row is None:
        cur.execute("INSERT INTO delivery_no_sequence (id, next_value) VALUES (1, 1)")
    else:
        current_delivery_next = int(delivery_sequence_row["next_value"])
        if current_delivery_next < 1 or current_delivery_next > delivery_max_value:
            cur.execute("UPDATE delivery_no_sequence SET next_value = 1 WHERE id = 1")


def import_backup_payload(conn: sqlite3.Connection, backup_payload: dict[str, Any], import_mode: str) -> dict[str, int]:
    if backup_payload.get("format") != BACKUP_FORMAT or int(backup_payload.get("version", 0)) != BACKUP_VERSION:
        raise ValueError("Unsupported backup format")
    data = backup_payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("Backup data is missing or invalid")
    scope = str(backup_payload.get("scope", "")).upper()
    if import_mode == "REPLACE" and scope != "FULL":
        raise ValueError("Replace restore requires a full-system backup")

    cur = conn.cursor()
    if import_mode == "REPLACE":
        for table_name in BACKUP_DELETE_ORDER:
            cur.execute(f"DELETE FROM {table_name}")

    imported_counts: dict[str, int] = {}
    for table_name in BACKUP_TABLES:
        table_rows = data.get(table_name, [])
        if not isinstance(table_rows, list):
            raise ValueError(f"Backup data for {table_name} must be a list")
        table_columns = get_table_columns(conn, table_name)
        imported_counts[table_name] = 0
        for row in table_rows:
            if not isinstance(row, dict):
                raise ValueError(f"Backup row for {table_name} must be an object")
            filtered_row = {column: row[column] for column in table_columns if column in row}
            if not filtered_row:
                continue
            columns = list(filtered_row.keys())
            placeholders = ",".join("?" for _ in columns)
            cur.execute(
                f"INSERT OR REPLACE INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})",
                tuple(filtered_row[column] for column in columns),
            )
            imported_counts[table_name] += 1

    sync_imported_backup_state(conn)
    return imported_counts


def extract_delivery_no_from_payload(payload_json: str) -> int | None:
    try:
        payload = json.loads(payload_json or "{}")
    except Exception:
        return None

    if isinstance(payload, dict):
        if isinstance(payload.get("delivery_no"), int):
            return payload.get("delivery_no")
        deliveries = payload.get("processed_deliveries")
        if isinstance(deliveries, list) and deliveries:
            first = deliveries[0]
            if isinstance(first, dict) and isinstance(first.get("delivery_no"), int):
                return first.get("delivery_no")
    return None


def create_notification(
    conn: sqlite3.Connection,
    *,
    notification_type: str,
    title: str,
    message: str,
    delivery_no: int | None,
    from_user_id: str | None,
    from_user_name: str | None,
    to_user_id: str | None,
    to_user_name: str | None,
    to_role: str | None,
    item_id: str | None = None,
    item_code: str | None = None,
    item_title: str | None = None,
    meta: dict[str, Any] | None = None,
) -> str:
    notification_id = secrets.token_hex(16)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO notifications (
            id, type, title, message, delivery_no, from_user_id, from_user_name, to_user_id, to_user_name,
            to_role, item_id, item_code, item_title, is_read, meta_json, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        """,
        (
            notification_id,
            notification_type,
            title,
            message,
            delivery_no,
            from_user_id,
            from_user_name,
            to_user_id,
            to_user_name,
            to_role,
            item_id,
            item_code,
            item_title,
            canonical_json(meta or {}),
            utc_now_iso(),
        ),
    )
    return notification_id


def notify_admin_roles(
    conn: sqlite3.Connection,
    *,
    notification_type: str,
    title: str,
    message: str,
    delivery_no: int | None,
    from_user_id: str | None,
    from_user_name: str | None,
    item_id: str | None = None,
    item_code: str | None = None,
    item_title: str | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, full_name, role
        FROM users
        WHERE is_active = 1 AND role IN ('ADMIN', 'SUPER_ADMIN')
        """
    )
    admins = cur.fetchall()
    for admin in admins:
        create_notification(
            conn,
            notification_type=notification_type,
            title=title,
            message=message,
            delivery_no=delivery_no,
            from_user_id=from_user_id,
            from_user_name=from_user_name,
            to_user_id=admin["id"],
            to_user_name=admin["full_name"],
            to_role=admin["role"],
            item_id=item_id,
            item_code=item_code,
            item_title=item_title,
            meta=meta,
        )


def to_start_iso(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if len(value) == 10:
        return f"{value}T00:00:00+00:00"
    return value


def to_end_iso(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if len(value) == 10:
        return f"{value}T23:59:59+00:00"
    return value


def build_analytics_payload(conn: sqlite3.Connection, filters: dict[str, str]) -> dict[str, Any]:
    analytics_type = filters.get("analytics_type", "all").strip().lower() or "all"
    start_date = to_start_iso(filters.get("start_date", ""))
    end_date = to_end_iso(filters.get("end_date", ""))
    item_id_filter = filters.get("item_id", "").strip()
    delivery_user_id_filter = filters.get("delivery_user_id", "").strip()
    user_id_filter = filters.get("user_id", "").strip()
    group_by = filters.get("group_by", "month").strip().lower() or "month"

    cur = conn.cursor()

    def date_clause(column: str) -> tuple[str, list[str]]:
        clauses: list[str] = []
        params: list[str] = []
        if start_date:
            clauses.append(f"{column} >= ?")
            params.append(start_date)
        if end_date:
            clauses.append(f"{column} <= ?")
            params.append(end_date)
        return (" AND ".join(clauses), params)

    sections: dict[str, Any] = {}
    summary: dict[str, Any] = {}
    export_rows: list[dict[str, Any]] = []

    include_all = analytics_type == "all"

    if include_all or analytics_type == "user":
        clause, params = date_clause("u.created_at")
        where_sql = f"WHERE {clause}" if clause else ""
        cur.execute(
            f"""
            SELECT u.role, COUNT(1) AS user_count,
                   SUM(CASE WHEN u.is_active = 1 THEN 1 ELSE 0 END) AS active_count
            FROM users u
            {where_sql}
            GROUP BY u.role
            ORDER BY user_count DESC
            """,
            params,
        )
        rows = [dict(row) for row in cur.fetchall()]
        sections["user"] = rows
        summary["total_users"] = sum(int(row.get("user_count", 0)) for row in rows)
        for row in rows:
            export_rows.append({"analytics": "user", **row})

    if include_all or analytics_type == "item":
        item_where: list[str] = []
        item_params: list[str] = []
        if item_id_filter:
            item_where.append("(i.id = ? OR i.item_code = ?)")
            item_params.extend([item_id_filter, item_id_filter])
        clause, params = date_clause("i.created_at")
        if clause:
            item_where.append(clause)
            item_params.extend(params)
        where_sql = f"WHERE {' AND '.join(item_where)}" if item_where else ""
        cur.execute(
            f"""
            SELECT i.id, i.item_code, i.title, i.status, i.fill_state, i.cycle_count,
                                     i.warning_active, i.warning_reason,
                                     (
                                             SELECT t.dc_book_id
                                             FROM item_transfers t
                                             WHERE t.item_id = i.id
                                                 AND t.dc_book_id IS NOT NULL
                                                 AND TRIM(t.dc_book_id) != ''
                                                 AND t.dc_number IS NOT NULL
                                             ORDER BY t.transferred_at DESC
                                             LIMIT 1
                                     ) AS dc_book_id,
                                     (
                                             SELECT t.dc_number
                                             FROM item_transfers t
                                             WHERE t.item_id = i.id
                                                 AND t.dc_book_id IS NOT NULL
                                                 AND TRIM(t.dc_book_id) != ''
                                                 AND t.dc_number IS NOT NULL
                                             ORDER BY t.transferred_at DESC
                                             LIMIT 1
                                     ) AS dc_number,
                                     (
                                             SELECT t.transferred_at
                                             FROM item_transfers t
                                             WHERE t.item_id = i.id
                                                 AND t.dc_book_id IS NOT NULL
                                                 AND TRIM(t.dc_book_id) != ''
                                                 AND t.dc_number IS NOT NULL
                                             ORDER BY t.transferred_at DESC
                                             LIMIT 1
                                     ) AS dc_updated_at,
                                     i.created_at, i.updated_at
            FROM items i
            {where_sql}
            ORDER BY i.updated_at DESC
            LIMIT 500
            """,
            item_params,
        )
        rows = [dict(row) for row in cur.fetchall()]
        sections["item"] = rows
        summary["total_items"] = len(rows)
        for row in rows:
            export_rows.append({"analytics": "item", **row})

    if include_all or analytics_type == "delivery":
        where_parts: list[str] = []
        where_params: list[str] = []
        clause, params = date_clause("t.transferred_at")
        if clause:
            where_parts.append(clause)
            where_params.extend(params)
        if delivery_user_id_filter:
            where_parts.append("t.transferred_by = ?")
            where_params.append(delivery_user_id_filter)
        where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

        cur.execute(
            f"""
            SELECT t.transferred_by AS user_id,
                   COALESCE(u.user_code, '') AS user_code,
                   COALESCE(u.full_name, '') AS full_name,
                   COALESCE(u.email, '') AS email,
                   COUNT(1) AS transfer_count
            FROM item_transfers t
            LEFT JOIN users u ON u.id = t.transferred_by
            {where_sql}
            GROUP BY t.transferred_by, u.user_code, u.full_name, u.email
            ORDER BY transfer_count DESC
            LIMIT 300
            """,
            where_params,
        )
        rows = [dict(row) for row in cur.fetchall()]
        sections["delivery"] = rows
        summary["total_transfers"] = sum(int(row.get("transfer_count", 0)) for row in rows)
        for row in rows:
            export_rows.append({"analytics": "delivery", **row})

    if include_all or analytics_type in {"year", "month", "date", "time"}:
        if group_by not in {"year", "month", "date"}:
            group_by = "month"
        group_expr = {
            "year": "substr(t.transferred_at, 1, 4)",
            "month": "substr(t.transferred_at, 1, 7)",
            "date": "substr(t.transferred_at, 1, 10)",
        }[group_by]
        clause, params = date_clause("t.transferred_at")
        where_sql = f"WHERE {clause}" if clause else ""
        cur.execute(
            f"""
            SELECT {group_expr} AS period, COUNT(1) AS transfer_count
            FROM item_transfers t
            {where_sql}
            GROUP BY period
            ORDER BY period DESC
            LIMIT 500
            """,
            params,
        )
        rows = [dict(row) for row in cur.fetchall()]
        sections["time"] = rows
        summary["time_group_by"] = group_by
        for row in rows:
            export_rows.append({"analytics": "time", **row})

    if user_id_filter:
        summary["filter_user_id"] = user_id_filter
    if item_id_filter:
        summary["filter_item_id"] = item_id_filter
    if delivery_user_id_filter:
        summary["filter_delivery_user_id"] = delivery_user_id_filter
    if start_date:
        summary["start_date"] = start_date
    if end_date:
        summary["end_date"] = end_date

    return {
        "analytics_type": analytics_type,
        "group_by": group_by,
        "summary": summary,
        "sections": sections,
        "export_rows": export_rows,
    }


class TrackingHandler(BaseHTTPRequestHandler):
    server_version = "TrackingNoFramework/1.0"

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        origin = self.headers.get("Origin", "")
        allowed_origin = f"http://{HOST}:{PORT}"
        if origin == allowed_origin:
            self.send_header("Access-Control-Allow-Origin", allowed_origin)
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token")
            self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            self.handle_api_get(path, parse_qs(parsed.query))
            return

        self.serve_static(path)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            send_json(self, {"message": "Not Found"}, 404)
            return
        self.handle_api_post(path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            send_json(self, {"message": "Not Found"}, 404)
            return
        self.handle_api_post(path)

    def handle_api_get(self, path: str, query: dict[str, list[str]]) -> None:
        _ = query
        conn = get_conn()
        try:
            try:
                if path == "/api/health":
                    send_json(self, {"status": "ok"})
                    return

                session_user = get_current_user(self, conn)
                if session_user is None:
                    send_json(self, {"message": "Unauthorized"}, 401)
                    return

                if path == "/api/me":
                    csrf_token, should_set_csrf_cookie = get_or_create_csrf_token(self)
                    body = {
                        "user": {
                            "id": session_user["id"],
                            "user_code": session_user["user_code"],
                            "email": session_user["email"],
                            "full_name": session_user["full_name"],
                            "role": session_user["role"],
                            "created_at": session_user["created_at"],
                            "updated_at": session_user["updated_at"],
                            "last_login_at": session_user["last_login_at"],
                        },
                        "csrf_token": csrf_token,
                        "lifecycle": {
                            "max_cycles": ITEM_WARNING_MAX_CYCLES,
                            "max_years": ITEM_WARNING_MAX_YEARS,
                        },
                    }
                    raw = json.dumps(body).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(raw)))
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("X-Content-Type-Options", "nosniff")
                    self.send_header("X-Frame-Options", "DENY")
                    self.send_header("Referrer-Policy", "same-origin")
                    self.send_header("Cross-Origin-Opener-Policy", "same-origin")
                    if should_set_csrf_cookie:
                        self.send_header(
                            "Set-Cookie",
                            build_set_cookie_value(CSRF_COOKIE_NAME, csrf_token, http_only=False),
                        )
                    self.end_headers()
                    self.wfile.write(raw)
                    return

                if path == "/api/items":
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT
                            i.id,
                            i.item_code,
                            ci.custom_id,
                            i.title,
                            i.category,
                            i.ownership_type,
                            i.owner_name,
                            i.company_location_id,
                            cl.company_id AS location_company_id,
                            c.company_name AS location_company_name,
                            cl.location_name AS location_name,
                            i.item_type,
                            i.volume_unit,
                            i.capacity,
                            i.capacity_units,
                            i.fill_state,
                            i.cycle_count,
                            i.warning_active,
                            i.warning_reason,
                            i.status,
                            i.current_location,
                            i.current_holder_user_id,
                            i.created_by_mode,
                            i.created_by_user_id,
                            u.full_name AS created_by_name,
                            i.created_at,
                            i.updated_at
                        FROM items i
                        LEFT JOIN custom_item_ids ci ON ci.item_id = i.id
                        LEFT JOIN users u ON u.id = i.created_by_user_id
                        LEFT JOIN company_locations cl ON cl.id = i.company_location_id
                        LEFT JOIN companies c ON c.id = cl.company_id
                        ORDER BY i.updated_at DESC
                        LIMIT 300
                        """
                    )
                    rows = cur.fetchall()
                    data = [
                        (lambda warning: {
                            "id": row["id"],
                            "item_code": row["item_code"],
                            "custom_id": row["custom_id"],
                            "title": row["title"],
                            "category": row["category"],
                            "ownership_type": row["ownership_type"] or "OURS",
                            "owner_name": row["owner_name"],
                            "company_location_id": row["company_location_id"],
                            "location_company_id": row["location_company_id"],
                            "location_company_name": row["location_company_name"],
                            "location_name": row["location_name"],
                            "item_type": row["item_type"],
                            "volume_unit": row["volume_unit"],
                            "capacity": format_capacity_units(get_row_capacity_units(row)),
                            "fill_state": row["fill_state"],
                            "cycle_count": int(row["cycle_count"] or 0),
                            "warning_active": bool(row["warning_active"]) or warning[0],
                            "warning_reason": row["warning_reason"] or warning[1],
                            "age_years": round(warning[2], 2),
                            "status": row["status"],
                            "current_location": row["current_location"],
                            "current_holder_user_id": row["current_holder_user_id"],
                            "created_by_mode": row["created_by_mode"],
                            "created_by_user_id": row["created_by_user_id"],
                            "created_by_name": row["created_by_name"],
                            "updated_at": row["updated_at"],
                        })(evaluate_item_warning(int(row["cycle_count"] or 0), row["created_at"]))
                        for row in rows
                    ]
                    send_json(self, {"data": data})
                    return

                if path == "/api/companies":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT id, company_name, contact_info, is_active, created_by_user_id, created_at, updated_at
                        FROM companies
                        ORDER BY company_name ASC, created_at DESC
                        LIMIT 500
                        """
                    )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "id": row["id"],
                                    "company_name": row["company_name"],
                                    "contact_info": row["contact_info"],
                                    "is_active": bool(row["is_active"]),
                                    "created_by_user_id": row["created_by_user_id"],
                                    "created_at": row["created_at"],
                                    "updated_at": row["updated_at"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/company-locations":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    company_id = str((query.get("company_id") or [""])[0]).strip()
                    active_only_raw = str((query.get("active_only") or [""])[0]).strip().lower()
                    active_only = active_only_raw in {"1", "true", "yes", "on"}
                    cur = conn.cursor()
                    if company_id and active_only:
                        cur.execute(
                            """
                            SELECT cl.id, cl.company_id, c.company_name, cl.location_name, cl.address_line, cl.is_active, cl.created_at, cl.updated_at
                            FROM company_locations cl
                            JOIN companies c ON c.id = cl.company_id
                            WHERE cl.company_id = ? AND cl.is_active = 1
                            ORDER BY c.company_name ASC, cl.location_name ASC
                            LIMIT 1000
                            """,
                            (company_id,),
                        )
                    elif company_id:
                        cur.execute(
                            """
                            SELECT cl.id, cl.company_id, c.company_name, cl.location_name, cl.address_line, cl.is_active, cl.created_at, cl.updated_at
                            FROM company_locations cl
                            JOIN companies c ON c.id = cl.company_id
                            WHERE cl.company_id = ?
                            ORDER BY c.company_name ASC, cl.location_name ASC
                            LIMIT 1000
                            """,
                            (company_id,),
                        )
                    elif active_only:
                        cur.execute(
                            """
                            SELECT cl.id, cl.company_id, c.company_name, cl.location_name, cl.address_line, cl.is_active, cl.created_at, cl.updated_at
                            FROM company_locations cl
                            JOIN companies c ON c.id = cl.company_id
                            WHERE cl.is_active = 1
                            ORDER BY c.company_name ASC, cl.location_name ASC
                            LIMIT 1000
                            """
                        )
                    else:
                        cur.execute(
                            """
                            SELECT cl.id, cl.company_id, c.company_name, cl.location_name, cl.address_line, cl.is_active, cl.created_at, cl.updated_at
                            FROM company_locations cl
                            JOIN companies c ON c.id = cl.company_id
                            ORDER BY c.company_name ASC, cl.location_name ASC
                            LIMIT 1000
                            """
                        )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "id": row["id"],
                                    "company_id": row["company_id"],
                                    "company_name": row["company_name"],
                                    "location_name": row["location_name"],
                                    "address_line": row["address_line"],
                                    "is_active": bool(row["is_active"]),
                                    "created_at": row["created_at"],
                                    "updated_at": row["updated_at"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/items/next-code":
                    category = str((query.get("category") or [""])[0]).strip()
                    prefix_override = str((query.get("prefix") or [""])[0]).strip().upper() or None
                    category_type = str((query.get("item_type") or [""])[0]).strip().upper() or None
                    if category:
                        try:
                            send_json(self, {"item_code": preview_next_item_code_for_category(conn, category, prefix_override, category_type)})
                        except ValueError as exc:
                            send_json(self, {"message": str(exc)}, 400)
                    else:
                        send_json(self, {"item_code": preview_next_item_code(conn)})
                    return

                if path == "/api/item-categories":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT category_key, category_name, item_type, code_prefix, code_prefixes_json, range_start, range_end, is_active, created_at, updated_at
                        FROM item_categories
                        ORDER BY updated_at DESC, created_at DESC, item_type ASC, category_name ASC
                        """
                    )
                    rows = cur.fetchall()
                    data = []
                    for row in rows:
                        try:
                            prefixes = json.loads(str(row["code_prefixes_json"] or "[]"))
                        except Exception:
                            prefixes = [row["code_prefix"]]
                        prefixes = normalize_prefix_list(prefixes, str(row["code_prefix"] or "").strip().upper() or "GEN")
                        data.append(
                            {
                                "category_key": row["category_key"],
                                "category_name": row["category_name"],
                                "item_type": row["item_type"],
                                "code_prefix": row["code_prefix"],
                                "prefixes": prefixes,
                                "range_start": int(row["range_start"]) if row["range_start"] is not None else None,
                                "range_end": int(row["range_end"]) if row["range_end"] is not None else None,
                                "is_active": bool(row["is_active"]),
                                "created_at": row["created_at"],
                                "updated_at": row["updated_at"],
                            }
                        )
                    send_json(self, {"data": data})
                    return

                if path == "/api/volume-units":
                    if not role_allowed(session_user["role"], ALLOWED_ROLES):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT unit_name, is_active, created_at, updated_at
                        FROM volume_units
                        WHERE is_active = 1
                        ORDER BY unit_name ASC
                        """
                    )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "unit_name": row["unit_name"],
                                    "is_active": bool(row["is_active"]),
                                    "created_at": row["created_at"],
                                    "updated_at": row["updated_at"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/customer-locations":
                    if not role_allowed(session_user["role"], ALLOWED_ROLES):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    user_id = str((query.get("user_id") or [""])[0]).strip()
                    active_only_raw = str((query.get("active_only") or [""])[0]).strip().lower()
                    active_only = active_only_raw in {"1", "true", "yes", "on"}
                    cur = conn.cursor()
                    where_parts: list[str] = []
                    params: list[str] = []
                    if user_id:
                        where_parts.append("cl.user_id = ?")
                        params.append(user_id)
                    if active_only:
                        where_parts.append("cl.is_active = 1")
                    where_sql = f" WHERE {' AND '.join(where_parts)}" if where_parts else ""
                    cur.execute(
                        "SELECT cl.id, cl.user_id, u.full_name AS customer_name, u.user_code, cl.location_name, cl.address_line, cl.is_active, cl.created_at, cl.updated_at FROM customer_locations cl LEFT JOIN users u ON u.id = cl.user_id"
                        + where_sql
                        + " ORDER BY u.full_name ASC, cl.location_name ASC LIMIT 1000",
                        tuple(params),
                    )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "id": r["id"],
                                    "user_id": r["user_id"],
                                    "customer_name": r["customer_name"],
                                    "user_code": r["user_code"],
                                    "location_name": r["location_name"],
                                    "address_line": r["address_line"],
                                    "is_active": bool(r["is_active"]),
                                    "created_at": r["created_at"],
                                    "updated_at": r["updated_at"],
                                }
                                for r in rows
                            ]
                        },
                    )
                    return

                if path == "/api/items/status-transitions":
                    current_status = str((query.get("current_status") or [""])[0]).strip().upper()
                    payload: dict[str, Any] = {
                        "sequence": ITEM_STATUS_SEQUENCE,
                        "transitions": {status: sorted(next_statuses) for status, next_statuses in ITEM_STATUS_TRANSITIONS.items()},
                    }
                    if current_status:
                        if current_status not in ITEM_STATUS_TRANSITIONS:
                            send_json(self, {"message": "Invalid current status"}, 400)
                            return
                        payload["current_status"] = current_status
                        payload["allowed_next"] = [current_status, *sorted(ITEM_STATUS_TRANSITIONS[current_status])]
                    send_json(self, payload)
                    return

                if path == "/api/transition/users":
                    if not role_allowed(session_user["role"], ALLOWED_ROLES):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    normalized_role = normalize_role_value(session_user["role"])
                    cur = conn.cursor()
                    if normalized_role in {"SUPER_ADMIN", "ADMIN"}:
                        cur.execute(
                            """
                            SELECT id, user_code, full_name, email, role
                            FROM users
                            WHERE is_active = 1
                            ORDER BY full_name ASC
                            LIMIT 300
                            """
                        )
                    else:
                        cur.execute(
                            """
                            SELECT id, user_code, full_name, '' AS email, role
                            FROM users
                            WHERE id = ? AND is_active = 1
                            LIMIT 1
                            """,
                            (session_user["id"],),
                        )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "id": row["id"],
                                    "user_code": row["user_code"],
                                    "full_name": row["full_name"],
                                    "email": row["email"],
                                    "role": row["role"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/transition/items":
                    if not role_allowed(session_user["role"], ALLOWED_ROLES):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return

                    source_type = str((query.get("source_type") or [""])[0]).strip().upper()
                    source_user_id = str((query.get("source_user_id") or [""])[0]).strip()
                    source_location_id = str((query.get("source_location_id") or [""])[0]).strip()
                    process_id = str((query.get("process_id") or [""])[0]).strip()
                    if source_type not in ALLOWED_TRANSITION_SOURCE:
                        send_json(self, {"message": "Invalid source type"}, 400)
                        return
                    if not is_transition_source_allowed_for_user(session_user, "TAKING", source_type, source_user_id):
                        send_json(self, {"message": f"Source type {source_type} is not allowed for your role"}, 403)
                        return

                    cur = conn.cursor()
                    base_query = (
                        """
                        SELECT id, item_code, title, category, capacity, capacity_units, fill_state, status, current_location, current_holder_user_id
                        FROM items
                        """
                    )

                    if source_type == "SELF":
                        if source_location_id:
                            cur.execute(
                                base_query + " WHERE current_holder_user_id = ? AND status = 'WITH_ME' AND company_location_id = ? ORDER BY updated_at DESC LIMIT 300",
                                (session_user["id"], source_location_id),
                            )
                        else:
                            cur.execute(
                                base_query + " WHERE current_holder_user_id = ? AND status = 'WITH_ME' ORDER BY updated_at DESC LIMIT 300",
                                (session_user["id"],),
                            )
                    elif source_type == "EMPLOYEE":
                        if not source_user_id:
                            send_json(self, {"message": "source_user_id is required for EMPLOYEE source"}, 400)
                            return
                        cur.execute(base_query + " WHERE current_holder_user_id = ? ORDER BY updated_at DESC LIMIT 300", (source_user_id,))
                    elif source_type == "FILLER":
                        if not source_user_id:
                            send_json(self, {"message": "source_user_id is required for FILLER source"}, 400)
                            return
                        cur.execute("SELECT full_name, user_code, email FROM users WHERE id = ?", (source_user_id,))
                        selected_user = cur.fetchone()
                        if selected_user is None:
                            send_json(self, {"message": "Selected filler user not found"}, 404)
                            return
                        name_candidates = [
                            str(selected_user["full_name"] or "").strip().lower(),
                            str(selected_user["user_code"] or "").strip().lower(),
                            str(selected_user["email"] or "").strip().lower(),
                        ]
                        valid_names = [value for value in name_candidates if value]
                        if valid_names:
                            placeholders = ",".join(["?" for _ in valid_names])
                            cur.execute(
                                base_query
                                + f" WHERE current_holder_user_id = ? OR (current_holder_user_id IS NULL AND status = 'WITH_CLIENT' AND LOWER(TRIM(current_location)) IN ({placeholders})) ORDER BY updated_at DESC LIMIT 300",
                                (source_user_id, *valid_names),
                            )
                        else:
                            cur.execute(base_query + " WHERE current_holder_user_id = ? ORDER BY updated_at DESC LIMIT 300", (source_user_id,))
                    elif source_type == "CUSTOMER":
                        if not source_user_id:
                            send_json(self, {"message": "source_user_id is required for CUSTOMER source"}, 400)
                            return
                        cur.execute("SELECT full_name, user_code, email FROM users WHERE id = ?", (source_user_id,))
                        selected_user = cur.fetchone()
                        if selected_user is None:
                            send_json(self, {"message": "Selected customer user not found"}, 404)
                            return
                        name_candidates = [
                            str(selected_user["full_name"] or "").strip().lower(),
                            str(selected_user["user_code"] or "").strip().lower(),
                            str(selected_user["email"] or "").strip().lower(),
                        ]
                        valid_names = [value for value in name_candidates if value]
                        if source_location_id and valid_names:
                            placeholders = ",".join(["?" for _ in valid_names])
                            cur.execute(
                                base_query + f" WHERE status = 'WITH_CLIENT' AND company_location_id = ? AND (current_holder_user_id = ? OR (current_holder_user_id IS NULL AND LOWER(TRIM(current_location)) IN ({placeholders}))) ORDER BY updated_at DESC LIMIT 300",
                                (source_location_id, source_user_id, *valid_names),
                            )
                        elif source_location_id:
                            cur.execute(
                                base_query + " WHERE status = 'WITH_CLIENT' AND company_location_id = ? AND current_holder_user_id = ? ORDER BY updated_at DESC LIMIT 300",
                                (source_location_id, source_user_id),
                            )
                        elif valid_names:
                            placeholders = ",".join(["?" for _ in valid_names])
                            cur.execute(
                                base_query + f" WHERE status = 'WITH_CLIENT' AND (current_holder_user_id = ? OR (current_holder_user_id IS NULL AND LOWER(TRIM(current_location)) IN ({placeholders}))) ORDER BY updated_at DESC LIMIT 300",
                                (source_user_id, *valid_names),
                            )
                        else:
                            cur.execute(
                                base_query + " WHERE current_holder_user_id = ? AND status = 'WITH_CLIENT' ORDER BY updated_at DESC LIMIT 300",
                                (source_user_id,),
                            )
                    else:
                        if process_id:
                            cur.execute(
                                base_query
                                + " WHERE status = 'IN_TRANSIT' AND current_holder_user_id = ? AND EXISTS (SELECT 1 FROM item_transfers t WHERE t.item_id = items.id AND t.transition_process_id = ?) ORDER BY updated_at DESC LIMIT 300",
                                (session_user["id"], process_id),
                            )
                        else:
                            cur.execute(
                                base_query + " WHERE status = 'IN_TRANSIT' AND current_holder_user_id = ? ORDER BY updated_at DESC LIMIT 300",
                                (session_user["id"],),
                            )

                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "id": row["id"],
                                    "item_code": row["item_code"],
                                    "title": row["title"],
                                    "category": row["category"],
                                    "capacity": format_capacity_units(get_row_capacity_units(row)),
                                    "fill_state": row["fill_state"],
                                    "status": row["status"],
                                    "current_location": row["current_location"],
                                    "current_holder_user_id": row["current_holder_user_id"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/transition/dc-links":
                    if not role_allowed(session_user["role"], ALLOWED_ROLES):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return

                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT
                            t.dc_book_id,
                            t.dc_number,
                            COUNT(1) AS pending_items,
                            MAX(t.transferred_at) AS last_giving_at
                        FROM item_transfers t
                        WHERE t.dc_book_id IS NOT NULL
                          AND TRIM(t.dc_book_id) != ''
                          AND t.dc_number IS NOT NULL
                          AND t.reason LIKE 'TRANSITION_GIVING%'
                          AND t.linked_taking_at IS NULL
                        GROUP BY t.dc_book_id, t.dc_number
                        ORDER BY last_giving_at DESC
                        LIMIT 300
                        """
                    )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "dc_book_id": row["dc_book_id"],
                                    "dc_number": int(row["dc_number"]),
                                    "pending_items": int(row["pending_items"] or 0),
                                    "last_giving_at": row["last_giving_at"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/transition/processes":
                    if not role_allowed(session_user["role"], ALLOWED_ROLES):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return

                    cur = conn.cursor()
                    where_sql = ""
                    args: list[Any] = []
                    if session_user["role"] not in {"SUPER_ADMIN", "ADMIN"}:
                        where_sql = "WHERE p.created_by_user_id = ?"
                        args.append(session_user["id"])

                    cur.execute(
                        f"""
                        SELECT
                            p.id,
                            p.created_by_user_id,
                            u.full_name AS created_by_name,
                            p.created_at,
                            p.updated_at,
                            (
                                COUNT(t.id)
                                + COALESCE(
                                    SUM(
                                        CASE
                                            WHEN t.linked_taking_at IS NOT NULL THEN 1
                                            ELSE 0
                                        END
                                    ),
                                    0
                                )
                            ) AS transfer_count,
                            COALESCE(SUM(CASE WHEN t.reason LIKE 'TRANSITION_GIVING%' THEN 1 ELSE 0 END), 0) AS giving_count,
                            (
                                COALESCE(SUM(CASE WHEN t.reason LIKE 'TRANSITION_TAKING%' THEN 1 ELSE 0 END), 0)
                                + COALESCE(
                                    SUM(
                                        CASE
                                            WHEN t.linked_taking_at IS NOT NULL THEN 1
                                            ELSE 0
                                        END
                                    ),
                                    0
                                )
                            ) AS taking_count,
                            (
                                SELECT COALESCE(NULLIF(TRIM(tt.to_location), ''), NULLIF(TRIM(tt.to_status), ''), '-')
                                FROM item_transfers tt
                                WHERE tt.transition_process_id = p.id
                                ORDER BY tt.transferred_at DESC
                                LIMIT 1
                            ) AS last_target,
                            (
                                SELECT COALESCE(NULLIF(TRIM(tt.reason), ''), '-')
                                FROM item_transfers tt
                                WHERE tt.transition_process_id = p.id
                                ORDER BY tt.transferred_at DESC
                                LIMIT 1
                            ) AS last_action,
                            MAX(t.transferred_at) AS last_transfer_at
                        FROM transition_processes p
                        LEFT JOIN users u ON u.id = p.created_by_user_id
                        LEFT JOIN item_transfers t ON t.transition_process_id = p.id
                        {where_sql}
                        GROUP BY p.id, p.created_by_user_id, u.full_name, p.created_at, p.updated_at
                        ORDER BY p.updated_at DESC
                        LIMIT 100
                        """,
                        tuple(args),
                    )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "id": row["id"],
                                    "created_by_user_id": row["created_by_user_id"],
                                    "created_by_name": row["created_by_name"],
                                    "created_at": row["created_at"],
                                    "updated_at": row["updated_at"],
                                    "transfer_count": int(row["transfer_count"] or 0),
                                    "giving_count": int(row["giving_count"] or 0),
                                    "taking_count": int(row["taking_count"] or 0),
                                    "last_target": row["last_target"] or "-",
                                    "last_action": row["last_action"] or "-",
                                    "last_transfer_at": row["last_transfer_at"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/transition/target-policy":
                    if not role_allowed(session_user["role"], ALLOWED_ROLES):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return

                    target_type = str((query.get("target_type") or [""])[0]).strip().upper()
                    target_key = str((query.get("target_key") or [""])[0]).strip()
                    if target_type not in {"USER", "CUSTOMER"}:
                        send_json(self, {"message": "target_type must be USER or CUSTOMER"}, 400)
                        return
                    if len(target_key) < 2 or len(target_key) > 120:
                        send_json(self, {"message": "target_key must be between 2 and 120 characters"}, 400)
                        return

                    normalized_key = target_key.lower() if target_type == "CUSTOMER" else target_key
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT reject_empty_items, updated_at FROM transition_target_policies WHERE target_type = ? AND target_key = ?",
                        (target_type, normalized_key),
                    )
                    row = cur.fetchone()
                    send_json(
                        self,
                        {
                            "data": {
                                "target_type": target_type,
                                "target_key": target_key,
                                "exists": row is not None,
                                "reject_empty_items": bool(row["reject_empty_items"]) if row is not None else False,
                                "updated_at": row["updated_at"] if row is not None else None,
                            }
                        },
                    )
                    return

                if path == "/api/transition/process-details":
                    if not role_allowed(session_user["role"], ALLOWED_ROLES):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return

                    process_id = (query.get("process_id") or [""])[0].strip()
                    if not process_id:
                        send_json(self, {"message": "process_id is required"}, 400)
                        return

                    cur = conn.cursor()
                    if session_user["role"] in {"SUPER_ADMIN", "ADMIN"}:
                        cur.execute("SELECT id FROM transition_processes WHERE id = ?", (process_id,))
                    else:
                        cur.execute(
                            "SELECT id FROM transition_processes WHERE id = ? AND created_by_user_id = ?",
                            (process_id, session_user["id"]),
                        )
                    process_row = cur.fetchone()
                    if process_row is None:
                        send_json(self, {"message": "Process not found"}, 404)
                        return

                    cur.execute(
                        """
                        SELECT
                            t.id,
                            t.item_id,
                            i.item_code,
                            i.title,
                            t.from_status,
                            t.to_status,
                            t.from_location,
                            t.to_location,
                            t.reason,
                            t.delivery_no,
                            t.dc_book_id,
                            t.dc_number,
                            t.linked_taking_at,
                            t.transferred_at,
                            COALESCE(u.full_name, t.transferred_by) AS transferred_by_name
                        FROM item_transfers t
                        LEFT JOIN items i ON i.id = t.item_id
                        LEFT JOIN users u ON u.id = t.transferred_by
                        WHERE t.transition_process_id = ?
                        ORDER BY t.transferred_at DESC
                        LIMIT 200
                        """,
                        (process_id,),
                    )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "id": row["id"],
                                    "item_id": row["item_id"],
                                    "item_code": row["item_code"],
                                    "title": row["title"],
                                    "from_status": row["from_status"],
                                    "to_status": row["to_status"],
                                    "from_location": row["from_location"],
                                    "to_location": row["to_location"],
                                    "reason": row["reason"],
                                    "delivery_no": row["delivery_no"],
                                    "dc_book_id": row["dc_book_id"],
                                    "dc_number": row["dc_number"],
                                    "linked_taking_at": row["linked_taking_at"],
                                    "transferred_at": row["transferred_at"],
                                    "transferred_by_name": row["transferred_by_name"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/users":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT
                            u.id,
                            u.user_code,
                            u.email,
                            u.full_name,
                            u.role,
                            u.created_by_mode,
                            u.created_by_user_id,
                            c.full_name AS created_by_name,
                            u.created_at,
                            u.is_active,
                            u.reject_empty_items,
                            u.reject_full_items
                        FROM users u
                        LEFT JOIN users c ON c.id = u.created_by_user_id
                        ORDER BY u.created_at DESC
                        LIMIT 200
                        """
                    )
                    rows = cur.fetchall()
                    data = [
                        {
                            "id": row["id"],
                            "user_code": row["user_code"],
                            "email": row["email"],
                            "full_name": row["full_name"],
                            "role": row["role"],
                            "created_by_mode": row["created_by_mode"],
                            "created_by_user_id": row["created_by_user_id"],
                            "created_by_name": row["created_by_name"],
                            "created_at": row["created_at"],
                            "is_active": bool(row["is_active"]),
                            "reject_empty_items": bool(row["reject_empty_items"]),
                            "reject_full_items": bool(row["reject_full_items"]),
                        }
                        for row in rows
                    ]
                    send_json(self, {"data": data})
                    return

                if path == "/api/login-controls":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    user_id_filter = str((query.get("user_id") or [""])[0]).strip()
                    cur = conn.cursor()
                    if user_id_filter:
                        cur.execute(
                            """
                            SELECT
                                l.id,
                                l.user_id,
                                l.system_name,
                                l.mac_address,
                                l.is_active,
                                l.created_at,
                                u.user_code,
                                u.full_name,
                                u.email
                            FROM login_system_controls l
                            JOIN users u ON u.id = l.user_id
                            WHERE l.user_id = ?
                            ORDER BY l.created_at DESC
                            LIMIT 300
                            """,
                            (user_id_filter,),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT
                                l.id,
                                l.user_id,
                                l.system_name,
                                l.mac_address,
                                l.is_active,
                                l.created_at,
                                u.user_code,
                                u.full_name,
                                u.email
                            FROM login_system_controls l
                            JOIN users u ON u.id = l.user_id
                            ORDER BY l.created_at DESC
                            LIMIT 500
                            """
                        )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "id": row["id"],
                                    "user_id": row["user_id"],
                                    "system_name": row["system_name"],
                                    "mac_address": row["mac_address"],
                                    "is_active": bool(row["is_active"]),
                                    "created_at": row["created_at"],
                                    "user_code": row["user_code"],
                                    "full_name": row["full_name"],
                                    "email": row["email"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/sessions/me":
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT id, device_fingerprint, ip_address, user_agent, is_active, created_at, last_seen_at
                        FROM user_sessions
                        WHERE user_id = ?
                        ORDER BY created_at DESC
                        LIMIT 100
                        """,
                        (session_user["id"],),
                    )
                    rows = cur.fetchall()
                    data = [
                        {
                            "id": row["id"],
                            "device_fingerprint": row["device_fingerprint"],
                            "ip_address": row["ip_address"],
                            "user_agent": row["user_agent"],
                            "is_active": bool(row["is_active"]),
                            "created_at": row["created_at"],
                            "last_seen_at": row["last_seen_at"],
                        }
                        for row in rows
                    ]
                    send_json(self, {"data": data})
                    return

                if path == "/api/notifications":
                    cur = conn.cursor()
                    if role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        cur.execute(
                            """
                            SELECT
                                id, type, title, message, delivery_no, from_user_id, from_user_name,
                                to_user_id, to_user_name, to_role,
                                item_id, item_code, item_title, is_read, created_at
                            FROM notifications
                            WHERE to_user_id = ? OR to_role IN ('ADMIN', 'SUPER_ADMIN')
                            ORDER BY created_at DESC
                            LIMIT 500
                            """,
                            (session_user["id"],),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT
                                id, type, title, message, delivery_no, from_user_id, from_user_name,
                                to_user_id, to_user_name, to_role,
                                item_id, item_code, item_title, is_read, created_at
                            FROM notifications
                            WHERE to_user_id = ?
                            ORDER BY created_at DESC
                            LIMIT 200
                            """,
                            (session_user["id"],),
                        )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "id": row["id"],
                                    "type": row["type"],
                                    "title": row["title"],
                                    "message": row["message"],
                                    "delivery_no": row["delivery_no"],
                                    "from_user_id": row["from_user_id"],
                                    "from_user_name": row["from_user_name"],
                                    "to_user_id": row["to_user_id"],
                                    "to_user_name": row["to_user_name"],
                                    "to_role": row["to_role"],
                                    "item_id": row["item_id"],
                                    "item_code": row["item_code"],
                                    "item_title": row["item_title"],
                                    "is_read": bool(row["is_read"]),
                                    "created_at": row["created_at"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/orders":
                    cur = conn.cursor()
                    if session_user["role"] in {"DELIVERY_PARTNER", "EXTERNAL_PARTNER"}:
                        cur.execute(
                            """
                            SELECT *
                            FROM customer_orders
                            WHERE delivery_user_id = ?
                            ORDER BY created_at DESC
                            LIMIT 300
                            """,
                            (session_user["id"],),
                        )
                    elif role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        cur.execute(
                            """
                            SELECT *
                            FROM customer_orders
                            ORDER BY created_at DESC
                            LIMIT 500
                            """
                        )
                    else:
                        cur.execute(
                            """
                            SELECT *
                            FROM customer_orders
                            WHERE created_by_user_id = ?
                            ORDER BY created_at DESC
                            LIMIT 300
                            """,
                            (session_user["id"],),
                        )
                    rows = cur.fetchall()
                    send_json(self, {"data": [dict(row) for row in rows]})
                    return

                if path == "/api/activity-logs":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT id, actor_user_id, actor_name, action, entity_type, entity_id, entity_label, created_at
                        FROM activity_logs
                        ORDER BY created_at DESC
                        LIMIT 500
                        """
                    )
                    rows = cur.fetchall()
                    send_json(self, {"data": [dict(row) for row in rows]})
                    return

                if path == "/api/logs":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT id, action, entity_type, entity_id, payload_json, checksum, created_at
                        FROM audit_logs
                        WHERE action != 'NAVIGATION_EVENT'
                        ORDER BY created_at DESC
                        LIMIT 200
                        """
                    )
                    rows = cur.fetchall()
                    data = [
                        {
                            "id": row["id"],
                            "action": row["action"],
                            "entity_type": row["entity_type"],
                            "entity_id": row["entity_id"],
                            "delivery_no": extract_delivery_no_from_payload(row["payload_json"]),
                            "checksum": row["checksum"],
                            "created_at": row["created_at"],
                        }
                        for row in rows
                    ]
                    send_json(self, {"data": data})
                    return

                if path == "/api/analytics":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    filters = {
                        "analytics_type": str((query.get("analytics_type") or ["all"])[0]),
                        "group_by": str((query.get("group_by") or ["month"])[0]),
                        "start_date": str((query.get("start_date") or [""])[0]),
                        "end_date": str((query.get("end_date") or [""])[0]),
                        "user_id": str((query.get("user_id") or [""])[0]),
                        "item_id": str((query.get("item_id") or [""])[0]),
                        "delivery_user_id": str((query.get("delivery_user_id") or [""])[0]),
                    }
                    payload = build_analytics_payload(conn, filters)
                    send_json(
                        self,
                        {
                            "analytics_type": payload["analytics_type"],
                            "group_by": payload["group_by"],
                            "summary": payload["summary"],
                            "sections": payload["sections"],
                        },
                    )
                    return

                if path == "/api/analytics/export":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    filters = {
                        "analytics_type": str((query.get("analytics_type") or ["all"])[0]),
                        "group_by": str((query.get("group_by") or ["month"])[0]),
                        "start_date": str((query.get("start_date") or [""])[0]),
                        "end_date": str((query.get("end_date") or [""])[0]),
                        "user_id": str((query.get("user_id") or [""])[0]),
                        "item_id": str((query.get("item_id") or [""])[0]),
                        "delivery_user_id": str((query.get("delivery_user_id") or [""])[0]),
                    }
                    payload = build_analytics_payload(conn, filters)
                    send_csv(self, "analytics_export.csv", payload["export_rows"])
                    return

                if path == "/api/super-admin/stats":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    stats: dict[str, int] = {}
                    for table_name in [
                        "users",
                        "items",
                        "custom_item_ids",
                        "dc_books",
                        "transition_processes",
                        "item_transfers",
                        "customer_orders",
                        "notifications",
                        "user_sessions",
                        "navigation_events",
                        "login_system_controls",
                        "audit_logs",
                    ]:
                        cur.execute(f"SELECT COUNT(1) AS count FROM {table_name}")
                        stats[table_name] = int(cur.fetchone()["count"])
                    send_json(self, {"data": stats})
                    return

                if path == "/api/super-admin/dc-books":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT book_id, range_start, range_end, next_dc_number, is_active, created_by_user_id, created_at, updated_at
                        FROM dc_books
                        ORDER BY created_at DESC
                        """
                    )
                    rows = cur.fetchall()
                    data = []
                    for row in rows:
                        next_dc_number = int(row["next_dc_number"] or 1)
                        range_end = int(row["range_end"] or 0)
                        data.append(
                            {
                                "book_id": row["book_id"],
                                "range_start": int(row["range_start"] or 0),
                                "range_end": range_end,
                                "next_dc_number": next_dc_number,
                                "is_active": bool(row["is_active"]),
                                "remaining": max(0, range_end - next_dc_number + 1),
                                "created_by_user_id": row["created_by_user_id"],
                                "created_at": row["created_at"],
                                "updated_at": row["updated_at"],
                            }
                        )
                    send_json(self, {"data": data})
                    return

                if path == "/api/super-admin/dc-books/details":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return

                    book_id = normalize_dc_book_id((query.get("book_id") or [""])[0])
                    if not book_id:
                        send_json(self, {"message": "book_id is required"}, 400)
                        return

                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT book_id, range_start, range_end, next_dc_number, is_active, created_at, updated_at
                        FROM dc_books
                        WHERE book_id = ?
                        """,
                        (book_id,),
                    )
                    book_row = cur.fetchone()
                    if book_row is None:
                        send_json(self, {"message": "DC book not found"}, 404)
                        return

                    cur.execute(
                        """
                        SELECT
                            t.id,
                            t.item_id,
                            i.item_code,
                            i.title,
                            t.delivery_no,
                            t.dc_number,
                            t.from_location,
                            t.to_location,
                            t.transferred_at,
                            t.transferred_by,
                            COALESCE(link_user.full_name, t.linked_taking_by) AS linked_taking_by_name,
                            t.linked_taking_at,
                            t.linked_taking_source_type,
                            t.linked_taking_to_status,
                            t.linked_taking_to_location,
                            t.linked_taking_fill_state,
                            i.status AS current_item_status,
                            i.fill_state AS current_item_fill_state,
                            i.current_location AS current_item_location
                        FROM item_transfers t
                        LEFT JOIN items i ON i.id = t.item_id
                        LEFT JOIN users link_user ON link_user.id = t.linked_taking_by
                        WHERE t.dc_book_id = ?
                        ORDER BY t.dc_number DESC, t.transferred_at DESC
                        LIMIT 500
                        """,
                        (book_id,),
                    )
                    rows = cur.fetchall()

                    records: list[dict[str, Any]] = []
                    linked_count = 0
                    open_count = 0
                    empty_link_count = 0
                    unique_numbers: set[int] = set()
                    for row in rows:
                        dc_number = int(row["dc_number"] or 0)
                        if dc_number > 0:
                            unique_numbers.add(dc_number)
                        is_linked = bool(row["linked_taking_at"])
                        if is_linked:
                            linked_count += 1
                        else:
                            open_count += 1
                        if str(row["linked_taking_fill_state"] or "").strip().upper() == "EMPTY":
                            empty_link_count += 1
                        current_fill_state = str(row["current_item_fill_state"] or "").strip().upper()
                        records.append(
                            {
                                "id": row["id"],
                                "item_id": row["item_id"],
                                "item_code": row["item_code"],
                                "title": row["title"],
                                "delivery_no": row["delivery_no"],
                                "dc_number": dc_number,
                                "from_location": row["from_location"],
                                "to_location": row["to_location"],
                                "transferred_at": row["transferred_at"],
                                "linked_taking_at": row["linked_taking_at"],
                                "linked_taking_by_name": row["linked_taking_by_name"],
                                "linked_taking_source_type": row["linked_taking_source_type"],
                                "linked_taking_to_status": row["linked_taking_to_status"],
                                "linked_taking_to_location": row["linked_taking_to_location"],
                                "linked_taking_fill_state": row["linked_taking_fill_state"],
                                "current_item_status": row["current_item_status"],
                                "current_item_fill_state": current_fill_state,
                                "current_item_location": row["current_item_location"],
                                "record_status": "LINKED" if is_linked else "OPEN",
                                "can_link_empty": (not is_linked) and current_fill_state == "EMPTY",
                            }
                        )

                    send_json(
                        self,
                        {
                            "book": {
                                "book_id": book_row["book_id"],
                                "range_start": int(book_row["range_start"] or 0),
                                "range_end": int(book_row["range_end"] or 0),
                                "next_dc_number": int(book_row["next_dc_number"] or 1),
                                "is_active": bool(book_row["is_active"]),
                                "created_at": book_row["created_at"],
                                "updated_at": book_row["updated_at"],
                            },
                            "summary": {
                                "total_records": len(records),
                                "open_records": open_count,
                                "linked_records": linked_count,
                                "empty_links": empty_link_count,
                                "used_numbers": len(unique_numbers),
                            },
                            "records": records,
                        },
                    )
                    return

                if path == "/api/super-admin/custom-item-ids":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT ci.item_id, ci.custom_id, ci.created_by_user_id, ci.created_at, ci.updated_at,
                               i.item_code, i.title
                        FROM custom_item_ids ci
                        LEFT JOIN items i ON i.id = ci.item_id
                        ORDER BY ci.updated_at DESC
                        """
                    )
                    rows = cur.fetchall()
                    send_json(
                        self,
                        {
                            "data": [
                                {
                                    "item_id": row["item_id"],
                                    "item_code": row["item_code"],
                                    "title": row["title"],
                                    "custom_id": row["custom_id"],
                                    "created_by_user_id": row["created_by_user_id"],
                                    "created_at": row["created_at"],
                                    "updated_at": row["updated_at"],
                                }
                                for row in rows
                            ]
                        },
                    )
                    return

                if path == "/api/dc-books/available":
                    if not role_allowed(session_user["role"], ALLOWED_ROLES):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute(
                        """
                        SELECT book_id, range_start, range_end, next_dc_number
                        FROM dc_books
                        WHERE is_active = 1 AND next_dc_number <= range_end
                        ORDER BY created_at DESC
                        """
                    )
                    rows = cur.fetchall()
                    data = [
                        {
                            "book_id": row["book_id"],
                            "range_start": int(row["range_start"] or 0),
                            "range_end": int(row["range_end"] or 0),
                            "next_dc_number": int(row["next_dc_number"] or 1),
                            "remaining": max(0, int(row["range_end"] or 0) - int(row["next_dc_number"] or 1) + 1),
                        }
                        for row in rows
                    ]
                    send_json(self, {"data": data})
                    return

                if path == "/api/backups":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    send_json(self, {"data": list_backup_files()})
                    return

                if path == "/api/backups/download":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    file_name = str((query.get("file_name") or [""])[0]).strip()
                    if not file_name:
                        send_json(self, {"message": "file_name is required"}, 400)
                        return
                    _, path_obj, _ = load_backup_payload_from_file(file_name)
                    send_download_bytes(
                        self,
                        path_obj.read_bytes(),
                        filename=path_obj.name,
                        content_type="application/json; charset=utf-8",
                    )
                    return

                send_json(self, {"message": "Not Found"}, 404)
            except Exception:
                send_json(self, {"message": "Internal server error"}, 500)
        finally:
            conn.close()

    def handle_api_post(self, path: str) -> None:
        conn = get_conn()
        try:
            if path == "/api/users/register-self":
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"email", "full_name", "password", "security_key_1", "security_key_2", "security_key_3"},
                    required_fields={"email", "full_name", "password"},
                )
                email = str(payload.get("email", "")).strip().lower()
                full_name = str(payload.get("full_name", "")).strip()
                password = str(payload.get("password", ""))
                security_keys = parse_security_keys(payload)

                if not is_valid_email(email):
                    send_json(self, {"message": "Valid email is required"}, 400)
                    return
                if len(full_name) < 2 or len(full_name) > 120:
                    send_json(self, {"message": "Full name must be between 2 and 120 characters"}, 400)
                    return
                password_error = validate_password(password)
                if password_error:
                    send_json(self, {"message": password_error}, 400)
                    return
                security_error = validate_security_keys(security_keys, required=False)
                if security_error:
                    send_json(self, {"message": security_error}, 400)
                    return

                update_security_keys = all(security_keys)
                security_key_1_hash = hash_security_key(security_keys[0]) if update_security_keys else None
                security_key_2_hash = hash_security_key(security_keys[1]) if update_security_keys else None
                security_key_3_hash = hash_security_key(security_keys[2]) if update_security_keys else None

                cur = conn.cursor()
                cur.execute("SELECT id FROM users WHERE email = ?", (email,))
                if cur.fetchone() is not None:
                    send_json(self, {"message": "User already exists"}, 409)
                    return

                user_id = secrets.token_hex(16)
                user_code = generate_next_user_code(conn)
                now = utc_now_iso()
                cur.execute(
                    """
                    INSERT INTO users (
                        id, user_code, email, full_name, role, password_hash,
                        security_key_1_hash, security_key_2_hash, security_key_3_hash,
                        created_by_user_id, created_by_mode,
                        is_active, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, 'USER', ?, ?, ?, ?, NULL, 'SELF', 1, ?, ?)
                    """,
                    (
                        user_id,
                        user_code,
                        email,
                        full_name,
                        hash_password(password),
                        security_key_1_hash,
                        security_key_2_hash,
                        security_key_3_hash,
                        now,
                        now,
                    ),
                )
                write_audit(conn, user_id, "USER_REGISTER_SELF", "USER", user_id, {"email": email}, self)
                write_activity(conn, user_id, email, "CREATE", "USER", user_id, email)
                conn.commit()
                send_json(self, {"ok": True, "id": user_id, "user_code": user_code}, 201)
                return

            if path == "/api/auth/login":
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"email", "password", "admin_code", "system_mac"},
                    required_fields={"email", "password"},
                )
                email = str(payload.get("email", "")).strip().lower()
                password = str(payload.get("password", ""))
                admin_code = str(payload.get("admin_code", "")).strip()
                system_mac_input = str(payload.get("system_mac", "")).strip()
                if not email or not password:
                    send_json(self, {"message": "Email and password required"}, 400)
                    return

                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT id, user_code, email, full_name, role, password_hash, is_active, failed_login_attempts, locked_until
                    FROM users
                    WHERE email = ?
                    """,
                    (email,),
                )
                user = cur.fetchone()
                if user is None or int(user["is_active"]) != 1:
                    send_json(self, {"message": "Invalid credentials"}, 401)
                    return

                locked_until = user["locked_until"]
                if locked_until:
                    lock_time = datetime.fromisoformat(locked_until)
                    if lock_time > utc_now():
                        send_json(self, {"message": "Account locked temporarily"}, 423)
                        return

                if not verify_password(password, user["password_hash"]):
                    new_failed = int(user["failed_login_attempts"] or 0) + 1
                    lock_until_value = (utc_now() + timedelta(minutes=15)).isoformat() if new_failed >= 5 else None
                    cur.execute(
                        "UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?",
                        (new_failed, lock_until_value, utc_now_iso(), user["id"]),
                    )
                    conn.commit()
                    send_json(self, {"message": "Invalid credentials"}, 401)
                    return

                configured_admin_code = os.getenv("ADMIN_SECURITY_CODE", "").strip()
                if user["role"] == "ADMIN" and configured_admin_code and admin_code != configured_admin_code:
                    send_json(self, {"message": "Admin security code required"}, 401)
                    return

                normalized_mac = normalize_mac_address(system_mac_input)
                cur.execute(
                    "SELECT COUNT(1) AS count FROM login_system_controls WHERE user_id = ? AND is_active = 1",
                    (user["id"],),
                )
                control_count = int(cur.fetchone()["count"])
                if control_count > 0:
                    if not normalized_mac or not is_valid_mac_address(normalized_mac):
                        send_json(self, {"message": "Valid system MAC address required for this user"}, 401)
                        return
                    cur.execute(
                        """
                        SELECT id FROM login_system_controls
                        WHERE user_id = ? AND mac_address = ? AND is_active = 1
                        """,
                        (user["id"], normalized_mac),
                    )
                    matching_control = cur.fetchone()
                    if matching_control is None:
                        send_json(self, {"message": "System verification failed: MAC address not allowed"}, 401)
                        return

                now_iso = utc_now_iso()
                cur.execute(
                    """
                    UPDATE user_sessions
                    SET is_active = 0
                    WHERE user_id = ? AND is_active = 1 AND expires_at <= ?
                    """,
                    (user["id"], now_iso),
                )
                inactivity_cutoff = (utc_now() - timedelta(hours=SESSION_INACTIVITY_HOURS)).isoformat()
                cur.execute(
                    """
                    UPDATE user_sessions
                    SET is_active = 0
                    WHERE user_id = ? AND is_active = 1 AND last_seen_at < ?
                    """,
                    (user["id"], inactivity_cutoff),
                )

                cur.execute(
                    """
                    SELECT id, device_fingerprint, ip_address, user_agent, created_at, last_seen_at
                    FROM user_sessions
                    WHERE user_id = ? AND is_active = 1
                    ORDER BY last_seen_at DESC, created_at DESC
                    LIMIT 1
                    """,
                    (user["id"],),
                )
                existing_active_session = cur.fetchone()

                # Auto-logout previous sessions when logging in from a different system
                if existing_active_session is not None:
                    cur.execute(
                        "UPDATE user_sessions SET is_active = 0 WHERE user_id = ? AND is_active = 1",
                        (user["id"],),
                    )
                    write_audit(
                        conn,
                        user["id"],
                        "AUTH_AUTO_LOGOUT_PREVIOUS",
                        "USER",
                        user["id"],
                        {"previous_session_id": existing_active_session["id"]},
                        self,
                    )
                    write_activity(conn, user["id"], user["full_name"] or user["email"], "LOGOUT", "USER", user["id"], user["email"])

                session_id = secrets.token_hex(24)
                expires_at = (utc_now() + timedelta(days=SESSION_DAYS)).isoformat()
                device_fingerprint = get_device_fingerprint(self)

                cur.execute(
                    """
                    INSERT INTO user_sessions (
                        id, user_id, device_fingerprint, ip_address, user_agent,
                        is_active, created_at, last_seen_at, expires_at
                    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
                    """,
                    (
                        session_id,
                        user["id"],
                        device_fingerprint,
                        self.client_address[0] if self.client_address else "0.0.0.0",
                        self.headers.get("User-Agent", ""),
                        now_iso,
                        now_iso,
                        expires_at,
                    ),
                )

                cur.execute(
                    """
                    UPDATE users
                    SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (now_iso, now_iso, user["id"]),
                )

                write_audit(
                    conn,
                    user["id"],
                    "AUTH_LOGIN",
                    "USER",
                    user["id"],
                    {"session_id": session_id},
                    self,
                )
                write_activity(conn, user["id"], user["full_name"] or user["email"], "LOGIN", "USER", user["id"], user["email"])
                conn.commit()

                body = {
                    "user": {
                        "id": user["id"],
                        "user_code": user["user_code"],
                        "email": user["email"],
                        "full_name": user["full_name"],
                        "role": user["role"],
                    },
                }
                csrf_token = secrets.token_hex(24)
                body["csrf_token"] = csrf_token
                raw = json.dumps(body).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(raw)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Set-Cookie", build_set_cookie_value("session_id", session_id, http_only=True))
                self.send_header("Set-Cookie", build_set_cookie_value(CSRF_COOKIE_NAME, csrf_token, http_only=False))
                self.end_headers()
                self.wfile.write(raw)
                return

            if path == "/api/auth/forgot-password":
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"email", "security_key_1", "security_key_2", "security_key_3", "new_password", "confirm_password"},
                    required_fields={"email", "security_key_1", "security_key_2", "security_key_3", "new_password", "confirm_password"},
                )
                email = str(payload.get("email", "")).strip().lower()
                security_keys = parse_security_keys(payload)
                new_password = str(payload.get("new_password", ""))
                confirm_password = str(payload.get("confirm_password", ""))

                if not is_valid_email(email):
                    send_json(self, {"message": "Valid email is required"}, 400)
                    return
                security_error = validate_security_keys(security_keys, required=True)
                if security_error:
                    send_json(self, {"message": security_error}, 400)
                    return
                if not new_password:
                    send_json(self, {"message": "New password is required"}, 400)
                    return
                if new_password != confirm_password:
                    send_json(self, {"message": "New password and confirm password must match"}, 400)
                    return
                password_error = validate_password(new_password)
                if password_error:
                    send_json(self, {"message": password_error}, 400)
                    return

                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT id, security_key_1_hash, security_key_2_hash, security_key_3_hash, failed_login_attempts, locked_until
                    FROM users
                    WHERE email = ?
                    """,
                    (email,),
                )
                user = cur.fetchone()
                if user is None:
                    # Do not reveal whether the email is registered (prevent user enumeration)
                    send_json(self, {"message": "Invalid email or security keys"}, 401)
                    return

                locked_until = user["locked_until"]
                if locked_until:
                    lock_time = datetime.fromisoformat(locked_until)
                    if lock_time > utc_now():
                        send_json(self, {"message": "Account locked temporarily"}, 423)
                        return

                valid_keys = all(
                    [
                        verify_security_key(security_keys[0], user["security_key_1_hash"]),
                        verify_security_key(security_keys[1], user["security_key_2_hash"]),
                        verify_security_key(security_keys[2], user["security_key_3_hash"]),
                    ]
                )
                if not valid_keys:
                    new_failed = int(user["failed_login_attempts"] or 0) + 1
                    lock_until_value = (
                        (utc_now() + timedelta(minutes=FORGOT_PASSWORD_LOCK_MINUTES)).isoformat()
                        if new_failed >= FORGOT_PASSWORD_MAX_ATTEMPTS
                        else None
                    )
                    cur.execute(
                        "UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?",
                        (new_failed, lock_until_value, utc_now_iso(), user["id"]),
                    )
                    conn.commit()
                    send_json(self, {"message": "Invalid email or security keys"}, 401)
                    return

                now = utc_now_iso()
                cur.execute(
                    """
                    UPDATE users
                    SET password_hash = ?, is_active = 1, failed_login_attempts = 0, locked_until = NULL, updated_at = ?
                    WHERE id = ?
                    """,
                    (hash_password(new_password), now, user["id"]),
                )
                cur.execute("UPDATE user_sessions SET is_active = 0 WHERE user_id = ?", (user["id"],))
                write_audit(
                    conn,
                    user["id"],
                    "AUTH_FORGOT_PASSWORD_RESET",
                    "USER",
                    user["id"],
                    {"email": email, "password_changed": True},
                    self,
                )
                write_activity(conn, user["id"], email, "UPDATE", "USER", user["id"], email)
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/super-admin/dc-books/link-empty":
                session_user = get_current_user(self, conn)
                if session_user is None:
                    send_json(self, {"message": "Unauthorized"}, 401)
                    return
                if not validate_csrf(self):
                    send_json(self, {"message": "CSRF validation failed"}, 403)
                    return
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(payload, allowed_fields={"transfer_id"}, required_fields={"transfer_id"})
                transfer_id = str(payload.get("transfer_id", "")).strip()
                if not transfer_id:
                    send_json(self, {"message": "transfer_id is required"}, 400)
                    return

                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT
                        t.id,
                        t.item_id,
                        t.dc_book_id,
                        t.dc_number,
                        t.linked_taking_at,
                        t.reason,
                        i.item_code,
                        i.fill_state,
                        i.status,
                        i.current_location
                    FROM item_transfers t
                    LEFT JOIN items i ON i.id = t.item_id
                    WHERE t.id = ?
                    """,
                    (transfer_id,),
                )
                transfer_row = cur.fetchone()
                if transfer_row is None:
                    send_json(self, {"message": "Book record not found"}, 404)
                    return
                if not str(transfer_row["dc_book_id"] or "").strip() or transfer_row["dc_number"] is None:
                    send_json(self, {"message": "Selected record is not linked to a DC book"}, 400)
                    return
                if str(transfer_row["reason"] or "").strip().upper().startswith("TRANSITION_GIVING") is False:
                    send_json(self, {"message": "Only open GIVING book records can be edited"}, 400)
                    return
                if transfer_row["linked_taking_at"]:
                    send_json(self, {"message": "This book record is already linked"}, 409)
                    return
                if str(transfer_row["fill_state"] or "").strip().upper() != "EMPTY":
                    send_json(self, {"message": "Only EMPTY-state items can be linked to a book record"}, 400)
                    return

                cur.execute(
                    """
                    SELECT id, dc_book_id, dc_number, transferred_at
                    FROM item_transfers
                    WHERE item_id = ?
                      AND reason LIKE 'TRANSITION_GIVING%'
                      AND linked_taking_at IS NULL
                    ORDER BY transferred_at ASC
                    LIMIT 1
                    """,
                    (transfer_row["item_id"],),
                )
                oldest_open = cur.fetchone()
                if oldest_open is None:
                    send_json(self, {"message": "No open cycle found for this item"}, 409)
                    return
                if str(oldest_open["id"] or "") != transfer_id:
                    oldest_ref = (
                        f"{oldest_open['dc_book_id']}-{int(oldest_open['dc_number'] or 0)}"
                        if oldest_open["dc_book_id"] and oldest_open["dc_number"] is not None
                        else str(oldest_open["id"] or "")
                    )
                    send_json(
                        self,
                        {
                            "message": (
                                "Date priority rule: oldest open dispatch must be linked first "
                                f"({oldest_ref}, created {oldest_open['transferred_at']})"
                            )
                        },
                        409,
                    )
                    return

                now_iso = utc_now_iso()
                cur.execute(
                    """
                    UPDATE item_transfers
                    SET linked_taking_at = ?,
                        linked_taking_by = ?,
                        linked_taking_source_type = 'BOOK_EDIT',
                        linked_taking_to_status = ?,
                        linked_taking_to_location = ?,
                        linked_taking_fill_state = 'EMPTY'
                    WHERE id = ? AND linked_taking_at IS NULL
                    """,
                    (
                        now_iso,
                        session_user["id"],
                        str(transfer_row["status"] or "").strip() or None,
                        str(transfer_row["current_location"] or "").strip() or None,
                        transfer_id,
                    ),
                )
                if cur.rowcount != 1:
                    send_json(self, {"message": "Book record link conflict. Please retry."}, 409)
                    return

                write_audit(
                    conn,
                    session_user["id"],
                    "DC_BOOK_LINK_EMPTY",
                    "DC_BOOK",
                    str(transfer_row["dc_book_id"] or ""),
                    {
                        "transfer_id": transfer_id,
                        "dc_book_id": transfer_row["dc_book_id"],
                        "dc_number": int(transfer_row["dc_number"] or 0),
                        "item_id": transfer_row["item_id"],
                        "item_code": transfer_row["item_code"],
                    },
                    self,
                )
                write_activity(
                    conn,
                    session_user["id"],
                    session_user["full_name"] or session_user["email"],
                    "UPDATE",
                    "DC_BOOK",
                    str(transfer_row["dc_book_id"] or ""),
                    transfer_id,
                )
                conn.commit()
                send_json(self, {"ok": True})
                return

            session_user = get_current_user(self, conn)
            if session_user is None:
                send_json(self, {"message": "Unauthorized"}, 401)
                return

            if not validate_csrf(self):
                send_json(self, {"message": "CSRF validation failed"}, 403)
                return

            if path == "/api/companies/upsert":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"company_id", "company_name", "contact_info", "is_active"},
                    required_fields={"company_name"},
                )
                company_id = str(payload.get("company_id", "")).strip()
                company_name = str(payload.get("company_name", "")).strip()
                contact_info = str(payload.get("contact_info", "")).strip()
                is_active_raw = payload.get("is_active", True)
                if len(company_name) < 2 or len(company_name) > 120:
                    send_json(self, {"message": "company_name must be between 2 and 120 characters"}, 400)
                    return
                if len(contact_info) > 240:
                    send_json(self, {"message": "contact_info must be at most 240 characters"}, 400)
                    return
                if not isinstance(is_active_raw, bool):
                    send_json(self, {"message": "is_active must be true or false"}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id FROM companies WHERE LOWER(company_name) = LOWER(?)", (company_name,))
                existing_by_name = cur.fetchone()
                if existing_by_name is not None and company_id and existing_by_name["id"] != company_id:
                    send_json(self, {"message": "Company name already exists"}, 409)
                    return
                if existing_by_name is not None and not company_id:
                    send_json(self, {"message": "Company name already exists"}, 409)
                    return

                now_iso = utc_now_iso()
                if company_id:
                    cur.execute("SELECT id, company_name FROM companies WHERE id = ?", (company_id,))
                    existing_company = cur.fetchone()
                    if existing_company is None:
                        send_json(self, {"message": "Company not found"}, 404)
                        return
                    existing_company_name = str(existing_company["company_name"] or "").strip()
                    if company_name != existing_company_name:
                        send_json(self, {"message": "Company name cannot be modified after initial setup"}, 400)
                        return
                    cur.execute(
                        """
                        UPDATE companies
                        SET company_name = ?, contact_info = ?, is_active = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (company_name, contact_info or None, 1 if is_active_raw else 0, now_iso, company_id),
                    )
                    action_name = "UPDATE"
                else:
                    company_id = secrets.token_hex(16)
                    cur.execute(
                        """
                        INSERT INTO companies (id, company_name, contact_info, is_active, created_by_user_id, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (company_id, company_name, contact_info or None, 1 if is_active_raw else 0, session_user["id"], now_iso, now_iso),
                    )
                    action_name = "CREATE"

                write_audit(
                    conn,
                    session_user["id"],
                    "COMPANY_UPSERT",
                    "COMPANY",
                    company_id,
                    {"company_name": company_name, "is_active": bool(is_active_raw)},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], action_name, "COMPANY", company_id, company_name)
                conn.commit()
                send_json(self, {"ok": True, "id": company_id})
                return

            if path == "/api/company-locations/upsert":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"location_id", "company_id", "location_name", "address_line", "is_active"},
                    required_fields={"company_id", "location_name"},
                )
                location_id = str(payload.get("location_id", "")).strip()
                company_id = str(payload.get("company_id", "")).strip()
                location_name = str(payload.get("location_name", "")).strip()
                address_line = str(payload.get("address_line", "")).strip()
                is_active_raw = payload.get("is_active", True)
                if not company_id:
                    send_json(self, {"message": "company_id is required"}, 400)
                    return
                if len(location_name) < 2 or len(location_name) > 120:
                    send_json(self, {"message": "location_name must be between 2 and 120 characters"}, 400)
                    return
                if len(address_line) > 240:
                    send_json(self, {"message": "address_line must be at most 240 characters"}, 400)
                    return
                if not isinstance(is_active_raw, bool):
                    send_json(self, {"message": "is_active must be true or false"}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id FROM companies WHERE id = ?", (company_id,))
                if cur.fetchone() is None:
                    send_json(self, {"message": "Company not found"}, 404)
                    return

                cur.execute(
                    "SELECT id FROM company_locations WHERE company_id = ? AND LOWER(location_name) = LOWER(?)",
                    (company_id, location_name),
                )
                existing_by_name = cur.fetchone()
                if existing_by_name is not None and location_id and existing_by_name["id"] != location_id:
                    send_json(self, {"message": "Location name already exists for this company"}, 409)
                    return
                if existing_by_name is not None and not location_id:
                    send_json(self, {"message": "Location name already exists for this company"}, 409)
                    return

                now_iso = utc_now_iso()
                if location_id:
                    cur.execute("SELECT id FROM company_locations WHERE id = ?", (location_id,))
                    if cur.fetchone() is None:
                        send_json(self, {"message": "Location not found"}, 404)
                        return
                    cur.execute(
                        """
                        UPDATE company_locations
                        SET company_id = ?, location_name = ?, address_line = ?, is_active = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (company_id, location_name, address_line or None, 1 if is_active_raw else 0, now_iso, location_id),
                    )
                    action_name = "UPDATE"
                else:
                    location_id = secrets.token_hex(16)
                    cur.execute(
                        """
                        INSERT INTO company_locations (id, company_id, location_name, address_line, is_active, created_by_user_id, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (location_id, company_id, location_name, address_line or None, 1 if is_active_raw else 0, session_user["id"], now_iso, now_iso),
                    )
                    action_name = "CREATE"

                write_audit(
                    conn,
                    session_user["id"],
                    "COMPANY_LOCATION_UPSERT",
                    "COMPANY_LOCATION",
                    location_id,
                    {"company_id": company_id, "location_name": location_name, "is_active": bool(is_active_raw)},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], action_name, "COMPANY_LOCATION", location_id, location_name)
                conn.commit()
                send_json(self, {"ok": True, "id": location_id})
                return

            if path in {
                "/api/users/register",
                "/api/customer-locations",
                "/api/customer-locations/upsert",
                "/api/filler-locations",
                "/api/filler-locations/upsert",
            }:
                if path == "/api/customer-locations":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute("SELECT cl.id, cl.user_id, u.full_name AS customer_name, u.user_code, cl.location_name, cl.address_line, cl.is_active, cl.created_at, cl.updated_at FROM customer_locations cl LEFT JOIN users u ON u.id=cl.user_id ORDER BY u.full_name ASC, cl.location_name ASC LIMIT 1000")
                    rows = cur.fetchall()
                    send_json(self, {"data": [{"id": r["id"], "user_id": r["user_id"], "customer_name": r["customer_name"], "user_code": r["user_code"], "location_name": r["location_name"], "address_line": r["address_line"], "is_active": bool(r["is_active"]), "created_at": r["created_at"], "updated_at": r["updated_at"]} for r in rows]})
                    return

                if path == "/api/customer-locations/upsert":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    payload = parse_json_body(self)
                    validate_payload_fields(payload, allowed_fields={"loc_id", "user_id", "location_name", "address_line", "is_active"}, required_fields={"user_id", "location_name"})
                    loc_id = str(payload.get("loc_id", "")).strip()
                    user_id = str(payload.get("user_id", "")).strip()
                    location_name = str(payload.get("location_name", "")).strip()
                    address_line = str(payload.get("address_line", "")).strip()
                    is_active_raw = payload.get("is_active", True)
                    if not user_id:
                        send_json(self, {"message": "user_id is required"}, 400)
                        return
                    if len(location_name) < 2 or len(location_name) > 120:
                        send_json(self, {"message": "location_name must be 2-120 characters"}, 400)
                        return
                    if not isinstance(is_active_raw, bool):
                        send_json(self, {"message": "is_active must be true or false"}, 400)
                        return
                    cur = conn.cursor()
                    cur.execute("SELECT id FROM users WHERE id=?", (user_id,))
                    if cur.fetchone() is None:
                        send_json(self, {"message": "User not found"}, 404)
                        return
                    cur.execute("SELECT id FROM customer_locations WHERE LOWER(user_id)=LOWER(?) AND LOWER(location_name)=LOWER(?)", (user_id, location_name))
                    existing = cur.fetchone()
                    if existing and loc_id and existing["id"] != loc_id:
                        send_json(self, {"message": "Location already exists for this user"}, 409)
                        return
                    if existing and not loc_id:
                        send_json(self, {"message": "Location already exists for this user"}, 409)
                        return
                    now_iso = utc_now_iso()
                    if loc_id:
                        cur.execute("SELECT id FROM customer_locations WHERE id=?", (loc_id,))
                        if cur.fetchone() is None:
                            send_json(self, {"message": "Customer location not found"}, 404)
                            return
                        cur.execute("UPDATE customer_locations SET user_id=?,location_name=?,address_line=?,is_active=?,updated_at=? WHERE id=?",
                                    (user_id, location_name, address_line or None, 1 if is_active_raw else 0, now_iso, loc_id))
                    else:
                        loc_id = secrets.token_hex(16)
                        cur.execute("INSERT INTO customer_locations (id,user_id,location_name,address_line,is_active,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
                                    (loc_id, user_id, location_name, address_line or None, 1 if is_active_raw else 0, session_user["id"], now_iso, now_iso))
                    conn.commit()
                    send_json(self, {"ok": True, "id": loc_id})
                    return

                if path == "/api/filler-locations":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    cur = conn.cursor()
                    cur.execute("SELECT fl.id, fl.filler_user_id, u.full_name AS filler_name, u.user_code, fl.location_name, fl.address_line, fl.is_active, fl.created_at, fl.updated_at FROM filler_locations fl LEFT JOIN users u ON u.id=fl.filler_user_id ORDER BY u.full_name ASC, fl.location_name ASC LIMIT 1000")
                    rows = cur.fetchall()
                    send_json(self, {"data": [{"id": r["id"], "filler_user_id": r["filler_user_id"], "filler_name": r["filler_name"], "user_code": r["user_code"], "location_name": r["location_name"], "address_line": r["address_line"], "is_active": bool(r["is_active"]), "created_at": r["created_at"], "updated_at": r["updated_at"]} for r in rows]})
                    return

                if path == "/api/filler-locations/upsert":
                    if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    payload = parse_json_body(self)
                    validate_payload_fields(payload, allowed_fields={"loc_id", "filler_user_id", "location_name", "address_line", "is_active"}, required_fields={"filler_user_id", "location_name"})
                    loc_id = str(payload.get("loc_id", "")).strip()
                    filler_user_id = str(payload.get("filler_user_id", "")).strip()
                    location_name = str(payload.get("location_name", "")).strip()
                    address_line = str(payload.get("address_line", "")).strip()
                    is_active_raw = payload.get("is_active", True)
                    if not filler_user_id:
                        send_json(self, {"message": "filler_user_id is required"}, 400)
                        return
                    if len(location_name) < 2 or len(location_name) > 120:
                        send_json(self, {"message": "location_name must be 2-120 characters"}, 400)
                        return
                    if not isinstance(is_active_raw, bool):
                        send_json(self, {"message": "is_active must be true or false"}, 400)
                        return
                    cur = conn.cursor()
                    cur.execute("SELECT id, role FROM users WHERE id=? AND is_active=1", (filler_user_id,))
                    filler_user = cur.fetchone()
                    if filler_user is None or filler_user["role"] != "FILLER":
                        send_json(self, {"message": "Filler user not found or not FILLER role"}, 404)
                        return
                    cur.execute("SELECT id FROM filler_locations WHERE filler_user_id=? AND LOWER(location_name)=LOWER(?)", (filler_user_id, location_name))
                    existing = cur.fetchone()
                    if existing and loc_id and existing["id"] != loc_id:
                        send_json(self, {"message": "Location already exists for this filler"}, 409)
                        return
                    if existing and not loc_id:
                        send_json(self, {"message": "Location already exists for this filler"}, 409)
                        return
                    now_iso = utc_now_iso()
                    if loc_id:
                        cur.execute("SELECT id FROM filler_locations WHERE id=?", (loc_id,))
                        if cur.fetchone() is None:
                            send_json(self, {"message": "Filler location not found"}, 404)
                            return
                        cur.execute("UPDATE filler_locations SET filler_user_id=?,location_name=?,address_line=?,is_active=?,updated_at=? WHERE id=?",
                                    (filler_user_id, location_name, address_line or None, 1 if is_active_raw else 0, now_iso, loc_id))
                    else:
                        loc_id = secrets.token_hex(16)
                        cur.execute("INSERT INTO filler_locations (id,filler_user_id,location_name,address_line,is_active,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
                                    (loc_id, filler_user_id, location_name, address_line or None, 1 if is_active_raw else 0, session_user["id"], now_iso, now_iso))
                    conn.commit()
                    send_json(self, {"ok": True, "id": loc_id})
                    return

                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"email", "full_name", "password", "role", "security_key_1", "security_key_2", "security_key_3", "reject_empty_items", "reject_full_items"},
                    required_fields={"email", "full_name", "password", "role"},
                )
                email = str(payload.get("email", "")).strip().lower()
                full_name = str(payload.get("full_name", "")).strip()
                password = str(payload.get("password", ""))
                role = normalize_role_value(payload.get("role", "CUSTOMER"))
                reject_empty_items_raw = payload.get("reject_empty_items", False)
                reject_full_items_raw = payload.get("reject_full_items", False)
                security_keys = parse_security_keys(payload)

                if not isinstance(reject_empty_items_raw, bool):
                    send_json(self, {"message": "reject_empty_items must be true or false"}, 400)
                    return
                if not isinstance(reject_full_items_raw, bool):
                    send_json(self, {"message": "reject_full_items must be true or false"}, 400)
                    return

                if not is_valid_email(email):
                    send_json(self, {"message": "Valid email is required"}, 400)
                    return
                if len(full_name) < 2 or len(full_name) > 120:
                    send_json(self, {"message": "Full name must be between 2 and 120 characters"}, 400)
                    return
                if role not in ALLOWED_ROLES:
                    send_json(self, {"message": "Invalid role"}, 400)
                    return
                if role == "SUPER_ADMIN":
                    send_json(self, {"message": "Super Admin role is fixed and cannot be created"}, 400)
                    return
                password_error = validate_password(password)
                if password_error:
                    send_json(self, {"message": password_error}, 400)
                    return
                security_error = validate_security_keys(security_keys, required=False)
                if security_error:
                    send_json(self, {"message": security_error}, 400)
                    return

                update_security_keys = all(security_keys)
                security_key_1_hash = hash_security_key(security_keys[0]) if update_security_keys else None
                security_key_2_hash = hash_security_key(security_keys[1]) if update_security_keys else None
                security_key_3_hash = hash_security_key(security_keys[2]) if update_security_keys else None

                cur = conn.cursor()
                cur.execute("SELECT id FROM users WHERE email = ?", (email,))
                if cur.fetchone() is not None:
                    send_json(self, {"message": "User already exists"}, 409)
                    return

                user_id = secrets.token_hex(16)
                user_code = generate_next_user_code(conn)
                now = utc_now_iso()
                cur.execute(
                    """
                    INSERT INTO users (
                        id, user_code, email, full_name, role, password_hash,
                        security_key_1_hash, security_key_2_hash, security_key_3_hash,
                        created_by_user_id, created_by_mode,
                        is_active, reject_empty_items, reject_full_items, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ADMIN', 1, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        user_code,
                        email,
                        full_name,
                        role,
                        hash_password(password),
                        security_key_1_hash,
                        security_key_2_hash,
                        security_key_3_hash,
                        session_user["id"],
                        1 if reject_empty_items_raw else 0,
                        1 if reject_full_items_raw else 0,
                        now,
                        now,
                    ),
                )
                write_audit(
                    conn,
                    session_user["id"],
                    "USER_REGISTER_ADMIN",
                    "USER",
                    user_id,
                    {
                        "email": email,
                        "role": role,
                        "reject_empty_items": reject_empty_items_raw,
                        "reject_full_items": reject_full_items_raw,
                        "created_by": session_user["id"],
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "CREATE", "USER", user_id, email)
                conn.commit()
                send_json(self, {"ok": True, "id": user_id, "user_code": user_code}, 201)
                return

            if path == "/api/profile/update":
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"email", "full_name", "current_password", "new_password", "security_key_1", "security_key_2", "security_key_3"},
                    required_fields={"email", "full_name", "current_password"},
                )
                email = str(payload.get("email", "")).strip().lower()
                full_name = str(payload.get("full_name", "")).strip()
                current_password = str(payload.get("current_password", ""))
                new_password = str(payload.get("new_password", ""))
                security_keys = parse_security_keys(payload)

                if not is_valid_email(email):
                    send_json(self, {"message": "Valid email is required"}, 400)
                    return
                if len(full_name) < 2 or len(full_name) > 120:
                    send_json(self, {"message": "Full name must be between 2 and 120 characters"}, 400)
                    return
                if not current_password:
                    send_json(self, {"message": "Current password is required"}, 400)
                    return
                if new_password:
                    password_error = validate_password(new_password)
                    if password_error:
                        send_json(self, {"message": password_error}, 400)
                        return
                security_error = validate_security_keys(security_keys, required=False)
                if security_error:
                    send_json(self, {"message": security_error}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id, email, full_name, password_hash FROM users WHERE id = ?", (session_user["id"],))
                db_user = cur.fetchone()
                if db_user is None:
                    send_json(self, {"message": "User not found"}, 404)
                    return

                if not verify_password(current_password, db_user["password_hash"]):
                    send_json(self, {"message": "Current password is incorrect"}, 401)
                    return

                cur.execute("SELECT id FROM users WHERE email = ? AND id != ?", (email, session_user["id"]))
                if cur.fetchone() is not None:
                    send_json(self, {"message": "Email already exists"}, 409)
                    return

                now = utc_now_iso()
                new_hash = db_user["password_hash"]
                if new_password:
                    new_hash = hash_password(new_password)

                update_security_keys = bool(security_keys[0] and security_keys[1] and security_keys[2])
                security_key_1_hash = hash_security_key(security_keys[0]) if update_security_keys else None
                security_key_2_hash = hash_security_key(security_keys[1]) if update_security_keys else None
                security_key_3_hash = hash_security_key(security_keys[2]) if update_security_keys else None

                if update_security_keys:
                    cur.execute(
                        """
                        UPDATE users
                        SET email = ?, full_name = ?, password_hash = ?, security_key_1_hash = ?, security_key_2_hash = ?, security_key_3_hash = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (email, full_name, new_hash, security_key_1_hash, security_key_2_hash, security_key_3_hash, now, session_user["id"]),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE users
                        SET email = ?, full_name = ?, password_hash = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (email, full_name, new_hash, now, session_user["id"]),
                    )

                write_audit(
                    conn,
                    session_user["id"],
                    "PROFILE_UPDATE",
                    "USER",
                    session_user["id"],
                    {
                        "before": {
                            "email": db_user["email"],
                            "full_name": db_user["full_name"],
                        },
                        "after": {
                            "email": email,
                            "full_name": full_name,
                            "password_changed": bool(new_password),
                            "security_keys_changed": update_security_keys,
                        },
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "USER", session_user["id"], email)
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/admin/password-reset":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                if session_user["role"] == "SUPER_ADMIN":
                    send_json(self, {"message": "Super Admin password reset is available only in Profile page"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"current_password", "new_password", "confirm_password"},
                    required_fields={"current_password", "new_password", "confirm_password"},
                )
                current_password = str(payload.get("current_password", ""))
                new_password = str(payload.get("new_password", ""))
                confirm_password = str(payload.get("confirm_password", ""))

                if not current_password:
                    send_json(self, {"message": "Current password is required"}, 400)
                    return
                if not new_password:
                    send_json(self, {"message": "New password is required"}, 400)
                    return
                if new_password != confirm_password:
                    send_json(self, {"message": "New password and confirm password must match"}, 400)
                    return
                password_error = validate_password(new_password)
                if password_error:
                    send_json(self, {"message": password_error}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id, password_hash FROM users WHERE id = ?", (session_user["id"],))
                db_user = cur.fetchone()
                if db_user is None:
                    send_json(self, {"message": "User not found"}, 404)
                    return

                if not verify_password(current_password, db_user["password_hash"]):
                    send_json(self, {"message": "Current password is incorrect"}, 401)
                    return

                new_hash = hash_password(new_password)
                now = utc_now_iso()
                cur.execute(
                    """
                    UPDATE users
                    SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = ?
                    WHERE id = ?
                    """,
                    (new_hash, now, session_user["id"]),
                )

                write_audit(
                    conn,
                    session_user["id"],
                    "ADMIN_PASSWORD_RESET",
                    "USER",
                    session_user["id"],
                    {
                        "password_changed": True,
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "USER", session_user["id"], session_user["email"])
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/notifications/requirement":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"to_user_id", "item_id", "message"},
                    required_fields={"to_user_id", "message"},
                )
                to_user_id = str(payload.get("to_user_id", "")).strip()
                item_id = str(payload.get("item_id", "")).strip()
                message = str(payload.get("message", "")).strip()

                if not to_user_id:
                    send_json(self, {"message": "to_user_id is required"}, 400)
                    return
                if len(message) < 3 or len(message) > 500:
                    send_json(self, {"message": "Requirement message must be between 3 and 500 characters"}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id, full_name, role FROM users WHERE id = ?", (to_user_id,))
                target_user = cur.fetchone()
                if target_user is None:
                    send_json(self, {"message": "Target user not found"}, 404)
                    return

                item_code = None
                item_title = None
                if item_id:
                    cur.execute("SELECT id, item_code, title FROM items WHERE id = ?", (item_id,))
                    item = cur.fetchone()
                    if item is None:
                        send_json(self, {"message": "Item not found"}, 404)
                        return
                    item_code = item["item_code"]
                    item_title = item["title"]

                create_notification(
                    conn,
                    notification_type="REQUIREMENT",
                    title="Item Requirement",
                    message=message,
                    delivery_no=None,
                    from_user_id=session_user["id"],
                    from_user_name=session_user["full_name"],
                    to_user_id=target_user["id"],
                    to_user_name=target_user["full_name"],
                    to_role=target_user["role"],
                    item_id=item_id or None,
                    item_code=item_code,
                    item_title=item_title,
                    meta={"source": "admin_requirement"},
                )
                write_audit(
                    conn,
                    session_user["id"],
                    "NOTIFICATION_REQUIREMENT_CREATE",
                    "NOTIFICATION",
                    to_user_id,
                    {
                        "to_user_id": to_user_id,
                        "item_id": item_id or None,
                        "message": message,
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "CREATE", "NOTIFICATION", to_user_id, message[:80])
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/notifications/mark-read":
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"mark_all", "notification_id"},
                )
                try:
                    mark_all = parse_boolean_field(payload, "mark_all", default=False)
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return
                notification_id = str(payload.get("notification_id", "")).strip()

                cur = conn.cursor()
                if mark_all:
                    if role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        cur.execute(
                            """
                            UPDATE notifications
                            SET is_read = 1
                            WHERE (to_user_id = ? OR to_role IN ('ADMIN', 'SUPER_ADMIN')) AND is_read = 0
                            """,
                            (session_user["id"],),
                        )
                    else:
                        cur.execute(
                            "UPDATE notifications SET is_read = 1 WHERE to_user_id = ? AND is_read = 0",
                            (session_user["id"],),
                        )
                    conn.commit()
                    send_json(self, {"ok": True})
                    return

                if not notification_id:
                    send_json(self, {"message": "notification_id is required"}, 400)
                    return

                cur.execute("SELECT id, to_user_id, to_role FROM notifications WHERE id = ?", (notification_id,))
                notification = cur.fetchone()
                if notification is None:
                    send_json(self, {"message": "Notification not found"}, 404)
                    return

                can_mark = notification["to_user_id"] == session_user["id"]
                if not can_mark and role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    can_mark = notification["to_role"] in {"ADMIN", "SUPER_ADMIN"}

                if not can_mark:
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                cur.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notification_id,))
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/orders/create-or-update":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN", "CUSTOMER", "FILLER"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"order_id", "item_id", "customer_name", "customer_contact", "quantity", "notes"},
                    required_fields={"customer_name"},
                )
                order_id = str(payload.get("order_id", "")).strip()
                item_id = str(payload.get("item_id", "")).strip()
                customer_name = str(payload.get("customer_name", "")).strip()
                customer_contact = str(payload.get("customer_contact", "")).strip()
                quantity_raw = payload.get("quantity", 1)
                notes = str(payload.get("notes", "")).strip()

                if len(customer_name) < 2 or len(customer_name) > 120:
                    send_json(self, {"message": "Customer name must be between 2 and 120 characters"}, 400)
                    return
                if customer_contact and len(customer_contact) > 100:
                    send_json(self, {"message": "Customer contact must be at most 100 characters"}, 400)
                    return
                try:
                    quantity = int(quantity_raw)
                except Exception:
                    send_json(self, {"message": "Quantity must be a valid integer"}, 400)
                    return
                if quantity <= 0 or quantity > 100000:
                    send_json(self, {"message": "Quantity must be between 1 and 100000"}, 400)
                    return
                if len(notes) > 1000:
                    send_json(self, {"message": "Notes must be at most 1000 characters"}, 400)
                    return

                cur = conn.cursor()
                item_code = None
                item_title = None
                if item_id:
                    cur.execute("SELECT id, item_code, title FROM items WHERE id = ?", (item_id,))
                    item = cur.fetchone()
                    if item is None:
                        send_json(self, {"message": "Item not found"}, 404)
                        return
                    item_code = item["item_code"]
                    item_title = item["title"]

                now = utc_now_iso()
                if order_id:
                    cur.execute("SELECT * FROM customer_orders WHERE id = ?", (order_id,))
                    existing = cur.fetchone()
                    if existing is None:
                        send_json(self, {"message": "Order not found"}, 404)
                        return
                    editable = role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}) or existing["created_by_user_id"] == session_user["id"]
                    if not editable:
                        send_json(self, {"message": "Forbidden"}, 403)
                        return
                    if existing["status"] not in {"PENDING_ADMIN", "REJECTED"} and not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                        send_json(self, {"message": "Only pending/rejected orders can be updated"}, 400)
                        return

                    cur.execute(
                        """
                        UPDATE customer_orders
                        SET item_id = ?, item_code = ?, item_title = ?, customer_name = ?, customer_contact = ?,
                            quantity = ?, notes = ?, status = 'PENDING_ADMIN', updated_at = ?,
                            approved_by_user_id = NULL, approved_by_user_name = NULL,
                            delivery_user_id = NULL, delivery_user_name = NULL,
                            delivered_by_user_id = NULL, delivered_by_user_name = NULL, delivered_at = NULL
                        WHERE id = ?
                        """,
                        (
                            item_id or None,
                            item_code,
                            item_title,
                            customer_name,
                            customer_contact or None,
                            quantity,
                            notes or None,
                            now,
                            order_id,
                        ),
                    )
                    action_name = "ORDER_UPDATE"
                else:
                    order_id = secrets.token_hex(16)
                    cur.execute(
                        """
                        INSERT INTO customer_orders (
                            id, item_id, item_code, item_title, customer_name, customer_contact, quantity, notes,
                            status, created_by_user_id, created_by_user_name, created_at, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_ADMIN', ?, ?, ?, ?)
                        """,
                        (
                            order_id,
                            item_id or None,
                            item_code,
                            item_title,
                            customer_name,
                            customer_contact or None,
                            quantity,
                            notes or None,
                            session_user["id"],
                            session_user["full_name"],
                            now,
                            now,
                        ),
                    )
                    action_name = "ORDER_CREATE"

                notify_admin_roles(
                    conn,
                    notification_type="ORDER_SUBMITTED",
                    title="Customer Order Submitted",
                    message=f"{session_user['full_name']} submitted an order for customer {customer_name}",
                    delivery_no=None,
                    from_user_id=session_user["id"],
                    from_user_name=session_user["full_name"],
                    item_id=item_id or None,
                    item_code=item_code,
                    item_title=item_title,
                    meta={"order_id": order_id, "customer_name": customer_name},
                )
                write_audit(
                    conn,
                    session_user["id"],
                    action_name,
                    "ORDER",
                    order_id,
                    {
                        "item_id": item_id or None,
                        "item_code": item_code,
                        "customer_name": customer_name,
                        "quantity": quantity,
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "CREATE" if action_name == "ORDER_CREATE" else "UPDATE", "ORDER", order_id, customer_name)
                conn.commit()
                send_json(self, {"ok": True, "id": order_id})
                return

            if path == "/api/orders/approve":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"order_id", "approved", "delivery_user_id", "admin_note"},
                    required_fields={"order_id"},
                )
                order_id = str(payload.get("order_id", "")).strip()
                try:
                    approved = parse_boolean_field(payload, "approved", default=True)
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return
                delivery_user_id = str(payload.get("delivery_user_id", "")).strip()
                admin_note = str(payload.get("admin_note", "")).strip()

                if not order_id:
                    send_json(self, {"message": "order_id is required"}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT * FROM customer_orders WHERE id = ?", (order_id,))
                order = cur.fetchone()
                if order is None:
                    send_json(self, {"message": "Order not found"}, 404)
                    return

                now = utc_now_iso()
                if approved:
                    if order["status"] != "PENDING_ADMIN":
                        send_json(self, {"message": "Only orders in PENDING_ADMIN state can be approved"}, 400)
                        return
                    if not delivery_user_id:
                        send_json(self, {"message": "delivery_user_id is required for approval"}, 400)
                        return
                    cur.execute("SELECT id, full_name, role FROM users WHERE id = ? AND is_active = 1", (delivery_user_id,))
                    delivery_user = cur.fetchone()
                    if delivery_user is None:
                        send_json(self, {"message": "Delivery user not found"}, 404)
                        return
                    if delivery_user["role"] not in {"DELIVERY_PARTNER", "EXTERNAL_PARTNER", "ADMIN", "SUPER_ADMIN"}:
                        send_json(self, {"message": "Delivery user must have DELIVERY_PARTNER, EXTERNAL_PARTNER, ADMIN, or SUPER_ADMIN role"}, 400)
                        return

                    cur.execute(
                        """
                        UPDATE customer_orders
                        SET status = 'PENDING_DELIVERY', approved_by_user_id = ?, approved_by_user_name = ?,
                            delivery_user_id = ?, delivery_user_name = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (session_user["id"], session_user["full_name"], delivery_user["id"], delivery_user["full_name"], now, order_id),
                    )

                    create_notification(
                        conn,
                        notification_type="ORDER_APPROVED",
                        title="Order Approved",
                        message=f"Your order for customer {order['customer_name']} is approved and pending delivery",
                        delivery_no=None,
                        from_user_id=session_user["id"],
                        from_user_name=session_user["full_name"],
                        to_user_id=order["created_by_user_id"],
                        to_user_name=order["created_by_user_name"],
                        to_role=None,
                        item_id=order["item_id"],
                        item_code=order["item_code"],
                        item_title=order["item_title"],
                        meta={"order_id": order_id},
                    )
                    create_notification(
                        conn,
                        notification_type="ORDER_PENDING_DELIVERY",
                        title="Pending Delivery Order",
                        message=f"Order approved for customer {order['customer_name']}. Please deliver.",
                        delivery_no=None,
                        from_user_id=session_user["id"],
                        from_user_name=session_user["full_name"],
                        to_user_id=delivery_user["id"],
                        to_user_name=delivery_user["full_name"],
                        to_role=delivery_user["role"],
                        item_id=order["item_id"],
                        item_code=order["item_code"],
                        item_title=order["item_title"],
                        meta={"order_id": order_id, "admin_note": admin_note or None},
                    )
                else:
                    if order["status"] != "PENDING_ADMIN":
                        send_json(self, {"message": "Only orders in PENDING_ADMIN state can be rejected"}, 400)
                        return
                    cur.execute(
                        """
                        UPDATE customer_orders
                        SET status = 'REJECTED', approved_by_user_id = ?, approved_by_user_name = ?,
                            delivery_user_id = NULL, delivery_user_name = NULL, updated_at = ?
                        WHERE id = ?
                        """,
                        (session_user["id"], session_user["full_name"], now, order_id),
                    )
                    create_notification(
                        conn,
                        notification_type="ORDER_REJECTED",
                        title="Order Rejected",
                        message=(
                            f"Order for customer {order['customer_name']} was rejected"
                            + (f": {admin_note}" if admin_note else "")
                        ),
                        delivery_no=None,
                        from_user_id=session_user["id"],
                        from_user_name=session_user["full_name"],
                        to_user_id=order["created_by_user_id"],
                        to_user_name=order["created_by_user_name"],
                        to_role=None,
                        item_id=order["item_id"],
                        item_code=order["item_code"],
                        item_title=order["item_title"],
                        meta={"order_id": order_id, "admin_note": admin_note or None},
                    )

                write_audit(
                    conn,
                    session_user["id"],
                    "ORDER_APPROVAL",
                    "ORDER",
                    order_id,
                    {"approved": approved, "delivery_user_id": delivery_user_id or None},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "APPROVE" if approved else "REJECT", "ORDER", order_id, order["customer_name"])
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/orders/mark-delivered":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN", "DELIVERY_PARTNER", "EXTERNAL_PARTNER"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"order_id", "delivery_note"},
                    required_fields={"order_id"},
                )
                order_id = str(payload.get("order_id", "")).strip()
                delivery_note = str(payload.get("delivery_note", "")).strip()
                if not order_id:
                    send_json(self, {"message": "order_id is required"}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT * FROM customer_orders WHERE id = ?", (order_id,))
                order = cur.fetchone()
                if order is None:
                    send_json(self, {"message": "Order not found"}, 404)
                    return
                if order["status"] != "PENDING_DELIVERY":
                    send_json(self, {"message": "Order is not in pending delivery state"}, 400)
                    return
                if session_user["role"] in {"DELIVERY_PARTNER", "EXTERNAL_PARTNER"} and order["delivery_user_id"] != session_user["id"]:
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                now = utc_now_iso()
                delivery_no = generate_next_delivery_no(conn)
                cur.execute(
                    """
                    UPDATE customer_orders
                    SET delivery_no = ?, status = 'DELIVERED', delivered_by_user_id = ?, delivered_by_user_name = ?, delivered_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (delivery_no, session_user["id"], session_user["full_name"], now, now, order_id),
                )

                notify_admin_roles(
                    conn,
                    notification_type="ORDER_DELIVERED",
                    title="Order Delivered",
                    message=(
                        f"{session_user['full_name']} delivered order for customer {order['customer_name']}"
                        + (f". Note: {delivery_note}" if delivery_note else "")
                    ),
                    delivery_no=delivery_no,
                    from_user_id=session_user["id"],
                    from_user_name=session_user["full_name"],
                    item_id=order["item_id"],
                    item_code=order["item_code"],
                    item_title=order["item_title"],
                    meta={"order_id": order_id, "delivery_note": delivery_note or None},
                )
                write_audit(
                    conn,
                    session_user["id"],
                    "ORDER_DELIVERED",
                    "ORDER",
                    order_id,
                    {"delivery_note": delivery_note or None, "delivery_no": delivery_no},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "ORDER", order_id, order["customer_name"])
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/items/register":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"title", "category", "custom_id", "code_prefix", "ownership_type", "owner_name", "company_location_id", "item_type", "volume_unit", "capacity", "fill_state", "status", "current_location"},
                    required_fields={"title", "category", "item_type", "capacity", "status"},
                )
                title = str(payload.get("title", "")).strip()
                category = str(payload.get("category", "")).strip()
                custom_id_raw = str(payload.get("custom_id", "")).strip()
                custom_id = None
                code_prefix_override = str(payload.get("code_prefix", "")).strip().upper() or None
                ownership_type = str(payload.get("ownership_type", "OURS")).strip().upper() or "OURS"
                owner_name = str(payload.get("owner_name", "")).strip()
                company_location_id = str(payload.get("company_location_id", "")).strip()
                item_type = str(payload.get("item_type", "CONTAINER"))
                volume_unit = payload.get("volume_unit")
                capacity_raw = payload.get("capacity", "")
                status = str(payload.get("status", "WITH_ME")).strip().upper()
                current_location = str(payload.get("current_location", "")).strip()
                fill_state = str(payload.get("fill_state", "EMPTY")).strip().upper() or "EMPTY"

                if len(title) < 2 or len(title) > 200:
                    send_json(self, {"message": "Title must be between 2 and 200 characters"}, 400)
                    return
                if len(category) < 2 or len(category) > 80:
                    send_json(self, {"message": "Category must be between 2 and 80 characters"}, 400)
                    return
                category = normalize_category_name(category)
                if ownership_type not in ALLOWED_ITEM_OWNERSHIP:
                    send_json(self, {"message": "ownership_type must be OURS or EXTERNAL"}, 400)
                    return
                if ownership_type == "EXTERNAL" and (len(owner_name) < 2 or len(owner_name) > 120):
                    send_json(self, {"message": "owner_name is required for EXTERNAL ownership and must be between 2 and 120 characters"}, 400)
                    return
                if ownership_type == "OURS":
                    owner_name = ""
                if owner_name and len(owner_name) > 120:
                    send_json(self, {"message": "owner_name must be at most 120 characters"}, 400)
                    return
                try:
                    capacity_units = parse_capacity_units(capacity_raw)
                    allowed_volume_units = get_allowed_cylinder_volume_units(conn)
                    item_type, volume_unit = validate_item_type_capacity(
                        item_type=item_type,
                        volume_unit=volume_unit,
                        allowed_volume_units=allowed_volume_units,
                    )
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return
                capacity = capacity_units / CAPACITY_SCALE
                if status not in ALLOWED_ITEM_STATUS:
                    send_json(self, {"message": "Invalid item status"}, 400)
                    return
                if fill_state not in ALLOWED_FILL_STATE:
                    send_json(self, {"message": "fill_state must be FULL or EMPTY"}, 400)
                    return
                if len(current_location) > 120:
                    send_json(self, {"message": "Location must be at most 120 characters"}, 400)
                    return
                if custom_id_raw:
                    try:
                        custom_id = normalize_custom_id(custom_id_raw)
                    except ValueError as exc:
                        send_json(self, {"message": str(exc)}, 400)
                        return

                cur = conn.cursor()
                if status == "WITH_ME":
                    if company_location_id:
                        cur.execute(
                            """
                            SELECT cl.id, cl.location_name
                            FROM company_locations cl
                            JOIN companies c ON c.id = cl.company_id
                            WHERE cl.id = ? AND cl.is_active = 1 AND c.is_active = 1
                            """,
                            (company_location_id,),
                        )
                        location_row = cur.fetchone()
                        if location_row is None:
                            send_json(self, {"message": "Selected company location is not active or not found"}, 400)
                            return
                        current_location = str(location_row["location_name"] or "").strip()
                    else:
                        if current_location:
                            company_location_id = ""
                        else:
                            cur.execute(
                                """
                                SELECT COUNT(1) AS total
                                FROM company_locations cl
                                JOIN companies c ON c.id = cl.company_id
                                WHERE cl.is_active = 1 AND c.is_active = 1
                                """
                            )
                            active_locations_total = int((cur.fetchone() or {"total": 0})["total"] or 0)
                            if active_locations_total > 0:
                                send_json(self, {"message": "company_location_id is required when status is WITH_ME"}, 400)
                                return

                            cur.execute(
                                """
                                SELECT company_name
                                FROM companies
                                WHERE is_active = 1
                                ORDER BY updated_at DESC, company_name ASC
                                LIMIT 1
                                """
                            )
                            fallback_company = cur.fetchone()
                            fallback_location_name = str((fallback_company or {"company_name": ""})["company_name"] or "").strip()
                            if not fallback_location_name:
                                send_json(self, {"message": "No active company configured for WITH_ME location fallback"}, 400)
                                return
                            current_location = fallback_location_name
                else:
                    company_location_id = ""

                try:
                    item_code, category_key, category_prefix, normalized_category_name = generate_next_item_code_for_category(conn, category, code_prefix_override, item_type)
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return
                item_id = secrets.token_hex(16)
                now = utc_now_iso()
                created_mode = "ADMIN" if session_user["role"] in {"SUPER_ADMIN", "ADMIN"} else "SELF"
                warning_active, warning_reason, _ = evaluate_item_warning(0, now)
                cur.execute(
                    """
                    INSERT INTO items (
                        id, item_code, title, category, ownership_type, owner_name, company_location_id, item_type, volume_unit, capacity, capacity_units, fill_state, cycle_count, warning_active, warning_reason, status, current_holder_user_id, current_location,
                        created_by_user_id, created_by_mode, updated_at, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item_id,
                        item_code,
                        title,
                        normalized_category_name,
                        ownership_type,
                        owner_name or None,
                        company_location_id or None,
                        item_type,
                        volume_unit,
                        capacity,
                        capacity_units,
                        fill_state,
                        0,
                        1 if warning_active else 0,
                        warning_reason or None,
                        status,
                        session_user["id"],
                        current_location or None,
                        session_user["id"],
                        created_mode,
                        now,
                        now,
                    ),
                )
                if custom_id:
                    cur.execute("SELECT item_id FROM custom_item_ids WHERE custom_id = ?", (custom_id,))
                    existing_custom_id_row = cur.fetchone()
                    if existing_custom_id_row is not None:
                        send_json(self, {"message": "custom_id already exists"}, 409)
                        return
                    cur.execute(
                        """
                        INSERT INTO custom_item_ids (item_id, custom_id, created_by_user_id, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (item_id, custom_id, session_user["id"], now, now),
                    )
                write_audit(
                    conn,
                    session_user["id"],
                    "ITEM_REGISTER",
                    "ITEM",
                    item_id,
                    {
                        "item_code": item_code,
                        "category": normalized_category_name,
                        "ownership_type": ownership_type,
                        "owner_name": owner_name or None,
                        "custom_id": custom_id,
                        "category_key": category_key,
                        "category_prefix": category_prefix,
                        "item_type": item_type,
                        "volume_unit": volume_unit,
                        "capacity": format_capacity_units(capacity_units),
                        "fill_state": fill_state,
                        "status": status,
                        "created_by": session_user["id"],
                        "mode": created_mode,
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "CREATE", "ITEM", item_id, item_code)
                conn.commit()
                send_json(self, {"ok": True, "id": item_id, "item_code": item_code}, 201)
                return

            if path == "/api/items/update":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"item_id", "title", "category", "custom_id", "ownership_type", "owner_name", "company_location_id", "item_type", "volume_unit", "capacity", "fill_state", "status", "current_location", "expected_updated_at"},
                    required_fields={"item_id", "title", "category", "item_type", "capacity", "fill_state", "status", "expected_updated_at"},
                )
                item_id = str(payload.get("item_id", "")).strip()
                title = str(payload.get("title", "")).strip()
                category = str(payload.get("category", "")).strip()
                custom_id_raw = str(payload.get("custom_id", "")).strip()
                custom_id = None
                ownership_type = str(payload.get("ownership_type", "OURS")).strip().upper() or "OURS"
                owner_name = str(payload.get("owner_name", "")).strip()
                company_location_id = str(payload.get("company_location_id", "")).strip()
                item_type = str(payload.get("item_type", "CONTAINER"))
                volume_unit = payload.get("volume_unit")
                capacity_raw = payload.get("capacity", "")
                fill_state = str(payload.get("fill_state", "EMPTY")).strip().upper()
                status = str(payload.get("status", "")).strip().upper()
                current_location = str(payload.get("current_location", "")).strip()
                expected_updated_at = str(payload.get("expected_updated_at", "")).strip()

                if not item_id:
                    send_json(self, {"message": "item_id is required"}, 400)
                    return
                if not expected_updated_at:
                    send_json(self, {"message": "expected_updated_at is required"}, 400)
                    return
                if len(title) < 2 or len(title) > 200:
                    send_json(self, {"message": "Title must be between 2 and 200 characters"}, 400)
                    return
                if len(category) < 2 or len(category) > 80:
                    send_json(self, {"message": "Category must be between 2 and 80 characters"}, 400)
                    return
                category = normalize_category_name(category)
                if ownership_type not in ALLOWED_ITEM_OWNERSHIP:
                    send_json(self, {"message": "ownership_type must be OURS or EXTERNAL"}, 400)
                    return
                if ownership_type == "EXTERNAL" and (len(owner_name) < 2 or len(owner_name) > 120):
                    send_json(self, {"message": "owner_name is required for EXTERNAL ownership and must be between 2 and 120 characters"}, 400)
                    return
                if ownership_type == "OURS":
                    owner_name = ""
                if owner_name and len(owner_name) > 120:
                    send_json(self, {"message": "owner_name must be at most 120 characters"}, 400)
                    return
                try:
                    capacity_units = parse_capacity_units(capacity_raw)
                    allowed_volume_units = get_allowed_cylinder_volume_units(conn)
                    item_type, volume_unit = validate_item_type_capacity(
                        item_type=item_type,
                        volume_unit=volume_unit,
                        allowed_volume_units=allowed_volume_units,
                    )
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return
                capacity = capacity_units / CAPACITY_SCALE
                if fill_state not in ALLOWED_FILL_STATE:
                    send_json(self, {"message": "Item state must be FULL or EMPTY"}, 400)
                    return
                if status not in ALLOWED_ITEM_STATUS:
                    send_json(self, {"message": "Invalid item status"}, 400)
                    return
                if len(current_location) > 120:
                    send_json(self, {"message": "Location must be at most 120 characters"}, 400)
                    return
                if custom_id_raw:
                    try:
                        custom_id = normalize_custom_id(custom_id_raw)
                    except ValueError as exc:
                        send_json(self, {"message": str(exc)}, 400)
                        return

                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT i.id, i.item_code, ci.custom_id, i.title, i.category, i.ownership_type, i.owner_name, i.item_type, i.volume_unit, i.capacity, i.capacity_units,
                           i.fill_state, i.cycle_count, i.warning_active, i.warning_reason, i.status, i.current_location, i.created_at, i.updated_at
                    FROM items i
                    LEFT JOIN custom_item_ids ci ON ci.item_id = i.id
                    WHERE i.id = ?
                    """,
                    (item_id,),
                )
                existing_item = cur.fetchone()
                if existing_item is None:
                    send_json(self, {"message": "Item not found"}, 404)
                    return
                if str(existing_item["updated_at"] or "") != expected_updated_at:
                    send_json(
                        self,
                        {
                            "message": "This item was updated by another user. Refresh and review the latest values before saving again.",
                            "latest_updated_at": existing_item["updated_at"],
                        },
                        409,
                    )
                    return
                if not is_valid_status_transition(str(existing_item["status"] or ""), status):
                    send_json(
                        self,
                        {"message": f"Invalid status transition from {existing_item['status']} to {status}"},
                        400,
                    )
                    return

                updated_cycle_count = compute_next_cycle_count(
                    str(existing_item["fill_state"] or "EMPTY"),
                    fill_state,
                    int(existing_item["cycle_count"] or 0),
                )
                warning_active, warning_reason, _ = evaluate_item_warning(updated_cycle_count, existing_item["created_at"])
                try:
                    ensure_item_category(conn, category, category_type=item_type, now_iso=utc_now_iso())
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return

                existing_custom_id = str(existing_item["custom_id"] or "").strip().upper()
                resolved_custom_id = existing_custom_id
                if custom_id:
                    cur.execute("SELECT item_id FROM custom_item_ids WHERE custom_id = ?", (custom_id,))
                    conflicting_custom_id = cur.fetchone()
                    if conflicting_custom_id is not None and str(conflicting_custom_id["item_id"] or "") != item_id:
                        send_json(self, {"message": "custom_id already exists"}, 409)
                        return
                    if existing_custom_id:
                        now_custom = utc_now_iso()
                        cur.execute(
                            """
                            UPDATE custom_item_ids
                            SET custom_id = ?, updated_at = ?
                            WHERE item_id = ?
                            """,
                            (custom_id, now_custom, item_id),
                        )
                    else:
                        now_custom = utc_now_iso()
                        cur.execute(
                            """
                            INSERT INTO custom_item_ids (item_id, custom_id, created_by_user_id, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            (item_id, custom_id, session_user["id"], now_custom, now_custom),
                        )
                    resolved_custom_id = custom_id

                cur.execute(
                    """
                    UPDATE items
                    SET title = ?, category = ?, ownership_type = ?, owner_name = ?, item_type = ?, volume_unit = ?, capacity = ?, capacity_units = ?, fill_state = ?, cycle_count = ?, warning_active = ?, warning_reason = ?, status = ?, current_location = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        title,
                        category,
                        ownership_type,
                        owner_name or None,
                        item_type,
                        volume_unit,
                        capacity,
                        capacity_units,
                        fill_state,
                        updated_cycle_count,
                        1 if warning_active else 0,
                        warning_reason or None,
                        status,
                        current_location or None,
                        utc_now_iso(),
                        item_id,
                    ),
                )
                write_audit(
                    conn,
                    session_user["id"],
                    "ITEM_UPDATE",
                    "ITEM",
                    item_id,
                    {
                        "before": {
                            "title": existing_item["title"],
                            "category": existing_item["category"],
                            "custom_id": existing_item["custom_id"],
                            "ownership_type": existing_item["ownership_type"] or "OURS",
                            "owner_name": existing_item["owner_name"],
                            "item_type": existing_item["item_type"],
                            "volume_unit": existing_item["volume_unit"],
                            "capacity": format_capacity_units(get_row_capacity_units(existing_item)),
                            "fill_state": existing_item["fill_state"],
                            "cycle_count": int(existing_item["cycle_count"] or 0),
                            "warning_active": bool(existing_item["warning_active"]),
                            "warning_reason": existing_item["warning_reason"],
                            "status": existing_item["status"],
                            "current_location": existing_item["current_location"],
                        },
                        "after": {
                            "title": title,
                            "category": normalize_category_name(category),
                            "custom_id": resolved_custom_id,
                            "ownership_type": ownership_type,
                            "owner_name": owner_name or None,
                            "item_type": item_type,
                            "volume_unit": volume_unit,
                            "capacity": format_capacity_units(capacity_units),
                            "fill_state": fill_state,
                            "cycle_count": updated_cycle_count,
                            "warning_active": warning_active,
                            "warning_reason": warning_reason,
                            "status": status,
                            "current_location": current_location,
                        },
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "ITEM", item_id, existing_item["item_code"] or item_id)
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/login-controls/add":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"user_id", "system_name", "mac_address"},
                    required_fields={"user_id", "mac_address"},
                )
                user_id = str(payload.get("user_id", "")).strip()
                system_name = str(payload.get("system_name", "")).strip()
                mac_address_raw = str(payload.get("mac_address", "")).strip()
                mac_address = normalize_mac_address(mac_address_raw)

                if not user_id:
                    send_json(self, {"message": "user_id is required"}, 400)
                    return
                if system_name and len(system_name) > 120:
                    send_json(self, {"message": "system_name must be at most 120 characters"}, 400)
                    return
                if not mac_address or not is_valid_mac_address(mac_address):
                    send_json(self, {"message": "Valid MAC address required (format: AA:BB:CC:DD:EE:FF)"}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id FROM users WHERE id = ?", (user_id,))
                target_user = cur.fetchone()
                if target_user is None:
                    send_json(self, {"message": "User not found"}, 404)
                    return

                now = utc_now_iso()
                cur.execute(
                    """
                    SELECT id FROM login_system_controls
                    WHERE user_id = ? AND mac_address = ?
                    """,
                    (user_id, mac_address),
                )
                existing_control = cur.fetchone()
                if existing_control is None:
                    control_id = secrets.token_hex(16)
                    cur.execute(
                        """
                        INSERT INTO login_system_controls (
                            id, user_id, system_name, mac_address, is_active, created_by_user_id, created_at, updated_at
                        )
                        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
                        """,
                        (control_id, user_id, system_name or None, mac_address, session_user["id"], now, now),
                    )
                else:
                    control_id = existing_control["id"]
                    cur.execute(
                        """
                        UPDATE login_system_controls
                        SET system_name = ?, is_active = 1, updated_at = ?
                        WHERE id = ?
                        """,
                        (system_name or None, now, control_id),
                    )

                write_audit(
                    conn,
                    session_user["id"],
                    "LOGIN_CONTROL_ADD",
                    "USER",
                    user_id,
                    {"control_id": control_id, "mac_address": mac_address, "system_name": system_name or None},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "CREATE", "LOGIN_CONTROL", user_id, mac_address)
                conn.commit()
                send_json(self, {"ok": True, "id": control_id, "mac_address": mac_address})
                return

            if path == "/api/login-controls/deactivate":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"control_id"},
                    required_fields={"control_id"},
                )
                control_id = str(payload.get("control_id", "")).strip()
                if not control_id:
                    send_json(self, {"message": "control_id is required"}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id, user_id FROM login_system_controls WHERE id = ?", (control_id,))
                control = cur.fetchone()
                if control is None:
                    send_json(self, {"message": "Control not found"}, 404)
                    return

                cur.execute(
                    "UPDATE login_system_controls SET is_active = 0, updated_at = ? WHERE id = ?",
                    (utc_now_iso(), control_id),
                )
                write_audit(
                    conn,
                    session_user["id"],
                    "LOGIN_CONTROL_DEACTIVATE",
                    "USER",
                    control["user_id"],
                    {"control_id": control_id},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "DELETE", "LOGIN_CONTROL", control["user_id"], control_id)
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/users/update":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={
                        "user_id",
                        "email",
                        "full_name",
                        "is_active",
                        "reject_empty_items",
                        "reject_full_items",
                        "new_password",
                        "role",
                        "security_key_1",
                        "security_key_2",
                        "security_key_3",
                    },
                    required_fields={"user_id", "email", "full_name", "is_active"},
                )
                user_id = str(payload.get("user_id", "")).strip()
                email = str(payload.get("email", "")).strip().lower()
                full_name = str(payload.get("full_name", "")).strip()
                is_active_raw = payload.get("is_active", True)
                reject_empty_items_raw = payload.get("reject_empty_items", False)
                reject_full_items_raw = payload.get("reject_full_items", False)
                new_password = str(payload.get("new_password", ""))
                role = normalize_role_value(payload.get("role", ""))
                security_keys = parse_security_keys(payload)

                if not user_id:
                    send_json(self, {"message": "user_id is required"}, 400)
                    return
                if not is_valid_email(email):
                    send_json(self, {"message": "Valid email is required"}, 400)
                    return
                if len(full_name) < 2 or len(full_name) > 120:
                    send_json(self, {"message": "Full name must be between 2 and 120 characters"}, 400)
                    return
                if not isinstance(is_active_raw, bool):
                    send_json(self, {"message": "is_active must be true or false"}, 400)
                    return
                if not isinstance(reject_empty_items_raw, bool):
                    send_json(self, {"message": "reject_empty_items must be true or false"}, 400)
                    return
                if not isinstance(reject_full_items_raw, bool):
                    send_json(self, {"message": "reject_full_items must be true or false"}, 400)
                    return
                if role and role not in ALLOWED_ROLES:
                    send_json(self, {"message": "Invalid role"}, 400)
                    return
                if new_password:
                    password_error = validate_password(new_password)
                    if password_error:
                        send_json(self, {"message": password_error}, 400)
                        return
                security_error = validate_security_keys(security_keys, required=False)
                if security_error:
                    send_json(self, {"message": security_error}, 400)
                    return

                cur = conn.cursor()
                cur.execute(
                    "SELECT id, email, full_name, role, is_active, reject_empty_items, reject_full_items, password_hash FROM users WHERE id = ?",
                    (user_id,),
                )
                existing_user = cur.fetchone()
                if existing_user is None:
                    send_json(self, {"message": "User not found"}, 404)
                    return
                if existing_user["role"] == "SUPER_ADMIN":
                    send_json(self, {"message": "Super Admin can be updated only from Profile page"}, 400)
                    return
                if existing_user["role"] == "SUPER_ADMIN" and session_user["role"] != "SUPER_ADMIN":
                    send_json(self, {"message": "Only Super Admin can modify Super Admin users"}, 403)
                    return
                if (
                    session_user["role"] == "ADMIN"
                    and existing_user["role"] == "ADMIN"
                    and new_password
                    and session_user["id"] != user_id
                ):
                    send_json(self, {"message": "Admins cannot reset another admin's password"}, 403)
                    return

                cur.execute("SELECT id FROM users WHERE email = ? AND id != ?", (email, user_id))
                if cur.fetchone() is not None:
                    send_json(self, {"message": "Email already exists"}, 409)
                    return

                password_hash = existing_user["password_hash"]
                if new_password:
                    password_hash = hash_password(new_password)
                target_role = role if role else existing_user["role"]
                if role == "SUPER_ADMIN" and existing_user["role"] != "SUPER_ADMIN":
                    send_json(self, {"message": "Super Admin role is fixed and cannot be assigned"}, 400)
                    return
                if existing_user["role"] == "SUPER_ADMIN" and role and role != "SUPER_ADMIN":
                    send_json(self, {"message": "Super Admin role is fixed and cannot be changed"}, 400)
                    return
                update_security_keys = bool(security_keys[0] and security_keys[1] and security_keys[2])
                security_key_1_hash = hash_security_key(security_keys[0]) if update_security_keys else None
                security_key_2_hash = hash_security_key(security_keys[1]) if update_security_keys else None
                security_key_3_hash = hash_security_key(security_keys[2]) if update_security_keys else None

                if update_security_keys:
                    cur.execute(
                        """
                        UPDATE users
                        SET email = ?, full_name = ?, role = ?, is_active = ?, reject_empty_items = ?, reject_full_items = ?, password_hash = ?, security_key_1_hash = ?, security_key_2_hash = ?, security_key_3_hash = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            email,
                            full_name,
                            target_role,
                            1 if is_active_raw else 0,
                            1 if reject_empty_items_raw else 0,
                            1 if reject_full_items_raw else 0,
                            password_hash,
                            security_key_1_hash,
                            security_key_2_hash,
                            security_key_3_hash,
                            utc_now_iso(),
                            user_id,
                        ),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE users
                        SET email = ?, full_name = ?, role = ?, is_active = ?, reject_empty_items = ?, reject_full_items = ?, password_hash = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            email,
                            full_name,
                            target_role,
                            1 if is_active_raw else 0,
                            1 if reject_empty_items_raw else 0,
                            1 if reject_full_items_raw else 0,
                            password_hash,
                            utc_now_iso(),
                            user_id,
                        ),
                    )
                write_audit(
                    conn,
                    session_user["id"],
                    "USER_UPDATE",
                    "USER",
                    user_id,
                    {
                        "before": {
                            "email": existing_user["email"],
                            "full_name": existing_user["full_name"],
                            "role": existing_user["role"],
                            "is_active": bool(existing_user["is_active"]),
                            "reject_empty_items": bool(existing_user["reject_empty_items"]),
                            "reject_full_items": bool(existing_user["reject_full_items"]),
                        },
                        "after": {
                            "email": email,
                            "full_name": full_name,
                            "role": target_role,
                            "is_active": is_active_raw,
                            "reject_empty_items": reject_empty_items_raw,
                            "reject_full_items": reject_full_items_raw,
                            "password_changed": bool(new_password),
                            "security_keys_changed": update_security_keys,
                        },
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "USER", user_id, email)
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/users/update-role":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"user_id", "role"},
                    required_fields={"user_id", "role"},
                )
                user_id = str(payload.get("user_id", "")).strip()
                role = normalize_role_value(payload.get("role", ""))

                if not user_id:
                    send_json(self, {"message": "user_id is required"}, 400)
                    return
                if role not in ALLOWED_ROLES:
                    send_json(self, {"message": "Invalid role"}, 400)
                    return
                if role == "SUPER_ADMIN":
                    send_json(self, {"message": "Super Admin role is fixed and cannot be assigned"}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id, role, email FROM users WHERE id = ?", (user_id,))
                existing_user = cur.fetchone()
                if existing_user is None:
                    send_json(self, {"message": "User not found"}, 404)
                    return
                if existing_user["role"] == "SUPER_ADMIN":
                    send_json(self, {"message": "Super Admin role is fixed and cannot be changed"}, 400)
                    return

                cur.execute("UPDATE users SET role = ?, updated_at = ? WHERE id = ?", (role, utc_now_iso(), user_id))
                write_audit(
                    conn,
                    session_user["id"],
                    "USER_ROLE_UPDATE",
                    "USER",
                    user_id,
                    {
                        "before": {"role": existing_user["role"]},
                        "after": {"role": role},
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "USER", user_id, existing_user["email"])
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/auth/logout":
                cookies = parse_cookie(self.headers)
                session_id = cookies.get("session_id")
                if session_id:
                    cur = conn.cursor()
                    cur.execute("UPDATE user_sessions SET is_active = 0 WHERE id = ?", (session_id,))
                    write_audit(conn, session_user["id"], "AUTH_LOGOUT", "USER", session_user["id"], {}, self)
                    write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "LOGOUT", "USER", session_user["id"], session_user["email"])
                    conn.commit()

                body = json.dumps({"ok": True}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Set-Cookie", build_set_cookie_value("session_id", "", http_only=True, max_age=0))
                self.send_header("Set-Cookie", build_set_cookie_value(CSRF_COOKIE_NAME, "", http_only=False, max_age=0))
                self.end_headers()
                self.wfile.write(body)
                return

            if path == "/api/navigation/event":
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"path", "title"},
                    required_fields={"path", "title"},
                )
                page_path = str(payload.get("path", "")).strip()
                title = str(payload.get("title", "")).strip()
                if not page_path or not title:
                    send_json(self, {"message": "path and title required"}, 400)
                    return
                if len(page_path) > 200:
                    send_json(self, {"message": "path must be at most 200 characters"}, 400)
                    return
                if len(title) > 200:
                    send_json(self, {"message": "title must be at most 200 characters"}, 400)
                    return

                # Navigation tracking intentionally disabled.
                send_json(self, {"saved": False})
                return

            if path == "/api/items/transfer":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN", "DELIVERY_PARTNER", "EXTERNAL_PARTNER"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"item_id", "to_status", "reason", "to_location"},
                    required_fields={"item_id", "to_status", "reason"},
                )
                item_id = str(payload.get("item_id", "")).strip()
                to_status = str(payload.get("to_status", "")).strip()
                reason = str(payload.get("reason", "")).strip()
                to_location = str(payload.get("to_location", "")).strip()
                if not item_id or not to_status or not reason:
                    send_json(self, {"message": "item_id, to_status, reason are required"}, 400)
                    return
                if to_status not in ALLOWED_ITEM_STATUS:
                    send_json(self, {"message": "Invalid item status"}, 400)
                    return
                if len(reason) > 500:
                    send_json(self, {"message": "Reason must be at most 500 characters"}, 400)
                    return
                if len(to_location) > 120:
                    send_json(self, {"message": "Location must be at most 120 characters"}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id, item_code, title, status, current_location FROM items WHERE id = ?", (item_id,))
                item = cur.fetchone()
                if item is None:
                    send_json(self, {"message": "Item not found"}, 404)
                    return
                if not is_valid_status_transition(str(item["status"] or ""), to_status):
                    send_json(self, {"message": f"Invalid status transition from {item['status']} to {to_status}"}, 400)
                    return

                cur.execute(
                    """
                    UPDATE items
                    SET status = ?, current_location = ?, current_holder_user_id = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (to_status, to_location or item["current_location"], session_user["id"], utc_now_iso(), item_id),
                )
                delivery_no = generate_next_delivery_no(conn)
                cur.execute(
                    """
                    INSERT INTO item_transfers (
                        id, delivery_no, item_id, from_status, to_status, from_location, to_location, reason, transferred_by, transferred_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        secrets.token_hex(16),
                        delivery_no,
                        item_id,
                        item["status"],
                        to_status,
                        item["current_location"],
                        to_location,
                        reason,
                        session_user["id"],
                        utc_now_iso(),
                    ),
                )

                notify_admin_roles(
                    conn,
                    notification_type="DELIVERY_UPDATE",
                    title="Item Delivery Update",
                    message=(
                        f"{session_user['full_name']} transferred item {item['item_code']} to status {to_status}"
                        f" at {to_location or item['current_location'] or '-'}"
                    ),
                    delivery_no=delivery_no,
                    from_user_id=session_user["id"],
                    from_user_name=session_user["full_name"],
                    item_id=item_id,
                    item_code=item["item_code"],
                    item_title=item["title"],
                    meta={
                        "to_status": to_status,
                        "to_location": to_location or item["current_location"],
                        "reason": reason,
                    },
                )
                write_audit(
                    conn,
                    session_user["id"],
                    "ITEM_TRANSFER",
                    "ITEM",
                    item_id,
                    {**payload, "delivery_no": delivery_no},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "ITEM", item_id, item_id)
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/transition/submit":
                if not role_allowed(session_user["role"], ALLOWED_ROLES):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={
                        "action",
                        "source_type",
                        "source_user_id",
                        "source_location_id",
                        "dispatch_target_type",
                        "dispatch_user_id",
                        "dispatch_customer_name",
                        "item_updates",
                        "dc_book_id",
                        "process_id",
                        "link_dc_book_id",
                        "link_dc_number",
                    },
                    required_fields={"action", "source_type", "item_updates"},
                )
                action = str(payload.get("action", "")).strip().upper()
                source_type = str(payload.get("source_type", "")).strip().upper()
                source_user_id = str(payload.get("source_user_id", "")).strip()
                source_location_id = str(payload.get("source_location_id", "")).strip()
                dispatch_target_type = str(payload.get("dispatch_target_type", "")).strip().upper()
                dispatch_user_id = str(payload.get("dispatch_user_id", "")).strip()
                dispatch_customer_name = str(payload.get("dispatch_customer_name", "")).strip()
                dc_book_id = normalize_dc_book_id(payload.get("dc_book_id", ""))
                link_dc_book_id = normalize_dc_book_id(payload.get("link_dc_book_id", ""))
                link_dc_number_raw = str(payload.get("link_dc_number", "")).strip()
                process_id = str(payload.get("process_id", "")).strip()
                item_updates = payload.get("item_updates", [])
                link_dc_number: int | None = None
                dispatch_user: sqlite3.Row | None = None

                if link_dc_number_raw:
                    try:
                        link_dc_number = int(link_dc_number_raw)
                    except Exception:
                        send_json(self, {"message": "link_dc_number must be a positive integer"}, 400)
                        return
                    if link_dc_number <= 0:
                        send_json(self, {"message": "link_dc_number must be a positive integer"}, 400)
                        return
                if bool(link_dc_book_id) != bool(link_dc_number):
                    send_json(self, {"message": "Both link_dc_book_id and link_dc_number are required to link a TAKING EMPTY transition"}, 400)
                    return
                linked_taking_enabled = action == "TAKING" and bool(link_dc_book_id) and link_dc_number is not None
                if action != "TAKING" and (link_dc_book_id or link_dc_number is not None):
                    send_json(self, {"message": "DC link is only supported for TAKING action"}, 400)
                    return

                if action not in ALLOWED_TRANSITION_ACTION:
                    send_json(self, {"message": "Action must be TAKING or GIVING"}, 400)
                    return
                if source_type not in ALLOWED_TRANSITION_SOURCE:
                    send_json(self, {"message": "Invalid source type"}, 400)
                    return

                if not is_transition_source_allowed_for_user(session_user, action, source_type, source_user_id):
                    send_json(self, {"message": f"Source type {source_type} is not allowed for action {action}"}, 403)
                    return
                if source_type in {"EMPLOYEE", "FILLER", "CUSTOMER"} and not source_user_id:
                    send_json(self, {"message": f"source_user_id is required for {source_type} source"}, 400)
                    return
                if action == "GIVING":
                    if dispatch_target_type not in {"CUSTOMER", "USER"}:
                        send_json(self, {"message": "dispatch_target_type is required for GIVING and must be CUSTOMER or USER"}, 400)
                        return
                    if dispatch_target_type == "USER" and not dispatch_user_id:
                        send_json(self, {"message": "dispatch_user_id is required when dispatch_target_type is USER"}, 400)
                        return
                    if dispatch_target_type == "USER" and dispatch_customer_name:
                        send_json(self, {"message": "dispatch_customer_name is only allowed when dispatch_target_type is CUSTOMER"}, 400)
                        return
                    if dispatch_target_type == "CUSTOMER":
                        if len(dispatch_customer_name) < 2 or len(dispatch_customer_name) > 120:
                            send_json(self, {"message": "dispatch_customer_name is required for CUSTOMER and must be between 2 and 120 characters"}, 400)
                            return
                elif dispatch_target_type or dispatch_user_id:
                    send_json(self, {"message": "dispatch target fields are only allowed for GIVING action"}, 400)
                    return
                elif dispatch_customer_name:
                    send_json(self, {"message": "dispatch_customer_name is only allowed for GIVING action"}, 400)
                    return
                if not isinstance(item_updates, list) or len(item_updates) == 0:
                    send_json(self, {"message": "At least one item must be selected"}, 400)
                    return
                if len(item_updates) > 50:
                    send_json(self, {"message": "Too many items in a single transition (max 50)"}, 400)
                    return

                if linked_taking_enabled:
                    has_non_empty_item = any(
                        str((item_update or {}).get("fill_state", "")).strip().upper() != "EMPTY"
                        for item_update in item_updates
                    )
                    if has_non_empty_item:
                        send_json(self, {"message": "Linked TAKING is allowed only when all selected items are EMPTY"}, 400)
                        return

                has_empty_item = any(
                    str((item_update or {}).get("fill_state", "")).strip().upper() == "EMPTY"
                    for item_update in item_updates
                )

                to_status = "IN_TRANSIT"
                to_location = "Transit"
                new_holder_user_id = session_user["id"]
                full_items_count = sum(
                    1 for item_update in item_updates if str((item_update or {}).get("fill_state", "")).strip().upper() == "FULL"
                )
                requires_dc = (
                    action == "GIVING"
                    and full_items_count > 0
                    and dispatch_target_type == "CUSTOMER"
                    and session_user["role"] != "FILLER"
                    and source_type != "SELF"
                )
                dc_optional = (
                    not requires_dc
                    and action == "GIVING"
                    and full_items_count > 0
                    and bool(dc_book_id)
                )

                source_name_candidates: list[str] = []
                if source_type in {"FILLER", "CUSTOMER"} and source_user_id:
                    cur = conn.cursor()
                    cur.execute("SELECT full_name, user_code, email FROM users WHERE id = ?", (source_user_id,))
                    selected_source_user = cur.fetchone()
                    if selected_source_user is None:
                        send_json(self, {"message": f"Selected {source_type.lower()} source user not found"}, 404)
                        return
                    source_name_candidates = [
                        str(selected_source_user["full_name"] or "").strip().lower(),
                        str(selected_source_user["user_code"] or "").strip().lower(),
                        str(selected_source_user["email"] or "").strip().lower(),
                    ]
                    source_name_candidates = [value for value in source_name_candidates if value]

                def source_matches_item(item_row: sqlite3.Row) -> bool:
                    holder_user_id = item_row["current_holder_user_id"]
                    if source_type == "SELF":
                        if holder_user_id != session_user["id"] or str(item_row["status"] or "") != "WITH_ME":
                            return False
                        if source_location_id and str(item_row["company_location_id"] or "") != source_location_id:
                            return False
                        return True
                    if source_type == "EMPLOYEE":
                        return holder_user_id == source_user_id
                    if source_type == "FILLER":
                        if holder_user_id == source_user_id:
                            return True
                        if holder_user_id is None and str(item_row["status"] or "") == "WITH_CLIENT" and source_name_candidates:
                            return str(item_row["current_location"] or "").strip().lower() in source_name_candidates
                        return False
                    if source_type == "CUSTOMER":
                        if str(item_row["status"] or "") != "WITH_CLIENT":
                            return False
                        if source_location_id and str(item_row["company_location_id"] or "") != source_location_id:
                            return False
                        if holder_user_id == source_user_id:
                            return True
                        if holder_user_id is None and source_name_candidates:
                            return str(item_row["current_location"] or "").strip().lower() in source_name_candidates
                        return False
                    if item_row["status"] != "IN_TRANSIT":
                        return False
                    if holder_user_id != session_user["id"]:
                        return False
                    if not process_id:
                        return True
                    cur.execute(
                        "SELECT 1 FROM item_transfers WHERE item_id = ? AND transition_process_id = ? LIMIT 1",
                        (item_row["id"], process_id),
                    )
                    return cur.fetchone() is not None

                cur = conn.cursor()
                if action == "TAKING":
                    cur.execute(
                        "SELECT reject_empty_items, reject_full_items FROM users WHERE id = ? AND is_active = 1",
                        (session_user["id"],),
                    )
                    taking_user = cur.fetchone()
                    if taking_user is None:
                        send_json(self, {"message": "Current user not found or inactive"}, 404)
                        return
                    if has_empty_item and bool(taking_user["reject_empty_items"]):
                        send_json(self, {"message": "Your profile does not allow EMPTY-state items"}, 400)
                        return
                    if full_items_count > 0 and bool(taking_user["reject_full_items"]):
                        send_json(self, {"message": "Your profile does not allow FULL-state items"}, 400)
                        return
                if action == "GIVING" and dispatch_target_type == "USER":
                    cur.execute(
                        "SELECT id, full_name, reject_empty_items, reject_full_items FROM users WHERE id = ? AND is_active = 1",
                        (dispatch_user_id,),
                    )
                    dispatch_user = cur.fetchone()
                    if dispatch_user is None:
                        send_json(self, {"message": "Dispatch recipient user not found"}, 404)
                        return
                    if has_empty_item and bool(dispatch_user["reject_empty_items"]):
                        send_json(self, {"message": "Selected recipient does not accept EMPTY-state items"}, 400)
                        return
                    if full_items_count > 0 and bool(dispatch_user["reject_full_items"]):
                        send_json(self, {"message": "Selected recipient does not accept FULL-state items"}, 400)
                        return
                    to_status = "IN_TRANSIT"
                    to_location = str(dispatch_user["full_name"] or "Transit")
                    new_holder_user_id = dispatch_user_id
                elif action == "GIVING":
                    to_status = "WITH_CLIENT"
                    to_location = dispatch_customer_name
                    new_holder_user_id = None

                if process_id:
                    cur.execute(
                        "SELECT id FROM transition_processes WHERE id = ? AND created_by_user_id = ?",
                        (process_id, session_user["id"]),
                    )
                    existing_process = cur.fetchone()
                    if existing_process is None:
                        send_json(self, {"message": "Transition process not found"}, 404)
                        return
                    cur.execute(
                        "UPDATE transition_processes SET updated_at = ? WHERE id = ?",
                        (utc_now_iso(), process_id),
                    )
                else:
                    process_id = secrets.token_hex(16)
                    now_iso = utc_now_iso()
                    cur.execute(
                        """
                        INSERT INTO transition_processes (id, created_by_user_id, created_at, updated_at)
                        VALUES (?, ?, ?, ?)
                        """,
                        (process_id, session_user["id"], now_iso, now_iso),
                    )

                dc_number_for_transition: int | None = None
                if requires_dc or dc_optional:
                    if requires_dc and not dc_book_id:
                        send_json(self, {"message": "Select a DC book for GIVING transitions with FULL state items"}, 400)
                        return
                    if dc_book_id:
                        cur.execute(
                            """
                            SELECT book_id, range_end, next_dc_number, is_active
                            FROM dc_books
                            WHERE book_id = ?
                            """,
                            (dc_book_id,),
                        )
                        dc_book = cur.fetchone()
                        if dc_book is None or int(dc_book["is_active"] or 0) != 1:
                            send_json(self, {"message": "Selected DC book is not available"}, 400)
                            return
                        next_dc_number = int(dc_book["next_dc_number"] or 1)
                        range_end = int(dc_book["range_end"] or 0)
                        if next_dc_number > range_end:
                            send_json(self, {"message": "Selected DC book is exhausted. Create a new book."}, 400)
                            return
                        dc_number_for_transition = next_dc_number
                        cur.execute(
                            """
                            UPDATE dc_books
                            SET next_dc_number = ?, updated_at = ?
                            WHERE book_id = ? AND is_active = 1 AND next_dc_number = ?
                            """,
                            (next_dc_number + 1, utc_now_iso(), dc_book_id, next_dc_number),
                        )
                        if cur.rowcount != 1:
                            send_json(self, {"message": "DC book number allocation conflict. Please retry."}, 409)
                            return

                processed_items: list[str] = []
                processed_deliveries: list[dict[str, Any]] = []
                for item_update in item_updates:
                    item_id = str((item_update or {}).get("item_id", "")).strip()
                    fill_state = str((item_update or {}).get("fill_state", "")).strip().upper()
                    if not item_id:
                        send_json(self, {"message": "item_id is required for each selected item"}, 400)
                        return
                    if fill_state not in ALLOWED_FILL_STATE:
                        send_json(self, {"message": "Item state must be FULL or EMPTY"}, 400)
                        return

                    cur.execute(
                        "SELECT id, item_code, title, status, current_location, current_holder_user_id, company_location_id, fill_state, cycle_count, created_at FROM items WHERE id = ?",
                        (item_id,),
                    )
                    item = cur.fetchone()
                    if item is None:
                        send_json(self, {"message": f"Item not found: {item_id}"}, 404)
                        return
                    if not source_matches_item(item):
                        send_json(self, {"message": f"Item source mismatch: {item['item_code']}"}, 400)
                        return
                    if action == "GIVING" and source_type == "TRANSIT":
                        current_fill_state = str(item["fill_state"] or "").strip().upper()
                        if fill_state != current_fill_state:
                            send_json(
                                self,
                                {"message": f"Item state cannot be changed for Transit dispatch: {item['item_code']}"},
                                400,
                            )
                            return
                    if not is_valid_status_transition(str(item["status"] or ""), to_status):
                        send_json(
                            self,
                            {"message": f"Invalid status transition for {item['item_code']}: {item['status']} -> {to_status}"},
                            400,
                        )
                        return

                    if action == "GIVING" and fill_state == "FULL":
                        cur.execute(
                            """
                            SELECT id, dc_book_id, dc_number, transferred_at
                            FROM item_transfers
                            WHERE item_id = ?
                              AND reason LIKE 'TRANSITION_GIVING%'
                              AND linked_taking_at IS NULL
                            ORDER BY transferred_at ASC
                            LIMIT 1
                            """,
                            (item_id,),
                        )
                        pending_cycle = cur.fetchone()
                        if pending_cycle is not None:
                            pending_ref = (
                                f"{pending_cycle['dc_book_id']}-{int(pending_cycle['dc_number'] or 0)}"
                                if pending_cycle["dc_book_id"] and pending_cycle["dc_number"] is not None
                                else str(pending_cycle["id"] or "")
                            )
                            send_json(
                                self,
                                {
                                    "message": (
                                        f"Cycle not completed for {item['item_code']}. "
                                        f"Return EMPTY for oldest open dispatch first ({pending_ref}, {pending_cycle['transferred_at']})."
                                    )
                                },
                                409,
                            )
                            return

                    updated_cycle_count = compute_next_cycle_count(
                        str(item["fill_state"] or "EMPTY"),
                        fill_state,
                        int(item["cycle_count"] or 0),
                    )
                    warning_active, warning_reason, _ = evaluate_item_warning(updated_cycle_count, item["created_at"])

                    cur.execute(
                        """
                        UPDATE items
                        SET fill_state = ?, cycle_count = ?, warning_active = ?, warning_reason = ?, status = ?, current_holder_user_id = ?, current_location = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            fill_state,
                            updated_cycle_count,
                            1 if warning_active else 0,
                            warning_reason or None,
                            to_status,
                            new_holder_user_id,
                            to_location,
                            utc_now_iso(),
                            item_id,
                        ),
                    )
                    delivery_no = generate_next_delivery_no(conn)
                    transfer_dc_book_id = dc_book_id if action == "GIVING" and fill_state == "FULL" else None
                    transfer_dc_number = dc_number_for_transition if action == "GIVING" and fill_state == "FULL" else None
                    if linked_taking_enabled:
                        cur.execute(
                            """
                            SELECT id, dc_book_id, dc_number, transferred_at
                            FROM item_transfers
                            WHERE item_id = ?
                              AND reason LIKE 'TRANSITION_GIVING%'
                              AND linked_taking_at IS NULL
                            ORDER BY transferred_at ASC
                            LIMIT 1
                            """,
                            (item_id,),
                        )
                        oldest_open = cur.fetchone()
                        if oldest_open is None:
                            send_json(
                                self,
                                {
                                    "message": (
                                        f"No open GIVING transfer found for {item['item_code']}"
                                    )
                                },
                                400,
                            )
                            return
                        oldest_book_id = str(oldest_open["dc_book_id"] or "").strip()
                        oldest_dc_number = int(oldest_open["dc_number"] or 0)
                        if oldest_book_id != link_dc_book_id or oldest_dc_number != int(link_dc_number or 0):
                            send_json(
                                self,
                                {
                                    "message": (
                                        f"Date priority rule: link oldest open dispatch first for {item['item_code']} "
                                        f"({oldest_book_id}-{oldest_dc_number}, {oldest_open['transferred_at']})"
                                    )
                                },
                                409,
                            )
                            return

                        cur.execute(
                            """
                            SELECT id
                            FROM item_transfers
                            WHERE item_id = ?
                              AND dc_book_id = ?
                              AND dc_number = ?
                              AND reason LIKE 'TRANSITION_GIVING%'
                              AND linked_taking_at IS NULL
                            ORDER BY transferred_at DESC
                            LIMIT 1
                            """,
                            (item_id, link_dc_book_id, link_dc_number),
                        )
                        linked_transfer = cur.fetchone()
                        if linked_transfer is None:
                            send_json(
                                self,
                                {
                                    "message": (
                                        f"No open GIVING transfer found for {item['item_code']} "
                                        f"with DC {link_dc_book_id}-{link_dc_number}"
                                    )
                                },
                                400,
                            )
                            return

                        cur.execute(
                            """
                            UPDATE item_transfers
                            SET linked_taking_at = ?,
                                linked_taking_by = ?,
                                linked_taking_process_id = ?,
                                linked_taking_delivery_no = ?,
                                linked_taking_source_type = ?,
                                linked_taking_source_user_id = ?,
                                linked_taking_to_status = ?,
                                linked_taking_to_location = ?,
                                linked_taking_fill_state = 'EMPTY'
                            WHERE id = ?
                            """,
                            (
                                utc_now_iso(),
                                session_user["id"],
                                process_id,
                                delivery_no,
                                source_type,
                                source_user_id or None,
                                to_status,
                                to_location,
                                linked_transfer["id"],
                            ),
                        )
                        transfer_dc_book_id = link_dc_book_id
                        transfer_dc_number = link_dc_number
                    else:
                        cur.execute(
                            """
                            INSERT INTO item_transfers (
                                id, transition_process_id, delivery_no, item_id, from_status, to_status, from_location, to_location, dc_book_id, dc_number, reason, transferred_by, transferred_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                secrets.token_hex(16),
                                process_id,
                                delivery_no,
                                item_id,
                                item["status"],
                                to_status,
                                item["current_location"],
                                to_location,
                                transfer_dc_book_id,
                                transfer_dc_number,
                                f"TRANSITION_{action}_{source_type}",
                                session_user["id"],
                                utc_now_iso(),
                            ),
                        )

                    if action == "GIVING":
                        notify_admin_roles(
                            conn,
                            notification_type="DELIVERY_UPDATE",
                            title="Transition Delivery Update",
                            message=(
                                f"{session_user['full_name']} delivered item {item['item_code']} via transition"
                                f" from {source_type} to {dispatch_user['full_name'] if dispatch_user is not None else dispatch_target_type.title()}"
                            ),
                            delivery_no=delivery_no,
                            from_user_id=session_user["id"],
                            from_user_name=session_user["full_name"],
                            item_id=item_id,
                            item_code=item["item_code"],
                            item_title=item["title"] or item["item_code"],
                            meta={
                                "action": action,
                                "source_type": source_type,
                                "dispatch_target_type": dispatch_target_type if action == "GIVING" else None,
                                "dispatch_user_id": dispatch_user_id if action == "GIVING" and dispatch_target_type == "USER" else None,
                                "dispatch_customer_name": dispatch_customer_name if action == "GIVING" and dispatch_target_type == "CUSTOMER" else None,
                                "reject_empty_items": bool(dispatch_user["reject_empty_items"]) if dispatch_user is not None else False,
                                "reject_full_items": bool(dispatch_user["reject_full_items"]) if dispatch_user is not None else False,
                                "to_status": to_status,
                                "to_location": to_location,
                                "source_user_id": source_user_id or None,
                                "dc_book_id": transfer_dc_book_id,
                                "dc_number": transfer_dc_number,
                            },
                        )
                    processed_items.append(item["item_code"])
                    processed_deliveries.append(
                        {
                            "item_code": item["item_code"],
                            "delivery_no": delivery_no,
                            "dc_book_id": transfer_dc_book_id,
                            "dc_number": transfer_dc_number,
                            "dispatch_target_type": dispatch_target_type if action == "GIVING" else None,
                            "dispatch_user_id": dispatch_user_id if action == "GIVING" and dispatch_target_type == "USER" else None,
                            "dispatch_customer_name": dispatch_customer_name if action == "GIVING" and dispatch_target_type == "CUSTOMER" else None,
                            "linked_taking": bool(linked_taking_enabled),
                        }
                    )

                write_audit(
                    conn,
                    session_user["id"],
                    "ITEM_TRANSITION_SUBMIT",
                    "ITEM",
                    ",".join(processed_items),
                    {
                        "action": action,
                        "source_type": source_type,
                        "source_user_id": source_user_id or None,
                        "dispatch_target_type": dispatch_target_type if action == "GIVING" else None,
                        "dispatch_user_id": dispatch_user_id if action == "GIVING" and dispatch_target_type == "USER" else None,
                        "dispatch_customer_name": dispatch_customer_name if action == "GIVING" and dispatch_target_type == "CUSTOMER" else None,
                        "reject_empty_items": bool(dispatch_user["reject_empty_items"]) if dispatch_user is not None else False,
                        "reject_full_items": bool(dispatch_user["reject_full_items"]) if dispatch_user is not None else False,
                        "process_id": process_id,
                        "dc_book_id": dc_book_id or None,
                        "dc_number": dc_number_for_transition,
                        "link_dc_book_id": link_dc_book_id or None,
                        "link_dc_number": link_dc_number,
                        "linked_taking": bool(linked_taking_enabled),
                        "processed_items": processed_items,
                        "processed_deliveries": processed_deliveries,
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "CREATE", "TRANSITION", process_id, ",".join(processed_items))
                conn.commit()
                send_json(self, {"ok": True, "processed": len(processed_items), "process_id": process_id})
                return

            if path == "/api/transition/target-policy/upsert":
                if not role_allowed(session_user["role"], ALLOWED_ROLES):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"target_type", "target_key", "reject_empty_items"},
                    required_fields={"target_type", "target_key", "reject_empty_items"},
                )
                target_type = str(payload.get("target_type", "")).strip().upper()
                target_key_raw = str(payload.get("target_key", "")).strip()
                reject_empty_items_raw = payload.get("reject_empty_items", False)

                if target_type not in {"USER", "CUSTOMER"}:
                    send_json(self, {"message": "target_type must be USER or CUSTOMER"}, 400)
                    return
                if len(target_key_raw) < 2 or len(target_key_raw) > 120:
                    send_json(self, {"message": "target_key must be between 2 and 120 characters"}, 400)
                    return

                if isinstance(reject_empty_items_raw, bool):
                    reject_empty_items = reject_empty_items_raw
                elif isinstance(reject_empty_items_raw, (int, float)):
                    reject_empty_items = int(reject_empty_items_raw) == 1
                elif isinstance(reject_empty_items_raw, str):
                    reject_empty_items = reject_empty_items_raw.strip().lower() in {"1", "true", "yes", "on"}
                else:
                    send_json(self, {"message": "reject_empty_items must be a boolean"}, 400)
                    return

                target_key = target_key_raw.lower() if target_type == "CUSTOMER" else target_key_raw
                if target_type == "USER":
                    cur = conn.cursor()
                    cur.execute("SELECT id FROM users WHERE id = ? AND is_active = 1", (target_key,))
                    if cur.fetchone() is None:
                        send_json(self, {"message": "Target user not found"}, 404)
                        return

                now_iso = utc_now_iso()
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO transition_target_policies (target_type, target_key, reject_empty_items, created_by_user_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(target_type, target_key)
                    DO UPDATE SET reject_empty_items = excluded.reject_empty_items,
                                  updated_at = excluded.updated_at,
                                  created_by_user_id = excluded.created_by_user_id
                    """,
                    (target_type, target_key, 1 if reject_empty_items else 0, session_user["id"], now_iso, now_iso),
                )
                write_audit(
                    conn,
                    session_user["id"],
                    "TRANSITION_TARGET_POLICY_UPSERT",
                    "TRANSITION_TARGET_POLICY",
                    f"{target_type}:{target_key}",
                    {
                        "target_type": target_type,
                        "target_key": target_key,
                        "reject_empty_items": reject_empty_items,
                    },
                    self,
                )
                conn.commit()
                send_json(
                    self,
                    {
                        "ok": True,
                        "data": {
                            "target_type": target_type,
                            "target_key": target_key,
                            "reject_empty_items": reject_empty_items,
                        },
                    },
                )
                return

            if path == "/api/logs/verify":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT action, entity_type, entity_id, payload_json, previous_checksum, checksum
                    FROM audit_logs
                    ORDER BY rowid ASC
                    LIMIT 10000
                    """
                )
                rows = cur.fetchall()
                expected_previous = "GENESIS"
                mismatches = 0
                total = 0
                for row in rows:
                    total += 1
                    expected = log_checksum(
                        row["previous_checksum"],
                        row["action"],
                        row["entity_type"],
                        row["entity_id"] or "",
                        row["payload_json"],
                    )
                    if row["previous_checksum"] != expected_previous or row["checksum"] != expected:
                        mismatches += 1
                    expected_previous = row["checksum"]

                send_json(
                    self,
                    {
                        "total": total,
                        "mismatches": mismatches,
                        "verified": mismatches == 0,
                        "capped": total == 10000,
                        "message": "Logs are consistent" if mismatches == 0 else "Log mismatch detected",
                    },
                )
                return

            if path == "/api/super-admin/delete-item":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"item_id"},
                    required_fields={"item_id"},
                )
                item_id = str(payload.get("item_id", "")).strip()
                if not item_id:
                    send_json(self, {"message": "item_id is required"}, 400)
                    return
                cur = conn.cursor()
                cur.execute("SELECT id, item_code FROM items WHERE id = ?", (item_id,))
                item = cur.fetchone()
                if item is None:
                    send_json(self, {"message": "Item not found"}, 404)
                    return
                cur.execute("DELETE FROM item_transfers WHERE item_id = ?", (item_id,))
                cur.execute("DELETE FROM custom_item_ids WHERE item_id = ?", (item_id,))
                cur.execute("DELETE FROM items WHERE id = ?", (item_id,))
                write_audit(conn, session_user["id"], "SUPER_ADMIN_DELETE_ITEM", "ITEM", item_id, {"item_code": item["item_code"]}, self)
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "DELETE", "ITEM", item_id, item["item_code"])
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/super-admin/delete-user":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"user_id"},
                    required_fields={"user_id"},
                )
                user_id = str(payload.get("user_id", "")).strip()
                if not user_id:
                    send_json(self, {"message": "user_id is required"}, 400)
                    return
                if user_id == session_user["id"]:
                    send_json(self, {"message": "Cannot delete current Super Admin session user"}, 400)
                    return
                cur = conn.cursor()
                cur.execute("SELECT id, role, email FROM users WHERE id = ?", (user_id,))
                target_user = cur.fetchone()
                if target_user is None:
                    send_json(self, {"message": "User not found"}, 404)
                    return
                if target_user["role"] == "SUPER_ADMIN":
                    send_json(self, {"message": "Cannot delete another Super Admin"}, 400)
                    return
                backup_info, _ = export_user_backup(
                    conn,
                    session_user,
                    target_user_id=user_id,
                    backup_kind="USER",
                    file_hint=f"pre-delete-user-{target_user['email']}",
                )
                cur.execute("UPDATE items SET current_holder_user_id = NULL WHERE current_holder_user_id = ?", (user_id,))
                # Nullify order references to preserve order history integrity
                cur.execute(
                    "UPDATE customer_orders SET created_by_user_name = '[deleted]' WHERE created_by_user_id = ?",
                    (user_id,),
                )
                cur.execute(
                    "UPDATE customer_orders SET approved_by_user_id = NULL, approved_by_user_name = '[deleted]' WHERE approved_by_user_id = ?",
                    (user_id,),
                )
                cur.execute(
                    "UPDATE customer_orders SET delivery_user_id = NULL, delivery_user_name = '[deleted]' WHERE delivery_user_id = ?",
                    (user_id,),
                )
                cur.execute(
                    "UPDATE customer_orders SET delivered_by_user_id = NULL, delivered_by_user_name = '[deleted]' WHERE delivered_by_user_id = ?",
                    (user_id,),
                )
                # Anonymise notification references
                cur.execute(
                    "UPDATE notifications SET from_user_id = NULL, from_user_name = '[deleted]' WHERE from_user_id = ?",
                    (user_id,),
                )
                cur.execute("DELETE FROM item_transfers WHERE transferred_by = ?", (user_id,))
                cur.execute("DELETE FROM transition_processes WHERE created_by_user_id = ?", (user_id,))
                cur.execute("DELETE FROM login_system_controls WHERE user_id = ?", (user_id,))
                cur.execute("DELETE FROM navigation_events WHERE user_id = ?", (user_id,))
                cur.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
                cur.execute("DELETE FROM users WHERE id = ?", (user_id,))
                write_audit(
                    conn,
                    session_user["id"],
                    "SUPER_ADMIN_DELETE_USER",
                    "USER",
                    user_id,
                    {"email": target_user["email"], "backup_file_name": backup_info["file_name"]},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "DELETE", "USER", user_id, target_user["email"])
                conn.commit()
                send_json(self, {"ok": True, "backup_file_name": backup_info["file_name"]})
                return

            if path == "/api/super-admin/reset-user-password":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"user_id", "new_password", "confirm_password"},
                    required_fields={"user_id", "new_password", "confirm_password"},
                )
                user_id = str(payload.get("user_id", "")).strip()
                new_password = str(payload.get("new_password", ""))
                confirm_password = str(payload.get("confirm_password", ""))

                if not user_id:
                    send_json(self, {"message": "user_id is required"}, 400)
                    return
                if not new_password:
                    send_json(self, {"message": "new_password is required"}, 400)
                    return
                if new_password != confirm_password:
                    send_json(self, {"message": "New password and confirm password must match"}, 400)
                    return
                password_error = validate_password(new_password)
                if password_error:
                    send_json(self, {"message": password_error}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id, email, role FROM users WHERE id = ?", (user_id,))
                target_user = cur.fetchone()
                if target_user is None:
                    send_json(self, {"message": "User not found"}, 404)
                    return
                if str(target_user["role"] or "").strip().upper() == "SUPER_ADMIN":
                    send_json(self, {"message": "Super Admin password can be reset only from Profile page"}, 403)
                    return

                now = utc_now_iso()
                cur.execute(
                    """
                    UPDATE users
                    SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = ?
                    WHERE id = ?
                    """,
                    (hash_password(new_password), now, user_id),
                )
                cur.execute("UPDATE user_sessions SET is_active = 0 WHERE user_id = ?", (user_id,))

                write_audit(
                    conn,
                    session_user["id"],
                    "SUPER_ADMIN_RESET_USER_PASSWORD",
                    "USER",
                    user_id,
                    {
                        "email": target_user["email"],
                        "role": target_user["role"],
                        "password_changed": True,
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "USER", user_id, target_user["email"])
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/super-admin/item-categories/upsert":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"category_key", "category_name", "category_type", "code_prefix", "prefixes", "range_start", "range_end", "is_active"},
                    required_fields={"category_name", "category_type"},
                )
                incoming_category_key = str(payload.get("category_key", "")).strip().upper()
                category_name = normalize_category_name(payload.get("category_name", ""))
                try:
                    category_type = normalize_category_type(payload.get("category_type"))
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return
                if not category_type:
                    send_json(self, {"message": "Category type is required"}, 400)
                    return
                if len(category_name) < 2 or len(category_name) > 80:
                    send_json(self, {"message": "Category must be between 2 and 80 characters"}, 400)
                    return

                category_key_from_name_value = category_key_from_name(category_name)
                category_key = incoming_category_key or category_key_from_name_value
                fallback_prefix = category_prefix_from_name(category_name)
                try:
                    requested_active_prefix = normalize_code_prefix(payload.get("code_prefix", fallback_prefix))
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return
                prefix_list = normalize_prefix_list(payload.get("prefixes"), requested_active_prefix)
                if requested_active_prefix not in prefix_list:
                    prefix_list.insert(0, requested_active_prefix)

                try:
                    range_start = parse_positive_int_or_none(payload.get("range_start"), "range_start")
                    range_end = parse_positive_int_or_none(payload.get("range_end"), "range_end")
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return
                if range_start is not None and range_end is not None and range_end < range_start:
                    send_json(self, {"message": "range_end must be greater than or equal to range_start"}, 400)
                    return

                is_active = payload.get("is_active")
                active_flag = 1 if is_active is None else (1 if bool(is_active) else 0)
                now = utc_now_iso()
                cur = conn.cursor()

                if incoming_category_key:
                    cur.execute("SELECT category_key FROM item_categories WHERE category_key = ?", (category_key,))
                    existing_row = cur.fetchone()
                    if existing_row is None:
                        send_json(self, {"message": "Category not found"}, 404)
                        return
                    if category_key_from_name_value != category_key:
                        cur.execute("SELECT category_key FROM item_categories WHERE category_key = ?", (category_key_from_name_value,))
                        conflict_row = cur.fetchone()
                        if conflict_row is not None:
                            send_json(self, {"message": "Category name already exists"}, 409)
                            return
                else:
                    ensure_item_category(conn, category_name, category_type=category_type, enforce_existing_type=False, now_iso=now)

                cur.execute(
                    """
                    UPDATE item_categories
                    SET category_name = ?, item_type = ?, code_prefix = ?, code_prefixes_json = ?, range_start = ?, range_end = ?, is_active = ?, updated_at = ?
                    WHERE category_key = ?
                    """,
                    (
                        category_name,
                        category_type,
                        requested_active_prefix,
                        json.dumps(prefix_list, separators=(",", ":"), sort_keys=False),
                        range_start,
                        range_end,
                        active_flag,
                        now,
                        category_key,
                    ),
                )

                cur.execute("SELECT next_value FROM item_category_sequences WHERE category_key = ?", (category_key,))
                sequence_row = cur.fetchone()
                if sequence_row is None:
                    initial_next = range_start if range_start is not None else 1
                    cur.execute(
                        "INSERT INTO item_category_sequences (category_key, next_value, updated_at) VALUES (?, ?, ?)",
                        (category_key, initial_next, now),
                    )
                elif range_start is not None and int(sequence_row["next_value"]) < range_start:
                    cur.execute(
                        "UPDATE item_category_sequences SET next_value = ?, updated_at = ? WHERE category_key = ?",
                        (range_start, now, category_key),
                    )

                write_audit(
                    conn,
                    session_user["id"],
                    "SUPER_ADMIN_ITEM_CATEGORY_RULE_UPSERT",
                    "ITEM_CATEGORY",
                    category_key,
                    {
                        "category_name": category_name,
                        "category_type": category_type,
                        "code_prefix": requested_active_prefix,
                        "prefixes": prefix_list,
                        "range_start": range_start,
                        "range_end": range_end,
                        "is_active": bool(active_flag),
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "ITEM_CATEGORY", category_key, category_name)
                conn.commit()
                send_json(
                    self,
                    {
                        "ok": True,
                        "data": {
                            "category_key": category_key,
                            "category_name": category_name,
                            "category_type": category_type,
                            "code_prefix": requested_active_prefix,
                            "prefixes": prefix_list,
                            "range_start": range_start,
                            "range_end": range_end,
                            "is_active": bool(active_flag),
                        },
                    },
                )
                return

            if path == "/api/super-admin/item-categories/delete":
                if self.command != "DELETE":
                    send_json(self, {"message": "Method not allowed"}, 405)
                    return
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"category_name", "category_key"},
                    required_fields=set(),
                )
                category_key = str(payload.get("category_key", "")).strip().upper()
                category_name = normalize_category_name(payload.get("category_name", ""))
                if not category_key and category_name:
                    category_key = category_key_from_name(category_name)
                if not category_key:
                    send_json(self, {"message": "category_key or category_name is required"}, 400)
                    return
                
                cur = conn.cursor()
                cur.execute("SELECT category_key FROM item_categories WHERE category_key = ?", (category_key,))
                if cur.fetchone() is None:
                    send_json(self, {"message": "Category not found"}, 404)
                    return
                
                # Delete the category and its sequence
                cur.execute("DELETE FROM item_category_sequences WHERE category_key = ?", (category_key,))
                cur.execute("DELETE FROM item_categories WHERE category_key = ?", (category_key,))
                
                write_audit(
                    conn,
                    session_user["id"],
                    "SUPER_ADMIN_ITEM_CATEGORY_RULE_DELETE",
                    "ITEM_CATEGORY",
                    category_key,
                    {"category_name": category_name, "category_key": category_key},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "DELETE", "ITEM_CATEGORY", category_key, category_name)
                conn.commit()
                send_json(self, {"ok": True, "message": "Category deleted"})
                return

            if path == "/api/super-admin/volume-units/upsert":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"unit_name"},
                    required_fields={"unit_name"},
                )
                unit_name = str(payload.get("unit_name", "")).strip().upper()
                unit_name = re.sub(r"\s+", "_", unit_name)
                if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,39}", unit_name):
                    send_json(self, {"message": "Volume unit must be 2-40 chars using A-Z, 0-9, underscore"}, 400)
                    return
                now = utc_now_iso()
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO volume_units (unit_name, is_active, created_by_user_id, created_at, updated_at)
                    VALUES (?, 1, ?, ?, ?)
                    ON CONFLICT(unit_name) DO UPDATE SET is_active = 1, updated_at = excluded.updated_at
                    """,
                    (unit_name, session_user["id"], now, now),
                )
                write_audit(
                    conn,
                    session_user["id"],
                    "SUPER_ADMIN_VOLUME_UNIT_UPSERT",
                    "VOLUME_UNIT",
                    unit_name,
                    {"unit_name": unit_name, "is_active": True},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "VOLUME_UNIT", unit_name, unit_name)
                conn.commit()
                send_json(self, {"ok": True, "data": {"unit_name": unit_name, "is_active": True}})
                return

            if path == "/api/super-admin/volume-units/delete":
                if self.command != "DELETE":
                    send_json(self, {"message": "Method not allowed"}, 405)
                    return
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"unit_name"},
                    required_fields={"unit_name"},
                )
                unit_name = str(payload.get("unit_name", "")).strip().upper()
                if not unit_name:
                    send_json(self, {"message": "unit_name is required"}, 400)
                    return
                cur = conn.cursor()
                cur.execute("SELECT unit_name FROM volume_units WHERE unit_name = ?", (unit_name,))
                if cur.fetchone() is None:
                    send_json(self, {"message": "Volume unit not found"}, 404)
                    return
                cur.execute(
                    "SELECT COUNT(1) AS count FROM items WHERE item_type = 'CYLINDER' AND UPPER(TRIM(volume_unit)) = ?",
                    (unit_name,),
                )
                used_count = int(cur.fetchone()["count"])
                if used_count > 0:
                    send_json(self, {"message": "Cannot delete volume unit already used by items"}, 409)
                    return
                cur.execute("DELETE FROM volume_units WHERE unit_name = ?", (unit_name,))
                write_audit(
                    conn,
                    session_user["id"],
                    "SUPER_ADMIN_VOLUME_UNIT_DELETE",
                    "VOLUME_UNIT",
                    unit_name,
                    {"unit_name": unit_name},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "DELETE", "VOLUME_UNIT", unit_name, unit_name)
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/super-admin/custom-item-ids/upsert":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"item_id", "custom_id", "reassign_from_existing"},
                    required_fields={"item_id", "custom_id"},
                )
                item_id = str(payload.get("item_id", "")).strip()
                raw_custom_id = payload.get("custom_id", "")
                try:
                    reassign_from_existing = parse_boolean_field(payload, "reassign_from_existing", default=False)
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return
                if not item_id:
                    send_json(self, {"message": "item_id is required"}, 400)
                    return
                try:
                    custom_id = normalize_custom_id(raw_custom_id)
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT id, item_code FROM items WHERE id = ?", (item_id,))
                item_row = cur.fetchone()
                if item_row is None:
                    send_json(self, {"message": "Item not found"}, 404)
                    return

                cur.execute("SELECT item_id FROM custom_item_ids WHERE custom_id = ?", (custom_id,))
                custom_id_owner = cur.fetchone()
                if custom_id_owner is not None and str(custom_id_owner["item_id"] or "") != item_id:
                    owner_item_id = str(custom_id_owner["item_id"] or "")
                    if not reassign_from_existing:
                        send_json(
                            self,
                            {
                                "message": "custom_id already exists",
                                "conflict_item_id": owner_item_id,
                                "can_reassign": True,
                            },
                            409,
                        )
                        return
                    cur.execute("DELETE FROM custom_item_ids WHERE item_id = ?", (owner_item_id,))

                now = utc_now_iso()
                cur.execute(
                    """
                    INSERT INTO custom_item_ids (item_id, custom_id, created_by_user_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(item_id) DO UPDATE SET
                        custom_id = excluded.custom_id,
                        updated_at = excluded.updated_at
                    """,
                    (item_id, custom_id, session_user["id"], now, now),
                )

                write_audit(
                    conn,
                    session_user["id"],
                    "SUPER_ADMIN_CUSTOM_ITEM_ID_UPSERT",
                    "ITEM",
                    item_id,
                    {
                        "item_id": item_id,
                        "item_code": item_row["item_code"],
                        "custom_id": custom_id,
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "UPDATE", "ITEM", item_id, item_row["item_code"])
                conn.commit()
                send_json(self, {"ok": True, "data": {"item_id": item_id, "item_code": item_row["item_code"], "custom_id": custom_id}})
                return

            if path == "/api/super-admin/custom-item-ids/delete":
                if self.command != "DELETE":
                    send_json(self, {"message": "Method not allowed"}, 405)
                    return
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"item_id", "custom_id"},
                    required_fields=set(),
                )
                item_id = str(payload.get("item_id", "")).strip()
                custom_id_raw = str(payload.get("custom_id", "")).strip()
                custom_id = custom_id_raw.upper() if custom_id_raw else ""
                if not item_id and not custom_id:
                    send_json(self, {"message": "item_id or custom_id is required"}, 400)
                    return

                cur = conn.cursor()
                target_row = None
                if item_id:
                    cur.execute("SELECT item_id, custom_id FROM custom_item_ids WHERE item_id = ?", (item_id,))
                    target_row = cur.fetchone()
                else:
                    cur.execute("SELECT item_id, custom_id FROM custom_item_ids WHERE custom_id = ?", (custom_id,))
                    target_row = cur.fetchone()
                if target_row is None:
                    send_json(self, {"message": "Custom ID mapping not found"}, 404)
                    return

                target_item_id = str(target_row["item_id"] or "")
                target_custom_id = str(target_row["custom_id"] or "")
                cur.execute("DELETE FROM custom_item_ids WHERE item_id = ?", (target_item_id,))

                write_audit(
                    conn,
                    session_user["id"],
                    "SUPER_ADMIN_CUSTOM_ITEM_ID_DELETE",
                    "ITEM",
                    target_item_id,
                    {
                        "item_id": target_item_id,
                        "custom_id": target_custom_id,
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "DELETE", "ITEM_CUSTOM_ID", target_item_id, target_custom_id)
                conn.commit()
                send_json(self, {"ok": True})
                return

            if path == "/api/super-admin/dc-books/create":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"book_id", "range_start", "range_end", "is_active"},
                    required_fields={"book_id"},
                )
                book_id = normalize_dc_book_id(payload.get("book_id", ""))
                range_start_raw = payload.get("range_start", 0)
                range_end_raw = payload.get("range_end", 100)
                try:
                    is_active = parse_boolean_field(payload, "is_active", default=True)
                except ValueError as exc:
                    send_json(self, {"message": str(exc)}, 400)
                    return

                if not book_id:
                    send_json(self, {"message": "book_id is required and must be alphanumeric with optional . _ -"}, 400)
                    return

                try:
                    range_start = int(range_start_raw)
                    range_end = int(range_end_raw)
                except Exception:
                    send_json(self, {"message": "range_start and range_end must be integers"}, 400)
                    return

                if range_start < 0 or range_end < 0:
                    send_json(self, {"message": "range_start and range_end must be non-negative"}, 400)
                    return
                if range_end < range_start:
                    send_json(self, {"message": "range_end must be greater than or equal to range_start"}, 400)
                    return

                next_dc_number = range_start if range_start > 0 else 1
                if next_dc_number > range_end:
                    send_json(self, {"message": "Range does not allow any usable DC number"}, 400)
                    return

                cur = conn.cursor()
                cur.execute("SELECT book_id FROM dc_books WHERE book_id = ?", (book_id,))
                if cur.fetchone() is not None:
                    send_json(self, {"message": "DC book already exists"}, 409)
                    return

                now = utc_now_iso()
                cur.execute(
                    """
                    INSERT INTO dc_books (
                        book_id, range_start, range_end, next_dc_number, is_active, created_by_user_id, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (book_id, range_start, range_end, next_dc_number, 1 if is_active else 0, session_user["id"], now, now),
                )
                write_audit(
                    conn,
                    session_user["id"],
                    "SUPER_ADMIN_DC_BOOK_CREATE",
                    "DC_BOOK",
                    book_id,
                    {
                        "book_id": book_id,
                        "range_start": range_start,
                        "range_end": range_end,
                        "next_dc_number": next_dc_number,
                        "is_active": is_active,
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "CREATE", "DC_BOOK", book_id, book_id)
                conn.commit()
                send_json(
                    self,
                    {
                        "ok": True,
                        "book_id": book_id,
                        "range_start": range_start,
                        "range_end": range_end,
                        "next_dc_number": next_dc_number,
                    },
                    201,
                )
                return

            if path == "/api/super-admin/reset-table":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"table_name"},
                    required_fields={"table_name"},
                )
                table_name = str(payload.get("table_name", "")).strip().lower()
                allowed_tables = {
                    "users",
                    "companies",
                    "company_locations",
                    "items",
                    "custom_item_ids",
                    "item_categories",
                    "item_category_sequences",
                    "dc_books",
                    "transition_processes",
                    "transition_target_policies",
                    "item_transfers",
                    "customer_orders",
                    "notifications",
                    "user_sessions",
                    "navigation_events",
                    "login_system_controls",
                    "activity_logs",
                    "audit_logs",
                }
                if table_name not in allowed_tables:
                    send_json(self, {"message": "Invalid table name"}, 400)
                    return
                cur = conn.cursor()
                backup_info = export_full_backup(
                    conn,
                    session_user,
                    backup_kind="FULL",
                    file_hint=f"pre-reset-table-{table_name}",
                )
                if table_name == "users":
                    cur.execute("DELETE FROM company_locations")
                    cur.execute("DELETE FROM companies")
                    cur.execute("DELETE FROM items")
                    cur.execute("DELETE FROM custom_item_ids")
                    cur.execute("DELETE FROM item_categories")
                    cur.execute("DELETE FROM item_category_sequences")
                    cur.execute("DELETE FROM dc_books")
                    cur.execute("DELETE FROM transition_processes")
                    cur.execute("DELETE FROM transition_target_policies")
                    cur.execute("DELETE FROM item_transfers")
                    cur.execute("DELETE FROM user_sessions")
                    cur.execute("DELETE FROM login_system_controls")
                    cur.execute("DELETE FROM navigation_events")
                    cur.execute("DELETE FROM users WHERE id != ?", (session_user["id"],))
                else:
                    cur.execute(f"DELETE FROM {table_name}")
                if table_name in {"items", "users"}:
                    if table_name == "items":
                        cur.execute("DELETE FROM custom_item_ids")
                        cur.execute("DELETE FROM item_code_sequence")
                        cur.execute("DELETE FROM item_category_sequences")
                        cur.execute("DELETE FROM item_categories")
                    if table_name == "users":
                        cur.execute("DELETE FROM user_code_sequence")
                write_audit(
                    conn,
                    session_user["id"],
                    "SUPER_ADMIN_RESET_TABLE",
                    "TABLE",
                    table_name,
                    {"table_name": table_name, "backup_file_name": backup_info["file_name"]},
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "DELETE", "TABLE", table_name, table_name)
                conn.commit()
                send_json(self, {"ok": True, "backup_file_name": backup_info["file_name"]})
                return

            if path == "/api/super-admin/clear-all-data":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"confirm_text", "reason"},
                    required_fields={"confirm_text", "reason"},
                )
                confirm_text = str(payload.get("confirm_text", "")).strip()
                reason = str(payload.get("reason", "")).strip()
                if confirm_text != "CONFIRM":
                    send_json(self, {"message": "Type CONFIRM exactly"}, 400)
                    return
                if len(reason) < 3 or len(reason) > 500:
                    send_json(self, {"message": "reason must be between 3 and 500 characters"}, 400)
                    return
                cur = conn.cursor()
                summary: dict[str, int] = {}
                tracked_tables = [
                    "item_transfers",
                    "transition_target_policies",
                    "transition_processes",
                    "customer_orders",
                    "notifications",
                    "custom_item_ids",
                    "company_locations",
                    "companies",
                    "items",
                    "item_categories",
                    "item_category_sequences",
                    "dc_books",
                    "navigation_events",
                    "login_system_controls",
                    "user_sessions",
                    "activity_logs",
                    "audit_logs",
                    "users",
                    "item_code_sequence",
                    "user_code_sequence",
                    "delivery_no_sequence",
                ]
                for table_name in tracked_tables:
                    if table_name == "users":
                        cur.execute("SELECT COUNT(1) AS count FROM users WHERE id != ?", (session_user["id"],))
                    elif table_name == "user_sessions":
                        cur.execute("SELECT COUNT(1) AS count FROM user_sessions WHERE id != ?", (session_user["session_id"],))
                    else:
                        cur.execute(f"SELECT COUNT(1) AS count FROM {table_name}")
                    summary[table_name] = int(cur.fetchone()["count"])
                backup_info = export_full_backup(conn, session_user, backup_kind="FULL", file_hint="pre-clear-all-data")
                cur.execute("DELETE FROM item_transfers")
                cur.execute("DELETE FROM transition_target_policies")
                cur.execute("DELETE FROM customer_orders")
                cur.execute("DELETE FROM notifications")
                cur.execute("DELETE FROM custom_item_ids")
                cur.execute("DELETE FROM company_locations")
                cur.execute("DELETE FROM companies")
                cur.execute("DELETE FROM items")
                cur.execute("DELETE FROM item_categories")
                cur.execute("DELETE FROM item_category_sequences")
                cur.execute("DELETE FROM dc_books")
                cur.execute("DELETE FROM transition_processes")
                cur.execute("DELETE FROM navigation_events")
                cur.execute("DELETE FROM login_system_controls")
                cur.execute("DELETE FROM user_sessions WHERE id != ?", (session_user["session_id"],))
                cur.execute("DELETE FROM activity_logs")
                cur.execute("DELETE FROM audit_logs")
                cur.execute("DELETE FROM users WHERE id != ?", (session_user["id"],))
                cur.execute("DELETE FROM item_code_sequence")
                cur.execute("DELETE FROM user_code_sequence")
                cur.execute("DELETE FROM delivery_no_sequence")
                conn.commit()
                send_json(self, {"ok": True, "backup_file_name": backup_info["file_name"]})
                return

            if path == "/api/backups/export":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN", "ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body(self)
                validate_payload_fields(
                    payload,
                    allowed_fields={"backup_kind", "target_user_id"},
                    required_fields={"backup_kind"},
                )
                backup_kind = str(payload.get("backup_kind", "")).strip().upper()
                target_user_id = str(payload.get("target_user_id", "")).strip()
                if backup_kind not in {"MONTHLY", "ANNUAL", "USER", "FULL"}:
                    send_json(self, {"message": "Invalid backup kind"}, 400)
                    return
                if backup_kind == "FULL" and not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return

                if backup_kind == "USER":
                    if not target_user_id:
                        send_json(self, {"message": "target_user_id is required for user backups"}, 400)
                        return
                    backup_info, target_user = export_user_backup(
                        conn,
                        session_user,
                        target_user_id=target_user_id,
                        backup_kind=backup_kind,
                        file_hint=f"user-{target_user_id}",
                    )
                    audit_payload = {"backup_kind": backup_kind, "target_user_id": target_user_id, "target_user_email": target_user.get("email")}
                else:
                    file_hint = f"month-{utc_now().strftime('%Y-%m')}" if backup_kind == "MONTHLY" else f"year-{utc_now().strftime('%Y')}"
                    if backup_kind == "FULL":
                        file_hint = "full-system"
                    backup_info = export_full_backup(conn, session_user, backup_kind=backup_kind, file_hint=file_hint)
                    audit_payload = {"backup_kind": backup_kind}

                write_audit(conn, session_user["id"], "BACKUP_EXPORT", "BACKUP", backup_info["file_name"], audit_payload, self)
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "CREATE", "BACKUP", backup_info["file_name"], backup_kind)
                conn.commit()
                send_json(self, {"ok": True, **backup_info}, 201)
                return

            if path == "/api/backups/import":
                if not role_allowed(session_user["role"], {"SUPER_ADMIN"}):
                    send_json(self, {"message": "Forbidden"}, 403)
                    return
                payload = parse_json_body_with_limit(self, BACKUP_IMPORT_MAX_BYTES)
                validate_payload_fields(
                    payload,
                    allowed_fields={"file_name", "file_content", "source_name", "import_mode"},
                    required_fields={"import_mode"},
                )
                file_name = str(payload.get("file_name", "")).strip()
                file_content = payload.get("file_content")
                source_name = str(payload.get("source_name", "")).strip() or file_name or "uploaded-backup.json"
                import_mode = str(payload.get("import_mode", "MERGE")).strip().upper()
                if import_mode not in {"MERGE", "REPLACE"}:
                    send_json(self, {"message": "Invalid import mode"}, 400)
                    return
                if bool(file_name) == bool(file_content):
                    send_json(self, {"message": "Provide either file_name or file_content"}, 400)
                    return

                if file_name:
                    backup_payload, _, _ = load_backup_payload_from_file(file_name)
                else:
                    if not isinstance(file_content, str) or not file_content.strip():
                        send_json(self, {"message": "file_content must be a non-empty JSON string"}, 400)
                        return
                    try:
                        backup_payload = json.loads(file_content)
                    except Exception:
                        send_json(self, {"message": "Uploaded backup file contains invalid JSON"}, 400)
                        return
                    if not isinstance(backup_payload, dict):
                        send_json(self, {"message": "Uploaded backup must contain a JSON object"}, 400)
                        return

                imported_counts = import_backup_payload(conn, backup_payload, import_mode)
                write_audit(
                    conn,
                    session_user["id"],
                    "BACKUP_IMPORT",
                    "BACKUP",
                    source_name,
                    {
                        "import_mode": import_mode,
                        "backup_kind": backup_payload.get("backup_kind"),
                        "scope": backup_payload.get("scope"),
                        "imported_counts": imported_counts,
                    },
                    self,
                )
                write_activity(conn, session_user["id"], session_user["full_name"] or session_user["email"], "CREATE", "BACKUP", source_name, import_mode)
                conn.commit()
                send_json(
                    self,
                    {
                        "ok": True,
                        "imported_counts": imported_counts,
                        "backup_kind": backup_payload.get("backup_kind"),
                        "scope": backup_payload.get("scope"),
                        "reauth_required": import_mode == "REPLACE",
                    },
                )
                return

            send_json(self, {"message": "Not Found"}, 404)
        except ValueError as exc:
            send_json(self, {"message": str(exc)}, 400)
        except Exception:
            send_json(self, {"message": "Internal server error"}, 500)
        finally:
            conn.close()

    def serve_static(self, path: str) -> None:
        if path == "/":
            path = "/index.html"

        safe_path = (STATIC_DIR / path.lstrip("/")).resolve()
        if not str(safe_path).startswith(str(STATIC_DIR.resolve())):
            send_json(self, {"message": "Forbidden"}, 403)
            return

        if not safe_path.is_file():
            send_json(self, {"message": "Not Found"}, 404)
            return

        content_type = "text/plain; charset=utf-8"
        if safe_path.suffix == ".html":
            content_type = "text/html; charset=utf-8"
        elif safe_path.suffix == ".js":
            content_type = "application/javascript; charset=utf-8"
        elif safe_path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif safe_path.suffix == ".json":
            content_type = "application/json; charset=utf-8"

        data = safe_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    init_db()
    httpd = ThreadingHTTPServer((HOST, PORT), TrackingHandler)
    print(f"No-framework app running at http://{HOST}:{PORT}")
    httpd.serve_forever()


if __name__ == "__main__":
    if sys.version_info < (3, 10):
        raise RuntimeError("Python 3.10+ is required")
    main()
