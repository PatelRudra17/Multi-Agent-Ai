"""Multi-Agent AI Website Builder - Backend Server."""

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import settings
from database.db import (
    create_project, get_project, get_all_projects, update_project,
    get_agent_logs, save_api_key, get_api_keys, delete_api_key, delete_project, get_db,
)
from services.orchestrator import run_pipeline, register_callback, unregister_callback
from agents import AGENT_PIPELINE

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
    # Load API keys from database into in-memory settings so they are
    # immediately available when the server starts.
    settings.load_api_keys_from_db()
    logger.info("Server started. Output dir: %s", os.path.abspath(settings.OUTPUT_DIR))
    yield
    logger.info("Server shutting down.")

app = FastAPI(
    title="Multi-Agent AI Website Builder",
    description="Build websites automatically using 6 specialized AI agents",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: allow_credentials=True with allow_origins=["*"] is rejected by browsers.
# Use the configured FRONTEND_URL for credentialed requests, plus common dev origins.
_allowed_origins = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Models ──────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: str
    plan: str = "starter"  # starter | pro | enterprise
    model: str = "claude-sonnet-4-6"


class ApiKeyUpdate(BaseModel):
    provider: str  # anthropic | openai | google
    api_key: str


# ── Project Endpoints ────────────────────────────────────────────

@app.post("/api/projects")
async def create_new_project(data: ProjectCreate):
    """Create a new project and start the agent pipeline."""
    # Validate that the required API key is available for the chosen model
    api_key = settings.get_api_key_for_model(data.model)
    if not api_key:
        provider = "unknown"
        if data.model.startswith("claude"):
            provider = "Anthropic"
        elif data.model.startswith("gpt"):
            provider = "OpenAI"
        elif data.model.startswith("gemini"):
            provider = "Google"
        elif data.model in ("llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"):
            provider = "Groq"
        raise HTTPException(
            400,
            f"No API key configured for {provider}. "
            f"Please add your {provider} API key in Settings before starting a build."
        )

    project_id = str(uuid.uuid4())[:8]

    create_project(project_id, data.name, data.description, data.plan, data.model)

    # Start pipeline in background
    initial_input = {
        "name": data.name,
        "description": data.description,
        "plan": data.plan,
    }

    asyncio.create_task(run_pipeline(project_id, initial_input, data.model))

    return {
        "project_id": project_id,
        "status": "started",
        "message": f"Pipeline started with {len(AGENT_PIPELINE)} agents",
    }


@app.get("/api/projects")
async def list_projects():
    """List all projects."""
    return get_all_projects()


@app.get("/api/projects/{project_id}")
async def get_project_details(project_id: str):
    """Get project details with agent logs."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    logs = get_agent_logs(project_id)
    return {**project, "agent_logs": logs}


@app.delete("/api/projects/{project_id}")
async def delete_project_endpoint(project_id: str):
    """Delete a project."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    delete_project(project_id)

    # Also clean up output files
    import os
    import shutil
    output_dir = os.path.join(settings.OUTPUT_DIR, project_id)
    if os.path.exists(output_dir):
        try:
            shutil.rmtree(output_dir)
        except OSError as e:
            logger.warning("Could not remove output dir %s: %s", output_dir, str(e))

    return {"status": "deleted"}


# ── Real-time WebSocket ──────────────────────────────────────────

@app.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    """WebSocket for real-time agent pipeline updates."""
    await websocket.accept()

    async def send_update(event: dict):
        try:
            await websocket.send_json(event)
        except Exception as e:
            logger.debug("WebSocket send failed for project %s: %s", project_id, e)

    register_callback(project_id, send_update)
    try:
        while True:
            # Keep connection alive. We receive pings/messages from the client.
            data = await websocket.receive_text()
            # Optionally handle client messages (e.g. ping/pong)
            if data == "ping":
                try:
                    await websocket.send_json({"type": "pong"})
                except Exception:
                    break
    except WebSocketDisconnect:
        logger.debug("WebSocket disconnected for project %s", project_id)
    except Exception as e:
        logger.debug("WebSocket error for project %s: %s", project_id, e)
    finally:
        unregister_callback(project_id, send_update)


# ── Settings / API Keys ─────────────────────────────────────────

@app.get("/api/settings/models")
async def get_available_models():
    """Get available AI models and pricing."""
    return {
        "models": settings.MODEL_PRICING,
        "default": settings.DEFAULT_MODEL,
    }


@app.get("/api/settings/plans")
async def get_pricing_plans():
    """Get available pricing plans."""
    return settings.PLATFORM_FEES


@app.post("/api/settings/api-keys")
async def update_api_key(data: ApiKeyUpdate):
    """Save or update an API key."""
    # Validate provider
    valid_providers = {"anthropic", "openai", "google", "groq", "openrouter", "cohere", "cerebras"}
    if data.provider not in valid_providers:
        raise HTTPException(400, f"Invalid provider. Must be one of: {', '.join(valid_providers)}")

    if not data.api_key or not data.api_key.strip():
        raise HTTPException(400, "API key cannot be empty")

    api_key = data.api_key.strip()

    # Save to database for persistence across restarts
    save_api_key(data.provider, api_key)

    # Update in-memory settings so the key is immediately usable
    key_map = {
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "google": "GOOGLE_API_KEY",
        "groq": "GROQ_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
        "cohere": "COHERE_API_KEY",
        "cerebras": "CEREBRAS_API_KEY",
    }
    attr = key_map.get(data.provider)
    if attr:
        setattr(settings, attr, api_key)

    logger.info("API key updated for provider: %s", data.provider)
    return {"status": "saved", "provider": data.provider}


@app.delete("/api/settings/api-keys/{provider}")
async def delete_api_key_endpoint(provider: str):
    """Delete an API key."""
    valid_providers = {"anthropic", "openai", "google", "groq", "openrouter", "cohere", "cerebras"}
    if provider not in valid_providers:
        raise HTTPException(400, f"Invalid provider. Must be one of: {', '.join(valid_providers)}")

    delete_api_key(provider)

    # Clear from in-memory settings
    key_map = {
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "google": "GOOGLE_API_KEY",
        "groq": "GROQ_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
        "cohere": "COHERE_API_KEY",
        "cerebras": "CEREBRAS_API_KEY",
    }
    attr = key_map.get(provider)
    if attr:
        setattr(settings, attr, "")

    logger.info("API key deleted for provider: %s", provider)
    return {"status": "deleted", "provider": provider}


@app.get("/api/settings/api-keys")
async def list_api_keys():
    """List configured API key providers (keys are masked)."""
    keys = get_api_keys()
    masked = {}
    for provider, key in keys.items():
        if key and len(key) > 8:
            masked[provider] = key[:4] + "..." + key[-4:]
        elif key:
            masked[provider] = "****"
    # Also check in-memory settings (env vars)
    for provider, attr in [("anthropic", "ANTHROPIC_API_KEY"), ("openai", "OPENAI_API_KEY"), ("google", "GOOGLE_API_KEY"), ("groq", "GROQ_API_KEY")]:
        val = getattr(settings, attr, "")
        if val and provider not in masked:
            if len(val) > 8:
                masked[provider] = val[:4] + "..." + val[-4:]
            else:
                masked[provider] = "****"
    return masked


# ── Agent Info ───────────────────────────────────────────────────

@app.get("/api/agents")
async def get_agents():
    """Get info about all pipeline agents."""
    return [
        {
            "name": a.name,
            "description": a.description,
            "next_agent": a.next_agent,
            "order": i + 1,
        }
        for i, a in enumerate(AGENT_PIPELINE)
    ]


# ── Output Files ─────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/files")
async def get_project_files(project_id: str):
    """Get the generated file list for a project."""
    import os
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    output_dir = os.path.join(settings.OUTPUT_DIR, project_id)
    if not os.path.exists(output_dir):
        return []

    files = []
    for root, dirs, filenames in os.walk(output_dir):
        for fname in filenames:
            full_path = os.path.join(root, fname)
            rel_path = os.path.relpath(full_path, output_dir).replace("\\", "/")
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                files.append({"path": rel_path, "content": content, "size": len(content)})
            except OSError:
                files.append({"path": rel_path, "content": "", "size": 0, "error": "Could not read file"})

    return files


# ── Health ───────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "agents": len(AGENT_PIPELINE),
        "has_anthropic_key": bool(settings.ANTHROPIC_API_KEY),
        "has_openai_key": bool(settings.OPENAI_API_KEY),
        "has_google_key": bool(settings.GOOGLE_API_KEY),
        "has_groq_key": bool(settings.GROQ_API_KEY),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.BACKEND_PORT)
