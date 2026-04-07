"""Planner Agent - Analyzes requirements and creates a structured project plan."""

import json
from .base_agent import BaseAgent


class PlannerAgent(BaseAgent):
    name = "planner"
    description = "Analyzes requirements and creates a structured website plan"
    next_agent = "designer"

    SYSTEM_PROMPT = """You are an expert project planner for web development.
Your job is to analyze user requirements and create a detailed, structured plan for building a website.

ALWAYS respond with valid JSON in this exact format:
{
    "project_name": "...",
    "summary": "Brief project summary",
    "pages": [
        {
            "name": "page name",
            "route": "/route",
            "description": "what this page does",
            "sections": ["list of sections on this page"],
            "features": ["interactive features needed"]
        }
    ],
    "tech_stack": {
        "framework": "HTML/CSS/JS or React or Next.js",
        "styling": "Tailwind CSS or custom CSS",
        "additional": ["any additional libraries"]
    },
    "color_scheme": {
        "primary": "#hex",
        "secondary": "#hex",
        "accent": "#hex",
        "background": "#hex",
        "text": "#hex"
    },
    "typography": {
        "heading_font": "font name",
        "body_font": "font name"
    },
    "requirements": ["list of functional requirements"],
    "estimated_complexity": "simple | medium | complex"
}"""

    def build_prompt(self, input_data: dict) -> str:
        name = input_data.get("name", "Website")
        description = input_data.get("description", "A modern website")
        plan_tier = input_data.get("plan", "starter")
        max_pages = {"starter": 3, "pro": 10, "enterprise": 50}.get(plan_tier, 3)

        return f"""Create a detailed project plan for the following website:

Project Name: {name}
Description: {description}
Plan Tier: {plan_tier} (max {max_pages} pages)

Analyze the requirements and create a comprehensive plan with pages, tech stack,
color scheme, typography, and all functional requirements. Keep it practical and
buildable. Use modern design principles.

Respond ONLY with the JSON plan, no other text."""

    def parse_response(self, response: str, input_data: dict) -> dict:
        # Extract JSON from response
        text = response.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        plan = None
        try:
            plan = json.loads(text.strip())
        except json.JSONDecodeError:
            # Try to find JSON in the response
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    plan = json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass

        if plan is None:
            plan = {
                    "project_name": input_data.get("name", "Website"),
                    "summary": response[:200],
                    "pages": [{"name": "Home", "route": "/", "description": "Main landing page", "sections": ["Hero", "Features", "Footer"], "features": []}],
                    "tech_stack": {"framework": "HTML/CSS/JS", "styling": "Tailwind CSS", "additional": []},
                    "color_scheme": {"primary": "#3B82F6", "secondary": "#1E40AF", "accent": "#F59E0B", "background": "#FFFFFF", "text": "#111827"},
                    "typography": {"heading_font": "Inter", "body_font": "Inter"},
                    "requirements": [input_data.get("description", "")],
                    "estimated_complexity": "simple",
                }

        return {"plan": plan}
