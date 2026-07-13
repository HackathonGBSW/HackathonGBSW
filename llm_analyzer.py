"""Compatibility adapter between the Flask backend and the AI analysis package.

Scores and battle results are deterministic. OpenAI only explains the already
calculated results and generates feedback.
"""

from __future__ import annotations

from github_battle_ai import (
    AnalysisError,
    LLMAnalysisError,
    LLMConfigurationError,
    analyze_portfolio_comparison,
    analyze_repo_detailed,
    rank_from_score,
)


class LLMError(Exception):
    """Backward-compatible LLM error consumed by app.py."""


RANK_ORDER = ["F", "E", "D", "C", "B", "A", "S"]
RANK_SCORE_GAIN = {"S": 18, "A": 13, "B": 8, "C": 5, "D": 2, "E": 1, "F": 0}


def rank_for_score(score: float) -> str:
    return rank_from_score(float(score))


def rank_tier_diff(rank_a: str, rank_b: str) -> int:
    return abs(RANK_ORDER.index(rank_a) - RANK_ORDER.index(rank_b))


def _feedback_text(feedback: dict) -> str:
    parts = [
        *feedback.get("good_points", []),
        *feedback.get("improvement_points", []),
        *feedback.get("learning_direction", []),
    ]
    return " / ".join(str(part) for part in parts if part)


def analyze_portfolio(repository: str, field: str) -> dict:
    """Return the legacy Flask portfolio contract from deterministic analysis."""
    try:
        result = analyze_repo_detailed(repository, field, use_llm=True)
    except (LLMAnalysisError, LLMConfigurationError) as exc:
        raise LLMError(str(exc)) from exc

    scores = result["weighted_scores"]
    return {
        "completeness_score": scores["completeness"],
        "structur_score": scores["structure"],
        "tech_score": scores["tech"],
        "docs_score": scores["docs"],
        "test_score": scores["test"],
        "deploy_score": scores["deploy"],
        "github_score": scores["github"],
        "score": result["total_score"],
        "rank": result["rank"],
        "feedback_good": result["feedback_good"],
        "feedback_improve": result["feedback_improve"],
    }


def compare_portfolios(repository1: str, repository2: str, field: str) -> dict:
    """Return legacy battle fields while using deterministic category scores."""
    try:
        result = analyze_portfolio_comparison(
            repository1, repository2, field, use_llm=True
        )
    except (LLMAnalysisError, LLMConfigurationError) as exc:
        raise LLMError(str(exc)) from exc

    feedback = result["comparison_feedback"]
    return {
        "scores1": result["portfolio1"]["raw_scores"],
        "scores2": result["portfolio2"]["raw_scores"],
        "feedback1": _feedback_text(feedback["portfolio1"]),
        "feedback2": _feedback_text(feedback["portfolio2"]),
    }
