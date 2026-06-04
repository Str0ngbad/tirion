/**
 * Phase 1E import script.
 * See spec/data_import_mapping.md for the full algorithm.
 *
 * Usage:
 *   npx tsx scripts/import-prior-shop-data.ts           # dry-run (default, no DB writes)
 *   npx tsx scripts/import-prior-shop-data.ts --commit  # commit to database
 */

import path from "path";
import fs from "fs";
import { prisma } from "@/lib/db/client";
import { createVendor } from "@/lib/vendors/service";
import { createMaterialSpec } from "@/lib/material-specs/service";
import { createRoutingTemplate } from "@/lib/routing-templates/service";
import { createPart, updateStockCount, updateInventoryLocation } from "@/lib/parts/service";
import { createBomEdge } from "@/lib/bom/service";
import { VendorNameCollisionError } from "@/lib/errors/vendor";
import { MaterialSpecCollisionError } from "@/lib/errors/material-spec";
import { RoutingTemplateNameCollisionError } from "@/lib/errors/routing-template";
import { PartNumberCollisionError } from "@/lib/errors/part";
import { BomDuplicateChildError, BomCycleError, BomDepthExceededError } from "@/lib/errors/bom";

const ROOT = path.resolve(__dirname, "..");
const DATA_IMPORT = path.join(ROOT, "data-import");

// ─── Minimal RFC 4180 CSV parser ─────────────────────────────────────────────

function parseCSV(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = raw.length;
  while (i < n) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') { field += '"'; i += 2; }
        else { inQuotes = false; i++; }
      } else { field += ch; i++; }
    } else {
      if (ch === '"') { inQuotes = true; i++; }
      else if (ch === ',') { row.push(field); field = ""; i++; }
      else if (ch === '\r' && raw[i + 1] === '\n') {
        row.push(field); rows.push(row); row = []; field = ""; i += 2;
      } else if (ch === '\n') {
        row.push(field); rows.push(row); row = []; field = ""; i++;
      } else { field += ch; i++; }
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function readCSV(filePath: string): string[][] {
  const raw = fs.readFileSync(filePath, "utf-8");
  return parseCSV(raw);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cell(row: string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

function parseDecimal(s: string): number | null {
  const cleaned = s.replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseDate(s: string): Date | null {
  const str = s.trim();
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function parseInteger(s: string): number | null {
  const cleaned = s.trim();
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

// ─── Category normalization (Section 5) ─────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  po: "Stock Cut",
  ctl: "Pre-Cut",
  p: "Purchased",
  hw: "Purchased",
  "3d": "Purchased",
  sm: "Sheet Metal",
};

function normalizeCategoryName(raw: string): string | null {
  const code = raw.trim().toLowerCase().replace(/\s+$/, "");
  return CATEGORY_MAP[code] ?? null;
}

// ─── Routing shape synthesis (Section 6) ─────────────────────────────────────

function synthPartStepSequence(
  category: string, machine: string, weld: string, blacken: string, paint: string
): string {
  if (category.trim().toUpperCase() === "3D") {
    return "Purchase + Receive + 3D Print + Distribution";
  }
  const steps = ["Purchase", "Receive"];
  if (machine.trim().toUpperCase() === "Y") steps.push("Machine");
  if (weld.trim().toUpperCase() === "Y") steps.push("Weld");
  if (blacken.trim().toUpperCase() === "Y") steps.push("Blacken");
  if (paint.trim().toUpperCase() === "Y") steps.push("Paint");
  steps.push("Distribution");
  return steps.join(" + ");
}

function synthAssemblyStepSequence(
  machine: string, weld: string, blacken: string, paint: string
): string {
  const steps: string[] = [];
  steps.push(weld.trim().toUpperCase() === "Y" ? "Weld" : "Assemble");
  if (machine.trim().toUpperCase() === "Y") steps.push("Machine");
  if (blacken.trim().toUpperCase() === "Y") steps.push("Blacken");
  if (paint.trim().toUpperCase() === "Y") steps.push("Paint");
  steps.push("Distribution");
  return steps.join(" + ");
}

function get3DConflictFlags(
  category: string, machine: string, weld: string, blacken: string, paint: string
): string[] | null {
  if (category.trim().toUpperCase() !== "3D") return null;
  const flags: string[] = [];
  if (machine.trim().toUpperCase() === "Y") flags.push("Machine");
  if (weld.trim().toUpperCase() === "Y") flags.push("Weld");
  if (blacken.trim().toUpperCase() === "Y") flags.push("Blacken");
  if (paint.trim().toUpperCase() === "Y") flags.push("Paint");
  return flags.length > 0 ? flags : null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Counts { created: number; alreadyExisted: number; }
const makeCount = (): Counts => ({ created: 0, alreadyExisted: 0 });

interface ValidationError { source: string; identifier: string; errorClass: string; message: string; }
interface SourceCount { total: number; imported: number; skipped: number; skipReasons: Record<string, number>; }
const makeSourceCount = (): SourceCount => ({ total: 0, imported: 0, skipped: 0, skipReasons: {} });

function skip(sc: SourceCount, reason: string) {
  sc.skipped++;
  sc.skipReasons[reason] = (sc.skipReasons[reason] ?? 0) + 1;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = !process.argv.includes("--commit");
  const startedAt = new Date();
  console.log(`\nPHASE 1E IMPORT — Mode: ${isDryRun ? "DRY-RUN (no DB writes)" : "COMMIT"}`);
  console.log(`Started: ${startedAt.toISOString()}\n`);

  // ── Read all input files (hard-fail on missing) ────────────────────────────

  console.log("Reading input files...");
  let partMasterRows: string[][];
  let assemblyMasterRows: string[][];
  let assemblyDesignerRows: string[][];
  let vendorMasterRows: string[][];
  let matNormRows: string[][];
  let matMixedRows: string[][];
  let vendorNormRows: string[][];
  let routingPreviewRows: string[][];
  try {
    partMasterRows     = readCSV(path.join(ROOT, "Master Production Tool (Split on 09-16-25) - Part Master.csv"));
    assemblyMasterRows = readCSV(path.join(ROOT, "Master Production Tool (Split on 09-16-25) - Assembly Master.csv"));
    assemblyDesignerRows = readCSV(path.join(ROOT, "Master Production Tool (Split on 09-16-25) - Assembly Designer.csv"));
    vendorMasterRows   = readCSV(path.join(ROOT, "Master Production Tool (Split on 09-16-25) - Vendor Master.csv"));
    matNormRows        = readCSV(path.join(DATA_IMPORT, "material_normalization.csv"));
    matMixedRows       = readCSV(path.join(DATA_IMPORT, "material_mixed_form_resolution.csv"));
    vendorNormRows     = readCSV(path.join(DATA_IMPORT, "vendor_normalization.csv"));
    routingPreviewRows = readCSV(path.join(DATA_IMPORT, "routing_template_synthesis_preview.csv"));
  } catch (err) {
    console.error("HARD FAILURE — cannot read input files:", (err as Error).message);
    process.exit(1);
  }
  console.log(`  Part Master: ${partMasterRows.length - 1} rows`);
  console.log(`  Assembly Master: ${assemblyMasterRows.length - 1} rows`);
  console.log(`  Assembly Designer: ${assemblyDesignerRows.length - 1} rows`);
  console.log(`  Vendor Master: ${vendorMasterRows.length - 1} rows`);
  console.log();

  // ── Build normalization lookup tables ─────────────────────────────────────

  // mat normalization: csv_material_value → { materialName, form } | null (null = explicitly unmapped)
  // form may be "" for ambiguous (mixed-form) cases where materialName IS present
  type MatEntry = { materialName: string; form: string } | null;
  const matNormMap = new Map<string, MatEntry>();
  for (let i = 1; i < matNormRows.length; i++) {
    const r = matNormRows[i];
    const csvVal = cell(r, 0);
    if (!csvVal) continue;
    const materialName = cell(r, 1);
    const form = cell(r, 2);
    matNormMap.set(csvVal, materialName ? { materialName, form } : null);
  }

  // mixed form: (csvVal, partNumber) → user_resolved_form
  const matMixedMap = new Map<string, string>();
  for (let i = 1; i < matMixedRows.length; i++) {
    const r = matMixedRows[i];
    const csvVal = cell(r, 0);
    const partNum = cell(r, 1);
    const resolvedForm = cell(r, 6);
    if (csvVal && partNum && resolvedForm) {
      matMixedMap.set(`${csvVal}||${partNum}`, resolvedForm);
    }
  }

  // vendor normalization: csv_string → { canonicalName, action }
  const vendorNormMap = new Map<string, { canonicalName: string; action: string }>();
  for (let i = 1; i < vendorNormRows.length; i++) {
    const r = vendorNormRows[i];
    const csvStr = (r[0] ?? "").trim(); // blank string is valid key
    const canonicalName = cell(r, 1);
    const action = cell(r, 2);
    if (!action) continue;
    vendorNormMap.set(csvStr, { canonicalName, action });
  }

  // routing preview: step_sequence → { effectiveName, action }
  // effectiveName = user_rename (if set and action=keep) else template_name;
  // for merge rows, effectiveName = user_rename (the merge target)
  interface RoutingEntry { stepSequence: string; effectiveName: string; action: "keep" | "merge"; }
  const routingBySeq = new Map<string, RoutingEntry>();
  for (let i = 1; i < routingPreviewRows.length; i++) {
    const r = routingPreviewRows[i];
    const templateName = cell(r, 0);
    const stepSeq = cell(r, 1);
    const userRename = cell(r, 4);
    const userAction = cell(r, 5).toLowerCase() as "keep" | "merge";
    if (!stepSeq) continue;
    routingBySeq.set(stepSeq, {
      stepSequence: stepSeq,
      effectiveName: userRename || templateName,
      action: userAction,
    });
  }

  // ── Load seeded DB entities ────────────────────────────────────────────────

  console.log("Loading seeded DB entities...");
  const activeUser = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { userId: "asc" } });
  if (!activeUser) {
    console.error("HARD FAILURE — no active User found in database.");
    process.exit(1);
  }
  const userId = activeUser.userId;
  console.log(`  Using userId=${userId}`);

  const procCats = await prisma.procurementCategory.findMany({ where: { isActive: true }, select: { procurementCategoryId: true, categoryName: true } });
  const procCatByName = new Map(procCats.map(c => [c.categoryName, c.procurementCategoryId]));
  console.log(`  Procurement categories: ${procCats.length}`);

  const processTypes = await prisma.processType.findMany({ where: { isActive: true }, select: { processTypeId: true, processName: true } });
  const procTypeByName = new Map(processTypes.map(pt => [pt.processName, pt.processTypeId]));
  console.log(`  Process types: ${processTypes.length}`);
  console.log();

  // ── Determine which assemblies have BOM rows (skip childless) ─────────────

  const assembliesWithBomRows = new Set<string>();
  for (let i = 1; i < assemblyDesignerRows.length; i++) {
    const r = assemblyDesignerRows[i];
    const asmId = cell(r, 0);
    const type = cell(r, 4);
    if (!asmId || type === "DO NOT EDIT TOP ROW" || !type || type.toLowerCase() === "nan") continue;
    assembliesWithBomRows.add(asmId);
  }

  // ── Tracking ──────────────────────────────────────────────────────────────

  const counts = {
    vendors: makeCount(), materialSpecs: makeCount(),
    routingTemplates: makeCount(), parts: makeCount(),
    assemblies: makeCount(), bomEdges: makeCount(),
  };
  const sc = {
    partMaster: makeSourceCount(), assemblyMaster: makeSourceCount(),
    assemblyDesigner: makeSourceCount(), vendorMaster: makeSourceCount(),
  };
  const errors: ValidationError[] = [];
  const unmappedMaterials = new Map<string, Set<string>>(); // csvVal → Set<partNumber>
  const unmappedVendors = new Map<string, Set<string>>();   // csvStr → Set<partNumber>
  const threeDConflicts: { partNumber: string; partName: string; flags: string[] }[] = [];
  const templateAssignments = new Map<string, { partCount: number; assemblyCount: number }>();

  function trackUnmappedMat(csvVal: string, pn: string) {
    if (!unmappedMaterials.has(csvVal)) unmappedMaterials.set(csvVal, new Set());
    unmappedMaterials.get(csvVal)!.add(pn);
  }
  function trackUnmappedVendor(csvStr: string, pn: string) {
    if (!unmappedVendors.has(csvStr)) unmappedVendors.set(csvStr, new Set());
    unmappedVendors.get(csvStr)!.add(pn);
  }
  function trackTemplateAssign(name: string, type: "part" | "assembly") {
    if (!templateAssignments.has(name)) templateAssignments.set(name, { partCount: 0, assemblyCount: 0 });
    const ta = templateAssignments.get(name)!;
    if (type === "part") ta.partCount++; else ta.assemblyCount++;
  }

  // In-memory ID maps (real IDs in commit mode; negative sentinels in dry-run for new entities)
  let dryRunSeq = -1;
  const nextDryId = () => dryRunSeq--;
  const vendorIdByName = new Map<string, number>();
  const matSpecIdByKey = new Map<string, number>(); // `${materialName}||${form}`
  const templateIdByName = new Map<string, number>();
  const partIdByNumber = new Map<string, number>();

  // ═══ PHASE A: Vendors ════════════════════════════════════════════════════════

  console.log("=== Phase A: Vendors ===");

  // Load existing vendors from DB
  const existingVendors = await prisma.vendor.findMany({ select: { vendorId: true, vendorName: true } });
  for (const v of existingVendors) vendorIdByName.set(v.vendorName, v.vendorId);

  // Helper: upsert a vendor by name
  async function upsertVendor(
    vendorName: string,
    metadata: {
      contactInfo?: string | null;
      location?: string | null;
      website?: string | null;
      notes?: string | null;
    }
  ): Promise<void> {
    if (vendorIdByName.has(vendorName)) { counts.vendors.alreadyExisted++; return; }
    if (isDryRun) { vendorIdByName.set(vendorName, nextDryId()); counts.vendors.created++; return; }
    try {
      const v = await createVendor({ vendorName, leadTimeDays: null, ...metadata }, userId);
      vendorIdByName.set(vendorName, v.vendorId);
      counts.vendors.created++;
    } catch (err) {
      if (err instanceof VendorNameCollisionError) {
        const ex = await prisma.vendor.findFirst({ where: { vendorName } });
        if (ex) vendorIdByName.set(vendorName, ex.vendorId);
        counts.vendors.alreadyExisted++;
      } else {
        errors.push({ source: "Vendor Master", identifier: vendorName, errorClass: (err as Error).constructor.name, message: String(err) });
      }
    }
  }

  // Process Vendor Master rows (with full metadata)
  for (let i = 1; i < vendorMasterRows.length; i++) {
    const r = vendorMasterRows[i];
    const vendorName = cell(r, 1);
    sc.vendorMaster.total++;
    if (!vendorName) { skip(sc.vendorMaster, "no name (reserved ID)"); continue; }
    sc.vendorMaster.imported++;

    const location = cell(r, 2) || null;
    const primaryContact = cell(r, 3) || null;
    const email = cell(r, 4) || null;
    const phone = cell(r, 5) || null;
    const website = cell(r, 6) || null;
    const notes = cell(r, 7) || null;
    const contactParts: string[] = [];
    if (primaryContact) contactParts.push(`Name: ${primaryContact}`);
    if (email) contactParts.push(`Email: ${email}`);
    if (phone) contactParts.push(`Phone: ${phone}`);
    const contactInfo = contactParts.length > 0 ? contactParts.join("\n") : null;

    await upsertVendor(vendorName, { contactInfo, location, website, notes });
  }

  // Ensure all canonical vendor names referenced in normalization map exist (for non-drop actions)
  // This covers promote, import_only, and "merge into X" style entries
  const canonicalNamesNeeded = new Set<string>();
  for (const { canonicalName, action } of vendorNormMap.values()) {
    if (action !== "drop" && canonicalName) canonicalNamesNeeded.add(canonicalName);
  }
  for (const name of canonicalNamesNeeded) {
    await upsertVendor(name, { contactInfo: null, location: null, website: null, notes: null });
  }

  console.log(`  Created: ${counts.vendors.created}, Already existed: ${counts.vendors.alreadyExisted}`);

  // ═══ PHASE B: MaterialSpecs ═══════════════════════════════════════════════════

  console.log("=== Phase B: MaterialSpecs ===");

  const existingSpecs = await prisma.materialSpec.findMany({ select: { materialSpecId: true, materialName: true, form: true } });
  for (const ms of existingSpecs) matSpecIdByKey.set(`${ms.materialName}||${ms.form}`, ms.materialSpecId);

  // Collect unique (materialName, form) pairs to create
  const specsToCreate = new Map<string, { materialName: string; form: string }>();

  // Path 1: normalization map entries where both materialName and form are non-blank
  for (const [, entry] of matNormMap.entries()) {
    if (!entry || !entry.materialName || !entry.form) continue;
    const key = `${entry.materialName}||${entry.form}`;
    specsToCreate.set(key, { materialName: entry.materialName, form: entry.form });
  }

  // Path 2: mixed-form resolution entries (materialName from norm map, form from resolution)
  for (let i = 1; i < matMixedRows.length; i++) {
    const r = matMixedRows[i];
    const csvVal = cell(r, 0);
    const resolvedForm = cell(r, 6);
    if (!csvVal || !resolvedForm) continue;
    const normEntry = matNormMap.get(csvVal);
    if (!normEntry || !normEntry.materialName) continue;
    const key = `${normEntry.materialName}||${resolvedForm}`;
    specsToCreate.set(key, { materialName: normEntry.materialName, form: resolvedForm });
  }

  for (const [key, { materialName, form }] of specsToCreate.entries()) {
    if (matSpecIdByKey.has(key)) { counts.materialSpecs.alreadyExisted++; continue; }
    if (isDryRun) { matSpecIdByKey.set(key, nextDryId()); counts.materialSpecs.created++; continue; }
    try {
      const ms = await createMaterialSpec({ materialName, form }, userId);
      matSpecIdByKey.set(key, ms.materialSpecId);
      counts.materialSpecs.created++;
    } catch (err) {
      if (err instanceof MaterialSpecCollisionError) {
        const ex = await prisma.materialSpec.findFirst({ where: { materialName, form } });
        if (ex) matSpecIdByKey.set(key, ex.materialSpecId);
        counts.materialSpecs.alreadyExisted++;
      } else {
        errors.push({ source: "MaterialSpec", identifier: key, errorClass: (err as Error).constructor.name, message: String(err) });
      }
    }
  }

  console.log(`  Created: ${counts.materialSpecs.created}, Already existed: ${counts.materialSpecs.alreadyExisted}`);

  // ═══ PHASE C: Routing Templates ══════════════════════════════════════════════

  console.log("=== Phase C: Routing Templates ===");

  const existingTemplates = await prisma.routingTemplateDefinition.findMany({ select: { routingTemplateDefinitionId: true, templateName: true } });
  for (const t of existingTemplates) templateIdByName.set(t.templateName, t.routingTemplateDefinitionId);

  // Create only "keep" templates
  for (const [, entry] of routingBySeq.entries()) {
    if (entry.action !== "keep") continue;
    const name = entry.effectiveName;
    if (templateIdByName.has(name)) { counts.routingTemplates.alreadyExisted++; continue; }

    const stepNames = entry.stepSequence.split(" + ").map(s => s.trim());
    const steps: { processTypeId: number; stepIndex: number }[] = [];
    let valid = true;
    for (let idx = 0; idx < stepNames.length; idx++) {
      const pid = procTypeByName.get(stepNames[idx]);
      if (!pid) {
        errors.push({ source: "RoutingTemplate", identifier: name, errorClass: "ProcessTypeNotFound", message: `"${stepNames[idx]}" not in ProcessType seed` });
        valid = false; break;
      }
      steps.push({ processTypeId: pid, stepIndex: idx + 1 });
    }
    if (!valid) continue;

    if (isDryRun) { templateIdByName.set(name, nextDryId()); counts.routingTemplates.created++; continue; }
    try {
      const result = await createRoutingTemplate({ templateName: name, steps }, userId);
      templateIdByName.set(name, result.template.routingTemplateDefinitionId);
      counts.routingTemplates.created++;
    } catch (err) {
      if (err instanceof RoutingTemplateNameCollisionError) {
        const ex = await prisma.routingTemplateDefinition.findFirst({ where: { templateName: name } });
        if (ex) templateIdByName.set(name, ex.routingTemplateDefinitionId);
        counts.routingTemplates.alreadyExisted++;
      } else {
        errors.push({ source: "RoutingTemplate", identifier: name, errorClass: (err as Error).constructor.name, message: String(err) });
      }
    }
  }

  console.log(`  Created: ${counts.routingTemplates.created}, Already existed: ${counts.routingTemplates.alreadyExisted}`);

  // ── Resolve routing template ID for a synthesized step sequence ──────────

  function resolveTemplateId(stepSeq: string, identifier: string): number | null {
    const entry = routingBySeq.get(stepSeq);
    if (!entry) {
      // Shape not in synthesis preview at all — log and return null
      errors.push({ source: "Routing", identifier, errorClass: "UnknownRoutingShape", message: `Step sequence "${stepSeq}" not found in synthesis preview` });
      return null;
    }
    const id = templateIdByName.get(entry.effectiveName);
    return id ?? null;
  }

  // ═══ PHASE D: Parts (type "Part") ════════════════════════════════════════════

  console.log("=== Phase D: Parts ===");

  const existingParts = await prisma.part.findMany({ where: { partType: "Part" }, select: { partId: true, partNumber: true } });
  for (const p of existingParts) partIdByNumber.set(p.partNumber, p.partId);

  // Part Master column indices:
  // 0=Internal Part Number, 1=Part Name, 4=Location, 5=Vendor Part ID,
  // 6=Stock Size, 7=Length, 8=Material, 9=Category, 10=Vendor,
  // 13=Machine, 15=Weld, 16=Blacken, 17=Paint,
  // 18=Material Cost, 21=Inventory, 22=Cost Date,
  // 28=Machine Cycle Time, 29=Number of Setups

  for (let i = 1; i < partMasterRows.length; i++) {
    const r = partMasterRows[i];
    const partNumber = cell(r, 0);
    sc.partMaster.total++;
    if (!partNumber) { skip(sc.partMaster, "blank Internal Part Number"); continue; }
    sc.partMaster.imported++;

    const partName = cell(r, 1) || partNumber;
    const inventoryLocation = cell(r, 4) || null;
    const vendorPartNumber = cell(r, 5) || null;
    const stockSize = cell(r, 6) || null;
    const categoryCsv = cell(r, 9);
    const vendorCsv = cell(r, 10); // trimmed — blank = "no vendor"
    const machineCsv = cell(r, 13);
    const weldCsv = cell(r, 15);
    const blackenCsv = cell(r, 16);
    const paintCsv = cell(r, 17);

    // Material resolution (Section 4.b)
    const materialCsv = cell(r, 8);
    let materialSpecId: number | null = null;
    const normEntry = matNormMap.get(materialCsv);
    if (normEntry === undefined) {
      if (materialCsv) trackUnmappedMat(materialCsv, partNumber);
    } else if (normEntry === null) {
      if (materialCsv) trackUnmappedMat(materialCsv, partNumber);
    } else if (normEntry.form) {
      // Both present — direct lookup
      materialSpecId = matSpecIdByKey.get(`${normEntry.materialName}||${normEntry.form}`) ?? null;
    } else {
      // materialName present, form blank — mixed-form resolution
      const resolvedForm = matMixedMap.get(`${materialCsv}||${partNumber}`);
      if (resolvedForm) {
        materialSpecId = matSpecIdByKey.get(`${normEntry.materialName}||${resolvedForm}`) ?? null;
      } else {
        if (materialCsv) trackUnmappedMat(materialCsv, partNumber);
      }
    }

    // Vendor resolution (Section 3.2)
    let defaultVendorId: number | null = null;
    const vendorEntry = vendorNormMap.get(vendorCsv);
    if (vendorEntry === undefined) {
      if (vendorCsv) trackUnmappedVendor(vendorCsv, partNumber);
    } else if (vendorEntry.action === "drop") {
      defaultVendorId = null;
    } else {
      const vid = vendorIdByName.get(vendorEntry.canonicalName);
      if (vid !== undefined) {
        // Only assign if real (positive) vendor ID in commit mode
        defaultVendorId = vid;
      } else if (vendorEntry.canonicalName) {
        trackUnmappedVendor(vendorCsv, partNumber);
      }
    }

    // 3D conflicts
    const conflictFlags = get3DConflictFlags(categoryCsv, machineCsv, weldCsv, blackenCsv, paintCsv);
    if (conflictFlags) threeDConflicts.push({ partNumber, partName, flags: conflictFlags });

    // Routing
    const stepSeq = synthPartStepSequence(categoryCsv, machineCsv, weldCsv, blackenCsv, paintCsv);
    const rawRoutingId = resolveTemplateId(stepSeq, `Part ${partNumber}`);
    let routingTemplateDefinitionId: number | null = rawRoutingId;
    if (rawRoutingId !== null) {
      const tname = routingBySeq.get(stepSeq)?.effectiveName;
      if (tname) trackTemplateAssign(tname, "part");
    }

    // Category
    const catName = normalizeCategoryName(categoryCsv);
    const procurementCategoryId = catName ? (procCatByName.get(catName) ?? null) : null;

    // Numeric fields
    const blankLength = parseDecimal(cell(r, 7));
    const partCost = parseDecimal(cell(r, 18));
    const inventoryRaw = cell(r, 21);
    const stockCount = inventoryRaw ? (parseDecimal(inventoryRaw) ?? 0) : 0;
    const partCostUpdatedAt = parseDate(cell(r, 22));
    const machineCycleTime = parseInteger(cell(r, 28));
    const numberOfSetups = parseInteger(cell(r, 29));

    if (partIdByNumber.has(partNumber)) { counts.parts.alreadyExisted++; continue; }

    const createInput = {
      partNumber, partName, partType: "Part" as const,
      vendorPartNumber: vendorPartNumber ?? undefined,
      stockSize: stockSize ?? undefined,
      blankLength: blankLength ?? undefined,
      materialSpecId: (materialSpecId !== null && materialSpecId > 0) ? materialSpecId : undefined,
      procurementCategoryId: procurementCategoryId ?? undefined,
      defaultVendorId: (defaultVendorId !== null && defaultVendorId > 0) ? defaultVendorId : undefined,
      routingTemplateDefinitionId: (routingTemplateDefinitionId !== null && routingTemplateDefinitionId > 0) ? routingTemplateDefinitionId : undefined,
      machineCycleTime: machineCycleTime ?? undefined,
      numberOfSetups: numberOfSetups ?? undefined,
      partCost: partCost ?? undefined,
    };

    if (isDryRun) {
      partIdByNumber.set(partNumber, nextDryId());
      counts.parts.created++;
      continue;
    }

    try {
      const created = await createPart(createInput, userId);
      partIdByNumber.set(partNumber, created.partId);
      counts.parts.created++;
      if (stockCount !== 0) await updateStockCount(created.partId, { stockCount }, userId);
      if (inventoryLocation) await updateInventoryLocation(created.partId, { inventoryLocation }, userId);
      if (partCostUpdatedAt) {
        await prisma.part.update({ where: { partId: created.partId }, data: { partCostUpdatedAt } });
      }
    } catch (err) {
      if (err instanceof PartNumberCollisionError) {
        const ex = await prisma.part.findFirst({ where: { partNumber } });
        if (ex) partIdByNumber.set(partNumber, ex.partId);
        counts.parts.alreadyExisted++;
      } else {
        errors.push({ source: "Part Master", identifier: partNumber, errorClass: (err as Error).constructor.name, message: String(err) });
      }
    }
  }

  console.log(`  Created: ${counts.parts.created}, Already existed: ${counts.parts.alreadyExisted}`);

  // ═══ PHASE E: Assemblies (type "Assembly") ════════════════════════════════════

  console.log("=== Phase E: Assemblies ===");

  const existingAsms = await prisma.part.findMany({ where: { partType: "Assembly" }, select: { partId: true, partNumber: true } });
  for (const a of existingAsms) partIdByNumber.set(a.partNumber, a.partId);

  // Assembly Master: 0=Assembly ID, 1=Name, 2=Machine, 3=Tumble, 4=Weld, 5=Blacken, 6=Paint
  for (let i = 1; i < assemblyMasterRows.length; i++) {
    const r = assemblyMasterRows[i];
    const assemblyId = cell(r, 0);
    sc.assemblyMaster.total++;
    if (!assemblyId) { skip(sc.assemblyMaster, "blank Assembly ID"); continue; }
    if (!assembliesWithBomRows.has(assemblyId)) {
      skip(sc.assemblyMaster, "childless assembly (no BOM rows)"); continue;
    }
    sc.assemblyMaster.imported++;

    const assemblyName = cell(r, 1) || assemblyId;
    const machineCsv = cell(r, 2);
    const weldCsv = cell(r, 4);
    const blackenCsv = cell(r, 5);
    const paintCsv = cell(r, 6);

    const stepSeq = synthAssemblyStepSequence(machineCsv, weldCsv, blackenCsv, paintCsv);
    const rawRoutingId = resolveTemplateId(stepSeq, `Assembly ${assemblyId}`);
    let routingTemplateDefinitionId: number | null = rawRoutingId;
    if (rawRoutingId !== null) {
      const tname = routingBySeq.get(stepSeq)?.effectiveName;
      if (tname) trackTemplateAssign(tname, "assembly");
    }

    if (partIdByNumber.has(assemblyId)) { counts.assemblies.alreadyExisted++; continue; }

    const createInput = {
      partNumber: assemblyId, partName: assemblyName, partType: "Assembly" as const,
      routingTemplateDefinitionId: (routingTemplateDefinitionId !== null && routingTemplateDefinitionId > 0) ? routingTemplateDefinitionId : undefined,
    };

    if (isDryRun) {
      partIdByNumber.set(assemblyId, nextDryId());
      counts.assemblies.created++;
      continue;
    }

    try {
      const created = await createPart(createInput, userId);
      partIdByNumber.set(assemblyId, created.partId);
      counts.assemblies.created++;
    } catch (err) {
      if (err instanceof PartNumberCollisionError) {
        const ex = await prisma.part.findFirst({ where: { partNumber: assemblyId } });
        if (ex) partIdByNumber.set(assemblyId, ex.partId);
        counts.assemblies.alreadyExisted++;
      } else {
        errors.push({ source: "Assembly Master", identifier: assemblyId, errorClass: (err as Error).constructor.name, message: String(err) });
      }
    }
  }

  console.log(`  Created: ${counts.assemblies.created}, Already existed: ${counts.assemblies.alreadyExisted}`);

  // ═══ PHASE F: BOM Edges ═══════════════════════════════════════════════════════

  console.log("=== Phase F: BOM Edges ===");

  const existingBom = await prisma.bOM.findMany({ select: { parentPartId: true, childPartId: true } });
  const existingBomSet = new Set(existingBom.map(e => `${e.parentPartId}||${e.childPartId}`));

  for (let i = 1; i < assemblyDesignerRows.length; i++) {
    const r = assemblyDesignerRows[i];
    const asmId = cell(r, 0);
    const partId = cell(r, 2);
    const typeField = cell(r, 4);
    const quantityRaw = cell(r, 5);
    sc.assemblyDesigner.total++;

    const isStub =
      !asmId || !partId ||
      typeField === "DO NOT EDIT TOP ROW" ||
      asmId === "DO NOT EDIT TOP ROW" ||
      !typeField ||
      typeField.toLowerCase() === "nan" ||
      typeField === "#N/A";
    if (isStub) {
      skip(sc.assemblyDesigner, !asmId || !partId ? "blank ID" : "stub row (header artifact)");
      continue;
    }
    sc.assemblyDesigner.imported++;

    const parentPartId = partIdByNumber.get(asmId);
    const childPartId = partIdByNumber.get(partId);
    const quantity = parseDecimal(quantityRaw) ?? 1;
    const identifier = `${asmId} → ${partId}`;

    if (!parentPartId || !childPartId) {
      errors.push({ source: "Assembly Designer", identifier, errorClass: "PartNotFound", message: `"${asmId}" or "${partId}" not in imported Parts` });
      continue;
    }

    const bomKey = `${parentPartId}||${childPartId}`;
    if (existingBomSet.has(bomKey)) { counts.bomEdges.alreadyExisted++; continue; }

    if (isDryRun) {
      existingBomSet.add(bomKey); // deduplicate within this run
      counts.bomEdges.created++;
      continue;
    }

    try {
      await createBomEdge({ parentPartId, childPartId, quantity }, userId);
      existingBomSet.add(bomKey);
      counts.bomEdges.created++;
    } catch (err) {
      if (err instanceof BomDuplicateChildError) {
        existingBomSet.add(bomKey);
        counts.bomEdges.alreadyExisted++;
      } else if (err instanceof BomCycleError) {
        errors.push({ source: "Assembly Designer", identifier, errorClass: "BomCycleError", message: err.message });
      } else if (err instanceof BomDepthExceededError) {
        errors.push({ source: "Assembly Designer", identifier, errorClass: "BomDepthExceededError", message: err.message });
      } else {
        errors.push({ source: "Assembly Designer", identifier, errorClass: (err as Error).constructor.name, message: String(err) });
      }
    }
  }

  console.log(`  Created: ${counts.bomEdges.created}, Already existed: ${counts.bomEdges.alreadyExisted}`);

  // ═══ Report ═══════════════════════════════════════════════════════════════════

  const completedAt = new Date();
  const durationSeconds = ((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1);

  const report = buildReport({
    mode: isDryRun ? "dry-run" : "committed",
    startedAt, completedAt, durationSeconds,
    sc, counts, templateAssignments, threeDConflicts,
    unmappedMaterials, unmappedVendors, errors,
  });

  console.log("\n" + "=".repeat(72));
  console.log(report);
  console.log("=".repeat(72));

  const timestamp = startedAt.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const reportPath = path.join(DATA_IMPORT, `import-report-${timestamp}.txt`);
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`\nReport written to: ${reportPath}`);

  await prisma.$disconnect();
}

// ─── Report builder ───────────────────────────────────────────────────────────

function buildReport(opts: {
  mode: string;
  startedAt: Date;
  completedAt: Date;
  durationSeconds: string;
  sc: Record<string, SourceCount>;
  counts: Record<string, Counts>;
  templateAssignments: Map<string, { partCount: number; assemblyCount: number }>;
  threeDConflicts: { partNumber: string; partName: string; flags: string[] }[];
  unmappedMaterials: Map<string, Set<string>>;
  unmappedVendors: Map<string, Set<string>>;
  errors: ValidationError[];
}): string {
  const L: string[] = [];
  const line = (s: string) => L.push(s);

  line("PHASE 1E IMPORT REPORT");
  line(`Mode: ${opts.mode}`);
  line(`Started: ${opts.startedAt.toISOString()}`);
  line(`Completed: ${opts.completedAt.toISOString()}`);
  line(`Duration: ${opts.durationSeconds}s`);
  line("");
  line("SOURCE PROCESSING");

  function renderSC(label: string, key: string) {
    const s = opts.sc[key];
    line(`  ${label.padEnd(20)} ${s.total} rows, ${s.imported} imported, ${s.skipped} skipped`);
    for (const [reason, cnt] of Object.entries(s.skipReasons)) {
      line(`    Skipped: ${cnt} ${reason}`);
    }
  }
  renderSC("Part Master:", "partMaster");
  renderSC("Assembly Master:", "assemblyMaster");
  renderSC("Assembly Designer:", "assemblyDesigner");
  renderSC("Vendor Master:", "vendorMaster");

  line("");
  line("ENTITY OUTCOMES");
  for (const [key, c] of Object.entries(opts.counts)) {
    line(`  ${key.padEnd(18)} ${c.created} created, ${c.alreadyExisted} already existed`);
  }

  line("");
  line("ROUTING TEMPLATE ASSIGNMENT");
  const sortedTemplates = [...opts.templateAssignments.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (sortedTemplates.length === 0) { line("  (none)"); }
  for (const [name, ta] of sortedTemplates) {
    line(`  ${name}: ${ta.partCount} Parts, ${ta.assemblyCount} Assemblies`);
  }

  line("");
  line("3D PRINT CONFLICT FLAGS");
  if (opts.threeDConflicts.length === 0) {
    line("  (none)");
  } else {
    line("The following Parts have Category=3D AND additional process flags set.");
    line("Imported with 3D Print routing only; additional flags ignored. Review for misclassification:");
    for (const c of opts.threeDConflicts) {
      line(`  ${c.partNumber} (${c.partName}): flags: ${c.flags.join(", ")}`);
    }
  }

  line("");
  line("UNMAPPED MATERIAL VALUES");
  if (opts.unmappedMaterials.size === 0) {
    line("  (none)");
  } else {
    line("Affected Parts imported with materialSpecId=null:");
    for (const [csvVal, partNums] of opts.unmappedMaterials.entries()) {
      const sample = [...partNums].slice(0, 8).join(", ");
      const more = partNums.size > 8 ? ` +${partNums.size - 8} more` : "";
      line(`  "${csvVal}": ${partNums.size} Parts — ${sample}${more}`);
    }
  }

  line("");
  line("UNMAPPED VENDOR VALUES");
  if (opts.unmappedVendors.size === 0) {
    line("  (none)");
  } else {
    line("Affected Parts imported with defaultVendorId=null:");
    for (const [csvStr, partNums] of opts.unmappedVendors.entries()) {
      const sample = [...partNums].slice(0, 8).join(", ");
      const more = partNums.size > 8 ? ` +${partNums.size - 8} more` : "";
      line(`  "${csvStr}": ${partNums.size} Parts — ${sample}${more}`);
    }
  }

  line("");
  line("VALIDATION ERRORS");
  if (opts.errors.length === 0) {
    line("  (none)");
  } else {
    for (const e of opts.errors) {
      line(`  ${e.source} row ${e.identifier}: ${e.errorClass}: ${e.message}`);
    }
  }

  line("");
  line("SUMMARY");
  const totalNullMat = [...opts.unmappedMaterials.values()].reduce((a, s) => a + s.size, 0);
  const totalNullVend = [...opts.unmappedVendors.values()].reduce((a, s) => a + s.size, 0);
  line(`  Total errors:               ${opts.errors.length}`);
  line(`  Total unmapped:             ${opts.unmappedMaterials.size} Material values, ${opts.unmappedVendors.size} Vendor strings`);
  line(`  Total 3D conflicts:         ${opts.threeDConflicts.length}`);
  line(`  Total Parts with materialSpecId=null:  ${totalNullMat}`);
  line(`  Total Parts with defaultVendorId=null: ${totalNullVend}`);

  return L.join("\n");
}

main().catch(err => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
