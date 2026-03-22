# Run VeedurIA locally

## Quick start

```bash
cd ~/Desktop/trabajo\ bogota\ 2026/VeedurIA/veeduria
source .venv/bin/activate
streamlit run app.py
```

Open **http://localhost:8501** in your browser.

## What you should see

```
You can now view your Streamlit app in your browser.

  Local URL: http://localhost:8501
```

No watchdog errors, no tracebacks.

## Why the venv?

Your system Python has a `watchdog` module conflict from `poly-agent/src/watchdog/`.
The `.venv` isolates Streamlit from that clash.

## If port 8501 is busy

```bash
lsof -ti :8501 | xargs kill -9
streamlit run app.py
```
