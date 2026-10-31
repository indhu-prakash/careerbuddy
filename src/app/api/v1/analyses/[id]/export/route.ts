import ExcelJS from "exceljs";
import { isUuid, notFound, withUser } from "@/lib/api";
import { getGapAnalysisView } from "@/lib/analysis/view";

const LEVELS = ["None", "Beginner", "Intermediate", "Advanced", "Expert"];
const STATUS_FILL: Record<string, string> = { matched: "FFC6EFCE", partial: "FFFFEB9C", missing: "FFFFC7CE" };

// Excel workbook of a saved gap analysis (gap matrix, sources, next steps). No model call.
export const GET = withUser<{ params: Promise<{ id: string }> }>(async (user, _request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const a = await getGapAnalysisView(user.id, id);
  if (!a) return notFound();

  const wb = new ExcelJS.Workbook();
  wb.creator = "CareerBuddy";

  const summary = wb.addWorksheet("Summary");
  summary.columns = [{ width: 24 }, { width: 80 }];
  summary.addRows([
    ["CareerBuddy: Skill Gap Report"],
    ["Target role", a.targetRole?.title ?? ""],
    ["Match score", `${Math.round(a.matchScore * 100)}%`],
    ["Job descriptions", a.jdCount],
    ["Role template blended", a.usedTemplate ? "Yes (fewer than 3 JDs)" : "No"],
    ["Generated", new Date(a.createdAt).toISOString().slice(0, 10)],
    [],
    ["Next steps"],
    ...a.recommendations.map((r, i) => [`${i + 1}.`, r]),
  ]);
  summary.getRow(1).font = { bold: true, size: 14 };
  summary.getRow(8).font = { bold: true };

  const matrix = wb.addWorksheet("Gap matrix");
  matrix.columns = [
    { header: "Skill", key: "skill", width: 28 },
    { header: "Status", key: "status", width: 10 },
    { header: "Category", key: "category", width: 14 },
    { header: "Current level", key: "current", width: 14 },
    { header: "Required level", key: "required", width: 14 },
    { header: "Demand %", key: "demand", width: 10 },
    { header: "Gap %", key: "gap", width: 8 },
    { header: "Priority", key: "priority", width: 9 },
    { header: "Effort (h)", key: "effort", width: 10 },
    { header: "From template", key: "template", width: 13 },
    { header: "Resume evidence", key: "evidence", width: 50 },
    { header: "JD evidence", key: "jd", width: 50 },
  ];
  for (const g of a.gaps) {
    const row = matrix.addRow({
      skill: g.skill,
      status: g.status,
      category: g.category ?? "",
      current: LEVELS[g.currentLevel ?? 0],
      required: LEVELS[g.requiredLevel ?? 2],
      demand: Math.round(g.demand * 100),
      gap: Math.round(g.gap * 100),
      priority: g.priority ?? "",
      effort: g.effortHours ?? "",
      template: g.fromTemplate ? "yes" : "",
      evidence: g.evidence ?? "",
      jd: g.jdQuotes.join(" | "),
    });
    row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[g.status] } };
  }
  matrix.getRow(1).font = { bold: true };
  matrix.views = [{ state: "frozen", ySplit: 1 }];

  const sources = wb.addWorksheet("Job descriptions");
  sources.columns = [
    { header: "Title", key: "title", width: 40 },
    { header: "Company", key: "company", width: 28 },
    { header: "Source", key: "source", width: 10 },
    { header: "Requirements", key: "count", width: 14 },
  ];
  for (const jd of a.jobDescriptions) {
    sources.addRow({ title: jd.title ?? "", company: jd.company ?? "", source: jd.source, count: jd.requirementCount });
  }
  sources.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="careerbuddy-gap-${a.id.slice(0, 8)}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
});
