export type UserRole = "Operator" | "Lead" | "Manager" | "Admin";

export type ProcessTypeKey =
  | "Purchase"
  | "Receive"
  | "Machine"
  | "Weld"
  | "Blacken"
  | "Paint"
  | "3D Print"
  | "Assemble"
  | "Distribution";

export type MockUser = {
  userId: number;
  userName: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  defaultStation: string | null;
  assignedProcessTypes: ProcessTypeKey[];
  auditLog: MockAuditEntry[];
};

export type MockAuditEntry = {
  timestamp: string;
  userName: string;
  action: "UserCreated" | "UserUpdated" | "UserDeactivated" | "UserReactivated";
  changedFields?: { field: string; before: string | null; after: string | null }[];
};

export const PROCESS_TYPE_META: Record<ProcessTypeKey, { label: string; cssVar: string }> = {
  Purchase:     { label: "Purchase",  cssVar: "--process-purchase" },
  Receive:      { label: "Receive",   cssVar: "--process-receive" },
  Machine:      { label: "Machine",   cssVar: "--process-machine" },
  Weld:         { label: "Weld",      cssVar: "--process-weld" },
  Blacken:      { label: "Blacken",   cssVar: "--process-blacken" },
  Paint:        { label: "Paint",     cssVar: "--process-paint" },
  "3D Print":   { label: "3D Print",  cssVar: "--process-3d-print" },
  Assemble:     { label: "Assemble",  cssVar: "--process-assemble" },
  Distribution: { label: "Dist.",     cssVar: "--process-distribution" },
};

export const ALL_PROCESS_TYPES: ProcessTypeKey[] = [
  "Purchase",
  "Receive",
  "Machine",
  "Weld",
  "Blacken",
  "Paint",
  "3D Print",
  "Assemble",
  "Distribution",
];

export const MOCK_USERS: MockUser[] = [
  {
    userId: 1,
    userName: "admin",
    displayName: "Admin",
    role: "Admin",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: [],
    auditLog: [
      {
        timestamp: "2026-01-15T09:00:00.000Z",
        userName: "System",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 2,
    userName: "jchen",
    displayName: "Jane Chen",
    role: "Admin",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: [],
    auditLog: [
      {
        timestamp: "2026-01-15T09:05:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 3,
    userName: "mhill",
    displayName: "Marcus Hill",
    role: "Manager",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: [],
    auditLog: [
      {
        timestamp: "2026-01-15T09:10:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 4,
    userName: "ralvarez",
    displayName: "Rita Alvarez",
    role: "Manager",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: [],
    auditLog: [
      {
        timestamp: "2026-02-10T14:30:00.000Z",
        userName: "Admin",
        action: "UserUpdated",
        changedFields: [
          { field: "displayName", before: "Anita Alvarez", after: "Rita Alvarez" },
        ],
      },
      {
        timestamp: "2026-01-15T09:12:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 5,
    userName: "dthompson",
    displayName: "Dan Thompson",
    role: "Lead",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: ["Machine", "Weld", "Assemble"],
    auditLog: [
      {
        timestamp: "2026-03-01T08:00:00.000Z",
        userName: "Jane Chen",
        action: "UserUpdated",
        changedFields: [
          { field: "role", before: "Operator", after: "Lead" },
          { field: "assignedProcessTypes", before: "Machine, Weld", after: "Machine, Weld, Assemble" },
        ],
      },
      {
        timestamp: "2026-01-15T09:15:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 6,
    userName: "sgarcia",
    displayName: "Sarah Garcia",
    role: "Lead",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: ["Purchase", "Receive"],
    auditLog: [
      {
        timestamp: "2026-02-20T11:00:00.000Z",
        userName: "Jane Chen",
        action: "UserUpdated",
        changedFields: [
          { field: "assignedProcessTypes", before: "Purchase", after: "Purchase, Receive" },
        ],
      },
      {
        timestamp: "2026-01-15T09:18:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 7,
    userName: "bnguyen",
    displayName: "Ben Nguyen",
    role: "Operator",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: ["Machine"],
    auditLog: [
      {
        timestamp: "2026-01-15T09:20:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 8,
    userName: "kpatel",
    displayName: "Kira Patel",
    role: "Operator",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: ["Machine", "Weld"],
    auditLog: [
      {
        timestamp: "2026-02-28T16:45:00.000Z",
        userName: "Jane Chen",
        action: "UserUpdated",
        changedFields: [
          { field: "displayName", before: "Kira K. Patel", after: "Kira Patel" },
        ],
      },
      {
        timestamp: "2026-01-15T09:22:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 9,
    userName: "jwilson",
    displayName: "James Wilson",
    role: "Operator",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: ["Blacken", "Paint"],
    auditLog: [
      {
        timestamp: "2026-01-15T09:25:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 10,
    userName: "aforster",
    displayName: "Anna Forster",
    role: "Operator",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: ["Assemble", "Distribution"],
    auditLog: [
      {
        timestamp: "2026-01-15T09:28:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 11,
    userName: "thoward",
    displayName: "Tom Howard",
    role: "Operator",
    isActive: true,
    defaultStation: null,
    assignedProcessTypes: ["3D Print", "Machine"],
    auditLog: [
      {
        timestamp: "2026-01-15T09:30:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 12,
    userName: "lprice",
    displayName: "Linda Price",
    role: "Operator",
    isActive: false,
    defaultStation: null,
    assignedProcessTypes: ["Machine"],
    auditLog: [
      {
        timestamp: "2026-04-15T10:00:00.000Z",
        userName: "Jane Chen",
        action: "UserDeactivated",
      },
      {
        timestamp: "2026-01-15T09:32:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
  {
    userId: 13,
    userName: "rkim",
    displayName: "Roy Kim",
    role: "Lead",
    isActive: false,
    defaultStation: null,
    assignedProcessTypes: ["Machine", "Assemble"],
    auditLog: [
      {
        timestamp: "2026-05-10T09:00:00.000Z",
        userName: "Jane Chen",
        action: "UserDeactivated",
      },
      {
        timestamp: "2026-01-15T09:35:00.000Z",
        userName: "Admin",
        action: "UserCreated",
      },
    ],
  },
];
