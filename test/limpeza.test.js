// Testes da camada de limpeza e padronizacao (src/lib/limpeza.js).
// Rodar com:  npm test   (usa o test runner nativo do Node 18+, sem dependencias extras)
import { test } from "node:test";
import assert from "node:assert/strict";
import { costByMonth } from "../src/lib/motor.js";
import {
  cleanNum, toDate, cleanStr, cleanCompetencia, dropBlankRows, isNullToken,
  groupBySpelling, sameKind, validateSemanticGroups, collectHarmonizeCandidates,
  harmonizeCategoricalValues, cleanAndNormalize, createQualityReport, summarizeCompleteness,
  findIntervalPairs, applyDateIntervals, buildDurationBands, normalizeMonthText, maskCpf,
} from "../src/lib/limpeza.js";

/* ------------------------------- numeros ------------------------------- */
test("cleanNum entende formatos brasileiros e americanos", () => {
  const casos = [
    ["R$ 1.234,56", 1234.56], ["1234.56", 1234.56], ["3.5", 3.5], ["1.234", 1234],
    ["12,5%", 12.5], ["(1.500,00)", -1500], ["-3", -3], ["1,234.56", 1234.56],
    ["1.234.567,89", 1234567.89], ["00123", 123], [42, 42],
  ];
  for (const [entrada, esperado] of casos) assert.equal(cleanNum(entrada), esperado, `cleanNum(${JSON.stringify(entrada)})`);
});

test("cleanNum devolve null para vazio, texto de vazio e datas", () => {
  for (const v of ["N/A", "-", "", null, undefined, "2024-01-05", "05/01/2024", new Date()]) {
    assert.equal(cleanNum(v), null, `cleanNum(${String(v)})`);
  }
});

/* -------------------------------- datas -------------------------------- */
test("toDate: dd/mm/aaaa e ano de 2 digitos", () => {
  const a = toDate("05/01/2024");
  assert.deepEqual([a.getFullYear(), a.getMonth(), a.getDate()], [2024, 0, 5]);
  assert.equal(toDate("15/03/85").getFullYear(), 1985);
  assert.equal(toDate("15/03/26").getFullYear(), 2026);
});

test("toDate: textos de vazio viram null", () => {
  for (const v of ["-", "N/A", "", null]) assert.equal(toDate(v), null);
});

/* ------------------------------- textos -------------------------------- */
test("cleanStr remove espacos extras e textos de vazio", () => {
  assert.equal(cleanStr("São   Paulo"), "São Paulo");
  assert.equal(cleanStr(" SP "), "SP");
  assert.equal(cleanStr("Analista"), "Analista");
  for (const v of [" N/A ", "—", "#N/D", "null", "sem informação"]) assert.equal(cleanStr(v), null, v);
});

test("isNullToken ignora acento e maiuscula", () => {
  assert.equal(isNullToken("Não Informado"), true);
  assert.equal(isNullToken("São Paulo"), false);
});

test("cleanCompetencia converte Date em AAAA-MM", () => {
  assert.equal(cleanCompetencia(new Date(2025, 0, 1)), "2025-01");
  assert.equal(cleanCompetencia("2025-02"), "2025-02");
});

test("dropBlankRows remove so as linhas realmente vazias", () => {
  const r = dropBlankRows([
    { a: null, b: "" }, { a: "-", b: null }, { a: 0, b: null }, { a: "x", b: null }, { a: new Date(), b: null },
  ]);
  assert.equal(r.rows.length, 3);
  assert.equal(r.dropped, 2);
});

/* ---------------------- padronizacao por grafia ------------------------ */
test("groupBySpelling une grafias e escolhe a forma mais bem escrita", () => {
  const map = groupBySpelling(new Map([["SP", 10], ["São Paulo", 20], ["sao paulo", 5], ["SÃO PAULO", 3], ["RJ", 8]]));
  assert.deepEqual(Object.fromEntries(map), { "sao paulo": "São Paulo", "SÃO PAULO": "São Paulo" });
});

/* --------------------- guardas contra uniao errada --------------------- */
test("sameKind nao deixa unir niveis diferentes", () => {
  assert.equal(sameKind("Analista I", "Analista II"), false);
  assert.equal(sameKind("Analista Jr", "Analista Sr"), false);
  assert.equal(sameKind("Nível 1", "Nível 2"), false);
  assert.equal(sameKind("SP", "São Paulo"), true);
});

test("validateSemanticGroups descarta grupos inseguros", () => {
  const valores = ["São Paulo", "SP", "Rio de Janeiro", "RJ", "Analista I", "Analista II"];
  const map = validateSemanticGroups([
    { canonical: "São Paulo", variants: ["SP"] },                 // ok
    { canonical: "Minas Gerais", variants: ["MG"] },              // canonical inexistente
    { canonical: "Analista I", variants: ["Analista II"] },       // niveis diferentes
    { canonical: "Rio de Janeiro", variants: ["RJ", "Inventado"] },// variante inexistente e ignorada
  ], valores);
  assert.deepEqual(Object.fromEntries(map), { SP: "São Paulo", RJ: "Rio de Janeiro" });
  assert.equal(validateSemanticGroups("lixo", valores).size, 0);
});

/* -------------------- padronizacao ponta a ponta ----------------------- */
const rep = (v, n) => Array.from({ length: n }, () => v);
function baseSuja() {
  const estados = [...rep("São Paulo", 20), ...rep("SP", 10), ...rep("sao paulo", 5), ...rep("SÃO PAULO", 3), ...rep("RJ", 8), ...rep("Rio de Janeiro", 6), ...rep("MG", 4)];
  const generos = estados.map((_, i) => ["Feminino", "F", "Masculino", "M", "Fem"][i % 5]);
  const cargos = estados.map((_, i) => ["Analista I", "Analista II", "Gerente", "Ger."][i % 4]);
  return {
    funcionarios: estados.map((e, i) => ({
      matricula: 1000 + i, nome: `Pessoa ${i}`, status: "Ativo", estado: e, genero: generos[i], cargo: cargos[i],
      idade: 20 + (i % 30), observacao: `texto livre unico ${i}`, filial: "Não informado",
    })),
    movimentacoes: [], rs: [], desligamentos: [], entrevistas: [], folha: [],
  };
}
const unicos = (d, k) => [...new Set(d.funcionarios.map((r) => r[k]))].sort();

// IA simulada, com acertos E erros de proposito.
function iaSimulada(enviados = []) {
  return async (campos) => {
    campos.forEach((c) => enviados.push(c.field));
    const porCampo = {
      estado: [{ canonical: "São Paulo", variants: ["SP"] }, { canonical: "Rio de Janeiro", variants: ["RJ"] }, { canonical: "Minas Gerais", variants: ["MG"] }],
      genero: [{ canonical: "Feminino", variants: ["F", "Fem"] }, { canonical: "Masculino", variants: ["M"] }],
      cargo: [{ canonical: "Analista I", variants: ["Analista II"] }, { canonical: "Gerente", variants: ["Ger."] }],
    };
    return new Map(campos.map((c) => [c.id, porCampo[c.field] || []]));
  };
}

test("harmonize: aplica o que e seguro e recusa o resto", async () => {
  const d = baseSuja(); const log = []; const enviados = [];
  await harmonizeCategoricalValues(d, { askAI: iaSimulada(enviados) }, log);
  assert.deepEqual(unicos(d, "estado"), ["MG", "Rio de Janeiro", "São Paulo"]);
  assert.deepEqual(unicos(d, "genero"), ["Feminino", "Masculino"]);
  assert.deepEqual(unicos(d, "cargo"), ["Analista I", "Analista II", "Gerente"]);
  assert.equal(d.funcionarios[0].nome, "Pessoa 0");
  assert.ok(log.length > 0);
});

test("harmonize: a IA so recebe campos de categoria (nunca nomes, ids ou texto livre)", async () => {
  const enviados = [];
  await harmonizeCategoricalValues(baseSuja(), { askAI: iaSimulada(enviados) }, []);
  assert.deepEqual(enviados.sort(), ["cargo", "estado", "genero"]);
});

test("harmonize sem IA: so a grafia e corrigida", async () => {
  const d = baseSuja();
  await harmonizeCategoricalValues(d, {}, []);
  assert.deepEqual(unicos(d, "estado"), ["MG", "RJ", "Rio de Janeiro", "SP", "São Paulo"]);
});

test("harmonize: se a IA falhar, segue com a grafia e avisa no log", async () => {
  const d = baseSuja(); const log = [];
  await harmonizeCategoricalValues(d, { askAI: async () => { throw new Error("401"); } }, log);
  assert.deepEqual(unicos(d, "estado"), ["MG", "RJ", "Rio de Janeiro", "SP", "São Paulo"]);
  assert.ok(log.some((l) => l.includes("não foi aplicada")));
});

test("harmonize: resposta da IA sem sentido nao quebra nada", async () => {
  const d = baseSuja();
  await harmonizeCategoricalValues(d, { askAI: async () => new Map([["f1", "lixo"], ["f2", null]]) }, []);
  assert.deepEqual(unicos(d, "estado"), ["MG", "RJ", "Rio de Janeiro", "SP", "São Paulo"]);
});

test("collectHarmonizeCandidates ignora identificadores, nomes e texto livre", () => {
  const campos = collectHarmonizeCandidates(baseSuja()).map((c) => c.field).sort();
  assert.deepEqual(campos, ["cargo", "estado", "genero"]);
});

/* --------------------------- limpeza completa --------------------------- */
test("cleanAndNormalize: sem cadastro de funcionarios nao quebra e avisa", () => {
  const log = [];
  const out = cleanAndNormalize({}, log);
  assert.deepEqual(out.funcionarios, []);
  assert.ok(log.length > 0);
});

/* ----------------------- relatorio de qualidade ------------------------ */
test("relatorio: conta linhas lidas, aproveitadas, duplicadas e descartadas", () => {
  const report = createQualityReport();
  const found = {
    funcionarios: [
      { matricula: 1, nome: "Ana", data_admissao: "01/02/2020" },
      { matricula: 1, nome: "Ana", data_admissao: "01/02/2020" },   // duplicada
      { matricula: 2, nome: "Beto" },                                // sem data de admissao
      { matricula: "-", nome: "Sem matricula" },                     // descartada
    ],
    folha: [
      { matricula: 1, competencia: "2025-01", salario_base: 1000 },
      { matricula: 99, competencia: "2025-01", salario_base: 1000 }, // nao existe no cadastro
    ],
  };
  cleanAndNormalize(found, [], report);
  assert.deepEqual(report.tables.funcionarios, { received: 4, kept: 2, duplicates: 1, discarded: 1, noAdmissionDate: 1 });
  assert.deepEqual(report.tables.folha, { received: 2, kept: 1, duplicates: 0, discarded: 1 });
});

test("relatorio: registra o que a padronizacao mudou e o estado da IA", async () => {
  const report = createQualityReport();
  await harmonizeCategoricalValues(baseSuja(), { askAI: iaSimulada() }, [], report);
  assert.equal(report.aiStatus, "aplicada");
  const estado = report.harmonized.find((h) => h.field === "estado");
  assert.ok(estado.rows > 0);
  const sp = estado.groups.find((g) => g.to === "São Paulo");
  assert.ok(sp.from.includes("SP"));
  assert.equal(sp.kind, "significado");

  const r2 = createQualityReport();
  await harmonizeCategoricalValues(baseSuja(), {}, [], r2);
  assert.equal(r2.aiStatus, "sem_chave");
  assert.equal(r2.harmonized.find((h) => h.field === "estado").groups[0].kind, "grafia");

  const r3 = createQualityReport();
  await harmonizeCategoricalValues(baseSuja(), { askAI: async () => { throw new Error("x"); } }, [], r3);
  assert.equal(r3.aiStatus, "falhou");
});

test("summarizeCompleteness aponta campos com muitos vazios e ignora nome/cpf", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    matricula: i, nome: null, cpf: null, centro_custo: null, area: i < 6 ? "TI" : "Não informado", genero: "F", salario_atual: i < 9 ? 1000 : null,
  }));
  const out = summarizeCompleteness({ funcionarios: rows });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].fields.map((f) => [f.field, f.pct]), [["area", 40], ["salario_atual", 10]]);
});

test("relatorio: conta textos de vazio (N/A, -) encontrados na planilha", () => {
  const report = createQualityReport();
  cleanAndNormalize({ funcionarios: [
    { matricula: 1, nome: "Ana", cargo: "N/A", area: "-" },
    { matricula: 2, nome: "Beto", cargo: "Analista", area: "#N/D" },
    { matricula: 3, nome: "Caio", cargo: "", area: null },   // vazio de verdade nao conta
  ] }, [], report);
  assert.equal(report.emptyTexts, 3);
});

/* ------------------------ intervalos de datas -------------------------- */
test("findIntervalPairs acha pares inicio/fim, inclusive em campos extras", () => {
  const pares = findIntervalPairs(["data_admissao", "data_desligamento", "extra_data_inicio_afastamento", "extra_data_fim_afastamento", "data_evento"]);
  assert.deepEqual(pares.map((p) => [p.start, p.end, p.name]), [
    ["extra_data_inicio_afastamento", "extra_data_fim_afastamento", "afastamento"],
    ["data_admissao", "data_desligamento", "admissao_desligamento"],
  ]);
  // temas diferentes nao se misturam: inicio de ferias com fim de afastamento
  assert.equal(findIntervalPairs(["extra_inicio_ferias", "extra_fim_afastamento"]).length, 0);
});

test("applyDateIntervals calcula dias, ignora fim antes do inicio e conta os em andamento", () => {
  const d = (s) => new Date(s + "T00:00:00");
  const data = { movimentacoes: [
    { extra_data_inicio_licenca: d("2025-01-01"), extra_data_fim_licenca: d("2025-01-11") },
    { extra_data_inicio_licenca: d("2025-02-01"), extra_data_fim_licenca: null },           // em andamento
    { extra_data_inicio_licenca: d("2025-03-10"), extra_data_fim_licenca: d("2025-03-01") },// inconsistente
    { extra_data_inicio_licenca: d("2025-04-01"), extra_data_fim_licenca: d("2025-04-21") },
  ] };
  const report = createQualityReport();
  const out = applyDateIntervals(data, report);
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].total, out[0].computed, out[0].open, out[0].invalid, out[0].avgDays], [4, 2, 1, 1, 15]);
  assert.equal(out[0].field, "extra_duracao_licenca_dias");
  assert.deepEqual(data.movimentacoes.map((r) => r.extra_duracao_licenca_dias), [10, null, null, 20]);
  assert.equal(report.intervals.length, 1);
});

test("applyDateIntervals so confere os pares que ja tem duracao propria", () => {
  const d = (s) => new Date(s + "T00:00:00");
  const data = { rs: [
    { data_abertura: d("2025-01-01"), data_fechamento: d("2025-01-31") },
    { data_abertura: d("2025-02-10"), data_fechamento: d("2025-02-01") },
  ] };
  const out = applyDateIntervals(data);
  assert.equal(out[0].field, null);
  assert.equal(out[0].invalid, 1);
  assert.deepEqual(Object.keys(data.rs[0]), ["data_abertura", "data_fechamento"]); // nenhum campo novo
});

test("vaga que fecha antes de abrir nao gera tempo de contratacao negativo", () => {
  const out = cleanAndNormalize({ rs: [
    { id_vaga: "V1", data_abertura: "01/03/2025", data_fechamento: "31/03/2025" },
    { id_vaga: "V2", data_abertura: "10/03/2025", data_fechamento: "01/03/2025" },
  ] }, []);
  assert.deepEqual(out.rs.map((v) => v.tempo_contratacao_dias), [30, null]);
});

test("buildDurationBands cria faixas redondas e ignora poucas duracoes", () => {
  const bands = buildDurationBands([3, 10, 25, 40, 61, 88, 120]);
  assert.deepEqual(bands.map((b) => b.label), ["até 30 dias", "31 a 60 dias", "61 a 90 dias", "91 a 120 dias", "121 a 150 dias"]);
  assert.equal(buildDurationBands([1, 2, 3]), null);        // poucos valores
  assert.equal(buildDurationBands([1, 2, 3, 4, 5, 6]), null); // tudo muito curto
});

test("applyDateIntervals cria o campo de faixa de duracao, com em andamento e inconsistente", () => {
  const d = (dias) => new Date(2025, 0, 1 + dias);
  const rows = [0, 10, 25, 40, 70, 95].map((dias) => ({ extra_data_inicio_x: d(0), extra_data_fim_x: d(dias) }));
  rows.push({ extra_data_inicio_x: d(0), extra_data_fim_x: null });
  rows.push({ extra_data_inicio_x: d(50), extra_data_fim_x: d(10) });
  const data = { movimentacoes: rows };
  const [iv] = applyDateIntervals(data);
  assert.equal(iv.faixaField, "extra_faixa_duracao_x_dias");
  assert.deepEqual(data.movimentacoes.map((r) => r.extra_faixa_duracao_x_dias), [
    "até 30 dias", "até 30 dias", "até 30 dias", "31 a 60 dias", "61 a 90 dias", "91 a 120 dias", "Em andamento", "Inconsistente",
  ]);
});

/* ------------------------ competencia (mes em texto) ------------------------ */
test("normalizeMonthText entende varias escritas de mes e devolve AAAA-MM", () => {
  const casos = [
    ["2025-11", "2025-11"], ["2025/11", "2025-11"], ["11/2025", "2025-11"], ["1-2026", "2026-01"],
    ["202511", "2025-11"], ["2025-11-03", "2025-11"], ["03/11/2025", "2025-11"],
    ["nov/25", "2025-11"], ["Nov-2025", "2025-11"], ["novembro 2025", "2025-11"], ["mar/24", "2024-03"], ["Março/2024", "2024-03"],
  ];
  for (const [entrada, esperado] of casos) assert.equal(normalizeMonthText(entrada), esperado, `normalizeMonthText(${JSON.stringify(entrada)})`);
});

test("normalizeMonthText devolve null para o que nao e mes", () => {
  for (const v of ["13/2025", "2025-13", "abc", "texto qualquer", "", null, "12345"]) assert.equal(normalizeMonthText(v), null, String(v));
});

test("folha: competencias em formatos diferentes caem no mesmo mes e o grafico fica continuo", () => {
  const report = createQualityReport();
  const found = {
    funcionarios: [{ matricula: 1, nome: "Ana", data_admissao: "2025-01-01" }, { matricula: 2, nome: "Beto", data_admissao: "2025-01-01" }],
    folha: [
      { matricula: 1, competencia: "2025-10", salario_base: 100, custo_total_ctc: 100 },
      { matricula: 2, competencia: "10/2025", salario_base: 100, custo_total_ctc: 100 },
      { matricula: 1, competencia: "2025/11", salario_base: 100, custo_total_ctc: 100 },
      { matricula: 2, competencia: "2025-11", salario_base: 100, custo_total_ctc: 100 },
      { matricula: 1, competencia: "dez/25", salario_base: 100, custo_total_ctc: 100 },
      { matricula: 2, competencia: "2025-12", salario_base: 100, custo_total_ctc: 100 },
    ],
  };
  const out = cleanAndNormalize(found, [], report);
  assert.deepEqual(costByMonth(out.folha, "custo_total_ctc").map((x) => [x.mes, x.total]), [["2025-10", 200], ["2025-11", 200], ["2025-12", 200]]);
  const h = report.harmonized.find((x) => x.field === "competencia");
  assert.equal(h.rows, 3);
  assert.deepEqual(h.groups.map((g) => g.to).sort(), ["2025-10", "2025-11", "2025-12"]);
});

test("maskCpf esconde o numero mas deixa o formato reconhecivel", () => {
  assert.equal(maskCpf("123.456.789-09"), "###.###.###-##");
  assert.equal(maskCpf("12345678909"), "###.###.###-##");
  assert.equal(maskCpf("Maria Silva"), "Maria Silva");
  assert.equal(maskCpf("2025-11-03"), "2025-11-03");
  assert.equal(maskCpf(4500), 4500);
});

test("toDate: numero fora do intervalo de data do Excel vira vazio, nunca 'Invalid Date'", () => {
  assert.equal(toDate(1750000000000), null);   // milissegundos de timestamp
  assert.equal(toDate(99999999), null);
  assert.equal(toDate(0), null);
  const ok = toDate(45000);                    // serial valido do Excel (2023)
  assert.ok(ok instanceof Date && !isNaN(ok) && ok.getFullYear() === 2023);
});
