import sqlite3
import json
import os
import threading
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "projects.db")

# Thread-local storage for SQLite connections (one connection per thread)
_local = threading.local()


def get_db() -> sqlite3.Connection:
    """Get a thread-local database connection with WAL mode for concurrent access."""
    if not hasattr(_local, "connection") or _local.connection is None:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        _local.connection = conn
    return _local.connection


def close_db():
    """Close the thread-local database connection."""
    if hasattr(_local, "connection") and _local.connection is not None:
        try:
            _local.connection.close()
        except Exception:
            pass
        _local.connection = None


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            plan TEXT DEFAULT 'starter',
            model TEXT DEFAULT 'claude-sonnet-4-6',
            status TEXT DEFAULT 'pending',
            current_agent TEXT DEFAULT 'planner',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            total_cost REAL DEFAULT 0.0,
            output_path TEXT
        );

        CREATE TABLE IF NOT EXISTS agent_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            agent_name TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            input_data TEXT,
            output_data TEXT,
            tokens_used INTEGER DEFAULT 0,
            cost REAL DEFAULT 0.0,
            started_at TEXT,
            completed_at TEXT,
            error TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL UNIQUE,
            api_key TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            amount REAL NOT NULL,
            plan TEXT NOT NULL,
            ai_cost REAL DEFAULT 0.0,
            platform_fee REAL DEFAULT 0.0,
            status TEXT DEFAULT 'pending',
            stripe_payment_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        );
    """)
    conn.commit()


def create_project(project_id, name, description, plan, model):
    conn = get_db()
    conn.execute(
        "INSERT INTO projects (id, name, description, plan, model) VALUES (?, ?, ?, ?, ?)",
        (project_id, name, description, plan, model),
    )
    conn.commit()


def update_project(project_id, **kwargs):
    if not kwargs:
        return
    conn = get_db()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    values = list(kwargs.values()) + [project_id]
    conn.execute(f"UPDATE projects SET {sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
    conn.commit()


def get_project(project_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return dict(row) if row else None


def get_all_projects():
    conn = get_db()
    rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


def delete_project(project_id):
    """Delete a project and all related records."""
    conn = get_db()
    conn.execute("DELETE FROM agent_logs WHERE project_id = ?", (project_id,))
    conn.execute("DELETE FROM payments WHERE project_id = ?", (project_id,))
    conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()


def log_agent(project_id, agent_name, status, input_data=None, output_data=None,
              tokens_used=0, cost=0.0, error=None):
    conn = get_db()
    now = datetime.utcnow().isoformat()
    started = now if status == "running" else None
    completed = now if status in ("completed", "failed") else None

    # Safely serialize data - truncate very large outputs to prevent DB bloat
    def safe_json(data, max_len=500_000):
        if data is None:
            return None
        try:
            s = json.dumps(data)
            if len(s) > max_len:
                return json.dumps({"_truncated": True, "summary": str(data)[:1000]})
            return s
        except (TypeError, ValueError):
            return json.dumps({"_error": "Could not serialize data"})

    conn.execute(
        """INSERT INTO agent_logs
        (project_id, agent_name, status, input_data, output_data, tokens_used, cost, started_at, completed_at, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (project_id, agent_name, status, safe_json(input_data),
         safe_json(output_data), tokens_used, cost, started, completed, error),
    )
    conn.commit()


def update_agent_log(project_id, agent_name, **kwargs):
    """Update the latest log entry for a given agent."""
    if not kwargs:
        return
    conn = get_db()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    values = list(kwargs.values()) + [project_id, agent_name]
    conn.execute(
        f"UPDATE agent_logs SET {sets} WHERE project_id = ? AND agent_name = ? "
        "AND id = (SELECT MAX(id) FROM agent_logs WHERE project_id = ? AND agent_name = ?)",
        values + [project_id, agent_name],
    )
    conn.commit()


def get_agent_logs(project_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM agent_logs WHERE project_id = ? ORDER BY id", (project_id,)
    ).fetchall()
    return [dict(r) for r in rows]


def save_api_key(provider, api_key):
    conn = get_db()
    conn.execute(
        """INSERT INTO api_keys (provider, api_key) VALUES (?, ?)
        ON CONFLICT(provider) DO UPDATE SET api_key = ?, updated_at = CURRENT_TIMESTAMP""",
        (provider, api_key, api_key),
    )
    conn.commit()


def get_api_keys():
    conn = get_db()
    rows = conn.execute("SELECT * FROM api_keys WHERE is_active = 1").fetchall()
    return {r["provider"]: r["api_key"] for r in rows}


def delete_api_key(provider):
    """Delete an API key by provider name."""
    conn = get_db()
    conn.execute("DELETE FROM api_keys WHERE provider = ?", (provider,))
    conn.commit()


def create_payment(project_id, amount, plan, ai_cost, platform_fee):
    conn = get_db()
    conn.execute(
        "INSERT INTO payments (project_id, amount, plan, ai_cost, platform_fee, status) VALUES (?, ?, ?, ?, ?, 'completed')",
        (project_id, amount, plan, ai_cost, platform_fee),
    )
    conn.commit()


# Initialize the database on module load
init_db()
