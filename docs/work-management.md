# Gestão de trabalhos e banco de questões

O professor acessa **Gestão de trabalhos** no menu. A área tem duas abas e filtros por curso, nível e texto.

## Questões

- Cursos: Word, Excel e PowerPoint.
- Níveis: Fácil, Intermediário e Difícil.
- Cada questão tem pergunta, quatro alternativas distintas, uma resposta correta e explicação opcional.
- A listagem permite visualizar as alternativas e o gabarito, consultar em quantos trabalhos a questão aparece e editar seu conteúdo.
- O curso é fixado no cadastro; para outro curso, crie outra questão.
- Apenas professores acessam o banco e o gabarito administrativo. Alunos recebem o gabarito somente após entregar uma tentativa.

## Trabalhos

1. Clique em **Novo trabalho** e informe código único, título, curso, nível e, opcionalmente, aula/unidade.
2. Selecione até dez questões do mesmo curso. É possível combinar questões de níveis diferentes e filtrar o seletor por nível ou texto.
3. Use **Cadastrar questão** para abrir o banco sem perder o trabalho em preenchimento. Depois de salvar a questão, volte à aba Trabalhos e selecione-a.
4. Salve mesmo com menos de dez questões: o trabalho fica como **Rascunho**.
5. Com dez questões, fica **Pronto para liberar** em **Alunos → Desempenho**. A regra continua sendo um ponto por questão, dez pontos no total.
6. **Visualizar / Editar** permite atualizar título, nível, aula e questões. Código e curso são fixos após o cadastro.

O W-A1 e suas dez questões originais são incorporados automaticamente ao cadastro na primeira consulta administrativa. Essa inicialização não sobrescreve edições posteriores.

## Preservação das notas

Cada liberação nova guarda uma cópia completa do trabalho e das questões. Alterar o banco ou o trabalho não modifica liberações anteriores, mesmo antes de o aluno começar ou ao refazer. Cada tentativa também guarda as questões apresentadas e a ordem. Liberações antigas do W-A1 sem essa cópia usam a definição original preservada no código.

A cópia com respostas corretas permanece no servidor. A listagem do aluno recebe apenas os metadados do trabalho. O relatório usa o título e o total da liberação, preservando a interpretação das notas históricas.

Edições administrativas usam uma revisão para detectar alterações concorrentes. Se outra aba salvou primeiro, a API retorna conflito e pede atualização, sem apagar as questões associadas ao trabalho.

## Arquivos e APIs

- `lib/work-input.ts`: validação de cursos, níveis, textos, alternativas e seleção de questões.
- `lib/work-catalog.ts`: persistência, inicialização do W-A1 e leitura das cópias de liberação.
- `public/work-management.js`: listagens, filtros, formulários e seleção de questões.
- `/api/teacher/questions`: GET lista; POST cadastra; PATCH edita com `id` e `revision`.
- `/api/teacher/works`: GET lista; POST cadastra; PATCH edita com `id` e `revision`.
- `/api/assignments`: continua responsável por liberar trabalhos aos alunos; aceita apenas trabalhos completos.

A migração `drizzle/0003_work_management.sql` adiciona `question_bank`, `managed_works`, `managed_work_questions` e a coluna nullable `work_assignments.definition_snapshot`. Não apaga tabelas, notas ou liberações existentes. O conteúdo inicial é inserido pela aplicação, separado da migração de schema.

## Ambientes e publicação

O ambiente usado pelo professor é `https://professor.toniagne.workers.dev`, com banco D1 `professor-toni`. O site `trials.toniagne.chatgpt.site` usa outro banco. Publicar ou migrar um não atualiza o outro.

Após o build, confira o binding `DB` em `dist/server/wrangler.json`. Para o ambiente direto da Cloudflare, aplique **somente a migração pendente**, uma única vez, antes de publicar o Worker:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --remote --config dist/server/wrangler.json --file drizzle/0003_work_management.sql --yes
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.json --keep-vars
```

Antes de executar a migração, confira se as tabelas e a coluna já existem. O comando de deploy do Worker não aplica essa migração automaticamente. Para instalação local, use `--local --persist-to .wrangler/state` em vez de `--remote`.

## Validação

```sh
node --experimental-strip-types tests/work-bank.test.mjs
node --experimental-strip-types tests/works.integration.mjs
node --experimental-strip-types tests/work-management.integration.mjs
node_modules/.bin/tsc --noEmit
node --check public/work-management.js
```

Os testes HTTP exigem a aplicação local e as migrações aplicadas. Não aceitam hosts de produção. Criam dados temporários e os removem ao terminar. Cobrem permissões, validação, associações por curso, edição concorrente, rascunhos, congelamento das liberações, compatibilidade do W-A1 e trabalhos de Excel, além da regressão de notas e tentativas.

## Simulador do professor

Em **Gestão de trabalhos → Trabalhos → Simular**, o professor responde ao mesmo questionário apresentado ao aluno. O botão está disponível para trabalhos salvos com dez questões. Ao entregar, aparecem a nota de zero a dez e o gabarito comentado. **Refazer com questões embaralhadas** inicia uma nova simulação com a ordem alterada.

A simulação usa a versão salva atual do cadastro. Liberações anteriores continuam usando suas próprias cópias, que podem ter conteúdo diferente após uma edição. O questionário e o gabarito compartilham o renderizador do aluno; correção e embaralhamento compartilham `public/work-engine.js` com o servidor.

Nenhuma liberação, tentativa, resposta ou nota é gravada. Os dados da simulação existem somente na memória da página e são descartados ao sair, atualizar ou encerrar a sessão. Não há alteração no relatório do aluno nem migração de banco para este recurso.

Teste de navegador local (Chrome instalado e aplicação na porta 5173):

```sh
node tests/work-simulator.browser.mjs
```

Verifica apresentação idêntica das perguntas, preenchimento obrigatório, notas 0/7/10, gabarito, embaralhamento, descarte, layout móvel e ausência de requisições de gravação durante a simulação.
