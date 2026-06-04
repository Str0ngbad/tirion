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
