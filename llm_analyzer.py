"""
포트폴리오 분석/비교를 담당하는 LLM 모듈 (OpenAI API 사용).

- analyze_portfolio(): 저장소 하나를 7개 항목 가중치로 채점 (POST/PUT /portfolios에서 사용)
- compare_portfolios(): 두 저장소를 같은 컨텍스트에서 상대 비교 (배틀 로직에서 사용)

환경변수:
- OPENAI_API_KEY: 필수. 없으면 두 함수 모두 LLMError를 발생시킨다.
- GITHUB_TOKEN: 선택. 없으면 GitHub API 익명 호출(시간당 60회 제한)을 사용한다.
- ANALYSIS_MODEL: 선택. 기본값 "gpt-4o-mini".
"""

import os
import re
import json

import requests

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

MODEL = os.environ.get("ANALYSIS_MODEL", "gpt-4o-mini")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_API = "https://api.github.com"

_client = None


class AnalysisError(Exception):
    """저장소 정보를 가져오지 못했을 때 (비공개 저장소, 잘못된 URL 등)."""


class LLMError(Exception):
    """LLM 호출/구조화 응답 파싱이 실패했을 때."""


def _get_client():
    global _client
    if _client is None:
        if OpenAI is None:
            raise LLMError("openai 패키지가 설치되어 있지 않습니다 (pip install openai)")
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise LLMError("OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다")
        _client = OpenAI(api_key=api_key)
    return _client


def _github_headers():
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return headers


def _parse_owner_repo(repository: str) -> tuple[str, str]:
    match = re.search(r"github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", repository.strip())
    if not match:
        raise AnalysisError(f"유효한 GitHub 저장소 URL이 아닙니다: {repository}")
    return match.group(1), match.group(2)


def _fetch_repo_context(repository: str) -> dict:
    """LLM 프롬프트에 첨부할 저장소 요약 정보를 GitHub REST API로 수집한다."""
    owner, repo = _parse_owner_repo(repository)
    base = f"{GITHUB_API}/repos/{owner}/{repo}"

    repo_resp = requests.get(base, headers=_github_headers(), timeout=10)
    if repo_resp.status_code == 404:
        raise AnalysisError(f"저장소를 찾을 수 없거나 비공개 저장소입니다: {repository}")
    if repo_resp.status_code != 200:
        raise AnalysisError(f"GitHub API 조회 실패({repo_resp.status_code}): {repository}")
    repo_data = repo_resp.json()

    def safe_get(path, default=None):
        resp = requests.get(f"{base}/{path}", headers=_github_headers(), timeout=10)
        return resp.json() if resp.status_code == 200 else default

    readme = safe_get("readme", {})
    languages = safe_get("languages", {})
    contents = safe_get("contents", [])
    commits = safe_get("commits?per_page=1", [])
    releases = safe_get("releases", [])
    top_level_names = [item.get("name", "") for item in contents] if isinstance(contents, list) else []

    return {
        "full_name": repo_data.get("full_name"),
        "description": repo_data.get("description"),
        "stars": repo_data.get("stargazers_count", 0),
        "open_issues": repo_data.get("open_issues_count", 0),
        "default_branch": repo_data.get("default_branch"),
        "has_readme": bool(readme),
        "languages": list(languages.keys()) if isinstance(languages, dict) else [],
        "top_level_files": top_level_names,
        "has_ci_config": any(
            name in (".github", ".circleci", ".gitlab-ci.yml") for name in top_level_names
        ),
        "has_test_dir": any(
            name.lower() in ("test", "tests", "__tests__", "spec") for name in top_level_names
        ),
        "has_deploy_config": any(
            name in ("Dockerfile", "docker-compose.yml", "vercel.json", "Procfile", "fly.toml")
            for name in top_level_names
        ),
        "release_count": len(releases) if isinstance(releases, list) else 0,
        "has_commit_history": bool(commits),
    }


PORTFOLIO_SCHEMA = {
    "name": "portfolio_analysis",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "completeness_score": {"type": "number", "minimum": 0, "maximum": 30},
            "structur_score": {"type": "number", "minimum": 0, "maximum": 10},
            "tech_score": {"type": "number", "minimum": 0, "maximum": 15},
            "docs_score": {"type": "number", "minimum": 0, "maximum": 5},
            "test_score": {"type": "number", "minimum": 0, "maximum": 5},
            "deploy_score": {"type": "number", "minimum": 0, "maximum": 15},
            "github_score": {"type": "number", "minimum": 0, "maximum": 20},
            "feedback_good": {"type": "string"},
            "feedback_improve": {"type": "string"},
        },
        "required": [
            "completeness_score", "structur_score", "tech_score", "docs_score",
            "test_score", "deploy_score", "github_score",
            "feedback_good", "feedback_improve",
        ],
        "additionalProperties": False,
    },
}

_CATEGORY_SCORE_SCHEMA = {
    "type": "object",
    "properties": {
        k: {"type": "number", "minimum": 0, "maximum": 10}
        for k in ["completeness", "structure", "tech", "docs", "test", "deploy", "github"]
    },
    "required": ["completeness", "structure", "tech", "docs", "test", "deploy", "github"],
    "additionalProperties": False,
}

COMPARE_SCHEMA = {
    "name": "portfolio_comparison",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "scores1": _CATEGORY_SCORE_SCHEMA,
            "scores2": _CATEGORY_SCORE_SCHEMA,
            "feedback1": {"type": "string"},
            "feedback2": {"type": "string"},
        },
        "required": ["scores1", "scores2", "feedback1", "feedback2"],
        "additionalProperties": False,
    },
}


def _call_llm(system_prompt: str, user_prompt: str, json_schema: dict) -> dict:
    client = _get_client()

    last_error = None
    for _ in range(2):  # 최초 시도 + 재시도 1회
        try:
            response = client.chat.completions.create(
                model=MODEL,
                temperature=0,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_schema", "json_schema": json_schema},
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as exc:  # noqa: BLE001 - LLM 호출 실패는 모두 LLMError로 통일
            last_error = str(exc)
    raise LLMError(f"LLM 구조화 응답을 받지 못했습니다: {last_error}")


def analyze_portfolio(repository: str, field: str) -> dict:
    context = _fetch_repo_context(repository)
    system_prompt = (
        "너는 소프트웨어 포트폴리오 심사관이다. 주어진 GitHub 저장소 요약 정보를 바탕으로 "
        f"'{field}' 분야 기준으로 다음 7개 항목을 채점하라: "
        "프로젝트 완성도(0~30), 코드 구조(0~10), 기술 활용(0~15), 문서화(0~5), "
        "테스트(0~5), 배포(0~15), GitHub 활용(0~20). "
        "점수는 요약 정보에서 확인 가능한 근거에만 기반해야 하며, 추측으로 후하게 주지 않는다."
    )
    user_prompt = (
        f"저장소 요약 정보:\n{json.dumps(context, ensure_ascii=False, indent=2)}\n\n"
        "위 정보를 근거로 각 항목을 채점하고, 좋았던 점과 개선할 점을 구체적으로 작성하라."
    )
    result = _call_llm(system_prompt, user_prompt, PORTFOLIO_SCHEMA)

    weights = {
        "completeness_score": 30, "structur_score": 10, "tech_score": 15,
        "docs_score": 5, "test_score": 5, "deploy_score": 15, "github_score": 20,
    }
    for key, cap in weights.items():
        result[key] = max(0.0, min(float(result[key]), cap))

    total = sum(result[key] for key in weights)
    result["score"] = total
    result["rank"] = rank_for_score(total)
    return result


def compare_portfolios(repository1: str, repository2: str, field: str) -> dict:
    context1 = _fetch_repo_context(repository1)
    context2 = _fetch_repo_context(repository2)
    system_prompt = (
        "너는 소프트웨어 포트폴리오 대결의 심사관이다. 두 저장소 A, B를 "
        f"'{field}' 분야 기준으로 같은 7개 항목(완성도/코드 구조/기술 활용/문서화/테스트/배포/GitHub 활용)에 대해 "
        "각각 10점 만점으로 상대평가하라. 항목별 점수 차이가 실력 차이를 반영해야 하며, "
        "두 저장소의 해당 항목이 실제로 동등하다면 같은 점수(무승부 가능)를 줘도 된다. "
        "인위적으로 차이를 만들거나 무승부를 피하려 하지 마라."
    )
    user_prompt = (
        f"저장소 A 요약:\n{json.dumps(context1, ensure_ascii=False, indent=2)}\n\n"
        f"저장소 B 요약:\n{json.dumps(context2, ensure_ascii=False, indent=2)}\n\n"
        "두 저장소를 항목별로 비교 채점하고, A 소유자에게 줄 피드백(feedback1)과 "
        "B 소유자에게 줄 피드백(feedback2)을 상대방과의 비교를 근거로 작성하라."
    )
    result = _call_llm(system_prompt, user_prompt, COMPARE_SCHEMA)

    for scores_key in ("scores1", "scores2"):
        for category, value in result[scores_key].items():
            result[scores_key][category] = max(0.0, min(float(value), 10))
    return result


RANK_ORDER = ["F", "E", "D", "C", "B", "A", "S"]  # 낮은 순 -> 높은 순


def rank_for_score(score: float) -> str:
    if score >= 100:
        return "S"
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    if score >= 20:
        return "E"
    return "F"


def rank_tier_diff(rank_a: str, rank_b: str) -> int:
    """두 랭크(S~F) 사이의 단계 차이 (매칭 시 '최대 한 랭크 차이' 판정에 사용)."""
    return abs(RANK_ORDER.index(rank_a) - RANK_ORDER.index(rank_b))


RANK_SCORE_GAIN = {"S": 18, "A": 13, "B": 8, "C": 5, "D": 2, "E": 1, "F": 0}
