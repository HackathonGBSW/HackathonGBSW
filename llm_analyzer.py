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
    parse_github_url,
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
# highest); per-division spacing widens going up the ladder (LoL-style).
FIXED_PLAYER_TIERS = [
    ("bronze", 4, "Bronze 4", 0),
    ("bronze", 3, "Bronze 3", 30),
    ("bronze", 2, "Bronze 2", 60),
    ("bronze", 1, "Bronze 1", 90),
    ("silver", 4, "Silver 4", 120),
    ("silver", 3, "Silver 3", 160),
    ("silver", 2, "Silver 2", 200),
    ("silver", 1, "Silver 1", 240),
    ("gold", 4, "Gold 4", 280),
    ("gold", 3, "Gold 3", 340),
    ("gold", 2, "Gold 2", 400),
    ("gold", 1, "Gold 1", 460),
    ("platinum", 4, "Platinum 4", 520),
    ("platinum", 3, "Platinum 3", 590),
    ("platinum", 2, "Platinum 2", 660),
    ("platinum", 1, "Platinum 1", 730),
    ("diamond", 4, "Diamond 4", 800),
    ("diamond", 3, "Diamond 3", 900),
    ("diamond", 2, "Diamond 2", 1000),
    ("diamond", 1, "Diamond 1", 1100),
]
_DIAMOND_1_INDEX = len(FIXED_PLAYER_TIERS) - 1

# Junior/Middle/Senior sit above Diamond 1 as flat, division-less bands and
# are gated by BOTH a score floor and a leaderboard rank_position cap (top
# 1000/800/300). Score alone isn't enough: player_rank_score only ever goes
# up (net of losses), so a pure score threshold would eventually let everyone
# cross it and pile into Senior. Capping by standing keeps the elite bands
# exclusive regardless of how high the whole population's scores climb —
# mirrors LoL's Master/Grandmaster/Challenger, where clearing the LP bar
# without a free slot just holds you at the top of Diamond.
JUNIOR_THRESHOLD = 1200
MIDDLE_THRESHOLD = JUNIOR_THRESHOLD + 1000
SENIOR_THRESHOLD = MIDDLE_THRESHOLD + 1500

ELITE_TIERS = [
    ("junior", "Junior", JUNIOR_THRESHOLD, 1000),
    ("middle", "Middle", MIDDLE_THRESHOLD, 800),
    ("senior", "Senior", SENIOR_THRESHOLD, 300),
]


def player_tier_for_score(score: float, rank_position: int) -> dict:
    """Map a cumulative player_rank_score to its player-ladder tier.

    rank_position is the player's 1-indexed standing among ALL players when
    sorted by player_rank_score descending (dense-ranked: ties share a
    position). It only matters once score clears the Junior floor — Bronze
    through Diamond are decided by score alone.
    """
    score = max(0.0, float(score))

    if score >= JUNIOR_THRESHOLD:
        for tier_index in range(len(ELITE_TIERS) - 1, -1, -1):
            material, label, threshold, rank_cap = ELITE_TIERS[tier_index]
            if score >= threshold and rank_position <= rank_cap:
                has_next = tier_index + 1 < len(ELITE_TIERS)
                next_label = ELITE_TIERS[tier_index + 1][1] if has_next else None
                next_threshold = ELITE_TIERS[tier_index + 1][2] if has_next else None
                progress_percent = (
                    100.0
                    if not has_next
                    else round(min(100.0, (score - threshold) / (next_threshold - threshold) * 100), 1)
                )
                return {
                    "material": material,
                    "division": None,
                    "label": label,
                    "index": _DIAMOND_1_INDEX + 1 + tier_index,
                    "next_label": next_label,
                    "progress_percent": progress_percent,
                }
        # Score clears Junior but rank_position exceeds even the widest
        # (1000-slot) cap: held at Diamond 1 until standing improves.

    index = 0
    for i, (_material, _division, _label, threshold) in enumerate(FIXED_PLAYER_TIERS):
        if score >= threshold:
            index = i
        else:
            break

    material, division, label, threshold = FIXED_PLAYER_TIERS[index]
    if index == _DIAMOND_1_INDEX:
        next_label = "Junior"
        progress_percent = (
            100.0
            if score >= JUNIOR_THRESHOLD
            else round(min(100.0, (score - threshold) / (JUNIOR_THRESHOLD - threshold) * 100), 1)
        )
    else:
        next_label = FIXED_PLAYER_TIERS[index + 1][2]
        next_threshold = FIXED_PLAYER_TIERS[index + 1][3]
        progress_percent = round(min(100.0, (score - threshold) / (next_threshold - threshold) * 100), 1)

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


def repository_owner_matches(github_username: str, repository: str) -> bool:
    """True if `repository`'s URL owner matches github_username (case-insensitive).

    Malformed URLs return True here so analyze_portfolio()/compare_portfolios()
    can raise the real, more specific AnalysisError for them instead of this
    check masking it with an ownership-mismatch message."""
    try:
        owner, _ = parse_github_url(repository)
    except AnalysisError:
        return True
    return owner.lower() == (github_username or "").lower()


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
