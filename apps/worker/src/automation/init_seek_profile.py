"""Bootstrap script for first-time Seek authentication profile.

Opens a persistent browser profile and waits for manual login.
After you log in and press Enter in terminal, cookies are saved for reuse.
"""
from __future__ import annotations

from pathlib import Path
from playwright.sync_api import sync_playwright


def bootstrap_seek_profile(user_data_dir: str = "./chrome_profile") -> None:
    profile = str(Path(user_data_dir).resolve())

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=profile,
            headless=False,
            slow_mo=700,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.new_page()
        page.goto("https://www.seek.com.au/", wait_until="domcontentloaded")
        print("Browser opened for Seek login.")
        input("Log in manually, then press Enter here to save session and exit...")
        context.close()


if __name__ == "__main__":
    bootstrap_seek_profile()
