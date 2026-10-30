# Play Haven pro počítač

Malá aplikace (Electron), která:
- otevře Play Haven v samostatném okně (stránka /live),
- čte lokální API League klienta (fáze hry, champ select) a předává je webu,
- web podle toho ukáže scouting spoluhráčů, nepřátel a doporučení.

Aplikace jen čte data a nic nehraje za hráče. Okno se zavřením schová do lišty.

## Spuštění pro vývoj
```
cd desktop
npm install
npm start
```
Jiná adresa webu: `PLAYHAVEN_URL=http://localhost:3000 npm start`.

## Sestavení exe
`npm run dist:portable` vytvoří `dist/PlayHaven.exe` (jeden soubor, bez instalace).
`npm run dist` vytvoří navíc instalátor `PlayHaven-Setup.exe`. Na Windows se vloží i ikona.

Automatické sestavení na GitHubu: soubor `.github/workflows/desktop.yml`. Po vytvoření tagu `desktop-v1.0.0`
sestaví exe a přiloží ho k Release.
