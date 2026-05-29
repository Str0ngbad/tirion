import type { ProcessTypeKey } from "@/app/mockups/users/_data";

export type { ProcessTypeKey };

export type MockSubStatus = {
  subStatusId: number;
  processType: ProcessTypeKey;
  subStatusName: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  auditLog: MockAuditEntry[];
};

export type MockAuditEntry = {
  timestamp: string;
  userName: string;
  action:
    | "SubStatusCreated"
    | "SubStatusUpdated"
    | "SubStatusRetired"
    | "SubStatusReactivated";
  changedFields?: { field: string; before: string | null; after: string | null }[];
};

export const MOCK_SUB_STATUSES: MockSubStatus[] = [
  // ─── Purchase ────────────────────────────────────────────────────────────────
  {
    subStatusId: 1,
    processType: "Purchase",
    subStatusName: "Material Checked",
    description: "Raw material stock has been verified against the BOM.",
    displayOrder: 10,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:15:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 2,
    processType: "Purchase",
    subStatusName: "RFQ Pending",
    description: "Request for quotation has been sent; awaiting vendor response.",
    displayOrder: 20,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:17:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 3,
    processType: "Purchase",
    subStatusName: "Quote Received",
    description: "Vendor quote received and under review.",
    displayOrder: 30,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:18:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
      {
        timestamp: "2025-02-14T11:30:00.000Z",
        userName: "Rita Alvarez",
        action: "SubStatusUpdated",
        changedFields: [
          { field: "description", before: "Quote in hand.", after: "Vendor quote received and under review." },
        ],
      },
    ],
  },
  {
    subStatusId: 4,
    processType: "Purchase",
    subStatusName: "Ordered",
    description: "Purchase order submitted to vendor.",
    displayOrder: 40,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:20:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },

  // ─── Receive ─────────────────────────────────────────────────────────────────
  {
    subStatusId: 5,
    processType: "Receive",
    subStatusName: "Partial",
    description: "Shipment received but quantity is short; remainder outstanding.",
    displayOrder: 10,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:25:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 6,
    processType: "Receive",
    subStatusName: "Requested Update",
    description: "Update requested from vendor or freight carrier.",
    displayOrder: 20,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:26:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 7,
    processType: "Receive",
    subStatusName: "Delayed",
    description: "Delivery confirmed delayed beyond original ETA.",
    displayOrder: 30,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:27:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
      {
        timestamp: "2025-03-01T14:00:00.000Z",
        userName: "Marcus Hill",
        action: "SubStatusUpdated",
        changedFields: [
          { field: "displayOrder", before: "25", after: "30" },
        ],
      },
    ],
  },
  // Inactive: "Awaiting" — deactivated as redundant with the primary state machine
  {
    subStatusId: 8,
    processType: "Receive",
    subStatusName: "Awaiting",
    description: null,
    displayOrder: 5,
    isActive: false,
    auditLog: [
      { timestamp: "2025-01-08T09:24:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
      { timestamp: "2025-01-10T10:00:00.000Z", userName: "Rita Alvarez", action: "SubStatusRetired" },
    ],
  },

  // ─── Machine ─────────────────────────────────────────────────────────────────
  {
    subStatusId: 9,
    processType: "Machine",
    subStatusName: "Setup",
    description: "Machine is being prepared; tooling and fixtures loaded.",
    displayOrder: 10,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:30:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 10,
    processType: "Machine",
    subStatusName: "Running",
    description: "Parts are actively being machined.",
    displayOrder: 20,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:31:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 11,
    processType: "Machine",
    subStatusName: "Complete",
    description: "Machining finished; parts ready for the next step.",
    displayOrder: 30,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:32:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 12,
    processType: "Machine",
    subStatusName: "Hold for QA",
    description: "Step paused pending quality assurance inspection.",
    displayOrder: 40,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:33:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 13,
    processType: "Machine",
    subStatusName: "Hold for Next Setup",
    description: "Work complete on current setup; machine needs reconfiguration before next batch.",
    displayOrder: 50,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:34:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  // Inactive: "Setp" — typo created in error before "Setup" was added; retired immediately
  {
    subStatusId: 14,
    processType: "Machine",
    subStatusName: "Setp",
    description: null,
    displayOrder: 15,
    isActive: false,
    auditLog: [
      { timestamp: "2025-01-08T09:29:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
      { timestamp: "2025-01-08T09:31:00.000Z", userName: "Jane Chen", action: "SubStatusRetired" },
    ],
  },

  // ─── Assemble ────────────────────────────────────────────────────────────────
  {
    subStatusId: 15,
    processType: "Assemble",
    subStatusName: "Staging",
    description: "Components gathered and staged at the assembly station.",
    displayOrder: 10,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:40:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 16,
    processType: "Assemble",
    subStatusName: "Validate Fit",
    description: "Pre-assembly dry-fit to confirm component compatibility.",
    displayOrder: 20,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:41:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 17,
    processType: "Assemble",
    subStatusName: "In Assembly",
    description: "Active assembly of sub-assemblies or final product.",
    displayOrder: 30,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:42:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
    ],
  },
  {
    subStatusId: 18,
    processType: "Assemble",
    subStatusName: "QA Review",
    description: "Assembled unit under quality review before sign-off.",
    displayOrder: 40,
    isActive: true,
    auditLog: [
      { timestamp: "2025-01-08T09:43:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
      {
        timestamp: "2025-02-20T15:00:00.000Z",
        userName: "Rita Alvarez",
        action: "SubStatusUpdated",
        changedFields: [
          {
            field: "description",
            before: "Final check before sign-off.",
            after: "Assembled unit under quality review before sign-off.",
          },
        ],
      },
    ],
  },
  // Inactive: "Final Check" — superseded by "QA Review" with a clearer name
  {
    subStatusId: 19,
    processType: "Assemble",
    subStatusName: "Final Check",
    description: "Final check before sign-off.",
    displayOrder: 45,
    isActive: false,
    auditLog: [
      { timestamp: "2025-01-08T09:44:00.000Z", userName: "Jane Chen", action: "SubStatusCreated" },
      { timestamp: "2025-02-20T15:05:00.000Z", userName: "Rita Alvarez", action: "SubStatusRetired" },
    ],
  },

  // Weld, Blacken, Paint, 3D Print, Distribution — no sub-statuses
];
