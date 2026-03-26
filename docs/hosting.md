# Hosting & Dystrybucja

## Kontekst
- Aplikacja prywatna, ~5-10 osób
- **iOS:** tylko 1 osoba (Ty, masz Maca)
- **Android:** reszta graczy
- Budżet: **$0**
- Akceptowalny: serwer lokalny, regularne re-deploye

---

## 1. Backend — hosting serwera

### Opcja A: Serwer domowy (REKOMENDOWANE) ✅
**Co:** Dowolny komputer w domu — stary laptop, Mac mini, Raspberry Pi 4/5.

| Element | Rozwiązanie |
|---|---|
| Serwer Node.js | Docker container |
| PostgreSQL + PostGIS | Docker container |
| MinIO (zdjęcia) | Docker container |
| Dostęp z zewnątrz | **Cloudflare Tunnel** (darmowy, zero-config, HTTPS) |
| Domena | Darmowa subdomena z Cloudflare lub duckdns.org |

**Dlaczego Cloudflare Tunnel?**
- Nie musisz otwierać portów na routerze
- Automatyczny HTTPS
- Darmowy na zawsze
- Działa za NATem — wystarczy `cloudflared tunnel` na serwerze

**Koszty:** $0 (zakładając że masz jakiegoś kompa w domu)

**Setup:**
```bash
# Na serwerze domowym:
brew install cloudflared     # lub apt install cloudflared
cloudflared tunnel login
cloudflared tunnel create hideseek
cloudflared tunnel route dns hideseek hideseek.twoja-domena.pl

# Uruchom tunel:
cloudflared tunnel run --url http://localhost:3000 hideseek
```

### Opcja B: Fly.io (darmowy tier)
- 3 shared VMs, 256MB RAM — wystarczy na backend
- Wbudowany PostgreSQL (free tier: 1GB)
- Trzeba jedynie dodać PostGIS extension
- **Uwaga:** free tier bywa ograniczany, mogą wymagać karty kredytowej

### Opcja C: Render.com (darmowy tier)
- Free web service (spins down po 15 min nieaktywności — cold start ~30s)
- Free PostgreSQL (90 dni, potem trzeba odnawiać)
- Dobry na fazę developmentu

### Opcja D: Railway.app
- $5 darmowego kredytu/mies. — powinno wystarczyć na niewielki ruch
- PostgreSQL + PostGIS out of the box
- Najprostszy setup ze wszystkich

---

## 2. iOS — dystrybucja (tylko Ty) ✅

Skoro tylko Ty używasz iOS i masz Maca — **nie potrzebujesz płacić Apple'owi ani grosza**.
Apple pozwala każdemu darmowemu kontu deweloperskiemu instalować aplikacje na własne urządzenie.
Certyfikat wygasa co 7 dni, ale **AltStore odświeża go automatycznie w tle**.

### AltStore + EAS Build (REKOMENDOWANE) ✅

**Jak to działa:**
1. **AltServer** — mała aplikacja działająca w menu barze Maca. Raz na ~7 dni, gdy iPhone jest w tej samej sieci WiFi, odświeża certyfikat automatycznie (zazwyczaj w nocy, gdy śpisz).
2. **EAS Build** — buduje plik `.ipa` w chmurze za darmo. Dostajesz gotowy plik do zainstalowania.
3. **AltStore** na iPhonie — przyjmuje `.ipa` i zarządza certyfikatem.

**Setup jednorazowy (krok po kroku):**

```
Krok 1 — Zainstaluj AltServer na Macu
  → Pobierz ze strony altstore.io
  → Uruchom, pojawi się ikona w menu barze

Krok 2 — Zainstaluj AltStore na iPhonie
  → Podłącz iPhone kablem USB do Maca
  → Kliknij ikonę AltServer w menu barze → "Install AltStore" → wybierz swój iPhone
  → Na iPhonie: Ustawienia → Ogólne → Zarządzanie urządzeniem → zaufaj certyfikatowi

Krok 3 — Zaloguj się w AltStore
  → Otwórz AltStore na iPhonie
  → Zaloguj się swoim Apple ID (tym samym co używasz w App Store)
  → To jest darmowe konto — nie potrzebujesz Apple Developer Program

Krok 4 — Zainstaluj aplikację
  → Pobierz plik .ipa zbudowany przez EAS
  → Wyślij go na iPhone (AirDrop, iCloud Drive, cokolwiek)
  → Otwórz plik → "Open in AltStore" → instaluje się

Krok 5 — Auto-odświeżanie
  → AltServer na Macu + iPhone w tej samej sieci WiFi
  → AltStore odświeża certyfikat sam, bez Twojego udziału
```

**Kiedy musisz ręcznie coś zrobić:**
- Nowa wersja aplikacji → zbudujesz nowe `.ipa` i zainstalujesz przez AltStore (kilka kliknięć)
- Mac był wyłączony przez >7 dni i telefon wyszedł z sieci → otwórz AltStore ręcznie i odśwież

**Koszty: $0**

### Expo Go (tylko na etap developmentu)

Podczas pisania kodu nie musisz za każdym razem budować pełnego `.ipa`.
Expo Go to aplikacja z App Store — skanujesz QR kod i aplikacja działa na żywo.
Ograniczenie: nie obsługuje geolokalizacji w tle ani geofencingu, więc nadaje się tylko do testowania UI.

---

## 3. Android — dystrybucja

Dużo prostsza sytuacja:
- **APK** — wystarczy zbudować i wysłać plik znajomym (sideloading). $0.
- **EAS Build** generuje APK/AAB za darmo.
- Nie trzeba Google Play ani żadnego konta.

---

## 4. Rekomendowany stack — $0 total

| Komponent | Rozwiązanie | Koszt |
|---|---|---|
| Backend + DB + MinIO | **Serwer domowy** + Docker Compose | $0 |
| Dostęp z internetu | **Cloudflare Tunnel** | $0 |
| Domena | **DuckDNS** lub subdomena Cloudflare | $0 |
| iOS build | **EAS Build** (free tier, ~30 buildów/mies.) | $0 |
| iOS dystrybucja | **AltStore** (certyfikat auto-odświeżany) | $0 |
| Android build | **EAS Build** (free tier) | $0 |
| Android dystrybucja | APK sideloading (wyślij plik znajomym) | $0 |
| CI/CD | **GitHub Actions** (2000 min/mies. free) | $0 |
| **RAZEM** | | **$0** |

---

## 5. CI/CD — pełny pipeline

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  git push   │────►│ GitHub       │────►│ CI: lint +    │
│  to main    │     │ Actions      │     │ typecheck +   │
│             │     │              │     │ test          │
└─────────────┘     └──────┬───────┘     └───────┬───────┘
                           │                     │ ✅
                    ┌──────┴───────┐      ┌──────┴───────┐
                    │ EAS Build    │      │ Deploy       │
                    │ iOS → .ipa   │      │ backend      │
                    │ Android→.apk │      │ → home server│
                    └──────┬───────┘      │ via SSH      │
                           │              └──────────────┘
                    ┌──────┴───────┐
                    │ Artefakty    │
                    │ .ipa → Ty   │  (AltStore)
                    │ .apk → reszta│ (bezpośrednio)
                    └──────────────┘
```

- **Backend deploy:** automatyczny przez SSH do serwera domowego  
- **Android APK:** EAS Build generuje plik → wysyłasz znajomym (WhatsApp, AirDrop, cokolwiek)  
- **iOS IPA:** EAS Build generuje plik → instalujesz przez AltStore na swoim iPhonie

---

## 6. Następne kroki (w kolejności)

1. [ ] Wybrać sprzęt na serwer domowy — co masz dostępne? (stary laptop, Raspberry Pi, Mac mini?)
2. [ ] Zainstalować AltServer na swoim Macu → altstore.io
3. [ ] Zainstalować AltStore na iPhonie (15 minut, jednorazowo)
4. [ ] Założyć konto Cloudflare i skonfigurować Tunnel na serwerze
5. [ ] Uruchomić `docker compose up` na serwerze (PostgreSQL + MinIO gotowe)
6. [ ] Skonfigurować EAS (`eas init` w folderze `apps/mobile`)
7. [ ] Pierwszy build: `eas build --platform ios --profile preview`
8. [ ] Zainstalować `.ipa` przez AltStore — gotowe!
