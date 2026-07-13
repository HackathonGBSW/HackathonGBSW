"""Public interface for the GitHub Battle analysis module."""

from .analyzer import analyze_portfolio, analyze_repo, analyze_repo_detailed, rank_from_score
from .comparison import analyze_portfolio_comparison
from .errors import AnalysisError, InvalidGitHubURLError, RepositoryAccessError
from .llm import LLMAnalysisError, LLMConfigurationError, OpenAIPortfolioEvaluator

__all__ = [
    "AnalysisError",
    "InvalidGitHubURLError",
    "LLMAnalysisError",
    "LLMConfigurationError",
    "OpenAIPortfolioEvaluator",
    "RepositoryAccessError",
    "analyze_repo",
    "analyze_repo_detailed",
    "analyze_portfolio",
    "analyze_portfolio_comparison",
    "rank_from_score",
]
