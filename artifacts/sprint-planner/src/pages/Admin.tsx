import { useGetAdminStats, useGetRecentActivity, useListPrds, useListFeatures } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  generating: "text-blue-400 bg-blue-400/10 border-blue-400/20 animate-pulse",
  completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  failed: "text-red-400 bg-red-400/10 border-red-400/20",
};

const PRIORITY_COLORS = ["#ef4444", "#f97316", "#3b82f6", "#94a3b8"];
const PRIORITY_LABELS = ["Critical", "High", "Medium", "Low"];

const TYPE_COLORS = ["#8b5cf6", "#3b82f6", "#ef4444", "#f59e0b", "#ec4899"];
const TYPE_LABELS = ["User Story", "Engineering", "Bug", "Infrastructure", "Design"];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Admin() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: prds } = useListPrds();
  const { data: features } = useListFeatures();
  const [, navigate] = useLocation();

  const prdById = new Map((prds || []).map(p => [p.id, p]));
  const prdByFeatureId = new Map((prds || []).map(p => [p.featureId, p]));

  const ownerData = (() => {
    const map = new Map<string, { features: number; tasks: number; effortPoints: number }>();
    for (const f of (features || [])) {
      const owner = f.ownerName || "Unassigned";
      const prd = prdByFeatureId.get(f.id);
      const existing = map.get(owner) || { features: 0, tasks: 0, effortPoints: 0 };
      map.set(owner, {
        features: existing.features + 1,
        tasks: existing.tasks + (prd?.totalTasks ?? 0),
        effortPoints: existing.effortPoints + (prd?.totalEffortPoints ?? 0),
      });
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.features - a.features);
  })();

  const priorityData = stats ? [
    { name: "Critical", value: stats.tasksByPriority.critical },
    { name: "High", value: stats.tasksByPriority.high },
    { name: "Medium", value: stats.tasksByPriority.medium },
    { name: "Low", value: stats.tasksByPriority.low },
  ].filter(d => d.value > 0) : [];

  const typeData = stats ? [
    { name: "User Story", value: stats.tasksByType.user_story },
    { name: "Engineering", value: stats.tasksByType.engineering },
    { name: "Bug", value: stats.tasksByType.bug },
    { name: "Infrastructure", value: stats.tasksByType.infrastructure },
    { name: "Design", value: stats.tasksByType.design },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="min-h-screen px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitoring and analytics for your sprint planner</p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-xl" />)}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Features" value={stats.totalFeatures} />
            <StatCard label="PRDs Generated" value={stats.totalPrds} />
            <StatCard label="Total Tasks" value={stats.totalTasks} sub={`${stats.avgTasksPerPrd.toFixed(1)} avg per PRD`} />
            <StatCard label="Total Sprints" value={stats.totalSprints} sub={`${stats.avgSprintsPerPrd.toFixed(1)} avg per PRD`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            <StatCard label="Avg Effort per PRD" value={`${stats.avgEffortPerPrd.toFixed(0)} pts`} />
            <StatCard label="Recent Generations" value={stats.recentGenerations} sub="Last 7 days" />
            <StatCard label="Completion Rate" value={stats.totalPrds > 0 ? `${((stats.totalPrds / Math.max(stats.totalFeatures, 1)) * 100).toFixed(0)}%` : "—"} />
          </div>

          {stats.totalTasks > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <div className="bg-card border border-card-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Tasks by Priority</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {priorityData.map((_, i) => (
                        <Cell key={i} fill={PRIORITY_COLORS[i % PRIORITY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(226 24% 11%)", border: "1px solid hsl(226 18% 18%)", borderRadius: "8px", color: "hsl(213 31% 91%)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Tasks by Type</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={typeData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: "hsl(213 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(213 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(226 24% 11%)", border: "1px solid hsl(226 18% 18%)", borderRadius: "8px", color: "hsl(213 31% 91%)" }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {typeData.map((_, i) => (
                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      ) : null}

      {ownerData.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5 mb-8">
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
                  <Tooltip contentStyle={{ background: "hsl(226 24% 11%)", border: "1px solid hsl(226 18% 18%)", borderRadius: "8px", color: "hsl(213 31% 91%)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "hsl(213 20% 55%)" }} />
                  <Bar dataKey="features" name="Features" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tasks" name="Tasks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-card-border">
          <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
        </div>
        {activityLoading ? (
          <div className="divide-y divide-border">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-muted/20 animate-pulse" />)}
          </div>
        ) : (activity || []).length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No activity yet</div>
        ) : (
          <div className="divide-y divide-border">
            {(activity || []).map(item => (
              <div
                key={item.id}
                onClick={() => item.prdId && navigate(`/results/${item.prdId}`)}
                className={cn(
                  "px-5 py-3 flex items-center justify-between transition-colors",
                  item.prdId ? "cursor-pointer hover:bg-muted/20" : "cursor-default"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">{item.featureTitle}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {item.taskCount != null && (
                      <span className="text-xs text-muted-foreground">{item.taskCount} tasks</span>
                    )}
                    {item.sprintCount != null && (
                      <span className="text-xs text-muted-foreground">{item.sprintCount} sprints</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", statusColors[item.status] || statusColors.pending)}>
                    {item.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
