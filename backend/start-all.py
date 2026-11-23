"""Run the API and Celery worker together in a single Render web service."""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time


def stop_processes(processes: list[subprocess.Popen[bytes]]) -> None:
    for process in processes:
        if process.poll() is None:
            process.terminate()

    deadline = time.monotonic() + 10
    for process in processes:
        if process.poll() is None:
            try:
                process.wait(timeout=max(0, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                process.kill()
        process.wait()


def main() -> int:
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)

    concurrency = os.environ.get("CELERY_CONCURRENCY", "1")
    processes = [
        subprocess.Popen(
            [
                "celery",
                "-A",
                "backend.app.workers.celery_app:celery_app",
                "worker",
                "--loglevel=INFO",
                f"--concurrency={concurrency}",
            ]
        ),
        subprocess.Popen(
            [
                "uvicorn",
                "backend.app.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                os.environ.get("PORT", "10000"),
            ]
        ),
    ]

    stopping = False

    def handle_signal(_signum: int, _frame: object) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    try:
        while not stopping:
            for process in processes:
                exit_code = process.poll()
                if exit_code is not None:
                    name = "Celery worker" if process is processes[0] else "Uvicorn API"
                    print(f"{name} exited with status {exit_code}; stopping the service.", flush=True)
                    return exit_code or 1
            time.sleep(0.5)
        return 0
    finally:
        stop_processes(processes)


if __name__ == "__main__":
    raise SystemExit(main())
