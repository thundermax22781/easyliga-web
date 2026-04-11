import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export interface Group {
  id: string;
  name: string;
  admin_id?: string;
  player_count: number;
  role: 'admin' | 'member';
  storage_type: 'local' | 'cloud';
  show_scorers?: boolean;
  show_assists?: boolean;
  use_bonus?: boolean;
  bonus_goals_threshold?: number;
  bonus_assists_threshold?: number;
  use_clean_sheet_bonus?: boolean;
  use_gk_bonus?: boolean;
  gk_bonus_threshold?: number;
  admin_token?: string;
  viewer_token?: string;
}

export interface Player {
  id: string;
  nickname: string;
  role: string;
  strength: number;
  age: number;
  date_of_birth?: string; // Allineato a schema Supabase
  name?: string;
  surname?: string;
  group_id: string;
}

export interface Match {
  id: string;
  date: string;
  team_a_players: string[];
  team_b_players: string[];
  team_a_score: number;
  team_b_score: number;
  team_a_name: string;
  team_b_name: string;
  team_a_color: string;
  team_b_color: string;
  description?: string;
  goals?: Record<string, number>;
  assists?: Record<string, number>;
  team_a_own_goals?: number;
  team_b_own_goals?: number;
  group_id: string;
}

export interface PlayerStats {
  player_id: string;
  nickname: string;
  role: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goals_done: number;
  goals_suffered: number;
  individual_goals: number;
  individual_assists: number;
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
  match_day?: string;
  match_time?: string;
  match_location?: string;
  description?: string;
}

export const ROLES = ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante'];
export const ROLE_COLORS: Record<string, string> = {
  Portiere: '#FF9500',
  Difensore: '#007AFF',
  Centrocampista: '#34C759',
  Attaccante: '#FF3B30',
};

export const ROLE_ORDER: Record<string, number> = {
  'Portiere': 1,
  'Difensore': 2,
  'Centrocampista': 3,
  'Attaccante': 4
};

export const STRENGTH_VALUES = [
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10,
];

export const JERSEY_COLORS = [
  { label: 'Bianca', value: 'Bianca', hex: '#FFFFFF' },
  { label: 'Rossa', value: 'Rossa', hex: '#FF3B30' },
  { label: 'Blu', value: 'Blu', hex: '#007AFF' },
  { label: 'Verde', value: 'Verde', hex: '#34C759' },
  { label: 'Gialla', value: 'Gialla', hex: '#FFD60A' },
  { label: 'Nera', value: 'Nera', hex: '#1C1C1E' },
];

export const MATCH_TYPES = [
  { label: '3 vs 3', value: 3 },
  { label: '4 vs 4', value: 4 },
  { label: '5 vs 5', value: 5 },
  { label: '6 vs 6', value: 6 },
  { label: '7 vs 7', value: 7 },
  { label: '8 vs 8', value: 8 },
];

const calculateAge = (birthDate?: string): number => {
  if (!birthDate) return 0;
  try {
    const today = new Date();
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return 0;
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  } catch (e) {
    return 0;
  }
};

// --- NOTIFICHE COMPLEANNI ---

export const scheduleBirthdayNotifications = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') return;
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    const groups = await fetchGroups();
    const today = new Date();
    for (const group of groups) {
      const players = await fetchPlayers({ group_id: group.id });
      for (const player of players) {
        if (player.date_of_birth) {
          const bday = new Date(player.date_of_birth);
          if (!isNaN(bday.getTime())) {
            if (today.getDate() === bday.getDate() && today.getMonth() === bday.getMonth()) {
               await Notifications.scheduleNotificationAsync({
                content: {
                  title: "🎂 Buon Compleanno!",
                  body: `Oggi ${player.nickname} compie gli anni! Auguri! ⚽`,
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: null,
              });
            }
          }
        }
      }
    }
  } catch (e) {}
};

// --- GRUPPI ---

export const fetchGroups = async (): Promise<Group[]> => {
  let local: Group[] = [];
  try {
    const saved = await AsyncStorage.getItem('local_groups');
    if (saved) {
      local = JSON.parse(saved).map((g: any) => ({ ...g, storage_type: 'local' }));
      for (const g of local) {
        const pSaved = await AsyncStorage.getItem(`players_${g.id}`);
        g.player_count = pSaved ? JSON.parse(pSaved).length : 0;
      }
    }
  } catch (e) {}

  let cloud: Group[] = [];
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: groupsData } = await supabase.from('groups').select('*');
    if (groupsData) {
      cloud = await Promise.all(groupsData.map(async (g) => {
        const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('group_id', g.id);
        const isAdmin = user ? g.admin_id === user.id : false;
        return {
          ...g,
          player_count: count || 0,
          storage_type: 'cloud',
          role: isAdmin ? 'admin' : 'member'
        };
      }));
    }
  } catch (e) {}

  return [...local, ...cloud];
};

export const createGroup = async (name: string, storageType: 'local' | 'cloud' = 'local'): Promise<void> => {
  return createGroupExtended(name, storageType, {});
};

export const createGroupExtended = async (name: string, storageType: 'local' | 'cloud', options: Partial<Group>): Promise<void> => {
  const newGroupId = Math.random().toString(36).substring(7);
  const newGroup: Group = {
    id: newGroupId,
    name,
    player_count: 0,
    role: 'admin',
    storage_type: storageType,
    show_scorers: options.show_scorers ?? true,
    show_assists: options.show_assists ?? true,
    use_bonus: options.use_bonus ?? false,
    bonus_goals_threshold: options.bonus_goals_threshold ?? 2,
    bonus_assists_threshold: options.bonus_assists_threshold ?? 2,
    use_clean_sheet_bonus: options.use_clean_sheet_bonus ?? false,
    use_gk_bonus: options.use_gk_bonus ?? false,
    gk_bonus_threshold: options.gk_bonus_threshold ?? 5
  };

  if (storageType === 'local') {
    const groups = await fetchGroups();
    const localOnly = groups.filter(g => g.storage_type === 'local');
    await AsyncStorage.setItem('local_groups', JSON.stringify([...localOnly, newGroup]));
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('groups').insert([{
      name,
      storage_type: 'cloud',
      admin_id: user?.id,
      show_scorers: newGroup.show_scorers,
      show_assists: newGroup.show_assists,
      use_bonus: newGroup.use_bonus,
      bonus_goals_threshold: newGroup.bonus_goals_threshold,
      bonus_assists_threshold: newGroup.bonus_assists_threshold,
      use_clean_sheet_bonus: newGroup.use_clean_sheet_bonus,
      use_gk_bonus: newGroup.use_gk_bonus,
      gk_bonus_threshold: newGroup.gk_bonus_threshold
    }]);
    if (error) throw error;
  }
};

export const updateGroup = async (groupId: string, updates: Partial<Group> | string): Promise<Group> => {
  const payload = typeof updates === 'string' ? { name: updates } : updates;
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new Error('Gruppo non trovato');

  if (group.storage_type === 'local') {
    const updated = { ...group, ...payload };
    const localGroups = groups.filter(g => g.storage_type === 'local').map(g => g.id === groupId ? updated : g);
    await AsyncStorage.setItem('local_groups', JSON.stringify(localGroups));
    return updated as Group;
  } else {
    // Ora permettiamo l'invio di tutte le colonne cloud (assumendo che le colonne esistano dopo l'ALTER TABLE)
    const { data, error } = await supabase.from('groups').update(payload).eq('id', groupId).select().single();
    if (error) throw error;
    return { ...data, storage_type: 'cloud' } as Group;
  }
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) return;

  if (group.storage_type === 'local') {
    const filtered = groups.filter(g => g.id !== groupId && g.storage_type === 'local');
    await AsyncStorage.setItem('local_groups', JSON.stringify(filtered));
    await AsyncStorage.removeItem(`players_${groupId}`);
    await AsyncStorage.removeItem(`matches_${groupId}`);
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Devi essere autenticato per eliminare un gruppo cloud.");

    if (group.admin_id === user.id) {
       const { error } = await supabase.from('groups').delete().eq('id', groupId);
       if (error) throw error;
    } else {
       throw new Error("Solo l'amministratore può eliminare questo gruppo dal cloud.");
    }
  }
};

export const joinGroup = async (token: string): Promise<void> => {
  const { data, error } = await supabase.from('groups').select('*').eq('id', token).single();
  if (error || !data) throw new Error('Token non valido');
};

// --- GIOCATORI ---

export const fetchPlayers = async (params: { group_id: string; search?: string; role?: string }): Promise<Player[]> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === params.group_id);
  let players: any[] = [];

  if (group?.storage_type === 'local') {
    const saved = await AsyncStorage.getItem(`players_${params.group_id}`);
    if (saved) players = JSON.parse(saved);
  } else {
    const { data } = await supabase.from('players').select('*').eq('group_id', params.group_id);
    if (data) players = data;
  }

  const mapped = players.map(p => ({
    ...p,
    age: p.date_of_birth ? calculateAge(p.date_of_birth) : (p.age || 0)
  }));
  let filtered = mapped;
  if (params.search) filtered = filtered.filter(p => p.nickname.toLowerCase().includes(params.search!.toLowerCase()));
  if (params.role) filtered = filtered.filter(p => p.role === params.role);
  return filtered;
};

export const savePlayer = async (player: Partial<Player> & { group_id: string }): Promise<void> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === player.group_id);

  if (group?.storage_type === 'local') {
    const players = await fetchPlayers({ group_id: player.group_id });
    const newPlayer = { ...player, id: player.id || Math.random().toString(36).substring(7) } as Player;
    const updated = player.id ? players.map(p => p.id === player.id ? newPlayer : p) : [...players, newPlayer];
    await AsyncStorage.setItem(`players_${player.group_id}`, JSON.stringify(updated));
  } else {
    // Allineato allo schema Supabase: nickname, name, surname, date_of_birth, role, strength, group_id
    const dataToSave: any = {
      nickname: player.nickname,
      name: player.name,
      surname: player.surname,
      date_of_birth: player.date_of_birth,
      role: player.role,
      strength: player.strength,
      group_id: player.group_id
    };

    if (player.id) {
      const { error } = await supabase.from('players').update(dataToSave).eq('id', player.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('players').insert([dataToSave]);
      if (error) throw error;
    }
  }
};

export const deletePlayer = async (playerId: string): Promise<void> => {
  const groups = await fetchGroups();
  for (const g of groups) {
    const players = await fetchPlayers({ group_id: g.id });
    const target = players.find(p => p.id === playerId);
    if (target) {
      if (g.storage_type === 'local') {
        await AsyncStorage.setItem(`players_${g.id}`, JSON.stringify(players.filter(p => p.id !== playerId)));
      } else {
        const { error } = await supabase.from('players').delete().eq('id', playerId);
        if (error) throw error;
      }
      return;
    }
  }
};

// --- PARTITE ---

export const fetchMatches = async (groupId: string): Promise<Match[]> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);

  if (group?.storage_type === 'local') {
    const saved = await AsyncStorage.getItem(`matches_${groupId}`);
    return saved ? JSON.parse(saved) : [];
  } else {
    const { data } = await supabase.from('matches').select('*').eq('group_id', groupId).order('date', { ascending: false });
    return (data as Match[]) || [];
  }
};

export const saveMatchResult = async (match: Match): Promise<void> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === match.group_id);

  if (group?.storage_type === 'local') {
    const matches = await fetchMatches(match.group_id);
    const matchWithId = { ...match, id: match.id || Math.random().toString(36).substring(7) };
    const updated = match.id ? matches.map(m => m.id === match.id ? matchWithId : m) : [matchWithId, ...matches];
    await AsyncStorage.setItem(`matches_${match.group_id}`, JSON.stringify(updated));
  } else {
    // Prepariamo i dati per Supabase assicurandoci di includere description e colori
    const dataToSave: any = {
      group_id: match.group_id,
      team_a_players: match.team_a_players,
      team_b_players: match.team_b_players,
      team_a_score: match.team_a_score,
      team_b_score: match.team_b_score,
      team_a_name: match.team_a_name,
      team_b_name: match.team_b_name,
      date: match.date,
      goals: match.goals,
      assists: match.assists,
      team_a_own_goals: match.team_a_own_goals,
      team_b_own_goals: match.team_b_own_goals,
      description: match.description,
      team_a_color: match.team_a_color,
      team_b_color: match.team_b_color
    };

    if (match.id && match.id.length > 20) { // Check se è un ID reale
      const { error } = await supabase.from('matches').update(dataToSave).eq('id', match.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('matches').insert([dataToSave]);
      if (error) throw error;
    }
  }
};

export const deleteMatch = async (matchId: string): Promise<void> => {
  const groups = await fetchGroups();
  for (const g of groups) {
    const matches = await fetchMatches(g.id);
    if (matches.find(m => m.id === matchId)) {
      if (g.storage_type === 'local') {
        await AsyncStorage.setItem(`matches_${g.id}`, JSON.stringify(matches.filter(m => m.id !== matchId)));
      } else {
        const { error } = await supabase.from('matches').delete().eq('id', matchId);
        if (error) throw error;
      }
      return;
    }
  }
};

// --- BACKUP & RIPRISTINO ---

export const createFullBackup = async (groupId: string): Promise<string> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new Error('Gruppo non trovato');
  const players = await fetchPlayers({ group_id: groupId });
  const matches = await fetchMatches(groupId);
  const backupData = { group, players, matches, version: '1.0', timestamp: new Date().toISOString() };
  return JSON.stringify(backupData, null, 2);
};

export const restoreFullBackup = async (groupId: string, jsonString: string): Promise<void> => {
  const backup = JSON.parse(jsonString);
  if (!backup.group || !backup.players || !backup.matches) throw new Error('File di backup non valido');
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new Error('Gruppo corrente non trovato');

  if (group.storage_type === 'local') {
    await AsyncStorage.setItem(`players_${groupId}`, JSON.stringify(backup.players));
    await AsyncStorage.setItem(`matches_${groupId}`, JSON.stringify(backup.matches));
    const updatedGroup = { ...group, ...backup.group, id: groupId, storage_type: 'local' };
    const localGroups = groups.filter(g => g.storage_type === 'local').map(g => g.id === groupId ? updatedGroup : g);
    await AsyncStorage.setItem('local_groups', JSON.stringify(localGroups));
  } else {
    await supabase.from('players').delete().eq('group_id', groupId);
    await supabase.from('matches').delete().eq('group_id', groupId);

    const playersToInsert = backup.players.map((p: any) => ({
      nickname: p.nickname,
      name: p.name,
      surname: p.surname,
      date_of_birth: p.date_of_birth,
      role: p.role,
      strength: p.strength,
      group_id: groupId
    }));

    const matchesToInsert = backup.matches.map((m: any) => ({
      group_id: groupId,
      team_a_players: m.team_a_players,
      team_b_players: m.team_b_players,
      team_a_score: m.team_a_score,
      team_b_score: m.team_b_score,
      team_a_name: m.team_a_name,
      team_b_name: m.team_b_name,
      date: m.date,
      goals: m.goals,
      assists: m.assists,
      team_a_own_goals: m.team_a_own_goals,
      team_b_own_goals: m.team_b_own_goals,
      description: m.description,
      team_a_color: m.team_a_color,
      team_b_color: m.team_b_color
    }));

    if (playersToInsert.length > 0) await supabase.from('players').insert(playersToInsert);
    if (matchesToInsert.length > 0) await supabase.from('matches').insert(matchesToInsert);

    const groupSettings = {
      name: backup.group.name,
      show_scorers: backup.group.show_scorers,
      show_assists: backup.group.show_assists,
      use_bonus: backup.group.use_bonus,
      bonus_goals_threshold: backup.group.bonus_goals_threshold,
      bonus_assists_threshold: backup.group.bonus_assists_threshold,
      use_clean_sheet_bonus: backup.group.use_clean_sheet_bonus,
      use_gk_bonus: backup.group.use_gk_bonus,
      gk_bonus_threshold: backup.group.gk_bonus_threshold
    };
    await supabase.from('groups').update(groupSettings).eq('id', groupId);
  }
};

// --- LOGICA SQUADRE ---

export const generateTeams = async (playerIds: string[], matchType: number, groupId: string, ...args: any[]): Promise<TeamResult> => {
  const players = await fetchPlayers({ group_id: groupId });
  const selected = players.filter(p => playerIds.includes(p.id));
  let teamA: Player[] = [];
  let teamB: Player[] = [];
  let strengthA = 0;
  let strengthB = 0;
  let attempts = 0;
  const goalkeepers = selected.filter(p => p.role === 'Portiere');
  const others = selected.filter(p => p.role !== 'Portiere');

  while (attempts < 100) {
    const currentA: Player[] = [];
    const currentB: Player[] = [];
    let sA = 0, sB = 0;
    const shuffledGKs = [...goalkeepers].sort(() => Math.random() - 0.5);
    shuffledGKs.forEach((gk, idx) => {
      if (idx === 0) { currentA.push(gk); sA += gk.strength; }
      else if (idx === 1) { currentB.push(gk); sB += gk.strength; }
    });
    const shuffledOthers = [...others].sort(() => Math.random() - 0.5);
    shuffledOthers.forEach(p => {
      if (currentA.length < matchType && (sA <= sB || currentB.length >= matchType)) { currentA.push(p); sA += p.strength; }
      else if (currentB.length < matchType) { currentB.push(p); sB += p.strength; }
      else { currentA.push(p); sA += p.strength; }
    });
    if (Math.abs(sA - sB) <= 2 || attempts === 99) {
      teamA = currentA; teamB = currentB;
      strengthA = sA; strengthB = sB;
      break;
    }
    attempts++;
  }
  const sortR = (a: Player, b: Player) => (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99);
  teamA.sort(sortR); teamB.sort(sortR);
  return {
    team_a: teamA, team_b: teamB,
    team_a_total_strength: Number(strengthA.toFixed(1)), team_b_total_strength: Number(strengthB.toFixed(1)),
    team_a_avg_age: teamA.length ? Number((teamA.reduce((acc, p) => acc + p.age, 0) / teamA.length).toFixed(1)) : 0,
    team_b_avg_age: teamB.length ? Number((teamB.reduce((acc, p) => acc + p.age, 0) / teamB.length).toFixed(1)) : 0,
    team_a_name: args[0] || 'Squadra A', team_b_name: args[1] || 'Squadra B',
    team_a_color: args[2] || 'Bianca', team_b_color: args[3] || 'Rossa',
    match_day: args[4], match_time: args[5], match_location: args[6], description: args[7]
  };
};

export const calculateStandings = async (groupId: string): Promise<PlayerStats[]> => {
  const players = await fetchPlayers({ group_id: groupId });
  const matches = await fetchMatches(groupId);
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  const statsMap: Record<string, PlayerStats> = {};
  players.forEach(p => statsMap[p.id] = {
    player_id: p.id, nickname: p.nickname, role: p.role, played: 0, won: 0, drawn: 0, lost: 0, points: 0,
    goals_done: 0, goals_suffered: 0, individual_goals: 0, individual_assists: 0
  });

  matches.forEach(m => {
    const isD = m.team_a_score === m.team_b_score;
    const aW = m.team_a_score > m.team_b_score;
    const proc = (pids: string[], s: number, os: number, win: boolean, cs: boolean) => {
      pids.forEach(pid => {
        if (!statsMap[pid]) return;
        statsMap[pid].played++; statsMap[pid].goals_done += s; statsMap[pid].goals_suffered += os;
        if (isD) { statsMap[pid].drawn++; statsMap[pid].points += 1; }
        else if (win) { statsMap[pid].won++; statsMap[pid].points += 3; }
        else statsMap[pid].lost++;
        const pG = m.goals?.[pid] || 0;
        const pA = m.assists?.[pid] || 0;
        statsMap[pid].individual_goals += pG;
        statsMap[pid].individual_assists += pA;
        if (group?.use_bonus && pG >= (group.bonus_goals_threshold || 2) && pA >= (group.bonus_assists_threshold || 2)) statsMap[pid].points += 1;
        if (group?.use_clean_sheet_bonus && cs) statsMap[pid].points += 1;
        if (group?.use_gk_bonus && statsMap[pid].role === 'Portiere' && os < (group.gk_bonus_threshold || 5)) statsMap[pid].points += 1;
      });
    };
    proc(m.team_a_players, m.team_a_score, m.team_b_score, aW, m.team_b_score === 0);
    proc(m.team_b_players, m.team_b_score, m.team_a_score, !aW && !isD, m.team_a_score === 0);
  });
  return Object.values(statsMap).sort((a, b) => b.points - a.points || (b.goals_done - b.goals_suffered) - (a.goals_done - a.goals_suffered));
};

export const importPlayersExcel = async (groupId: string, data: any[]) => {
  for (const p of data) {
    const normalized: any = {};
    Object.keys(p).forEach(k => {
      normalized[k.toLowerCase().trim()] = p[k];
    });

    const nickname = normalized['nickname'] || normalized['nick'] || '';
    if (!nickname || String(nickname).trim() === '') continue;

    const nomeCompleto = normalized['nome'] || normalized['name'] || '';
    const cognome = normalized['cognome'] || normalized['surname'] || '';
    const role = normalized['ruolo'] || normalized['role'] || 'Attaccante';
    const strength = normalized['forza'] || normalized['strength'] || 5;
    const rawBirthDate = normalized['data di nascita'] || normalized['data nascita'] || normalized['birth_date'] || normalized['date_of_birth'] || normalized['nascita'] || normalized['data'];

    let date_of_birth: string | undefined = undefined;

    if (rawBirthDate) {
      if (rawBirthDate instanceof Date) {
        date_of_birth = rawBirthDate.toISOString().split('T')[0];
      } else if (typeof rawBirthDate === 'number') {
        try {
          const d = new Date((rawBirthDate - 25569) * 86400 * 1000);
          if (!isNaN(d.getTime())) {
            date_of_birth = d.toISOString().split('T')[0];
          }
        } catch (e) {}
      } else if (typeof rawBirthDate === 'string' && rawBirthDate.trim().length > 0) {
        const cleanDate = rawBirthDate.trim();
        const parts = cleanDate.split(/[\/\-.]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            date_of_birth = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else if (parts[2].length === 4) {
            date_of_birth = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else if (parts[2].length === 2) {
             const year = parseInt(parts[2]) > 30 ? `19${parts[2]}` : `20${parts[2]}`;
             date_of_birth = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        if (!date_of_birth) {
          const d = new Date(cleanDate);
          if (!isNaN(d.getTime())) {
            date_of_birth = d.toISOString().split('T')[0];
          }
        }
      }
    }

    let strengthNum = parseFloat(String(strength).replace(',', '.'));
    if (isNaN(strengthNum)) strengthNum = 5;

    await savePlayer({
      nickname: String(nickname).trim(),
      role: String(role).trim(),
      strength: strengthNum,
      date_of_birth: date_of_birth,
      name: nomeCompleto.trim() || undefined,
      surname: cognome.trim() || undefined,
      group_id: groupId
    });
  }
};

export const exportPlayersExcel = async (groupId: string): Promise<any[]> => {
  const players = await fetchPlayers({ group_id: groupId });
  return players.map(p => {
    return {
      'Nickname': p.nickname,
      'Nome': p.name || '',
      'Cognome': p.surname || '',
      'Data di Nascita': p.date_of_birth || '',
      'Ruolo': p.role,
      'Forza': p.strength
    };
  });
};
