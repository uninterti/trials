# Trabalhos individuais e desempenho

## Como usar

1. Entre como professor e abra **Alunos → Desempenho e liberação de trabalhos**. O botão **Desempenho / Trabalhos** na linha de cada aluno abre a mesma área com o aluno selecionado.
2. Escolha o aluno e o trabalho disponível para seu curso. Clique em **Liberar trabalho**. A mesma liberação não é duplicada e não apaga notas anteriores.
3. O aluno entra com sua própria conta e abre **Meus trabalhos**. Somente trabalhos liberados para ele aparecem.
4. O W-A1 contém 10 questões objetivas da Aula 1 de Word, valendo 1 ponto cada. Todas devem ser respondidas antes da entrega.
5. Após entregar, o aluno vê a nota salva, suas respostas e o gabarito comentado. Pode consultar esse resultado depois de entrar novamente.
6. **Refazer com questões embaralhadas** abre uma nova tentativa com uma ordem diferente da anterior. Tentativas concluídas não são sobrescritas.
7. No relatório do professor, filtre por curso para ver curso, aula, trabalho, aluno, status, nota atual, melhor nota, quantidade de tentativas e última entrega. Abra o histórico para consultar cada nota e data.

A nota atual é a da última tentativa concluída, inclusive se for inferior à anterior. A média considera apenas trabalhos com nota, usando a nota atual de cada trabalho. Uma nova tentativa em andamento preserva a última nota concluída até ser entregue. Respostas ainda não entregues não são salvas; a tela informa isso. Excluir o cadastro do aluno também remove suas liberações e tentativas, conforme a confirmação de exclusão.

A revisão geral de três perguntas em **Avaliações** permanece separada dos trabalhos individuais. Nesta primeira versão, somente **Word · Aula 1 · W-A1** está disponível; W-A2 é uma expansão futura.

## Implementação

- `lib/work-bank.ts`: definição do W-A1, dez questões, alternativas, respostas e explicações; uso somente no servidor.
- `lib/works.ts`: autenticação com consulta da conta atual, autorização, resumos e projeção pública das tentativas.
- `app/api/assignments/route.ts`: consulta de liberações e liberação pelo professor.
- `app/api/assignments/attempts/route.ts`: iniciar/retomar (`POST`), entregar (`PATCH`) e consultar (`GET`) uma tentativa do aluno autenticado.
- `app/api/students/performance/route.ts`: relatório restrito ao professor.
- `public/works.js`: telas de liberação, relatório, lista do aluno, questionário e resultado.
- `work_assignments`: vínculo único entre trabalho e aluno.
- `work_attempts`: versão, questões na ordem apresentada, respostas, nota e datas. O índice parcial permite apenas uma tentativa em andamento por liberação.

A API não recebe a nota como fonte de verdade. Corrige por ID da questão, valida todas as alternativas e devolve o gabarito somente após a conclusão. Reenvios de uma tentativa concluída retornam o resultado já salvo. Cada tentativa guarda uma cópia das questões para preservar sua correção mesmo se o banco de questões evoluir.

Para adicionar W-A2, incluir uma definição com ID próprio, curso, aula, versão e dez questões revisadas. Não remover definições de trabalhos que já tenham liberações. A interface de liberação e o relatório utilizam esses metadados automaticamente.

## Migração e validação

A migração `drizzle/0002_work_assignments.sql` cria as duas tabelas e reconcilia a tabela `users` com o snapshot do Drizzle, usando `IF NOT EXISTS` somente na tabela e nos índices legados de usuários. O arquivo preexistente `0002_users.sql` e as migrações anteriores foram preservados. A migração nova foi aplicada uma vez ao banco local; não deve ser reaplicada manualmente. Na publicação pelo Sites, as migrações são incluídas no pacote.

Comandos de validação:

```sh
node --experimental-strip-types --test tests/work-bank.test.mjs
node_modules/.bin/tsc --noEmit
node --check public/interface.js
node --check public/works.js
```

Com a aplicação local em execução e migrações aplicadas:

```sh
node --experimental-strip-types tests/works.integration.mjs
```

O teste de integração só aceita localhost. Usa a conta local de demonstração do professor e cria alunos temporários, removidos ao final. Verifica isolamento, autorização, liberação duplicada, início concorrente, envio inválido, correção, reenvio idempotente, embaralhamento, histórico e persistência após novo login.

Foi necessário priorizar a correspondência exata do usuário no login: a consulta anterior podia selecionar outra conta de professor antes de validar a senha.
