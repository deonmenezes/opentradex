export type GuideCodeSample = {
  label: string;
  language: string;
  code: string;
};

export type GuideStep = {
  level: string;
  title: string;
  summary: string;
  outcome: string;
  highlights: string[];
  codeSamples: GuideCodeSample[];
};

export const guideBenchmarks = [
  {
    label: "Prompted LLM",
    value: "55-62%",
    note: "Draft benchmark band for raw prompting without task-specific tuning.",
  },
  {
    label: "Fine-tuned",
    value: "65-72%",
    note: "Illustrative range for a LoRA-tuned financial classification task.",
  },
  {
    label: "Fine-tuned + RAG",
    value: "68-75%",
    note: "Adds current retrieval context on top of a domain-adapted model.",
  },
  {
    label: "Reality check",
    value: "Validate it",
    note: "Slippage, data leakage, and regime change still matter more than slide-deck numbers.",
  },
];

export const guidePrinciples = [
  "Each level should deliver a usable result.",
  "Split by date so the model never sees the future.",
  "Keep monitoring and risk controls separate from prompting.",
  "Paper trade before you even think about live execution.",
];

export const guideResearchNotes = [
  "The accuracy bands and research framing here should be treated as draft guide copy until you validate them against your own data, date splits, fees, and execution assumptions.",
  "Nothing on this page is financial advice, a return guarantee, or a claim that a model can trade safely without human review.",
];

export const guideSteps: GuideStep[] = [
  {
    level: "Level 1",
    title: "Your first trading signal in about 50 lines",
    summary:
      "Start with a structured analyst prompt, force JSON output, and map one news item into a next-day directional signal.",
    outcome:
      "You finish with a working analysis function that can classify a headline as bullish, bearish, or neutral.",
    highlights: [
      "Use an OpenAI-compatible client so the same flow can point at OpenAI, Ollama, Together, or a local server.",
      "Low temperature plus JSON output keeps the model consistent enough to evaluate.",
      "Prompt for what is new versus what is already priced in.",
    ],
    codeSamples: [
      {
        label: "Prompt + analyzer",
        language: "python",
        code: `import json
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are a senior equity research analyst.
Analyze financial news and predict the most likely stock move for the NEXT TRADING DAY.
Respond only with JSON: {signal, confidence, reasoning, key_factors}"""

def analyze_news(news_text: str, ticker: str = "") -> dict:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.1,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Ticker: {ticker}\\nNews: {news_text}"},
        ],
    )
    return json.loads(response.choices[0].message.content)`,
      },
    ],
  },
  {
    level: "Level 2",
    title: "Backtest it so the prompt has to face prices",
    summary:
      "Join dated news to next-day returns, convert returns into labeled outcomes, and compute whether the signals would have helped.",
    outcome:
      "You stop guessing whether the prompt is useful and start measuring a real signal-to-result pipeline.",
    highlights: [
      "Classification accuracy is not enough; you still need a trade filter and return series.",
      "A confidence threshold is often the first useful lever.",
      "Multi-ticker scans show whether the workflow generalizes beyond one name.",
    ],
    codeSamples: [
      {
        label: "Dataset + backtest core",
        language: "python",
        code: `import numpy as np
import pandas as pd
import yfinance as yf

def build_backtest_dataset(ticker: str, news_list: list[dict]) -> pd.DataFrame:
    stock = yf.download(ticker, start="2024-01-01", end="2025-12-31")
    stock["next_day_return"] = stock["Close"].pct_change().shift(-1)
    rows = []

    for item in news_list:
        date = pd.Timestamp(item["date"])
        future = stock.loc[stock.index >= date, "next_day_return"]
        if future.empty:
            continue
        ret = float(future.iloc[0])
        actual = "BULLISH" if ret > 0.005 else ("BEARISH" if ret < -0.005 else "NEUTRAL")
        pred = analyze_news(item["text"], ticker)
        rows.append({"actual_return": ret, "actual_signal": actual, **pred})

    return pd.DataFrame(rows)

def run_backtest(df: pd.DataFrame) -> dict:
    accuracy = (df["signal"] == df["actual_signal"]).mean()
    returns = np.where((df["signal"] == "BULLISH") & (df["confidence"] >= 6), df["actual_return"], 0.0)
    sharpe = (returns.mean() / (returns.std() + 1e-9)) * np.sqrt(252)
    return {"accuracy": float(accuracy), "sharpe": float(sharpe)}`,
      },
    ],
  },
  {
    level: "Level 3",
    title: "Fine-tune a small model on your exact task",
    summary:
      "Build a date-split dataset, then use 4-bit loading plus LoRA adapters to teach a local model your label format and financial framing.",
    outcome:
      "You get a portable adapter tuned for your signal format, your examples, and your evaluation loop.",
    highlights: [
      "Date-based train, validation, and test splits matter more than almost any hyperparameter choice.",
      "LoRA lets you adapt a 7B model without retraining every parameter.",
      "Fine-tuning teaches the task behavior; it does not replace evaluation.",
    ],
    codeSamples: [
      {
        label: "Chronological dataset builder",
        language: "python",
        code: `import json
from pathlib import Path

class TradingDatasetBuilder:
    def __init__(self, output_dir="./dataset"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.examples = []

    def add_news_with_prices(self, news_items: list[dict], ticker: str):
        stock = yf.download(ticker, start="2023-01-01", end="2025-12-31", progress=False)
        stock["ret"] = stock["Close"].pct_change().shift(-1)

        for item in news_items:
            date = pd.Timestamp(item["date"])
            future = stock[stock.index >= date]
            if future.empty:
                continue
            ret = float(future["ret"].iloc[0])
            signal = "BULLISH" if ret > 0.01 else ("BEARISH" if ret < -0.01 else "NEUTRAL")
            self.examples.append({"input": item["text"], "output": json.dumps({"signal": signal}), "_date": item["date"]})

    def save(self):
        self.examples.sort(key=lambda row: row["_date"])
        clean = lambda rows: [{k: v for k, v in row.items() if not k.startswith("_")} for row in rows]
        n = len(self.examples)
        splits = {
            "train": clean(self.examples[: int(n * 0.85)]),
            "val": clean(self.examples[int(n * 0.85) : int(n * 0.95)]),
            "test": clean(self.examples[int(n * 0.95) :]),
        }
        for name, rows in splits.items():
            with open(self.output_dir / f"{name}.json", "w", encoding="utf-8") as handle:
                json.dump(rows, handle, indent=2)`,
      },
    ],
  },
  {
    level: "Level 4",
    title: "Add RAG so the model knows what happened today",
    summary:
      "Use embeddings plus a vector store to retrieve recent market context and inject it at inference time.",
    outcome:
      "Your model keeps its learned analysis style while receiving fresh context from current articles and watchlist-specific news.",
    highlights: [
      "Fine-tuning teaches the model how to think; retrieval gives it the latest facts.",
      "Recent context matters because reactions depend on what changed, not just what was said.",
      "A lightweight FAISS stack is enough to test whether retrieval improves calibration.",
    ],
    codeSamples: [
      {
        label: "Financial RAG skeleton",
        language: "python",
        code: `import json
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

class FinancialRAG:
    def __init__(self):
        self.embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")
        self.vectorstore = None

    def add_news(self, articles: list[dict]):
        texts = [article["text"] for article in articles]
        if self.vectorstore is None:
            self.vectorstore = FAISS.from_texts(texts, self.embeddings)
        else:
            self.vectorstore.add_texts(texts)

    def context_for(self, news: str, ticker: str = "") -> str:
        docs = self.vectorstore.similarity_search(f"{ticker} {news}", k=3) if self.vectorstore else []
        return "\\n---\\n".join(doc.page_content for doc in docs)`,
      },
    ],
  },
  {
    level: "Level 5",
    title: "Use multiple agents so every trade gets argued before it is sized",
    summary:
      "Break the job into specialized analysts, then synthesize their arguments with a portfolio-manager style final pass.",
    outcome:
      "Instead of one opaque answer, you get structured disagreement, consensus, and role-specific reasoning.",
    highlights: [
      "A bull analyst, bear analyst, and quant analyst is already enough to improve reasoning structure.",
      "Consensus is useful as a sizing input; split decisions usually deserve less risk.",
      "This is where debate starts to matter more than one-shot confidence scores.",
    ],
    codeSamples: [
      {
        label: "Minimal multi-agent trader",
        language: "python",
        code: `import json

class MultiAgentTrader:
    def __init__(self, client, model="trading-lora"):
        self.client = client
        self.model = model

    def _ask(self, role_prompt, news, ticker):
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": role_prompt},
                {"role": "user", "content": f"Ticker: {ticker}\\nNews: {news}\\nJSON only."},
            ],
        )
        return json.loads(response.choices[0].message.content)

    def analyze(self, news, ticker):
        bull = self._ask("BULLISH analyst. Find every positive signal.", news, ticker)
        bear = self._ask("BEARISH analyst. Find every risk.", news, ticker)
        quant = self._ask("QUANT analyst. Only numbers and measurable deltas.", news, ticker)
        return {"bull": bull, "bear": bear, "quant": quant}`,
      },
    ],
  },
  {
    level: "Level 6",
    title: "Production means monitoring, risk controls, and paper execution first",
    summary:
      "Serve the model behind an OpenAI-compatible API, monitor drift, gate trades through hard risk rules, and start on paper.",
    outcome:
      "You end with a system that can say stop, reduce size, or skip entirely when signal quality degrades.",
    highlights: [
      "A model monitor should be able to halt the system when rolling quality drops too far.",
      "Risk management is a separate service boundary, not a prompt afterthought.",
      "Paper trading is the proving ground; live execution is an explicit upgrade.",
    ],
    codeSamples: [
      {
        label: "Monitor + risk layer",
        language: "python",
        code: `from collections import deque
from dataclasses import dataclass
import numpy as np

class ModelMonitor:
    def __init__(self, window=100):
        self.predictions = deque(maxlen=window)
        self.actuals = deque(maxlen=window)
        self.returns = deque(maxlen=window)
        self.baseline_accuracy = 0.68

    def status(self):
        if len(self.predictions) < 30:
            return {"status": "WARMING_UP"}
        acc = sum(p == a for p, a in zip(self.predictions, self.actuals)) / len(self.predictions)
        sharpe = (np.mean(self.returns) / (np.std(self.returns) + 1e-9)) * np.sqrt(252)
        if acc < self.baseline_accuracy * 0.8 or sharpe < 0:
            return {"status": "HALT"}
        if acc < self.baseline_accuracy * 0.9:
            return {"status": "CAUTION"}
        return {"status": "HEALTHY"}

@dataclass
class TradeOrder:
    ticker: str
    side: str
    size: float
    stop_loss: float
    take_profit: float
    reason: str`,
      },
    ],
  },
];

export const guideInstallCommands = [
  {
    label: "Python starter stack",
    command: "pip install openai yfinance pandas numpy scikit-learn",
  },
  {
    label: "OpenTradex onboarding",
    command: "npm install -g opentradex@latest && opentradex onboard",
  },
  {
    label: "Alt package flow",
    command: "npx opentradex@latest onboard",
  },
  {
    label: "Hosted installer",
    command: "curl -fsSL https://opentradex.vercel.app/install.sh | bash",
  },
];
