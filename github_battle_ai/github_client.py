"""Small GitHub REST client with no third-party runtime dependency."""

from __future__ import annotations

import base64
import json
import os
import re
import ssl
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

import certifi
from dotenv import load_dotenv

from .errors import InvalidGitHubURLError, RepositoryAccessError
from .models import RepoSnapshot


load_dotenv()


GITHUB_HOSTS = {"github.com", "www.github.com"}
TEXT_EXTENSIONS = {
    ".c", ".cc", ".cpp", ".cs", ".css", ".dart", ".ex", ".exs", ".go",
    ".graphql", ".h", ".hpp", ".html", ".java", ".js", ".jsx", ".kt",
    ".kts", ".md", ".php", ".properties", ".py", ".rb", ".rs", ".scala",
    ".sh", ".sql", ".swift", ".toml", ".ts", ".tsx", ".vue", ".xml",
    ".yaml", ".yml",
}
IMPORTANT_NAMES = {
    ".env.example", ".gitignore", "dockerfile", "docker-compose.yml",
    "docker-compose.yaml", "go.mod", "package.json", "pom.xml", "pyproject.toml",
    "requirements.txt", "cargo.toml", "gemfile", "build.gradle", "settings.gradle",
}
SKIP_PARTS = {
    ".git", ".next", ".venv", "build", "coverage", "dist", "node_modules",
    "target", "vendor", "venv",
}


def parse_github_url(github_url: str) -> tuple[str, str]:
    if not isinstance(github_url, str) or not github_url.strip():
        raise InvalidGitHubURLError("GitHub URL is required")

    candidate = github_url.strip()
    if not re.match(r"^https?://", candidate, re.IGNORECASE):
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in GITHUB_HOSTS:
        raise InvalidGitHubURLError("Only github.com repository URLs are supported")

    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) != 2:
        raise InvalidGitHubURLError("Use a repository URL such as https://github.com/owner/repo")
    owner, repo = parts
    if repo.endswith(".git"):
        repo = repo[:-4]
    valid = re.compile(r"^[A-Za-z0-9_.-]+$")
    if not owner or not repo or not valid.fullmatch(owner) or not valid.fullmatch(repo):
        raise InvalidGitHubURLError("The GitHub owner or repository name is invalid")
    return owner, repo


def parse_github_input(github_url: str) -> tuple[str, str | None]:
    """Parse either a GitHub profile URL or a public repository URL."""
    if not isinstance(github_url, str) or not github_url.strip():
        raise InvalidGitHubURLError("GitHub URL is required")
    candidate = github_url.strip()
    if not re.match(r"^https?://", candidate, re.IGNORECASE):
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in GITHUB_HOSTS:
        raise InvalidGitHubURLError("Only github.com profile or repository URLs are supported")
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) not in {1, 2}:
        raise InvalidGitHubURLError("Use a GitHub profile URL or repository URL")
    valid = re.compile(r"^[A-Za-z0-9_.-]+$")
    owner = parts[0]
    repo = parts[1] if len(parts) == 2 else None
    if repo and repo.endswith(".git"):
        repo = repo[:-4]
    if not valid.fullmatch(owner) or (repo is not None and (not repo or not valid.fullmatch(repo))):
        raise InvalidGitHubURLError("The GitHub owner or repository name is invalid")
    return owner, repo


class GitHubClient:
    def __init__(self, token: str | None = None, timeout: float = 15.0) -> None:
        self.token = token if token is not None else os.getenv("GITHUB_TOKEN")
        self.timeout = timeout
        # python.org macOS builds may not be connected to the system keychain.
        # certifi keeps certificate verification enabled and makes local/dev runs reliable.
        self.ssl_context = ssl.create_default_context(cafile=certifi.where())

    def _request_json(self, path: str) -> tuple[Any, dict[str, str]]:
        url = path if path.startswith("https://") else f"https://api.github.com{path}"
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "github-battle-analyzer/1.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = Request(url, headers=headers)
        try:
            with urlopen(request, timeout=self.timeout, context=self.ssl_context) as response:
                body = json.loads(response.read().decode("utf-8"))
                return body, dict(response.headers.items())
        except HTTPError as exc:
            if exc.code in {401, 403}:
                message = "GitHub access was denied or the API rate limit was exceeded"
            elif exc.code == 404:
                message = "Repository not found or it is private"
            else:
                message = f"GitHub returned HTTP {exc.code}"
            raise RepositoryAccessError(message) from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RepositoryAccessError("Could not read repository data from GitHub") from exc

    def _optional_json(self, path: str, default: Any) -> Any:
        try:
            return self._request_json(path)[0]
        except RepositoryAccessError:
            return default

    def _count_endpoint(self, path: str) -> int:
        """Count a paginated GitHub endpoint using its last-page Link header."""
        separator = "&" if "?" in path else "?"
        data, headers = self._request_json(f"{path}{separator}per_page=1")
        link = headers.get("Link", headers.get("link", ""))
        last = re.search(r"[?&]page=(\d+)[^>]*>;\s*rel=\"last\"", link)
        if last:
            return int(last.group(1))
        return len(data) if isinstance(data, list) else 0

    def _representative_repo(self, owner: str) -> str:
        repositories = self._request_json(
            f"/users/{owner}/repos?type=owner&sort=pushed&direction=desc&per_page=100"
        )[0]
        if not isinstance(repositories, list):
            raise RepositoryAccessError("Could not read the user's public repositories")
        candidates = [
            item for item in repositories
            if isinstance(item, dict)
            and not item.get("private")
            and not item.get("fork")
            and not item.get("archived")
            and item.get("name")
        ]
        project_candidates = [
            item for item in candidates
            if str(item.get("name") or "").lower() != owner.lower()
        ]
        if project_candidates:
            candidates = project_candidates
        if not candidates:
            candidates = [
                item for item in repositories
                if isinstance(item, dict) and not item.get("private") and item.get("name")
            ]
        if not candidates:
            raise RepositoryAccessError("The GitHub profile has no public repository to analyze")
        representative = max(
            candidates,
            key=lambda item: (
                int(item.get("stargazers_count") or 0),
                int(item.get("forks_count") or 0),
                int(item.get("size") or 0),
                str(item.get("pushed_at") or ""),
                str(item.get("name") or "").lower(),
            ),
        )
        return str(representative["name"])

    def _file_content(self, owner: str, repo: str, path: str, ref: str) -> str:
        encoded_path = quote(path, safe="/")
        data = self._optional_json(
            f"/repos/{owner}/{repo}/contents/{encoded_path}?ref={quote(ref)}", {}
        )
        if not isinstance(data, dict) or data.get("encoding") != "base64":
            return ""
        try:
            decoded = base64.b64decode(data.get("content", ""), validate=False)
            return decoded.decode("utf-8", errors="replace")
        except (ValueError, TypeError):
            return ""

    @staticmethod
    def _sample_paths(files: list[str], sizes: dict[str, int], limit: int = 16) -> list[str]:
        eligible: list[str] = []
        for path in files:
            lowered = path.lower()
            parts = set(lowered.split("/"))
            name = lowered.rsplit("/", 1)[-1]
            extension = "." + name.rsplit(".", 1)[-1] if "." in name else ""
            if parts & SKIP_PARTS or sizes.get(path, 0) > 80_000:
                continue
            if name.startswith("readme"):
                continue
            if extension in TEXT_EXTENSIONS or name in IMPORTANT_NAMES or ".github/workflows/" in lowered:
                eligible.append(path)

        def priority(path: str) -> tuple[int, int, str]:
            lower = path.lower()
            name = lower.rsplit("/", 1)[-1]
            if name in IMPORTANT_NAMES:
                group = 0
            elif "test" in lower or "spec" in lower:
                group = 1
            elif lower.startswith(("src/", "app/", "server/", "backend/", "frontend/")):
                group = 2
            else:
                group = 3
            return group, lower.count("/"), lower

        return sorted(eligible, key=priority)[:limit]

    def collect(self, github_url: str) -> RepoSnapshot:
        owner, repo = parse_github_input(github_url)
        profile_data, _ = self._request_json(f"/users/{owner}")
        if not isinstance(profile_data, dict):
            raise RepositoryAccessError("Could not read the GitHub profile")
        if repo is None:
            repo = self._representative_repo(owner)
        repo_data, _ = self._request_json(f"/repos/{owner}/{repo}")
        if not isinstance(repo_data, dict) or repo_data.get("private"):
            raise RepositoryAccessError("Only public GitHub repositories are supported")

        branch = str(repo_data.get("default_branch") or "main")
        # Independent GitHub endpoints are fetched concurrently so one slow API call
        # does not multiply the complete analysis time.
        requests = {
            "tree": (f"/repos/{owner}/{repo}/git/trees/{quote(branch)}?recursive=1", {"tree": []}),
            "readme": (f"/repos/{owner}/{repo}/readme", {}),
            "languages": (f"/repos/{owner}/{repo}/languages", {}),
            "commits": (f"/repos/{owner}/{repo}/commits?per_page=100", []),
            "issues": (f"/repos/{owner}/{repo}/issues?state=all&per_page=100", []),
        }
        with ThreadPoolExecutor(max_workers=len(requests)) as executor:
            futures = {
                key: executor.submit(self._optional_json, path, default)
                for key, (path, default) in requests.items()
            }
            collected = {key: future.result() for key, future in futures.items()}

        tree_data = collected["tree"]
        tree = tree_data.get("tree", []) if isinstance(tree_data, dict) else []
        blobs = [item for item in tree if item.get("type") == "blob" and item.get("path")]
        files = [str(item["path"]) for item in blobs]
        sizes = {str(item["path"]): int(item.get("size") or 0) for item in blobs}

        readme_data = collected["readme"]
        readme = ""
        if isinstance(readme_data, dict) and readme_data.get("encoding") == "base64":
            try:
                readme = base64.b64decode(readme_data.get("content", "")).decode(
                    "utf-8", errors="replace"
                )
            except (ValueError, TypeError):
                readme = ""

        languages = collected["languages"]
        commits = collected["commits"]
        issues = collected["issues"]
        issue_count = len([
            item for item in issues
            if isinstance(item, dict) and "pull_request" not in item
        ]) if isinstance(issues, list) else 0
        issue_query = quote(f"repo:{owner}/{repo} type:issue")
        issue_search = self._optional_json(f"/search/issues?q={issue_query}&per_page=1", {})
        if isinstance(issue_search, dict) and isinstance(issue_search.get("total_count"), int):
            issue_count = int(issue_search["total_count"])
        count_paths = {
            "pulls": f"/repos/{owner}/{repo}/pulls?state=all",
            "branches": f"/repos/{owner}/{repo}/branches",
            "contributors": f"/repos/{owner}/{repo}/contributors?anon=true",
            "releases": f"/repos/{owner}/{repo}/releases",
        }
        with ThreadPoolExecutor(max_workers=len(count_paths)) as executor:
            count_futures = {
                key: executor.submit(self._count_endpoint, path)
                for key, path in count_paths.items()
            }
            counts: dict[str, int] = {}
            for key, future in count_futures.items():
                try:
                    counts[key] = future.result()
                except RepositoryAccessError:
                    counts[key] = 0
        commit_count = len(commits) if isinstance(commits, list) else 0
        if commit_count == 100:
            try:
                commit_count = self._count_endpoint(f"/repos/{owner}/{repo}/commits")
            except RepositoryAccessError:
                pass
        sample_paths = self._sample_paths(files, sizes)
        with ThreadPoolExecutor(max_workers=min(8, max(1, len(sample_paths)))) as executor:
            sampled = list(
                executor.map(
                    lambda path: self._file_content(owner, repo, path, branch),
                    sample_paths,
                )
            )
        contents = {path: content for path, content in zip(sample_paths, sampled) if content}

        workflows = [path for path in files if path.lower().startswith(".github/workflows/")]
        license_data = repo_data.get("license") or {}
        events = self._optional_json(f"/users/{owner}/events/public?per_page=1", [])
        latest_event_at = ""
        if isinstance(events, list) and events and isinstance(events[0], dict):
            latest_event_at = str(events[0].get("created_at") or "")
        activity_candidates = [
            str(profile_data.get("updated_at") or ""),
            str(repo_data.get("pushed_at") or ""),
            str(repo_data.get("updated_at") or ""),
            latest_event_at,
        ]
        commit_messages = []
        if isinstance(commits, list):
            for item in commits:
                if not isinstance(item, dict):
                    continue
                commit = item.get("commit") or {}
                message = str(commit.get("message") or "").splitlines()[0].strip()
                if message:
                    commit_messages.append(message)
        return RepoSnapshot(
            owner=owner,
            name=repo,
            html_url=str(repo_data.get("html_url") or github_url),
            username=str(profile_data.get("login") or owner),
            public_repo_count=int(profile_data.get("public_repos") or 0),
            followers=int(profile_data.get("followers") or 0),
            following=int(profile_data.get("following") or 0),
            recent_activity_at=max(activity_candidates),
            description=str(repo_data.get("description") or ""),
            default_branch=branch,
            stars=int(repo_data.get("stargazers_count") or 0),
            forks=int(repo_data.get("forks_count") or 0),
            open_issues=issue_count,
            license_name=str(license_data.get("spdx_id") or ""),
            topics=list(repo_data.get("topics") or []),
            homepage=str(repo_data.get("homepage") or ""),
            languages=languages if isinstance(languages, dict) else {},
            files=files,
            file_sizes=sizes,
            sampled_contents=contents,
            readme=readme,
            commit_count=commit_count,
            commit_messages=commit_messages,
            pull_request_count=counts["pulls"],
            workflow_count=len(workflows),
            branch_count=counts["branches"],
            contributor_count=counts["contributors"],
            release_count=counts["releases"],
        )
