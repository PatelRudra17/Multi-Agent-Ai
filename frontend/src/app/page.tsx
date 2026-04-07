"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getProjects, deleteProject as apiDeleteProject } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  current_agent: string;
  model: string;
  plan: string;
  total_cost: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  building: "bg-brand-500/20 text-brand-400 border-brand-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(Array.isArray(data) ? (data as Project[]) : []);
      setLoading(false);
      setError(null);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Cannot connect to backend");
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    // Poll every 3s so building projects update in real time
    intervalRef.current = setInterval(fetchProjects, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchProjects]);

  // Stop polling when no projects are building
  useEffect(() => {
    const hasActive = projects.some((p) => p.status === "building" || p.status === "pending");
    if (!hasActive && !loading && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (hasActive && !intervalRef.current) {
      intervalRef.current = setInterval(fetchProjects, 3000);
    }
  }, [projects, loading, fetchProjects]);

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setDeleting(projectId);
    try {
      await apiDeleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch {
      // silently fail, project will reappear on next poll if still there
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <Navbar />
      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
            <span className="bg-gradient-to-r from-brand-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Multi-Agent AI
            </span>{" "}
            Website Builder
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            6 specialized AI agents work together to plan, design, develop, test, review,
            and deploy your website automatically.
          </p>
          <Link
            href="/new"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-brand-600 hover:bg-brand-500 rounded-xl text-base font-semibold transition-all glow"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Build New Website
          </Link>
        </div>

        {/* Agent Pipeline Preview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
          {[
            { name: "Planner", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", color: "from-blue-500 to-cyan-500" },
            { name: "Designer", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01", color: "from-purple-500 to-pink-500" },
            { name: "Developer", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4", color: "from-green-500 to-emerald-500" },
            { name: "Tester", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "from-yellow-500 to-orange-500" },
            { name: "Reviewer", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z", color: "from-indigo-500 to-violet-500" },
            { name: "Deployer", icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12", color: "from-rose-500 to-red-500" },
          ].map((agent, i) => (
            <div key={agent.name} className="relative group">
              <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] card-hover text-center">
                <div className={`w-10 h-10 mx-auto rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center mb-2 opacity-80 group-hover:opacity-100 transition-opacity`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={agent.icon} />
                  </svg>
                </div>
                <div className="text-sm font-medium">{agent.name}</div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">Agent {i + 1}</div>
              </div>
              {i < 5 && (
                <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2 text-[var(--border-color)]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Projects List */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Your Projects</h2>
          <span className="text-sm text-[var(--text-secondary)]">{projects.length} projects</span>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[var(--text-secondary)]">Loading projects...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
            <svg className="w-12 h-12 mx-auto text-red-400/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">Cannot Load Projects</h3>
            <p className="text-[var(--text-secondary)] mb-4">{error}</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Make sure the backend server is running at{" "}
              <code className="px-1.5 py-0.5 rounded bg-white/5 text-brand-400 text-xs">http://localhost:8000</code>
            </p>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                fetchProjects();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-medium transition-all"
            >
              Try Again
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
            <svg className="w-16 h-16 mx-auto text-[var(--border-color)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-[var(--text-secondary)] mb-4">Create your first AI-generated website</p>
            <Link href="/new" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-medium transition-all">
              Get Started
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                className="block p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] card-hover relative group/card"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold truncate flex-1">{p.name}</h3>
                  <div className="flex items-center gap-2 ml-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[p.status] || STATUS_COLORS.pending}`}>
                      {p.status}
                    </span>
                    {(p.status === "completed" || p.status === "failed") && (
                      <button
                        onClick={(e) => handleDelete(e, p.id)}
                        disabled={deleting === p.id}
                        className="opacity-0 group-hover/card:opacity-100 p-1 rounded-md hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400 transition-all"
                        title="Delete project"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">{p.description}</p>
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span className="capitalize">{p.model?.replace(/-/g, " ")}</span>
                  <span>${p.total_cost?.toFixed(4) || "0.00"}</span>
                </div>
                {p.status === "building" && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                    <span className="text-xs text-brand-400 capitalize">{p.current_agent} agent working...</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
