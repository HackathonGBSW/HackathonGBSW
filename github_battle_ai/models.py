"""Internal data structures used by collectors and scorers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class RepoSnapshot:
    owner: str
    name: str
    html_url: str
    username: str = ""
    public_repo_count: int = 0
    followers: int = 0
    following: int = 0
    recent_activity_at: str = ""
    description: str = ""
    default_branch: str = "main"
    stars: int = 0
    forks: int = 0
    open_issues: int = 0
    license_name: str = ""
    topics: list[str] = field(default_factory=list)
    homepage: str = ""
    languages: dict[str, int] = field(default_factory=dict)
    files: list[str] = field(default_factory=list)
    file_sizes: dict[str, int] = field(default_factory=dict)
    sampled_contents: dict[str, str] = field(default_factory=dict)
    readme: str = ""
    commit_count: int = 0
    commit_messages: list[str] = field(default_factory=list)
    pull_request_count: int = 0
    workflow_count: int = 0
    branch_count: int = 0
    contributor_count: int = 0
    release_count: int = 0

    def combined_text(self, *, max_chars: int = 250_000) -> str:
        chunks = [self.readme]
        for path, content in self.sampled_contents.items():
            chunks.append(f"\nFILE: {path}\n{content}")
            if sum(map(len, chunks)) >= max_chars:
                break
        return "".join(chunks)[:max_chars]


@dataclass(slots=True)
class CategoryAssessment:
    score: float
    evidence: list[str]


@dataclass(slots=True)
class AnalysisDetails:
    raw_scores: dict[str, float]
    weighted_scores: dict[str, float]
    evidence: dict[str, list[str]]
    feedback_good: str
    feedback_improve: str
    repository: dict[str, Any]
    total_score: float
    rank: str
    category_feedback: dict[str, Any]
    overall_feedback: dict[str, Any]
    github_data: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "raw_scores": self.raw_scores,
            "weighted_scores": self.weighted_scores,
            "evidence": self.evidence,
            "feedback_good": self.feedback_good,
            "feedback_improve": self.feedback_improve,
            "repository": self.repository,
            "total_score": self.total_score,
            "rank": self.rank,
            "category_feedback": self.category_feedback,
            "overall_feedback": self.overall_feedback,
            "github_data": self.github_data,
        }
