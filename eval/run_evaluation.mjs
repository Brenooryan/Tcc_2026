#!/usr/bin/env node
// eval/run_evaluation.mjs
//
// Avalia a precisao da IA (deteccao de estrutura + planejamento do dashboard) contra um
// conjunto de bases de teste com gabarito (ground truth) escrito a mao. Faz chamadas REAIS
// a API de IA configurada — precisa de uma chave valida.
//
// USO:
//   EVAL_API_KEY=sua_chave EVAL_PROVIDER=gemini node eval/run_evaluation.mjs
//   EVAL_API_KEY=sua_chave EVAL_PROVIDER=anthropic EVAL_MODEL=claude-sonnet-5 node eval/run_evaluation.mjs
//
// Gera um relatorio em Markdown em eval/results_<timestamp>.md com metricas por base e
// agregadas, alem do JSON bruto de cada resposta da IA (para auditoria/reproducibilidade).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FIXTURES } from "./fixtures.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROVIDER = process.env.EVAL_PROVIDER || "gemini";
const API_KEY = process.env.EVAL_API_KEY;
const MODEL = process.env.EVAL_MODEL || (PROVIDER === "gemini" ? "gemini-3.6-flash" : "claude-sonnet-5");

if (!API_KEY) {
  console.error("Erro: defina EVAL_API_KEY com uma chave de API valida antes de rodar.");
  console.error("Exemplo: EVAL_API_KEY=sua_chave EVAL_PROVIDER=gemini node eval/run_evaluation.mjs");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Extrai o motor puro (sem React/JSX) direto do App.jsx real do projeto — assim a
// avaliacao sempre testa a logica ATUAL, nunca uma copia que pode ficar desatualizada.
// ---------------------------------------------------------------------------
const appSrcPath = path.join(__dirname, "..", "src", "App.jsx");
const appSrc = fs.readFileSync(appSrcPath, "utf8");
const startMarker = "const fmtBRL ="; // limpeza e motor de calculo ficam em src/lib/ (ver abaixo)
const endMarker = "function useApiKey"; // primeiro "hook"/componente React que segue os dados puros — corta antes dele
const startIdx = appSrc.indexOf(startMarker);
const endIdx = appSrc.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error("Nao foi possivel localizar os marcadores de extracao no App.jsx. O arquivo mudou de estrutura?");
  process.exit(1);
}
// A limpeza (toDate, cleanNum, cleanAndNormalize...) mora em src/lib/limpeza.js como modulo ES;
// aqui o `export` e removido para o codigo poder ser avaliado junto com o resto.
// Idem para o motor de calculo (src/lib/motor.js); as linhas "import" tambem saem.
const libSrc = (file) => fs.readFileSync(path.join(__dirname, "..", "src", "lib", file), "utf8")
  .replace(/^import .*$/gm, "")
  .replace(/^export /gm, "");
const coreCode = libSrc("limpeza.js") + "\n" + libSrc("motor.js") + "\n" + appSrc.slice(startIdx, endIdx);

// WRITING_STYLE_RULE fica definida ANTES do marcador de inicio (startMarker), entao nao
// entra em coreCode, mas e usada dentro dos prompts extraidos (ex: planDashboardWithAI).
// Extrai a linha direto do App.jsx real, em vez de copiar o texto a mao aqui -- assim,
// se a regra mudar de redacao no futuro, a avaliacao nunca fica dessincronizada de novo
// (foi exatamente isso que quebrou "validade graficos" antes desta correcao).
const wsrMatch = appSrc.match(/const WRITING_STYLE_RULE = ".*?";/s);
if (!wsrMatch) {
  console.error("Nao foi possivel localizar WRITING_STYLE_RULE no App.jsx. O arquivo mudou de estrutura?");
  process.exit(1);
}
eval(wsrMatch[0].replace("const WRITING_STYLE_RULE", "globalThis.WRITING_STYLE_RULE"));

// Ambiente minimo em Node para o codigo extraido rodar sem o navegador/React:
globalThis.MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
globalThis.XLSX = {
  utils: {
    sheet_to_json(ws, opts) {
      const allRows = ws.__rows || [];
      if (opts && opts.header === 1) {
        return [Object.keys(allRows[0] || {})];
      }
      return allRows;
    },
  },
};

globalThis.__evalExports = {};
eval(coreCode + `
Object.assign(globalThis.__evalExports, {
  detectSchemaWithAI, planDashboardWithAI, validatePlan, validateChart, buildDataProfile,
  cleanAndNormalize, buildFoundFromAIMapping, TABLE_LABELS, ROLE_CANONICAL_FIELDS,
});
`);
const {
  detectSchemaWithAI, planDashboardWithAI, validatePlan, buildDataProfile,
  cleanAndNormalize, buildFoundFromAIMapping,
} = globalThis.__evalExports;

// ---------------------------------------------------------------------------
// Helpers de avaliacao
// ---------------------------------------------------------------------------
function buildFakeWorkbook(fixture) {
  const wb = { SheetNames: [], Sheets: {} };
  fixture.sheets.forEach((s) => {
    wb.SheetNames.push(s.name);
    wb.Sheets[s.name] = { __rows: s.rows };
  });
  return wb;
}

/** Compara o column_map da IA com o gabarito. Retorna precisao/recall SOMENTE sobre os
 *  campos que o gabarito define para essa aba (campos extras que a IA mapear e o gabarito
 *  nao previu nao contam nem a favor nem contra — escolha metodologica conservadora,
 *  documentada no capitulo de metodologia). */
function scoreColumnMap(predicted, groundTruth, alternatives) {
  const gtFields = Object.keys(groundTruth);
  let correct = 0;
  let attempted = 0;
  gtFields.forEach((field) => {
    const expected = groundTruth[field];
    const accepted = [expected, ...((alternatives && alternatives[field]) || [])];
    const got = predicted[field];
    if (got !== undefined && got !== null) {
      attempted++;
      if (accepted.includes(got)) correct++;
    }
  });
  return {
    recall: gtFields.length ? correct / gtFields.length : null,
    precision: attempted ? correct / attempted : null,
    correct, attempted, total: gtFields.length,
  };
}

function findAiSheet(mapping, originalName) {
  return (mapping.sheets || []).find((s) => s.original_name === originalName);
}

// ---------------------------------------------------------------------------
// Execucao
// ---------------------------------------------------------------------------
async function evaluateFixture(fixture) {
  const result = {
    id: fixture.id, description: fixture.description,
    isHrDataExpected: fixture.groundTruth.isHrData, isHrDataPredicted: null, isHrDataCorrect: null,
    sheetResults: [], planResult: null, rawMapping: null, rawPlan: null, error: null,
  };

  const wb = buildFakeWorkbook(fixture);
  let mapping;
  try {
    mapping = await detectSchemaWithAI(wb, API_KEY, MODEL, PROVIDER);
  } catch (e) {
    result.error = `Falha na deteccao de schema: ${e.message}`;
    return result;
  }
  result.rawMapping = mapping;
  result.isHrDataPredicted = mapping.is_hr_data;
  result.isHrDataCorrect = mapping.is_hr_data === fixture.groundTruth.isHrData;

  if (!fixture.groundTruth.isHrData) {
    return result; // fixture negativa (nao-RH) — so avaliamos is_hr_data, nada mais
  }

  fixture.groundTruth.sheets.forEach((gtSheet) => {
    const aiSheet = findAiSheet(mapping, gtSheet.matchOriginalName);
    if (!aiSheet) {
      result.sheetResults.push({
        originalName: gtSheet.matchOriginalName, expectedRole: gtSheet.expectedRole,
        predictedRole: null, roleCorrect: false, columnScore: null,
        note: "IA nao retornou nenhuma entrada para esta aba",
      });
      return;
    }
    const roleCorrect = aiSheet.role === gtSheet.expectedRole;
    const columnScore = roleCorrect
      ? scoreColumnMap(aiSheet.column_map || {}, gtSheet.columnMap, gtSheet.columnMapAlternatives)
      : null;
    result.sheetResults.push({
      originalName: gtSheet.matchOriginalName, expectedRole: gtSheet.expectedRole,
      predictedRole: aiSheet.role, roleCorrect, columnScore,
    });
  });

  // Se a aba de funcionarios foi reconhecida, tenta seguir ate o planejamento do dashboard
  const temFuncionarios = result.sheetResults.some((s) => s.expectedRole === "funcionarios" && s.roleCorrect);
  if (temFuncionarios) {
    try {
      const log = [];
      const found = buildFoundFromAIMapping(wb, mapping, log);
      const processed = cleanAndNormalize(found, log);
      const profile = buildDataProfile(processed);
      const rawPlan = await planDashboardWithAI(profile, API_KEY, MODEL, PROVIDER, "");
      result.rawPlan = rawPlan;
      if (rawPlan.is_hr_data !== false) {
        const validated = validatePlan(rawPlan, profile);
        const totalProposed = (rawPlan.pages || []).reduce((a, p) => a + (p.charts || []).length, 0);
        const totalValidated = validated.pages.reduce((a, p) => a + p.charts.length, 0);
        result.planResult = {
          pagesProposed: (rawPlan.pages || []).length, pagesValidated: validated.pages.length,
          chartsProposed: totalProposed, chartsValidated: totalValidated,
          validityRate: totalProposed ? totalValidated / totalProposed : null,
        };
      }
    } catch (e) {
      result.planResult = { error: e.message };
    }
  }

  return result;
}

function aggregate(results) {
  const hrFixtures = results.filter((r) => r.isHrDataExpected);
  const negFixtures = results.filter((r) => !r.isHrDataExpected);

  const isHrAccuracy = results.filter((r) => r.isHrDataCorrect).length / results.length;

  const allSheets = hrFixtures.flatMap((r) => r.sheetResults);
  const roleAccuracy = allSheets.length ? allSheets.filter((s) => s.roleCorrect).length / allSheets.length : null;

  // So entram na media abas com pelo menos 1 campo canonico esperado no gabarito
  // (gtFields.length > 0, ou seja, columnScore.total > 0). Uma aba "unknown"/decoy
  // tem columnMap={} no gabarito, entao scoreColumnMap devolve recall/precision
  // null com total:0 — esse objeto ainda e truthy, e sem esse filtro extra o
  // "(null || 0)" contava a aba como um acerto zerado, puxando a media pra baixo
  // mesmo quando a IA classificou a aba corretamente como "unknown".
  const withColumnScore = allSheets.filter((s) => s.columnScore && s.columnScore.total > 0);
  const avgRecall = withColumnScore.length
    ? withColumnScore.reduce((a, s) => a + (s.columnScore.recall || 0), 0) / withColumnScore.length : null;
  const avgPrecision = withColumnScore.length
    ? withColumnScore.reduce((a, s) => a + (s.columnScore.precision || 0), 0) / withColumnScore.length : null;

  const withPlan = hrFixtures.filter((r) => r.planResult && r.planResult.validityRate !== undefined && r.planResult.validityRate !== null);
  const avgValidityRate = withPlan.length
    ? withPlan.reduce((a, r) => a + r.planResult.validityRate, 0) / withPlan.length : null;

  return {
    totalFixtures: results.length, hrFixturesCount: hrFixtures.length, negFixturesCount: negFixtures.length,
    isHrAccuracy, roleAccuracy, avgRecall, avgPrecision, avgValidityRate,
    totalSheetsEvaluated: allSheets.length, totalPlansEvaluated: withPlan.length,
  };
}

function pct(v) { return v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`; }

function buildMarkdownReport(results, agg) {
  const now = new Date().toISOString();
  let md = `# Relatorio de avaliacao — deteccao de schema e planejamento de dashboard por IA\n\n`;
  md += `- **Data:** ${now}\n`;
  md += `- **Provedor:** ${PROVIDER}\n`;
  md += `- **Modelo:** ${MODEL}\n`;
  md += `- **Bases de teste:** ${agg.totalFixtures} (${agg.hrFixturesCount} de RH, ${agg.negFixturesCount} negativa(s)/nao-RH)\n\n`;

  md += `## Resumo agregado\n\n`;
  md += `| Metrica | Valor | O que mede |\n|---|---|---|\n`;
  md += `| Acuracia de is_hr_data | ${pct(agg.isHrAccuracy)} | Acertar se a base e/nao e dado de RH |\n`;
  md += `| Acuracia de classificacao de papel | ${pct(agg.roleAccuracy)} | Acertar o papel de cada aba (funcionarios/desligamentos/folha/etc), sobre ${agg.totalSheetsEvaluated} abas avaliadas |\n`;
  md += `| Recall medio do mapeamento de colunas | ${pct(agg.avgRecall)} | Dos campos que o gabarito esperava, quantos a IA encontrou |\n`;
  md += `| Precisao media do mapeamento de colunas | ${pct(agg.avgPrecision)} | Dos campos que a IA tentou mapear (dentre os do gabarito), quantos estavam corretos |\n`;
  md += `| Taxa de validade dos graficos propostos | ${pct(agg.avgValidityRate)} | Dos graficos que a IA propos no plano do dashboard, quantos passaram na validacao determinística (nao foram descartados por referenciar campo/tabela inexistente), sobre ${agg.totalPlansEvaluated} planos avaliados |\n\n`;

  md += `## Resultado por base de teste\n\n`;
  results.forEach((r) => {
    md += `### \`${r.id}\` — ${r.description}\n\n`;
    if (r.error) { md += `**Erro:** ${r.error}\n\n`; return; }
    md += `- \`is_hr_data\` esperado: **${r.isHrDataExpected}** · previsto: **${r.isHrDataPredicted}** · ${r.isHrDataCorrect ? "correto" : "INCORRETO"}\n`;
    if (r.sheetResults.length) {
      md += `\n| Aba | Papel esperado | Papel previsto | Recall colunas | Precisao colunas |\n|---|---|---|---|---|\n`;
      r.sheetResults.forEach((s) => {
        md += `| ${s.originalName} | ${s.expectedRole} | ${s.predictedRole || "—"} ${s.roleCorrect ? "OK" : "ERRO"} | ${s.columnScore ? pct(s.columnScore.recall) : "—"} | ${s.columnScore ? pct(s.columnScore.precision) : "—"} |\n`;
      });
    }
    if (r.planResult) {
      if (r.planResult.error) {
        md += `\n- Planejamento do dashboard: erro — ${r.planResult.error}\n`;
      } else {
        md += `\n- Planejamento do dashboard: ${r.planResult.pagesValidated}/${r.planResult.pagesProposed} paginas validas, ${r.planResult.chartsValidated}/${r.planResult.chartsProposed} graficos validos (taxa de validade: ${pct(r.planResult.validityRate)})\n`;
      }
    }
    md += `\n`;
  });

  md += `## Metodologia (resumo)\n\n`;
  md += `Cada base de teste tem uma estrutura de colunas escrita a mao, diferente do template original do projeto, para avaliar generalizacao (nao decoreba). O gabarito de cada base define: (1) se a base deveria ser reconhecida como dado de RH; (2) o papel esperado de cada aba; (3) o mapeamento esperado de colunas originais para os campos canonicos do sistema. A precisao/recall do mapeamento de colunas e calculada apenas sobre os campos que o gabarito define para aquela aba — campos adicionais que a IA eventualmente mapeie sem estarem no gabarito nao são somados nem descontados, por nao termos verificacao manual da correcao deles. A taxa de validade dos graficos usa o mesmo validador (\`validateChart\`) que roda em producao, entao mede exatamente a fracao de sugestoes da IA que sobreviveriam no dashboard real do usuario.\n`;

  return md;
}

async function main() {
  console.log(`Rodando avaliacao com provider=${PROVIDER} model=${MODEL} (${FIXTURES.length} bases de teste)...\n`);
  const results = [];
  for (const fixture of FIXTURES) {
    process.stdout.write(`  - ${fixture.id}... `);
    const r = await evaluateFixture(fixture);
    results.push(r);
    console.log(r.error ? `ERRO (${r.error})` : "ok");
  }

  const agg = aggregate(results);
  const md = buildMarkdownReport(results, agg);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const mdPath = path.join(__dirname, `results_${stamp}.md`);
  const jsonPath = path.join(__dirname, `results_${stamp}.json`);
  fs.writeFileSync(mdPath, md, "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify({ provider: PROVIDER, model: MODEL, results, aggregate: agg }, null, 2), "utf8");

  console.log(`\nRelatorio salvo em:\n  ${mdPath}\n  ${jsonPath}\n`);
  console.log("Resumo agregado:");
  console.log(`  is_hr_data:        ${pct(agg.isHrAccuracy)}`);
  console.log(`  papel da aba:      ${pct(agg.roleAccuracy)}`);
  console.log(`  recall colunas:    ${pct(agg.avgRecall)}`);
  console.log(`  precisao colunas:  ${pct(agg.avgPrecision)}`);
  console.log(`  validade graficos: ${pct(agg.avgValidityRate)}`);
}

main().catch((e) => {
  console.error("Falha na avaliacao:", e);
  process.exit(1);
});
