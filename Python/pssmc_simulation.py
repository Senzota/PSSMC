"""
============================================================
PSSMC Simulation — Kasprowiak Two-DOF Regenerative Chatter
============================================================
Generates data arrays for page-5.html (Results & Discussion).

Three controllers compared:
  1. No Control       — pure undamped chatter (worst case)
  2. Standard SMC     — fixed gains lambda, K_sw, phi
  3. PSSMC (novel)    — adaptive lambda(t), Tp(t), phi(t)

System: Kasprowiak two-DOF model.
  c1 = c2 = 0 (NO DAMPING — hardest test case, infinite chatter).

Output: JavaScript array literals + scalar metrics,
written to a file ready to paste into page-5.html.

Author:  Fadhil Shuma (PSSMC Research Archive)
Solver:  scipy.integrate.solve_ivp (Radau, stiff-friendly)
============================================================
"""

import numpy as np
from scipy.integrate import solve_ivp

import math
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


# ── Physical parameters (Kasprowiak et al.) ────────────────
m1 = 0.2      # tool mass            (kg)
k1 = 2.2e9    # tool stiffness       (N/m)
c1 = 0.0      # tool damping         (kg/s)   ← NO DAMPING
m2 = 3.0      # workpiece mass       (kg)
k2 = 1.7e8    # workpiece stiffness  (N/m)
c2 = 0.0      # workpiece damping    (kg/s)   ← NO DAMPING

# ── Cutting parameters ─────────────────────────────────────
fz = 0.2      # feed per tooth        (mm)
ap = 0.5      # axial depth of cut    (mm)
Kc = 1500.0   # specific cutting force (N/mm²)

# ── Standard SMC (fixed gains) ─────────────────────────────
lam_smc = 44.1     # sliding-surface slope
K_sw    = 1000.0    # switching gain
phi_smc = 0.001   # boundary-layer thickness (large → smooth)

# ── PSSMC initial values + adaptation gains ────────────────
lam0  = 1.0
Tp0   = 8.0e-6
phi0  = 0.001
g1    = 2.0   # gain on lambda dot
g2    = 1.0        # gain on Tp dot
g3    = 0.0001      # gain on phi dot

# Lower bounds (stability enforcement)
lam_min = 1.0
Tp_min  = 1.0e-6
phi_min = 1.0e-4


# ╔══════════════════════════════════════════════════════════╗
# ║  System dynamics                                         ║
# ╚══════════════════════════════════════════════════════════╝

def sys_nc(t, x):
    """No Control — pure regenerative chatter."""
    x1, x2, x3, x4 = x
    Fc = (fz - x1 + x3) * ap * Kc
    return [x2,
            (-k1 * x1 + Fc) / m1,
            x4,
            (-k2 * x3 - Fc) / m2]


def sys_smc(t, x):
    """Standard SMC — fixed lambda, K_sw, phi."""
    x1, x2, x3, x4, uc = x
    Fc  = (fz - x1 + x3) * ap * Kc
    e   = -x1
    ed  = -x2
    s   = ed + lam_smc * e
    ueq = -(k1 * x1 - lam_smc * m1 * x2)
    usw = K_sw * np.tanh(s / phi_smc)
    u   = ueq + usw
    return [x2,
            (-k1 * x1 + Fc + u) / m1,
            x4,
            (-k2 * x3 - Fc - u) / m2,
            u ** 2]


def sys_ps(t, x):
    """PSSMC — adaptive lambda(t), Tp(t), phi(t)."""
    x1, x2, x3, x4, lam, Tp, phi, uc = x
    lam = max(lam, lam_min)
    Tp  = max(Tp,  Tp_min)
    phi = max(phi, phi_min)
    Fc  = (fz - x1 + x3) * ap * Kc
    e   = -x1
    ed  = -x2
    s   = ed + lam * e
    x2d = (-k1 * x1 + Fc) / m1
    sdot = -x2d + lam * ed
    s_pred = s + Tp * sdot

    # adaptive laws (with projection at lower bounds)
    ld = (-g1 * s ** 2)  if lam > lam_min else max(0.0, -g1 * s ** 2)
    Td = (-g2 * s ** 2)  if Tp  > Tp_min  else max(0.0, -g2 * s ** 2)
    pd = (-g3 * abs(s))  if phi > phi_min else max(0.0, -g3 * abs(s))

    ueq = -(k1 * x1 - lam * m1 * x2)
    usw = K_sw * np.tanh(s_pred / phi)
    u   = ueq + usw

    return [x2,
            (-k1 * x1 + Fc + u) / m1,
            x4,
            (-k2 * x3 - Fc - u) / m2,
            ld, Td, pd,
            u ** 2]


# ╔══════════════════════════════════════════════════════════╗
# ║  Run simulations                                         ║
# ╚══════════════════════════════════════════════════════════╝

# Solver uses 2000 points internally for accuracy,
# but we output 1000 (every other) to keep JS file size reasonable.
N_SIM  = 2000
N_OUT  = 1000
T_END  = 0.01
t_eval = np.linspace(0, T_END, N_SIM)
opts   = dict(method='Radau', rtol=1e-6, atol=1e-9)

# Initial conditions (small perturbation in tool position)
ic_nc  = [1e-4, 0, 0, 0]
ic_smc = [1e-4, 0, 0, 0, 0]
ic_ps  = [1e-4, 0, 0, 0, lam0, Tp0, phi0, 0]

print("Running No Control simulation...")
snc  = solve_ivp(sys_nc,  (0, T_END), ic_nc,  t_eval=t_eval, **opts)
print("Running Standard SMC simulation...")
ssmc = solve_ivp(sys_smc, (0, T_END), ic_smc, t_eval=t_eval, **opts)
print("Running PSSMC simulation...")
sps  = solve_ivp(sys_ps,  (0, T_END), ic_ps,  t_eval=t_eval, **opts)

t = snc.t


# ╔══════════════════════════════════════════════════════════╗
# ║  Derived signals                                         ║
# ╚══════════════════════════════════════════════════════════╝

Fc_nc  = (fz - snc.y[0]  + snc.y[2])  * ap * Kc
Fc_smc = (fz - ssmc.y[0] + ssmc.y[2]) * ap * Kc
Fc_ps  = (fz - sps.y[0]  + sps.y[2])  * ap * Kc

lam_t = sps.y[4]
s_smc = (-ssmc.y[1]) + lam_smc * (-ssmc.y[0])
s_ps  = (-sps.y[1])  + lam_t   * (-sps.y[0])

# Reconstruct control signals (post-hoc)
U_smc, Ueq_smc, Usw_smc = [], [], []
U_ps,  Ueq_ps,  Usw_ps  = [], [], []

for i in range(N_SIM):
    x1, x2 = ssmc.y[0, i], ssmc.y[1, i]
    s = (-x2) + lam_smc * (-x1)
    ueq = -(k1 * x1 - lam_smc * m1 * x2)
    usw = K_sw * np.tanh(s / phi_smc)
    U_smc.append(ueq + usw)
    Ueq_smc.append(ueq)
    Usw_smc.append(usw)

for i in range(N_SIM):
    x1, x2 = sps.y[0, i], sps.y[1, i]
    lam = max(sps.y[4, i], lam_min)
    Tp  = max(sps.y[5, i], Tp_min)
    phi = max(sps.y[6, i], phi_min)
    Fc  = (fz - x1 + sps.y[2, i]) * ap * Kc
    s   = (-x2) + lam * (-x1)
    x2d = (-k1 * x1 + Fc) / m1
    sdot = -x2d + lam * (-x2)
    s_pred = s + Tp * sdot
    ueq = -(k1 * x1 - lam * m1 * x2)
    usw = K_sw * np.tanh(s_pred / phi)
    U_ps.append(ueq + usw)
    Ueq_ps.append(ueq)
    Usw_ps.append(usw)

# Convert control lists to numpy arrays for slicing
U_smc   = np.array(U_smc)
Ueq_smc = np.array(Ueq_smc)
Usw_smc = np.array(Usw_smc)
U_ps    = np.array(U_ps)
Ueq_ps  = np.array(Ueq_ps)
Usw_ps  = np.array(Usw_ps)

# Downsample every 2nd point for output (2000 -> 1000)
idx = np.arange(0, N_SIM, N_SIM // N_OUT)
t_out      = t[idx]
y1_nc_out  = snc.y[0][idx]
y1_smc_out = ssmc.y[0][idx]
y1_ps_out  = sps.y[0][idx]
yd_nc_out  = snc.y[1][idx]
yd_smc_out = ssmc.y[1][idx]
yd_ps_out  = sps.y[1][idx]
Fc_nc_out  = Fc_nc[idx]
Fc_smc_out = Fc_smc[idx]
Fc_ps_out  = Fc_ps[idx]
s_smc_out  = s_smc[idx]
s_ps_out   = s_ps[idx]
lam_out    = sps.y[4][idx]
Tp_out     = sps.y[5][idx]
phi_out    = sps.y[6][idx]
U_smc_out  = U_smc[idx]
Ueq_smc_out= Ueq_smc[idx]
Usw_smc_out= Usw_smc[idx]
U_ps_out   = U_ps[idx]
Ueq_ps_out = Ueq_ps[idx]
Usw_ps_out = Usw_ps[idx]


# ╔══════════════════════════════════════════════════════════╗
# ║  Performance metrics                                     ║
# ╚══════════════════════════════════════════════════════════╝

# Metrics computed from FULL N=2000 data (more accurate)
chatter_smc = float(np.std(np.diff(s_smc)))
chatter_ps  = float(np.std(np.diff(s_ps)))
energy_smc  = float(np.trapezoid(ssmc.y[4], ssmc.t))
energy_ps   = float(np.trapezoid(sps.y[7], sps.t))

pct_chatter = (chatter_smc - chatter_ps) / max(chatter_smc, 1e-12) * 100
pct_energy  = (energy_smc  - energy_ps)  / max(energy_smc,  1e-12) * 100

rms_nc  = float(np.sqrt(np.mean(snc.y[0]  ** 2))) * 1e6
rms_smc = float(np.sqrt(np.mean(ssmc.y[0] ** 2))) * 1e6
rms_ps  = float(np.sqrt(np.mean(sps.y[0]  ** 2))) * 1e6

# Distribution of |y1| for chatter thresholds (used for HIGH/MED/LOW tiers)
abs_y1_nc  = np.abs(snc.y[0])  * 1e6
abs_y1_smc = np.abs(ssmc.y[0]) * 1e6
abs_y1_ps  = np.abs(sps.y[0])  * 1e6

print(f"\n┌──────────────────────────────────────────────┐")
print(f"│           SIMULATION RESULTS                  │")
print(f"├──────────────────────────────────────────────┤")
print(f"│ Chatter reduction (PSSMC vs SMC) : {pct_chatter:6.2f}%  │")
print(f"│ Energy reduction  (PSSMC vs SMC) : {pct_energy:6.2f}%   │")
print(f"│                                              │")
print(f"│ RMS y1 — No Control : {rms_nc:7.2f} μm           │")
print(f"│ RMS y1 — SMC        : {rms_smc:7.2f} μm           │")
print(f"│ RMS y1 — PSSMC      : {rms_ps:7.2f} μm           │")
print(f"│                                              │")
print(f"│ Max |y1| — NC  : {np.max(abs_y1_nc):7.2f} μm                │")
print(f"│ Max |y1| — SMC : {np.max(abs_y1_smc):7.2f} μm                │")
print(f"│ Max |y1| — PS  : {np.max(abs_y1_ps):7.2f} μm                │")
print(f"└──────────────────────────────────────────────┘")


# ╔══════════════════════════════════════════════════════════╗
# ║  Format arrays as JavaScript                             ║
# ╚══════════════════════════════════════════════════════════╝

def fmt(name, arr, sc=1.0, dec=3, sig=None):
    """Format numpy array as JS const declaration.
    Uses significant figures (sig) if provided, else fixed decimals (dec).
    """
    if sig is not None:
        def _format(v):
            v = float(v) * sc
            if v == 0:
                return '0'
            # significant figures formatting
            import math
            d = sig - int(math.floor(math.log10(abs(v)))) - 1
            d = max(0, min(d, 8))
            s = f'{v:.{d}f}'
            # strip trailing zeros after decimal
            if '.' in s:
                s = s.rstrip('0').rstrip('.')
            return s if s else '0'
        arr2 = [_format(v) for v in arr]
    else:
        arr2 = []
        for v in arr:
            x = round(float(v) * sc, dec)
            s = f'{x:.{dec}f}'
            if '.' in s:
                s = s.rstrip('0').rstrip('.')
            arr2.append(s if s else '0')
    rows = [arr2[i:i + 12] for i in range(0, len(arr2), 12)]
    body = ',\n  '.join(','.join(str(x) for x in r) for r in rows)
    return f'const _{name} = [\n  {body}\n];'


out_lines = []
out_lines.append("// ============================================================")
out_lines.append("// PSSMC SIMULATION DATA — generated by pssmc_simulation.py")
out_lines.append("// Kasprowiak Two-DOF, c1=c2=0 (no damping)")
out_lines.append("// N=2000 points, t in [0, 0.01s], Radau solver")
out_lines.append("// ============================================================\n")

# Time uses 7 decimals (range 0..0.01, need precision)
out_lines.append(fmt('T',       t_out, dec=7))
# Displacement in μm (range ±100), 2 decimals enough
out_lines.append(fmt('Y1_NC',   y1_nc_out,  1e6, dec=2))
out_lines.append(fmt('Y1_SMC',  y1_smc_out, 1e6, dec=2))
out_lines.append(fmt('Y1_PS',   y1_ps_out,  1e6, dec=2))
# Cutting force in N (range ±200), 1 decimal
out_lines.append(fmt('FC_NC',   Fc_nc_out, dec=1))
out_lines.append(fmt('FC_SMC',  Fc_smc_out, dec=1))
out_lines.append(fmt('FC_PS',   Fc_ps_out, dec=1))
# Sliding surface — 4 sig figs
out_lines.append(fmt('S_SMC',   s_smc_out, sig=4))
out_lines.append(fmt('S_PS',    s_ps_out,  sig=4))
# Adaptive parameters
out_lines.append(fmt('LAM',     lam_out, sig=5))
out_lines.append(fmt('TP',      Tp_out,  sig=4))
out_lines.append(fmt('PHI',     phi_out, sig=4))
# Errors
out_lines.append(fmt('E_NC',   -y1_nc_out,  1e6, dec=2))
out_lines.append(fmt('ED_NC',  -yd_nc_out,  1e3, dec=2))
out_lines.append(fmt('E_SMC',  -y1_smc_out, 1e6, dec=2))
out_lines.append(fmt('ED_SMC', -yd_smc_out, 1e3, dec=2))
out_lines.append(fmt('E_PS',   -y1_ps_out,  1e6, dec=2))
out_lines.append(fmt('ED_PS',  -yd_ps_out,  1e3, dec=2))
# Control signals (large values, need sig figs)
out_lines.append(fmt('U_SMC',   U_smc_out,   sig=5))
out_lines.append(fmt('UEQ_SMC', Ueq_smc_out, sig=5))
out_lines.append(fmt('USW_SMC', Usw_smc_out, sig=4))
out_lines.append(fmt('U_PS',    U_ps_out,    sig=5))
out_lines.append(fmt('UEQ_PS',  Ueq_ps_out,  sig=5))
out_lines.append(fmt('USW_PS',  Usw_ps_out,  sig=4))

out_lines.append("\n// ── SCALAR METRICS ──────────────────────────────")
out_lines.append(f"const _PCT_CHATTER = {pct_chatter:.2f};")
out_lines.append(f"const _PCT_ENERGY  = {pct_energy:.2f};")
out_lines.append(f"const _RMS_NC      = {rms_nc:.2f};")
out_lines.append(f"const _RMS_SMC     = {rms_smc:.2f};")
out_lines.append(f"const _RMS_PS      = {rms_ps:.2f};")
out_lines.append(f"const _MAX_NC      = {float(np.max(abs_y1_nc)):.2f};")
out_lines.append(f"const _MAX_SMC     = {float(np.max(abs_y1_smc)):.2f};")
out_lines.append(f"const _MAX_PS      = {float(np.max(abs_y1_ps)):.2f};")

os.makedirs('assets/js', exist_ok=True)
with open('assets/js/pssmc_data.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out_lines))

print(f"\n✓ Data written to pssmc_data.js")
print(f"  Total lines : {sum(1 for _ in open('assets/js/pssmc_data.js', encoding='utf-8'))}")
print(f"  File size   : {len(open('assets/js/pssmc_data.js', encoding='utf-8').read()) / 1024:.1f} KB")