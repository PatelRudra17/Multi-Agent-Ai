"""Tester Agent - Validates generated code for errors, accessibility, and best practices."""

import json
from .base_agent import BaseAgent


class TesterAgent(BaseAgent):
    name = "tester"
    description = "Tests and validates the generated website code"
    next_agent = "reviewer"

    SYSTEM_PROMPT = """You are an expert QA engineer and web tester.
Your job is to analyze website code and identify bugs, issues, and improvements.

Respond with valid JSON:
{
    "overall_score": 85,
    "tests": [
        {
            "category": "HTML Validity|CSS|JavaScript|Responsive|Accessibility|Performance|SEO",
            "name": "test name",
            "status": "pass|fail|warning",
            "message": "details",
            "fix": "suggested fix if failed (null if passed)"
        }
    ],
    "critical_issues": ["list of must-fix issues"],
    "suggestions": ["list of nice-to-have improvements"],
    "files_to_fix": [
        {
            "path": "file path",
            "issues": ["list of issues in this file"],
            "fixed_content": "complete corrected file content"
        }
    ]
}"""

    def build_prompt(self, input_data: dict) -> str:
        files = input_data.get("files", [])
        files_text = ""
        for f in files:
            files_text += f"\n\n--- FILE: {f['path']} ---\n{f['content']}"

        return f"""Test and validate this website code thoroughly:

{files_text}

Run these checks:
1. HTML Validity - proper structure, semantic tags, missing closing tags
2. CSS - syntax errors, unused styles, responsive breakpoints
3. JavaScript - syntax errors, null references, event listener issues
4. Responsive Design - mobile/tablet/desktop compatibility
5. Accessibility - ARIA labels, alt text, keyboard navigation, contrast
6. Performance - large images, render-blocking resources, optimization
7. SEO - meta tags, heading hierarchy, structured data
8. Cross-browser - potential compatibility issues

For any FAILED tests, provide the COMPLETE fixed file content in files_to_fix.
Be thorough but practical. Respond ONLY with JSON."""

    def parse_response(self, response: str, input_data: dict) -> dict:
        text = response.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        try:
            test_results = json.loads(text.strip())
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    test_results = json.loads(text[start:end])
                except json.JSONDecodeError:
                    test_results = {"overall_score": 70, "tests": [], "critical_issues": [], "suggestions": [], "files_to_fix": []}
            else:
                test_results = {"overall_score": 70, "tests": [], "critical_issues": [], "suggestions": [], "files_to_fix": []}

        # Apply fixes to files
        files = list(input_data.get("files", []))
        fixes = test_results.get("files_to_fix", [])
        for fix in fixes:
            for i, f in enumerate(files):
                if f["path"] == fix.get("path") and fix.get("fixed_content"):
                    files[i] = {**f, "content": fix["fixed_content"]}

        return {
            "plan": input_data.get("plan", {}),
            "design": input_data.get("design", {}),
            "files": files,
            "test_results": test_results,
        }
