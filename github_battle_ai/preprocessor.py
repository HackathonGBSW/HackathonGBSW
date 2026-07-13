"""Normalize collected GitHub data into the deterministic analysis JSON."""

from __future__ import annotations

from typing import Any

from .models import RepoSnapshot


TECH_MARKERS = {
    "React": ("react", "jsx", "tsx"),
    "Vue": ("vue",),
    "Next.js": ("next.config", "next/"),
    "FastAPI": ("fastapi",),
    "Django": ("django", "manage.py"),
    "Flask": ("flask",),
    "Spring": ("spring", "build.gradle", "pom.xml"),
    "Node.js": ("package.json", "node"),
    "Docker": ("dockerfile", "docker-compose"),
    "PostgreSQL": ("postgres", "psycopg"),
    "MySQL": ("mysql",),
    "MongoDB": ("mongodb", "mongoose"),
    "Redis": ("redis",),
    "PyTorch": ("torch", "pytorch"),
    "TensorFlow": ("tensorflow",),
}


def preprocess_snapshot(repo: RepoSnapshot) -> dict[str, Any]:
    text = ("\n".join(repo.files) + "\n" + repo.combined_text(max_chars=150_000)).lower()
    technology_stack = sorted(
        technology
        for technology, markers in TECH_MARKERS.items()
        if any(marker in text for marker in markers)
    )
    lower_files = [path.lower() for path in repo.files]
    has_tests = any(
        "/test" in f"/{path}" or "__tests__" in path or "spec." in path or "test." in path
        for path in lower_files
    )
    deployment_markers = (
        "dockerfile", "vercel.json", "netlify.toml", "render.yaml",
        "railway.json", "fly.toml", "procfile", "serverless.yml",
    )
    has_deployment_config = any(
        any(marker in path for marker in deployment_markers) for path in lower_files
    )
    total_language_bytes = float(sum(repo.languages.values()))
    language_statistics = [
        {
            "language": str(language),
            "bytes": int(byte_count),
            "percentage": round(float(byte_count) / total_language_bytes * 100, 2)
            if total_language_bytes else 0.0,
        }
        for language, byte_count in sorted(
            repo.languages.items(), key=lambda item: item[1], reverse=True
        )
    ]
    return {
        "user": {
            "username": repo.username or repo.owner,
            "public_repository_count": repo.public_repo_count,
            "followers": repo.followers,
            "following": repo.following,
            "recent_activity_at": repo.recent_activity_at,
        },
        "repository": {
            "name": repo.name,
            "description": repo.description,
            "url": repo.html_url,
            "default_branch": repo.default_branch,
            "recent_activity_at": repo.recent_activity_at,
            "languages": repo.languages,
            "language_statistics": language_statistics,
            "technology_stack": technology_stack,
            "commit_count": repo.commit_count,
            "branch_count": repo.branch_count,
            "pull_request_count": repo.pull_request_count,
            "issue_count": repo.open_issues,
            "stars": repo.stars,
            "forks": repo.forks,
            "contributor_count": repo.contributor_count,
            "has_release": repo.release_count > 0,
            "release_count": repo.release_count,
            "has_github_actions": repo.workflow_count > 0,
            "github_actions_count": repo.workflow_count,
            "topics": repo.topics,
            "license": repo.license_name,
            "homepage": repo.homepage,
            "has_readme": bool(repo.readme.strip()),
            "has_tests": has_tests,
            "has_deployment_config": has_deployment_config,
            "file_count": len(repo.files),
        },
    }
