"""Deterministic portfolio scoring followed by optional LLM feedback."""

from __future__ import annotations

import os
from typing import Any

from .github_client import GitHubClient
from .llm import LLMAnalysisError, OpenAIPortfolioEvaluator
from .models import AnalysisDetails, RepoSnapshot
from .preprocessor import preprocess_snapshot
from .scorer import CATEGORIES, score_repository, weighted_scores


CATEGORY_LABELS = {
    "completeness": "프로젝트 완성도",
    "structure": "코드 구조",
    "tech": "기술 활용",
    "docs": "문서화",
    "test": "테스트",
    "deploy": "배포",
    "github": "GitHub 활용",
}

IMPROVEMENT_GUIDES = {
    "completeness": "핵심 사용자 흐름, 실행 검증과 예외 처리를 보강하세요.",
    "structure": "기능별 책임을 나누고 계층과 모듈의 경계를 명확히 하세요.",
    "tech": "선택 분야의 핵심 기술을 실제 기능에 적용하고 사용 이유를 문서화하세요.",
    "docs": "README에 설치, 실행, 환경변수, API와 프로젝트 구조를 추가하세요.",
    "test": "핵심 정상·실패 흐름의 단위 및 통합 테스트를 추가하세요.",
    "deploy": "재현 가능한 배포 설정, 실제 서비스 URL과 운영 설정을 추가하세요.",
    "github": "의미 있는 커밋, 브랜치, PR, Issue, Release와 Actions를 활용하세요.",
}


def rank_from_score(total_score: float) -> str:
    """Return the final-spec rank for a deterministic 0-100 score.

    Calibrated against real, well-regarded open-source repositories rather
    than a theoretical 0-100 curve: the original 90/80/60/40/20 thresholds
    graded pallets/flask (a widely-used, mature web framework) as a "C" and
    docker/compose (a flagship Docker project) as a "B" — the rubric checks
    for specific file-level signals (README length, Dockerfile presence,
    test directory naming, etc.) that many legitimate, high-quality projects
    satisfy only partially even when the underlying engineering is excellent
    (e.g. docs living in a separate site instead of a long README). Loosened
    so genuinely strong real-world projects can reach A/B instead of capping
    out a tier lower purely on rubric-detail coverage.
    """
    if total_score >= 95:
        return "S"
    if total_score >= 82:
        return "A"
    if total_score >= 65:
        return "B"
    if total_score >= 45:
        return "C"
    if total_score >= 28:
        return "D"
    if total_score >= 12:
        return "E"
    return "F"


def _fallback_feedback(
    raw_scores: dict[str, float], evidence: dict[str, list[str]], field: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    category_feedback: dict[str, Any] = {}
    for category in CATEGORIES:
        proof = evidence[category] or ["확인 가능한 근거가 부족함"]
        category_feedback[category] = {
            "evidence": proof,
            "good_points": [
                f"{CATEGORY_LABELS[category]}가 규칙 기준 {raw_scores[category]:g}/10으로 평가되었습니다."
            ],
            "improvement_points": [IMPROVEMENT_GUIDES[category]],
        }

    strongest = sorted(CATEGORIES, key=lambda key: (-raw_scores[key], CATEGORIES.index(key)))[:2]
    weakest = sorted(CATEGORIES, key=lambda key: (raw_scores[key], CATEGORIES.index(key)))[:2]
    overall = {
        "strengths": [f"{CATEGORY_LABELS[key]}가 상대적으로 강합니다." for key in strongest],
        "weaknesses": [f"{CATEGORY_LABELS[key]}의 근거가 상대적으로 부족합니다." for key in weakest],
        "priority_improvements": [IMPROVEMENT_GUIDES[key] for key in weakest],
        "recommended_technologies": [f"{field} 분야의 핵심 기술을 실제 기능과 테스트에 적용하세요."],
        "recommended_projects": [f"{field} 분야의 배포 가능한 실전 프로젝트를 완성해 보세요."],
        "learning_direction": ["구현, 테스트, 배포, 문서화를 하나의 흐름으로 반복 학습하세요."],
        "summary": (
            f"{field} 포트폴리오의 확인 가능한 강점을 유지하면서 "
            "점수가 낮은 항목부터 근거를 보강하는 것이 좋습니다."
        ),
    }
    return category_feedback, overall


def analyze_snapshot(
    repo: RepoSnapshot,
    field: str,
    *,
    llm_evaluator: OpenAIPortfolioEvaluator | Any | None = None,
) -> AnalysisDetails:
    """Score a collected snapshot. LLM feedback never changes these scores."""
    if not isinstance(field, str) or not field.strip():
        raise ValueError("field is required")
    normalized_field = field.strip()
    assessments = score_repository(repo, normalized_field)
    raw = {category: assessments[category].score for category in CATEGORIES}
    weighted = weighted_scores(assessments)
    total_score = round(sum(weighted.values()), 2)
    rank = rank_from_score(total_score)
    rule_evidence = {category: assessments[category].evidence for category in CATEGORIES}

    if llm_evaluator is not None:
        llm_result = llm_evaluator.evaluate(
            repo, normalized_field, assessments, weighted, total_score, rank
        )
        dumped = llm_result.model_dump()
        category_feedback = {category: dumped[category] for category in CATEGORIES}
        overall = dumped["overall"]
    else:
        category_feedback, overall = _fallback_feedback(raw, rule_evidence, normalized_field)

    evidence = {
        category: list(dict.fromkeys([
            *category_feedback[category]["evidence"],
            *rule_evidence[category],
        ]))[:8]
        for category in CATEGORIES
    }
    feedback_good = " / ".join(overall["strengths"])
    feedback_improve = " / ".join(overall["priority_improvements"])
    return AnalysisDetails(
        raw_scores=raw,
        weighted_scores=weighted,
        evidence=evidence,
        feedback_good=feedback_good,
        feedback_improve=feedback_improve,
        repository={
            "owner": repo.owner,
            "name": repo.name,
            "url": repo.html_url,
            "field": normalized_field,
        },
        total_score=total_score,
        rank=rank,
        category_feedback=category_feedback,
        overall_feedback=overall,
        github_data=preprocess_snapshot(repo),
    )


def analyze_repo_detailed(
    github_url: str,
    field: str,
    *,
    github_client: GitHubClient | None = None,
    llm_evaluator: OpenAIPortfolioEvaluator | Any | None = None,
    use_llm: bool | None = None,
) -> dict[str, Any]:
    """Collect, deterministically score, rank, and generate feedback."""
    if not isinstance(field, str) or not field.strip():
        raise ValueError("field is required")
    normalized_field = field.strip()
    client = github_client or GitHubClient()
    if use_llm is None:
        use_llm = llm_evaluator is not None or bool(os.getenv("OPENAI_API_KEY"))
    evaluator = llm_evaluator if use_llm else None
    warning: str | None = None
    if use_llm and evaluator is None:
        evaluator = OpenAIPortfolioEvaluator()
    snapshot = client.collect(github_url)
    try:
        details = analyze_snapshot(snapshot, normalized_field, llm_evaluator=evaluator)
        analysis_mode = "rules_with_llm_feedback" if evaluator is not None else "rules"
    except LLMAnalysisError as exc:
        if os.getenv("LLM_FALLBACK_TO_RULES", "true").strip().lower() not in {"1", "true", "yes"}:
            raise
        details = analyze_snapshot(snapshot, normalized_field)
        analysis_mode = "rules_fallback"
        warning = str(exc)
    result = details.to_dict()
    result["analysis_mode"] = analysis_mode
    if warning:
        result["warning"] = warning
    return result


def analyze_repo(
    github_url: str,
    field: str,
    *,
    github_client: GitHubClient | None = None,
    llm_evaluator: OpenAIPortfolioEvaluator | Any | None = None,
    use_llm: bool | None = None,
) -> dict[str, Any]:
    """Return the final backend JSON contract for one portfolio."""
    details = analyze_repo_detailed(
        github_url,
        field,
        github_client=github_client,
        llm_evaluator=llm_evaluator,
        use_llm=use_llm,
    )
    reason = " / ".join(
        f"{CATEGORY_LABELS[category]}: {details['evidence'][category][0]}"
        for category in CATEGORIES
    )
    feedback = {
        "reason": reason,
        "good": " / ".join(details["overall_feedback"]["strengths"]),
        "improve": " / ".join(details["overall_feedback"]["priority_improvements"]),
        "summary": details["overall_feedback"]["summary"],
    }
    return {
        "scores": details["weighted_scores"],
        "raw_scores": details["raw_scores"],
        "total_score": details["total_score"],
        "rank": details["rank"],
        "evidence": details["evidence"],
        "category_feedback": details["category_feedback"],
        "overall_feedback": details["overall_feedback"],
        "feedback": feedback,
        "repository": details["repository"],
        "github_data": details["github_data"],
        "analysis_mode": details["analysis_mode"],
        **({"warning": details["warning"]} if "warning" in details else {}),
    }


def analyze_portfolio(
    github_url: str,
    field: str,
    *,
    github_client: GitHubClient | None = None,
    llm_evaluator: OpenAIPortfolioEvaluator | Any | None = None,
    use_llm: bool | None = None,
) -> dict[str, Any]:
    """Alias for the detailed portfolio analysis result."""
    return analyze_repo_detailed(
        github_url,
        field,
        github_client=github_client,
        llm_evaluator=llm_evaluator,
        use_llm=use_llm,
    )
