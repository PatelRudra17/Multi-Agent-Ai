"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { getApiKeys, saveApiKey as apiSaveApiKey, deleteApiKey as apiDeleteApiKey } from "@/lib/api";

interface KeyEntry {
  provider: string;
  label: string;
  placeholder: string;
  prefix: string;
  value: string;
  saved: string;
}

const INITIAL_KEYS: KeyEntry[] = [
  // Free providers
  { provider: "google", label: "Google Gemini (Free - 1M tokens/min)", placeholder: "AIzaSy...", prefix: "AIza", value: "", saved: "" },
  { provider: "openrouter", label: "OpenRouter (Free models - No limits)", placeholder: "sk-or-...", prefix: "sk-or-", value: "", saved: "" },
  { provider: "cohere", label: "Cohere (Free trial - Command R)", placeholder: "...", prefix: "", value: "", saved: "" },
  { provider: "cerebras", label: "Cerebras (Free - Ultra fast)", placeholder: "csk-...", prefix: "csk-", value: "", saved: "" },
  { provider: "groq", label: "Groq (Free - Rate limited 12K TPM)", placeholder: "gsk_...", prefix: "gsk_", value: "", saved: "" },
  // Paid providers
  { provider: "anthropic", label: "Anthropic (Paid - Claude)", placeholder: "sk-ant-...", prefix: "sk-ant-", value: "", saved: "" },
  { provider: "openai", label: "OpenAI (Paid - GPT)", placeholder: "sk-...", prefix: "sk-", value: "", saved: "" },
];

export default function SettingsPage() {
  const [keys, setKeys] = useState<KeyEntry[]>(INITIAL_KEYS);
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getApiKeys()
      .then((data) => {
        if (data && typeof data === "object") {
          setKeys((prev) =>
            prev.map((k) => ({
              ...k,
              saved: data[k.provider] || "",
            }))
          );
        }
      })
      .catch(() => {
        setLoadError("Could not connect to backend. Make sure the server is running on port 8000.");
      });
  }, []);

  const validateKey = (provider: string, key: string): string | null => {
    const trimmed = key.trim();
    if (!trimmed) return "API key cannot be empty.";
    if (trimmed.length < 10) return "API key is too short. Please check and try again.";

    // Basic prefix validation
    const entry = keys.find((k) => k.provider === provider);
    if (entry && entry.prefix && !trimmed.startsWith(entry.prefix)) {
      return `This doesn't look like a valid ${entry.label} key. Expected to start with "${entry.prefix}".`;
    }

    return null;
  };

  const handleSave = async (provider: string) => {
    const key = keys.find((k) => k.provider === provider);
    if (!key) return;

    const validationError = validateKey(provider, key.value);
    if (validationError) {
      setStatus((prev) => ({ ...prev, [provider]: `validation:${validationError}` }));
      return;
    }

    setSaving(provider);
    setStatus((prev) => ({ ...prev, [provider]: "" }));

    try {
      await apiSaveApiKey(provider, key.value.trim());

      setStatus((prev) => ({ ...prev, [provider]: "saved" }));
      setKeys((prev) =>
        prev.map((k) =>
          k.provider === provider
            ? { ...k, saved: k.value.trim().slice(0, 8) + "..." + k.value.trim().slice(-4), value: "" }
            : k
        )
      );
      setTimeout(() => setStatus((prev) => ({ ...prev, [provider]: "" })), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save key";
      setStatus((prev) => ({ ...prev, [provider]: `error:${msg}` }));
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (provider: string) => {
    setSaving(provider);
    try {
      await apiDeleteApiKey(provider);
      setKeys((prev) =>
        prev.map((k) =>
          k.provider === provider ? { ...k, saved: "", value: "" } : k
        )
      );
      setStatus((prev) => ({ ...prev, [provider]: "deleted" }));
      setTimeout(() => setStatus((prev) => ({ ...prev, [provider]: "" })), 3000);
    } catch {
      setStatus((prev) => ({ ...prev, [provider]: "error:Failed to delete key" }));
    } finally {
      setSaving(null);
    }
  };

  const getStatusMessage = (provider: string) => {
    const s = status[provider];
    if (!s) return null;
    if (s === "saved") return { type: "success" as const, text: "Key saved successfully!" };
    if (s === "deleted") return { type: "success" as const, text: "Key removed." };
    if (s.startsWith("error:")) return { type: "error" as const, text: s.slice(6) };
    if (s.startsWith("validation:")) return { type: "warning" as const, text: s.slice(11) };
    return null;
  };

  const hasAnyKey = keys.some((k) => k.saved);

  return (
    <>
      <Navbar />
      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Configure your AI API keys. You need at least one key to build websites.
        </p>

        {/* Connection error banner */}
        {loadError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-400">{loadError}</p>
          </div>
        )}

        {/* No keys warning */}
        {!loadError && !hasAnyKey && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
            <svg className="w-5 h-5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-yellow-400">No API keys configured yet. Add at least one key below to start building websites.</p>
          </div>
        )}

        {/* API Keys */}
        <section className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] mb-8">
          <h2 className="text-lg font-semibold mb-6">API Keys</h2>
          <div className="space-y-6">
            {keys.map((key) => {
              const statusMsg = getStatusMessage(key.provider);
              return (
                <div key={key.provider}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">{key.label}</label>
                    {key.saved && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Configured: {key.saved}
                        </span>
                        <button
                          onClick={() => handleDelete(key.provider)}
                          disabled={saving === key.provider}
                          className="text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Remove this key"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={key.value}
                      onChange={(e) => {
                        setKeys((prev) =>
                          prev.map((k) =>
                            k.provider === key.provider ? { ...k, value: e.target.value } : k
                          )
                        );
                        // Clear validation errors on type
                        if (status[key.provider]?.startsWith("validation:")) {
                          setStatus((prev) => ({ ...prev, [key.provider]: "" }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && key.value.trim()) {
                          handleSave(key.provider);
                        }
                      }}
                      placeholder={key.saved ? "Enter new key to update..." : key.placeholder}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-white placeholder-[var(--text-secondary)] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm"
                    />
                    <button
                      onClick={() => handleSave(key.provider)}
                      disabled={!key.value.trim() || saving === key.provider}
                      className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving === key.provider ? (
                        <span className="flex items-center gap-1.5">
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving
                        </span>
                      ) : key.saved ? (
                        "Update"
                      ) : (
                        "Save"
                      )}
                    </button>
                  </div>
                  {statusMsg && (
                    <p className={`text-xs mt-1.5 ${
                      statusMsg.type === "success" ? "text-green-400" :
                      statusMsg.type === "warning" ? "text-yellow-400" :
                      "text-red-400"
                    }`}>
                      {statusMsg.text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Info */}
        <section className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
          <h2 className="text-lg font-semibold mb-4">How It Works</h2>
          <div className="space-y-4 text-sm text-[var(--text-secondary)]">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <span className="text-blue-400 font-bold">1</span>
              </div>
              <div>
                <p className="text-white font-medium">Add your API key</p>
                <p>Get a key from Anthropic, OpenAI, or Google and paste it above. Keys are stored securely on the server.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <span className="text-purple-400 font-bold">2</span>
              </div>
              <div>
                <p className="text-white font-medium">Describe your website</p>
                <p>Tell us what you want to build. The more detail, the better.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                <span className="text-green-400 font-bold">3</span>
              </div>
              <div>
                <p className="text-white font-medium">Watch 6 agents build it</p>
                <p>Planner, Designer, Developer, Tester, Reviewer, and Deployer work together automatically.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0">
                <span className="text-rose-400 font-bold">4</span>
              </div>
              <div>
                <p className="text-white font-medium">Download & deploy</p>
                <p>Get production-ready HTML/CSS/JS files to deploy anywhere.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Where to get keys */}
        <section className="mt-8 p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
          <h2 className="text-lg font-semibold mb-4">Where to Get API Keys</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/20">
              <div>
                <p className="font-medium">Google Gemini <span className="text-green-400 text-xs ml-1">FREE - 1M tokens/min</span></p>
                <p className="text-[var(--text-secondary)]">Gemini 2.0 Flash - best free option, practically unlimited</p>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 text-xs font-medium"
              >
                Get Free Key &rarr;
              </a>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/20">
              <div>
                <p className="font-medium">OpenRouter <span className="text-green-400 text-xs ml-1">FREE - No rate limits</span></p>
                <p className="text-[var(--text-secondary)]">Llama 3.3, Qwen 3, DeepSeek R1, Gemma 3, Mistral - all free</p>
              </div>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 text-xs font-medium"
              >
                Get Free Key &rarr;
              </a>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/20">
              <div>
                <p className="font-medium">Cohere <span className="text-green-400 text-xs ml-1">FREE trial - No credit card</span></p>
                <p className="text-[var(--text-secondary)]">Command R, R+, and A - 20 calls/min free</p>
              </div>
              <a
                href="https://dashboard.cohere.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 text-xs font-medium"
              >
                Get Free Key &rarr;
              </a>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/20">
              <div>
                <p className="font-medium">Cerebras <span className="text-green-400 text-xs ml-1">FREE - Ultra fast inference</span></p>
                <p className="text-[var(--text-secondary)]">Llama 3.3 70B, Llama 4 Scout - fastest free inference</p>
              </div>
              <a
                href="https://cloud.cerebras.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 text-xs font-medium"
              >
                Get Free Key &rarr;
              </a>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/20">
              <div>
                <p className="font-medium">Groq <span className="text-yellow-400 text-xs ml-1">FREE - 12K tokens/min limit</span></p>
                <p className="text-[var(--text-secondary)]">Llama 3.3 70B, Gemma 2 - fast but rate limited</p>
              </div>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 text-xs font-medium"
              >
                Get Free Key &rarr;
              </a>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)]">
              <div>
                <p className="font-medium">Anthropic (Claude) <span className="text-yellow-400 text-xs ml-1">Paid</span></p>
                <p className="text-[var(--text-secondary)]">Best quality - requires billing</p>
              </div>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 hover:text-brand-300 text-xs font-medium"
              >
                Get Key &rarr;
              </a>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)]">
              <div>
                <p className="font-medium">OpenAI (GPT) <span className="text-yellow-400 text-xs ml-1">Paid</span></p>
                <p className="text-[var(--text-secondary)]">Great quality - requires billing</p>
              </div>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 hover:text-brand-300 text-xs font-medium"
              >
                Get Key &rarr;
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
