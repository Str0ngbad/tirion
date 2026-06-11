"use client";

import { useEffect, useRef, useState } from "react";
import { useCreateProject } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function NewProjectPage() {
  const createProject = useCreateProject();
  const [error, setError] = useState<string | null>(null);
  const didCreate = useRef(false);

  function doCreate() {
    setError(null);
    didCreate.current = true;
    createProject.mutate(
      {
        projectNumber: `DRAFT-${Date.now()}`,
        projectName: "New Project",
      },
      {
        onSuccess: (project) => {
          // Hard navigation bypasses Next.js router cache, ensuring the edit
          // page always mounts fresh with the new project loaded.
          window.location.replace(`/projects/${project.projectId}/edit`);
        },
        onError: () => {
          didCreate.current = false;
          setError("Failed to create draft. Please try again.");
        },
      }
    );
  }

  useEffect(() => {
    if (!didCreate.current) {
      doCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={doCreate}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Creating draft…
    </div>
  );
}
