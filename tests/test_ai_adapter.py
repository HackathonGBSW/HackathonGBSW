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

    def test_blank_field_raises_analysis_error_not_value_error(self) -> None:
        with patch(
            "llm_analyzer.analyze_repo_detailed",
            side_effect=ValueError("field is required"),
        ):
            with self.assertRaises(llm_analyzer.AnalysisError):
                llm_analyzer.analyze_portfolio("https://github.com/team/project", "  ")

    def test_same_repository_battle_raises_analysis_error_not_value_error(self) -> None:
        with patch(
            "llm_analyzer.analyze_portfolio_comparison",
            side_effect=ValueError("The two GitHub inputs resolved to the same repository"),
        ):
            with self.assertRaises(llm_analyzer.AnalysisError):
                llm_analyzer.compare_portfolios(
                    "https://github.com/team/project",
                    "https://github.com/team/project.git",
                    "backend",
                )

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


class PlayerTierTests(unittest.TestCase):
    """llm_analyzer.player_tier_for_score: fixed Bronze..Diamond ladder plus
    the Junior/Middle/Senior bands, which are gated by BOTH a score floor
    and a leaderboard rank_position cap (top 1000/800/300)."""

    def test_fixed_tier_boundaries_use_per_material_spacing(self) -> None:
        # Bronze=30/division, Silver=40, Gold=60, Platinum=70, Diamond=100.
        cases = [
            (0, "Bronze 4"), (29, "Bronze 4"), (30, "Bronze 3"),
            (89, "Bronze 2"), (90, "Bronze 1"), (119, "Bronze 1"),
            (120, "Silver 4"), (239, "Silver 2"), (240, "Silver 1"),
            (280, "Gold 4"), (459, "Gold 2"), (460, "Gold 1"),
            (520, "Platinum 4"), (729, "Platinum 2"), (730, "Platinum 1"),
            (800, "Diamond 4"), (1099, "Diamond 2"), (1100, "Diamond 1"),
            (1199, "Diamond 1"),
        ]
        for score, expected in cases:
            with self.subTest(score=score):
                self.assertEqual(
                    llm_analyzer.player_tier_for_score(score, rank_position=1)["label"],
                    expected,
                )

    def test_newbie_tier_is_gone(self) -> None:
        labels = [t[2] for t in llm_analyzer.FIXED_PLAYER_TIERS] + [
            t[1] for t in llm_analyzer.ELITE_TIERS
        ]
        self.assertNotIn("신입", labels)
        self.assertNotIn("newbie", [t[0] for t in llm_analyzer.ELITE_TIERS])

    def test_elite_tiers_require_score_and_rank_position(self) -> None:
        # Score alone clears Junior (>=1200), but rank_position 5000 is
        # outside every cap -> held at Diamond 1, not promoted.
        held = llm_analyzer.player_tier_for_score(1200, rank_position=5000)
        self.assertEqual(held["label"], "Diamond 1")
        self.assertEqual(held["next_label"], "Junior")
        self.assertEqual(held["progress_percent"], 100.0)

        self.assertEqual(
            llm_analyzer.player_tier_for_score(1200, rank_position=1000)["label"], "Junior"
        )
        # Clears Middle's score floor but not its rank cap (800) -> falls
        # back to Junior rather than jumping straight to capped-Diamond-1.
        self.assertEqual(
            llm_analyzer.player_tier_for_score(2200, rank_position=900)["label"], "Junior"
        )
        self.assertEqual(
            llm_analyzer.player_tier_for_score(2200, rank_position=800)["label"], "Middle"
        )
        # Clears Senior's score floor but not its rank cap (300) -> falls
        # back to Middle.
        self.assertEqual(
            llm_analyzer.player_tier_for_score(3700, rank_position=500)["label"], "Middle"
        )
        self.assertEqual(
            llm_analyzer.player_tier_for_score(3700, rank_position=300)["label"], "Senior"
        )

    def test_huge_score_still_capped_by_rank_position(self) -> None:
        # An arbitrarily high score never bypasses the population caps.
        self.assertEqual(
            llm_analyzer.player_tier_for_score(50_000, rank_position=1001)["label"],
            "Diamond 1",
        )
        self.assertEqual(
            llm_analyzer.player_tier_for_score(50_000, rank_position=301)["label"],
            "Middle",
        )

    def test_tier_indices_are_contiguous_for_matchmaking(self) -> None:
        diamond1 = llm_analyzer.player_tier_for_score(1100, rank_position=1)
        junior = llm_analyzer.player_tier_for_score(1200, rank_position=1)
        middle = llm_analyzer.player_tier_for_score(2200, rank_position=1)
        senior = llm_analyzer.player_tier_for_score(3700, rank_position=1)
        self.assertEqual(
            [diamond1["index"], junior["index"], middle["index"], senior["index"]],
            [19, 20, 21, 22],
        )
        self.assertEqual(llm_analyzer.player_tier_diff(diamond1["index"], junior["index"]), 1)
        self.assertEqual(llm_analyzer.player_tier_diff(junior["index"], senior["index"]), 2)


if __name__ == "__main__":
    unittest.main()
