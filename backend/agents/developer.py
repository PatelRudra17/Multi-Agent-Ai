"""Developer Agent - Generates actual website code from plan and design specs."""

import json
import os
import re
from .base_agent import BaseAgent


class DeveloperAgent(BaseAgent):
    name = "developer"
    description = "Generates complete website code from plan and design"
    next_agent = "tester"

    SYSTEM_PROMPT = """You are an expert frontend developer. You build complete, production-ready websites.
Your job is to take a project plan and design specification and generate ALL the code files needed.

IMPORTANT RULES:
- Generate complete, working HTML/CSS/JS code
- Use modern CSS (flexbox, grid, custom properties)
- Make everything fully responsive
- Include smooth animations and transitions
- Use semantic HTML5
- Include meta tags for SEO
- Add proper accessibility attributes

Respond with valid JSON containing all files:
{
    "files": [
        {
            "path": "index.html",
            "content": "<!DOCTYPE html>...",
            "type": "html"
        },
        {
            "path": "styles/main.css",
            "content": "...",
            "type": "css"
        },
        {
            "path": "js/main.js",
            "content": "...",
            "type": "javascript"
        }
    ]
}

Generate COMPLETE file contents - no placeholders, no TODOs, no "add your content here".
Every file must be production-ready."""

    def build_prompt(self, input_data: dict) -> str:
        plan = input_data.get("plan", {})
        design = input_data.get("design", {})

        return f"""Build a complete website based on this plan and design:

PROJECT PLAN:
{json.dumps(plan, separators=(',', ':'))}

DESIGN SPECIFICATION:
{json.dumps(design, separators=(',', ':'))}

Generate ALL files needed for a complete, working website:
1. HTML files for each page (with full content, not Lorem Ipsum - use realistic content)
2. CSS files with the complete design system, responsive styles, and animations
3. JavaScript files for interactivity (mobile menu, smooth scroll, form validation, animations)

Requirements:
- Use Tailwind CSS via CDN for utility classes AND custom CSS for complex styles
- Include Google Fonts links matching the typography spec
- Add smooth scroll behavior
- Include intersection observer for scroll animations
- Mobile-first responsive design
- Dark mode toggle support
- Working navigation between pages
- Professional, realistic content

Respond ONLY with the JSON containing all files."""

    def parse_response(self, response: str, input_data: dict) -> dict:
        text = response.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        try:
            result = json.loads(text.strip())
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    result = json.loads(text[start:end])
                except json.JSONDecodeError:
                    result = self._extract_files_from_text(text)
            else:
                result = self._extract_files_from_text(text)

        files = result.get("files", [])
        if not files:
            files = [{"path": "index.html", "content": response, "type": "html"}]

        return {
            "plan": input_data.get("plan", {}),
            "design": input_data.get("design", {}),
            "files": files,
        }

    def _extract_files_from_text(self, text: str) -> dict:
        """Fallback: extract code blocks from unstructured AI response."""
        files = []
        # Look for code blocks with filenames
        pattern = r'(?:#+\s*|`?)(\S+\.(?:html|css|js))`?\s*\n```(?:\w+)?\n(.*?)```'
        matches = re.findall(pattern, text, re.DOTALL)
        for filename, content in matches:
            ext = filename.rsplit(".", 1)[-1]
            type_map = {"html": "html", "css": "css", "js": "javascript"}
            files.append({
                "path": filename,
                "content": content.strip(),
                "type": type_map.get(ext, "text"),
            })

        if not files:
            files = [{"path": "index.html", "content": text, "type": "html"}]

        return {"files": files}
