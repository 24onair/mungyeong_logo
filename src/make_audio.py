"""Sound design for the 4.5s reel, synthesized from scratch and cued to reel.js.

Output: out/sfx.wav (48 kHz, stereo, 16-bit). Every cue time below mirrors a
visual hit in reel.js, so change them together.
"""
import sys
import wave

import numpy as np
from scipy import signal

SR = 48000
DUR = 4.5
N = int(SR * DUR)
OUT = sys.argv[1] if len(sys.argv) > 1 else "out/sfx.wav"
rs = np.random.default_rng(2024)
mix = np.zeros((N, 2))


def tvec(d):
    return np.arange(int(d * SR)) / SR


def add(x, at, pan=0.0, gain=1.0):
    """Mix mono or stereo x starting at `at` seconds, equal-power pan in [-1, 1]."""
    i = int(at * SR)
    if x.ndim == 1:
        a = (pan + 1) * np.pi / 4
        x = np.stack([x * np.cos(a), x * np.sin(a)], 1) * np.sqrt(2)
    n = min(len(x), N - i)
    if n > 0:
        mix[i:i + n] += x[:n] * gain


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def hp(x, f):
    return signal.sosfilt(signal.butter(2, f, "high", fs=SR, output="sos"), x)


def lp(x, f):
    return signal.sosfilt(signal.butter(2, f, "low", fs=SR, output="sos"), x)


def sweep_noise(d, f0, f1, f2=None, q=0.6):
    """Noise through a band-pass whose centre glides f0 -> f1 (-> f2); block-wise."""
    n = int(d * SR)
    out = np.zeros(n)
    blk = 512
    zi = None
    src = rs.standard_normal(n)
    for s in range(0, n, blk):
        u = s / n
        f = f0 * (f1 / f0) ** (u * 2) if f2 and u < 0.5 else (f1 * (f2 / f1) ** ((u - 0.5) * 2) if f2 else f0 * (f1 / f0) ** u)
        sos = signal.butter(1, [f * (1 - q / 2), f * (1 + q / 2)], "band", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        out[s:s + blk], zi = signal.sosfilt(sos, src[s:s + blk], zi=zi)
    return out / (np.abs(out).max() + 1e-9)


def env_bell(n, peak=0.5, sharp=2.0):
    u = np.linspace(0, 1, n)
    return np.where(u < peak, (u / peak) ** sharp, ((1 - u) / (1 - peak)) ** sharp)


def kick(f0=160, f1=42, d=0.45, click=0.3):
    t = tvec(d)
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    x[:240] += click * rs.standard_normal(240) * np.linspace(1, 0, 240)
    return x


def pluck(f, d=0.22, bright=0.35):
    t = tvec(d)
    fm = f * (1 + 0.5 * np.exp(-t * 60))
    ph = 2 * np.pi * np.cumsum(fm) / SR
    return (np.sin(ph) + bright * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)) * np.exp(-t * 16)


def bell(f, d=1.6, decay=3.0):
    t = tvec(d)
    parts = [(1, 1, 1), (2.76, 0.35, 1.8), (5.4, 0.18, 3), (8.93, 0.08, 4.5)]
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * decay * k) for r, a, k in parts)


# 0.00 opening punch + intro wing whoosh (sweeps L -> R with the white wing)
add(kick(190, 45, 0.5, 0.6), 0.0, gain=0.9)
add(hp(rs.standard_normal(int(0.12 * SR)), 3000) * np.exp(-tvec(0.12) * 35), 0.0, gain=0.35)
w = sweep_noise(0.5, 300, 2600, 700) * env_bell(int(0.5 * SR), 0.45)
add(np.stack([w * np.linspace(1, 0.2, len(w)), w * np.linspace(0.2, 1, len(w))], 1), 0.0, gain=0.55)
# 0.20-0.50 stripe wipe swish
add(sweep_noise(0.32, 1500, 7000) * env_bell(int(0.32 * SR), 0.7, 1.5), 0.2, pan=0.3, gain=0.4)
# 0.40-0.80 riser into the slam (rising hi-pass noise + pitch riser)
r = sweep_noise(0.4, 400, 6000, q=1.2) * np.linspace(0, 1, int(0.4 * SR)) ** 2.2
tt = tvec(0.4)
r += 0.35 * np.sin(2 * np.pi * np.cumsum(200 + 900 * (tt / 0.4) ** 2) / SR) * (tt / 0.4) ** 2
add(r, 0.4, gain=0.55)

# 0.80 SLAM: sub boom + crack + mid thump
tb = tvec(1.4)
boom = np.sin(2 * np.pi * np.cumsum(30 + 50 * np.exp(-tb * 5)) / SR) * np.exp(-tb * 2.6)
add(boom, 0.8, gain=1.0)
add(kick(220, 50, 0.6, 0.9), 0.8, gain=0.9)
crack = rs.standard_normal(int(0.25 * SR)) * np.exp(-tvec(0.25) * 22)
add(np.stack([bp(crack, 800, 9000), bp(rs.standard_normal(len(crack)), 800, 9000) * np.exp(-tvec(0.25) * 22)], 1), 0.8, gain=0.55)
add(lp(rs.standard_normal(int(0.9 * SR)), 900) * np.exp(-tvec(0.9) * 5), 0.8, gain=0.35)  # debris rumble

# 1.26.. letters land on 16ths: ascending pentatonic plucks, panned across the word
notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]
for i, f in enumerate(notes):
    add(pluck(f), 1.18 + i * 0.1 + 0.07, pan=-0.6 + i * 0.24, gain=0.33)
    add(kick(300, 120, 0.08, 0.1), 1.18 + i * 0.1 + 0.07, gain=0.18)

# 1.42-2.06 wing flight: long airy whoosh, pans with the flight path (R -> L -> R)
d = 0.72
w = sweep_noise(d, 250, 1800, 500, q=0.8) * env_bell(int(d * SR), 0.35, 1.6)
pan = np.interp(np.linspace(0, 1, len(w)), [0, 0.3, 0.6, 1], [0.8, -0.8, -0.2, 0.6])
a = (pan + 1) * np.pi / 4
add(np.stack([w * np.cos(a), w * np.sin(a)], 1) * 1.4, 1.40, gain=0.55)
# 1.98 slab slides up
add(sweep_noise(0.4, 120, 900) * env_bell(int(0.4 * SR), 0.35), 1.98, gain=0.45)

# 2.06 wing lands: soft thump + glint shimmer arpeggio
add(kick(140, 55, 0.35, 0.2), 2.06, gain=0.55)
for i, f in enumerate([2093.0, 2637.0, 3136.0, 4186.0]):
    add(bell(f, 0.9, 5) * 0.25, 2.1 + i * 0.05, pan=-0.4 + i * 0.3, gain=0.35)

# 2.30 booking tag pop
tp = tvec(0.12)
add(np.sin(2 * np.pi * np.cumsum(300 + 1200 * tp / 0.12) / SR) * np.exp(-tp * 30), 2.3, gain=0.35)
add(kick(200, 70, 0.2, 0.2), 2.3, gain=0.4)

# 2.36-2.94 slot-machine ticks, then a woody "lock" per digit
for tk in np.arange(2.37, 2.9, 0.021):
    add(bp(rs.standard_normal(260), 2500, 6000) * np.exp(-tvec(260 / SR) * 400), tk, pan=rs.uniform(-0.5, 0.5), gain=0.22)
for i in range(9):
    if i == 4:
        continue
    tl = tvec(0.09)
    add(np.sin(2 * np.pi * (900 + i * 40) * tl) * np.exp(-tl * 55), 2.56 + i * 0.045, pan=-0.7 + i * 0.17, gain=0.3)

# 2.93 final sting: kick + bright bell chord that rings out to the end
add(kick(170, 45, 0.7, 0.5), 2.93, gain=0.95)
add(boom[: int(0.9 * SR)] * 0.6, 2.93)
for f, p in [(523.25, -0.5), (659.25, 0.5), (783.99, -0.2), (1174.66, 0.3), (1567.98, 0.0)]:
    add(bell(f, 1.57, 1.7), 2.93, pan=p, gain=0.16)
add(sweep_noise(0.25, 3000, 9000) * env_bell(int(0.25 * SR), 0.2), 2.9, gain=0.3)  # underline swish

# phone "brrring" trill when the icon rings (3.0, 3.85)
for t0 in (3.0, 3.85):
    tr = tvec(0.42)
    trill = (np.sin(2 * np.pi * 1300 * tr) + np.sin(2 * np.pi * 1630 * tr)) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 22 * tr)))
    add(trill * np.exp(-tr * 5) * env_bell(len(tr), 0.05, 0.5), t0, pan=-0.25, gain=0.07)
# number glint + final logo glint
for t0 in (3.3, 3.95):
    for i, f in enumerate([3520.0, 4186.0, 5274.0]):
        add(bell(f, 0.6, 7) * 0.2, t0 + 0.12 + i * 0.05, pan=-0.3 + i * 0.3, gain=0.3)

# light 16th hats from 1.2s to the sting keep the pulse moving
for k, tk in enumerate(np.arange(1.2, 2.9, 0.1)):
    h = hp(rs.standard_normal(1200), 8000) * np.exp(-tvec(1200 / SR) * (90 if k % 2 else 45))
    add(h, tk, pan=0.35 if k % 2 else -0.35, gain=0.07 if k % 2 else 0.11)

# --- master: small room reverb, glue, fade
ir_t = tvec(1.1)
ir = np.stack([rs.standard_normal(len(ir_t)), rs.standard_normal(len(ir_t))], 1) * np.exp(-ir_t * 5.5)[:, None]
ir = np.stack([lp(ir[:, 0], 6000), lp(ir[:, 1], 6000)], 1)
ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([signal.fftconvolve(mix[:, c], ir[:, c])[:N] for c in (0, 1)], 1)
out = mix + 0.22 * wet
out = hp(out.T, 25).T
out = np.tanh(out * 1.1 / np.abs(out).max() * 1.3) / np.tanh(1.3)
fade = np.ones(N)
fade[-int(0.25 * SR):] = np.linspace(1, 0, int(0.25 * SR)) ** 2
out *= fade[:, None] * 10 ** (-1 / 20)

with wave.open(OUT, "wb") as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes((out * 32767).astype("<i2").tobytes())
print("audio ->", OUT, f"peak {np.abs(out).max():.2f}")
