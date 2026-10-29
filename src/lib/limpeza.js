/* Limpeza e padronizacao de dados (etapa "T" do ETL). Funcoes puras, sem React nem rede:
   por isso podem ser testadas isoladamente (npm test). */

export function toDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === "number") {
    // serial excel
    // Numero fora de um intervalo plausivel de serial do Excel (1900 a 2100) nao e data: vira vazio,
    // em vez de um objeto "Invalid Date" que quebraria o perfil e os graficos mais adiante.
    if (!(v >= 1 && v <= 73415)) return null;
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + v * 86400000);
  }
  const s = String(v).trim();
  if (isNullToken(s)) return null;

  // dd/mm/aaaa ou dd-mm-aaaa (formato brasileiro, comum em CSV), com hora opcional.
  // CSV nao tem tipo de data nativo (diferente de celulas .xlsx), entao datas chegam como texto
  // e o construtor nativo `new Date(texto)` interpreta ambiguamente como MM/DD/AAAA (americano) —
  // por isso tratamos esse formato explicitamente antes de cair no parser generico.
  const brMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brMatch) {
    const [, dd, mm, yyRaw, hh, mi, ss] = brMatch;
    // Ano com 2 digitos ("15/03/85"): ate o ano seguinte ao atual vale 20xx, acima disso 19xx.
    let yyyy = yyRaw;
    if (yyRaw.length === 2) {
      const yy = parseInt(yyRaw, 10);
      yyyy = String(yy <= (new Date().getFullYear() % 100) + 1 ? 2000 + yy : 1900 + yy);
    }
    const d = new Date(
      parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10),
      hh ? parseInt(hh, 10) : 0, mi ? parseInt(mi, 10) : 0, ss ? parseInt(ss, 10) : 0
    );
    return isNaN(d) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function normalizeKey(s) {
  return (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
}
/** Textos que, na pratica, significam "celula vazia" (exportacoes de sistemas e planilhas
 *  manuais escrevem "N/A", "-", "#N/D" etc. em vez de deixar em branco). Comparados sem
 *  acento e sem diferenca de maiuscula/minuscula. Tratar isso como valor real criaria
 *  categorias falsas nos filtros e graficos (ex: uma fatia "N/A" no grafico de genero). */
export const NULL_TOKENS = new Set([
  "", "-", "--", "---", "—", "–", ".", "..", "null", "nulo", "none", "nan", "n/a", "n.a.", "n.a",
  "na", "n/d", "#n/d", "#n/a", "#valor!", "#value!", "#ref!", "#div/0!", "#nome?", "#name?",
  "sem informacao", "s/i", "nao informado", "(vazio)", "(blank)", "blank",
]);
export function isNullToken(s) {
  const f = String(s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return NULL_TOKENS.has(f);
}
/** Linha em que TODAS as celulas estao vazias ou so tem "textos de vazio". */
export function isBlankRow(row) {
  return Object.values(row).every((v) => v === null || v === undefined || (typeof v === "string" && isNullToken(v)));
}
export function dropBlankRows(rows) {
  const kept = rows.filter((r) => !isBlankRow(r));
  return { rows: kept, dropped: rows.length - kept.length };
}
export function cleanStr(v) {
  if (v === null || v === undefined) return null;
  // Espacos "invisiveis" (nbsp, largura zero, BOM) e espacos duplicados viram um espaco so.
  const s = String(v).replace(/[ ​‌‍﻿]/g, " ").replace(/\s+/g, " ").trim();
  return isNullToken(s) ? null : s;
}
/** Mascara CPF ("123.456.789-09" ou "12345678909") antes de enviar amostras de linhas a IA.
 *  O formato continua reconhecivel (a IA ainda ve que a coluna e um CPF), mas o numero real nao sai do navegador. */
export function maskCpf(v) {
  if (typeof v !== "string") return v;
  return /^\s*\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s*$/.test(v) ? "###.###.###-##" : v;
}
const MONTH_NAMES = {
  jan: 1, janeiro: 1, january: 1, fev: 2, fevereiro: 2, feb: 2, february: 2, mar: 3, marco: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4, mai: 5, maio: 5, may: 5, jun: 6, junho: 6, june: 6,
  jul: 7, julho: 7, july: 7, ago: 8, agosto: 8, aug: 8, august: 8, set: 9, setembro: 9, sep: 9, sept: 9, september: 9,
  out: 10, outubro: 10, oct: 10, october: 10, nov: 11, novembro: 11, november: 11, dez: 12, dezembro: 12, dec: 12, december: 12,
};
/** Reconhece um mes escrito de varias formas e devolve "AAAA-MM" (ou null se nao for um mes).
 *  Aceita: 2025-11, 2025/11, 11/2025, 11-2025, 202511, 2025-11-03 (data completa), 03/11/2025 (dd/mm/aaaa),
 *  nov/25, nov/2025, novembro 2025, Nov-25. */
export function normalizeMonthText(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let y, mo, m;
  if ((m = /^(\d{4})\s*[-\/.]\s*(\d{1,2})$/.exec(t))) { y = +m[1]; mo = +m[2]; }
  else if ((m = /^(\d{1,2})\s*[-\/.]\s*(\d{4})$/.exec(t))) { mo = +m[1]; y = +m[2]; }
  else if ((m = /^(\d{4})(\d{2})$/.exec(t))) { y = +m[1]; mo = +m[2]; }
  else if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/.exec(t))) { y = +m[1]; mo = +m[2]; }
  else if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(t))) { mo = +m[2]; y = +m[3]; }
  else if ((m = /^([a-z]+)\.?\s*(?:[-\/.]|de)?\s*(\d{2}|\d{4})$/.exec(t)) && MONTH_NAMES[m[1]]) {
    mo = MONTH_NAMES[m[1]]; y = m[2].length === 2 ? 2000 + +m[2] : +m[2];
  } else return null;
  if (!(mo >= 1 && mo <= 12) || !(y >= 1900 && y <= 2100)) return null;
  return `${y}-${String(mo).padStart(2, "0")}`;
}
/** A coluna "competencia" da folha (ex: "2025-01") as vezes e interpretada pelo
 * SheetJS como data de verdade (vira um objeto Date), o que geraria um rotulo tipo
 * "Wed Jan 01 2025 00:00:00 GMT+0000..." nos graficos. Outras vezes vem como texto em
 * outro formato ("11/2025", "2025/11", "nov/25"), que viraria um "mes" separado no grafico.
 * Aqui ela sempre volta a ser uma string "AAAA-MM" antes de seguir para o resto da limpeza. */
export function cleanCompetencia(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}`;
  }
  const s = cleanStr(v);
  if (!s) return null;
  return normalizeMonthText(s) || s;
}
/** Converte texto em numero aceitando os formatos que aparecem em bases reais:
 *  "R$ 1.234,56" (brasileiro), "1,234.56" (americano), "1234.56", "12,5%", "(1.500,00)"
 *  (negativo contabil) e "-3". Datas e "textos de vazio" viram null (nunca numero). */
export function cleanNum(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  if (v instanceof Date) return null;
  let s = String(v).trim();
  if (isNullToken(s)) return null;
  // "2024-01-05" e "05/01/2024" sao datas, nao numeros.
  if (/^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(s)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^-/.test(s) || /-$/.test(s)) neg = !neg;
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let norm;
  if (lastDot >= 0 && lastComma >= 0) {
    // Os dois separadores presentes: o que aparece por ultimo e o decimal.
    norm = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // So virgula: decimal brasileiro ("12,5"); varias virgulas seriam milhares ("1,234,567").
    norm = s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    // So ponto: "1.234" e "1.234.567" sao milhares (padrao brasileiro); "3.5" e "1234.56" sao decimais.
    norm = s.split(".").length > 2 || /^\d{1,3}\.\d{3}$/.test(s) ? s.replace(/\./g, "") : s;
  } else {
    norm = s;
  }
  const n = parseFloat(norm);
  if (isNaN(n)) return null;
  return neg ? -Math.abs(n) : n;
}

/** Copia os campos "extra_*" (ja tipados por applyExtraFields) de uma linha crua `r` para
 *  o objeto limpo `out` de cleanAndNormalize — usado em todas as 6 tabelas (funcionarios,
 *  movimentacoes, rs, desligamentos, entrevistas, folha) para que campos extras sobrevivam
 *  a limpeza, ja que cada bloco ali monta um objeto literal so com os campos canonicos. */
export function withExtraFields(out, r) {
  Object.keys(r).forEach((k) => { if (k.startsWith("extra_")) out[k] = r[k]; });
  return out;
}

/** Remove duplicatas mantendo a ULTIMA ocorrencia de cada chave (util quando a base tem
 *  a mesma pessoa/registro repetido em abas diferentes, ex: uma aba por ano). */
export function dedupeKeepLast(rows, keyFn) {
  const map = new Map();
  let dupCount = 0;
  let anonCounter = 0;
  rows.forEach((r) => {
    let k = keyFn(r);
    if (k === null || k === undefined || k === "") k = `__semchave_${anonCounter++}`;
    else if (map.has(k)) dupCount++;
    map.set(k, r);
  });
  return { rows: Array.from(map.values()), dupCount };
}

/** Relatorio de qualidade dos dados: o que a limpeza fez, em numeros, para mostrar ao usuario.
 *  Nasce vazio e e preenchido por cleanAndNormalize (linhas por tabela) e por
 *  harmonizeCategoricalValues (valores padronizados). Tudo calculado pelo codigo. */
export function createQualityReport() {
  return { sheets: [], tables: {}, harmonized: [], checkedFields: 0, aiStatus: "nao_executada", completeness: [], emptyTexts: 0, intervals: [] };
}
function recordTable(report, key, received, brutos, deduped) {
  if (!report || !received) return;
  report.tables[key] = {
    received,                              // linhas lidas da planilha
    kept: deduped.rows.length,             // linhas que seguiram para o painel
    duplicates: deduped.dupCount,          // registros repetidos combinados em um
    discarded: Math.max(0, received - brutos), // linhas sem identificador/data obrigatoria ou sem vinculo
  };
}

/** Conta celulas com "texto de vazio" (N/A, -, #N/D...) nas linhas cruas: sao as que viram vazio de verdade. */
function countEmptyTexts(found) {
  let n = 0;
  Object.values(found || {}).forEach((rows) => (rows || []).forEach((r) => {
    Object.values(r).forEach((v) => {
      if (typeof v === "string" && v.trim() !== "" && isNullToken(v)) n++;
    });
  }));
  return n;
}

export function cleanAndNormalize(found, log, report) {
  if (report) report.emptyTexts = countEmptyTexts(found);
  const temFuncionarios = !!(found.funcionarios && found.funcionarios.length);
  if (!temFuncionarios) {
    log.push("Nenhuma aba de cadastro de funcionarios foi reconhecida: o painel sera montado apenas com as demais tabelas disponiveis, sem indicadores de headcount, turnover ou risco de saida.");
  }

  // ---- FUNCIONARIOS ----
  let missingCount = 0;
  const funcionariosBrutos = (found.funcionarios || [])
    .map((r) => {
      const matricula = cleanNum(r.matricula);
      if (matricula === null) return null;
      let nome = cleanStr(r.nome);
      let cargo = cleanStr(r.cargo) || "Não informado";
      // "Cargo / Nome" combinados na mesma coluna original (ex: "Assistente / Joao Silva")
      if (nome && cargo !== "Não informado" && nome === cargo && nome.includes(" / ")) {
        const partes = nome.split(" / ").map((s) => s.trim()).filter(Boolean);
        if (partes.length === 2) { cargo = partes[0]; nome = partes[1]; }
      }
      if (!nome) nome = `Funcionario ${matricula}`;
      return withExtraFields({
        matricula,
        nome,
        cpf: cleanStr(r.cpf),
        data_nascimento: toDate(r.data_nascimento),
        idade_informada: cleanNum(r.idade),
        data_admissao: toDate(r.data_admissao),
        data_desligamento: toDate(r.data_desligamento),
        status: cleanStr(r.status) || (toDate(r.data_desligamento) ? "Desligado" : "Ativo"),
        cargo,
        senioridade: cleanStr(r.senioridade) || "Não informado",
        area: cleanStr(r.area) || "Não informado",
        centro_custo: cleanStr(r.centro_custo),
        matricula_gestor: cleanNum(r.matricula_gestor),
        filial: cleanStr(r.filial) || "Não informado",
        modelo_trabalho: cleanStr(r.modelo_trabalho) || "Não informado",
        tipo_contrato: cleanStr(r.tipo_contrato) || "Não informado",
        genero: cleanStr(r.genero) || "Não informado",
        raca_etnia: cleanStr(r.raca_etnia) || "Não informado",
        pcd: cleanStr(r.pcd) || "Não informado",
        salario_inicial: cleanNum(r.salario_inicial),
        salario_atual: cleanNum(r.salario_atual),
      }, r);
    })
    .filter(Boolean);
  // OBS: uma base sem nenhuma data de admissao (so ID + atributos/metricas, ex: dataset de
  // pesquisa/avaliacao sem campo de vinculo empregaticio) NAO tem mais as linhas descartadas
  // aqui por essa causa — "data_admissao" fica null para essas, e as paginas que dependem dela
  // (headcount/turnover/Previsoes, ver buildCoreSeries) ja se escondem sozinhas nesse caso,
  // mas o resto do dashboard (incluindo os campos extras do Caminho B) continua funcionando.
  missingCount = funcionariosBrutos.filter((f) => !f.data_admissao).length;
  const { rows: funcionariosDeduped, dupCount } = dedupeKeepLast(funcionariosBrutos, (f) => f.matricula);
  const funcionarios = funcionariosDeduped.map((f) => {
    const statusNorm = normalizeKey(f.status);
    f.status = f.data_desligamento || statusNorm.includes("deslig") ? "Desligado" : "Ativo";
    const ref = f.data_desligamento || new Date();
    f.tempo_casa_meses = f.data_admissao ? Math.max(0, Math.round((ref - f.data_admissao) / (1000 * 60 * 60 * 24 * 30.44))) : null;
    f.idade = f.data_nascimento
      ? Math.floor((new Date() - f.data_nascimento) / (1000 * 60 * 60 * 24 * 365.25))
      : (f.idade_informada !== null && f.idade_informada !== undefined ? Math.round(f.idade_informada) : null);
    return f;
  });
  recordTable(report, "funcionarios", (found.funcionarios || []).length, funcionariosBrutos.length, { rows: funcionarios, dupCount });
  if (report && report.tables.funcionarios) report.tables.funcionarios.noAdmissionDate = missingCount;
  log.push(`Funcionarios: ${funcionarios.length} registros validos apos limpeza (${dupCount} registros de mesma matricula combinados — mantida a versao mais recente, ${missingCount} sem data de admissao removidos).`);

  const matriculaSet = new Set(funcionarios.map((f) => f.matricula));

  // ---- MOVIMENTACOES ----
  const movimentacoesBrutas = (found.movimentacoes || [])
    .map((r) => withExtraFields({
      matricula: cleanNum(r.matricula),
      data_evento: toDate(r.data_evento),
      tipo_evento: cleanStr(r.tipo_evento),
      cargo_anterior: cleanStr(r.cargo_anterior),
      cargo_novo: cleanStr(r.cargo_novo),
      area_anterior: cleanStr(r.area_anterior),
      area_novo: cleanStr(r.area_novo),
      salario_anterior: cleanNum(r.salario_anterior),
      salario_novo: cleanNum(r.salario_novo),
      motivo: cleanStr(r.motivo),
    }, r))
    .filter((r) => r.matricula !== null && r.data_evento && (!temFuncionarios || matriculaSet.has(r.matricula)));
  const movDeduped = dedupeKeepLast(movimentacoesBrutas, (m) => `${m.matricula}|${m.data_evento?.getTime()}|${m.tipo_evento}`);
  const movimentacoes = movDeduped.rows;
  recordTable(report, "movimentacoes", (found.movimentacoes || []).length, movimentacoesBrutas.length, movDeduped);
  log.push(`Movimentacoes: ${movimentacoes.length} registros validos vinculados a funcionarios existentes${movDeduped.dupCount ? ` (${movDeduped.dupCount} duplicados combinados)` : ""}.`);

  // ---- RECRUTAMENTO & SELECAO ----
  const rsBrutos = (found.rs || [])
    .map((r) => {
      const abertura = toDate(r.data_abertura);
      const fechamento = toDate(r.data_fechamento);
      return withExtraFields({
        id_vaga: cleanStr(r.id_vaga) || cleanStr(r.idvaga),
        cargo: cleanStr(r.cargo) || "Não informado",
        area: cleanStr(r.area) || "Não informado",
        data_abertura: abertura,
        data_fechamento: fechamento,
        recrutador_responsavel: cleanStr(r.recrutador_responsavel) || "Não informado",
        status: cleanStr(r.status) || "Não informado",
        origem_vaga: cleanStr(r.origem_vaga) || "Não informado",
        fonte_recrutamento: cleanStr(r.fonte_recrutamento) || "Não informado",
        matricula_contratado: cleanNum(r.matricula_contratado),
        tempo_contratacao_dias:
          cleanNum(r.tempo_contratacao_dias) ?? (abertura && fechamento && fechamento >= abertura ? Math.round((fechamento - abertura) / 86400000) : null),
      }, r);
    })
    // So "id_vaga" e obrigatorio (precisa pra identificar/deduplicar a vaga). "data_abertura"
    // NAO e mais obrigatoria aqui — bases de recrutamento reais (ex: exportacoes de ATS com
    // fluxo de aprovacao/congelamento) muitas vezes nao tem uma coluna literal de "abertura
    // da vaga", so datas de processo (aprovacao, admissao, SLA). Exigir isso zerava a tabela
    // "rs" inteira em bases assim. Sem essa data, graficos que agrupariam por mes nessa tabela
    // simplesmente nao tem pontos (ver computeChartData, que ja ignora datas invalidas/nulas),
    // mas tudo que nao depende de data (status, recrutador, SLA, campos extras do Caminho B)
    // continua funcionando normalmente.
    .filter((r) => !!r.id_vaga);
  const rsDeduped = dedupeKeepLast(rsBrutos, (v) => v.id_vaga);
  const rs = rsDeduped.rows;
  recordTable(report, "rs", (found.rs || []).length, rsBrutos.length, rsDeduped);
  log.push(`Recrutamento & Selecao: ${rs.length} vagas validas${rsDeduped.dupCount ? ` (${rsDeduped.dupCount} duplicadas combinadas)` : ""}.`);

  // ---- DESLIGAMENTOS ----
  const desligamentosBrutos = (found.desligamentos || [])
    .map((r) => withExtraFields({
      matricula: cleanNum(r.matricula),
      data_desligamento: toDate(r.data_desligamento),
      tipo_desligamento: cleanStr(r.tipo_desligamento) || "Não informado",
      motivo_detalhado: cleanStr(r.motivo_detalhado) || "Não informado",
      iniciativa: cleanStr(r.iniciativa) || "Não informado",
      tempo_casa_dias: cleanNum(r.tempo_casa_dias),
      nota_enps: cleanNum(r.nota_enps),
    }, r))
    .filter((r) => r.matricula !== null && r.data_desligamento && (!temFuncionarios || matriculaSet.has(r.matricula)));
  const deslDeduped = dedupeKeepLast(desligamentosBrutos, (d) => `${d.matricula}|${d.data_desligamento?.getTime()}`);
  let desligamentos = deslDeduped.rows;

  if (!desligamentos.length) {
    const sintetizados = funcionarios
      .filter((f) => f.status === "Desligado" && f.data_desligamento)
      .map((f) => ({
        matricula: f.matricula,
        data_desligamento: f.data_desligamento,
        tipo_desligamento: "Não informado",
        motivo_detalhado: "Não informado",
        iniciativa: "Não informado",
        tempo_casa_dias: f.tempo_casa_meses !== null ? Math.round(f.tempo_casa_meses * 30.44) : null,
        nota_enps: null,
      }));
    if (sintetizados.length) {
      desligamentos = sintetizados;
      log.push(`Desligamentos: nao havia aba dedicada, entao foram gerados a partir do status/data de desligamento do cadastro de funcionarios (${sintetizados.length} registros, sem motivo/tipo detalhado).`);
    }
  }
  recordTable(report, "desligamentos", (found.desligamentos || []).length, desligamentosBrutos.length, { rows: desligamentos, dupCount: deslDeduped.dupCount });
  if (report && !(found.desligamentos || []).length && desligamentos.length) {
    report.tables.desligamentos = { received: 0, kept: desligamentos.length, duplicates: 0, discarded: 0, synthesized: true };
  }
  log.push(`Desligamentos: ${desligamentos.length} registros validos${deslDeduped.dupCount ? ` (${deslDeduped.dupCount} duplicados combinados)` : ""}.`);

  // ---- ENTREVISTA DE DESLIGAMENTO ----
  const entrevistasBrutas = (found.entrevistas || [])
    .map((r) => withExtraFields({
      matricula: cleanNum(r.matricula),
      categoria: cleanStr(r.categoria) || "Outros",
      pergunta: cleanStr(r.pergunta),
      resposta_nota: cleanNum(r.resposta_nota),
      resposta_texto: cleanStr(r.resposta_texto),
    }, r))
    .filter((r) => r.matricula !== null && r.resposta_nota !== null && (!temFuncionarios || matriculaSet.has(r.matricula)));
  const entrDeduped = dedupeKeepLast(entrevistasBrutas, (e) => `${e.matricula}|${e.categoria}|${e.pergunta}`);
  const entrevistas = entrDeduped.rows;
  recordTable(report, "entrevistas", (found.entrevistas || []).length, entrevistasBrutas.length, entrDeduped);
  log.push(`Entrevistas de desligamento: ${entrevistas.length} respostas validas${entrDeduped.dupCount ? ` (${entrDeduped.dupCount} duplicadas combinadas)` : ""}.`);

  // ---- FOLHA DE PAGAMENTO ----
  const mesAjustado = new Map(); // "AAAA-MM" -> variantes de escrita encontradas
  let mesLinhas = 0;
  const folhaBruta = (found.folha || [])
    .map((r) => withExtraFields({
      matricula: cleanNum(r.matricula),
      competencia: (() => {
        const c = cleanCompetencia(r.competencia);
        const bruto = typeof r.competencia === "string" ? cleanStr(r.competencia) : null;
        if (bruto && c && bruto !== c) {
          mesLinhas++;
          if (!mesAjustado.has(c)) mesAjustado.set(c, new Set());
          mesAjustado.get(c).add(bruto);
        }
        return c;
      })(),
      salario_base: cleanNum(r.salario_base),
      beneficios: cleanNum(r.beneficios_vr_va_saude) ?? cleanNum(r.beneficios),
      bonus_comissao: cleanNum(r.bonus_comissao) || 0,
      encargos: cleanNum(r.encargos_inss_fgts),
      horas_extras: cleanNum(r.horas_extras) || 0,
      custo_total_ctc: cleanNum(r.custo_total_ctc),
    }, r))
    .filter((r) => r.matricula !== null && r.competencia && (!temFuncionarios || matriculaSet.has(r.matricula)));
  const folhaDeduped = dedupeKeepLast(folhaBruta, (f) => `${f.matricula}|${f.competencia}`);
  const folha = folhaDeduped.rows;
  recordTable(report, "folha", (found.folha || []).length, folhaBruta.length, folhaDeduped);
  if (report && mesLinhas > 0) {
    report.harmonized.push({
      table: "folha", field: "competencia", rows: mesLinhas,
      groups: Array.from(mesAjustado.entries()).map(([to, froms]) => ({ to, from: Array.from(froms), kind: "grafia" })),
    });
  }
  log.push(`Folha de pagamento: ${folha.length} registros validos${folhaDeduped.dupCount ? ` (${folhaDeduped.dupCount} duplicados combinados)` : ""}.`);

  return { funcionarios, movimentacoes, rs, desligamentos, entrevistas, folha };
}

/* ============================================================================
   PADRONIZACAO DE VALORES CATEGORICOS (etapa "T" do ETL, invisivel para o usuario)

   Problema: a mesma coisa escrita de formas diferentes ("SP", "sp", "Sao Paulo",
   "SÃO PAULO") vira varias categorias nos filtros e graficos, e cada uma e contada a parte.

   Duas etapas, mantendo o principio "a IA decide, o codigo sempre calcula":
   A) Por GRAFIA (so codigo, sempre roda): variacoes que diferem apenas em maiuscula/
      minuscula, acento, pontuacao ou espaco ("sao paulo" = "São Paulo") sao unificadas.
   B) Por SIGNIFICADO (IA + validacao em codigo, so se houver chave de API): a IA recebe
      SOMENTE a lista de valores distintos de cada campo (nunca as linhas da base, nunca
      nomes de pessoas) e propoe quais sao o mesmo valor ("SP" = "São Paulo"). O codigo
      so aplica o que passar nas validacoes abaixo. Se a IA falhar, a etapa A continua valendo.
============================================================================ */
export const HARMONIZE_TABLES = ["funcionarios", "movimentacoes", "rs", "desligamentos", "entrevistas", "folha"];
// Campos que nunca sao categorias padronizaveis (identificadores, nomes, texto livre, periodo).
export const HARMONIZE_SKIP_FIELDS = new Set(["nome", "cpf", "id_vaga", "pergunta", "resposta_texto", "competencia"]);
// "tabela.campo" que ja sao padronizados por regra propria no codigo.
export const HARMONIZE_SKIP_PAIRS = new Set(["funcionarios.status"]);
// Campos com nomes de pessoas: so a etapa A (grafia). "Ana S." e "Ana Silva" podem ser pessoas diferentes.
export const HARMONIZE_NO_AI_FIELDS = new Set(["recrutador_responsavel"]);
export const HARMONIZE_PLACEHOLDER = "Não informado";
export const HARMONIZE_MAX_DISTINCT = 60; // acima disso o campo e tratado como texto livre
export const HARMONIZE_AI_MAX_FIELDS = 30;
export const HARMONIZE_AI_MAX_VALUES = 50;

export function foldValueKey(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
/** Quanto uma grafia parece "bem escrita": acento e mistura de maiuscula/minuscula pontuam. */
export function spellScore(v) {
  let s = 0;
  if (/[À-ÿ]/.test(v)) s += 2;
  if (v !== v.toUpperCase() && v !== v.toLowerCase()) s += 2;
  return s;
}

/** Lista os campos de texto com poucos valores distintos (categorias) de todas as tabelas. */
export function collectHarmonizeCandidates(data) {
  const out = [];
  HARMONIZE_TABLES.forEach((table) => {
    const rows = (data && data[table]) || [];
    if (rows.length < 4) return;
    const fields = new Set();
    rows.forEach((r) => Object.keys(r).forEach((k) => fields.add(k)));
    fields.forEach((field) => {
      if (HARMONIZE_SKIP_FIELDS.has(field) || HARMONIZE_SKIP_PAIRS.has(`${table}.${field}`) || field.startsWith("matricula")) return;
      const counts = new Map();
      let nonNull = 0;
      let allStrings = true;
      for (const r of rows) {
        const v = r[field];
        if (v === null || v === undefined) continue;
        if (typeof v !== "string") { allStrings = false; break; }
        if (v === HARMONIZE_PLACEHOLDER) continue;
        nonNull++;
        counts.set(v, (counts.get(v) || 0) + 1);
      }
      if (!allStrings || nonNull < 4) return;
      if (counts.size < 2 || counts.size > HARMONIZE_MAX_DISTINCT) return;
      if (counts.size > nonNull * 0.5) return; // quase tudo diferente = identificador/texto livre
      out.push({ table, field, counts });
    });
  });
  return out;
}

/** Etapa A: agrupa valores que so diferem na grafia. Devolve Map(variante -> forma escolhida). */
export function groupBySpelling(counts) {
  const groups = new Map();
  counts.forEach((n, value) => {
    const key = foldValueKey(value) || value;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ value, n });
  });
  const map = new Map();
  groups.forEach((variants) => {
    if (variants.length < 2) return;
    const best = variants.slice().sort((a, b) => (spellScore(b.value) - spellScore(a.value)) || (b.n - a.n) || a.value.localeCompare(b.value))[0].value;
    variants.forEach((v) => { if (v.value !== best) map.set(v.value, best); });
  });
  return map;
}

// Guardas contra a IA unir coisas que parecem parecidas mas sao diferentes.
export function digitsOf(s) { return (String(s).match(/\d+/g) || []).join("|"); }
export function romanOf(s) { return (String(s).match(/\b(?:I{1,3}|IV|VI{0,3}|IX|X)\b/g) || []).join("|"); }
export function levelTag(s) {
  const f = String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/\b(junior|jr)\b/.test(f)) return "jr";
  if (/\b(pleno|pl)\b/.test(f)) return "pl";
  if (/\b(senior|sr)\b/.test(f)) return "sr";
  return "";
}
export function sameKind(a, b) {
  return digitsOf(a) === digitsOf(b) && romanOf(a) === romanOf(b) && levelTag(a) === levelTag(b);
}

/** Valida os grupos propostos pela IA para UM campo. So sobrevive o que for seguro. */
export function validateSemanticGroups(groups, values) {
  const valid = new Set(values);
  const used = new Set();
  const map = new Map();
  if (!Array.isArray(groups)) return map;
  groups.forEach((g) => {
    if (!g || typeof g.canonical !== "string" || !valid.has(g.canonical) || !Array.isArray(g.variants)) return;
    if (used.has(g.canonical)) return; // ja e variante de outro grupo (evita cadeias)
    const vars = [...new Set(g.variants)].filter((v) => typeof v === "string" && v !== g.canonical && valid.has(v) && !used.has(v) && sameKind(v, g.canonical));
    if (!vars.length || vars.length > 12) return;
    vars.forEach((v) => { map.set(v, g.canonical); used.add(v); });
    used.add(g.canonical);
  });
  return map;
}

/** Aplica as duas etapas em `data` (modifica as linhas no lugar) e registra o que fez no log.
 *  `askAI(campos)` e opcional: funcao que recebe [{id, field, reps}] e devolve Map(id -> grupos).
 *  Sem ela (ou se ela falhar) so a etapa A (grafia) e aplicada.
 *  Nunca derruba o fluxo: qualquer falha da IA so deixa de aplicar a etapa B. */
export async function harmonizeCategoricalValues(data, { askAI } = {}, log = [], report = null) {
  const candidates = collectHarmonizeCandidates(data);
  if (report) report.checkedFields = candidates.length;
  if (!candidates.length) return data;

  // Etapa A (grafia)
  candidates.forEach((c) => {
    c.mapA = groupBySpelling(c.counts);
    const reps = new Map();
    c.counts.forEach((n, v) => { const rep = c.mapA.get(v) || v; reps.set(rep, (reps.get(rep) || 0) + n); });
    c.reps = Array.from(reps.entries()).sort((a, b) => b[1] - a[1]); // [valor, quantidade]
    c.mapB = new Map();
  });

  // Etapa B (significado) — so se ha chave e algum campo ainda tem 2+ valores distintos
  const aiFields = candidates
    .filter((c) => !HARMONIZE_NO_AI_FIELDS.has(c.field) && c.reps.length >= 2 && c.reps.length <= HARMONIZE_AI_MAX_VALUES)
    .slice(0, HARMONIZE_AI_MAX_FIELDS);
  if (report) report.aiStatus = !askAI ? "sem_chave" : aiFields.length ? "aplicada" : "nada_a_verificar";
  if (askAI && aiFields.length) {
    aiFields.forEach((c, i) => { c.id = `f${i + 1}`; });
    try {
      const byId = await askAI(aiFields);
      aiFields.forEach((c) => {
        c.mapB = validateSemanticGroups(byId.get(c.id), c.reps.map(([v]) => v));
      });
    } catch (e) {
      if (report) report.aiStatus = "falhou";
      log.push("Padronização por significado (ex: sigla = nome por extenso) não foi aplicada porque a IA não respondeu; só a padronização por grafia (maiúscula, acento, espaço) foi feita.");
    }
  }

  // Aplicacao + log
  candidates.forEach((c) => {
    const final = new Map(); // valor original -> valor final
    c.counts.forEach((n, v) => {
      const rep = c.mapA.get(v) || v;
      const canon = c.mapB.get(rep) || rep;
      if (canon !== v) final.set(v, canon);
    });
    if (!final.size) return;
    (data[c.table] || []).forEach((r) => {
      const v = r[c.field];
      if (typeof v === "string" && final.has(v)) r[c.field] = final.get(v);
    });
    const byTarget = new Map();
    final.forEach((to, from) => { if (!byTarget.has(to)) byTarget.set(to, []); byTarget.get(to).push(from); });
    if (report) {
      let rowsChanged = 0;
      final.forEach((to, from) => { rowsChanged += c.counts.get(from) || 0; });
      report.harmonized.push({
        table: c.table, field: c.field, rows: rowsChanged,
        groups: Array.from(byTarget.entries()).map(([to, froms]) => ({
          to, from: froms,
          // "significado" = so a IA conseguiu ligar (sigla = nome por extenso); "grafia" = so maiuscula/acento/espaco
          kind: froms.some((f) => c.mapB.has(c.mapA.get(f) || f)) ? "significado" : "grafia",
        })),
      });
    }
    const partes = Array.from(byTarget.entries()).slice(0, 5).map(([to, froms]) => `${froms.map((f) => `"${f}"`).join(", ")} → "${to}"`);
    log.push(`Padronização de valores em "${c.field}" (${c.table}): ${partes.join("; ")}${byTarget.size > 5 ? "; ..." : ""}.`);
  });
  return data;
}

/** Campos com muitas celulas vazias (ou "Não informado") em cada tabela, para avisar o usuario
 *  de onde a base e fraca. Campos 100% vazios sao ignorados: significam que a coluna nao existe na planilha. So olha campos que o usuario reconhece (ignora nome, CPF e calculados). */
const COMPLETENESS_SKIP = new Set(["nome", "cpf", "idade_informada", "tempo_casa_meses", "matricula", "matricula_gestor"]);
export function summarizeCompleteness(data, { minPct = 10, minRows = 5, maxFields = 8 } = {}) {
  const out = [];
  HARMONIZE_TABLES.forEach((table) => {
    const rows = (data && data[table]) || [];
    if (rows.length < minRows) return;
    const fields = new Set();
    rows.forEach((r) => Object.keys(r).forEach((k) => fields.add(k)));
    const weak = [];
    fields.forEach((field) => {
      if (COMPLETENESS_SKIP.has(field) || field.startsWith("extra_duracao_") || field.startsWith("extra_faixa_duracao_")) return;
      let empty = 0;
      for (const r of rows) {
        const v = r[field];
        if (v === null || v === undefined || v === "" || v === HARMONIZE_PLACEHOLDER || (typeof v === "number" && isNaN(v))) empty++;
      }
      const pct = (empty / rows.length) * 100;
      if (pct >= minPct && pct < 100) weak.push({ field, pct: Math.round(pct * 10) / 10 });
    });
    if (weak.length) {
      weak.sort((a, b) => b.pct - a.pct);
      out.push({ table, rows: rows.length, fields: weak.slice(0, maxFields), more: Math.max(0, weak.length - maxFields) });
    }
  });
  return out;
}

/* ============================================================================
   INTERVALOS DE DATAS (inicio -> fim) em qualquer tabela

   Acha pares de campos de data que formam um intervalo ("data_inicio" e "data_fim",
   "abertura" e "fechamento", "entrada" e "saida"...) pelo NOME dos campos, inclusive nos
   campos extras. Para cada par, o codigo calcula a duracao em dias e cria um campo numerico
   "extra_duracao_<nome>_dias" que os graficos podem usar. Tambem conta intervalos sem data final
   (ainda em andamento) e inconsistentes (fim antes do inicio, que nao entram na duracao).
============================================================================ */
// [palavra do inicio, palavra do fim]
const INTERVAL_WORDS = [
  ["inicio", "fim"], ["inicio", "termino"], ["inicio", "final"], ["inicio", "encerramento"], ["inicio", "conclusao"],
  ["inicial", "final"], ["abertura", "fechamento"], ["abertura", "encerramento"], ["admissao", "desligamento"],
  ["entrada", "saida"], ["criacao", "conclusao"], ["criacao", "encerramento"], ["vigencia", "vencimento"],
];
// Pares que ja tem duracao propria na limpeza (tempo de casa, tempo de contratacao): so conferimos a consistencia.
const INTERVAL_EXISTING = new Set(["funcionarios.data_admissao.data_desligamento", "rs.data_abertura.data_fechamento"]);
const INTERVAL_FILLER = new Set(["data", "dt", "de", "da", "do"]);

function dateKeyTokens(key) {
  return String(key).replace(/^extra_/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .split("_").filter((t) => t && !INTERVAL_FILLER.has(t));
}
/** Dado o conjunto de campos de data de uma tabela, devolve [{start, end, name}]. */
export function findIntervalPairs(dateFields) {
  const info = dateFields.map((f) => ({ f, tokens: dateKeyTokens(f) }));
  const pairs = [];
  const used = new Set();
  INTERVAL_WORDS.forEach(([sw, ew]) => {
    info.forEach((a) => {
      if (!a.tokens.includes(sw)) return;
      const stem = a.tokens.filter((t) => t !== sw).join("_");
      const b = info.find((x) => x.f !== a.f && x.tokens.includes(ew) && x.tokens.filter((t) => t !== ew).join("_") === stem);
      if (!b) return;
      const id = `${a.f}|${b.f}`;
      if (used.has(id)) return;
      used.add(id);
      pairs.push({ start: a.f, end: b.f, name: stem || `${sw}_${ew}` });
    });
  });
  return pairs;
}

const DURATION_STEPS = [1, 2, 5, 7, 10, 15, 30, 60, 90, 180, 365, 730];
/** Escolhe faixas "redondas" (ate 5) para uma lista de duracoes em dias. Devolve null quando
 *  nao ha variacao suficiente para faixas fazerem sentido. */
export function buildDurationBands(values) {
  if (!values || values.length < 5) return null;
  const max = Math.max(...values);
  if (max < 10) return null;
  const raw = Math.ceil(max / 5);
  const step = DURATION_STEPS.find((x) => x >= raw) || Math.ceil(raw / 365) * 365;
  const bands = [];
  for (let from = 0; from <= max; from += step) bands.push({ from, to: from + step });
  return bands.map((b, i) => ({
    ...b,
    label: i === 0 ? `até ${b.to} dias` : `${b.from + 1} a ${b.to} dias`,
  }));
}

/** Calcula as duracoes (modifica as linhas no lugar) e devolve o resumo de cada intervalo achado. */
export function applyDateIntervals(data, report = null) {
  const out = [];
  HARMONIZE_TABLES.forEach((table) => {
    const rows = (data && data[table]) || [];
    if (rows.length < 2) return;
    const keys = new Set();
    rows.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    const dateFields = [...keys].filter((k) => rows.some((r) => r[k] instanceof Date));
    findIntervalPairs(dateFields).forEach(({ start, end, name }) => {
      const existing = INTERVAL_EXISTING.has(`${table}.${start}.${end}`);
      const field = existing ? null : `extra_duracao_${name}_dias`;
      const faixaField = field ? field.replace("extra_duracao_", "extra_faixa_duracao_") : null;
      if (field && keys.has(field)) return;
      let total = 0, computed = 0, open = 0, invalid = 0, soma = 0;
      rows.forEach((r) => {
        const a = r[start], b = r[end];
        if (field) r[field] = null;
        if (!(a instanceof Date)) return;
        total++;
        if (!(b instanceof Date)) { open++; return; }
        const dias = Math.round((b - a) / 86400000);
        if (dias < 0) { invalid++; return; }
        computed++; soma += dias;
        if (field) r[field] = dias;
      });
      if (!total) return;
      // Faixas de duracao (ex: "até 30 dias", "31 a 60 dias") como campo de categoria: assim a duracao
      // tambem vira filtro e eixo de grafico, sem nenhum tratamento especial no motor.
      const bands = field ? buildDurationBands(rows.map((r) => r[field]).filter((v) => typeof v === "number")) : null;
      if (bands) {
        rows.forEach((r) => {
          const a = r[start], b = r[end];
          let faixa = null;
          if (a instanceof Date) {
            if (typeof r[field] === "number") faixa = (bands.find((x) => r[field] <= x.to) || bands[bands.length - 1]).label;
            else faixa = b instanceof Date ? "Inconsistente" : "Em andamento";
          }
          r[faixaField] = faixa;
        });
      }
      const item = { table, start, end, field, faixaField: bands ? faixaField : null, total, computed, open, invalid, avgDays: computed ? Math.round(soma / computed) : null };
      out.push(item);
    });
  });
  if (report) report.intervals = out;
  return out;
}
