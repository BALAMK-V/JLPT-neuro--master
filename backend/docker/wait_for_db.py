import os
import time
from urllib.parse import urlparse

import psycopg


def main() -> int:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set; skipping DB wait.")
        return 0

    parsed = urlparse(url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        print(f"Unsupported DB scheme: {parsed.scheme}; skipping DB wait.")
        return 0

    dbname = (parsed.path or "").lstrip("/")
    conninfo = {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "dbname": dbname or "postgres",
        "connect_timeout": 3,
    }

    deadline = time.time() + 45
    last_err = None
    while time.time() < deadline:
        try:
            with psycopg.connect(**conninfo) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            print("Database is ready.")
            return 0
        except Exception as e:
            last_err = e
            print("Waiting for database...")
            time.sleep(1.5)

    print(f"Database not ready in time: {last_err}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
