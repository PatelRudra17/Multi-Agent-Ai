"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import AgentPipeline from "@/components/AgentPipeline";
import { getProject as apiGetProject, getProjectFiles, deleteProject as apiDeleteProject } from "@/lib/api";

interface ProjectFile {
  path: string;
  content: string;
  size: number;
}

interface AgentLog {
  agent_name: string;
  status: string;
  tokens_used?: number;
  cost?: number;
  error?: string;
}

interface ProjectData {
  id: string;
  name: string;
  description: string;
  status: string;
  current_agent: string;
  model: string;
  plan: string;
  total_cost: number;
  created_at: string;
  detail?: string;
  agent_logs?: AgentLog[];
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [activeFile, setActiveFile] = useState<string>("");
  const [tab, setTab] = useState<"pipeline" | "files" | "preview">("pipeline");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const filesFetchedRef = useRef(false);

  const fetchProject = useCallback(async () => {
    try {
      const data = (await apiGetProject(projectId)) as ProjectData;
      setProject(data);
      setLoading(false);
      setError(null);

      // Fetch files once when completed
      if (data.status === "completed" && !filesFetchedRef.current) {
        filesFetchedRef.current = true;
        try {
          const f = await getProjectFiles(projectId);
          if (Array.isArray(f)) {
            setFiles(f);
            if (f.length > 0 && !activeFile) setActiveFile(f[0].path);
          }
        } catch {
          // Files not available yet, allow retry on next poll
          filesFetchedRef.current = false;
        }
      }

      // Stop polling once project is in a terminal state
      if (data.status === "completed" || data.status === "failed") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
      setLoading(false);
    }
  }, [projectId, activeFile]);

  useEffect(() => {
    fetchProject();
    intervalRef.current = setInterval(fetchProject, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchProject]);

  const activeFileData = files.find((f) => f.path === activeFile);

  // Construct a full preview HTML by inlining ALL CSS/JS into the index.html
  const getPreviewHtml = (): string => {
    const indexFile = files.find((f) => f.path === "index.html");
    if (!indexFile) return "";

    let html = indexFile.content;

    // Inline ALL CSS files
    const cssFiles = files.filter((f) => f.path.endsWith(".css"));
    if (cssFiles.length > 0) {
      const allCss = cssFiles.map((f) => f.content).join("\n");
      // Replace all <link> CSS references with combined inline styles
      html = html.replace(
        /<link[^>]+href=["'][^"']*\.css["'][^>]*>/gi,
        ""
      );
      // Insert combined CSS before </head>
      html = html.replace(
        /<\/head>/i,
        `<style>${allCss}</style>\n</head>`
      );
    }

    // Inline ALL JS files
    const jsFiles = files.filter((f) => f.path.endsWith(".js") && !f.path.endsWith(".json"));
    if (jsFiles.length > 0) {
      const allJs = jsFiles.map((f) => f.content).join("\n");
      // Remove all <script src="*.js"> references
      html = html.replace(
        /<script[^>]+src=["'][^"']*\.js["'][^>]*><\/script>/gi,
        ""
      );
      // Insert combined JS before </body>
      html = html.replace(
        /<\/body>/i,
        `<script>${allJs}</script>\n</body>`
      );
    }

    return html;
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiDeleteProject(projectId);
      router.push("/");
    } catch {
      setDeleting(false);
    }
  };

  const handleDownloadAll = () => {
    if (files.length === 0) return;
    // Download each file individually or create a combined download
    files.forEach((f) => {
      const blob = new Blob([f.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.path.replace(/\//g, "_");
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="pt-20 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">Loading project...</p>
          </div>
        </main>
      </>
    );
  }

  if (error && !project) {
    return (
      <>
        <Navbar />
        <main className="pt-20 text-center py-20">
          <svg className="w-16 h-16 mx-auto text-red-400/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-2xl font-bold mb-2">Failed to Load Project</h1>
          <p className="text-[var(--text-secondary)] mb-4">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { setLoading(true); setError(null); fetchProject(); }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-medium transition-all"
            >
              Try Again
            </button>
            <Link href="/" className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-white border border-[var(--border-color)] hover:border-brand-500 transition-all">
              Back to Dashboard
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (!project || project.detail) {
    return (
      <>
        <Navbar />
        <main className="pt-20 text-center py-20">
          <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
          <Link href="/" className="text-brand-400 hover:text-brand-300">Back to Dashboard</Link>
        </main>
      </>
    );
  }

  const previewHtml = getPreviewHtml();

  return (
    <>
      <Navbar />
      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1">
              <Link href="/" className="text-[var(--text-secondary)] hover:text-white transition-colors shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold truncate">{project.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
                  project.status === "completed"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : project.status === "building"
                    ? "bg-brand-500/20 text-brand-400 border-brand-500/30"
                    : project.status === "failed"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                }`}
              >
                {project.status}
              </span>
            </div>
            <p className="text-[var(--text-secondary)] truncate">{project.description}</p>
          </div>
          <div className="flex items-start gap-4 shrink-0">
            <div className="text-right text-sm text-[var(--text-secondary)]">
              <div>Model: <span className="text-white capitalize">{project.model?.replace(/-/g, " ")}</span></div>
              <div>Plan: <span className="text-white capitalize">{project.plan}</span></div>
              <div>Cost: <span className="text-brand-400">${project.total_cost?.toFixed(4) || "0.0000"}</span></div>
            </div>
            {(project.status === "completed" || project.status === "failed") && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-all disabled:opacity-50"
                title="Delete project"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl w-fit">
            {(["pipeline", "files", "preview"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                  tab === t ? "bg-brand-600 text-white" : "text-[var(--text-secondary)] hover:text-white"
                }`}
              >
                {t}
                {t === "files" && files.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-brand-500/20 text-brand-400">
                    {files.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {files.length > 0 && (
            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-white hover:border-brand-500 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Files
            </button>
          )}
        </div>

        {/* Pipeline View */}
        {tab === "pipeline" && (
          <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <h2 className="text-lg font-semibold mb-6">Agent Pipeline</h2>
            <AgentPipeline projectId={projectId} projectStatus={project.status} agentLogs={project.agent_logs} />
          </div>
        )}

        {/* Files View */}
        {tab === "files" && (
          <div className="grid lg:grid-cols-[250px_1fr] gap-4">
            {/* File tree */}
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
              <h3 className="text-sm font-semibold mb-3 text-[var(--text-secondary)] uppercase tracking-wider">Files</h3>
              {files.length === 0 ? (
                <div className="text-center py-6">
                  <svg className="w-10 h-10 mx-auto text-[var(--border-color)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {project.status === "building" ? "Files will appear when the developer agent completes..." : "No files generated yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {files.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => setActiveFile(f.path)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                        activeFile === f.path
                          ? "bg-brand-500/20 text-brand-400"
                          : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate">{f.path}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Code viewer */}
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
              {activeFileData ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-brand-400">{activeFileData.path}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-secondary)]">{activeFileData.size} chars</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeFileData.content).catch(() => {});
                        }}
                        className="text-xs text-[var(--text-secondary)] hover:text-white px-2 py-1 rounded-md hover:bg-white/5 transition-all"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] overflow-x-auto text-sm leading-relaxed max-h-[70vh] overflow-y-auto">
                    <code>{activeFileData.content}</code>
                  </pre>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
                  Select a file to view its code
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview View */}
        {tab === "preview" && (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden">
            {previewHtml ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/60" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                      <div className="w-3 h-3 rounded-full bg-green-500/60" />
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] ml-2">Preview</span>
                  </div>
                  <button
                    onClick={() => {
                      const blob = new Blob([previewHtml], { type: "text/html" });
                      const url = URL.createObjectURL(blob);
                      window.open(url, "_blank");
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                    className="text-xs text-[var(--text-secondary)] hover:text-white px-2 py-1 rounded-md hover:bg-white/5 transition-all"
                  >
                    Open in New Tab
                  </button>
                </div>
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-[80vh] bg-white"
                  title="Website Preview"
                  sandbox="allow-scripts"
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)]">
                <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <p>
                  {project.status === "building"
                    ? "Preview will be available once the website is generated..."
                    : "No preview available - index.html not found"}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
