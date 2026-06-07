'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface ConfigurationPageChromeProps {
  title: string;
  count?: number;
  showInactive: boolean;
  onShowInactiveChange: (value: boolean) => void;
  addLabel?: string;
  onAdd?: () => void;
  children: React.ReactNode;
}

export function ConfigurationPageChrome({
  title,
  count,
  showInactive,
  onShowInactiveChange,
  addLabel = 'Add',
  onAdd,
  children,
}: ConfigurationPageChromeProps) {
  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">{title}</h1>
          {count !== undefined && (
            <span className="text-sm text-muted-foreground">
              {count} {count === 1 ? 'item' : 'items'}
            </span>
          )}

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={onShowInactiveChange}
              />
              <label
                htmlFor="show-inactive"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Show inactive
              </label>
            </div>

            {onAdd && (
              <Button onClick={onAdd}>
                <Plus className="h-4 w-4 mr-2" />
                {addLabel}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
