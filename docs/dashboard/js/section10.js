/* ============================================================
   section10.js — Heatmaps
============================================================ */

let HM_MEDIANAS = null;
let HM_PREMIO = null;
let graficoHmMedianas = null;
let graficoHmPremio = null;

async function iniciarSeccaoHeatmaps() {
  const [medianas, premio] = await Promise.all([
    carregarDados("medianas_segmento"),
    carregarDados("premio_energetico"),
  ]);
  HM_MEDIANAS = medianas;
  HM_PREMIO = premio;

  const selTipo = document.getElementById("hm-tipo");
  const selEstado = document.getElementById("hm-estado");
  if (selTipo) selTipo.addEventListener("change", desenharHeatmapMedianas);
  if (selEstado) selEstado.addEventListener("change", desenharHeatmapMedianas);

  const selTipoPremio = document.getElementById("hm-premio-tipo");
  if (selTipoPremio) selTipoPremio.addEventListener("change", desenharHeatmapPremio);

  desenharHeatmapMedianas();
  desenharHeatmapPremio();
}

function desenharHeatmapMedianas() {
  if (!HM_MEDIANAS) return;
  const tipo = document.getElementById("hm-tipo")?.value || "Apartamento";
  const estado = document.getElementById("hm-estado")?.value || "Usado";

  const freguesias = Array.from(new Set(HM_MEDIANAS.map((d) => d.freguesia)));
  const series = freguesias.map((freguesia) => ({
    name: freguesia,
    data: TIPOLOGIAS_ORDEM.map((tipologia) => {
      const linha = HM_MEDIANAS.find(
        (d) => d.freguesia === freguesia && d.tipo === tipo && d.tipologia === tipologia && d.estado === estado
      );
      const valor = linha && linha.n_amostra > 3 ? linha.mediana_m2 : null;
      return { x: tipologia, y: valor };
    }),
  }));

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "heatmap", height: 360 },
    series,
    colors: ["#2FBE6E"],
    plotOptions: {
      heatmap: {
        radius: 4,
        colorScale: { ranges: [{ from: -1, to: 0, color: "#181F1A", name: "sem dados" }] },
      },
    },
    dataLabels: { enabled: true, style: { colors: ["#06140C"], fontSize: "10.5px" }, formatter: (v) => (v ? formatoPT(v) : "") },
    xaxis: { position: "top" },
    grid: { padding: { top: -10 } },
  };

  const el = document.querySelector("#heatmap-medianas");
  if (graficoHmMedianas) graficoHmMedianas.destroy();
  graficoHmMedianas = new ApexCharts(el, opcoes);
  graficoHmMedianas.render();
}

function desenharHeatmapPremio() {
  if (!HM_PREMIO) return;
  const tipo = document.getElementById("hm-premio-tipo")?.value || "Apartamento";
  const classes = ORDEM_CLASSES.filter((c) => c !== "NT");

  const series = classes.map((classe) => ({
    name: classe,
    data: TIPOLOGIAS_ORDEM.map((tipologia) => {
      const linha = HM_PREMIO.find((d) => d.classe_energetica === classe && d.tipo === tipo && d.tipologia === tipologia);
      const valor = linha && linha.n_amostra > 3 ? linha.premio : null;
      return { x: tipologia, y: valor };
    }),
  }));

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "heatmap", height: 400 },
    series,
    colors: ["#F2A93B"],
    plotOptions: {
      heatmap: {
        radius: 4,
        colorScale: {
          ranges: [
            { from: -100000, to: -0.01, color: "#E5484D", name: "negativo" },
            { from: 0, to: 100000, color: "#2FBE6E", name: "positivo" },
          ],
        },
      },
    },
    dataLabels: { enabled: true, style: { colors: ["#06140C"], fontSize: "10.5px" }, formatter: (v) => (v !== null ? formatoPT(v) : "") },
    xaxis: { position: "top" },
  };

  const el = document.querySelector("#heatmap-premio");
  if (graficoHmPremio) graficoHmPremio.destroy();
  graficoHmPremio = new ApexCharts(el, opcoes);
  graficoHmPremio.render();
}

document.addEventListener("DOMContentLoaded", iniciarSeccaoHeatmaps);
