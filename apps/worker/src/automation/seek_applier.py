"""
Seek.com.au Playwright auto-apply bot.

Design principles
-----------------
* Headful + persistent Chrome profile  →  stays logged in, looks human.
* slow_mo=1000  →  human-like interaction speed.
* submit_enabled flag  →  default False (Review Mode); set True to actually submit.
* Callable from CLI (env vars) or imported as a function.

Usage (CLI):
  JOB_URL=https://seek.com.au/job/12345  \\
  CV_PATH=/abs/path/Tailored_CV.docx     \\
  CL_PATH=/abs/path/Tailored_CL.docx    \\
  SUBMIT_ENABLED=false                   \\
  python automation/seek_applier.py

Usage (Python):
  from automation.seek_applier import apply_to_seek
  apply_to_seek(job_url=..., cv_path=..., cl_path=..., submit_enabled=False)
"""
from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import sync_playwright


def apply_to_seek(
    job_url: str,
    cv_path: str,
    cl_path: str,
    user_data_dir: str = "./chrome_profile",
    submit_enabled: bool = False,
) -> dict:
    """
    Navigate to a Seek job URL, upload tailored documents, and optionally submit.

    Returns a dict with keys:
      status   – "applied" | "needs_review" | "failed"
      message  – human-readable summary
      evidence – path to screenshot (if captured)
    """
    cv_path = str(Path(cv_path).resolve())
    cl_path = str(Path(cl_path).resolve())

    with sync_playwright() as p:
        # Persistent context keeps cookies/session across runs
        context = p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=False,
            slow_mo=1000,
            args=["--disable-blink-features=AutomationControlled"],
        )

        page = context.new_page()

        try:
            # ---------------------------------------------------------- #
            # 1. Navigate to the job                                       #
            # ---------------------------------------------------------- #
            print(f"[seek_applier] Navigating → {job_url}")
            page.goto(job_url, wait_until="domcontentloaded", timeout=30_000)

            # ---------------------------------------------------------- #
            # 2. Click Apply / Quick Apply                                 #
            # ---------------------------------------------------------- #
            # Seek renders either an <a> "Apply" or a button "Quick apply"
            apply_link = page.get_by_role("link", name="Apply", exact=True)
            quick_apply = page.get_by_role("button", name="Quick apply")

            if apply_link.is_visible():
                apply_link.click()
            elif quick_apply.is_visible():
                quick_apply.click()
            else:
                screenshot = _screenshot(page, "no_apply_button")
                return {
                    "status":   "needs_review",
                    "message":  "Apply button not found — may need login or already applied.",
                    "evidence": screenshot,
                }

            page.wait_for_load_state("domcontentloaded", timeout=15_000)

            # ---------------------------------------------------------- #
            # 3. Upload CV                                                 #
            # ---------------------------------------------------------- #
            print(f"[seek_applier] Uploading CV: {cv_path}")
            # Seek accepts PDF or DOCX; target the first file input
            file_inputs = page.query_selector_all('input[type="file"]')

            if not file_inputs:
                screenshot = _screenshot(page, "no_file_inputs")
                return {
                    "status":   "needs_review",
                    "message":  "No file upload inputs found.",
                    "evidence": screenshot,
                }

            file_inputs[0].set_input_files(cv_path)

            # Upload cover letter if a second input exists
            if len(file_inputs) > 1 and cl_path:
                print(f"[seek_applier] Uploading Cover Letter: {cl_path}")
                file_inputs[1].set_input_files(cl_path)

            # ---------------------------------------------------------- #
            # 4. Submit (gated behind submit_enabled flag)                 #
            # ---------------------------------------------------------- #
            if submit_enabled:
                submit_btn = page.get_by_role("button", name="Submit application")
                if submit_btn.is_visible():
                    submit_btn.click()
                    page.wait_for_load_state("domcontentloaded", timeout=15_000)
                    screenshot = _screenshot(page, "submitted")
                    print("[seek_applier] Application submitted ✓")
                    return {
                        "status":   "applied",
                        "message":  "Application submitted successfully.",
                        "evidence": screenshot,
                    }
                else:
                    screenshot = _screenshot(page, "submit_btn_missing")
                    return {
                        "status":   "needs_review",
                        "message":  "Submit button not found — review manually.",
                        "evidence": screenshot,
                    }
            else:
                # Review mode — keep browser open for 8 s for human check
                screenshot = _screenshot(page, "review_mode")
                print("[seek_applier] Review mode — NOT submitting. Check browser window.")
                page.wait_for_timeout(8_000)
                return {
                    "status":   "needs_review",
                    "message":  "Documents uploaded. Awaiting user approval to submit.",
                    "evidence": screenshot,
                }

        except Exception as exc:
            screenshot = _screenshot(page, "error")
            return {
                "status":   "failed",
                "message":  str(exc),
                "evidence": screenshot,
            }

        finally:
            context.close()


# ──────────────────────────────────────────────────────────────────────────── #

def _screenshot(page, label: str) -> str:
    path = f"/tmp/seek_applier_{label}.png"
    try:
        page.screenshot(path=path)
    except Exception:
        pass
    return path


# ──────────────────────────────────────────────────────────────────────────── #
# CLI entry-point                                                              #
# ──────────────────────────────────────────────────────────────────────────── #

if __name__ == "__main__":
    result = apply_to_seek(
        job_url=os.environ["JOB_URL"],
        cv_path=os.environ["CV_PATH"],
        cl_path=os.environ.get("CL_PATH", ""),
        submit_enabled=os.environ.get("SUBMIT_ENABLED", "false").lower() == "true",
    )
    print(result)
