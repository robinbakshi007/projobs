"""
AI Document Engine — placeholder-based CV & Cover Letter tailoring.

Design rules
------------
* NEVER modify: Company Name, Job Title, Dates worked.
* ONLY rewrite: [SUMMARY] and [ROLE_DESC_*] placeholders.
* Preserves all fonts, spacing, table layout from the master .docx.
* Uses GPT-4o for all rewrites.

Placeholder convention in the master CV .docx:
  [SUMMARY]           – Professional summary block
  [ROLE_DESC_1]       – Description for most recent role
  [ROLE_DESC_2]       – Description for second role
  ... etc.

Usage:
  python document_engine/tailor_cv.py \\
    --cv-path   /path/to/master_cv.docx   \\
    --jd-text   "We are looking for..."   \\
    --output    /path/to/tailored_cv.docx
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from docx import Document
from openai import OpenAI

_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")

# ── Preserved sections: never replaced ───────────────────────────────────────
_PRESERVED_MARKERS = {"[COMPANY]", "[TITLE]", "[DATES]"}


def tailor_cv(
    cv_path: str,
    jd_text: str,
    output_path: str,
    *,
    max_summary_words: int = 80,
) -> dict:
    """
    Load the master CV, replace placeholders via GPT-4o, save to output_path.

    Returns:
        {
          "summary_before": str,
          "summary_after":  str,
          "placeholders_replaced": list[str],
          "output_path": str,
        }
    """
    doc = Document(cv_path)

    placeholders: dict[str, str] = {}  # marker → original text
    results: dict = {
        "summary_before": "",
        "summary_after": "",
        "placeholders_replaced": [],
        "output_path": output_path,
    }

    # ── Pass 1: collect current placeholder values ────────────────────────
    for para in doc.paragraphs:
        text = para.text.strip()
        for marker in _PLACEHOLDER_MARKERS:
            if text.startswith(marker):
                placeholders[marker] = text[len(marker):].strip()

    # Also scan table cells
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    text = para.text.strip()
                    for marker in _PLACEHOLDER_MARKERS:
                        if text.startswith(marker):
                            placeholders[marker] = text[len(marker):].strip()

    # ── Pass 2: generate rewrites via GPT-4o ─────────────────────────────
    rewrites: dict[str, str] = {}

    if "[SUMMARY]" in placeholders:
        results["summary_before"] = placeholders["[SUMMARY]"]
        new_summary = _rewrite_summary(
            original=placeholders["[SUMMARY]"],
            jd_text=jd_text,
            max_words=max_summary_words,
        )
        rewrites["[SUMMARY]"] = new_summary
        results["summary_after"] = new_summary

    for i in range(1, 10):
        marker = f"[ROLE_DESC_{i}]"
        if marker in placeholders:
            rewrites[marker] = _rewrite_role_description(
                original=placeholders[marker],
                jd_text=jd_text,
            )

    # ── Pass 3: apply rewrites in-place, preserving formatting ───────────
    _apply_rewrites(doc, rewrites)
    results["placeholders_replaced"] = list(rewrites.keys())

    # ── Save ──────────────────────────────────────────────────────────────
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)

    return results


# ── GPT-4o helpers ────────────────────────────────────────────────────────────

def _rewrite_summary(original: str, jd_text: str, max_words: int) -> str:
    prompt = (
        f"You are a professional CV writer. Rewrite the professional summary below "
        f"to align with the job description. Keep it under {max_words} words. "
        f"Do NOT mention specific companies, job titles, or dates. "
        f"Use strong action verbs. Remove AI clichés like 'passionate' or 'innovative'.\n\n"
        f"JOB DESCRIPTION:\n{jd_text[:3000]}\n\n"
        f"ORIGINAL SUMMARY:\n{original}\n\n"
        f"REWRITTEN SUMMARY:"
    )
    response = _client.chat.completions.create(
        model=_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()


def _rewrite_role_description(original: str, jd_text: str) -> str:
    prompt = (
        "You are a professional CV writer. Given the job description and original "
        "role description bullets below, slightly reorder and rephrase the bullets "
        "to emphasise keywords found in the job description. "
        "CRITICAL RULES:\n"
        "  - Do NOT change any company name, job title, or date.\n"
        "  - Keep the same number of bullet points.\n"
        "  - Keep bullets concise (max 20 words each).\n"
        "  - Do NOT invent new responsibilities.\n\n"
        f"JOB DESCRIPTION (first 2000 chars):\n{jd_text[:2000]}\n\n"
        f"ORIGINAL BULLETS:\n{original}\n\n"
        "REWRITTEN BULLETS:"
    )
    response = _client.chat.completions.create(
        model=_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


# ── Docx in-place rewrite ─────────────────────────────────────────────────────

_PLACEHOLDER_MARKERS = [
    "[SUMMARY]",
    *[f"[ROLE_DESC_{i}]" for i in range(1, 10)],
]


def _apply_rewrites(doc: Document, rewrites: dict[str, str]) -> None:
    """
    Replace placeholder content in paragraphs and table cells.
    Runs are preserved so fonts / bold / colour stay intact —
    only the text of the first run in a matching paragraph is replaced.
    """
    def _process_para(para) -> None:
        for marker, new_text in rewrites.items():
            if para.text.strip().startswith(marker):
                # Clear all runs
                full_text = marker + " " + new_text
                if para.runs:
                    para.runs[0].text = full_text
                    for run in para.runs[1:]:
                        run.text = ""
                else:
                    para.add_run(full_text)
                return

    for para in doc.paragraphs:
        _process_para(para)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _process_para(para)


# ── CLI ───────────────────────────────────────────────────────────────────────

def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Tailor a master CV to a job description.")
    p.add_argument("--cv-path",  required=True, help="Path to master CV .docx")
    p.add_argument("--jd-text",  required=False, help="Job description text")
    p.add_argument("--jd-file",  required=False, help="Path to a .txt file with JD text")
    p.add_argument("--output",   required=True, help="Output path for tailored CV .docx")
    return p


if __name__ == "__main__":
    args = _build_arg_parser().parse_args()

    jd = args.jd_text or ""
    if args.jd_file:
        jd = Path(args.jd_file).read_text()

    result = tailor_cv(
        cv_path=args.cv_path,
        jd_text=jd,
        output_path=args.output,
    )
    print(f"Tailored CV saved → {result['output_path']}")
    print(f"Placeholders replaced: {result['placeholders_replaced']}")
    print(f"\nSummary before:\n{result['summary_before']}")
    print(f"\nSummary after:\n{result['summary_after']}")
