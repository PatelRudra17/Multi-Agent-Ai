"""Base agent class that all agents inherit from."""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from database.db import log_agent, update_project
from services.ai_client import call_ai, AIClientError

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for all pipeline agents."""

    name: str = "base"
    description: str = "Base agent"
    next_agent: str = None  # Name of the next agent in pipeline

    SYSTEM_PROMPT: str = "You are an expert web development AI agent."

    async def run(self, project_id: str, input_data: dict, model: str = None) -> dict:
        """Execute the agent's task and return output."""
        # Log start
        log_agent(project_id, self.name, "running", input_data=input_data)
        update_project(project_id, current_agent=self.name, status="building")

        try:
            prompt = self.build_prompt(input_data)
            ai_result = await call_ai(prompt, self.SYSTEM_PROMPT, model)

            try:
                output = self.parse_response(ai_result["response"], input_data)
            except Exception as parse_err:
                logger.warning(
                    "Agent '%s' failed to parse AI response, using fallback: %s",
                    self.name, str(parse_err),
                )
                # Provide a graceful fallback - pass the raw response along
                # with whatever input data we have so the pipeline can continue
                output = self._fallback_output(ai_result["response"], input_data)

            output["_ai_meta"] = {
                "tokens": ai_result["total_tokens"],
                "cost": ai_result["cost"],
            }

            log_agent(
                project_id, self.name, "completed",
                input_data=input_data,
                output_data=output,
                tokens_used=ai_result["total_tokens"],
                cost=ai_result["cost"],
            )
            return output

        except AIClientError as e:
            # Clear error from the AI client (missing key, auth failure, etc.)
            log_agent(project_id, self.name, "failed", input_data=input_data, error=str(e))
            raise
        except Exception as e:
            log_agent(project_id, self.name, "failed", input_data=input_data, error=str(e))
            raise

    def _fallback_output(self, raw_response: str, input_data: dict) -> dict:
        """Produce a minimal valid output when parse_response fails.

        Subclasses can override this for agent-specific fallback logic.
        """
        # Carry forward all input data keys so downstream agents get what they need
        output = {}
        for key in ("plan", "design", "files", "test_results", "review"):
            if key in input_data:
                output[key] = input_data[key]
        output["_raw_response"] = raw_response[:2000]
        return output

    @abstractmethod
    def build_prompt(self, input_data: dict) -> str:
        """Build the prompt to send to the AI model."""
        pass

    @abstractmethod
    def parse_response(self, response: str, input_data: dict) -> dict:
        """Parse the AI response into structured output."""
        pass
