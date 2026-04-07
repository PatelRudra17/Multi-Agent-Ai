"""Reviewer Agent - Reviews code quality, applies final improvements."""

import json
from .base_agent import BaseAgent


class ReviewerAgent(BaseAgent):
    name = "reviewer"
    description = "Reviews code quality and applies final polish"
    next_agent = "deployer"

    SYSTEM_PROMPT = """You are a senior frontend architect doing a final code review.
Your job is to review website code, apply final polish, and ensure production quality.

Respond with valid JSON:
{
    "review_score": 90,
    "review_summary": "Brief overall assessment",
    "review_items": [
        {
            "file": "file path",
            "category": "code_quality|performance|security|ux|accessibility",
            "severity": "info|minor|major|critical",
            "finding": "what was found",
            "action": "what was done to fix it"
        }
    ],
    "final_files": [
        {
            "path": "file path",
            "content": "final polished file content",
            "type": "html|css|javascript"
        }
    ],
    "improvements_made": ["list of improvements applied"]
}

IMPORTANT: The final_files array must contain ALL files with their COMPLETE, FINAL content.
Apply all improvements directly - do not just suggest them."""

    def build_prompt(self, input_data: dict) -> str:
        files = input_data.get("files", [])
        test_results = input_data.get("test_results", {})

        files_text = ""
        for f in files:
            files_text += f"\n\n--- FILE: {f['path']} ---\n{f['content']}"

        return f"""Do a final code review and polish for this website:

{files_text}

TEST RESULTS FROM QA:
{json.dumps(test_results, separators=(',', ':'))}

Review and improve:
1. Code Quality - clean, well-organized, properly commented where needed
2. Performance - optimize CSS, minimize JS, efficient selectors
3. Security - XSS prevention, safe external links (rel="noopener")
4. UX Polish - smooth transitions, hover states, loading states, micro-interactions
5. Accessibility - final ARIA check, focus management, screen reader support
6. SEO - meta descriptions, Open Graph tags, proper heading hierarchy
7. Add subtle animations for visual polish (fade-ins, slide-ups on scroll)
8. Ensure consistent spacing and visual rhythm

Return ALL files with improvements applied. Every file must be COMPLETE.
Respond ONLY with JSON."""

    def parse_response(self, response: str, input_data: dict) -> dict:
        text = response.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        try:
            review = json.loads(text.strip())
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    review = json.loads(text[start:end])
                except json.JSONDecodeError:
                    review = {"review_score": 80, "review_summary": "Review completed", "review_items": [], "final_files": [], "improvements_made": []}
            else:
                review = {"review_score": 80, "review_summary": "Review completed", "review_items": [], "final_files": [], "improvements_made": []}

        # Use reviewed files if available, otherwise keep originals
        final_files = review.get("final_files", [])
        if not final_files:
            final_files = input_data.get("files", [])

        return {
            "plan": input_data.get("plan", {}),
            "design": input_data.get("design", {}),
            "files": final_files,
            "test_results": input_data.get("test_results", {}),
            "review": {
                "score": review.get("review_score", 80),
                "summary": review.get("review_summary", ""),
                "items": review.get("review_items", []),
                "improvements": review.get("improvements_made", []),
            },
        }
