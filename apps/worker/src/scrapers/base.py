"""
Scraper base contract.

Every source adapter inherits BaseScraper and implements `scrape()`.
Results are normalised to the JobPost schema before being POSTed back
to the Laravel API via the callback endpoint.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class ScraperInput(BaseModel):
    """Input parameters shared across all scraper adapters."""

    keywords: str = Field(..., description="Search terms, e.g. 'Python Backend Engineer'")
    location: str = Field(..., description="City / region, e.g. 'Sydney, NSW'")
    remote_only: bool = False
    results_wanted: int = Field(default=25, ge=1, le=200)
    days_old: int = Field(default=7, ge=1, le=90)
    # passed back to Laravel so we can correlate
    local_task_id: Optional[int] = None
    user_id: Optional[int] = None
    tenant_id: Optional[int] = None


class JobPost(BaseModel):
    """Canonical job representation — maps 1-to-1 with job_listings table."""

    source: str                            # e.g. "seek", "linkedin"
    schema_version: str = "1.0"
    external_job_id: str
    source_url: Optional[str] = None
    title: str
    company: Optional[str] = None
    location_text: Optional[str] = None
    remote_flag: bool = False
    job_type_text: Optional[str] = None    # "Full-time", "Contract", etc.
    posted_at: Optional[datetime] = None
    description_text: Optional[str] = None
    salary_text: Optional[str] = None
    raw_payload_json: Optional[dict] = None


class ScrapeResult(BaseModel):
    source: str
    total_found: int
    jobs: list[JobPost]
    errors: list[str] = []


class BaseScraper(ABC):
    """Abstract base that all source adapters must implement."""

    SOURCE: str = ""

    def __init__(self, scraper_input: ScraperInput) -> None:
        self.input = scraper_input

    @abstractmethod
    def scrape(self) -> ScrapeResult:
        """Perform the scrape and return a ScrapeResult."""
        ...

    # ------------------------------------------------------------------ #
    # Shared helpers                                                       #
    # ------------------------------------------------------------------ #

    def _base_result(self, jobs: list[JobPost], errors: list[str] | None = None) -> ScrapeResult:
        return ScrapeResult(
            source=self.SOURCE,
            total_found=len(jobs),
            jobs=jobs,
            errors=errors or [],
        )
