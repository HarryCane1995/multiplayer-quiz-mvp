import type { Question } from "./types";

export const QUESTIONS: Question[] = [
  {
    text: "Какой язык используется для типизации JavaScript?",
    options: ["TypeScript", "Python", "Go", "Ruby"],
    correctIndex: 0
  },
  {
    text: "Какой транспорт чаще всего использует Socket.io для постоянного соединения?",
    options: ["SMTP", "WebSocket", "FTP", "DNS"],
    correctIndex: 1
  },
  {
    text: "Какой хук React используется для локального состояния компонента?",
    options: ["useRouter", "useState", "useMemo", "useServer"],
    correctIndex: 1
  },
  {
    text: "Где хранится состояние комнат в этом MVP?",
    options: ["В PostgreSQL", "В Redis", "В памяти сервера", "В Telegram"],
    correctIndex: 2
  },
  {
    text: "Сколько вариантов ответа показывается в каждом вопросе?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2
  }
];
