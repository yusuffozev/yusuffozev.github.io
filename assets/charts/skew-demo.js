(() => {
  const slider = document.getElementById("skewSlider");
  const canvas = document.getElementById("skewChart");
  if (!slider || !canvas || typeof Chart === "undefined") return;

  const label = document.getElementById("skewLabel");
  const nameEl = document.getElementById("skewName");
  const noteEl = document.getElementById("skewNote");
  const statMode = document.getElementById("statMode");
  const statMedian = document.getElementById("statMedian");
  const statMean = document.getElementById("statMean");

  function normalPdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  // Abramowitz-Stegun tarzı hızlı CDF yaklaşımı
  function normalCdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
    const p =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x >= 0 ? 1 - p : p;
  }

  function skewNormalPdf(x, alpha) {
    return 2 * normalPdf(x) * normalCdf(alpha * x);
  }

  function buildSeries(alpha) {
    const xs = [];
    const ys = [];
    const step = 0.05;
    for (let x = -4.5; x <= 4.5 + 1e-9; x += step) {
      xs.push(Number(x.toFixed(2)));
      ys.push(skewNormalPdf(x, alpha));
    }

    // normalize lightly for numerical noise
    const area = ys.reduce((a, b) => a + b, 0) * step;
    const dens = ys.map((y) => y / area);

    let modeIdx = 0;
    for (let i = 1; i < dens.length; i++) {
      if (dens[i] > dens[modeIdx]) modeIdx = i;
    }
    const mode = xs[modeIdx];

    // mean ≈ ∫ x f(x) dx
    let mean = 0;
    for (let i = 0; i < xs.length; i++) mean += xs[i] * dens[i] * step;

    // median: CDF = 0.5
    let cdf = 0;
    let median = xs[xs.length - 1];
    for (let i = 0; i < xs.length; i++) {
      cdf += dens[i] * step;
      if (cdf >= 0.5) {
        median = xs[i];
        break;
      }
    }

    return { xs, dens, mode, median, mean };
  }

  function nearestIndex(xs, value) {
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const d = Math.abs(xs[i] - value);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    }
    return best;
  }

  function markerDataset(xs, dens, value, color, labelText) {
    const idx = nearestIndex(xs, value);
    const data = xs.map((_, i) => (i === idx ? dens[i] : null));
    return {
      type: "scatter",
      label: labelText,
      data,
      showLine: false,
      pointRadius: 6,
      pointHoverRadius: 7,
      backgroundColor: color,
      borderColor: color,
      order: 1
    };
  }

  let chart;

  function render() {
    const alpha = Number(slider.value);
    const { xs, dens, mode, median, mean } = buildSeries(alpha);

    label.textContent = alpha.toFixed(1);
    if (Math.abs(alpha) < 0.15) {
      nameEl.textContent = "(simetrik)";
      noteEl.textContent = "Simetrik dağılım: üç ölçü de yaklaşık aynı noktada.";
    } else if (alpha > 0) {
      nameEl.textContent = "(sağa çarpık)";
      noteEl.textContent = "Sağa çarpık: mod < medyan < ortalama. Uzun sağ kuyruk ortalamayı sağa çeker.";
    } else {
      nameEl.textContent = "(sola çarpık)";
      noteEl.textContent = "Sola çarpık: ortalama < medyan < mod. Uzun sol kuyruk ortalamayı sola çeker.";
    }

    statMode.textContent = mode.toFixed(2);
    statMedian.textContent = median.toFixed(2);
    statMean.textContent = mean.toFixed(2);

    const datasets = [
      {
        type: "line",
        label: "Yoğunluk",
        data: dens,
        borderColor: "#3a7d74",
        backgroundColor: "rgba(58,125,116,0.12)",
        fill: true,
        pointRadius: 0,
        borderWidth: 2.5,
        tension: 0.15,
        order: 2
      },
      markerDataset(xs, dens, mode, "#e8614a", "Mod"),
      markerDataset(xs, dens, median, "#d4a853", "Medyan"),
      markerDataset(xs, dens, mean, "#3b6ea5", "Ortalama")
    ];

    if (!chart) {
      chart = new Chart(canvas.getContext("2d"), {
        data: { labels: xs, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 180 },
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 12, usePointStyle: true, pointStyle: "circle" }
            },
            tooltip: {
              callbacks: {
                title(items) {
                  return `x = ${items[0].label}`;
                }
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: "Değer" },
              ticks: { maxTicksLimit: 9 }
            },
            y: {
              title: { display: true, text: "Yoğunluk" },
              beginAtZero: true
            }
          }
        }
      });
    } else {
      chart.data.labels = xs;
      chart.data.datasets = datasets;
      chart.update();
    }
  }

  slider.addEventListener("input", render);
  render();
})();
