# GitHub Battle AI 분석 모듈

`github_battle_ai/`는 GitHub 저장소를 수집·전처리하고 7개 기준을 규칙으로 평가한다.
OpenAI는 확정된 점수와 승패를 변경하지 않고 근거와 피드백만 생성한다.

## 백엔드 연결

기존 Flask 백엔드는 `llm_analyzer.py`의 다음 호환 함수를 그대로 사용한다.

- `analyze_portfolio(repository, field)`
- `compare_portfolios(repository1, repository2, field)`
- `rank_for_score(score)`
- `rank_tier_diff(rank_a, rank_b)`

따라서 `app.py`와 DB 모델 변경 없이 규칙 기반 AI 분석기로 교체된다.

## 환경변수

```env
GITHUB_TOKEN=github_pat_...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
LLM_FALLBACK_TO_RULES=true
```

`.env`는 커밋하지 않는다.

## 점수 기준

- 프로젝트 완성도: 30점
- 코드 구조: 10점
- 기술 활용: 15점
- 문서화: 5점
- 테스트: 5점
- 배포: 15점
- GitHub 활용: 20점

총점으로 S~F 랭크를 결정하며 대결은 각 항목의 0~10 원점수 차이를 합산한다.
