import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetPrd,
  useListTasks,
  useListSprints,
  useUpdateTask,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import type { Prd, Task, Sprint } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";

const priorityColors: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/30",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  medium: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  low: "text-slate-400 bg-slate-400/10 border-slate-400/30",
};

const riskColors: Record<string, string> = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-emerald-400",
};

const typeIcons: Record<string, string> = {
  user_story: "US",
  engineering: "EN",
  bug: "BG",
  infrastructure: "IN",
  design: "DS",
};

const typeColors: Record<string, string> = {
  user_story: "bg-violet-500/20 text-violet-300",
  engineering: "bg-blue-500/20 text-blue-300",
  bug: "bg-red-500/20 text-red-300",
  infrastructure: "bg-amber-500/20 text-amber-300",
  design: "bg-pink-500/20 text-pink-300",
};

type Tab = "overview" | "stories" | "tasks" | "sprints";

function generateSprintPlanPDF(prd: Prd, tasks: Task[], sprints: Sprint[]) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const COLORS = {
    primary: [99, 102, 241] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    foreground: [15, 23, 42] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    headerBg: [241, 245, 249] as [number, number, number],
  };

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function drawHRule(color = COLORS.border) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  function sectionHeader(title: string) {
    ensureSpace(32);
    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(margin, y, contentWidth, 24, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.primary);
    doc.text(title.toUpperCase(), margin + 10, y + 16);
    y += 32;
  }

  function wrappedText(text: string, x: number, maxWidth: number, fontSize: number, color: [number, number, number], bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = fontSize * 1.4;
    ensureSpace(lines.length * lineHeight + 4);
    doc.text(lines, x, y);
    y += lines.length * lineHeight;
    return lines.length * lineHeight;
  }

  function bulletLine(text: string, indent = 0) {
    const x = margin + 12 + indent;
    const maxW = contentWidth - 20 - indent;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.foreground);
    const lines = doc.splitTextToSize(text.replace(/^[-•]\s*/, ""), maxW);
    const lineH = 9.5 * 1.4;
    ensureSpace(lines.length * lineH + 6);
    doc.setFillColor(...COLORS.primary);
    doc.circle(margin + 5 + indent, y - 2.5, 1.8, "F");
    doc.text(lines, x, y);
    y += lines.length * lineH + 2;
  }

  type RGB = [number, number, number];
  interface TagColor { bg: RGB; fg: RGB; }

  function drawTag(text: string, x: number, yPos: number, color: TagColor): number {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    const w = doc.getTextWidth(text) + 8;
    doc.setFillColor(...color.bg);
    doc.roundedRect(x, yPos - 9, w, 12, 2, 2, "F");
    doc.setTextColor(...color.fg);
    doc.text(text, x + 4, yPos);
    return w + 4;
  }

  const priorityTagColors: Record<string, TagColor> = {
    critical: { bg: [239, 68,  68],  fg: [220, 38,  38]  },
    high:     { bg: [249, 115, 22],  fg: [194, 65,  12]  },
    medium:   { bg: [59,  130, 246], fg: [29,  78,  216] },
    low:      { bg: [100, 116, 139], fg: [71,  85,  105] },
  };

  const typeTagColors: Record<string, TagColor> = {
    user_story:     { bg: [139, 92,  246], fg: [109, 40,  217] },
    engineering:    { bg: [59,  130, 246], fg: [29,  78,  216] },
    bug:            { bg: [239, 68,  68],  fg: [185, 28,  28]  },
    infrastructure: { bg: [245, 158, 11],  fg: [180, 83,  9]   },
    design:         { bg: [236, 72,  153], fg: [190, 24,  93]  },
  };

  const fallbackTagColor: TagColor = { bg: [59, 130, 246], fg: [29, 78, 216] };

  function tagColor(map: Record<string, TagColor>, key: string): TagColor {
    return map[key] ?? fallbackTagColor;
  }

  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 6, "F");

  y = margin + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.primary);
  const titleLines = doc.splitTextToSize(prd.featureTitle, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 28 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  const riskLabel = prd.riskScore > 0.6 ? "High" : prd.riskScore > 0.3 ? "Medium" : "Low";
  const meta = `${new Date(prd.createdAt).toLocaleDateString()}   |   ${prd.totalTasks} tasks   |   ${prd.totalSprints} sprints   |   ${prd.totalEffortPoints} effort pts   |   Risk: ${(prd.riskScore * 100).toFixed(0)}% (${riskLabel})`;
  doc.text(meta, margin, y);
  y += 14;

  drawHRule(COLORS.primary);
  y += 4;

  sectionHeader("Overview");
  wrappedText(prd.overview, margin, contentWidth, 9.5, COLORS.foreground);
  y += 12;

  sectionHeader("Goals");
  prd.goals.split("\n").filter(Boolean).forEach(line => bulletLine(line));
  y += 12;

  sectionHeader("Success Metrics");
  prd.successMetrics.split("\n").filter(Boolean).forEach(line => bulletLine(line));
  y += 12;

  sectionHeader("User Stories");
  const stories = prd.userStories.split("\n").filter(Boolean);
  stories.forEach((story, i) => {
    const clean = story.replace(/^[-•]\s*/, "");
    const lineH = 9.5 * 1.4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(clean, contentWidth - 30);
    ensureSpace(lines.length * lineH + 8);
    doc.setFillColor(...COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    doc.roundedRect(margin, y - 10, 16, 13, 2, 2, "F");
    doc.text(String(i + 1), margin + 8, y, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.foreground);
    doc.text(lines, margin + 22, y);
    y += lines.length * lineH + 6;
  });
  y += 6;

  sectionHeader("Technical Requirements");
  prd.technicalRequirements.split("\n").filter(Boolean).forEach(line => bulletLine(line));
  y += 12;

  sectionHeader("Tasks");
  const sortedTasks = [...tasks].sort((a, b) => b.priorityScore - a.priorityScore);
  sortedTasks.forEach((task) => {
    const rowH = 46;
    ensureSpace(rowH + 4);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 12, contentWidth, rowH, 3, 3, "F");
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y - 12, contentWidth, rowH, 3, 3, "S");

    const typeLabel = { user_story: "US", engineering: "EN", bug: "BG", infrastructure: "IN", design: "DS" }[task.type] || "??";
    drawTag(typeLabel, margin + 8, y, tagColor(typeTagColors, task.type));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.foreground);
    const titleLines2 = doc.splitTextToSize(task.title, contentWidth - 100);
    doc.text(titleLines2, margin + 36, y);

    const pTagW = drawTag(task.priority, pageWidth - margin - 80, y, tagColor(priorityTagColors, task.priority));

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${task.effortPoints}pt`, pageWidth - margin - 80 + pTagW + 4, y);

    y += 14;
    const descLines = doc.splitTextToSize(task.description, contentWidth - 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(descLines.slice(0, 2), margin + 8, y);
    y += Math.min(descLines.length, 2) * 11 + 16;
  });
  y += 4;

  sectionHeader("Sprint Plan");
  sprints.forEach((sprint) => {
    const sprintTasks = tasks.filter(t => t.sprintId === sprint.id);
    const sprintHeight = 52 + sprintTasks.length * 20;
    ensureSpace(sprintHeight + 12);

    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(margin, y - 12, contentWidth, sprintHeight, 4, 4, "F");
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y - 12, contentWidth, sprintHeight, 4, 4, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.primary);
    doc.text(sprint.name, margin + 10, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${sprint.totalEffortPoints} pts  ·  ${sprint.taskCount} tasks`, pageWidth - margin - 10, y, { align: "right" });

    y += 14;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.muted);
    const goalLines = doc.splitTextToSize(sprint.goal, contentWidth - 20);
    doc.text(goalLines, margin + 10, y);
    y += goalLines.length * 11 + 8;

    drawHRule(COLORS.border);

    sprintTasks.forEach((task) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.foreground);
      const tl = doc.splitTextToSize(task.title, contentWidth - 100);
      doc.text(tl[0], margin + 10, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.muted);
      doc.text(`${task.priority} · ${task.effortPoints}pt`, pageWidth - margin - 10, y, { align: "right" });
      y += 18;
    });

    y += 8;
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`PRD Sprint Planner  ·  Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: "center" });
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, pageHeight - 4, pageWidth, 4, "F");
  }

  const safeName = prd.featureTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`sprint-plan-${safeName}.pdf`);
}

export default function Results() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const queryClient = useQueryClient();

  const [isExporting, setIsExporting] = useState(false);

  const { data: prd, isLoading: prdLoading, error: prdError } = useGetPrd(id, {
    query: { enabled: !!id },
  });
  const { data: tasks, isLoading: tasksLoading } = useListTasks({ prdId: id }, {
    query: { enabled: !!id },
  });
  const { data: sprints, isLoading: sprintsLoading } = useListSprints({ prdId: id }, {
    query: { enabled: !!id },
  });

  const updateTask = useUpdateTask();

  function handleDownloadPDF() {
    if (!prd) return;
    setIsExporting(true);
    setTimeout(() => {
      try {
        generateSprintPlanPDF(prd, tasks || [], sprints || []);
      } finally {
        setIsExporting(false);
      }
    }, 0);
  }

  if (prdLoading) {
    return (
      <div className="min-h-screen px-8 py-10">
        <div className="h-8 w-64 bg-card animate-pulse rounded mb-8" />
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (prdError || !prd) {
    return (
      <div className="min-h-screen px-8 py-10 flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">PRD not found</p>
        <button onClick={() => navigate("/")} className="text-primary text-sm hover:underline">Back to Generator</button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "stories", label: "User Stories" },
    { id: "tasks", label: "Tasks", count: tasks?.length },
    { id: "sprints", label: "Sprint Plan", count: sprints?.length },
  ];

  return (
    <div className="min-h-screen px-8 py-10">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-3">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Generator
          </button>
          <h1 className="text-2xl font-bold text-foreground">{prd.featureTitle}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted-foreground">{new Date(prd.createdAt).toLocaleDateString()}</span>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-emerald-400">{prd.totalTasks} tasks</span>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-blue-400">{prd.totalSprints} sprints</span>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-amber-400">{prd.totalEffortPoints} effort pts</span>
            <span className="text-xs text-muted-foreground">|</span>
            <span className={cn("text-xs", riskColors[prd.riskScore > 0.6 ? "high" : prd.riskScore > 0.3 ? "medium" : "low"])}>
              Risk: {(prd.riskScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={isExporting || tasksLoading || sprintsLoading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isExporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </>
          )}
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-card border border-card-border rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
              activeTab === tab.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                activeTab === tab.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-4">
          <Section title="Overview">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{prd.overview}</p>
          </Section>
          <Section title="Goals">
            <div className="space-y-2">
              {prd.goals.split("\n").filter(Boolean).map((line, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-primary mt-0.5 flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                    </svg>
                  </span>
                  <span>{line.replace(/^[-•]\s*/, "")}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Success Metrics">
            <div className="space-y-2">
              {prd.successMetrics.split("\n").filter(Boolean).map((line, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </span>
                  <span>{line.replace(/^[-•]\s*/, "")}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {activeTab === "stories" && (
        <div className="space-y-4">
          <Section title="User Stories">
            <div className="space-y-3">
              {prd.userStories.split("\n").filter(Boolean).map((story, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-background border border-border rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-violet-500/20 text-violet-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <p className="text-sm text-foreground leading-relaxed">{story.replace(/^[-•]\s*/, "")}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Technical Requirements">
            <div className="space-y-2">
              {prd.technicalRequirements.split("\n").filter(Boolean).map((req, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-blue-400 mt-0.5 flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </span>
                  <span>{req.replace(/^[-•]\s*/, "")}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {activeTab === "tasks" && (
        <div>
          {tasksLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {(tasks || [])
                .slice()
                .sort((a, b) => b.priorityScore - a.priorityScore)
                .map(task => (
                  <div key={task.id} className="bg-card border border-card-border rounded-xl p-4 hover:border-border/80 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5", typeColors[task.type] || typeColors.engineering)}>
                        {typeIcons[task.type] || "??"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{task.title}</p>
                          <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", priorityColors[task.priority])}>
                            {task.priority}
                          </span>
                          <span className={cn("text-xs font-medium", riskColors[task.riskLevel])}>
                            {task.riskLevel} risk
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{task.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground">
                            <span className="text-foreground font-medium">{task.effortPoints}</span> pts
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Score: <span className="text-foreground font-medium">{task.priorityScore.toFixed(0)}</span>
                          </span>
                          {task.dependencies && task.dependencies.length > 0 && (
                            <span className="text-xs text-amber-400">
                              {task.dependencies.length} dep{task.dependencies.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "sprints" && (
        <div>
          {sprintsLoading ? (
            <div className="space-y-4">
              {[1,2].map(i => <div key={i} className="h-48 bg-card animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {(sprints || []).map(sprint => {
                const sprintTasks = (tasks || []).filter(t => t.sprintId === sprint.id);
                return (
                  <div key={sprint.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-card-border flex items-center justify-between bg-muted/30">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{sprint.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 italic">{sprint.goal}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Effort</p>
                          <p className="text-sm font-bold text-primary">{sprint.totalEffortPoints} pts</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Tasks</p>
                          <p className="text-sm font-bold text-foreground">{sprint.taskCount}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      {sprintTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-3 px-3 py-2 bg-background rounded-lg border border-border">
                          <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0", typeColors[task.type] || typeColors.engineering)}>
                            {typeIcons[task.type] || "??"}
                          </span>
                          <span className="text-sm text-foreground flex-1 min-w-0 truncate">{task.title}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={cn("text-xs px-1.5 py-0.5 rounded border", priorityColors[task.priority])}>
                              {task.priority}
                            </span>
                            <span className="text-xs text-muted-foreground">{task.effortPoints}pt</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-card-border bg-muted/20">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
