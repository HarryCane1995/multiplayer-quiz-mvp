import type { PlayerSummary } from "@/lib/types";

type ScoreTableProps = {
  players: PlayerSummary[];
  title: string;
  currentPlayerId?: string | null;
  showAnswers?: boolean;
};

export function ScoreTable({ players, title, currentPlayerId, showAnswers = false }: ScoreTableProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="score-table-wrap">
        <table className="score-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Игрок</th>
              <th>Очки</th>
              {showAnswers ? <th>Ответ</th> : null}
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={showAnswers ? 4 : 3}>Пока никого нет</td>
              </tr>
            ) : (
              players.map((player, index) => (
                <tr key={player.id} className={player.id === currentPlayerId ? "is-current-player" : undefined}>
                  <td>{index + 1}</td>
                  <td>
                    <span className="player-name">{player.name}</span>
                    <span className={player.connected ? "status-online" : "status-offline"}>
                      {player.connected ? "online" : "offline"}
                    </span>
                  </td>
                  <td>{player.score}</td>
                  {showAnswers ? (
                    <td>
                      {player.answered ? (
                        <span className={player.correct ? "answer-correct" : "answer-wrong"}>
                          {player.correct ? `+${player.points}` : "0"}
                        </span>
                      ) : (
                        "нет"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
