import { Link } from "react-router-dom";
import { Button } from "../components/ui";
import "./landing.css";

export function LandingPage() {
  return (
    <div className="land">
      <header className="land__nav">
        <div className="land__nav-inner">
          <Link to="/" className="land__brand">
            Proof Arena
          </Link>
          <nav className="land__links">
            <a href="#features">기능</a>
            <a href="#flow">흐름</a>
          </nav>
          <div className="land__actions">
            <Link to="/login" className="land__signin">
              로그인
            </Link>
            <Link to="/signup">
              <Button size="md">시작하기</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="hero-dark">
        <div className="hero-dark__grid">
          <div className="hero-dark__copy">
            <p className="badge" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
              Portfolio Rank
            </p>
            <h1 className="t-mega">
              포트폴리오를
              <br />
              증명하세요
            </h1>
            <p className="hero-dark__lead">
              GitHub 프로젝트를 근거 기반으로 분석하고, 개선과 대결 랭크를 한
              프로필에 기록합니다.
            </p>
            <div className="row" style={{ marginTop: 28, flexWrap: "wrap" }}>
              <Link to="/signup">
                <Button size="lg">시작하기</Button>
              </Link>
              <Link to="/app">
                <Button variant="outline" size="lg">
                  미리보기
                </Button>
              </Link>
            </div>
          </div>
          <div className="hero-dark__mock">
            <div className="mock-card mock-card--back">
              <p className="t-cap" style={{ color: "var(--color-on-dark-soft)" }}>
                Ranking
              </p>
              <p className="num" style={{ fontSize: 28, color: "#fff" }}>
                1,438
              </p>
              <p className="up num">+24</p>
            </div>
            <div className="mock-card">
              <p className="t-cap" style={{ color: "var(--color-on-dark-soft)" }}>
                Analysis
              </p>
              <p className="t-title" style={{ color: "#fff", marginTop: 8 }}>
                Secure API Gateway
              </p>
              <p className="num" style={{ fontSize: 40, color: "#fff", marginTop: 16 }}>
                86
              </p>
              <p style={{ color: "var(--color-on-dark-soft)" }}>Rank A · +13 RP</p>
              <div className="mock-bars">
                <i style={{ width: "88%" }} />
                <i style={{ width: "72%" }} />
                <i style={{ width: "68%" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="land__section">
        <p className="badge">Features</p>
        <h2 className="t-display" style={{ marginTop: 16 }}>
          분석 · 성장 · 대결
        </h2>
        <div className="grid-3" style={{ marginTop: 40 }}>
          <article className="card">
            <h3 className="t-title">포트폴리오 분석</h3>
            <p className="t-body" style={{ marginTop: 12 }}>
              완성도, 구조, 기술, 문서, 테스트, 배포, GitHub 활용을 항목별로
              측정합니다.
            </p>
          </article>
          <article className="card">
            <h3 className="t-title">플레이어 랭크</h3>
            <p className="t-body" style={{ marginTop: 12 }}>
              분석과 대결 결과로 점수가 쌓이고 S~F 랭크로 성장합니다.
            </p>
          </article>
          <article className="card">
            <h3 className="t-title">근거 기반 대결</h3>
            <p className="t-body" style={{ marginTop: 12 }}>
              같은 분야 포트폴리오를 비교하고 승패와 피드백을 받습니다.
            </p>
          </article>
        </div>
      </section>

      <section id="flow" className="cta-dark">
        <h2 className="t-h2" style={{ color: "#fff" }}>
          지금 바로 증명 시작
        </h2>
        <p style={{ color: "var(--color-on-dark-soft)", marginTop: 12 }}>
          신규 사용자는 플레이어 점수 0점, 랭크 F부터 시작합니다.
        </p>
        <div style={{ marginTop: 28 }}>
          <Link to="/signup">
            <Button size="lg">무료로 시작</Button>
          </Link>
        </div>
      </section>

      <footer className="land__foot">
        <strong>Proof Arena</strong>
        <div className="row">
          <Link to="/login">로그인</Link>
          <Link to="/signup">회원가입</Link>
          <Link to="/app">앱</Link>
        </div>
      </footer>
    </div>
  );
}
