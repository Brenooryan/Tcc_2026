# Avaliação da precisão da IA na detecção de estrutura e no planejamento do dashboard

> Este documento foi escrito para ser adaptado diretamente como um capítulo de metodologia
> e resultados do TCC. Os números de exemplo devem ser substituídos pelos que você obtiver
> ao rodar `eval/run_evaluation.mjs` com sua própria chave de API — nenhum resultado neste
> documento foi inventado; a seção de resultados fica em branco de propósito até você rodar.

## 1. Motivação

O painel proposto neste trabalho depende de dois momentos em que um modelo de linguagem
toma decisões estruturais sobre os dados do usuário, sem supervisão humana no momento da
execução:

1. **Detecção de estrutura** — dado o cabeçalho e uma amostra de linhas de cada aba de uma
   planilha, o modelo decide (a) se a planilha contém dados de RH, (b) qual papel semântico
   cada aba desempenha (cadastro de funcionários, desligamentos, folha de pagamento,
   recrutamento, entrevistas, movimentações) e (c) como as colunas originais da planilha
   correspondem aos campos internos do sistema.
2. **Planejamento do dashboard** — dado um perfil estatístico da base já normalizada
   (quais tabelas existem, tipos de campo, cardinalidade, intervalos de valores), o modelo
   decide quais páginas e gráficos fazem sentido para aquela base específica, especificando
   cada gráfico de forma declarativa (fonte de dados, filtros, agrupamento, métrica).

Como essas decisões condicionam diretamente o que o usuário final vê, é necessário medir
sua confiabilidade de forma sistemática e reprodutível, e não apenas por inspeção visual
pontual — daí a construção desta suíte de avaliação.

## 2. Perguntas de pesquisa

- **RQ1:** Com que frequência o modelo classifica corretamente se uma planilha arbitrária
  contém dados de RH?
- **RQ2:** Dado que uma planilha contém dados de RH, com que frequência o modelo classifica
  corretamente o papel semântico de cada aba?
- **RQ3:** Dado que o papel de uma aba foi classificado corretamente, com que completude
  (recall) e correção (precisão) o modelo mapeia as colunas originais para os campos
  canônicos internos?
- **RQ4:** Das especificações de gráfico que o modelo propõe no planejamento do dashboard,
  que fração é estruturalmente válida (não referencia campos ou tabelas inexistentes)?

## 3. Corpus de teste

Foram construídas manualmente 10 bases de teste (`eval/fixtures.mjs`): 7 sintéticas, 2 derivadas de bases de teste do próprio projeto e 1 propositalmente difícil. Cada uma
com uma estrutura de colunas **deliberadamente diferente** do template de referência do
projeto, para avaliar generalização e não apenas reconhecimento de um formato memorizado.
Cada base tem um gabarito (*ground truth*) anotado à mão.

| Base | O que testa |
|---|---|
| `varejo_padrao` | Caso comum: 1 aba, nomes de coluna descritivos em português |
| `consultoria_abreviada` | 2 abas (cadastro + desligamentos), nomes de coluna abreviados |
| `startup_combinada` | Coluna "cargo + nome" combinada em um único campo; idade informada diretamente em vez de data de nascimento |
| `industria_minima` | Base mínima viável: apenas 4 colunas |
| `somente_folha` | Base contendo apenas folha de pagamento, sem cadastro de funcionários (fronteira do sistema) |
| `nao_rh_vendas` | Planilha de controle de vendas — **não** deveria ser reconhecida como dado de RH (teste negativo) |
| `dividido_por_ano` | Duas abas com estrutura idêntica representando anos diferentes (2019/2020) — deveriam receber o mesmo papel e ser combinadas |
| `nexatech_real` | Base de teste do próprio projeto, com 6 abas (funcionários, movimentações, recrutamento, desligamentos, entrevistas e folha) e colunas já no padrão interno |
| `trilha_real` | Base de teste do próprio projeto, com 3 abas (funcionários, recrutamento e pesquisa de saída) e nomenclatura de coluna bem diferente do padrão |
| `adversarial_dificil` | Cabeçalhos ambíguos, coluna de ID que não é matrícula, cargo e área combinados, datas em formatos mistos, salário com moeda, coluna numérica parecida com salário e uma aba que não é de RH disfarçada |

Isso cobre: o caso comum, variações de nomenclatura, dados malformados/combinados,
bases minimalistas, uma fronteira de escopo do sistema, um caso negativo de controle, e o
cenário de múltiplas abas equivalentes.

## 4. Métricas e definições operacionais

Todas as métricas são calculadas por `eval/run_evaluation.mjs`, reaproveitando **as mesmas
funções do sistema em produção** (extraídas diretamente de `src/App.jsx` e de `src/lib/` em tempo de
execução, nunca uma cópia separada), para garantir que a avaliação nunca fica dessincronizada
do comportamento real do painel.

- **Acurácia de `is_hr_data`** — proporção de bases em que a classificação binária
  (é/não é dado de RH) do modelo bateu com o gabarito. Calculada sobre as 10 bases.
- **Acurácia de classificação de papel** — proporção de abas (dentre as bases de RH) em
  que o papel semântico previsto pelo modelo bateu exatamente com o gabarito.
- **Recall do mapeamento de colunas** — para cada aba com papel classificado corretamente,
  a fração dos campos canônicos que o gabarito esperava e que o modelo de fato mapeou
  corretamente (para a coluna certa, ou uma alternativa aceita como equivalente — ver
  nota abaixo). Métrica agregada como média simples entre as abas avaliadas.
- **Precisão do mapeamento de colunas** — dentre os campos canônicos que o modelo *tentou*
  mapear (e que estavam no gabarito), a fração que estava correta.
- **Taxa de validade dos gráficos propostos** — dentre os gráficos que o modelo propôs no
  plano do dashboard, a fração que passou no validador determinístico do sistema
  (`validateChart`), ou seja, que efetivamente apareceria no dashboard do usuário sem ser
  descartada por referenciar um campo ou tabela inexistente.

**Nota metodológica sobre o cálculo de precisão/recall:** um campo canônico que o modelo
mapeia mas que **não consta no gabarito** daquela aba não é somado nem descontado de
nenhuma métrica — o gabarito foi escrito à mão e não cobre exaustivamente todo mapeamento
plausível; penalizar mapeamentos adicionais não verificados manualmente introduziria viés
contra o modelo. Isso é uma limitação conhecida do desenho experimental (discutida na
seção 6).

**Nota sobre equivalências aceitas:** alguns campos têm mais de uma coluna de origem
razoável (por exemplo, "Loja" pode ser legitimamente mapeado tanto para `area` quanto para
`filial`, dependendo da interpretação). Esses casos estão marcados explicitamente em
`columnMapAlternatives` em cada fixture, e qualquer uma das alternativas conta como
acerto — isso evita penalizar o modelo por uma ambiguidade genuína da própria base de
teste, não por um erro do modelo.

## 5. Procedimento

1. Cada base de teste é convertida em um objeto que simula a estrutura de uma planilha
   real (`workbook.Sheets[nome] = { linhas... }`), sem depender de arquivos `.xlsx` no
   disco.
2. Para cada base: chama-se `detectSchemaWithAI` com a chave de API real do avaliador.
3. A resposta é comparada campo a campo com o gabarito (RQ1, RQ2, RQ3).
4. Se a aba de cadastro de funcionários foi corretamente identificada, o pipeline segue:
   normalização dos dados (`cleanAndNormalize`), construção do perfil estatístico
   (`buildDataProfile`) e chamada a `planDashboardWithAI`, cuja resposta é validada por
   `validatePlan`/`validateChart` (RQ4).
5. Todas as respostas brutas da IA são salvas em `eval/results_<timestamp>.json` para
   auditoria e possível reanálise manual.
6. Um relatório em Markdown (`eval/results_<timestamp>.md`) é gerado automaticamente com
   as métricas agregadas e o detalhamento por base.

### Como reproduzir

```bash
cd painel-rh-dinamico
EVAL_API_KEY=sua_chave_aqui EVAL_PROVIDER=gemini node eval/run_evaluation.mjs
```

Trocando `EVAL_PROVIDER=anthropic` e fornecendo `EVAL_MODEL` é possível repetir o mesmo
experimento com outro provedor/modelo, permitindo comparação entre modelos como extensão
do trabalho.

## 6. Limitações do desenho experimental

- **Corpus pequeno (n=7).** Suficiente para uma avaliação qualitativa/exploratória e para
  detectar falhas grosseiras, mas não para afirmar generalização estatística robusta.
  Expandir o corpus (idealmente com bases de RH reais anonimizadas, se disponíveis) é a
  extensão mais natural deste trabalho.
- **Gabarito escrito por um único avaliador**, sem dupla checagem por um segundo anotador
  — não há medida de concordância entre avaliadores (inter-rater agreement).
- **Não penaliza mapeamentos extras não previstos no gabarito** (ver seção 4), o que pode
  inflar levemente as métricas de precisão em relação a uma avaliação exaustiva.
- **Determinismo do modelo:** LLMs comerciais não são perfeitamente determinísticos entre
  execuções; os números obtidos em uma única rodada são uma amostra, não um valor exato do
  modelo. Rodar o script múltiplas vezes e reportar média/desvio padrão é uma extensão
  recomendada caso o rigor exigido pelo trabalho seja maior.
- **A avaliação mede o pipeline até a validação do plano**, não a qualidade subjetiva dos
  títulos/organização das páginas escolhidas pela IA — isso exigiria avaliação qualitativa
  adicional (por exemplo, um pequeno estudo de usabilidade com usuários reais).

## 7. Resultados

*(Esta seção fica em branco de propósito. Rode `eval/run_evaluation.mjs` com sua chave de
API e cole aqui o conteúdo do arquivo `results_<timestamp>.md` gerado, junto com sua
análise/discussão dos números obtidos.)*
