"""Unified AI client supporting Anthropic, OpenAI, Google, Groq, OpenRouter, Cohere, and Cerebras models."""

import asyncio
import logging
from config import settings

logger = logging.getLogger(__name__)

# Groq model IDs
GROQ_MODELS = {"llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"}

# Groq free tier token limit (per-minute, but a single request cannot exceed it either)
GROQ_MAX_INPUT_CHARS = 28000  # ~7000 tokens, leaves room for system prompt + output

# OpenRouter free model IDs (suffix :free)
OPENROUTER_MODELS = {
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen3-235b-a22b:free",
    "deepseek/deepseek-r1-0528:free",
    "google/gemma-3-27b-it:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
}

# Cohere model IDs
COHERE_MODELS = {"command-r", "command-r-plus", "command-a-03-2025"}

# Cerebras model IDs
CEREBRAS_MODELS = {"cerebras-llama-3.3-70b", "cerebras-llama-4-scout-17b"}


class AIClientError(Exception):
    """Raised when an AI API call fails."""
    pass


async def call_ai(prompt: str, system_prompt: str = "", model: str = None) -> dict:
    """Call the AI model and return response with token usage.

    Returns:
        dict with keys: response, input_tokens, output_tokens, total_tokens, cost

    Raises:
        AIClientError: If the API key is missing or the API call fails.
    """
    model = model or settings.DEFAULT_MODEL

    try:
        if model.startswith("claude"):
            return await _call_anthropic(prompt, system_prompt, model)
        elif model.startswith("gpt"):
            return await _call_openai(prompt, system_prompt, model)
        elif model.startswith("gemini"):
            return await _call_google(prompt, system_prompt, model)
        elif model in GROQ_MODELS:
            return await _call_groq(prompt, system_prompt, model)
        elif model in OPENROUTER_MODELS:
            return await _call_openrouter(prompt, system_prompt, model)
        elif model in COHERE_MODELS:
            return await _call_cohere(prompt, system_prompt, model)
        elif model in CEREBRAS_MODELS:
            return await _call_cerebras(prompt, system_prompt, model)
        else:
            raise AIClientError(
                f"Unsupported model: {model}. Supported: claude*, gpt*, gemini*, "
                f"Groq models, OpenRouter free models, Cohere models, Cerebras models"
            )
    except AIClientError:
        raise
    except Exception as e:
        logger.exception("AI API call failed for model %s", model)
        raise AIClientError(f"AI API call failed ({model}): {type(e).__name__}: {str(e)}") from e


async def _call_anthropic(prompt: str, system_prompt: str, model: str) -> dict:
    from anthropic import Anthropic, APIError, AuthenticationError

    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise AIClientError(
            "Anthropic API key not configured. "
            "Please add your API key in Settings > API Keys, or set the ANTHROPIC_API_KEY environment variable."
        )

    try:
        client = Anthropic(api_key=api_key)
        # Run synchronous SDK call in a thread pool to avoid blocking the event loop
        message = await asyncio.to_thread(
            client.messages.create,
            model=model,
            max_tokens=8192,
            system=system_prompt or "You are an expert web developer AI agent.",
            messages=[{"role": "user", "content": prompt}],
        )
    except AuthenticationError:
        raise AIClientError(
            "Anthropic API key is invalid. Please check your API key in Settings > API Keys."
        )
    except APIError as e:
        raise AIClientError(f"Anthropic API error: {e.message}") from e

    text = message.content[0].text
    input_tokens = message.usage.input_tokens
    output_tokens = message.usage.output_tokens

    pricing = settings.MODEL_PRICING.get(model, {"input": 0.003, "output": 0.015})
    cost = (input_tokens / 1000 * pricing["input"]) + (output_tokens / 1000 * pricing["output"])

    return {
        "response": text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost": round(cost, 6),
    }


async def _call_openai(prompt: str, system_prompt: str, model: str) -> dict:
    from openai import OpenAI, APIError, AuthenticationError

    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise AIClientError(
            "OpenAI API key not configured. "
            "Please add your API key in Settings > API Keys, or set the OPENAI_API_KEY environment variable."
        )

    try:
        client = OpenAI(api_key=api_key)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Run synchronous SDK call in a thread pool to avoid blocking the event loop
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=model,
            messages=messages,
            max_tokens=8192,
        )
    except AuthenticationError:
        raise AIClientError(
            "OpenAI API key is invalid. Please check your API key in Settings > API Keys."
        )
    except APIError as e:
        raise AIClientError(f"OpenAI API error: {e.message}") from e

    text = response.choices[0].message.content
    input_tokens = response.usage.prompt_tokens
    output_tokens = response.usage.completion_tokens

    pricing = settings.MODEL_PRICING.get(model, {"input": 0.005, "output": 0.015})
    cost = (input_tokens / 1000 * pricing["input"]) + (output_tokens / 1000 * pricing["output"])

    return {
        "response": text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost": round(cost, 6),
    }


async def _call_google(prompt: str, system_prompt: str, model: str) -> dict:
    import google.generativeai as genai

    api_key = settings.GOOGLE_API_KEY
    if not api_key:
        raise AIClientError(
            "Google API key not configured. "
            "Please add your API key in Settings > API Keys, or set the GOOGLE_API_KEY environment variable."
        )

    try:
        genai.configure(api_key=api_key)
        gen_model = genai.GenerativeModel(
            model_name=model,
            system_instruction=system_prompt or "You are an expert web developer AI agent.",
        )
        # Run synchronous SDK call in a thread pool to avoid blocking the event loop
        response = await asyncio.to_thread(gen_model.generate_content, prompt)
    except Exception as e:
        error_msg = str(e).lower()
        if "api key" in error_msg or "authentication" in error_msg or "permission" in error_msg:
            raise AIClientError(
                "Google API key is invalid. Please check your API key in Settings > API Keys."
            )
        raise AIClientError(f"Google AI API error: {str(e)}") from e

    text = response.text
    # Google API usage metadata
    input_tokens = 0
    output_tokens = 0
    if hasattr(response, "usage_metadata") and response.usage_metadata:
        input_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
        output_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0

    pricing = settings.MODEL_PRICING.get(model, {"input": 0.0001, "output": 0.0004})
    cost = (input_tokens / 1000 * pricing["input"]) + (output_tokens / 1000 * pricing["output"])

    return {
        "response": text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost": round(cost, 6),
    }


async def _call_groq(prompt: str, system_prompt: str, model: str) -> dict:
    from groq import Groq, APIError, AuthenticationError

    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise AIClientError(
            "Groq API key not configured. "
            "Please add your API key in Settings > API Keys, or set the GROQ_API_KEY environment variable. "
            "Get a free key at https://console.groq.com/keys"
        )

    # Truncate prompt if it exceeds Groq free-tier limits
    if len(prompt) > GROQ_MAX_INPUT_CHARS:
        logger.warning(
            "Groq prompt too long (%d chars), truncating to %d chars",
            len(prompt), GROQ_MAX_INPUT_CHARS,
        )
        prompt = prompt[:GROQ_MAX_INPUT_CHARS] + "\n\n[Content truncated to fit token limit. Work with what is provided above.]"

    client = Groq(api_key=api_key)
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=model,
                messages=messages,
                max_tokens=4096,
            )
            break
        except AuthenticationError:
            raise AIClientError(
                "Groq API key is invalid. Please check your API key in Settings > API Keys. "
                "Get a free key at https://console.groq.com/keys"
            )
        except APIError as e:
            if "rate_limit" in str(getattr(e, "code", "")) or "429" in str(e.status_code) or "413" in str(e.status_code):
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 15  # 15s, 30s, 45s
                    logger.warning(
                        "Groq rate limit hit (attempt %d/%d), waiting %ds before retry",
                        attempt + 1, max_retries, wait_time,
                    )
                    await asyncio.sleep(wait_time)
                    continue
            raise AIClientError(f"Groq API error: {e.message}") from e

    text = response.choices[0].message.content
    input_tokens = response.usage.prompt_tokens
    output_tokens = response.usage.completion_tokens

    # Groq is free
    return {
        "response": text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost": 0.0,
    }


async def _call_openrouter(prompt: str, system_prompt: str, model: str) -> dict:
    """Call OpenRouter API (OpenAI-compatible). Free models have no cost."""
    from openai import OpenAI, APIError, AuthenticationError

    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise AIClientError(
            "OpenRouter API key not configured. "
            "Please add your API key in Settings > API Keys, or set the OPENROUTER_API_KEY environment variable. "
            "Get a free key at https://openrouter.ai/keys"
        )

    try:
        client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=model,
            messages=messages,
            max_tokens=8192,
        )
    except AuthenticationError:
        raise AIClientError(
            "OpenRouter API key is invalid. Please check your API key in Settings > API Keys."
        )
    except APIError as e:
        raise AIClientError(f"OpenRouter API error: {e.message}") from e

    text = response.choices[0].message.content
    input_tokens = getattr(response.usage, "prompt_tokens", 0) or 0
    output_tokens = getattr(response.usage, "completion_tokens", 0) or 0

    return {
        "response": text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost": 0.0,
    }


async def _call_cohere(prompt: str, system_prompt: str, model: str) -> dict:
    """Call Cohere API. Free for trial use (20 calls/min)."""
    import cohere

    api_key = settings.COHERE_API_KEY
    if not api_key:
        raise AIClientError(
            "Cohere API key not configured. "
            "Please add your API key in Settings > API Keys, or set the COHERE_API_KEY environment variable. "
            "Get a free trial key at https://dashboard.cohere.com/api-keys"
        )

    try:
        client = cohere.ClientV2(api_key=api_key)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await asyncio.to_thread(
            client.chat,
            model=model,
            messages=messages,
            max_tokens=8192,
        )
    except Exception as e:
        error_msg = str(e).lower()
        if "api key" in error_msg or "unauthorized" in error_msg or "authentication" in error_msg:
            raise AIClientError(
                "Cohere API key is invalid. Please check your API key in Settings > API Keys."
            )
        raise AIClientError(f"Cohere API error: {str(e)}") from e

    text = response.message.content[0].text
    input_tokens = getattr(response.usage, "tokens", {}).get("input_tokens", 0) if hasattr(response.usage, "tokens") else 0
    output_tokens = getattr(response.usage, "tokens", {}).get("output_tokens", 0) if hasattr(response.usage, "tokens") else 0
    if hasattr(response.usage, "billed_units"):
        input_tokens = getattr(response.usage.billed_units, "input_tokens", 0) or 0
        output_tokens = getattr(response.usage.billed_units, "output_tokens", 0) or 0

    return {
        "response": text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost": 0.0,
    }


async def _call_cerebras(prompt: str, system_prompt: str, model: str) -> dict:
    """Call Cerebras API (OpenAI-compatible). Free tier with fast inference."""
    from openai import OpenAI, APIError, AuthenticationError

    api_key = settings.CEREBRAS_API_KEY
    if not api_key:
        raise AIClientError(
            "Cerebras API key not configured. "
            "Please add your API key in Settings > API Keys, or set the CEREBRAS_API_KEY environment variable. "
            "Get a free key at https://cloud.cerebras.ai"
        )

    # Map our model IDs to actual Cerebras model names
    cerebras_model_map = {
        "cerebras-llama-3.3-70b": "llama-3.3-70b",
        "cerebras-llama-4-scout-17b": "llama-4-scout-17b-16e-instruct",
    }
    actual_model = cerebras_model_map.get(model, model)

    try:
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.cerebras.ai/v1",
        )
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=actual_model,
            messages=messages,
            max_tokens=8192,
        )
    except AuthenticationError:
        raise AIClientError(
            "Cerebras API key is invalid. Please check your API key in Settings > API Keys."
        )
    except APIError as e:
        raise AIClientError(f"Cerebras API error: {e.message}") from e

    text = response.choices[0].message.content
    input_tokens = getattr(response.usage, "prompt_tokens", 0) or 0
    output_tokens = getattr(response.usage, "completion_tokens", 0) or 0

    return {
        "response": text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost": 0.0,
    }
