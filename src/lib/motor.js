/* Motor de calculo do painel: perfil da base, validacao do plano da IA e calculo dos numeros.
   A IA decide O QUE mostrar; tudo aqui e codigo deterministico, sem React nem rede,
   por isso pode ser testado isoladamente (npm test). */
import { normalizeKey } from "./limpeza.js";

export const MONTH_ABBR = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function monthKey(d) {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(key) {
  const [y, m] = key.split("-");
  return `${MONTH_ABBR[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}
export function endOfMonth(y, m) {
  return new Date(y, m + 1, 0, 23, 59, 59);
}
export function addMonths(key, n) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}
export function monthsBetween(startKey, endKey) {
  const out = [];
  let cur = startKey;
  let guard = 0;
  while (cur <= endKey && guard < 600) {
    out.push(cur);
    cur = addMonths(cur, 1);
    guard++;
  }
  return out;
}

/** Filtro de periodo por calendario (ano e/ou mes especificos), no lugar de um contador
 *  relativo tipo "ultimos N meses" — mesKey e sempre "AAAA-MM". Vazio ("") em year/month
 *  significa "todos". Usado tanto nas series fixas (buildCoreSeries) quanto em qualquer
 *  grafico dinamico agrupado por mes (computeChartData/computeCrossTabData). */
export function matchesPeriodFilter(mesKey, periodFilter) {
  if (!periodFilter || (!periodFilter.year && !periodFilter.month)) return true;
  if (periodFilter.year && !mesKey.startsWith(periodFilter.year)) return false;
  if (periodFilter.month && !mesKey.endsWith(`-${periodFilter.month}`)) return false;
  return true;
}

export const CHART_TYPES = ["bar", "bar_horizontal", "line", "area", "pie", "radar"];
export const AGG_TYPES = ["count", "sum", "avg", "median", "min", "max"];
export const FILTER_OPS = ["eq", "neq", "not_null", "gt", "lt"];
export const ICON_HINTS = ["users", "user-minus", "briefcase", "dollar", "pie", "trending-up", "target", "activity", "heart", "bar-chart"];

export const IDENTIFYING_FIELDS = ["nome", "matricula", "cpf"];
export const SENSITIVE_NUMERIC_FIELDS = ["salario_atual", "salario_inicial", "salario_base", "custo_total_ctc", "bonus_comissao"];
export const MIN_GROUP_SIZE_FOR_SENSITIVE = 5;

export function isSensitiveMetric(metric) {
  return !!(metric && metric.field && SENSITIVE_NUMERIC_FIELDS.includes(metric.field) && metric.agg !== "count");
}

/* ============================================================================
   PERFIL DOS DADOS (deterministico, base para o planejamento dinamico da IA)
============================================================================ */
export const TABLE_LABELS = {
  funcionarios: "Cadastro de funcionários",
  desligamentos: "Desligamentos",
  folha: "Folha de pagamento",
  rs: "Recrutamento e seleção (vagas)",
  entrevistas: "Entrevistas de desligamento e pesquisa",
  movimentacoes: "Movimentações de carreira",
};

const NO_SAMPLE_FIELDS = new Set([...IDENTIFYING_FIELDS, "recrutador_responsavel", "id_vaga"]);
const MAX_SAMPLE_CARDINALITY = 30;
/** Minimo e maximo por laco: `Math.min(...lista)` estoura a pilha com listas muito grandes (acima de ~100 mil itens). */
function minOf(list) { let m = Infinity; for (let i = 0; i < list.length; i++) if (list[i] < m) m = list[i]; return m; }
function maxOf(list) { let m = -Infinity; for (let i = 0; i < list.length; i++) if (list[i] > m) m = list[i]; return m; }
export function describeField(rows, field) {
  const vals = rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined && v !== "");
  if (!vals.length) return null;
  const nonNullPct = Math.round((vals.length / rows.length) * 100);
  const sample = vals[0];
  if (sample instanceof Date) {
    const times = vals.filter((v) => v instanceof Date).map((v) => v.getTime()).filter((t) => !isNaN(t));
    if (!times.length) return null;
    return { type: "date", non_null_pct: nonNullPct, min: new Date(minOf(times)).toISOString().slice(0, 10), max: new Date(maxOf(times)).toISOString().slice(0, 10) };
  }
  if (typeof sample === "number") {
    const nums = vals.filter((v) => typeof v === "number" && !isNaN(v));
    if (!nums.length) return null;
    return { type: "numeric", non_null_pct: nonNullPct, min: minOf(nums), max: maxOf(nums), avg: +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) };
  }
  const uniq = [...new Set(vals.map(String))];
  const out = { type: "categorical", non_null_pct: nonNullPct, cardinality: uniq.length };
  // Privacidade: o perfil e enviado a IA. Campos que identificam pessoas (nome, CPF, matricula, responsavel)
  // e campos com muitos valores distintos (que se parecem com identificadores ou texto livre) nunca levam exemplos.
  if (!NO_SAMPLE_FIELDS.has(field) && !String(field).startsWith("matricula") && uniq.length <= MAX_SAMPLE_CARDINALITY) {
    out.sample_values = uniq.slice(0, 8);
  }
  return out;
}

export function buildDataProfile(data) {
  const profile = {};
  Object.keys(TABLE_LABELS).forEach((table) => {
    const rows = data[table] || [];
    if (!rows.length) { profile[table] = { label: TABLE_LABELS[table], row_count: 0 }; return; }
    const fields = {};
    Object.keys(rows[0]).forEach((f) => {
      const d = describeField(rows, f);
      if (d) fields[f] = d;
    });
    profile[table] = { label: TABLE_LABELS[table], row_count: rows.length, fields };
  });
  return profile;
}

export const JOINABLE_WITH_FUNCIONARIOS = ["desligamentos", "folha", "movimentacoes", "entrevistas"];

export function fieldExists(profile, table, field) {
  if (profile[table] && profile[table].fields && profile[table].fields[field]) return true;
  // campos de "funcionarios" (genero, area, senioridade...) tambem sao aceitos em outras
  // tabelas que tenham matricula — o motor de calculo cruza automaticamente por matricula.
  if (JOINABLE_WITH_FUNCIONARIOS.includes(table) && profile.funcionarios && profile.funcionarios.fields && profile.funcionarios.fields[field]) return true;
  return false;
}
export function validFilters(profile, table, filters) {
  if (!Array.isArray(filters)) return [];
  return filters.filter((f) => f && f.field && FILTER_OPS.includes(f.op) && fieldExists(profile, table, f.field));
}
export function fieldType(profile, table, field) {
  if (profile[table] && profile[table].fields && profile[table].fields[field]) return profile[table].fields[field].type;
  if (JOINABLE_WITH_FUNCIONARIOS.includes(table) && profile.funcionarios && profile.funcionarios.fields && profile.funcionarios.fields[field]) return profile.funcionarios.fields[field].type;
  return null;
}
export function validateChart(profile, c) {
  if (!c || !c.id || !c.title || !CHART_TYPES.includes(c.chart_type)) return null;
  if (c.special === "headcount_trend" || c.special === "turnover_trend") {
    if (!profile.funcionarios || !profile.funcionarios.fields) return null;
    return { ...c, filters: [] };
  }
  if (!c.source || !TABLE_LABELS[c.source] || !profile[c.source] || !profile[c.source].fields) return null;
  const filters = validFilters(profile, c.source, c.filters).filter((f) => !IDENTIFYING_FIELDS.includes(f.field));
  let group_by = null;
  if (c.group_by && c.group_by.field && !IDENTIFYING_FIELDS.includes(c.group_by.field) && fieldExists(profile, c.source, c.group_by.field)) {
    // O "kind" e derivado do tipo REAL do campo (nunca confiamos no que a IA declarou aqui):
    // se o campo e uma data de verdade, SEMPRE agrupamos por mes — nunca por valor cru
    // (que geraria rotulos horriveis tipo "Thu Aug 20 2026 00:00:00 GMT..."), mesmo que a
    // IA tenha pedido kind:"category" por engano. O tipo pode vir da propria tabela ou,
    // em campos cruzados (ex: "genero" usado com source:"folha"), do perfil de funcionarios.
    const kind = fieldType(profile, c.source, c.group_by.field) === "date" ? "month" : "category";
    group_by = { kind, field: c.group_by.field };
  }
  const metric = c.metric && AGG_TYPES.includes(c.metric.agg)
    ? { agg: c.metric.agg, field: c.metric.agg === "count" ? null : (c.metric.field && fieldExists(profile, c.source, c.metric.field) ? c.metric.field : null) }
    : { agg: "count", field: null };
  if (metric.agg !== "count" && !metric.field) return null;
  if (!group_by) return null;

  // Segunda dimensao opcional (crosstab, ex: "genero por cargo") — vira barras empilhadas.
  // So aceita campo categorico (nao data, nao numerico) diferente do campo principal.
  let series_by = null;
  if (c.series_by && c.series_by.field && c.series_by.field !== group_by.field
      && !IDENTIFYING_FIELDS.includes(c.series_by.field) && fieldExists(profile, c.source, c.series_by.field)) {
    const svType = fieldType(profile, c.source, c.series_by.field);
    if (svType === "categorical") series_by = { field: c.series_by.field };
  }
  // Crosstab so faz sentido visualmente como barra — forca o tipo se a IA pediu outro
  const chart_type = series_by ? (["bar", "bar_horizontal"].includes(c.chart_type) ? c.chart_type : "bar") : c.chart_type;

  return { ...c, chart_type, filters, group_by, series_by, metric, sort: c.sort || "none", limit: c.limit || null };
}
export function validateKpi(profile, k) {
  if (!k || !k.id || !k.label || !k.source || !TABLE_LABELS[k.source] || !profile[k.source] || !profile[k.source].fields) return null;
  const filters = validFilters(profile, k.source, k.filters);
  const agg = AGG_TYPES.includes(k.agg) ? k.agg : "count";
  const field = agg === "count" ? null : (k.field && fieldExists(profile, k.source, k.field) ? k.field : null);
  if (agg !== "count" && !field) return null;
  const format = ["number", "currency", "percent"].includes(k.format) ? k.format : "number";
  return { ...k, filters, agg, field, format };
}
/** Confere os campos de filtro global propostos pela IA (plan.filter_fields) contra o
 *  perfil real — so sobrevive campo que existe, e categorico, e tem cardinalidade util (2 a
 *  30 valores distintos). A IA decide QUAIS campos importam mais para segmentar essa base
 *  especifica (ate 6, na ordem de importancia que ela propos); o codigo sempre confere e
 *  limita — nunca confia cegamente na escolha. Duplicatas sao descartadas. */
export function validateFilterFields(filterFields, profile) {
  const seen = new Set();
  const valid = [];
  (filterFields || []).forEach((f) => {
    if (!f || !f.table || !f.field) return;
    const d = profile[f.table] && profile[f.table].fields && profile[f.table].fields[f.field];
    if (!d || d.type !== "categorical" || d.cardinality < 2 || d.cardinality > 30) return;
    const key = `${f.table}:${f.field}`;
    if (seen.has(key)) return;
    seen.add(key);
    valid.push({ table: f.table, field: f.field });
  });
  return valid.slice(0, 6);
}
export function validatePlan(plan, profile) {
  const pages = (plan.pages || [])
    .map((p) => {
      if (!p || !p.id || !p.label) return null;
      const kpis = (p.kpis || []).map((k) => validateKpi(profile, k)).filter(Boolean);
      const charts = (p.charts || []).map((c) => validateChart(profile, c)).filter(Boolean);
      if (!kpis.length && !charts.length) return null;
      return { id: p.id, label: p.label, icon_hint: ICON_HINTS.includes(p.icon_hint) ? p.icon_hint : "bar-chart", kpis, charts };
    })
    .filter(Boolean);
  const filterFields = validateFilterFields(plan.filter_fields, profile);
  return { ...plan, pages, filter_fields: filterFields };
}

/* ============================================================================
   MOTOR DE CALCULO GENERICO (executa os specs contra os dados reais —
   a IA decide O QUE calcular, o codigo sempre calcula os numeros de verdade)
============================================================================ */
export function applyFilterOp(val, op, target) {
  if (op === "not_null") return val !== null && val !== undefined && val !== "";
  if (op === "gt") return typeof val === "number" && val > target;
  if (op === "lt") return typeof val === "number" && val < target;
  const nv = normalizeKey(String(val ?? ""));
  const nt = normalizeKey(String(target ?? ""));
  if (op === "eq") return nv === nt;
  if (op === "neq") return nv !== nt;
  return true;
}
export function applyFilters(rows, filters) {
  if (!filters || !filters.length) return rows;
  return rows.filter((r) => filters.every((f) => applyFilterOp(r[f.field], f.op, f.value)));
}
/** Enriquece linhas de outras tabelas (folha, desligamentos, movimentacoes, entrevistas)
 *  com os atributos do funcionario correspondente (genero, area, senioridade...), casando
 *  por matricula — permite graficos/KPIs tipo "CTC por genero" mesmo com genero e custo_total_ctc
 *  vivendo em tabelas diferentes. So preenche campos que a linha original ainda nao tem
 *  (nunca sobrescreve um campo proprio da tabela, ex: nunca mexe no "status" de desligamentos). */
const funcByIdCache = new WeakMap(); // lista de funcionarios -> Map(matricula -> funcionario), montado uma vez
function funcionariosById(list) {
  let m = funcByIdCache.get(list);
  if (!m) { m = new Map(list.map((f) => [f.matricula, f])); funcByIdCache.set(list, m); }
  return m;
}
/** Acrescenta a cada linha os campos do cadastro de funcionarios (cruzamento por matricula).
 *  `needed` (opcional) e a lista de campos que o calculo vai realmente usar: se todas as linhas ja os tem,
 *  o cruzamento e pulado, porque nao mudaria o resultado (e copiar milhares de linhas custa caro). */
export function joinWithFuncionarios(rows, source, data, needed) {
  if (source === "funcionarios" || !JOINABLE_WITH_FUNCIONARIOS.includes(source) || !rows.length) return rows;
  if (needed && rows.every((r) => needed.every((f) => f in r))) return rows;
  const funcById = funcionariosById(data.funcionarios || []);
  if (needed) {
    // So os campos que o calculo vai ler sao copiados do cadastro (bem mais barato que copiar o cadastro inteiro).
    return rows.map((r) => {
      const f = r.matricula !== undefined && r.matricula !== null ? funcById.get(r.matricula) : null;
      if (!f) return r;
      let merged = null;
      for (let i = 0; i < needed.length; i++) {
        const k = needed[i];
        if (!(k in r) && k in f) { if (!merged) merged = { ...r }; merged[k] = f[k]; }
      }
      return merged || r;
    });
  }
  return rows.map((r) => {
    const f = r.matricula !== undefined && r.matricula !== null ? funcById.get(r.matricula) : null;
    if (!f) return r;
    const merged = { ...r };
    Object.keys(f).forEach((k) => { if (!(k in merged)) merged[k] = f[k]; });
    return merged;
  });
}
/** Campos de uma especificacao (grafico ou indicador) que o calculo le nas linhas. */
function fieldsUsedBy(spec) {
  const out = [];
  if (spec.group_by && spec.group_by.field) out.push(spec.group_by.field);
  if (spec.series_by && spec.series_by.field) out.push(spec.series_by.field);
  if (spec.metric && spec.metric.field) out.push(spec.metric.field);
  if (spec.field) out.push(spec.field);
  (spec.filters || []).forEach((f) => { if (f && f.field) out.push(f.field); });
  return out;
}
export function computeAgg(rows, metric) {
  if (!metric || metric.agg === "count") return rows.length;
  const vals = rows.map((r) => r[metric.field]).filter((v) => typeof v === "number" && !isNaN(v));
  if (!vals.length) return 0;
  if (metric.agg === "sum") return +vals.reduce((a, b) => a + b, 0).toFixed(2);
  if (metric.agg === "avg") return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
  if (metric.agg === "min") return minOf(vals);
  if (metric.agg === "max") return maxOf(vals);
  if (metric.agg === "median") {
    const sorted = vals.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return +(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2).toFixed(2);
  }
  return 0;
}
/** Um registro "esta dentro do periodo" selecionado (Ano/Mes na barra de filtro) se tiver
 *  AO MENOS UM campo de data (canonico ou extra, qualquer um — generico, sem precisar saber
 *  qual e "a" data certa de cada tabela) cujo ano/mes bate com o filtro. Ex: a tabela "rs"
 *  tem "data_abertura" E "data_fechamento" — uma vaga fechada em marco deve aparecer no
 *  filtro "Marco" mesmo que ela tenha sido aberta em janeiro. Sem filtro ativo, sempre true.
 *
 *  CASO ESPECIAL — "data_admissao": diferente de um evento pontual (vaga aberta, desligamento,
 *  movimentacao), admissao e o INICIO de um vinculo que pode continuar aberto ate hoje. Se
 *  tratassemos isso como "alguma data bate exatamente com o periodo", um funcionario ativo
 *  admitido ha anos sumiria do KPI "Funcionarios ativos" so por filtrar o ano atual — o que
 *  nao faz sentido (o ano atual e "agora", deveria bater com o numero sem filtro nenhum).
 *  Em vez disso, checa SOBREPOSICAO: o vinculo (admissao -> desligamento ou hoje, se ainda
 *  ativo) cruza com a janela do periodo selecionado? So aplica esse caso quando a propria
 *  linha tem "data_admissao" (ou seja, so na tabela "funcionarios" — ver nota abaixo sobre
 *  a ordem de chamada em relacao ao cruzamento com funcionarios). */
export function periodRange(periodFilter) {
  const year = periodFilter.year ? Number(periodFilter.year) : new Date().getFullYear();
  const month = periodFilter.month ? Number(periodFilter.month) : null;
  if (month) return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
  return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}
export function rowMatchesPeriod(row, periodFilter) {
  if (!periodFilter || (!periodFilter.year && !periodFilter.month)) return true;
  const adm = row.data_admissao;
  if (adm instanceof Date && !isNaN(adm)) {
    const { start, end } = periodRange(periodFilter);
    const deslig = row.data_desligamento;
    const seguiaNoVinculo = !(deslig instanceof Date && !isNaN(deslig)) || deslig >= start;
    return adm < end && seguiaNoVinculo;
  }
  return Object.values(row).some((v) => {
    if (v instanceof Date && !isNaN(v)) {
      if (periodFilter.year && String(v.getFullYear()) !== periodFilter.year) return false;
      if (periodFilter.month && String(v.getMonth() + 1).padStart(2, "0") !== periodFilter.month) return false;
      return true;
    }
    // Campos tipo "competencia" da folha, guardados como texto "AAAA-MM" em vez de Date.
    if (typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return matchesPeriodFilter(v, periodFilter);
    return false;
  });
}
export function computeKpiValue(kpi, data, periodFilter) {
  // O filtro de periodo roda ANTES do cruzamento com funcionarios (joinWithFuncionarios):
  // assim "data_admissao" em rowMatchesPeriod so aparece quando a linha E de fato um
  // funcionario, nunca "emprestada" de um JOIN — senao uma linha de folha/desligamento
  // passaria a usar a janela de vinculo do funcionario em vez da sua propria data de evento.
  let rows = (data[kpi.source] || []).filter((r) => rowMatchesPeriod(r, periodFilter));
  rows = applyFilters(joinWithFuncionarios(rows, kpi.source, data, fieldsUsedBy(kpi)), kpi.filters);
  return computeAgg(rows, { agg: kpi.agg, field: kpi.field });
}
/** Calcula um grafico de 2 dimensoes (ex: "genero por cargo"): uma categoria principal no
 *  eixo, e uma segunda categoria quebrando cada barra em series empilhadas. Retorna o
 *  mesmo formato {name, ...} de sempre, so que com uma chave dinamica por valor da segunda
 *  dimensao em vez de uma unica chave "value" — o renderizador detecta isso via spec.series_by. */
/** Ordem natural para rotulos que comecam com numeros ("até 30 dias", "31 a 60 dias", "0-3 meses"):
 *  ordena pelo primeiro numero do rotulo, em vez da ordem em que apareceram nas linhas.
 *  So age quando TODOS os rotulos (exceto textos sem numero, que vao para o fim) tem numero. */
export function naturalLabelOrder(entries) {
  const num = (name) => { const m = String(name).match(/\d+/); return m ? Number(m[0]) : null; };
  const withNum = entries.filter((e) => num(e.name) !== null);
  if (withNum.length < 2 || entries.length - withNum.length > 3) return entries;
  const rest = entries.filter((e) => num(e.name) === null);
  return [...withNum.sort((a, b) => num(a.name) - num(b.name)), ...rest];
}
export function computeCrossTabData(spec, rows, periodFilter) {
  const cells = {}; // chave primaria -> { chave secundaria -> linhas[] }
  const order = [];
  const seriesSet = new Set();
  rows.forEach((r) => {
    let key;
    if (spec.group_by.kind === "month") {
      const d = r[spec.group_by.field];
      if (!(d instanceof Date) || isNaN(d)) return;
      key = monthKey(d);
    } else {
      const v = r[spec.group_by.field];
      key = v instanceof Date && !isNaN(v) ? monthKey(v) : (v === null || v === undefined || v === "" ? "Não informado" : String(v));
    }
    const sv = r[spec.series_by.field];
    const seriesKey = sv === null || sv === undefined || sv === "" ? "Não informado" : String(sv);
    seriesSet.add(seriesKey);
    if (!cells[key]) { cells[key] = {}; order.push(key); }
    if (!cells[key][seriesKey]) cells[key][seriesKey] = [];
    cells[key][seriesKey].push(r);
  });

  const looksLikeYearMonth = spec.group_by.kind !== "month" && order.length > 0 && order.every((k) => /^\d{4}-(0[1-9]|1[0-2])$/.test(k));
  const isMonthLike = spec.group_by.kind === "month" || looksLikeYearMonth;
  const seriesKeys = [...seriesSet].sort();
  const sensitive = isSensitiveMetric(spec.metric);

  let entries = order.map((key) => {
    const row = { name: isMonthLike ? monthLabel(key) : key, _sortKey: key };
    seriesKeys.forEach((sk) => {
      const cellRows = cells[key][sk] || [];
      row[sk] = (sensitive && cellRows.length > 0 && cellRows.length < MIN_GROUP_SIZE_FOR_SENSITIVE) ? null : (cellRows.length ? computeAgg(cellRows, spec.metric) : 0);
    });
    return row;
  });

  if (isMonthLike) {
    entries.sort((a, b) => (a._sortKey < b._sortKey ? -1 : 1));
    entries = entries.filter((e) => matchesPeriodFilter(e._sortKey, periodFilter));
  } else if (spec.sort === "value_desc" || spec.sort === "value_asc") {
    const total = (row) => seriesKeys.reduce((s, k) => s + (row[k] || 0), 0);
    entries.sort((a, b) => (spec.sort === "value_desc" ? total(b) - total(a) : total(a) - total(b)));
  } else if (spec.sort === "label_asc") {
    entries.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    entries = naturalLabelOrder(entries);
  }
  if (spec.limit) entries = entries.slice(0, spec.limit);

  return entries.map(({ _sortKey, ...rest }) => rest);
}

export function computeChartData(spec, data, coreSeries, periodFilter) {
  if (spec.special === "headcount_trend") {
    return (coreSeries?.headcountByMonth || []).map((h) => ({ name: h.label, value: h.ativos }));
  }
  if (spec.special === "turnover_trend") {
    return (coreSeries?.turnoverByMonth || []).map((t) => ({ name: t.label, value: t.taxa }));
  }
  // Filtro de periodo ANTES do cruzamento com funcionarios, pelo mesmo motivo de
  // computeKpiValue: evita que "data_admissao" emprestada via JOIN faca uma linha de outra
  // tabela (folha, desligamentos...) usar a janela de vinculo do funcionario em vez da sua
  // propria data de evento. Tambem cobre o que faltava antes: so grafico com group_by:"month"
  // respeitava Ano/Mes (via o filtro de _sortKey mais abaixo); um grafico agrupado por
  // categoria (ex: "Vagas por Status") ignorava o periodo inteiramente.
  let rows = (data[spec.source] || []).filter((r) => rowMatchesPeriod(r, periodFilter));
  rows = applyFilters(joinWithFuncionarios(rows, spec.source, data, fieldsUsedBy(spec)), spec.filters);

  if (spec.series_by && spec.series_by.field) {
    return computeCrossTabData(spec, rows, periodFilter);
  }

  const groups = {};
  const order = [];
  rows.forEach((r) => {
    let key;
    if (spec.group_by.kind === "month") {
      const d = r[spec.group_by.field];
      if (!(d instanceof Date) || isNaN(d)) return;
      key = monthKey(d);
    } else {
      const v = r[spec.group_by.field];
      // defesa extra: se por algum motivo cair aqui um valor que e Date de verdade,
      // trata como mes em vez de deixar o texto cru do Date.toString() virar rotulo
      key = v instanceof Date && !isNaN(v)
        ? monthKey(v)
        : (v === null || v === undefined || v === "" ? "Não informado" : String(v));
    }
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(r);
  });
  // Mesmo quando o campo nao e um Date de verdade (ex: "competencia" armazenada como
  // texto "2024-08"), se TODAS as chaves parecem "AAAA-MM" tratamos como serie mensal:
  // formata como "Mes/Ano" e ordena cronologicamente, em vez de deixar o texto cru.
  const looksLikeYearMonth = spec.group_by.kind !== "month" && order.length > 0 && order.every((k) => /^\d{4}-(0[1-9]|1[0-2])$/.test(k));
  const isMonthLike = spec.group_by.kind === "month" || looksLikeYearMonth;

  let entries = order.map((key) => ({
    name: isMonthLike ? monthLabel(key) : key,
    _sortKey: key,
    value: (isSensitiveMetric(spec.metric) && groups[key].length < MIN_GROUP_SIZE_FOR_SENSITIVE) ? null : computeAgg(groups[key], spec.metric),
  }));
  if (isMonthLike) {
    entries.sort((a, b) => (a._sortKey < b._sortKey ? -1 : 1));
    entries = entries.filter((e) => matchesPeriodFilter(e._sortKey, periodFilter));
  } else if (spec.sort === "value_desc") {
    entries.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  } else if (spec.sort === "value_asc") {
    entries.sort((a, b) => (a.value ?? -1) - (b.value ?? -1));
  } else if (spec.sort === "label_asc") {
    entries.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    entries = naturalLabelOrder(entries);
  }
  if (spec.limit) entries = entries.slice(0, spec.limit);
  return entries.map(({ name, value }) => ({ name, value }));
}

/* ============================================================================
   FILTROS GLOBAIS DO DASHBOARD (segmentacao por categoria + janela de tempo)
   O plano de paginas/graficos e decidido uma vez pela IA; os filtros so recalculam
   os valores dentro dos graficos ja existentes, sem precisar replanejar nada.
============================================================================ */
/** Segmenta a base por multiplos filtros combinados (E logico) — ex: area=Engenharia
 *  E senioridade=Senior ao mesmo tempo. `segments` e uma lista de {field, value}. */
/** Cada segmento agora carrega {table, field, value} — nao so {field, value} — porque o
 *  mesmo filtro (ex: "status") pode existir em tabelas diferentes, e porque tabelas sem
 *  vinculo de matricula (ex: "rs"/vagas) precisam filtrar a si mesmas diretamente em vez
 *  de so cascatear a partir de funcionarios. */
export function applyGlobalFilters(data, segments) {
  if (!data || !segments || !segments.length) return data;
  const funcSegments = segments.filter((s) => s.table === "funcionarios");
  // matriculas permitidas pelos filtros de funcionarios (null = nenhum filtro desse tipo ativo)
  const allowed = funcSegments.length
    ? new Set(
        (data.funcionarios || [])
          .filter((f) => funcSegments.every((s) => String(f[s.field] ?? "Não informado") === s.value))
          .map((f) => f.matricula)
      )
    : null;
  // Aplica os filtros proprios de UMA tabela (ex: "status"/"filial" da propria vaga em "rs")
  const bySegmentsOf = (table, rows) => {
    const own = segments.filter((s) => s.table === table);
    if (!own.length) return rows;
    return rows.filter((r) => own.every((s) => String(r[s.field] ?? "Não informado") === s.value));
  };
  // Tabelas ligadas a funcionarios por matricula: cascateia o filtro de funcionarios
  // (quando ativo) e ainda aplica os filtros proprios dessa tabela, se houver.
  const cascade = (table) => {
    let rows = data[table] || [];
    if (allowed) rows = rows.filter((r) => allowed.has(r.matricula));
    return bySegmentsOf(table, rows);
  };
  return {
    funcionarios: cascade("funcionarios"),
    desligamentos: cascade("desligamentos"),
    folha: cascade("folha"),
    entrevistas: cascade("entrevistas"),
    movimentacoes: cascade("movimentacoes"),
    // "rs" (vagas) nao tem matricula vinculada em toda linha (so quando a vaga foi
    // preenchida) — por isso nao entra no cascade de funcionario, mas filtra normalmente
    // pelos seus proprios campos (status da vaga, filial, classificacao, negocio etc.,
    // incluindo campos extras do Caminho B como "Status Vaga"/"Filial"/"Classificação").
    rs: bySegmentsOf("rs", data.rs || []),
  };
}

/* ============================================================================
   CUSTO DE FOLHA: usa so o que a base realmente tem
   A previsao e o simulador de cenarios nunca devem mostrar "CTC" quando a base nao tem
   CTC. Esta funcao escolhe a melhor medida de custo disponivel na folha (CTC; se nao houver,
   o salario base; se nao houver nenhum, nada) e os graficos so aparecem quando ha medida.
============================================================================ */
function hasNumbers(rows, field) {
  return rows.some((r) => typeof r[field] === "number" && !isNaN(r[field]));
}
function sumNumbers(rows, field) {
  return rows.reduce((a, r) => a + (typeof r[field] === "number" && !isNaN(r[field]) ? r[field] : 0), 0);
}
export function resolveCostMeasure(folha) {
  const rows = folha || [];
  if (hasNumbers(rows, "custo_total_ctc")) {
    const totalBase = sumNumbers(rows, "salario_base");
    return {
      field: "custo_total_ctc", label: "custo de folha (CTC)",
      // quanto o CTC pesa sobre o salario base, na propria base (so existe se houver salario base)
      factorOverBase: totalBase > 0 ? sumNumbers(rows, "custo_total_ctc") / totalBase : null,
    };
  }
  if (hasNumbers(rows, "salario_base")) return { field: "salario_base", label: "folha de salários (salário base)", factorOverBase: null };
  return null;
}
/** Total do campo de custo por competencia (AAAA-MM); so entram meses com algum valor numerico. */
export function costByMonth(folha, field) {
  const map = {};
  (folha || []).forEach((f) => {
    if (!f.competencia || typeof f[field] !== "number" || isNaN(f[field])) return;
    map[f.competencia] = (map[f.competencia] || 0) + f[field];
  });
  return Object.keys(map).sort().map((mes) => ({ mes, label: monthLabel(mes), total: Math.round(map[mes]) }));
}
/** Como o simulador de cenarios projeta o custo: devolve null quando nao ha base para isso
 *  (sem salario nenhum). Com CTC e salario base usa a razao real; senao, so salarios (sem encargos). */
export function resolvePayrollSimulation(cost, avgSalary) {
  if (!(avgSalary > 0)) return null;
  if (cost && cost.field === "custo_total_ctc" && cost.factorOverBase) {
    return { factor: cost.factorOverBase, label: "Custo de folha (CTC), base e cenário", usesCtc: true };
  }
  return { factor: 1, label: "Folha de salários (sem encargos e benefícios), base e cenário", usesCtc: false };
}

/* ============================================================================
   TELAS FIXAS: so mostram o que a base tem
============================================================================ */
/** Valor de categoria "de verdade": null para vazio ou para o texto "Não informado". */
export function realCategory(v) {
  if (v === null || v === undefined || v === "" || v === "Não informado") return null;
  return v;
}
/** Dimensoes do simulador de risco que a base sustenta: precisam de 2 ou mais categorias
 *  reais (uma dimensao com um valor so, ou so "Não informado", nao distingue ninguem). */
export function usableRiskDimensions(riskModel, dimensions) {
  return (dimensions || []).filter(({ key }) => {
    const groups = Object.keys((riskModel && riskModel[key]) || {}).filter((g) => realCategory(g) !== null);
    return groups.length >= 2;
  });
}
/** Rotulos das tabelas que existem de fato no perfil da base (para o chat dizer sobre o que pode responder). */
export function availableTableLabels(profile) {
  return Object.keys(TABLE_LABELS).filter((t) => profile && profile[t] && profile[t].row_count > 0).map((t) => TABLE_LABELS[t]);
}
