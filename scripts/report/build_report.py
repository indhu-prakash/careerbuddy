"""Build an Excel workbook and a PDF report from the analysis JSON written by scripts/analyze.ts.

Usage: python scripts/report/build_report.py out/analysis.json [--out-dir out]
Requires: pip install -r scripts/report/requirements.txt
"""

import argparse
import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

STATUS_COLORS = {"matched": "C6EFCE", "partial": "FFEB9C", "missing": "FFC7CE"}
HEADER_FILL = PatternFill("solid", fgColor="1F3864")
HEADER_FONT = Font(bold=True, color="FFFFFF")


def pct(x: float) -> str:
    return f"{x * 100:.0f}%"


# ---------- Excel ----------

def write_sheet(ws, headers, rows, widths):
    ws.append(headers)
    for cell in ws[1]:
        cell.fill, cell.font = HEADER_FILL, HEADER_FONT
    for row in rows:
        ws.append(row)
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "A2"


def build_excel(data: dict, path: Path) -> None:
    wb = Workbook()

    ws = wb.active
    ws.title = "Summary"
    c = data["candidate"]
    counts = {s: sum(g["status"] == s for g in data["gaps"]) for s in STATUS_COLORS}
    summary = [
        ("Match score", data["matchScore"]),
        ("Current role", c["currentRole"]),
        ("Years of experience", c["yearsExperience"]),
        ("Summary", c["summary"]),
        ("Matched skills", counts["matched"]),
        ("Partial skills", counts["partial"]),
        ("Missing skills", counts["missing"]),
        ("Resume", data["sources"]["resume"]),
        ("Job descriptions", ", ".join(data["sources"]["jobDescriptions"])),
        ("Generated at", data["generatedAt"]),
    ]
    write_sheet(ws, ["Field", "Value"], summary, [22, 90])
    ws["B2"].number_format = "0%"
    ws.append([])
    ws.append(["Recommendations"])
    ws.cell(ws.max_row, 1).font = Font(bold=True)
    for i, rec in enumerate(data["recommendations"], start=1):
        ws.append([i, rec])
        ws.cell(ws.max_row, 2).alignment = Alignment(wrap_text=True, vertical="top")

    ws = wb.create_sheet("Gap Map")
    rows = [
        [g["skill"], g["status"], g["demand"], g["have"], g["gap"], g.get("evidence") or ""]
        for g in data["gaps"]
    ]
    write_sheet(ws, ["Skill", "Status", "Demand", "Have", "Gap", "Evidence"], rows, [28, 11, 10, 8, 8, 70])
    for r in range(2, ws.max_row + 1):
        ws.cell(r, 2).fill = PatternFill("solid", fgColor=STATUS_COLORS[ws.cell(r, 2).value])
        for col in (3, 5):
            ws.cell(r, col).number_format = "0%"
    ws.auto_filter.ref = ws.dimensions

    ws = wb.create_sheet("JD Skills")
    rows = [
        [jd["company"], jd["title"], s["skill"], "Required" if s["required"] else "Nice to have"]
        for jd in data["jobDescriptions"]
        for s in jd["skills"]
    ]
    write_sheet(ws, ["Company", "Title", "Skill", "Priority"], rows, [22, 30, 28, 14])
    ws.auto_filter.ref = ws.dimensions

    wb.save(path)


# ---------- PDF ----------

def build_pdf(data: dict, path: Path) -> None:
    styles = getSampleStyleSheet()
    body, small = styles["BodyText"], styles["BodyText"].clone("small", fontSize=8, leading=10)
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm, title="Skill Gap Report")
    c = data["candidate"]
    story = [
        Paragraph("CareerBuddy: Skill Gap Report", styles["Title"]),
        Paragraph(f"<b>Match score: {pct(data['matchScore'])}</b>", styles["Heading2"]),
        Paragraph(f"{c['currentRole']}, {c['yearsExperience']:g} years. {c['summary']}", body),
        Paragraph(
            "Compared against: " + ", ".join(f"{jd['title']} ({jd['company']})" for jd in data["jobDescriptions"]),
            body,
        ),
        Spacer(1, 6 * mm),
        Paragraph("Recommendations", styles["Heading2"]),
    ]
    story += [Paragraph(f"{i}. {r}", body) for i, r in enumerate(data["recommendations"], start=1)]
    story += [Spacer(1, 6 * mm), Paragraph("Gap map (largest gaps first)", styles["Heading2"])]

    table_data = [["Skill", "Status", "Demand", "Gap", "Evidence"]]
    table_data += [
        [Paragraph(g["skill"], small), g["status"].title(), pct(g["demand"]), pct(g["gap"]),
         Paragraph(g.get("evidence") or "-", small)]
        for g in data["gaps"]
    ]
    table = Table(table_data, colWidths=[40 * mm, 20 * mm, 18 * mm, 14 * mm, 88 * mm], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F3864")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
    ]
    for i, g in enumerate(data["gaps"], start=1):
        style.append(("BACKGROUND", (1, i), (1, i), colors.HexColor("#" + STATUS_COLORS[g["status"]])))
    table.setStyle(TableStyle(style))
    story.append(table)
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        f"Generated {data['generatedAt']} ({data['promptVersion']}). Demand = share of JDs asking for the skill "
        "(nice-to-have counts half). Gap = demand x (1 - resume evidence).", small))

    doc.build(story)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("analysis", type=Path)
    parser.add_argument("--out-dir", type=Path)
    args = parser.parse_args()

    data = json.loads(args.analysis.read_text(encoding="utf-8"))
    out_dir = args.out_dir or args.analysis.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = args.analysis.stem

    xlsx, pdf = out_dir / f"{stem}.xlsx", out_dir / f"{stem}.pdf"
    build_excel(data, xlsx)
    build_pdf(data, pdf)
    print(f"Wrote {xlsx} and {pdf}")


if __name__ == "__main__":
    main()
