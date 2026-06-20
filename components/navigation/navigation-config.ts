import type { UserRole } from "@/lib/api/users";

export interface NavSurface {
  slug: string;
  label: string;
  href: string;
}

export interface NavCategory {
  type: "category";
  id: "production" | "configuration";
  label: string;
  surfaces: NavSurface[];
}

export interface NavDirectLink {
  type: "link";
  slug: string;
  label: string;
  href: string;
  hiddenForRoles?: UserRole[];
}

export type NavItem = NavCategory | NavDirectLink;

export const NAV_ITEMS: NavItem[] = [
  {
    type: "link",
    slug: "projects",
    label: "Projects",
    href: "/projects",
    hiddenForRoles: ["Operator"],
  },
  {
    type: "link",
    slug: "stock-fulfillment",
    label: "Stock Fulfillment",
    href: "/stock-fulfillment",
    hiddenForRoles: ["Operator"],
  },
  {
    type: "link",
    slug: "batching",
    label: "Batching",
    href: "/batching",
    hiddenForRoles: ["Operator"],
  },
  {
    type: "category",
    id: "production",
    label: "Production Views",
    surfaces: [],
  },
  {
    type: "category",
    id: "configuration",
    label: "Configuration Views",
    surfaces: [
      { slug: "parts", label: "Parts", href: "/parts" },
      { slug: "bom-editor", label: "BOM Editor", href: "/bom-editor" },
      { slug: "routing-templates", label: "Routing Templates", href: "/routing-templates" },
      { slug: "vendors", label: "Vendors", href: "/configuration/vendors" },
      { slug: "material-specs", label: "Material Specs", href: "/configuration/material-specs" },
      { slug: "users", label: "Users", href: "/configuration/users" },
      { slug: "processes", label: "Processes", href: "/configuration/processes" },
      { slug: "procurement-categories", label: "Procurement Categories", href: "/configuration/procurement-categories" },
    ],
  },
];

// Legacy export used by global-nav for category lookups
export type NavCategory_Legacy = NavCategory;
