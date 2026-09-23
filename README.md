# Rechenfit

Kopfrechnen üben im Browser – zehn Aufgaben pro Runde, frei wählbare Rechenarten und Schwierigkeit.

**Live:** [sweetnordic.github.io/rechenfit](https://sweetnordic.github.io/rechenfit/)

## Datenschutz

Kein Backend, keine Analytics, keine Cookies. Einstellungen, Spielstand und Statistik liegen nur in `localStorage` auf dem Gerät des Nutzers.

## Lokale Entwicklung

ES-Module brauchen einen lokalen HTTP-Server:

```bash
npx serve public
```

Dann [http://localhost:3000](http://localhost:3000) öffnen.

## Veröffentlichung

Push auf `main` deployt den Ordner `public/` per GitHub Actions auf GitHub Pages. In den Repository-Einstellungen muss **Pages → Source: GitHub Actions** aktiv sein.

## Herkunft

Abgeleitet vom Spiel **Kopfrechnen** in [Denkspiele](https://github.com/sweetnordic/denkspiele) (privates Homelab-Repo). Rechenfit ist als eigenständige, edugo-taugliche Variante ohne Tracking und ohne Plattform-Kopplung gedacht.

## Lizenz

MIT – siehe [LICENSE](LICENSE).
