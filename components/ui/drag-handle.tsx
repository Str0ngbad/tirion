'use client';

import { GripVertical } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface DragHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const DragHandle = forwardRef<HTMLDivElement, DragHandleProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0',
        className
      )}
      role="button"
      tabIndex={0}
      aria-label="Drag to reorder"
      {...props}
    >
      <GripVertical className="h-4 w-4" />
    </div>
  )
);

DragHandle.displayName = 'DragHandle';
