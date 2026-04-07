"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    description: "Perfect for simple landing pages",
    features: [
      "Up to 3 pages",
      "6 AI agents pipeline",
      "Basic responsive design",
      "Standard animations",
      "HTML/CSS/JS output",
      "Download source code",
    ],
    highlight: false,
  },
  {
    id: "pro",
    name: "Professional",
    price: "Free",
    description: "For business websites & portfolios",
    features: [
      "Up to 10 pages",
      "6 AI agents pipeline",
      "Advanced responsive design",
      "Dark mode support",
      "Custom animations",
      "SEO optimized",
      "Contact forms",
      "Priority generation",
    ],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Free",
    description: "Full-featured web applications",
    features: [
      "Up to 50 pages",
      "6 AI agents pipeline",
      "Premium design system",
      "Advanced animations",
      "Full SEO suite",
      "Performance optimized",
      "Accessibility compliant",
      "Custom integrations",
      "Priority support",
      "Commercial license",
    ],
    highlight: false,
  },
];

const AI_MODELS = [
  // Free - High/Unlimited limits
  { name: "Gemini 2.0 Flash", provider: "Google", input: "Free", output: "Free", quality: "Excellent", speed: "Fast", free: true },
  { name: "Llama 3.3 70B", provider: "OpenRouter", input: "Free", output: "Free", quality: "Excellent", speed: "Fast", free: true },
  { name: "Qwen 3 235B", provider: "OpenRouter", input: "Free", output: "Free", quality: "Excellent", speed: "Fast", free: true },
  { name: "DeepSeek R1", provider: "OpenRouter", input: "Free", output: "Free", quality: "Excellent", speed: "Medium", free: true },
  { name: "Gemma 3 27B", provider: "OpenRouter", input: "Free", output: "Free", quality: "Good", speed: "Fast", free: true },
  { name: "Mistral Small 3.1", provider: "OpenRouter", input: "Free", output: "Free", quality: "Good", speed: "Fast", free: true },
  { name: "Command R+", provider: "Cohere", input: "Free", output: "Free", quality: "Excellent", speed: "Fast", free: true },
  { name: "Command R", provider: "Cohere", input: "Free", output: "Free", quality: "Good", speed: "Fast", free: true },
  { name: "Command A", provider: "Cohere", input: "Free", output: "Free", quality: "Excellent", speed: "Fast", free: true },
  { name: "Llama 3.3 70B", provider: "Cerebras", input: "Free", output: "Free", quality: "Excellent", speed: "Ultra Fast", free: true },
  { name: "Llama 4 Scout", provider: "Cerebras", input: "Free", output: "Free", quality: "Good", speed: "Ultra Fast", free: true },
  // Free - Rate limited
  { name: "Llama 3.3 70B", provider: "Groq", input: "Free", output: "Free", quality: "Excellent", speed: "Very Fast", free: true },
  { name: "Llama 3.1 8B", provider: "Groq", input: "Free", output: "Free", quality: "Good", speed: "Fastest", free: true },
  { name: "Gemma 2 9B", provider: "Groq", input: "Free", output: "Free", quality: "Good", speed: "Very Fast", free: true },
  // Paid
  { name: "Claude Sonnet 4.6", provider: "Anthropic", input: "$0.003", output: "$0.015", quality: "Excellent", speed: "Fast", free: false },
  { name: "Claude Haiku 4.5", provider: "Anthropic", input: "$0.001", output: "$0.005", quality: "Good", speed: "Fastest", free: false },
  { name: "GPT-4o", provider: "OpenAI", input: "$0.005", output: "$0.015", quality: "Excellent", speed: "Fast", free: false },
  { name: "GPT-4o Mini", provider: "OpenAI", input: "$0.00015", output: "$0.0006", quality: "Good", speed: "Fast", free: false },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold mb-3">
            Simple,{" "}
            <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
              Transparent
            </span>{" "}
            Pricing
          </h1>
          <p className="text-lg text-[var(--text-secondary)]">
            All plans are free. You only pay AI token costs via your own API key.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative p-6 rounded-2xl border transition-all ${
                plan.highlight
                  ? "bg-gradient-to-b from-brand-500/10 to-transparent border-brand-500/50 glow"
                  : "bg-[var(--bg-card)] border-[var(--border-color)] card-hover"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-600 text-white">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-green-400">{plan.price}</span>
                <span className="text-[var(--text-secondary)]"> / project</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[var(--text-secondary)]">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/new"
                className={`block text-center py-2.5 rounded-xl font-medium transition-all ${
                  plan.highlight
                    ? "bg-brand-600 hover:bg-brand-500 text-white"
                    : "bg-white/5 hover:bg-white/10 border border-[var(--border-color)]"
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>

        {/* AI Model Costs */}
        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
          <h2 className="text-xl font-bold mb-2">AI Model Token Costs</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            AI costs are charged separately based on the model you choose. Prices are per 1,000 tokens.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--text-secondary)]">Model</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--text-secondary)]">Provider</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--text-secondary)]">Input /1K</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--text-secondary)]">Output /1K</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--text-secondary)]">Quality</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--text-secondary)]">Speed</th>
                </tr>
              </thead>
              <tbody>
                {AI_MODELS.map((m) => (
                  <tr key={m.name} className={`border-b border-[var(--border-color)] hover:bg-white/5 ${m.free ? "" : "opacity-60"}`}>
                    <td className="py-3 px-4 font-medium">
                      {m.name}
                      {m.free && <span className="ml-2 text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">FREE</span>}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{m.provider}</td>
                    <td className="py-3 px-4 text-green-400">{m.input}</td>
                    <td className="py-3 px-4 text-brand-400">{m.output}</td>
                    <td className="py-3 px-4">{m.quality}</td>
                    <td className="py-3 px-4">{m.speed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-4">
            A typical website build uses ~30K-100K tokens across all 6 agents. Estimated cost: $0.10 - $2.00 depending on model.
          </p>
        </div>
      </main>
    </>
  );
}
