/**
 * ============================================================================
 * REUSABLE CV + COVER LETTER GENERATOR (docx)
 * ============================================================================
 * Requires: npm install docx
 * Run:      node cv_cover_letter_template.js
 * Output:   CV.docx and CoverLetter.docx in the same folder
 *
 * HOW TO USE
 * 1. Fill in the PROFILE object below with your real details (name, contact,
 *    summary, certifications, experience, etc.) — this is your master data.
 * 2. Fill in the ROLE object with the specific job you're tailoring for
 *    (headline, KPI bullets, cover letter paragraphs).
 * 3. Run the script. It builds a clean, ATS-friendly Word doc for both.
 * 4. For a new role, just duplicate the ROLE object and re-run — PROFILE
 *    (education, full work history) stays constant; ROLE is what changes
 *    per application (headline, highlights, cover letter body).
 *
 * DESIGN NOTES
 * - Certifications and Technology sections render as clean multi-column
 *   tables (no visible borders) instead of long single-column bullet lists —
 *   set COLS below to control column count.
 * - Plain, ATS-safe formatting: no icons, no text boxes, no images.
 *   (If you want an icon variant for direct-to-human applications, that's a
 *   separate build — icons/images can confuse ATS parsers, so keep this
 *   version as your default for online applications.)
 * ============================================================================
 */

const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, convertInchesToTwip, Table, TableRow, TableCell, WidthType, VerticalAlign
} = require("docx");
const fs = require("fs");

// ----------------------------------------------------------------------------
// 1. FILL IN YOUR REAL DATA HERE
// ----------------------------------------------------------------------------

const PROFILE = {
  name: "YOUR NAME",
  location: "City, State, Country",
  citizenship: "Citizenship / work rights status",
  email: "you@email.com",
  phone: "0000 000 000",

  education: [
    { degree: "Your Degree(s)", institution: "Your University" },
  ],

  // Full certifications list — order can be overridden per-role in ROLE.certPriority
  allCertifications: [
    "Certification One",
    "Certification Two",
    "Certification Three",
  ],

  // Full technology/tools list
  technology: [
    "Tool One",
    "Tool Two",
    "Tool Three",
  ],

  // Full work history — reused across every tailored CV.
  // Bullets can be lightly reworded per role in ROLE.experienceOverrides if needed,
  // but keep facts (employer, dates, real achievements) constant across versions.
  experience: [
    {
      title: "Job Title",
      org: "Employer Name",
      dates: "Mon Year – Mon Year",
      bullets: [
        "Achievement bullet one, with a real quantified result where possible.",
        "Achievement bullet two.",
      ],
    },
    // ... add every role in your history here
  ],
};

// ----------------------------------------------------------------------------
// 2. FILL IN THE ROLE-SPECIFIC DETAILS (changes per application)
// ----------------------------------------------------------------------------

const ROLE = {
  slug: "Example_Role",                 // used in output filenames
  companyName: "Target Company",
  roleTitle: "Job Title You're Applying For",
  ref: "REQ-12345",                     // job reference number, if any
  location: "City, State (Hybrid/Remote/Onsite)",

  headline: "Your Positioning Headline | Key Theme 1, Key Theme 2 & Key Theme 3",

  summary: "2–4 sentence professional summary tailored to this role, written in " +
    "third-person-omitted style ('Senior X with a decade of experience in Y...'). " +
    "Lead with what matches the job ad; be honest about anything you can't claim.",

  highlights: [
    { lead: "KPI Title: ", rest: "one-sentence achievement with a quantified result." },
    { lead: "KPI Title: ", rest: "one-sentence achievement with a quantified result." },
    { lead: "KPI Title: ", rest: "one-sentence achievement with a quantified result." },
    { lead: "KPI Title: ", rest: "one-sentence achievement with a quantified result." },
  ],

  // Certifications to push to the top of the list for this role (rest follow in original order)
  certPriority: [],

  // Cover letter body paragraphs, in order. Keep one paragraph honestly
  // flagging any gap between your real experience and the job ad's asks —
  // this reads better than silently overclaiming and protects you at interview.
  coverLetterParagraphs: [
    "Opening paragraph: express interest, state your positioning in one line.",
    "Second paragraph: 1-2 concrete achievements mapped directly to JD language.",
    "Third paragraph: more mapped experience, or the honest gap-flag paragraph.",
    "Closing paragraph: invite further discussion.",
  ],
};

// ----------------------------------------------------------------------------
// STYLING CONSTANTS — tweak colors/fonts here, applies everywhere
// ----------------------------------------------------------------------------

const NAVY = "1F3864";
const GREY = "444444";
const LINEGREY = "BFBFBF";
const CERT_COLUMNS = 2;   // columns for certifications table
const TECH_COLUMNS = 3;   // columns for technology table

// ----------------------------------------------------------------------------
// BUILDING BLOCKS (generally no need to edit below this line)
// ----------------------------------------------------------------------------

const hr = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINEGREY, space: 4 } },
  spacing: { after: 160 },
});

const sectionHeading = (text) => new Paragraph({
  spacing: { before: 220, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 2 } },
  children: [new TextRun({ text: text.toUpperCase(), bold: true, color: NAVY, size: 21, font: "Calibri" })],
});

const bullet = (text) => new Paragraph({
  numbering: { reference: "bullet-list", level: 0 },
  spacing: { after: 60 },
  children: Array.isArray(text) ? text : [new TextRun({ text, size: 20, font: "Calibri", color: GREY })],
});

const boldBullet = (lead, rest) => bullet([
  new TextRun({ text: lead, bold: true, size: 20, font: "Calibri", color: "222222" }),
  new TextRun({ text: rest, size: 20, font: "Calibri", color: GREY }),
]);

const roleHeader = (title, org, dates) => new Paragraph({
  spacing: { before: 160, after: 40 },
  tabStops: [{ type: "right", position: convertInchesToTwip(6.5) }],
  children: [
    new TextRun({ text: `${title} — `, bold: true, size: 21, font: "Calibri", color: "222222" }),
    new TextRun({ text: org, italics: true, size: 21, font: "Calibri", color: "222222" }),
    new TextRun({ text: `\t${dates}`, italics: true, size: 19, font: "Calibri", color: GREY }),
  ],
});

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER };

// Renders a flat list of strings as a clean N-column table (no visible borders)
function gridTable(items, cols) {
  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    const rowItems = items.slice(i, i + cols);
    while (rowItems.length < cols) rowItems.push("");
    rows.push(new TableRow({
      children: rowItems.map(text => new TableCell({
        width: { size: Math.floor(100 / cols), type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 60, bottom: 60, left: 60, right: 120 },
        children: [new Paragraph({
          children: text ? [new TextRun({ text: "• " + text, size: 20, font: "Calibri", color: GREY })] : [],
        })],
      })),
    }));
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows });
}

function orderWithPriority(all, priority) {
  const rest = all.filter(c => !priority.includes(c));
  return [...priority, ...rest];
}

// ----------------------------------------------------------------------------
// CV BUILDER
// ----------------------------------------------------------------------------

function buildCV() {
  const orderedCerts = orderWithPriority(PROFILE.allCertifications, ROLE.certPriority || []);

  return new Document({
    numbering: {
      config: [{
        reference: "bullet-list",
        levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
      }],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 620, bottom: 620, left: 720, right: 720 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
          children: [new TextRun({ text: PROFILE.name.toUpperCase(), bold: true, size: 40, font: "Calibri", color: NAVY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
          children: [new TextRun({ text: ROLE.headline, italics: true, size: 22, font: "Calibri", color: "333333" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
          children: [new TextRun({
            text: `${PROFILE.location}  |  ${PROFILE.citizenship}  |  ${PROFILE.email}  |  ${PROFILE.phone}`,
            size: 18, font: "Calibri", color: GREY,
          })] }),
        hr(),

        sectionHeading("Professional Summary"),
        new Paragraph({ spacing: { after: 100 },
          children: [new TextRun({ text: ROLE.summary, size: 20, font: "Calibri", color: GREY })] }),

        sectionHeading("Key Performance Highlights"),
        ...ROLE.highlights.map(h => boldBullet(h.lead, h.rest)),

        sectionHeading("Education"),
        ...PROFILE.education.flatMap(e => ([
          new Paragraph({ spacing: { after: 40 },
            children: [new TextRun({ text: e.degree, bold: true, size: 20, font: "Calibri", color: "222222" })] }),
          new Paragraph({ spacing: { after: 40 },
            children: [new TextRun({ text: e.institution, italics: true, size: 19, font: "Calibri", color: GREY })] }),
        ])),

        sectionHeading("Technology"),
        gridTable(PROFILE.technology, TECH_COLUMNS),

        sectionHeading("Certifications"),
        gridTable(orderedCerts, CERT_COLUMNS),

        sectionHeading("Professional Experience"),
        ...PROFILE.experience.flatMap(job => ([
          roleHeader(job.title, job.org, job.dates),
          ...job.bullets.map(b => bullet(b)),
        ])),
      ],
    }],
  });
}

// ----------------------------------------------------------------------------
// COVER LETTER BUILDER
// ----------------------------------------------------------------------------

function buildCoverLetter() {
  const body = (text) => new Paragraph({
    spacing: { after: 200, line: 300 },
    children: [new TextRun({ text, size: 21, font: "Calibri", color: "222222" })],
  });

  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  return new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 },
          children: [new TextRun({ text: PROFILE.name.toUpperCase(), bold: true, size: 34, font: "Calibri", color: NAVY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
          children: [new TextRun({ text: ROLE.headline, italics: true, size: 20, font: "Calibri", color: "333333" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BFBFBF", space: 6 } },
          children: [new TextRun({
            text: `${PROFILE.location}  |  ${PROFILE.citizenship}  |  ${PROFILE.email}  |  ${PROFILE.phone}`,
            size: 18, font: "Calibri", color: GREY,
          })] }),

        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: today, size: 21, font: "Calibri" })] }),
        new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: "Hiring Manager", bold: true, size: 21, font: "Calibri" })] }),
        new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: ROLE.companyName, size: 21, font: "Calibri" })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: ROLE.location, size: 21, font: "Calibri" })] }),

        new Paragraph({ spacing: { after: 200 },
          children: [new TextRun({
            text: `RE: ${ROLE.roleTitle}${ROLE.ref ? ` (Reference: ${ROLE.ref})` : ""}`,
            bold: true, size: 21, font: "Calibri", color: NAVY,
          })] }),

        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Dear Hiring Manager,", size: 21, font: "Calibri" })] }),

        ...ROLE.coverLetterParagraphs.map(body),

        new Paragraph({ spacing: { before: 200, after: 20 }, children: [new TextRun({ text: "Sincerely,", size: 21, font: "Calibri" })] }),
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: PROFILE.name, bold: true, size: 21, font: "Calibri" })] }),
      ],
    }],
  });
}

// ----------------------------------------------------------------------------
// RUN
// ----------------------------------------------------------------------------

Promise.all([
  Packer.toBuffer(buildCV()).then(buf => fs.writeFileSync(`CV_${ROLE.slug}.docx`, buf)),
  Packer.toBuffer(buildCoverLetter()).then(buf => fs.writeFileSync(`CoverLetter_${ROLE.slug}.docx`, buf)),
]).then(() => console.log(`Done: CV_${ROLE.slug}.docx and CoverLetter_${ROLE.slug}.docx created.`));
