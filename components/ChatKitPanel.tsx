"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
} from "@/lib/config";
import { ErrorOverlay } from "./ErrorOverlay";
import type { ColorScheme } from "@/hooks/useColorScheme";

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

type QuickStart = {
  title: string;
  description: string;
  badge?: string;
};

type KnowledgePack = {
  title: string;
  meta: string;
};

type LiveSignal = {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "steady";
};

type ActivityEvent = {
  time: string;
  summary: string;
  tag: string;
};

type WorkflowSegment = {
  title: string;
  description: string;
  status: "ready" | "running" | "paused";
};

const QUICK_STARTS: readonly QuickStart[] = [
  {
    title: "Generate safety briefing",
    description: "Summarize overnight incidents and highlight operator alerts for the next shift.",
    badge: "Briefing",
  },
  {
    title: "Draft field escalation",
    description: "Compose a ready-to-send update for regional supervisors with mitigation steps.",
    badge: "Escalation",
  },
  {
    title: "Convert maintenance log",
    description: "Transform raw technician notes into a structured task report with follow-ups.",
    badge: "Handoff",
  },
] as const;

const KNOWLEDGE_PACKS: readonly KnowledgePack[] = [
  {
    title: "Operations handbook",
    meta: "Updated 4 hours ago · 68 curated references",
  },
  {
    title: "Signal diagnostics",
    meta: "Live telemetry · 12 streams monitored",
  },
  {
    title: "Emergency playbooks",
    meta: "6 response templates · auto versioned",
  },
] as const;

const LIVE_SIGNALS: readonly LiveSignal[] = [
  {
    label: "Active workflows",
    value: "12",
    delta: "+3",
    trend: "up",
  },
  {
    label: "Response latency",
    value: "128 ms",
    delta: "-18%",
    trend: "down",
  },
  {
    label: "Operator satisfaction",
    value: "96%",
    delta: "+2%",
    trend: "up",
  },
] as const;

const ACTIVITY_FEED: readonly ActivityEvent[] = [
  {
    time: "09:42",
    summary: "Escalation note routed to central control with mitigation guidance.",
    tag: "Automation",
  },
  {
    time: "09:18",
    summary: "Knowledge pack \"Signal diagnostics\" synced with newest sensor schema.",
    tag: "Sync",
  },
  {
    time: "08:51",
    summary: "Operator feedback recorded: visibility improved after briefing tweak.",
    tag: "Feedback",
  },
  {
    time: "08:05",
    summary: "Workflow hgg-ops/live-monitor confirmed stable after overnight redeploy.",
    tag: "Status",
  },
] as const;

const WORKFLOW_SEGMENTS: readonly WorkflowSegment[] = [
  {
    title: "Realtime monitor",
    description: "Streaming signal ingest with anomaly tagging across 12 depots.",
    status: "running",
  },
  {
    title: "Operator co-pilot",
    description: "Conversational reasoning with fact capture and escalation templates.",
    status: "ready",
  },
  {
    title: "Incident handoff",
    description: "Auto-generate shift briefs and publish to dispatch Slack.",
    status: "ready",
  },
  {
    title: "Audit trail",
    description: "Structured trace of actions with exportable timeline for compliance.",
    status: "paused",
  },
] as const;

export function ChatKitPanel({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
}: ChatKitPanelProps) {
  const processedFacts = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const isMountedRef = useRef(true);
  const [scriptStatus, setScriptStatus] = useState<
    "pending" | "ready" | "error"
  >(() =>
    isBrowser && window.customElements?.get("openai-chatkit")
      ? "ready"
      : "pending"
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    let timeoutId: number | undefined;

    const handleLoaded = () => {
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("ready");
      setErrorState({ script: null });
    };

    const handleError = (event: Event) => {
      console.error("Failed to load chatkit.js for some reason", event);
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("error");
      const detail = (event as CustomEvent<unknown>)?.detail ?? "unknown error";
      setErrorState({ script: `Error: ${detail}`, retryable: false });
      setIsInitializingSession(false);
    };

    window.addEventListener("chatkit-script-loaded", handleLoaded);
    window.addEventListener(
      "chatkit-script-error",
      handleError as EventListener
    );

    if (window.customElements?.get("openai-chatkit")) {
      handleLoaded();
    } else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!window.customElements?.get("openai-chatkit")) {
          handleError(
            new CustomEvent("chatkit-script-error", {
              detail:
                "ChatKit web component is unavailable. Verify that the script URL is reachable.",
            })
          );
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("chatkit-script-loaded", handleLoaded);
      window.removeEventListener(
        "chatkit-script-error",
        handleError as EventListener
      );
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [scriptStatus, setErrorState]);

  const isWorkflowConfigured = Boolean(
    WORKFLOW_ID && !WORKFLOW_ID.startsWith("wf_replace")
  );

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
      setScriptStatus(
        window.customElements?.get("openai-chatkit") ? "ready" : "pending"
      );
    }
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
  }, []);

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      if (isDev) {
        console.info("[ChatKitPanel] getClientSecret invoked", {
          currentSecretPresent: Boolean(currentSecret),
          workflowId: WORKFLOW_ID,
          endpoint: CREATE_SESSION_ENDPOINT,
        });
      }

      if (!isWorkflowConfigured) {
        const detail =
          "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
          setIsInitializingSession(false);
        }
        throw new Error(detail);
      }

      if (isMountedRef.current) {
        if (!currentSecret) {
          setIsInitializingSession(true);
        }
        setErrorState({ session: null, integration: null, retryable: false });
      }

      try {
        const response = await fetch(CREATE_SESSION_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workflow: { id: WORKFLOW_ID },
          }),
        });

        const raw = await response.text();

        if (isDev) {
          console.info("[ChatKitPanel] createSession response", {
            status: response.status,
            ok: response.ok,
            bodyPreview: raw.slice(0, 1600),
          });
        }

        let data: Record<string, unknown> = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch (parseError) {
            console.error(
              "Failed to parse create-session response",
              parseError
            );
          }
        }

        if (!response.ok) {
          const detail = extractErrorDetail(data, response.statusText);
          console.error("Create session request failed", {
            status: response.status,
            body: data,
          });
          throw new Error(detail);
        }

        const clientSecret = data?.client_secret as string | undefined;
        if (!clientSecret) {
          throw new Error("Missing client secret in response");
        }

        if (isMountedRef.current) {
          setErrorState({ session: null, integration: null });
        }

        return clientSecret;
      } catch (error) {
        console.error("Failed to create ChatKit session", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Unable to start ChatKit session.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
        }
        throw error instanceof Error ? error : new Error(detail);
      } finally {
        if (isMountedRef.current && !currentSecret) {
          setIsInitializingSession(false);
        }
      }
    },
    [isWorkflowConfigured, setErrorState]
  );

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: theme,
      color: {
        grayscale: {
          hue: 220,
          tint: 6,
          shade: theme === "dark" ? -1 : -4,
        },
        accent: {
          primary: theme === "dark" ? "#f1f5f9" : "#0f172a",
          level: 1,
        },
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
    threadItemActions: {
      feedback: false,
    },
    onClientTool: async (invocation: {
      name: string;
      params: Record<string, unknown>;
    }) => {
      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          if (isDev) {
            console.debug("[ChatKitPanel] switch_theme", requested);
          }
          onThemeRequest(requested);
          return { success: true };
        }
        return { success: false };
      }

      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");
        if (!id || processedFacts.current.has(id)) {
          return { success: true };
        }
        processedFacts.current.add(id);
        void onWidgetAction({
          type: "save",
          factId: id,
          factText: text.replace(/\s+/g, " ").trim(),
        });
        return { success: true };
      }

      return { success: false };
    },
    onResponseEnd: () => {
      onResponseEnd();
    },
    onResponseStart: () => {
      setErrorState({ integration: null, retryable: false });
    },
    onThreadChange: () => {
      processedFacts.current.clear();
    },
    onError: ({ error }: { error: unknown }) => {
      // Note that Chatkit UI handles errors for your users.
      // Thus, your app code doesn't need to display errors on UI.
      console.error("ChatKit error", error);
    },
  });

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;

  if (isDev) {
    console.debug("[ChatKitPanel] render state", {
      isInitializingSession,
      hasControl: Boolean(chatkit.control),
      scriptStatus,
      hasError: Boolean(blockingError),
      workflowId: WORKFLOW_ID,
    });
  }

  const nextTheme = theme === "dark" ? "light" : "dark";
  const themeToggleLabel = nextTheme === "dark" ? "Switch to dark" : "Switch to light";
  const themeToggleIcon = nextTheme === "dark" ? "🌑" : "🌞";
  const statusBadgeStyles: Record<WorkflowSegment["status"], string> = {
    running: "bg-emerald-500/15 text-emerald-400",
    ready: "bg-blue-500/15 text-blue-500",
    paused: "bg-amber-500/15 text-amber-500",
  };
  const statusLabel: Record<WorkflowSegment["status"], string> = {
    running: "Live",
    ready: "Ready",
    paused: "Paused",
  };

  return (
    <div className="flex flex-1 flex-col gap-8 text-[color:var(--foreground)]">
      <header className="flex flex-wrap items-start justify-between gap-4 lg:items-center lg:gap-6">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">
            RoboRail · Live workspace
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--primary)] dark:text-[var(--primary)]">
            Control Studio for Guided Operations
          </h1>
          <p className="max-w-xl text-sm text-muted">
            Orchestrate workflows, monitor live signals, and brief every operator with the same high quality context—without leaving the conversation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-4 py-2 text-sm font-medium text-[color:var(--primary)] shadow-card transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/60"
            onClick={() => onThemeRequest(nextTheme)}
          >
            <span aria-hidden>{themeToggleIcon}</span>
            {themeToggleLabel}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground)] shadow-card transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50"
            onClick={handleResetChat}
          >
            Restart chat
          </button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[19rem_minmax(0,1fr)_18rem] xl:items-start">
        <aside className="space-y-4">
          <section className="rounded-3xl border border-divider bg-surface p-5 shadow-card backdrop-blur-xl">
            <header className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Quick start
              </p>
              <h2 className="text-lg font-semibold text-[color:var(--primary)]">
                Mission recipes for today
              </h2>
            </header>
            <ul className="mt-4 space-y-3">
              {QUICK_STARTS.map((item) => (
                <li key={item.title}>
                  <div
                    className="group rounded-2xl border border-transparent bg-surface-muted px-4 py-3 transition hover:border-[color:var(--accent)] hover:bg-[color:var(--surface-accent-strong)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[color:var(--primary)]">
                        {item.title}
                      </p>
                      {item.badge ? (
                        <span className="inline-flex min-w-max items-center rounded-full bg-[color:var(--surface-accent)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--accent)]">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-5 text-muted">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-divider bg-surface p-5 shadow-card backdrop-blur-xl">
            <header className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Knowledge packs
              </p>
              <h2 className="text-lg font-semibold text-[color:var(--primary)]">
                Curated sources on deck
              </h2>
            </header>
            <ul className="mt-4 space-y-3">
              {KNOWLEDGE_PACKS.map((pack) => (
                <li key={pack.title}>
                  <div className="flex flex-col gap-1 rounded-2xl border border-divider bg-surface-muted px-4 py-3">
                    <p className="text-sm font-semibold text-[color:var(--primary)]">
                      {pack.title}
                    </p>
                    <p className="text-xs text-muted">{pack.meta}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="flex flex-col gap-4">
          <div className="relative flex min-h-[540px] flex-1 overflow-hidden rounded-[2.5rem] border border-divider bg-surface shadow-card backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[rgba(59,130,246,0.16)] via-transparent to-transparent dark:from-[rgba(59,130,246,0.22)]" />
            <ChatKit
              key={widgetInstanceKey}
              control={chatkit.control}
              className={`z-0 h-full w-full transition-opacity duration-300 ${
                blockingError || isInitializingSession
                  ? "pointer-events-none opacity-0"
                  : "opacity-100"
              }`}
            />
            <ErrorOverlay
              error={blockingError}
              fallbackMessage={
                blockingError || !isInitializingSession
                  ? null
                  : "Loading assistant session..."
              }
              onRetry={blockingError && errors.retryable ? handleResetChat : null}
              retryLabel="Restart chat"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-divider bg-surface p-5 shadow-card backdrop-blur-xl">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Live signals
                  </p>
                  <h2 className="text-lg font-semibold text-[color:var(--primary)]">
                    Health snapshot
                  </h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
                  ● Stable
                </span>
              </header>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {LIVE_SIGNALS.map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-2xl border border-divider bg-surface-muted p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {signal.label}
                    </p>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-[color:var(--primary)]">
                        {signal.value}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          signal.trend === "up"
                            ? "text-emerald-500"
                            : signal.trend === "down"
                              ? "text-rose-500"
                              : "text-muted"
                        }`}
                      >
                        {signal.delta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-divider bg-surface p-5 shadow-card backdrop-blur-xl">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Activity feed
                  </p>
                  <h2 className="text-lg font-semibold text-[color:var(--primary)]">
                    Latest automations
                  </h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--surface-accent)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                  Auto-sync on
                </span>
              </header>
              <ul className="mt-5 space-y-4">
                {ACTIVITY_FEED.map((event) => (
                  <li key={`${event.time}-${event.summary}`} className="flex gap-3">
                    <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[color:var(--accent)]" />
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold text-muted">
                          {event.time}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted">
                          {event.tag}
                        </span>
                      </div>
                      <p className="text-sm leading-5 text-muted">{event.summary}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-divider bg-surface p-5 shadow-card backdrop-blur-xl">
            <header className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Workflow map
              </p>
              <h2 className="text-lg font-semibold text-[color:var(--primary)]">
                HGG · hgg-ops/live-monitor
              </h2>
            </header>
            <ul className="mt-5 space-y-4">
              {WORKFLOW_SEGMENTS.map((segment) => (
                <li
                  key={segment.title}
                  className="rounded-2xl border border-divider bg-surface-muted px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[color:var(--primary)]">
                      {segment.title}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeStyles[segment.status]}`}
                    >
                      {statusLabel[segment.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{segment.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-divider bg-surface p-5 shadow-card backdrop-blur-xl">
            <header className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Integrations
              </p>
              <h2 className="text-lg font-semibold text-[color:var(--primary)]">
                Connected services
              </h2>
            </header>
            <ul className="mt-4 space-y-3">
              <li className="flex items-start justify-between gap-3 rounded-2xl border border-divider bg-surface-muted px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--primary)]">Dispatch Slack</p>
                  <p className="text-xs text-muted">Publishing shift briefs · last sync 12m ago</p>
                </div>
                <span className="mt-1 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                  Active
                </span>
              </li>
              <li className="flex items-start justify-between gap-3 rounded-2xl border border-divider bg-surface-muted px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--primary)]">Observability bus</p>
                  <p className="text-xs text-muted">Streaming diagnostics · latency 128 ms</p>
                </div>
                <span className="mt-1 inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-500">
                  Synced
                </span>
              </li>
              <li className="flex items-start justify-between gap-3 rounded-2xl border border-divider bg-surface-muted px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--primary)]">Compliance archive</p>
                  <p className="text-xs text-muted">Daily export scheduled · pending review</p>
                </div>
                <span className="mt-1 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
                  Action needed
                </span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function extractErrorDetail(
  payload: Record<string, unknown> | undefined,
  fallback: string
): string {
  if (!payload) {
    return fallback;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  const details = payload.details;
  if (typeof details === "string") {
    return details;
  }

  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") {
      return nestedError;
    }
    if (
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof (nestedError as { message?: unknown }).message === "string"
    ) {
      return (nestedError as { message: string }).message;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}
