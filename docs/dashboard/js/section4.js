/* ============================================================
   section4.js — EVI (Energy Value Index)
============================================================ */

async function iniciarSeccaoEVI() {
  const [pesquisa, top20] = await Promise.all([
    carregarDados("imoveis_pesquisa"),
    carregarDados("evi_top20"),
  ]);
  if (!pesquisa) return;

  preencherStatsEVI(pesquisa);
  if (pesquisa) {
    graficoEviVsM2(pesquisa);
    graficoEficienciaVsPreco(pesquisa);
  }
  if (top20) preencherTabelaTop20(top20);
}

function preencherStatsEVI(pesquisa) {
  const comEvi = pesquisa.filter((d) => d.evi !== null && d.evi !== undefined);
  const media = comEvi.length ? comEvi.reduce((s, d) => s + d.evi, 0) / comEvi.length : 0;
  const acima50 = comEvi.filter((d) => d.evi > 50).length;
  const mediaM2 = pesquisa.length ? pesquisa.reduce((s, d) => s + (d.eur_m2 || 0), 0) / pesquisa.length : 0;

  const elMedia = document.getElementById("evi-stat-medio");
  const elAcima = document.getElementById("evi-stat-acima50");
  const elM2 = document.getElementById("evi-stat-m2");
  if (elMedia) animarNumero(elMedia, media, 1);
  if (elAcima) animarNumero(elAcima, acima50);
  if (elM2) elM2.textContent = formatoPT(mediaM2) + " €";
}

function corPorCategoria(categoria) {
  const mapa = { Excelente: "#2FBE6E", Bom: "#8BD448", Médio: "#F2C94C", Fraco: "#F2A93B", "Muito Fraco": "#E5484D" };
  return mapa[categoria] || "#5C6760";
}

function graficoEviVsM2(pesquisa) {
  const el = document.querySelector("#grafico-evi-scatter");
  if (!el) return;
  const validos = pesquisa.filter((d) => d.evi !== null && d.eur_m2 > 0);

  const porCategoria = {};
  validos.forEach((d) => {
    const cat = d.categoria || "NC";
    porCategoria[cat] = porCategoria[cat] || [];
    porCategoria[cat].push({ x: d.eur_m2, y: d.evi });
  });

  const series = Object.entries(porCategoria).map(([cat, pontos]) => ({ name: cat, data: pontos }));

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "scatter", height: 360, zoom: { enabled: true } },
    series,
    colors: Object.keys(porCategoria).map(corPorCategoria),
    xaxis: { title: { text: "€/m²", style: { color: "#9CA39B" } }, labels: { formatter: (v) => formatoPT(v) } },
    yaxis: { title: { text: "EVI", style: { color: "#9CA39B" } }, max: 110 },
    markers: { size: 4 },
  };
  new ApexCharts(el, opcoes).render();
}

function graficoEficienciaVsPreco(pesquisa) {
  const el = document.querySelector("#grafico-eficiencia-scatter");
  if (!el) return;

  const porClasse = {};
  pesquisa.forEach((d) => {
    if (!d.classe_energetica || !d.eur_m2 || d.energy_score_valor === null || d.energy_score_valor === undefined) return;
    porClasse[d.classe_energetica] = porClasse[d.classe_energetica] || { somaScore: 0, somaM2: 0, n: 0 };
    porClasse[d.classe_energetica].somaScore += d.energy_score_valor;
    porClasse[d.classe_energetica].somaM2 += d.eur_m2;
    porClasse[d.classe_energetica].n += 1;
  });

  const classes = Object.keys(porClasse).filter((c) => ORDEM_CLASSES.includes(c));
  const dataPontos = classes.map((c) => ({
    x: porClasse[c].somaScore / porClasse[c].n,
    y: porClasse[c].somaM2 / porClasse[c].n,
    classe: c,
  }));

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "scatter", height: 320 },
    series: [{ name: "Classe energética", data: dataPontos.map((p) => ({ x: p.x, y: p.y })) }],
    colors: ["#2FBE6E"],
    markers: {
      size: 9,
      colors: classes.map((c) => CORES_CLASSES[c] || "#5C6760"),
    },
    xaxis: { title: { text: "Energy Score médio", style: { color: "#9CA39B" } }, min: 0, max: 5.5, labels: { formatter: (v) => formatoPT(v, 1) } },
    yaxis: { title: { text: "€/m² médio", style: { color: "#9CA39B" } }, labels: { formatter: (v) => formatoPT(v) } },
    dataLabels: {
      enabled: true,
      formatter: (v, opts) => classes[opts.dataPointIndex],
      style: { colors: ["#F2F0E9"] },
      offsetY: -14,
    },
  };
  new ApexCharts(el, opcoes).render();
}

function preencherTabelaTop20(top20) {
  const tbody = document.querySelector("#tabela-top20 tbody");
  if (!tbody) return;
  tbody.innerHTML = top20
    .map(
      (d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.freguesia}</td>
      <td>${d.tipo} ${d.tipologia}</td>
      <td>${d.classe_energetica || "—"}</td>
      <td>${formatoPT(d.eur_m2)} €</td>
      <td style="color:${corPorCategoria(d.categoria)}; font-weight:600;">${formatoPT(d.evi, 1)}</td>
      <td><span class="badge" style="background:${corPorCategoria(d.categoria)}22; color:${corPorCategoria(d.categoria)};">${d.categoria}</span></td>
      <td><a href="${d.url}" target="_blank" rel="noopener">ver ↗</a></td>
    </tr>`
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", iniciarSeccaoEVI);
