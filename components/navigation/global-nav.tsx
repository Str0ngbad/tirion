'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_CATEGORIES, type NavCategory } from './navigation-config';

export function GlobalNav() {
  const pathname = usePathname();
  const [openCategory, setOpenCategory] = useState<'production' | 'configuration' | null>(null);
  const [pinnedCategory, setPinnedCategory] = useState<'production' | 'configuration' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeCategoryId = NAV_CATEGORIES.find(cat =>
    cat.surfaces.some(s => pathname === s.href || pathname.startsWith(s.href + '/'))
  )?.id ?? null;

  const activeSurfaceHref = NAV_CATEGORIES
    .flatMap(c => c.surfaces)
    .find(s => pathname === s.href || pathname.startsWith(s.href + '/'))?.href ?? null;

  const effectiveOpen = pinnedCategory ?? openCategory;

  useEffect(() => {
    if (!pinnedCategory) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPinnedCategory(null);
        setOpenCategory(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pinnedCategory]);

  const handleMouseEnter = (categoryId: 'production' | 'configuration') => {
    if (pinnedCategory && pinnedCategory !== categoryId) {
      setPinnedCategory(null);
    }
    setOpenCategory(categoryId);
  };

  const handleMouseLeaveButton = (categoryId: 'production' | 'configuration') => {
    if (pinnedCategory) return;
    setTimeout(() => {
      setOpenCategory(current => current === categoryId ? null : current);
    }, 100);
  };

  const handleDropdownMouseLeave = () => {
    if (pinnedCategory) return;
    setOpenCategory(null);
  };

  const handleButtonClick = (categoryId: 'production' | 'configuration') => {
    if (pinnedCategory === categoryId) {
      setPinnedCategory(null);
      setOpenCategory(null);
    } else {
      setPinnedCategory(categoryId);
      setOpenCategory(categoryId);
    }
  };

  return (
    <nav ref={containerRef} className="border-b bg-background shrink-0">
      <div className="flex items-center px-4 h-12">
        <Link
          href="/"
          className="text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors mr-6"
        >
          Tirion
        </Link>

        <div className="flex items-center">
          {NAV_CATEGORIES.map((category) => (
            <CategoryButton
              key={category.id}
              category={category}
              isActive={activeCategoryId === category.id}
              isOpen={effectiveOpen === category.id}
              onMouseEnter={() => handleMouseEnter(category.id)}
              onMouseLeaveButton={() => handleMouseLeaveButton(category.id)}
              onClick={() => handleButtonClick(category.id)}
              activeSurfaceHref={activeSurfaceHref}
              onDropdownMouseLeave={handleDropdownMouseLeave}
              onDropdownMouseEnter={() => setOpenCategory(category.id)}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

interface CategoryButtonProps {
  category: NavCategory;
  isActive: boolean;
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeaveButton: () => void;
  onClick: () => void;
  activeSurfaceHref: string | null;
  onDropdownMouseLeave: () => void;
  onDropdownMouseEnter: () => void;
}

function CategoryButton({
  category,
  isActive,
  isOpen,
  onMouseEnter,
  onMouseLeaveButton,
  onClick,
  activeSurfaceHref,
  onDropdownMouseLeave,
  onDropdownMouseEnter,
}: CategoryButtonProps) {
  return (
    <div className="relative">
      <button
        className={cn(
          'flex items-center gap-1 px-4 py-3 text-sm transition-colors',
          isActive
            ? 'text-foreground border-b-2 border-primary -mb-px font-medium'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeaveButton}
        onClick={onClick}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {category.label}
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-0 min-w-[200px] bg-background border border-border rounded-b-md shadow-md z-50"
          onMouseEnter={onDropdownMouseEnter}
          onMouseLeave={onDropdownMouseLeave}
        >
          <ul className="py-1">
            {category.surfaces.map((surface) => {
              const isActiveSurface = activeSurfaceHref === surface.href;
              return (
                <li key={surface.slug}>
                  <Link
                    href={surface.href}
                    className={cn(
                      'block px-4 py-2 text-sm transition-colors',
                      isActiveSurface
                        ? 'text-foreground border-l-2 border-primary pl-[14px] font-medium bg-muted/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    )}
                  >
                    {surface.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
