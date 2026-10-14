export type WorkQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
};

// Server-only source: never import this bank into a client component or public asset.
export const workDefinitions = [{
  id: "W-A1", courseId: "word", courseTitle: "Word", lessonId: "word-1",
  lessonTitle: "Aula 1", title: "Primeiros passos no Word", version: 1,
  questions: [
    { id: "wa1-01", prompt: "Para criar uma apresentação pessoal do zero no Word, qual opção você escolhe ao abrir o programa?", options: ["Documento em branco", "Imprimir", "Fechar documento", "Exportar PDF"], correct: 0, explanation: "Documento em branco abre uma página para começar a escrever." },
    { id: "wa1-02", prompt: "Em qual guia ficam as opções para abrir, salvar e imprimir um documento?", options: ["Inserir", "Página Inicial", "Arquivo", "Layout"], correct: 2, explanation: "A guia Arquivo reúne as opções de abrir, salvar e imprimir." },
    { id: "wa1-03", prompt: "Você quer começar um novo parágrafo. Qual tecla deve usar?", options: ["Delete", "Enter", "Esc", "Backspace"], correct: 1, explanation: "Enter inicia um novo parágrafo. Não é preciso usá-lo no final de cada linha." },
    { id: "wa1-04", prompt: "Você precisa mover uma frase para outro lugar, retirando-a da posição original. O que deve fazer?", options: ["Copiar e copiar novamente", "Salvar e fechar", "Aplicar negrito", "Selecionar, recortar e colar"], correct: 3, explanation: "Recortar retira o trecho da posição original; colar o coloca no novo local." },
    { id: "wa1-05", prompt: "Qual é o primeiro passo para mudar a formatação de apenas uma palavra?", options: ["Selecionar a palavra", "Selecionar todos os parágrafos", "Exportar o documento", "Apagar o título"], correct: 0, explanation: "Selecione apenas o trecho desejado antes de aplicar a formatação." },
    { id: "wa1-06", prompt: "Como a Aula 1 orienta formatar o título APRESENTAÇÃO PESSOAL?", options: ["Tamanho 11 e alinhado à direita", "Tamanho 18, negrito e centralizado", "Sem destaque e alinhado à esquerda", "Itálico e com marcadores"], correct: 1, explanation: "O título deve usar tamanho 18, negrito e alinhamento centralizado." },
    { id: "wa1-07", prompt: "Para listar ferramentas favoritas sem uma sequência obrigatória, qual recurso é mais adequado?", options: ["Cabeçalho", "Quebra de página", "Lista com marcadores", "Lista numerada"], correct: 2, explanation: "Marcadores organizam conjuntos de itens sem ordem obrigatória." },
    { id: "wa1-08", prompt: "Para apresentar etapas de uma rotina em uma sequência, qual recurso deve ser usado?", options: ["Marca-texto", "Sublinhado", "Alinhamento centralizado", "Lista numerada"], correct: 3, explanation: "A numeração é adequada quando a ordem das etapas importa." },
    { id: "wa1-09", prompt: "Qual formato deve ser guardado para continuar editando o documento no Word?", options: ["PDF", "DOCX", "PNG", "MP3"], correct: 1, explanation: "DOCX é o formato de edição do Word; guarde essa versão para continuar o trabalho." },
    { id: "wa1-10", prompt: "Por que a Aula 1 orienta também salvar uma versão em PDF?", options: ["Para apagar a versão DOCX", "Para transformar o texto em áudio", "Para manter a aparência ao compartilhar ou imprimir", "Para impedir que o documento seja aberto"], correct: 2, explanation: "O PDF mantém a aparência do documento ao compartilhar ou imprimir." },
  ] satisfies WorkQuestion[],
}];

export function publicWork(work: { id: string; courseId: string; courseTitle: string; lessonTitle: string; title: string; version: number; level?: string; questions: WorkQuestion[] }) {
  return { id: work.id, courseId: work.courseId, courseTitle: work.courseTitle, lessonTitle: work.lessonTitle, title: work.title, version: work.version, level: work.level, questionCount: work.questions.length, total: work.questions.length };
}

export function shuffledQuestions(questions: WorkQuestion[], previousIds: string[] = []) {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Ensure a retake never has exactly the preceding question order.
  if (shuffled.length > 1 && shuffled.every((q, i) => q.id === previousIds[i])) {
    shuffled.push(shuffled.shift()!);
  }
  return shuffled;
}

export function gradeAnswers(questions: WorkQuestion[], answers: unknown) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  const values = answers as Record<string, unknown>;
  if (Object.keys(values).length !== questions.length) return null;
  if (!questions.every(q => Object.hasOwn(values, q.id) && Number.isInteger(values[q.id]) && Number(values[q.id]) >= 0 && Number(values[q.id]) < q.options.length)) return null;
  return questions.reduce((score, q) => score + Number(values[q.id] === q.correct), 0);
}
