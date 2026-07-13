import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Input, PageHeader, RankPill, Avatar } from "../components/ui";
import { api, PORTFOLIO_FIELDS, SCORE_ITEMS, DEMO } from "../lib/api";

const MOCK_LIST = [
  { portfolio_id: 1, field: "백엔드", total_score: 86, rank: "A" as const, created_at: "2026-07-11", name: "Secure API Gateway", github: "https://github.com/demo/api" },
  { portfolio_id: 2, field: "풀스택", total_score: 78, rank: "C" as const, created_at: "2026-07-07", name: "Realtime Chat Core", github: "https://github.com/demo/chat" },
];

export function PortfolioListPage() {
  return (
    <div className="stack">
      <PageHeader
        title="포트폴리오"
        description="등록 · 재분석 · 삭제 · 필터"
        actions={
          <Link to="/app/portfolios/new">
            <Button>포트폴리오 등록</Button>
          </Link>
        }
      />
      <div className="row" style={{ flexWrap: "wrap" }}>
        <Button variant="secondary">분야 전체</Button>
        <Button variant="secondary">랭크 전체</Button>
        <Button variant="secondary">최신순</Button>
      </div>
      {MOCK_LIST.map((p) => (
        <article key={p.portfolio_id} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <p className="t-cap">{p.field} · 분석 완료 · {p.created_at}</p>
              <h3 className="t-title" style={{ marginTop: 6 }}>
                <Link to={`/app/portfolios/${p.portfolio_id}`}>{p.name}</Link>
              </h3>
              <p className="t-cap" style={{ marginTop: 6 }}>{p.github}</p>
            </div>
            <RankPill rank={p.rank} score={p.total_score} />
          </div>
          <div className="row" style={{ marginTop: 16, flexWrap: "wrap" }}>
            <Link to={`/app/portfolios/${p.portfolio_id}`}><Button variant="secondary">결과 보기</Button></Link>
            <Button variant="secondary">재분석</Button>
            <Button variant="danger">삭제</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function PortfolioNewPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [field, setField] = useState<(typeof PORTFOLIO_FIELDS)[number]>(PORTFOLIO_FIELDS[1]);
  const [github, setGithub] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function finish() {
    setLoading(true);
    setError("");
    try {
      const res = await api.createPortfolio({ field, github_url: github });
      nav(`/app/portfolios/${res.portfolio_id}`);
    } catch {
      nav("/app/portfolios/analyzing");
    } finally {
      setLoading(false);
    }
  }

  function next(e: FormEvent) {
    e.preventDefault();
    if (step < 4) setStep(step + 1);
    else void finish();
  }

  return (
    <div className="stack">
      <PageHeader title="포트폴리오 등록" description={`${step}/4 단계`} />
      <form className="card stack" onSubmit={next}>
        {step === 1 && (
          <>
            <h2 className="t-title">1. 분야 선택</h2>
            <div className="chips">
              {PORTFOLIO_FIELDS.map((f) => (
                <button key={f} type="button" className={`chip ${field === f ? "is-on" : ""}`} onClick={() => setField(f)}>
                  {f}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="t-title">2. GitHub 링크</h2>
            <Input label="저장소 URL" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/user/repo" required />
            <Input label="프로젝트 이름" placeholder="선택" />
            <Input label="배포 URL" placeholder="선택" />
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="t-title">3. 저장소 확인</h2>
            <ul className="stack" style={{ gap: 8 }}>
              {["접근 가능", "기본 브랜치 main", "TypeScript", "커밋 128", "README", "테스트", "배포 설정", "Actions"].map((x) => (
                <li key={x} className="t-sm">· {x}</li>
              ))}
            </ul>
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="t-title">4. 분석 요청</h2>
            <p className="t-body">분야 {field} · 분석을 시작합니다.</p>
            {error ? <p style={{ color: "var(--color-semantic-down)" }}>{error}</p> : null}
          </>
        )}
        <div className="row" style={{ justifyContent: "space-between" }}>
          {step > 1 ? <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>이전</Button> : <span />}
          <Button type="submit" disabled={loading}>{step === 4 ? (loading ? "분석 중…" : "분석 시작") : "다음"}</Button>
        </div>
      </form>
    </div>
  );
}

const STEPS = [
  "GitHub 저장소 불러오기",
  "프로젝트 구조 확인",
  "코드 분석",
  "기술 스택 분석",
  "문서 분석",
  "테스트 분석",
  "배포 상태 분석",
  "GitHub 활용도 분석",
  "최종 점수 계산",
  "피드백 생성",
];

export function AnalyzeProgressPage() {
  const nav = useNavigate();
  const [i] = useState(3);
  useEffect(() => {
    const t = window.setTimeout(() => nav("/app/portfolios/1"), 2200);
    return () => window.clearTimeout(t);
  }, [nav]);
  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <PageHeader title="분석 진행 중" description={`현재: ${STEPS[i]}`} />
      <div className="card stack">
        <div style={{ height: 8, background: "var(--color-surface-strong)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${((i + 1) / STEPS.length) * 100}%`, height: "100%", background: "var(--color-primary)" }} />
        </div>
        <ol className="stack" style={{ gap: 6 }}>
          {STEPS.map((s, idx) => (
            <li key={s} className="t-sm" style={{ color: idx <= i ? "var(--color-ink)" : "var(--color-muted)", fontWeight: idx === i ? 600 : 400 }}>
              {idx + 1}. {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function AnalyzeResultPage() {
  const { id } = useParams();
  const scores = [
    { label: "프로젝트 완성도", value: 26, max: 30 },
    { label: "코드 구조", value: 8, max: 10 },
    { label: "기술 활용", value: 12, max: 15 },
    { label: "문서화", value: 3.5, max: 5 },
    { label: "테스트", value: 3.5, max: 5 },
    { label: "배포", value: 12, max: 15 },
    { label: "GitHub 활용", value: 17, max: 20 },
  ];
  return (
    <div className="stack" style={{ gap: 28 }}>
      <PageHeader
        title="분석 결과"
        description={`포트폴리오 #${id ?? 1} · 백엔드`}
        actions={
          <>
            <Link to="/app/battle"><Button>대결에 사용</Button></Link>
            <Button variant="secondary">재분석</Button>
            <Button variant="secondary">공유</Button>
          </>
        }
      />
      <section className="card row" style={{ gap: 20 }}>
        <RankPill rank="A" score={86} />
        <div>
          <p className="t-h1 num">86</p>
          <p className="t-cap">총점 · 랭크 A · 플레이어 점수 +13</p>
        </div>
      </section>
      <section className="card stack">
        <h2 className="t-title">항목별 결과</h2>
        {scores.map((s, idx) => (
          <div key={s.label} className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="t-sm">{s.label} <span className="t-cap">({SCORE_ITEMS[idx].pct}%)</span></span>
              <span className="num t-sm">{s.value}/{s.max}</span>
            </div>
            <div style={{ height: 6, background: "var(--color-surface-strong)", borderRadius: 999 }}>
              <div style={{ width: `${(s.value / s.max) * 100}%`, height: "100%", background: "var(--color-primary)", borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </section>
      <section className="grid-2">
        <article className="card stack">
          <h3 className="t-title">좋은 점</h3>
          <p className="t-body">CI 테스트와 배포 설정이 명확합니다.</p>
        </article>
        <article className="card stack">
          <h3 className="t-title">개선할 점</h3>
          <p className="t-body">OpenAPI 명세를 추가하면 문서화 점수를 올릴 수 있습니다.</p>
        </article>
      </section>
    </div>
  );
}

export function ProfilePage() {
  const { username = "demo" } = useParams();
  const u = DEMO;
  const [tab, setTab] = useState<"p" | "b">("p");
  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="card stack">
        <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
          <Avatar name={username} size="lg" />
          <div className="stack" style={{ gap: 6, flex: 1 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h1 className="t-h1">{username}</h1>
              <div className="row">
                <Link to="/app/profile/edit"><Button variant="secondary">수정</Button></Link>
                <Link to="/app/battle/friend"><Button>대결 신청</Button></Link>
              </div>
            </div>
            <p className="t-sm">{u.main_field}</p>
            <p className="t-body">{u.bio}</p>
            <p className="t-cap">{u.github_url}</p>
          </div>
        </div>
        <div className="grid-3">
          <div><p className="t-cap">플레이어</p><RankPill rank={u.player_rank} score={u.player_rank_score} /></div>
          <div><p className="t-cap">승률</p><p className="t-title num">{(u.battle_win_rate * 100).toFixed(1)}%</p></div>
          <div><p className="t-cap">포폴 최고/평균</p><p className="t-title">{u.portfolio_best_rank} / {u.portfolio_avg_rank}</p></div>
        </div>
      </section>
      <div className="row">
        <Button variant={tab === "p" ? "primary" : "secondary"} onClick={() => setTab("p")}>포트폴리오</Button>
        <Button variant={tab === "b" ? "primary" : "secondary"} onClick={() => setTab("b")}>대결</Button>
      </div>
      {tab === "p" ? (
        <article className="card row" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="t-cap">백엔드</p>
            <h3 className="t-title">Secure API Gateway</h3>
          </div>
          <RankPill rank="A" score={86} />
        </article>
      ) : (
        <article className="card"><p className="t-body">최근 대결 기록은 대결 기록 메뉴에서 확인하세요.</p></article>
      )}
    </div>
  );
}

export function ProfileEditPage() {
  const nav = useNavigate();
  const [field, setField] = useState(DEMO.main_field);
  const [github, setGithub] = useState(DEMO.github_url);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api.updateProfile({ main_field: field, github_url: github });
    } catch { /* demo */ }
    nav("/app/profile/demo");
  }
  return (
    <div className="stack">
      <PageHeader title="프로필 수정" />
      <form className="card stack" onSubmit={save}>
        <Input label="사용자 이름" defaultValue={DEMO.username} />
        <div className="stack" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>주 분야</span>
          <div className="chips">
            {(["프론트엔드", "백엔드", "모바일", "인공지능", "보안"] as const).map((f) => (
              <button key={f} type="button" className={`chip ${field === f ? "is-on" : ""}`} onClick={() => setField(f)}>{f}</button>
            ))}
          </div>
        </div>
        <Input label="GitHub URL" value={github} onChange={(e) => setGithub(e.target.value)} />
        <div className="row">
          <Button type="submit">저장</Button>
          <Button type="button" variant="danger">회원 탈퇴</Button>
        </div>
      </form>
    </div>
  );
}
