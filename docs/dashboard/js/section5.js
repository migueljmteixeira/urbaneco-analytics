/* ============================================================
   section5.js — Prémio Verde
============================================================ */

let PREMIO_DADOS = null;
let graficoPremioVerde = null;

async function iniciarSeccaoPremioVerde() {
  PREMIO_DADOS = await carregarDados("premio_energetico");
  if (!PREMIO_DADOS) return;

  const selTipo = document.getElementById("pv-filtro-tipo");
  const selTipologia = document.getElementById("pv-filtro-tipologia");
  if (selTipo) selTipo.addEventListener("change", atualizarGraficoPremioVerde);
  if (selTipologia) selTipologia.addEventListener("change", atualizarGraficoPremioVerde);

  atualizarGraficoPremioVerde();
}

function atualizarGraficoPremioVerde() {
  const tipo = document.getElementById("pv-filtro-tipo")?.value || "Apartamento";
  const tipologia = document.getElementById("pv-filtro-tipologia")?.value || "T2";

  const classes = ORDEM_CLASSES.filter((c) => c !== "NT");
  const linhas = classes.map((c) => PREMIO_DADOS.find((d) => d.classe_energetica === c && d.tipo === tipo && d.tipologia === tipologia));
  const valores = linhas.map((l) => (l && l.n_amostra > 3 ? l.premio : 0));
  const cores = classes.map((c) => CORES_CLASSES[c]);

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "bar", height: 360 },
    series: [{ name: "Prémio (€/m²)", data: valores }],
    colors: cores,
    plotOptions: { bar: { columnWidth: "55%", borderRadius: 5, distributed: true } },
    xaxis: { categories: classes },
    yaxis: { labels: { formatter: (v) => `${formatoPT(v)} €` } },
    legend: { show: false },
  };

  const el = document.querySelector("#grafico-premio-verde");
  if (graficoPremioVerde) graficoPremioVerde.destroy();
  graficoPremioVerde = new ApexCharts(el, opcoes);
  graficoPremioVerde.render();
}

document.addEventListener("DOMContentLoaded", iniciarSeccaoPremioVerde);
