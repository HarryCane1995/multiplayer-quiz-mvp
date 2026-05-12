"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import type { ClientRoomState } from "@/lib/types";
import { ScoreTable } from "./ScoreTable";
import { Timer } from "./Timer";

export function HostGame() {
  const [state, setState] = useState<ClientRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createdRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    const handleUpdate = (nextState: ClientRoomState) => {
      setState(nextState);
      setError(null);
    };

    socket.on("room:update", handleUpdate);

    if (!createdRef.current) {
      createdRef.current = true;
      socket.emit("host:create", (response: { ok: true; roomCode: string; state: ClientRoomState }) => {
        setState(response.state);
      });
    }

    return () => {
      socket.off("room:update", handleUpdate);
    };
  }, []);

  const activePlayers = useMemo(() => state?.players.filter((player) => player.connected) ?? [], [state]);
  const isLastQuestion = state ? state.currentQuestionIndex >= state.totalQuestions - 1 : false;
  const questionNumber = state ? state.currentQuestionIndex + 1 : 1;

  function startGame() {
    if (!state) {
      return;
    }

    getSocket().emit("host:start", { roomCode: state.code }, (response: { ok: boolean; message?: string }) => {
      if (!response.ok) {
        setError(response.message ?? "Не удалось начать игру");
      }
    });
  }

  function nextQuestion() {
    if (!state) {
      return;
    }

    getSocket().emit("host:next", { roomCode: state.code }, (response: { ok: boolean; message?: string }) => {
      if (!response.ok) {
        setError(response.message ?? "Не удалось перейти дальше");
      }
    });
  }

  if (!state) {
    return (
      <main className="app-shell">
        <section className="panel hero-panel">
          <p className="eyebrow">Хост</p>
          <h1>Создаем комнату...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="top-bar">
        <Link href="/" className="ghost-link">
          На главную
        </Link>
        <div className="room-code-box">
          <span>Код комнаты</span>
          <strong>{state.code}</strong>
        </div>
      </section>

      {error ? <p className="notice error">{error}</p> : null}

      {state.phase === "lobby" ? (
        <section className="layout-two">
          <section className="panel hero-panel">
            <p className="eyebrow">Лобби хоста</p>
            <h1>Игроки подключаются</h1>
            <p className="muted">Активных игроков: {activePlayers.length}</p>
            <button className="primary-button" type="button" onClick={startGame} disabled={activePlayers.length === 0}>
              Начать игру
            </button>
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Игроки</h2>
              <span>{state.players.length}</span>
            </div>
            <ul className="player-list">
              {state.players.length === 0 ? (
                <li className="empty-row">Пока никого нет</li>
              ) : (
                state.players.map((player) => (
                  <li key={player.id}>
                    <span>{player.name}</span>
                    <span className={player.connected ? "status-online" : "status-offline"}>
                      {player.connected ? "online" : "offline"}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </section>
      ) : null}

      {state.phase === "question" && state.question ? (
        <section className="game-grid">
          <section className="panel question-panel">
            <div className="section-heading">
              <h2>
                Вопрос {questionNumber} из {state.totalQuestions}
              </h2>
              <span>
                {state.answeredCount}/{state.activePlayerCount}
              </span>
            </div>
            <Timer endsAt={state.questionEndsAt} limitSeconds={state.timeLimitSeconds} closed={state.questionClosed} />
            <h1 className="question-title">{state.question.text}</h1>
            <div className="option-grid">
              {state.question.options.map((option, index) => {
                const isCorrect = state.questionClosed && index === state.question?.correctIndex;
                return (
                  <div key={option} className={isCorrect ? "option-card correct-option" : "option-card"}>
                    <span>{String.fromCharCode(65 + index)}</span>
                    <strong>{option}</strong>
                  </div>
                );
              })}
            </div>
            <div className="round-meta">
              <span>Первый ответ: {state.firstAnswerName ?? "еще нет"}</span>
              <span>Первый правильный: {state.firstCorrectName ?? "еще нет"}</span>
            </div>
            <button className="primary-button" type="button" onClick={nextQuestion} disabled={!state.questionClosed}>
              {isLastQuestion ? "Показать результаты" : "Следующий вопрос"}
            </button>
          </section>

          <ScoreTable
            title={state.questionClosed ? "Раунд завершен" : "Таблица очков"}
            players={state.leaderboard}
            showAnswers={state.questionClosed}
          />
        </section>
      ) : null}

      {state.phase === "results" ? (
        <section className="layout-two">
          <section className="panel hero-panel">
            <p className="eyebrow">Финал</p>
            <h1>Итоговая таблица</h1>
            <Link href="/host" className="primary-link">
              Новая игра
            </Link>
          </section>
          <ScoreTable title="Результаты" players={state.leaderboard} />
        </section>
      ) : null}
    </main>
  );
}
