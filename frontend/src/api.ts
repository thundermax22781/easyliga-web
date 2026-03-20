const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const API_BASE = `${BACKEND_URL}/api`;

export interface Player {
  id: string;
  name: string;
  surname: string;
  nickname: string;
  date_of_birth: string;
  age: number;
  photo: string | null;
  role: string;
  strength: number;
  created_at: string;
  updated_at: string;
}

export interface TeamResult {
  team_a: Player[];
  team_b: Player[];
  team_a_avg_strength: number;
  team_b_avg_strength: number;
}

export const ROLES = ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante'] as const;

export const ROLE_COLORS: Record<string, string> = {
  Portiere: '#FF9500',
  Difensore: '#5856D6',
  Centrocampista: '#34C759',
  Attaccante: '#FF3B30',
};

export async function fetchPlayers(params?: {
  search?: string;
  role?: string;
  min_strength?: number;
  max_strength?: number;
  sort_by?: string;
  sort_order?: string;
}): Promise<Player[]> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.role) query.append('role', params.role);
  if (params?.min_strength) query.append('min_strength', String(params.min_strength));
  if (params?.max_strength) query.append('max_strength', String(params.max_strength));
  if (params?.sort_by) query.append('sort_by', params.sort_by);
  if (params?.sort_order) query.append('sort_order', params.sort_order);

  const res = await fetch(`${API_BASE}/players?${query.toString()}`);
  if (!res.ok) throw new Error('Errore nel caricamento giocatori');
  return res.json();
}

export async function fetchPlayer(id: string): Promise<Player> {
  const res = await fetch(`${API_BASE}/players/${id}`);
  if (!res.ok) throw new Error('Giocatore non trovato');
  return res.json();
}

export async function createPlayer(data: {
  name: string;
  surname: string;
  nickname: string;
  date_of_birth: string;
  photo?: string | null;
  role: string;
  strength: number;
}): Promise<Player> {
  const res = await fetch(`${API_BASE}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Errore nella creazione');
  }
  return res.json();
}

export async function updatePlayer(
  id: string,
  data: Partial<{
    name: string;
    surname: string;
    nickname: string;
    date_of_birth: string;
    photo: string | null;
    role: string;
    strength: number;
  }>
): Promise<Player> {
  const res = await fetch(`${API_BASE}/players/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Errore nella modifica');
  }
  return res.json();
}

export async function deletePlayer(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/players/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Errore nella cancellazione');
}

export async function generateTeams(
  playerIds: string[],
  playersPerTeam?: number
): Promise<TeamResult> {
  const res = await fetch(`${API_BASE}/generate-teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_ids: playerIds,
      players_per_team: playersPerTeam || 5,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Errore nella generazione squadre');
  }
  return res.json();
}
