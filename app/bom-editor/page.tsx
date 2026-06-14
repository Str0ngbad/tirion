import { BomEditorChrome } from "./_components/bom-editor-chrome";

export default function BomEditorLandingPage() {
  return (
    <div className="h-full flex flex-col bg-background">
      <BomEditorChrome autoFocusSearch />
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Search for an Assembly to view its BOM
      </div>
    </div>
  );
}
