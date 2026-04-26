import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useGetAdminStats,
  useListPrds,
  useListFeatures,
  useDeleteFeature,
  useGeneratePrd,
  getListFeaturesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, LabelList, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending:    "text-amber-400 bg-amber-400/10 border-amber-400/20",
  generating: "text-blue-400 bg-blue-400/10 border-blue-400/20 animate-pulse",
  completed:  "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  failed:     "text-red-400 bg-red-400/10 border-red-400/20",
};

const PRIORITY_COLORS = ["#ef4444", "#f97316", "#3b82f6", "#94a3b8"];
const TYPE_COLORS     = ["#8b5cf6", "#3b82f6", "#ef4444", "#f59e0b", "#ec4899"];

type TabId = "workflows" | "analytics";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function getRiskBadge(score: number | null | undefined) {
  if (score == null) return null;
  const pct = (score * 100).toFixed(0);
  if (score > 0.6) return { label: `${pct}% High`,   cls: "text-red-400 bg-red-400/10 border-red-400/30" };
  if (score > 0.3) return { label: `${pct}% Med`,    cls: "text-amber-400 bg-amber-400/10 border-amber-400/30" };
  return              { label: `${pct}% Low`,   cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" };
}

export default function Admin() {
  const [activeTab, setActiveTab]         = useState<TabId>("workflows");
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [riskFilter, setRiskFilter]       = useState("all");
  const [flaggedIds, setFlaggedIds]       = useState<Set<number>>(new Set());
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: prds }                           = useListPrds();
  const { data: features, isLoading: featuresLoading } = useListFeatures();

  const deleteFeature = useDeleteFeature();
  const generatePrd   = useGeneratePrd();
  const queryClient   = useQueryClient();
  const [, navigate]  = useLocation();
  const { toast }     = useToast();

  const prdByFeatureId = useMemo(
    () => new Map((prds || []).map(p => [p.featureId, p])),
    [prds],
  );

  const allRows = useMemo(
    () =>
      (features || [])
        .map(f => ({ ...f, prd: prdByFeatureId.get(f.id) ?? null }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [features, prdByFeatureId],
  );

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter(row => {
      if (q && !row.title.toLowerCase().includes(q) && !row.description.toLowerCase().includes(q) && !(row.ownerName || "").toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (riskFilter !== "all") {
        const rs = row.prd?.riskScore ?? null;
        if (riskFilter === "high"   && (rs === null || rs <= 0.6))             return false;
        if (riskFilter === "medium" && (rs === null || rs <= 0.3 || rs > 0.6)) return false;
        if (riskFilter === "low"    && (rs === null || rs > 0.3))              return false;
      }
      return true;
    });
  }, [allRows, search, statusFilter, riskFilter]);

  const ownerData = useMemo(() => {
    const map = new Map<string, { features: number; tasks: number; effortPoints: number }>();
    for (const f of (features || [])) {
      const owner = f.ownerName || "Unassigned";
      const prd = prdByFeatureId.get(f.id);
      const ex = map.get(owner) ?? { features: 0, tasks: 0, effortPoints: 0 };
      map.set(owner, {
        features: ex.features + 1,
        tasks: ex.tasks + (prd?.totalTasks ?? 0),
        effortPoints: ex.effortPoints + (prd?.totalEffortPoints ?? 0),
      });
    }
    return Array.from(map.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.features - a.features);
  }, [features, prdByFeatureId]);

  const priorityData = stats ? [
    { name: "Critical", value: stats.tasksByPriority.critical },
    { name: "High",     value: stats.tasksByPriority.high },
    { name: "Medium",   value: stats.tasksByPriority.medium },
    { name: "Low",      value: stats.tasksByPriority.low },
  ].filter(d => d.value > 0) : [];

  const typeData = stats ? [
    { name: "User Story",     value: stats.tasksByType.user_story },
    { name: "Engineering",    value: stats.tasksByType.engineering },
    { name: "Bug",            value: stats.tasksByType.bug },
    { name: "Infrastructure", value: stats.tasksByType.infrastructure },
    { name: "Design",         value: stats.tasksByType.design },
  ].filter(d => d.value > 0) : [];

  function handleDelete(id: number) {
    if (!confirm("Delete this feature and its generated plan?")) return;
    deleteFeature.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFeaturesQueryKey() });
        toast({ title: "Deleted", description: "Feature and plan removed." });
      },
      onError: () => toast({ title: "Delete failed", description: "Could not delete this entry.", variant: "destructive" }),
    });
  }

  async function handleRegenerate(featureId: number) {
    setRegeneratingId(featureId);
    try {
      const result = await generatePrd.mutateAsync({ data: { featureId } });
      queryClient.invalidateQueries();
      navigate(`/results/${result.prd.id}`);
    } catch {
      toast({ title: "Regeneration failed", description: "Could not regenerate the plan.", variant: "destructive" });
    } finally {
      setRegeneratingId(null);
    }
  }

  function toggleFlag(id: number) {
    setFlaggedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const tooltipStyle = {
    background: "hsl(226 24% 11%)",
    border: "1px solid hsl(226 18% 18%)",
    borderRadius: "8px",
    color: "hsl(213 31% 91%)",
  };

  return (
    <div className="min-h-screen px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitoring and management interface for generated sprint plans</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 bg-card border border-card-border rounded-lg p-1 w-fit">
        {(["workflows", "analytics"] as TabId[]).map(id => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize",
              activeTab === id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {id === "workflows" ? "Workflows" : "Analytics"}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          WORKFLOWS TAB
      ═══════════════════════════════════════════ */}
      {activeTab === "workflows" && (
        <div>
          {/* Search + filter bar */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-56">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search by title, owner, or description…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="pl-3 pr-8 py-2.5 bg-card border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="generating">Generating</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
              className="pl-3 pr-8 py-2.5 bg-card border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              <option value="all">All Risk Levels</option>
              <option value="high">High Risk (&gt;60%)</option>
              <option value="medium">Medium Risk (30–60%)</option>
              <option value="low">Low Risk (&lt;30%)</option>
            </select>
          </div>

          {/* Row count + clear */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="text-foreground font-medium">{filteredRows.length}</span>
              {" "}of{" "}
              <span className="text-foreground font-medium">{allRows.length}</span>
              {" "}workflows
              {flaggedIds.size > 0 && (
                <span className="ml-2 text-amber-400">· {flaggedIds.size} flagged</span>
              )}
            </p>
            {(search || statusFilter !== "all" || riskFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setStatusFilter("all"); setRiskFilter("all"); }}
                className="text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          {featuresLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-card animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-16 bg-card border border-card-border rounded-xl">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-muted flex items-center justify-center">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">
                {allRows.length === 0 ? "No workflows yet. Generate your first sprint plan." : "No workflows match your filters."}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border bg-muted/20">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 min-w-56">Feature / Inputs</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 min-w-36">Outputs</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 min-w-32">Logic Results</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 min-w-28">Timestamp</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 min-w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRows.map(row => {
                      const risk        = getRiskBadge(row.prd?.riskScore);
                      const isFlagged   = flaggedIds.has(row.id);
                      const isRegen     = regeneratingId === row.id;
                      const avgPtsPerTask = row.prd && row.prd.totalTasks > 0
                        ? (row.prd.totalEffortPoints / row.prd.totalTasks).toFixed(1)
                        : null;

                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "transition-colors hover:bg-muted/10",
                            isFlagged && "bg-amber-400/5",
                          )}
                        >
                          {/* ── Feature / Inputs ── */}
                          <td className="px-4 py-3 max-w-xs">
                            <div className="flex items-start gap-2">
                              {isFlagged && (
                                <svg className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M4 21V4h11l.5 1H20v10H4" />
                                  <path d="M4 21h2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                                </svg>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <p className="text-sm font-semibold text-foreground">{row.title}</p>
                                  <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0", statusColors[row.status] ?? statusColors.pending)}>
                                    {row.status}
                                  </span>
                                </div>
                                {row.ownerName && (
                                  <p className="text-xs text-indigo-400 flex items-center gap-1 mb-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    {row.ownerName}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{row.description}</p>
                              </div>
                            </div>
                          </td>

                          {/* ── Outputs ── */}
                          <td className="px-4 py-3">
                            {row.prd ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-blue-400">{row.prd.totalTasks}</span>
                                  <span className="text-xs text-muted-foreground">tasks</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-violet-400">{row.prd.totalSprints}</span>
                                  <span className="text-xs text-muted-foreground">sprints</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-amber-400">{row.prd.totalEffortPoints}</span>
                                  <span className="text-xs text-muted-foreground">effort pts</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>

                          {/* ── Logic Results ── */}
                          <td className="px-4 py-3">
                            {risk ? (
                              <div className="space-y-1.5">
                                <span className={cn("inline-flex text-xs px-2 py-0.5 rounded border font-medium", risk.cls)}>
                                  {risk.label}
                                </span>
                                {avgPtsPerTask && (
                                  <p className="text-xs text-muted-foreground">{avgPtsPerTask} pts/task avg</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>

                          {/* ── Timestamp ── */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-xs text-foreground">
                              {new Date(row.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </td>

                          {/* ── Actions ── */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-0.5">
                              {/* View */}
                              {row.prd && (
                                <button
                                  onClick={() => navigate(`/results/${row.prd!.id}`)}
                                  title="View results"
                                  className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              )}

                              {/* Regenerate */}
                              {(row.status === "completed" || row.status === "failed") && (
                                <button
                                  onClick={() => handleRegenerate(row.id)}
                                  disabled={regeneratingId !== null}
                                  title="Regenerate plan"
                                  className="p-1.5 rounded text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {isRegen ? (
                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  )}
                                </button>
                              )}

                              {/* Flag */}
                              <button
                                onClick={() => toggleFlag(row.id)}
                                title={isFlagged ? "Remove flag" : "Flag as low quality"}
                                className={cn(
                                  "p-1.5 rounded transition-colors",
                                  isFlagged
                                    ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20"
                                    : "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10",
                                )}
                              >
                                <svg className="w-3.5 h-3.5" fill={isFlagged ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isFlagged ? 0 : 2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDelete(row.id)}
                                title="Delete"
                                className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          ANALYTICS TAB
      ═══════════════════════════════════════════ */}
      {activeTab === "analytics" && (
        <div>
          {statsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-xl" />)}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Features"  value={stats.totalFeatures} />
                <StatCard label="PRDs Generated"  value={stats.totalPrds} />
                <StatCard label="Total Tasks"     value={stats.totalTasks}   sub={`${stats.avgTasksPerPrd.toFixed(1)} avg per PRD`} />
                <StatCard label="Total Sprints"   value={stats.totalSprints} sub={`${stats.avgSprintsPerPrd.toFixed(1)} avg per PRD`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <StatCard label="Avg Effort per PRD"   value={`${stats.avgEffortPerPrd.toFixed(0)} pts`} />
                <StatCard label="Recent Generations"   value={stats.recentGenerations} sub="Last 7 days" />
                <StatCard
                  label="Completion Rate"
                  value={stats.totalPrds > 0 ? `${((stats.totalPrds / Math.max(stats.totalFeatures, 1)) * 100).toFixed(0)}%` : "—"}
                />
              </div>

              {stats.totalTasks > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  <div className="bg-card border border-card-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Tasks by Priority</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={priorityData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%" cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {priorityData.map((_, i) => (
                            <Cell key={i} fill={PRIORITY_COLORS[i % PRIORITY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-card border border-card-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Tasks by Type</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={typeData} margin={{ top: 24, right: 10, bottom: 5, left: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: "hsl(213 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "hsl(213 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {typeData.map((_, i) => (
                            <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                          ))}
                          <LabelList dataKey="value" position="top" style={{ fill: "#ffffff", fontSize: 12, fontWeight: 700 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          ) : null}

          {ownerData.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Features by Owner</h3>
              <p className="text-xs text-muted-foreground mb-4">Tasks and effort points broken down per feature owner</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2 pr-6">Owner</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2 pr-6">Features</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2 pr-6">Tasks</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2">Effort pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ownerData.map(row => (
                      <tr key={row.name}>
                        <td className="py-2.5 pr-6">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-primary">{row.name[0].toUpperCase()}</span>
                            </div>
                            <span className="text-foreground font-medium">{row.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-6 text-right tabular-nums text-foreground">{row.features}</td>
                        <td className="py-2.5 pr-6 text-right tabular-nums text-blue-400">{row.tasks}</td>
                        <td className="py-2.5 text-right tabular-nums text-amber-400">{row.effortPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ownerData.length > 1 && (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={ownerData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: "hsl(213 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "hsl(213 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "hsl(213 20% 55%)" }} />
                      <Bar dataKey="features" name="Features" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="tasks"    name="Tasks"    fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
