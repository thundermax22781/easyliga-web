# Calcetto Manager - PRD

## Panoramica
App mobile per gestire un database di giocatori di calcetto amatoriale. Permette di creare, modificare, eliminare giocatori e generare squadre casuali equilibrate.

## Funzionalità Principali

### 1. Database Giocatori (CRUD)
- **Creazione**: Nome, Cognome, Nickname (visualizzato), Data di nascita, Ruolo, Valore di Forza (1-10)
- **Modifica**: Tutti gli attributi modificabili
- **Eliminazione**: Con conferma (long press o pulsante)
- **Dettaglio**: Pagina profilo con tutte le informazioni e età calcolata automaticamente

### 2. Ricerca e Filtri
- Ricerca per nome, cognome o nickname
- Filtro per ruolo: Portiere, Difensore, Centrocampista, Attaccante
- Filtro per valore di forza (range)

### 3. Generazione Squadre Equilibrate
- Selezione giocatori dalla lista
- Algoritmo di bilanciamento basato sulla forza
- Visualizzazione Squadra A vs Squadra B con media forza
- Possibilità di rigenerare le squadre

### 4. Calcolo Età Automatico
- Età calcolata dalla data di nascita
- Si aggiorna automaticamente al compleanno

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
