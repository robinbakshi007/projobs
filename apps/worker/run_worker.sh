#!/usr/bin/env bash
set -euo pipefail

# Reliable worker launcher that avoids Python 3.14 package incompatibilities.
# Uses Python 3.11 virtualenv and installs deps if missing.

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv311"
PY311="/opt/homebrew/bin/python3.11"

if [[ ! -x "$PY311" ]]; then
  echo "python3.11 not found at $PY311"
  echo "Install with: brew install python@3.11"
  exit 1
fi

if [[ ! -d "$VENV_DIR" ]]; then
  "$PY311" -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
python -m pip install -q -r "$ROOT_DIR/requirements.txt"
python -m playwright install chromium >/dev/null 2>&1 || true

cd "$ROOT_DIR/src"
exec python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
