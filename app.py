import os

from flask import Flask, render_template, request, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from enum import Enum

from llm_analyzer import (
    analyze_portfolio,
    compare_portfolios,
    AnalysisError,
    LLMError,
    RANK_SCORE_GAIN,
    rank_for_score,
    player_tier_for_score,
    player_tier_diff,
)

app = Flask(__name__, template_folder="templates")
# Fallbacks keep `python app.py` working out of the box for local dev; set
# SECRET_KEY / DATABASE_URL to override for anything beyond that. The
# fallback secret is already committed to git history — rotate it before
# ever running this anywhere but a local machine.
app.secret_key = os.environ.get(
    "SECRET_KEY", "ab5f48133f18fe10fc82073538e14b56d14f93b72aa7e19d7d2c805cf5a582a0"
)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "mysql+pymysql://user:0000@localhost:3306/battle"
)
db = SQLAlchemy()
db.init_app(app)
CORS(
    app,
    supports_credentials=True,
    origins=["http://localhost:5173"]
)

class User(db.Model):
    __tablename__ = "user"

    username = db.Column(db.String(30), primary_key=True)
    password = db.Column(db.String(255), nullable=False)
    github_username = db.Column(db.String(50), nullable=False)
    main_field = db.Column(db.String(50))
    win = db.Column(db.Integer, nullable=False, default=0)
    lose = db.Column(db.Integer, nullable=False, default=0)
    player_rank_score = db.Column(db.Integer, nullable=False, default=0)
    win_streak = db.Column(db.Integer, nullable=False, default=0)

class Portfolio_Rank(Enum):
    S = "S"
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"
    F = "F"

class Portfolio(db.Model):
    __tablename__ = "portfolio"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(
        db.String(30),
        db.ForeignKey("user.username"),
        nullable=False
    )
    user = db.relationship("User")

    field = db.Column(db.String(50), nullable=False)
    repository = db.Column(
        db.String(1000),
        nullable=False
    )
    completeness_score = db.Column(db.Float)
    structur_score = db.Column(db.Float)
    tech_score = db.Column(db.Float)
    docs_score = db.Column(db.Float)
    test_score = db.Column(db.Float)
    deploy_score = db.Column(db.Float)
    github_score = db.Column(db.Float)
    score = db.Column(db.Float)
    rank = db.Column(
        db.Enum(Portfolio_Rank)
    )
    feedback_good = db.Column(db.Text)
    feedback_improve = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=db.func.now())

class Battle(db.Model):
    __tablename__ = "battle"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    field = db.Column(db.String(50), nullable=False)
    username1 = db.Column(
        db.String(30),
        db.ForeignKey("user.username"),
        nullable=False
    )
    username2 = db.Column(
        db.String(30),
        db.ForeignKey("user.username"),
        nullable=False
    )
    user1 = db.relationship("User", foreign_keys=[username1])
    user2 = db.relationship("User", foreign_keys=[username2])
    win_username = db.Column(
        db.String(30),
        db.ForeignKey("user.username"),
    )
    win_user = db.relationship("User", foreign_keys=[win_username])
    user1_portfolio_id = db.Column(
        db.Integer,
        db.ForeignKey("portfolio.id"),
        nullable=False
    )
    user2_portfolio_id = db.Column(
        db.Integer,
        db.ForeignKey("portfolio.id"),
        nullable=False
    )
    user1_portfolio = db.relationship("Portfolio", foreign_keys=[user1_portfolio_id])
    user2_portfolio = db.relationship("Portfolio", foreign_keys=[user2_portfolio_id])
    scores1 = db.Column(db.JSON)
    scores2 = db.Column(db.JSON)
    user1_portfolio_score = db.Column(
        db.Float,
        nullable=False
    )
    user2_portfolio_score = db.Column(
        db.Float,
        nullable=False
    )
    user1_portfolio_feedback = db.Column(db.Text)
    user2_portfolio_feedback = db.Column(db.Text)
    datetime = db.Column(db.DateTime, default=db.func.now())

class MatchQueue(db.Model):
    __tablename__ = "match_queue"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(
        db.String(30),
        db.ForeignKey("user.username"),
        nullable=False
    )
    field = db.Column(db.String(50), nullable=False)
    portfolio_id = db.Column(
        db.Integer,
        db.ForeignKey("portfolio.id"),
        nullable=False
    )
    status = db.Column(db.String(10), nullable=False, default="waiting")  # waiting | matched | cancelled
    matched_battle_id = db.Column(
        db.Integer,
        db.ForeignKey("battle.id"),
        nullable=True
    )
    created_at = db.Column(db.DateTime, default=db.func.now())

with app.app_context():
    db.create_all()

@app.get("/")
def main():
    return render_template("main.html")

def ok():
    return "", 200
def ok_data(data):
    return data, 200
def created():
    return "", 201
def bad_request():
    return "", 400
def unauthorized():
    return "", 401
def method_not_allowed():
    return "", 405
def created_data(data):
    return data, 201
def error_data(message, status):
    return {"error": message}, status

def _parse_body(*required_fields):
    data = None
    if all(request.form.get(f) for f in required_fields):
        data = {f: request.form.get(f) for f in required_fields}
    else:
        data = request.get_json(silent=True)
    return data

def _portfolio_to_dict(p):
    return {
        "id": p.id,
        "username": p.username,
        "field": p.field,
        "repository": p.repository,
        "completeness_score": p.completeness_score,
        "structur_score": p.structur_score,
        "tech_score": p.tech_score,
        "docs_score": p.docs_score,
        "test_score": p.test_score,
        "deploy_score": p.deploy_score,
        "github_score": p.github_score,
        "score": p.score,
        "rank": p.rank.value if p.rank else None,
        "feedback_good": p.feedback_good,
        "feedback_improve": p.feedback_improve,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }

def _apply_analysis_result(portfolio, result):
    portfolio.completeness_score = result["completeness_score"]
    portfolio.structur_score = result["structur_score"]
    portfolio.tech_score = result["tech_score"]
    portfolio.docs_score = result["docs_score"]
    portfolio.test_score = result["test_score"]
    portfolio.deploy_score = result["deploy_score"]
    portfolio.github_score = result["github_score"]
    portfolio.score = result["score"]
    portfolio.rank = Portfolio_Rank[result["rank"]]
    portfolio.feedback_good = result["feedback_good"]
    portfolio.feedback_improve = result["feedback_improve"]

def _battle_to_dict(b):
    return {
        "id": b.id,
        "field": b.field,
        "username1": b.username1,
        "username2": b.username2,
        "winner": b.win_username,
        "scores1": b.scores1,
        "scores2": b.scores2,
        "result1": b.user1_portfolio_score,
        "result2": b.user2_portfolio_score,
        "feedback1": b.user1_portfolio_feedback,
        "feedback2": b.user2_portfolio_feedback,
        "created_at": b.datetime.isoformat() if b.datetime else None,
    }

def _match_queue_to_dict(q):
    return {
        "id": q.id,
        "field": q.field,
        "portfolio_id": q.portfolio_id,
        "status": q.status,
        "matched_battle_id": q.matched_battle_id,
        "created_at": q.created_at.isoformat() if q.created_at else None,
    }

def _profile_to_dict(user):
    total_battles = user.win + user.lose
    win_rate = (user.win / total_battles) if total_battles > 0 else None

    scores = [
        p.score for p in Portfolio.query.filter_by(username=user.username).all()
        if p.score is not None
    ]
    portfolio_best_rank = rank_for_score(max(scores)) if scores else None
    portfolio_avg_rank = rank_for_score(sum(scores) / len(scores)) if scores else None

    return {
        "username": user.username,
        "github_username": user.github_username,
        "main_field": user.main_field,
        "player_rank": player_tier_for_score(user.player_rank_score),
        "player_rank_score": user.player_rank_score,
        "battle_win": user.win,
        "battle_lose": user.lose,
        "battle_win_rate": win_rate,
        "win_streak": user.win_streak,
        "portfolio_best_rank": portfolio_best_rank,
        "portfolio_avg_rank": portfolio_avg_rank,
    }

BATTLE_WIN_BASE_SCORE = 8
BATTLE_LOSS_SCORE = 3
STREAK_BONUS_PER_WIN = 2
STREAK_BONUS_CAP = 10

def _win_score_gain(win_streak_after):
    """win_streak_after is the streak count including the win just scored.
    +2 per consecutive win beyond the first, capped at +10 (so a long streak
    tops out at +18 total, matching the best single-portfolio score gain)."""
    bonus = min((win_streak_after - 1) * STREAK_BONUS_PER_WIN, STREAK_BONUS_CAP)
    return BATTLE_WIN_BASE_SCORE + bonus

def _resolve_battle(field, username1, portfolio1, username2, portfolio2):
    """두 포트폴리오를 비교 채점하고 Battle을 만들어 반환한다 (커밋은 호출자 책임).
    compare_portfolios()가 실패하면 AnalysisError/LLMError를 그대로 던진다."""
    comparison = compare_portfolios(portfolio1.repository, portfolio2.repository, field)

    result1 = sum(max(0.0, comparison["scores1"][k] - comparison["scores2"][k]) for k in comparison["scores1"])
    result2 = sum(max(0.0, comparison["scores2"][k] - comparison["scores1"][k]) for k in comparison["scores2"])

    winner = None
    if result1 > result2:
        winner = username1
    elif result2 > result1:
        winner = username2
    # 동점이면 winner = None (무승부)

    battle = Battle(
        field=field,
        username1=username1,
        username2=username2,
        win_username=winner,
        user1_portfolio_id=portfolio1.id,
        user2_portfolio_id=portfolio2.id,
        scores1=comparison["scores1"],
        scores2=comparison["scores2"],
        user1_portfolio_score=result1,
        user2_portfolio_score=result2,
        user1_portfolio_feedback=comparison["feedback1"],
        user2_portfolio_feedback=comparison["feedback2"],
    )

    user1 = db.get_or_404(User, username1)
    user2 = db.get_or_404(User, username2)
    if winner == username1:
        user1.win += 1
        user2.lose += 1
        user1.win_streak += 1
        user2.win_streak = 0
        user1.player_rank_score += _win_score_gain(user1.win_streak)
        user2.player_rank_score = max(0, user2.player_rank_score - BATTLE_LOSS_SCORE)
    elif winner == username2:
        user2.win += 1
        user1.lose += 1
        user2.win_streak += 1
        user1.win_streak = 0
        user2.player_rank_score += _win_score_gain(user2.win_streak)
        user1.player_rank_score = max(0, user1.player_rank_score - BATTLE_LOSS_SCORE)
    # 무승부: 승/패, 랭크 점수 변동 없음. 연승도 패배가 아니므로 끊지 않음.

    return battle

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        return "signup"
    elif request.method == "POST": #회원가입
        data = None
        if request.form.get("username") and request.form.get("password") and request.form.get("github_username"):
            data = {"username": request.form.get("username"), "password": request.form.get("password"), "github_username": request.form.get("github_username")}
        else:
            data = request.get_json() or request.json
        if not data == None:
            user = User(
                username=data["username"],
                password=generate_password_hash(data["password"]),
                github_username=data["github_username"],
            )
            try:
                db.session.add(user)
                db.session.commit()
                return created()
            except IntegrityError:
                db.session.rollback()
                return error_data("이미 존재하는 아이디입니다.", 409)
            except Exception:
                db.session.rollback()
                raise
        return bad_request()
    return method_not_allowed()
@app.route("/signin", methods=["GET", "POST"])
def signin():
    if request.method == "GET":
        return "signin"
    elif request.method == "POST": #로그인
        data = None
        if request.form.get("username") and request.form.get("password"):
            data = {"username": request.form.get("username"), "password": request.form.get("password")}
        else:
            data = request.get_json() or request.json
        if data is not None:
            user = User.query.get(data.get("username"))
            if not user or not check_password_hash(user.password, data.get("password")):
                return "", 404
            session["username"] = user.username
            return ok_data({"username": user.username})
    return method_not_allowed()
@app.get("/signout")
def signout():
    if session:
        session.clear() #로그아웃
        return ok()
    return unauthorized()

@app.get("/profile/<username>")
def profile_detail(username):
    user = User.query.get(username)
    if not user:
        return "", 404
    return ok_data(_profile_to_dict(user))

@app.route("/profile", methods=["PATCH"])
def profile_update():
    if not session:
        return unauthorized()
    data = request.get_json(silent=True) or request.form
    user = db.get_or_404(User, session["username"])
    if data.get("main_field"):
        user.main_field = data["main_field"]
    if data.get("github_username"):
        user.github_username = data["github_username"]
    db.session.commit()
    return ok_data(_profile_to_dict(user))

@app.route("/portfolios", methods=["GET", "POST"])
def portfolios():
    if request.method == "GET":
        # ?username= 지정 시 공개 조회(상대 포트폴리오 선택용), 없으면 내 목록
        username = request.args.get("username")
        if username:
            rows = Portfolio.query.filter_by(username=username).order_by(Portfolio.created_at.desc())
            return ok_data([_portfolio_to_dict(p) for p in rows])
        if not session:
            return unauthorized()
        rows = Portfolio.query.filter_by(username=session["username"]).order_by(Portfolio.created_at.desc())
        return ok_data([_portfolio_to_dict(p) for p in rows])

    if not session:
        return unauthorized()

    # POST: 포트폴리오 등록
    data = _parse_body("repository", "field")
    if data is None or not data.get("repository") or not data.get("field"):
        return bad_request()

    duplicate = Portfolio.query.filter_by(
        username=session["username"], repository=data["repository"]
    ).first()
    if duplicate:
        return error_data("이미 등록한 저장소입니다.", 409)

    try:
        result = analyze_portfolio(data["repository"], data["field"])
    except AnalysisError as e:
        return error_data(str(e), 422)
    except LLMError as e:
        return error_data(str(e), 502)

    portfolio = Portfolio(username=session["username"], repository=data["repository"], field=data["field"])
    _apply_analysis_result(portfolio, result)
    user = db.get_or_404(User, session["username"])
    user.player_rank_score += RANK_SCORE_GAIN[result["rank"]]
    try:
        db.session.add(portfolio)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return created_data(_portfolio_to_dict(portfolio))

@app.route("/portfolios/<int:portfolio_id>", methods=["GET", "PUT", "DELETE"])
def portfolio_detail(portfolio_id):
    portfolio = Portfolio.query.get(portfolio_id)
    if not portfolio:
        return "", 404

    if request.method == "GET": #단건 조회 (공개)
        return ok_data(_portfolio_to_dict(portfolio))

    if not session:
        return unauthorized()
    if portfolio.username != session["username"]:
        return "", 403

    if request.method == "DELETE": #포트폴리오 삭제
        in_use = Battle.query.filter(
            (Battle.user1_portfolio_id == portfolio_id) | (Battle.user2_portfolio_id == portfolio_id)
        ).first()
        if in_use:
            return "", 409
        db.session.delete(portfolio)
        db.session.commit()
        return ok()

    # PUT: 포트폴리오 수정 (재분석)
    data = _parse_body("repository", "field") or {}
    repository = data.get("repository") or portfolio.repository
    field = data.get("field") or portfolio.field

    if repository != portfolio.repository:
        duplicate = Portfolio.query.filter(
            Portfolio.username == session["username"],
            Portfolio.repository == repository,
            Portfolio.id != portfolio.id,
        ).first()
        if duplicate:
            return error_data("이미 등록한 저장소입니다.", 409)

    try:
        result = analyze_portfolio(repository, field)
    except AnalysisError as e:
        return error_data(str(e), 422)
    except LLMError as e:
        return error_data(str(e), 502)

    portfolio.repository = repository
    portfolio.field = field
    _apply_analysis_result(portfolio, result)
    user = db.get_or_404(User, session["username"])
    user.player_rank_score += RANK_SCORE_GAIN[result["rank"]]
    db.session.commit()
    return ok_data(_portfolio_to_dict(portfolio))

@app.route("/battles", methods=["GET", "POST"])
def battles():
    if not session:
        return unauthorized()

    if request.method == "GET": #내 대결 기록 조회
        rows = Battle.query.filter(
            (Battle.username1 == session["username"]) | (Battle.username2 == session["username"])
        ).order_by(Battle.datetime.desc())
        return ok_data([_battle_to_dict(b) for b in rows])

    # POST: 대결 신청 및 즉시 채점 (매칭 대기열은 아직 없음 — 상대를 직접 지정하는 친구 대결만 지원)
    data = _parse_body("field", "opponent_username", "portfolio_id", "opponent_portfolio_id") or {}
    field = data.get("field")
    opponent_username = data.get("opponent_username")
    portfolio_id = data.get("portfolio_id")
    opponent_portfolio_id = data.get("opponent_portfolio_id")
    if not (field and opponent_username and portfolio_id and opponent_portfolio_id):
        return bad_request()

    my_username = session["username"]
    if opponent_username == my_username:
        return bad_request()

    opponent = User.query.get(opponent_username)
    if not opponent:
        return "", 404

    my_portfolio = Portfolio.query.get(portfolio_id)
    opponent_portfolio = Portfolio.query.get(opponent_portfolio_id)
    if not my_portfolio or my_portfolio.username != my_username or my_portfolio.field != field:
        return bad_request()
    if not opponent_portfolio or opponent_portfolio.username != opponent_username or opponent_portfolio.field != field:
        return bad_request()

    try:
        battle = _resolve_battle(field, my_username, my_portfolio, opponent_username, opponent_portfolio)
    except AnalysisError as e:
        return error_data(str(e), 422)
    except LLMError as e:
        return error_data(str(e), 502)

    try:
        db.session.add(battle)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return created_data(_battle_to_dict(battle))

@app.route("/battles/match", methods=["GET", "POST", "DELETE"])
def battle_match():
    if not session:
        return unauthorized()
    my_username = session["username"]

    if request.method == "DELETE": #대기열에서 나가기
        entry = MatchQueue.query.filter_by(username=my_username, status="waiting").first()
        if not entry:
            return "", 404
        db.session.delete(entry)
        db.session.commit()
        return ok()

    if request.method == "GET": #내 매칭 상태 조회 (waiting -> matched 전환을 폴링으로 확인)
        entry = MatchQueue.query.filter(
            MatchQueue.username == my_username,
            MatchQueue.status.in_(["waiting", "matched"]),
        ).order_by(MatchQueue.created_at.desc()).first()
        if not entry:
            return "", 404
        return ok_data(_match_queue_to_dict(entry))

    # POST: 매칭 신청 (분야가 같고 랭크가 최대 한 단계 차이나는 대기자와 즉시 매칭, 없으면 대기열 등록)
    data = _parse_body("field", "portfolio_id") or {}
    field = data.get("field")
    portfolio_id = data.get("portfolio_id")
    if not (field and portfolio_id):
        return bad_request()

    my_portfolio = Portfolio.query.get(portfolio_id)
    if not my_portfolio or my_portfolio.username != my_username or my_portfolio.field != field:
        return bad_request()

    # 이미 대기 중인 내 요청이 있으면 재사용하되, 그 사이 상대가 들어왔을 수 있으니
    # 곧바로 반환하지 않고 아래에서 매칭을 다시 시도한다 (재클릭 시에도 매칭이 진행되도록).
    my_entry = MatchQueue.query.filter_by(username=my_username, field=field, status="waiting").first()
    if my_entry:
        my_entry.portfolio_id = my_portfolio.id
    else:
        my_entry = MatchQueue(username=my_username, field=field, portfolio_id=my_portfolio.id, status="waiting")
        db.session.add(my_entry)

    me = db.get_or_404(User, my_username)
    my_tier_index = player_tier_for_score(me.player_rank_score)["index"]

    candidates = MatchQueue.query.filter(
        MatchQueue.field == field,
        MatchQueue.status == "waiting",
        MatchQueue.username != my_username,
    ).order_by(MatchQueue.created_at.asc()).all()

    opponent_entry = None
    for candidate in candidates:
        opponent = User.query.get(candidate.username)
        if opponent:
            opponent_tier_index = player_tier_for_score(opponent.player_rank_score)["index"]
            if player_tier_diff(my_tier_index, opponent_tier_index) <= 1:
                opponent_entry = candidate
                break

    if opponent_entry is None: #대기 중인 상대가 없으면 (재)대기
        db.session.commit()
        return created_data(_match_queue_to_dict(my_entry))

    # 매칭 성립: 즉시 채점
    opponent_portfolio = Portfolio.query.get(opponent_entry.portfolio_id)
    try:
        battle = _resolve_battle(field, my_username, my_portfolio, opponent_entry.username, opponent_portfolio)
    except AnalysisError as e:
        return error_data(str(e), 422)
    except LLMError as e:
        return error_data(str(e), 502)

    db.session.add(battle)
    db.session.flush()  # battle.id 확보
    opponent_entry.status = "matched"
    opponent_entry.matched_battle_id = battle.id
    my_entry.status = "matched"
    my_entry.matched_battle_id = battle.id
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return created_data(_battle_to_dict(battle))

@app.get("/battles/<int:battle_id>")
def battle_detail(battle_id):
    if not session:
        return unauthorized()
    battle = Battle.query.get(battle_id)
    if not battle:
        return "", 404
    if session["username"] not in (battle.username1, battle.username2):
        return "", 403
    return ok_data(_battle_to_dict(battle))

@app.get("/my")
def my():
    if session and "username" in session:
        return ok_data({"username": session["username"]})
    return unauthorized()

LEADERBOARD_LIMIT = 100

@app.get("/leaderboard")
def leaderboard():
    field = request.args.get("field")
    query = User.query
    if field:
        query = query.filter_by(main_field=field)
    users = query.order_by(User.player_rank_score.desc()).limit(LEADERBOARD_LIMIT).all()
    return ok_data([
        {
            "username": u.username,
            "main_field": u.main_field,
            "player_rank": player_tier_for_score(u.player_rank_score),
            "player_rank_score": u.player_rank_score,
            "battle_win": u.win,
            "battle_lose": u.lose,
            "win_streak": u.win_streak,
        }
        for u in users
    ])

if __name__ == "__main__":
    # macOS AirPlay Receiver occupies :5000 — use 5001 for local Vite proxy.
    app.run(host="127.0.0.1", port=5001, debug=True)