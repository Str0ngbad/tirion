"use client";

import BomEditorChrome from "./_components/bom-editor-chrome";

export default function BomEditorLandingPage() {
  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground">
      <BomEditorChrome autoFocusSearch />
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Search for an Assembly to view its BOM
        </p>
      </div>
    </div>
  );
}
