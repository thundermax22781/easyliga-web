const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const API_BASE = `${BACKEND_URL}/api`;

export interface Group {
  id: string;
  name: string;
  player_count: number;
  created_at: string;
}

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
  team_a_total_strength: number;
  team_b_total_strength: number;
  team_a_avg_age: number;
  team_b_avg_age: number;
  team_a_name: string;
  team_b_name: string;
  team_a_color: string;
  team_b_color: string;
}

export const ROLES = ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante'] as const;

export const ROLE_COLORS: Record<string, string> = {
  Portiere: '#FF9500',
  Difensore: '#5856D6',
  Centrocampista: '#34C759',
  Attaccante: '#FF3B30',
};

export const JERSEY_COLORS: { label: string; value: string; hex: string }[] = [
  { label: 'Bianca', value: 'Bianca', hex: '#FFFFFF' },
  { label: 'Rossa', value: 'Rossa', hex: '#FF3B30' },
  { label: 'Gialla', value: 'Gialla', hex: '#FFCC00' },
  { label: 'Nera', value: 'Nera', hex: '#1C1C1E' },
  { label: 'Verde', value: 'Verde', hex: '#34C759' },
];

export const MATCH_TYPES: { label: string; value: number }[] = [
  { label: 'Calcetto 5', value: 5 },
  { label: 'Calcio 6', value: 6 },
  { label: 'Calcio 7', value: 7 },
  { label: 'Calcio 8', value: 8 },
  { label: 'Calcio 9', value: 9 },
  { label: 'Calcio 10', value: 10 },
  { label: 'Calcio 11', value: 11 },
];

export const STRENGTH_VALUES: number[] = [];
for (let i = 1; i <= 10; i += 0.5) {
  STRENGTH_VALUES.push(i);
}

// --- Group API ---

export async function fetchGroups(): Promise<Group[]> {
  const res = await fetch(`${API_BASE}/groups`);
  if (!res.ok) throw new Error('Errore nel caricamento gruppi');
  return res.json();
}

export async function createGroup(name: string): Promise<Group> {
  const res = await fetch(`${API_BASE}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Errore nella creazione del gruppo');
  return res.json();
}

export async function updateGroup(id: string, name: string): Promise<Group> {
  const res = await fetch(`${API_BASE}/groups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Errore nella modifica del gruppo');
  return res.json();
}

export async function deleteGroup(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/groups/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Errore nella cancellazione del gruppo');
}

// --- Player API ---

export async function fetchPlayers(params?: {
  search?: string;
  role?: string;
  group_id?: string;
  min_strength?: number;
  max_strength?: number;
  sort_by?: string;
  sort_order?: string;
}): Promise<Player[]> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.role) query.append('role', params.role);
  if (params?.group_id) query.append('group_id', params.group_id);
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
  group_id: string;
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

export async function importPlayersExcel(
  file: { uri: string; name: string; mimeType?: string },
  groupId: string
): Promise<{ imported: number; errors: string[]; players: Player[] }> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as any);
  formData.append('group_id', groupId);

  const res = await fetch(`${API_BASE}/players/import`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Errore durante l\'importazione');
  }
  return res.json();
}

export function getTemplateUrl(): string {
  return `${API_BASE}/players/template`;
}

export async function generateTeams(
  playerIds: string[],
  playersPerTeam: number = 5,
  teamAName: string = 'Squadra A',
  teamBName: string = 'Squadra B',
  teamAColor: string = 'Bianca',
  teamBColor: string = 'Rossa'
): Promise<TeamResult> {
  const res = await fetch(`${API_BASE}/generate-teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_ids: playerIds,
      players_per_team: playersPerTeam,
      team_a_name: teamAName,
      team_b_name: teamBName,
      team_a_color: teamAColor,
      team_b_color: teamBColor,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Errore nella generazione squadre');
  }
  return res.json();
}
