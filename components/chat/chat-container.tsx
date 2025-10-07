"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import type { SourceItem } from '@/components/ai-elements/sources';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
  tools?: Array<{
    name: string;
    input?: any;
    output?: any;
    status?: 'loading' | 'success' | 'error';
  }>;
  createdAt?: Date;
}

interface ChatContainerProps {
  messages: Message[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  onMessageEdit?: (id: string, content: string) => void;
  onMessageDelete?: (id: string) => void;
  onReload?: () => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  className?: string;
  welcomeMessage?: React.ReactNode;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}

export function ChatContainer({
  messages,
  input,
  onInputChange,
  onSubmit,
  onStop,
  onMessageEdit,
  onMessageDelete,
  onReload,
  isLoading = false,
  isStreaming = false,
  placeholder,
  className,
  welcomeMessage,
  suggestions,
  onSuggestionClick,
}: ChatContainerProps) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isEmpty = messages.length === 0;

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <ScrollArea
        ref={scrollAreaRef}
        className="flex-1 px-4"
      >
        <div className="mx-auto max-w-3xl py-8">
          {isEmpty && welcomeMessage && (
            <div className="mb-8 text-center">
              {welcomeMessage}
            </div>
          )}

          {isEmpty && suggestions && suggestions.length > 0 && (
            <div className="mb-8">
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Try asking about:
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => onSuggestionClick?.(suggestion)}
                    className="rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                id={message.id}
                role={message.role}
                content={message.content}
                sources={message.sources}
                tools={message.tools}
                isStreaming={isStreaming && message === messages[messages.length - 1]}
                onEdit={onMessageEdit}
                onDelete={onMessageDelete}
                onReload={message === messages[messages.length - 1] ? onReload : undefined}
              />
            ))}
          </div>

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <ChatMessage
              role="assistant"
              content=""
              isStreaming
            />
          )}

          <div ref={messagesEndRef} className="h-px w-full" />
        </div>
      </ScrollArea>

      <div className="border-t bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <ChatInput
            value={input}
            onChange={onInputChange}
            onSubmit={onSubmit}
            onStop={onStop}
            isSubmitting={isStreaming}
            placeholder={placeholder}
            disabled={isLoading && !isStreaming}
          />
        </div>
      </div>
    </div>
  );
}