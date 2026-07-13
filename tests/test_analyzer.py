from __future__ import annotations

import unittest
from unittest.mock import patch

from github_battle_ai.analyzer import (
    analyze_repo,
    analyze_repo_detailed,
    analyze_snapshot,
    rank_from_score,
)
from github_battle_ai.github_client import parse_github_input, parse_github_url
from github_battle_ai.llm import (
    CategoryFeedback,
    LLMAnalysisError,
    OverallFeedback,
    PortfolioLLMFeedback,
)
from github_battle_ai.models import RepoSnapshot
from github_battle_ai.scorer import CATEGORIES


def rich_snapshot(name: str = "project") -> RepoSnapshot:
    files = [
        ".env.example", ".gitignore", ".github/workflows/test.yml", "Dockerfile",
        "README.md", "requirements.txt", "app/api/routes.py", "app/config/settings.py",
        "app/models/user.py", "app/repositories/user_repository.py",
        "app/services/auth_service.py", "tests/test_auth.py", "tests/test_api.py",
    ]
    return RepoSnapshot(
        owner="team", name=name, html_url=f"https://github.com/team/{name}",
        username="team", public_repo_count=7, followers=12, following=3,
        recent_activity_at="2026-07-14T00:00:00Z",
        description="Backend API", languages={"Python": 10000}, files=files,
        file_sizes={path: 1000 for path in files},
        sampled_contents={
            "requirements.txt": "fastapi\nsqlalchemy\npytest\nrequests\nbcrypt\n",
            "app/api/routes.py": "@router.get('/api')\nasync def api():\n try:\n  return service.list()\n except Exception:\n  return {'error': 'failed'}",
            "tests/test_auth.py": "def test_login():\n assert True",
            ".github/workflows/test.yml": "run: pytest\nrun: docker build .\nrun: deploy production",
        },
        readme=("# API\n## 소개\n## 주요 기능\n## 설치 및 실행\n## 환경변수\n"
                "## API 구조\n## 테스트\n## 배포\nhttps://example.com\n") * 10,
        commit_count=35, commit_messages=["feat: implement user authentication"] * 20,
        pull_request_count=8, open_issues=3, workflow_count=1, branch_count=4,
        contributor_count=3, release_count=2, stars=10, forks=2,
        license_name="MIT", homepage="https://example.com",
    )


def feedback_result(prefix: str = "AI") -> PortfolioLLMFeedback:
    category = lambda key: CategoryFeedback(
        evidence=[f"{prefix} {key} 근거"],
        good_points=[f"{prefix} {key} 좋은 점"],
        improvement_points=[f"{prefix} {key} 개선점"],
    )
    return PortfolioLLMFeedback(
        **{key: category(key) for key in CATEGORIES},
        overall=OverallFeedback(
            strengths=[f"{prefix} 전체 강점"], weaknesses=[f"{prefix} 전체 약점"],
            priority_improvements=[f"{prefix} 우선 개선"],
            recommended_technologies=["FastAPI"], recommended_projects=["실전 API"],
            learning_direction=["테스트와 배포 학습"],
            summary=f"{prefix} 포트폴리오에 대한 종합 피드백입니다.",
        ),
    )


class FakeClient:
    def __init__(self, snapshot: RepoSnapshot | None = None) -> None:
        self.snapshot = snapshot or rich_snapshot()
        self.calls = 0

    def collect(self, github_url: str) -> RepoSnapshot:
        self.calls += 1
        return self.snapshot


class FakeEvaluator:
    def __init__(self, prefix: str = "AI") -> None:
        self.prefix = prefix

    def evaluate(self, repo, field, assessments, weighted, total_score, rank):
        self.received_scores = weighted
        return feedback_result(self.prefix)


class FailingEvaluator:
    def evaluate(self, repo, field, assessments, weighted, total_score, rank):
        raise LLMAnalysisError("temporary OpenAI failure")


class AnalyzerTests(unittest.TestCase):
    def test_parse_profile_and_repository_urls(self) -> None:
        self.assertEqual(parse_github_input("https://github.com/openai"), ("openai", None))
        self.assertEqual(parse_github_input("github.com/openai/openai-python.git"), ("openai", "openai-python"))
        self.assertEqual(parse_github_url("https://github.com/openai/openai-python"), ("openai", "openai-python"))

    def test_rank_boundaries(self) -> None:
        cases = [(100, "S"), (99.5, "A"), (90, "A"), (80, "B"), (60, "C"),
                 (40, "D"), (20, "E"), (19.99, "F"), (0, "F")]
        for score, expected in cases:
            with self.subTest(score=score):
                self.assertEqual(rank_from_score(score), expected)

    def test_scores_are_deterministic_and_llm_cannot_change_them(self) -> None:
        repo = rich_snapshot()
        rules = analyze_snapshot(repo, "backend")
        first = analyze_snapshot(repo, "backend", llm_evaluator=FakeEvaluator("ONE"))
        second = analyze_snapshot(repo, "backend", llm_evaluator=FakeEvaluator("TWO"))
        self.assertEqual(rules.raw_scores, first.raw_scores)
        self.assertEqual(first.raw_scores, second.raw_scores)
        self.assertEqual(first.weighted_scores, second.weighted_scores)
        self.assertEqual(first.total_score, sum(first.weighted_scores.values()))
        self.assertNotEqual(first.feedback_good, second.feedback_good)

    def test_final_backend_contract(self) -> None:
        result = analyze_repo(
            "https://github.com/team/project", "backend",
            github_client=FakeClient(), use_llm=False,
        )
        required = {"scores", "raw_scores", "total_score", "rank", "evidence", "feedback",
                    "category_feedback", "overall_feedback", "repository", "github_data"}
        self.assertTrue(required <= set(result))
        self.assertEqual(set(result["scores"]), set(CATEGORIES))
        self.assertEqual(set(result["category_feedback"]), set(CATEGORIES))
        self.assertAlmostEqual(result["total_score"], sum(result["scores"].values()))
        self.assertIn(result["rank"], "SABCDEF")
        self.assertEqual(result["github_data"]["repository"]["branch_count"], 4)
        self.assertIn("FastAPI", result["github_data"]["repository"]["technology_stack"])
        self.assertEqual(set(result["feedback"]), {"reason", "good", "improve", "summary"})
        self.assertTrue(all(result["feedback"].values()))
        self.assertEqual(
            result["github_data"]["repository"]["language_statistics"][0]["percentage"],
            100.0,
        )

    def test_empty_field_is_rejected_before_collection(self) -> None:
        client = FakeClient()
        with self.assertRaisesRegex(ValueError, "field is required"):
            analyze_repo_detailed("https://github.com/team/project", " ", github_client=client)
        self.assertEqual(client.calls, 0)

    def test_llm_failure_falls_back_without_changing_scores(self) -> None:
        client = FakeClient()
        expected = analyze_repo_detailed(
            "https://github.com/team/project", "backend", github_client=client, use_llm=False
        )
        actual = analyze_repo_detailed(
            "https://github.com/team/project", "backend", github_client=client,
            llm_evaluator=FailingEvaluator(), use_llm=True,
        )
        self.assertEqual(actual["analysis_mode"], "rules_fallback")
        self.assertEqual(actual["weighted_scores"], expected["weighted_scores"])
        self.assertIn("temporary OpenAI failure", actual["warning"])

    def test_llm_failure_propagates_when_fallback_disabled(self) -> None:
        with patch.dict("os.environ", {"LLM_FALLBACK_TO_RULES": "false"}):
            with self.assertRaises(LLMAnalysisError):
                analyze_repo_detailed(
                    "https://github.com/team/project", "backend",
                    github_client=FakeClient(), llm_evaluator=FailingEvaluator(), use_llm=True,
                )


if __name__ == "__main__":
    unittest.main()
