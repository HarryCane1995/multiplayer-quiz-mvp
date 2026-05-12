"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import type { ClientRoomState } from "@/lib/types";
import { ScoreTable } from "./ScoreTable";
import { Timer } from "./Timer";

export function PlayerGame() {
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<ClientRoomState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const handleUpdate = (nextState: ClientRoomState) => {
      setState(nextState);
      setError(null);
    };

    socket.on("room:update", handleUpdate);
    return () => {
      socket.off("room:update", handleUpdate);
    };
  }, []);

  useEffect(() => {
    setSelectedIndex(null);
  }, [state?.currentQuestionIndex]);

  const me = useMemo(() => state?.players.find((player) => player.id === playerId) ?? null, [playerId, state]);
  const hasAnswered = Boolean(me?.answered) || selectedIndex !== null;
  const questionNumber = state ? state.currentQuestionIndex + 1 : 1;

  function joinGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    getSocket().emit(
      "player:join",
      { roomCode, name },
      (response: { ok: true; playerId: string; state: ClientRoomState } | { ok: false; message: string }) => {
        if (!response.ok) {
          setError(response.message);
          return;
        }

        setPlayerId(response.playerId);
        setState(response.state);
      }
    );
  }

  function answer(index: number) {
    if (!state || !playerId || hasAnswered) {
      return;
    }

    setSelectedIndex(index);
    getSocket().emit(
      "player:answer",
      { roomCode: state.code, playerId, index },
      (response: { ok: boolean; message?: string }) => {
        if (!response.ok) {
          setSelectedIndex(null);
          setError(response.message ?? "Ответ не принят");
        }
      }
    );
  }

  if (!playerId || !state) {
    return (
      <main className="app-shell compact-shell">
        <section className="top-bar">
          <Link href="/" className="ghost-link">
            На главную
          </Link>
        </section>
        <section className="panel join-panel">
          <p className="eyebrow">Игрок</p>
          <h1>Присоединиться</h1>
          <form className="join-form" onSubmit={joinGame}>
            <label>
              Код комнаты
              <input
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
                }
                placeholder="ABC123"
                minLength={6}
                maxLength={6}
                required
              />
            </label>
            <label>
              Никнейм
              <input
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 24))}
                placeholder="Анна"
                minLength={1}
                maxLength={24}
                required
              />
            </label>
            {error ? <p className="notice error">{error}</p> : null}
            <button className="primary-button" type="submit">
              Войти в лобби
            </button>
          </form>
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
            <p className="eyebrow">Лобби игрока</p>
            <h1>{me?.name}</h1>
            <p className="muted">Ожидание старта</p>
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>Игроки</h2>
              <span>{state.players.length}</span>
            </div>
            <ul className="player-list">
              {state.players.map((player) => (
                <li key={player.id} className={player.id === playerId ? "is-current-player" : undefined}>
                  <span>{player.name}</span>
                  <span className={player.connected ? "status-online" : "status-offline"}>
                    {player.connected ? "online" : "offline"}
                  </span>
                </li>
              ))}
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
              <span>{hasAnswered ? "ответ принят" : "выбор ответа"}</span>
            </div>
            <Timer endsAt={state.questionEndsAt} limitSeconds={state.timeLimitSeconds} closed={state.questionClosed} />
            <h1 className="question-title">{state.question.text}</h1>
            <div className="option-grid">
              {state.question.options.map((option, index) => {
                const isSelected = selectedIndex === index;
                const isCorrect = state.questionClosed && index === state.question?.correctIndex;
                const isWrongSelected = state.questionClosed && isSelected && !isCorrect;

                return (
                  <button
                    key={option}
                    className={[
                      "answer-button",
                      isSelected ? "selected-answer" : "",
                      isCorrect ? "correct-option" : "",
                      isWrongSelected ? "wrong-option" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    type="button"
                    onClick={() => answer(index)}
                    disabled={hasAnswered || state.questionClosed}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    <strong>{option}</strong>
                  </button>
                );
              })}
            </div>
            {state.questionClosed ? (
              <p className="notice success">
                Правильный ответ: {state.question.options[state.question.correctIndex ?? 0]}
              </p>
            ) : null}
          </section>

          <ScoreTable
            title="Таблица очков"
            players={state.leaderboard}
            currentPlayerId={playerId}
            showAnswers={state.questionClosed}
          />
        </section>
      ) : null}

      {state.phase === "results" ? (
        <section className="layout-two">
          <section className="panel hero-panel">
            <p className="eyebrow">Финал</p>
            <h1>{me?.name}</h1>
            <p className="muted">Ваш счет: {me?.score ?? 0}</p>
          </section>
          <ScoreTable title="Результаты" players={state.leaderboard} currentPlayerId={playerId} />
        </section>
      ) : null}
    </main>
  );
}
