"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
} from "@/lib/config";
import { ErrorOverlay } from "./ErrorOverlay";
import { ChatContainer, type Message } from "@/components/chat/chat-container";
import type { ColorScheme } from "@/hooks/useColorScheme";
import type { SourceItem } from "@/components/ai-elements/sources";

export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
};

type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: (action: FactAction) => Promise<void>;
  onResponseEnd: () => void;
  onThemeRequest: (scheme: ColorScheme) => void;
};

type ErrorState = {
  script: string | null;
  session: string | null;
  integration: string | null;
  retryable: boolean;
};

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

export function ChatKitPanelNew({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
}: ChatKitPanelProps) {
  const processedFacts = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const isMountedRef = useRef(true);
  const [scriptStatus, setScriptStatus] = useState<"pending" | "ready" | "error">(() =>
    isBrowser && window.customElements?.get("openai-chatkit") ? "ready" : "pending"
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Script loading
  useEffect(() => {
    if (!isBrowser) return;

    let timeoutId: number | undefined;

    const handleLoaded = () => {
      if (!isMountedRef.current) return;
      setScriptStatus("ready");
      setErrorState({ script: null });
    };

    const handleError = (event: Event) => {
      console.error("Failed to load chatkit.js", event);
      if (!isMountedRef.current) return;
      setScriptStatus("error");
      const detail = (event as CustomEvent<unknown>)?.detail ?? "unknown error";
      setErrorState({ script: `Error: ${detail}`, retryable: false });
      setIsInitializingSession(false);
    };

    window.addEventListener("chatkit-script-loaded", handleLoaded);
    window.addEventListener("chatkit-script-error", handleError as EventListener);

    if (window.customElements?.get("openai-chatkit")) {
      handleLoaded();
    } else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!window.customElements?.get("openai-chatkit")) {
          handleError(new CustomEvent("chatkit-script-error", {
            detail: "ChatKit web component is unavailable."
          }));
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("chatkit-script-loaded", handleLoaded);
      window.removeEventListener("chatkit-script-error", handleError as EventListener);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [scriptStatus, setErrorState]);

  const isWorkflowConfigured = Boolean(WORKFLOW_ID && !WORKFLOW_ID.startsWith("wf_replace"));

  useEffect(() => {
    if (!isWorkflowConfigured && isMountedRef.current) {
      setErrorState({
        session: "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.",
        retryable: false,
      });
      setIsInitializingSession(false);
    }
  }, [isWorkflowConfigured, setErrorState]);

  const handleResetChat = useCallback(() => {
    processedFacts.current.clear();
    if (isBrowser) {
      setScriptStatus(window.customElements?.get("openai-chatkit") ? "ready" : "pending");
    }
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
    setMessages([]);
    setInput("");
  }, []);

  const getClientSecret = useCallback(async (currentSecret: string | null) => {
    if (!isWorkflowConfigured) {
      const detail = "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.";
      if (isMountedRef.current) {
        setErrorState({ session: detail, retryable: false });
        setIsInitializingSession(false);
      }
      throw new Error(detail);
    }

    if (isMountedRef.current) {
      if (!currentSecret) setIsInitializingSession(true);
      setErrorState({ session: null, integration: null, retryable: false });
    }

    try {
      const response = await fetch(CREATE_SESSION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: { id: WORKFLOW_ID } }),
      });

      const raw = await response.text();
      let data: Record<string, unknown> = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch (e) {
          console.error("Failed to parse response", e);
        }
      }

      if (!response.ok) {
        const detail = extractErrorDetail(data, response.statusText);
        throw new Error(detail);
      }

      const clientSecret = data?.client_secret as string | undefined;
      if (!clientSecret) throw new Error("Missing client secret");

      if (isMountedRef.current) {
        setErrorState({ session: null, integration: null });
      }
      return clientSecret;
    } catch (error) {
      console.error("Failed to create session", error);
      const detail = error instanceof Error ? error.message : "Unable to start session.";
      if (isMountedRef.current) {
        setErrorState({ session: detail, retryable: false });
      }
      throw error;
    } finally {
      if (isMountedRef.current && !currentSecret) {
        setIsInitializingSession(false);
      }
    }
  }, [isWorkflowConfigured, setErrorState]);

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: theme,
      color: {
        grayscale: { hue: 220, tint: 6, shade: theme === "dark" ? -1 : -4 },
        accent: { primary: theme === "dark" ? "#f1f5f9" : "#0f172a", level: 1 },
      },
      radius: "round",
    },
    startScreen: {
      greeting: GREETING,
      prompts: STARTER_PROMPTS,
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
    },
    threadItemActions: { feedback: false },
    onClientTool: async (invocation: { name: string; params: Record<string, unknown> }) => {
      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          onThemeRequest(requested);
          return { success: true };
        }
      }
      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");
        if (!id || processedFacts.current.has(id)) return { success: true };
        processedFacts.current.add(id);
        void onWidgetAction({ type: "save", factId: id, factText: text.trim() });
        return { success: true };
      }
      return { success: false };
    },
    onResponseEnd: () => {
      setIsStreaming(false);
      onResponseEnd();
    },
    onResponseStart: () => {
      setIsStreaming(true);
      setErrorState({ integration: null, retryable: false });
    },
    onThreadChange: () => {
      processedFacts.current.clear();
    },
    onError: ({ error }: { error: unknown }) => {
      console.error("ChatKit error", error);
      setIsStreaming(false);
    },
  });

  // Handle message submission
  const handleSubmit = useCallback(() => {
    if (!input.trim() || !chatkit.control) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    // Send to ChatKit
    if (chatkit.control) {
      chatkit.control.send(userMessage.content);
    }

    // Simulate assistant response for now
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "I'm the new ChatKit interface! Your message has been received.",
        sources: [
          {
            id: "1",
            title: "Example Source",
            url: "https://example.com",
            snippet: "This is an example source snippet."
          }
        ]
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsStreaming(false);
    }, 1000);
  }, [input, chatkit.control]);

  const handleStop = useCallback(() => {
    if (chatkit.control) {
      // Stop streaming if available
      setIsStreaming(false);
    }
  }, [chatkit.control]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion);
  }, []);

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;

  // Show the new UI only when initialized
  if (blockingError || isInitializingSession) {
    return (
      <div className="relative flex h-[90vh] w-full flex-col overflow-hidden bg-background">
        <ChatKit
          key={widgetInstanceKey}
          control={chatkit.control}
          className="hidden"
        />
        <ErrorOverlay
          error={blockingError}
          fallbackMessage={blockingError || !isInitializingSession ? null : "Loading assistant session..."}
          onRetry={blockingError && errors.retryable ? handleResetChat : null}
          retryLabel="Restart chat"
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-[90vh] w-full flex-col overflow-hidden bg-background">
      {/* Hidden ChatKit component for session management */}
      <ChatKit
        key={widgetInstanceKey}
        control={chatkit.control}
        className="hidden"
      />

      {/* New Chat UI */}
      <ChatContainer
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onStop={handleStop}
        isLoading={isInitializingSession}
        isStreaming={isStreaming}
        placeholder={PLACEHOLDER_INPUT}
        className="h-full"
        welcomeMessage={
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{GREETING}</h1>
            <p className="text-muted-foreground">How can I help you today?</p>
          </div>
        }
        suggestions={STARTER_PROMPTS}
        onSuggestionClick={handleSuggestionClick}
      />
    </div>
  );
}

function extractErrorDetail(payload: Record<string, unknown> | undefined, fallback: string): string {
  if (!payload) return fallback;
  const error = payload.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message;
  }
  if (typeof payload.message === "string") return payload.message;
  return fallback;
}