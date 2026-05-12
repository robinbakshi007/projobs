---
name: search-and-apply
description: >
  Searches Seek, LinkedIn, and Indeed for matching jobs, tailors the user's
  master CV and cover letter to each role using GPT-4o, then auto-applies
  via Playwright — all within the user's daily quota.
version: 1.0.0
tools:
  - jobspy_scraper
  - python_exec
  - browser
applyTo: "**"
---

# Search & Apply Skill

Use this skill to automate the full end-to-end job application lifecycle.

## Step 1 — Discover Jobs

Use the `jobspy_scraper` tool with the user's keywords and location:

```tool
jobspy_scraper(
  keywords = "<user_keywords>",
  location = "<user_location>",
  sources  = ["seek", "linkedin", "indeed"],
  results_wanted = 25
)
```

Save results to MySQL via the Laravel API:

```
POST /api/v1/internal/worker/scrape-complete
{ "jobs": [ ...normalised JobPost objects... ] }
```

## Step 2 — Score & Filter

For each saved job call `python_exec` to run the keyword-gap scorer:

```python
python_exec("score_jobs.py", job_id=<id>, user_id=<user_id>)
```

Only proceed with jobs that score ≥ 60 %.

## Step 3 — Tailor Documents

For each qualifying job run:

```python
python_exec("tailor_cv.py",
  job_id     = <id>,
  cv_path    = USER.md["master_cv_path"],
  cl_path    = USER.md["sample_cl_path"],
  output_dir = "./tailored/")
```

**Preservation rules (never change):** Company Name · Job Title · Dates worked.

## Step 4 — Review Gate

Surface the tailored CV diff and ATS score in the React Review Mode dashboard.
Wait for the user to click **Approve & Apply** before proceeding.

## Step 5 — Submit Application

Once approved, use the `browser` tool to call the Seek auto-apply flow:

```python
python_exec("automation/seek_applier.py",
  job_url  = <source_url>,
  cv_path  = <tailored_cv_path>,
  cl_path  = <tailored_cl_path>,
  submit_enabled = False)   # set True after review
```

## Skill Notes

- **Headful mode**: browser runs `headless=False` with `slow_mo=1000` for
  Seek bot detection avoidance.
- **Persistent profile**: stored in `./chrome_profile/` — log in manually on
  first run; subsequent runs stay authenticated.
- **Quota guard**: check `/api/v1/quotas/today` before each application cycle.
  Abort if `quota_remaining == 0`.
- **Restart registry**: if this skill doesn't appear, run
  `openclaw gateway restart` to reload the skill registry.
