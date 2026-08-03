from datetime import datetime, timezone

import main as worker_main


def _task(payload: dict) -> worker_main.WorkerTask:
    return worker_main.WorkerTask(
        id="task-1",
        user_id=1,
        task_type=worker_main.TaskType.apply,
        status=worker_main.TaskStatus.queued,
        payload=payload,
        created_at=datetime.now(timezone.utc),
    )


def test_apply_task_accepts_application_ids_list(monkeypatch):
    calls = []

    def fake_post(path: str, body: dict) -> None:
        calls.append((path, body))

    monkeypatch.setattr(worker_main, "_post_callback", fake_post)

    task = _task({"application_ids": [101, 202], "mode": "balanced"})
    worker_main._run_apply_task(task)

    assert task.status == worker_main.TaskStatus.waiting_for_review
    assert len(calls) == 2
    assert calls[0][1]["application_id"] == 101
    assert calls[1][1]["application_id"] == 202


def test_apply_task_fails_when_session_payload_missing_application_ids(monkeypatch):
    monkeypatch.setattr(worker_main, "_post_callback", lambda *_args, **_kwargs: None)

    task = _task({"session_id": 55, "job_ids": [1, 2]})
    worker_main._run_apply_task(task)

    assert task.status == worker_main.TaskStatus.failed
    assert task.payload.get("_error") == "application_ids missing for session payload"


def test_apply_task_backwards_compatible_single_application_id(monkeypatch):
    calls = []

    def fake_post(path: str, body: dict) -> None:
        calls.append((path, body))

    monkeypatch.setattr(worker_main, "_post_callback", fake_post)

    task = _task({"application_id": 999})
    worker_main._run_apply_task(task)

    assert task.status == worker_main.TaskStatus.waiting_for_review
    assert len(calls) == 1
    assert calls[0][1]["application_id"] == 999
