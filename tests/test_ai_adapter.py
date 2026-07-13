from __future__ import annotations

import unittest
from unittest.mock import patch

import llm_analyzer


class AIAdapterTests(unittest.TestCase):
    def test_single_analysis_maps_to_existing_flask_contract(self) -> None:
        detailed = {
            "weighted_scores": {
                "completeness": 24, "structure": 8, "tech": 12,
                "docs": 4, "test": 3, "deploy": 12, "github": 16,
            },
            "total_score": 79,
            "rank": "C",
            "feedback_good": "좋은 점",
            "feedback_improve": "개선할 점",
        }
        with patch("llm_analyzer.analyze_repo_detailed", return_value=detailed):
            result = llm_analyzer.analyze_portfolio(
                "https://github.com/team/project", "backend"
            )
        self.assertEqual(result["score"], 79)
        self.assertEqual(result["rank"], "C")
        self.assertEqual(result["completeness_score"], 24)
        self.assertEqual(result["structur_score"], 8)

    def test_comparison_maps_to_existing_battle_contract(self) -> None:
        raw1 = {key: 8 for key in (
            "completeness", "structure", "tech", "docs", "test", "deploy", "github"
        )}
        raw2 = {key: 5 for key in raw1}
        compared = {
            "portfolio1": {"raw_scores": raw1},
            "portfolio2": {"raw_scores": raw2},
            "comparison_feedback": {
                "portfolio1": {
                    "good_points": ["강점"], "improvement_points": ["개선"],
                    "learning_direction": ["학습"],
                },
                "portfolio2": {
                    "good_points": ["장점"], "improvement_points": ["보완"],
                    "learning_direction": ["연습"],
                },
            },
        }
        with patch("llm_analyzer.analyze_portfolio_comparison", return_value=compared):
            result = llm_analyzer.compare_portfolios("repo1", "repo2", "backend")
        self.assertEqual(result["scores1"], raw1)
        self.assertEqual(result["scores2"], raw2)
        self.assertIn("강점", result["feedback1"])
        self.assertIn("보완", result["feedback2"])


if __name__ == "__main__":
    unittest.main()
