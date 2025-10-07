import * as React from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface SourceItem {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  icon?: React.ReactNode;
}

interface SourcesProps {
  sources: SourceItem[];
  className?: string;
}

export const Sources = ({ sources, className }: SourcesProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('w-full', className)}
    >
      <Collapsible.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              'mr-1 h-3 w-3 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
          {sources.length} source{sources.length !== 1 ? 's' : ''}
        </Button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="grid gap-2 pb-2">
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};

export const SourceCard = ({ source }: { source: SourceItem }) => (
  <Card className="p-3">
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block space-y-1"
    >
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-medium leading-none group-hover:text-primary">
          {source.title}
        </h4>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {source.snippet && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {source.snippet}
        </p>
      )}
      <p className="text-xs text-muted-foreground truncate">{source.url}</p>
    </a>
  </Card>
);

// Simple source and sources trigger components for inline usage
export const Source = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block">{children}</span>
);

export const SourcesContent = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
);

export const SourcesTrigger = ({ children }: { children: React.ReactNode }) => (
  <button type="button" className="text-primary hover:underline">
    {children}
  </button>
);