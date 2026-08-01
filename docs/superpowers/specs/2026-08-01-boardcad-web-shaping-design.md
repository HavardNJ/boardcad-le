# BoardCAD Web – Shaping-Teil (ohne CAM)

Datum: 2026-08-01
Status: Approved (Design), Implementierungsplan steht aus

## Kontext

BoardCAD LE ist ein bestehendes Java-Swing-Desktop-Tool zum Design von Surfboards
(CAD) inkl. CNC-Fräsbahn-Generierung (CAM). Für dieses Projekt wird geprüft, den
Design-Teil (Shaping) als eigenständige Web-App neu zu bauen. Der CAM-Teil
(Toolpath-Generierung, Kollisionserkennung, Spannvorrichtungen, Java3D/JOGL-Fräsbahn-
Rendering) wird komplett ausgeklammert – dort gibt es im bestehenden Code keine
Abstraktionsschicht, Fachlogik und Rendering sind eng verdrahtet (`Machine3DView`
wird direkt aus der Toolpath-Generierung heraus bespielt).

Der 2D-Zeichenteil des bestehenden Codes ist dagegen bereits gut vorbereitet: die
Klasse `AbstractDraw` (`src/boardcad/AbstractDraw.java`) abstrahiert Zeichen-
operationen (`draw`, `fill`, `setColor`, `transform` …) und wird von sechs
unterschiedlichen Backends genutzt (Bildschirm, DXF-Export, PDF-Export, G-Code-
Export, Druckvorlagen) – der Code enthält sogar einen expliziten Kommentar, der
Portabilität zu GWT/Android als Ziel nennt. Ebenso vorhanden: ein Command-Pattern
mit Undo/Redo-History (`BrdCommandHistory`) und properties-basierte i18n.

## Ziel & Scope

Ein rein clientseitiges, persönliches Web-Tool (Einzelnutzer, kein Auth, kein
Backend) für den Design-Teil von BoardCAD LE:

- Outline (Umriss von oben)
- Cross-Sections (Querschnitte)
- Rocker/Profilkurve
- Bezier-Kurvenanpassung zwischen den Kurven
- 3D-Board-Vorschau (Surface-Model, gerendert mit Three.js)

**Nicht im Scope:** CAM/Toolpath-Generierung, Kollisionserkennung, Spann-
vorrichtungen (holdingsystems), Maschinenkonfiguration.

**Nicht im Scope (Entscheidung):** Kompatibilität mit bestehenden `.brd`-Dateien.
Die Web-App bekommt ein eigenes, neues JSON-Speicherformat. Alte `.brd`-Dateien
bleiben nur im Desktop-Tool nutzbar.

**Hosting:** nur lokal (`npm run dev`), kein Deployment in dieser Phase.

## Architektur

```
src/
  core/                 (reines TypeScript, keine React-/DOM-Abhängigkeit)
    board/               Board-Modell: Outline, Cross-Sections, Rocker, Metadaten
    bezier/              BezierCurve, BezierSpline, BezierFit, BezierKnot (Port von cadcore)
    surface/             Surface-Model: kombiniert Kurven zu 3D-Mesh (Vertex-/Index-Buffer)
    commands/            Command-Pattern + History (Port von BrdCommand/BrdCommandHistory)
  app/                  (React + TypeScript + Three.js)
    editor2d/            Canvas-Editor für Outline/Cross-Section/Rocker
    viewer3d/            react-three-fiber-Szene, konsumiert das Surface-Mesh
    state/               React-Hook/Context, bindet core-BoardCommandHistory an die UI
    dialogs/             Board-Settings-Formulare (Dimensionen etc.)
```

`core` bleibt bewusst UI-unabhängig und pur testbar – das spiegelt die bestehende
Trennung von `cadcore`/`board` (Fachlogik) und `boardcad.gui` (UI) im Java-Code
und war einer der Gründe, warum der 2D-Teil sich überhaupt gut portieren lässt.

**Frontend-Stack:** React + TypeScript, Three.js über `react-three-fiber` für die
3D-Vorschau, HTML Canvas (oder SVG) für den 2D-Kurveneditor.

## Komponenten

### core/board
Datenmodell eines Boards: Outline-Kurve, N Cross-Sections, Rocker-Kurve, Meta-
daten (Länge, Breite, Dicke, Name). Entspricht grob `AbstractBoard`/`BezierBoard`,
aber ohne die dort vermischten AWT/vecmath-Typen – reine TS-Werttypen.

### core/bezier
Direkter Port der Bezier-Mathematik aus `cadcore` (`BezierCurve`, `BezierSpline`,
`BezierFit`, `BezierKnot`, `BezierUtil`, `MathUtils`). Diese Klassen sind im Java-
Code bereits weitgehend reine Geometrie (Point2D/vecmath als Werttypen), der Port
ist mechanisch.

### core/surface
Port der Surface-Model-Logik (`BezierBoardControlPointInterpolationSurfaceModel`
u. Ä.), die aus Outline + Cross-Sections + Rocker eine 3D-Oberfläche erzeugt.
Ausgabe: Vertex-/Index-Buffer, die direkt in eine `Three.js BufferGeometry`
geladen werden können.

### core/commands
Port von `BrdCommand`/`BrdCommandHistory`: Commands für Control-Point-Bewegung,
Kurve hinzufügen/entfernen, etc. Bildet Undo/Redo als lineare History mit
aktuellem Index ab, wie im Original.

### app/editor2d
Canvas-basierter Editor für Outline, Cross-Sections und Rocker: Control Points
ziehen, hinzufügen, entfernen. Löst `AbstractDraw`/`JavaDraw`/`BezierBoardDrawUtil`
ab; die Draw-Operationen (Linie, Kurve, Transform) sind vom bestehenden
`AbstractDraw`-Interface her bekannt und dienen als Referenz für die neue
Canvas-Implementierung.

### app/viewer3d
`react-three-fiber`-Szene, die das vom `core/surface`-Modell erzeugte Mesh
rendert, mit Orbit-Controls. Vereinfachte Variante von `Machine3DView`/
`ThreeDView` – ohne Maschinen-/Cutter-Overlay, da CAM entfällt.

### app/state
React-Hook/Context, der eine `core`-`BoardCommandHistory`-Instanz kapselt und
`board`-State + `dispatch(command)` an Komponenten liefert. Keyboard-Shortcuts
für Undo/Redo (Cmd/Ctrl+Z / Shift+Cmd/Ctrl+Z).

### app/dialogs
Minimale Formulare für Board-Metadaten (Name, Dimensionen) – reduzierter
Ausschnitt der ~140 Swing-Dialoge im Original, nur was für Shaping relevant ist.

## Datenfluss

1. Nutzer verschiebt einen Control Point im 2D-Canvas.
2. `app/editor2d` erzeugt ein `MoveControlPointCommand` und ruft `dispatch()`.
3. `core/commands` wendet das Command auf das `core/board`-Modell an und legt es
   in der History ab.
4. `core/surface` berechnet das 3D-Mesh neu (derived/memoized aus dem Board-
   Modell).
5. `app/viewer3d` rendert das aktualisierte Mesh.
6. Undo/Redo laufen über dieselbe History rückwärts/vorwärts.

## Persistenz

- **Speichern:** Board-Modell (Control Points, Kurvengrad, Metadaten) wird zu
  JSON serialisiert und als Datei-Download angeboten.
- **Laden:** File-Input liest JSON, validiert Struktur, ersetzt das aktuelle
  Board-Modell.
- **Autosave:** Das aktuelle Board wird zusätzlich fortlaufend in `localStorage`
  gesichert, damit ein Tab-Reload keine Arbeit verliert. Explizites Speichern
  bleibt für benannte/exportierte Stände nötig.

## Error Handling

- Ungültiges oder beschädigtes JSON beim Laden → Fehlermeldung im UI, aktuelles
  Board bleibt unverändert.
- Degenerierte Kurven (zu wenige Control Points für ein gültiges Surface-Model)
  → Validierung vor Anwenden der Änderung, analog zu bestehenden Constraints in
  `BezierFit`.
- Kein Netzwerk/Backend vorhanden → keine Netzwerkfehlerbehandlung nötig.

## Testing

- `core`: Unit-Tests (Vitest) für Bezier-Mathematik, Surface-Generierung und
  Undo/Redo-Commands. Wo möglich gegen bekannte Werte/Verhalten aus
  `BezierFit`/`BezierUtil` im Java-Original gegengeprüft.
- `app`: Manuelles Testen im Browser reicht für den Start (Einzelnutzer-Tool,
  kein CI-Zwang). Komponententests optional, kein Muss für v1.

## Out of Scope (explizit)

- CAM/Toolpath-Generierung, Kollisionserkennung, Spannvorrichtungen
- Java3D/JOGL-Maschinenansicht
- `.brd`-Dateikompatibilität
- Mehrbenutzerfähigkeit, Auth, Hosting/Deployment
