// Testes do motor de calculo (src/lib/motor.js): perfil, validacao do plano da IA e calculo dos numeros.
// Rodar com:  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeAgg, applyFilters, joinWithFuncionarios, rowMatchesPeriod, computeKpiValue, computeChartData,
  validateChart, validateKpi, validatePlan, validateFilterFields, buildDataProfile, applyGlobalFilters,
  matchesPeriodFilter, monthKey, monthLabel, addMonths, monthsBetween, isSensitiveMetric,
  resolveCostMeasure, costByMonth, resolvePayrollSimulation, realCategory, usableRiskDimensions, availableTableLabels,
} from "../src/lib/motor.js";

const d = (s) => new Date(s + "T00:00:00");
const SEM_FILTRO = { year: "", month: "" };

/* Base pequena e conhecida: 6 funcionarios, folha, desligamentos e vagas. */
function baseExemplo() {
  const funcionarios = [
    { matricula: 1, area: "TI", genero: "Feminino", status: "Ativo", salario_atual: 5000, data_admissao: d("2020-01-10"), data_desligamento: null },
    { matricula: 2, area: "TI", genero: "Masculino", status: "Ativo", salario_atual: 7000, data_admissao: d("2021-03-05"), data_desligamento: null },
    { matricula: 3, area: "TI", genero: "Feminino", status: "Ativo", salario_atual: 6000, data_admissao: d("2022-06-01"), data_desligamento: null },
    { matricula: 4, area: "RH", genero: "Feminino", status: "Ativo", salario_atual: 4000, data_admissao: d("2019-02-01"), data_desligamento: null },
    { matricula: 5, area: "RH", genero: "Masculino", status: "Desligado", salario_atual: 4500, data_admissao: d("2018-05-01"), data_desligamento: d("2024-03-15") },
    { matricula: 6, area: null, genero: "Masculino", status: "Ativo", salario_atual: 3000, data_admissao: d("2023-01-01"), data_desligamento: null },
  ];
  const folha = [
    { matricula: 1, competencia: "2025-01", custo_total_ctc: 100, horas_extras: 1 },
    { matricula: 1, competencia: "2025-02", custo_total_ctc: 100, horas_extras: 1 },
    { matricula: 2, competencia: "2025-01", custo_total_ctc: 300, horas_extras: 3 },
    { matricula: 4, competencia: "2025-02", custo_total_ctc: 200, horas_extras: 2 },
  ];
  const desligamentos = [{ matricula: 5, data_desligamento: d("2024-03-15"), tipo_desligamento: "Voluntário" }];
  const rs = [
    { id_vaga: "V1", status: "Fechada", data_abertura: d("2025-01-05"), tempo_contratacao_dias: 20 },
    { id_vaga: "V2", status: "Fechada", data_abertura: d("2025-02-05"), tempo_contratacao_dias: 40 },
    { id_vaga: "V3", status: "Aberta", data_abertura: d("2025-02-20"), tempo_contratacao_dias: null },
  ];
  return { funcionarios, folha, desligamentos, rs, movimentacoes: [], entrevistas: [] };
}

/* ------------------------------ agregacoes ------------------------------ */
test("computeAgg: contagem, soma, media, mediana, minimo e maximo", () => {
  const rows = [{ v: 10 }, { v: 20 }, { v: 90 }, { v: null }, { v: "texto" }];
  assert.equal(computeAgg(rows, { agg: "count" }), 5);
  assert.equal(computeAgg(rows, { agg: "sum", field: "v" }), 120);
  assert.equal(computeAgg(rows, { agg: "avg", field: "v" }), 40);
  assert.equal(computeAgg(rows, { agg: "median", field: "v" }), 20);
  assert.equal(computeAgg(rows, { agg: "min", field: "v" }), 10);
  assert.equal(computeAgg(rows, { agg: "max", field: "v" }), 90);
});

test("computeAgg: mediana de quantidade par e campo sem numeros", () => {
  assert.equal(computeAgg([{ v: 1 }, { v: 2 }, { v: 3 }, { v: 10 }], { agg: "median", field: "v" }), 2.5);
  assert.equal(computeAgg([{ v: null }], { agg: "avg", field: "v" }), 0);
});

/* ------------------------------- filtros -------------------------------- */
test("applyFilters: eq ignora acento e maiuscula; neq, not_null, gt e lt", () => {
  const rows = [
    { a: "São Paulo", n: 5 }, { a: "sao paulo", n: 15 }, { a: "Rio", n: null }, { a: "", n: 25 },
  ];
  assert.equal(applyFilters(rows, [{ field: "a", op: "eq", value: "SÃO PAULO" }]).length, 2);
  assert.equal(applyFilters(rows, [{ field: "a", op: "neq", value: "Rio" }]).length, 3);
  assert.equal(applyFilters(rows, [{ field: "a", op: "not_null" }]).length, 3);
  assert.equal(applyFilters(rows, [{ field: "n", op: "gt", value: 10 }]).length, 2);
  assert.equal(applyFilters(rows, [{ field: "n", op: "lt", value: 10 }]).length, 1);
  assert.equal(applyFilters(rows, []).length, 4);
});

/* -------------------------- cruzamento por matricula -------------------- */
test("joinWithFuncionarios traz atributos do funcionario sem sobrescrever os da propria linha", () => {
  const data = baseExemplo();
  const folha = joinWithFuncionarios(data.folha, "folha", data);
  assert.equal(folha[0].genero, "Feminino");
  assert.equal(folha[0].custo_total_ctc, 100);
  const desl = joinWithFuncionarios([{ matricula: 5, status: "proprio" }], "desligamentos", data);
  assert.equal(desl[0].status, "proprio");          // nao sobrescreve
  assert.equal(joinWithFuncionarios(data.rs, "rs", data), data.rs); // vagas nao cruzam
});

/* -------------------------------- periodo ------------------------------- */
test("rowMatchesPeriod: sem filtro sempre vale; evento pontual; competencia em texto", () => {
  assert.equal(rowMatchesPeriod({ x: 1 }, SEM_FILTRO), true);
  const vaga = { data_abertura: d("2025-02-05") };
  assert.equal(rowMatchesPeriod(vaga, { year: "2025", month: "" }), true);
  assert.equal(rowMatchesPeriod(vaga, { year: "2025", month: "03" }), false);
  assert.equal(rowMatchesPeriod({ competencia: "2025-01" }, { year: "2025", month: "01" }), true);
  assert.equal(rowMatchesPeriod({ competencia: "2025-01" }, { year: "2024", month: "" }), false);
});

test("rowMatchesPeriod: funcionario ativo ha anos continua contando no periodo", () => {
  const ativo = { data_admissao: d("2019-02-01"), data_desligamento: null };
  const desligadoAntes = { data_admissao: d("2018-05-01"), data_desligamento: d("2020-03-15") };
  assert.equal(rowMatchesPeriod(ativo, { year: "2025", month: "" }), true);
  assert.equal(rowMatchesPeriod(desligadoAntes, { year: "2025", month: "" }), false);
  assert.equal(rowMatchesPeriod(desligadoAntes, { year: "2019", month: "" }), true);
});

test("helpers de mes: chave, rotulo, soma de meses e intervalo", () => {
  assert.equal(monthKey(d("2025-03-09")), "2025-03");
  assert.equal(monthLabel("2025-01"), "Jan/25");
  assert.equal(addMonths("2025-11", 3), "2026-02");
  assert.deepEqual(monthsBetween("2025-01", "2025-03"), ["2025-01", "2025-02", "2025-03"]);
  assert.equal(matchesPeriodFilter("2025-03", { year: "2025", month: "03" }), true);
  assert.equal(matchesPeriodFilter("2025-03", { year: "2024", month: "" }), false);
});

/* --------------------------------- KPIs --------------------------------- */
test("computeKpiValue: contagem com filtro, media e filtro de periodo", () => {
  const data = baseExemplo();
  const ativos = { source: "funcionarios", agg: "count", field: null, filters: [{ field: "status", op: "eq", value: "Ativo" }] };
  assert.equal(computeKpiValue(ativos, data, SEM_FILTRO), 5);
  assert.equal(computeKpiValue({ source: "funcionarios", agg: "avg", field: "salario_atual", filters: [] }, data, SEM_FILTRO), 4916.67);
  assert.equal(computeKpiValue({ source: "rs", agg: "median", field: "tempo_contratacao_dias", filters: [] }, data, SEM_FILTRO), 30);
  assert.equal(computeKpiValue({ source: "rs", agg: "count", field: null, filters: [] }, data, { year: "2025", month: "02" }), 2);
});

test("computeKpiValue: filtro por campo do funcionario em outra tabela (cruzamento)", () => {
  const data = baseExemplo();
  const kpi = { source: "folha", agg: "sum", field: "custo_total_ctc", filters: [{ field: "area", op: "eq", value: "TI" }] };
  assert.equal(computeKpiValue(kpi, data, SEM_FILTRO), 500);
});

/* -------------------------------- graficos ------------------------------ */
const porNome = (rows) => Object.fromEntries(rows.map((r) => [r.name, r.value]));

test("computeChartData: contagem por categoria, 'Não informado' para vazio, ordenacao e limite", () => {
  const data = baseExemplo();
  const spec = { source: "funcionarios", filters: [], group_by: { kind: "category", field: "area" }, metric: { agg: "count", field: null }, sort: "value_desc", limit: null };
  const out = computeChartData(spec, data, null, SEM_FILTRO);
  assert.deepEqual(out.map((r) => [r.name, r.value]), [["TI", 3], ["RH", 2], ["Não informado", 1]]);
  assert.equal(computeChartData({ ...spec, limit: 1 }, data, null, SEM_FILTRO).length, 1);
});

test("computeChartData: serie mensal em ordem cronologica com rotulo Mes/Ano", () => {
  const data = baseExemplo();
  // "competencia" e guardada como texto AAAA-MM (categoria); o motor reconhece e trata como serie mensal.
  const spec = { source: "folha", filters: [], group_by: { kind: "category", field: "competencia" }, metric: { agg: "sum", field: "horas_extras" }, sort: "none" };
  assert.deepEqual(computeChartData(spec, data, null, SEM_FILTRO), [{ name: "Jan/25", value: 4 }, { name: "Fev/25", value: 3 }]);
  assert.deepEqual(computeChartData(spec, data, null, { year: "2025", month: "02" }), [{ name: "Fev/25", value: 3 }]);
  // campo de data de verdade (Date) agrupa por mes
  const vagas = { source: "rs", filters: [], group_by: { kind: "month", field: "data_abertura" }, metric: { agg: "count", field: null }, sort: "none" };
  assert.deepEqual(computeChartData(vagas, data, null, SEM_FILTRO), [{ name: "Jan/25", value: 1 }, { name: "Fev/25", value: 2 }]);
});

test("computeChartData: agrupa por campo de funcionario mesmo em outra tabela", () => {
  const data = baseExemplo();
  const spec = { source: "folha", filters: [], group_by: { kind: "category", field: "genero" }, metric: { agg: "sum", field: "horas_extras" }, sort: "none" };
  assert.deepEqual(porNome(computeChartData(spec, data, null, SEM_FILTRO)), { Feminino: 4, Masculino: 3 });
});

test("computeChartData: barras empilhadas (duas dimensoes)", () => {
  const data = baseExemplo();
  const spec = { source: "funcionarios", filters: [], group_by: { kind: "category", field: "area" }, series_by: { field: "genero" }, metric: { agg: "count", field: null }, sort: "label_asc" };
  const out = computeChartData(spec, data, null, SEM_FILTRO);
  const ti = out.find((r) => r.name === "TI");
  assert.deepEqual([ti.Feminino, ti.Masculino], [2, 1]);
});

test("computeChartData: rotulos com numero ficam em ordem natural (faixas de duracao)", () => {
  const rows = ["31 a 60 dias", "até 30 dias", "Em andamento", "91 a 120 dias", "61 a 90 dias", "até 30 dias"].map((f) => ({ faixa: f }));
  const spec = { source: "rs", filters: [], group_by: { kind: "category", field: "faixa" }, metric: { agg: "count", field: null }, sort: "none" };
  const out = computeChartData(spec, { rs: rows }, null, SEM_FILTRO);
  assert.deepEqual(out.map((r) => r.name), ["até 30 dias", "31 a 60 dias", "61 a 90 dias", "91 a 120 dias", "Em andamento"]);
});

test("computeChartData: salario de grupo com menos de 5 pessoas e ocultado (privacidade)", () => {
  const data = baseExemplo();
  const spec = { source: "funcionarios", filters: [], group_by: { kind: "category", field: "area" }, metric: { agg: "avg", field: "salario_atual" }, sort: "none" };
  assert.ok(computeChartData(spec, data, null, SEM_FILTRO).every((r) => r.value === null));
  assert.equal(isSensitiveMetric({ agg: "avg", field: "salario_atual" }), true);
  assert.equal(isSensitiveMetric({ agg: "count", field: "salario_atual" }), false);
});

test("computeChartData: serie especial de headcount usa as series prontas", () => {
  const out = computeChartData({ special: "headcount_trend" }, {}, { headcountByMonth: [{ label: "Jan/25", ativos: 7 }] }, SEM_FILTRO);
  assert.deepEqual(out, [{ name: "Jan/25", value: 7 }]);
});

/* ---------------------- validacao do que a IA propoe -------------------- */
const perfil = () => buildDataProfile(baseExemplo());

test("buildDataProfile descreve o tipo de cada campo", () => {
  const p = perfil();
  assert.equal(p.funcionarios.row_count, 6);
  assert.equal(p.funcionarios.fields.area.type, "categorical");
  assert.equal(p.funcionarios.fields.salario_atual.type, "numeric");
  assert.equal(p.funcionarios.fields.data_admissao.type, "date");
  assert.equal(p.movimentacoes.row_count, 0);
});

test("validateChart: descarta campo inexistente, identificador e metrica sem campo", () => {
  const p = perfil();
  const base = { id: "c", title: "t", chart_type: "bar", source: "funcionarios", group_by: { kind: "category", field: "area" }, metric: { agg: "count" } };
  assert.ok(validateChart(p, base));
  assert.equal(validateChart(p, { ...base, group_by: { kind: "category", field: "inexistente" } }), null);
  assert.equal(validateChart(p, { ...base, group_by: { kind: "category", field: "matricula" } }), null);
  assert.equal(validateChart(p, { ...base, metric: { agg: "avg" } }), null);
  assert.equal(validateChart(p, { ...base, source: "tabela_que_nao_existe" }), null);
  assert.equal(validateChart(p, { ...base, chart_type: "mapa" }), null);
});

test("validateChart: campo de data sempre agrupa por mes e mediana e aceita", () => {
  const p = perfil();
  const v = validateChart(p, { id: "c", title: "t", chart_type: "line", source: "rs", group_by: { kind: "category", field: "data_abertura" }, metric: { agg: "median", field: "tempo_contratacao_dias" } });
  assert.equal(v.group_by.kind, "month");
  assert.equal(v.metric.agg, "median");
});

test("validateChart: series_by so aceita campo categorico diferente do principal", () => {
  const p = perfil();
  const base = { id: "c", title: "t", chart_type: "line", source: "funcionarios", group_by: { kind: "category", field: "area" }, metric: { agg: "count" } };
  assert.equal(validateChart(p, { ...base, series_by: { field: "genero" } }).series_by.field, "genero");
  assert.equal(validateChart(p, { ...base, series_by: { field: "genero" } }).chart_type, "bar"); // empilhado vira barra
  assert.equal(validateChart(p, { ...base, series_by: { field: "area" } }).series_by, null);
  assert.equal(validateChart(p, { ...base, series_by: { field: "salario_atual" } }).series_by, null);
});

test("validateKpi e validatePlan: so sobrevive o que o perfil sustenta", () => {
  const p = perfil();
  assert.ok(validateKpi(p, { id: "k", label: "Ativos", source: "funcionarios", agg: "count" }));
  assert.equal(validateKpi(p, { id: "k", label: "x", source: "funcionarios", agg: "sum", field: "nao_existe" }), null);
  const plano = validatePlan({
    pages: [
      { id: "a", label: "A", kpis: [{ id: "k", label: "x", source: "funcionarios", agg: "count" }], charts: [] },
      { id: "b", label: "B", kpis: [{ id: "k2", label: "y", source: "tabela_falsa", agg: "count" }], charts: [] }, // some inteira
    ],
    filter_fields: [{ table: "funcionarios", field: "area" }, { table: "funcionarios", field: "salario_atual" }],
  }, p);
  assert.deepEqual(plano.pages.map((x) => x.id), ["a"]);
  assert.deepEqual(plano.filter_fields, [{ table: "funcionarios", field: "area" }]); // numerico nao vira filtro
});

test("validateFilterFields: respeita cardinalidade e remove duplicados", () => {
  const p = perfil();
  const out = validateFilterFields([
    { table: "funcionarios", field: "genero" }, { table: "funcionarios", field: "genero" }, { table: "funcionarios", field: "status" },
    { table: "rs", field: "id_vaga" }, // 3 valores distintos, ok
  ], p);
  assert.deepEqual(out.map((f) => f.field), ["genero", "status", "id_vaga"]);
});

/* ------------------------------ filtros globais ------------------------- */
test("applyGlobalFilters: filtro de funcionarios cascateia para as tabelas ligadas por matricula", () => {
  const data = baseExemplo();
  const out = applyGlobalFilters(data, [{ table: "funcionarios", field: "area", value: "TI" }]);
  assert.equal(out.funcionarios.length, 3);
  assert.equal(out.folha.length, 3);          // matriculas 1, 1 e 2
  assert.equal(out.desligamentos.length, 0);  // quem saiu era de RH
  assert.equal(out.rs.length, 3);             // vagas nao cascateiam
});

test("applyGlobalFilters: vagas filtram pelos proprios campos; sem filtro devolve a base", () => {
  const data = baseExemplo();
  assert.equal(applyGlobalFilters(data, [{ table: "rs", field: "status", value: "Aberta" }]).rs.length, 1);
  assert.equal(applyGlobalFilters(data, []), data);
});

/* ------------------- custo de folha: so o que a base tem ---------------- */
test("resolveCostMeasure: usa CTC se existir, senao salario base, senao nada", () => {
  const comCtc = [{ custo_total_ctc: 200, salario_base: 100 }, { custo_total_ctc: 100, salario_base: 100 }];
  assert.equal(resolveCostMeasure(comCtc).field, "custo_total_ctc");
  assert.equal(resolveCostMeasure(comCtc).factorOverBase, 1.5);
  const soBase = [{ salario_base: 1000 }, { salario_base: 2000, custo_total_ctc: null }];
  assert.equal(resolveCostMeasure(soBase).field, "salario_base");
  assert.equal(resolveCostMeasure(soBase).factorOverBase, null);
  assert.equal(resolveCostMeasure([{ custo_total_ctc: null, salario_base: null }]), null);
  assert.equal(resolveCostMeasure([]), null);
});

test("costByMonth: soma por competencia e ignora meses sem valor", () => {
  const folha = [
    { competencia: "2025-02", salario_base: 50 }, { competencia: "2025-01", salario_base: 100 },
    { competencia: "2025-01", salario_base: 20 }, { competencia: "2025-03", salario_base: null },
  ];
  assert.deepEqual(costByMonth(folha, "salario_base").map((m) => [m.mes, m.total]), [["2025-01", 120], ["2025-02", 50]]);
  assert.deepEqual(costByMonth(folha, "custo_total_ctc"), []); // campo que a base nao tem: nada, em vez de zeros
});

test("resolvePayrollSimulation: so simula custo com base de dados, sem inventar fator de CTC", () => {
  const ctc = { field: "custo_total_ctc", factorOverBase: 1.4 };
  assert.deepEqual(resolvePayrollSimulation(ctc, 5000), { factor: 1.4, label: "Custo de folha (CTC), base e cenário", usesCtc: true });
  assert.equal(resolvePayrollSimulation(null, 5000).usesCtc, false);          // sem CTC: so salarios
  assert.equal(resolvePayrollSimulation({ field: "custo_total_ctc", factorOverBase: null }, 5000).factor, 1);
  assert.equal(resolvePayrollSimulation(ctc, 0), null);                       // sem salario: nada
});

/* ------------- telas fixas: so o que a base tem (risco, chat) ------------ */
test("realCategory trata vazio e 'Não informado' como ausencia", () => {
  assert.equal(realCategory("Não informado"), null);
  assert.equal(realCategory(""), null);
  assert.equal(realCategory(null), null);
  assert.equal(realCategory("TI"), "TI");
});

test("usableRiskDimensions: so dimensoes com 2 ou mais categorias reais", () => {
  const dims = [{ key: "area", label: "Área" }, { key: "modelo", label: "Modelo" }, { key: "genero", label: "Gênero" }, { key: "tenure", label: "Tempo" }];
  const rm = {
    area: { TI: {}, RH: {} },                       // ok
    modelo: { "Não informado": {} },                // so "Não informado": fora
    genero: { Feminino: {} },                       // um valor so: fora
  };
  assert.deepEqual(usableRiskDimensions(rm, dims).map((d) => d.key), ["area"]);
  assert.deepEqual(usableRiskDimensions(null, dims), []);
});

test("availableTableLabels lista so as tabelas que existem na base", () => {
  const profile = buildDataProfile({ ...baseExemplo(), folha: [] });
  const labels = availableTableLabels(profile);
  assert.ok(labels.includes("Cadastro de funcionários"));
  assert.ok(labels.includes("Recrutamento e seleção (vagas)"));
  assert.ok(!labels.includes("Folha de pagamento"));
  assert.ok(!labels.includes("Movimentações de carreira"));
});

test("perfil enviado a IA nunca leva exemplos de nome, CPF, matricula ou campos com muitos valores", () => {
  const funcionarios = Array.from({ length: 40 }, (_, i) => ({
    matricula: 1000 + i, nome: `Pessoa Exemplo ${i}`, cpf: `000.000.${String(i).padStart(3, "0")}-00`,
    area: i % 2 ? "Comercial" : "Engenharia", cidade_texto_livre: `Cidade ${i}`,
  }));
  const rs = [{ id_vaga: "VG-1", recrutador_responsavel: "Ana Souza", status: "Aberta" }, { id_vaga: "VG-2", recrutador_responsavel: "Bia Lima", status: "Fechada" }];
  const perfil = buildDataProfile({ funcionarios, rs });
  const texto = JSON.stringify(perfil);
  assert.ok(!texto.includes("Pessoa Exemplo"), "nomes nao podem ir para a IA");
  assert.ok(!texto.includes("000.000."), "CPFs nao podem ir para a IA");
  assert.ok(!texto.includes("Ana Souza") && !texto.includes("VG-1"), "responsavel e id da vaga nao vao");
  assert.ok(!texto.includes("Cidade 1"), "campo com muitos valores distintos nao leva exemplos");
  assert.equal(perfil.funcionarios.fields.nome.cardinality, 40);        // o campo continua existindo no perfil
  assert.deepEqual(perfil.funcionarios.fields.area.sample_values.sort(), ["Comercial", "Engenharia"]);
  assert.deepEqual(perfil.rs.fields.status.sample_values.sort(), ["Aberta", "Fechada"]);
});

/* ------------------------------ desempenho ------------------------------ */
test("min e max funcionam com centenas de milhares de linhas (sem estourar a pilha)", () => {
  const rows = Array.from({ length: 300000 }, (_, i) => ({ v: i % 1000 }));
  assert.equal(computeAgg(rows, { agg: "min", field: "v" }), 0);
  assert.equal(computeAgg(rows, { agg: "max", field: "v" }), 999);
  const perfil = buildDataProfile({ funcionarios: rows.map((r, i) => ({ matricula: i, valor: r.v })) });
  assert.equal(perfil.funcionarios.fields.valor.max, 999);
});

test("perfil ignora datas invalidas em vez de quebrar", () => {
  const perfil = buildDataProfile({ funcionarios: [{ matricula: 1, data_admissao: new Date("2024-01-10") }, { matricula: 2, data_admissao: new Date("lixo") }] });
  assert.equal(perfil.funcionarios.fields.data_admissao.min, "2024-01-10");
});

test("cruzamento sob demanda: pular o JOIN nao muda nenhum resultado", () => {
  const funcionarios = Array.from({ length: 60 }, (_, i) => ({ matricula: i, area: i % 3 ? "Comercial" : "Engenharia", genero: i % 2 ? "F" : "M" }));
  const folha = Array.from({ length: 300 }, (_, i) => ({ matricula: i % 60, competencia: `2025-0${1 + (i % 4)}`, salario_base: 1000 + i, custo_total_ctc: 2000 + i }));
  const data = { funcionarios, folha };
  const specs = [
    { id: "a", title: "x", chart_type: "line", source: "folha", group_by: { kind: "category", field: "competencia" }, metric: { agg: "sum", field: "custo_total_ctc" }, filters: [] },   // nao precisa do cadastro
    { id: "b", title: "x", chart_type: "bar", source: "folha", group_by: { kind: "category", field: "area" }, metric: { agg: "avg", field: "salario_base" }, filters: [] },           // precisa
    { id: "c", title: "x", chart_type: "bar", source: "folha", group_by: { kind: "category", field: "competencia" }, metric: { agg: "count" }, filters: [{ field: "genero", op: "eq", value: "F" }] },
  ];
  const completo = (spec) => {
    // referencia: cruzamento completo (sem a lista de campos), como era antes da otimizacao
    const rows = applyFilters(joinWithFuncionarios(folha, "folha", data), spec.filters);
    const grupos = {};
    rows.forEach((r) => { const k = String(r[spec.group_by.field] ?? "Não informado"); (grupos[k] = grupos[k] || []).push(r); });
    return Object.keys(grupos).map((k) => computeAgg(grupos[k], spec.metric)).sort((p, q) => p - q);
  };
  for (const spec of specs) {
    const obtido = computeChartData(spec, data, null, SEM_FILTRO).map((e) => e.value).sort((p, q) => p - q);
    assert.deepEqual(obtido, completo(spec), spec.id);
  }
  // sem lista de campos, o cruzamento completo continua acrescentando os campos do cadastro
  assert.equal(joinWithFuncionarios(folha, "folha", data)[0].area, "Engenharia");
  // com a lista e todos os campos ja presentes, as proprias linhas sao devolvidas (nada e copiado)
  assert.equal(joinWithFuncionarios(folha, "folha", data, ["competencia", "salario_base"]), folha);
});
