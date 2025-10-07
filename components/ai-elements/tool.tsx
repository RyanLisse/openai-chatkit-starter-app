import * as React from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ToolProps {
  name: string;
  status?: 'loading' | 'success' | 'error';
  children?: React.ReactNode;
  className?: string;
}

export const Tool = ({ name, status = 'loading', children, className }: ToolProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Card className={cn('my-2 overflow-hidden', className)}>
      <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
        <Collapsible.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between p-3 font-mono text-xs"
          >
            <div className="flex items-center gap-2">
              {status === 'loading' && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              <span>{name}</span>
            </div>
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </Button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div className="border-t p-3">{children}</div>
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
};

export const ToolHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-xs font-medium text-muted-foreground">
    {children}
  </div>
);

export const ToolContent = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs">{children}</div>
);

export const ToolInput = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2">
    <ToolHeader>Input</ToolHeader>
    <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
      <code>{typeof children === 'string' ? children : JSON.stringify(children, null, 2)}</code>
    </pre>
  </div>
);

export const ToolOutput = ({ children }: { children: React.ReactNode }) => (
  <div>
    <ToolHeader>Output</ToolHeader>
    <div className="rounded bg-muted p-2 text-xs">
      {typeof children === 'string' ? (
        <pre className="overflow-x-auto">
          <code>{children}</code>
        </pre>
      ) : (
        children
      )}
    </div>
  </div>
);