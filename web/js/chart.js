/* EchoSphere timeline chart: one line per layer + moving playhead (decorative; data table in the drawer).
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const W = 1000, H = 110, PAD = { l: 12, r: 12, t: 12, b: 22 };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  }

  class Chart {
    constructor(host) { this.host = host; this.svg = null; this.head = null; this.dots = {}; }

    draw(song, eventsByLayer, muted) {
      this.song = song; this.events = eventsByLayer;
      const n = song.steps.length;
      const x = i => PAD.l + (W - PAD.l - PAD.r) * (n === 1 ? 0.5 : i / (n - 1));
      const y = v => PAD.t + (H - PAD.t - PAD.b) * (1 - v);
      this.x = x; this.y = y;
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", role: "presentation" });

      // month / year ticks
      let lastLabel = null;
      song.steps.forEach((d, i) => {
        const m = parseInt(d.slice(5, 7), 10) - 1;
        const label = song.stepUnit === "slice" ? (i === 0 ? "West" : i === n - 1 ? "East" : (i % 8 === 0 ? `slice ${i + 1}` : null)) // a picture: space, not time
          : song.stepUnit === "quarter" ? (m === 0 && +d.slice(0, 4) % 2 === 0 ? d.slice(0, 4) : null) // every second year
          : song.stepUnit === "month" ? (m === 0 ? d.slice(0, 4) : (m % 3 === 0 ? MONTHS[m] : null)) : MONTHS[m];
        if (label && label !== lastLabel) {
          svg.appendChild(el("line", { x1: x(i), x2: x(i), y1: PAD.t, y2: H - PAD.b, stroke: "rgba(255,255,255,.07)" }));
          const last = song.stepUnit === "slice" && i === n - 1;
          const t = el("text", { x: last ? x(i) - 3 : x(i) + 3, y: H - 6, fill: "#A9B0D0", "font-size": 12, "font-family": "Inter, sans-serif", "text-anchor": last ? "end" : "start" });
          t.textContent = label; svg.appendChild(t);
          lastLabel = label;
        }
      });

      // caption markers
      Object.keys(song.captions || {}).forEach(d => {
        const i = song.steps.indexOf(d);
        if (i >= 0) svg.appendChild(el("circle", { cx: x(i), cy: PAD.t - 5, r: 3, fill: "#FFB547" }));
      });

      // layer lines
      this.dots = {};
      song.layers.forEach(layer => {
        const ev = eventsByLayer[layer.id];
        let dPath = "", pen = false;
        ev.forEach((e, i) => {
          if (e.n === null) { pen = false; return; }
          dPath += (pen ? "L" : "M") + x(i).toFixed(1) + "," + y(e.n).toFixed(1);
          pen = true;
        });
        const off = muted && muted.has(layer.id);
        svg.appendChild(el("path", { d: dPath, fill: "none", stroke: layer.color, "stroke-width": 2.5,
          "stroke-linejoin": "round", "stroke-linecap": "round", opacity: off ? 0.2 : 0.95 }));
        // rests (silence) shown as small hollow marks on the baseline
        ev.forEach((e, i) => {
          if (e.midi === null && e.n !== null) svg.appendChild(el("circle", { cx: x(i), cy: H - PAD.b - 2, r: 2.5, fill: "none", stroke: layer.color, opacity: off ? 0.2 : 0.7 }));
        });
        const dot = el("circle", { r: 4.5, fill: layer.color, stroke: "#0B1020", "stroke-width": 2, opacity: 0 });
        svg.appendChild(dot); this.dots[layer.id] = dot;
      });

      this.head = el("line", { x1: x(0), x2: x(0), y1: PAD.t - 2, y2: H - PAD.b, stroke: "#FF5EA8", "stroke-width": 2, opacity: 0 });
      svg.appendChild(this.head);
      this.host.innerHTML = ""; this.host.appendChild(svg); this.svg = svg;
    }

    move(i) {
      if (!this.svg) return;
      const X = this.x(i);
      this.head.setAttribute("x1", X); this.head.setAttribute("x2", X); this.head.setAttribute("opacity", 1);
      this.song.layers.forEach(layer => {
        const e = this.events[layer.id][i], dot = this.dots[layer.id];
        if (!e || e.n === null) { dot.setAttribute("opacity", 0); return; }
        dot.setAttribute("cx", X); dot.setAttribute("cy", this.y(e.n)); dot.setAttribute("opacity", 1);
      });
    }
  }

  window.EchoChart = Chart;
})();
