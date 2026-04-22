import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateFeature, useGeneratePrd, useListFeatures } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListFeaturesQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  generating: "text-blue-400 bg-blue-400/10 border-blue-400/20 animate-pulse",
  completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  failed: "text-red-400 bg-red-400/10 border-red-400/20",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  generating: "Generating...",
  completed: "Completed",
  failed: "Failed",
};

export default function Home() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: features, isLoading: featuresLoading } = useListFeatures();
  const createFeature = useCreateFeature();
  const generatePrd = useGeneratePrd();

  const isGenerating = generatingId !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    try {
      const feature = await createFeature.mutateAsync({ data: { title: title.trim(), description: description.trim() } });
      setTitle("");
      setDescription("");
      setGeneratingId(feature.id);

      queryClient.invalidateQueries({ queryKey: getListFeaturesQueryKey() });

      const result = await generatePrd.mutateAsync({ data: { featureId: feature.id } });
      setGeneratingId(null);
      queryClient.invalidateQueries({ queryKey: getListFeaturesQueryKey() });
      navigate(`/results/${result.prd.id}`);
    } catch {
      setGeneratingId(null);
      queryClient.invalidateQueries({ queryKey: getListFeaturesQueryKey() });
      toast({ title: "Generation failed", description: "Failed to generate PRD. Please try again.", variant: "destructive" });
    }
  }

  const completedFeatures = (features || []).filter(f => f.status === "completed");

  return (
    <div className="min-h-screen px-8 py-10 max-w-3xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">PRD Generator</h1>
        <p className="mt-2 text-muted-foreground">Convert your feature idea into a structured product document, user stories, tasks, and sprint plan.</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-6 shadow-md mb-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Feature Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Real-time collaboration for document editor"
              disabled={isGenerating}
              className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Feature Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the feature in detail — what problem it solves, who it's for, and any key requirements..."
              rows={5}
              disabled={isGenerating}
              className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim() || !description.trim() || isGenerating}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating plan... this may take 15-30 seconds
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Sprint Plan
              </>
            )}
          </button>
        </form>

        {isGenerating && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-primary">
              <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI is analyzing your feature, generating PRD, tasks, and sprint plan...
            </div>
            <div className="mt-2 w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}
      </div>

      {featuresLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => (
            <div key={i} className="h-16 bg-card border border-card-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : completedFeatures.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Plans</h2>
          <div className="space-y-2">
            {completedFeatures.slice().reverse().slice(0, 5).map(feature => (
              <div key={feature.id} className="group bg-card border border-card-border rounded-xl px-4 py-3 flex items-center justify-between hover:border-primary/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{feature.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(feature.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", statusColors[feature.status] || statusColors.pending)}>
                    {statusLabels[feature.status] || feature.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !featuresLoading && (features || []).length === 0 ? (
        <div className="text-center py-12 bg-card border border-card-border rounded-xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-muted flex items-center justify-center">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">No plans yet. Enter your first feature idea above.</p>
        </div>
      ) : null}
    </div>
  );
}
