import math
import os
import struct
import wave
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


FILES = [
    ("kadai", "n2_kadai_01.wav", 440.0),
    ("kadai", "n2_kadai_02.wav", 466.16),
    ("point", "n2_point_01.wav", 523.25),
    ("point", "n2_point_02.wav", 587.33),
    ("gaiyo", "n2_gaiyo_01.wav", 659.25),
    ("gaiyo", "n2_gaiyo_02.wav", 698.46),
    ("sokuji", "n2_sokuji_01.wav", 783.99),
    ("sokuji", "n2_sokuji_02.wav", 880.0),
    ("togo", "n2_togo_01.wav", 987.77),
    ("togo", "n2_togo_02.wav", 1046.5),
]


def write_tone_wav(path: Path, freq_hz: float, seconds: float = 1.6, sample_rate: int = 44100) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    n = int(seconds * sample_rate)
    amp = 0.20

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)

        for i in range(n):
            t = i / sample_rate
            fade = min(1.0, i / (0.02 * sample_rate), (n - i) / (0.02 * sample_rate))
            s = amp * fade * math.sin(2.0 * math.pi * freq_hz * t)
            wf.writeframes(struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)))


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    out_dir = repo_root / "docs" / "imports" / "audio_n2_sample"
    zip_path = repo_root / "docs" / "imports" / "listening_n2_audio_sample.zip"

    for _section, fname, freq in FILES:
        write_tone_wav(out_dir / fname, freq_hz=freq)

    with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as zf:
        for _section, fname, _freq in FILES:
            zf.write(out_dir / fname, arcname=fname)

    print(f"Wrote {len(FILES)} WAV files to: {out_dir}")
    print(f"Wrote ZIP to: {zip_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

