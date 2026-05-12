export type GamePhase = "lobby" | "question" | "results";

export type Question = {
  text: string;
  options: string[];
  correctIndex: number;
};

export type PublicQuestion = {
  text: string;
  options: string[];
  correctIndex: number | null;
};

export type PlayerSummary = {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  answered: boolean;
  answerIndex: number | null;
  answerOrder: number | null;
  correct: boolean | null;
  points: number;
};

export type ClientRoomState = {
  code: string;
  phase: GamePhase;
  players: PlayerSummary[];
  leaderboard: PlayerSummary[];
  currentQuestionIndex: number;
  totalQuestions: number;
  question: PublicQuestion | null;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  questionClosed: boolean;
  timeLimitSeconds: number;
  answeredCount: number;
  activePlayerCount: number;
  hostConnected: boolean;
  firstAnswerPlayerId: string | null;
  firstAnswerName: string | null;
  firstCorrectPlayerId: string | null;
  firstCorrectName: string | null;
};
