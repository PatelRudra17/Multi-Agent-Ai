"""Designer Agent - Creates detailed UI/UX design specifications from the plan."""

import json
from .base_agent import BaseAgent


class DesignerAgent(BaseAgent):
    name = "designer"
    description = "Creates detailed UI/UX design specifications"
    next_agent = "developer"

    SYSTEM_PROMPT = """You are an expert UI/UX designer specializing in modern web design.
Your job is to take a project plan and create detailed design specifications for each page.

ALWAYS respond with valid JSON in this exact format:
{
    "design_system": {
        "colors": {"primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "surface": "#hex", "text": "#hex", "text_secondary": "#hex"},
        "spacing": {"xs": "0.25rem", "sm": "0.5rem", "md": "1rem", "lg": "2rem", "xl": "4rem"},
        "border_radius": "0.5rem",
        "shadows": {"sm": "...", "md": "...", "lg": "..."}
    },
    "pages": [
        {
            "name": "page name",
            "route": "/route",
            "layout": "description of overall layout",
            "sections": [
                {
                    "name": "section name",
                    "type": "hero|features|cta|content|gallery|testimonials|footer|navbar|pricing|contact|faq",
                    "layout": "detailed layout description",
                    "components": ["list of UI components needed"],
                    "content_hints": {"heading": "suggested heading", "subheading": "suggested subtext"},
                    "responsive_notes": "how it adapts on mobile"
                }
            ]
        }
    ],
    "global_components": [
        {"name": "Navbar", "description": "...", "variant": "fixed|sticky|static"},
        {"name": "Footer", "description": "...", "columns": 3}
    ],
    "animations": ["list of animations/transitions to use"],
    "accessibility_notes": ["WCAG compliance notes"]
}"""

    def build_prompt(self, input_data: dict) -> str:
        plan = input_data.get("plan", {})
        return f"""Based on this project plan, create detailed UI/UX design specifications:

PROJECT PLAN:
{json.dumps(plan, separators=(',', ':'))}

Create a comprehensive design system with:
1. Color palette with proper contrast ratios
2. Detailed layout for each page and section
3. Component specifications
4. Responsive design notes
5. Animation/transition suggestions
6. Accessibility guidelines

Make the design modern, clean, and professional. Use current design trends.
Respond ONLY with the JSON design spec, no other text."""

    def parse_response(self, response: str, input_data: dict) -> dict:
        text = response.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        design = None
        try:
            design = json.loads(text.strip())
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    design = json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass

        if design is None:
            plan = input_data.get("plan", {})
            colors = plan.get("color_scheme", {})
            design = {
                "design_system": {
                    "colors": colors or {"primary": "#3B82F6", "secondary": "#1E40AF", "accent": "#F59E0B", "background": "#FFFFFF", "surface": "#F9FAFB", "text": "#111827", "text_secondary": "#6B7280"},
                    "spacing": {"xs": "0.25rem", "sm": "0.5rem", "md": "1rem", "lg": "2rem", "xl": "4rem"},
                    "border_radius": "0.5rem",
                    "shadows": {"sm": "0 1px 2px rgba(0,0,0,0.05)", "md": "0 4px 6px rgba(0,0,0,0.1)", "lg": "0 10px 15px rgba(0,0,0,0.1)"},
                },
                "pages": [],
                "global_components": [],
                "animations": ["fade-in", "slide-up"],
                "accessibility_notes": ["Use semantic HTML", "Ensure color contrast ratio >= 4.5:1"],
            }

        return {"plan": input_data.get("plan", {}), "design": design}
