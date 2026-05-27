/* ============================================================
   PSSMC RESEARCH ARCHIVE — main.js
   Handles: theme toggle, overlays, count-up, Plotly charts
   ============================================================ */

(function () {

  /* ── THEME TOGGLE ──────────────────────────────────────── */
  const root = document.documentElement;
  const btn  = document.querySelector('[data-theme-toggle]');

  let theme = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark' : 'light';

  root.setAttribute('data-theme', theme);

  const moonSVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`;

  const sunSVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="5"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42
             M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>`;

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    if (btn) btn.innerHTML = t === 'dark' ? sunSVG : moonSVG;
  }

  applyTheme(theme);

  if (btn) {
    btn.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      applyTheme(theme);
    });
  }


  /* ── OVERLAYS ──────────────────────────────────────────── */

  function openOverlay(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.hidden = false;
    document.body.style.overflow = ' ';
    // Focus first focusable element inside
    const focusable = panel.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) focusable.focus();
  }

  function closeAll() {
    document.querySelectorAll('.overlay').forEach(el => {
      el.hidden = true;
    });
    document.body.style.overflow = ' ';
  }

  // Open triggers — any element with data-overlay="ol-id"
  document.querySelectorAll('[data-overlay]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      openOverlay(trigger.getAttribute('data-overlay'));
    });
  });

  // Close triggers — backdrop and close button
  document.querySelectorAll('[data-close-overlay]').forEach(el => {
    el.addEventListener('click', closeAll);
  });

  // Close on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
  });


  /* ── COUNT-UP ANIMATION ────────────────────────────────── */
  // Usage: <span data-count="15">0</span>
  //        <span data-count="0.881">0</span>
  const countEls = document.querySelectorAll('[data-count]');

  if (countEls.length) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const el      = entry.target;
        const target  = parseFloat(el.dataset.count);
        const isFloat = el.dataset.count.includes('.');
        const dec     = isFloat ? el.dataset.count.split('.')[1].length : 0;
        const duration = 900; // ms
        let startTime  = null;

        function tick(timestamp) {
          if (!startTime) startTime = timestamp;
          const elapsed  = timestamp - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // Ease-out cubic
          const eased    = 1 - Math.pow(1 - progress, 3);
          el.textContent = (target * eased).toFixed(dec);
          if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    countEls.forEach(el => observer.observe(el));
  }


  /* ── PLOTLY SHARED CONFIG ──────────────────────────────── */
  const cs   = getComputedStyle(root);
  const ACC  = cs.getPropertyValue('--color-primary').trim()      || '#7a5c3a';
  const ACC2 = cs.getPropertyValue('--color-primary-dark').trim() || '#52371c';
  const MUT  = cs.getPropertyValue('--color-text-muted').trim()   || '#68594e';
  const GRID = 'rgba(120, 96, 70, 0.09)';

  const BASE_LAYOUT = {
    paper_bgcolor: 'transparent',
    plot_bgcolor:  'transparent',
    font: {
      family: "'Inter', 'Helvetica Neue', sans-serif",
      color:  MUT,
      size:   12
    },
    margin: { t: 20, r: 20, b: 60, l: 64 },
    xaxis: {
      gridcolor:     GRID,
      linecolor:     GRID,
      zerolinecolor: GRID
    },
    yaxis: {
      gridcolor:     GRID,
      linecolor:     GRID,
      zerolinecolor: GRID
    },
    legend: { bgcolor: 'transparent' },
    hoverlabel: {
      bgcolor:    '#fffdf9',
      bordercolor: '#d6c0a4',
      font: { family: 'Inter', size: 13 }
    }
  };

  const PLOTLY_CONFIG = {
    responsive:  true,
    displaylogo: false,
    modeBarButtonsToRemove: ['toImage', 'sendDataToCloud']
  };

  function plot(id, traces, extraLayout) {
    const el = document.getElementById(id);
    if (!el || !window.Plotly) return;
    Plotly.newPlot(
      el,
      traces,
      Object.assign({}, BASE_LAYOUT, extraLayout),
      PLOTLY_CONFIG
    );
  }


  /* ── STEP 1 CHART ──────────────────────────────────────── */
  // Cutting force per run — scatter + line
  // Marker size  = vibration amplitude (scaled)
  // Marker colour = Fc value (colour scale)
  window.buildStep1Chart = function () {
    const runs = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];

    const fc = [300, 70, 170, 575, 150, 155, 100,
                160, 340,  80, 145, 200, 320, 325, 600];

    const freq = [14.40, 3.84, 8.32, 16.96, 7.68, 8.00, 2.24,
                   6.40, 18.24, 3.52, 7.04,  9.92, 13.44, 13.76, 21.12];

    const vib  = [0.0045, 0.0012, 0.0026, 0.0053, 0.0024, 0.0025, 0.0007,
                  0.0020, 0.0057, 0.0011, 0.0022, 0.0031, 0.0042, 0.0043, 0.0066];

    const maxVib  = Math.max(...vib);
    const markerSizes = vib.map(v => 9 + (v / maxVib) * 22);

    plot('chart-step1', [
      {
        x: runs,
        y: fc,
        mode: 'markers+lines',
        type: 'scatter',
        name: 'Cutting force F<sub>c</sub>',
        marker: {
          color:      fc,
          colorscale: [[0, '#d6c0a4'], [0.5, '#9a7350'], [1, '#52371c']],
          size:       markerSizes,
          line:       { color: '#fff', width: 1.5 },
          showscale:  true,
          colorbar: {
            title:     'F<sub>c</sub> (N)',
            thickness: 12,
            len:       0.65,
            tickfont:  { size: 11 },
            titlefont: { size: 12 }
          }
        },
        line: {
          color: 'rgba(122, 92, 58, 0.3)',
          shape: 'spline',
          width: 1.5
        },
        customdata: runs.map((_, i) => [freq[i], vib[i]]),
        hovertemplate:
          '<b>Run %{x}</b><br>' +
          'F<sub>c</sub> = %{y} N<br>' +
          'Freq = %{customdata[0]} Hz<br>' +
          'Vib = %{customdata[1]} m/s' +
          '<extra></extra>'
      }
    ], {
      xaxis: { title: 'Run index', dtick: 1 },
      yaxis: { title: 'Cutting force F<sub>c</sub> (N)' }
    });
  };


  /* ── STEP 2 CHART ──────────────────────────────────────── */
  // Measured vs predicted Fc — 1:1 scatter
  // Model: Fc = 4838.94 * Vc^(-0.3024) * d^(0.5436) * f^(0.8046)
  window.buildStep2Chart = function () {
    const measured = [300, 70, 170, 575, 150, 155, 100,
                      160, 340,  80, 145, 200, 320, 325, 600];

    // [Vc, f, d] for each of the 15 runs
    const params = [
      [125, 0.250, 0.4], [125, 0.125, 0.1], [90,  0.125, 0.4],
      [90,  0.500, 0.4], [180, 0.125, 0.4], [125, 0.250, 0.4],
      [90,  0.250, 0.1], [125, 0.250, 0.4], [180, 0.250, 0.8],
      [180, 0.250, 0.1], [125, 0.125, 0.8], [125, 0.500, 0.1],
      [90,  0.250, 0.8], [180, 0.500, 0.4], [125, 0.500, 0.8]
    ];

    const predicted = params.map(([vc, f, d]) =>
      Math.round(
        4838.94
        * Math.pow(vc, -0.3024)
        * Math.pow(d,   0.5436)
        * Math.pow(f,   0.8046)
      )
    );

    const axRange = [50, 650];

    plot('chart-step2', [
      {
        x: measured,
        y: predicted,
        mode: 'markers',
        type: 'scatter',
        name: 'Runs',
        marker: {
          color:   ACC,
          size:    13,
          opacity: 0.85,
          line: { color: ACC2, width: 1.5 }
        },
        hovertemplate:
          '<b>Measured:</b>  %{x} N<br>' +
          '<b>Predicted:</b> %{y} N' +
          '<extra></extra>'
      },
      {
        x: axRange,
        y: axRange,
        mode: 'lines',
        type: 'scatter',
        name: 'Perfect fit (1:1)',
        line: { dash: 'dot', color: MUT, width: 1.5 },
        hoverinfo: 'none'
      }
    ], {
      xaxis: { title: 'Measured F<sub>c</sub> (N)',   range: axRange },
      yaxis: { title: 'Predicted F<sub>c</sub> (N)',  range: axRange },
      annotations: [{
        x:          520,
        y:          580,
        text:       'R² = 0.881',
        showarrow:  false,
        font:       { size: 13, color: ACC2 },
        bgcolor:    'rgba(255, 253, 249, 0.85)',
        bordercolor: ACC2,
        borderwidth: 1,
        borderpad:   6
      }]
    });
  };


  /* ── STEP 3 CHART ──────────────────────────────────────── */
  // Normalised unit-step responses
  // Cutting process:  y(t) = 1 - exp(-t / 0.0227)
  // CNC servo:        y(t) = 1 - exp(-t / 0.17)
  window.buildStep3Chart = function () {
    const N    = 200;
    const tEnd = 1.0;  // seconds

    const t = Array.from({ length: N }, (_, i) =>
      parseFloat((i * tEnd / (N - 1)).toFixed(4))
    );

    const TAU_C = 0.0227;  // cutting process time constant
    const TAU_S = 0.17;    // CNC servo time constant

    const yc = t.map(tv => parseFloat((1 - Math.exp(-tv / TAU_C)).toFixed(6)));
    const ys = t.map(tv => parseFloat((1 - Math.exp(-tv / TAU_S)).toFixed(6)));

    plot('chart-step3', [
      {
        x: t, y: yc,
        mode: 'lines',
        type: 'scatter',
        name: 'Cutting process (τ<sub>c</sub> = 0.0227 s)',
        line: { color: ACC2, width: 3 },
        hovertemplate: 't = %{x:.3f} s → %{y:.3f}<extra></extra>'
      },
      {
        x: t, y: ys,
        mode: 'lines',
        type: 'scatter',
        name: 'CNC servo (τ<sub>s</sub> = 0.17 s)',
        line: { color: '#c49a6a', width: 3, dash: 'dash' },
        hovertemplate: 't = %{x:.3f} s → %{y:.3f}<extra></extra>'
      },
      {
        x: [0, tEnd],
        y: [0.632, 0.632],
        mode: 'lines',
        type: 'scatter',
        name: '63.2 % threshold',
        line: { color: MUT, width: 1, dash: 'dot' },
        hoverinfo: 'none'
      }
    ], {
      xaxis: { title: 'Time (s)',              range: [0, tEnd] },
      yaxis: { title: 'Normalised response',   range: [0, 1.06] }
    });
  };



  /* ── Trial Code   */

// ── THEME TOGGLE ────────────────────────────────────────
  (function(){
    const t = document.querySelector('[data-theme-toggle]');
    const r = document.documentElement;
    let d = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
    r.setAttribute('data-theme', d);
    if(t) t.addEventListener('click', () => {
      d = d === 'dark' ? 'light' : 'dark';
      r.setAttribute('data-theme', d);
    });
  })();

  // ── GLOSSARY ─────────────────────────────────────────────
  (function(){
    const btn = document.getElementById('glossaryBtn');
    const heroBtn = document.getElementById('heroGlossBtn');
    const drawer = document.getElementById('glossaryDrawer');
    const backdrop = document.getElementById('glossaryBackdrop');
    const close = document.getElementById('glossaryClose');
    function open(){ drawer.classList.add('open'); backdrop.classList.add('open'); }
    function closeG(){ drawer.classList.remove('open'); backdrop.classList.remove('open'); }
    btn.addEventListener('click', open);
    if(heroBtn) heroBtn.addEventListener('click', open);
    close.addEventListener('click', closeG);
    backdrop.addEventListener('click', closeG);
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeG(); });
  })();

  // ── RUN DATA ─────────────────────────────────────────────
  const RUNS = [
    {run:1,  vc:125, f:0.25,  d:0.4, Fc:300, tc:0.01105},
    {run:2,  vc:125, f:0.125, d:0.1, Fc:70,  tc:0.04145},
    {run:3,  vc:90,  f:0.125, d:0.4, Fc:170, tc:0.01913},
    {run:4,  vc:90,  f:0.5,   d:0.4, Fc:575, tc:0.00938},
    {run:5,  vc:180, f:0.125, d:0.4, Fc:150, tc:0.02072},
    {run:6,  vc:125, f:0.25,  d:0.4, Fc:155, tc:0.01989},
    {run:7,  vc:90,  f:0.25,  d:0.1, Fc:100, tc:0.07105},
    {run:8,  vc:125, f:0.25,  d:0.4, Fc:160, tc:0.02487},
    {run:9,  vc:180, f:0.25,  d:0.8, Fc:340, tc:0.00873},
    {run:10, vc:180, f:0.25,  d:0.1, Fc:80,  tc:0.04521},
    {run:11, vc:125, f:0.125, d:0.8, Fc:145, tc:0.02261},
    {run:12, vc:125, f:0.5,   d:0.1, Fc:200, tc:0.01604},
    {run:13, vc:90,  f:0.25,  d:0.8, Fc:320, tc:0.01184},
    {run:14, vc:180, f:0.5,   d:0.4, Fc:325, tc:0.01157},
    {run:15, vc:125, f:0.5,   d:0.8, Fc:600, tc:0.00754},
  ];

  // Power-law exponents from Step 2
  const C0 = 4838.94, a = -0.3024, b_exp = 0.5436, c_exp = 0.8046;
  const tau_s = 0.17; // literature

  function calcFc(vc, d, f){
    return C0 * Math.pow(vc, a) * Math.pow(d, b_exp) * Math.pow(f, c_exp);
  }
  function calcK(Fc, d){ return b_exp * Fc / d; }

  // Populate table
  (function(){
    const tbody = document.getElementById('run-table-body');
    RUNS.forEach(r => {
      const Fc = calcFc(r.vc, r.d, r.f);
      const k  = calcK(Fc, r.d);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.run}</td>
        <td>${r.vc}</td>
        <td>${r.f}</td>
        <td>${r.d}</td>
        <td>${(r.Fc).toFixed(0)} N</td>
        <td>${r.tc.toFixed(5)}</td>
        <td>${k.toFixed(1)} N/mm</td>
        <td>—</td>
      `;
      tbody.appendChild(tr);
    });
  })();

  // ── STATE-SPACE STEP RESPONSE ─────────────────────────────
  function computeStepResponse(Kc, tc, ts, stepSize, tEnd, dt){
    // RK4 integration of 2nd order state-space
    // x1 = Fc, x2 = dFc/dt
    // dx1 = x2
    // dx2 = -1/(tc*ts)*x1 - (tc+ts)/(tc*ts)*x2 + Kc/(tc*ts)*u
    const a11 = 0, a12 = 1;
    const a21 = -1/(tc*ts), a22 = -(tc+ts)/(tc*ts);
    const b2  = Kc/(tc*ts);
    const u   = stepSize;

    let x1 = 0, x2 = 0;
    const t = [], y = [];

    for(let ti = 0; ti <= tEnd; ti += dt){
      t.push(+ti.toFixed(4));
      y.push(x1);
      // RK4
      const f1 = (xx1, xx2) => a12*xx2;
      const f2 = (xx1, xx2) => a21*xx1 + a22*xx2 + b2*u;
      const k1x = f1(x1,x2), k1y = f2(x1,x2);
      const k2x = f1(x1+dt/2*k1x, x2+dt/2*k1y);
      const k2y = f2(x1+dt/2*k1x, x2+dt/2*k1y);
      const k3x = f1(x1+dt/2*k2x, x2+dt/2*k2y);
      const k3y = f2(x1+dt/2*k2x, x2+dt/2*k2y);
      const k4x = f1(x1+dt*k3x, x2+dt*k3y);
      const k4y = f2(x1+dt*k3x, x2+dt*k3y);
      x1 += dt/6*(k1x+2*k2x+2*k3x+k4x);
      x2 += dt/6*(k1y+2*k2y+2*k3y+k4y);
    }
    return {t, y};
  }

  // ── PLOT ─────────────────────────────────────────────────
  let plotInitialised = false;

  function updateAll(){
    const vc = +document.getElementById('sl-vc').value;
    const d  = +document.getElementById('sl-d').value;
    const f  = +document.getElementById('sl-f').value;
    const tc = +document.getElementById('sl-tc').value;

    document.getElementById('val-vc').innerHTML = `${vc} <small style="font-size:0.6em;font-weight:400;">m/min</small>`;
    document.getElementById('val-d').innerHTML  = `${d} <small style="font-size:0.6em;font-weight:400;">mm</small>`;
    document.getElementById('val-f').innerHTML  = `${f} <small style="font-size:0.6em;font-weight:400;">mm/rev</small>`;
    document.getElementById('val-tc').innerHTML = `${tc.toFixed(4)} <small style="font-size:0.6em;font-weight:400;">s</small>`;

    const Fc = calcFc(vc, d, f);
    const k  = calcK(Fc, d);
    const Kc = k; // cutting gain = stiffness
    const pc = -1/tc;
    const ps = -1/tau_s;

    document.getElementById('dv-Fc').textContent = Fc.toFixed(1) + ' N';
    document.getElementById('dv-k').textContent  = k.toFixed(2)  + ' N/mm';
    document.getElementById('dv-Kc').textContent = Kc.toFixed(2) + ' N/mm';
    document.getElementById('dv-pc').textContent = pc.toFixed(1) + ' rad/s';
    document.getElementById('dv-ps').textContent = ps.toFixed(2) + ' rad/s';

    // Update equation displays
    const tcts = (tc*tau_s).toExponential(3);
    const tcplusts = (tc+tau_s).toFixed(4);

    if(window.MathJax){
      document.getElementById('eq-Gc').innerHTML =
        `\\[ G_c(s) = \\frac{${Kc.toFixed(1)}}{${tc.toFixed(4)}\\,s + 1} \\]`;
      document.getElementById('eq-pc').innerHTML =
        `\\[ p_c = -\\frac{1}{${tc.toFixed(4)}} = ${pc.toFixed(1)}\\;\\text{rad/s} \\]`;
      document.getElementById('eq-Gp').innerHTML =
        `\\[ G_p(s) = \\frac{${Kc.toFixed(1)}}{(${tc.toFixed(4)}s+1)(0.17s+1)} \\]`;
      document.getElementById('eq-Gp2').innerHTML =
        `\\[ G_p(s) = \\frac{${Kc.toFixed(1)}}{${tcts}\\,s^2 + ${tcplusts}\\,s + 1} \\]`;

      const A21 = (-1/(tc*tau_s)).toFixed(1);
      const A22 = (-(tc+tau_s)/(tc*tau_s)).toFixed(2);
      const B2  = (Kc/(tc*tau_s)).toFixed(0);
      document.getElementById('eq-matrices-num').innerHTML =
        `\\[ A = \\begin{bmatrix} 0 & 1 \\\\ ${A21} & ${A22} \\end{bmatrix} \\quad B = \\begin{bmatrix} 0 \\\\ ${B2} \\end{bmatrix} \\]`;

      MathJax.typesetPromise([
        document.getElementById('eq-Gc'),
        document.getElementById('eq-pc'),
        document.getElementById('eq-Gp'),
        document.getElementById('eq-Gp2'),
        document.getElementById('eq-matrices-num'),
      ]);
    }

    // Step response
    if(window.Plotly){
      const stepSize = 0.1; // mm step
      const tEnd = Math.max(1.5, tc*30, tau_s*12);
      const dt = tEnd / 2000;
      const {t, y} = computeStepResponse(Kc, tc, tau_s, stepSize, tEnd, dt);
      const Fc_ss = Kc * stepSize;

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDark ? '#c0a888' : '#68594e';
      const gridColor = isDark ? 'rgba(245,230,210,0.08)' : 'rgba(58,43,26,0.08)';
      const lineColor = isDark ? '#c49a6a' : '#7a5c3a';

      const layout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { family: 'Inter, sans-serif', color: textColor, size: 12 },
        xaxis: {
          title: 'Time (s)',
          gridcolor: gridColor, zerolinecolor: gridColor,
          tickfont: { color: textColor }
        },
        yaxis: {
          title: 'F_c response (N)',
          gridcolor: gridColor, zerolinecolor: gridColor,
          tickfont: { color: textColor }
        },
        margin: { t: 20, r: 20, b: 50, l: 70 },
        shapes: [{
          type: 'line', x0: 0, x1: tEnd, y0: Fc_ss, y1: Fc_ss,
          line: { color: lineColor, width: 1.5, dash: 'dot' }
        }],
        annotations: [{
          x: tEnd * 0.7, y: Fc_ss * 1.05,
          text: `Steady-state = ${Fc_ss.toFixed(1)} N`,
          showarrow: false,
          font: { color: lineColor, size: 11 }
        }],
        showlegend: false,
      };

      const trace = {
        x: t, y: y,
        mode: 'lines',
        line: { color: lineColor, width: 2.5 },
        name: 'Fc(t)',
      };

      if(!plotInitialised){
        Plotly.newPlot('step-plot', [trace], layout, {
          responsive: true, displayModeBar: false
        });
        plotInitialised = true;
      } else {
        Plotly.react('step-plot', [trace], layout);
      }

      document.getElementById('plot-caption').innerHTML =
        `Step input Δd = 0.1 mm at t = 0. V<sub>c</sub> = ${vc} m/min, d = ${d} mm, f = ${f} mm/rev, τ<sub>c</sub> = ${tc.toFixed(4)} s, τ<sub>s</sub> = 0.17 s (literature). Steady-state ΔF<sub>c</sub> = ${Fc_ss.toFixed(1)} N.`;
    }
  }

  // Wire sliders
  ['sl-vc','sl-d','sl-f','sl-tc'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateAll);
  });

  // Init after Plotly + MathJax load
  window.addEventListener('load', () => {
    // Poll until Plotly ready
    const timer = setInterval(() => {
      if(window.Plotly){
        clearInterval(timer);
        updateAll();
      }
    }, 200);
  });





})(); // end IIFE