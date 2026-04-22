import { useState } from "react";
import { useLocation } from "wouter";
import { useListFeatures, useListPrds, useDeleteFeature } from "@workspace/api-client-react";
import { getListFeaturesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  generating: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  failed: "text-red-400 bg-red-400/10 border-red-400/20",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  generating: "Generating",
  completed: "Completed",
  failed: "Failed",
};

export default function Features() {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: features, isLoading } = useListFeatures();
  const { data: prds } = useListPrds();
  const deleteFeature = useDeleteFeature();

  const prdByFeatureId = new Map((prds || []).map(p => [p.featureId, p]));

  const allOwners = Array.from(
    new Set((features || []).map(f => f.ownerName).filter(Boolean) as string[])
  ).sort();

  const filtered = (features || [])
    .filter(f => {
      const matchesSearch = !search || f.title.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase());
      const matchesOwner = !ownerFilter || f.ownerName === ownerFilter;
      return matchesSearch && matchesOwner;
    })
    .slice()
    .reverse();

  function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this feature and its PRD?")) return;
    deleteFeature.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFeaturesQueryKey() }),
    });
  }

  function handleView(featureId: number) {
    const prd = prdByFeatureId.get(featureId);
    if (prd) navigate(`/results/${prd.id}`);
  }

  return (
    <div className="min-h-screen px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feature Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">All your feature ideas and their generated plans</p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Feature
        </button>
      </div>

      <div className="mb-5 flex gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search features..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        {allOwners.length > 0 && (
          <select
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            className="pl-3 pr-8 py-2.5 bg-card border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent appearance-none cursor-pointer"
          >
            <option value="">All Owners</option>
            {allOwners.map(owner => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-card animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-card-border rounded-xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-muted flex items-center justify-center">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">{search ? "No features match your search" : "No features yet. Generate your first plan."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(feature => {
            const prd = prdByFeatureId.get(feature.id);
            return (
              <div
                key={feature.id}
                onClick={() => feature.status === "completed" && handleView(feature.id)}
                className={cn(
                  "group bg-card border border-card-border rounded-xl px-5 py-4 flex items-center justify-between transition-colors",
                  feature.status === "completed" ? "cursor-pointer hover:border-primary/30" : "cursor-default"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-foreground truncate">{feature.title}</p>
                    <span className={cn("text-xs px-2 py-0.5 rounded border font-medium flex-shrink-0", statusColors[feature.status] || statusColors.pending)}>
                      {statusLabels[feature.status] || feature.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {feature.ownerName && (
                      <span className="text-xs text-indigo-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {feature.ownerName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{feature.description}</p>
                  {prd && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-blue-400">{prd.totalTasks} tasks</span>
                      <span className="text-xs text-muted-foreground">|</span>
                      <span className="text-xs text-violet-400">{prd.totalSprints} sprints</span>
                      <span className="text-xs text-muted-foreground">|</span>
                      <span className="text-xs text-amber-400">{prd.totalEffortPoints} effort pts</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{new Date(feature.createdAt).toLocaleDateString()}</span>
                  {feature.status === "completed" && (
                    <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                  <button
                    onClick={e => handleDelete(feature.id, e)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
