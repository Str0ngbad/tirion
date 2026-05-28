// Mockup-only types and data for /app/mockups/material-specs/
// In-memory state only — no API calls, no database. Resets on reload.

export type MockMaterialSpec = {
  materialSpecId: number;
  materialName: string;
  form: string;
  isActive: boolean;
  usedByCount: number;
  openSupplyOrderCount: number;
  activeWoCount: number;
  awaitingReceiptWoCount: number;
  awaitingPurchaseWoCount: number;
  referencingParts: MockReferencingPart[];
  auditLog: MockAuditEntry[];
};

export type MockReferencingPart = {
  partId: number;
  partNumber: string;
  partName: string;
};

export type MockAuditEntry = {
  timestamp: string; // ISO 8601
  userName: string;
  action:
    | 'MaterialSpecCreated'
    | 'MaterialSpecUpdated'
    | 'MaterialSpecDeactivated'
    | 'MaterialSpecReactivated';
  changedFields?: { field: string; before: string | null; after: string | null }[];
};

// ---------------------------------------------------------------------------
// Part pool — reuses vendor mockup part numbers for cross-mockup consistency,
// extended with machined-component parts appropriate for MaterialSpec context.
// ---------------------------------------------------------------------------
const PARTS = {
  // From vendor pool
  brk101: { partId: 101, partNumber: 'BRK-101', partName: 'Bracket A' },
  plt330: { partId: 102, partNumber: 'PLT-330', partName: 'Mount Plate' },
  pin707: { partId: 103, partNumber: 'PIN-707', partName: 'Locator Pin' },
  spc808: { partId: 104, partNumber: 'SPC-808', partName: 'Spacer Block' },
  arm515: { partId: 105, partNumber: 'ARM-515', partName: 'Arm Link' },
  hsg410: { partId: 106, partNumber: 'HSG-410', partName: 'Housing' },
  cov612: { partId: 107, partNumber: 'COV-612', partName: 'Cover' },
  sha220: { partId: 108, partNumber: 'SHA-220', partName: 'Shaft Spacer' },
  bsh140: { partId: 109, partNumber: 'BSH-140', partName: 'Bushing' },
  std095: { partId: 110, partNumber: 'STD-095', partName: 'Standoff' },
  pin055: { partId: 115, partNumber: 'PIN-055', partName: 'Dowel Pin 5mm' },
  // Extended pool for MaterialSpec context
  mnt200: { partId: 117, partNumber: 'MNT-200', partName: 'Motor Mount' },
  gus305: { partId: 118, partNumber: 'GUS-305', partName: 'Gusset Plate' },
  sft445: { partId: 119, partNumber: 'SFT-445', partName: 'Drive Shaft' },
  fla112: { partId: 120, partNumber: 'FLA-112', partName: 'Flange Block' },
  rib022: { partId: 121, partNumber: 'RIB-022', partName: 'Rib Stiffener' },
  bar330: { partId: 122, partNumber: 'BAR-330', partName: 'Base Rail' },
  clp080: { partId: 123, partNumber: 'CLP-080', partName: 'Clamp Body' },
  jnt090: { partId: 124, partNumber: 'JNT-090', partName: 'Joint Block' },
};

const USERS = {
  jane: 'Jane Chen',
  marcus: 'Marcus Hill',
  rita: 'Rita Alvarez',
};

export const MOCK_MATERIAL_SPECS: MockMaterialSpec[] = [
  {
    materialSpecId: 1,
    materialName: '1018 Steel',
    form: 'Flat Bar',
    isActive: true,
    usedByCount: 47,
    openSupplyOrderCount: 6,
    activeWoCount: 32,
    awaitingReceiptWoCount: 12,
    awaitingPurchaseWoCount: 18,
    referencingParts: [
      PARTS.brk101,
      PARTS.plt330,
      PARTS.mnt200,
      PARTS.gus305,
      PARTS.rib022,
      PARTS.bar330,
      PARTS.clp080,
      PARTS.jnt090,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T10:05:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecCreated',
      },
    ],
  },
  {
    materialSpecId: 2,
    materialName: '1018 Steel',
    form: 'Rnd Bar',
    isActive: true,
    usedByCount: 23,
    openSupplyOrderCount: 3,
    activeWoCount: 14,
    awaitingReceiptWoCount: 5,
    awaitingPurchaseWoCount: 8,
    referencingParts: [
      PARTS.pin707,
      PARTS.spc808,
      PARTS.arm515,
      PARTS.sha220,
      PARTS.bsh140,
      PARTS.std095,
      PARTS.sft445,
      PARTS.fla112,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T10:07:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecCreated',
      },
      {
        timestamp: '2025-10-15T14:20:00Z',
        userName: USERS.marcus,
        action: 'MaterialSpecUpdated',
        changedFields: [{ field: 'form', before: 'Round Bar', after: 'Rnd Bar' }],
      },
    ],
  },
  {
    materialSpecId: 3,
    materialName: '1018 Steel',
    form: 'Sqr Bar',
    isActive: true,
    usedByCount: 8,
    openSupplyOrderCount: 1,
    activeWoCount: 4,
    awaitingReceiptWoCount: 1,
    awaitingPurchaseWoCount: 2,
    referencingParts: [
      PARTS.brk101,
      PARTS.arm515,
      PARTS.spc808,
      PARTS.sha220,
      PARTS.gus305,
      PARTS.rib022,
      PARTS.clp080,
      PARTS.jnt090,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T10:09:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecCreated',
      },
    ],
  },
  {
    materialSpecId: 4,
    materialName: '1018 Steel',
    form: 'Plate',
    isActive: true,
    usedByCount: 19,
    openSupplyOrderCount: 2,
    activeWoCount: 11,
    awaitingReceiptWoCount: 4,
    awaitingPurchaseWoCount: 6,
    referencingParts: [
      PARTS.plt330,
      PARTS.hsg410,
      PARTS.mnt200,
      PARTS.gus305,
      PARTS.bar330,
      PARTS.clp080,
      PARTS.jnt090,
      PARTS.fla112,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T10:11:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecCreated',
      },
    ],
  },
  {
    materialSpecId: 5,
    materialName: '6061 Aluminum',
    form: 'Plate',
    isActive: true,
    usedByCount: 38,
    openSupplyOrderCount: 5,
    activeWoCount: 24,
    awaitingReceiptWoCount: 9,
    awaitingPurchaseWoCount: 13,
    referencingParts: [
      PARTS.cov612,
      PARTS.hsg410,
      PARTS.mnt200,
      PARTS.gus305,
      PARTS.plt330,
      PARTS.brk101,
      PARTS.clp080,
      PARTS.fla112,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T10:15:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecCreated',
      },
    ],
  },
  {
    materialSpecId: 6,
    materialName: '6061 Aluminum',
    form: 'Flat Bar',
    isActive: true,
    usedByCount: 15,
    openSupplyOrderCount: 2,
    activeWoCount: 9,
    awaitingReceiptWoCount: 3,
    awaitingPurchaseWoCount: 5,
    referencingParts: [
      PARTS.arm515,
      PARTS.cov612,
      PARTS.sha220,
      PARTS.std095,
      PARTS.mnt200,
      PARTS.rib022,
      PARTS.jnt090,
      PARTS.clp080,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T10:18:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecCreated',
      },
    ],
  },
  {
    materialSpecId: 7,
    materialName: '6061 Aluminum',
    form: 'Rnd Bar',
    isActive: true,
    usedByCount: 11,
    openSupplyOrderCount: 2,
    activeWoCount: 7,
    awaitingReceiptWoCount: 2,
    awaitingPurchaseWoCount: 4,
    referencingParts: [
      PARTS.pin707,
      PARTS.bsh140,
      PARTS.sft445,
      PARTS.fla112,
      PARTS.spc808,
      PARTS.std095,
      PARTS.sha220,
      PARTS.arm515,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T10:20:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecCreated',
      },
      {
        timestamp: '2025-10-15T14:22:00Z',
        userName: USERS.marcus,
        action: 'MaterialSpecUpdated',
        changedFields: [{ field: 'form', before: 'Round Bar', after: 'Rnd Bar' }],
      },
    ],
  },
  {
    materialSpecId: 8,
    materialName: '4140 Steel',
    form: 'Rnd Bar',
    isActive: true,
    usedByCount: 9,
    openSupplyOrderCount: 1,
    activeWoCount: 6,
    awaitingReceiptWoCount: 2,
    awaitingPurchaseWoCount: 3,
    referencingParts: [
      PARTS.sft445,
      PARTS.pin707,
      PARTS.fla112,
      PARTS.bsh140,
      PARTS.pin055,
      PARTS.clp080,
      PARTS.arm515,
      PARTS.sha220,
    ],
    auditLog: [
      {
        timestamp: '2025-09-03T09:30:00Z',
        userName: USERS.marcus,
        action: 'MaterialSpecCreated',
      },
      {
        timestamp: '2025-10-15T14:25:00Z',
        userName: USERS.marcus,
        action: 'MaterialSpecUpdated',
        changedFields: [{ field: 'form', before: 'Round Bar', after: 'Rnd Bar' }],
      },
    ],
  },
  {
    materialSpecId: 9,
    materialName: 'HR Steel',
    form: 'Plate',
    isActive: true,
    usedByCount: 14,
    openSupplyOrderCount: 1,
    activeWoCount: 8,
    awaitingReceiptWoCount: 3,
    awaitingPurchaseWoCount: 4,
    referencingParts: [
      PARTS.gus305,
      PARTS.plt330,
      PARTS.bar330,
      PARTS.brk101,
      PARTS.mnt200,
      PARTS.rib022,
      PARTS.hsg410,
      PARTS.jnt090,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T10:25:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecCreated',
      },
    ],
  },
  {
    materialSpecId: 10,
    materialName: 'HR Steel',
    form: 'Angle',
    isActive: true,
    usedByCount: 6,
    openSupplyOrderCount: 0,
    activeWoCount: 3,
    awaitingReceiptWoCount: 0,
    awaitingPurchaseWoCount: 2,
    referencingParts: [
      PARTS.bar330,
      PARTS.gus305,
      PARTS.rib022,
      PARTS.brk101,
      PARTS.plt330,
      PARTS.mnt200,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T10:28:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecCreated',
      },
    ],
  },
  {
    materialSpecId: 11,
    materialName: 'DOM Steel',
    form: 'Rnd Tube',
    isActive: true,
    usedByCount: 12,
    openSupplyOrderCount: 2,
    activeWoCount: 7,
    awaitingReceiptWoCount: 3,
    awaitingPurchaseWoCount: 3,
    referencingParts: [
      PARTS.sft445,
      PARTS.arm515,
      PARTS.clp080,
      PARTS.hsg410,
      PARTS.jnt090,
      PARTS.sha220,
      PARTS.bsh140,
      PARTS.mnt200,
    ],
    auditLog: [
      {
        timestamp: '2025-09-18T11:00:00Z',
        userName: USERS.rita,
        action: 'MaterialSpecCreated',
      },
    ],
  },
  {
    // Deliberate typo "1018 stell" — deactivated as cleanup.
    // Exercises edit-distance autocomplete: typing "1018 St" should suggest "1018 Steel",
    // and this entry (inactive) should NOT appear in the cascade modal dropdown.
    materialSpecId: 12,
    materialName: '1018 stell',
    form: 'Flat Bar',
    isActive: false,
    usedByCount: 0,
    openSupplyOrderCount: 0,
    activeWoCount: 0,
    awaitingReceiptWoCount: 0,
    awaitingPurchaseWoCount: 0,
    referencingParts: [],
    auditLog: [
      {
        timestamp: '2025-09-14T13:15:00Z',
        userName: USERS.rita,
        action: 'MaterialSpecCreated',
      },
      {
        timestamp: '2025-09-21T09:40:00Z',
        userName: USERS.marcus,
        action: 'MaterialSpecDeactivated',
      },
    ],
  },
  {
    materialSpecId: 13,
    materialName: '6061 Aluminum',
    form: 'Sqr Tube',
    isActive: false,
    usedByCount: 0,
    openSupplyOrderCount: 0,
    activeWoCount: 0,
    awaitingReceiptWoCount: 0,
    awaitingPurchaseWoCount: 0,
    referencingParts: [],
    auditLog: [
      {
        timestamp: '2025-08-12T10:30:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecCreated',
      },
      {
        timestamp: '2025-12-01T15:00:00Z',
        userName: USERS.rita,
        action: 'MaterialSpecDeactivated',
      },
    ],
  },
  {
    materialSpecId: 14,
    materialName: '4140 Steel',
    form: 'Plate',
    isActive: false,
    usedByCount: 0,
    openSupplyOrderCount: 0,
    activeWoCount: 0,
    awaitingReceiptWoCount: 0,
    awaitingPurchaseWoCount: 0,
    referencingParts: [],
    auditLog: [
      {
        timestamp: '2025-10-05T08:45:00Z',
        userName: USERS.marcus,
        action: 'MaterialSpecCreated',
      },
      {
        timestamp: '2026-01-15T11:30:00Z',
        userName: USERS.jane,
        action: 'MaterialSpecDeactivated',
      },
    ],
  },
];
