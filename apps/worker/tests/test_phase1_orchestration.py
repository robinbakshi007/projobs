from datetime import datetime, timezone

import main as worker_main


def _task(payload: dict) -> worker_main.WorkerTask:
    return worker_main.WorkerTask(
        id="task-phase1",
        user_id=1,
        task_type=worker_main.TaskType.apply,
        status=worker_main.TaskStatus.queued,
        payload=payload,
        created_at=datetime.now(timezone.utc),
    )


def test_waiting_for_code_checkpoint_when_otp_required_without_code(monkeypatch):
    status_events = []

    def fake_post_checkpoint(task_id, status, checkpoint_code, details):
        status_events.append((task_id, status, checkpoint_code, details))

    monkeypatch.setattr(worker_main, "_post_checkpoint_status", fake_post_checkpoint)
    monkeypatch.setattr(worker_main, "_post_callback", lambda *_a, **_k: None)

    task = _task(
        {
            "local_task_id": 77,
            "application_ids": [10],
            "requires_otp": True,
            "provider": "seek",
            "submit_enabled": False,
        }
    )
    worker_main._run_apply_task(task)

    assert task.status == worker_main.TaskStatus.waiting_for_code
    assert any(event[1] == "waiting_for_code" and event[2] == "otp_challenge" for event in status_events)


def test_resume_after_otp_code_reaches_waiting_for_review(monkeypatch):
    status_events = []
    apply_progress_calls = []

    def fake_post(path: str, body: dict) -> None:
        if path.endswith("/apply-progress"):
            apply_progress_calls.append(body)

    def fake_post_checkpoint(task_id, status, checkpoint_code, details):
        status_events.append((task_id, status, checkpoint_code, details))

    monkeypatch.setattr(worker_main, "_post_callback", fake_post)
    monkeypatch.setattr(worker_main, "_post_checkpoint_status", fake_post_checkpoint)

    task = _task(
        {
            "local_task_id": 88,
            "application_ids": [21, 22],
            "requires_otp": True,
            "otp_code": "123456",
            "submit_enabled": False,
        }
    )
    worker_main._run_apply_task(task)

    assert task.status == worker_main.TaskStatus.waiting_for_review
    assert len(apply_progress_calls) == 2
    assert any(event[1] == "waiting_for_review" and event[2] == "review_gate" for event in status_events)


def test_captcha_escalation_blocks_after_deterministic_retries(monkeypatch):
    status_events = []

    def fake_post_checkpoint(task_id, status, checkpoint_code, details):
        status_events.append((task_id, status, checkpoint_code, details))

    monkeypatch.setattr(worker_main, "_post_checkpoint_status", fake_post_checkpoint)
    monkeypatch.setattr(worker_main, "_post_callback", lambda *_a, **_k: None)

    task = _task(
        {
            "local_task_id": 90,
            "application_ids": [31],
            "simulate_captcha": True,
            "retry_policy": {"captcha_max_retries": 2},
            "submit_enabled": True,
        }
    )
    worker_main._run_apply_task(task)

    assert task.status == worker_main.TaskStatus.blocked
    running_captcha = [e for e in status_events if e[1] == "running" and e[2] == "captcha_escalation"]
    blocked = [e for e in status_events if e[1] == "blocked" and e[2] == "captcha_escalation"]
    assert len(running_captcha) == 2
    assert len(blocked) == 1
