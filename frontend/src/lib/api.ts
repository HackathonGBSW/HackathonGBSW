const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/**
 * Only http(s) URLs are safe to use as an anchor href. Without this check a
 * profile's github link (attacker-controlled, stored server-side) could be set
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

/** Build a profile GitHub URL from username (backend stores username, not URL). */
export function githubProfileUrl(username: string | null | undefined): string | undefined {
  if (!username) return undefined;
  return toSafeHttpUrl(`https://github.com/${encodeURIComponent(username)}`);
}

/** Friendly fallback for error responses with no JSON `.error` body (the
 * backend returns a bare empty body + status for most 4xx cases), so the UI
 * never shows a raw "HTTP 404" to the user. */
function defaultErrorMessage(status: number): string {
  switch (status) {
    case 401:
      return "로그인이 필요합니다.";
    case 403:
      return "권한이 없습니다.";
    case 404:
      return "요청한 대상을 찾을 수 없습니다.";
    case 409:
      return "이미 존재하거나 처리할 수 없는 요청입니다.";
    default:
      return status >= 500
        ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        : "요청을 처리하지 못했습니다.";
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
    let message = text || defaultErrorMessage(res.status);
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* keep raw */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    return (text ? text : undefined) as T;
  }
  return res.json() as Promise<T>;
}

export type Rank = "S" | "A" | "B" | "C" | "D" | "E" | "F";

// Portfolio-analysis grade (0-100 score -> S~F), unrelated to the player
// ladder below. Kept as simple material names (no divisions) for the
// "포폴 최고/평균 랭크" summary fields.
export const RANK_TIER_LABEL: Record<Rank, string> = {
  S: "Challenger",
  A: "Diamond",
  B: "Platinum",
  C: "Gold",
  D: "Silver",
  E: "Bronze",
  F: "Iron",
};

export function formatRankTier(rank: Rank | null | undefined) {
  return rank ? RANK_TIER_LABEL[rank] : "—";
}

export const RANK_SCORE_GAIN: Record<Rank, number> = {
  S: 18,
  A: 13,
  B: 8,
  C: 5,
  D: 2,
  E: 1,
  F: 0,
};

// Player-ladder tier (cumulative player_rank_score -> 23-step ladder).
// See llm_analyzer.FIXED_PLAYER_TIERS/ELITE_TIERS / SPEC.md §3 for the
// backend threshold table. Junior/Middle/Senior are also gated by the
// player's leaderboard rank_position (top 1000/800/300), not score alone.
export type PlayerTierMaterial =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "junior"
  | "middle"
  | "senior";

export interface PlayerRank {
  material: PlayerTierMaterial;
  division: number | null;
  label: string;
  index: number;
  next_label: string | null;
  progress_percent: number;
}

/** Mineral-inspired gradient per tier material, for the PLAYER RANK badge. */
export const PLAYER_TIER_GRADIENT: Record<PlayerTierMaterial, string> = {
  bronze: "linear-gradient(90deg, #a9601a 0%, #e2a15c 50%, #a9601a 100%)",
  silver: "linear-gradient(90deg, #8b939c 0%, #e7ebef 50%, #8b939c 100%)",
  gold: "linear-gradient(90deg, #b8860b 0%, #ffe08a 50%, #b8860b 100%)",
  platinum: "linear-gradient(90deg, #3fa9a3 0%, #b9fff2 50%, #3fa9a3 100%)",
  diamond: "linear-gradient(90deg, #4f7cff 0%, #d6ecff 50%, #4f7cff 100%)",
  junior: "linear-gradient(90deg, #2f80ed 0%, #a0d8ff 100%)",
  middle: "linear-gradient(90deg, #7b2ff7 0%, #f9a8ff 100%)",
  senior: "linear-gradient(90deg, #ff5f6d 0%, #ffc371 25%, #47cf73 50%, #4f7cff 75%, #a855f7 100%)",
};

export interface Profile {
  username: string;
  github_username: string;
  main_field: string | null;
  player_rank: PlayerRank;
  player_rank_score: number;
  battle_win: number;
  battle_lose: number;
  battle_win_rate: number | null;
  win_streak: number;
  portfolio_best_rank: Rank | null;
  portfolio_avg_rank: Rank | null;
}

export interface LeaderboardEntry {
  username: string;
  main_field: string | null;
  player_rank: PlayerRank;
  player_rank_score: number;
  battle_win: number;
  battle_lose: number;
  win_streak: number;
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

/** Raw backend portfolio payload (SPEC §4). */
export interface Portfolio {
  id: number;
  username: string;
  field: string;
  repository: string;
  completeness_score: number;
  structur_score: number;
  tech_score: number;
  docs_score: number;
  test_score: number;
  deploy_score: number;
  github_score: number;
  score: number;
  rank: Rank;
  feedback_good: string;
  feedback_improve: string;
  created_at: string | null;
}

/** UI-friendly view of a portfolio analysis. */
export interface PortfolioDetail {
  portfolio_id: number;
  scores: PortfolioScores;
  total_score: number;
  rank: Rank;
  feedback: { good: string; improve: string };
  player_rank_score_gained: number;
  field?: string;
  created_at?: string | null;
}

export interface BattleScores {
  completeness: number;
  structure: number;
  tech: number;
  docs: number;
  test: number;
  deploy: number;
  github: number;
}

export interface Battle {
  id: number;
  field: string;
  username1: string;
  username2: string;
  winner: string | null;
  scores1: BattleScores;
  scores2: BattleScores;
  result1: number;
  result2: number;
  feedback1: string;
  feedback2: string;
  created_at: string | null;
}

export interface MatchQueue {
  id: number;
  field: string;
  portfolio_id: number;
  status: "waiting" | "matched" | "cancelled";
  matched_battle_id: number | null;
  created_at: string | null;
}

export function toPortfolioDetail(p: Portfolio): PortfolioDetail {
  return {
    portfolio_id: p.id,
    total_score: p.score,
    rank: p.rank,
    player_rank_score_gained: RANK_SCORE_GAIN[p.rank] ?? 0,
    field: p.field,
    created_at: p.created_at,
    feedback: { good: p.feedback_good, improve: p.feedback_improve },
    scores: {
      completeness: p.completeness_score,
      structure: p.structur_score,
      tech: p.tech_score,
      docs: p.docs_score,
      test: p.test_score,
      deploy: p.deploy_score,
      github: p.github_score,
    },
  };
}

const AUTH_USER_KEY = "auth-username";

export function setAuthUsername(username: string | null) {
  if (username) sessionStorage.setItem(AUTH_USER_KEY, username);
  else sessionStorage.removeItem(AUTH_USER_KEY);
}

export function getAuthUsername(): string | null {
  return sessionStorage.getItem(AUTH_USER_KEY);
}

export const api = {
  signup: (username: string, password: string, github_username: string) =>
    request<void>("/signup", {
      method: "POST",
      body: { username, password, github_username },
    }),
  signin: (username: string, password: string) =>
    request<{ username: string }>("/signin", {
      method: "POST",
      body: { username, password },
    }),
  signout: () => request<void>("/signout"),
  me: () => request<{ username: string }>("/my"),
  getProfile: (username: string) =>
    request<Profile>(`/profile/${encodeURIComponent(username)}`),
  updateProfile: (data: { main_field?: string; github_username?: string }) =>
    request<Profile>("/profile", { method: "PATCH", body: data }),
  listPortfolios: () => request<Portfolio[]>("/portfolios"),
  /** Public lookup of another user's portfolios, for the friend-battle opponent picker. */
  listPortfoliosByUsername: (username: string) =>
    request<Portfolio[]>(`/portfolios?username=${encodeURIComponent(username)}`),
  createPortfolio: async (data: { field: string; repository: string }) => {
    const p = await request<Portfolio>("/portfolios", { method: "POST", body: data });
    return toPortfolioDetail(p);
  },
  getPortfolio: async (id: number) => {
    const p = await request<Portfolio>(`/portfolios/${id}`);
    return toPortfolioDetail(p);
  },
  createFriendBattle: (data: {
    field: string;
    opponent_username: string;
    portfolio_id: number;
    opponent_portfolio_id: number;
  }) => request<Battle>("/battles", { method: "POST", body: data }),
  createMatch: (data: { field: string; portfolio_id: number }) =>
    request<Battle | MatchQueue>("/battles/match", { method: "POST", body: data }),
  getMatchStatus: () => request<MatchQueue>("/battles/match"),
  cancelMatch: () => request<void>("/battles/match", { method: "DELETE" }),
  getBattle: (id: number) => request<Battle>(`/battles/${id}`),
  listBattles: () => request<Battle[]>("/battles"),
  getLeaderboard: (field?: string) =>
    request<LeaderboardEntry[]>(
      field ? `/leaderboard?field=${encodeURIComponent(field)}` : "/leaderboard",
    ),
};

export function isBattle(data: Battle | MatchQueue): data is Battle {
  return "username1" in data && "result1" in data;
}

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

export const BATTLE_SCORE_KEYS = [
  { key: "completeness", label: "프로젝트 완성도" },
  { key: "structure", label: "코드 구조" },
  { key: "tech", label: "기술 활용" },
  { key: "docs", label: "문서화" },
  { key: "test", label: "테스트" },
  { key: "deploy", label: "배포" },
  { key: "github", label: "GitHub 활용" },
] as const;

export const DEMO: Profile & { bio: string } = {
  username: "demo",
  github_username: "demo",
  main_field: "백엔드",
  player_rank: {
    material: "gold",
    division: 2,
    label: "Gold 2",
    index: 10,
    next_label: "Gold 1",
    progress_percent: 45.0,
  },
  player_rank_score: 427,
  battle_win: 41,
  battle_lose: 22,
  battle_win_rate: 0.651,
  win_streak: 2,
  portfolio_best_rank: "A",
  portfolio_avg_rank: "B",
  bio: "근거 기반 포트폴리오로 실력을 증명합니다.",
};
