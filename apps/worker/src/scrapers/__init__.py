"""Scraper package — exposes all adapters + shared models."""
from .base import BaseScraper, JobPost, ScraperInput, ScrapeResult
from .seek import SeekScraper

__all__ = [
    "BaseScraper",
    "JobPost",
    "ScraperInput",
    "ScrapeResult",
    "SeekScraper",
]
