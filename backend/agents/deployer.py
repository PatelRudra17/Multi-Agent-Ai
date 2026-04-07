"""Deployer Agent - Writes final files to disk and prepares for deployment."""

import json
import logging
import os
from datetime import datetime
from .base_agent import BaseAgent
from config import settings

logger = logging.getLogger(__name__)


class DeployerAgent(BaseAgent):
    name = "deployer"
    description = "Deploys the final website files"
    next_agent = None  # Last agent in pipeline

    SYSTEM_PROMPT = """You are a deployment engineer. Prepare the final deployment package.

Respond with valid JSON:
{
    "deployment_ready": true,
    "deployment_notes": "Any important notes about the deployment",
    "file_manifest": [
        {"path": "file path", "size": "file size estimate", "type": "file type"}
    ],
    "post_deploy_checklist": [
        "List of things to verify after deployment"
    ]
}"""

    def build_prompt(self, input_data: dict) -> str:
        files = input_data.get("files", [])
        review = input_data.get("review", {})

        manifest = []
        for f in files:
            manifest.append(f"- {f['path']} ({f.get('type', 'unknown')}): {len(f.get('content', ''))} chars")

        return f"""Prepare deployment for this website.

FILES TO DEPLOY:
{chr(10).join(manifest)}

REVIEW SCORE: {review.get('score', 'N/A')}/100
REVIEW SUMMARY: {review.get('summary', 'N/A')}

Create a deployment manifest and checklist.
Respond ONLY with JSON."""

    def parse_response(self, response: str, input_data: dict) -> dict:
        text = response.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        deploy_info = None
        try:
            deploy_info = json.loads(text.strip())
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    deploy_info = json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass

        if deploy_info is None:
            deploy_info = {
                "deployment_ready": True,
                "deployment_notes": "",
                "file_manifest": [],
                "post_deploy_checklist": [],
            }

        return {
            "plan": input_data.get("plan", {}),
            "design": input_data.get("design", {}),
            "files": input_data.get("files", []),
            "test_results": input_data.get("test_results", {}),
            "review": input_data.get("review", {}),
            "deployment": deploy_info,
        }

    async def run(self, project_id: str, input_data: dict, model: str = None) -> dict:
        """Override run to also write files to disk."""
        result = await super().run(project_id, input_data, model)

        # Write files to output directory
        output_dir = os.path.join(settings.OUTPUT_DIR, project_id)
        os.makedirs(output_dir, exist_ok=True)

        files = result.get("files", [])
        written_count = 0
        for f in files:
            file_path = os.path.normpath(os.path.join(output_dir, f.get("path", "untitled.html")))

            # Security check: ensure file stays within the output directory
            if not file_path.startswith(os.path.normpath(output_dir)):
                logger.warning("Skipping file with path traversal attempt: %s", f.get("path"))
                continue

            # Create parent directories (handles nested paths like styles/main.css)
            parent_dir = os.path.dirname(file_path)
            if parent_dir:
                os.makedirs(parent_dir, exist_ok=True)

            content = f.get("content", "")
            try:
                with open(file_path, "w", encoding="utf-8") as fp:
                    fp.write(content)
                written_count += 1
            except OSError as e:
                logger.error("Failed to write file %s: %s", file_path, str(e))

        logger.info("Deployed %d files to %s", written_count, output_dir)
        result["output_path"] = output_dir
        return result
