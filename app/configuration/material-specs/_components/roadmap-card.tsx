export function RoadmapCard() {
  return (
    <div className="max-w-sm bg-muted/30 border border-border rounded-md p-6 text-sm">
      <h3 className="font-semibold mb-2 text-foreground">Materials — Rev 1</h3>
      <p className="text-muted-foreground mb-3 leading-relaxed">
        Scoped narrow for the initial release. The data model
        captures (material, form) pairs with full validation and
        audit infrastructure; the surface presents what&apos;s needed
        to define parts and nothing more.
      </p>
      <p className="text-muted-foreground leading-relaxed">
        Rev 2 expands this into the full material handling pass —
        vendor sourcing, dimensional standards, stock management,
        usage rollups across parts and work orders. It&apos;s the
        first item on the post-Rev 1 roadmap.
      </p>
    </div>
  );
}
