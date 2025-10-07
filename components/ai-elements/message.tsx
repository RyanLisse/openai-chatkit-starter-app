import type React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export type MessageProps = React.ComponentPropsWithoutRef<'div'> & {
  from: 'user' | 'assistant' | 'system';
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      'group flex w-full items-start gap-3 py-4',
      from === 'user' ? 'justify-end' : 'justify-start',
      className
    )}
    {...props}
  />
);

export type MessageContentProps = React.ComponentPropsWithoutRef<'div'>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      'flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm max-w-[80%]',
      'group-[.justify-end]:bg-primary group-[.justify-end]:text-primary-foreground',
      'group-[.justify-start]:bg-muted group-[.justify-start]:text-foreground',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageAvatarProps = React.ComponentProps<typeof Avatar> & {
  src?: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn('size-8', className)} {...props}>
    {src && <AvatarImage alt="" src={src} />}
    <AvatarFallback>{name?.slice(0, 2)?.toUpperCase() || 'AI'}</AvatarFallback>
  </Avatar>
);