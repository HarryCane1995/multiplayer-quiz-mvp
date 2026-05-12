import Link from "next/link";

export default function Home() {
  return (
    <main className="home-shell">
      <section className="panel home-panel">
        <p className="eyebrow">Multiplayer Quiz</p>
        <h1>Локальная квиз-комната</h1>
        <div className="home-actions">
          <Link href="/host" className="primary-link">
            Создать игру
          </Link>
          <Link href="/join" className="secondary-link">
            Присоединиться
          </Link>
        </div>
      </section>
    </main>
  );
}
