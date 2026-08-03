"""Bootstrap script for first-time Seek authentication profile.

Opens a persistent browser profile and waits for manual login.
After you log in and press Enter in terminal, cookies are saved for reuse.
"""
from __future__ import annotations

import sys
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
        
        # If running interactively, wait for enter. Otherwise, poll until browser closes.
        if sys.stdin and sys.stdin.isatty():
            try:
                input("Log in manually, then press Enter here to save session and exit...")
            except (KeyboardInterrupt, SystemExit):
                pass
        else:
            print("Non-interactive context. Waiting for browser window to be closed...")
            try:
                while not page.is_closed():
                    page.wait_for_timeout(1000)
            except Exception:
                pass

        context.close()


if __name__ == "__main__":
    bootstrap_seek_profile()

