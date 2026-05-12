import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import next from "next";
import { Server } from "socket.io";
import { QUESTIONS } from "./src/lib/questions";
import type { ClientRoomState, GamePhase, PlayerSummary } from "./src/lib/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();
const QUESTION_SECONDS = 20;

type PlayerRecord = {
  id: string;
  socketId: string;
  name: string;
  score: number;
  connected: boolean;
  joinedAt: number;
  answerIndex: number | null;
  answeredAt: number | null;
  answerOrder: number | null;
  correct: boolean | null;
  points: number;
};

type RoomRecord = {
  code: string;
  hostSocketId: string | null;
  hostConnected: boolean;
  phase: GamePhase;
  players: Map<string, PlayerRecord>;
  currentQuestionIndex: number;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  questionClosed: boolean;
  answerSequence: number;
  firstAnswerPlayerId: string | null;
  firstCorrectPlayerId: string | null;
  timer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
};

type HostCreateAck = (response: { ok: true; roomCode: string; state: ClientRoomState }) => void;
type HostActionAck = (response: { ok: boolean; message?: string; state?: ClientRoomState }) => void;
type PlayerJoinAck = (
  response:
    | { ok: true; playerId: string; state: ClientRoomState }
    | { ok: false; message: string }
) => void;
type PlayerAnswerAck = (response: { ok: boolean; message?: string; state?: ClientRoomState }) => void;

const rooms = new Map<string, RoomRecord>();

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    if (!rooms.has(code)) {
      return code;
    }
  }

  return `${Date.now()}`.slice(-6);
}

function makePlayerId() {
  return randomUUID();
}

function resetAnswers(room: RoomRecord) {
  room.answerSequence = 0;
  room.firstAnswerPlayerId = null;
  room.firstCorrectPlayerId = null;

  for (const player of room.players.values()) {
    player.answerIndex = null;
    player.answeredAt = null;
    player.answerOrder = null;
    player.correct = null;
    player.points = 0;
  }
}

function getActivePlayers(room: RoomRecord) {
  return Array.from(room.players.values()).filter((player) => player.connected);
}

function buildState(room: RoomRecord): ClientRoomState {
  const revealAnswers = room.phase !== "question" || room.questionClosed;
  const players: PlayerSummary[] = Array.from(room.players.values())
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      connected: player.connected,
      answered: player.answeredAt !== null,
      answerIndex: revealAnswers ? player.answerIndex : null,
      answerOrder: revealAnswers ? player.answerOrder : null,
      correct: revealAnswers ? player.correct : null,
      points: revealAnswers ? player.points : 0
    }));

  const leaderboard = [...players].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.name.localeCompare(b.name);
  });

  const currentQuestion = room.phase === "question" ? QUESTIONS[room.currentQuestionIndex] : null;
  const firstAnswer = room.firstAnswerPlayerId ? room.players.get(room.firstAnswerPlayerId) : null;
  const firstCorrect = room.firstCorrectPlayerId ? room.players.get(room.firstCorrectPlayerId) : null;

  return {
    code: room.code,
    phase: room.phase,
    players,
    leaderboard,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: QUESTIONS.length,
    question: currentQuestion
      ? {
          text: currentQuestion.text,
          options: currentQuestion.options,
          correctIndex: revealAnswers ? currentQuestion.correctIndex : null
        }
      : null,
    questionStartedAt: room.questionStartedAt,
    questionEndsAt: room.questionEndsAt,
    questionClosed: room.questionClosed,
    timeLimitSeconds: QUESTION_SECONDS,
    answeredCount: players.filter((player) => player.answered).length,
    activePlayerCount: getActivePlayers(room).length,
    hostConnected: room.hostConnected,
    firstAnswerPlayerId: room.firstAnswerPlayerId,
    firstAnswerName: firstAnswer?.name ?? null,
    firstCorrectPlayerId: room.firstCorrectPlayerId,
    firstCorrectName: firstCorrect?.name ?? null
  };
}

function emitState(io: Server, room: RoomRecord) {
  io.to(room.code).emit("room:update", buildState(room));
}

function closeQuestion(room: RoomRecord) {
  if (room.questionClosed) {
    return;
  }

  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }

  room.questionClosed = true;
  room.questionEndsAt = Date.now();
}

function startQuestion(io: Server, room: RoomRecord, questionIndex: number) {
  if (room.timer) {
    clearTimeout(room.timer);
  }

  resetAnswers(room);
  room.phase = "question";
  room.currentQuestionIndex = questionIndex;
  room.questionStartedAt = Date.now();
  room.questionEndsAt = room.questionStartedAt + QUESTION_SECONDS * 1000;
  room.questionClosed = false;
  room.timer = setTimeout(() => {
    closeQuestion(room);
    emitState(io, room);
  }, QUESTION_SECONDS * 1000);

  emitState(io, room);
}

function moveToResults(io: Server, room: RoomRecord) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }

  room.phase = "results";
  room.questionClosed = true;
  room.questionStartedAt = null;
  room.questionEndsAt = null;
  emitState(io, room);
}

function normalizeRoomCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    socket.on("host:create", (ack?: HostCreateAck) => {
      const code = makeRoomCode();
      const room: RoomRecord = {
        code,
        hostSocketId: socket.id,
        hostConnected: true,
        phase: "lobby",
        players: new Map(),
        currentQuestionIndex: 0,
        questionStartedAt: null,
        questionEndsAt: null,
        questionClosed: false,
        answerSequence: 0,
        firstAnswerPlayerId: null,
        firstCorrectPlayerId: null,
        timer: null,
        createdAt: Date.now()
      };

      rooms.set(code, room);
      socket.join(code);
      socket.data.role = "host";
      socket.data.roomCode = code;

      ack?.({ ok: true, roomCode: code, state: buildState(room) });
    });

    socket.on("host:start", (payload: { roomCode?: string }, ack?: HostActionAck) => {
      const room = rooms.get(normalizeRoomCode(payload?.roomCode));
      if (!room || room.hostSocketId !== socket.id) {
        ack?.({ ok: false, message: "Комната не найдена" });
        return;
      }

      if (room.phase !== "lobby") {
        ack?.({ ok: false, message: "Игра уже запущена", state: buildState(room) });
        return;
      }

      if (getActivePlayers(room).length === 0) {
        ack?.({ ok: false, message: "Нужен хотя бы один игрок", state: buildState(room) });
        return;
      }

      startQuestion(io, room, 0);
      ack?.({ ok: true, state: buildState(room) });
    });

    socket.on("host:next", (payload: { roomCode?: string }, ack?: HostActionAck) => {
      const room = rooms.get(normalizeRoomCode(payload?.roomCode));
      if (!room || room.hostSocketId !== socket.id) {
        ack?.({ ok: false, message: "Комната не найдена" });
        return;
      }

      if (room.phase !== "question" || !room.questionClosed) {
        ack?.({ ok: false, message: "Следующий вопрос доступен после завершения текущего", state: buildState(room) });
        return;
      }

      if (room.currentQuestionIndex >= QUESTIONS.length - 1) {
        moveToResults(io, room);
        ack?.({ ok: true, state: buildState(room) });
        return;
      }

      startQuestion(io, room, room.currentQuestionIndex + 1);
      ack?.({ ok: true, state: buildState(room) });
    });

    socket.on("player:join", (payload: { roomCode?: string; name?: string }, ack?: PlayerJoinAck) => {
      const code = normalizeRoomCode(payload?.roomCode);
      const name = String(payload?.name ?? "").trim().slice(0, 24);
      const room = rooms.get(code);

      if (!room) {
        ack?.({ ok: false, message: "Комната не найдена" });
        return;
      }

      if (room.phase !== "lobby") {
        ack?.({ ok: false, message: "Игра уже началась" });
        return;
      }

      if (!name) {
        ack?.({ ok: false, message: "Введите никнейм" });
        return;
      }

      const player: PlayerRecord = {
        id: makePlayerId(),
        socketId: socket.id,
        name,
        score: 0,
        connected: true,
        joinedAt: Date.now(),
        answerIndex: null,
        answeredAt: null,
        answerOrder: null,
        correct: null,
        points: 0
      };

      room.players.set(player.id, player);
      socket.join(code);
      socket.data.role = "player";
      socket.data.roomCode = code;
      socket.data.playerId = player.id;

      const state = buildState(room);
      ack?.({ ok: true, playerId: player.id, state });
      emitState(io, room);
    });

    socket.on("player:answer", (payload: { roomCode?: string; playerId?: string; index?: number }, ack?: PlayerAnswerAck) => {
      const room = rooms.get(normalizeRoomCode(payload?.roomCode));
      const playerId = String(payload?.playerId ?? "");
      const index = Number(payload?.index);
      const question = room?.phase === "question" ? QUESTIONS[room.currentQuestionIndex] : null;
      const player = room?.players.get(playerId);

      if (!room || !question || !player) {
        ack?.({ ok: false, message: "Ответ не принят" });
        return;
      }

      if (room.questionClosed) {
        ack?.({ ok: false, message: "Вопрос уже завершен", state: buildState(room) });
        return;
      }

      if (!Number.isInteger(index) || index < 0 || index >= question.options.length) {
        ack?.({ ok: false, message: "Некорректный вариант ответа", state: buildState(room) });
        return;
      }

      if (player.answeredAt !== null) {
        ack?.({ ok: true, state: buildState(room) });
        return;
      }

      room.answerSequence += 1;
      player.answerIndex = index;
      player.answeredAt = Date.now();
      player.answerOrder = room.answerSequence;
      player.correct = index === question.correctIndex;
      room.firstAnswerPlayerId ??= player.id;

      if (player.correct) {
        player.points = room.firstCorrectPlayerId ? 500 : 1000;
        room.firstCorrectPlayerId ??= player.id;
        player.score += player.points;
      }

      const activePlayers = getActivePlayers(room);
      if (activePlayers.length > 0 && activePlayers.every((activePlayer) => activePlayer.answeredAt !== null)) {
        closeQuestion(room);
      }

      emitState(io, room);
      ack?.({ ok: true, state: buildState(room) });
    });

    socket.on("disconnect", () => {
      const code = String(socket.data.roomCode ?? "");
      const room = rooms.get(code);

      if (!room) {
        return;
      }

      if (socket.data.role === "host" && room.hostSocketId === socket.id) {
        room.hostConnected = false;
        room.hostSocketId = null;
      }

      if (socket.data.role === "player") {
        const player = room.players.get(String(socket.data.playerId ?? ""));
        if (player) {
          player.connected = false;
          player.socketId = "";
        }
      }

      emitState(io, room);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`Quiz MVP ready on http://${hostname}:${port}`);
  });
});
