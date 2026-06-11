"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/lib/api/projects";
import { ProjectIdPill } from "@/components/project/project-id-pill";
import { DraftEditor } from "./_components/draft-editor";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

type Props = { params: Promise<{ id: string }> };

export default function EditProjectPage({ params }: Props) {
  const { id } = use(params);
  const projectId = parseInt(id, 10);
  const router = useRouter();

  const { data: project, isLoading, isError } = useProject(
    Number.isInteger(projectId) && projectId > 0 ? projectId : null
  );

  // Redirect non-Draft projects to the summary view
  useEffect(() => {
    if (project && project.status !== "Draft") {
      router.replace(`/projects/${project.projectId}`);
    }
  }, [project, router]);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <p>Invalid project ID.</p>
        <Link href="/projects" className="text-primary underline">Back to Projects</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading project…
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <p>Project not found.</p>
        <Link href="/projects" className="text-primary underline">Back to Projects</Link>
      </div>
    );
  }

  // While redirecting non-Draft projects, show nothing
  if (project.status !== "Draft") return null;

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-6">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium">
          <ProjectIdPill projectNumber={project.projectNumber} color={project.color} />
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
          Draft
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <DraftEditor initialProject={project} />
      </div>
    </div>
  );
}
