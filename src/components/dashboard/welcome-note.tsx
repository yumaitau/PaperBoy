export function WelcomeNote({ organizationName }: { organizationName: string }) {
  return (
    <section className="welcome-note" aria-labelledby="welcome-note-title">
      <h2 id="welcome-note-title">{organizationName}</h2>
      <p>Email delivery and engagement at a glance.</p>
    </section>
  );
}
