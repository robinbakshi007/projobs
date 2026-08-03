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
    waiting_for_code = "waiting_for_code"
    waiting_for_review = "waiting_for_review"
    blocked = "blocked"
    completed = "completed"
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
    elif request.task_type == TaskType.tailor:
        background.add_task(_run_tailor_task, task)

    return task


def _launch_seek_browser() -> None:
    try:
        from automation.init_seek_profile import bootstrap_seek_profile
        bootstrap_seek_profile(user_data_dir="./chrome_profile")
    except Exception:
        pass


@app.post("/automation/seek/init-profile")
def init_seek_profile_endpoint(background: BackgroundTasks) -> dict:
    background.add_task(_launch_seek_browser)
    return {"message": "SEEK login browser session started on host."}


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

    payload = task.payload
    local_task_id = payload.get("local_task_id")

    _post_checkpoint_status(
        local_task_id,
        "running",
        "login",
        {"message": "Starting apply runbook"},
    )

    job_url = payload.get("job_url")
    if job_url:
        try:
            cv_content = payload.get("cv_content") or ""
            cl_content = payload.get("cover_letter_content") or ""
            submit_enabled = payload.get("submit_enabled", False)

            import tempfile
            from pathlib import Path
            
            temp_dir = Path(tempfile.mkdtemp())
            cv_path = temp_dir / "CV.txt"
            cv_path.write_text(cv_content, encoding="utf-8")
            
            cl_path = temp_dir / "CoverLetter.txt"
            cl_path.write_text(cl_content, encoding="utf-8")

            from automation.seek_applier import apply_to_seek
            
            chrome_profile_dir = Path(__file__).parent.resolve() / "chrome_profile"
            
            _post_checkpoint_status(
                local_task_id,
                "running",
                "form_fill",
                {"message": f"Opening headful browser. Saving in: {chrome_profile_dir}"},
            )
            
            result = apply_to_seek(
                job_url=job_url,
                cv_path=str(cv_path),
                cl_path=str(cl_path),
                user_data_dir=str(chrome_profile_dir),
                submit_enabled=submit_enabled,
            )
            
            if result["status"] == "applied":
                task.status = TaskStatus.completed
                _post_checkpoint_status(
                    local_task_id,
                    "completed",
                    "submit",
                    {"message": result["message"], "evidence": result.get("evidence")},
                )
            elif result["status"] == "needs_review":
                task.status = TaskStatus.waiting_for_review
                _post_checkpoint_status(
                    local_task_id,
                    "waiting_for_review",
                    "review_gate",
                    {"message": result["message"], "evidence": result.get("evidence")},
                )
            else:
                raise ValueError(result["message"])
                
        except Exception as exc:
            task.status = TaskStatus.failed
            task.payload["_error"] = str(exc)
            _post_checkpoint_status(
                local_task_id,
                "failed",
                "submit",
                {"error": str(exc)},
            )
        return

    application_ids = payload.get("application_ids")
    if application_ids is None:
        single_id = payload.get("application_id")
        application_ids = [single_id] if single_id else []

    # Backward-compatible fallback for session payloads that do not include application IDs.
    if not application_ids and payload.get("session_id"):
        task.status = TaskStatus.failed
        task.payload["_error"] = "application_ids missing for session payload"
        _post_checkpoint_status(
            local_task_id,
            "failed",
            "login",
            {"error": task.payload["_error"]},
        )
        return

    if not application_ids:
        task.status = TaskStatus.failed
        task.payload["_error"] = "application_id(s) missing"
        _post_checkpoint_status(
            local_task_id,
            "failed",
            "login",
            {"error": task.payload["_error"]},
        )
        return

    if payload.get("requires_otp") and not payload.get("otp_code"):
        task.status = TaskStatus.waiting_for_code
        _post_checkpoint_status(
            local_task_id,
            "waiting_for_code",
            "otp_challenge",
            {"reason": "otp_required", "provider": payload.get("provider", "seek")},
        )
        return

    retry_policy = payload.get("retry_policy") or {
        "captcha_max_retries": 2,
        "unexpected_field_max_retries": 1,
    }
    captcha_max_retries = int(retry_policy.get("captcha_max_retries", 2))
    unexpected_max_retries = int(retry_policy.get("unexpected_field_max_retries", 1))

    captcha_retries = 0
    unexpected_retries = 0

    if payload.get("simulate_captcha"):
        while captcha_retries < captcha_max_retries:
            captcha_retries += 1
            _post_checkpoint_status(
                local_task_id,
                "running",
                "captcha_escalation",
                {"attempt": captcha_retries, "max": captcha_max_retries},
            )

        task.status = TaskStatus.blocked
        _post_checkpoint_status(
            local_task_id,
            "blocked",
            "captcha_escalation",
            {"reason": "captcha_retry_exhausted", "attempts": captcha_retries},
        )
        return

    if payload.get("simulate_unexpected_field"):
        while unexpected_retries < unexpected_max_retries:
            unexpected_retries += 1
            _post_checkpoint_status(
                local_task_id,
                "running",
                "unexpected_field",
                {"attempt": unexpected_retries, "max": unexpected_max_retries},
            )

        task.status = TaskStatus.blocked
        _post_checkpoint_status(
            local_task_id,
            "blocked",
            "unexpected_field",
            {"reason": "unexpected_field_retry_exhausted", "attempts": unexpected_retries},
        )
        return

    _post_checkpoint_status(local_task_id, "running", "form_fill", {"applications": len(application_ids)})

    for application_id in application_ids:
        _post_callback(
            "/api/v1/internal/worker/apply-progress",
            {
                "application_id": application_id,
                "step": "review-approved-dispatch",
                "status": "done",
                "metadata": {"mode": payload.get("mode", "review")},
            },
        )

    if payload.get("submit_enabled") is not True:
        task.status = TaskStatus.waiting_for_review
        _post_checkpoint_status(
            local_task_id,
            "waiting_for_review",
            "review_gate",
            {"reason": "review_required", "resume_needed": True},
        )
        return

    _post_checkpoint_status(local_task_id, "running", "submit", {"mode": "auto"})

    for application_id in application_ids:
        _post_callback(
            "/api/v1/internal/worker/apply-complete",
            {
                "application_id": application_id,
                "status": "applied",
            },
        )

    task.status = TaskStatus.completed
    _post_checkpoint_status(local_task_id, "completed", "submit", {"submitted": len(application_ids)})


def _post_checkpoint_status(task_id: int | None, status: str, checkpoint_code: str, details: dict) -> None:
    if not task_id:
        return

    _post_callback(
        "/api/v1/internal/worker/checkpoint-status",
        {
            "task_id": task_id,
            "status": status,
            "checkpoint_code": checkpoint_code,
            "details": details,
        },
    )


def _run_tailor_task(task: WorkerTask) -> None:
    task.status = TaskStatus.running
    payload = task.payload
    local_task_id = payload.get("local_task_id")

    _post_checkpoint_status(
        local_task_id,
        "running",
        "tailor",
        {"message": "Starting document tailoring"},
    )

    try:
        agent_id = payload.get("agent_id")
        jd_text = payload.get("jd_text") or payload.get("job_description") or ""

        from document_engine.tailor_cv import tailor_cv
        from document_engine.tailor_cover_letter import tailor_cover_letter

        results = {}
        if agent_id == "cv_tailor" or payload.get("cv_path"):
            cv_path = payload.get("cv_path") or "./master_cv.docx"
            output_path = payload.get("output_path") or "./tailored_cv.docx"
            res = tailor_cv(
                cv_path=cv_path,
                jd_text=jd_text,
                output_path=output_path,
            )
            results = {
                "status": "succeeded",
                "output_path": res["output_path"],
                "placeholders_replaced": res["placeholders_replaced"],
            }
        elif agent_id == "cover_writer" or payload.get("sample_cl_path"):
            sample_cl = payload.get("sample_cl_path") or "./sample_cover_letter.docx"
            output_path = payload.get("output_path") or "./tailored_cover_letter.docx"
            res = tailor_cover_letter(
                sample_cl_path=sample_cl,
                jd_text=jd_text,
                output_path=output_path,
            )
            results = {
                "status": "succeeded",
                "output_path": res["output_path"],
            }
        else:
            raise ValueError(f"Unknown agent/tailoring task: {agent_id}")

        task.status = TaskStatus.completed
        _post_checkpoint_status(
            local_task_id,
            "completed",
            "tailor",
            {"results": results},
        )

    except Exception as exc:
        task.status = TaskStatus.failed
        task.payload["_error"] = str(exc)
        _post_checkpoint_status(
            local_task_id,
            "failed",
            "tailor",
            {"error": str(exc)},
        )


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
