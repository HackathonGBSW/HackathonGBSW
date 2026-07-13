from __future__ import annotations

import unittest
from dataclasses import replace

from github_battle_ai.comparison import analyze_portfolio_comparison
from github_battle_ai.llm import LLMAnalysisError
from tests.test_analyzer import FakeEvaluator, rich_snapshot
from tests.test_llm import comparison_feedback


class BattleClient:
    def __init__(self) -> None:
        self.calls = 0

    def collect(self, github_url: str):
        self.calls += 1
        if "strong" in github_url:
            return rich_snapshot("strong")
        return replace(
            rich_snapshot("weak"),
            files=["README.md", "main.py"],
            file_sizes={"README.md": 100, "main.py": 100},
            sampled_contents={"main.py": "print('hello')"},
            readme="# project",
            commit_count=1,
            commit_messages=["init"],
            pull_request_count=0,
            open_issues=0,
            workflow_count=0,
            branch_count=1,
            contributor_count=1,
            release_count=0,
            stars=0,
            forks=0,
            homepage="",
            license_name="",
        )


class ComparisonEvaluator(FakeEvaluator):
    def compare(self, field, portfolio1, portfolio2, battle_result):
        self.battle_result = battle_result
        return comparison_feedback()


class FailingComparisonEvaluator(FakeEvaluator):
    def compare(self, field, portfolio1, portfolio2, battle_result):
        raise LLMAnalysisError("comparison failed")


class ComparisonTests(unittest.TestCase):
    def test_battle_calculates_differences_and_winner(self) -> None:
        result = analyze_portfolio_comparison(
            "https://github.com/team/strong", "https://github.com/team/weak", "backend",
            github_client=BattleClient(), use_llm=False,
        )
        battle = result["battle_result"]
        self.assertEqual(battle["winner"], "portfolio1")
        self.assertGreater(battle["battle_scores"]["portfolio1"], battle["battle_scores"]["portfolio2"])
        self.assertEqual(len(battle["category_differences"]), 7)
        self.assertTrue(result["comparison_feedback"]["winner_reason"])

    def test_llm_explains_but_does_not_change_winner(self) -> None:
        evaluator = ComparisonEvaluator()
        result = analyze_portfolio_comparison(
            "https://github.com/team/strong", "https://github.com/team/weak", "backend",
            github_client=BattleClient(), llm_evaluator=evaluator, use_llm=True,
        )
        self.assertEqual(result["battle_result"]["winner"], "portfolio1")
        self.assertEqual(evaluator.battle_result["winner"], "portfolio1")
        self.assertEqual(result["feedback_source"], "llm")

    def test_comparison_llm_failure_falls_back(self) -> None:
        result = analyze_portfolio_comparison(
            "https://github.com/team/strong", "https://github.com/team/weak", "backend",
            github_client=BattleClient(), llm_evaluator=FailingComparisonEvaluator(), use_llm=True,
        )
        self.assertEqual(result["feedback_source"], "rules")
        self.assertEqual(result["battle_result"]["winner"], "portfolio1")

    def test_same_repository_variants_are_rejected_before_collection(self) -> None:
        client = BattleClient()
        with self.assertRaises(ValueError):
            analyze_portfolio_comparison(
                "https://github.com/TEAM/Project.git", "github.com/team/project/", "backend",
                github_client=client, use_llm=False,
            )
        self.assertEqual(client.calls, 0)

    def test_profile_and_repository_resolving_to_same_repo_are_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "resolved to the same repository"):
            analyze_portfolio_comparison(
                "https://github.com/team", "https://github.com/team/weak", "backend",
                github_client=BattleClient(), use_llm=False,
            )


if __name__ == "__main__":
    unittest.main()
