import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self):
        self.ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
        self.OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
        self.GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
        self.GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
        self.OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
        self.COHERE_API_KEY: str = os.getenv("COHERE_API_KEY", "")
        self.CEREBRAS_API_KEY: str = os.getenv("CEREBRAS_API_KEY", "")
        self.DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "gemini-2.0-flash")
        self.STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
        self.STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
        self.BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
        self.FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
        self.OUTPUT_DIR: str = os.getenv("OUTPUT_DIR", "./output")

    # AI Model pricing per 1K tokens (input/output)
    MODEL_PRICING = {
        # === FREE MODELS (No cost, high/unlimited limits) ===
        # Google Gemini - Free: 15 RPM, 1,000,000 TPM (best free option)
        "gemini-2.0-flash": {"input": 0.0, "output": 0.0, "name": "Gemini 2.0 Flash (Google)", "free": True},
        # OpenRouter - Free models (no rate limit on free tier)
        "meta-llama/llama-3.3-70b-instruct:free": {"input": 0.0, "output": 0.0, "name": "Llama 3.3 70B (OpenRouter)", "free": True},
        "qwen/qwen3-235b-a22b:free": {"input": 0.0, "output": 0.0, "name": "Qwen 3 235B (OpenRouter)", "free": True},
        "deepseek/deepseek-r1-0528:free": {"input": 0.0, "output": 0.0, "name": "DeepSeek R1 (OpenRouter)", "free": True},
        "google/gemma-3-27b-it:free": {"input": 0.0, "output": 0.0, "name": "Gemma 3 27B (OpenRouter)", "free": True},
        "mistralai/mistral-small-3.1-24b-instruct:free": {"input": 0.0, "output": 0.0, "name": "Mistral Small 3.1 (OpenRouter)", "free": True},
        # Cohere - Free trial key (20 calls/min)
        "command-r": {"input": 0.0, "output": 0.0, "name": "Command R (Cohere)", "free": True},
        "command-r-plus": {"input": 0.0, "output": 0.0, "name": "Command R+ (Cohere)", "free": True},
        "command-a-03-2025": {"input": 0.0, "output": 0.0, "name": "Command A (Cohere)", "free": True},
        # Cerebras - Free tier (ultra-fast inference)
        "cerebras-llama-3.3-70b": {"input": 0.0, "output": 0.0, "name": "Llama 3.3 70B (Cerebras)", "free": True},
        "cerebras-llama-4-scout-17b": {"input": 0.0, "output": 0.0, "name": "Llama 4 Scout (Cerebras)", "free": True},
        # Groq - Free but strict rate limits (12K TPM)
        "llama-3.3-70b-versatile": {"input": 0.0, "output": 0.0, "name": "Llama 3.3 70B (Groq)", "free": True},
        "llama-3.1-8b-instant": {"input": 0.0, "output": 0.0, "name": "Llama 3.1 8B (Groq)", "free": True},
        "gemma2-9b-it": {"input": 0.0, "output": 0.0, "name": "Gemma 2 9B (Groq)", "free": True},
        # === PAID MODELS ===
        "claude-sonnet-4-6": {"input": 0.003, "output": 0.015, "name": "Claude Sonnet 4.6", "free": False},
        "claude-haiku-4-5": {"input": 0.001, "output": 0.005, "name": "Claude Haiku 4.5", "free": False},
        "gpt-4o": {"input": 0.005, "output": 0.015, "name": "GPT-4o", "free": False},
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006, "name": "GPT-4o Mini", "free": False},
    }

    # Platform fee per project (USD) - set to 0 (free) since payment is not integrated
    PLATFORM_FEES = {
        "starter": {"price": 0.00, "max_pages": 3, "name": "Starter"},
        "pro": {"price": 0.00, "max_pages": 10, "name": "Professional"},
        "enterprise": {"price": 0.00, "max_pages": 50, "name": "Enterprise"},
    }

    def load_api_keys_from_db(self):
        """Load API keys from database into memory (called at startup)."""
        try:
            from database.db import get_api_keys
            db_keys = get_api_keys()
            provider_attr_map = {
                "anthropic": "ANTHROPIC_API_KEY",
                "openai": "OPENAI_API_KEY",
                "google": "GOOGLE_API_KEY",
                "groq": "GROQ_API_KEY",
                "openrouter": "OPENROUTER_API_KEY",
                "cohere": "COHERE_API_KEY",
                "cerebras": "CEREBRAS_API_KEY",
            }
            for provider, key in db_keys.items():
                attr = provider_attr_map.get(provider)
                if attr and key:
                    # Only override if no env var is set (env vars take priority)
                    current = getattr(self, attr, "")
                    if not current:
                        setattr(self, attr, key)
        except Exception:
            # DB may not be initialized yet; ignore
            pass

    def get_api_key_for_model(self, model: str) -> str:
        """Get the appropriate API key for a given model name."""
        if model.startswith("claude"):
            return self.ANTHROPIC_API_KEY
        elif model.startswith("gpt"):
            return self.OPENAI_API_KEY
        elif model.startswith("gemini"):
            return self.GOOGLE_API_KEY
        elif model in ("llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"):
            return self.GROQ_API_KEY
        elif ":free" in model:
            return self.OPENROUTER_API_KEY
        elif model.startswith("command-"):
            return self.COHERE_API_KEY
        elif model.startswith("cerebras-"):
            return self.CEREBRAS_API_KEY
        return ""


settings = Settings()
