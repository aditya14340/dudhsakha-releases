#!/usr/bin/env python3
"""
TTS Bridge — Microsoft Edge Neural TTS for DudhSakha desktop app.
Uses the same JSON stdin/stdout pattern as fatmachine_bridge.py.

Input  (from main.js via stdin):
  {"action": "speak", "text": "...", "voice": "mr-IN-AarohiNeural"}
  {"action": "stop"}

Output (to main.js via stdout):
  {"type": "ready"}
  {"type": "audio_data", "data": "<base64_mp3>"}
  {"type": "stopped"}
  {"type": "error", "message": "..."}

main.js reads the base64 MP3 and sends it to the renderer via 'tts-play-audio'.
The renderer plays it with the browser Audio API — no Python audio lib needed.
"""

import sys
import json
import asyncio
import base64
import io

# ── Force UTF-8 on stdin/stdout ─────────────────────────────────────────────
# Windows defaults sys.stdin/stdout to cp1252 which cannot decode Marathi.
# PYTHONUTF8=1 env var (set by main.js) also does this, but we do it here too
# as a safety net in case the env var is not inherited correctly.
if hasattr(sys.stdin, 'buffer'):
    sys.stdin  = io.TextIOWrapper(sys.stdin.buffer,  encoding='utf-8', errors='replace')
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8',
                                  line_buffering=True, errors='replace')


def send(msg: dict):
    """Write a JSON message to stdout so Electron main.js can read it."""
    print(json.dumps(msg, ensure_ascii=True), flush=True)  # ensure_ascii=True → pure ASCII output


def get_edge_tts():
    """Import edge_tts, auto-installing it via pip if missing."""
    try:
        import edge_tts
        return edge_tts
    except ImportError:
        send({"type": "status", "message": "Installing edge-tts (first run only)..."})
        import subprocess
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "edge-tts", "-q"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception as e:
            send({"type": "error", "message": f"pip install edge-tts failed: {e}"})
            return None
        try:
            import edge_tts
            send({"type": "status", "message": "edge-tts installed successfully."})
            return edge_tts
        except ImportError as e:
            send({"type": "error", "message": f"edge-tts import failed after install: {e}"})
            return None


async def generate_audio_b64(text: str, voice: str, edge_tts) -> str:
    """
    Stream audio chunks from Microsoft Edge Neural TTS.
    Returns all audio concatenated and base64-encoded as an ASCII string.
    """
    communicate = edge_tts.Communicate(text=text, voice=voice, rate="-10%")
    audio = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return base64.b64encode(audio).decode("ascii")


def main():
    send({"type": "ready"})

    edge_tts = get_edge_tts()
    if not edge_tts:
        # Cannot proceed — drain stdin so the process doesn't exit immediately
        # (exiting would trigger a restart loop in main.js)
        for _ in sys.stdin:
            pass
        return

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue

        try:
            cmd = json.loads(raw)
        except json.JSONDecodeError as e:
            send({"type": "error", "message": f"JSON parse error: {e}"})
            continue

        action = cmd.get("action", "")

        if action == "speak":
            text  = cmd.get("text", "").strip()
            voice = cmd.get("voice", "mr-IN-AarohiNeural")
            if not text:
                continue
            try:
                b64 = loop.run_until_complete(generate_audio_b64(text, voice, edge_tts))
                send({"type": "audio_data", "data": b64})
            except Exception as e:
                send({"type": "error", "message": f"TTS generation failed: {e}"})

        elif action == "stop":
            # Each speak request is synchronous; nothing to stop mid-stream
            send({"type": "stopped"})

        else:
            send({"type": "error", "message": f"Unknown action: '{action}'"})


if __name__ == "__main__":
    main()
