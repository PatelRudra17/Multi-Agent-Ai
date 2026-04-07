"""Pipeline Orchestrator - Automatically runs agents in sequence and transfers work."""

import asyncio
import logging
import traceback
from datetime import datetime
from typing import Callable

from agents import AGENT_PIPELINE, AGENTS_MAP
from database.db import update_project, get_project, create_payment
from config import settings

logger = logging.getLogger(__name__)

# Store active project callbacks for real-time updates
_callbacks: dict[str, list[Callable]] = {}


def register_callback(project_id: str, callback: Callable):
    if project_id not in _callbacks:
        _callbacks[project_id] = []
    _callbacks[project_id].append(callback)


def unregister_callback(project_id: str, callback: Callable):
    if project_id in _callbacks:
        try:
            _callbacks[project_id].remove(callback)
        except ValueError:
            pass
        if not _callbacks[project_id]:
            del _callbacks[project_id]


async def _notify(project_id: str, event: dict):
    """Send real-time updates to connected clients."""
    callbacks = list(_callbacks.get(project_id, []))
    for cb in callbacks:
        try:
            await cb(event)
        except Exception:
            # Client disconnected or send failed; remove the dead callback
            try:
                unregister_callback(project_id, cb)
            except Exception:
                pass


async def run_pipeline(project_id: str, initial_input: dict, model: str = None):
    """Run the full agent pipeline for a project.

    Each agent's output automatically becomes the next agent's input.
    Handles failures gracefully and always updates the project status.
    """
    current_input = initial_input
    total_cost = 0.0
    total_tokens = 0

    try:
        update_project(project_id, status="building")

        await _notify(project_id, {
            "type": "pipeline_start",
            "project_id": project_id,
            "agents": [a.name for a in AGENT_PIPELINE],
            "timestamp": datetime.utcnow().isoformat(),
        })

        for agent in AGENT_PIPELINE:
            await _notify(project_id, {
                "type": "agent_start",
                "agent": agent.name,
                "description": agent.description,
                "timestamp": datetime.utcnow().isoformat(),
            })

            try:
                output = await agent.run(project_id, current_input, model)

                # Track costs
                ai_meta = output.pop("_ai_meta", {})
                agent_cost = ai_meta.get("cost", 0)
                agent_tokens = ai_meta.get("tokens", 0)
                total_cost += agent_cost
                total_tokens += agent_tokens

                await _notify(project_id, {
                    "type": "agent_complete",
                    "agent": agent.name,
                    "next_agent": agent.next_agent,
                    "tokens": agent_tokens,
                    "cost": agent_cost,
                    "timestamp": datetime.utcnow().isoformat(),
                })

                # Transfer output as next agent's input
                current_input = output

            except Exception as e:
                error_detail = f"{type(e).__name__}: {str(e)}"
                logger.error("Agent '%s' failed for project '%s': %s", agent.name, project_id, error_detail)

                await _notify(project_id, {
                    "type": "agent_error",
                    "agent": agent.name,
                    "error": error_detail,
                    "timestamp": datetime.utcnow().isoformat(),
                })

                update_project(project_id, status="failed", current_agent=agent.name)

                await _notify(project_id, {
                    "type": "pipeline_failed",
                    "project_id": project_id,
                    "failed_agent": agent.name,
                    "error": error_detail,
                    "total_cost": round(total_cost, 4),
                    "total_tokens": total_tokens,
                    "timestamp": datetime.utcnow().isoformat(),
                })
                # Do NOT re-raise: this is a background task, raising would create
                # an unhandled exception. The failure is recorded in the DB and sent
                # to the client via WebSocket.
                return {
                    "status": "failed",
                    "failed_agent": agent.name,
                    "error": error_detail,
                    "total_cost": total_cost,
                    "total_tokens": total_tokens,
                }

        # Pipeline complete
        output_path = current_input.get("output_path", "")
        update_project(
            project_id,
            status="completed",
            current_agent="done",
            total_cost=total_cost,
            output_path=output_path,
        )

        # Record payment
        project = get_project(project_id)
        plan_tier = project.get("plan", "starter") if project else "starter"
        platform_fee = settings.PLATFORM_FEES.get(plan_tier, {}).get("price", 5.0)
        total_amount = total_cost + platform_fee
        create_payment(project_id, total_amount, plan_tier, total_cost, platform_fee)

        await _notify(project_id, {
            "type": "pipeline_complete",
            "project_id": project_id,
            "total_cost": round(total_cost, 4),
            "platform_fee": platform_fee,
            "total_tokens": total_tokens,
            "output_path": output_path,
            "timestamp": datetime.utcnow().isoformat(),
        })

        return {
            "status": "completed",
            "total_cost": total_cost,
            "platform_fee": platform_fee,
            "total_tokens": total_tokens,
            "output_path": output_path,
            "result": current_input,
        }

    except Exception as e:
        # Catch-all for unexpected errors (DB failures, etc.)
        error_detail = f"{type(e).__name__}: {str(e)}"
        logger.exception("Unexpected pipeline error for project '%s'", project_id)

        try:
            update_project(project_id, status="failed")
        except Exception:
            pass

        try:
            await _notify(project_id, {
                "type": "pipeline_failed",
                "project_id": project_id,
                "error": error_detail,
                "timestamp": datetime.utcnow().isoformat(),
            })
        except Exception:
            pass

        return {
            "status": "failed",
            "error": error_detail,
            "total_cost": total_cost,
            "total_tokens": total_tokens,
        }
