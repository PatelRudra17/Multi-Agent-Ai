"use client";

import { useEffect, useState, useRef } from "react";
import { connectWebSocket } from "@/lib/api";

const AGENT_ICONS: Record<string, string> = {
  planner: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  designer: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
  developer: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  tester: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  reviewer: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  deployer: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
};

const AGENT_COLORS: Record<string, string> = {
  planner: "from-blue-500 to-cyan-500",
  designer: "from-purple-500 to-pink-500",
  developer: "from-green-500 to-emerald-500",
  tester: "from-yellow-500 to-orange-500",
  reviewer: "from-indigo-500 to-violet-500",
  deployer: "from-rose-500 to-red-500",
};

interface AgentStatus {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  description: string;
  tokens?: number;
  cost?: number;
  errorMessage?: string;
}

interface AgentPipelineProps {
  projectId: string;
  projectStatus?: string;
  agentLogs?: Array<{
    agent_name: string;
    status: string;
    tokens_used?: number;
    cost?: number;
    error?: string;
  }>;
}

const DEFAULT_AGENTS: AgentStatus[] = [
  { name: "planner", status: "pending", description: "Analyzing requirements & creating plan" },
  { name: "designer", status: "pending", description: "Designing UI/UX specifications" },
  { name: "developer", status: "pending", description: "Generating website code" },
  { name: "tester", status: "pending", description: "Testing & validating code" },
  { name: "reviewer", status: "pending", description: "Reviewing code quality" },
  { name: "deployer", status: "pending", description: "Deploying final website" },
];

export default function AgentPipeline({ projectId, projectStatus, agentLogs }: AgentPipelineProps) {
  const isTerminal = projectStatus === "completed" || projectStatus === "failed";

  // Build initial agent state from logs if project is already done
  const buildInitialAgents = (): AgentStatus[] => {
    if (!agentLogs || agentLogs.length === 0) return DEFAULT_AGENTS.map((a) => ({ ...a }));

    return DEFAULT_AGENTS.map((a) => {
      const log = agentLogs.find((l) => l.agent_name === a.name);
      if (!log) return { ...a };
      return {
        ...a,
        status: (log.status === "completed" ? "completed" : log.status === "failed" ? "failed" : "pending") as AgentStatus["status"],
        tokens: log.tokens_used || 0,
        cost: log.cost || 0,
        errorMessage: log.error || undefined,
      };
    });
  };

  const [agents, setAgents] = useState<AgentStatus[]>(buildInitialAgents);
  const [completed, setCompleted] = useState(projectStatus === "completed");
  const [totalCost, setTotalCost] = useState(() => {
    if (!agentLogs) return 0;
    return agentLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
  });
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Don't connect WebSocket for finished projects
    if (isTerminal) return;

    const cleanup = connectWebSocket(projectId, {
      onMessage: (data) => {
        setConnectionError(null);

        if (data.type === "agent_start") {
          setAgents((prev) =>
            prev.map((a) =>
              a.name === data.agent ? { ...a, status: "running" } : a
            )
          );
        }

        if (data.type === "agent_complete") {
          const cost = typeof data.cost === "number" ? data.cost : 0;
          setAgents((prev) =>
            prev.map((a) =>
              a.name === data.agent
                ? {
                    ...a,
                    status: "completed",
                    tokens: typeof data.tokens === "number" ? data.tokens : 0,
                    cost,
                  }
                : a
            )
          );
          setTotalCost((prev) => prev + cost);
        }

        if (data.type === "agent_error") {
          setAgents((prev) =>
            prev.map((a) =>
              a.name === data.agent
                ? {
                    ...a,
                    status: "failed",
                    errorMessage: typeof data.error === "string" ? data.error : "Agent failed",
                  }
                : a
            )
          );
        }

        if (data.type === "pipeline_complete") {
          setCompleted(true);
          // Close WebSocket after pipeline completes
          if (cleanupRef.current) cleanupRef.current();
        }

        if (data.type === "pipeline_failed") {
          // Close WebSocket after pipeline fails
          if (cleanupRef.current) cleanupRef.current();
        }
      },
      onError: (error) => {
        setConnectionError(error);
      },
      onOpen: () => {
        setConnected(true);
        setConnectionError(null);
      },
      onClose: () => {
        setConnected(false);
      },
    });

    cleanupRef.current = cleanup;
    return () => cleanup();
  }, [projectId, isTerminal]);

  return (
    <div className="space-y-2">
      {/* Connection status banner - only for active builds */}
      {!isTerminal && connectionError && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-red-400">{connectionError}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!isTerminal && !connectionError && !connected && !completed && (
        <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm text-yellow-400">Connecting to pipeline...</p>
        </div>
      )}

      {agents.map((agent, i) => (
        <div key={agent.name} className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${
                agent.status === "running"
                  ? `bg-gradient-to-br ${AGENT_COLORS[agent.name]} agent-active`
                  : agent.status === "completed"
                  ? "bg-green-500/20 border border-green-500/50"
                  : agent.status === "failed"
                  ? "bg-red-500/20 border border-red-500/50"
                  : "bg-[var(--bg-card)] border border-[var(--border-color)]"
              }`}
            >
              {agent.status === "completed" ? (
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : agent.status === "failed" ? (
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className={`w-6 h-6 ${agent.status === "running" ? "text-white" : "text-[var(--text-secondary)]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={AGENT_ICONS[agent.name]} />
                </svg>
              )}
            </div>
            {i < agents.length - 1 && (
              <div
                className={`w-0.5 h-8 mt-1 transition-all duration-500 ${
                  agent.status === "completed" ? "bg-green-500/50" : "bg-[var(--border-color)]"
                }`}
              />
            )}
          </div>

          <div className="flex-1 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-semibold capitalize ${agent.status === "running" ? "text-white glow-text" : ""}`}>
                  {agent.name} Agent
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  {agent.status === "running" ? (
                    <span className="text-brand-400 loading-dots">Working</span>
                  ) : agent.status === "failed" ? (
                    <span className="text-red-400">{agent.errorMessage || "Agent encountered an error"}</span>
                  ) : (
                    agent.description
                  )}
                </p>
              </div>
              <div className="text-right">
                {agent.status === "completed" && (
                  <div className="text-xs text-[var(--text-secondary)]">
                    <span className="text-green-400">{agent.tokens?.toLocaleString()} tokens</span>
                    <span className="mx-1">|</span>
                    <span>${agent.cost?.toFixed(4)}</span>
                  </div>
                )}
                {agent.status === "running" && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                    <span className="text-xs text-brand-400">Running</span>
                  </div>
                )}
                {agent.status === "failed" && (
                  <span className="text-xs text-red-400 font-medium">Failed</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Summary */}
      {completed && (
        <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-green-400">Pipeline Complete!</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Total AI cost: ${totalCost.toFixed(4)} | Your website is ready to view
              </p>
            </div>
          </div>
        </div>
      )}

      {projectStatus === "failed" && !completed && (
        <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-red-400">Pipeline Failed</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Check your API key in Settings and try creating a new project.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
