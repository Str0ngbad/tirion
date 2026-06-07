'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const SURFACES = [
  { slug: 'vendors', label: 'Vendors' },
  { slug: 'material-specs', label: 'Material Specs' },
  { slug: 'users', label: 'Users' },
  { slug: 'process-types', label: 'Process Types' },
  { slug: 'process-type-sub-statuses', label: 'Sub-Statuses' },
  { slug: 'procurement-categories', label: 'Procurement Categories' },
] as const;

export function ConfigurationSubNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background shrink-0">
      <div className="flex items-center px-4">
        <span className="text-sm font-semibold text-muted-foreground mr-6 py-3">
          Configuration
        </span>
        <ul className="flex items-center">
          {SURFACES.map(({ slug, label }) => {
            const href = `/configuration/${slug}`;
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={slug}>
                <Link
                  href={href}
                  className={cn(
                    'block px-4 py-3 text-sm transition-colors',
                    isActive
                      ? 'text-foreground border-b-2 border-primary -mb-px font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
