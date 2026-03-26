Planuję implementację aplikacji do rozbudowanej zabawy w chowanego w mieście. powinny być dwa profile uzytkownika - chowajacy i szukajacy.

Aplikacja ma byc dostepna zarówno na androida jak i iosa, wiec zalezy mi na tym zeby było to w jakimś języku ktory pogodzi obie te platformy. 

aplikacja ma tez wykorzystywać openstreetmap bo zalezy mi na mapach - no chhyba ze za darmo do rozwiazan prywanych mozna uzywac google maps. 

dla chowającego sie przebieg zabawy wyglada następująco:
1. pobierana jest aktualna lokalizacja
2. klikniety zostaje przycisk start gra czy cos w tym stylu, gdzie ustawiamy czas który chowajacy ma na schowanie sie. 
3. chować mozna sie tylko w obrębie X metrów (predefiniowane przed grą) od przystanku tramwajowego lub autobusowego, takze fajnie by bylo gdyby mogly byc one zaznaczone na mapie. jesli jest ten sam przystanek o kilku nazwach to wybieramy po prostu centralny punkt. 
4. w ciągu tych 30 czy iles minut chowajacy musi juz byc na wybranym przez siebie przystanku i tam powinien zostac xaznaczony (przez chowajacego albo autpmatycznie po zakonczeniu czasu na chowanie) punkt oraz obszar X metrów od tego przystnaku jako geofence. jesli konczy sie czas a chowajacy znajduja sie w obrebie np. 3 roznych przystankow to powinno pojawic sie okno dialogowe do wyboru ktory przystanek cie interesuje.
5. w trakcie jak szukajacy beda ich szukac to moze on sie poruszac w obszarze tego fenca, ale chcialabym zeby bylo jakies ostrzezenie dzwiekowe lub powiadomioenie jesli zbliza sie on do granicy fenca.
6. chowający w miare w czasie rzeczywistym mają podgląd na lokalizacje szukających.
7. musi być jakis komunikator pomiedzy szukajacymi i chowającymi, poniewaz jest baza pytan, ktore mogą zadawac szukajacy, zeby zawezic obszar. 
8. powinna istniec baza "klątw" rzucanych na szukajacych po zadaniu przez nich pytania. klatwa ta powinna moc byc wyslana do szukajacych w prosty i przejrzysty spokoj.
9. komunikator musi pozwalac tez na wysylanie zdjęć. czesc klątw jest czasowych wiec powinien byc dla nich osobny timer, a czesc konczy sie np po wykonaniu jakiegos zadania wiec nalezaloby dodac jakis task czy cos, gdzie chowajacy moze anulowac klatwe po jej wykonaniu.


dla szukajacego natomiast:
1. po uplywie czasu na chowanie rozpoczyna sie proces poszukiwania. 
2. zawęza on obszar poszukiwan zadając pytania z bazy. mozna je podzielic na kategorie:
a) pytania w stylu Matching: Is your nearest _____ the same as my nearest _____?
b) pytania measuring: Compared to me, are you closer to or further from __
c) termometr: I just travled (at least) [Distance]. Am I hotter or colder?
d) radar: Are you within [Distance] of me?
e) Of all the [Places(np. muzeum)] within [Distance] of me,which are you closest to?
c) Send a photo of [subject]

po zadaniu kazdego z pytań chowający sie mogą pociągnąć ze swojego fizycznego decku x kart - na ręce mogą miec maksymalniee Y kart takze czasem musza jakas odrzucic zeby nie miec przepełnionego decku.
oprocz klątw w talii mogą znalezc sie tez time bonusy, ktore pomagaja na koncu.

celem gry jest to zeby jak najszybciej znalezc chowajacych przez szukajacego (chowajacemu zalezy natomiast zeby czas ten byl najdluzszy)

fajnie by tez bhlo zeby gdzies w apce byl staly podgląd czasu. 

3. nie wiem jeszcze jak to rozwiązac ale chcialabym zeby oni na mapie mogli sobie dokladnie zaznazyc jaki obszar wykluczaja lub do jakiego zawęzaja. 

Obecnie chcialabym 

---

## Propozycja technologii

### Frontend (mobilny, cross-platform)
- **React Native** z **Expo** — jeden codebase na iOS i Android, dojrzały ekosystem, dobre wsparcie dla geolokalizacji i powiadomień.

### Mapy
- **react-native-maps** z providerem **OpenStreetMap** — za darmo, bez ograniczeń licencyjnych.
- Dane przystanków tramwajowych/autobusowych — **Overpass API** (zapytania do bazy OSM o obiekty typu `public_transport=stop_position` / `highway=bus_stop`).

### Backend
- **Node.js** (TypeScript) z **Fastify** — szybki development, jeden język (TS) na frontendzie i backendzie.
- **Socket.IO** — komunikacja w czasie rzeczywistym (lokalizacja graczy, chat/komunikator, klątwy, timery).
- **PostgreSQL** + **PostGIS** — baza danych z rozszerzeniem geoprzestrzennym (geofencing, obliczanie odległości, zapytania "nearest").

### Geofencing & lokalizacja
- **expo-location** — śledzenie GPS w tle, geofencing z powiadomieniami.
- **Turf.js** — obliczenia geometryczne po stronie klienta (bufory, dystanse, sprawdzanie czy punkt jest w obszarze).

### Chat / komunikator
- **Socket.IO** + przechowywanie wiadomości w PostgreSQL.
- Wysyłanie zdjęć: upload na **S3-compatible storage** (np. MinIO lokalnie, AWS S3 na produkcji), linki w wiadomościach.

### Autoryzacja
- Prosty system pokoi/gier z kodem dołączenia (bez pełnej rejestracji).

---

## Plan realizacji (fazy)

---

## FAZA 1 — Fundament

### Epic 1.1: Inicjalizacja projektu i infrastruktura deweloperska

**Cel:** Działające środowisko dev — jeden `npm install`, uruchomienie backendu i mobilnej apki.

| # | Story | Opis | Definition of Done |
|---|---|---|---|
| 1.1.1 | Expo init | Zainicjalizować projekt Expo w `apps/mobile` z Expo Router, skonfigurować `app.json`, `tsconfig.json` | `npx expo start` uruchamia apkę, wyświetla ekran powitalny |
| 1.1.2 | Backend init | Fastify + Socket.IO w `apps/server`, endpoint `/health` | `npm run dev:server` → `curl localhost:3000/health` zwraca `{"status":"ok"}` |
| 1.1.3 | Docker Compose | PostgreSQL+PostGIS + MinIO działające lokalnie | `npm run docker:up` → baza i MinIO dostępne na standardowych portach |
| 1.1.4 | Monorepo wiring | npm workspaces + Turborepo — `@hideseek/shared` importowalny w obu apps | `npm run typecheck` przechodzi bez błędów |
| 1.1.5 | Linter + formatter | ESLint + Prettier skonfigurowane, skrypty `lint` i `format` | `npm run lint` przechodzi, formatowanie spójne |
| 1.1.6 | CI green | GitHub Actions: install → build → typecheck → lint → test (pusty suite) | Push do main → pipeline zielony |

**Review & Testy:**
- [ ] Code review: PR z całym scaffoldem — sprawdzić strukturę katalogów vs architektura.md
- [ ] Smoke test: fresh clone → `npm install` → `npm run docker:up` → `npm run dev:server` → `npm run dev:mobile` — wszystko startuje bez błędów
- [ ] CI przechodzi na GitHubie

---

### Epic 1.2: Baza danych — schemat i migracje

**Cel:** Tabele `games`, `players`, `stops` gotowe w PostgreSQL z PostGIS.

| # | Story | Opis | DoD |
|---|---|---|---|
| 1.2.1 | Klient DB | Moduł `db/client.ts` — pool PostgreSQL, konfiguracja z `.env` | Połączenie z bazą działa, loguje sukces na starcie |
| 1.2.2 | System migracji | Prosty runner migracji SQL (kolejność plików) | `npm run db:migrate` tworzy tabele, idempotentny (bezpieczne wielokrotne uruchomienie) |
| 1.2.3 | Migracja: games | Tabela `games` ze wszystkimi kolumnami z architecture.md | Tabela istnieje, typy kolumn poprawne |
| 1.2.4 | Migracja: players | Tabela `players` z FK do `games` | FK działa, constraint na role ENUM |
| 1.2.5 | Migracja: stops | Tabela `stops` z GEOGRAPHY(Point) i GEOGRAPHY(Polygon) | PostGIS geography działa, indeks przestrzenny |

**Review & Testy:**
- [ ] Code review: SQL migracji — sprawdzić typy, FK, indeksy, brak SQL injection
- [ ] Test integracyjny: uruchom migracje na czystej bazie → sprawdź `\dt` i `\d games` etc.
- [ ] Test idempotentności: uruchom migracje 2x — brak błędów
- [ ] Test rollback: usunięcie tabel i ponowna migracja działa

---

### Epic 1.3: Lobby — tworzenie i dołączanie do gry

**Cel:** Gracz może stworzyć grę (dostaje kod) lub dołączyć do istniejącej podając kod. Wybiera rolę i imię.

| # | Story | Opis | DoD |
|---|---|---|---|
| 1.3.1 | REST: POST /games | Tworzy grę, generuje 6-znakowy kod, zwraca game object | Kod unikalny, status=`waiting`, zwraca JSON |
| 1.3.2 | REST: POST /games/:code/join | Dołącza gracza (name + role) do gry po kodzie | Gracz zapisany w DB, zwraca player object |
| 1.3.3 | REST: GET /games/:code | Pobiera stan gry + listę graczy | Zwraca grę z zagnieżdżoną listą graczy |
| 1.3.4 | Socket: game:join | Po połączeniu WebSocket gracz dołącza do Socket.IO room | Gracz w roomie, inni gracze dostają powiadomienie |
| 1.3.5 | Mobile: ekran główny | Ekran z dwoma opcjami: "Stwórz grę" / "Dołącz do gry" | Widoczne na iOS i Android, nawigacja działa |
| 1.3.6 | Mobile: formularz tworzenia gry | Input: czas na chowanie, promień geofence, promień gry. Przycisk "Stwórz" | Po kliknięciu → API call → przejście do lobby |
| 1.3.7 | Mobile: formularz dołączania | Input: kod gry, imię, wybór roli (hider/seeker) | Po dołączeniu → przejście do lobby |
| 1.3.8 | Mobile: ekran lobby | Lista graczy (real-time via Socket), przycisk "Start" (tylko twórca) | Nowi gracze pojawiają się bez refreshu |
| 1.3.9 | Walidacja | Kody case-insensitive, imię 1-20 znaków, parametry gry w sensownych zakresach | Błędy walidacji wyświetlane w UI |

**Review & Testy:**
- [ ] Code review: PR z endpointami + ekranami
- [ ] Test jednostkowy: generowanie kodu (unikalność, format)
- [ ] Test jednostkowy: walidacja inputów (odrzuca puste imię, ujemny czas, zbyt duży promień)
- [ ] Test integracyjny: stwórz grę → dołącz 3 graczy → sprawdź GET /games/:code
- [ ] Test E2E manualny: 2 telefony/emulatory — jeden tworzy grę, drugi dołącza, obaj widzą się w lobby
- [ ] Test edge case: dołączanie do nieistniejącego kodu, dołączanie gdy gra już started

---

### Epic 1.4: Mapa — podstawowy widok z lokalizacją

**Cel:** Ekran mapy wyświetla aktualną pozycję gracza na mapie OSM.

| # | Story | Opis | DoD |
|---|---|---|---|
| 1.4.1 | react-native-maps setup | Zainstalować i skonfigurować z providerem OSM (lub Apple Maps na iOS / Google na Android — whichever free) | Mapa wyświetla się na obu platformach |
| 1.4.2 | expo-location setup | Uprawnienia lokalizacji, hook `useLocation` | Prośba o lokalizację, pozycja aktualizowana co 3-5s |
| 1.4.3 | Marker gracza | Ikona na mapie śledząca aktualną lokalizację | Marker przesuwa się przy ruchu |
| 1.4.4 | Centrowanie mapy | Mapa centruje się na graczu przy otwarciu, przycisk "wycentruj" | Jedno kliknięcie → mapa wraca do pozycji gracza |
| 1.4.5 | Location store | Zustand store zapisujący lokalizację + wysyłanie przez Socket.IO | Serwer odbiera `location:update` co 3-5s |

**Review & Testy:**
- [ ] Code review: uprawnienia lokalizacji (poprawne i minimalne), obsługa gdy user odmówi
- [ ] Test manualny na fizycznym urządzeniu: mapa się ładuje, marker widoczny, GPS działa
- [ ] Test: odmowa uprawnień lokalizacji → sensowny komunikat błędu
- [ ] Test integracyjny: Socket.IO odbiera location updates od klienta
- [ ] Sprawdzić zużycie baterii — czy interwał 3-5s nie drenuje za bardzo

---

### 🏁 Milestone: FAZA 1 DONE

**Kryteria akceptacji fazy 1:**
- [ ] `npm install && npm run docker:up && npm run dev:server && npm run dev:mobile` — działa od zera
- [ ] Gracz tworzy grę → dostaje kod → drugi gracz dołącza → obaj w lobby
- [ ] Mapa wyświetla aktualną pozycję GPS
- [ ] Lokalizacja wysyłana do serwera przez WebSocket
- [ ] CI pipeline zielony
- [ ] Brak hardkodowanych wartości (konfiguracja przez .env)

---

## FAZA 2 — Mechanika chowającego

### Epic 2.1: Przystanki z Overpass API

**Cel:** Po starcie gry pobieramy przystanki tramwajowe/autobusowe w promieniu gry i wyświetlamy je na mapie.

| # | Story | Opis | DoD |
|---|---|---|---|
| 2.1.1 | Overpass service (backend) | Serwis pobierający przystanki z Overpass API w promieniu X m od punktu | Zwraca listę przystanków z nazwą, lokalizacją, osm_id |
| 2.1.2 | Dedupl. i centrowanie | Przystanki o tej samej nazwie w bliskiej odległości → jeden punkt centralny | Np. "Rynek Główny" z 4 peronów → 1 punkt |
| 2.1.3 | Cache w DB | Przystanki zapisywane w tabeli `stops` per gra (jedno zapytanie do Overpass per gra) | Drugie otwarcie mapy bierze dane z DB, nie z API |
| 2.1.4 | REST: GET /games/:id/stops | Endpoint zwracający przystanki dla gry | JSON z tablicą przystanków + lokalizacja |
| 2.1.5 | Mobile: markery przystanków | Ikony przystanków na mapie (inne niż marker gracza) | Widoczne, klikalne (pokazują nazwę), nie zasłaniają się nawzajem |
| 2.1.6 | Filtrowanie widoku | Opcjonalny toggle "pokaż/ukryj przystanki" na mapie | Domyślnie widoczne, można schować żeby nie zaśmiecały |

**Review & Testy:**
- [ ] Code review: zapytanie Overpass — sprawdzić czy nie jest zbyt szerokie (timeout), czy escape'uje parametry
- [ ] Test jednostkowy: dedupl. i centrowanie przystanków (fixture z prawdziwymi danymi OSM)
- [ ] Test integracyjny: start gry → przystanki pobrane → zapisane w DB → zwracane przez GET
- [ ] Test manualny: mapa z przystankami w znanej lokalizacji (np. centrum Twojego miasta) — weryfikacja czy są poprawne
- [ ] Test edge case: brak internetu przy zapytaniu do Overpass → sensowny błąd, brak przystanków w okolicy → info dla gracza

---

### Epic 2.2: Faza chowania — timer i zmiana stanu gry

**Cel:** Po kliknięciu "Start" w lobby rozpoczyna się faza chowania z odliczaniem.

| # | Story | Opis | DoD |
|---|---|---|---|
| 2.2.1 | Socket: game:start | Twórca gry emituje start → serwer zmienia status na `hiding`, zapisuje `started_at` | Wszyscy gracze w roomie dostają `game:phase_change` |
| 2.2.2 | Timer serwerowy | Serwer liczy czas fazy chowania, emituje `timer:sync` co 1s | Klienci dostają pozostały czas |
| 2.2.3 | Mobile: komponent Timer | Stały, widoczny timer u góry ekranu (lub floating) — aktualizowany z serwera | Pokazuje MM:SS, odlicza, widoczny na każdym ekranie gry |
| 2.2.4 | Auto-przejście do szukania | Gdy timer dojdzie do 0 → serwer zmienia status na `seeking` | Wszyscy gracze dostają `game:phase_change` z nowym statusem |
| 2.2.5 | Mobile: game state store | Zustand store śledzący fazę gry, synchronizowany z Socket events | Ekrany reagują na fazę (hiding → seeking): różne UI |
| 2.2.6 | Mobile: ekran mapy per faza | W fazie `hiding`: chowający widzi przystanki + swój marker. W `waiting`: info "czekaj na start" | Kontekstowy UI zależny od roli i fazy gry |

**Review & Testy:**
- [ ] Code review: logika timera — sprawdzić synchronizację, drift, co gdy serwer się zrestartuje w trakcie
- [ ] Test jednostkowy: timer service — czas startuje, odlicza, zmienia fazę na 0
- [ ] Test integracyjny: start gry → timer działa → po X sekundach (zmniejszony na potrzeby testu) → faza zmienia się na `seeking`
- [ ] Test manualny (2 urządzenia): start gry, timer widoczny i zsynchronizowany na obu
- [ ] Test edge case: gracz rozłącza się w trakcie chowania → reconnect → timer wciąż poprawny

---

### Epic 2.3: Wybór przystanku przez chowającego

**Cel:** Chowający wybiera przystanek, przy którym się chowa. Jeśli czas mija — auto-wybór lub okno dialogowe.

| # | Story | Opis | DoD |
|---|---|---|---|
| 2.3.1 | Mobile: tap na przystanek | Chowający klika marker przystanku → "Chowam się tutaj?" z potwierdzeniem | Dialog z nazwą przystanku i przyciskiem potwierdź/anuluj |
| 2.3.2 | REST: POST /games/:id/hide | Chowający potwierdza przystanek → zapis `chosen_stop_id` w `players` | Status gracza zaktualizowany, serwer wie gdzie jest |
| 2.3.3 | Auto-detect bliskości | Po upływie timera: serwer sprawdza pozycję chowającego vs przystanki w promieniu | Lista przystanków w zasięgu (PostGIS ST_DWithin) |
| 2.3.4 | Mobile: dialog multi-stop | Jeśli chowający jest w zasięgu >1 przystanku po upływie czasu → okno z wyborem | Lista przystanków z odległością, gracz musi wybrać |
| 2.3.5 | Mobile: dialog single-stop | Jeśli dokładnie 1 przystanek w zasięgu → auto-przypisanie z powiadomieniem | Toast: "Przypisano do przystanku X" |
| 2.3.6 | Edge case: brak przystanku | Chowający nie jest w zasięgu żadnego przystanku po upływie czasu | Wymuszenie: "musisz dotrzeć do przystanku!" z przedłużeniem 2 min lub komunikat |

**Review & Testy:**
- [ ] Code review: logika PostGIS — sprawdzić zapytania ST_DWithin, indeksy, prawidłowy promień
- [ ] Test jednostkowy: logika auto-detect (0, 1, N przystanków w zasięgu)
- [ ] Test integracyjny: chowający → wybiera przystanek → DB zaktualizowana → GET /games/:code potwierdza
- [ ] Test manualny: fizycznie przy przystanku → tap → potwierdź → przypisane poprawnie
- [ ] Test edge case: chowający wybiera → potem próbuje zmienić (nie powinno być możliwe po potwierdzeniu)

---

### Epic 2.4: Geofence — generowanie i wizualizacja

**Cel:** Po wyborze przystanku generowany jest geofence (koło X m). Chowający widzi go na mapie i nie może go opuścić.

| # | Story | Opis | DoD |
|---|---|---|---|
| 2.4.1 | Backend: generowanie geofence | Po wyborze przystanku → `ST_Buffer(location, radius)` → zapis w `stops.geofence` | Polygon w DB, radius z konfiguracji gry |
| 2.4.2 | REST: GET /games/:id/geofence | Zwraca geofence chowającego (polygon GeoJSON) | Poprawny GeoJSON, dostępny tylko w fazie `seeking` |
| 2.4.3 | Mobile: GeofenceOverlay | Przezroczysty okrąg na mapie wokół przystanku | Widoczny, nie zasłania mapy, kolor rozróżnialny |
| 2.4.4 | Hook useGeofence | Monitoruje pozycję chowającego vs granica geofence (Turf.js) | Oblicza dystans do krawędzi w czasie rzeczywistym |
| 2.4.5 | Ostrzeżenie: zbliżanie do granicy | Wibracja + dźwięk + wizualny alert gdy <20m do krawędzi geofence | Stopniowane: 20m → lekkie ostrzeżenie, 5m → mocne |
| 2.4.6 | Ostrzeżenie: poza geofence | Jeśli chowający przekroczy granicę → czerwony alert + powiadomienie | Wyraźne "WRÓĆ! Jesteś poza strefą!" |

**Review & Testy:**
- [ ] Code review: klient-side Turf.js vs serwer PostGIS — czy nie ma desynchronizacji
- [ ] Test jednostkowy: Turf.js — dystans do krawędzi koła, punkt wewnątrz/na zewnątrz
- [ ] Test jednostkowy: backend ST_Buffer — generuje poprawny polygon
- [ ] Test integracyjny: wybrany przystanek → geofence wygenerowany → dostępny przez API → overlay na mapie
- [ ] Test manualny: fizycznie chodzić w okolicy — ostrzeżenia dźwiękowe odpalają się w odpowiednich momentach
- [ ] Test edge case: brak GPS chwilowo → nie wyrzucać fałszywego alarmu "poza geofence"

---

### Epic 2.5: Śledzenie pozycji szukających (widok chowającego)

**Cel:** Chowający w fazie `seeking` widzi na mapie pozycje szukających w (prawie) czasie rzeczywistym.

| # | Story | Opis | DoD |
|---|---|---|---|
| 2.5.1 | Socket: location broadcast | Serwer zbiera `location:update` od szukających i emituje `location:seekers` do chowających co 3-5s | Chowający w roomie dostają pozycje seekerów |
| 2.5.2 | Filtrowanie wg roli | Tylko szukający wysyłają lokalizację do chowających, nie odwrotnie | Szukający NIE widzą siebie nawzajem ani chowających |
| 2.5.3 | Mobile: PlayerMarker | Markery szukających na mapie chowającego (inne ikony/kolory niż przystanki) | Rozróżnialne, z imieniem gracza |
| 2.5.4 | Płynność animacji | Markery szukających interpolowane (nie skaczą) | Przejście między pozycjami animowane |

**Review & Testy:**
- [ ] Code review: logika broadcastu — sprawdzić że nie wyciekają dane (chowający → szukający)
- [ ] Test integracyjny: 2 klientów Socket.IO — seeker wysyła lokalizację, hider ją otrzymuje
- [ ] Test bezpieczeństwa: seeker NIE dostaje lokalizacji hidera ani innych seekerów
- [ ] Test manualny: 2 urządzenia — seeker chodzi, hider widzi ruch w real-time
- [ ] Test edge case: seeker rozłącza się → marker znika / jest szary

---

### 🏁 Milestone: FAZA 2 DONE

**Kryteria akceptacji fazy 2:**
- [ ] Pełny flow chowającego: lobby → start → widzę przystanki → wybieram → geofence aktywny → widzę szukających
- [ ] Timer działa i jest zsynchronizowany między urządzeniami
- [ ] Geofence ostrzega przy granicy (dźwięk + wizualnie)
- [ ] Przystanki poprawnie pobrane z Overpass API i wyświetlone na mapie
- [ ] Szukający nie mają dostępu do lokalizacji chowającego
- [ ] Serwer przeżywa reconnecty graczy (stan gry trwały w DB, nie tylko w pamięci)
- [ ] Wszystkie testy przechodzą (unit + integracyjne)
- [ ] Code review zakończone na wszystkich PR-ach

### Faza 3 — Mechanika szukającego
10. Baza pytań (kategorie: Matching, Measuring, Termometr, Radar, Nearest Place, Photo)
11. Interfejs zadawania pytań z wyborem kategorii i parametrów
12. Logika odpowiadania — obliczenia geolokalizacyjne po stronie backendu
13. Narzędzie do zaznaczania/wykluczania obszarów na mapie (rysowanie polygonów)

### Faza 4 — Klątwy i karty
14. Baza klątw i time-bonusów
15. Mechanika talii: losowanie kart, limit na ręce, odrzucanie
16. Wysyłanie klątw do szukających (UI + Socket.IO)
17. Timer klątw czasowych + zadania z możliwością anulowania przez chowającego

### Faza 5 — Komunikacja i śledzenie
18. Chat (tekst + zdjęcia) między drużynami
19. Śledzenie lokalizacji szukających w czasie rzeczywistym (widok chowającego)
20. Stały wyświetlacz czasu gry

### Faza 6 — Polish
21. Ekran końca gry (podsumowanie, ranking czasu)
22. Obsługa edge case'ów (utrata GPS, rozłączenie, wyjście gracza)
23. Testy na obu platformach
