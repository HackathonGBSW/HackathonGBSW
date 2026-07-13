const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/**
 * Only http(s) URLs are safe to use as an anchor href. Without this check a
 * profile's github_url (attacker-controlled, stored server-side) could be set
 * to a `javascript:` URI and execute script in any visitor's browser when
 * they click the rendered link.
 */
export function toSafeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
  } = {},
): Promise<T> {
  const { method = "GET", body } = options;
  const headers: HeadersInit = {};
  let payload: BodyInit | undefined;

  if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: payload,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export type Rank = "S" | "A" | "B" | "C" | "D" | "E" | "F";

export interface Profile {
  username: string;
  main_field: string | null;
  github_url: string | null;
  player_rank: Rank;
  player_rank_score: number;
  battle_win_rate: number;
  portfolio_best_rank: Rank;
  portfolio_avg_rank: Rank;
}

export interface PortfolioScores {
  completeness: number;
  structure: number;
  tech: number;
  docs: number;
  test: number;
  deploy: number;
  github: number;
}

export interface PortfolioDetail {
  portfolio_id: number;
  scores: PortfolioScores;
  total_score: number;
  rank: Rank;
  feedback: { good: string; improve: string };
  player_rank_score_gained?: number;
  field?: string;
  created_at?: string;
}

export interface PortfolioSummary {
  portfolio_id: number;
  field: string;
  total_score: number;
  rank: Rank;
  created_at: string;
}

export const api = {
  signup: (username: string, password: string) =>
    request<void>("/signup", { method: "POST", body: { username, password } }),
  signin: (username: string, password: string) =>
    request<{ username: string }>("/signin", {
      method: "POST",
      body: { username, password },
    }),
  signout: () => request<void>("/signout"),
  me: () => request<{ username: string }>("/my"),
  getProfile: (username: string) =>
    request<Profile>(`/profile/${encodeURIComponent(username)}`),
  updateProfile: (data: { main_field?: string; github_url?: string }) =>
    request<Profile>("/profile", { method: "PATCH", body: data }),
  createPortfolio: (data: { field: string; github_url: string }) =>
    request<PortfolioDetail>("/portfolio", { method: "POST", body: data }),
  getPortfolio: (id: number) => request<PortfolioDetail>(`/portfolio/${id}`),
  listPortfolios: (username: string) =>
    request<PortfolioSummary[]>(
      `/portfolio?username=${encodeURIComponent(username)}`,
    ),
  createBattle: (data: {
    field: string;
    mode: "match" | "friend";
    portfolio_id: number;
    opponent_username?: string;
  }) => request<unknown>("/battle", { method: "POST", body: data }),
  getBattle: (id: number) => request<unknown>(`/battle/${id}`),
  listBattles: (username: string) =>
    request<unknown[]>(`/battle?username=${encodeURIComponent(username)}`),
  acceptBattle: (id: number, portfolio_id: number) =>
    request<unknown>(`/battle/${id}/accept`, {
      method: "POST",
      body: { portfolio_id },
    }),
  declineBattle: (id: number) =>
    request<unknown>(`/battle/${id}/decline`, { method: "POST" }),
};

export const FIELDS = [
  "프론트엔드",
  "백엔드",
  "모바일",
  "인공지능",
  "데이터",
  "게임 개발",
  "클라우드·DevOps",
  "보안",
  "임베디드",
  "디자인",
] as const;

export const PORTFOLIO_FIELDS = [
  "프론트엔드",
  "백엔드",
  "모바일",
  "AI",
  "데이터",
  "게임",
  "클라우드·DevOps",
  "보안",
  "임베디드",
  "기타",
] as const;

export const SCORE_ITEMS = [
  { key: "completeness", label: "프로젝트 완성도", max: 30, pct: 30 },
  { key: "structure", label: "코드 구조", max: 10, pct: 10 },
  { key: "tech", label: "기술 활용", max: 15, pct: 15 },
  { key: "docs", label: "문서화", max: 5, pct: 5 },
  { key: "test", label: "테스트", max: 5, pct: 5 },
  { key: "deploy", label: "배포", max: 15, pct: 15 },
  { key: "github", label: "GitHub 활용", max: 20, pct: 20 },
] as const;

export const DEMO = {
  username: "demo",
  main_field: "백엔드",
  github_url: "https://github.com/demo",
  player_rank: "C" as Rank,
  player_rank_score: 72,
  battle_win_rate: 0.651,
  portfolio_best_rank: "A" as Rank,
  portfolio_avg_rank: "B" as Rank,
  wins: 41,
  losses: 22,
  bio: "근거 기반 포트폴리오로 실력을 증명합니다.",
};
