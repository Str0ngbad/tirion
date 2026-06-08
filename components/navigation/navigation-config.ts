export interface NavSurface {
  slug: string;
  label: string;
  href: string;
}

export interface NavCategory {
  id: 'production' | 'configuration';
  label: string;
  surfaces: NavSurface[];
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'production',
    label: 'Production Views',
    surfaces: [
      { slug: 'parts', label: 'Parts', href: '/parts' },
      { slug: 'bom-editor', label: 'BOM Editor', href: '/bom-editor' },
      { slug: 'routing-templates', label: 'Routing Templates', href: '/routing-templates' },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration Views',
    surfaces: [
      { slug: 'vendors', label: 'Vendors', href: '/configuration/vendors' },
      { slug: 'material-specs', label: 'Material Specs', href: '/configuration/material-specs' },
      { slug: 'users', label: 'Users', href: '/configuration/users' },
      { slug: 'processes', label: 'Processes', href: '/configuration/processes' },
      { slug: 'procurement-categories', label: 'Procurement Categories', href: '/configuration/procurement-categories' },
    ],
  },
];
