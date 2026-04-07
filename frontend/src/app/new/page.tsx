"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { createProject } from "@/lib/api";

const MODELS = [
  // Free models - Unlimited / High limits
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google", badge: "Free - Recommended", price: "Free", free: true },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B", provider: "OpenRouter", badge: "Free - No Limits", price: "Free", free: true },
  { id: "qwen/qwen3-235b-a22b:free", name: "Qwen 3 235B", provider: "OpenRouter", badge: "Free - Smartest", price: "Free", free: true },
  { id: "deepseek/deepseek-r1-0528:free", name: "DeepSeek R1", provider: "OpenRouter", badge: "Free - Reasoning", price: "Free", free: true },
  { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B", provider: "OpenRouter", badge: "Free", price: "Free", free: true },
  { id: "mistralai/mistral-small-3.1-24b-instruct:free", name: "Mistral Small 3.1", provider: "OpenRouter", badge: "Free", price: "Free", free: true },
  { id: "command-r-plus", name: "Command R+", provider: "Cohere", badge: "Free Trial", price: "Free", free: true },
  { id: "command-r", name: "Command R", provider: "Cohere", badge: "Free Trial", price: "Free", free: true },
  { id: "command-a-03-2025", name: "Command A", provider: "Cohere", badge: "Free Trial", price: "Free", free: true },
  { id: "cerebras-llama-3.3-70b", name: "Llama 3.3 70B", provider: "Cerebras", badge: "Free - Ultra Fast", price: "Free", free: true },
  { id: "cerebras-llama-4-scout-17b", name: "Llama 4 Scout", provider: "Cerebras", badge: "Free - Fast", price: "Free", free: true },
  // Free models - Limited
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "Groq", badge: "Free - Rate Limited", price: "Free", free: true },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", provider: "Groq", badge: "Free - Rate Limited", price: "Free", free: true },
  { id: "gemma2-9b-it", name: "Gemma 2 9B", provider: "Groq", badge: "Free - Rate Limited", price: "Free", free: true },
  // Paid models
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "Anthropic", badge: "Paid", price: "$0.003/$0.015", free: false },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "Anthropic", badge: "Paid", price: "$0.001/$0.005", free: false },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", badge: "Paid", price: "$0.005/$0.015", free: false },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", badge: "Paid - Budget", price: "$0.00015/$0.0006", free: false },
];

const PLANS = [
  { id: "starter", name: "Starter", pages: 3, features: ["Up to 3 pages", "Basic design", "Standard support"] },
  { id: "pro", name: "Professional", pages: 10, features: ["Up to 10 pages", "Advanced design", "Dark mode", "Animations", "SEO optimized"] },
  { id: "enterprise", name: "Enterprise", pages: 50, features: ["Up to 50 pages", "Premium design", "Custom animations", "Full SEO suite", "Priority support", "Source code"] },
];

export default function NewProject() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [plan, setPlan] = useState("starter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const data = await createProject({ name, description, plan, model });
      if (data.project_id) {
        router.push(`/project/${data.project_id}`);
      } else {
        setError("Unexpected server response. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot connect to backend. Make sure the server is running.");
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Build New Website</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Describe your website and our 6 AI agents will build it for you.
        </p>

        <div className="space-y-8">
          {/* Project Details */}
          <section className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <h2 className="text-lg font-semibold mb-4">Project Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Website Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., TechStartup Landing Page"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-white placeholder-[var(--text-secondary)] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your website in detail: What it's for, key pages, features, style preferences, target audience..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-white placeholder-[var(--text-secondary)] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-none"
                />
              </div>
            </div>
          </section>

          {/* Plan Selection */}
          <section className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Choose Plan</h2>
              <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-1 rounded-full">
                All plans free - you only pay AI token costs via your own API key
              </span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    plan === p.id
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-[var(--border-color)] hover:border-[var(--text-secondary)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-xs font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Free</span>
                  </div>
                  <ul className="space-y-1">
                    {p.features.map((f) => (
                      <li key={f} className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </section>

          {/* Model Selection */}
          <section className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <h2 className="text-lg font-semibold mb-4">AI Model</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    model === m.id
                      ? "border-brand-500 bg-brand-500/10"
                      : m.free
                      ? "border-green-500/20 hover:border-green-500/50"
                      : "border-[var(--border-color)] hover:border-[var(--text-secondary)] opacity-70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{m.name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{m.provider} | {m.price}{!m.free ? " per 1K tokens" : ""}</div>
                    </div>
                    {m.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        m.free
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                      }`}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Submit */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 font-semibold text-lg transition-all glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting Pipeline...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Build Website with 6 AI Agents
              </span>
            )}
          </button>
        </div>
      </main>
    </>
  );
}
