import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

const SUPPORTED_COLUMNS = new Set([
  "partType",
  "procurementCategory",
  "material",
  "materialForm",
  "vendor",
]);

export async function GET(req: NextRequest) {
  const column = req.nextUrl.searchParams.get("column");

  if (!column || !SUPPORTED_COLUMNS.has(column)) {
    return NextResponse.json(
      { error: { code: "INVALID_COLUMN", message: `Column "${column}" is not supported for distinct values` } },
      { status: 400 }
    );
  }

  let values: string[];

  switch (column) {
    case "partType": {
      const rows = await prisma.part.findMany({
        where: { isActive: true },
        select: { partType: true },
        distinct: ["partType"],
      });
      values = rows.map((r) => String(r.partType));
      break;
    }
    case "procurementCategory": {
      const rows = await prisma.part.findMany({
        where: { isActive: true, procurementCategory: { isNot: null } },
        select: { procurementCategory: { select: { categoryName: true } } },
      });
      const seen = new Set<string>();
      values = [];
      for (const r of rows) {
        const v = r.procurementCategory?.categoryName;
        if (v && !seen.has(v)) { seen.add(v); values.push(v); }
      }
      break;
    }
    case "material": {
      const rows = await prisma.part.findMany({
        where: { isActive: true, materialSpec: { isNot: null } },
        select: { materialSpec: { select: { materialName: true } } },
      });
      const seen = new Set<string>();
      values = [];
      for (const r of rows) {
        const v = r.materialSpec?.materialName;
        if (v && !seen.has(v)) { seen.add(v); values.push(v); }
      }
      break;
    }
    case "materialForm": {
      const rows = await prisma.part.findMany({
        where: { isActive: true, materialSpec: { isNot: null } },
        select: { materialSpec: { select: { form: true } } },
      });
      const seen = new Set<string>();
      values = [];
      for (const r of rows) {
        const v = r.materialSpec?.form;
        if (v && !seen.has(v)) { seen.add(v); values.push(v); }
      }
      break;
    }
    case "vendor": {
      const rows = await prisma.part.findMany({
        where: { isActive: true, defaultVendor: { isNot: null } },
        select: { defaultVendor: { select: { vendorName: true } } },
      });
      const seen = new Set<string>();
      values = [];
      for (const r of rows) {
        const v = r.defaultVendor?.vendorName;
        if (v && !seen.has(v)) { seen.add(v); values.push(v); }
      }
      break;
    }
    default: {
      return NextResponse.json(
        { error: { code: "INVALID_COLUMN", message: `Column "${column}" is not supported` } },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ values: values.sort() });
}
