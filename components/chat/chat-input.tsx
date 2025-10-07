"use client";

import * as React from 'react';
import { Send, Paperclip, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isSubmitting?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onFileUpload?: (files: FileList) => void;
  maxLength?: number;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isSubmitting = false,
  placeholder = "Send a message...",
  disabled = false,
  className,
  onFileUpload,
  maxLength = 4000,
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !disabled && !isSubmitting) {
          onSubmit();
        }
      }
    },
    [value, disabled, isSubmitting, onSubmit]
  );

  const handleSubmit = React.useCallback(() => {
    if (isSubmitting && onStop) {
      onStop();
    } else if (value.trim() && !disabled) {
      onSubmit();
    }
  }, [value, disabled, isSubmitting, onSubmit, onStop]);

  const handleFileClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && onFileUpload) {
        onFileUpload(e.target.files);
        e.target.value = ''; // Reset input
      }
    },
    [onFileUpload]
  );

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [value]);

  return (
    <div className={cn('relative flex flex-col gap-2', className)}>
      <div className="relative flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className="min-h-[60px] resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
          rows={1}
        />
        <div className="flex items-center gap-1 pb-1">
          {onFileUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,.pdf,.txt,.md,.doc,.docx"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={handleFileClick}
                disabled={disabled || isSubmitting}
              >
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">Attach file</span>
              </Button>
            </>
          )}
          <Button
            type="button"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleSubmit}
            disabled={disabled || (!value.trim() && !isSubmitting)}
          >
            {isSubmitting ? (
              <>
                <Square className="h-3 w-3 fill-current" />
                <span className="sr-only">Stop</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </>
            )}
          </Button>
        </div>
      </div>
      {maxLength && (
        <div className="text-right text-xs text-muted-foreground">
          {value.length} / {maxLength}
        </div>
      )}
    </div>
  );
}