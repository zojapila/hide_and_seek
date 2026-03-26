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

### Faza 1 — Fundament
1. Inicjalizacja projektu (Expo + backend Node.js/TS)
2. Model danych: gracze, pokoje/gry, role (chowający/szukający)
3. Ekran tworzenia/dołączania do gry (kod pokoju)
4. Podstawowa mapa z wyświetlaniem aktualnej lokalizacji

### Faza 2 — Mechanika chowającego
5. Pobieranie przystanków z Overpass API w promieniu gry i wyświetlanie ich na mapie
6. Timer na chowanie się (konfigurowalny)
7. Wybór przystanku (automatyczny z oknem dialogowym jeśli kilka w zasięgu)
8. Generowanie geofence'a (okrąg X m od przystanku)
9. Ostrzeżenie dźwiękowe/wibracja przy zbliżaniu się do granicy geofence'a

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
