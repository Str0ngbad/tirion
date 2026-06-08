import { cn } from '@/lib/utils';

interface ActiveIndicatorProps {
  active: boolean;
}

export function ActiveIndicator({ active }: ActiveIndicatorProps) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        active ? 'bg-emerald-500' : 'bg-muted-foreground/30'
      )}
      title={active ? 'Active' : 'Inactive'}
    />
  );
}
