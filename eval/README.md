# Avaliação de precisão da IA

Suíte de avaliação que mede, com bases de teste reais (rodando contra a API de verdade,
não simulada), o quão bem a IA:

1. Identifica se uma planilha contém dados de RH
2. Classifica o papel de cada aba (funcionários, desligamentos, folha, recrutamento...)
3. Mapeia colunas com nomes arbitrários para os campos internos do sistema
4. Propõe gráficos que sobrevivem à validação (não referenciam campos inexistentes)

## Como rodar

Precisa de uma chave de API de verdade (Gemini ou Anthropic) e do Node.js instalado.

```bash
cd painel-rh-dinamico
EVAL_API_KEY=sua_chave_aqui EVAL_PROVIDER=gemini node eval/run_evaluation.mjs
```

Ou com Anthropic:

```bash
EVAL_API_KEY=sua_chave_aqui EVAL_PROVIDER=anthropic EVAL_MODEL=claude-sonnet-5 node eval/run_evaluation.mjs
```

Isso faz chamadas reais à API (consome sua cota/crédito — são cerca de 18 chamadas no total: até
2 por base de teste × 10 bases) e gera dois arquivos:

- `eval/results_<timestamp>.md` — relatório legível com as métricas
- `eval/results_<timestamp>.json` — dados brutos (respostas completas da IA), para auditoria

## Arquivos

- `fixtures.mjs` — as 10 bases de teste (sintéticas, reais do projeto e uma adversarial) + gabarito (ground truth) de cada uma
- `run_evaluation.mjs` — o script que roda a avaliação (extrai a lógica direto do
  `src/App.jsx` e de `src/lib/` (`limpeza.js` e `motor.js`) reais do projeto, garantindo que a avaliação nunca fica desatualizada em
  relação ao sistema em produção)
- `METODOLOGIA.md` — capítulo pronto (metodologia + limitações), para colar no TCC. A
  seção de resultados fica em branco até você rodar o script e colar os números reais.

## Importante

Os números que este script produz são de verdade — nenhum resultado é inventado. A seção
de resultados do `METODOLOGIA.md` está deliberadamente em branco: você precisa rodar o
script com sua própria chave e preencher com o que a IA realmente retornar.
