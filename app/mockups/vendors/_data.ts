// Mockup-only types and data for /app/mockups/vendors/
// Deliberately NOT importing from /lib/vendors/ — see prompt for rationale.
//
// Notes for the mockup author:
// - `website` and `location` are EXPLORATORY fields not present in the Rev 1 spec.
//   They surface in the mockup to validate whether they earn a place in the schema.
//   The decision (option a vs. d, per spec discussion) is deferred until after this
//   mockup is reviewed.
// - Audit log entries here are hand-authored; in the real implementation they're
//   written via mutateWithAudit() against the AuditLog table.

export type MockVendor = {
  vendorId: number;
  vendorName: string;
  contactInfo: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
  defaultVendorForCount: number;
  openSupplyOrderCount: number;
  // Exploratory — not in Rev 1 spec
  website: string | null;
  location: string | null;
  // Mockup-only relations
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
  action: 'VendorCreated' | 'VendorUpdated' | 'VendorDeactivated' | 'VendorReactivated';
  changedFields?: { field: string; before: string | null; after: string | null }[];
};

// ---------------------------------------------------------------------------
// Reference parts pool — drawn from the routing demo for cross-mockup consistency.
// These part numbers are not real; they're a stable set used across mockups.
// ---------------------------------------------------------------------------
const PARTS = {
  brk101: { partId: 101, partNumber: 'BRK-101', partName: 'Bracket A' },
  plt330: { partId: 102, partNumber: 'PLT-330', partName: 'Mount Plate' },
  pin707: { partId: 103, partNumber: 'PIN-707', partName: 'Locator Pin' },
  spc808: { partId: 104, partNumber: 'SPC-808', partName: 'Spacer Block' },
  arm515: { partId: 105, partNumber: 'ARM-515', partName: 'Arm Link' },
  hsg410: { partId: 106, partNumber: 'HSG-410', partName: 'Housing' },
  cov612: { partId: 107, partNumber: 'COV-612', partName: 'Cover' },
  sha220: { partId: 108, partNumber: 'SHA-220', partName: 'Shaft Spacer' },
  // Additional parts to support McMaster's 12-reference list
  bsh140: { partId: 109, partNumber: 'BSH-140', partName: 'Bushing' },
  std095: { partId: 110, partNumber: 'STD-095', partName: 'Standoff' },
  scr025: { partId: 111, partNumber: 'SCR-025', partName: 'Socket Screw M5' },
  scr040: { partId: 112, partNumber: 'SCR-040', partName: 'Socket Screw M8' },
  nut018: { partId: 113, partNumber: 'NUT-018', partName: 'Hex Nut M5' },
  wsh012: { partId: 114, partNumber: 'WSH-012', partName: 'Flat Washer M5' },
  pin055: { partId: 115, partNumber: 'PIN-055', partName: 'Dowel Pin 5mm' },
  ret033: { partId: 116, partNumber: 'RET-033', partName: 'Retaining Ring' },
};

// Standard mockup user names for audit entries
const USERS = {
  jane: 'Jane Chen',
  marcus: 'Marcus Hill',
  rita: 'Rita Alvarez',
};

export const MOCK_VENDORS: MockVendor[] = [
  {
    vendorId: 1,
    vendorName: 'Alpine Bearing',
    contactInfo: 'sales@alpinebearing.com',
    leadTimeDays: 14,
    notes: 'Specialty bearing vendor. Email for quotes and orders.',
    isActive: true,
    defaultVendorForCount: 3,
    openSupplyOrderCount: 1,
    website: 'alpinebearing.com',
    location: 'Boston, MA',
    referencingParts: [PARTS.bsh140, PARTS.arm515, PARTS.sha220],
    auditLog: [
      {
        timestamp: '2025-08-12T14:22:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
      {
        timestamp: '2026-01-04T10:15:00Z',
        userName: USERS.marcus,
        action: 'VendorUpdated',
        changedFields: [{ field: 'leadTimeDays', before: '10', after: '14' }],
      },
    ],
  },
  {
    vendorId: 2,
    vendorName: 'Amazon',
    contactInfo: 'amazon.com',
    leadTimeDays: 2,
    notes: 'Used for one-off items. Verify lead times when ordering critical parts.',
    isActive: true,
    defaultVendorForCount: 0,
    openSupplyOrderCount: 0,
    website: 'amazon.com',
    location: null,
    referencingParts: [],
    auditLog: [
      {
        timestamp: '2025-08-12T14:25:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
    ],
  },
  {
    vendorId: 3,
    vendorName: 'Automation Direct',
    contactInfo: 'automationdirect.com',
    leadTimeDays: 2,
    notes: 'Electrical component vendor. Free two-day shipping on orders over $45.',
    isActive: true,
    defaultVendorForCount: 5,
    openSupplyOrderCount: 2,
    website: 'automationdirect.com',
    location: 'Atlanta, GA',
    referencingParts: [PARTS.hsg410, PARTS.cov612, PARTS.arm515, PARTS.brk101, PARTS.plt330],
    auditLog: [
      {
        timestamp: '2025-08-12T14:28:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
    ],
  },
  {
    vendorId: 4,
    vendorName: 'Bokers',
    contactInfo: 'sales@bokers.com',
    leadTimeDays: 56,
    notes: 'Custom stampings including precision washers and small formed parts.',
    isActive: true,
    defaultVendorForCount: 2,
    openSupplyOrderCount: 1,
    website: null,
    location: 'Minneapolis, MN',
    referencingParts: [PARTS.wsh012, PARTS.ret033],
    auditLog: [
      {
        timestamp: '2025-09-03T09:11:00Z',
        userName: USERS.marcus,
        action: 'VendorCreated',
      },
      {
        timestamp: '2025-11-18T16:40:00Z',
        userName: USERS.rita,
        action: 'VendorUpdated',
        changedFields: [
          { field: 'notes', before: 'Custom stampings.', after: 'Custom stampings including precision washers and small formed parts.' },
        ],
      },
    ],
  },
  {
    vendorId: 5,
    vendorName: 'Bulloch',
    contactInfo: '972-221-6277',
    leadTimeDays: 14,
    notes: 'Primary sheet metal vendor. Specializes in larger batch orders.',
    isActive: true,
    defaultVendorForCount: 7,
    openSupplyOrderCount: 0,
    website: null,
    location: 'Lewisville, TX',
    referencingParts: [
      PARTS.brk101,
      PARTS.plt330,
      PARTS.cov612,
      PARTS.hsg410,
      PARTS.spc808,
      PARTS.arm515,
      PARTS.sha220,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T14:32:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
    ],
  },
  {
    vendorId: 6,
    vendorName: 'DigiKey',
    contactInfo: 'digikey.com',
    leadTimeDays: 3,
    notes: 'Alternate electrical components vendor. Backup when Mouser is short.',
    isActive: true,
    defaultVendorForCount: 4,
    openSupplyOrderCount: 1,
    website: 'digikey.com',
    location: 'Thief River Falls, MN',
    referencingParts: [PARTS.hsg410, PARTS.cov612, PARTS.brk101, PARTS.arm515],
    auditLog: [
      {
        timestamp: '2025-08-12T14:35:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
    ],
  },
  {
    vendorId: 7,
    vendorName: 'Fastenal',
    contactInfo: '940-665-0559',
    leadTimeDays: 5,
    notes: 'Primary hardware vendor. Call to place orders and check stock.',
    isActive: true,
    defaultVendorForCount: 8,
    openSupplyOrderCount: 3,
    website: null,
    location: 'Gainesville, TX',
    referencingParts: [
      PARTS.scr025,
      PARTS.scr040,
      PARTS.nut018,
      PARTS.wsh012,
      PARTS.pin055,
      PARTS.std095,
      PARTS.ret033,
      PARTS.bsh140,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T14:38:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
    ],
  },
  {
    vendorId: 8,
    vendorName: 'Hannibal Carbide',
    contactInfo: '573-221-2775',
    leadTimeDays: 21,
    notes: 'Tooling vendor. Call to place orders.',
    isActive: true,
    defaultVendorForCount: 1,
    openSupplyOrderCount: 0,
    website: 'hannibalcarbide.com',
    location: 'Hannibal, MO',
    referencingParts: [PARTS.pin055],
    auditLog: [
      {
        timestamp: '2025-10-21T11:02:00Z',
        userName: USERS.marcus,
        action: 'VendorCreated',
      },
    ],
  },
  {
    vendorId: 9,
    vendorName: 'Hiwin',
    contactInfo: 'orders@hiwin.com',
    leadTimeDays: 60,
    notes: 'Linear rails and blocks. Replaced by direct relationship with distributor.',
    isActive: false,
    defaultVendorForCount: 0,
    openSupplyOrderCount: 0,
    website: 'hiwin.com',
    location: null,
    referencingParts: [],
    auditLog: [
      {
        timestamp: '2025-08-12T14:42:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
      {
        timestamp: '2025-12-15T13:30:00Z',
        userName: USERS.rita,
        action: 'VendorDeactivated',
      },
    ],
  },
  {
    vendorId: 10,
    vendorName: 'McMaster-Carr',
    contactInfo: 'mcmaster.com',
    leadTimeDays: 1,
    notes: 'Miscellaneous vendor for hardware, tooling, raw stock. Source elsewhere when volume justifies.',
    isActive: true,
    defaultVendorForCount: 12,
    openSupplyOrderCount: 4,
    website: 'mcmaster.com',
    location: 'Dallas, TX',
    referencingParts: [
      PARTS.brk101,
      PARTS.plt330,
      PARTS.pin707,
      PARTS.spc808,
      PARTS.arm515,
      PARTS.hsg410,
      PARTS.cov612,
      PARTS.sha220,
      PARTS.bsh140,
      PARTS.std095,
      PARTS.scr025,
      PARTS.wsh012,
    ],
    auditLog: [
      {
        timestamp: '2025-08-12T14:45:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
      {
        timestamp: '2026-02-08T08:50:00Z',
        userName: USERS.marcus,
        action: 'VendorUpdated',
        changedFields: [{ field: 'contactInfo', before: 'mcmaster.com / 562-692-5911', after: 'mcmaster.com' }],
      },
    ],
  },
  {
    vendorId: 11,
    vendorName: 'Metals4U',
    contactInfo: '214-231-1434',
    leadTimeDays: 7,
    notes: 'Primary vendor for cut-to-length steel and DOM tubing. Email for quotes and orders.',
    isActive: true,
    defaultVendorForCount: 6,
    openSupplyOrderCount: 2,
    website: null,
    location: 'Dallas, TX',
    referencingParts: [
      PARTS.brk101,
      PARTS.plt330,
      PARTS.sha220,
      PARTS.spc808,
      PARTS.arm515,
      PARTS.hsg410,
    ],
    auditLog: [
      {
        timestamp: '2025-11-04T15:20:00Z',
        userName: USERS.marcus,
        action: 'VendorCreated',
      },
    ],
  },
  {
    vendorId: 12,
    vendorName: 'Mi-Tech Metals',
    contactInfo: '317-549-4290',
    leadTimeDays: 14,
    notes: 'Heavy metal. Discontinued — replaced by Metals4U for tubing work.',
    isActive: false,
    defaultVendorForCount: 0,
    openSupplyOrderCount: 0,
    website: 'mttm.com',
    location: 'Indianapolis, IN',
    referencingParts: [],
    auditLog: [
      {
        timestamp: '2025-08-12T14:50:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
      {
        timestamp: '2025-11-04T15:25:00Z',
        userName: USERS.marcus,
        action: 'VendorDeactivated',
      },
    ],
  },
  {
    vendorId: 13,
    vendorName: 'Newegg',
    contactInfo: 'newegg.com',
    leadTimeDays: 3,
    notes: 'Computer parts. Compared against Amazon — Amazon usually wins on speed.',
    isActive: false,
    defaultVendorForCount: 0,
    openSupplyOrderCount: 0,
    website: 'newegg.com',
    location: null,
    referencingParts: [],
    auditLog: [
      {
        timestamp: '2025-08-12T14:52:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
      {
        timestamp: '2026-01-22T09:00:00Z',
        userName: USERS.rita,
        action: 'VendorDeactivated',
      },
    ],
  },
  {
    vendorId: 14,
    vendorName: 'SHARS',
    contactInfo: '630-443-6822',
    leadTimeDays: 7,
    notes: 'Tooling vendor. Discount account no longer active.',
    isActive: false,
    defaultVendorForCount: 0,
    openSupplyOrderCount: 0,
    website: 'shars.com',
    location: 'St. Charles, IL',
    referencingParts: [],
    auditLog: [
      {
        timestamp: '2025-08-12T14:55:00Z',
        userName: USERS.jane,
        action: 'VendorCreated',
      },
      {
        timestamp: '2025-09-30T11:45:00Z',
        userName: USERS.marcus,
        action: 'VendorUpdated',
        changedFields: [{ field: 'notes', before: '15% discount account active.', after: 'Tooling vendor. Discount account no longer active.' }],
      },
      {
        timestamp: '2026-02-14T14:10:00Z',
        userName: USERS.rita,
        action: 'VendorDeactivated',
      },
    ],
  },
];
