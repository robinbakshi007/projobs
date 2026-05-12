from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field

from scrapers import ScraperInput, SeekScraper

app = FastAPI(title="AI Job Worker", version="0.3.0")

BACKEND_BASE_URL: str = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
WORKER_INTERNAL_KEY: str = os.getenv("WORKER_INTERNAL_KEY", "local-worker")
WORKER_INTERNAL_SECRET: str = os.getenv("WORKER_INTERNAL_SECRET", "")


class TaskType(str, Enum):
    scrape = "scrape"
    tailor = "tailor"
    apply = "apply"


class TaskStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class EnqueueTaskRequest(BaseModel):
    user_id: int = Field(..., ge=1)
    task_type: TaskType
    payload: dict


class WorkerTask(BaseModel):
    id: str
    user_id: int
    task_type: TaskType
    status: TaskStatus
    payload: dict
    created_at: datetime


TASK_STORE: dict[str, WorkerTask] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "python-worker"}


@app.post("/tasks/enqueue", response_model=WorkerTask, status_code=201)
def enqueue_task(request: EnqueueTaskRequest, background: BackgroundTasks) -> WorkerTask:
    task = WorkerTask(
        id=str(uuid4()),
        user_id=request.user_id,
        task_type=request.task_type,
        status=TaskStatus.queued,
        payload=request.payload,
        created_at=datetime.now(timezone.utc),
    )
    TASK_STORE[task.id] = task

    if request.task_type == TaskType.scrape:
        background.add_task(_run_scrape_task, task)
    elif request.task_type == TaskType.apply:
        background.add_task(_run_apply_task, task)

    return task


@app.get("/tasks/{task_id}", response_model=WorkerTask)
def get_task(task_id: str) -> WorkerTask:
    task = TASK_STORE.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _run_scrape_task(task: WorkerTask) -> None:
    task.status = TaskStatus.running
    payload = task.payload

    try:
        scraper_input = ScraperInput(
            keywords=payload.get("keywords", ""),
            location=payload.get("location", ""),
            remote_only=payload.get("remote_only", False),
            results_wanted=payload.get("results_wanted", 25),
            days_old=payload.get("days_old", 7),
            local_task_id=payload.get("local_task_id"),
            user_id=task.user_id,
        )

        source = payload.get("source", "seek").lower()
        if source == "seek":
            scraper = SeekScraper(scraper_input)
        else:
            raise ValueError(f"Unknown source: {source}")

        result = scraper.scrape()
        jobs_payload = [j.model_dump(mode="json") for j in result.jobs]

        _post_callback(
            "/api/v1/internal/worker/scrape-complete",
            {
                "task_id": payload.get("local_task_id"),
                "jobs": jobs_payload,
            },
        )

        task.status = TaskStatus.succeeded

    except Exception as exc:  # noqa: BLE001
        task.status = TaskStatus.failed
        task.payload["_error"] = str(exc)


def _run_apply_task(task: WorkerTask) -> None:
    task.status = TaskStatus.running

    application_id = task.payload.get("application_id")
    if not application_id:
        task.status = TaskStatus.failed
        task.payload["_error"] = "application_id missing"
        return

    _post_callback(
        "/api/v1/internal/worker/apply-progress",
        {
            "application_id": application_id,
            "step": "review-approved-dispatch",
            "status": "done",
            "metadata": {"mode": "review"},
        },
    )

    task.status = TaskStatus.succeeded


def _post_callback(path: str, body: dict) -> None:
    url = BACKEND_BASE_URL.rstrip("/") + path
    encoded = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
    timestamp = str(int(datetime.now(timezone.utc).timestamp()))
    nonce = str(uuid4())

    base = f"{timestamp}\n{nonce}\n{encoded}".encode("utf-8")
    signature = hmac.new(
        WORKER_INTERNAL_SECRET.encode("utf-8"),
        base,
        hashlib.sha256,
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Worker-Key": WORKER_INTERNAL_KEY,
        "X-Worker-Timestamp": timestamp,
        "X-Worker-Nonce": nonce,
        "X-Worker-Signature": signature,
    }

    try:
        with httpx.Client(timeout=10) as client:
            client.post(url, content=encoded.encode("utf-8"), headers=headers)
    except Exception:
        pass
