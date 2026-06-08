import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import {
  ViewNotFoundError,
  ViewNameCollisionError,
  ViewLockedError,
  ViewMasterImmutableError,
} from "@/lib/errors/view";
import type { ViewRow, CreateViewInput, UpdateViewInput, FilterObject, SortSpec } from "@/lib/views/types";

// name is the only unique field on View, so any P2002 is a name collision.
function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const MASTER_VIEW_NAME = "Master View";

function parseViewRow(raw: {
  viewId: number;
  name: string;
  isDefault: boolean;
  isLocked: boolean;
  visibleColumns: Prisma.JsonValue;
  columnOrder: Prisma.JsonValue;
  defaultSort: Prisma.JsonValue;
  filters: Prisma.JsonValue;
}): ViewRow {
  return {
    viewId: raw.viewId,
    name: raw.name,
    isDefault: raw.isDefault,
    isLocked: raw.isLocked,
    visibleColumns: raw.visibleColumns as string[],
    columnOrder: raw.columnOrder as string[] | null,
    defaultSort: raw.defaultSort as SortSpec[],
    filters: raw.filters as FilterObject[],
  };
}

export async function listViews(): Promise<ViewRow[]> {
  const rows = await prisma.view.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map(parseViewRow);
}

export async function getView(viewId: number): Promise<ViewRow> {
  const raw = await prisma.view.findUnique({ where: { viewId } });
  if (raw === null) throw new ViewNotFoundError(viewId);
  return parseViewRow(raw);
}

export async function createView(
  input: CreateViewInput,
  userId: number
): Promise<ViewRow> {
  try {
    return await mutateWithAudit<ViewRow>({
      userId,
      entityType: "View",
      action: "ViewCreated",
      work: async (tx) => {
        const created = await tx.view.create({
          data: {
            name: input.name,
            visibleColumns: input.visibleColumns,
            ...(input.columnOrder !== undefined && { columnOrder: input.columnOrder }),
            defaultSort: input.defaultSort,
            filters: input.filters as Prisma.InputJsonValue,
            isDefault: false,
            isLocked: false,
          },
        });

        const result = parseViewRow(created);
        return {
          entityId: created.viewId,
          previousValue: null,
          newValue: { name: created.name },
          result,
        };
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new ViewNameCollisionError(input.name);
    throw err;
  }
}

export async function updateView(
  viewId: number,
  input: UpdateViewInput,
  userId: number
): Promise<ViewRow> {
  try {
    return await mutateWithAudit<ViewRow>({
      userId,
      entityType: "View",
      action: "ViewUpdated",
      work: async (tx) => {
        const view = await tx.view.findUnique({ where: { viewId } });
        if (view === null) throw new ViewNotFoundError(viewId);

        // The Master View cannot be updated at all via the API.
        // spec: "Saves to this View are disabled; users must use Save as new
        // to preserve a modified state." We enforce at the API layer too.
        if (view.name === MASTER_VIEW_NAME) {
          throw new ViewMasterImmutableError(Object.keys(input)[0] ?? "unknown");
        }

        const previousValue = {
          name: view.name,
          visibleColumns: view.visibleColumns,
          defaultSort: view.defaultSort,
          filters: view.filters,
        };

        const updated = await tx.view.update({
          where: { viewId },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.visibleColumns !== undefined && { visibleColumns: input.visibleColumns }),
            ...(input.columnOrder !== undefined && { columnOrder: input.columnOrder }),
            ...(input.defaultSort !== undefined && { defaultSort: input.defaultSort }),
            ...(input.filters !== undefined && { filters: input.filters as Prisma.InputJsonValue }),
          },
        });

        return {
          entityId: viewId,
          previousValue,
          newValue: { name: updated.name },
          result: parseViewRow(updated),
        };
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ViewNameCollisionError(input.name ?? "");
    }
    throw err;
  }
}

export async function deleteView(viewId: number, userId: number): Promise<void> {
  await mutateWithAudit<void>({
    userId,
    entityType: "View",
    action: "ViewDeleted",
    work: async (tx) => {
      const view = await tx.view.findUnique({ where: { viewId } });
      if (view === null) throw new ViewNotFoundError(viewId);
      if (view.isLocked) throw new ViewLockedError(viewId, "deleted");

      const previousValue = {
        name: view.name,
        visibleColumns: view.visibleColumns,
        defaultSort: view.defaultSort,
        filters: view.filters,
      };

      await tx.view.delete({ where: { viewId } });

      return {
        entityId: viewId,
        previousValue,
        newValue: null,
        result: undefined,
      };
    },
  });
}
