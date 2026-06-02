/**
 * Generates parts-data.json from the three source CSVs.
 * Run from the project root: node app/mockups/parts/_data/generate.js
 */

"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../../..");

// ─── CSV parser ──────────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function parseField() {
    if (i >= len) return "";
    if (text[i] === '"') {
      i++;
      let field = "";
      while (i < len) {
        if (text[i] === '"' && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (text[i] === '"') {
          i++;
          break;
        } else {
          field += text[i++];
        }
      }
      return field;
    } else {
      let field = "";
      while (i < len && text[i] !== "," && text[i] !== "\r" && text[i] !== "\n") {
        field += text[i++];
      }
      return field;
    }
  }

  function parseRow() {
    const row = [];
    while (i < len) {
      row.push(parseField());
      if (i < len && text[i] === ",") i++;
      else break;
    }
    if (i < len && text[i] === "\r") i++;
    if (i < len && text[i] === "\n") i++;
    return row;
  }

  while (i < len) {
    const row = parseRow();
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
  }
  return rows;
}

function toObjects(rows) {
  const headers = rows[0].map((h) => h.trim().replace(/^\n+/, "").trim());
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] || "").trim();
    });
    return obj;
  });
}

// ─── Load CSVs ───────────────────────────────────────────────────────────────

const pmRaw = parseCSV(fs.readFileSync(path.join(ROOT, "Master Production Tool (Split on 09-16-25) - Part Master.csv"), "utf8"));
const amRaw = parseCSV(fs.readFileSync(path.join(ROOT, "Master Production Tool (Split on 09-16-25) - Assembly Master.csv"), "utf8"));
const adRaw = parseCSV(fs.readFileSync(path.join(ROOT, "Master Production Tool (Split on 09-16-25) - Assembly Designer.csv"), "utf8"));

const pmRows = toObjects(pmRaw);
const amRows = toObjects(amRaw);
// Assembly Designer: skip header row + "DO NOT EDIT TOP ROW" row
const adRows = toObjects(adRaw).filter(
  (r) => r["Assembly ID"] && r["Assembly ID"] !== "DO NOT EDIT TOP ROW" && r["Part ID"]
);

console.log(`Loaded: ${pmRows.length} parts, ${amRows.length} assemblies, ${adRows.length} BOM edges`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function parseNum(s) {
  if (!s) return null;
  const cleaned = String(s).replace(/[$,]/g, "").trim();
  if (cleaned === "" || cleaned === "0") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseIntVal(s) {
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function isoDateDaysAgo(daysAgo, refDate = new Date("2026-06-01")) {
  const d = new Date(refDate);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function isoTimestamp(daysOffset, refDate = new Date("2024-09-16")) {
  const d = new Date(refDate);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(9 + (daysOffset % 8));
  return d.toISOString().replace(/\.\d+Z$/, ".000Z");
}

const USERS = ["Jane Chen", "Marcus Hill", "Rita Alvarez"];

// ─── Routing templates (must match _data.ts IDs) ──────────────────────────────

const ROUTING_TEMPLATES = [
  { templateId: 1, templateName: "Machined Part",       steps: ["Receive", "Machine", "Blacken"] },
  { templateId: 2, templateName: "Machined & Painted",  steps: ["Receive", "Machine", "Weld", "Paint"] },
  { templateId: 3, templateName: "Purchased Part",      steps: ["Purchase", "Receive"] },
  { templateId: 4, templateName: "Machined Weld",       steps: ["Receive", "Machine", "Weld"] },
  { templateId: 5, templateName: "3D Print Part",       steps: ["Receive", "3D Print", "Machine"] },
  { templateId: 6, templateName: "Sub-Assembly",        steps: ["Assemble"] },
  { templateId: 7, templateName: "Full Assembly",       steps: ["Assemble", "Distribution"] },
];

function T(id) {
  return ROUTING_TEMPLATES.find((t) => t.templateId === id) || null;
}

function inferTemplate(machine, weld, blacken, paint, category, isAssembly) {
  if (category === "PO") return T(3);
  if (category === "3D") return T(5);
  if (isAssembly) return null; // set later based on parenthood
  const m = machine === "Y";
  const w = weld === "Y";
  const bl = blacken === "Y";
  const pa = paint === "Y";
  if (m && pa) return T(2);
  if (m && w) return T(4);
  if (m) return T(1);
  if (w && pa) return T(2);
  if (w) return T(4);
  return null;
}

// ─── Vendors ─────────────────────────────────────────────────────────────────

const vendorMap = new Map(); // name → MockMinimalVendor
let vendorIdSeq = 1;

function getOrCreateVendor(name) {
  const n = name.trim();
  if (!n) return null;
  if (!vendorMap.has(n)) {
    vendorMap.set(n, { vendorId: vendorIdSeq++, vendorName: n });
  }
  return vendorMap.get(n);
}

// ─── Materials ───────────────────────────────────────────────────────────────

const materialMap = new Map(); // name → MockMinimalMaterialSpec
let matIdSeq = 1;

function inferForm(matName) {
  const m = matName.toLowerCase();
  if (m.includes("flat") || m.includes("sheet") || m.includes("plate")) return "Flat Bar";
  if (m.includes("tube") || m.includes("pipe")) return "Tube";
  if (m.includes("cast")) return "Cast";
  if (m.includes("bar") || m.includes("round")) return "Round Bar";
  return "Round Bar";
}

function getOrCreateMaterial(name) {
  const n = name.trim();
  if (!n) return null;
  if (!materialMap.has(n)) {
    materialMap.set(n, { materialSpecId: matIdSeq++, materialName: n, form: inferForm(n) });
  }
  return materialMap.get(n);
}

// ─── Customer name sanitization ───────────────────────────────────────────────

const customerMap = new Map(); // original customer name → letter
let customerLetterCode = 65; // 'A'

const CUSTOMER_PATTERNS = [
  /^(Hines)\s+/i,
  /^(SW)\s+/i,
  /^(Probal)\s+/i,
  /^(Pruitt)\s+/i,
  /^(Order\s+\d+)/i,
  /^(Pruitt Press Proto)/i,
];

function sanitizeAssemblyName(name) {
  for (const pat of CUSTOMER_PATTERNS) {
    const m = name.match(pat);
    if (m) {
      const key = m[1].toLowerCase();
      if (!customerMap.has(key)) {
        customerMap.set(key, String.fromCharCode(customerLetterCode++));
      }
      const letter = customerMap.get(key);
      if (/^order\s+\d+/i.test(m[1])) {
        return "Customer Order";
      }
      if (/pruitt press proto/i.test(m[1])) {
        return "Customer Prototype";
      }
      return `Customer ${letter} ${name.slice(m[0].length)}`.trim();
    }
  }
  return name;
}

// ─── Cost date generation ────────────────────────────────────────────────────

function costLastUpdated(partNumber) {
  const h = hashCode(partNumber);
  const bucket = h % 100;
  let daysAgo;
  if (bucket < 40) daysAgo = hashCode(partNumber + "a") % 90;
  else if (bucket < 75) daysAgo = 91 + (hashCode(partNumber + "b") % 90);
  else daysAgo = 181 + (hashCode(partNumber + "c") % 360);
  return isoDateDaysAgo(daysAgo);
}

// ─── WO generation ───────────────────────────────────────────────────────────

const PROJECT_COLORS = {
  "PROJ-A": "#3b82f6",
  "PROJ-B": "#10b981",
  "PROJ-C": "#f59e0b",
  "PROJ-D": "#8b5cf6",
  "PROJ-E": "#ef4444",
};
const PROJECTS = Object.keys(PROJECT_COLORS);

let woIdSeq = 1;

function stepStatus(step) {
  if (step === "Receive") return "Awaiting Material";
  if (step === "Purchase") return "Awaiting Purchase";
  if (step === "Machine" || step === "Weld" || step === "Assemble" || step === "3D Print") return "In Progress";
  return "Open";
}

function generateWos(part, parentAssemblies) {
  const h = hashCode(part.partNumber + "wos");
  const usageWeight = Math.min(parentAssemblies.length, 5);
  // effective bucket shifts toward more WOs for high-usage parts
  const effectiveBucket = Math.max(0, (h % 100) - usageWeight * 3);
  let count;
  if (effectiveBucket < 60) count = 0;
  else if (effectiveBucket < 80) count = 1 + (hashCode(part.partNumber + "wc") % 2);
  else if (effectiveBucket < 92) count = 3 + (hashCode(part.partNumber + "wc2") % 3);
  else count = 6 + (hashCode(part.partNumber + "wc3") % 3);

  const template = part.routingTemplate;
  const steps = template ? template.steps : ["Assemble"];
  const wos = [];

  for (let j = 0; j < count; j++) {
    const projKey = PROJECTS[(woIdSeq + j) % PROJECTS.length];
    const step = steps[j % steps.length];
    const topRef =
      parentAssemblies.length > 0
        ? parentAssemblies[j % parentAssemblies.length].partNumber
        : part.partNumber;
    wos.push({
      woId: woIdSeq++,
      woNumber: `WO-2025${String(woIdSeq).padStart(4, "0")}`,
      projectReference: projKey,
      projectColor: PROJECT_COLORS[projKey],
      topLevelReference: topRef,
      partNumber: part.partNumber,
      currentStep: step,
      status: stepStatus(step),
      batchContext: null,
    });
  }
  return wos;
}

// ─── Build parts ──────────────────────────────────────────────────────────────

const allParts = new Map(); // partNumber → MockPart (partial, before BOM edges)
let partIdSeq = 1;

// Part Master
for (const row of pmRows) {
  const partNumber = row["Internal Part Number"].trim();
  if (!partNumber) continue;

  const partName = row["Part Name"].trim();
  const category = row["Category"].trim();
  const vendor = getOrCreateVendor(row["Vendor"]);
  const material = getOrCreateMaterial(row["Material"]);
  const cost = parseNum(row["Material Cost"]);
  const machine = row["Machine"];
  const weld = row["Weld"];
  const blacken = row["Blacken"];
  const paint = row["Paint"];
  const template = inferTemplate(machine, weld, blacken, paint, category, false);
  const stock = parseIntVal(row["Inventory"]) ?? 0;
  const exceptionFlag = row["Exception"].trim().toUpperCase();
  const isActive = exceptionFlag !== "TRUE";
  const notes = row["Tim's notes"].trim() || row["Exception Notes"].trim() || null;

  const partId = partIdSeq++;

  allParts.set(partNumber, {
    partId,
    partNumber,
    partName,
    partType: "Part",
    procurementType: category === "PO" ? "Buy" : "Make",
    description: null,
    blankLength: parseNum(row["Length"]),
    notes,
    materialSpec: material,
    stockSize: row["Stock Size"].trim() || null,
    defaultVendor: vendor,
    routingTemplate: template,
    stockCount: stock,
    inventoryLocation: row["Location"].trim() || null,
    isActive,
    createdAt: isoTimestamp(partId % 180),
    auditLog: [],
    vendorPartNumber: row["Vendor Part ID"].trim() || null,
    modelLink: row["Part Model Location"].trim() || null,
    drawingLink: row["Part Drawing Location"].trim() || null,
    binMin: parseIntVal(row["Min. Bin Size"]),
    binMax: parseIntVal(row["Full Bin Size"]),
    cost,
    costLastUpdated: cost !== null ? costLastUpdated(partNumber) : null,
    machineCycleTime: parseNum(row["Fusion: Machine Cycle Time"]),
    numberOfSetups: parseIntVal(row["Fusion: Number of Setups"]),
    assembliesUsedInCount: 0, // filled later
    parentAssemblies: [],
    childParts: [],
    openWos: [],
  });
}

// Assembly Master
for (const row of amRows) {
  const partNumber = row["Assembly ID"].trim();
  if (!partNumber) continue;

  const rawName = row["Assembly Name"].trim();
  const partName = sanitizeAssemblyName(rawName);
  const cost = parseNum(row["Material Cost"]);
  const machine = row["Machine"];
  const weld = row["Weld"];
  const blacken = row["Blacken"];
  const paint = row["Paint"];
  const partId = partIdSeq++;

  allParts.set(partNumber, {
    partId,
    partNumber,
    partName,
    partType: "Assembly",
    procurementType: "Make",
    description: null,
    blankLength: null,
    notes: null,
    materialSpec: null,
    stockSize: null,
    defaultVendor: null,
    routingTemplate: inferTemplate(machine, weld, blacken, paint, "", true),
    stockCount: 0,
    inventoryLocation: row["Inventory Location"].trim() || null,
    isActive: true,
    createdAt: isoTimestamp(partId % 180),
    auditLog: [],
    vendorPartNumber: null,
    modelLink: row["Assembly Model Location"].trim() || null,
    drawingLink: row["Assembly Drawing Location"].trim() || null,
    binMin: null,
    binMax: null,
    cost,
    costLastUpdated: cost !== null ? costLastUpdated(partNumber) : null,
    machineCycleTime: null,
    numberOfSetups: null,
    assembliesUsedInCount: 0,
    parentAssemblies: [],
    childParts: [],
    openWos: [],
  });
}

console.log(`Created ${allParts.size} parts (before BOM edges)`);

// ─── Build BOM edges ──────────────────────────────────────────────────────────

let skippedEdges = 0;
let orphanParents = 0;
let orphanChildren = 0;

for (const row of adRows) {
  const parentNum = row["Assembly ID"].trim();
  const childNum = row["Part ID"].trim();
  if (!parentNum || !childNum) { skippedEdges++; continue; }

  const parent = allParts.get(parentNum);
  const child = allParts.get(childNum);

  if (!parent) { orphanParents++; continue; }
  if (!child) { orphanChildren++; continue; }

  const qty = parseIntVal(row["Quantity"]) ?? 1;

  // Avoid duplicate edges
  if (!parent.childParts.find((c) => c.childPartId === child.partId)) {
    parent.childParts.push({
      childPartId: child.partId,
      childPartNumber: child.partNumber,
      childPartName: child.partName,
      quantity: qty,
    });
  }
  if (!child.parentAssemblies.find((p) => p.assemblyPartId === parent.partId)) {
    child.parentAssemblies.push({
      assemblyPartId: parent.partId,
      partNumber: parent.partNumber,
      partName: parent.partName,
      quantityInParent: qty,
    });
  }
}

console.log(`BOM edges: skipped=${skippedEdges}, orphan parents=${orphanParents}, orphan children=${orphanChildren}`);

// ─── Finalize assemblies: routing template and assembliesUsedInCount ──────────

// Determine which assemblies are top-level (no parents)
for (const part of allParts.values()) {
  // Update assembliesUsedInCount
  part.assembliesUsedInCount = part.parentAssemblies.length;

  // Set assembly routing templates
  if (part.partType === "Assembly" && part.routingTemplate === null) {
    if (part.parentAssemblies.length === 0) {
      part.routingTemplate = T(7); // Full Assembly
    } else {
      part.routingTemplate = T(6); // Sub-Assembly
    }
  }
}

// ─── Cycle detection ─────────────────────────────────────────────────────────

const partIdMap = new Map(); // partId → part
for (const p of allParts.values()) partIdMap.set(p.partId, p);

function hasCycle(startId, visited = new Set(), stack = new Set()) {
  if (stack.has(startId)) return true;
  if (visited.has(startId)) return false;
  visited.add(startId);
  stack.add(startId);
  const part = partIdMap.get(startId);
  if (part) {
    for (const c of part.childParts) {
      if (hasCycle(c.childPartId, visited, stack)) return true;
    }
  }
  stack.delete(startId);
  return false;
}

let cyclesFound = 0;
for (const part of allParts.values()) {
  if (hasCycle(part.partId)) {
    console.warn(`CYCLE detected starting at ${part.partNumber} — breaking by clearing childParts`);
    part.childParts = [];
    cyclesFound++;
  }
}
if (cyclesFound === 0) console.log("No cycles detected.");

// ─── Audit logs ──────────────────────────────────────────────────────────────

for (const part of allParts.values()) {
  const user = USERS[part.partId % 3];
  const created = part.createdAt;
  const entries = [{ timestamp: created, userName: "Admin", action: "PartCreated" }];

  if (part.cost !== null) {
    // Add a cost update entry some time after creation
    const updateOffset = (hashCode(part.partNumber + "au") % 90) + 30;
    const updateDate = new Date(created);
    updateDate.setDate(updateDate.getDate() + updateOffset);
    if (updateDate < new Date("2026-06-01")) {
      entries.unshift({
        timestamp: updateDate.toISOString().replace(/\.\d+Z$/, ".000Z"),
        userName: user,
        action: "PartUpdated",
        changedFields: [
          { field: "cost", before: null, after: String(part.cost) },
        ],
      });
    }
  }

  if (!part.isActive) {
    const deactivateDate = new Date(created);
    deactivateDate.setDate(deactivateDate.getDate() + 90);
    entries.unshift({
      timestamp: deactivateDate.toISOString().replace(/\.\d+Z$/, ".000Z"),
      userName: user,
      action: "PartDeactivated",
    });
  }

  part.auditLog = entries;
}

// ─── Open WOs ────────────────────────────────────────────────────────────────

for (const part of allParts.values()) {
  part.openWos = generateWos(part, part.parentAssemblies);
}

// ─── Write output ─────────────────────────────────────────────────────────────

const partsArray = Array.from(allParts.values());
const vendors = Array.from(vendorMap.values());
const materials = Array.from(materialMap.values());

// Integrity report
let integrityErrors = 0;
for (const p of partsArray) {
  for (const pa of p.parentAssemblies) {
    const parent = partIdMap.get(pa.assemblyPartId);
    if (!parent) { console.warn(`Orphan parentAssembly ref in ${p.partNumber}: assemblyPartId=${pa.assemblyPartId}`); integrityErrors++; }
    else {
      const back = parent.childParts.find((c) => c.childPartId === p.partId);
      if (!back) { console.warn(`Missing reciprocal childParts in ${parent.partNumber} for child ${p.partNumber}`); integrityErrors++; }
    }
  }
}

console.log(`Integrity check: ${integrityErrors === 0 ? "PASSED" : integrityErrors + " errors"}`);
console.log(`Final counts: ${partsArray.length} parts, ${vendors.length} vendors, ${materials.length} materials`);
console.log(`  Parts: ${partsArray.filter(p => p.partType === "Part").length}`);
console.log(`  Assemblies: ${partsArray.filter(p => p.partType === "Assembly").length}`);

const out = { parts: partsArray, vendors, materials };
const outPath = path.join(__dirname, "parts-data.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`);
