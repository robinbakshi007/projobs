"""AI Cover Letter builder that preserves user sample style.

Creates a tailored cover letter from a sample cover letter and job description.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from docx import Document
from openai import OpenAI

_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")


def tailor_cover_letter(sample_cl_path: str, jd_text: str, output_path: str) -> dict:
    doc = Document(sample_cl_path)
    sample_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    prompt = (
        "Rewrite the cover letter body to match the job description while preserving tone and layout intent. "
        "Do not fabricate facts, keep professional, concise, and ATS-friendly.\n\n"
        f"JOB DESCRIPTION:\n{jd_text[:3500]}\n\n"
        f"SAMPLE COVER LETTER:\n{sample_text[:3500]}\n\n"
        "TAILORED COVER LETTER BODY:"
    )

    response = _client.chat.completions.create(
        model=_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=700,
        temperature=0.35,
    )
    tailored = response.choices[0].message.content.strip()

    out = Document(sample_cl_path)
    for i, p in enumerate(out.paragraphs):
        if i == 0:
            p.text = tailored
        else:
            p.text = ""

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    out.save(output_path)

    return {
        "output_path": output_path,
        "sample_excerpt": sample_text[:240],
        "tailored_excerpt": tailored[:240],
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Tailor a sample cover letter to a job description")
    parser.add_argument("--sample-cl", required=True, help="Path to sample cover letter .docx")
    parser.add_argument("--jd-text", required=False, default="", help="Job description text")
    parser.add_argument("--jd-file", required=False, help="Path to .txt job description")
    parser.add_argument("--output", required=True, help="Output path for tailored cover letter .docx")
    return parser


if __name__ == "__main__":
    args = _build_parser().parse_args()
    jd = args.jd_text
    if args.jd_file:
        jd = Path(args.jd_file).read_text()
    result = tailor_cover_letter(args.sample_cl, jd, args.output)
    print(result)
