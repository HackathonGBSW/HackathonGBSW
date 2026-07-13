"""Evidence-based MVP scorer implementing EVALUATION_RUBRIC.md."""

from __future__ import annotations

import re
from collections.abc import Iterable

from .models import CategoryAssessment, RepoSnapshot


CATEGORIES = ("completeness", "structure", "tech", "docs", "test", "deploy", "github")
WEIGHTS = {
    "completeness": 3.0,
    "structure": 1.0,
    "tech": 1.5,
    "docs": 0.5,
    "test": 0.5,
    "deploy": 1.5,
    "github": 2.0,
}
MAX_WEIGHTED = {category: 10.0 * weight for category, weight in WEIGHTS.items()}

SOURCE_EXTENSIONS = {
    ".c", ".cc", ".cpp", ".cs", ".dart", ".ex", ".exs", ".go", ".java",
    ".js", ".jsx", ".kt", ".php", ".py", ".rb", ".rs", ".scala", ".swift",
    ".ts", ".tsx", ".vue",
}
MANIFEST_NAMES = {
    "package.json", "requirements.txt", "pyproject.toml", "pom.xml", "build.gradle",
    "cargo.toml", "go.mod", "gemfile", "composer.json", "pubspec.yaml",
}
DEPLOY_NAMES = {
    "dockerfile", "docker-compose.yml", "docker-compose.yaml", "vercel.json",
    "netlify.toml", "render.yaml", "fly.toml", "procfile", "app.yaml",
    "serverless.yml", "serverless.yaml", "railway.json",
}
FIELD_TERMS = {
    "backend": {"api", "database", "sql", "auth", "route", "controller", "service", "redis"},
    "백엔드": {"api", "database", "sql", "auth", "route", "controller", "service", "redis"},
    "frontend": {"component", "router", "state", "react", "vue", "svelte", "css", "accessibility"},
    "프론트엔드": {"component", "router", "state", "react", "vue", "svelte", "css", "accessibility"},
    "ai": {"model", "inference", "embedding", "prompt", "torch", "tensorflow", "transformers", "dataset"},
    "인공지능": {"model", "inference", "embedding", "prompt", "torch", "tensorflow", "transformers", "dataset"},
    "data": {"dataset", "pipeline", "pandas", "spark", "etl", "visualization", "analysis"},
    "데이터": {"dataset", "pipeline", "pandas", "spark", "etl", "visualization", "analysis"},
    "mobile": {"android", "ios", "flutter", "react native", "swift", "kotlin", "navigation"},
    "모바일": {"android", "ios", "flutter", "react native", "swift", "kotlin", "navigation"},
    "devops": {"docker", "kubernetes", "terraform", "pipeline", "monitoring", "deployment", "cloud"},
    "데브옵스": {"docker", "kubernetes", "terraform", "pipeline", "monitoring", "deployment", "cloud"},
    "fullstack": {
        "api", "database", "auth", "route", "service", "component", "router", "state", "css",
    },
    "풀스택": {
        "api", "database", "auth", "route", "service", "component", "router", "state", "css",
    },
    "cybersecurity": {
        "security", "exploit", "vulnerability", "cve", "pwn", "fuzz", "reverse", "crypt", "payload",
    },
    "security": {
        "security", "exploit", "vulnerability", "cve", "pwn", "fuzz", "reverse", "crypt", "payload",
    },
    "보안": {
        "security", "exploit", "vulnerability", "cve", "pwn", "fuzz", "reverse", "crypt", "payload",
    },
}


def _name(path: str) -> str:
    return path.lower().rsplit("/", 1)[-1]


def _extension(path: str) -> str:
    name = _name(path)
    return "." + name.rsplit(".", 1)[-1] if "." in name else ""


def _has_name(files: Iterable[str], names: set[str]) -> bool:
    return any(_name(path) in names for path in files)


def _has_path_term(files: Iterable[str], terms: Iterable[str]) -> bool:
    lowered_terms = tuple(term.lower() for term in terms)
    return any(any(term in path.lower() for term in lowered_terms) for path in files)


def _bounded(score: float) -> float:
    return round(max(0.0, min(10.0, score)) * 2) / 2


def _assessment(score: float, evidence: list[str], fallback: str) -> CategoryAssessment:
    return CategoryAssessment(_bounded(score), evidence or [fallback])


def _completeness(repo: RepoSnapshot, text: str) -> CategoryAssessment:
    source_files = [path for path in repo.files if _extension(path) in SOURCE_EXTENSIONS]
    score = 0.0
    evidence: list[str] = []
    if source_files:
        score += 1.0
        evidence.append(f"분석 가능한 소스 파일 {len(source_files)}개가 확인됨")
    if len(source_files) >= 5:
        score += 1.5
    if len(source_files) >= 15:
        score += 1.0
    if _has_name(repo.files, MANIFEST_NAMES):
        score += 1.0
        evidence.append("의존성 또는 빌드 설정 파일이 존재함")
    functional_groups = {
        "API·라우팅": ("route", "router", "controller", "endpoint", "@app.", "@router"),
        "데이터 저장": ("model", "repository", "database", "sqlalchemy", "mongoose", "prisma", "jdbc"),
        "인증·권한": ("auth", "login", "signin", "jwt", "session", "permission"),
        "입력·예외 처리": ("validate", "schema", "exception", "errorhandler", "try:", "catch ("),
    }
    found = []
    for label, terms in functional_groups.items():
        if any(term in text for term in terms):
            score += 1.0
            found.append(label)
    if found:
        evidence.append(f"구현 요소 확인: {', '.join(found)}")
    if _has_path_term(repo.files, (".env.example", "config", "settings")):
        score += 0.5
        evidence.append("환경 또는 실행 설정이 분리되어 있음")
    if len(repo.readme) >= 500:
        score += 0.5
    return _assessment(score, evidence, "구현 완성도를 뒷받침할 충분한 소스 증거가 확인되지 않음")


def _structure(repo: RepoSnapshot, text: str) -> CategoryAssessment:
    source_files = [path for path in repo.files if _extension(path) in SOURCE_EXTENSIONS]
    score = 0.0
    evidence: list[str] = []
    if source_files:
        score += 2.0
    directories = {path.split("/", 1)[0] for path in source_files if "/" in path}
    if len(directories) >= 2:
        score += 1.0
    architecture_dirs = {
        "src", "app", "api", "components", "controllers", "models", "routes", "services",
        "repositories", "domain", "infrastructure", "utils", "config",
    }
    present = sorted({part for path in repo.files for part in path.lower().split("/")} & architecture_dirs)
    score += min(3.0, len(present) * 0.6)
    if present:
        evidence.append(f"역할을 나타내는 디렉터리 확인: {', '.join(present[:6])}")
    if _has_path_term(repo.files, ("config", "settings", ".env.example")):
        score += 1.0
        evidence.append("설정 관련 파일이 소스와 분리되어 있음")
    if any(term in text for term in ("interface ", "abstract ", "dependency", "service", "repository")):
        score += 1.0
        evidence.append("책임 또는 의존성 분리 패턴이 표본 코드에서 확인됨")
    large_files = [path for path in source_files if repo.file_sizes.get(path, 0) > 50_000]
    if len(source_files) >= 8 and not large_files:
        score += 1.0
    if large_files:
        score -= min(2.0, len(large_files) * 0.5)
        evidence.append(f"크기가 큰 소스 파일 {len(large_files)}개는 책임 분리 검토가 필요함")
    return _assessment(score, evidence, "코드 구조를 판단할 소스 파일이 확인되지 않음")


def _tech(repo: RepoSnapshot, field: str, text: str) -> CategoryAssessment:
    score = 0.0
    evidence: list[str] = []
    if repo.languages:
        score += 2.0
        names = list(repo.languages)[:5]
        evidence.append(f"사용 언어 확인: {', '.join(names)}")
    if _has_name(repo.files, MANIFEST_NAMES):
        score += 2.0
        evidence.append("기술 의존성이 선언된 빌드·패키지 파일이 존재함")
    integration_terms = {
        "데이터베이스": ("sqlalchemy", "prisma", "mongoose", "jdbc", "redis", "database"),
        "외부 API": ("requests.", "fetch(", "axios", "httpclient", "urlopen"),
        "보안·인증": ("jwt", "oauth", "bcrypt", "argon", "session"),
        "비동기·작업 처리": ("async ", "await ", "celery", "queue", "worker"),
        "컨테이너": ("docker", "container"),
    }
    found = []
    for label, terms in integration_terms.items():
        if any(term in text for term in terms):
            score += 0.8
            found.append(label)
    if found:
        evidence.append(f"실제 기술 적용 흔적: {', '.join(found)}")

    requested = field.strip().lower()
    terms = FIELD_TERMS.get(requested, {requested} if requested else set())
    matched = sorted(term for term in terms if term and term in text)
    score += min(2.0, len(matched) * 0.5)
    if matched:
        evidence.append(f"선택 분야({field}) 관련 구현 키워드 확인: {', '.join(matched[:6])}")
    if repo.workflow_count:
        score += 0.5
    return _assessment(score, evidence, "선택 분야에 해당하는 기술 활용 근거가 충분히 확인되지 않음")


def _docs(repo: RepoSnapshot) -> CategoryAssessment:
    readme = repo.readme
    lower = readme.lower()
    score = 0.0
    evidence: list[str] = []
    if readme.strip():
        score += 1.5
        evidence.append("README가 존재함")
    if len(readme) >= 500:
        score += 1.0
    if len(readme) >= 1500:
        score += 1.0
    sections = {
        "프로젝트 설명": ("소개", "about", "overview", "description"),
        "설치·실행": ("install", "설치", "실행", "getting started", "usage"),
        "주요 기능": ("기능", "feature"),
        "환경변수": ("환경변수", "environment", ".env"),
        "API·구조": ("api", "architecture", "아키텍처", "구조"),
        "테스트": ("test", "테스트"),
        "배포": ("deploy", "배포"),
    }
    found = [label for label, terms in sections.items() if any(term in lower for term in terms)]
    score += min(4.5, len(found) * 0.75)
    if found:
        evidence.append(f"README 설명 항목: {', '.join(found)}")
    if repo.license_name:
        score += 0.5
        evidence.append(f"라이선스가 명시됨({repo.license_name})")
    return _assessment(score, evidence, "README 또는 사용 문서가 확인되지 않음")


def _test(repo: RepoSnapshot, text: str) -> CategoryAssessment:
    test_files = [
        path for path in repo.files
        if re.search(r"(^|/)(tests?|__tests__|spec)(/|$)", path.lower())
        or re.search(r"(test|spec)\.[a-z0-9]+$", path.lower())
    ]
    score = 0.0
    evidence: list[str] = []
    if test_files:
        score += 2.0
        evidence.append(f"테스트 관련 파일 {len(test_files)}개가 확인됨")
    if len(test_files) >= 3:
        score += 1.5
    if len(test_files) >= 8:
        score += 1.0
    unit_tests = [path for path in test_files if "unit" in path.lower()]
    integration_tests = [
        path for path in test_files
        if any(term in path.lower() for term in ("integration", "e2e", "system"))
    ]
    if unit_tests:
        score += 0.5
        evidence.append(f"단위 테스트 파일 {len(unit_tests)}개가 확인됨")
    if integration_tests:
        score += 0.5
        evidence.append(f"통합·E2E 테스트 파일 {len(integration_tests)}개가 확인됨")
    if any(term in text for term in ("assert ", "assertequal", "expect(", "should(", "pytest", "unittest")):
        score += 1.5
        evidence.append("실제 검증 구문이 표본 테스트 코드에서 확인됨")
    if any(term in text for term in ("mock", "fixture", "beforeeach", "setup(")):
        score += 1.0
        evidence.append("fixture 또는 mock을 활용한 테스트 구성이 확인됨")
    workflow_text = " ".join(path.lower() for path in repo.files if ".github/workflows/" in path.lower())
    if repo.workflow_count and ("test" in workflow_text or "ci" in workflow_text or "test" in text):
        score += 2.0
        evidence.append("GitHub Actions를 통한 테스트 자동화 가능성이 확인됨")
    return _assessment(score, evidence, "자동화된 테스트 코드가 확인되지 않음")


def _deploy(repo: RepoSnapshot, text: str) -> CategoryAssessment:
    deploy_files = [path for path in repo.files if _name(path) in DEPLOY_NAMES]
    score = 0.0
    evidence: list[str] = []
    if deploy_files:
        score += 3.0
        evidence.append(f"배포 설정 파일 확인: {', '.join(deploy_files[:4])}")
    if any(_name(path) == "dockerfile" for path in repo.files):
        score += 1.0
    if repo.homepage:
        score += 2.0
        evidence.append(f"저장소 홈페이지 또는 배포 주소가 등록됨: {repo.homepage}")
    readme_urls = re.findall(r"https?://[^\s)>\]]+", repo.readme)
    non_github_urls = [url for url in readme_urls if "github.com" not in url]
    if non_github_urls:
        score += 1.0
        evidence.append("README에서 외부 서비스 주소가 확인됨")
    if repo.workflow_count:
        score += 1.5
        evidence.append(f"GitHub Actions 워크플로 {repo.workflow_count}개가 존재함")
    if any(term in text for term in ("deploy", "deployment", "release", "production")):
        score += 1.0
    if any(term in text for term in ("health", "monitor", "sentry", "logging", "prometheus")):
        score += 0.5
        evidence.append("상태 확인, 로그 또는 모니터링 관련 설정이 확인됨")
    return _assessment(score, evidence, "배포 주소나 배포 설정이 확인되지 않음")


def _github(repo: RepoSnapshot) -> CategoryAssessment:
    score = 0.0
    evidence: list[str] = []
    commits = repo.commit_count
    if commits >= 2:
        score += 1.0
    if commits >= 5:
        score += 1.0
    if commits >= 15:
        score += 1.0
    if commits >= 40:
        score += 0.5
    if commits:
        evidence.append(f"최근 조회 범위에서 커밋 {commits}개가 확인됨")
    generic_messages = {"update", "fix", "test", "init", "initial commit", "wip"}
    meaningful = [
        message for message in repo.commit_messages
        if len(message) >= 12 and message.strip().lower() not in generic_messages
    ]
    if meaningful:
        ratio = len(meaningful) / max(1, len(repo.commit_messages))
        score += min(1.0, ratio)
        evidence.append(f"설명형 커밋 메시지 {len(meaningful)}개가 확인됨")
    if repo.branch_count >= 2:
        score += 0.5
        evidence.append(f"브랜치 {repo.branch_count}개를 활용함")
    if _has_name(repo.files, {".gitignore"}):
        score += 1.0
        evidence.append(".gitignore가 설정되어 있음")
    if repo.workflow_count:
        score += 1.5
        evidence.append(f"GitHub Actions 워크플로 {repo.workflow_count}개를 활용함")
    if repo.pull_request_count:
        score += min(2.0, 0.5 + repo.pull_request_count * 0.15)
        evidence.append(f"PR 기록 {repo.pull_request_count}개가 확인됨")
    if repo.open_issues:
        score += 0.5
        evidence.append("Issue를 통한 작업 관리 흔적이 확인됨")
    if repo.release_count:
        score += 0.5
        evidence.append(f"Release {repo.release_count}개가 확인됨")
    if repo.contributor_count >= 2:
        score += 0.5
        evidence.append(f"Contributor {repo.contributor_count}명이 참여함")
    if repo.stars or repo.forks:
        score += min(0.5, (repo.stars + repo.forks) * 0.05)
        evidence.append(f"Star {repo.stars}개, Fork {repo.forks}개가 확인됨")
    if repo.license_name:
        score += 0.5
    if _has_path_term(repo.files, ("contributing", "pull_request_template", "issue_template")):
        score += 1.0
        evidence.append("기여 또는 Issue·PR 템플릿이 존재함")
    return _assessment(score, evidence, "의미 있는 GitHub 개발 이력을 충분히 확인하지 못함")


def score_repository(repo: RepoSnapshot, field: str) -> dict[str, CategoryAssessment]:
    """Return 0-10 category scores plus concrete evidence."""
    text = repo.combined_text().lower()
    return {
        "completeness": _completeness(repo, text),
        "structure": _structure(repo, text),
        "tech": _tech(repo, field, text),
        "docs": _docs(repo),
        "test": _test(repo, text),
        "deploy": _deploy(repo, text),
        "github": _github(repo),
    }


def weighted_scores(assessments: dict[str, CategoryAssessment]) -> dict[str, float]:
    return {
        category: round(assessments[category].score * WEIGHTS[category], 2)
        for category in CATEGORIES
    }
