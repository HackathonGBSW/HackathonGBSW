"""Deterministic portfolio battle with optional LLM explanation."""

from __future__ import annotations

import os
from typing import Any

from .analyzer import CATEGORY_LABELS, analyze_portfolio
from .github_client import GitHubClient, parse_github_input
from .llm import LLMAnalysisError, OpenAIPortfolioEvaluator
from .scorer import CATEGORIES


def _battle_result(first: dict[str, Any], second: dict[str, Any]) -> dict[str, Any]:
    differences: dict[str, Any] = {}
    first_points = 0.0
    second_points = 0.0
    for category in CATEGORIES:
        score1 = float(first["raw_scores"][category])
        score2 = float(second["raw_scores"][category])
        difference = round(abs(score1 - score2), 2)
        awarded_to = "draw"
        if score1 > score2:
            first_points += difference
            awarded_to = "portfolio1"
        elif score2 > score1:
            second_points += difference
            awarded_to = "portfolio2"
        differences[category] = {
            "portfolio1_score": score1,
            "portfolio2_score": score2,
            "difference": difference,
            "awarded_to": awarded_to,
        }
    if first_points > second_points:
        winner = "portfolio1"
    elif second_points > first_points:
        winner = "portfolio2"
    else:
        winner = "draw"
    return {
        "category_differences": differences,
        "battle_scores": {
            "portfolio1": round(first_points, 2),
            "portfolio2": round(second_points, 2),
        },
        "winner": winner,
        "winner_repository": (
            first["repository"] if winner == "portfolio1"
            else second["repository"] if winner == "portfolio2"
            else None
        ),
    }


def _fallback_user_feedback(
    own: dict[str, Any], opponent: dict[str, Any]
) -> dict[str, Any]:
    own_scores = own["raw_scores"]
    other_scores = opponent["raw_scores"]
    higher = [key for key in CATEGORIES if own_scores[key] > other_scores[key]]
    lower = [key for key in CATEGORIES if own_scores[key] < other_scores[key]]
    good = [
        f"{CATEGORY_LABELS[key]}가 상대보다 {own_scores[key] - other_scores[key]:g}점 높습니다."
        for key in higher[:3]
    ] or ["동점인 항목의 현재 품질을 유지하고 평가 근거를 더 강화하세요."]
    improve = [
        f"{CATEGORY_LABELS[key]}가 상대보다 {other_scores[key] - own_scores[key]:g}점 낮습니다."
        for key in lower[:3]
    ] or ["상대보다 낮은 항목은 없지만 자동화와 문서화를 계속 보완하세요."]
    return {
        "good_points": good,
        "improvement_points": improve,
        "lacking_compared_to_opponent": improve,
        "recommended_technologies": own["overall_feedback"]["recommended_technologies"],
        "learning_direction": own["overall_feedback"]["learning_direction"],
    }


def _fallback_comparison(
    first: dict[str, Any], second: dict[str, Any], battle: dict[str, Any]
) -> dict[str, Any]:
    winner = battle["winner"]
    if winner == "draw":
        reason = ["두 사용자의 항목별 점수 차이 합계가 같아 무승부입니다."]
    else:
        scores = battle["battle_scores"]
        reason = [
            f"{winner}의 점수 차이 합계가 {scores[winner]:g}점으로 상대보다 높습니다."
        ]
    return {
        "winner_reason": reason,
        "portfolio1": _fallback_user_feedback(first, second),
        "portfolio2": _fallback_user_feedback(second, first),
        "overall_comparison": "규칙 기반 항목별 점수 차이를 합산하여 승패를 결정했습니다.",
    }


def analyze_portfolio_comparison(
    github_url1: str,
    github_url2: str,
    field: str,
    *,
    github_client: GitHubClient | None = None,
    llm_evaluator: OpenAIPortfolioEvaluator | Any | None = None,
    use_llm: bool | None = None,
) -> dict[str, Any]:
    """Analyze, compare, determine a winner, and explain the result."""
    if not isinstance(field, str) or not field.strip():
        raise ValueError("field is required")
    normalized_field = field.strip()
    first_input = tuple(part.lower() if part else None for part in parse_github_input(github_url1))
    second_input = tuple(part.lower() if part else None for part in parse_github_input(github_url2))
    if first_input == second_input:
        raise ValueError("Two different GitHub URLs are required")
    client = github_client or GitHubClient()
    if use_llm is None:
        use_llm = llm_evaluator is not None or bool(os.getenv("OPENAI_API_KEY"))
    evaluator = llm_evaluator if use_llm else None
    if use_llm and evaluator is None:
        evaluator = OpenAIPortfolioEvaluator()

    first = analyze_portfolio(
        github_url1,
        normalized_field,
        github_client=client,
        llm_evaluator=evaluator,
        use_llm=use_llm,
    )
    second = analyze_portfolio(
        github_url2,
        normalized_field,
        github_client=client,
        llm_evaluator=evaluator,
        use_llm=use_llm,
    )
    first_repository = (
        str(first["repository"]["owner"]).lower(),
        str(first["repository"]["name"]).lower(),
    )
    second_repository = (
        str(second["repository"]["owner"]).lower(),
        str(second["repository"]["name"]).lower(),
    )
    if first_repository == second_repository:
        raise ValueError("The two GitHub inputs resolved to the same repository")
    battle = _battle_result(first, second)

    feedback_source = "rules"
    if evaluator is not None:
        try:
            feedback = evaluator.compare(
                normalized_field, first, second, battle
            ).model_dump()
            feedback_source = "llm"
        except LLMAnalysisError:
            if os.getenv("LLM_FALLBACK_TO_RULES", "true").strip().lower() not in {"1", "true", "yes"}:
                raise
            feedback = _fallback_comparison(first, second, battle)
    else:
        feedback = _fallback_comparison(first, second, battle)

    return {
        "field": normalized_field,
        "portfolio1": first,
        "portfolio2": second,
        "battle_result": battle,
        "comparison_feedback": feedback,
        "feedback_source": feedback_source,
    }
