# GitHub Battle 백엔드 명세서

구현되고 실제로 동작 검증된 상태 기준 명세서. 스택: Flask + Flask-SQLAlchemy(MySQL) + 규칙 기반 AI 분석 + OpenAI API + GitHub REST API. 세션 기반 인증.

요청 바디는 `application/json` 또는 `application/x-www-form-urlencoded` 둘 다 허용(엔드포인트별로 구현 방식이 다를 수 있음). 응답은 데이터가 있으면 JSON 바디 + 상태코드, 없으면 빈 바디 + 상태코드만 반환.

---

## 1. 데이터 모델 (`app.py`)

### User

| 컬럼 | 타입 | 설명 |
|---|---|---|
| username | String(30), PK | |
| password | String(255) | `werkzeug.security`로 해시 저장(scrypt) |
| github_username | String(50) | |
| main_field | String(50), nullable | 주분야 |
| win / lose | Integer, default 0 | 대결 승/패 누적 카운트 |
| player_rank_score | Integer, default 0 | 플레이어 랭크 점수 (최저점에서 누적) |

### Portfolio

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | Integer, PK | |
| username | FK(User) | |
| field | String(50) | 분석 시 선택한 분야 |
| repository | String(1000) | GitHub 저장소 URL |
| completeness_score / structur_score / tech_score / docs_score / test_score / deploy_score / github_score | Float | 항목별 점수 (각 만점: 30/10/15/5/5/15/20) |
| score | Float | 7개 항목 합산 (0~100) |
| rank | Enum(S/A/B/C/D/E/F) | |
| feedback_good / feedback_improve | Text | |
| created_at | DateTime | |

### Battle

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | Integer, PK | |
| field | String(50) | |
| username1 / username2 | FK(User) | |
| win_username | FK(User), nullable | 승자. **무승부면 NULL** |
| user1_portfolio_id / user2_portfolio_id | FK(Portfolio) | |
| scores1 / scores2 | JSON | 항목별 10점 만점 비교 점수 (`{completeness, structure, tech, docs, test, deploy, github}`) |
| user1_portfolio_score / user2_portfolio_score | Float | 항목별 점수차 합산 (승점) |
| user1_portfolio_feedback / user2_portfolio_feedback | Text | |
| datetime | DateTime | |

### MatchQueue

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | Integer, PK | |
| username | FK(User) | |
| field | String(50) | |
| portfolio_id | FK(Portfolio) | |
| status | String(10) | `waiting` / `matched` / `cancelled` |
| matched_battle_id | FK(Battle), nullable | 매칭 성사 시 생성된 대결 id |
| created_at | DateTime | |

### 랭크 기준 (포트폴리오 랭크·플레이어 랭크 공통, `llm_analyzer.rank_for_score`)

100점 만점: S=100, A≥90, B≥80, C≥60, D≥40, E≥20, F≤19. `player_rank_score`는 상한 없이 누적되며 같은 구간표로 S~F를 매긴다.

- 포트폴리오 분석 완료 시 랭크별 가산점(`RANK_SCORE_GAIN`): S+18, A+13, B+8, C+5, D+2, E+1, F+0
- 대결 결과: 승자 +8, 패자 -3(0 미만으로는 내려가지 않음), **무승부는 랭크 점수·승패 카운트 변동 없음**

---

## 2. 인증 API

### POST /signup
Body: `{ username, password, github_username }` → `201` / `400`(필드 누락) / `409`(이미 존재하는 아이디)

### POST /signin
Body: `{ username, password }` → `200 { username }` (세션 생성) / `404`(존재하지 않는 유저·비밀번호 불일치)

### GET /signout
`200` / `401`

### GET /my
로그인 여부 확인. `200 { username }` / `401`

---

## 3. 프로필 API

### GET /profile/\<username\>
메인 프로필 조회 (인증 불필요, 공개).
- `200`:
```json
{
  "username": "string",
  "github_username": "string",
  "main_field": "string|null",
  "player_rank": "S|A|B|C|D|E|F",
  "player_rank_score": 0,
  "battle_win": 0,
  "battle_lose": 0,
  "battle_win_rate": 0.0,
  "portfolio_best_rank": "S|A|B|C|D|E|F|null",
  "portfolio_avg_rank": "S|A|B|C|D|E|F|null"
}
```
- `battle_win_rate`은 대결 기록이 없으면 `null`. `portfolio_*_rank`는 등록된 포트폴리오가 없으면 `null`.
- `404`: 존재하지 않는 사용자

### PATCH /profile
로그인한 사용자의 주분야/깃헙 계정명 수정.
- 인증 필요. Body: `{ "main_field"?: string, "github_username"?: string }` (부분 업데이트)
- `200`: 갱신된 프로필(위와 동일 형태) / `401`

---

## 4. 포트폴리오 API

### GET /portfolios
로그인 사용자의 포트폴리오 목록(최신순). `200 [ {portfolio}, ... ]` / `401`

### POST /portfolios
포트폴리오 등록 + 즉시 분석.
- 인증 필요. Body: `{ repository, field }`
- 처리: `llm_analyzer.analyze_portfolio()` 호출 → 7개 항목 점수·랭크·피드백 산출 → 저장 → `User.player_rank_score`에 랭크별 가산점 반영
- `201 {portfolio}` / `400`(필드 누락) / `422`(저장소 조회 실패 — 비공개/존재하지 않음/GitHub API 오류) / `502`(LLM 응답 실패)

### GET /portfolios/\<id\>
단건 조회 (공개). `200 {portfolio}` / `404`

### PUT /portfolios/\<id\>
재분석. 소유자만 가능.
- Body: `{ repository?, field? }` (미지정 시 기존 값 유지)
- 재분석 후 새 랭크 가산점이 **추가로** 지급됨(기존에 받은 가산점은 회수하지 않음)
- `200 {portfolio}` / `401` / `403`(소유자 아님) / `422` / `502`

### DELETE /portfolios/\<id\>
소유자만 가능. 대결 기록에서 참조 중이면 삭제 불가.
- `200` / `401` / `403` / `404` / `409`(대결에서 사용 중)

`{portfolio}` 형태:
```json
{
  "id": 0, "username": "string", "field": "string", "repository": "string",
  "completeness_score": 0, "structur_score": 0, "tech_score": 0, "docs_score": 0,
  "test_score": 0, "deploy_score": 0, "github_score": 0, "score": 0,
  "rank": "S|A|B|C|D|E|F", "feedback_good": "string", "feedback_improve": "string",
  "created_at": "ISO8601"
}
```

---

## 5. 대결 API

### GET /battles
내가 참여한 대결 기록(최신순). `200 [ {battle}, ... ]` / `401`

### POST /battles — 친구 대결
상대를 직접 지정해 즉시 채점.
- Body: `{ field, opponent_username, portfolio_id, opponent_portfolio_id }`
- 두 포트폴리오 모두 각자 소유자 확인 + `field` 일치 확인
- `201 {battle}` / `400`(자기 자신 지정, 포트폴리오 불일치 등) / `404`(상대 없음) / `422` / `502`

### POST /battles/match — 매칭
같은 분야에서 랭크 차이가 최대 1단계(`llm_analyzer.rank_tier_diff`)인 대기자를 찾아 즉시 채점, 없으면 대기열 등록.
- Body: `{ field, portfolio_id }`
- 이미 대기 중이면 그 요청을 재사용하되, **매번 다시 매칭을 시도**한다 (재요청 시 그사이 들어온 상대와 매칭될 수 있음)
- 매칭 성사: `201 {battle}` — 내가 신청자든 대기자든 상관없이 매칭을 성사시킨 쪽에 바로 대결 결과 반환
- 매칭 실패(대기 중인 적합한 상대 없음): `201 {match_queue}`
- `400` / `422` / `502`

### GET /battles/match
내 대기열 상태 폴리이용(상대가 나를 매칭시켰는지 확인).
- `200 {match_queue}` (status: waiting|matched) / `404`(대기 중인 요청 없음)

### DELETE /battles/match
대기열에서 나가기. `200` / `404`

### GET /battles/\<id\>
대결 상세. 당사자만 조회 가능. `200 {battle}` / `401` / `403` / `404`

`{battle}` 형태:
```json
{
  "id": 0, "field": "string", "username1": "string", "username2": "string",
  "winner": "string|null",
  "scores1": {"completeness":0,"structure":0,"tech":0,"docs":0,"test":0,"deploy":0,"github":0},
  "scores2": { "...동일 구조..." },
  "result1": 0, "result2": 0,
  "feedback1": "string", "feedback2": "string",
  "created_at": "ISO8601"
}
```
`winner`가 `null`이면 무승부(`result1 == result2`).

`{match_queue}` 형태:
```json
{ "id": 0, "field": "string", "portfolio_id": 0, "status": "waiting|matched|cancelled", "matched_battle_id": 0, "created_at": "ISO8601" }
```

### 대결 채점 로직 (`_resolve_battle`, 친구 대결·매칭 공통)
1. `compare_portfolios(repo1, repo2, field)`로 두 저장소를 동일한 규칙에 따라 7개 항목 10점 만점으로 평가
2. 항목별 `max(0, 높은점수 - 낮은점수)`를 각자 합산 → `result1`, `result2`
3. `result1 > result2`면 user1 승, 반대면 user2 승, **같으면 무승부**(`winner=null`)
4. 승자 `win+=1`, `player_rank_score+=8` / 패자 `lose+=1`, `player_rank_score=max(0, score-3)` / 무승부는 양쪽 다 변동 없음

---

## 6. AI 분석 모듈 (`github_battle_ai/`, `llm_analyzer.py`)

GitHub REST API로 메타데이터, README, 파일 트리, 언어, 커밋, 브랜치, PR, Issue, Contributor, Release와 Actions를 수집한다. 7개 항목의 점수·총점·랭크와 대결 승패는 고정된 규칙으로 계산한다. OpenAI 구조화 출력은 확정된 점수와 근거를 해석하여 좋은 점, 개선점, 추천 기술과 학습 방향을 생성할 때만 사용하며 점수를 변경하지 않는다.

- `github_battle_ai/` — 수집, 전처리, 규칙 채점, 랭크, LLM 피드백과 대결 비교 구현
- `llm_analyzer.analyze_portfolio(repository, field)` — 기존 Flask 포트폴리오 저장 형식으로 변환
- `llm_analyzer.compare_portfolios(repo1, repo2, field)` — 기존 Flask 대결 형식으로 변환
- `rank_for_score(score)`, `rank_tier_diff(rank_a, rank_b)`, `RANK_SCORE_GAIN` — 기존 백엔드 호환 유틸

**환경변수**: `OPENAI_API_KEY`, `GITHUB_TOKEN`, `OPENAI_MODEL`(기본 `gpt-5.4-mini`), `LLM_FALLBACK_TO_RULES`(기본 `true`).

**오류 처리**: OpenAI 호출 실패 시 기본적으로 규칙 점수와 규칙 피드백을 반환한다. GitHub 조회 실패는 `AnalysisError`로 전달되어 기존 Flask 라우트가 처리한다.

---

## 7. 알려진 한계

- 비밀번호는 `werkzeug.security`로 해시 저장됨. 세션 시크릿·DB URI는 `SECRET_KEY`/`DATABASE_URL` 환경변수로 오버라이드 가능(미설정 시 기존 로컬 개발용 기본값 사용) — 다만 그 기본 시크릿값은 이미 git 히스토리에 커밋되어 있으므로 로컬 외 환경에서는 반드시 교체할 것
- `MatchQueue` 매칭에는 동시성 제어(락)가 없음 — 여러 요청이 동시에 같은 대기자를 매칭 대상으로 잡을 경합 가능성이 있으나 로컬/저사용량 데모 범위에서는 무시 가능한 수준
- 친구 대결(`POST /battles`)은 상대의 사전 동의 없이 즉시 성립됨 — "상대 수락" 단계는 없음
- GitHub 익명 API 호출 제한(60/시간)에 취약 — `GITHUB_TOKEN` 설정 권장
