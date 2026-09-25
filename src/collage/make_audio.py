"""Sound for the paper-collage reel: a playful marimba/clap groove (120 BPM)
plus paper foley (swish, slap, tape, tear, marker squeak) cued to collage.js.

Output: out/collage/sfx.wav (48 kHz stereo 16-bit).
"""
import sys
import wave

import numpy as np
from scipy import signal

SR, DUR = 48000, 4.5
N = int(SR * DUR)
OUT = sys.argv[1] if len(sys.argv) > 1 else "out/collage/sfx.wav"
rs = np.random.default_rng(7)
mix = np.zeros((N, 2))


def tv(d):
    return np.arange(int(d * SR)) / SR


def add(x, at, pan=0.0, gain=1.0):
    i = int(at * SR)
    a = (pan + 1) * np.pi / 4
    x = np.stack([x * np.cos(a), x * np.sin(a)], 1) * np.sqrt(2)
    n = min(len(x), N - i)
    if n > 0:
        mix[i:i + n] += x[:n] * gain


def bp(x, lo, hi):
    return signal.sosfilt(signal.butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def lp(x, f):
    return signal.sosfilt(signal.butter(2, f, "low", fs=SR, output="sos"), x)


def hp(x, f):
    return signal.sosfilt(signal.butter(2, f, "high", fs=SR, output="sos"), x)


def bell_env(n, peak=0.3, sharp=1.6):
    u = np.linspace(0, 1, n)
    return np.where(u < peak, (u / peak) ** sharp, ((1 - u) / (1 - peak)) ** sharp)


# ------------------------------------------------------------- instruments
def marimba(f, d=0.5, vel=1.0):
    t = tv(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 7) + 0.3 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 22) + 0.06 * np.sin(2 * np.pi * 9.9 * f * t) * np.exp(-t * 40)
    x[:120] *= np.linspace(0, 1, 120)
    return x * vel


def glock(f, d=1.4):
    t = tv(d)
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * k) for r, a, k in [(1, 1, 2.2), (2.76, 0.4, 4), (5.4, 0.15, 7)])


def clap():
    n = int(0.18 * SR)
    x = bp(rs.standard_normal(n), 900, 5000)
    env = np.zeros(n)
    for k, o in enumerate([0, 0.008, 0.017]):
        i = int(o * SR)
        env[i:] += np.exp(-np.arange(n - i) / SR * (60 if k < 2 else 22)) * (0.7 if k < 2 else 1)
    return x * env


def kick(f0=130, f1=48, d=0.3):
    t = tv(d)
    return np.sin(2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t * 30)) / SR) * np.exp(-t * 11)


def shaker():
    n = int(0.06 * SR)
    return hp(rs.standard_normal(n), 6000) * bell_env(n, 0.3, 1.2)


# ---------------------------------------------------------------- paper foley
def swish(d=0.16, lo=700, hi=4000):
    n = int(d * SR)
    return bp(rs.standard_normal(n), lo, hi) * bell_env(n, 0.35, 1.4)


def slap(big=1.0):
    t = tv(0.25)
    body = np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-t * 40)) / SR) * np.exp(-t * 20)
    crack = bp(rs.standard_normal(len(t)), 600, 7000) * np.exp(-t * 60)
    return (body * 0.9 + crack * 0.8) * big


def crackle(d, density=900, lo=1200, hi=7000):
    n = int(d * SR)
    x = np.zeros(n)
    k = int(density * d)
    idx = rs.integers(0, n, k)
    x[idx] = rs.uniform(-1, 1, k)
    x = bp(x, lo, hi) * 6 + 0.25 * bp(rs.standard_normal(n), lo, hi)
    return x


def tear(d=0.3):
    n = int(d * SR)
    x = crackle(d, 2600, 900, 8000)
    am = 0.6 + 0.4 * np.sin(np.linspace(0, 2 * np.pi * 9, n)) ** 2
    return x * am * bell_env(n, 0.15, 0.8)


def marker(d, rate=11):
    n = int(d * SR)
    x = bp(rs.standard_normal(n), 1800, 5200)
    t = np.arange(n) / SR
    am = np.abs(np.sin(np.pi * rate * t)) ** 1.5
    return x * am * bell_env(n, 0.1, 0.6)


# ------------------------------------------------------------------- groove
BEAT = 0.5
C4, D4, E4, F4, G4, A4, B4 = 261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88
prog = [([C4, E4, G4, 2 * C4], 0.0), ([A4 / 2, C4, E4, A4], 1.0), ([F4 / 2, A4 / 2, C4, F4], 2.0), ([G4 / 2, B4 / 2, D4, G4], 3.0)]
for notes, t0 in prog:
    add(marimba(notes[0] / 2, 0.9, 0.9), t0, -0.1, 0.35)
    for k, f in enumerate([notes[1], notes[2], notes[3], notes[2]]):
        add(marimba(f * 2, 0.4, 0.8 if k % 2 == 0 else 0.6), t0 + k * 0.25, 0.4 if k % 2 else -0.4, 0.22)
for b in range(7):
    t0 = b * BEAT
    if b % 2 == 0:
        add(kick(), t0, gain=0.45)
    else:
        add(clap(), t0, 0.1, 0.33)
for k in range(28):
    add(shaker(), k * 0.125, 0.5 if k % 2 else -0.5, 0.08 if k % 2 else 0.05)
# ta-da ending on the number: C major glock chord + bass
add(kick(150, 45, 0.5), 3.5, gain=0.6)
add(marimba(C4 / 2, 1.0, 1.0), 3.5, gain=0.4)
for f, p in [(2 * C4, -0.4), (2 * E4, 0.3), (2 * G4, -0.1), (4 * C4, 0.2)]:
    add(glock(f), 3.5, p, 0.12)

# ---------------------------------------------------------------------- foley
for i, t0 in enumerate([0.0, 0.05, 0.1, 0.15, 0.2]):
    add(swish(0.2, 600, 3500), t0 + 0.02, -0.6 if i % 2 == 0 else 0.6, 0.35)
add(marimba(2 * G4, 0.3), 0.3, 0.6, 0.3)                       # sun pop
for i in range(4):
    add(swish(0.12, 1500, 6000), 0.3 + i * 0.07, 0.5 - i * 0.3, 0.15)
for i in range(4):
    add(swish(0.22, 250, 1400), 0.18 + i * 0.07, 0, 0.3)       # mountains rise
for i in range(5):
    add(swish(0.22, 200, 1100), 0.4 + i * 0.07, 0, 0.25)       # hills
add(slap(1.0), 0.72, -0.3, 0.8)                                 # tandem photo slap
add(crackle(0.09), 0.82, -0.5, 0.35)                            # tape
add(crackle(0.09), 0.9, 0.2, 0.35)
add(marker(0.35), 0.9, -0.4, 0.28)                              # circle
add(marker(0.3, 14), 1.1, -0.2, 0.25)                           # 짜릿!
add(swish(0.2, 400, 2500), 1.22, 0.4, 0.35)
add(slap(0.8), 1.45, 0.4, 0.7)                                  # crew sticker
add(marker(0.25, 13), 1.55, 0.4, 0.25)                          # 이륙!
add(marker(0.28, 9), 1.64, 0.3, 0.22)                           # arrow
add(swish(0.25, 300, 2000), 2.02, 0, 0.4)
add(slap(1.2), 2.25, 0, 0.9)                                    # logo card
scale = [C4, D4, E4, G4, A4, 2 * C4, 2 * D4, 2 * E4]
for i, f in enumerate(scale):
    add(marimba(2 * f, 0.3), 2.3 + i * 0.05, -0.7 + i * 0.2, 0.3)  # letter stickers
add(swish(0.3, 500, 3000), 2.68, 0.6, 0.35)                     # wing flies in
add(marimba(4 * C4, 0.5), 2.98, 0.5, 0.25)
add(tear(0.32), 2.86, -0.3, 0.7)                                # red strip tears across
add(slap(0.9), 3.23, -0.4, 0.7)                                 # label
for i in range(9):
    if i == 4:
        continue
    t = tv(0.08)
    add(np.sin(2 * np.pi * (700 + i * 55) * t) * np.exp(-t * 60) + 0.3 * bp(rs.standard_normal(len(t)), 2000, 6000) * np.exp(-t * 90),
        3.18 + i * 0.045 + 0.1, -0.7 + i * 0.17, 0.35)          # digit tiles
for t0 in (3.45, 4.05):                                         # phone ring
    t = tv(0.35)
    trill = (np.sin(2 * np.pi * 1300 * t) + np.sin(2 * np.pi * 1630 * t)) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 22 * t)))
    add(trill * np.exp(-t * 6), t0, -0.3, 0.05)
add(marker(0.3, 12), 3.62, 0, 0.25)                             # underline

# --------------------------------------------------------------------- master
ir_t = tv(0.8)
ir = rs.standard_normal((len(ir_t), 2)) * np.exp(-ir_t * 7)[:, None]
ir = np.stack([lp(ir[:, 0], 5000), lp(ir[:, 1], 5000)], 1)
ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([signal.fftconvolve(mix[:, c], ir[:, c])[:N] for c in (0, 1)], 1)
out = hp((mix + 0.15 * wet).T, 30).T
out = np.tanh(out / np.abs(out).max() * 1.4) / np.tanh(1.4)
fade = np.ones(N)
fade[-int(0.3 * SR):] = np.linspace(1, 0, int(0.3 * SR)) ** 2
out *= fade[:, None] * 10 ** (-1 / 20)
with wave.open(OUT, "wb") as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes((out * 32767).astype("<i2").tobytes())
print("audio ->", OUT)
