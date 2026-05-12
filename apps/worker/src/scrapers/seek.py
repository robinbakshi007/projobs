"""
Seek.com.au scraper adapter.

Uses the public Seek search API (JSON endpoint) — no login required for
search results.  For description scraping, falls back to HTML parsing.

Features:
  - Exponential back-off on 429 / 5xx
  - seen_ids deduplication across paginated calls
  - Normalises to JobPost schema
"""
from __future__ import annotations

import random
import time
from datetime import datetime, timezone
from typing import Optional

import requests
from bs4 import BeautifulSoup

from .base import BaseScraper, JobPost, ScraperInput, ScrapeResult

# Seek's undocumented but stable GraphQL-adjacent search API
_SEEK_API = "https://www.seek.com.au/api/chalice-search/v4/jobs"
_SEEK_JOB = "https://www.seek.com.au/job/{job_id}"

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-AU,en;q=0.9",
    "Referer": "https://www.seek.com.au/",
}

_RETRY_STATUSES = {429, 500, 502, 503, 504}
_MAX_RETRIES = 3


class SeekScraper(BaseScraper):
    SOURCE = "seek"

    def __init__(self, scraper_input: ScraperInput) -> None:
        super().__init__(scraper_input)
        self._session = requests.Session()
        self._session.headers.update(_DEFAULT_HEADERS)
        self._seen_ids: set[str] = set()

    def scrape(self) -> ScrapeResult:
        jobs: list[JobPost] = []
        errors: list[str] = []
        page = 1
        page_size = 22  # Seek's default page size

        while len(jobs) < self.input.results_wanted:
            params = self._build_params(page, page_size)
            try:
                data = self._get_with_retry(_SEEK_API, params=params)
            except Exception as exc:
                errors.append(f"page {page}: {exc}")
                break

            hits = data.get("data", [])
            if not hits:
                break

            for item in hits:
                job_id = str(item.get("id", ""))
                if not job_id or job_id in self._seen_ids:
                    continue
                self._seen_ids.add(job_id)
                jobs.append(self._normalise(item))
                if len(jobs) >= self.input.results_wanted:
                    break

            total_count = data.get("totalCount", 0)
            if page * page_size >= total_count:
                break

            page += 1
            time.sleep(random.uniform(1.0, 2.5))  # polite delay

        return self._base_result(jobs, errors)

    # ------------------------------------------------------------------ #

    def _build_params(self, page: int, page_size: int) -> dict:
        params: dict = {
            "where":     self.input.location,
            "keywords":  self.input.keywords,
            "pageSize":  page_size,
            "page":      page,
            "sortmode":  "ListedDate",
        }
        if self.input.days_old:
            params["dateRange"] = self.input.days_old
        if self.input.remote_only:
            params["workarrangement"] = "2"   # Seek's code for "remote"
        return params

    def _normalise(self, item: dict) -> JobPost:
        job_id = str(item.get("id", ""))
        source_url = _SEEK_JOB.format(job_id=job_id)
        description = item.get("teaser") or self._fetch_full_description(source_url)

        return JobPost(
            source=self.SOURCE,
            schema_version="1.0",
            external_job_id=job_id,
            source_url=source_url,
            title=item.get("title", ""),
            company=item.get("advertiser", {}).get("description"),
            location_text=item.get("location"),
            remote_flag="Remote" in (item.get("workArrangements", {}).get("details") or []),
            job_type_text=(item.get("workTypes") or {}).get("label"),
            posted_at=self._parse_dt(item.get("listingDate")),
            description_text=description,
            salary_text=(item.get("salary") or {}).get("currencyLabel"),
            raw_payload_json=item,
        )

    def _fetch_full_description(self, url: str) -> Optional[str]:
        try:
            resp = self._session.get(url, timeout=12)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            selectors = [
                '[data-automation="jobAdDetails"]',
                'div[data-testid="job-details"]',
                'article',
                'main',
            ]

            for selector in selectors:
                node = soup.select_one(selector)
                if node:
                    text = node.get_text(" ", strip=True)
                    if len(text) > 120:
                        return text

            return None
        except Exception:
            return None

    @staticmethod
    def _parse_dt(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    def _get_with_retry(self, url: str, params: dict) -> dict:
        delay = 2.0
        for attempt in range(_MAX_RETRIES):
            resp = self._session.get(url, params=params, timeout=15)
            if resp.status_code in _RETRY_STATUSES:
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(delay + random.uniform(0, 1))
                    delay *= 2
                    continue
                resp.raise_for_status()
            resp.raise_for_status()
            return resp.json()
        raise RuntimeError(f"Failed after {_MAX_RETRIES} retries: {url}")
