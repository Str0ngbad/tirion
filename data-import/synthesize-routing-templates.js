#!/usr/bin/env node
// Routing Template Synthesis Preview Generator — Phase 1E
// Reads Part Master and Assembly Master CSVs, applies the synthesis algorithm
// from spec/data_import_mapping.md Section 6, and writes:
//   data-import/routing_template_synthesis_preview.csv
//   data-import/routing_synthesis_summary.txt
//
// Re-runnable: overwrites output files each run. If manual edits to the
// preview CSV need to survive a re-run, back up the file first.

const fs = require("fs");
const path = require("path");

// ─── RFC 4180 CSV parser ─────────────────────────────────────────────────────

function parseCSV(text) {
  const records = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    // Skip lone \r (shouldn't appear but be safe)
    const fields = [];
    while (i < len) {
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = "";
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i++];
          }
        }
        fields.push(field);
      } else {
        // Unquoted field
        let field = "";
        while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
          field += text[i++];
        }
        fields.push(field);
      }

      if (i < len && text[i] === ",") {
        i++; // consume comma, continue to next field
      } else {
        break; // end of record
      }
    }
    // consume record separator
    if (i < len && text[i] === "\r") i++;
    if (i < len && text[i] === "\n") i++;

    if (fields.length > 0) {
      records.push(fields);
    }
  }
  return records;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeFlag(val) {
  if (!val) return "N";
  const v = val.trim().toUpperCase();
  if (v === "Y") return "Y";
  if (v === "N") return "N";
  if (v === "") return "N";
  return null; // unexpected value
}

// Wrap a CSV field per RFC 4180 (quote if it contains comma, quote, or newline)
function csvField(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(fields) {
  return fields.map(csvField).join(",");
}

// ─── Paths ───────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const PART_MASTER = path.join(ROOT, "Master Production Tool (Split on 09-16-25) - Part Master.csv");
const ASSEMBLY_MASTER = path.join(ROOT, "Master Production Tool (Split on 09-16-25) - Assembly Master.csv");
const ASSEMBLY_DESIGNER = path.join(ROOT, "Master Production Tool (Split on 09-16-25) - Assembly Designer.csv");

const OUT_CSV = path.join(__dirname, "routing_template_synthesis_preview.csv");
const OUT_TXT = path.join(__dirname, "routing_synthesis_summary.txt");

// ─── Parse CSVs ──────────────────────────────────────────────────────────────

console.log("Parsing CSVs...");

const partMasterRecords = parseCSV(fs.readFileSync(PART_MASTER, "utf-8"));
const assemblyMasterRecords = parseCSV(fs.readFileSync(ASSEMBLY_MASTER, "utf-8"));
const assemblyDesignerRecords = parseCSV(fs.readFileSync(ASSEMBLY_DESIGNER, "utf-8"));

// Part Master: first record is the multi-line header, data starts at index 1
// Column indices (0-based):
//   0  Internal Part Number
//   1  Part Name
//   2  Part Model Location
//   3  Part Drawing Location
//   4  Location
//   5  Vendor Part ID
//   6  Stock Size
//   7  Length
//   8  Material
//   9  Category
//  10  Vendor
//  11  Alt. Vendor Part ID
//  12  Alt. Vendor
//  13  Machine
//  14  (Unnamed: 14)
//  15  Weld
//  16  Blacken
//  17  Paint
//  18  Material Cost
//  ...

const PM_COL = {
  partNumber: 0,
  partName: 1,
  category: 9,
  machine: 13,
  weld: 15,
  blacken: 16,
  paint: 17,
};

// Assembly Master: first record is single-line header, data starts at index 1
// Column indices:
//   0  Assembly ID
//   1  Assembly Name
//   2  Machine
//   3  Tumble
//   4  Weld
//   5  Blacken
//   6  Paint
//  13  Referenced in Assembly Designer

const AM_COL = {
  assemblyId: 0,
  assemblyName: 1,
  machine: 2,
  tumble: 3,
  weld: 4,
  blacken: 5,
  paint: 6,
  referencedCount: 13,
};

// ─── Find childless assemblies ────────────────────────────────────────────────
// An assembly is "childless" (skipped) if it has zero rows as a parent in
// Assembly Designer. We determine this by collecting all parent assembly IDs
// that appear in Assembly Designer (skipping stub rows).

const assembliesWithChildren = new Set();
// Assembly Designer: header is row 0, data from row 1
for (let i = 1; i < assemblyDesignerRecords.length; i++) {
  const row = assemblyDesignerRecords[i];
  const assemblyId = (row[0] || "").trim();
  const type = (row[4] || "").trim();
  // Skip stubs: "DO NOT EDIT TOP ROW" type or NaN type
  if (!assemblyId || type === "DO NOT EDIT TOP ROW" || assemblyId === "DO NOT EDIT TOP ROW") continue;
  if (assemblyId) assembliesWithChildren.add(assemblyId);
}

// ─── Process Part Master ──────────────────────────────────────────────────────

const warnings = [];
let partRowsSkipped = 0;
let partRowsProcessed = 0;

// Part templates: map from shape key -> { name, parts: [{partNumber, partName}] }
const partTemplates = new Map();

// Track 3D print conflict parts
const threeDConflicts = [];

// part records start at index 1 (index 0 is header)
for (let i = 1; i < partMasterRecords.length; i++) {
  const row = partMasterRecords[i];
  const partNumber = (row[PM_COL.partNumber] || "").trim();

  if (!partNumber) {
    partRowsSkipped++;
    continue;
  }

  partRowsProcessed++;
  const partName = (row[PM_COL.partName] || "").trim();
  const categoryRaw = (row[PM_COL.category] || "").trim();
  const is3D = categoryRaw.toUpperCase() === "3D";

  // Normalize flags — warn if unexpected value
  function getFlag(colIdx, label) {
    const raw = (row[colIdx] || "").trim();
    const n = normalizeFlag(raw);
    if (n === null) {
      warnings.push(`Part ${partNumber}: unexpected ${label} flag value "${raw}" — treated as N`);
      return "N";
    }
    return n;
  }

  const machine = getFlag(PM_COL.machine, "Machine");
  const weld = getFlag(PM_COL.weld, "Weld");
  const blacken = getFlag(PM_COL.blacken, "Blacken");
  const paint = getFlag(PM_COL.paint, "Paint");

  let shapeKey;
  let templateName;
  let stepSequence;

  if (is3D) {
    // Check for conflict
    const conflictFlags = [];
    if (machine === "Y") conflictFlags.push("Machine=Y");
    if (weld === "Y") conflictFlags.push("Weld=Y");
    if (blacken === "Y") conflictFlags.push("Blacken=Y");
    if (paint === "Y") conflictFlags.push("Paint=Y");
    if (conflictFlags.length > 0) {
      threeDConflicts.push({ partNumber, partName, flags: conflictFlags });
    }
    shapeKey = "3DPRINT";
    templateName = "3D Print";
    stepSequence = "Purchase + Receive + 3D Print + Distribution";
  } else {
    const midSteps = [];
    if (machine === "Y") midSteps.push("Machine");
    if (weld === "Y") midSteps.push("Weld");
    if (blacken === "Y") midSteps.push("Blacken");
    if (paint === "Y") midSteps.push("Paint");

    shapeKey = "PART:" + (midSteps.join("+") || "NONE");
    templateName = midSteps.length === 0 ? "Purchase Only" : midSteps.join(" + ");
    const allSteps = ["Purchase", "Receive", ...midSteps, "Distribution"];
    stepSequence = allSteps.join(" + ");
  }

  if (!partTemplates.has(shapeKey)) {
    partTemplates.set(shapeKey, { templateName, stepSequence, parts: [], assemblies: [] });
  }
  partTemplates.get(shapeKey).parts.push({ partNumber, partName });
}

// ─── Process Assembly Master ──────────────────────────────────────────────────

let assemblyRowsSkipped = 0;
let assemblyRowsProcessed = 0;

const assemblyTemplates = new Map();

for (let i = 1; i < assemblyMasterRecords.length; i++) {
  const row = assemblyMasterRecords[i];
  const assemblyId = (row[AM_COL.assemblyId] || "").trim();

  if (!assemblyId) {
    assemblyRowsSkipped++;
    continue;
  }

  // Skip childless assemblies
  if (!assembliesWithChildren.has(assemblyId)) {
    assemblyRowsSkipped++;
    continue;
  }

  assemblyRowsProcessed++;
  const assemblyName = (row[AM_COL.assemblyName] || "").trim();

  function getAsmFlag(colIdx, label) {
    const raw = (row[colIdx] || "").trim();
    const n = normalizeFlag(raw);
    if (n === null) {
      warnings.push(`Assembly ${assemblyId}: unexpected ${label} flag value "${raw}" — treated as N`);
      return "N";
    }
    return n;
  }

  const machine = getAsmFlag(AM_COL.machine, "Machine");
  const weld = getAsmFlag(AM_COL.weld, "Weld");
  const blacken = getAsmFlag(AM_COL.blacken, "Blacken");
  const paint = getAsmFlag(AM_COL.paint, "Paint");

  // Weld-replaces-Assemble rule
  let firstStep;
  if (weld === "Y") {
    firstStep = "Weld";
  } else {
    firstStep = "Assemble";
  }

  // Middle steps: Machine, then Blacken, then Paint (Weld already handled; Tumble dropped)
  const midSteps = [];
  if (machine === "Y") midSteps.push("Machine");
  if (blacken === "Y") midSteps.push("Blacken");
  if (paint === "Y") midSteps.push("Paint");

  const shapeKey = "ASM:" + firstStep + "+" + (midSteps.join("+") || "NONE");

  // Template name: firstStep (if Weld or Assemble) plus any mid steps
  // "Assemble" alone = "Assemble", "Weld" alone = "Weld"
  const nameParts = [firstStep, ...midSteps];
  const templateName = nameParts.join(" + ");

  const allSteps = [firstStep, ...midSteps, "Distribution"];
  const stepSequence = allSteps.join(" + ");

  if (!assemblyTemplates.has(shapeKey)) {
    assemblyTemplates.set(shapeKey, { templateName, stepSequence, parts: [], assemblies: [] });
  }
  assemblyTemplates.get(shapeKey).assemblies.push({ assemblyId, assemblyName });
}

// ─── Merge templates into a single map ───────────────────────────────────────
// Parts and Assemblies must NOT share templates (different implicit steps).
// Verify this: all part templates have parts only, assembly templates have assemblies only.

const allTemplates = new Map();

for (const [key, tmpl] of partTemplates) {
  allTemplates.set(key, tmpl);
}
for (const [key, tmpl] of assemblyTemplates) {
  allTemplates.set(key, tmpl);
}

// ─── Detect naming collisions ─────────────────────────────────────────────────
// A collision occurs when a Part template and an Assembly template share the
// same synthesized name but have different step sequences. At import, templates
// are created by name; collisions would merge distinct templates incorrectly.
// Flag both members of each colliding pair for user rename.

const nameToKeys = new Map(); // templateName -> [keys]
for (const [key, tmpl] of allTemplates) {
  if (!nameToKeys.has(tmpl.templateName)) nameToKeys.set(tmpl.templateName, []);
  nameToKeys.get(tmpl.templateName).push(key);
}
const collidingNames = new Set();
for (const [name, keys] of nameToKeys) {
  if (keys.length > 1) collidingNames.add(name);
}

// ─── Apply heuristics ─────────────────────────────────────────────────────────

// Heuristic: single-Part templates
const singlePartTemplates = [];
for (const [key, tmpl] of allTemplates) {
  const total = tmpl.parts.length + tmpl.assemblies.length;
  if (total === 1) {
    singlePartTemplates.push({ key, tmpl });
  }
}

// Heuristic: welded assemblies (all of them, since user noted exceptions exist)
const weldedAssemblies = [];
for (const [key, tmpl] of assemblyTemplates) {
  if (key.startsWith("ASM:Weld+")) {
    weldedAssemblies.push(...tmpl.assemblies);
  }
}
const weldedAssemblyCount = weldedAssemblies.length;

// Heuristic: plain assemblies (just Assemble + Distribution)
const plainAssemblyCount = assemblyTemplates.has("ASM:Assemble+NONE")
  ? assemblyTemplates.get("ASM:Assemble+NONE").assemblies.length
  : 0;

// ─── Build CSV rows ───────────────────────────────────────────────────────────

// Sort: by (part_count + assembly_count) descending, then template_name ascending
const rows = [];
for (const [key, tmpl] of allTemplates) {
  const partCount = tmpl.parts.length;
  const assemblyCount = tmpl.assemblies.length;
  const total = partCount + assemblyCount;

  // Determine heuristic_flags and user_action
  let flags = "";
  let action = "keep";

  // 3D Print conflict
  if (key === "3DPRINT" && threeDConflicts.length > 0) {
    flags = `${threeDConflicts.length} of ${partCount} Parts have additional flags set (3D Print conflict)`;
    action = "review";
  }

  // Single-Part template
  if (total === 1) {
    if (partCount === 1) {
      const p = tmpl.parts[0];
      flags = `single-Part candidate: ${p.partNumber}`;
    } else {
      const a = tmpl.assemblies[0];
      flags = `single-Assembly candidate: ${a.assemblyId}`;
    }
    action = "review";
  }

  // Welded assemblies
  if (key.startsWith("ASM:Weld+")) {
    flags += (flags ? "; " : "") + `${assemblyCount} Assemblies use Weld; user noted exceptions may exist`;
    if (action !== "review") action = "review";
  }

  // Naming collision: same template name used by both a Part and an Assembly template
  if (collidingNames.has(tmpl.templateName)) {
    const kind = partCount > 0 ? "Parts" : "Assemblies";
    flags += (flags ? "; " : "") + `NAME COLLISION: another template shares this name — rename one (e.g. "${tmpl.templateName} (${kind})")`;
    action = "review";
  }

  rows.push({
    key,
    templateName: tmpl.templateName,
    stepSequence: tmpl.stepSequence,
    partCount,
    assemblyCount,
    total,
    action,
    flags,
    tmpl,
  });
}

rows.sort((a, b) => {
  if (b.total !== a.total) return b.total - a.total;
  return a.templateName.localeCompare(b.templateName);
});

// ─── Write preview CSV ────────────────────────────────────────────────────────

const csvLines = [
  csvRow(["template_name", "step_sequence", "part_count", "assembly_count", "user_rename", "user_action", "heuristic_flags"]),
];

for (const row of rows) {
  csvLines.push(csvRow([
    row.templateName,
    row.stepSequence,
    String(row.partCount),
    String(row.assemblyCount),
    "",
    row.action,
    row.flags,
  ]));
}

fs.writeFileSync(OUT_CSV, csvLines.join("\r\n") + "\r\n", "utf-8");
console.log(`Wrote ${OUT_CSV}`);

// ─── Write summary report ─────────────────────────────────────────────────────

const now = new Date().toISOString();
const totalTemplates = allTemplates.size;
const partOnlyTemplates = [...allTemplates.values()].filter(t => t.parts.length > 0 && t.assemblies.length === 0).length;
const asmOnlyTemplates = [...allTemplates.values()].filter(t => t.assemblies.length > 0 && t.parts.length === 0).length;
const mixedTemplates = [...allTemplates.values()].filter(t => t.parts.length > 0 && t.assemblies.length > 0).length;
const totalPartsAssigned = rows.reduce((s, r) => s + r.partCount, 0);
const totalAsmAssigned = rows.reduce((s, r) => s + r.assemblyCount, 0);
const partTemplateCount = rows.filter(r => r.partCount > 0).length;
const asmTemplateCount = rows.filter(r => r.assemblyCount > 0).length;

let summaryLines = [];
summaryLines.push("PHASE 1E ROUTING TEMPLATE SYNTHESIS SUMMARY");
summaryLines.push(`Generated: ${now}`);
summaryLines.push("");
summaryLines.push("OVERALL");
summaryLines.push(`- Source rows processed: ${partRowsProcessed} Parts, ${assemblyRowsProcessed} Assemblies`);
summaryLines.push(`- Source rows skipped: ${partRowsSkipped} Parts (blank rows), ${assemblyRowsSkipped} Assemblies (childless)`);
summaryLines.push(`- Synthesized templates: ${totalTemplates}`);
summaryLines.push(`  - Containing Parts only: ${partOnlyTemplates}`);
summaryLines.push(`  - Containing Assemblies only: ${asmOnlyTemplates}`);
if (mixedTemplates > 0) {
  summaryLines.push(`  - Containing both: ${mixedTemplates}  *** ERROR: mixed templates detected — synthesis bug ***`);
} else {
  summaryLines.push(`  - Containing both: 0  (correct — no mixed templates)`);
}
summaryLines.push(`- Total Parts assigned: ${totalPartsAssigned} across ${partTemplateCount} templates`);
summaryLines.push(`- Total Assemblies assigned: ${totalAsmAssigned} across ${asmTemplateCount} templates`);
summaryLines.push("");
summaryLines.push("HEURISTIC FINDINGS");
summaryLines.push("");

// 3D Print conflicts
summaryLines.push("3D Print Conflict");
if (threeDConflicts.length === 0) {
  summaryLines.push("No Parts with Category=3D have additional process flags set.");
} else {
  summaryLines.push(
    "The following Parts have Category=3D but also have additional process\n" +
    "flags set. Synthesis ignores the additional flags and routes them as\n" +
    "3D Print only. Review whether these are misclassifications:\n"
  );
  for (const c of threeDConflicts) {
    summaryLines.push(`  ${c.partNumber} (${c.partName}): flags set: ${c.flags.join(", ")}`);
  }
}
summaryLines.push("");

// Single-Part templates
summaryLines.push("Single-Part Templates");
if (singlePartTemplates.length === 0) {
  summaryLines.push("No single-Part or single-Assembly templates found.");
} else {
  summaryLines.push(
    "The following synthesized templates have only 1 Part or 1 Assembly\n" +
    "assigned. Candidates for review — possibly misclassified rows or\n" +
    "genuinely unique routings:\n"
  );
  for (const { key, tmpl } of singlePartTemplates) {
    summaryLines.push(`  Template: ${tmpl.templateName}`);
    if (tmpl.parts.length === 1) {
      const p = tmpl.parts[0];
      summaryLines.push(`    Part: ${p.partNumber} (${p.partName})`);
    } else if (tmpl.assemblies.length === 1) {
      const a = tmpl.assemblies[0];
      summaryLines.push(`    Assembly: ${a.assemblyId} (${a.assemblyName})`);
    }
  }
}
summaryLines.push("");

// Welded assemblies
summaryLines.push("Welded Assemblies");
summaryLines.push(
  `${weldedAssemblyCount} Assemblies use Weld and have it as the first step (replacing\n` +
  "Assemble per the synthesis rule). User noted that exceptions may\n" +
  "exist — Assemblies that should have both Weld and Assemble steps.\n" +
  "These are not enumerated here due to volume; the user reviews from\n" +
  "operational memory post-import."
);
summaryLines.push("");

// Naming collisions
summaryLines.push("Naming Collisions (ACTION REQUIRED)");
if (collidingNames.size === 0) {
  summaryLines.push("No naming collisions detected.");
} else {
  summaryLines.push(
    "The following template names are shared by both a Part template and an\n" +
    "Assembly template. At import, templates are looked up by name — these pairs\n" +
    "would incorrectly merge into a single template. Use user_rename in the CSV\n" +
    "to give each a distinct name before the import script runs.\n"
  );
  for (const name of collidingNames) {
    summaryLines.push(`  Name: "${name}"`);
    const keys = nameToKeys.get(name);
    for (const key of keys) {
      const tmpl = allTemplates.get(key);
      const kind = tmpl.parts.length > 0 ? "Parts" : "Assemblies";
      summaryLines.push(`    ${kind}: ${tmpl.stepSequence}`);
      summaryLines.push(`    Suggested rename: "${name} (${kind})"`);
    }
  }
}
summaryLines.push("");

// Plain assemblies
summaryLines.push("Plain Assemblies");
summaryLines.push(
  `${plainAssemblyCount} Assemblies use just Assemble + Distribution (no middle\n` +
  "steps). For context."
);
summaryLines.push("");

if (warnings.length > 0) {
  summaryLines.push("WARNINGS — UNEXPECTED FLAG VALUES");
  for (const w of warnings) summaryLines.push(`  ${w}`);
  summaryLines.push("");
}

// Template inventory
summaryLines.push("TEMPLATE INVENTORY");
for (const row of rows) {
  summaryLines.push(`${row.templateName}: ${row.partCount} Parts, ${row.assemblyCount} Assemblies`);
}
summaryLines.push("");

fs.writeFileSync(OUT_TXT, summaryLines.join("\n"), "utf-8");
console.log(`Wrote ${OUT_TXT}`);

// ─── Console report ───────────────────────────────────────────────────────────

console.log("\n=== SYNTHESIS COMPLETE ===");
console.log(`Unique templates synthesized: ${totalTemplates}`);
console.log(`  Parts-only templates: ${partOnlyTemplates}`);
console.log(`  Assembly-only templates: ${asmOnlyTemplates}`);
console.log(`  Mixed (error if > 0): ${mixedTemplates}`);
console.log(`Total Parts assigned: ${totalPartsAssigned} (processed: ${partRowsProcessed})`);
console.log(`Total Assemblies assigned: ${totalAsmAssigned} (processed: ${assemblyRowsProcessed})`);

// Distribution of template sizes
const sizeBuckets = { "1": 0, "2-5": 0, "6-20": 0, "21-100": 0, "101+": 0 };
for (const row of rows) {
  const t = row.total;
  if (t === 1) sizeBuckets["1"]++;
  else if (t <= 5) sizeBuckets["2-5"]++;
  else if (t <= 20) sizeBuckets["6-20"]++;
  else if (t <= 100) sizeBuckets["21-100"]++;
  else sizeBuckets["101+"]++;
}
console.log("\nTemplate size distribution:");
for (const [bucket, count] of Object.entries(sizeBuckets)) {
  console.log(`  ${bucket} assigned: ${count} templates`);
}

console.log(`\n3D Print conflicts: ${threeDConflicts.length}`);
console.log(`Single-Part/Assembly templates: ${singlePartTemplates.length}`);
if (warnings.length > 0) console.log(`Flag value warnings: ${warnings.length}`);

console.log("\nFirst 10 rows of preview CSV:");
csvLines.slice(0, 11).forEach(l => console.log("  " + l));
