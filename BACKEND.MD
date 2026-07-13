# GitHub Battle 백엔드 명세서

스택: Flask + Flask-SQLAlchemy + MySQL, 세션 기반 인증(`app.py` 기존 방식 유지).
요청 바디는 기존 코드 관례를 따라 `application/x-www-form-urlencoded`(form) 또는 `application/json` 둘 다 허용한다.

---

## 1. 공통 사항

- 인증이 필요한 요청은 세션에 `username`이 있어야 하며, 없으면 `401`을 반환한다.
- 성공 응답은 데이터가 있으면 JSON 바디 + `200`/`201`, 없으면 `""` + 상태코드만 반환(기존 스타일 유지).
- 실패 응답: `400`(요청 형식 오류), `401`(비인증), `403`(권한 없음), `404`(대상 없음), `409`(중복/충돌).

---

## 2. 데이터 모델

### User (기존 확장)

| 컬럼              | 타입                  | 설명                                |
| ----------------- | --------------------- | ----------------------------------- |
| username          | String(30), PK        | 사용자 이름                         |
| password          | String(50)            | 비밀번호                            |
| main_field        | String(50), nullable  | 주분야                              |
| github_url        | String(255), nullable | 깃헙 URL                            |
| player_rank_score | Integer, default=0    | 플레이어 랭크 점수(최저점에서 누적) |
| battle_win_count  | Integer, default=0    | 대결 승리 수                        |
| battle_lose_count | Integer, default=0    | 대결 패배 수                        |

파생 값(저장하지 않고 조회 시 계산):

- **대결 승률** = `battle_win_count / (battle_win_count + battle_lose_count)`
- **포폴 최고 랭크** = 해당 유저의 `Portfolio.total_score` 중 최댓값의 랭크
- **포폴 평균 랭크** = 해당 유저의 `Portfolio.total_score` 평균의 랭크

### Portfolio (포폴 분석 결과)

| 컬럼               | 타입                          | 설명                               |
| ------------------ | ----------------------------- | ---------------------------------- |
| id                 | Integer, PK, autoincrement    |                                    |
| username           | String(30), FK(User.username) | 소유자                             |
| field              | String(50)                    | 분석 시 선택한 분야                |
| github_url         | String(255)                   | 분석 대상 깃헙 링크                |
| score_completeness | Float                         | 프로젝트 완성도 (30% 가중치, 0~30) |
| score_structure    | Float                         | 코드 구조 (10%, 0~10)              |
| score_tech         | Float                         | 기술 활용 (15%, 0~15)              |
| score_docs         | Float                         | 문서화 (5%, 0~5)                   |
| score_test         | Float                         | 테스트 (5%, 0~5)                   |
| score_deploy       | Float                         | 배포 (15%, 0~15)                   |
| score_github       | Float                         | GitHub 활용 (20%, 0~20)            |
| total_score        | Float                         | 위 항목 합산 (0~100)               |
| rank               | String(1)                     | S/A/B/C/D/E/F                      |
| feedback_good      | Text                          | 좋은 점                            |
| feedback_improve   | Text                          | 개선할 점                          |
| created_at         | DateTime, default=now         | 분석 시각                          |

### Battle (대결 기록)

| 컬럼          | 타입                                    | 설명                                         |
| ------------- | --------------------------------------- | -------------------------------------------- |
| id            | Integer, PK, autoincrement              |                                              |
| field         | String(50)                              | 대결 분야                                    |
| mode          | String(10)                              | `match`(매칭) / `friend`(친구 대결)          |
| status        | String(15)                              | `pending`(친구 대결 수락 대기) / `completed` |
| user1         | String(30), FK(User.username)           | 대결 신청자                                  |
| user2         | String(30), FK(User.username), nullable | 상대(매칭 전에는 null)                       |
| portfolio1_id | Integer, FK(Portfolio.id)               | user1이 사용한 포폴                          |
| portfolio2_id | Integer, FK(Portfolio.id), nullable     | user2가 사용한 포폴                          |
| scores1       | JSON                                    | user1의 7개 항목별 점수(10점 만점)           |
| scores2       | JSON                                    | user2의 7개 항목별 점수(10점 만점)           |
| result1       | Float                                   | user1 최종 승점(항목별 차이 합)              |
| result2       | Float                                   | user2 최종 승점                              |
| winner        | String(30), nullable                    | 승자 username                                |
| feedback1     | Text                                    | user1에게 주는 개선점/좋았던 점              |
| feedback2     | Text                                    | user2에게 주는 개선점/좋았던 점              |
| created_at    | DateTime, default=now                   |                                              |

랭크 배정 기준(공통, 100점 만점): S=100, A≥90, B≥80, C≥60, D≥40, E≥20, F≤19.

포폴 분석 후 플레이어 랭크 점수 가산: S +18, A +13, B +8, C +5, D +2, E +1, F +0.

대결 결과에 따른 플레이어 랭크 점수 가감: 승리 +8, 패배 -3.

---

## 3. 인증 API (기존 유지)

### POST /signup

- Body: `{ "username": string, "password": string }`
- 201: 생성 완료 / 400: 필드 누락 / 409: 이미 존재하는 username

### POST /signin

- Body: `{ "username": string, "password": string }`
- 200: `{ "username": string }` (세션 생성) / 401: 비밀번호 불일치 / 404: 없는 유저

### GET /signout

- 200: 세션 종료 / 401: 로그인 상태 아님

### GET /my

- 200: `{ "username": string }` / 401: 로그인 상태 아님

---

## 4. 랭크 시스템 API

### GET /profile/<username>

메인 프로필 조회.

- 200:

```json
{
  "username": "string",
  "main_field": "string",
  "github_url": "string",
  "player_rank": "S|A|B|C|D|E|F",
  "player_rank_score": 0,
  "battle_win_rate": 0.0,
  "portfolio_best_rank": "S|A|B|C|D|E|F",
  "portfolio_avg_rank": "S|A|B|C|D|E|F"
}
```

- 404: 존재하지 않는 사용자

### PATCH /profile

로그인한 사용자의 주분야/깃헙 URL 수정.

- 인증 필요
- Body: `{ "main_field"?: string, "github_url"?: string }`
- 200: 갱신된 프로필 반환 / 401

### POST /portfolio

포폴 업로드 및 분석 실행 (분야 선택 + 깃헙 링크 입력 → 분석 → 랭크 배정 → 피드백 → 플레이어 랭크 점수 반영까지 한 트랜잭션으로 처리).

- 인증 필요
- Body: `{ "field": string, "github_url": string }`
- 처리 순서:
  1. `field`, `github_url` 유효성 검사 (400)
  2. 깃헙 저장소 분석 실행(내부 분석 모듈, §6 참고)하여 7개 항목 점수 산출
  3. `total_score` 계산, 랭크 배정
  4. 피드백(좋은 점/개선할 점) 생성
  5. `Portfolio` 레코드 저장
  6. 랭크별 가산점을 `User.player_rank_score`에 더함
- 201:

```json
{
  "portfolio_id": 0,
  "scores": {
    "completeness": 0,
    "structure": 0,
    "tech": 0,
    "docs": 0,
    "test": 0,
    "deploy": 0,
    "github": 0
  },
  "total_score": 0,
  "rank": "S|A|B|C|D|E|F",
  "feedback": { "good": "string", "improve": "string" },
  "player_rank_score_gained": 0
}
```

- 400: 잘못된 깃헙 URL / 422: 분석 실패(비공개 저장소 등)

### GET /portfolio/<id>

포폴 분석 결과 단건 조회.

- 200: §4 `POST /portfolio` 응답과 동일한 형태 / 404

### GET /portfolio?username=<username>

특정 사용자의 포폴 분석 기록 목록(최신순).

- 200: `Portfolio` 요약 배열 `[{ "portfolio_id", "field", "total_score", "rank", "created_at" }]`

---

## 5. 대결 시스템 API

### POST /battle

대결 신청 생성. `mode`가 `match`면 즉시 매칭을 시도하고, `friend`면 상대의 수락을 기다리는 `pending` 대결을 생성한다.

- 인증 필요
- Body:

```json
{
  "field": "string",
  "mode": "match|friend",
  "portfolio_id": 0,
  "opponent_username": "string (mode=friend일 때 필수)"
}
```

- `match` 처리: `field`가 같고, 자신과 `player_rank` 차이가 최대 1랭크(예: A↔B 가능, A↔C 불가)인 상대 중 대기 중인 사용자를 찾아 즉시 매칭. 대기자가 없으면 매칭 대기열에 등록.
- `friend` 처리: `status="pending"`으로 생성, `user2`는 상대로 지정, 상대에게 알림(추후 알림 시스템 연동).
- 201(즉시 매칭/생성): 아래 §5-2 `POST /battle/<id>/resolve` 응답과 동일한 결과 반환, 단 매칭 대기 상태면 `{ "battle_id": 0, "status": "waiting" }`
- 400: `portfolio_id`가 본인 소유가 아니거나 존재하지 않음 / 404: `opponent_username` 없음

### POST /battle/<id>/accept

`friend` 모드로 받은 대결 요청 수락. 수락 시점에 상대도 사용할 `portfolio_id`를 지정해야 한다.

- 인증 필요, 요청자가 `user2`여야 함
- Body: `{ "portfolio_id": 0 }`
- 200: 대결이 즉시 채점되어 완료됨 — §5-3 결과 형식과 동일
- 403: 본인에게 온 요청이 아님 / 404 / 409: 이미 처리된 요청

### POST /battle/<id>/decline

친구 대결 거절.

- 200 / 403 / 404

### 대결 채점 로직 (내부, `accept` 또는 매칭 성립 시 자동 실행)

1. `portfolio1`, `portfolio2`의 7개 항목을 10점 만점으로 정규화하여 비교
2. 항목별로 점수가 높은 쪽에 `(높은 점수 - 낮은 점수)`를 가산 (동점이면 0)
3. 7개 항목 가산점을 각자 합산 → `result1`, `result2`
4. `result1 > result2`면 `user1` 승, 반대면 `user2` 승, 동점이면 재분석 없이 `무승부` 없음 규칙 필요 시 재경기 요청(현 명세는 동점 시 `user1` 우선 규칙으로 처리하지 않고 422 반환 — 운영 정책 확정 필요)
5. 승자 `player_rank_score += 8`, 패자 `player_rank_score -= 3` (0 미만으로 내려가지 않음)
6. 승자 `battle_win_count += 1`, 패자 `battle_lose_count += 1`
7. 항목별 비교를 바탕으로 각자에게 `feedback1`, `feedback2`(좋았던 점/개선한 점) 생성

### GET /battle/<id>

대결 결과 조회.

- 200:

```json
{
  "battle_id": 0,
  "field": "string",
  "status": "pending|completed",
  "user1": "string",
  "user2": "string",
  "category_scores": {
    "completeness": [8, 5],
    "structure": [4, 5],
    "tech": [0, 0],
    "docs": [0, 0],
    "test": [0, 0],
    "deploy": [0, 0],
    "github": [0, 0]
  },
  "result1": 0,
  "result2": 0,
  "winner": "string",
  "feedback": { "user1": "string", "user2": "string" },
  "created_at": "ISO8601"
}
```

- 404

### GET /battle?username=<username>

특정 사용자의 대결 기록(최신순).

- 200: `[{ "battle_id", "field", "opponent", "result", "created_at" }]`

---

## 6. 분석 모듈 (내부 인터페이스, API 아님)

`POST /portfolio`와 대결 채점 로직이 공통으로 사용하는 내부 함수 계약.

```
analyze_repo(github_url: str, field: str) -> {
    "completeness": float,  # 0~30
    "structure": float,     # 0~10
    "tech": float,          # 0~15
    "docs": float,          # 0~5
    "test": float,          # 0~5
    "deploy": float,        # 0~15
    "github": float,        # 0~20
    "feedback_good": str,
    "feedback_improve": str,
}
```

실제 분석(정적 분석/GitHub API 조회/LLM 평가 등) 구현은 별도 모듈로 분리하고, 위 인터페이스만 맞추면 라우트 코드는 변경할 필요 없음.
