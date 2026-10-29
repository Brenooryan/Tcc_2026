import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ReferenceLine,
} from "recharts";
import {
  Upload, TrendingUp, Users, DollarSign, UserMinus, Briefcase, MessageCircle,
  Send, Sparkles, SlidersHorizontal, Loader2, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, RotateCcw, FileSpreadsheet, BarChart3, PieChartIcon,
  Activity, Target, Bot, KeyRound, HelpCircle, Download, Pencil, PlusCircle, X, Save,
} from "lucide-react";
import {
  cleanAndNormalize,
  createQualityReport,
  summarizeCompleteness,
  applyDateIntervals,
  cleanNum,
  cleanStr,
  dropBlankRows,
  harmonizeCategoricalValues,
  maskCpf,
  normalizeKey,
  toDate,
} from "./lib/limpeza.js";
import {
  AGG_TYPES,
  CHART_TYPES,
  FILTER_OPS,
  ICON_HINTS,
  IDENTIFYING_FIELDS,
  MIN_GROUP_SIZE_FOR_SENSITIVE,
  TABLE_LABELS,
  addMonths,
  applyFilters,
  applyGlobalFilters,
  buildDataProfile,
  computeAgg,
  computeChartData,
  computeKpiValue,
  endOfMonth,
  fieldExists,
  isSensitiveMetric,
  matchesPeriodFilter,
  monthKey,
  monthLabel,
  monthsBetween,
  resolveCostMeasure,
  costByMonth,
  resolvePayrollSimulation,
  realCategory,
  usableRiskDimensions,
  availableTableLabels,
  validateChart,
  validateFilterFields,
  validatePlan,
} from "./lib/motor.js";

// Biblioteca de planilhas (SheetJS, ~330 KB): so e baixada quando o usuario envia um arquivo (ver readWorkbookMerged).
let XLSX = null;

/* ============================================================================
   DESIGN TOKENS (via CSS custom properties — permite trocar paleta/modo claro-escuro
   sem alterar cada componente: definimos os valores uma vez no elemento raiz, e todo
   o app referencia var(--c-...) por baixo dos panos)
============================================================================ */
const T = {
  ink: "var(--c-ink)",
  paper: "var(--c-paper)",
  paperRaised: "var(--c-paper-raised)",
  line: "var(--c-line)",
  forest: "var(--c-forest)",
  forestDark: "var(--c-forest-dark)",
  amber: "var(--c-amber)",
  brick: "var(--c-brick)",
  slate: "var(--c-slate)",
  slateLight: "var(--c-slate-light)",
  navyPanel: "var(--c-navy-panel)",
};
const CHART_COLORS = [
  "var(--c-chart-1)", "var(--c-chart-2)", "var(--c-chart-3)", "var(--c-chart-4)",
  "var(--c-chart-5)", "var(--c-chart-6)", "var(--c-chart-7)", "var(--c-chart-8)",
];

/* Bases neutras (estrutura) por modo — as cores de marca vêm da paleta escolhida */
const LIGHT_BASE = { ink: "#16213B", paper: "#F6F4EE", paperRaised: "#FFFFFF", line: "#DCD7C9", slate: "#6E7488", slateLight: "#9AA0B0", navyPanel: "#1B2740" };
const DARK_BASE = { ink: "#E9EAF0", paper: "#12141C", paperRaised: "#1B1F2B", line: "#2C3040", slate: "#9AA2B8", slateLight: "#666E82", navyPanel: "#0C0E15" };

/* Paletas de marca — cada uma define acento primario/secundario/erro + 8 cores categoricas */
const PALETTES = {
  floresta: { label: "Floresta", forest: "#2F6F5E", forestDark: "#1F4B3F", amber: "#C6852F", brick: "#A94B3E",
    chart: ["#2F6F5E", "#C6852F", "#3E6FA8", "#A94B3E", "#8C6FB0", "#6E9B7A", "#B08A4E", "#5B7C99"] },
  oceano: { label: "Oceano", forest: "#1D6FA5", forestDark: "#134D75", amber: "#DE8A3C", brick: "#B0473F",
    chart: ["#1D6FA5", "#DE8A3C", "#4CA097", "#B0473F", "#6B7FBF", "#3E9B6E", "#C4A23E", "#7C6FA5"] },
  ameixa: { label: "Ameixa", forest: "#6B4E9B", forestDark: "#4C3670", amber: "#D9A441", brick: "#B14B5C",
    chart: ["#6B4E9B", "#D9A441", "#4C8FA5", "#B14B5C", "#8A6FBF", "#5C9B6E", "#C46E8A", "#4E6FA5"] },
  grafite: { label: "Grafite", forest: "#3E5C6B", forestDark: "#2A414D", amber: "#B98A3E", brick: "#A5504A",
    chart: ["#3E5C6B", "#B98A3E", "#6B8A99", "#A5504A", "#7C7C8A", "#5C8A6E", "#A57C4A", "#4A6B8A"] },
  terracota: { label: "Terracota", forest: "#B5623E", forestDark: "#8A462A", amber: "#3E7C6E", brick: "#8C3B36",
    chart: ["#B5623E", "#3E7C6E", "#C48A4E", "#8C3B36", "#6E8A99", "#A5794A", "#5C7C5E", "#8A5C4A"] },
};
const DEFAULT_PALETTE = "floresta";

/* Estilos visuais — controlam a "personalidade" inteira da interface: tipografia (fontes
 * de titulo/corpo/numeros), raio de borda, sombra e espessura de borda — independente da
 * paleta de cor escolhida. Cada estilo carrega uma familia de fontes bem diferente das
 * outras, entao a mudanca aparece no HTML inteiro, nao so no contorno dos cartoes. */
const STYLES = {
  classico: {
    label: "Classico", radiusCard: 12, radiusSm: 7, shadow: "none", borderWeight: "1px",
    fontDisplay: "'Fraunces', serif", fontBody: "'Inter', sans-serif", fontMono: "'IBM Plex Mono', monospace",
  },
  suave: {
    label: "Suave", radiusCard: 20, radiusSm: 14, shadow: "0 4px 16px rgba(20,20,30,0.08)", borderWeight: "1px",
    fontDisplay: "'Baloo 2', cursive", fontBody: "'Nunito', sans-serif", fontMono: "'IBM Plex Mono', monospace",
  },
  tech: {
    label: "Tech", radiusCard: 4, radiusSm: 3, shadow: "none", borderWeight: "1.5px",
    fontDisplay: "'Space Grotesk', sans-serif", fontBody: "'IBM Plex Sans', sans-serif", fontMono: "'JetBrains Mono', monospace",
  },
};
const DEFAULT_STYLE = "classico";

function buildThemeVars(paletteId, darkMode, styleId) {
  const base = darkMode ? DARK_BASE : LIGHT_BASE;
  const accent = PALETTES[paletteId] || PALETTES[DEFAULT_PALETTE];
  const style = STYLES[styleId] || STYLES[DEFAULT_STYLE];
  return {
    "--c-ink": base.ink, "--c-paper": base.paper, "--c-paper-raised": base.paperRaised,
    "--c-line": base.line, "--c-slate": base.slate, "--c-slate-light": base.slateLight,
    "--c-navy-panel": base.navyPanel,
    "--c-forest": accent.forest, "--c-forest-dark": accent.forestDark,
    "--c-amber": accent.amber, "--c-brick": accent.brick,
    "--c-chart-1": accent.chart[0], "--c-chart-2": accent.chart[1], "--c-chart-3": accent.chart[2], "--c-chart-4": accent.chart[3],
    "--c-chart-5": accent.chart[4], "--c-chart-6": accent.chart[5], "--c-chart-7": accent.chart[6], "--c-chart-8": accent.chart[7],
    "--r-card": `${style.radiusCard}px`, "--r-sm": `${style.radiusSm}px`,
    "--shadow-card": style.shadow, "--border-w": style.borderWeight,
    "--font-display": style.fontDisplay, "--font-body": style.fontBody, "--font-mono": style.fontMono,
  };
}

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Baloo+2:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');`;

/** Regra de escrita repetida em todo prompt de IA que produz texto exibido ao usuario
 *  (titulos de grafico, resumos, respostas do chat) — garante acentuacao correta em
 *  portugues e evita o uso de hifen como separador de ideias. */
const WRITING_STYLE_RULE = "Escreva sempre em portugues do Brasil correto e bem acentuado (use a, e, i, o, u com acento, cedilha em c e til em a/o onde for gramaticalmente necessario). Nunca use hifen (-) para separar ideias, temas ou frases; prefira virgula, ponto final ou a conjuncao 'e'.";

/* ============================================================================
   HELPERS: datas, numeros
============================================================================ */
const fmtBRL = (v) =>
  v === null || v === undefined || isNaN(v)
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtBRLc = (v) =>
  v === null || v === undefined || isNaN(v)
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(v);
const fmtInt = (v) => (v === null || v === undefined || isNaN(v) ? "—" : new Intl.NumberFormat("pt-BR").format(Math.round(v)));
const fmtPct = (v) => (v === null || v === undefined || isNaN(v) ? "—" : `${v.toFixed(1)}%`);

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, predict: (x) => points[0]?.y ?? 0 };
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, predict: (x) => slope * x + intercept };
}
/* ============================================================================
   PARSE + TRATAMENTO DE DADOS
============================================================================ */
function detectSheetKey(name) {
  const n = normalizeKey(name);
  if (n.includes("entrevista")) return "entrevistas";
  if (n.includes("desligamento")) return "desligamentos";
  if (n.includes("movimenta")) return "movimentacoes";
  if (n.includes("recrutamento") || n.includes("selecao") || n.includes("vaga")) return "rs";
  if (n.includes("folha") || n.includes("pagamento")) return "folha";
  if (n.includes("funcionario")) return "funcionarios";
  return null;
}

const ROLE_LABELS = {
  funcionarios: "Cadastro de funcionários",
  desligamentos: "Desligamentos",
  folha: "Folha de pagamento",
  rs: "Recrutamento & Seleção",
  entrevistas: "Entrevista de desligamento e pesquisa",
  movimentacoes: "Movimentações (promoções, transferências e outras)",
  unknown: "Não identificada",
};

const ROLE_CANONICAL_FIELDS = {
  funcionarios: ["matricula", "nome", "cpf", "data_nascimento", "idade", "data_admissao", "data_desligamento", "status", "cargo", "senioridade", "area", "centro_custo", "matricula_gestor", "filial", "modelo_trabalho", "tipo_contrato", "genero", "raca_etnia", "pcd", "salario_inicial", "salario_atual"],
  desligamentos: ["matricula", "data_desligamento", "tipo_desligamento", "motivo_detalhado", "iniciativa", "tempo_casa_dias", "nota_enps"],
  folha: ["matricula", "competencia", "salario_base", "beneficios_vr_va_saude", "bonus_comissao", "encargos_inss_fgts", "horas_extras", "custo_total_ctc"],
  rs: ["id_vaga", "cargo", "area", "data_abertura", "data_fechamento", "recrutador_responsavel", "status", "origem_vaga", "fonte_recrutamento", "matricula_contratado", "tempo_contratacao_dias"],
  entrevistas: ["matricula", "categoria", "pergunta", "resposta_nota", "resposta_texto"],
  movimentacoes: ["matricula", "data_evento", "tipo_evento", "cargo_anterior", "cargo_novo", "area_anterior", "area_novo", "salario_anterior", "salario_novo", "motivo"],
};
const ROLE_FIELD_NOTES = {
  funcionarios: {
    idade: "use SOMENTE se a aba trouxer a idade em anos diretamente (numero), quando nao houver data de nascimento.",
    cargo: "se a aba tiver uma unica coluna combinando cargo e nome (ex: 'Cargo / Nome' com valor 'Assistente / Joao Silva'), mapeie 'cargo' E 'nome' para essa MESMA coluna — o sistema separa os dois automaticamente depois.",
  },
};

function parseJsonLoose(text) {
  let t = (text || "").trim();
  t = t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

function truncateVal(v) {
  if (v === null || v === undefined) return null;
  const s = String(maskCpf(typeof v === "string" ? v : String(v)));
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
}

/** Chama a IA para identificar o papel de cada aba e mapear suas colunas para o dicionario canonico. */
async function detectSchemaWithAI(workbook, apiKey, model, provider, onRetry) {
  const sheets = workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name];
    const rows = dropBlankRows(XLSX.utils.sheet_to_json(ws, { defval: null, raw: true })).rows;
    const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
    const headers = rows.length ? Object.keys(rows[0]) : headerRow.map(String);
    const amostra = rows.slice(0, 4).map((r) => {
      const o = {};
      headers.forEach((h) => { o[h] = truncateVal(r[h]); });
      return o;
    });
    return { aba: name, colunas: headers, total_linhas: rows.length, amostra };
  });

  const system = `Voce e um especialista em dados de Recursos Humanos / People Analytics. Vai receber a lista de abas de uma planilha enviada por um usuario, com seus cabecalhos de coluna e uma pequena amostra de linhas de cada uma. 

Sua tarefa:
1. Avaliar se essa planilha, no geral, parece conter dados de RH (cadastro de funcionarios, desligamentos, folha de pagamento, recrutamento, pesquisas de clima/saida, movimentacoes de carreira, etc). Se NADA nela parecer dado de RH, marque is_hr_data como false.
2. Para cada aba, identificar qual papel ela tem, escolhendo APENAS entre: "funcionarios" (cadastro/mestre de colaboradores, com pelo menos identificador da pessoa e alguma data de admissao), "desligamentos" (registros de saida com motivo/tipo), "folha" (dados de pagamento/salario por competencia), "rs" (vagas de recrutamento e selecao), "entrevistas" (respostas de entrevista de desligamento ou pesquisa de engajamento/clima), "movimentacoes" (historico de promocoes, transferencias, mudancas de cargo/salario/gestor), ou "unknown" se nao se encaixar em nenhuma.
3. Para cada aba com papel identificado, mapear as colunas originais dela para os campos canonicos correspondentes (fornecidos abaixo para cada papel). Use null quando um campo canonico nao existir naquela aba. NUNCA invente nomes de colunas que nao estao na lista "colunas" fornecida.
4. As abas podem vir de arquivos diferentes (o nome pode vir prefixado com "NomeDoArquivo · NomeDaAba") e/ou representar o mesmo tipo de dado repetido por periodo (ex: uma aba "2019", outra "2020", cada uma com a mesma estrutura de colunas representando um ano diferente). Nesses casos, atribua o MESMO papel a todas as abas com estrutura equivalente, para que sejam combinadas em uma unica base — nao invente um papel diferente so porque o nome da aba muda.
5. O dicionario de campos canonicos abaixo NAO cobre todo contexto possivel de RH (ex: indices de pesquisa de clima, SLA/meta de recrutamento, classificacao de vaga, avaliacao de desempenho, dados demograficos especificos de uma empresa). Para cada coluna de uma aba identificada (papel != "unknown") que NAO foi usada no "column_map" mas que ainda assim parece conter um dado analisavel (numero, categoria com poucos valores distintos, ou data) — e nao for um identificador individual (nome, cpf, texto livre longo, ID interno sem uso analitico) — inclua ela em "extra_fields", com um rotulo curto em portugues e o tipo de dado que te parece mais provavel. Omita colunas de texto livre extenso, comentarios, ou ids/campos sem valor analitico. Isso permite que a base seja aproveitada mesmo quando tem metricas que nao fazem parte do dicionario fixo do sistema — o tipo que voce declarar aqui sera conferido contra os dados reais depois, entao um palpite razoavel e suficiente.

Campos canonicos por papel:
${JSON.stringify(ROLE_CANONICAL_FIELDS, null, 0)}

Observacoes especiais sobre alguns campos:
${JSON.stringify(ROLE_FIELD_NOTES, null, 0)}

Responda SOMENTE com um JSON valido (sem markdown, sem texto fora do JSON), o mais compacto possivel (sem espacos/quebras de linha desnecessarias), exatamente neste formato:
{
  "is_hr_data": true,
  "overall_note": "string curta, preenchida principalmente se is_hr_data for false, explicando o motivo",
  "sheets": [
    { "original_name": "nome exato da aba", "role": "funcionarios", "confidence": "high",
      "column_map": { "matricula": "nome_da_coluna_original", "nome": "nome_da_coluna_original" },
      "extra_fields": [ { "original_name": "nome_da_coluna_original", "label": "Indice de Engajamento", "data_type": "numeric" } ] }
  ]
}
IMPORTANTE: no "column_map" de cada aba, inclua APENAS os campos canonicos que voce conseguiu mapear com uma coluna real (nao inclua campos com valor null nem campos que nao existem na aba) — isso mantem a resposta curta. "extra_fields" e opcional — omita o array inteiro (ou deixe vazio) se nao houver nenhuma coluna sobrando que valha a pena. "data_type" deve ser "numeric", "categorical", "date" ou "text".`;

  const prompt = `Abas encontradas na planilha (JSON):\n${JSON.stringify(sheets)}`;

  try {
    return await callWithRetry(
      // Base 4096 tokens, dobrando a cada nova tentativa (ate um teto) — bases com muitas
      // colunas ambiguas (sem papel canonico obvio) levam a IA a escrever respostas mais
      // longas, e um limite fixo repetido nas 3 tentativas falha sempre do mesmo jeito.
      (attempt) => callClaude(prompt, system, apiKey, model, provider, Math.min(4096 * 2 ** attempt, 16000)),
      (text) => {
        let parsed;
        try {
          parsed = parseJsonLoose(text);
        } catch (e) {
          throw new Error("PARSE_RETRY");
        }
        if (!parsed || !Array.isArray(parsed.sheets)) throw new Error("PARSE_RETRY");
        return parsed;
      },
      { onRetry }
    );
  } catch (e) {
    if (e.message === "PARSE_RETRY" || e.retryable) {
      throw new Error("A IA não retornou um mapeamento válido após várias tentativas. Tente novamente, ou verifique sua chave e modelo configurado.");
    }
    throw e;
  }
}

function applyColumnMap(rows, columnMap) {
  const entries = Object.entries(columnMap || {}).filter(([, orig]) => orig);
  return rows.map((r) => {
    const out = {};
    entries.forEach(([canon, orig]) => { out[canon] = r[orig]; });
    return out;
  });
}

/* ============================================================================
   CAMPOS EXTRAS (Caminho B) — colunas que nao pertencem ao dicionario canonico fixo
   (ex: indice de pesquisa de clima, SLA/meta de vaga, avaliacao de desempenho) mas que
   ainda assim sao numero/categoria/data analisavel. A IA so propoe rotulo + palpite de
   tipo (sheets[].extra_fields, ver prompt de detectSchemaWithAI); o codigo SEMPRE confere
   esse palpite contra os valores reais antes de confiar nele — a IA nunca calcula nada,
   so ajuda a nomear o que calcular, igual ao restante do column_map.
============================================================================ */

/** Gera uma chave de objeto segura (sem espaco/acento/maiuscula) a partir do rotulo dado
 *  pela IA, sempre prefixada com "extra_" para nunca colidir com um campo canonico.
 *  Diferente de normalizeKey (que so usamos pra COMPARAR valores e descarta espacos sem
 *  deixar rastro), aqui o separador de palavra vira "_" em vez de ser removido — assim a
 *  barra de filtros consegue reconstruir um rotulo legivel tipo "Status Vaga" a partir da
 *  chave "extra_status_vaga" (ver humanizeFieldKey). Com normalizeKey puro, "Status Vaga"
 *  e "Fase Atual" virariam "statusvaga"/"faseatual" — palavras grudadas, sem como separar
 *  de volta. */
function slugifyExtraFieldKey(label, originalName) {
  const src = (label || originalName || "").toString();
  const base = src
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  return `extra_${base || "campo"}`;
}

/** Decide o tipo REAL de uma coluna a partir dos valores de verdade (nunca do palpite da
 *  IA): maioria dos valores nao-vazios parseia como numero -> "numeric"; maioria parseia
 *  como data -> "date"; poucos valores distintos -> "categorical"; senao, "text" (texto
 *  livre, descartado depois — nao ha calculo determinístico util sobre texto livre). */
function detectRealFieldType(values) {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (!nonNull.length) return null;
  const asNum = nonNull.filter((v) => cleanNum(v) !== null).length;
  if (asNum / nonNull.length >= 0.8) return "numeric";
  const asDate = nonNull.filter((v) => toDate(v) !== null).length;
  if (asDate / nonNull.length >= 0.8) return "date";
  const uniq = new Set(nonNull.map((v) => String(v).trim().toLowerCase()));
  if (uniq.size <= Math.max(20, Math.round(nonNull.length * 0.5))) return "categorical";
  return "text";
}

/** Valida a lista "extra_fields" proposta pela IA para uma aba contra os dados reais da
 *  propria aba. So sobrevivem campos cujo tipo real pode ser determinado com confianca
 *  (numeric/date/categorical) — campos de texto livre ou vazios sao descartados. O
 *  "data_type" devolvido e sempre o REAL, mesmo que a IA tenha palpitado outro. */
function validateExtraFields(rawRows, extraFieldsProposed) {
  const valid = [];
  (extraFieldsProposed || []).forEach((ef) => {
    if (!ef || !ef.original_name) return;
    const values = rawRows.map((r) => r[ef.original_name]);
    const realType = detectRealFieldType(values);
    if (!realType || realType === "text") return;
    const label = cleanStr(ef.label) || ef.original_name;
    valid.push({ key: slugifyExtraFieldKey(label, ef.original_name), original_name: ef.original_name, label, data_type: realType });
  });
  return valid;
}

/** Aplica os campos extras ja validados nas linhas renomeadas (mesma ordem/tamanho de
 *  rawRows, pois `renamedRows` veio de um .map() sobre rawRows), convertendo cada valor
 *  para o tipo real detectado — a partir daqui o campo extra se comporta como qualquer
 *  campo canonico no resto do pipeline (perfil, validacao de grafico, motor de calculo). */
function applyExtraFields(renamedRows, rawRows, validExtraFields) {
  if (!validExtraFields.length) return renamedRows;
  return renamedRows.map((row, i) => {
    const rawRow = rawRows[i];
    validExtraFields.forEach((ef) => {
      const raw = rawRow[ef.original_name];
      row[ef.key] = ef.data_type === "numeric" ? cleanNum(raw) : ef.data_type === "date" ? toDate(raw) : cleanStr(raw);
    });
    return row;
  });
}

/** Constroi o objeto `found` (papel -> linhas cruas ja renomeadas) a partir do mapeamento da IA. */
function buildFoundFromAIMapping(workbook, mapping, log, report = null) {
  const found = {};
  (mapping.sheets || []).forEach((s) => {
    if (!s.role || s.role === "unknown" || !ROLE_CANONICAL_FIELDS[s.role]) {
      log.push(`Aba "${s.original_name}" nao foi identificada como um papel conhecido de RH e foi ignorada.`);
      return;
    }
    const ws = workbook.Sheets[s.original_name];
    if (!ws) {
      log.push(`Aba "${s.original_name}" mencionada pela IA nao foi encontrada no arquivo.`);
      return;
    }
    const { rows: rawRows, dropped: blankDropped } = dropBlankRows(XLSX.utils.sheet_to_json(ws, { defval: null, raw: true }));
    if (blankDropped) log.push(`Aba "${s.original_name}": ${blankDropped} linha(s) totalmente em branco removida(s).`);
    let renamed = applyColumnMap(rawRows, s.column_map);
    const mappedCount = Object.values(s.column_map || {}).filter(Boolean).length;
    const totalFields = ROLE_CANONICAL_FIELDS[s.role].length;
    const validExtra = validateExtraFields(rawRows, s.extra_fields);
    if (validExtra.length) {
      renamed = applyExtraFields(renamed, rawRows, validExtra);
      log.push(`Aba "${s.original_name}": ${validExtra.length} campo(s) fora do dicionario padrao aproveitado(s) como metrica extra (${validExtra.map((e) => e.label).join(", ")}).`);
    }
    found[s.role] = (found[s.role] || []).concat(renamed);
    if (report) report.sheets.push({ name: s.original_name, role: s.role, rows: renamed.length, blankDropped, extraFields: validExtra.length });
    log.push(`Aba "${s.original_name}" identificada pela IA como "${ROLE_LABELS[s.role]}" (confianca: ${s.confidence || "?"}, ${mappedCount}/${totalFields} campos mapeados, ${renamed.length} linhas).`);
  });
  return found;
}

/** Modo legado (sem IA): exige nomes de aba e coluna identicos ao template original. */
/** Le varios arquivos e os mescla num unico "workbook" (SheetNames/Sheets), prefixando
 *  o nome da aba com o nome do arquivo quando ha mais de um arquivo, para evitar colisao. */
async function readWorkbookMerged(files) {
  if (!XLSX) XLSX = await import("xlsx");
  const merged = { SheetNames: [], Sheets: {} };
  const multi = files.length > 1;
  for (const file of files) {
    const isCsv = /\.csv$/i.test(file.name);
    let wb;
    if (isCsv) {
      // CSV nao carrega metadado de codificacao (diferente de .xlsx/.xls). Sem forcar
      // UTF-8 explicitamente aqui, o SheetJS pode interpretar o arquivo com outra
      // codificacao quando nao ha BOM, corrompendo acentos (ex: "Operações" vira
      // "OperaÃ§Ãµes"). Decodificar como texto UTF-8 antes de repassar ao SheetJS
      // evita esse problema, com ou sem BOM no arquivo original.
      const buf = await file.arrayBuffer();
      const text = new TextDecoder("utf-8").decode(buf);
      wb = XLSX.read(text, { type: "string", cellDates: true, raw: true });
    } else {
      const buf = await file.arrayBuffer();
      wb = XLSX.read(buf, { type: "array", cellDates: true });
    }
    const baseLabel = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
    wb.SheetNames.forEach((sheetName) => {
      let uniqueName = multi ? `${baseLabel} · ${sheetName}` : sheetName;
      let finalName = uniqueName;
      let n = 2;
      while (Object.prototype.hasOwnProperty.call(merged.Sheets, finalName)) {
        finalName = `${uniqueName} (${n++})`;
      }
      merged.SheetNames.push(finalName);
      merged.Sheets[finalName] = wb.Sheets[sheetName];
    });
  }
  return merged;
}

function buildFoundLegacy(workbook, log) {
  const found = {};
  workbook.SheetNames.forEach((name) => {
    const key = detectSheetKey(name);
    if (!key) {
      log.push(`Aba "${name}" nao reconhecida e foi ignorada (sem IA configurada, so reconhecemos os nomes de aba do template original).`);
      return;
    }
    const ws = workbook.Sheets[name];
    const { rows, dropped: blankDropped } = dropBlankRows(XLSX.utils.sheet_to_json(ws, { defval: null, raw: true }));
    if (blankDropped) log.push(`Aba "${name}": ${blankDropped} linha(s) totalmente em branco removida(s).`);
    found[key] = (found[key] || []).concat(rows);
    log.push(`Aba "${name}" identificada como "${ROLE_LABELS[key]}" (${rows.length} linhas brutas).`);
  });
  return found;
}

/** Etapa B: pergunta a IA, em UMA chamada, quais valores distintos sao o mesmo valor. */
async function proposeSemanticMerges(fields, apiKey, model, provider) {
  const system = `Voce e um especialista em qualidade de dados de RH (etapa de transformacao de um ETL). Vai receber varios campos categoricos de uma base, cada um com a lista de valores DISTINTOS que aparecem nele e quantas vezes cada um aparece. Sua tarefa e identificar valores que sao a MESMA coisa escrita de formas diferentes dentro do MESMO campo e agrupa-los.

Devem ser unificados: siglas e nomes por extenso ("SP" e "Sao Paulo", "Fem" e "Feminino", "CLT" e "Contrato CLT"), abreviacoes ("Ger." e "Gerente"), erros de digitacao evidentes ("Financiero" e "Financeiro"), idiomas diferentes ("Male" e "Masculino").
NAO devem ser unificados (na duvida, NAO una): niveis ou numeros diferentes ("Analista I" e "Analista II", "Nivel 1" e "Nivel 2", "Junior" e "Senior"), cargos ou areas realmente diferentes, pessoas diferentes, valores opostos ou de naturezas diferentes ("Ativo" e "Inativo", "Voluntario" e "Involuntario"), categorias que apenas parecem parecidas.

Regras: o "canonical" de cada grupo DEVE ser exatamente um dos valores listados para aquele campo (escolha a forma mais completa e bem escrita). Cada valor so pode estar em UM grupo e nunca ser canonical de um grupo e variante de outro. Nao invente valores. Inclua apenas grupos com 2 ou mais valores e omita os campos sem nada a unificar.

Responda SOMENTE com JSON valido, compacto, sem markdown: {"fields":[{"id":"f1","groups":[{"canonical":"Sao Paulo","variants":["SP","S. Paulo"]}]}]}`;

  const payload = fields.map((f) => ({
    id: f.id,
    campo: f.field,
    valores: f.reps.map(([value, n]) => [value.length > 60 ? value.slice(0, 60) : value, n]),
  }));
  const prompt = `Campos e valores distintos (JSON):\n${JSON.stringify(payload)}`;

  const parsed = await callWithRetry(
    (attempt) => callClaude(prompt, system, apiKey, model, provider, Math.min(3000 * 2 ** attempt, 12000)),
    (text) => {
      let p;
      try { p = parseJsonLoose(text); } catch (e) { throw new Error("PARSE_RETRY"); }
      if (!p || !Array.isArray(p.fields)) throw new Error("PARSE_RETRY");
      return p;
    },
    { retries: 1 }
  );
  const byId = new Map();
  (parsed.fields || []).forEach((pf) => { if (pf && typeof pf.id === "string") byId.set(pf.id, pf.groups); });
  return byId;
}

/** Detecta o que e possivel construir/mostrar de acordo com o que a base realmente contem. */
function computeCaps(data) {
  if (!data) return { headcount: false, turnover: false, payroll: false, recruitment: false, exitSurvey: false, diversity: false };
  const { funcionarios, desligamentos, rs, entrevistas, folha } = data;
  const temDesligado = funcionarios.some((f) => f.status === "Desligado");
  const diversityFields = ["genero", "raca_etnia", "pcd"];
  const hasDiversity = funcionarios.some((f) => diversityFields.some((k) => f[k] && normalizeKey(f[k]) !== "naoinformado"));
  return {
    headcount: funcionarios.length > 0,
    turnover: desligamentos.length > 0 || temDesligado,
    payroll: folha.length > 0,
    recruitment: rs.length > 0,
    exitSurvey: entrevistas.length > 0,
    diversity: hasDiversity,
  };
}

/* ============================================================================
   SERIES BASICAS (usadas apenas pelas paginas fixas de Previsoes/Cenario/Risco —
   essas sao ferramentas/algoritmos especificos, nao fazem parte do plano dinamico)
============================================================================ */
function buildCoreSeries(data, periodFilter) {
  const { funcionarios, desligamentos, folha } = data;
  if (!funcionarios.length) return null;

  const admissoes = funcionarios.map((f) => f.data_admissao).filter(Boolean);
  // Sem nenhuma data de admissao valida, nao ha como montar series historicas
  // (headcount/turnover ao longo do tempo, nem o modelo de risco). Em vez de deixar
  // o calculo seguir com uma data invalida, a pagina de Previsoes inteira e escondida.
  if (!admissoes.length) return null;

  const minAdm = new Date(Math.min(...admissoes.map((d) => d.getTime())));
  const now = new Date();
  const startKey = monthKey(minAdm);
  const endKey = monthKey(now);
  const months = monthsBetween(startKey, endKey);

  const isActiveAt = (f, dref) => f.data_admissao <= dref && (!f.data_desligamento || f.data_desligamento > dref);

  const headcountByMonth = months.map((mk) => {
    const [y, m] = mk.split("-").map(Number);
    const dref = endOfMonth(y, m - 1);
    const count = funcionarios.filter((f) => isActiveAt(f, dref)).length;
    return { mes: mk, label: monthLabel(mk), ativos: count };
  });

  const desligByMonth = {};
  desligamentos.forEach((d) => {
    const mk = monthKey(d.data_desligamento);
    desligByMonth[mk] = (desligByMonth[mk] || 0) + 1;
  });
  const admByMonth = {};
  funcionarios.forEach((f) => {
    const mk = monthKey(f.data_admissao);
    admByMonth[mk] = (admByMonth[mk] || 0) + 1;
  });

  const turnoverByMonth = months.map((mk, i) => {
    const desl = desligByMonth[mk] || 0;
    const hcAtual = headcountByMonth[i].ativos;
    const hcAnterior = i > 0 ? headcountByMonth[i - 1].ativos : hcAtual;
    const media = (hcAtual + hcAnterior) / 2 || 1;
    return { mes: mk, label: monthLabel(mk), taxa: +((desl / media) * 100).toFixed(2), desligamentos: desl, admissoes: admByMonth[mk] || 0 };
  });

  const ativos = funcionarios.filter((f) => f.status === "Ativo");

  // Custo da folha: usa so a medida que a base realmente tem (CTC; senao salario base; senao nada).
  const cost = resolveCostMeasure(folha);
  const folhaByMonth = cost ? costByMonth(folha, cost.field) : [];

  const salariosAtivos = ativos.map((f) => f.salario_atual).filter((v) => typeof v === "number" && !isNaN(v));
  const salarioMedioAtivos = salariosAtivos.length ? salariosAtivos.reduce((a, v) => a + v, 0) / salariosAtivos.length : 0;
  const payrollSim = resolvePayrollSimulation(cost, salarioMedioAtivos);

  // ---- MODELO DE RISCO DE SAIDA POR PERFIL ----
  const riskBaseRate = funcionarios.length ? (funcionarios.length - ativos.length) / funcionarios.length : 0;
  function smoothedRate(deslig, total, base, k = 8) { return (deslig + k * base) / (total + k); }
  function groupRate(keyFn) {
    const totals = {}, deslig = {};
    funcionarios.forEach((f) => {
      const k = keyFn(f);
      if (k === null || k === undefined) return;
      totals[k] = (totals[k] || 0) + 1;
      if (f.status === "Desligado") deslig[k] = (deslig[k] || 0) + 1;
    });
    const out = {};
    Object.keys(totals).forEach((k) => { out[k] = { rate: smoothedRate(deslig[k] || 0, totals[k], riskBaseRate), total: totals[k], desligados: deslig[k] || 0 }; });
    return out;
  }
  function faixaEtariaKey(f) {
    if (f.idade === null || f.idade === undefined) return null;
    if (f.idade <= 24) return "Até 24";
    if (f.idade <= 34) return "25-34";
    if (f.idade <= 44) return "35-44";
    if (f.idade <= 54) return "45-54";
    return "55+";
  }
  function tenureBucketKey(f) {
    if (f.tempo_casa_meses === null || f.tempo_casa_meses === undefined) return null;
    const m = f.tempo_casa_meses;
    if (m <= 3) return "0-3 meses";
    if (m <= 6) return "3-6 meses";
    if (m <= 12) return "6-12 meses";
    if (m <= 24) return "1-2 anos";
    return "2+ anos";
  }
  const riskModel = {
    baseRate: riskBaseRate,
    area: groupRate((f) => realCategory(f.area)),
    senioridade: groupRate((f) => realCategory(f.senioridade)),
    faixaEtaria: groupRate(faixaEtariaKey),
    tenure: groupRate(tenureBucketKey),
    modelo: groupRate((f) => realCategory(f.modelo_trabalho)),
    contrato: groupRate((f) => realCategory(f.tipo_contrato)),
    genero: groupRate((f) => realCategory(f.genero)),
  };

  return {
    headcountByMonth: headcountByMonth.filter((h) => matchesPeriodFilter(h.mes, periodFilter)),
    turnoverByMonth: turnoverByMonth.filter((t) => matchesPeriodFilter(t.mes, periodFilter)),
    folhaByMonth: folhaByMonth.filter((f) => matchesPeriodFilter(f.mes, periodFilter)),
    costLabel: cost ? cost.label : null, payrollSim, salarioMedioAtivos,
    totalAtivos: ativos.length, totalDesligados: funcionarios.length - ativos.length,
    totalHistorico: funcionarios.length, riskModel,
  };
}

/** Series mensais que NAO dependem de existir um cadastro de funcionarios — usadas na
 * pagina de Previsoes quando a base enviada nao tem headcount (ex: so recrutamento,
 * so folha, ou so desligamentos). Cada serie so aparece se a tabela correspondente
 * tiver dado suficiente; o restante do app decide o que fazer com cada uma. */
function buildStandaloneSeries(data) {
  const { rs, folha, desligamentos } = data;

  const groupCountByMonth = (rows, dateField) => {
    const map = {};
    rows.forEach((r) => {
      const d = r[dateField];
      if (!d) return;
      const mk = monthKey(d);
      map[mk] = (map[mk] || 0) + 1;
    });
    return Object.keys(map).sort().map((mk) => ({ mes: mk, label: monthLabel(mk), valor: map[mk] }));
  };

  const rsAbertasByMonth = groupCountByMonth(rs, "data_abertura");
  const rsFechadasByMonth = groupCountByMonth(rs.filter((r) => normalizeKey(r.status || "").includes("fech")), "data_fechamento");
  const desligamentosByMonth = groupCountByMonth(desligamentos, "data_desligamento");

  const tempoContratacaoByMonth = (() => {
    const map = {};
    rs.forEach((r) => {
      if (!r.data_fechamento || r.tempo_contratacao_dias === null || r.tempo_contratacao_dias === undefined) return;
      const mk = monthKey(r.data_fechamento);
      if (!map[mk]) map[mk] = { soma: 0, count: 0 };
      map[mk].soma += r.tempo_contratacao_dias;
      map[mk].count += 1;
    });
    return Object.keys(map).sort().map((mk) => ({ mes: mk, label: monthLabel(mk), valor: Math.round(map[mk].soma / map[mk].count) }));
  })();

  const cost = resolveCostMeasure(folha);
  const folhaByMonth = cost ? costByMonth(folha, cost.field).map(({ mes, label, total }) => ({ mes, label, valor: total })) : [];

  return { rsAbertasByMonth, rsFechadasByMonth, desligamentosByMonth, tempoContratacaoByMonth, folhaByMonth, costLabel: cost ? cost.label : null };
}

/* ============================================================================
   PLANEJAMENTO DINAMICO DO PAINEL (a IA decide paginas e graficos)
============================================================================ */
async function planDashboardWithAI(profile, apiKey, model, provider, userRequirements, onRetry) {
  const system = `Voce e um especialista em People Analytics que projeta dashboards de RH sob medida para cada base de dados recebida — nunca um template fixo.

Vai receber um PERFIL da base (quais tabelas existem, quais campos cada uma tem, o tipo de cada campo — categorico/numerico/data —, cardinalidade, intervalo de valores e amostras). Com base SOMENTE nisso, monte um plano de dashboard: quais paginas/temas fazem sentido para ESSA base especifica, e quais graficos colocar em cada uma.

Regras importantes:
0. ${WRITING_STYLE_RULE} Isso vale para "title", "subtitle" e "company_summary".
1. So proponha paginas e graficos para os quais existam dados suficientes no perfil. Nao invente um tema so porque e comum em RH — se a base nao tem dado de folha, nao crie uma pagina de remuneracao. Se a tabela "funcionarios" nao existir ou tiver row_count 0, a base NAO tem cadastro de funcionarios: nesse caso, nunca proponha KPIs ou graficos com source:"funcionarios", nem os specials "headcount_trend"/"turnover_trend" — construa o dashboard inteiro em torno das tabelas que realmente existem (por exemplo, so "rs", ou "rs" + "desligamentos" juntos formando um tema de entrada e saida de pessoas, ou so "folha"). Use group_by em um campo de data (kind:"month") para criar tendencias mensais nessas tabelas, no lugar dos specials.
2. A primeira pagina deve ser "visao-geral": um resumo executivo com 4 a 6 KPIs (numeros unicos) e no maximo 2 graficos de destaque.
3. As paginas seguintes (proponha entre 2 e 4, dependendo da riqueza da base) devem cobrir os temas que a propria base sustenta — nomeie e organize esses temas como fizer mais sentido para ESSES dados (nao precisa seguir uma lista fixa de nomes). Cada pagina deve ter entre 3 e 5 graficos (nunca mais que 5). No total, o plano inteiro nao deve passar de ~18 graficos somando todas as paginas.
3b. Seja economico na resposta: "title" com no maximo ~6 palavras, "subtitle" com no maximo ~8 palavras ou omitido, "company_summary" com no maximo 1 frase curta. Isso e mais importante que cobrir cada detalhe possivel da base — prefira menos graficos, bem escolhidos, a uma lista longa.
4. Cada grafico e definido de forma DECLARATIVA (voce escolhe O QUE mostrar; o calculo dos numeros e feito depois por codigo determinístico, entao nunca invente valores — so referencie campos que existem no perfil).
5. Um grafico normal usa: source (uma das tabelas), filters (opcional, lista de condicoes simples), group_by (categoria ou mes de um campo de data) e metric (contagem, soma, media, mediana, minimo ou maximo de um campo numerico; prefira a mediana a media quando o campo for uma duracao ou um valor com poucos casos muito altos).
5b. Campos "extra_duracao_..._dias" sao duracoes em dias entre duas datas, calculadas pelo sistema (ex: tempo entre inicio e fim). Servem como metrica (avg, median, max). Para cada um pode existir um campo categorico "extra_faixa_duracao_..." com faixas (ex: "até 30 dias", "31 a 60 dias", "Em andamento"): use-o como group_by para mostrar a distribuicao das duracoes ou como filtro global.
6. Existem 2 series especiais prontas que voce pode usar em vez de source/group_by/metric, quando fizer sentido: "headcount_trend" (evolucao mensal do quadro de funcionarios ativos) e "turnover_trend" (taxa de turnover mensal %) — ambas exigem que a tabela "funcionarios" tenha data de admissao (e desligamento, no caso do turnover).
7. Use apenas campos que aparecem no perfil (nunca invente nomes de campo). Use apenas os valores de chart_type, agg e op fornecidos abaixo.
7b. As tabelas "desligamentos", "folha", "movimentacoes" e "entrevistas" sao automaticamente cruzadas com "funcionarios" por matricula. Isso significa que voce PODE usar um campo de funcionarios (genero, area, senioridade, modelo_trabalho, filial, tipo_contrato, idade) como group_by ou filter mesmo quando source for uma dessas outras tabelas — por exemplo, source:"folha" com group_by no campo "genero" (de funcionarios) e metric somando "custo_total_ctc" (de folha) e uma combinacao valida para responder algo como "CTC total por genero". A tabela "rs" (recrutamento) NAO tem esse cruzamento automatico.
7c. Para uma distribuicao cruzada de DUAS dimensoes categoricas ao mesmo tempo (ex: "genero por cargo", "senioridade por area"), use "series_by": {"field": "..."} junto com o group_by normal — group_by define o eixo principal (categorias no eixo X ou Y), series_by define a segunda dimensao, que vira barras empilhadas dentro de cada categoria principal. So funciona com chart_type "bar" ou "bar_horizontal". Nao invente outra forma de representar 2 dimensoes.
8. NUNCA proponha group_by ou filter usando os campos "nome", "matricula" ou "cpf" — sao identificadores individuais e violam privacidade. Analises de RH sao sempre agregadas por categoria (area, cargo, senioridade, etc), nunca por pessoa.
9. Alem das paginas, escolha tambem ate 6 campos categoricos (de qualquer tabela do perfil) para virarem os FILTROS GLOBAIS do dashboard (a barra de filtros que afeta todos os graficos de uma vez, tipo "Unidade"/"Status"/"Classificacao" num BI). So escolha entre campos que no perfil tem type:"categorical" e cardinality entre 2 e 30 (fora disso o filtro fica inutil — poucas opcoes nao filtra nada, muitas vira uma lista enorme tipo nome de candidato ou cargo). Priorize os campos mais uteis pra um gestor de RH segmentar a analise (ex: status da vaga, filial, unidade, classificacao, area, departamento, modelo de trabalho, tipo de contrato) — NUNCA inclua identificadores, texto livre ou campos de baixo valor analitico. Se a base nao tiver nenhum campo categorico bom o suficiente, retorne uma lista vazia. Liste do mais para o menos importante.
${userRequirements ? `10. O usuario descreveu expectativas especificas para este dashboard — priorize atende-las (inclusive criando paginas ou graficos extras alem do minimo, se for preciso), desde que os dados no perfil sustentem: "${userRequirements}"` : ""}

chart_type possiveis: ${JSON.stringify(CHART_TYPES)}
agg possiveis: ${JSON.stringify(AGG_TYPES)} (agg="count" nao precisa de field)
op de filtro possiveis: ${JSON.stringify(FILTER_OPS)}
icon_hint possiveis (para o menu): ${JSON.stringify(ICON_HINTS)}

Responda SOMENTE com um JSON valido (sem markdown, sem texto fora do JSON), compacto, exatamente neste formato:
{
  "is_hr_data": true,
  "overall_note": "",
  "company_summary": "1 frase curta descrevendo o que da para inferir sobre esta organizacao a partir dos dados",
  "pages": [
    {
      "id": "visao-geral", "label": "Visao Geral", "icon_hint": "target",
      "kpis": [ { "id": "kpi1", "label": "Funcionarios ativos", "source": "funcionarios", "filters": [{"field":"status","op":"eq","value":"Ativo"}], "agg": "count", "field": null, "format": "number" } ],
      "charts": [
        { "id": "g1", "title": "Headcount ao longo do tempo", "subtitle": "Evolucao mensal", "chart_type": "line", "special": "headcount_trend" },
        { "id": "g2", "title": "Funcionarios por area", "subtitle": "Ativos hoje", "chart_type": "bar_horizontal", "source": "funcionarios", "filters": [{"field":"status","op":"eq","value":"Ativo"}], "group_by": {"kind":"category","field":"area"}, "metric": {"agg":"count","field":null}, "sort": "value_desc", "limit": 12 }
      ]
    }
  ],
  "filter_fields": [ { "table": "funcionarios", "field": "area" }, { "table": "rs", "field": "status" } ]
}
"format" dos KPIs deve ser "number", "currency" ou "percent". "sort" pode ser "value_desc", "value_asc", "label_asc" ou "none". "limit" e opcional (numero maximo de categorias no grafico). "filter_fields" e uma lista de no maximo 6 objetos {table, field} (pode ser vazia) — "table" deve ser uma das tabelas do perfil e "field" um campo categorico real dessa tabela.`;

  const prompt = `Perfil da base de dados (JSON):\n${JSON.stringify(profile)}`;
  try {
    return await callWithRetry(
      (attempt) => callClaude(prompt, system, apiKey, model, provider, Math.min(8192 * 2 ** attempt, 24000)),
      (text) => {
        let parsed;
        try {
          parsed = parseJsonLoose(text);
        } catch (e) {
          throw new Error("PARSE_RETRY");
        }
        if (!parsed || !Array.isArray(parsed.pages)) throw new Error("PARSE_RETRY");
        return parsed;
      },
      { onRetry }
    );
  } catch (e) {
    if (e.message === "PARSE_RETRY" || e.retryable) {
      throw new Error("A IA não retornou um plano de dashboard válido após várias tentativas. Tente novamente.");
    }
    throw e;
  }
}

/** Pede a IA para montar UM grafico novo (usado no modo de edicao, apos o dashboard
 *  ja gerado) — reaproveita o mesmo esquema/validacao dos graficos do plano original. */
async function planSingleChartWithAI(profile, pageLabel, existingTitles, requestText, apiKey, model, provider, onRetry) {
  const system = `Voce e um especialista em People Analytics. O usuario ja tem um dashboard de RH pronto e esta pedindo UM grafico adicional para a pagina "${pageLabel}".

Pedido do usuario: "${requestText}"

Graficos que ja existem nessa pagina (evite duplicar): ${JSON.stringify(existingTitles)}

Monte um UNICO grafico que atenda o pedido, usando SOMENTE campos que existem no perfil da base abaixo. NUNCA use os campos "nome", "matricula" ou "cpf" em group_by ou filters (violam privacidade individual). ${WRITING_STYLE_RULE} Isso vale para "title" e "subtitle".

As tabelas "desligamentos", "folha", "movimentacoes" e "entrevistas" sao automaticamente cruzadas com "funcionarios" por matricula — voce pode usar um campo de funcionarios (genero, area, senioridade, modelo_trabalho, filial, tipo_contrato, idade) como group_by ou filter mesmo quando source for uma dessas outras tabelas. Por exemplo, para "CTC por genero", use source:"folha", group_by no campo "genero", metric somando "custo_total_ctc". A tabela "rs" nao tem esse cruzamento automatico.

Se o pedido envolver DUAS dimensoes categoricas ao mesmo tempo (ex: "genero por cargo", "distribuicao cruzada de X por Y"), use "series_by": {"field": "..."} junto com o group_by normal (group_by = dimensao principal/eixo, series_by = segunda dimensao, vira barras empilhadas). Use chart_type "bar" ou "bar_horizontal" nesse caso. Isso permite representar qualquer combinacao de 2 dimensoes — nunca diga que "so suporta uma dimensao".

chart_type possiveis: ${JSON.stringify(CHART_TYPES)}
agg possiveis: ${JSON.stringify(AGG_TYPES)}
op de filtro possiveis: ${JSON.stringify(FILTER_OPS)}

Responda SOMENTE com um JSON valido, compacto, exatamente neste formato:
{ "chart": { "id": "chart-novo-1", "title": "...", "subtitle": "...", "chart_type": "bar", "source": "funcionarios", "filters": [], "group_by": {"kind":"category","field":"..."}, "series_by": null, "metric": {"agg":"count","field":null}, "sort": "value_desc", "limit": null } }
Ou, se o pedido nao puder ser atendido com os dados disponiveis no perfil: { "error": "explicacao curta do motivo" }`;

  const prompt = `Perfil da base de dados (JSON):\n${JSON.stringify(profile)}`;

  try {
    return await callWithRetry(
      (attempt) => callClaude(prompt, system, apiKey, model, provider, Math.min(1200 * 2 ** attempt, 4800)),
      (text) => {
        let parsed;
        try {
          parsed = parseJsonLoose(text);
        } catch (e) {
          throw new Error("PARSE_RETRY");
        }
        if (!parsed || (!parsed.chart && !parsed.error)) throw new Error("PARSE_RETRY");
        return parsed;
      },
      { onRetry }
    );
  } catch (e) {
    if (e.message === "PARSE_RETRY" || e.retryable) {
      throw new Error("Não foi possível gerar o gráfico após várias tentativas. Tente reformular o pedido.");
    }
    throw e;
  }
}

/* ============================================================================
   VALIDACAO DO PLANO (defensivo: descarta qualquer coisa que referencie
   campos/tabelas que nao existem, para nunca quebrar a renderizacao)
============================================================================ */
/** Tabelas que tem uma coluna "matricula" e por isso podem ser cruzadas automaticamente
 *  com o cadastro de funcionarios (ex: "CTC por genero" cruza folha + funcionarios). */
/** Nomes curtos por tabela, usados so para prefixar os seletores de filtro quando mais de
 *  uma tabela contribui com opcoes (evita ambiguidade tipo "Filial" de funcionarios vs
 *  "Filial" de vagas apontando pro campo errado). */
const TABLE_SHORT_LABELS = {
  funcionarios: "Equipe", desligamentos: "Desligamentos", folha: "Folha",
  rs: "Vagas", entrevistas: "Entrevistas", movimentacoes: "Movimentações",
};
/** Rotulos conhecidos para os campos canonicos mais comuns — qualquer outro campo
 *  (incluindo campos extras do Caminho B, tipo "extra_status_vaga") cai no fallback
 *  generico abaixo, que so formata a chave (sem o prefixo "extra_") em Title Case. */
const KNOWN_FIELD_LABELS = {
  area: "Área", senioridade: "Senioridade", genero: "Gênero", modelo_trabalho: "Modelo de trabalho",
  filial: "Filial", tipo_contrato: "Tipo de contrato", status: "Status",
  recrutador_responsavel: "Recrutador", origem_vaga: "Origem da vaga", fonte_recrutamento: "Fonte de recrutamento",
  cargo: "Cargo", tipo_recrutamento: "Tipo de recrutamento",
  raca_etnia: "Raça e etnia", centro_custo: "Centro de custo", pcd: "PCD", data_admissao: "Data de admissão",
  data_desligamento: "Data de desligamento", data_nascimento: "Data de nascimento", salario_atual: "Salário atual",
  salario_inicial: "Salário inicial", motivo_detalhado: "Motivo detalhado", tipo_desligamento: "Tipo de desligamento",
};
function humanizeFieldKey(field) {
  if (KNOWN_FIELD_LABELS[field]) return KNOWN_FIELD_LABELS[field];
  if (field.startsWith("extra_faixa_duracao_")) {
    return `Faixa de duração: ${field.slice("extra_faixa_duracao_".length, -"_dias".length).split("_").filter(Boolean).join(" ")}`;
  }
  if (field.startsWith("extra_duracao_") && field.endsWith("_dias")) {
    const nome = field.slice("extra_duracao_".length, -"_dias".length).split("_").filter(Boolean).join(" ");
    return `Duração: ${nome} (dias)`;
  }
  const base = field.startsWith("extra_") ? field.slice(6) : field;
  return base.split("_").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || field;
}
/** Varre TODAS as tabelas do perfil (nao so funcionarios) em busca de campos categoricos
 *  com cardinalidade baixa o suficiente pra virar um dropdown de filtro util (entre 2 e 30
 *  valores distintos — abaixo disso nao filtra nada de util, acima vira uma lista enorme
 *  tipo nome de candidato). Isso e o que permite "rs" (recrutamento) ganhar filtros proprios
 *  como status da vaga, filial, classificacao — sem precisar hardcodar nomes de coluna,
 *  entao funciona pra qualquer base real, incluindo campos extras do Caminho B. */
function collectSegmentFieldOptions(profile) {
  if (!profile) return [];
  const options = [];
  Object.keys(TABLE_LABELS).forEach((table) => {
    const fields = (profile[table] && profile[table].fields) || {};
    Object.keys(fields).forEach((field) => {
      const d = fields[field];
      if (!d || d.type !== "categorical" || d.cardinality < 2 || d.cardinality > 30) return;
      options.push({ table, field, label: `${TABLE_SHORT_LABELS[table] || table}: ${humanizeFieldKey(field)}` });
    });
  });
  return options;
}
/** Converte a lista ja validada de plan.filter_fields ({table,field}) no formato que a
 *  barra de filtro renderiza ({table,field,label}) — reconfere contra o perfil (defensivo:
 *  cobre o caso de um projeto salvo com um perfil antigo/diferente). */
function segmentOptionsFromFilterFields(filterFields, profile) {
  if (!profile) return [];
  return (filterFields || [])
    .filter((f) => profile[f.table] && profile[f.table].fields && profile[f.table].fields[f.field])
    .map((f) => ({ table: f.table, field: f.field, label: `${TABLE_SHORT_LABELS[f.table] || f.table}: ${humanizeFieldKey(f.field)}` }));
}
const MONTH_OPTIONS = [
  { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" }, { value: "03", label: "Março" },
  { value: "04", label: "Abril" }, { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
  { value: "07", label: "Julho" }, { value: "08", label: "Agosto" }, { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" }, { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];
/** Varre todas as tabelas/campos em busca de valores Date validos, para saber quais anos
 *  existem de verdade na base e popular o seletor de Ano — nunca uma lista fixa/chutada. */
function collectAvailableYears(data) {
  if (!data) return [];
  const years = new Set();
  Object.values(data).forEach((rows) => {
    (rows || []).forEach((r) => {
      Object.values(r).forEach((v) => { if (v instanceof Date && !isNaN(v)) years.add(v.getFullYear()); });
    });
  });
  return [...years].sort((a, b) => a - b);
}


function buildDynamicDigest(plan, data, coreSeries, periodFilter) {
  if (!plan) return {};
  const digest = { visao_geral_da_empresa: plan.company_summary || null, paginas: {} };
  plan.pages.forEach((page) => {
    const kpis = {};
    page.kpis.forEach((k) => { kpis[k.label] = computeKpiValue(k, data, periodFilter); });
    const charts = {};
    page.charts.forEach((c) => { charts[c.title] = computeChartData(c, data, coreSeries, periodFilter); });
    digest.paginas[page.label] = { kpis, graficos: charts };
  });
  return digest;
}

/* ============================================================================
   FERRAMENTA DE CONSULTA DO CHAT (para perguntas que cruzam tabelas/filtros que
   nao estavam pre-calculados no plano — ex: "turnover por faixa etaria entre
   quem trabalha remoto no ultimo ano". A IA so pede o QUE calcular; quem calcula
   sempre e este motor deterministico, nunca a IA.

   PRIVACIDADE: o motor nunca revela dado individual de remuneracao. Duas camadas:
   1) proibe agrupar ou filtrar por campos que identificam a pessoa (nome, matricula, cpf);
   2) mesmo agrupando por algo legitimo (ex: cargo), se o grupo resultante tiver poucas
      pessoas — o que na pratica pode isolar 1 individuo, ex: um cargo unico na empresa —
      o valor de campos de remuneracao e OMITIDO em vez de mostrado.
============================================================================ */
const FAIXA_ETARIA_BUCKETS_CHAT = [
  { name: "Até 24", min: 0, max: 24 }, { name: "25-34", min: 25, max: 34 },
  { name: "35-44", min: 35, max: 44 }, { name: "45-54", min: 45, max: 54 },
  { name: "55+", min: 55, max: 999 },
];
function idadeBracket(idade) {
  if (idade === null || idade === undefined) return "Não informado";
  const b = FAIXA_ETARIA_BUCKETS_CHAT.find((b) => idade >= b.min && idade <= b.max);
  return b ? b.name : "Não informado";
}
function resolveGroupKey(f, field) {
  if (field === "idade_bracket") return idadeBracket(f.idade);
  const v = f[field];
  return v === null || v === undefined || v === "" ? "Não informado" : String(v);
}
function validateChatQuery(q, profile) {
  if (!q) return null;
  const source = q.source === "rs" ? "rs" : "funcionarios";

  // Listagem de registros individuais (nao agregada): so permitida para "rs" (vagas),
  // nunca para tabelas ligadas a pessoas (funcionarios, folha, desligamentos, etc.).
  // Sempre limitada a poucas linhas, e sempre sem o campo que liga a vaga a quem foi
  // contratado — nunca vira um jeito de extrair a base pessoa a pessoa via chat.
  if (q.analysis === "list") {
    if (source !== "rs") return null;
    const filters = (q.filters || [])
      .filter((f) => f && f.field && FILTER_OPS.includes(f.op) && fieldExists(profile, source, f.field))
      .filter((f) => !IDENTIFYING_FIELDS.includes(f.field) && f.field !== "matricula_contratado");
    const limit = Math.min(Math.max(1, Math.round(Number(q.limit)) || 20), 20);
    return { source, analysis: "list", filters, limit };
  }

  if (!q.group_by || !q.group_by.field) return null;
  if (IDENTIFYING_FIELDS.includes(q.group_by.field)) return null; // nunca agrupar por pessoa
  const allowedFields = Object.keys((profile[source] && profile[source].fields) || {}).concat(source === "funcionarios" ? ["idade_bracket"] : []);
  if (!allowedFields.includes(q.group_by.field)) return null;
  const filters = (q.filters || [])
    .filter((f) => f && f.field && FILTER_OPS.includes(f.op) && fieldExists(profile, source, f.field))
    .filter((f) => !IDENTIFYING_FIELDS.includes(f.field)); // nunca filtrar isolando uma pessoa por nome/matricula/cpf
  // turnover_rate so faz sentido para a populacao de funcionarios (cruza com desligamentos)
  const analysis = source === "funcionarios" && q.analysis === "turnover_rate" ? "turnover_rate" : "distribution";
  const months_window = typeof q.months_window === "number" && q.months_window > 0 ? Math.min(Math.round(q.months_window), 240) : null;
  const metric = q.metric && AGG_TYPES.includes(q.metric.agg)
    ? { agg: q.metric.agg, field: q.metric.agg !== "count" && q.metric.field && fieldExists(profile, source, q.metric.field) ? q.metric.field : null }
    : { agg: "count", field: null };
  return { source, analysis, group_by: { field: q.group_by.field }, filters, months_window, metric };
}
const RS_LIST_SAFE_FIELDS = ["id_vaga", "cargo", "area", "status", "data_abertura", "data_fechamento", "recrutador_responsavel", "origem_vaga", "fonte_recrutamento", "tempo_contratacao_dias"];
function computeChatQuery(spec, data) {
  if (spec.analysis === "list") {
    const rows = applyFilters(data.rs || [], spec.filters);
    return rows.slice(0, spec.limit).map((r) => {
      const out = {};
      RS_LIST_SAFE_FIELDS.forEach((f) => { if (r[f] !== undefined && r[f] !== null) out[f] = r[f]; });
      return out;
    });
  }
  if (spec.source === "rs") {
    const rows = applyFilters(data.rs || [], spec.filters);
    const groups = {};
    rows.forEach((r) => { const k = resolveGroupKey(r, spec.group_by.field); (groups[k] = groups[k] || []).push(r); });
    return Object.entries(groups)
      .map(([k, rowsInGroup]) => ({ grupo: k, valor: computeAgg(rowsInGroup, spec.metric), vagas_no_grupo: rowsInGroup.length }))
      .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  }

  const funcionarios = data.funcionarios || [];
  const desligamentos = data.desligamentos || [];
  const pop = applyFilters(funcionarios, spec.filters);

  if (spec.analysis === "turnover_rate") {
    const cutoff = spec.months_window ? (() => { const d = new Date(); d.setMonth(d.getMonth() - spec.months_window); return d; })() : null;
    const funcById = new Map(funcionarios.map((f) => [f.matricula, f]));
    let eventRows = desligamentos.filter((d) => !cutoff || (d.data_desligamento && d.data_desligamento >= cutoff));
    eventRows = eventRows.map((d) => funcById.get(d.matricula)).filter(Boolean);
    eventRows = applyFilters(eventRows, spec.filters);

    const popGroups = {}, evGroups = {};
    pop.forEach((f) => { const k = resolveGroupKey(f, spec.group_by.field); popGroups[k] = (popGroups[k] || 0) + 1; });
    eventRows.forEach((f) => { const k = resolveGroupKey(f, spec.group_by.field); evGroups[k] = (evGroups[k] || 0) + 1; });
    const keys = new Set([...Object.keys(popGroups), ...Object.keys(evGroups)]);
    return [...keys].map((k) => ({
      grupo: k, populacao_considerada: popGroups[k] || 0, desligamentos_no_periodo: evGroups[k] || 0,
      taxa_turnover_pct: popGroups[k] ? +(((evGroups[k] || 0) / popGroups[k]) * 100).toFixed(1) : null,
    })).sort((a, b) => (b.taxa_turnover_pct || 0) - (a.taxa_turnover_pct || 0));
  }

  const sensitive = isSensitiveMetric(spec.metric);
  const groups = {};
  pop.forEach((f) => { const k = resolveGroupKey(f, spec.group_by.field); (groups[k] = groups[k] || []).push(f); });
  return Object.entries(groups)
    .map(([k, rows]) => {
      if (sensitive && rows.length < MIN_GROUP_SIZE_FOR_SENSITIVE) {
        return { grupo: k, valor: null, pessoas_no_grupo: rows.length, motivo_omissao: `Grupo com menos de ${MIN_GROUP_SIZE_FOR_SENSITIVE} pessoas, valor omitido para preservar privacidade individual.` };
      }
      return { grupo: k, valor: computeAgg(rows, spec.metric), pessoas_no_grupo: rows.length };
    })
    .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
}

/** Erros marcados como "retryable" sao aqueles que vale tentar de novo (rede, 5xx, 429,
 *  JSON malformado). Erros de autenticacao/permissao (401/403) nunca sao — repetir nao ajuda. */
function retryableError(message) {
  const e = new Error(message);
  e.retryable = true;
  return e;
}

async function callAnthropic(userText, systemText, apiKey, model, maxTokens = 1000) {
  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-5",
        max_tokens: maxTokens,
        system: systemText,
        messages: [{ role: "user", content: userText }],
      }),
    });
  } catch (e) {
    throw retryableError("Falha de rede ao chamar a Anthropic. Verifique sua conexão.");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 401) throw new Error("Chave de API da Anthropic inválida ou sem permissão. Confira nas configurações.");
    if (response.status === 429 || response.status >= 500) throw retryableError(`A Anthropic esta temporariamente indisponivel (status ${response.status}).`);
    throw new Error(`Falha na chamada da IA (status ${response.status}). ${body.slice(0, 150)}`);
  }
  const data = await response.json();
  const text = (data.content || []).map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("\n");
  if (data.stop_reason === "max_tokens") {
    // retryableError (nao um Error comum) e essencial aqui: e o que faz o callWithRetry
    // repetir a chamada com um limite de tokens maior (ver comentario em callWithRetry).
    // Sem isso, a resposta cortada vira erro final na primeira tentativa e o mecanismo de
    // "tentar de novo com mais espaco" nunca chega a rodar.
    throw retryableError("A resposta da IA foi cortada por exceder o limite de tokens. Tente novamente (ajustamos o limite) ou use um modelo diferente.");
  }
  return text || "Não foi possível gerar uma resposta.";
}

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

async function callGeminiOnce(userText, systemText, apiKey, model, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || DEFAULT_GEMINI_MODEL}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  };
  if (systemText) body.system_instruction = { parts: [{ text: systemText }] };
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw retryableError("Falha de rede ao chamar o Gemini. Verifique sua conexão.");
  }
  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    if (response.status === 400 || response.status === 403) throw new Error("Chave de API do Gemini inválida ou sem permissão. Confira nas configurações.");
    if (response.status === 429 || response.status >= 500) throw retryableError(`O Gemini esta temporariamente indisponivel (status ${response.status}).`);
    if (response.status === 404) {
      const e = new Error(`Modelo "${model}" nao encontrado ou desativado (status 404). ${errBody.slice(0, 150)}`);
      e.modelNotFound = true;
      throw e;
    }
    throw new Error(`Falha na chamada da IA (status ${response.status}). ${errBody.slice(0, 150)}`);
  }
  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const text = (candidate?.content?.parts || []).map((p) => p.text || "").filter(Boolean).join("\n");
  if (candidate?.finishReason === "MAX_TOKENS") {
    // Mesmo motivo do callAnthropic: precisa ser retryableError, senao o callWithRetry
    // nunca chega a repetir a chamada com um maxOutputTokens maior, e qualquer base cuja
    // resposta nao coube no limite da 1a tentativa falha na hora, sempre.
    throw retryableError("A resposta da IA foi cortada por exceder o limite de tokens. Tente novamente (ajustamos o limite) ou use um modelo diferente.");
  }
  return text || "Não foi possível gerar uma resposta.";
}

async function callGemini(userText, systemText, apiKey, model, maxTokens = 1000) {
  try {
    return await callGeminiOnce(userText, systemText, apiKey, model, maxTokens);
  } catch (e) {
    // Modelos do Gemini sao descontinuados com alguma frequencia. Se o modelo configurado
    // (possivelmente salvo ha tempo no navegador) nao existir mais, tenta uma vez com o
    // modelo recomendado atual antes de desistir — assim uma preferencia antiga salva nao
    // trava o uso do painel.
    if (e.modelNotFound && model !== DEFAULT_GEMINI_MODEL) {
      try {
        const text = await callGeminiOnce(userText, systemText, apiKey, DEFAULT_GEMINI_MODEL, maxTokens);
        return text;
      } catch (e2) {
        throw new Error(`O modelo "${model}" não está mais disponível, e a tentativa automática com "${DEFAULT_GEMINI_MODEL}" também falhou. Abra "Configurar IA" e escolha um modelo da lista atual.`);
      }
    }
    if (e.modelNotFound) {
      throw new Error(`O modelo "${model}" não está mais disponível. Abra "Configurar IA" e escolha outro modelo da lista.`);
    }
    throw e;
  }
}

async function callClaude(userText, systemText, apiKey, model, provider, maxTokens = 1000) {
  if (!apiKey) throw new Error("NO_API_KEY");
  return provider === "gemini" ? callGemini(userText, systemText, apiKey, model, maxTokens) : callAnthropic(userText, systemText, apiKey, model, maxTokens);
}

/** Chama `fn` (uma chamada de IA) com retry automatico: repete em erros marcados como
 *  retryable (rede/5xx/429) e tambem quando `parseAndValidate` falhar (ex: JSON malformado
 *  da IA) — esse segundo caso e o mais comum na pratica. Espera crescente entre tentativas. */
async function callWithRetry(fn, parseAndValidate, { retries = 2, baseDelayMs = 900, onRetry } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // "attempt" (0, 1, 2...) e repassado para `fn` para que o limite de tokens possa
      // crescer a cada nova tentativa — uma resposta cortada no meio (JSON truncado) e a
      // causa mais comum de "PARSE_RETRY" na pratica, e repetir com o MESMO limite fixo
      // garante o mesmo corte de novo. Chamadas que nao usam o parametro (fn de 0 argumentos)
      // continuam funcionando normalmente, o argumento extra e so ignorado.
      const raw = await fn(attempt);
      return parseAndValidate ? parseAndValidate(raw) : raw;
    } catch (e) {
      lastErr = e;
      const isLastAttempt = attempt === retries;
      const shouldRetry = e.retryable || e.message === "PARSE_RETRY";
      if (isLastAttempt || !shouldRetry) throw e;
      if (onRetry) onRetry(attempt + 1, retries);
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

/* ============================================================================
   GESTAO DA CHAVE DE API (armazenada apenas no localStorage do seu navegador)
============================================================================ */
const LS_PROVIDER = "nexatech_rh_provider";
const LS_KEY_ANTHROPIC = "nexatech_rh_anthropic_api_key";
const LS_KEY_GEMINI = "nexatech_rh_gemini_api_key";
const LS_MODEL_ANTHROPIC = "nexatech_rh_anthropic_model";
const LS_MODEL_GEMINI = "nexatech_rh_gemini_model";

const MODEL_OPTIONS = {
  anthropic: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5 (recomendado)" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (mais rapido/barato)" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8 (mais poderoso/caro)" },
  ],
  gemini: [
    { id: DEFAULT_GEMINI_MODEL, label: "Gemini 3.6 Flash (recomendado)" },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (mais rapido/barato)" },
  ],
};

function useApiKey() {
  const readLS = (k, fallback) => { try { return localStorage.getItem(k) || fallback; } catch { return fallback; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const [provider, setProviderState] = useState(() => readLS(LS_PROVIDER, "gemini"));
  const [anthropicKey, setAnthropicKeyState] = useState(() => readLS(LS_KEY_ANTHROPIC, ""));
  const [geminiKey, setGeminiKeyState] = useState(() => readLS(LS_KEY_GEMINI, ""));
  const [anthropicModel, setAnthropicModelState] = useState(() => readLS(LS_MODEL_ANTHROPIC, "claude-sonnet-5"));
  const [geminiModel, setGeminiModelState] = useState(() => readLS(LS_MODEL_GEMINI, DEFAULT_GEMINI_MODEL));

  const setProvider = (v) => { setProviderState(v); writeLS(LS_PROVIDER, v); };
  const setAnthropicKey = (v) => { setAnthropicKeyState(v); writeLS(LS_KEY_ANTHROPIC, v); };
  const setGeminiKey = (v) => { setGeminiKeyState(v); writeLS(LS_KEY_GEMINI, v); };
  const setAnthropicModel = (v) => { setAnthropicModelState(v); writeLS(LS_MODEL_ANTHROPIC, v); };
  const setGeminiModel = (v) => { setGeminiModelState(v); writeLS(LS_MODEL_GEMINI, v); };

  const apiKey = provider === "gemini" ? geminiKey : anthropicKey;
  const model = provider === "gemini" ? geminiModel : anthropicModel;

  return {
    provider, setProvider, apiKey, model,
    anthropicKey, setAnthropicKey, geminiKey, setGeminiKey,
    anthropicModel, setAnthropicModel, geminiModel, setGeminiModel,
  };
}

/* ============================================================================
   PREFERENCIA DE TEMA (paleta + claro/escuro), persistida no navegador
============================================================================ */
const LS_PALETTE = "nexatech_rh_palette";
const LS_DARKMODE = "nexatech_rh_darkmode";
const LS_STYLE = "nexatech_rh_style";
function useThemePrefs() {
  const readLS = (k, fallback) => { try { return localStorage.getItem(k) || fallback; } catch { return fallback; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const [paletteId, setPaletteIdState] = useState(() => readLS(LS_PALETTE, DEFAULT_PALETTE));
  const [darkMode, setDarkModeState] = useState(() => readLS(LS_DARKMODE, "false") === "true");
  const [styleId, setStyleIdState] = useState(() => readLS(LS_STYLE, DEFAULT_STYLE));
  const setPaletteId = (v) => { setPaletteIdState(v); writeLS(LS_PALETTE, v); };
  const setDarkMode = (v) => { setDarkModeState(v); writeLS(LS_DARKMODE, v ? "true" : "false"); };
  const setStyleId = (v) => { setStyleIdState(v); writeLS(LS_STYLE, v); };
  return { paletteId, setPaletteId, darkMode, setDarkMode, styleId, setStyleId };
}

/* ============================================================================
   PERSISTENCIA DE PROJETOS (IndexedDB) — salva a base processada + o dashboard
   gerado, para reabrir depois sem precisar subir o arquivo e chamar a IA de novo.
   IndexedDB (nao localStorage) porque suporta objetos grandes e Date nativamente.
============================================================================ */
const PROJECTS_DB_NAME = "nexatech_rh_projects_db";
const PROJECTS_DB_VERSION = 1;
const PROJECTS_STORE = "projects";

function openProjectsDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("IndexedDB indisponivel neste navegador.")); return; }
    const req = indexedDB.open(PROJECTS_DB_NAME, PROJECTS_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveProjectToDB(project) {
  const db = await openProjectsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readwrite");
    tx.objectStore(PROJECTS_STORE).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function listProjectsFromDB() {
  const db = await openProjectsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readonly");
    const req = tx.objectStore(PROJECTS_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.updatedAt - a.updatedAt));
    req.onerror = () => reject(req.error);
  });
}
async function deleteProjectFromDB(id) {
  const db = await openProjectsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readwrite");
    tx.objectStore(PROJECTS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ============================================================================
   TELA DE PERSONALIZACAO (depois de confirmar o mapeamento, antes de planejar):
   a pessoa descreve o que espera ver no dashboard e escolhe visual (paleta + modo)
============================================================================ */
function CustomizationScreen({ paletteId, setPaletteId, darkMode, setDarkMode, styleId, setStyleId, requirements, setRequirements, onGenerate, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: T.paper, display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, width: "100%" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", color: T.forest, textTransform: "uppercase", marginBottom: 10 }}>
          Último passo antes do dashboard
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: T.ink, margin: "0 0 8px" }}>
          Alguma preferência?
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: T.slate, lineHeight: 1.55, margin: "0 0 24px" }}>
          Isso é opcional. Se quiser, descreva algo que você espera ver no dashboard, e a IA leva isso em
          conta junto com o que a base sustenta. Escolha também o visual antes de gerar.
        </p>

        <div style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 8 }}>O que você espera ver? (opcional)</div>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder='Ex: "quero uma página só para entrevista de desligamento, detalhando as perguntas e os pilares de NPS" ou "dê mais destaque para diversidade"'
            rows={4}
            style={{
              width: "100%", border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px",
              fontFamily: "var(--font-body)", fontSize: 13, color: T.ink, background: T.paperRaised,
              outline: "none", resize: "vertical", lineHeight: 1.5,
            }}
          />
        </div>

        <div style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 10 }}>Paleta de cores</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
            {Object.entries(PALETTES).map(([id, p]) => {
              const active = paletteId === id;
              return (
                <button
                  key={id}
                  onClick={() => setPaletteId(id)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 8px",
                    borderRadius: 10, border: `2px solid ${active ? p.forest : T.line}`, background: T.paperRaised, cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", gap: 4 }}>
                    {[p.forest, p.amber, p.brick, p.chart[2]].map((c, i) => (
                      <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: c }} />
                    ))}
                  </div>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? p.forest : T.slate }}>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 10 }}>Estilo</div>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(STYLES).map(([id, s]) => {
              const active = styleId === id;
              return (
                <button
                  key={id}
                  onClick={() => setStyleId(id)}
                  style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 8px",
                    border: `2px solid ${active ? T.forest : T.line}`, borderRadius: 10, background: T.paperRaised, cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 24, height: 24, background: T.forest, borderRadius: `${s.radiusSm}px`, boxShadow: s.shadow }} />
                    <span style={{ fontFamily: s.fontDisplay, fontSize: 17, fontWeight: 600, color: T.ink }}>Aa</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? T.forest : T.slate }}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 34 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 10 }}>Modo</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: false, label: "Claro" }, { id: true, label: "Escuro" }].map((m) => (
              <button
                key={String(m.id)}
                onClick={() => setDarkMode(m.id)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600,
                  border: `1px solid ${darkMode === m.id ? T.forest : T.line}`,
                  background: darkMode === m.id ? T.forest : T.paperRaised, color: darkMode === m.id ? "#fff" : T.slate, cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onGenerate}
            style={{ flex: 1, background: T.forest, color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Gerar dashboard
          </button>
          <button
            onClick={onBack}
            style={{ background: "transparent", color: T.slate, border: `1px solid ${T.line}`, borderRadius: 8, padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, cursor: "pointer" }}
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ provider, setProvider, anthropicKey, setAnthropicKey, geminiKey, setGeminiKey, anthropicModel, setAnthropicModel, geminiModel, setGeminiModel, apiKey }) {
  const [open, setOpen] = useState(false);
  const [draftProvider, setDraftProvider] = useState(provider);
  const [draftKey, setDraftKey] = useState(provider === "gemini" ? geminiKey : anthropicKey);
  const [draftModel, setDraftModel] = useState(provider === "gemini" ? geminiModel : anthropicModel);
  const [saved, setSaved] = useState(false);

  const openPanel = () => {
    setDraftProvider(provider);
    setDraftKey(provider === "gemini" ? geminiKey : anthropicKey);
    setDraftModel(provider === "gemini" ? geminiModel : anthropicModel);
    setSaved(false);
    setOpen((o) => !o);
  };

  const switchDraftProvider = (p) => {
    setDraftProvider(p);
    setDraftKey(p === "gemini" ? geminiKey : anthropicKey);
    setDraftModel(p === "gemini" ? geminiModel : anthropicModel);
  };

  const save = () => {
    setProvider(draftProvider);
    if (draftProvider === "gemini") { setGeminiKey(draftKey.trim()); setGeminiModel(draftModel); }
    else { setAnthropicKey(draftKey.trim()); setAnthropicModel(draftModel); }
    setSaved(true);
    setTimeout(() => setOpen(false), 700);
  };

  const ToggleBtn = ({ id, label }) => (
    <button
      onClick={() => switchDraftProvider(id)}
      style={{
        flex: 1, padding: "7px 0", borderRadius: 7, fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600,
        border: `1px solid ${draftProvider === id ? T.forest : T.line}`,
        background: draftProvider === id ? T.forest : "#fff", color: draftProvider === id ? "#fff" : T.slate, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={openPanel}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: apiKey ? "transparent" : T.amber,
          border: `1px solid ${apiKey ? "#3A4A68" : T.amber}`, color: apiKey ? "#B9C2D6" : "#fff",
          borderRadius: 7, padding: "6px 12px", fontSize: 11.5, fontFamily: "var(--font-body)", cursor: "pointer",
        }}
      >
        <KeyRound size={13} /> {apiKey ? `IA: ${provider === "gemini" ? "Gemini" : "Claude"} configurado` : "Configurar IA"}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360, background: T.paperRaised,
          border: `1px solid ${T.line}`, borderRadius: 10, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", zIndex: 50,
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Provedor de IA</div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: T.slate, lineHeight: 1.5, margin: "0 0 10px" }}>
            Necessário para o chat e as análises de IA. A chave fica salva apenas no localStorage do seu navegador.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <ToggleBtn id="gemini" label="Google Gemini (gratuito)" />
            <ToggleBtn id="anthropic" label="Anthropic Claude" />
          </div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: T.slateLight, lineHeight: 1.5, margin: "0 0 8px" }}>
            {draftProvider === "gemini" ? (
              <>Gere uma chave gratuita em{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: T.forest }}>aistudio.google.com/apikey</a>.</>
            ) : (
              <>Gere uma chave em{" "}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: T.forest }}>console.anthropic.com</a> (tem custo por uso).</>
            )}
          </p>
          <input
            type="password"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder={draftProvider === "gemini" ? "AIzaSy..." : "sk-ant-api03-..."}
            style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 7, padding: "8px 10px", fontFamily: "var(--font-mono)", fontSize: 12, marginBottom: 10, outline: "none", background: T.paperRaised, color: T.ink }}
          />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, fontWeight: 600, color: T.ink, marginBottom: 5 }}>Modelo</div>
            <select
              value={draftModel}
              onChange={(e) => setDraftModel(e.target.value)}
              style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 7, padding: "7px 9px", fontFamily: "var(--font-body)", fontSize: 12, outline: "none", background: T.paperRaised, color: T.ink }}
            >
              {MODEL_OPTIONS[draftProvider].map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={save}
              style={{ flex: 1, background: T.forest, color: "#fff", border: "none", borderRadius: 7, padding: "8px 0", fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              {saved ? "Salvo!" : "Salvar"}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "transparent", color: T.slate, border: `1px solid ${T.line}`, borderRadius: 7, padding: "8px 14px", fontFamily: "var(--font-body)", fontSize: 12.5, cursor: "pointer" }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   UI: PRIMITIVOS
============================================================================ */
function IconBadge({ children, tone = "forest" }) {
  const bg = tone === "forest" ? T.forest : tone === "amber" ? T.amber : tone === "brick" ? T.brick : T.slate;
  return (
    <div style={{ width: 34, height: 34, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
      {children}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, tone }) {
  const valueStr = String(value ?? "");
  const fontSize = valueStr.length > 16 ? 14 : valueStr.length > 12 ? 16 : valueStr.length > 9 ? 18 : 22;
  return (
    <div style={{ background: T.paperRaised, border: `var(--border-w) solid ${T.line}`, borderRadius: "var(--r-sm)", boxShadow: "var(--shadow-card)", padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, breakInside: "avoid", pageBreakInside: "avoid" }}>
      <IconBadge tone={tone}>{icon}</IconBadge>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize, fontWeight: 600, color: T.ink, lineHeight: 1.2, overflowWrap: "anywhere", wordBreak: "break-word" }}>{value}</div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: T.slate, marginTop: 3 }}>{label}</div>
        {sub ? <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: T.slateLight, marginTop: 1 }}>{sub}</div> : null}
      </div>
    </div>
  );
}

function AiInsightPanel({ chartId, insights, trigger }) {
  const state = insights[chartId] || {};
  return (
    <div style={{ marginTop: 14, borderTop: `1px dashed ${T.line}`, paddingTop: 12 }}>
      {!state.text && !state.loading && (
        <button
          onClick={trigger}
          className="no-print"
          style={{
            display: "flex", alignItems: "center", gap: 7, background: "transparent", border: `1px solid ${T.forest}`,
            color: T.forest, borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontFamily: "var(--font-body)",
            fontWeight: 600, cursor: "pointer",
          }}
        >
          <Sparkles size={14} /> Analisar este grafico com IA
        </button>
      )}
      {state.loading && (
        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, color: T.slate, fontSize: 12.5, fontFamily: "var(--font-body)" }}>
          <Loader2 size={14} className="spin" /> Gerando analise...
        </div>
      )}
      {state.error && (
        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 7, color: T.brick, fontSize: 12.5, fontFamily: "var(--font-body)" }}>
          <AlertCircle size={14} /> {state.error}
          <button onClick={trigger} style={{ marginLeft: 6, textDecoration: "underline", background: "none", border: "none", color: T.brick, cursor: "pointer", fontSize: 12.5 }}>tentar de novo</button>
        </div>
      )}
      {state.text && !state.loading && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Sparkles size={14} style={{ color: T.amber, marginTop: 2, flexShrink: 0 }} />
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.55, color: T.ink, margin: 0 }}>{state.text}</p>
        </div>
      )}
    </div>
  );
}

function ChartCard({ id, title, subtitle, children, insights, onGenerate, tall, insightData, insightLabel, onRemove }) {
  const trigger = () => onGenerate(id, insightData !== undefined ? insightData : null, insightLabel || subtitle || title, title);
  return (
    <div style={{ background: T.paperRaised, border: `var(--border-w) solid ${T.line}`, borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "18px 20px", display: "flex", flexDirection: "column", position: "relative", breakInside: "avoid", pageBreakInside: "avoid" }}>
      {onRemove && (
        <button
          onClick={onRemove}
          className="no-print"
          title="Remover grafico"
          style={{
            position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: "50%",
            background: "color-mix(in srgb, var(--c-brick) 12%, var(--c-paper))", border: `1px solid ${T.brick}`,
            color: T.brick, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
          }}
        >
          <X size={12} />
        </button>
      )}
      <div style={{ marginBottom: 10, paddingRight: onRemove ? 26 : 0 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16.5, fontWeight: 600, color: T.ink, margin: 0 }}>{title}</h3>
        {subtitle ? <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: T.slate, margin: "3px 0 0" }}>{subtitle}</p> : null}
      </div>
      <div style={{ height: tall ? 300 : 240 }}>{children}</div>
      <AiInsightPanel chartId={id} insights={insights} trigger={trigger} />
    </div>
  );
}

function SectionTitle({ eyebrow, title, id }) {
  return (
    <div id={id} style={{ marginBottom: 18, marginTop: 6 }}>
      {eyebrow && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: T.forest, textTransform: "uppercase", marginBottom: 4 }}>{eyebrow}</div>
      )}
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: T.ink, margin: 0 }}>{title}</h2>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: T.navyPanel, color: "#fff", padding: "8px 12px", borderRadius: 7, fontFamily: "var(--font-body)", fontSize: 12.5 }}>
      <div style={{ opacity: 0.7, marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <span>{p.name}:</span>
          <strong>{formatter ? formatter(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

/* ============================================================================
   TELA DE UPLOAD
============================================================================ */
/* ============================================================================
   TUTORIAL/ONBOARDING (primeira visita)
============================================================================ */
const LS_ONBOARDED = "nexatech_rh_onboarded";
const ONBOARDING_STEPS = [
  { title: "Bem-vindo(a)", text: "Este painel lê qualquer planilha de RH, entende sua estrutura com IA e monta um dashboard sob medida, sem template fixo. Vamos ver como funciona em cinco passos rápidos." },
  { title: "1. Configure a IA", text: "Antes de tudo, clique em \"Configurar IA\" no canto superior direito e cole uma chave (o Gemini é gratuito). Sem isso, o painel não consegue ler sua planilha nem montar o dashboard." },
  { title: "2. Suba sua base", text: "Envie um ou mais arquivos .xlsx, .xls ou .csv. Pode ser uma só aba com tudo, vários arquivos separados por área, ou abas divididas por ano. O sistema tenta juntar tudo sozinho." },
  { title: "3. Confira e personalize", text: "Depois do upload, você revisa o que a IA entendeu de cada aba e pode escrever o que espera ver no dashboard, além de escolher a paleta de cores e o modo claro ou escuro." },
  { title: "4. Explore e ajuste", text: "O menu do topo mostra só as páginas que fazem sentido pra sua base. Use os filtros para segmentar por área e período, pergunte no chat, e edite o dashboard depois de pronto, adicionando ou removendo gráficos." },
];
/* ============================================================================
   DIALOGO DE CONFIRMACAO (generico, reutilizavel para acoes destrutivas)
============================================================================ */
function ConfirmDialog({ title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", onConfirm, onCancel, danger = true }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,12,18,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 20 }}>
      <div style={{ maxWidth: 420, width: "100%", background: T.paperRaised, borderRadius: "var(--r-card)", padding: "26px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: T.ink, margin: "0 0 10px" }}>{title}</h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: T.slate, lineHeight: 1.55, margin: "0 0 22px" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ background: "transparent", border: `1px solid ${T.line}`, color: T.slate, borderRadius: 7, padding: "8px 16px", fontFamily: "var(--font-body)", fontSize: 13, cursor: "pointer" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{ background: danger ? T.brick : T.forest, color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0);
  const last = step === ONBOARDING_STEPS.length - 1;
  const s = ONBOARDING_STEPS[step];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,12,18,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ maxWidth: 460, width: "100%", background: T.paperRaised, borderRadius: 14, padding: "28px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", gap: 5, marginBottom: 18 }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= step ? T.forest : T.line }} />
          ))}
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 600, color: T.ink, margin: "0 0 10px" }}>{s.title}</h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: T.slate, lineHeight: 1.6, margin: "0 0 24px" }}>{s.text}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.slateLight, fontFamily: "var(--font-body)", fontSize: 12.5, cursor: "pointer" }}>
            Pular tutorial
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} style={{ background: "transparent", border: `1px solid ${T.line}`, color: T.slate, borderRadius: 7, padding: "8px 16px", fontFamily: "var(--font-body)", fontSize: 13, cursor: "pointer" }}>
                Voltar
              </button>
            )}
            <button
              onClick={() => (last ? onClose() : setStep((s) => s + 1))}
              style={{ background: T.forest, color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {last ? "Começar" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadScreen({ onFiles, loading, loadingStage, error, log, apiKey, requireApiKey, savedProjects, onOpenProject, onDeleteProject }) {
  const inputRef = useRef(null);
  const [queued, setQueued] = useState([]); // File[] esperando confirmacao
  const [dragOver, setDragOver] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem(LS_ONBOARDED) !== "true"; } catch { return true; }
  });
  const closeOnboarding = () => {
    setShowOnboarding(false);
    try { localStorage.setItem(LS_ONBOARDED, "true"); } catch {}
  };
  const loadingLabel = loadingStage.startsWith("detectando-retry-")
    ? `IA identificando a estrutura... (nova tentativa ${loadingStage.split("-").pop()}/2)`
    : loadingStage === "detectando" ? "IA identificando a estrutura da planilha..." : "Lendo o(s) arquivo(s)...";
  const blocked = requireApiKey && !apiKey;

  const addFiles = (fileList) => {
    if (blocked) return;
    const arr = Array.from(fileList || []).filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (!arr.length) return;
    setQueued((cur) => [...cur, ...arr]);
  };
  const removeQueued = (idx) => setQueued((cur) => cur.filter((_, i) => i !== idx));
  const processQueued = () => { if (queued.length && !blocked) onFiles(queued); };

  return (
    <div style={{ minHeight: "100vh", background: T.paper, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}
      {!showOnboarding && (
        <button
          onClick={() => setShowOnboarding(true)}
          style={{ position: "fixed", top: 16, left: 16, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.line}`, color: T.slate, borderRadius: 7, padding: "6px 12px", fontSize: 11.5, fontFamily: "var(--font-body)", cursor: "pointer", zIndex: 40 }}
        >
          <HelpCircle size={13} /> Como funciona
        </button>
      )}
      <div style={{ maxWidth: 580, width: "100%", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", color: T.forest, textTransform: "uppercase", marginBottom: 10 }}>
          Painel de pessoas
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 600, color: T.ink, margin: "0 0 10px" }}>
          Suba sua base de RH
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14.5, color: T.slate, lineHeight: 1.6, margin: "0 0 14px" }}>
          Envie uma ou mais planilhas (.xlsx, .xls ou .csv) com dados de RH, como cadastro de funcionários,
          desligamentos, folha, recrutamento e pesquisas de saída, o que você tiver. Se os dados estiverem
          espalhados em arquivos diferentes ou divididos por ano, pode selecionar todos de uma vez.
          A IA analisa o que existe na sua base e monta as páginas e os gráficos sob medida, e não um
          conjunto fixo de telas.
        </p>
        {requireApiKey && !apiKey ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: T.brick, lineHeight: 1.5, margin: "0 0 26px", background: "color-mix(in srgb, var(--c-brick) 14%, var(--c-paper))", border: `1px solid ${T.brick}`, borderRadius: 8, padding: "8px 12px" }}>
            Esta versão exige uma chave de IA configurada (botão "Configurar IA" no topo) antes de subir uma base,
            já que ela é usada tanto para entender a estrutura da planilha quanto para planejar o dashboard.
          </p>
        ) : (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: T.forest, lineHeight: 1.5, margin: "0 0 26px", background: "color-mix(in srgb, var(--c-forest) 14%, var(--c-paper))", border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 12px" }}>
            Ao provedor de IA configurado vão os cabeçalhos e 4 linhas de amostra de cada aba, para entender a estrutura (CPFs são
            mascarados, mas outros dados da amostra, como nomes, seguem como estão), e resumos da base: campos, tipos, faixas de
            valores e exemplos de campos de categoria, sem nome nem CPF. A base inteira não é enviada.
          </p>
        )}

        {savedProjects && savedProjects.length > 0 && (
          <div style={{ textAlign: "left", marginBottom: 28 }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: T.slate, marginBottom: 8 }}>Projetos salvos</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {savedProjects.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 9, padding: "10px 14px" }}>
                  <button
                    onClick={() => onOpenProject(p)}
                    style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}
                  >
                    <div style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name || "Base sem nome"}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: T.slateLight, marginTop: 2 }}>
                      Atualizado em {new Date(p.updatedAt).toLocaleDateString("pt-BR")} às {new Date(p.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </button>
                  {confirmDeleteId === p.id ? (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { onDeleteProject(p.id); setConfirmDeleteId(null); }} style={{ background: T.brick, color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontFamily: "var(--font-body)", cursor: "pointer" }}>Excluir</button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ background: "transparent", border: `1px solid ${T.line}`, color: T.slate, borderRadius: 6, padding: "5px 10px", fontSize: 11, fontFamily: "var(--font-body)", cursor: "pointer" }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(p.id)} title="Excluir projeto salvo" style={{ flexShrink: 0, background: "transparent", border: "none", color: T.slateLight, cursor: "pointer", padding: 4 }}>
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          onClick={() => !loading && !blocked && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!loading && !blocked) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!loading && !blocked) addFiles(e.dataTransfer.files);
          }}
          style={{
            border: `2px dashed ${loading ? T.slateLight : blocked ? T.line : dragOver ? T.amber : T.forest}`, borderRadius: 14, padding: "40px 24px",
            background: blocked ? "color-mix(in srgb, var(--c-slate) 10%, var(--c-paper))" : dragOver ? "color-mix(in srgb, var(--c-amber) 14%, var(--c-paper))" : T.paperRaised, cursor: loading || blocked ? "default" : "pointer",
            opacity: blocked ? 0.6 : 1, transition: "background 0.15s",
          }}
        >
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <Loader2 size={30} style={{ color: T.forest }} className="spin" />
              <span style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: T.slate }}>{loadingLabel}</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <FileSpreadsheet size={30} style={{ color: blocked ? T.slateLight : T.forest }} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: blocked ? T.slateLight : T.ink }}>
                {blocked ? "Configure a chave de IA primeiro" : "Clique para escolher um ou mais arquivos"}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: T.slateLight }}>ou arraste os arquivos aqui, em .xlsx, .xls ou .csv</span>
            </div>
          )}
        </div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" multiple style={{ display: "none" }} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

        {queued.length > 0 && !loading && (
          <div style={{ marginTop: 16, textAlign: "left" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {queued.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <FileSpreadsheet size={14} style={{ color: T.forest, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  </div>
                  <button onClick={() => removeQueued(i)} style={{ background: "none", border: "none", color: T.slateLight, cursor: "pointer", fontSize: 15, padding: "0 4px", flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
            <button
              onClick={processQueued}
              style={{ width: "100%", background: T.forest, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
            >
              Processar {queued.length === 1 ? "1 arquivo" : `${queued.length} arquivos`}
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "flex-start", textAlign: "left", background: "color-mix(in srgb, var(--c-brick) 14%, var(--c-paper))", border: `1px solid ${T.brick}`, borderRadius: 9, padding: "10px 14px" }}>
            <AlertCircle size={16} style={{ color: T.brick, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: T.brick }}>{error}</span>
          </div>
        )}
        {log && log.length > 0 && (
          <details style={{ marginTop: 18, textAlign: "left" }}>
            <summary style={{ fontFamily: "var(--font-body)", fontSize: 12, color: T.slate, cursor: "pointer" }}>Ver log de tratamento ({log.length} linhas)</summary>
            <div style={{ marginTop: 8, background: T.navyPanel, borderRadius: 8, padding: 12, maxHeight: 180, overflowY: "auto" }}>
              {log.map((l, i) => (
                <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "#C9D3E0", marginBottom: 3 }}>{l}</div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   REVISAO DO MAPEAMENTO DETECTADO PELA IA
============================================================================ */
function MappingReviewScreen({ mapping, onConfirm, onCancel, busy = false }) {
  const recognized = (mapping.sheets || []).filter((s) => s.role && s.role !== "unknown" && ROLE_CANONICAL_FIELDS[s.role]);
  const ignored = (mapping.sheets || []).filter((s) => !s.role || s.role === "unknown" || !ROLE_CANONICAL_FIELDS[s.role]);
  const temAlgumaTabela = recognized.length > 0;
  const temFuncionarios = recognized.some((s) => s.role === "funcionarios");

  return (
    <div style={{ minHeight: "100vh", background: T.paper, display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, width: "100%" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", color: T.forest, textTransform: "uppercase", marginBottom: 10 }}>
          Estrutura detectada pela IA
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: T.ink, margin: "0 0 8px" }}>
          Confira antes de continuar
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: T.slate, lineHeight: 1.55, margin: "0 0 26px" }}>
          A IA identificou o papel de cada aba da sua planilha e mapeou as colunas correspondentes. Confira se faz sentido antes de gerar o painel.
        </p>

        {!temAlgumaTabela && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "color-mix(in srgb, var(--c-brick) 14%, var(--c-paper))", border: `1px solid ${T.brick}`, borderRadius: 9, padding: "12px 14px", marginBottom: 18 }}>
            <AlertCircle size={16} style={{ color: T.brick, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: T.brick }}>
              Nenhuma aba foi reconhecida como um dos tipos de dado de RH suportados. Sem isso, não é possível montar o painel. Cancele e revise o arquivo.
            </span>
          </div>
        )}
        {temAlgumaTabela && !temFuncionarios && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "color-mix(in srgb, var(--c-amber) 16%, var(--c-paper))", border: `1px solid ${T.amber}`, borderRadius: 9, padding: "12px 14px", marginBottom: 18 }}>
            <AlertCircle size={16} style={{ color: T.amber, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: T.amber }}>
              Esta base não tem um cadastro de funcionários, então o painel será montado só com o que existir ({recognized.map((s) => ROLE_LABELS[s.role]).join(", ")}). Indicadores que dependem do quadro de funcionários (headcount, turnover, risco de saída) não estarão disponíveis.
            </span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {recognized.map((s, i) => {
            const total = ROLE_CANONICAL_FIELDS[s.role].length;
            const mapped = Object.values(s.column_map || {}).filter(Boolean).length;
            return (
              <div key={i} style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                    "{s.original_name}" <span style={{ color: T.slateLight, fontWeight: 400 }}>→</span> {ROLE_LABELS[s.role]}
                  </div>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "2px 8px", borderRadius: 12,
                    background: s.confidence === "high" ? "color-mix(in srgb, var(--c-forest) 14%, var(--c-paper))" : s.confidence === "low" ? "color-mix(in srgb, var(--c-brick) 14%, var(--c-paper))" : "color-mix(in srgb, var(--c-amber) 16%, var(--c-paper))",
                    color: s.confidence === "high" ? T.forestDark : s.confidence === "low" ? T.brick : T.amber,
                  }}>
                    confiança {s.confidence || "desconhecida"}
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: T.slate, marginTop: 4 }}>
                  {mapped} de {total} campos reconhecidos
                </div>
              </div>
            );
          })}
        </div>

        {ignored.length > 0 && (
          <details style={{ marginBottom: 24 }}>
            <summary style={{ fontFamily: "var(--font-body)", fontSize: 12, color: T.slateLight, cursor: "pointer" }}>
              {ignored.length} aba(s) não reconhecida(s), que não entrarão no painel
            </summary>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {ignored.map((s, i) => (
                <div key={i} style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: T.slateLight }}>"{s.original_name}"</div>
              ))}
            </div>
          </details>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onConfirm}
            disabled={!temAlgumaTabela || busy}
            style={{
              flex: 1, background: temAlgumaTabela && !busy ? T.forest : T.slateLight, color: "#fff", border: "none", borderRadius: 8,
              padding: "11px 0", fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600,
              cursor: temAlgumaTabela && !busy ? "pointer" : "default",
            }}
          >
            {busy ? "Padronizando os dados..." : "Usar esta base e gerar o painel"}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{ background: "transparent", color: T.slate, border: `1px solid ${T.line}`, borderRadius: 8, padding: "11px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, cursor: "pointer" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   CHAT COM IA
============================================================================ */
function ChatPanel({ getDigest, apiKey, model, provider, profile, rawData }) {
  const [messages, setMessages] = useState(() => {
    const tabelas = availableTableLabels(profile);
    const sobre = tabelas.length ? `Pergunte sobre os dados que você enviou (${tabelas.map((t) => t.toLowerCase()).join(", ")}), inclusive cruzamentos específicos entre eles.` : "Pergunte sobre os dados que você enviou, inclusive cruzamentos específicos.";
    return [{ role: "assistant", text: `Oi! Sou o assistente de dados do Painel de Pessoas. ${sobre} Se precisar, eu mesmo calculo em cima dos dados reais, não só do que já está nos gráficos.` }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("pensando...");
  const [err, setErr] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const funcFields = Object.keys((profile?.funcionarios && profile.funcionarios.fields) || {});
  const rsFields = Object.keys((profile?.rs && profile.rs.fields) || {});

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    if (!apiKey) { setErr("Configure sua chave de API (botão no topo da página) para usar o chat."); return; }
    setInput("");
    setErr(null);
    const newMessages = [...messages, { role: "user", text: q }];
    setMessages(newMessages);
    setLoading(true);
    setLoadingLabel("pensando...");
    try {
      const system = `Voce e um analista de People Analytics respondendo sobre a base de RH de uma empresa. Responda em portugues do Brasil, de forma direta e objetiva (maximo ~130 palavras salvo pedido de mais detalhe), citando numeros concretos do resumo agregado abaixo sempre que possivel. ${WRITING_STYLE_RULE}

Se a pergunta pedir um CRUZAMENTO especifico que nao esta no resumo agregado (ex: taxa de turnover por uma categoria com filtros, como "turnover por faixa etaria entre quem trabalha remoto no ultimo ano"), voce pode pedir uma consulta aos dados reais em vez de dizer que nao tem a informacao. Para isso, responda SOMENTE (sem nenhum texto antes ou depois) com um JSON neste formato exato:
{"need_query": true, "query": {"source": "funcionarios", "analysis": "turnover_rate", "group_by": {"field": "idade_bracket"}, "filters": [{"field": "modelo_trabalho", "op": "eq", "value": "Remoto"}], "months_window": 12, "metric": null}}
Exemplo para uma pergunta sobre vagas, como "quantas vagas abertas por area":
{"need_query": true, "query": {"source": "rs", "analysis": "distribution", "group_by": {"field": "area"}, "filters": [{"field": "status", "op": "eq", "value": "Aberta"}], "months_window": null, "metric": null}}
Exemplo para uma pergunta pedindo para VER as vagas, ou pedindo detalhe por vaga (quem e o recrutador, qual o cargo, qual a origem), como "quais sao as vagas abertas", "me mostra as vagas de engenharia" ou "quantas vagas por area e quem e o recrutador de cada uma":
{"need_query": true, "query": {"source": "rs", "analysis": "list", "filters": [{"field": "status", "op": "eq", "value": "Aberta"}], "limit": 20}}
- "source": opcional, "funcionarios" (padrao) ou "rs" (tabela de recrutamento e selecao, vagas). Use "rs" para perguntas sobre vagas, recrutamento, tempo de contratacao, status de vaga, etc.
- "analysis": "distribution" (padrao, agregado por categoria, SEM detalhe de vaga individual), "turnover_rate" (so funciona com source="funcionarios") ou "list" (lista os proprios registros de vaga, com area/cargo/recrutador responsavel/status de cada uma — so funciona com source="rs", nunca com "funcionarios"). Use "list" sempre que a pergunta pedir para ver as vagas em si, identificar qual vaga e qual, ou informar quem e o recrutador responsavel — "distribution" so serve para contar quantas, nao para identificar detalhe de cada vaga. Numa pergunta composta (ex: "quantas por area E quem e o recrutador"), prefira "list": a partir da lista de vagas voce consegue tanto contar por area quanto informar o recrutador de cada uma, na mesma resposta.
- "group_by.field": obrigatorio quando analysis e "distribution" ou "turnover_rate" (nao se aplica quando analysis="list"). Se source="funcionarios", um destes campos: ${JSON.stringify(funcFields)}, ou "idade_bracket" (faixa etaria). Se source="rs", um destes campos: ${JSON.stringify(rsFields)}.
- "limit": opcional, so para analysis="list" — quantos registros retornar (maximo 20, padrao 20 se omitido).
- "filters": lista de {field, op, value}, op em ["eq","neq","gt","lt","not_null"], aplicados sobre campos da tabela escolhida em "source".
- "months_window": so para analysis="turnover_rate" (que so funciona com source="funcionarios"), quantos meses para tras considerar nos desligamentos (null = todo o historico).
- "metric": so para analysis="distribution" quando quiser somar, tirar a media, mediana, minimo ou maximo de um campo numerico da tabela escolhida, ex {"agg":"avg","field":"salario_atual"} ou {"agg":"avg","field":"tempo_contratacao_dias"} para source="rs"; use null para so contar.
So peca essa consulta quando o resumo abaixo genuinamente nao cobrir a pergunta. Se dado assim mesmo nao existir na base (campo nao listado acima), diga isso ao usuario em vez de pedir a consulta. Esta ferramenta retorna numeros agregados (contagem, soma, media por categoria) na maioria dos casos; a unica excecao e analysis="list" sobre "rs", que retorna os proprios registros de vaga (nunca dados de funcionarios, folha, desligamentos ou qualquer tabela ligada a uma pessoa especifica).

REGRA DE PRIVACIDADE (importante, sem excecoes): nunca revele o nome de um funcionario (ativo ou desligado), nem salario, remuneracao ou cargo de uma pessoa especifica, mesmo que o usuario peca por nome, matricula ou uma descricao que isole 1 pessoa (ex: "quem trabalha em X e ganha mais"). Voce so pode falar de remuneracao em nivel agregado (media/soma por area, senioridade, etc — nunca de 1 individuo). O sistema tambem bloqueia isso automaticamente do lado tecnico (consultas agrupadas por nome/matricula sao rejeitadas, e grupos com poucas pessoas tem o valor de salario omitido), mas mesmo assim, se o usuario perguntar o salario ou cargo de uma pessoa nomeada, responda educadamente que essa informacao e individual e nao pode ser compartilhada, e ofereca uma media agregada da area/cargo dela como alternativa, se fizer sentido. Essa regra NAO se aplica a dados de vaga (recrutamento e selecao): o nome do recrutador responsavel por uma vaga, o cargo da vaga, a area, o status e a origem podem ser informados livremente quando perguntados, pois nao sao dados pessoais de um funcionario ou candidato.

Resumo agregado da base (JSON):\n${JSON.stringify(getDigest())}`;
      const history = newMessages.slice(-8).map((m) => `${m.role === "user" ? "Usuario" : "Assistente"}: ${m.text}`).join("\n");
      const answer1 = await callClaude(`Historico da conversa:\n${history}\n\nResponda a ultima pergunta do usuario.`, system, apiKey, model, provider);

      let finalText = answer1;
      let asksQuery = null;
      try {
        const maybe = parseJsonLoose(answer1);
        if (maybe && maybe.need_query === true && maybe.query) asksQuery = maybe.query;
      } catch { /* resposta normal em texto, segue com answer1 */ }

      if (asksQuery && profile && rawData) {
        const validated = validateChatQuery(asksQuery, profile);
        if (validated) {
          setLoadingLabel("calculando nos dados reais...");
          const result = computeChatQuery(validated, rawData);
          const followSystem = `Voce e um analista de People Analytics. Responda a pergunta original do usuario em portugues do Brasil, de forma direta (maximo ~130 palavras), usando o resultado da consulta abaixo (pode ser um numero agregado por categoria, ou uma lista de registros, dependendo da pergunta). Se for uma lista de vagas, apresente cada uma de forma organizada (ex: cargo, area, status, e o recrutador responsavel, sempre que esse campo estiver presente no resultado — informar o recrutador de uma vaga nao e um dado pessoal restrito, pode ser citado normalmente). Nao use markdown. ${WRITING_STYLE_RULE}`;
          const followPrompt = `Pergunta original do usuario: "${q}"\n\nResultado da consulta que voce pediu (JSON):\n${JSON.stringify(result)}`;
          finalText = await callClaude(followPrompt, followSystem, apiKey, model, provider);
        } else {
          finalText = "Não consegui montar essa consulta com os campos disponíveis nesta base. Algum campo ou filtro que eu tentaria usar não existe nos dados enviados.";
        }
      }

      setMessages((cur) => [...cur, { role: "assistant", text: finalText }]);
    } catch (e) {
      setErr(e.message === "NO_API_KEY" ? "Configure sua chave de API (botão no topo da página) para usar o chat." : (e.message || "Não foi possível falar com a IA agora. Tente novamente em instantes."));
    } finally {
      setLoading(false);
      setLoadingLabel("pensando...");
    }
  };

  return (
    <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 12, display: "flex", flexDirection: "column", height: 560 }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 10 }}>
        <IconBadge tone="forest"><Bot size={17} /></IconBadge>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: T.ink }}>Chat com a base de dados</div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: T.slateLight }}>Pergunte em linguagem natural sobre os indicadores de RH</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              style={{
                maxWidth: "82%", padding: "9px 13px", borderRadius: 12,
                background: m.role === "user" ? T.forest : T.paper,
                color: m.role === "user" ? "#fff" : T.ink,
                fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.5,
                border: m.role === "user" ? "none" : `1px solid ${T.line}`,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: T.slate, fontSize: 12.5, fontFamily: "var(--font-body)" }}>
            <Loader2 size={14} className="spin" /> {loadingLabel}
          </div>
        )}
        {err && <div style={{ color: T.brick, fontSize: 12, fontFamily: "var(--font-body)" }}>{err}</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${T.line}`, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ex: qual área teve mais turnover nos últimos 6 meses?"
          style={{
            flex: 1, border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 12px",
            fontFamily: "var(--font-body)", fontSize: 13, outline: "none", color: T.ink, background: T.paper,
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            width: 38, height: 38, borderRadius: 8, background: T.forest, border: "none", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: loading ? "default" : "pointer",
            opacity: loading || !input.trim() ? 0.55 : 1, flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   SIMULADOR DE CENARIO (what-if)
============================================================================ */
function SliderRow({ label, value, onChange, min, max, step, unit, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600, color: T.ink }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: T.forest, fontWeight: 600 }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: T.forest }} />
      {hint && <div style={{ fontFamily: "var(--font-body)", fontSize: 10.5, color: T.slateLight, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

/* ============================================================================
   PREVISAO DE RISCO DE SAIDA POR PERFIL (heuristica estatistica simples)
============================================================================ */
const RISK_DIMENSIONS = [
  { key: "area", label: "Área" },
  { key: "senioridade", label: "Senioridade" },
  { key: "faixaEtaria", label: "Faixa etária" },
  { key: "tenure", label: "Tempo de empresa" },
  { key: "modelo", label: "Modelo de trabalho" },
  { key: "contrato", label: "Tipo de contrato" },
  { key: "genero", label: "Gênero" },
];
const FAIXA_ETARIA_ORDER = ["Até 24", "25-34", "35-44", "45-54", "55+"];
const TENURE_ORDER = ["0-3 meses", "3-6 meses", "6-12 meses", "1-2 anos", "2+ anos"];

function orderedOptions(dimKey, groupObj) {
  const keys = Object.keys(groupObj || {});
  if (dimKey === "faixaEtaria") return FAIXA_ETARIA_ORDER.filter((k) => keys.includes(k));
  if (dimKey === "tenure") return TENURE_ORDER.filter((k) => keys.includes(k));
  return keys.sort((a, b) => (groupObj[b]?.total || 0) - (groupObj[a]?.total || 0));
}

function computeRisco(riskModel, selections) {
  const base = Math.min(0.95, Math.max(0.01, riskModel.baseRate || 0.05));
  const baseOdds = base / (1 - base);
  let odds = baseOdds;
  const fatores = [];
  RISK_DIMENSIONS.forEach(({ key, label }) => {
    const val = selections[key];
    if (!val) return;
    const entry = riskModel[key]?.[val];
    if (!entry) return;
    const p = Math.min(0.95, Math.max(0.01, entry.rate));
    const lr = (p / (1 - p)) / baseOdds;
    odds *= lr;
    fatores.push({ dim: label, valor: val, taxa: p, amostra: entry.total, acimaDaMedia: p > base });
  });
  const combined = Math.min(0.95, Math.max(0.01, odds / (1 + odds)));
  return { prob: combined, base, fatores };
}

function riskBand(prob, base) {
  if (prob <= base * 0.75) return { label: "Abaixo da media", color: T.forest };
  if (prob <= base * 1.25) return { label: "Na media da empresa", color: T.amber };
  if (prob <= base * 2) return { label: "Acima da media", color: "#C1662E" };
  return { label: "Risco elevado", color: T.brick };
}

function RiskPredictor({ agg, apiKey, model, provider }) {
  const rm = agg.riskModel;
  const dims = useMemo(() => usableRiskDimensions(rm, RISK_DIMENSIONS), [rm]);
  const [sel, setSel] = useState({ area: "", senioridade: "", faixaEtaria: "", tenure: "", modelo: "", contrato: "", genero: "" });
  const [aiState, setAiState] = useState({});

  const resultado = useMemo(() => computeRisco(rm, sel), [rm, sel]);
  const band = riskBand(resultado.prob, resultado.base);
  const algumFatorSelecionado = resultado.fatores.length > 0;

  const updateSel = (key, value) => {
    setSel((s) => ({ ...s, [key]: value }));
    setAiState({});
  };
  const limpar = () => { setSel({ area: "", senioridade: "", faixaEtaria: "", tenure: "", modelo: "", contrato: "", genero: "" }); setAiState({}); };

  const gerarAnalise = async () => {
    if (!apiKey) { setAiState({ error: "Configure sua chave de API (botão no topo da página)." }); return; }
    setAiState({ loading: true });
    try {
      const payload = {
        probabilidade_estimada_pct: +(resultado.prob * 100).toFixed(1),
        media_geral_da_empresa_pct: +(resultado.base * 100).toFixed(1),
        fatores_considerados: resultado.fatores.map((f) => ({ dimensao: f.dim, valor: f.valor, taxa_historica_pct: +(f.taxa * 100).toFixed(1), tamanho_amostra: f.amostra })),
      };
      const system = `Voce e um analista de People Analytics. Um gestor de RH esta consultando o risco estimado de saida de um PERFIL de funcionario (nao uma pessoa real e identificada), baseado em taxas historicas de desligamento por categoria. Escreva 3 a 4 frases em portugues do Brasil: explique o que mais pesa nesse risco, e sugira 1 a 2 acoes praticas de retencao para esse perfil. Deixe claro que e uma estimativa estatistica agregada, nao um veredito sobre uma pessoa especifica, e que amostras pequenas sao menos confiaveis. Nao use markdown. ${WRITING_STYLE_RULE}`;
      const prompt = `Estimativa de risco de saida para o perfil selecionado (JSON):\n${JSON.stringify(payload)}`;
      const text = await callClaude(prompt, system, apiKey, model, provider);
      setAiState({ text });
    } catch (e) {
      setAiState({ error: e.message === "NO_API_KEY" ? "Configure sua chave de API (botão no topo da página)." : (e.message || "Falha ao gerar análise.") });
    }
  };

  const Select = ({ dimKey, label }) => (
    <div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, fontWeight: 600, color: T.ink, marginBottom: 5 }}>{label}</div>
      <select
        value={sel[dimKey]}
        onChange={(e) => updateSel(dimKey, e.target.value)}
        style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 7, padding: "8px 9px", fontFamily: "var(--font-body)", fontSize: 12.5, outline: "none", background: T.paperRaised, color: T.ink }}
      >
        <option value="">Não considerar</option>
        {orderedOptions(dimKey, rm[dimKey]).map((opt) => (
          <option key={opt} value={opt}>{opt} ({rm[dimKey][opt].total})</option>
        ))}
      </select>
    </div>
  );

  return (
    <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 12, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: T.ink, margin: 0 }}>Risco de saída por perfil</h3>
        <button onClick={limpar} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.line}`, color: T.slate, borderRadius: 7, padding: "6px 11px", fontSize: 11.5, fontFamily: "var(--font-body)", cursor: "pointer" }}>
          <RotateCcw size={12} /> Limpar seleção
        </button>
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: T.slate, margin: "0 0 18px" }}>
        Monte um perfil com as categorias que a sua base tem e veja a chance histórica de desligamento para esse perfil, com base nos padrões da sua própria base.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {dims.map((d) => <Select key={d.key} dimKey={d.key} label={d.label} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }} className="scenario-grid">
        <div style={{ background: T.navyPanel, borderRadius: 10, padding: "18px 16px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "#B9C2D6", marginBottom: 6 }}>Chance estimada de saída</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 34, fontWeight: 600, color: "#fff" }}>{(resultado.prob * 100).toFixed(1)}%</div>
          <div style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 20, background: band.color, color: "#fff", fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600 }}>
            {band.label}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10.5, color: "#8891A6", marginTop: 10 }}>
            Média geral da empresa: {(resultado.base * 100).toFixed(1)}%
          </div>
        </div>

        <div>
          {!algumFatorSelecionado ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.slateLight, fontSize: 12.5, fontFamily: "var(--font-body)", height: "100%" }}>
              Selecione ao menos um fator acima para montar um perfil. Sem seleção, o número mostrado é a média geral da empresa.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {resultado.fatores.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.paper, borderRadius: 8, border: `1px solid ${T.line}` }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: T.ink }}>
                    <strong>{f.dim}:</strong> {f.valor}
                    {f.amostra < 15 && <span style={{ color: T.amber, marginLeft: 6, fontSize: 11 }}>(amostra pequena, {f.amostra} pessoas)</span>}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: f.acimaDaMedia ? T.brick : T.forest }}>
                    {(f.taxa * 100).toFixed(1)}% histórico
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, borderTop: `1px dashed ${T.line}`, paddingTop: 12 }}>
        {!aiState.text && !aiState.loading && (
          <button onClick={gerarAnalise} disabled={!algumFatorSelecionado} style={{
            display: "flex", alignItems: "center", gap: 7, background: "transparent", border: `1px solid ${T.forest}`,
            color: T.forest, borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontFamily: "var(--font-body)",
            fontWeight: 600, cursor: algumFatorSelecionado ? "pointer" : "default", opacity: algumFatorSelecionado ? 1 : 0.4,
          }}>
            <Sparkles size={14} /> Analisar este perfil com IA
          </button>
        )}
        {aiState.loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.slate, fontSize: 12.5, fontFamily: "var(--font-body)" }}>
            <Loader2 size={14} className="spin" /> Gerando análise...
          </div>
        )}
        {aiState.error && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: T.brick, fontSize: 12.5, fontFamily: "var(--font-body)" }}>
            <AlertCircle size={14} /> {aiState.error}
            <button onClick={gerarAnalise} style={{ marginLeft: 6, textDecoration: "underline", background: "none", border: "none", color: T.brick, cursor: "pointer", fontSize: 12.5 }}>tentar de novo</button>
          </div>
        )}
        {aiState.text && !aiState.loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Sparkles size={14} style={{ color: T.amber, marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.55, color: T.ink, margin: 0 }}>{aiState.text}</p>
          </div>
        )}
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: T.slateLight, margin: "14px 0 0", lineHeight: 1.5 }}>
        Estimativa por heurística estatística: combina as taxas históricas de desligamento de cada categoria selecionada, com suavização para amostras pequenas, e não é um modelo de machine learning treinado. Nunca use isso como único critério sobre uma pessoa real. Serve para identificar padrões agregados e priorizar ações de retenção.
      </p>
    </div>
  );
}


function ScenarioSimulator({ agg }) {
  const baseline = useMemo(() => {
    const recent = agg.turnoverByMonth.slice(-6);
    const avgTurnover = recent.length ? recent.reduce((a, t) => a + t.taxa, 0) / recent.length : 2;
    const avgHires = recent.length ? recent.reduce((a, t) => a + t.admissoes, 0) / recent.length : 5;
    return { turnover: +avgTurnover.toFixed(1), hires: Math.round(avgHires) };
  }, [agg]);

  const [turnover, setTurnover] = useState(baseline.turnover);
  const [hires, setHires] = useState(baseline.hires);
  const [salaryAdjust, setSalaryAdjust] = useState(6);

  const projection = useMemo(() => {
    const months = 12;
    const buildSeries = (turnoverRate, monthlyHires, adjustPct) => {
      let hc = agg.totalAtivos;
      let avgSalary = agg.salarioMedioAtivos;
      const out = [];
      for (let i = 1; i <= months; i++) {
        const desligados = hc * (turnoverRate / 100);
        hc = Math.max(0, hc - desligados + monthlyHires);
        avgSalary = avgSalary * (1 + adjustPct / 100 / 12);
        const payroll = agg.payrollSim ? hc * avgSalary * agg.payrollSim.factor : null;
        out.push({ mes: `+${i}m`, headcount: Math.round(hc), folha: payroll === null ? null : Math.round(payroll) });
      }
      return out;
    };
    return {
      base: buildSeries(baseline.turnover, baseline.hires, 6),
      cenario: buildSeries(turnover, hires, salaryAdjust),
    };
  }, [agg, turnover, hires, salaryAdjust, baseline]);

  const merged = projection.base.map((b, i) => ({
    mes: b.mes,
    headcount_base: b.headcount,
    headcount_cenario: projection.cenario[i].headcount,
    folha_base: b.folha,
    folha_cenario: projection.cenario[i].folha,
  }));

  const finalBase = projection.base[projection.base.length - 1];
  const finalCenario = projection.cenario[projection.cenario.length - 1];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 22 }} className="scenario-grid">
      <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 12, padding: 20, height: "fit-content" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <SlidersHorizontal size={16} style={{ color: T.forest }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 600, color: T.ink }}>Variáveis do cenário</span>
        </div>
        <SliderRow label="Turnover mensal" value={turnover} onChange={setTurnover} min={0} max={15} step={0.1} unit="%" hint={`Média histórica recente: ${baseline.turnover}%`} />
        <SliderRow label="Contratações por mês" value={hires} onChange={setHires} min={0} max={40} step={1} unit="" hint={`Média histórica recente: ${baseline.hires} por mês`} />
        {agg.payrollSim && <SliderRow label="Reajuste salarial anual" value={salaryAdjust} onChange={setSalaryAdjust} min={0} max={20} step={0.5} unit="%" hint="Aplicado mensalmente de forma composta" />}
        <button
          onClick={() => { setTurnover(baseline.turnover); setHires(baseline.hires); setSalaryAdjust(6); }}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.line}`, color: T.slate, borderRadius: 7, padding: "7px 12px", fontSize: 12, fontFamily: "var(--font-body)", cursor: "pointer", marginTop: 4 }}
        >
          <RotateCcw size={13} /> Resetar para média histórica
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          <div style={{ background: T.navyPanel, borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: "#B9C2D6" }}>Headcount projetado em 12 meses</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, color: "#fff", marginTop: 4 }}>
              {fmtInt(finalCenario.headcount)}
              <span style={{ fontSize: 13, color: finalCenario.headcount >= finalBase.headcount ? "#8FD4B8" : "#E4A79E", marginLeft: 8 }}>
                ({finalCenario.headcount >= finalBase.headcount ? "+" : ""}{fmtInt(finalCenario.headcount - finalBase.headcount)} em relação à base)
              </span>
            </div>
          </div>
          <div style={{ background: T.navyPanel, borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: "#B9C2D6" }}>Custo de folha projetado (mês 12)</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, color: "#fff", marginTop: 4 }}>
              {fmtBRL(finalCenario.folha)}
              <span style={{ fontSize: 13, color: finalCenario.folha <= finalBase.folha ? "#8FD4B8" : "#E4A79E", marginLeft: 8 }}>
                ({finalCenario.folha >= finalBase.folha ? "+" : ""}{fmtBRL(finalCenario.folha - finalBase.folha)})
              </span>
            </div>
          </div>
        </div>

        <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 12, padding: "18px 20px" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 600, color: T.ink, margin: "0 0 12px" }}>Headcount, base histórica e cenário</h3>
          <div style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={merged} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} />
                <YAxis tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} />
                <Tooltip content={<CustomTooltip formatter={fmtInt} />} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter" }} />
                <Line type="monotone" dataKey="headcount_base" name="Base (tendência atual)" stroke={T.slateLight} strokeDasharray="4 3" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="headcount_cenario" name="Cenário simulado" stroke={T.forest} dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {agg.payrollSim && <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 12, padding: "18px 20px" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 600, color: T.ink, margin: "0 0 12px" }}>{agg.payrollSim.label}</h3>
          <div style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={merged} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} />
                <YAxis tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<CustomTooltip formatter={fmtBRL} />} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter" }} />
                <Line type="monotone" dataKey="folha_base" name="Base (tendência atual)" stroke={T.slateLight} strokeDasharray="4 3" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="folha_cenario" name="Cenário simulado" stroke={T.amber} dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>}
        <p style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: T.slateLight, margin: 0, lineHeight: 1.5 }}>
          Simulação paramétrica simples, e não um modelo treinado: a cada mês, o headcount perde uma fração por turnover e ganha as contratações definidas
          {agg.payrollSim ? ", e o salário médio é reajustado de forma composta" : ""}.
          {agg.payrollSim && agg.payrollSim.usesCtc ? ` O custo de folha usa a razão histórica entre CTC e salário base (${agg.payrollSim.factor.toFixed(2)}x) observada na sua base.` : ""}
          {agg.payrollSim && !agg.payrollSim.usesCtc ? " A base não tem CTC, então o gráfico de folha considera só o salário dos ativos, sem encargos e benefícios." : ""}
          {!agg.payrollSim ? " A base não tem salários, então o custo de folha não é simulado." : ""}
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
   PREVISOES (regressao linear simples)
============================================================================ */
/** Constroi {combined, slope} para qualquer serie mensal no formato [{mes,label,<valueKey>}],
 * reaproveitando a mesma logica de regressao linear usada no headcount/turnover/folha
 * baseados em funcionarios. Usado tanto no caminho normal quanto no caminho alternativo
 * (bases sem cadastro de funcionarios). */
function buildGenericForecast(series, valueKey) {
  if (!series || series.length < 2) return null;
  const recent = series.slice(-9);
  const pts = recent.map((s, i) => ({ x: i, y: s[valueKey] }));
  const reg = linearRegression(pts);
  const lastIdx = pts.length - 1;
  const combined = series.map((s) => ({ label: s.label, real: s[valueKey], previsto: null }));
  let lastKey = series[series.length - 1].mes;
  combined[combined.length - 1].previsto = combined[combined.length - 1].real;
  for (let i = 1; i <= 6; i++) {
    lastKey = addMonths(lastKey, 1);
    const pred = Math.max(0, Math.round(reg.predict(lastIdx + i) * 100) / 100);
    combined.push({ label: monthLabel(lastKey), real: null, previsto: pred });
  }
  return { combined, slope: reg.slope };
}
function ForecastSection({ agg, alt, insights, onGenerate }) {
  const headcountForecast = useMemo(() => (agg ? buildGenericForecast(agg.headcountByMonth, "ativos") : null), [agg]);
  const turnoverForecast = useMemo(() => (agg ? buildGenericForecast(agg.turnoverByMonth, "taxa") : null), [agg]);
  const folhaForecast = useMemo(() => (agg && agg.costLabel && agg.folhaByMonth.length >= 2 ? buildGenericForecast(agg.folhaByMonth, "total") : null), [agg]);

  // Caminho alternativo: bases sem cadastro de funcionarios, usando so o que existir
  // (vagas abertas/fechadas, tempo de contratacao, desligamentos crus, folha isolada).
  const altRsAbertas = useMemo(() => (alt ? buildGenericForecast(alt.rsAbertasByMonth, "valor") : null), [alt]);
  const altRsFechadas = useMemo(() => (alt ? buildGenericForecast(alt.rsFechadasByMonth, "valor") : null), [alt]);
  const altTempoContratacao = useMemo(() => (alt ? buildGenericForecast(alt.tempoContratacaoByMonth, "valor") : null), [alt]);
  const altDesligamentos = useMemo(() => (alt ? buildGenericForecast(alt.desligamentosByMonth, "valor") : null), [alt]);
  const altFolha = useMemo(() => (alt ? buildGenericForecast(alt.folhaByMonth, "valor") : null), [alt]);

  const genericLineCard = (id, title, subtitle, forecast, formatter, colorReal) => forecast && (
    <ChartCard key={id} id={id} title={title} subtitle={subtitle} insights={insights} onGenerate={onGenerate}
      insightData={forecast.combined} insightLabel={`Serie historica de ${title.toLowerCase()} e projecao para os proximos 6 meses via regressao linear simples`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={forecast.combined} margin={{ left: 0, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: "Inter" }} stroke={T.slateLight} interval={2} />
          <YAxis tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} />
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Inter" }} />
          <Line type="monotone" dataKey="real" name="Real" stroke={colorReal} dot={false} strokeWidth={2.5} connectNulls={false} />
          <Line type="monotone" dataKey="previsto" name="Previsto" stroke={T.amber} strokeDasharray="5 4" dot={false} strokeWidth={2.5} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );

  if (!agg) {
    const altCards = [
      genericLineCard("forecast_rs_abertas", "Vagas abertas por mês", "Histórico e 6 meses projetados", altRsAbertas, fmtInt, T.forest),
      genericLineCard("forecast_rs_fechadas", "Contratações por mês", "Vagas fechadas, histórico e 6 meses projetados", altRsFechadas, fmtInt, T.forestDark),
      genericLineCard("forecast_tempo_contratacao", "Tempo médio de contratação", "Em dias, histórico e 6 meses projetados", altTempoContratacao, fmtInt, T.amber),
      genericLineCard("forecast_desligamentos", "Desligamentos por mês", "Contagem bruta, histórico e 6 meses projetados", altDesligamentos, fmtInt, T.brick),
      genericLineCard("forecast_folha_alt", `Previsão de ${alt && alt.costLabel ? alt.costLabel : "custo de folha"}`, "Total mensal, histórico e 6 meses projetados", altFolha, fmtBRL, T.forestDark),
    ].filter(Boolean);

    if (!altCards.length) return null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ background: "color-mix(in srgb, var(--c-forest) 14%, var(--c-paper))", border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10 }}>
          <Activity size={16} style={{ color: T.forest, flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: T.ink, margin: 0, lineHeight: 1.55 }}>
            As projeções abaixo usam <strong>regressão linear simples</strong> sobre os últimos 9 meses de histórico
            para estimar os próximos 6 meses, a partir das tabelas disponíveis nesta base (sem cadastro de
            funcionários). É um método estatístico transparente, e não uma rede neural.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="forecast-grid">
          {altCards}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: "color-mix(in srgb, var(--c-forest) 14%, var(--c-paper))", border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10 }}>
        <Activity size={16} style={{ color: T.forest, flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: T.ink, margin: 0, lineHeight: 1.55 }}>
          As projeções abaixo usam <strong>regressão linear simples</strong> sobre os últimos 9 meses de histórico
          para estimar os próximos 6 meses. É um método estatístico transparente, e não uma rede neural, útil para
          identificar tendência, e não para prever com precisão eventos pontuais.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="forecast-grid">
        {genericLineCard("forecast_headcount", "Previsão de headcount", "Histórico e 6 meses projetados", headcountForecast, fmtInt, T.forest)}
        {agg.totalDesligados > 0 && genericLineCard("forecast_turnover", "Previsão de turnover mensal", "Taxa em porcentagem, histórico e 6 meses projetados", turnoverForecast, fmtPct, T.brick)}
      </div>

      {genericLineCard("forecast_folha", `Previsão de ${agg.costLabel || "custo de folha"}`, "Total mensal, histórico e 6 meses projetados", folhaForecast, fmtBRL, T.forestDark)}
    </div>
  );
}

/* ============================================================================
   PAGINAS DO PAINEL (navegacao real, uma pagina renderizada por vez)
============================================================================ */
/* ============================================================================
   PAGINA "QUALIDADE DOS DADOS" — mostra ao usuario o que a limpeza automatica fez.
   Todos os numeros vem de `report`, montado pelo codigo em src/lib/limpeza.js.
============================================================================ */
function DataQualityPage({ report }) {
  const fmt = (n) => new Intl.NumberFormat("pt-BR").format(n);
  const tableKeys = Object.keys(TABLE_LABELS).filter((k) => report.tables && report.tables[k]);
  const sum = (key) => tableKeys.reduce((a, k) => a + (report.tables[k][key] || 0), 0);
  const blankTotal = (report.sheets || []).reduce((a, s) => a + (s.blankDropped || 0), 0);
  const harmonized = report.harmonized || [];
  const valuesChanged = harmonized.reduce((a, h) => a + h.rows, 0);
  const groupsMerged = harmonized.reduce((a, h) => a + h.groups.length, 0);
  const completeness = report.completeness || [];
  const intervals = report.intervals || [];

  const card = { background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 12, padding: "18px 20px", marginBottom: 16 };
  const h3 = { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: T.ink, margin: "0 0 4px" };
  const sub = { fontFamily: "var(--font-body)", fontSize: 12.5, color: T.slate, lineHeight: 1.55, margin: "0 0 12px" };
  const body = { fontFamily: "var(--font-body)", fontSize: 12.5, color: T.ink };
  const th = { textAlign: "right", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: T.slate, borderBottom: `1px solid ${T.line}` };
  const td = { textAlign: "right", padding: "7px 8px", borderBottom: `1px solid ${T.line}`, fontVariantNumeric: "tabular-nums" };

  const tiles = [
    { label: "Linhas lidas", value: fmt(sum("received")) },
    { label: "Linhas aproveitadas", value: fmt(sum("kept")) },
    { label: "Duplicados combinados", value: fmt(sum("duplicates")) },
    { label: "Valores unificados", value: fmt(groupsMerged), hint: `${fmt(valuesChanged)} célula(s) ajustada(s)` },
  ];

  const aiMsg = {
    aplicada: `A IA comparou os valores distintos de ${report.checkedFields} campo(s) de categoria para achar o mesmo valor escrito de formas diferentes. Ela não recebe linhas da base nem nomes de pessoas, e o código só aplica o que passa nas validações.`,
    sem_chave: "A padronização por significado (ex: sigla = nome por extenso) precisa da chave de IA e não rodou. Só a padronização por grafia (maiúscula, acento, espaço) foi feita.",
    falhou: "A IA não respondeu na padronização por significado. Só a padronização por grafia (maiúscula, acento, espaço) foi feita.",
  }[report.aiStatus];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: T.forest }}>{t.value}</div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: T.slate, marginTop: 2 }}>{t.label}</div>
            {t.hint && <div style={{ fontFamily: "var(--font-body)", fontSize: 10.5, color: T.slateLight, marginTop: 1 }}>{t.hint}</div>}
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={h3}>Linhas por tabela</h3>
        <p style={sub}>
          Linhas descartadas são as que não tinham identificador ou data obrigatória, ou que não se ligavam a nenhum funcionário do cadastro.
          {blankTotal > 0 && ` Além disso, ${fmt(blankTotal)} linha(s) totalmente em branco foram removidas das planilhas antes da contagem.`}
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ ...body, width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Tabela</th>
                <th style={th}>Lidas</th><th style={th}>Aproveitadas</th><th style={th}>Duplicados combinados</th><th style={th}>Descartadas</th>
              </tr>
            </thead>
            <tbody>
              {tableKeys.map((k) => {
                const t = report.tables[k];
                return (
                  <tr key={k}>
                    <td style={{ ...td, textAlign: "left" }}>
                      {TABLE_LABELS[k]}
                      {t.synthesized && <span style={{ color: T.slate }}> (gerada a partir do cadastro)</span>}
                    </td>
                    <td style={td}>{t.synthesized ? "—" : fmt(t.received)}</td>
                    <td style={td}>{fmt(t.kept)}</td>
                    <td style={td}>{fmt(t.duplicates)}</td>
                    <td style={{ ...td, color: t.discarded ? T.brick : T.ink }}>{fmt(t.discarded)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {report.tables.funcionarios && report.tables.funcionarios.noAdmissionDate > 0 && (
          <p style={{ ...sub, margin: "10px 0 0" }}>
            {fmt(report.tables.funcionarios.noAdmissionDate)} funcionário(s) estão sem data de admissão. Eles foram mantidos, mas não entram em gráficos de tempo de casa e de headcount.
          </p>
        )}
      </div>

      <div style={card}>
        <h3 style={h3}>Valores padronizados</h3>
        <p style={sub}>
          Quando o mesmo valor aparecia escrito de formas diferentes, ele foi unificado para não virar várias categorias nos filtros e gráficos.
        </p>
        {harmonized.length === 0 ? (
          <div style={{ ...body, color: T.slate }}>Nenhum valor precisou ser unificado. Os campos de categoria já estavam consistentes.</div>
        ) : (
          harmonized.map((h) => (
            <div key={`${h.table}.${h.field}`} style={{ padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
              <div style={{ ...body, fontWeight: 600 }}>
                {humanizeFieldKey(h.field)} <span style={{ fontWeight: 400, color: T.slate }}>· {TABLE_LABELS[h.table]} · {fmt(h.rows)} valor(es) ajustado(s)</span>
              </div>
              {h.groups.slice(0, 5).map((g) => (
                <div key={g.to} style={{ ...body, color: T.slate, marginTop: 3 }}>
                  {g.from.slice(0, 6).map((f) => `"${f}"`).join(", ")}{g.from.length > 6 ? ` e mais ${g.from.length - 6}` : ""} → <span style={{ color: T.ink, fontWeight: 600 }}>"{g.to}"</span>
                  <span style={{ marginLeft: 8, fontSize: 10.5, padding: "1px 7px", borderRadius: 999, border: `1px solid ${T.line}`, color: T.slate }}>
                    {g.kind === "significado" ? "por significado (IA)" : "por grafia"}
                  </span>
                </div>
              ))}
              {h.groups.length > 5 && <div style={{ ...body, color: T.slateLight, marginTop: 3 }}>e mais {h.groups.length - 5} grupo(s)</div>}
            </div>
          ))
        )}
        {aiMsg && <p style={{ ...sub, margin: "12px 0 0" }}>{aiMsg}</p>}
      </div>

      {intervals.length > 0 && (
        <div style={card}>
          <h3 style={h3}>Intervalos de datas</h3>
          <p style={sub}>
            O sistema encontrou pares de datas de início e fim e calculou a duração em dias. Intervalos sem data final são tratados como em andamento.
            Intervalos com o fim antes do início são inconsistentes e ficam fora do cálculo da duração.
          </p>
          {intervals.map((iv) => (
            <div key={`${iv.table}.${iv.start}.${iv.end}`} style={{ padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
              <div style={{ ...body, fontWeight: 600 }}>
                {humanizeFieldKey(iv.start)} → {humanizeFieldKey(iv.end)} <span style={{ fontWeight: 400, color: T.slate }}>· {TABLE_LABELS[iv.table]}</span>
              </div>
              <div style={{ ...body, color: T.slate, marginTop: 3 }}>
                {fmt(iv.computed)} calculado(s){iv.avgDays !== null ? `, duração média de ${fmt(iv.avgDays)} dias` : ""}
                {iv.open > 0 ? ` · ${fmt(iv.open)} em andamento (sem data final)` : ""}
                {iv.invalid > 0 && <span style={{ color: T.brick }}> · {fmt(iv.invalid)} inconsistente(s): fim antes do início</span>}
              </div>
              {iv.field && <div style={{ ...body, color: T.slateLight, marginTop: 2 }}>Novos campos disponíveis nos gráficos e filtros: {humanizeFieldKey(iv.field)}{iv.faixaField ? `, ${humanizeFieldKey(iv.faixaField)}` : ""}</div>}
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <h3 style={h3}>Campos com muitos vazios</h3>
        <p style={sub}>Campos em que 10% ou mais das linhas estão sem valor (ou "Não informado"). Gráficos que dependem deles refletem só as linhas preenchidas.</p>
        {completeness.length === 0 ? (
          <div style={{ ...body, color: T.slate }}>Nenhum campo relevante com mais de 10% de vazios.</div>
        ) : (
          completeness.map((c) => (
            <div key={c.table} style={{ padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
              <div style={{ ...body, fontWeight: 600, marginBottom: 6 }}>{TABLE_LABELS[c.table]} <span style={{ fontWeight: 400, color: T.slate }}>· {fmt(c.rows)} linhas</span></div>
              {c.fields.map((f) => (
                <div key={f.field} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <div style={{ ...body, width: 190, flexShrink: 0 }}>{humanizeFieldKey(f.field)}</div>
                  <div style={{ flex: 1, height: 8, background: T.line, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, f.pct)}%`, height: "100%", background: f.pct >= 50 ? T.brick : T.amber }} />
                  </div>
                  <div style={{ ...body, width: 48, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.pct.toLocaleString("pt-BR")}%</div>
                </div>
              ))}
              {c.more > 0 && <div style={{ ...body, color: T.slateLight }}>e mais {c.more} campo(s)</div>}
            </div>
          ))
        )}
      </div>

      <div style={{ ...body, color: T.slate, lineHeight: 1.6, padding: "0 4px" }}>
        Também foram tratados automaticamente: {report.emptyTexts > 0 ? `${fmt(report.emptyTexts)} célula(s) com texto que significa vazio ("N/A", "-", "#N/D") viraram vazio de verdade` : `textos que significam vazio ("N/A", "-", "#N/D") viram vazio de verdade`}, e números e datas escritos em formatos diferentes (R$ 1.234,56, 12,5%, 05/01/24) foram entendidos.
      </div>
    </div>
  );
}

function PageIntro({ text }) {
  return (
    <p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: T.slate, margin: "-8px 0 20px", maxWidth: 640, lineHeight: 1.5 }}>{text}</p>
  );
}


/* ============================================================================
   ICONES POR icon_hint (a IA so escolhe o nome, o codigo escolhe o componente)
============================================================================ */
const ICON_MAP = {
  users: Users, "user-minus": UserMinus, briefcase: Briefcase, dollar: DollarSign,
  pie: PieChartIcon, "trending-up": TrendingUp, target: Target, activity: Activity,
  heart: Sparkles, "bar-chart": BarChart3,
};
function iconFor(hint) { return ICON_MAP[hint] || BarChart3; }

/* ============================================================================
   GRAFICO DINAMICO (renderiza qualquer chart_type generico contra dados ja
   calculados — layout/cores fixos, conteudo 100% vindo do plano da IA)
============================================================================ */
function DynamicChartBody({ spec, chartData }) {
  if (!chartData || !chartData.length) {
    return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: T.slateLight, fontFamily: "var(--font-body)", fontSize: 12.5 }}>Sem dados suficientes para este grafico.</div>;
  }
  const isPct = /%|taxa|percent/i.test(spec.title + " " + (spec.subtitle || ""));
  const isMoney = /custo|salario|folha|ctc|r\$/i.test(spec.title + " " + (spec.subtitle || "")) && spec.metric?.agg !== "count";
  const formatter = isPct ? fmtPct : isMoney ? fmtBRL : fmtInt;
  const tickFmt = isMoney ? (v) => `${Math.round(v / 1000)}k` : undefined;
  const xTickInterval = chartData.length > 10 ? Math.ceil(chartData.length / 10) - 1 : 0;

  // Grafico de 2 dimensoes (crosstab, ex: "genero por cargo"): cada linha tem uma chave
  // dinamica por valor da segunda dimensao, em vez de uma unica chave "value".
  const isCrossTab = !!(spec.series_by && spec.series_by.field);
  const seriesKeys = isCrossTab ? [...new Set(chartData.flatMap((row) => Object.keys(row).filter((k) => k !== "name")))] : [];

  if (isCrossTab) {
    const layout = spec.chart_type === "bar_horizontal" ? "vertical" : "horizontal";
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout={layout} margin={layout === "vertical" ? { left: 10, right: 20 } : { left: 0, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.line} horizontal={layout !== "vertical"} />
          {layout === "vertical" ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} tickFormatter={tickFmt} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10.5, fontFamily: "Inter" }} stroke={T.slateLight} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 9.5, fontFamily: "Inter" }} stroke={T.slateLight} interval={xTickInterval} angle={chartData.length > 6 ? -20 : 0} textAnchor={chartData.length > 6 ? "end" : "middle"} height={chartData.length > 6 ? 55 : 30} />
              <YAxis tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} tickFormatter={tickFmt} />
            </>
          )}
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Inter" }} />
          {seriesKeys.map((sk, i) => (
            <Bar key={sk} dataKey={sk} name={sk} stackId="crosstab" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === seriesKeys.length - 1 ? (layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  switch (spec.chart_type) {
    case "line":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "Inter" }} stroke={T.slateLight} interval={xTickInterval} />
            <YAxis tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} tickFormatter={tickFmt} />
            <Tooltip content={<CustomTooltip formatter={formatter} />} />
            <Line type="monotone" dataKey="value" name={spec.title} stroke={T.forest} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    case "area":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "Inter" }} stroke={T.slateLight} interval={xTickInterval} />
            <YAxis tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} tickFormatter={tickFmt} />
            <Tooltip content={<CustomTooltip formatter={formatter} />} />
            <Area type="monotone" dataKey="value" name={spec.title} stroke={T.forest} fill={T.forest} fillOpacity={0.25} strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      );
    case "pie": {
      const total = chartData.reduce((a, d) => a + (d.value || 0), 0) || 1;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData} dataKey="value" nameKey="name" cx="50%" cy="44%" outerRadius={78}
              label={({ name, value, percent }) => (percent > 0.06 ? `${name} (${value})` : "")}
              labelLine={({ percent }) => percent > 0.06}
              fontSize={10.5}
            >
              {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Legend
              verticalAlign="bottom" height={40} iconSize={9}
              wrapperStyle={{ fontSize: 10.5, fontFamily: "Inter" }}
              formatter={(value, entry) => `${value} (${entry.payload.value})`}
            />
            <Tooltip content={<CustomTooltip formatter={formatter} />} />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    case "radar":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} outerRadius={85}>
            <PolarGrid stroke={T.line} />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 9.5, fontFamily: "Inter" }} />
            <PolarRadiusAxis angle={30} tick={{ fontSize: 9 }} />
            <Radar name={spec.title} dataKey="value" stroke={T.forest} fill={T.forest} fillOpacity={0.35} />
            <Tooltip content={<CustomTooltip formatter={formatter} />} />
          </RadarChart>
        </ResponsiveContainer>
      );
    case "bar_horizontal": {
      // Largura fixa de 130px quebrava com categorias longas (ex: nomes de etapa de
      // processo tipo "Agendamento exames admissionais - Medicina"): o texto do eixo Y
      // ultrapassava a largura reservada e o Recharts renderiza o rotulo terminando
      // alinhado aquele limite, entao o excesso "vazava" pra fora do card pela esquerda —
      // em casos extremos o rotulo inteiro ficava invisivel. Agora a largura do eixo se
      // adapta ao rotulo mais comprido dos dados (com teto), e qualquer rotulo que ainda
      // assim nao caiba e truncado com "…" — nunca mais vaza pra fora do card. O tooltip
      // ao passar o mouse continua mostrando o nome completo, sem truncar.
      const maxLabelLen = chartData.reduce((max, d) => Math.max(max, String(d.name ?? "").length), 0);
      const yAxisWidth = Math.min(210, Math.max(90, maxLabelLen * 6 + 16));
      const truncateTick = (v) => {
        const s = String(v ?? "");
        return s.length > 34 ? `${s.slice(0, 33)}…` : s;
      };
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} tickFormatter={tickFmt} />
            <YAxis type="category" dataKey="name" width={yAxisWidth} tick={{ fontSize: 10.5, fontFamily: "Inter" }} stroke={T.slateLight} tickFormatter={truncateTick} />
            <Tooltip content={<CustomTooltip formatter={formatter} />} />
            <Bar dataKey="value" name={spec.title} fill={T.forest} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    case "bar":
    default:
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
            <XAxis dataKey="name" tick={{ fontSize: 9.5, fontFamily: "Inter" }} stroke={T.slateLight} interval={xTickInterval} angle={chartData.length > 6 ? -20 : 0} textAnchor={chartData.length > 6 ? "end" : "middle"} height={chartData.length > 6 ? 55 : 30} />
            <YAxis tick={{ fontSize: 11, fontFamily: "Inter" }} stroke={T.slateLight} tickFormatter={tickFmt} />
            <Tooltip content={<CustomTooltip formatter={formatter} />} />
            <Bar dataKey="value" name={spec.title} fill={T.amber} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
  }
}

/* ============================================================================
   PAGINA DINAMICA (renderiza os KPIs e graficos que a IA planejou para 1 pagina)
============================================================================ */
/* ============================================================================
   BARRA DE FILTROS GLOBAIS (segmentacao por categoria + janela de tempo) —
   afeta os valores calculados em todas as paginas, sem replanejar o dashboard
============================================================================ */
function FilterBar({ profile, filterFields, rawData, segments, setSegments, periodFilter, setPeriodFilter }) {
  const [expanded, setExpanded] = useState(false);
  // Os filtros de categoria mostrados sao os ate 6 campos que a propria IA escolheu como
  // mais relevantes pra essa base (plan.filter_fields, ja validado contra o perfil real —
  // ver validateFilterFields). So cai no calculo generico (varrer todas as tabelas e pegar
  // os 6 primeiros campos categoricos uteis) se a IA nao tiver proposto nenhum — ex: plano
  // antigo salvo antes dessa funcionalidade existir.
  const availableSegmentFields = useMemo(() => {
    const fromPlan = segmentOptionsFromFilterFields(filterFields, profile);
    return fromPlan.length ? fromPlan : collectSegmentFieldOptions(profile).slice(0, 6);
  }, [filterFields, profile]);
  // Anos calculados a partir dos dados de verdade (qualquer campo de data, em qualquer
  // tabela) — nunca uma lista chutada, entao sempre bate com o que a base realmente tem.
  const availableYears = useMemo(() => collectAvailableYears(rawData), [rawData]);

  const valueOptionsFor = (table, field) => {
    const rows = rawData && rawData[table];
    if (!rows) return [];
    return [...new Set(rows.map((r) => String(r[field] ?? "Não informado")))].sort();
  };
  const getValue = (table, field) => segments.find((s) => s.table === table && s.field === field)?.value || "";
  const setFieldValue = (table, field, value) => {
    setSegments((cur) => {
      const rest = cur.filter((s) => !(s.table === table && s.field === field));
      return value ? [...rest, { table, field, value }] : rest;
    });
  };
  const activeCount = segments.length + (periodFilter.year ? 1 : 0) + (periodFilter.month ? 1 : 0);

  return (
    <div style={{ marginBottom: 20, background: T.paperRaised, border: `var(--border-w) solid ${T.line}`, borderRadius: "var(--r-sm)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="no-print"
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: "transparent", border: "none", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.slate, fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600 }}>
          <SlidersHorizontal size={13} /> Filtros
          {activeCount > 0 && (
            <span style={{ background: T.forest, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10.5, fontFamily: "var(--font-mono)" }}>
              {activeCount}
            </span>
          )}
        </div>
        <ChevronDown size={15} style={{ color: T.slateLight, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
      </button>

      {expanded && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "0 14px 14px", borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
          {availableYears.length > 0 && (
            <>
              <select
                value={periodFilter.year}
                onChange={(e) => setPeriodFilter((cur) => ({ ...cur, year: e.target.value }))}
                style={{
                  border: `1px solid ${periodFilter.year ? T.forest : T.line}`, borderRadius: 7, padding: "6px 9px",
                  fontFamily: "var(--font-body)", fontSize: 12, fontWeight: periodFilter.year ? 600 : 400,
                  color: periodFilter.year ? T.forest : T.ink, background: periodFilter.year ? "color-mix(in srgb, var(--c-forest) 10%, var(--c-paper))" : T.paper, outline: "none",
                }}
              >
                <option value="">Ano: Todos</option>
                {availableYears.map((y) => <option key={y} value={String(y)}>Ano: {y}</option>)}
              </select>
              <select
                value={periodFilter.month}
                onChange={(e) => setPeriodFilter((cur) => ({ ...cur, month: e.target.value }))}
                style={{
                  border: `1px solid ${periodFilter.month ? T.forest : T.line}`, borderRadius: 7, padding: "6px 9px",
                  fontFamily: "var(--font-body)", fontSize: 12, fontWeight: periodFilter.month ? 600 : 400,
                  color: periodFilter.month ? T.forest : T.ink, background: periodFilter.month ? "color-mix(in srgb, var(--c-forest) 10%, var(--c-paper))" : T.paper, outline: "none",
                }}
              >
                <option value="">Mês: Todos</option>
                {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>Mês: {m.label}</option>)}
              </select>
            </>
          )}

          {availableSegmentFields.map((s) => {
            const active = !!getValue(s.table, s.field);
            return (
              <select
                key={`${s.table}:${s.field}`}
                value={getValue(s.table, s.field)}
                onChange={(e) => setFieldValue(s.table, s.field, e.target.value)}
                style={{
                  border: `1px solid ${active ? T.forest : T.line}`, borderRadius: 7, padding: "6px 9px",
                  fontFamily: "var(--font-body)", fontSize: 12, fontWeight: active ? 600 : 400,
                  color: active ? T.forest : T.ink, background: active ? "color-mix(in srgb, var(--c-forest) 10%, var(--c-paper))" : T.paper, outline: "none",
                }}
              >
                <option value="">{s.label}: Todos</option>
                {valueOptionsFor(s.table, s.field).map((v) => <option key={v} value={v}>{s.label}: {v}</option>)}
              </select>
            );
          })}

          {activeCount > 0 ? (
            <button
              onClick={() => { setSegments([]); setPeriodFilter({ year: "", month: "" }); }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: T.brick, fontFamily: "var(--font-body)", fontSize: 11.5, cursor: "pointer", marginLeft: 2 }}
            >
              <RotateCcw size={12} /> Limpar tudo
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   EXPORTACAO DO DASHBOARD (empilha todas as paginas para imprimir/salvar em PDF)
============================================================================ */
function ExportView({ plan, data, coreSeries, periodFilter, insights, onGenerate, onExit, paletteId, styleId, getDigest }) {
  // A exportacao sempre usa tema claro fixo, independente do modo claro/escuro escolhido
  // no dashboard — um relatorio pensado para tela deve continuar legivel impresso/em PDF.
  const exportThemeVars = buildThemeVars(paletteId, false, styleId);
  return (
    <div className="themed-root" style={{ ...exportThemeVars, background: "#fff", minHeight: "100vh" }}>
      <div className="no-print" style={{ position: "sticky", top: 0, background: T.navyPanel, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 50, flexWrap: "wrap", gap: 10 }}>
        <span style={{ color: "#fff", fontFamily: "var(--font-body)", fontSize: 12.5 }}>
          Visualização de exportação, com todas as páginas empilhadas. Use o botão abaixo (ou Ctrl/Cmd+P) para salvar como PDF.
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, background: T.forest, color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <Download size={13} /> Imprimir / Salvar PDF
          </button>
          <button onClick={onExit} style={{ background: "transparent", border: "1px solid #3A4A68", color: "#B9C2D6", borderRadius: 7, padding: "7px 14px", fontFamily: "var(--font-body)", fontSize: 12.5, cursor: "pointer" }}>
            Voltar ao dashboard
          </button>
        </div>
      </div>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: T.forest, textTransform: "uppercase" }}>Painel de Pessoas</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: T.ink, margin: "6px 0" }}>Relatorio de RH</h1>
          {plan.company_summary && <p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: T.slate, maxWidth: 520, margin: "0 auto" }}>{plan.company_summary}</p>}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: T.slateLight, marginTop: 10 }}>
            Gerado em {new Date().toLocaleDateString("pt-BR")} · {plan.pages.length} paginas
          </p>
        </div>
        {plan.pages.map((p, idx) => (
          <div key={p.id} className="export-page" style={{ marginBottom: 44 }}>
            {/* breakAfter/pageBreakAfter "avoid": sem isso, uma secao mais alta que 1 pagina
                de impressao podia quebrar logo depois do titulo (o navegador escolhe onde
                cortar sem saber que titulo+conteudo deveriam ficar juntos), deixando o h2
                sozinho numa pagina e os graficos todos na seguinte — exatamente o "pagina em
                branco com só o titulo" que aparecia no PDF exportado. Isso forca o titulo a
                "grudar" no que vem logo depois dele ao decidir a quebra. */}
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: T.ink, borderBottom: `2px solid ${T.forest}`, paddingBottom: 8, marginBottom: 18, breakAfter: "avoid", pageBreakAfter: "avoid" }}>{p.label}</h2>
            {idx === 0 && getDigest && <GeneralAnalysisCard getDigest={getDigest} insights={insights} onGenerate={onGenerate} />}
            <DynamicPage page={p} data={data} coreSeries={coreSeries} insights={insights} onGenerate={onGenerate} periodFilter={periodFilter} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AddChartForm({ onAdd, busy, error }) {
  const [text, setText] = useState("");
  const submit = () => { if (text.trim() && !busy) onAdd(text.trim()); };
  return (
    <div className="no-print" style={{ marginTop: 18, background: T.paperRaised, border: `1px dashed ${T.forest}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <PlusCircle size={15} style={{ color: T.forest }} />
        <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: T.ink }}>Pedir um grafico novo para esta pagina</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder='Ex: "salário médio por senioridade" ou "distribuição de idade dos ativos"'
          disabled={busy}
          style={{ flex: 1, border: `1px solid ${T.line}`, borderRadius: 7, padding: "8px 11px", fontFamily: "var(--font-body)", fontSize: 12.5, color: T.ink, background: T.paper, outline: "none" }}
        />
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          style={{ background: T.forest, color: "#fff", border: "none", borderRadius: 7, padding: "0 16px", fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy || !text.trim() ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}
        >
          {busy ? <Loader2 size={13} className="spin" /> : <PlusCircle size={13} />} {busy ? "Gerando..." : "Gerar"}
        </button>
      </div>
      {error && <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, color: T.brick, fontSize: 12, fontFamily: "var(--font-body)" }}><AlertCircle size={13} /> {error}</div>}
    </div>
  );
}

/* ============================================================================
   ANALISE GERAL DA BASE (IA) — sempre presente na primeira pagina (visao geral),
   cobrindo a base inteira, diferente das analises por grafico (que olham 1 grafico so)
============================================================================ */
function GeneralAnalysisCard({ getDigest, insights, onGenerate }) {
  return (
    <div className="no-print" style={{ background: T.paperRaised, border: `var(--border-w) solid ${T.line}`, borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "18px 20px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Sparkles size={16} style={{ color: T.amber }} />
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16.5, fontWeight: 600, color: T.ink, margin: 0 }}>Resumo geral da empresa (IA)</h3>
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: T.slate, margin: "3px 0 0" }}>
        Analise a base inteira de uma vez, diferente das análises por gráfico, que olham só um dado específico.
      </p>
      <AiInsightPanel
        chartId="geral" insights={insights}
        trigger={() => onGenerate("geral", getDigest(), "Resumo geral de toda a base de RH", "Análise geral da base")}
      />
    </div>
  );
}

function DynamicPage({ page, data, coreSeries, insights, onGenerate, periodFilter, editMode, onRemoveChart, onRemovePage, onAddChart, addChartBusy, addChartError }) {
  const kpiValues = useMemo(() => page.kpis.map((k) => ({ ...k, value: computeKpiValue(k, data, periodFilter) })), [page, data, periodFilter]);
  const chartsData = useMemo(() => page.charts.map((c) => ({ spec: c, chartData: computeChartData(c, data, coreSeries, periodFilter) })), [page, data, coreSeries, periodFilter]);

  const fmtByFormat = (fmt, v) => (fmt === "currency" ? fmtBRL(v) : fmt === "percent" ? fmtPct(v) : fmtInt(v));

  return (
    <>
      {editMode && (
        <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            onClick={onRemovePage}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.brick}`, color: T.brick, borderRadius: 7, padding: "6px 12px", fontSize: 12, fontFamily: "var(--font-body)", cursor: "pointer" }}
          >
            <X size={12} /> Remover esta pagina
          </button>
        </div>
      )}
      {kpiValues.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 14, marginBottom: 24 }}>
          {kpiValues.map((k, i) => (
            <KpiCard key={k.id || i} icon={React.createElement(iconFor(page.icon_hint), { size: 16 })} label={k.label} value={fmtByFormat(k.format, k.value)} tone={i % 2 === 0 ? "forest" : "amber"} />
          ))}
        </div>
      )}
      {chartsData.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: chartsData.length === 1 ? "1fr" : "1fr 1fr", gap: 18 }} className="forecast-grid">
          {chartsData.map(({ spec, chartData }) => (
            <ChartCard
              key={spec.id} id={spec.id} title={spec.title} subtitle={spec.subtitle}
              insights={insights} onGenerate={onGenerate}
              insightData={chartData} insightLabel={spec.subtitle ? `${spec.title} — ${spec.subtitle}` : spec.title}
              onRemove={editMode ? () => onRemoveChart(spec.id) : null}
            >
              <DynamicChartBody spec={spec} chartData={chartData} />
            </ChartCard>
          ))}
        </div>
      )}
      {!kpiValues.length && !chartsData.length && (
        <div style={{ color: T.slateLight, fontFamily: "var(--font-body)", fontSize: 13 }}>Nada para mostrar nesta pagina.</div>
      )}
      {editMode && onAddChart && (
        <AddChartForm onAdd={onAddChart} busy={addChartBusy} error={addChartError} />
      )}
    </>
  );
}

function PlanningScreen({ retryInfo }) {
  return (
    <div style={{ minHeight: "100vh", background: T.paper, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Loader2 size={30} style={{ color: T.forest }} className="spin" />
      <div style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: T.slate, marginTop: 14 }}>
        {retryInfo ? `Tentando novamente (${retryInfo.attempt}/${retryInfo.total})...` : "IA projetando o dashboard para esta base..."}
      </div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: T.slateLight, marginTop: 4 }}>escolhendo páginas e gráficos com base no que sua base realmente tem</div>
    </div>
  );
}

export default function PainelRHApp() {
  const [rawData, setRawData] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [requirements, setRequirements] = useState("");
  const [loadingStage, setLoadingStage] = useState(""); // "lendo" | "detectando" | ""
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [exportMode, setExportMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [insights, setInsights] = useState({});
  const [pendingWorkbook, setPendingWorkbook] = useState(null);
  const [pendingMapping, setPendingMapping] = useState(null);
  const [qualityReport, setQualityReport] = useState(null);
  const [confirming, setConfirming] = useState(false); // limpando/padronizando apos "Usar esta base"
  const [projectId, setProjectId] = useState(null);
  const [savedProjects, setSavedProjects] = useState([]);
  const [confirmNewBase, setConfirmNewBase] = useState(false);
  const {
    provider, setProvider, apiKey, model,
    anthropicKey, setAnthropicKey, geminiKey, setGeminiKey,
    anthropicModel, setAnthropicModel, geminiModel, setGeminiModel,
  } = useApiKey();
  const { paletteId, setPaletteId, darkMode, setDarkMode, styleId, setStyleId } = useThemePrefs();
  const themeVars = useMemo(() => buildThemeVars(paletteId, darkMode, styleId), [paletteId, darkMode, styleId]);

  const refreshSavedProjects = useCallback(() => {
    listProjectsFromDB().then(setSavedProjects).catch(() => setSavedProjects([]));
  }, []);
  useEffect(() => { refreshSavedProjects(); }, [refreshSavedProjects]);

  const resetAll = () => {
    setRawData(null); setPlan(null); setInsights({}); setActiveSection(null); setQualityReport(null);
    setPendingWorkbook(null); setPendingMapping(null); setError(null); setLog([]);
    setCustomizing(false); setRequirements("");
    setSegments([]); setPeriodFilter({ year: "", month: "" });
    setProjectId(null);
  };

  const openSavedProject = useCallback((project) => {
    setRawData(project.rawData);
    setPlan(project.plan);
    setRequirements(project.requirements || "");
    setInsights(project.insights || {});
    setQualityReport(project.qualityReport || null);
    setProjectId(project.id);
    setActiveSection((project.plan.pages[0] && project.plan.pages[0].id) || null);
    setSegments([]); setPeriodFilter({ year: "", month: "" });
    setError(null);
  }, []);

  const deleteSavedProject = useCallback(async (id) => {
    try { await deleteProjectFromDB(id); refreshSavedProjects(); } catch {}
  }, [refreshSavedProjects]);

  const handleFiles = useCallback(async (files) => {
    if (!apiKey) {
      setError("Configure uma chave de IA (botão no topo) antes de subir a base. Esta versão usa IA tanto para entender a estrutura da planilha quanto para planejar o dashboard.");
      return;
    }
    setLoading(true);
    setError(null);
    setPendingWorkbook(null);
    setPendingMapping(null);
    const newLog = [];
    try {
      setLoadingStage("lendo");
      const wb = await readWorkbookMerged(files);
      const nomes = files.map((f) => `"${f.name}"`).join(", ");
      newLog.push(`${files.length === 1 ? "Arquivo" : `${files.length} arquivos`} ${nomes} lido(s) com sucesso (${wb.SheetNames.length} abas no total).`);

      setLoadingStage("detectando");
      const mapping = await detectSchemaWithAI(wb, apiKey, model, provider, (attempt, total) => setLoadingStage(`detectando-retry-${attempt}`));
      if (mapping.is_hr_data === false) {
        throw new Error(mapping.overall_note || "A IA não identificou dados de RH reconhecíveis nesta planilha.");
      }
      setPendingWorkbook(wb);
      setPendingMapping(mapping);
      setLog(newLog);
    } catch (e) {
      setError(e.message || "Não foi possível processar o(s) arquivo(s).");
      setLog(newLog);
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  }, [apiKey, model, provider]);

  const confirmMapping = useCallback(async () => {
    const newLog = [...log];
    setConfirming(true);
    try {
      const report = createQualityReport();
      const found = buildFoundFromAIMapping(pendingWorkbook, pendingMapping, newLog, report);
      const processed = cleanAndNormalize(found, newLog, report);
      // Padroniza valores equivalentes ("SP" = "São Paulo") antes de montar perfil, filtros e graficos.
      await harmonizeCategoricalValues(processed, { askAI: apiKey ? (fields) => proposeSemanticMerges(fields, apiKey, model, provider) : null }, newLog, report);
      // Duracao (em dias) de qualquer par inicio/fim de datas, vira campo numerico para os graficos.
      applyDateIntervals(processed, report);
      report.completeness = summarizeCompleteness(processed);
      setQualityReport(report);
      setRawData(processed);
      setLog(newLog);
      setPendingWorkbook(null);
      setPendingMapping(null);
      setCustomizing(true);
    } catch (e) {
      setError(e.message || "Não foi possível processar o arquivo.");
      setPendingWorkbook(null);
      setPendingMapping(null);
      setLog(newLog);
    } finally {
      setConfirming(false);
    }
  }, [pendingWorkbook, pendingMapping, log, apiKey, model, provider]);

  const cancelMapping = useCallback(() => {
    setPendingWorkbook(null);
    setPendingMapping(null);
    setLog([]);
  }, []);

  const [planRetryInfo, setPlanRetryInfo] = useState(null);
  const generateDashboard = useCallback(async () => {
    if (!rawData) return;
    setCustomizing(false);
    setPlanning(true);
    setPlanRetryInfo(null);
    try {
      const profile = buildDataProfile(rawData);
      const rawPlan = await planDashboardWithAI(profile, apiKey, model, provider, requirements.trim(), (attempt, total) => setPlanRetryInfo({ attempt, total }));
      if (rawPlan.is_hr_data === false) {
        throw new Error(rawPlan.overall_note || "Não foi possível planejar um dashboard útil para esta base.");
      }
      const validated = validatePlan(rawPlan, profile);
      if (!validated.pages.length) {
        throw new Error("A IA não conseguiu planejar nenhuma página útil com os dados desta base. Tente novamente ou revise o arquivo.");
      }
      setPlan(validated);
      setActiveSection(validated.pages[0].id);
    } catch (e) {
      setError(e.message || "Não foi possível planejar o dashboard.");
      setRawData(null);
    } finally {
      setPlanning(false);
      setPlanRetryInfo(null);
    }
  }, [rawData, apiKey, model, provider, requirements]);

  const backFromCustomizing = useCallback(() => {
    setCustomizing(false);
    resetAll();
  }, []);

  const [segments, setSegments] = useState([]);
  const [periodFilter, setPeriodFilter] = useState({ year: "", month: "" });

  const filteredData = useMemo(() => (rawData ? applyGlobalFilters(rawData, segments) : null), [rawData, segments]);
  const coreSeries = useMemo(() => (filteredData ? buildCoreSeries(filteredData, periodFilter) : null), [filteredData, periodFilter]);
  const altSeries = useMemo(() => (filteredData ? buildStandaloneSeries(filteredData) : null), [filteredData]);
  // O resumo da base inteira so e calculado quando alguem precisa dele (chat ou analise geral), e nao a cada mudanca de filtro.
  const getDigest = useCallback(() => buildDynamicDigest(plan, filteredData, coreSeries, periodFilter), [plan, filteredData, coreSeries, periodFilter]);
  const caps = useMemo(() => computeCaps(filteredData), [filteredData]);
  const dataProfile = useMemo(() => (rawData ? buildDataProfile(rawData) : null), [rawData]);

  // Salva automaticamente sempre que um dashboard e gerado ou editado (adicionar/remover
  // grafico ou pagina), para a pessoa poder reabrir depois sem subir o arquivo de novo.
  useEffect(() => {
    if (!plan || !rawData) return;
    const id = projectId || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!projectId) setProjectId(id);
    const existing = savedProjects.find((p) => p.id === id);
    const project = {
      id, name: (plan.company_summary || "Base sem nome").slice(0, 90),
      createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
      rawData, plan, requirements, insights, qualityReport,
    };
    saveProjectToDB(project).then(refreshSavedProjects).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);


  // A pagina de Previsões entra no menu se houver historico minimo para projetar
  // ALGUMA coisa (pelo menos 3 meses), seja pelo caminho normal (headcount, quando
  // ha cadastro de funcionarios) ou por series independentes (vagas, contratacoes,
  // desligamentos ou folha, quando a base nao tem funcionarios). Sem isso, regressao
  // linear e simulador nao produzem nada util, entao a pagina inteira fica escondida
  // em vez de exibir graficos vazios ou quebrados.
  const hasHeadcountForecast = !!(coreSeries && coreSeries.headcountByMonth && coreSeries.headcountByMonth.length >= 3);
  const hasStandaloneForecast = !!(altSeries && [altSeries.rsAbertasByMonth, altSeries.rsFechadasByMonth, altSeries.desligamentosByMonth, altSeries.folhaByMonth].some((s) => s.length >= 3));
  const showPrevisoes = hasHeadcountForecast || hasStandaloneForecast;

  const navItems = useMemo(() => {
    if (!plan) return [];
    const dynamicItems = plan.pages.map((p) => ({ id: p.id, label: p.label, icon: iconFor(p.icon_hint) }));
    const items = [...dynamicItems];
    if (showPrevisoes) {
      items.push({ id: "previsoes", label: "Previsões & Cenários", icon: TrendingUp });
    }
    items.push({ id: "chat", label: "Chat IA", icon: MessageCircle });
    if (qualityReport) items.push({ id: "qualidade", label: "Qualidade dos dados", icon: CheckCircle2 });
    return items;
  }, [plan, showPrevisoes, qualityReport]);

  useEffect(() => {
    if (!plan) return;
    const disponiveis = navItems.map((n) => n.id);
    if (!activeSection || !disponiveis.includes(activeSection)) setActiveSection(plan.pages[0].id);
  }, [plan, navItems]);

  const generateInsight = useCallback(async (chartId, dataPayload, contextLabel, chartTitle) => {
    if (!apiKey) {
      setInsights((cur) => ({ ...cur, [chartId]: { error: "Configure sua chave de API (botao no topo da pagina)." } }));
      return;
    }
    // Modelos com raciocinio interno (ex: Gemini com "thinking") podem consumir parte do
    // limite de tokens so pensando, antes de escrever a resposta visivel. Na pratica, a
    // primeira tentativa com um teto baixo quase sempre cortava, e so a segunda (com o
    // dobro) dava certo — entao o teto inicial ja comeca no valor que antes so era
    // alcancado na retentativa, e uma nova retentativa ainda tem margem real pra subir
    // mais uma vez, em vez de ficar presa perto do mesmo teto.
    const previousBudget = insights[chartId]?.maxTokens;
    const maxTokens = previousBudget ? Math.min(previousBudget * 2, 12000) : 4000;
    setInsights((cur) => ({ ...cur, [chartId]: { loading: true, maxTokens } }));
    try {
      const isGeral = chartId === "geral";
      const system = isGeral
        ? `Voce e um analista de People Analytics escrevendo um resumo executivo. Escreva 4 a 6 frases, objetivas, em portugues do Brasil, cobrindo o estado geral desta base de RH, destacando os 2 ou 3 pontos mais importantes para a lideranca prestar atencao agora. Cite numeros relevantes. Nao use markdown. ${WRITING_STYLE_RULE}`
        : `Voce e um analista de People Analytics. Analise APENAS os dados fornecidos abaixo, referentes a um unico grafico do painel, sem falar sobre a empresa como um todo nem sobre outros indicadores que nao estao nesses dados. Escreva uma analise curta (3 a 4 frases, cerca de 70 palavras), objetiva, em portugues do Brasil, destacando o padrao principal nesses dados, um ponto de atencao e, quando fizer sentido, uma sugestao pratica. Nao repita numeros desnecessarios. Nao use markdown. ${WRITING_STYLE_RULE}`;
      const prompt = isGeral
        ? `Resumo agregado de toda a base de RH (JSON):\n${JSON.stringify(dataPayload)}`
        : `Grafico: "${chartTitle || contextLabel}"\nContexto: ${contextLabel}\nDados deste grafico (JSON):\n${JSON.stringify(dataPayload)}`;
      const text = await callClaude(prompt, system, apiKey, model, provider, maxTokens);
      setInsights((cur) => ({ ...cur, [chartId]: { text } }));
    } catch (e) {
      setInsights((cur) => ({ ...cur, [chartId]: { error: e.message || "Falha ao gerar analise.", maxTokens } }));
    }
  }, [apiKey, model, provider, insights]);

  const [addChartState, setAddChartState] = useState({ pageId: null, busy: false, error: null });

  const removeChartFromPage = useCallback((pageId, chartId) => {
    setPlan((cur) => {
      if (!cur) return cur;
      return { ...cur, pages: cur.pages.map((p) => p.id === pageId ? { ...p, charts: p.charts.filter((c) => c.id !== chartId) } : p) };
    });
  }, []);

  const removePage = useCallback((pageId) => {
    setPlan((cur) => {
      if (!cur) return cur;
      const pages = cur.pages.filter((p) => p.id !== pageId);
      if (activeSection === pageId) setActiveSection(pages[0]?.id || null);
      return { ...cur, pages };
    });
  }, [activeSection]);

  const addChartToPage = useCallback(async (pageId, requestText) => {
    if (!apiKey) { setAddChartState({ pageId, busy: false, error: "Configure sua chave de API (botão no topo da página)." }); return; }
    const page = plan?.pages.find((p) => p.id === pageId);
    if (!page) return;
    setAddChartState({ pageId, busy: true, error: null });
    try {
      const profile = buildDataProfile(rawData);
      const result = await planSingleChartWithAI(
        profile, page.label, page.charts.map((c) => c.title), requestText, apiKey, model, provider,
        () => setAddChartState({ pageId, busy: true, error: "Tentando novamente..." })
      );
      if (result.error) throw new Error(result.error);
      const withUniqueId = { ...result.chart, id: `custom-${Date.now()}` };
      const validated = validateChart(profile, withUniqueId);
      if (!validated) throw new Error("O gráfico gerado usa um campo que não existe na base. Tente reformular o pedido.");
      setPlan((cur) => ({ ...cur, pages: cur.pages.map((p) => p.id === pageId ? { ...p, charts: [...p.charts, validated] } : p) }));
      setAddChartState({ pageId: null, busy: false, error: null });
    } catch (e) {
      setAddChartState({ pageId, busy: false, error: e.message || "Não foi possível gerar o gráfico." });
    }
  }, [apiKey, model, provider, plan, rawData]);

  const scrollTo = (id) => {
    setActiveSection(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const settingsProps = { provider, setProvider, anthropicKey, setAnthropicKey, geminiKey, setGeminiKey, anthropicModel, setAnthropicModel, geminiModel, setGeminiModel, apiKey };

  if (planning) {
    return (
      <div className="themed-root" style={themeVars}>
        <style>{`${FONT_IMPORT} .spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>
        <PlanningScreen retryInfo={planRetryInfo} />
      </div>
    );
  }

  if (pendingMapping) {
    return (
      <div className="themed-root" style={themeVars}>
        <style>{`${FONT_IMPORT} .spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>
        <MappingReviewScreen mapping={pendingMapping} onConfirm={confirmMapping} onCancel={cancelMapping} busy={confirming} />
      </div>
    );
  }

  if (customizing) {
    return (
      <div className="themed-root" style={themeVars}>
        <style>{`${FONT_IMPORT} .spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>
        <CustomizationScreen
          paletteId={paletteId} setPaletteId={setPaletteId} darkMode={darkMode} setDarkMode={setDarkMode}
          styleId={styleId} setStyleId={setStyleId}
          requirements={requirements} setRequirements={setRequirements}
          onGenerate={generateDashboard} onBack={backFromCustomizing}
        />
      </div>
    );
  }

  if (!rawData || !plan) {
    return (
      <div className="themed-root" style={themeVars}>
        <style>{`${FONT_IMPORT} .spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 60 }}>
          <SettingsPanel {...settingsProps} />
        </div>
        <UploadScreen
          onFiles={handleFiles} loading={loading} loadingStage={loadingStage} error={error} log={log} apiKey={apiKey} requireApiKey
          savedProjects={savedProjects} onOpenProject={openSavedProject} onDeleteProject={deleteSavedProject}
        />
      </div>
    );
  }

  if (exportMode) {
    return (
      <div className="themed-root" style={themeVars}>
        <style>{`
          ${FONT_IMPORT}
          *{box-sizing:border-box}
          @media print{
            .no-print{display:none !important}
            body{background:#fff !important}
            .export-page{break-after:page}
            .export-page:last-child{break-after:auto}
          }
        `}</style>
        <ExportView
          plan={plan} data={filteredData} coreSeries={coreSeries} periodFilter={periodFilter}
          insights={insights} onGenerate={generateInsight} onExit={() => setExportMode(false)} paletteId={paletteId} styleId={styleId} getDigest={getDigest}
        />
      </div>
    );
  }

  return (
    <div className="themed-root" style={{ ...themeVars, background: T.paper, minHeight: "100vh", fontFamily: "var(--font-body)" }}>
      <style>{`
        ${FONT_IMPORT}
        *{box-sizing:border-box}
        .spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:8px;height:8px}
        ::-webkit-scrollbar-thumb{background:${T.slateLight};border-radius:4px}
        .navbtn:hover{background:${T.forestDark} !important}
        @media (max-width: 860px){
          .scenario-grid{grid-template-columns:1fr !important}
          .forecast-grid{grid-template-columns:1fr !important}
        }
        @media print{
          .no-print{display:none !important}
          body{background:#fff !important}
          .themed-root{
            --c-paper:#F6F4EE !important; --c-paper-raised:#FFFFFF !important; --c-ink:#16213B !important;
            --c-line:#DCD7C9 !important; --c-slate:#6E7488 !important; --c-slate-light:#9AA0B0 !important;
            --c-navy-panel:#1B2740 !important; --c-forest:#2F6F5E !important; --c-forest-dark:#1F4B3F !important;
            --c-amber:#C6852F !important; --c-brick:#A94B3E !important;
            --c-chart-1:#2F6F5E !important; --c-chart-2:#C6852F !important; --c-chart-3:#3E6FA8 !important;
            --c-chart-4:#A94B3E !important; --c-chart-5:#8C6FB0 !important; --c-chart-6:#6E9B7A !important;
            --c-chart-7:#B08A4E !important; --c-chart-8:#5B7C99 !important;
          }
          .export-page{break-after:page}
          .export-page:last-child{break-after:auto}
        }
      `}</style>

      {/* MASTHEAD */}
      <div style={{ background: T.navyPanel, borderBottom: `3px solid ${T.forest}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 24px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", color: "#8FD4B8", textTransform: "uppercase" }}>Painel de pessoas</div>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "#fff", margin: "4px 0 0" }}>Inteligência de RH</h1>
            </div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              <div style={{ alignSelf: "center" }}>
                <SettingsPanel {...settingsProps} />
              </div>
              <button
                onClick={() => setEditMode((v) => !v)}
                className="no-print"
                style={{
                  alignSelf: "center", display: "flex", alignItems: "center", gap: 6,
                  background: editMode ? T.forest : "transparent", border: `1px solid ${editMode ? T.forest : "#3A4A68"}`,
                  color: editMode ? "#fff" : "#B9C2D6", borderRadius: 7, padding: "6px 12px", fontSize: 11.5, fontFamily: "var(--font-body)", cursor: "pointer",
                }}
              >
                <Pencil size={12} /> {editMode ? "Concluir edição" : "Editar dashboard"}
              </button>
              <button
                onClick={() => setExportMode(true)}
                className="no-print"
                style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid #3A4A68", color: "#B9C2D6", borderRadius: 7, padding: "6px 12px", fontSize: 11.5, fontFamily: "var(--font-body)", cursor: "pointer" }}
              >
                <Download size={12} /> Exportar
              </button>
              <button
                onClick={() => setConfirmNewBase(true)}
                className="no-print"
                style={{ alignSelf: "center", background: "transparent", border: "1px solid #3A4A68", color: "#B9C2D6", borderRadius: 7, padding: "6px 12px", fontSize: 11.5, fontFamily: "var(--font-body)", cursor: "pointer" }}
              >
                Nova base
              </button>
            </div>
          </div>
        </div>
        {/* NAV */}
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", display: "flex", gap: 4, overflowX: "auto" }}>
          {navItems.map((n) => {
            const Icon = n.icon;
            const active = activeSection === n.id;
            return (
              <button
                key={n.id}
                className="navbtn"
                onClick={() => scrollTo(n.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", background: active ? T.forest : "transparent",
                  border: "none", color: active ? "#fff" : "#B9C2D6", padding: "9px 13px", borderRadius: "7px 7px 0 0",
                  fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                }}
              >
                <Icon size={13} /> {n.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 80px" }}>
        <FilterBar
          profile={dataProfile} filterFields={plan.filter_fields} rawData={rawData}
          segments={segments} setSegments={setSegments}
          periodFilter={periodFilter} setPeriodFilter={setPeriodFilter}
        />
        {plan.pages.map((p, idx) => activeSection === p.id && (
          <React.Fragment key={p.id}>
            <SectionTitle title={p.label} />
            {idx === 0 && <GeneralAnalysisCard getDigest={getDigest} insights={insights} onGenerate={generateInsight} />}
            <DynamicPage
              page={p} data={filteredData} coreSeries={coreSeries} insights={insights} onGenerate={generateInsight} periodFilter={periodFilter}
              editMode={editMode}
              onRemoveChart={(chartId) => removeChartFromPage(p.id, chartId)}
              onRemovePage={() => removePage(p.id)}
              onAddChart={(text) => addChartToPage(p.id, text)}
              addChartBusy={addChartState.pageId === p.id && addChartState.busy}
              addChartError={addChartState.pageId === p.id ? addChartState.error : null}
            />
          </React.Fragment>
        ))}
        {activeSection === "previsoes" && (
          <>
            <SectionTitle eyebrow="Machine learning" title="Previsões e simulador de cenários" />
            {coreSeries ? (
              <>
                <PageIntro text="Projeções estatísticas simples e um simulador para testar premissas, calculados só com os dados que a sua base tem. Estas ferramentas são fixas e não fazem parte do plano dinâmico da IA." />
                <ForecastSection agg={coreSeries} alt={null} insights={insights} onGenerate={generateInsight} />
                <div style={{ height: 26 }} />
                {caps.turnover && usableRiskDimensions(coreSeries.riskModel, RISK_DIMENSIONS).length > 0 ? (
                  <RiskPredictor agg={coreSeries} apiKey={apiKey} model={model} provider={provider} />
                ) : (
                  <div style={{ background: T.paperRaised, border: `1px solid ${T.line}`, borderRadius: 12, padding: "20px 22px", fontFamily: "var(--font-body)", fontSize: 12.5, color: T.slateLight }}>
                    {caps.turnover
                      ? "A base enviada não tem categorias (área, idade, tempo de empresa, entre outras) com mais de um valor para montar perfis de risco de saída."
                      : "A base enviada não tem dados de desligamento suficientes para calcular risco de saída por perfil."}
                  </div>
                )}
                <div style={{ height: 26 }} />
                <ScenarioSimulator agg={coreSeries} />
              </>
            ) : (
              <>
                <PageIntro text="Esta base não tem um cadastro de funcionários, então as projeções abaixo usam apenas as tabelas disponíveis. O simulador de cenário e o preditor de risco por perfil exigem dados de funcionários e não estão disponíveis aqui." />
                <ForecastSection agg={null} alt={altSeries} insights={insights} onGenerate={generateInsight} />
              </>
            )}
          </>
        )}
        {activeSection === "qualidade" && qualityReport && (
          <>
            <SectionTitle eyebrow="Transparência" title="Qualidade dos dados" />
            <PageIntro text="Antes de montar o painel, a base passou por uma limpeza automática. Aqui está, em números, o que foi encontrado e corrigido." />
            <DataQualityPage report={qualityReport} />
          </>
        )}
        {activeSection === "chat" && (
          <>
            <SectionTitle eyebrow="Pergunte aos dados" title="Chat com IA" />
            <PageIntro text="Converse em linguagem natural com o resumo agregado da sua base de RH." />
            <ChatPanel getDigest={getDigest} apiKey={apiKey} model={model} provider={provider} profile={dataProfile} rawData={filteredData} />
          </>
        )}

        <div style={{ marginTop: 40, paddingTop: 18, borderTop: `1px solid ${T.line}`, fontFamily: "var(--font-body)", fontSize: 11, color: T.slateLight, textAlign: "center" }}>
          Páginas e gráficos planejados por IA a partir da sua base, com processamento local no navegador e análises via {provider === "gemini" ? "Google Gemini" : "Anthropic Claude"}
        </div>
      </div>
      {confirmNewBase && (
        <ConfirmDialog
          title="Começar uma nova base?"
          message="Isso vai fechar o dashboard atual. Fique tranquilo, ele já está salvo e você pode reabrir quando quiser, na tela inicial, em Projetos salvos."
          confirmLabel="Sim, começar nova base"
          cancelLabel="Cancelar"
          onConfirm={() => { setConfirmNewBase(false); resetAll(); }}
          onCancel={() => setConfirmNewBase(false)}
        />
      )}
    </div>
  );
}
