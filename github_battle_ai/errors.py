"""Domain errors raised by the portfolio analyzer."""


class AnalysisError(Exception):
    """Base exception for errors that should become an analysis failure response."""


class InvalidGitHubURLError(AnalysisError):
    """Raised when a URL is not a supported GitHub repository URL."""


class RepositoryAccessError(AnalysisError):
    """Raised when GitHub cannot return a public repository."""

