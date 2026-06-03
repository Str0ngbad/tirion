export type BomNode = {
  bomId: number | null;
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  quantity: number | null;
  stockCount: number | null;
  cost: number | null;
  costLastUpdated: string | null;
  inventoryLocation: string | null;
  children: BomNode[];
};

export type BomEdgeRow = {
  bomId: number;
  parentPartId: number;
  childPartId: number;
  quantity: number;
};

export type CreateBomEdgeInput = {
  parentPartId: number;
  childPartId: number;
  quantity: number;
};

export type UpdateBomEdgeInput = {
  quantity: number;
};

export type BulkDeleteInput = {
  edgeIds: number[];
};

export type SaveResponse = {
  edge: BomEdgeRow;
  flaggedWoCount: number;
};
