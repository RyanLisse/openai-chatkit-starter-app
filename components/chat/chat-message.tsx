"use client";

import * as React from 'react';
import { Copy, Check, RotateCw, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Message, MessageContent, MessageAvatar } from '@/components/ai-elements/message';
import { Sources, type SourceItem } from '@/components/ai-elements/sources';
import { Tool, ToolInput, ToolOutput } from '@/components/ai-elements/tool';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
  sources?: SourceItem[];
  tools?: Array<{
    name: string;
    input?: any;
    output?: any;
    status?: 'loading' | 'success' | 'error';
  }>;
  isStreaming?: boolean;
  onEdit?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
  onReload?: () => void;
  className?: string;
}

export function ChatMessage({
  role,
  content,
  id,
  sources,
  tools,
  isStreaming,
  onEdit,
  onDelete,
  onReload,
  className,
}: ChatMessageProps) {
  const [copied, setCopied] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(content);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleEdit = React.useCallback(() => {
    if (isEditing && id && onEdit) {
      onEdit(id, editContent);
    }
    setIsEditing(!isEditing);
  }, [isEditing, id, editContent, onEdit]);

  const handleDelete = React.useCallback(() => {
    if (id && onDelete) {
      onDelete(id);
    }
  }, [id, onDelete]);

  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  return (
    <Message from={role} className={className}>
      {role === 'assistant' && (
        <MessageAvatar
          name="AI"
          className="mt-0.5"
        />
      )}
      <div className="flex-1 space-y-2">
        <MessageContent>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full resize-none rounded-lg bg-background p-2 text-sm outline-none ring-1 ring-input"
              rows={4}
            />
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {isStreaming && !content ? (
                <span className="inline-flex">
                  <span className="sr-only">Loading</span>
                  <span className="animate-pulse">●</span>
                  <span className="animate-pulse delay-150">●</span>
                  <span className="animate-pulse delay-300">●</span>
                </span>
              ) : (
                <p className="whitespace-pre-wrap">{content}</p>
              )}
            </div>
          )}
          {/* Message Actions */}
          <div className="flex items-center gap-1 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            {role === 'user' && onEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={handleEdit}
              >
                <Edit2 className="h-3 w-3" />
                {isEditing ? 'Save' : 'Edit'}
              </Button>
            )}
            {role === 'user' && onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            {role === 'assistant' && onReload && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={onReload}
              >
                <RotateCw className="h-3 w-3" />
                Regenerate
              </Button>
            )}
          </div>
        </MessageContent>

        {/* Tools Display */}
        {tools && tools.length > 0 && (
          <div className="space-y-2">
            {tools.map((tool, index) => (
              <Tool
                key={index}
                name={tool.name}
                status={tool.status}
              >
                {tool.input && <ToolInput>{tool.input}</ToolInput>}
                {tool.output && <ToolOutput>{tool.output}</ToolOutput>}
              </Tool>
            ))}
          </div>
        )}

        {/* Sources Display */}
        {sources && sources.length > 0 && (
          <Sources sources={sources} className="mt-2" />
        )}
      </div>
      {role === 'user' && (
        <MessageAvatar
          name="You"
          className="mt-0.5"
        />
      )}
    </Message>
  );
}