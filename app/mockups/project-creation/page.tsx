"use client";

import { useState } from "react";
import { getSessionProjects, MockProject } from "./_data";
import ProjectList from "./_components/project-list";

export default function ProjectCreationPage() {
  // Initialize from the session store — persists project additions/deletions made on the detail page.
  const [projects, setProjects] = useState<MockProject[]>(() => getSessionProjects());

  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground">
      {/* Chrome */}
      <div className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4">
        <span className="text-sm font-medium text-muted-foreground">Tirion</span>
        <span className="mx-2 text-muted-foreground/40">/</span>
        <span className="text-sm font-semibold text-foreground">Project Creation</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <ProjectList projects={projects} setProjects={setProjects} />
      </div>
    </div>
  );
}
