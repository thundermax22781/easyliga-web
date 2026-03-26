# Calcetto Manager - PRD

## Panoramica
App mobile per gestire un database di giocatori di calcetto amatoriale. Permette di creare, modificare, eliminare giocatori e generare squadre casuali equilibrate.

## Funzionalità Principali

### 1. Multi-Database (Gruppi)
- Crea gruppi separati per gestire sessioni diverse (es. "Martedì sera", "Giovedì pomeriggio")
- Ogni gruppo ha il proprio set di giocatori isolato
- CRUD completo sui gruppi

### 2. Database Giocatori (CRUD)
- Creazione: Nome, Cognome, Nickname, Data di Nascita (età auto-calcolata), Ruolo, Forza (1-10 con step 0.5)
- Modifica e eliminazione
- Importazione massiva da Excel (.xlsx)
- Template Excel scaricabile

### 3. Ricerca e Filtri
- Ricerca per nome/cognome/nickname
- Filtro per ruolo: Portiere, Difensore, Centrocampista, Attaccante

### 4. Generazione Squadre Equilibrate
- Tipo partita: Calcetto 5, Calcio 6, 7, 8, 9, 10, 11
- Nomi squadre personalizzabili
- Selezione colore maglia (Bianca, Rossa, Gialla, Nera, Verde)
- Ordinamento giocatori per ruolo (POR → DIF → CEN → ATT)
- Spostamento manuale giocatori tra squadre con ricalcolo statistiche
- Media forza e età media per squadra

## Architettura Tecnica
- **Frontend**: React Native Expo (SDK 54) con Expo Router
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Navigazione**: Tab-based (Giocatori | Genera Squadre)

## Ruoli Giocatore
| Ruolo | Colore |
|-------|--------|
| Portiere | Arancione (#FF9500) |
| Difensore | Viola (#5856D6) |
| Centrocampista | Verde (#34C759) |
| Attaccante | Rosso (#FF3B30) |

## API Endpoints
- `GET /api/players` - Lista giocatori (con filtri)
- `POST /api/players` - Crea giocatore
- `GET /api/players/{id}` - Dettaglio giocatore
- `PUT /api/players/{id}` - Modifica giocatore
- `DELETE /api/players/{id}` - Elimina giocatore
- `POST /api/generate-teams` - Genera squadre equilibrate

## Design
- Tema chiaro e pulito
- Interfaccia in italiano
- Senza autenticazione (uso personale)
