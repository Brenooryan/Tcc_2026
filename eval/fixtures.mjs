// eval/fixtures.mjs
// Bases de teste sinteticas, com estruturas de coluna DIFERENTES do template original do
// projeto de proposito — o objetivo e avaliar se a IA generaliza para planilhas nunca
// vistas, nao se decorou um formato especifico. Cada fixture tem um gabarito (ground truth)
// escrito a mao, usado para comparar com o que a IA realmente detectou.

function rows(cols, data) {
  return data.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}

export const FIXTURES = [
  // ---------------------------------------------------------------------
  // 1) Rede de varejo — nomes de coluna comuns, 1 unica aba
  // ---------------------------------------------------------------------
  {
    id: "varejo_padrao",
    description: "Rede de varejo, 1 aba de funcionarios com nomes de coluna comuns",
    sheets: [
      {
        name: "Colaboradores",
        rows: rows(
          ["ID_Colab", "Nome_Completo", "Loja", "Funcao", "Dt_Admissao", "Dt_Desligamento", "Status_Atual", "Sal_Mensal", "Sexo"],
          [
            [1, "Ana Paula Ferreira", "Loja Centro", "Vendedora", "2021-03-01", null, "Ativo", 2200, "F"],
            [2, "Bruno Costa Lima", "Loja Centro", "Gerente de Loja", "2019-06-15", null, "Ativo", 5200, "M"],
            [3, "Carla Mendes Souza", "Loja Norte", "Vendedora", "2022-01-10", "2023-08-20", "Desligado", 2100, "F"],
            [4, "Daniel Alves Rocha", "Loja Norte", "Caixa", "2020-09-05", null, "Ativo", 1900, "M"],
            [5, "Elaine Ribeiro Dias", "Loja Sul", "Vendedora", "2021-11-20", null, "Ativo", 2150, "F"],
            [6, "Fabio Nunes Cardoso", "Loja Sul", "Estoquista", "2023-02-14", null, "Ativo", 1800, "M"],
            [7, "Gabriela Torres Melo", "Loja Centro", "Caixa", "2022-07-01", "2024-01-15", "Desligado", 1950, "F"],
            [8, "Henrique Barros Silva", "Loja Norte", "Gerente de Loja", "2018-04-22", null, "Ativo", 5400, "M"],
            [9, "Isabela Campos Reis", "Loja Sul", "Vendedora", "2023-05-10", null, "Ativo", 2180, "F"],
            [10, "Joao Vitor Pereira", "Loja Centro", "Estoquista", "2021-08-18", null, "Ativo", 1850, "M"],
            [11, "Karina Souza Farias", "Loja Norte", "Vendedora", "2020-02-01", "2022-12-01", "Desligado", 2050, "F"],
            [12, "Leonardo Dias Martins", "Loja Sul", "Caixa", "2022-10-05", null, "Ativo", 1920, "M"],
          ]
        ),
      },
    ],
    groundTruth: {
      isHrData: true,
      sheets: [
        {
          matchOriginalName: "Colaboradores",
          expectedRole: "funcionarios",
          columnMap: {
            matricula: "ID_Colab", nome: "Nome_Completo", cargo: "Funcao",
            data_admissao: "Dt_Admissao", data_desligamento: "Dt_Desligamento",
            status: "Status_Atual", salario_atual: "Sal_Mensal", genero: "Sexo",
          },
          columnMapAlternatives: { area: ["Loja"], filial: ["Loja"] }, // "Loja" pode ser mapeada como area OU filial — ambas aceitaveis
        },
      ],
    },
  },

  // ---------------------------------------------------------------------
  // 2) Consultoria de RH — 2 abas (funcionarios + desligamentos), nomes abreviados
  // ---------------------------------------------------------------------
  {
    id: "consultoria_abreviada",
    description: "2 abas (cadastro + desligamentos), nomes de coluna abreviados",
    sheets: [
      {
        name: "Cadastro",
        rows: rows(
          ["Cod", "NomeCompleto", "Depto", "Cargo", "DtAdm", "DtDeslig", "Sit", "SalAtual", "Genero"],
          [
            ["C001", "Marcelo Andrade Vieira", "Consultoria", "Consultor Senior", "2019-02-01", null, "Ativo", 9800, "M"],
            ["C002", "Patricia Gomes Ramos", "Consultoria", "Consultora Pleno", "2020-05-10", null, "Ativo", 6500, "F"],
            ["C003", "Rodrigo Nascimento Silva", "Administrativo", "Analista Financeiro", "2021-07-15", "2023-11-01", "Desligado", 4800, "M"],
            ["C004", "Simone Cardoso Teixeira", "Consultoria", "Consultora Junior", "2022-03-20", null, "Ativo", 4200, "F"],
            ["C005", "Thiago Moraes Batista", "Comercial", "Executivo de Contas", "2018-09-12", null, "Ativo", 7200, "M"],
            ["C006", "Vanessa Lima Correia", "Administrativo", "Assistente Administrativo", "2023-01-05", null, "Ativo", 2600, "F"],
            ["C007", "Wagner Pires Almeida", "Consultoria", "Consultor Pleno", "2020-11-01", "2022-06-15", "Desligado", 6400, "M"],
            ["C008", "Yasmin Duarte Rocha", "Comercial", "Analista Comercial", "2021-04-08", null, "Ativo", 3900, "F"],
            ["C009", "Alexandre Freitas Nunes", "Consultoria", "Consultor Senior", "2017-08-22", null, "Ativo", 10200, "M"],
            ["C010", "Beatriz Santana Costa", "Administrativo", "Coordenadora Financeira", "2019-12-01", null, "Ativo", 8100, "F"],
          ]
        ),
      },
      {
        name: "Saidas",
        rows: rows(
          ["Cod_Func", "DataSaida", "TipoSaida", "Motivo", "Iniciativa"],
          [
            ["C003", "2023-11-01", "Involuntario", "Reducao de quadro", "Empresa"],
            ["C007", "2022-06-15", "Voluntario", "Nova oportunidade", "Colaborador"],
          ]
        ),
      },
    ],
    groundTruth: {
      isHrData: true,
      sheets: [
        {
          matchOriginalName: "Cadastro",
          expectedRole: "funcionarios",
          columnMap: {
            matricula: "Cod", nome: "NomeCompleto", area: "Depto", cargo: "Cargo",
            data_admissao: "DtAdm", data_desligamento: "DtDeslig", status: "Sit",
            salario_atual: "SalAtual", genero: "Genero",
          },
        },
        {
          matchOriginalName: "Saidas",
          expectedRole: "desligamentos",
          columnMap: {
            matricula: "Cod_Func", data_desligamento: "DataSaida", tipo_desligamento: "TipoSaida",
            motivo_detalhado: "Motivo", iniciativa: "Iniciativa",
          },
        },
      ],
    },
  },

  // ---------------------------------------------------------------------
  // 3) Startup — coluna "Cargo/Nome" combinada, idade direta (sem nascimento)
  // ---------------------------------------------------------------------
  {
    id: "startup_combinada",
    description: "Coluna cargo+nome combinada, idade direta ao inves de data de nascimento",
    sheets: [
      {
        name: "Time",
        rows: rows(
          ["Matricula", "CargoNome", "Setor", "Contratacao", "Desligamento", "SituacaoAtual", "Remuneracao", "Genero", "Idade"],
          [
            ["E01", "Desenvolvedor Backend / Lucas Martins", "Engenharia", "2021-01-11", null, "Ativo", 8500, "M", 29],
            ["E02", "Product Manager / Fernanda Alves", "Produto", "2020-06-01", null, "Ativo", 11000, "F", 34],
            ["E03", "Desenvolvedora Frontend / Camila Rocha", "Engenharia", "2022-02-14", null, "Ativo", 7800, "F", 26],
            ["E04", "Designer / Rafael Santos", "Produto", "2021-09-01", "2023-04-10", "Desligado", 6900, "M", 31],
            ["E05", "Analista de Marketing / Juliana Pires", "Marketing", "2022-11-05", null, "Ativo", 4800, "F", 27],
            ["E06", "Desenvolvedor Backend / Andre Luiz Souza", "Engenharia", "2019-03-20", null, "Ativo", 9200, "M", 36],
            ["E07", "Executiva de Vendas / Larissa Gomes", "Comercial", "2023-01-15", null, "Ativo", 5200, "F", 24],
            ["E08", "Gerente de Engenharia / Marcos Vinicius Lima", "Engenharia", "2018-05-01", null, "Ativo", 15000, "M", 40],
            ["E09", "Analista de RH / Priscila Nunes", "RH", "2022-08-08", null, "Ativo", 4600, "F", 28],
            ["E10", "Desenvolvedor Fullstack / Igor Cavalcante", "Engenharia", "2020-10-01", "2022-01-20", "Desligado", 8100, "M", 30],
          ]
        ),
      },
    ],
    groundTruth: {
      isHrData: true,
      sheets: [
        {
          matchOriginalName: "Time",
          expectedRole: "funcionarios",
          columnMap: {
            matricula: "Matricula", area: "Setor", data_admissao: "Contratacao",
            data_desligamento: "Desligamento", status: "SituacaoAtual", salario_atual: "Remuneracao",
            genero: "Genero", idade: "Idade",
          },
          columnMapAlternatives: { nome: ["CargoNome"], cargo: ["CargoNome"] }, // combinada — aceitavel mapear pra qualquer um dos dois, o app separa depois
        },
      ],
    },
  },

  // ---------------------------------------------------------------------
  // 4) Industria — base minima viavel (so 4 colunas)
  // ---------------------------------------------------------------------
  {
    id: "industria_minima",
    description: "Base minima viavel: so ID, nome, setor e data de entrada",
    sheets: [
      {
        name: "Pessoal",
        rows: rows(
          ["ID", "Nome", "Setor", "DataEntrada"],
          [
            [1, "Jose Carlos Ferreira", "Producao", "2015-03-01"],
            [2, "Maria Aparecida Souza", "Qualidade", "2017-07-12"],
            [3, "Antonio Marcos Lima", "Producao", "2019-01-20"],
            [4, "Francisca Oliveira Reis", "Logistica", "2020-11-05"],
            [5, "Sebastiao Pereira Costa", "Producao", "2016-05-18"],
            [6, "Rita de Cassia Almeida", "Qualidade", "2021-02-01"],
            [7, "Joaquim Batista Nunes", "Manutencao", "2014-09-10"],
            [8, "Aparecida Santos Dias", "Logistica", "2022-04-15"],
          ]
        ),
      },
    ],
    groundTruth: {
      isHrData: true,
      sheets: [
        {
          matchOriginalName: "Pessoal",
          expectedRole: "funcionarios",
          columnMap: { matricula: "ID", nome: "Nome", area: "Setor", data_admissao: "DataEntrada" },
        },
      ],
    },
  },

  // ---------------------------------------------------------------------
  // 5) Apenas folha de pagamento (sem cadastro de funcionarios)
  // ---------------------------------------------------------------------
  {
    id: "somente_folha",
    description: "Base contendo apenas folha de pagamento, sem cadastro de funcionarios",
    sheets: [
      {
        name: "Folha_Mensal",
        rows: rows(
          ["Matricula", "Mes", "SalarioBase", "Beneficios", "Encargos", "CustoTotal"],
          [
            [101, "2024-01", 5000, 800, 1500, 7300],
            [102, "2024-01", 3200, 650, 960, 4810],
            [101, "2024-02", 5000, 800, 1500, 7300],
            [102, "2024-02", 3200, 650, 960, 4810],
            [103, "2024-01", 7800, 900, 2340, 11040],
            [103, "2024-02", 7800, 900, 2340, 11040],
          ]
        ),
      },
    ],
    groundTruth: {
      isHrData: true,
      sheets: [
        {
          matchOriginalName: "Folha_Mensal",
          expectedRole: "folha",
          columnMap: {
            matricula: "Matricula", competencia: "Mes", salario_base: "SalarioBase",
            beneficios_vr_va_saude: "Beneficios", encargos_inss_fgts: "Encargos", custo_total_ctc: "CustoTotal",
          },
        },
      ],
    },
  },

  // ---------------------------------------------------------------------
  // 6) Planilha de vendas — NAO e dado de RH (teste negativo)
  // ---------------------------------------------------------------------
  {
    id: "nao_rh_vendas",
    description: "Planilha de controle de vendas de produtos — nao deve ser reconhecida como RH",
    sheets: [
      {
        name: "Pedidos",
        rows: rows(
          ["ID_Pedido", "Produto", "Categoria", "Quantidade", "PrecoUnitario", "DataVenda", "Cliente"],
          [
            [1, "Notebook Pro 15", "Eletronicos", 2, 4500, "2024-03-01", "Empresa Alfa Ltda"],
            [2, "Mouse sem fio", "Acessorios", 15, 89, "2024-03-02", "Comercio Beta"],
            [3, "Monitor 27 polegadas", "Eletronicos", 4, 1800, "2024-03-03", "Distribuidora Gama"],
            [4, "Teclado mecanico", "Acessorios", 8, 350, "2024-03-04", "Empresa Alfa Ltda"],
            [5, "Cadeira ergonomica", "Moveis", 6, 1200, "2024-03-05", "Comercio Beta"],
          ]
        ),
      },
    ],
    groundTruth: { isHrData: false, sheets: [] },
  },

  // ---------------------------------------------------------------------
  // 7) Mesma estrutura repetida por ano (2019 / 2020) — deve unificar o papel
  // ---------------------------------------------------------------------
  {
    id: "dividido_por_ano",
    description: "2 abas com estrutura identica representando anos diferentes (2019, 2020)",
    sheets: [
      {
        name: "2019",
        rows: rows(
          ["Codigo", "Nome", "Area", "Admissao", "Desligamento", "Status", "Salario"],
          [
            [1, "Eduardo Castro Lima", "Vendas", "2017-01-10", null, "Ativo", 3800],
            [2, "Fernanda Ribeiro Alves", "TI", "2018-06-01", null, "Ativo", 6200],
            [3, "Gustavo Henrique Melo", "Vendas", "2016-03-15", "2019-08-01", "Desligado", 3600],
          ]
        ),
      },
      {
        name: "2020",
        rows: rows(
          ["Codigo", "Nome", "Area", "Admissao", "Desligamento", "Status", "Salario"],
          [
            [1, "Eduardo Castro Lima", "Vendas", "2017-01-10", "2020-05-20", "Desligado", 4100],
            [2, "Fernanda Ribeiro Alves", "TI", "2018-06-01", null, "Ativo", 6800],
            [4, "Helena Souza Barbosa", "RH", "2020-02-01", null, "Ativo", 4500],
          ]
        ),
      },
    ],
    groundTruth: {
      isHrData: true,
      sheets: [
        {
          matchOriginalName: "2019",
          expectedRole: "funcionarios",
          columnMap: { matricula: "Codigo", nome: "Nome", area: "Area", data_admissao: "Admissao", data_desligamento: "Desligamento", status: "Status", salario_atual: "Salario" },
        },
        {
          matchOriginalName: "2020",
          expectedRole: "funcionarios", // MESMO papel que a aba "2019" — testa a instrucao de unificacao
          columnMap: { matricula: "Codigo", nome: "Nome", area: "Area", data_admissao: "Admissao", data_desligamento: "Desligamento", status: "Status", salario_atual: "Salario" },
        },
      ],
    },
  },

  // ---------------------------------------------------------------------
  // 8) Base real — Nexatech (dados de teste do proprio produto, ja usam os
  // nomes de coluna canonicos). Serve como teste de sanidade com 6 abas
  // reais simultaneas; nao mede generalizacao de nomenclatura (ja usa os
  // nomes canonicos), mas testa volume/variedade de papeis de uma vez.
  // ---------------------------------------------------------------------
  {
    id: "nexatech_real",
    description: "Base real Nexatech (6 abas: funcionarios, movimentacoes, RS, desligamentos, entrevistas, folha) — colunas ja no padrao canonico",
    sheets: [
      {
        name: "Funcionarios",
        rows: rows(
          ["matricula", "nome", "cpf", "data_nascimento", "data_admissao", "data_desligamento", "status", "cargo", "senioridade", "area", "centro_custo", "matricula_gestor", "filial", "modelo_trabalho", "tipo_contrato", "genero", "raca_etnia", "pcd", "salario_inicial", "salario_atual"],
          [
            [1001, "Eduardo Nunes Campos", "018.159.083-27", "1987-04-29", "2024-08-20", null, "Ativo", "Diretor(a) Executivo(a) - CEO", "Diretoria", "Diretoria", "CC-01", null, "Matriz - Sao Paulo/SP", "Presencial", "CLT", "M", "Branca", "Nao", 45670, 50550],
            [1002, "Helena Castro Monteiro", "099.603.082-43", "1990-11-10", "2024-08-20", null, "Ativo", "Coordenador(a) Comercial", "Coordenacao", "Comercial", "CC-04", 1001, "Matriz - Sao Paulo/SP", "Presencial", "CLT", "F", "Branca", "Nao", 12920, 15630],
            [1003, "Sergio Castro Martins", "518.190.937-00", "1998-01-01", "2024-08-20", null, "Ativo", "Desenvolvedor(a) Pleno", "Pleno", "Engenharia", "CC-02", 1001, "Matriz - Sao Paulo/SP", "Presencial", "CLT", "M", "Parda", "Nao", 7010, 9300],
            [1004, "Leandro Lopes Ferreira", "948.757.491-39", "1991-03-07", "2024-08-20", "2025-10-27", "Desligado", "Desenvolvedor(a) Junior", "Junior", "Engenharia", "CC-02", 1003, "Matriz - Sao Paulo/SP", "Hibrido", "CLT", "M", "Branca", "Nao", 4310, 4880],
            [1005, "Camila Peixoto Correia", "955.597.971-54", "1995-09-06", "2024-08-20", null, "Ativo", "Executivo(a) de Contas Pleno", "Pleno", "Comercial", "CC-04", 1002, "Matriz - Sao Paulo/SP", "Presencial", "CLT", "F", "Preta", "Nao", 3580, 5280],
            [1006, "Caio Nascimento Melo", "632.122.330-10", "1999-05-08", "2024-09-22", null, "Ativo", "Desenvolvedor(a) Junior", "Junior", "Engenharia", "CC-02", 1003, "Matriz - Sao Paulo/SP", "Presencial", "CLT", "M", "Parda", "Nao", 4540, 4890],
            [1007, "Jessica Nunes Alves", "760.313.721-77", "1997-12-13", "2024-09-22", null, "Ativo", "Analista Financeiro Senior", "Senior", "Financeiro", "CC-08", 1001, "Matriz - Sao Paulo/SP", "Presencial", "CLT", "F", "Branca", "Nao", 10300, 11670],
            [1008, "Daniela Pereira Coelho", "777.741.215-95", "1992-07-10", "2024-09-22", "2025-03-25", "Desligado", "Executivo(a) de Contas Pleno", "Pleno", "Comercial", "CC-04", 1002, "Matriz - Sao Paulo/SP", "Presencial", "CLT", "F", "Parda", "Nao", 7510, 7510],
          ]
        ),
      },
      {
        name: "Movimentacoes",
        rows: rows(
          ["matricula", "data_evento", "tipo_evento", "cargo_anterior", "cargo_novo", "area_anterior", "area_novo", "salario_anterior", "salario_novo", "matricula_gestor_anterior", "matricula_gestor_novo", "motivo"],
          [
            [1001, "2024-08-20", "Admissao", null, "Diretor(a) Executivo(a) - CEO", null, "Diretoria", null, 45670, null, null, "Fundacao da empresa"],
            [1002, "2024-08-20", "Admissao", null, "Coordenador(a) Comercial", null, "Comercial", null, 12920, null, 1001, "Contratacao - equipe fundadora"],
            [1003, "2024-08-20", "Admissao", null, "Desenvolvedor(a) Pleno", null, "Engenharia", null, 7010, null, 1001, "Contratacao - equipe fundadora"],
            [1004, "2024-08-20", "Admissao", null, "Desenvolvedor(a) Junior", null, "Engenharia", null, 4310, null, 1003, "Contratacao - equipe fundadora"],
            [1005, "2024-08-20", "Admissao", null, "Analista Comercial Junior", null, "Comercial", null, 3580, null, 1002, "Contratacao - equipe fundadora"],
            [1001, "2024-09-22", "Reajuste/Merito", "Diretor(a) Executivo(a) - CEO", "Diretor(a) Executivo(a) - CEO", "Diretoria", "Diretoria", 45670, 47960, null, null, "Reajuste anual / merito"],
          ]
        ),
      },
      {
        name: "Recrutamento_Selecao",
        rows: rows(
          ["id_vaga", "cargo", "area", "data_abertura", "data_fechamento", "recrutador_responsavel", "status", "origem_vaga", "fonte_recrutamento", "matricula_contratado", "tempo_contratacao_dias"],
          [
            ["VG-101", "Diretor(a) Executivo(a) - CEO", "Diretoria", "2024-07-11", "2024-08-20", "Fundadores (processo direto)", "Fechada", "Aumento de quadro", "Indicacao interna", 1001, 40],
            ["VG-102", "Coordenador(a) Comercial", "Comercial", "2024-07-13", "2024-08-20", "Fundadores (processo direto)", "Fechada", "Aumento de quadro", "Indicacao interna", 1002, 38],
            ["VG-103", "Desenvolvedor(a) Pleno", "Engenharia", "2024-07-17", "2024-08-20", "Fundadores (processo direto)", "Fechada", "Aumento de quadro", "Indicacao interna", 1003, 34],
            ["VG-105", "Analista Comercial Junior", "Comercial", "2024-07-19", "2024-08-20", "Fundadores (processo direto)", "Fechada", "Aumento de quadro", "Indicacao interna", 1005, 32],
            ["VG-104", "Desenvolvedor(a) Junior", "Engenharia", "2024-07-22", "2024-08-20", "Fundadores (processo direto)", "Fechada", "Aumento de quadro", "Indicacao interna", 1004, 29],
            ["VG-116", "Auxiliar Administrativo(a)", "Administrativo", "2024-08-20", "2024-10-18", "Camila Nogueira Reis", "Fechada", "Aumento de quadro", "Site de vagas (Gupy)", 1016, 59],
          ]
        ),
      },
      {
        name: "Desligamentos",
        rows: rows(
          ["matricula", "data_desligamento", "tipo_desligamento", "motivo_detalhado", "iniciativa", "tempo_casa_dias", "nota_enps"],
          [
            [1021, "2025-03-24", "Involuntario", "Reestruturacao de area", "Empresa", 113, 7],
            [1054, "2025-03-24", "Voluntario", "Motivos pessoais/familiares", "Colaborador", 33, 8],
            [1008, "2025-03-25", "Involuntario", "Encerramento de contrato de experiencia", "Empresa", 184, 6],
            [1075, "2025-04-21", "Voluntario", "Insatisfacao com o cargo atual", "Colaborador", 35, 5],
            [1063, "2025-04-25", "Voluntario", "Insatisfacao com o cargo atual", "Colaborador", 39, 8],
          ]
        ),
      },
      {
        name: "Entrevista_Desligamento",
        rows: rows(
          ["matricula", "categoria", "pergunta", "resposta_nota", "resposta_texto"],
          [
            [1008, "Lideranca e Gestao", "Como voce avalia o apoio recebido do seu gestor para realizar suas atividades?", 3, "Bom"],
            [1008, "Lideranca e Gestao", "Como voce avalia a clareza das orientacoes e expectativas passadas pela lideranca?", 4, "Otimo"],
            [1008, "Lideranca e Gestao", "Como voce avalia a abertura da lideranca para ouvir sugestoes e feedbacks?", 3, "Bom"],
            [1008, "Lideranca e Gestao", "Como voce avalia a forma como os conflitos e problemas eram tratados pela gestao?", 2, "Regular"],
            [1008, "Lideranca e Gestao", "Como voce avalia o reconhecimento recebido da sua lideranca pelo seu trabalho?", 3, "Bom"],
          ]
        ),
      },
      {
        name: "Folha_Pagamento",
        rows: rows(
          ["matricula", "competencia", "salario_base", "beneficios_vr_va_saude", "bonus_comissao", "encargos_inss_fgts", "horas_extras", "custo_total_ctc"],
          [
            [1001, "2024-08", 45670, 1616, 0, 13984.63, 0, 61270.63],
            [1002, "2024-08", 12920, 1456, 2450.86, 3738.65, 0, 20565.51],
            [1003, "2024-08", 7010, 1156, 0, 2043.37, 0, 10209.37],
            [1004, "2024-08", 4310, 1156, 0, 1140.14, 237.77, 6843.91],
            [1005, "2024-08", 3580, 1156, 1048.56, 938.3, 0, 6722.86],
            [1001, "2024-09", 47960, 1616, 0, 14037.71, 0, 63613.71],
          ]
        ),
      },
    ],
    groundTruth: {
      isHrData: true,
      sheets: [
        {
          matchOriginalName: "Funcionarios",
          expectedRole: "funcionarios",
          columnMap: {
            matricula: "matricula", nome: "nome", cpf: "cpf", data_nascimento: "data_nascimento",
            data_admissao: "data_admissao", data_desligamento: "data_desligamento", status: "status",
            cargo: "cargo", senioridade: "senioridade", area: "area", centro_custo: "centro_custo",
            matricula_gestor: "matricula_gestor", filial: "filial", modelo_trabalho: "modelo_trabalho",
            tipo_contrato: "tipo_contrato", genero: "genero", raca_etnia: "raca_etnia", pcd: "pcd",
            salario_inicial: "salario_inicial", salario_atual: "salario_atual",
          },
        },
        {
          matchOriginalName: "Movimentacoes",
          expectedRole: "movimentacoes",
          columnMap: {
            matricula: "matricula", data_evento: "data_evento", tipo_evento: "tipo_evento",
            cargo_anterior: "cargo_anterior", cargo_novo: "cargo_novo", area_anterior: "area_anterior",
            area_novo: "area_novo", salario_anterior: "salario_anterior", salario_novo: "salario_novo",
            motivo: "motivo",
          },
        },
        {
          matchOriginalName: "Recrutamento_Selecao",
          expectedRole: "rs",
          columnMap: {
            id_vaga: "id_vaga", cargo: "cargo", area: "area", data_abertura: "data_abertura",
            data_fechamento: "data_fechamento", recrutador_responsavel: "recrutador_responsavel",
            status: "status", origem_vaga: "origem_vaga", fonte_recrutamento: "fonte_recrutamento",
            matricula_contratado: "matricula_contratado", tempo_contratacao_dias: "tempo_contratacao_dias",
          },
        },
        {
          matchOriginalName: "Desligamentos",
          expectedRole: "desligamentos",
          columnMap: {
            matricula: "matricula", data_desligamento: "data_desligamento", tipo_desligamento: "tipo_desligamento",
            motivo_detalhado: "motivo_detalhado", iniciativa: "iniciativa", tempo_casa_dias: "tempo_casa_dias",
            nota_enps: "nota_enps",
          },
        },
        {
          matchOriginalName: "Entrevista_Desligamento",
          expectedRole: "entrevistas",
          columnMap: {
            matricula: "matricula", categoria: "categoria", pergunta: "pergunta",
            resposta_nota: "resposta_nota", resposta_texto: "resposta_texto",
          },
        },
        {
          matchOriginalName: "Folha_Pagamento",
          expectedRole: "folha",
          columnMap: {
            matricula: "matricula", competencia: "competencia", salario_base: "salario_base",
            beneficios_vr_va_saude: "beneficios_vr_va_saude", bonus_comissao: "bonus_comissao",
            encargos_inss_fgts: "encargos_inss_fgts", horas_extras: "horas_extras",
            custo_total_ctc: "custo_total_ctc",
          },
        },
      ],
    },
  },

  // ---------------------------------------------------------------------
  // 9) Base real — Trilha (dados reais de teste, nomenclatura de coluna
  // totalmente diferente do padrao canonico — bom teste de generalizacao
  // com dado real, nao sintetico).
  // ---------------------------------------------------------------------
  {
    id: "trilha_real",
    description: "Base real Trilha (3 abas: funcionarios, recrutamento, pesquisa de saida) — nomenclatura de coluna bem diferente do padrao canonico",
    sheets: [
      {
        name: "Funcionarios",
        rows: rows(
          ["Codigo", "Nome", "Setor", "Cargo", "DataAdmissao", "DataDemissao", "SituacaoAtual", "SalarioAtual", "Genero", "Idade", "Cidade", "TipoVinculo"],
          [
            ["F0001", "Leonardo Soares Duarte", "Frota e Manutencao", "Auxiliar de Manutencao", "01/03/2019", "27/03/2019", "Desligado", 1310, "M", 20, "Ponta Grossa/PR", "CLT"],
            ["F0002", "Marcos Gomes Freitas", "Frota e Manutencao", "Mecanico de Frota", "01/03/2019", "01/02/2021", "Desligado", 3280, "M", 33, "Sao Jose dos Pinhais/PR", "CLT"],
            ["F0003", "Michele Ferreira Freitas", "Operacoes", "Auxiliar de Logistica", "01/03/2019", null, "Ativo", 1270, "F", 22, "Londrina/PR", "CLT"],
            ["F0004", "Fabio Goncalves Melo", "Operacoes", "Supervisor de Operacoes", "01/03/2019", null, "Ativo", 4490, "M", 53, "Sao Jose dos Pinhais/PR", "CLT"],
            ["F0005", "Renato Barbosa Castro", "Frota e Manutencao", "Mecanico de Frota", "01/03/2019", "28/12/2021", "Desligado", 3010, "M", 35, "Curitiba/PR", "CLT"],
            ["F0006", "Karina Teixeira Nunes", "Frota e Manutencao", "Supervisor de Frota", "01/03/2019", "22/06/2019", "Desligado", 4400, "F", 48, "Sao Jose dos Pinhais/PR", "CLT"],
            ["F0007", "Cristina Pereira Alves", "Operacoes", "Analista de Operacoes", "01/03/2019", null, "Ativo", 2940, "F", 26, "Curitiba/PR", "CLT"],
            ["F0008", "Isabela Soares Pereira", "Frota e Manutencao", "Supervisor de Frota", "01/03/2019", null, "Ativo", 5510, "F", 38, "Joinville/SC", "CLT"],
            ["F0009", "Priscila Carvalho Guimaraes", "Administrativo e Financeiro", "Assistente Administrativo", "10/03/2019", "03/05/2022", "Desligado", 1910, "F", 19, "Sao Jose dos Pinhais/PR", "CLT"],
            ["F0010", "Bruno Lima Soares", "Tecnologia da Informacao", "Analista de Suporte", "10/03/2019", "27/05/2024", "Desligado", 2840, "M", 32, "Ponta Grossa/PR", "CLT"],
          ]
        ),
      },
      {
        name: "Recrutamento",
        rows: rows(
          ["CodigoVaga", "Cargo", "Setor", "Abertura", "Fechamento", "Recrutador", "SituacaoVaga", "OrigemVaga", "Canal", "CodigoContratado"],
          [
            ["VG-001", "Auxiliar de Manutencao", "Frota e Manutencao", "16/01/2019", "01/03/2019", "Patricia Gomes Ramos", "Fechada", "Substituicao", "Indicacao de Funcionarios", "F0001"],
            ["VG-002", "Mecanico de Frota", "Frota e Manutencao", "29/01/2019", "01/03/2019", "Patricia Gomes Ramos", "Fechada", "Aumento de Quadro", "Agencia de Emprego", "F0002"],
            ["VG-003", "Auxiliar de Logistica", "Operacoes", "21/01/2019", "01/03/2019", "Patricia Gomes Ramos", "Fechada", "Substituicao", "Indicacao de Funcionarios", "F0003"],
            ["VG-004", "Supervisor de Operacoes", "Operacoes", "17/02/2019", "01/03/2019", "Patricia Gomes Ramos", "Fechada", "Aumento de Quadro", "Indicacao de Funcionarios", "F0004"],
            ["VG-005", "Mecanico de Frota", "Frota e Manutencao", "26/01/2019", "01/03/2019", "Eduardo Castro Lima", "Fechada", "Aumento de Quadro", "LinkedIn", "F0005"],
            ["VG-006", "Supervisor de Frota", "Frota e Manutencao", "28/01/2019", "01/03/2019", "Juliana Marques Dias", "Fechada", "Substituicao", "Site de Vagas", "F0006"],
          ]
        ),
      },
      {
        name: "Pesquisa",
        rows: rows(
          ["Pesquisa", "DataResposta", "Resposta", "CodigoFuncionario", "Tema"],
          [
            ["Entrevista de Desligamento", "30/03/2019", "Neutro", "F0001", "Relacionamento com Lideranca"],
            ["Entrevista de Desligamento", "29/03/2019", "Neutro", "F0001", "Infraestrutura"],
            ["Entrevista de Desligamento", "26/06/2019", "Neutro", "F0006", "Carga Horaria"],
            ["Entrevista de Desligamento", "22/06/2019", "Neutro", "F0006", "Beneficios"],
            ["Entrevista de Desligamento", "26/06/2019", "Neutro", "F0006", "Saude e Seguranca"],
            ["Entrevista de Desligamento", "24/06/2019", "Neutro", "F0006", "Salario"],
          ]
        ),
      },
    ],
    groundTruth: {
      isHrData: true,
      sheets: [
        {
          matchOriginalName: "Funcionarios",
          expectedRole: "funcionarios",
          columnMap: {
            matricula: "Codigo", nome: "Nome", area: "Setor", cargo: "Cargo",
            data_admissao: "DataAdmissao", data_desligamento: "DataDemissao", status: "SituacaoAtual",
            salario_atual: "SalarioAtual", genero: "Genero", idade: "Idade",
          },
          // "Cidade" e "TipoVinculo" nao tem campo canonico correspondente — devem ficar sem mapeamento (null), nao e erro.
        },
        {
          matchOriginalName: "Recrutamento",
          expectedRole: "rs",
          columnMap: {
            id_vaga: "CodigoVaga", cargo: "Cargo", area: "Setor", data_abertura: "Abertura",
            data_fechamento: "Fechamento", recrutador_responsavel: "Recrutador", status: "SituacaoVaga",
            origem_vaga: "OrigemVaga", fonte_recrutamento: "Canal", matricula_contratado: "CodigoContratado",
          },
        },
        {
          matchOriginalName: "Pesquisa",
          expectedRole: "entrevistas",
          columnMap: {
            matricula: "CodigoFuncionario", categoria: "Tema", resposta_texto: "Resposta",
          },
          // "Pesquisa" e "DataResposta" nao tem campo canonico correspondente em "entrevistas".
        },
      ],
    },
  },

  // ---------------------------------------------------------------------
  // 10) Base adversarial — propositalmente dificil, pra testar o limite do 100%.
  // Cabecalhos ambiguos/sujos, coluna "decoy" que parece matricula mas nao e,
  // coluna combinada cargo+area, datas em formatos inconsistentes dentro da
  // MESMA coluna, salario com moeda/formatacao (nao numero limpo), uma coluna
  // numerica decoy parecida com salario, e uma aba que NAO e RH mas parece
  // (tem nomes de pessoas e "aprovador") — teste de falso-positivo de deteccao.
  // ---------------------------------------------------------------------
  {
    id: "adversarial_dificil",
    description: "Base propositalmente dificil: cabecalhos ambiguos/sujos, coluna decoy de ID (nao e matricula), cargo+area combinados, datas em formatos mistos, salario com moeda, coluna numerica decoy, e uma aba nao-RH disfarcada (aprovacao de orcamento com nomes de pessoas)",
    sheets: [
      {
        name: "Cadastro_Confuso",
        rows: rows(
          ["Cod_Sist", "Matricula_RH", "Nome Completo (Nome Social)", "Funcao/Area", "Status_Atual", "Dt Adm", "Remuneração (R$)", "Meta_Mensal", "Obs"],
          [
            ["SYS-9001", "M-501", "Carlos Eduardo Nascimento", "Analista de Vendas / Comercial", "Active", "2021-05-01", "R$ 4.500,00", 50000, ""],
            ["SYS-9002", "M-502", "Juliana Mara Oliveira (Ju)", "Gerente de Loja / Comercial", "Active", "01/03/2019", "R$ 8.200,50", 120000, "Transferida da filial SP em 2022"],
            ["SYS-9003", "M-503", "Roberto Silva Andrade", "Analista Financeiro / Financeiro", "Terminated", "1 de julho de 2018", "R$ 6.100,00", null, "Desligamento por reestruturacao"],
            ["SYS-9004", "M-504", "Fernanda Costa Lima", "Assistente de RH / Recursos Humanos", "Active", "2020-11-15", "R$ 3.200,00", null, ""],
            ["SYS-9005", "M-505", "Paulo Henrique Souza", "Supervisor de Producao / Producao", "Active", "15/02/2017", "R$ 5.750,75", 80000, ""],
            ["SYS-9006", "M-506", "Marina Alves Pereira", "Analista de Marketing / Marketing", "Terminated", "2022-09-01", "R$ 4.900,00", null, "Pediu demissao"],
            ["SYS-9007", "M-507", "Diego Martins Rocha", "Auxiliar Administrativo / Administrativo", "Active", "3 de janeiro de 2023", "R$ 2.400,00", null, ""],
            ["SYS-9008", "M-508", "Aline Rodrigues Faria", "Coordenadora de TI / Tecnologia", "Active", "2019-04-22", "R$ 9.800,00", null, ""],
            ["SYS-9009", "M-509", "Thiago Barros Cunha", "Vendedor / Comercial", "Active", "10/08/2021", "R$ 3.100,00", 45000, ""],
            ["SYS-9010", "M-510", "Camila Torres Vieira", "Analista Contabil / Financeiro", "Terminated", "2016-06-30", "R$ 5.400,00", null, "Fim de contrato temporario"],
          ]
        ),
      },
      {
        name: "Aprovacoes_Orcamento",
        rows: rows(
          ["ID_Solicitacao", "Solicitante", "Departamento", "Valor_Aprovado", "Data_Aprovacao", "Aprovador"],
          [
            ["SOL-001", "Carlos Eduardo Nascimento", "Comercial", 12000, "2024-01-15", "Roberta Dias"],
            ["SOL-002", "Marina Alves Pereira", "Marketing", 8500, "2024-02-03", "Roberta Dias"],
            ["SOL-003", "Diego Martins Rocha", "Administrativo", 3000, "2024-02-20", "Fernando Melo"],
            ["SOL-004", "Aline Rodrigues Faria", "Tecnologia", 25000, "2024-03-01", "Fernando Melo"],
            ["SOL-005", "Thiago Barros Cunha", "Comercial", 6000, "2024-03-18", "Roberta Dias"],
            ["SOL-006", "Camila Torres Vieira", "Financeiro", 9000, "2024-04-05", "Fernando Melo"],
          ]
        ),
      },
    ],
    groundTruth: {
      isHrData: true,
      sheets: [
        {
          matchOriginalName: "Cadastro_Confuso",
          expectedRole: "funcionarios",
          columnMap: {
            matricula: "Matricula_RH",
            nome: "Nome Completo (Nome Social)",
            cargo: "Funcao/Area",
            area: "Funcao/Area",
            status: "Status_Atual",
            data_admissao: "Dt Adm",
            salario_atual: "Remuneração (R$)",
          },
          // "Cod_Sist" e decoy (parece ID mas nao e a matricula usada pelo RH); "Meta_Mensal" e
          // decoy numerico parecido com salario; "Obs" e ruido textual. Nenhum dos tres deveria
          // ser mapeado para um campo canonico.
        },
        {
          matchOriginalName: "Aprovacoes_Orcamento",
          expectedRole: "unknown",
          columnMap: {},
          // Aba disfarcada: tem nomes de pessoas e um "aprovador", mas e fluxo de aprovacao de
          // orcamento, nao dado de RH. A IA deve classificar como "unknown", nao como uma das
          // roles de RH.
        },
      ],
    },
  },
];
