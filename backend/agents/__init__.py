from .planner import PlannerAgent
from .designer import DesignerAgent
from .developer import DeveloperAgent
from .tester import TesterAgent
from .reviewer import ReviewerAgent
from .deployer import DeployerAgent

AGENT_PIPELINE = [
    PlannerAgent(),
    DesignerAgent(),
    DeveloperAgent(),
    TesterAgent(),
    ReviewerAgent(),
    DeployerAgent(),
]

AGENTS_MAP = {agent.name: agent for agent in AGENT_PIPELINE}
