type Props = {
  partName: string;
  stockCount: number;
};

export default function DefinitionChangeFlagStockView({ partName, stockCount }: Props) {
  return (
    <div className="w-full max-w-2xl py-2">
      <p className="text-sm text-foreground">
        <span className="text-2xl font-bold tabular-nums text-foreground">{stockCount}</span>
        {" "}
        <span className="text-muted-foreground">
          {stockCount === 1 ? "unit" : "units"} of{" "}
          <span className="font-medium text-foreground">{partName}</span>{" "}
          currently in stock.
        </span>
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Existing stock may not conform to the updated definition. Review and reconcile as needed.
      </p>
    </div>
  );
}
