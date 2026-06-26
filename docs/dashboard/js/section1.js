/* ============================================================
   section1.js — Dados do Mercado
============================================================ */

async function iniciarSeccao1() {
  const [resumo, porTipologia, distribuicao, premio] = await Promise.all([
    carregarDados("resumo"),
    carregarDados("imoveis_por_tipologia"),
    carregarDados("distribuicao_energetica"),
    carregarDados("premio_energetico"),
  ]);

  if (resumo) preencherEstatisticas(resumo);
  if (porTipologia) graficoPorTipologia(porTipologia);
  if (distribuicao) graficoPorClasseEnergetica(distribuicao);
  if (premio) graficoMedianaPorClasseTipologia(premio);
}

function preencherEstatisticas(resumo) {
  const mapa = {
    "stat-total-imoveis": resumo.total_imoveis,
    "stat-total-imoveis-2": resumo.total_imoveis,
    "stat-apartamentos": resumo.total_apartamentos,
    "stat-moradias": resumo.total_moradias,
    "stat-freguesias": resumo.n_freguesias,
  };
  for (const [id, valor] of Object.entries(mapa)) {
    const el = document.getElementById(id);
    if (el) animarNumero(el, valor ?? 0);
  }
  ["stat-evi-medio", "stat-evi-medio-2"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (resumo.evi_medio !== null) animarNumero(el, resumo.evi_medio, 1);
    else el.textContent = "—";
  });
}

/** Gráfico 1: nº de imóveis por tipologia, agrupado por tipo. */
function graficoPorTipologia(dados) {
  const categorias = TIPOLOGIAS_ORDEM.filter((t) => dados.some((d) => d.tipologia === t));
  const porTipo = (tipo) =>
    categorias.map((t) => {
      const linha = dados.find((d) => d.tipologia === t && d.tipo === tipo);
      return linha ? linha.total : 0;
    });

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "bar", height: 320 },
    series: [
      { name: "Apartamento", data: porTipo("Apartamento") },
      { name: "Moradia", data: porTipo("Moradia") },
    ],
    colors: ["#2FBE6E", "#F2A93B"],
    plotOptions: { bar: { columnWidth: "55%", borderRadius: 5 } },
    xaxis: { categories: categorias, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (v) => formatoPT(v) } },
  };
  new ApexCharts(document.querySelector("#grafico-tipologia"), opcoes).render();
}

/** Gráfico 2: stock total de imóveis por classe energética (somado em
 * todas as freguesias), colorido com a escala de classes energéticas. */
function graficoPorClasseEnergetica(dados) {
  const stockPorClasse = {};
  dados.forEach((d) => {
    stockPorClasse[d.classe_energetica] = (stockPorClasse[d.classe_energetica] || 0) + d.stock;
  });
  const categorias = ORDEM_CLASSES.filter((c) => stockPorClasse[c] !== undefined);
  const valores = categorias.map((c) => stockPorClasse[c] || 0);
  const cores = categorias.map((c) => CORES_CLASSES[c]);

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "bar", height: 320 },
    series: [{ name: "Imóveis", data: valores }],
    colors: cores,
    plotOptions: {
      bar: {
        columnWidth: "55%", borderRadius: 5, distributed: true,
      },
    },
    xaxis: { categories: categorias, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (v) => formatoPT(v) } },
    legend: { show: false },
  };
  new ApexCharts(document.querySelector("#grafico-classe-energetica"), opcoes).render();
}

/** Gráfico 3: mediana €/m² por classe energética, uma linha por
 * tipologia (dados de premio_energetico, tipo = Apartamento por
 * defeito - é o tipo com mais volume de dados). */
function graficoMedianaPorClasseTipologia(dados) {
  const tipoEscolhido = "Apartamento";
  const classes = ORDEM_CLASSES.filter((c) => c !== "NT" && dados.some((d) => d.classe_energetica === c));

  const series = TIPOLOGIAS_ORDEM.map((tipologia) => ({
    name: tipologia,
    data: classes.map((classe) => {
      const linha = dados.find(
        (d) => d.classe_energetica === classe && d.tipologia === tipologia && d.tipo === tipoEscolhido
      );
      // n_amostra<=3 já vem como mediana_classe=0 da base de dados -
      // mostramos null em vez de 0, para o gráfico não sugerir "preço zero".
      if (!linha || linha.n_amostra <= 3) return null;
      return linha.mediana_classe;
    }),
  }));

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "line", height: 340 },
    series,
    colors: ["#2FBE6E", "#8BD448", "#F2C94C", "#F2A93B", "#E5484D"],
    stroke: { width: 3, curve: "smooth" },
    markers: { size: 4 },
    xaxis: { categories: classes, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (v) => `${formatoPT(v)} €` } },
  };
  new ApexCharts(document.querySelector("#grafico-mediana-classe"), opcoes).render();
}

document.addEventListener("DOMContentLoaded", iniciarSeccao1);
