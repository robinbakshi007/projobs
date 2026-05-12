"""
OpenClaw tool registrations.

Import this module in the OpenClaw gateway plugin loader.
"""
from __future__ import annotations

import json
import os
from typing import Any

import httpx

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")


def register_job_tools(api: Any) -> None:  # api = openclaw plugin API object
    """Register all job-application tools with the OpenClaw gateway."""

    # ------------------------------------------------------------------ #
    #  jobspy_scraper                                                      #
    # ------------------------------------------------------------------ #
    @api.register_tool(
        name="jobspy_scraper",
        description=(
            "Scrapes job listings from Seek, LinkedIn, and/or Indeed. "
            "Returns a list of normalised JobPost objects."
        ),
    )
    def jobspy_scraper(
        keywords: str,
        location: str,
        sources: list[str] | None = None,
        results_wanted: int = 25,
        remote_only: bool = False,
        days_old: int = 7,
        user_id: int = 1,
    ) -> str:
        sources = sources or ["seek"]
        payload = {
            "user_id":        user_id,
            "task_type":      "scrape",
            "payload": {
                "keywords":        keywords,
                "location":        location,
                "sources":         sources,
                "results_wanted":  results_wanted,
                "remote_only":     remote_only,
                "days_old":        days_old,
            },
        }
        with httpx.Client(timeout=30) as client:
            resp = client.post("http://localhost:8001/tasks/enqueue", json=payload)
        return resp.text

    # ------------------------------------------------------------------ #
    #  python_exec                                                         #
    # ------------------------------------------------------------------ #
    @api.register_tool(
        name="python_exec",
        description="Run a Python script in the worker container.",
    )
    def python_exec(script: str, **kwargs: Any) -> str:
        """
        script  – path relative to apps/worker/src/
        kwargs  – forwarded as CLI args or env vars
        """
        import subprocess
        import sys

        worker_src = os.path.join(
            os.path.dirname(__file__), "..", "..", "apps", "worker", "src"
        )
        cmd = [sys.executable, os.path.join(worker_src, script)]
        env = {**os.environ, **{k.upper(): str(v) for k, v in kwargs.items()}}
        result = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=120)
        return result.stdout + result.stderr

    # ------------------------------------------------------------------ #
    #  browser (thin wrapper — real impl delegates to Playwright)          #
    # ------------------------------------------------------------------ #
    @api.register_tool(
        name="browser",
        description=(
            "Launch a Playwright browser session. Used for Seek/LinkedIn "
            "auto-apply. set submit_enabled=False for review-only mode."
        ),
    )
    def browser(
        action: str,
        job_url: str,
        cv_path: str = "",
        cl_path: str = "",
        submit_enabled: bool = False,
    ) -> str:
        if action == "seek_apply":
            return python_exec(
                "automation/seek_applier.py",
                JOB_URL=job_url,
                CV_PATH=cv_path,
                CL_PATH=cl_path,
                SUBMIT_ENABLED=str(submit_enabled).lower(),
            )
        return f"Unknown browser action: {action}"
