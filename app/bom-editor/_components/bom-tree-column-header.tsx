export function BomTreeColumnHeader() {
  return (
    <div className="sticky top-0 z-10 flex items-center bg-muted text-xs font-semibold text-foreground border-b border-border">
      <div className="w-6 shrink-0" />
      <div className="flex-1 min-w-0 px-2 py-2">Component</div>
      <div className="w-16 shrink-0 text-right px-2 py-2">Qty</div>
      <div className="w-20 shrink-0 text-right px-2 py-2">Stock</div>
      <div className="w-20 shrink-0 text-right px-2 py-2">Buildable</div>
      <div className="w-24 shrink-0 text-right px-2 py-2">Cost</div>
      <div className="w-8 shrink-0 px-2 py-2" />
      <div className="w-24 shrink-0 px-2 py-2">Location</div>
      <div className="w-8 shrink-0" />
    </div>
  );
}
