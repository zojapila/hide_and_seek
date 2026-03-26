# Hosting & Dystrybucja — Propozycje

## Kontekst
- Aplikacja prywatna, ~5-10 osób
- Musi działać na iOS (i Android)
- Budżet: $0 (oprócz ewentualnego Apple Developer Program)
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

## 2. iOS — dystrybucja aplikacji

### Kluczowy koszt: Apple Developer Program — $99/rok

Niestety **nie da się** dystrybuować natywnej aplikacji na iOS fizycznym osobom za darmo. Eksplorujmy opcje:

### Opcja A: TestFlight (REKOMENDOWANE) ✅
- Wymaga Apple Developer Account ($99/rok)
- Do **10 000** testerów (aż nadto)
- Aplikacja ważna **90 dni** od uploadu — potem trzeba ponownie zbudować i załadować
- Build przez **EAS Build** (Expo Application Services) — darmowe ~30 buildów/mies.

**Workflow:**
```
push do main → GitHub Actions → EAS Build (iOS) → upload do TestFlight → zaproszenie testerów
```

Regularne re-deploye co ~2-3 miesiące = zero problemu.

### Opcja B: Expo Development Build + Ad Hoc
- Też wymaga Apple Developer Account ($99/rok)
- Instalacja bezpośrednio na urządzenia (do 100 urządzeń)
- Registracja UDID każdego urządzenia
- Bardziej ręczne niż TestFlight

### Opcja C: Expo Go (tylko development)
- **Darmowe** — nie wymaga Apple Developer Account
- Ale: nie obsługuje niestandardowych native modules
- Dobre na etap prototypowania, nie na "produkcję"
- Każdy musi mieć Expo Go z App Store i skanować QR code

### Opcja D: PWA (Progressive Web App)
- $0 — żadnego Apple Developer Account
- Działa w przeglądarce Safari, można "dodać do ekranu głównego"
- **ALE:** ograniczony dostęp do GPS w tle, brak push notyfikacji (od iOS 16.4 jest częściowe wsparcie), brak geofencing
- **Nie nadaje się** dla tej aplikacji — za dużo zależy od lokalizacji w tle

### Moja rekomendacja:
> **TestFlight + EAS Build** — jedyny sensowny sposób na iOS.
> $99/rok to jedyny koszt, który musisz ponieść. Reszta może być za darmo.

---

## 3. Android — dystrybucja

Dużo prostsza sytuacja:
- **APK** — wystarczy zbudować i wysłać plik znajomym (sideloading). $0.
- **EAS Build** generuje APK/AAB za darmo.
- Nie trzeba Google Play ani żadnego konta.

---

## 4. Rekomendowany stack hostingowy (minimal cost)

| Komponent | Rozwiązanie | Koszt |
|---|---|---|
| Backend + DB + MinIO | **Serwer domowy** + Docker Compose | $0 |
| Dostęp z internetu | **Cloudflare Tunnel** | $0 |
| Domena | **DuckDNS** lub darmowa subdomena Cloudflare | $0 |
| iOS build | **EAS Build** (free tier) | $0 |
| iOS dystrybucja | **TestFlight** | **$99/rok** (Apple Developer) |
| Android build | **EAS Build** (free tier) | $0 |
| Android dystrybucja | APK sideloading | $0 |
| CI/CD | **GitHub Actions** (2000 min/mies. free) | $0 |
| **RAZEM** | | **$99/rok** |

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
                    │ (iOS+Android)│      │ backend      │
                    │ → TestFlight │      │ → home server│
                    │ → APK        │      │ via SSH      │
                    └──────────────┘      └──────────────┘
```

- **Backend deploy:** automatyczny przez SSH do serwera domowego (workflow w `.github/workflows/deploy.yml`)
- **Mobile build:** ręcznie lub automatycznie przez EAS (`eas build --platform all`)
- **TestFlight upload:** `eas submit --platform ios` (wymaga Apple credentials)

---

## 6. Alternatywa "zero kosztów absolutnych"

Jeśli $99/rok na Apple Developer to za dużo, jest opcja:
1. **Rozwój i testowanie** — przez Expo Go (darmowe)
2. **"Produkcja" na iOS** — każdy musi mieć Expo Go app i łączyć się z twoim developmentowym serwerem
3. **Backend** — serwer domowy + Cloudflare Tunnel

To zadziała, ale z ograniczeniami (brak działania w tle, gorszy UX).

---

## Następne kroki

1. [ ] Zdecydować: Apple Developer Account — tak/nie?
2. [ ] Wybrać serwer domowy (jaki sprzęt masz dostępny?)
3. [ ] Założyć konto Cloudflare i skonfigurować Tunnel
4. [ ] Skonfigurować EAS (`eas init` + `eas.json`)
5. [ ] Postawić docker-compose na serwerze domowym
