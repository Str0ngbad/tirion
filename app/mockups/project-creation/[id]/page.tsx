"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { getSessionProjects, setSessionProjects, MockProject, PROJECT_COLOR_MAP } from "../_data";
import DraftEditor from "../_components/draft-editor";
import ActiveSummary from "../_components/active-summary";
import { ArrowLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

export default function ProjectDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();

  // Initialize from the session store so new projects created on the list page are visible here.
  // Edits made here are synced back to the session store in updateProject() so the list
  // page sees the changes on navigate-back.
  const [projects, setProjects] = useState<MockProject[]>(() => getSessionProjects());

  const project = projects.find(
    (p) => p.projectId === parseInt(id) || p.projectNumber === id
  );

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <button
          onClick={() => router.push("/mockups/project-creation")}
          className="mt-4 text-xs text-primary underline"
        >
          Back to Project List
        </button>
      </div>
    );
  }

  function updateProject(updated: MockProject) {
    setProjects((prev) => {
      const next = prev.map((p) => (p.projectId === updated.projectId ? updated : p));
      setSessionProjects(next); // sync changes back so list page sees them on navigate-back
      return next;
    });
  }

  function onCompileSuccess(compiled: MockProject) {
    // Transition compiled project to Active, then go back to list
    updateProject(compiled);
    router.push("/mockups/project-creation");
  }

  function onDeleteDraft() {
    // Remove from session store so the list page reflects the deletion on navigate-back
    const next = projects.filter((p) => p.projectId !== project?.projectId);
    setSessionProjects(next);
    router.push("/mockups/project-creation");
  }

  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground">
      {/* Chrome */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <button
          onClick={() => router.push("/mockups/project-creation")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Projects</span>
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {project.color && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PROJECT_COLOR_MAP[project.color].hex }}
            />
          )}
          {project.projectNumber} — {project.projectName || <span className="text-muted-foreground font-normal italic">Untitled Draft</span>}
        </span>
        <span className="ml-2 rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
          {project.status}
        </span>
      </div>

      {/* Surface — Draft Editor or Active Summary */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {project.status === "Draft" ? (
          <DraftEditor
            project={project}
            onChange={updateProject}
            onCompileSuccess={onCompileSuccess}
            onDeleteDraft={onDeleteDraft}
          />
        ) : (
          <ActiveSummary project={project} onChange={updateProject} />
        )}
      </div>
    </div>
  );
}
