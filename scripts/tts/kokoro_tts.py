#!/usr/bin/env python3
"""Generate a short WAV file with Kokoro for the Next.js TTS endpoint."""

from __future__ import annotations

import json
import sys
import wave
from pathlib import Path
from typing import Any

SAMPLE_RATE = 24000


def main() -> int:
    payload = json.load(sys.stdin)
    text = str(payload.get("text", "")).strip()
    output_path = Path(str(payload.get("outputPath", ""))).expanduser()
    voice = str(payload.get("voice") or "af_heart")
    lang_code = str(payload.get("langCode") or "a")
    speed = float(payload.get("speed") or 0.94)

    if not text:
        raise ValueError("Missing text")
    if not output_path:
        raise ValueError("Missing outputPath")

    try:
        import numpy
        from kokoro import KPipeline
    except Exception as exc:  # pragma: no cover - exercised by the API route.
        raise RuntimeError(
            "Kokoro dependencies are not installed. Run `python3 -m pip install kokoro>=0.9.4` "
            "and install espeak-ng (`brew install espeak-ng` on macOS)."
        ) from exc

    pipeline = KPipeline(lang_code=lang_code)
    chunks: list[Any] = []

    for _, _, audio in pipeline(text, voice=voice, speed=speed, split_pattern=r"\n+"):
        chunk = numpy.asarray(audio, dtype=numpy.float32)
        if chunk.size:
            chunks.append(chunk)

    if not chunks:
        raise RuntimeError("Kokoro did not generate audio")

    audio = numpy.concatenate(chunks)
    write_pcm16_wav(output_path, audio, numpy)
    print(json.dumps({"ok": True, "outputPath": str(output_path)}))
    return 0


def write_pcm16_wav(output_path: Path, audio: Any, numpy: Any) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    clipped = numpy.clip(audio, -1.0, 1.0)
    pcm = (clipped * 32767).astype(numpy.int16)

    with wave.open(str(output_path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(pcm.tobytes())


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
