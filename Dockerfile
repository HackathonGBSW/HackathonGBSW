FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py llm_analyzer.py ./
COPY github_battle_ai ./github_battle_ai

EXPOSE 5001

CMD ["gunicorn", "--workers", "2", "--timeout", "120", "--bind", "0.0.0.0:5001", "app:app"]
