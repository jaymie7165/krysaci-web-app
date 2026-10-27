export default function GameSelect({
  games,
  name = "gameId",
}: {
  games: { id: string; name: string }[];
  name?: string;
}) {
  return (
    <select name={name} required className="input">
      {games.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
