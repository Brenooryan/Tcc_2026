<div align="center">

# Painel de Pessoas

**Suba uma planilha de RH e receba um dashboard sob medida para os seus dados.**

A IA decide o que mostrar. O código calcula todos os números.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-2-22b5bf)
![IA](https://img.shields.io/badge/IA-Gemini%20%7C%20Claude-8A5CF6)
![Status](https://img.shields.io/badge/status-TCC%20em%20desenvolvimento-orange)

</div>

<!-- Dica: adicione uma captura de tela do painel em docs/screenshot.png e descomente a linha abaixo.
![Painel de Pessoas](docs/screenshot.png)
-->

## Sobre o projeto

Dashboards de People Analytics costumam ser feitos sob encomenda: alguém monta cada página e cada gráfico para uma base específica, e tudo precisa ser refeito quando os dados mudam. O **Painel de Pessoas** inverte isso. Você envia a planilha que tem em mãos, de uma única área (só recrutamento, só desligamentos) ou de várias juntas, e o sistema entende a estrutura, limpa os dados, propõe um dashboard e calcula tudo a partir do que existe nela.

Ele nasceu como um Trabalho de Conclusão de Curso de Engenharia da Computação (UNISAL), com a meta de virar uma ferramenta que qualquer profissional de RH consiga usar com a sua própria base, qualquer que seja a área que ela cobre.

### O princípio central

> **A IA decide, o código sempre calcula.**

Modelos de linguagem são bons em interpretar e planejar, e ruins em aritmética confiável. Por isso o projeto separa as duas coisas. A IA é usada em cinco pontos, e depois de cada um há sempre uma trava feita pelo código:

| Onde a IA entra | A IA decide | O código garante |
|---|---|---|
| Detecção de estrutura | Qual é o papel de cada aba (funcionários, folha, desligamentos...) e a que campo cada coluna corresponde | Você revisa o mapeamento antes de continuar, e só campos conhecidos são aceitos |
| Planejamento do dashboard | Quais páginas, gráficos, indicadores e filtros fazem sentido para a base | Cada item é validado contra a base real, e o que citar campo ou tabela inexistente é descartado sem quebrar a tela |
| Padronização por significado | Quais valores escritos de forma diferente são a mesma coisa (`SP` e `São Paulo`) | Só une valores do mesmo campo, e níveis diferentes (`Analista I` e `II`) nunca são unidos |
| Chat com a base | Qual consulta fazer, quando a pergunta pede um cruzamento específico | A consulta é validada e **executada pelo motor**, e a IA só redige a resposta com o resultado |
| Análise de gráficos e risco de saída | Como explicar em texto os números | Todos os números vêm do código (totais, médias, taxas, projeções) |

As chamadas de estrutura, planejamento e padronização tentam de novo sozinhas em caso de falha de rede ou resposta malformada, com limite de tokens crescente.

A IA nunca escreve o valor de um gráfico. Ela devolve uma *especificação* ("contagem de funcionários ativos por área"), e um motor determinístico em JavaScript a executa sobre os dados reais. O resultado é reproduzível: a mesma base e a mesma especificação sempre dão o mesmo número.

## Como funciona

```mermaid
flowchart LR
    A["Upload da planilha"] --> B["IA identifica o papel de cada aba"]
    B --> C["Revisão do mapeamento"]
    C --> D["Limpeza e padronização"]
    D --> E["IA planeja páginas e gráficos"]
    E --> F["Validação do plano"]
    F --> G["Cálculo determinístico"]
    G --> H["Dashboard"]
```

1. **Upload:** um ou vários arquivos (`.xlsx`, `.xls`, `.csv`) de uma vez.
2. **Detecção de estrutura:** a IA reconhece o papel de cada aba (funcionários, desligamentos, folha, recrutamento e seleção, entrevistas, movimentações) e mapeia as colunas para os campos internos, mesmo com nomes diferentes dos esperados. Colunas fora do padrão viram métricas extras.
3. **Revisão:** você confere o que foi entendido antes de continuar.
4. **Limpeza e padronização:** formatos, vazios disfarçados, duplicados e valores escritos de formas diferentes são tratados pelo código (veja [Tratamento de dados](#tratamento-de-dados)).
5. **Planejamento:** a IA recebe apenas o *perfil* dos dados já limpos (campos, tipos, cardinalidade, intervalos) e devolve o plano de páginas, gráficos, indicadores e filtros.
6. **Validação e cálculo:** cada item do plano é validado contra a base real, e só então os números são calculados pelo motor.

## Arquitetura

O código é dividido em camadas com responsabilidades separadas. As duas camadas de dados são funções puras, sem React e sem chamadas de rede, o que permite testá-las isoladamente.

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Interface e orquestração | `src/App.jsx` | Telas, chamadas à IA (estrutura, planejamento, padronização, chat, análises), previsões e simulador |
| Limpeza e padronização | `src/lib/limpeza.js` | Formatos de número, data e mês, vazios disfarçados, duplicados, unificação de valores, intervalos de datas, relatório de qualidade |
| Motor de cálculo | `src/lib/motor.js` | Perfil da base, validação do plano da IA, agregações, filtros, cruzamento entre tabelas, privacidade de salários |
| Avaliação | `eval/` | Suíte que mede a precisão da IA com chamadas reais à API |

## O motor de cálculo

O motor recebe uma especificação em JSON, como esta que a IA propõe:

```json
{
  "id": "g2",
  "title": "Funcionários por área",
  "chart_type": "bar_horizontal",
  "source": "funcionarios",
  "filters": [{ "field": "status", "op": "eq", "value": "Ativo" }],
  "group_by": { "kind": "category", "field": "area" },
  "metric": { "agg": "count" }
}
```

e produz os dados do gráfico a partir da base limpa. O que ele sabe fazer:

- **Agregações:** contagem, soma, média, mediana, mínimo e máximo, por categoria ou por mês.
- **Gráficos:** barras (vertical e horizontal), linha, área, pizza e radar.
- **Filtros:** igual, diferente, maior, menor e preenchido, mais filtro de período (ano e mês) e até 6 filtros de categoria globais, escolhidos pela IA entre os campos de qualquer tabela.
- **Cruzamento entre tabelas:** campos do cadastro (área, gênero, senioridade) podem ser usados em desligamentos, folha, movimentações e entrevistas, cruzando automaticamente por matrícula.
- **Durações:** qualquer par início/fim de datas vira duração em dias e faixas ("até 30 dias", "31 a 60 dias"), com fim antes do início sinalizado.
- **Validação:** campo ou tabela que não existe na base derruba o item, não a tela. O tipo do campo vem do perfil real, nunca do que a IA declarou.
- **Privacidade de salários:** métricas de salário e custo não são exibidas para grupos com menos de 5 pessoas, e nenhum gráfico agrupa ou filtra por nome, matrícula ou CPF.

## Tratamento de dados

A etapa de limpeza roda inteira no navegador e cobre os problemas mais comuns de planilhas reais:

- **Vazios disfarçados** (`N/A`, `-`, `#N/D`) viram vazio de verdade, e linhas totalmente em branco são removidas.
- **Números e datas em vários formatos** são entendidos: `R$ 1.234,56`, `12,5%`, `05/01/2024`, `2024-01-05`. Meses escritos de formas diferentes (`11/2025`, `2025/11`, `nov/25`) viram `AAAA-MM`.
- **Duplicados** (mesma matrícula repetida) são combinados.
- **Valores equivalentes** viram um só: primeiro por grafia (`sao paulo`, `SÃO PAULO`), depois, com a IA, por significado (`SP` e `São Paulo`).
- **Intervalos de datas** viram duração em dias e faixas.

A página **Qualidade dos dados** mostra, em números, o que a limpeza fez: linhas lidas, aproveitadas e descartadas, duplicados combinados, valores padronizados (com o antes e o depois), campos com muitos vazios e os intervalos de datas encontrados.

## Previsões e cenários

- **Previsões:** projeção dos próximos 6 meses por regressão linear simples sobre os últimos 9 meses de histórico (headcount, desligamentos e custo de folha).
- **Simulador de cenários:** ajusta turnover, contratações por mês e reajuste salarial e compara com o cenário base.
- **Risco de saída:** estimativa por heurística estatística, combinando as taxas históricas de desligamento de cada categoria, com suavização para amostras pequenas. Não é um modelo de machine learning treinado, e serve para padrões agregados, não para julgar pessoas.

Só aparece o que a base sustenta: sem CTC, o custo de folha usa o salário base (ou some, se a base não tem salários); sem desligamentos, não há previsão de saída nem risco.

## Funcionalidades

- **Dashboard sob medida:** páginas, gráficos e indicadores escolhidos para a sua base, em qualquer recorte de RH.
- **Edição depois de pronto:** remova gráficos e páginas, ou peça um gráfico novo em texto livre ("salário médio por senioridade").
- **Chat com a base:** pergunte em linguagem natural, inclusive cruzamentos específicos e listagem de vagas; os números vêm de cálculo sobre os dados reais.
- **Análise por IA de cada gráfico**, com os números já calculados.
- **Relatório de qualidade dos dados** em uma página própria.
- **Exportação:** visualização única de todas as páginas, pronta para imprimir ou salvar em PDF.
- **Personalização visual:** 5 paletas de cor e modo claro ou escuro.
- **Projetos salvos:** o dashboard gerado fica no navegador para reabrir depois, sem subir o arquivo de novo.

## Tecnologias

| Parte | Tecnologia |
|---|---|
| Interface | React 18, Vite 5, Recharts, Lucide |
| Leitura de planilhas | SheetJS (`.xlsx`, `.xls`, `.csv`) |
| Motor de cálculo e limpeza | JavaScript puro (funções puras, sem dependências) |
| IA | APIs do Google Gemini e da Anthropic (Claude), chamadas direto do navegador |
| Armazenamento | `localStorage` (preferências e chave) e IndexedDB (projetos salvos) |
| Testes | Test runner nativo do Node (`node --test`) |

## Desempenho

Tudo roda no navegador, então o projeto cuida de não refazer trabalho à toa:

- **Cálculo sob demanda:** os gráficos de cada página são calculados só quando a página é aberta (e recalculados só quando filtro ou período mudam). O resumo da base inteira, usado pelo chat e pela análise geral, só é montado quando alguém o pede.
- **Cruzamento enxuto:** o cruzamento com o cadastro de funcionários copia apenas os campos que o gráfico usa, e é pulado quando não é necessário.
- **Carregamento inicial menor:** a biblioteca de planilhas (cerca de 430 KB) só é baixada quando você envia um arquivo. O carregamento inicial caiu de cerca de 289 KB para 176 KB comprimidos.
- **Sem limite artificial de tamanho:** mínimo, máximo e perfil da base usam laços simples, e não estouram com centenas de milhares de linhas.

Medidas feitas durante os testes, com uma base de folha de pagamento replicada para simular tamanhos maiores (os tempos variam de máquina para máquina):

| Linhas no total | Limpeza e padronização | Gráfico por mês (folha) | Gráfico por área (precisa do cadastro) |
|---|---|---|---|
| 6,8 mil (base de demonstração) | 52 ms | 1 ms | 6 ms |
| 68 mil (10x) | 346 ms | 4 ms | 19 ms |
| 342 mil (50x) | 1,6 s | 39 ms | 126 ms |

## Começando

### Pré-requisitos

- [Node.js](https://nodejs.org) 18 ou mais recente
- Uma chave de API de um destes provedores:
  - **Google Gemini** (gratuito): [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
  - **Anthropic Claude** (pago por uso): [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

### Instalação

```bash
git clone https://github.com/joaovitorfap/painel-de-pessoas.git
cd painel-de-pessoas
npm install
npm run dev
```

Abra `http://localhost:5173`.

### Primeiro uso

1. Clique em **Configurar IA**, escolha o provedor e salve a chave.
2. Envie um ou mais arquivos (`.xlsx`, `.xls` ou `.csv`).
3. Confira o mapeamento detectado e confirme.
4. Escolha paleta e, se quiser, escreva o que espera ver (ex: "uma página só sobre recrutamento").
5. Aguarde o painel ser projetado e navegue pelas páginas.

## Privacidade e segurança

A base inteira nunca é enviada à IA. O que sai do navegador, por etapa:

| Etapa | O que vai para o provedor de IA |
|---|---|
| Detecção de estrutura | Cabeçalhos e **4 linhas de amostra por aba**. São linhas reais: CPFs são mascarados, mas outros dados da amostra (como nomes) seguem como estão |
| Padronização por significado | Só a lista de valores distintos de campos de categoria, com a contagem de cada um. Nunca linhas, nome, CPF ou matrícula |
| Planejamento do dashboard | O *perfil* da base: campos, tipos, faixas de valores e alguns exemplos de campos de categoria com poucos valores. Nome, CPF, matrícula e responsável pela vaga nunca levam exemplos |
| Chat e análises | Um resumo agregado e o resultado das consultas (totais por grupo). A listagem de vagas inclui cargo, área e recrutador responsável. O chat nunca revela nome nem salário de uma pessoa específica |

Cuidados adicionais:

- A chamada à IA sai **direto do navegador**, sem servidor intermediário. A chave fica salva só no `localStorage` do seu navegador e nunca é escrita no código.
- Como a chave é usada no navegador, ela aparece na aba Network do DevTools. Use o projeto localmente e **não o publique na internet com a sua chave configurada**.

## Testes automatizados

```bash
npm test
```

Cobrem duas camadas: a limpeza e padronização (formatos de número, data e mês, textos de vazio, linhas em branco, unificação de valores, intervalos de datas, mascaramento de CPF e as travas que impedem a IA de unir níveis diferentes) e o motor de cálculo (agregações, filtros, filtro de período, cruzamento por matrícula, privacidade de salários e do perfil enviado à IA, validação do que a IA propõe e filtros globais). Usam o test runner nativo do Node, sem dependências extras, e simulam a IA, então não consomem cota de API.

## Avaliação de precisão da IA

A pasta [`eval/`](eval) contém uma suíte de avaliação com chamadas reais à API (não simuladas). Ela mede a precisão da IA na detecção de estrutura e no planejamento do dashboard contra 10 bases de teste com gabarito escrito à mão (7 sintéticas, 2 derivadas de bases de teste do próprio projeto e 1 propositalmente difícil).

```bash
EVAL_API_KEY=sua_chave EVAL_PROVIDER=gemini node eval/run_evaluation.mjs
```

Última execução (30/09/2026, modelo `claude-sonnet-5`): 100% de acerto em reconhecer se a base é de RH, 100% na classificação do papel de cada aba (19 abas), cerca de 94,7% de recall e precisão no mapeamento de colunas e 100% dos gráficos propostos válidos (8 planos). O relatório completo está em `eval/results_*.md`.

Veja [`eval/README.md`](eval/README.md) e [`eval/METODOLOGIA.md`](eval/METODOLOGIA.md) para detalhes.

## Estrutura do repositório

```
├── src/
│   ├── lib/
│   │   ├── limpeza.js   # limpeza, padronização e intervalos de datas (funções puras, testadas)
│   │   └── motor.js     # perfil da base, validação do plano da IA e cálculo dos números (testado)
│   ├── App.jsx          # aplicação (planejamento com IA e interface)
│   └── main.jsx
├── test/                # testes automatizados da limpeza e do motor de cálculo
├── eval/                # suíte de avaliação da IA e metodologia
├── Documentos/          # documentação do TCC
├── index.html
├── vite.config.js
└── package.json
```

## Próximos passos

- Escrever a documentação do TCC
- Apresentar o TCC em dezembro

Ideias técnicas para depois, fora do escopo do TCC:

- Revisar a exportação e os limites de consulta do chat para garantir que só usam o que a base realmente tem
- Filtro numérico (faixa de valores) na barra de filtros, para qualquer campo numérico
- Faixas automáticas para qualquer campo numérico (salário, idade, tempo de casa), como já existe para as durações
- Avaliar com chamadas reais à API a padronização por significado, no mesmo formato da avaliação de estrutura e planejamento (`eval/`)
