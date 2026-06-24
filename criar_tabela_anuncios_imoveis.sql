-- ============================================================
-- Tabela: anuncios_imoveis
-- Projeto: UrbanEco Analytics
-- Descricao: Tabela simplificada de anuncios imobiliarios,
--            preparada para receber dados de multiplas fontes
--            (SuperCasa, e futuramente outras - Idealista, etc.)
-- ============================================================
--
-- NOTA IMPORTANTE: este nome de tabela (anuncios_imoveis) foi escolhido
-- de propósito para NAO colidir com uma eventual tabela "imoveis" já
-- existente na base de dados (com um esquema mais complexo, usado
-- anteriormente no projeto). Se preferires substituir essa tabela antiga
-- por esta, ou juntar os dados das duas, diz-me e ajusto o script.
--
-- Para correr: copiar e colar no Aiven Query Editor ou no DBeaver,
-- ligado a base de dados urbaneco-db.

CREATE TABLE IF NOT EXISTS anuncios_imoveis (

    -- Chave primaria auto-incremental
    id                  SERIAL PRIMARY KEY,

    -- Identificador alfanumerico que vem no final do URL do anuncio
    -- (ex: para ".../i2230392" o valor guardado e "i2230392")
    id_url              VARCHAR(50)     NOT NULL,

    -- Preco do imovel, em euros
    preco               NUMERIC(12,2),

    -- Tipo de imovel: Apartamento, Moradia, Loja, Predio, Terreno, etc.
    tipo                VARCHAR(50),

    -- Tipologia normalizada: T0, T1, T2, T3, T4, T5+, V0, V1, V2, V3,
    -- V4, V5+, ou Outros (quando nao se aplica, ex: lojas e terrenos)
    tipologia           VARCHAR(10),

    -- Areas em metros quadrados (com 2 casas decimais)
    area_bruta          NUMERIC(8,2),
    area_util           NUMERIC(8,2),

    -- Morada (rua), quando foi possivel identificar no anuncio
    morada              VARCHAR(255),

    -- Certificado energetico: A+, A, B, C, D, E, F ou G
    -- (campo de texto livre para tambem aceitar casos como "Isento"
    -- ou "Em curso", que por vezes aparecem em vez de uma letra)
    classe_energetica   VARCHAR(10),

    -- Fonte dos dados: SuperCasa, ou Outros (Idealista, Casafari, etc.)
    fonte               VARCHAR(50)     NOT NULL DEFAULT 'SuperCasa',

    -- Localizacao administrativa
    freguesia           VARCHAR(100),
    concelho            VARCHAR(100),

    -- Numero de quartos
    quartos             INTEGER,

    -- Caracteristicas booleanas, guardadas como 'S' (sim) ou 'N' (nao)
    garagem             CHAR(1)         CHECK (garagem  IN ('S', 'N')),
    elevador            CHAR(1)         CHECK (elevador IN ('S', 'N')),
    varanda             CHAR(1)         CHECK (varanda  IN ('S', 'N')),

    -- Estado do imovel: Novo, Usado, Para Recuperar ou Em Construcao
    -- (definido automaticamente pelo scraper, de acordo com o filtro
    -- de URL utilizado - nao e' extraido do texto do anuncio)
    estado              VARCHAR(20),

    -- Ano de construcao
    ano                 INTEGER,

    -- URL completo do anuncio (coluna acrescentada pelo Claude para
    -- alem da lista original: permite voltar a abrir o anuncio para
    -- verificacao manual, e funciona como segunda chave de unicidade
    -- juntamente com o id_url + fonte - ver indice em baixo)
    url                 TEXT            NOT NULL,

    -- Momento exato em que o registo foi capturado/atualizado pelo scraper
    timestamp_registo   TIMESTAMP       NOT NULL DEFAULT NOW()

);

-- ============================================================
-- Indices e restricoes de unicidade
-- ============================================================

-- Cada anuncio (fonte + id_url) só pode aparecer uma vez na tabela.
-- E' esta a chave usada pelo scraper para fazer UPSERT (inserir se for
-- novo, atualizar se ja existir).
CREATE UNIQUE INDEX IF NOT EXISTS idx_anuncios_fonte_idurl
    ON anuncios_imoveis(fonte, id_url);

-- Indices simples para acelerar pesquisas e filtros mais frequentes
CREATE INDEX IF NOT EXISTS idx_anuncios_concelho   ON anuncios_imoveis(concelho);
CREATE INDEX IF NOT EXISTS idx_anuncios_freguesia  ON anuncios_imoveis(freguesia);
CREATE INDEX IF NOT EXISTS idx_anuncios_estado     ON anuncios_imoveis(estado);
CREATE INDEX IF NOT EXISTS idx_anuncios_tipologia  ON anuncios_imoveis(tipologia);

-- ============================================================
-- Comentarios na tabela, para documentacao interna (sem acentos,
-- para evitar problemas de encoding no DBeaver)
-- ============================================================

COMMENT ON TABLE anuncios_imoveis IS 'Anuncios imobiliarios recolhidos por scraping - UrbanEco Analytics';
COMMENT ON COLUMN anuncios_imoveis.id_url IS 'Identificador alfanumerico extraido do final do URL do anuncio';
COMMENT ON COLUMN anuncios_imoveis.tipologia IS 'T0 a T4, T5+ para 5 ou mais quartos, V0 a V4, V5+, ou Outros';
COMMENT ON COLUMN anuncios_imoveis.classe_energetica IS 'Certificado energetico: A+, A, B, C, D, E, F ou G';
COMMENT ON COLUMN anuncios_imoveis.fonte IS 'Origem dos dados: SuperCasa ou Outros';
COMMENT ON COLUMN anuncios_imoveis.estado IS 'Novo, Usado, Para Recuperar ou Em Construcao - definido pelo filtro do scraper';
COMMENT ON COLUMN anuncios_imoveis.garagem IS 'S = tem garagem, N = nao tem';
COMMENT ON COLUMN anuncios_imoveis.elevador IS 'S = tem elevador, N = nao tem';
COMMENT ON COLUMN anuncios_imoveis.varanda IS 'S = tem varanda, N = nao tem';
