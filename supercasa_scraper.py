"""
=============================================================================
  SUPERCASA SCRAPER - UrbanEco Analytics
=============================================================================
  Este script percorre páginas de listagem do Supercasa.pt (uma por cada
  combinação freguesia + estado do imóvel), recolhe os anúncios reais de
  cada página, visita a página de detalhe de cada anúncio para extrair as
  variáveis pedidas, e grava tudo na tabela `anuncios_imoveis` da base de
  dados PostgreSQL alojada no Aiven (ver ficheiro
  criar_tabela_anuncios_imoveis.sql para criar a tabela antes da primeira
  execução).

  Variáveis recolhidas (esquema definido por Miguel):
    ID, ID_URL, Preco, Tipo, Tipologia, Area_Bruta, Area_Util, Morada,
    Classe_Energetica, Fonte, Freguesia, Concelho, Quartos, Garagem,
    Elevador, Varanda, Estado, Ano, TimeStamp
    (+ URL completo, acrescentado pelo Claude - ver explicação na
    resposta de chat e no SQL).

  Arquitetura (decisões e porquês)
  ---------------------------------
  1) Selenium + Chrome real (não headless por defeito) com perfil dedicado
     -----------------------------------------------------------------------
     O Supercasa está protegido pela Cloudflare (desafio "Just a moment...").
     Em testes, um Chrome real resolve este desafio automaticamente em
     poucos segundos, sem necessitar de qualquer interação - basta abrir a
     página e esperar. Tal como no scraper do Idealista, usamos um perfil
     de Chrome dedicado (não o perfil principal) para manter o cookie
     "cf_clearance" entre execuções e evitar o problema já conhecido de
     bloqueio de imagens no Chrome principal.

     IMPORTANTE (lição aprendida durante o desenvolvimento): o user-agent
     enviado tem de ter um número de versão do Chrome IGUAL à versão real
     instalada (ver variável VERSAO_CHROME, na configuração abaixo). Um
     user-agent desalinhado faz a Cloudflare ficar bloqueada no desafio
     para sempre.

  2) Não foi necessário criar conta / fazer login no Supercasa
     -----------------------------------------------------------------------
     O Supercasa expõe TODOS os dados de cada anúncio diretamente no HTML
     devolvido pelo servidor. Alguns elementos têm `style="display:none"`
     e só ficam visíveis ao clicar em "Ver todos os detalhes" (que pede
     login) - mas o TEXTO já está no HTML, só está escondido por CSS. Como
     fazemos scraping do HTML e não cliques de UI, conseguimos ler tudo
     sem precisar de conta.

  3) Duas fases, tal como no Idealista
     -----------------------------------------------------------------------
     FASE 1 (listagem): cada página de resultados só mostra título, preço,
     nº de quartos e área bruta aproximada - dados insuficientes.
     FASE 2 (detalhe): visitamos cada anúncio individualmente para obter o
     conjunto completo de variáveis (classe energética, ano de construção,
     casas de banho, etc.).

  4) Paginação por URL, não por cliques
     -----------------------------------------------------------------------
     Confirmado por testes reais: a paginação segue o padrão
       https://supercasa.pt/<filtros>/pagina-2 , /pagina-3 , etc.
     Paramos quando uma página não devolve nenhum anúncio real.

  5) "Tipo" e "Tipologia" são lidos do PRÓPRIO URL do anúncio
     -----------------------------------------------------------------------
     Ex: ".../venda-apartamento-t2-porto/i2230392" já nos diz que o tipo é
     "Apartamento" e a tipologia é "T2" - mais fiável do que tentar
     interpretar o texto livre do título.

  6) "Estado" do imóvel NÃO é extraído da página - é definido na
     CONFIGURAÇÃO, porque cada um dos 4 links por freguesia já corresponde
     a um filtro específico do site (Novo / Usado / Para Recuperar /
     Em Construção).

  7) Deduplicação - NUNCA atualiza um anúncio já existente
     -----------------------------------------------------------------------
     A chave de unicidade é (Fonte, ID_URL) - ver índice único no SQL.
     Se um anúncio com a mesma (Fonte, ID_URL) já existir na tabela, o
     scraper IGNORA-O por completo: não atualiza nenhum campo, não apaga
     e reinsere, não duplica - o registo existente fica intocado, com o
     mesmo `id` que já tinha. Só são inseridos anúncios verdadeiramente
     novos. Isto permite, no futuro, ter o mesmo ID numérico vindo de
     fontes diferentes (ex: Idealista e SuperCasa) sem conflito.

  8) Limite de imóveis em modo de teste
     -----------------------------------------------------------------------
     Quando MODO_TESTE = True, o script para automaticamente depois de
     processar LIMITE_IMOVEIS_MODO_TESTE imóveis (ver configuração abaixo),
     mesmo que o filtro tenha centenas de resultados. O limite aplica-se
     tanto à Fase 1 (para de paginar mais cedo) como à Fase 2 (para de
     abrir mais anúncios), e conta o total ao longo de TODOS os links da
     lista LINKS_PARA_SCRAPER, não por link individual. Em modo de
     produção (MODO_TESTE = False) este limite é ignorado por completo.

  9) Os 28 links (7 freguesias x 4 estados) - filtro "últimas 48 horas"
     -----------------------------------------------------------------------
     Todos os links usam o filtro "com-publicado-ultimas-48-horas" do
     Supercasa combinado com o estado do imóvel. Isto significa que cada
     execução só traz anúncios MUITO recentes (publicados ou atualizados
     nas últimas 48h) - ideal para correr este scraper periodicamente
     (ex: uma vez por dia, via scheduler) e ir acumulando o histórico na
     base de dados, em vez de tentar capturar tudo de uma vez. O mesmo
     princípio já era usado no scraper do Idealista.

  10) Configuração via variáveis de ambiente (.env / Secrets do GitHub)
      -----------------------------------------------------------------------
      A secção CONFIGURAÇÃO já não tem a password da base de dados escrita
      em texto (não é seguro, agora que este ficheiro vive num repositório
      Git). Em vez disso, lê tudo de variáveis de ambiente:
        - Localmente: cria um ficheiro chamado .env (na mesma pasta do
          script, NUNCA enviado para o GitHub) com, no mínimo:
            DATABASE_URL=postgres://...a tua ligação real do Aiven...
          Ver o ficheiro .env.example como modelo.
        - No GitHub Actions: a mesma variável é definida como "Secret" do
          repositório, e o workflow injeta-a automaticamente - não precisas
          de ficheiro .env nenhum lá.

  Como usar (no teu computador, Windows/Spyder)
  ----------------------------------------------
    1. Criar primeiro a tabela na base de dados (correr o ficheiro
       criar_tabela_anuncios_imoveis.sql no Aiven Query Editor ou DBeaver) -
       só é preciso fazer isto uma vez.
    2. Criar o ficheiro .env (ver .env.example) com a tua DATABASE_URL.
    3. Preencher a secção CONFIGURAÇÃO abaixo (lista de URLs, etc.).
    4. Decidir o MODO_TESTE (True = não escreve na BD, só mostra e grava
       um ficheiro de apoio em JSON; False = escreve mesmo na BD do Aiven).
    5. Correr no Spyder (F5) ou em terminal: python supercasa_scraper.py

  Como usar (automaticamente, todos os dias, no GitHub Actions)
  ----------------------------------------------------------------
    Ver o ficheiro .github/workflows/scraper_diario.yml e as instruções
    passo a passo dadas na resposta de chat - resumidamente: criar um
    repositório no GitHub, enviar estes ficheiros, definir o Secret
    DATABASE_URL nas definições do repositório, e o workflow corre
    sozinho todos os dias à hora marcada (ou manualmente, a qualquer
    momento, pelo botão "Run workflow").

  Dependências (correr uma vez):
    pip install -r requirements.txt
"""

import os
import re
import json
import time
import random
import logging
from datetime import datetime

from dotenv import load_dotenv
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

import psycopg2

# Carrega variáveis de um ficheiro .env local, se existir, para as colocar
# em os.environ (não tem qualquer efeito no GitHub Actions, onde as
# variáveis já vêm definidas como "Secrets" - ver explicação no chat e
# no ficheiro .env.example).
load_dotenv()


# =============================================================================
#   CONFIGURAÇÃO  (ZONA DE AJUSTE — editar livremente conforme necessário)
# =============================================================================
#
# A PARTIR DESTA VERSÃO, todas as definições abaixo podem ser substituídas
# por variáveis de ambiente (sem precisar de tocar no código). Isto permite
# usar EXATAMENTE o mesmo ficheiro tanto:
#   - no teu computador Windows (Spyder), onde as variáveis vêm do ficheiro
#     .env que crias localmente (ver .env.example) - os caminhos do Chrome
#     abaixo ficam como estavam, como valor de reserva (fallback);
#   - no GitHub Actions (Linux, na nuvem), onde as variáveis vêm dos
#     "Secrets" do repositório e dos outputs da ação que instala o Chrome -
#     nesse ambiente NÃO se usam os caminhos do Windows, claro.
#
# IMPORTANTE - SEGURANÇA: a password da base de dados JÁ NÃO está escrita
# aqui em texto. Tem de vir sempre de uma variável de ambiente (local: pelo
# ficheiro .env; no GitHub Actions: pelo Secret DATABASE_URL). Isto é
# essencial porque este ficheiro passa a ficar guardado num repositório
# Git - nunca se deve pôr uma password a sério dentro de código-fonte.

# --- Caminho para o executável do Chrome e do Chromedriver -----------------
# Em Linux (GitHub Actions) deixamos em None - o Selenium Manager resolve
# sozinho sem problema nenhum nesse sistema (o problema só existe no
# Windows com processador ARM, que é o teu caso local).
CHROME_BINARY = os.environ.get("CHROME_BINARY", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
CHROMEDRIVER_PATH = os.environ.get("CHROMEDRIVER_PATH", r"C:\WebDriver\chromedriver.exe")

# --- Versão do Chrome a anunciar no user-agent ------------------------------
# Localmente, continua a ter de corresponder à versão real instalada (ver
# chrome://version). No GitHub Actions, o workflow define este valor
# automaticamente a partir da versão do Chrome que acabou de instalar -
# nunca fica desatualizado.
VERSAO_CHROME = os.environ.get("VERSAO_CHROME", "149")

# --- Perfil de Chrome dedicado (igual ao princípio já usado no Idealista) --
# No GitHub Actions cada execução começa numa máquina nova e limpa, por
# isso este perfil nunca persiste entre dias - não há problema, o desafio
# da Cloudflare resolve-se sozinho em poucos segundos mesmo num perfil
# novo (testado).
PASTA_PERFIL_CHROME = os.environ.get(
    "PASTA_PERFIL_CHROME",
    os.path.expanduser("~/Documents/supercasa_chrome_profile"),
)

# --- Modo headless (sem janela) ---------------------------------------------
# No GitHub Actions TEM de ser True (não há ecrã nenhum lá). Localmente
# podes continuar a escolher.
MODO_HEADLESS = os.environ.get("MODO_HEADLESS", "True").lower() == "true"

# --- Modo teste --------------------------------------------------------------
# True  -> não escreve na base de dados; grava um ficheiro
#          supercasa_teste.json no Desktop e imprime os resultados no ecrã.
#          Além disso, para automaticamente ao atingir
#          LIMITE_IMOVEIS_MODO_TESTE imóveis processados (ver abaixo).
# False -> escreve mesmo na tabela `anuncios_imoveis` da base de dados Aiven,
#          e percorre TUDO, sem limite.
# MODO_TESTE = os.environ.get("MODO_TESTE", "False").lower() == "true"
MODO_TESTE = "false"

# --- Limite de imóveis a processar em modo de teste -------------------------
# Só tem efeito quando MODO_TESTE = True. Ponha None para não ter limite
# nenhum mesmo em modo de teste (comportamento antigo).
LIMITE_IMOVEIS_MODO_TESTE = 10

# --- Ligação à base de dados PostgreSQL (Aiven) -----------------------------
# Sem valor de reserva (fallback) propositadamente - tem de vir SEMPRE do
# .env local ou do Secret do GitHub. Se não estiver definida, o script
# avisa e para, em vez de arriscar usar uma ligação errada.
DATABASE_URL = os.environ.get("DATABASE_URL", "")


# --- Identificação da fonte dos dados (ver coluna `fonte` na tabela) -------
FONTE = "SuperCasa"

# --- Lista de páginas a percorrer -------------------------------------------
# Estrutura: cada entrada é (freguesia, concelho, estado, url).
# `estado` tem de ser um destes 4 valores: "Novo", "Usado",
# "Para Recuperar", "Em Construção".
#
# Mapeamento entre o filtro do URL e o valor de "estado" usado aqui:
#   ...,novo            -> "Novo"
#   ...,bom-estado      -> "Usado"           (imóvel usado mas em bom estado)
#   ...,para-reformar   -> "Para Recuperar"
#   ...,em-construcao   -> "Em Construção"
#
# As 7 freguesias do Porto, 4 estados cada = 28 links.
LINKS_PARA_SCRAPER = [

    # --- Bonfim ---
    ("Bonfim", "Porto", "Novo",
     "https://supercasa.pt/comprar-casas/porto/bonfim/com-publicado-ultimas-48-horas,novo"),
    ("Bonfim", "Porto", "Usado",
     "https://supercasa.pt/comprar-casas/porto/bonfim/com-publicado-ultimas-48-horas,bom-estado"),
    ("Bonfim", "Porto", "Para Recuperar",
     "https://supercasa.pt/comprar-casas/porto/bonfim/com-publicado-ultimas-48-horas,para-reformar"),
    ("Bonfim", "Porto", "Em Construção",
     "https://supercasa.pt/comprar-casas/porto/bonfim/com-publicado-ultimas-48-horas,em-construcao"),

    # --- Campanhã ---
    ("Campanhã", "Porto", "Novo",
     "https://supercasa.pt/comprar-casas/porto/campanha/com-publicado-ultimas-48-horas,novo"),
    ("Campanhã", "Porto", "Usado",
     "https://supercasa.pt/comprar-casas/porto/campanha/com-publicado-ultimas-48-horas,bom-estado"),
    ("Campanhã", "Porto", "Para Recuperar",
     "https://supercasa.pt/comprar-casas/porto/campanha/com-publicado-ultimas-48-horas,para-reformar"),
    ("Campanhã", "Porto", "Em Construção",
     "https://supercasa.pt/comprar-casas/porto/campanha/com-publicado-ultimas-48-horas,em-construcao"),

    # --- Paranhos ---
    ("Paranhos", "Porto", "Novo",
     "https://supercasa.pt/comprar-casas/porto/paranhos/com-publicado-ultimas-48-horas,novo"),
    ("Paranhos", "Porto", "Usado",
     "https://supercasa.pt/comprar-casas/porto/paranhos/com-publicado-ultimas-48-horas,bom-estado"),
    ("Paranhos", "Porto", "Para Recuperar",
     "https://supercasa.pt/comprar-casas/porto/paranhos/com-publicado-ultimas-48-horas,para-reformar"),
    ("Paranhos", "Porto", "Em Construção",
     "https://supercasa.pt/comprar-casas/porto/paranhos/com-publicado-ultimas-48-horas,em-construcao"),

    # --- Ramalde ---
    ("Ramalde", "Porto", "Novo",
     "https://supercasa.pt/comprar-casas/porto/ramalde/com-publicado-ultimas-48-horas,novo"),
    ("Ramalde", "Porto", "Usado",
     "https://supercasa.pt/comprar-casas/porto/ramalde/com-publicado-ultimas-48-horas,bom-estado"),
    ("Ramalde", "Porto", "Para Recuperar",
     "https://supercasa.pt/comprar-casas/porto/ramalde/com-publicado-ultimas-48-horas,para-reformar"),
    ("Ramalde", "Porto", "Em Construção",
     "https://supercasa.pt/comprar-casas/porto/ramalde/com-publicado-ultimas-48-horas,em-construcao"),

    # --- Aldoar, Foz do Douro e Nevogilde ---
    ("Aldoar, Foz do Douro e Nevogilde", "Porto", "Novo",
     "https://supercasa.pt/comprar-casas/porto/aldoar-foz-do-douro-e-nevogilde/com-publicado-ultimas-48-horas,novo"),
    ("Aldoar, Foz do Douro e Nevogilde", "Porto", "Usado",
     "https://supercasa.pt/comprar-casas/porto/aldoar-foz-do-douro-e-nevogilde/com-publicado-ultimas-48-horas,bom-estado"),
    ("Aldoar, Foz do Douro e Nevogilde", "Porto", "Para Recuperar",
     "https://supercasa.pt/comprar-casas/porto/aldoar-foz-do-douro-e-nevogilde/com-publicado-ultimas-48-horas,para-reformar"),
    ("Aldoar, Foz do Douro e Nevogilde", "Porto", "Em Construção",
     "https://supercasa.pt/comprar-casas/porto/aldoar-foz-do-douro-e-nevogilde/com-publicado-ultimas-48-horas,em-construcao"),

    # --- Cedofeita, Santo Ildefonso, Sé, Miragaia, São Nicolau e Vitória ---
    ("Cedofeita, Santo Ildefonso, Sé, Miragaia, São Nicolau e Vitória", "Porto", "Novo",
     "https://supercasa.pt/comprar-casas/porto/cedofeita-santo-ildefonso-se-miragaia-sao-nicolau-e-vitoria/com-publicado-ultimas-48-horas,novo"),
    ("Cedofeita, Santo Ildefonso, Sé, Miragaia, São Nicolau e Vitória", "Porto", "Usado",
     "https://supercasa.pt/comprar-casas/porto/cedofeita-santo-ildefonso-se-miragaia-sao-nicolau-e-vitoria/com-publicado-ultimas-48-horas,bom-estado"),
    ("Cedofeita, Santo Ildefonso, Sé, Miragaia, São Nicolau e Vitória", "Porto", "Para Recuperar",
     "https://supercasa.pt/comprar-casas/porto/cedofeita-santo-ildefonso-se-miragaia-sao-nicolau-e-vitoria/com-publicado-ultimas-48-horas,para-reformar"),
    ("Cedofeita, Santo Ildefonso, Sé, Miragaia, São Nicolau e Vitória", "Porto", "Em Construção",
     "https://supercasa.pt/comprar-casas/porto/cedofeita-santo-ildefonso-se-miragaia-sao-nicolau-e-vitoria/com-publicado-ultimas-48-horas,em-construcao"),

    # --- Lordelo do Ouro e Massarelos ---
    ("Lordelo do Ouro e Massarelos", "Porto", "Novo",
     "https://supercasa.pt/comprar-casas/porto/lordelo-do-ouro-e-massarelos/com-publicado-ultimas-48-horas,novo"),
    ("Lordelo do Ouro e Massarelos", "Porto", "Usado",
     "https://supercasa.pt/comprar-casas/porto/lordelo-do-ouro-e-massarelos/com-publicado-ultimas-48-horas,bom-estado"),
    ("Lordelo do Ouro e Massarelos", "Porto", "Para Recuperar",
     "https://supercasa.pt/comprar-casas/porto/lordelo-do-ouro-e-massarelos/com-publicado-ultimas-48-horas,para-reformar"),
    ("Lordelo do Ouro e Massarelos", "Porto", "Em Construção",
     "https://supercasa.pt/comprar-casas/porto/lordelo-do-ouro-e-massarelos/com-publicado-ultimas-48-horas,em-construcao"),

]

# --- Tempos de espera e "arrefecimento" (anti-bot) --------------------------
ESPERA_MIN_ENTRE_PEDIDOS = 3.0
ESPERA_MAX_ENTRE_PEDIDOS = 7.0
PEDIDOS_ANTES_DE_ARREFECER = 15
PAUSA_DE_ARREFECIMENTO = (20, 40)
MAX_PAGINAS_POR_LINK = 40
SEGUNDOS_MAX_ESPERA_CLOUDFLARE = 25


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("supercasa")


# =============================================================================
#   BROWSER — arranque do Chrome e espera pelo desafio da Cloudflare
# =============================================================================

def criar_driver():
    opcoes = Options()

    if CHROME_BINARY:
        opcoes.binary_location = CHROME_BINARY
    if MODO_HEADLESS:
        opcoes.add_argument("--headless=new")

    opcoes.add_argument(f"--user-data-dir={PASTA_PERFIL_CHROME}")

    # Em ambientes de CI/contentores (o GitHub Actions define sempre a
    # variável de ambiente CI=true), o Chrome precisa destas duas flags
    # extra para não recusar arrancar. No Windows local não têm efeito
    # nenhum, por isso não há problema em deixá-las condicionais.
    if os.environ.get("CI"):
        opcoes.add_argument("--no-sandbox")
        opcoes.add_argument("--disable-dev-shm-usage")

    opcoes.add_argument("--window-size=1366,900")
    opcoes.add_argument("--lang=pt-PT")

    # ZONA DE AJUSTE: a versão usada aqui vem da variável VERSAO_CHROME,
    # configurada no topo do ficheiro. Mantenha-a sempre igual à versão
    # real do Chrome instalado e à versão do chromedriver. Se a Cloudflare
    # passar a ficar bloqueada no desafio, comece por aqui.
    opcoes.add_argument(
        "user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        f"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{VERSAO_CHROME}.0.0.0 Safari/537.36"
    )
    opcoes.add_experimental_option("excludeSwitches", ["enable-automation"])
    opcoes.add_experimental_option("useAutomationExtension", False)
    opcoes.add_argument("--disable-blink-features=AutomationControlled")

    if CHROMEDRIVER_PATH:
        servico = Service(CHROMEDRIVER_PATH)
        driver = webdriver.Chrome(service=servico, options=opcoes)
    else:
        driver = webdriver.Chrome(options=opcoes)

    return driver


def ir_para_url_com_espera(driver, url):
    """Navega para o URL e espera até a Cloudflare libertar a página."""
    driver.get(url)
    inicio = time.time()
    while time.time() - inicio < SEGUNDOS_MAX_ESPERA_CLOUDFLARE:
        titulo = driver.title.lower()
        if "just a moment" not in titulo and "momento" not in titulo:
            return True
        time.sleep(1)
    log.warning(f"Desafio da Cloudflare não resolveu a tempo em: {url}")
    return False


def pausa_aleatoria():
    time.sleep(random.uniform(ESPERA_MIN_ENTRE_PEDIDOS, ESPERA_MAX_ENTRE_PEDIDOS))


# =============================================================================
#   FASE 1 — PÁGINA DE LISTAGEM
# =============================================================================

def url_da_pagina(url_base, numero_pagina):
    """Acrescenta '/pagina-N' ao URL base, exceto para a página 1."""
    if numero_pagina <= 1:
        return url_base
    return f"{url_base.rstrip('/')}/pagina-{numero_pagina}"


def parse_listing_page(html):
    """
    Extrai os anúncios REAIS de uma página de listagem.

    ZONA DE AJUSTE: o critério que distingue um anúncio real de um anúncio
    "featured" (publicidade de outra zona, irrelevante para o nosso filtro)
    é a presença do atributo id="property-XXXX" no <article>. Os cartões
    publicitários não têm este atributo, em todos os testes feitos.
    """
    soup = BeautifulSoup(html, "lxml")
    resultados = []

    artigos = soup.find_all("article", id=re.compile(r"^property-\d+$"))
    for art in artigos:
        titulo_tag = art.select_one(".property-card__title a")
        href = titulo_tag["href"] if titulo_tag else None
        titulo = titulo_tag.get_text(strip=True) if titulo_tag else None

        preco_tag = art.select_one(".property-card__price span")
        preco_texto = preco_tag.get_text(strip=True) if preco_tag else None

        ldjson = {}
        script_tag = art.find("script", type="application/ld+json")
        if script_tag and script_tag.string:
            try:
                ldjson = json.loads(script_tag.string.strip())
            except json.JSONDecodeError:
                ldjson = {}

        if not href:
            continue

        url_completo = "https://supercasa.pt" + href if href.startswith("/") else href

        resultados.append({
            "url": url_completo,
            "titulo_listagem": titulo,
            "preco_texto_listagem": preco_texto,
            "ldjson_listagem": ldjson,
        })

    return resultados


def colher_todos_os_anuncios(driver, url_base, limite=None):
    """
    Percorre todas as páginas de um URL de filtro (Fase 1).

    Se `limite` for indicado (não None), o script para de paginar logo que
    já tiver recolhido esse número de anúncios - poupa tempo em modo de
    teste, não há necessidade de percorrer centenas de páginas só para
    processar alguns imóveis a seguir.
    """
    todos = []
    contador_pedidos = 0

    for pagina in range(1, MAX_PAGINAS_POR_LINK + 1):
        url_pagina = url_da_pagina(url_base, pagina)
        log.info(f"  [Fase 1] A ler página {pagina}: {url_pagina}")

        ok = ir_para_url_com_espera(driver, url_pagina)
        if not ok:
            log.warning("  Página não carregou corretamente - a parar esta lista.")
            break

        anuncios_da_pagina = parse_listing_page(driver.page_source)

        if not anuncios_da_pagina:
            log.info(f"  Página {pagina} sem anúncios reais - fim da paginação.")
            break

        log.info(f"  -> {len(anuncios_da_pagina)} anúncio(s) encontrado(s) nesta página.")
        todos.extend(anuncios_da_pagina)

        if limite is not None and len(todos) >= limite:
            log.info(f"  Limite de teste ({limite}) atingido na Fase 1 - a parar a paginação.")
            break

        contador_pedidos += 1
        if contador_pedidos % PEDIDOS_ANTES_DE_ARREFECER == 0:
            pausa = random.uniform(*PAUSA_DE_ARREFECIMENTO)
            log.info(f"  A arrefecer {pausa:.0f}s para não sobrecarregar o site...")
            time.sleep(pausa)
        else:
            pausa_aleatoria()

    # Remover duplicados pelo URL (pode raramente repetir-se entre páginas)
    vistos = set()
    sem_duplicados = []
    for a in todos:
        if a["url"] not in vistos:
            vistos.add(a["url"])
            sem_duplicados.append(a)

    if limite is not None:
        sem_duplicados = sem_duplicados[:limite]

    return sem_duplicados


# =============================================================================
#   FASE 2 — PÁGINA DE DETALHE
# =============================================================================

def parse_feature_categories(soup):
    """
    Cada bloco de características tem um título (<h3 class="title-lbase">) e
    uma lista de itens (<li class="features">). Devolve
    {nome_da_categoria: [itens]}.

    ZONA DE AJUSTE: alguns itens trazem style="display:none" (só ficam
    visíveis ao clicar em "Ver todos os detalhes"), mas o texto já vem
    completo no HTML do servidor - por isso o seletor "li.features" (sem
    filtrar por style) pega em tudo. Se o Supercasa passar a carregar estes
    itens só depois de um clique via JavaScript, este seletor deixa de
    funcionar e será preciso simular o clique com Selenium.
    """
    categorias = {}
    for bloco in soup.select(".o-container-feature-gray"):
        titulo_tag = bloco.select_one("h3.title-lbase")
        if not titulo_tag:
            continue
        nome_categoria = titulo_tag.get_text(strip=True)
        itens = [li.get_text(strip=True) for li in bloco.select("li.features")]
        categorias[nome_categoria] = itens
    return categorias


def itens_para_dict(itens):
    """'Casa(s) de Banho : 4' -> {'casa(s) de banho': '4'}; 'Elevador' -> {'elevador': True}"""
    resultado = {}
    for item in itens:
        if ":" in item:
            chave, valor = item.split(":", 1)
            resultado[chave.strip().lower()] = valor.strip()
        else:
            resultado[item.strip().lower()] = True
    return resultado


def parse_detail_page(html):
    soup = BeautifulSoup(html, "lxml")

    categorias = parse_feature_categories(soup)
    flat = {}
    for itens in categorias.values():
        flat.update(itens_para_dict(itens))

    ldjson_offer = {}
    for script_tag in soup.find_all("script", type="application/ld+json"):
        if not script_tag.string:
            continue
        try:
            data = json.loads(script_tag.string.strip())
        except json.JSONDecodeError:
            continue
        if data.get("@type") == "Offer" and "availableAtOrFrom" in data:
            ldjson_offer = data
            break

    titulo_tag = soup.select_one(".property-summary__title span")
    titulo = titulo_tag.get_text(strip=True) if titulo_tag else None

    return {
        "flat": flat,
        "ldjson_offer": ldjson_offer,
        "titulo_detalhe": titulo,
    }


# =============================================================================
#   FUNÇÕES AUXILIARES DE CONVERSÃO (texto do site -> tipos Python/SQL)
# =============================================================================

def parse_preco(texto):
    """'573.000 €' -> 573000.0  (ponto = separador de milhares, formato PT)."""
    if not texto:
        return None
    texto = str(texto).replace("€", "").strip()
    texto = texto.replace(".", "").replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        return None


def parse_area(texto):
    """
    '343.53 m²' -> 343.53
    ATENÇÃO: aqui o ponto já é separador DECIMAL, não de milhares -
    confirmado em testes (diferente da convenção usada no preço!).
    """
    if not texto:
        return None
    m = re.search(r"([\d]+(?:[.,]\d+)?)", str(texto))
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", "."))
    except ValueError:
        return None


def parse_inteiro(texto):
    if texto is None or isinstance(texto, bool):
        return None
    m = re.search(r"\d+", str(texto))
    return int(m.group()) if m else None


def parse_id_url(url):
    """
    Extrai o identificador alfanumérico do final do URL do anúncio.
    Ex: 'https://supercasa.pt/venda-apartamento-t2-porto/i2230392' -> 'i2230392'
    """
    if not url:
        return None
    return url.rstrip("/").split("/")[-1]


def parse_tipo_e_codigo_tipologia(url, titulo):
    """
    Lê o "Tipo" (Apartamento, Moradia, Loja, etc.) e o código bruto de
    tipologia (T2, V3, etc.) de preferência a partir do URL do anúncio
    (mais fiável), com o título como rede de segurança.

    Padrão do URL confirmado em testes:
      /venda-<tipo>-<codigo>-<zona>/i<id>
      ex: /venda-apartamento-t2-porto/i2230392
    """
    tipo, codigo = None, None

    if url:
        partes = url.rstrip("/").split("/")
        slug = partes[-2] if len(partes) >= 2 else partes[-1]
        m = re.search(r"venda-([a-z\-]+?)-([tv]\d+(?:\+\d+)?)-", slug, re.IGNORECASE)
        if m:
            tipo = m.group(1).replace("-", " ").strip().title()
            codigo = m.group(2).upper()

    if codigo is None and titulo:
        m = re.search(r"\b([TV]\d{1,2}(?:\+\d{1,2})?)\b", titulo, re.IGNORECASE)
        if m:
            codigo = m.group(1).upper()

    if tipo is None and titulo:
        m = re.match(r"\s*([A-Za-zÀ-ÿ]+)", titulo)
        if m:
            tipo = m.group(1).title()

    return tipo, codigo


def bucket_tipologia(codigo):
    """
    Normaliza o código bruto (ex: 'T6', 'V2', 'T3+1') para uma das
    categorias pedidas: T0, T1, T2, T3, T4, T5+, V0, V1, V2, V3, V4, V5+,
    ou Outros.
    """
    if not codigo:
        return "Outros"
    m = re.match(r"([TV])(\d+)", codigo, re.IGNORECASE)
    if not m:
        return "Outros"
    letra = m.group(1).upper()
    numero = int(m.group(2))
    return f"{letra}5+" if numero >= 5 else f"{letra}{numero}"


def sim_nao(flat, *chaves):
    """Devolve 'S' se qualquer uma das chaves existir no dicionário flat, senão 'N'."""
    return "S" if any(chave in flat for chave in chaves) else "N"


def primeiro_valor(flat, *chaves):
    for chave in chaves:
        if chave in flat:
            return flat[chave]
    return None


# =============================================================================
#   MAPEAMENTO FINAL — junta listagem + detalhe + configuração num registo
#   pronto para gravar na tabela `anuncios_imoveis`
# =============================================================================

def montar_registo_imovel(resumo_listagem, detalhe, freguesia_cfg, concelho_cfg, estado_cfg):
    flat = detalhe["flat"]
    ldjson = detalhe["ldjson_offer"] or resumo_listagem.get("ldjson_listagem", {})
    endereco_ldjson = ldjson.get("availableAtOrFrom", {}).get("address", {})

    titulo = detalhe.get("titulo_detalhe") or resumo_listagem.get("titulo_listagem")
    url = resumo_listagem["url"]

    # --- Preço: preferir o ld+json (mais limpo), com recurso ao texto da listagem
    preco = None
    if ldjson.get("price"):
        try:
            preco = float(str(ldjson["price"][0]).replace(".", "").replace(",", "."))
        except (ValueError, IndexError):
            preco = None
    if preco is None:
        preco = parse_preco(resumo_listagem.get("preco_texto_listagem"))

    # --- Tipo e Tipologia
    tipo, codigo_tipologia = parse_tipo_e_codigo_tipologia(url, titulo)
    tipologia = bucket_tipologia(codigo_tipologia)

    # --- Áreas
    area_util = parse_area(primeiro_valor(flat, "área útil"))
    area_bruta = parse_area(primeiro_valor(flat, "área bruta"))

    # --- Localização
    freguesia = endereco_ldjson.get("addressRegion") or freguesia_cfg
    concelho = endereco_ldjson.get("addressLocality") or concelho_cfg
    morada = None
    if titulo:
        m = re.search(r"\bn[ao]\s+(.+?),", titulo)
        morada = m.group(1).strip() if m else None

    # --- Outras características
    classe_energetica = primeiro_valor(flat, "classe energética")
    quartos = parse_inteiro(primeiro_valor(flat, "total quarto(s)", "total quartos"))
    if quartos is None:
        # rede de segurança: tentar ler "X quartos" das features rápidas da listagem
        m = re.search(r"(\d+)\s*quartos?", resumo_listagem.get("titulo_listagem") or "", re.IGNORECASE)
        quartos = int(m.group(1)) if m else None

    garagem = sim_nao(flat, "garagem", "lugar de garagem", "lugares de garagem")
    elevador = sim_nao(flat, "elevador")
    varanda = sim_nao(flat, "varandas", "varanda")

    ano = parse_inteiro(primeiro_valor(flat, "fim da construção", "ano construção", "ano de construção"))

    return {
        "id_url": parse_id_url(url),
        "preco": preco,
        "tipo": tipo,
        "tipologia": tipologia,
        "area_bruta": area_bruta,
        "area_util": area_util,
        "morada": morada,
        "classe_energetica": classe_energetica,
        "fonte": FONTE,
        "freguesia": freguesia,
        "concelho": concelho,
        "quartos": quartos,
        "garagem": garagem,
        "elevador": elevador,
        "varanda": varanda,
        "estado": estado_cfg,
        "ano": ano,
        "url": url,
        "timestamp_registo": datetime.now(),
    }


# =============================================================================
#   BASE DE DADOS — ligação e upsert (a criação da tabela é feita pelo
#   ficheiro criar_tabela_anuncios_imoveis.sql, correr esse primeiro)
# =============================================================================

def obter_ligacao():
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL não está definida. Localmente: cria um ficheiro .env "
            "com DATABASE_URL=... (ver .env.example). No GitHub Actions: define "
            "o Secret chamado DATABASE_URL nas definições do repositório."
        )
    return psycopg2.connect(DATABASE_URL, sslmode="require")


def inserir_se_novo(conn, dados):
    """
    Insere um novo anúncio SE E SÓ SE (fonte, id_url) ainda não existir na
    tabela. Se já existir, não faz NADA - não atualiza, não duplica, não
    apaga e reinsere. O registo já existente fica exatamente como estava.

    Devolve True se foi mesmo inserido (anúncio novo), False se já existia
    e foi ignorado.

    NOTA: antes esta função fazia um "upsert" (inserir OU atualizar, via
    ON CONFLICT ... DO UPDATE). Mudámos para "inserir só se for novo"
    (ON CONFLICT ... DO NOTHING) a pedido do Miguel.
    """
    colunas = list(dados.keys())
    valores = [dados[c] for c in colunas]
    colunas_sql = ", ".join(colunas)
    marcadores = ", ".join(["%s"] * len(colunas))

    sql = f"""
        INSERT INTO anuncios_imoveis ({colunas_sql})
        VALUES ({marcadores})
        ON CONFLICT (fonte, id_url) DO NOTHING
        RETURNING id;
    """
    with conn.cursor() as cur:
        cur.execute(sql, valores)
        linha = cur.fetchone()
    conn.commit()
    return linha is not None


# =============================================================================
#   FLUXO PRINCIPAL
# =============================================================================

def correr_scraper():
    log.info("=" * 70)
    log.info("SUPERCASA SCRAPER - UrbanEco Analytics")
    log.info(f"Modo: {'TESTE (sem escrita na BD)' if MODO_TESTE else 'PRODUÇÃO (escreve na BD)'}")

    limite = LIMITE_IMOVEIS_MODO_TESTE if MODO_TESTE else None
    if limite is not None:
        log.info(f"Limite de imóveis em modo de teste: {limite}")
    log.info("=" * 70)

    conn = None
    if not MODO_TESTE:
        # Verificar a ligação primeiro, antes de gastar tempo a abrir o
        # Chrome e a passar a Cloudflare - se faltar a DATABASE_URL é
        # melhor falhar logo aqui, claramente, do que a meio do trabalho.
        conn = obter_ligacao()
        log.info("Ligação à base de dados estabelecida.")

    driver = criar_driver()
    registos_para_ficheiro_teste = []
    total_processados = 0

    try:
        total_novos, total_existentes = 0, 0

        for freguesia, concelho, estado, url_base in LINKS_PARA_SCRAPER:

            if limite is not None and total_processados >= limite:
                log.info("Limite de teste atingido - a ignorar os links restantes.")
                break

            log.info(f"\n>>> A processar: {freguesia} / {estado}")
            log.info(f"    URL: {url_base}")

            # Quantos imóveis ainda faltam para atingir o limite global
            limite_restante = (limite - total_processados) if limite is not None else None

            anuncios = colher_todos_os_anuncios(driver, url_base, limite=limite_restante)
            log.info(f"    Total de anúncios reais encontrados: {len(anuncios)}")

            for i, resumo in enumerate(anuncios, start=1):

                if limite is not None and total_processados >= limite:
                    log.info(f"    Limite de teste ({limite}) atingido - a parar a Fase 2.")
                    break

                log.info(f"    [Fase 2] ({i}/{len(anuncios)}) A abrir: {resumo['url']}")

                ok = ir_para_url_com_espera(driver, resumo["url"])
                if not ok:
                    log.warning(f"    Não foi possível abrir {resumo['url']} - a saltar.")
                    continue

                detalhe = parse_detail_page(driver.page_source)
                registo = montar_registo_imovel(resumo, detalhe, freguesia, concelho, estado)

                if MODO_TESTE:
                    registos_para_ficheiro_teste.append(registo)
                    log.info(f"    [TESTE] {json.dumps(registo, ensure_ascii=False, default=str)}")
                else:
                    e_novo = inserir_se_novo(conn, registo)
                    if e_novo:
                        total_novos += 1
                        log.info("    Gravado na BD (novo).")
                    else:
                        total_existentes += 1
                        log.info("    Já existia na BD (id_url repetido) - ignorado, nada foi alterado.")

                total_processados += 1

                if i % PEDIDOS_ANTES_DE_ARREFECER == 0:
                    pausa = random.uniform(*PAUSA_DE_ARREFECIMENTO)
                    log.info(f"    A arrefecer {pausa:.0f}s...")
                    time.sleep(pausa)
                else:
                    pausa_aleatoria()

        if MODO_TESTE:
            caminho_desktop = os.path.expanduser("~/Desktop")
            pasta_destino = caminho_desktop if os.path.isdir(caminho_desktop) else "."
            caminho_ficheiro = os.path.join(pasta_destino, "supercasa_teste.json")
            with open(caminho_ficheiro, "w", encoding="utf-8") as f:
                json.dump(registos_para_ficheiro_teste, f, ensure_ascii=False, indent=2, default=str)
            log.info(f"\nFicheiro de teste gravado em: {caminho_ficheiro}")
            log.info(f"Total de registos recolhidos: {len(registos_para_ficheiro_teste)}")
        else:
            log.info(f"\nConcluído. Novos: {total_novos} | Já existiam (ignorados): {total_existentes}")

    finally:
        driver.quit()
        if conn:
            conn.close()


if __name__ == "__main__":
    correr_scraper()
