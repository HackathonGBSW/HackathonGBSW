"""Compatibility adapter between the Flask backend and the AI analysis package.

Scores and battle results are deterministic. OpenAI only explains the already
calculated results and generates feedback.
"""

from __future__ import annotations

import logging

from github_battle_ai import (
    AnalysisError,
    LLMAnalysisError,
    LLMConfigurationError,
    analyze_portfolio_comparison,
    analyze_repo_detailed,
    rank_from_score,
)

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Backward-compatible LLM error consumed by app.py."""


RANK_SCORE_GAIN = {"S": 18, "A": 13, "B": 8, "C": 5, "D": 2, "E": 1, "F": 0}


def rank_for_score(score: float) -> str:
    return rank_from_score(float(score))


# Player-ladder tiers, distinct from the S~F portfolio analysis grade above.
# player_rank_score is cumulative and unbounded (portfolio submissions grant
# up to +18, battles grant +8/-3 plus a streak bonus), so — unlike the 0-100
# analysis score — it needs an open-ended ladder rather than a 7-band scale.
# Bronze/Silver/Gold/Platinum/Diamond each carry 4 divisions (4 lowest -> 1
# highest); the top four bands are flat, division-less score bands, matching
# how LoL-style ladders stop subdividing once a ladder gets to its top end.
PLAYER_TIERS = [
    ("bronze", 4, "브론즈 4", 0),
    ("bronze", 3, "브론즈 3", 20),
    ("bronze", 2, "브론즈 2", 40),
    ("bronze", 1, "브론즈 1", 60),
    ("silver", 4, "실버 4", 80),
    ("silver", 3, "실버 3", 100),
    ("silver", 2, "실버 2", 120),
    ("silver", 1, "실버 1", 140),
    ("gold", 4, "골드 4", 160),
    ("gold", 3, "골드 3", 180),
    ("gold", 2, "골드 2", 200),
    ("gold", 1, "골드 1", 220),
    ("platinum", 4, "플래티넘 4", 240),
    ("platinum", 3, "플래티넘 3", 260),
    ("platinum", 2, "플래티넘 2", 280),
    ("platinum", 1, "플래티넘 1", 300),
    ("diamond", 4, "다이아몬드 4", 320),
    ("diamond", 3, "다이아몬드 3", 340),
    ("diamond", 2, "다이아몬드 2", 360),
    ("diamond", 1, "다이아몬드 1", 380),
    ("newbie", None, "신입", 400),
    ("junior", None, "주니어", 480),
    ("middle", None, "미들", 560),
    ("senior", None, "시니어", 640),
]


def player_tier_for_score(score: float) -> dict:
    """Map a cumulative player_rank_score to its player-ladder tier."""
    score = max(0.0, float(score))
    index = 0
    for i, (_material, _division, _label, threshold) in enumerate(PLAYER_TIERS):
        if score >= threshold:
            index = i
        else:
            break

    material, division, label, threshold = PLAYER_TIERS[index]
    has_next = index + 1 < len(PLAYER_TIERS)
    next_label = PLAYER_TIERS[index + 1][2] if has_next else None
    next_threshold = PLAYER_TIERS[index + 1][3] if has_next else None
    progress_percent = (
        100.0
        if not has_next
        else round(min(100.0, (score - threshold) / (next_threshold - threshold) * 100), 1)
    )

    return {
        "material": material,
        "division": division,
        "label": label,
        "index": index,
        "next_label": next_label,
        "progress_percent": progress_percent,
    }


def player_tier_diff(index_a: int, index_b: int) -> int:
    return abs(index_a - index_b)


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
        # use_llm=None lets the package auto-detect from OPENAI_API_KEY, instead
        # of forcing an LLM call that hard-fails whenever the key is unset.
        result = analyze_repo_detailed(repository, field, use_llm=None)
    except (LLMAnalysisError, LLMConfigurationError) as exc:
        raise LLMError(str(exc)) from exc
    except ValueError as exc:
        # Bad input (blank field, malformed URL) -> a 422, not an unhandled 500.
        raise AnalysisError(str(exc)) from exc

    if result.get("analysis_mode") == "rules_fallback":
        logger.warning(
            "LLM feedback failed for %s, fell back to rule-based feedback: %s",
            repository,
            result.get("warning"),
        )

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
            repository1, repository2, field, use_llm=None
        )
    except (LLMAnalysisError, LLMConfigurationError) as exc:
        raise LLMError(str(exc)) from exc
    except ValueError as exc:
        raise AnalysisError(str(exc)) from exc

    if (
        result["portfolio1"].get("analysis_mode") == "rules_fallback"
        or result["portfolio2"].get("analysis_mode") == "rules_fallback"
    ):
        logger.warning(
            "LLM feedback failed during comparison of %s vs %s, fell back to rule-based feedback",
            repository1,
            repository2,
        )

    feedback = result["comparison_feedback"]
    return {
        "scores1": result["portfolio1"]["raw_scores"],
        "scores2": result["portfolio2"]["raw_scores"],
        "feedback1": _feedback_text(feedback["portfolio1"]),
        "feedback2": _feedback_text(feedback["portfolio2"]),
    }
