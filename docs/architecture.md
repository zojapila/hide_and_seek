# Hide & Seek — Architektura systemu

## Przegląd

Aplikacja mobilna do rozbudowanej zabawy w chowanego w mieście. Architektura oparta o **monorepo** z jednym codebase'em na frontend (React Native/Expo) i backend (Node.js/TypeScript).

---

## Diagram wysokopoziomowy

```
┌─────────────────────────────────────────────────────┐
│                   KLIENCI (Expo)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │   iOS     │  │ Android  │  │  Web (opcjonalne) │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       └──────────────┼─────────────────┘             │
│                      │                               │
│              HTTP REST + WebSocket                   │
└──────────────────────┼───────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────┐
│                  BACKEND (Fastify + Socket.IO)       │
│                      │                               │
│  ┌───────────────────┼────────────────────────────┐  │
│  │             API Gateway / Router               │  │
│  ├────────────┬──────┴─────┬──────────┬───────────┤  │
│  │  Game      │  Location  │  Chat    │  Cards    │  │
│  │  Service   │  Service   │  Service │  Service  │  │
│  └─────┬──────┴──────┬─────┴────┬─────┴─────┬────┘  │
│        │             │          │            │       │
│  ┌─────┴─────────────┴──────────┴────────────┴───┐   │
│  │          PostgreSQL + PostGIS                 │   │
│  └───────────────────────────────────────────────┘   │
│                      │                               │
│  ┌───────────────────┴───────────────────────────┐   │
│  │          MinIO (S3-compatible storage)         │   │
│  │          — zdjęcia z chatu                     │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
                       │
               ┌───────┴────────┐
               │  Overpass API  │
               │  (OSM data)   │
               └────────────────┘
```

---

## Struktura monorepo

```
hide_and_seek/
├── apps/
│   ├── mobile/                 # Expo (React Native)
│   │   ├── app/                # Expo Router (file-based routing)
│   │   │   ├── (auth)/         # ekrany przed grą
│   │   │   │   ├── index.tsx           # ekran główny / tworzenie gry
│   │   │   │   └── join.tsx            # dołączanie do gry
│   │   │   ├── (game)/         # ekrany w trakcie gry
│   │   │   │   ├── _layout.tsx         # layout gry (timer, nawigacja)
│   │   │   │   ├── map.tsx             # widok mapy
│   │   │   │   ├── chat.tsx            # komunikator
│   │   │   │   ├── questions.tsx       # pytania (szukający)
│   │   │   │   ├── cards.tsx           # talii kart (chowający)
│   │   │   │   └── curses.tsx          # klątwy
│   │   │   └── _layout.tsx     # root layout
│   │   ├── components/
│   │   │   ├── map/
│   │   │   │   ├── GameMap.tsx         # główna mapa
│   │   │   │   ├── StopMarker.tsx      # marker przystanku
│   │   │   │   ├── GeofenceOverlay.tsx # wizualizacja geofence
│   │   │   │   ├── PlayerMarker.tsx    # marker gracza
│   │   │   │   └── AreaDrawer.tsx      # rysowanie polygonów
│   │   │   ├── chat/
│   │   │   │   ├── ChatBubble.tsx
│   │   │   │   ├── ImageMessage.tsx
│   │   │   │   └── CurseAlert.tsx
│   │   │   ├── game/
│   │   │   │   ├── Timer.tsx
│   │   │   │   ├── CurseTimer.tsx
│   │   │   │   ├── QuestionPicker.tsx
│   │   │   │   └── CardDeck.tsx
│   │   │   └── ui/                     # reużywalne komponenty UI
│   │   ├── hooks/
│   │   │   ├── useLocation.ts
│   │   │   ├── useSocket.ts
│   │   │   ├── useGameState.ts
│   │   │   └── useGeofence.ts
│   │   ├── services/
│   │   │   ├── api.ts                  # HTTP client (REST)
│   │   │   ├── socket.ts              # Socket.IO client
│   │   │   └── overpass.ts            # zapytania Overpass API
│   │   ├── stores/
│   │   │   ├── gameStore.ts           # Zustand — stan gry
│   │   │   ├── locationStore.ts       # Zustand — lokalizacja
│   │   │   └── chatStore.ts           # Zustand — wiadomości
│   │   ├── utils/
│   │   │   ├── geo.ts                 # Turf.js helpers
│   │   │   └── constants.ts
│   │   ├── app.json
│   │   ├── eas.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── server/                 # Backend Node.js
│       ├── src/
│       │   ├── index.ts                # entry point
│       │   ├── config.ts              # env config
│       │   ├── routes/
│       │   │   ├── game.ts            # CRUD gier, dołączanie
│       │   │   ├── questions.ts       # baza pytań
│       │   │   └── upload.ts          # upload zdjęć
│       │   ├── services/
│       │   │   ├── gameService.ts     # logika gry
│       │   │   ├── locationService.ts # geofencing, odległości
│       │   │   ├── chatService.ts     # wiadomości
│       │   │   ├── cardService.ts     # talia, klątwy, bonusy
│       │   │   └── overpassService.ts # cache przystanków
│       │   ├── socket/
│       │   │   ├── index.ts           # Socket.IO setup
│       │   │   ├── handlers/
│       │   │   │   ├── gameHandler.ts
│       │   │   │   ├── locationHandler.ts
│       │   │   │   ├── chatHandler.ts
│       │   │   │   └── curseHandler.ts
│       │   │   └── middleware.ts       # auth socket middleware
│       │   ├── db/
│       │   │   ├── client.ts          # połączenie PG
│       │   │   ├── migrations/        # migracje SQL
│       │   │   └── seed/              # dane startowe (pytania, klątwy)
│       │   ├── models/
│       │   │   ├── game.ts
│       │   │   ├── player.ts
│       │   │   ├── message.ts
│       │   │   ├── question.ts
│       │   │   ├── curse.ts
│       │   │   └── card.ts
│       │   └── utils/
│       │       ├── geo.ts             # PostGIS helpers
│       │       └── validators.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                 # Wspólne typy i stałe
│       ├── types/
│       │   ├── game.ts
│       │   ├── player.ts
│       │   ├── message.ts
│       │   ├── question.ts
│       │   └── curse.ts
│       ├── constants.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml      # PostgreSQL + PostGIS + MinIO
│   └── Dockerfile.server       # backend image
│
├── docs/
│   ├── architecture.md         # ten plik
│   └── api.md                  # dokumentacja API (potem)
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # lint + test + typecheck
│       └── deploy.yml          # deploy backendu
│
├── plan.md
├── package.json                # workspace root (npm workspaces)
├── turbo.json                  # Turborepo config
├── .gitignore
├── .env.example
└── README.md
```

---

## Model danych (PostgreSQL + PostGIS)

### Tabela: `games`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID (PK) | |
| code | VARCHAR(6) | kod dołączania |
| status | ENUM | `waiting`, `hiding`, `seeking`, `finished` |
| hide_time_minutes | INT | czas na chowanie (minuty) |
| geofence_radius_m | INT | promień geofence od przystanku |
| game_radius_m | INT | maks. odległość od startu |
| started_at | TIMESTAMPTZ | start fazy chowania |
| seeking_started_at | TIMESTAMPTZ | start fazy szukania |
| finished_at | TIMESTAMPTZ | |
| center_point | GEOGRAPHY(Point) | punkt centralny gry |
| created_at | TIMESTAMPTZ | |

### Tabela: `players`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID (PK) | |
| game_id | UUID (FK) | |
| name | VARCHAR | |
| role | ENUM | `hider`, `seeker` |
| current_location | GEOGRAPHY(Point) | ostatnia lokalizacja |
| chosen_stop_id | UUID (FK, nullable) | wybrany przystanek |
| location_updated_at | TIMESTAMPTZ | |

### Tabela: `stops` (cache przystanków)
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID (PK) | |
| game_id | UUID (FK) | |
| osm_id | BIGINT | ID z OpenStreetMap |
| name | VARCHAR | nazwa przystanku |
| location | GEOGRAPHY(Point) | |
| geofence | GEOGRAPHY(Polygon) | wygenerowany bufor |

### Tabela: `messages`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID (PK) | |
| game_id | UUID (FK) | |
| sender_id | UUID (FK) | |
| type | ENUM | `text`, `image`, `question`, `curse`, `system` |
| content | TEXT | treść lub URL zdjęcia |
| metadata | JSONB | dodatkowe dane (pytanie, klątwa) |
| created_at | TIMESTAMPTZ | |

### Tabela: `questions`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID (PK) | |
| category | ENUM | `matching`, `measuring`, `thermometer`, `radar`, `nearest_place`, `photo` |
| template | TEXT | szablon pytania z placeholderami |
| params | JSONB | wymagane parametry |

### Tabela: `curses`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID (PK) | |
| name | VARCHAR | |
| description | TEXT | |
| type | ENUM | `timed`, `task` |
| duration_seconds | INT (nullable) | dla klątw czasowych |

### Tabela: `active_curses`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID (PK) | |
| game_id | UUID (FK) | |
| curse_id | UUID (FK) | |
| target_player_id | UUID (FK) | na kogo rzucona |
| cast_by_player_id | UUID (FK) | kto rzucił |
| status | ENUM | `active`, `completed`, `expired` |
| expires_at | TIMESTAMPTZ (nullable) | |
| created_at | TIMESTAMPTZ | |

### Tabela: `card_decks`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID (PK) | |
| game_id | UUID (FK) | |
| player_id | UUID (FK) | chowający |
| card_type | ENUM | `curse`, `time_bonus` |
| card_ref_id | UUID (nullable) | ref do curse/bonus |
| status | ENUM | `in_deck`, `in_hand`, `played`, `discarded` |
| drawn_at | TIMESTAMPTZ (nullable) | |

### Tabela: `excluded_areas`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID (PK) | |
| game_id | UUID (FK) | |
| created_by_id | UUID (FK) | szukający |
| polygon | GEOGRAPHY(Polygon) | zaznaczony obszar |
| type | ENUM | `excluded`, `narrowed` |
| created_at | TIMESTAMPTZ | |

---

## Komunikacja w czasie rzeczywistym (Socket.IO)

### Namespace'y i eventy

```
/ (default namespace)
├── game:join            # dołączenie do pokoju
├── game:start           # start gry
├── game:phase_change    # zmiana fazy (hiding → seeking → finished)
│
├── location:update      # gracz wysyła swoją lokalizację  (co 3-5s)
├── location:seekers     # broadcast lokalizacji szukających → chowającym
├── location:geofence_warning  # ostrzeżenie o zbliżaniu do granicy
│
├── chat:message         # nowa wiadomość
├── chat:image           # wiadomość ze zdjęciem
│
├── question:ask         # szukający zadaje pytanie
├── question:answer      # odpowiedź (auto lub manualna)
│
├── curse:cast           # chowający rzuca klątwę
├── curse:expired        # klątwa wygasła
├── curse:completed      # klątwa anulowana (task wykonany)
│
├── cards:draw           # ciągnięcie kart z talii
├── cards:discard        # odrzucenie karty
│
└── timer:sync           # synchronizacja timera
```

---

## Przepływ gry — diagram sekwencji

```
Chowający                    Serwer                     Szukający
    │                           │                           │
    ├── twórz grę (code) ──────►│                           │
    │                           │◄── dołącz (code) ────────┤
    │                           │                           │
    ├── START (czas X min) ────►│── game:phase=hiding ─────►│
    │                           │   (pobierz przystanki     │
    │                           │    z Overpass API)         │
    │                           │                           │
    │  ... chowa się ...        │                           │
    │                           │                           │
    ├── wybierz przystanek ────►│                           │
    │   (lub auto po czasie)    │── generuj geofence ──►DB │
    │                           │                           │
    │                           │── game:phase=seeking ────►│
    │                           │                           │
    │                           │◄── question:ask ─────────┤
    │◄── question:forward ──────│                           │
    │── question:answer ───────►│── question:result ───────►│
    │                           │                           │
    │  (ciągnij karty)          │                           │
    │── curse:cast ────────────►│── curse:activate ────────►│
    │                           │                           │
    │◄── location:seekers ──────│◄── location:update ──────┤
    │   (widzi szukających)     │     (co 3-5s)            │
    │                           │                           │
    │  geofence_warning ◄───────│  (monitoruj pozycję)     │
    │                           │                           │
    │                           │── game:phase=finished ───►│
```

---

## Kluczowe decyzje architektoniczne

1. **Monorepo z Turborepo** — jeden `npm install`, cache buildów, łatwe współdzielenie typów.

2. **Expo Router (file-based routing)** — nawigacja oparta na plikach, ułatwia zarządzanie ekranami.

3. **Zustand (state management)** — lekki, prosty, dobrze współgra z Socket.IO (aktualizacje w storze z eventów).

4. **PostGIS do obliczeń geo** — obliczenia odległości i geofencing na serwerze (precyzja, bezpieczeństwo). Turf.js tylko do wizualizacji na kliencie.

5. **Socket.IO rooms** — każda gra = 1 room. Ułatwia broadcast eventów do graczy tej samej gry.

6. **Cache przystanków per gra** — przystanki pobierane z Overpass API raz na start gry i zapisywane w DB. Unikamy wielokrotnych zapytań do zewnętrznego API.

7. **Brak pełnej rejestracji** — gracz podaje imię i dołącza kodem. Sesja trzymana w pamięci + localStorage. Wystarczające dla grupy znajomych.
