/* ============================================================
   section2.js — Índice Verde (Índice de Sustentabilidade Local)
============================================================ */

async function iniciarSeccaoIndiceVerde() {
  const dados = await carregarDados("indice_verde");
  if (!dados) return;
  graficoRankingGeral(dados.geral);
  graficoDimensoes(dados.geral);
}

function graficoRankingGeral(geral) {
  const ordenado = [...geral].sort((a, b) => a.ranking_geral - b.ranking_geral);
  const el = document.querySelector("#grafico-iv-ranking");
  if (!el) return;

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "bar", height: 360 },
    series: [{ name: "Índice Verde", data: ordenado.map((d) => Number(d.indice_verde_100)) }],
    colors: ["#2FBE6E"],
    plotOptions: { bar: { horizontal: true, borderRadius: 5, barHeight: "55%" } },
    xaxis: { categories: ordenado.map((d) => d.freguesia), max: 100 },
    yaxis: { labels: { style: { fontSize: "12px" } } },
    grid: { ...temaApexBase().grid, yaxis: { lines: { show: false } } },
  };
  new ApexCharts(el, opcoes).render();
}

function graficoDimensoes(geral) {
  const ordenado = [...geral].sort((a, b) => a.ranking_geral - b.ranking_geral);
  const el = document.querySelector("#grafico-iv-dimensoes");
  if (!el) return;

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "bar", height: 340, stacked: false },
    series: [
      { name: "Ambiente Verde", data: ordenado.map((d) => Number(d.dim1_score ?? 0)) },
      { name: "Mobilidade Sustentável", data: ordenado.map((d) => Number(d.dim2_score ?? 0)) },
      { name: "Equipamentos Sociais", data: ordenado.map((d) => Number(d.dim3_score ?? 0)) },
    ],
    colors: ["#2FBE6E", "#F2A93B", "#8BD448"],
    plotOptions: { bar: { columnWidth: "60%", borderRadius: 4 } },
    xaxis: { categories: ordenado.map((d) => d.freguesia), labels: { style: { fontSize: "11px" } } },
  };
  new ApexCharts(el, opcoes).render();
}

document.addEventListener("DOMContentLoaded", iniciarSeccaoIndiceVerde);
