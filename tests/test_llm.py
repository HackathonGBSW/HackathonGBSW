from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from github_battle_ai.analyzer import analyze_snapshot
from github_battle_ai.llm import (
    OpenAIPortfolioEvaluator,
    PortfolioComparisonFeedback,
    PortfolioLLMFeedback,
    UserComparisonFeedback,
)
from github_battle_ai.scorer import score_repository, weighted_scores
from tests.test_analyzer import feedback_result, rich_snapshot


def comparison_feedback() -> PortfolioComparisonFeedback:
    user = lambda prefix: UserComparisonFeedback(
        good_points=[f"{prefix} 좋은 점"], improvement_points=[f"{prefix} 개선점"],
        lacking_compared_to_opponent=[f"{prefix} 상대 대비 부족"],
        recommended_technologies=["Docker"], learning_direction=["테스트 학습"],
    )
    return PortfolioComparisonFeedback(
        winner_reason=["규칙 점수 차이 합계가 더 높습니다."],
        portfolio1=user("첫 번째"), portfolio2=user("두 번째"),
        overall_comparison="규칙 기반으로 확정된 결과를 비교한 종합 설명입니다.",
    )


class LLMTests(unittest.TestCase):
    def test_openai_evaluator_requests_feedback_schema_without_scores(self) -> None:
        client = MagicMock()
        client.responses.parse.return_value = SimpleNamespace(output_parsed=feedback_result())
        evaluator = OpenAIPortfolioEvaluator(client=client, model="test-model")
        repo = rich_snapshot()
        assessments = score_repository(repo, "backend")
        weighted = weighted_scores(assessments)
        result = evaluator.evaluate(repo, "backend", assessments, weighted, 85, "B")
        self.assertIsInstance(result, PortfolioLLMFeedback)
        kwargs = client.responses.parse.call_args.kwargs
        self.assertIs(kwargs["text_format"], PortfolioLLMFeedback)
        prompt = kwargs["input"][0]["content"] + kwargs["input"][1]["content"]
        self.assertIn("점수를 수정", prompt)
        self.assertNotIn("각각 0~10점으로 평가", prompt)

    def test_comparison_explains_precalculated_winner(self) -> None:
        client = MagicMock()
        client.responses.parse.return_value = SimpleNamespace(output_parsed=comparison_feedback())
        evaluator = OpenAIPortfolioEvaluator(client=client, model="test-model")
        details = analyze_snapshot(rich_snapshot(), "backend").to_dict()
        battle = {"winner": "portfolio1", "battle_scores": {"portfolio1": 4, "portfolio2": 1}}
        result = evaluator.compare("backend", details, details, battle)
        self.assertTrue(result.winner_reason)
        kwargs = client.responses.parse.call_args.kwargs
        self.assertIs(kwargs["text_format"], PortfolioComparisonFeedback)
        self.assertIn("승자와 패자를 변경하지 않는다", kwargs["input"][0]["content"])


if __name__ == "__main__":
    unittest.main()
