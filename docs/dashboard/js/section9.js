/* ============================================================
   section9.js — Escada de Valor da Sustentabilidade
   Calculadora de prémios monetários entre classes energéticas.
============================================================ */

let ESCADA_DADOS = null;
let graficoEscada = null;

async function iniciarSeccaoEscada() {
  ESCADA_DADOS = await carregarDados("premio_energetico");
  if (!ESCADA_DADOS) return;

  const selTipo = document.getElementById("ev-tipo");
  const selTipologia = document.getElementById("ev-tipologia");
  const selOrigem = document.getElementById("ev-origem");
  const selDestino = document.getElementById("ev-destino");
  const inputArea = document.getElementById("ev-area");

  const classes = ORDEM_CLASSES.filter((c) => c !== "NT");
  [selOrigem, selDestino].forEach((sel) => {
    if (!sel) return;
    classes.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  });
  if (selOrigem) selOrigem.value = "G";
  if (selDestino) selDestino.value = "A";

  [selTipo, selTipologia, selOrigem, selDestino, inputArea].forEach((el) => {
    if (el) el.addEventListener("input", atualizarEscada);
  });

  atualizarEscada();
}

function atualizarEscada() {
  const tipo = document.getElementById("ev-tipo")?.value || "Apartamento";
  const tipologia = document.getElementById("ev-tipologia")?.value || "T2";
  const origem = document.getElementById("ev-origem")?.value || "G";
  const destino = document.getElementById("ev-destino")?.value || "A";
  const area = parseFloat(document.getElementById("ev-area")?.value) || 0;

  const classes = ORDEM_CLASSES.filter((c) => c !== "NT");
  const linhaOrigem = ESCADA_DADOS.find((d) => d.classe_energetica === origem && d.tipo === tipo && d.tipologia === tipologia);
  const linhaDestino = ESCADA_DADOS.find((d) => d.classe_energetica === destino && d.tipo === tipo && d.tipologia === tipologia);

  const temDados = linhaOrigem && linhaDestino && linhaOrigem.n_amostra > 3 && linhaDestino.n_amostra > 3;
  const premioM2 = temDados ? (linhaDestino.mediana_classe - linhaOrigem.mediana_classe) : null;

  const elPremioM2 = document.getElementById("ev-resultado-m2");
  const elPremioTotal = document.getElementById("ev-resultado-total");
  const elAviso = document.getElementById("ev-aviso");

  if (premioM2 === null) {
    if (elPremioM2) elPremioM2.textContent = "—";
    if (elPremioTotal) elPremioTotal.textContent = "—";
    if (elAviso) elAviso.textContent = "Amostra insuficiente para este segmento (precisa de 4+ imóveis em cada classe).";
  } else {
    if (elPremioM2) elPremioM2.textContent = (premioM2 >= 0 ? "+" : "") + formatoPT(premioM2) + " €/m²";
    if (elPremioTotal) elPremioTotal.textContent = area > 0 ? (premioM2 >= 0 ? "+" : "") + formatoPT(premioM2 * area) + " €" : "—";
    if (elAviso) elAviso.textContent = area > 0 ? "" : "Indica a área (m²) para veres o valor total estimado.";
  }

  // grafico: mediana_classe por classe, destacando o intervalo origem->destino
  const valores = classes.map((c) => {
    const linha = ESCADA_DADOS.find((d) => d.classe_energetica === c && d.tipo === tipo && d.tipologia === tipologia);
    return linha && linha.n_amostra > 3 ? linha.mediana_classe : null;
  });
  const iOrigem = classes.indexOf(origem), iDestino = classes.indexOf(destino);
  const cores = classes.map((c, i) => {
    const dentroIntervalo = i >= Math.min(iOrigem, iDestino) && i <= Math.max(iOrigem, iDestino);
    return dentroIntervalo ? "#2FBE6E" : "#181F1A";
  });

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "bar", height: 320 },
    series: [{ name: "Mediana €/m²", data: valores }],
    colors: cores,
    plotOptions: { bar: { columnWidth: "55%", borderRadius: 5, distributed: true } },
    xaxis: { categories: classes },
    yaxis: { labels: { formatter: (v) => `${formatoPT(v)} €` } },
    legend: { show: false },
  };

  const el = document.querySelector("#grafico-escada");
  if (graficoEscada) graficoEscada.destroy();
  graficoEscada = new ApexCharts(el, opcoes);
  graficoEscada.render();
}

document.addEventListener("DOMContentLoaded", iniciarSeccaoEscada);
