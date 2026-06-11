"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjects, useDeleteProject, type ProjectStatus } from "@/lib/api/projects";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { ProjectListTable } from "./_components/project-list-table";
import { toast } from "sonner";

// ─── Filter tab config ────────────────────────────────────────────────────────

type FilterTab = "all" | "Draft" | "Active" | "Complete" | "Archived";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "Draft",    label: "Draft" },
  { id: "Active",   label: "Active" },
  { id: "Complete", label: "Complete" },
  { id: "Archived", label: "Archived" },
];

function tabToStatuses(tab: FilterTab): ProjectStatus[] {
  if (tab === "all")      return ["Draft", "Active", "Complete"];
  if (tab === "Archived") return ["Archived"];
  return [tab];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const statuses = tabToStatuses(activeTab);
  const { data: projects = [], isLoading, isError, refetch } = useProjects(statuses);
  const deleteProject = useDeleteProject();

  const canManage = user?.role === "Manager" || user?.role === "Admin";

  function handleAddNew() {
    // Hard navigation prevents the router cache from restoring the stale
    // /projects/new component — the page needs to mount fresh so its
    // useEffect fires and creates the Draft.
    window.location.href = "/projects/new";
  }

  function handleDelete(projectId: number) {
    deleteProject.mutate(projectId, {
      onSuccess: () => toast.success("Draft deleted."),
      onError: () => toast.error("Failed to delete draft."),
    });
  }

  const emptyMessage =
    activeTab === "all" || activeTab === "Draft"
      ? "No draft projects. Add one to get started."
      : "No projects match this filter.";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Projects</h1>
          {!isLoading && !isError && (
            <span className="text-sm text-muted-foreground">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          )}
          {canManage && (
            <div className="ml-auto">
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add New Project
              </Button>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {isLoading && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Loading projects…
          </div>
        )}

        {isError && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <p>Failed to load projects.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && projects.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}

        {!isLoading && !isError && projects.length > 0 && (
          <ProjectListTable
            projects={projects}
            canManage={canManage}
            onDelete={handleDelete}
            isDeleting={deleteProject.isPending}
          />
        )}
      </div>
    </div>
  );
}
