import Link from 'next/link';

export interface ReferenceItem {
  id: number;
  primary: string;
  secondary: string;
  link?: string;
}

interface ReferenceListProps {
  items: ReferenceItem[];
  emptyMessage?: string;
  maxHeight?: string;
}

export function ReferenceList({
  items,
  emptyMessage = 'No references',
  maxHeight = '300px',
}: ReferenceListProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div style={{ maxHeight }} className="overflow-y-auto">
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="px-3 py-2 hover:bg-muted/50">
              {item.link ? (
                <Link href={item.link} className="flex items-center gap-2">
                  <span className="font-mono text-xs">{item.primary}</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {item.secondary}
                  </span>
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{item.primary}</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {item.secondary}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
