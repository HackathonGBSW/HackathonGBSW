import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { FlowShell } from "./components/FlowShell";
import { LandingPage } from "./pages/Landing";
import { LoginPage, SignupPage, OnboardingPage } from "./pages/Core";
import {
  MainPage,
  RankPage,
  RankAnalyzingPage,
  RankResultPage,
  BattleHomePage,
  BattleMatchFlowPage,
  BattleFriendFlowPage,
  BattleFightingPage,
  BattleOutcomePage,
} from "./pages/Flow";

/**
 * flow.md 기준 플로우
 * 랜딩 → 로그인/가입 → 메인(마이페이지) → 랭크받기 | 대결하기
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route path="/app" element={<FlowShell />}>
          <Route index element={<MainPage />} />
          <Route path="rank" element={<RankPage />} />
          <Route path="rank/analyzing" element={<RankAnalyzingPage />} />
          <Route path="rank/result/:id" element={<RankResultPage />} />
          <Route path="battle" element={<BattleHomePage />} />
          <Route path="battle/match" element={<BattleMatchFlowPage />} />
          <Route path="battle/friend" element={<BattleFriendFlowPage />} />
          <Route path="battle/fighting" element={<BattleFightingPage />} />
          <Route path="battle/result" element={<BattleOutcomePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
