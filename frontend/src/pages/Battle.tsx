import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input, PageHeader, Avatar } from "../components/ui";
import { PORTFOLIO_FIELDS, DEMO } from "../lib/api";

export function BattleLobbyPage() {
  const [field, setField] = useState("백엔드");
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title="대결" description="승리 +8 · 패배 -3 · 무승부 0 (0~100)" />
      <section className="card stack">
        <h2 className="t-title">분야 · 대표 포트폴리오</h2>
        <div className="chips">
          {["백엔드", "풀스택"].map((f) => (
            <button key={f} type="button" className={`chip ${field === f ? "is-on" : ""}`} onClick={() => setField(f)}>{f}</button>
          ))}
        </div>
        <p className="t-cap">Secure API Gateway · 랭크 {DEMO.player_rank} · {DEMO.player_rank_score}점</p>
      </section>
      <div className="grid-2">
        <article className="card stack">
          <h3 className="t-title">랜덤 매칭</h3>
          <p className="t-body">랭크 차이 최대 1단계 상대와 매칭</p>
          <Link to="/app/battle/match"><Button>매칭 시작</Button></Link>
        </article>
        <article className="card stack">
          <h3 className="t-title">친구와 대결</h3>
          <p className="t-body">검색 · 초대 · 수락 대기</p>
          <Link to="/app/battle/friend"><Button variant="secondary">친구 대결</Button></Link>
        </article>
      </div>
    </div>
  );
}

export function BattleMatchPage() {
  const nav = useNavigate();
  const [found, setFound] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setFound(true), 1600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <PageHeader title="랜덤 매칭" description="같은 분야 · 랭크 ±1 · 대결 가능 포폴" />
      {!found ? (
        <div className="card stack" style={{ textAlign: "center", padding: 48 }}>
          <p className="t-h1">검색 중…</p>
          <Button variant="secondary" onClick={() => nav("/app/battle")}>매칭 취소</Button>
        </div>
      ) : (
        <div className="card stack">
          <h2 className="t-title">매칭 완료</h2>
          <div className="row" style={{ gap: 12 }}>
            <Avatar name="opponent" />
            <div>
              <p className="t-title">opponent</p>
              <p className="t-cap">랭크 B · 승률 58% · 최고 A</p>
            </div>
          </div>
          <p className="t-body">상세 점수는 시작 전 비공개입니다.</p>
          <div className="row">
            <Button onClick={() => nav("/app/battle/analyzing")}>대결 시작</Button>
            <Button variant="secondary" onClick={() => nav("/app/battle")}>취소</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BattleFriendPage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  return (
    <div className="stack">
      <PageHeader title="친구와 대결" description="초대: 대기 / 수락 / 거절 / 만료 / 취소" />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); nav("/app/battle/analyzing"); }}>
        <Input label="사용자 검색" value={q} onChange={(e) => setQ(e.target.value)} placeholder="상대 이름" />
        <div className="chips">
          {PORTFOLIO_FIELDS.slice(0, 4).map((f) => (
            <button key={f} type="button" className="chip">{f}</button>
          ))}
        </div>
        <Input label="초대 메시지" placeholder="한 판 하실래요?" />
        <Button type="submit">초대 전송</Button>
      </form>
    </div>
  );
}

export function BattleAnalyzingPage() {
  const nav = useNavigate();
  useEffect(() => {
    const t = window.setTimeout(() => nav("/app/battle/1"), 1800);
    return () => window.clearTimeout(t);
  }, [nav]);
  return (
    <div className="stack" style={{ textAlign: "center", paddingTop: 40 }}>
      <PageHeader title="대결 분석 중" description="항목별 10점 만점 비교" />
      <div className="card row" style={{ justifyContent: "center", gap: 32 }}>
        <div><Avatar name="demo" size="lg" /><p className="t-sm">demo</p></div>
        <span className="muted">VS</span>
        <div><Avatar name="opponent" size="lg" /><p className="t-sm">opponent</p></div>
      </div>
    </div>
  );
}

const COMPARE = [
  { label: "프로젝트 완성도", a: 8, b: 5 },
  { label: "코드 구조", a: 4, b: 5 },
  { label: "기술 활용", a: 7, b: 6 },
  { label: "문서화", a: 5, b: 5 },
  { label: "테스트", a: 4, b: 7 },
  { label: "배포", a: 8, b: 6 },
  { label: "GitHub 활용", a: 9, b: 7 },
];

export function BattleResultPage() {
  const r1 = COMPARE.reduce((s, r) => s + (r.a > r.b ? r.a - r.b : 0), 0);
  const r2 = COMPARE.reduce((s, r) => s + (r.b > r.a ? r.b - r.a : 0), 0);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title="대결 결과" description="백엔드 · 매칭" />
      <div className="card" style={{ textAlign: "center", fontWeight: 600, color: "var(--color-primary)" }}>
        승리 · <span className="num up">+8</span> RP
      </div>
      <div className="grid-2">
        <article className="card stack" style={{ alignItems: "center" }}>
          <Avatar name="demo" /><p className="t-title">demo</p>
          <p className="t-h1 num">{r1}</p>
        </article>
        <article className="card stack" style={{ alignItems: "center" }}>
          <Avatar name="opponent" /><p className="t-title">opponent</p>
          <p className="t-h1 num">{r2}</p>
        </article>
      </div>
      <section className="card" style={{ overflowX: "auto" }}>
        <h2 className="t-title" style={{ marginBottom: 12 }}>항목별 비교</h2>
        <table className="table">
          <thead>
            <tr><th>항목</th><th>demo</th><th>opponent</th><th>차이</th><th>우세</th></tr>
          </thead>
          <tbody>
            {COMPARE.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{r.a}</td>
                <td className="num">{r.b}</td>
                <td className="num">{Math.abs(r.a - r.b)}</td>
                <td>{r.a === r.b ? "동점" : r.a > r.b ? "demo" : "opponent"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="grid-3">
        <article className="card stack"><h3 className="t-title">좋았던 점</h3><p className="t-body">배포·GitHub에서 앞섰습니다.</p></article>
        <article className="card stack"><h3 className="t-title">개선할 점</h3><p className="t-body">테스트를 보강하세요.</p></article>
        <article className="card stack"><h3 className="t-title">배울 점</h3><p className="t-body">상대의 테스트 자동화.</p></article>
      </section>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <Button variant="secondary">공유</Button>
        <Link to="/app/battle"><Button>다른 상대와 대결</Button></Link>
      </div>
    </div>
  );
}

export function BattleHistoryPage() {
  const rows = [
    { id: 1, date: "2026-07-12", field: "백엔드", opp: "opponent", result: "승리", rp: "+8" },
    { id: 2, date: "2026-07-08", field: "백엔드", opp: "buildfast", result: "패배", rp: "-3" },
  ];
  return (
    <div className="stack">
      <PageHeader title="대결 기록" />
      <div className="row" style={{ flexWrap: "wrap" }}>
        {["전체", "승리", "패배", "무승부"].map((f) => (
          <Button key={f} variant="secondary">{f}</Button>
        ))}
      </div>
      {rows.map((r) => (
        <article key={r.id} className="card row" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="t-cap">{r.date} · {r.field}</p>
            <h3 className="t-title">vs {r.opp} · {r.result}</h3>
            <p className={`t-cap num ${r.rp.startsWith("+") ? "up" : "down"}`}>RP {r.rp}</p>
          </div>
          <Link to={`/app/battle/${r.id}`}><Button variant="secondary">다시 보기</Button></Link>
        </article>
      ))}
    </div>
  );
}

export function RankingPage() {
  const rows = [
    { rank: 1, user: "apex_dev", field: "백엔드", pr: "S", score: 100, wr: "71%" },
    { rank: 2, user: "neon_ship", field: "프론트엔드", pr: "A", score: 94, wr: "66%" },
    { rank: 12, user: "demo", field: "백엔드", pr: "C", score: 72, wr: "65%", me: true },
  ];
  return (
    <div className="stack">
      <PageHeader title="랭킹" description="플레이어 점수 순" />
      <div className="row" style={{ flexWrap: "wrap" }}>
        {["전체", "프론트엔드", "백엔드", "모바일", "AI", "보안"].map((f) => (
          <Button key={f} variant="secondary">{f}</Button>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.map((r) => (
          <div key={r.user} className="row" style={{ padding: "14px 20px", borderBottom: "1px solid var(--color-hairline)", background: r.me ? "var(--color-surface-soft)" : undefined, justifyContent: "space-between" }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="num muted" style={{ width: 28 }}>{r.rank}</span>
              <Avatar name={r.user} size="sm" />
              <div>
                <Link to={`/app/profile/${r.user}`}><strong>{r.user}</strong></Link>
                <p className="t-cap">{r.field} · {r.pr} · 승률 {r.wr}</p>
              </div>
            </div>
            <span className="num">{r.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExplorePage() {
  return (
    <div className="stack">
      <PageHeader title="사용자 검색" />
      <Input placeholder="이름 · GitHub · 분야 · 랭크" />
      <article className="card row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 12 }}>
          <Avatar name="apex_dev" />
          <div>
            <strong>apex_dev</strong>
            <p className="t-cap">백엔드 · S · 승률 71%</p>
          </div>
        </div>
        <div className="row">
          <Link to="/app/profile/apex_dev"><Button variant="secondary">프로필</Button></Link>
          <Button>대결 신청</Button>
        </div>
      </article>
    </div>
  );
}

export function NotificationsPage() {
  const items = ["친구 대결 초대", "분석 완료", "랭크 상승 D→C", "매칭 완료"];
  return (
    <div className="stack">
      <PageHeader title="알림" actions={<Button variant="secondary">전체 읽음</Button>} />
      {items.map((i) => (
        <article key={i} className="card row" style={{ justifyContent: "space-between" }}>
          <p className="t-sm">{i}</p>
          <Button variant="text">이동</Button>
        </article>
      ))}
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title="설정" />
      <section className="card stack">
        <h2 className="t-title">계정</h2>
        <Input label="이메일" defaultValue="demo@example.com" />
        <Input label="비밀번호 변경" type="password" placeholder="새 비밀번호" />
        <div className="row">
          <Button variant="secondary">GitHub 연결</Button>
          <Button variant="danger">연결 해제</Button>
        </div>
      </section>
      <section className="card stack">
        <h2 className="t-title">공개 범위</h2>
        {["GitHub URL", "포트폴리오", "대결 기록", "승률"].map((x) => (
          <label key={x} className="row" style={{ justifyContent: "space-between" }}>
            <span className="t-sm">{x} 공개</span>
            <input type="checkbox" defaultChecked />
          </label>
        ))}
      </section>
      <section className="card stack">
        <h2 className="t-title">알림</h2>
        {["대결 초대", "분석 완료", "랭크 변동", "이메일", "웹 푸시"].map((x) => (
          <label key={x} className="row" style={{ justifyContent: "space-between" }}>
            <span className="t-sm">{x}</span>
            <input type="checkbox" defaultChecked />
          </label>
        ))}
      </section>
      <Button variant="danger">회원 탈퇴</Button>
    </div>
  );
}
