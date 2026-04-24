import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export interface Group {
  id: string;
  name: string;
  admin_id?: string;
  player_count: number;
  role: 'owner' | 'admin' | 'viewer' | 'member';
  storage_type: 'local' | 'cloud';
  show_scorers?: boolean;
  show_assists?: boolean;
  use_bonus?: boolean;
  bonus_goals_threshold?: number;
  bonus_assists_threshold?: number;
  use_clean_sheet_bonus?: boolean;
  use_gk_bonus?: boolean;
  gk_bonus_threshold?: number;
  match_type?: number;
  points_win?: number;
  points_draw?: number;
  admin_token?: string;
  viewer_token?: string;
  updated_at?: string;
}

export interface Player {
  id: string;
  nickname: string;
  role: string;
  strength: number;
  age: number;
  date_of_birth?: string;
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
  location?: string;
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
  clean_sheets: number;
  incisivity: number;
  bonus_points: number;
  last_trend?: 'W' | 'L' | 'D';
}

const calculateAge = (dob: string) => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

// --- GRUPPI ---

export const fetchGroups = async (): Promise<Group[]> => {
  let local: Group[] = [];
  let cloudCache: Group[] = [];

  try {
    const saved = await AsyncStorage.getItem('local_groups');
    if (saved) local = JSON.parse(saved).map((g: any) => ({ ...g, storage_type: 'local' }));
  } catch (e) {}

  try {
    const savedCloud = await AsyncStorage.getItem('cloud_groups_cache');
    if (savedCloud) cloudCache = JSON.parse(savedCloud);
  } catch (e) {}

  const allGroups = [...local];
  cloudCache.forEach(cg => {
    if (!allGroups.find(lg => lg.id === cg.id)) allGroups.push(cg);
  });

  for (const g of allGroups) {
    try {
      const pSaved = await AsyncStorage.getItem(`players_${g.id}`);
      g.player_count = pSaved ? JSON.parse(pSaved).length : 0;
    } catch (e) {
      g.player_count = 0;
    }
  }
  return allGroups;
};

const setNeedsSync = async (groupId: string) => {
  await AsyncStorage.setItem(`needs_sync_${groupId}`, 'true');
};

export const checkSyncNeeded = async (groupId: string): Promise<boolean> => {
  const localVal = await AsyncStorage.getItem(`needs_sync_${groupId}`);
  if (localVal === 'true') return true;

  try {
    const lastSync = await AsyncStorage.getItem(`last_sync_timestamp_${groupId}`);
    if (!lastSync) return false;

    const { data: gData } = await supabase.from('groups').select('updated_at').eq('id', groupId).maybeSingle();
    if (gData?.updated_at && new Date(gData.updated_at) > new Date(lastSync)) return true;

    const { data: pData } = await supabase.from('players').select('updated_at').eq('group_id', groupId).order('updated_at', { ascending: false }).limit(1);
    if (pData?.[0]?.updated_at && new Date(pData[0].updated_at) > new Date(lastSync)) return true;

    const { data: mData } = await supabase.from('matches').select('updated_at').eq('group_id', groupId).order('updated_at', { ascending: false }).limit(1);
    if (mData?.[0]?.updated_at && new Date(mData[0].updated_at) > new Date(lastSync)) return true;

  } catch (e) {
    console.log("Check update failed:", e);
  }

  return false;
};

export const syncCloudData = async (groupId?: string): Promise<void> => {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    const joinedCloudIdsSaved = await AsyncStorage.getItem('joined_cloud_groups');
    const joinedCloudIds: string[] = joinedCloudIdsSaved ? JSON.parse(joinedCloudIdsSaved) : [];

    if (joinedCloudIds.length === 0) {
      await AsyncStorage.setItem('cloud_groups_cache', JSON.stringify([]));
    } else {
      const { data: groupsData, error: groupsError } = await supabase.from('groups').select('*').in('id', joinedCloudIds);
      if (groupsData) {
        const rolesSaved = await AsyncStorage.getItem('cloud_group_roles');
        const roles = rolesSaved ? JSON.parse(rolesSaved) : {};
        const allCloud = groupsData.map((g) => {
          let role: 'owner' | 'admin' | 'viewer' | 'member' = 'viewer';
          if (user && g.admin_id === user.id) role = 'owner';
          else if (roles[g.id]) role = roles[g.id];
          return { ...g, storage_type: 'cloud', role };
        });
        await AsyncStorage.setItem('cloud_groups_cache', JSON.stringify(allCloud));
      }
    }

    if (groupId) {
      const { data: pData } = await supabase.from('players').select('*').eq('group_id', groupId);
      if (pData) await AsyncStorage.setItem(`players_${groupId}`, JSON.stringify(pData));

      const { data: mData } = await supabase.from('matches').select('*').eq('group_id', groupId).order('date', { ascending: false });
      if (mData) await AsyncStorage.setItem(`matches_${groupId}`, JSON.stringify(mData));

      await AsyncStorage.removeItem(`needs_sync_${groupId}`);
      await AsyncStorage.setItem(`last_sync_timestamp_${groupId}`, new Date().toISOString());
    }
  } catch (e) {
    console.error("Sync error:", e);
    throw e;
  }
};

export const createGroup = async (name: string, storageType: 'local' | 'cloud' = 'local'): Promise<void> => {
  return createGroupExtended(name, storageType, {});
};

export const createGroupExtended = async (name: string, storageType: 'local' | 'cloud', options: Partial<Group>): Promise<void> => {
  const newGroupId = Math.random().toString(36).substring(7);
  const newGroup: Group = {
    id: newGroupId, name, player_count: 0, role: 'owner', storage_type: storageType,
    show_scorers: true, show_assists: true, use_bonus: true, bonus_goals_threshold: 2, bonus_assists_threshold: 2,
    use_clean_sheet_bonus: true, use_gk_bonus: true, gk_bonus_threshold: 5, points_win: options.points_win ?? 3, points_draw: options.points_draw ?? 1
  };

  if (storageType === 'local') {
    const groups = await fetchGroups();
    const localOnly = groups.filter(g => g.storage_type === 'local');
    await AsyncStorage.setItem('local_groups', JSON.stringify([...localOnly, newGroup]));
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('groups').insert([{
      name, storage_type: 'cloud', admin_id: user?.id,
      show_scorers: newGroup.show_scorers, show_assists: newGroup.show_assists, use_bonus: newGroup.use_bonus,
      bonus_goals_threshold: newGroup.bonus_goals_threshold, bonus_assists_threshold: newGroup.bonus_assists_threshold,
      use_clean_sheet_bonus: newGroup.use_clean_sheet_bonus, use_gk_bonus: newGroup.use_gk_bonus,
      gk_bonus_threshold: newGroup.gk_bonus_threshold, points_win: newGroup.points_win, points_draw: newGroup.points_draw
    }]).select().single();

    if (error) throw error;
    if (data) {
      const joinedSaved = await AsyncStorage.getItem('joined_cloud_groups');
      const joined: string[] = joinedSaved ? JSON.parse(joinedSaved) : [];
      if (!joined.includes(data.id)) await AsyncStorage.setItem('joined_cloud_groups', JSON.stringify([...joined, data.id]));
      await syncCloudData();
    }
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
    await setNeedsSync(groupId);
    const { data, error } = await supabase.from('groups').update(payload).eq('id', groupId).select().single();
    if (error) throw error;
    return { ...data, storage_type: 'cloud' } as Group;
  }
};

export const leaveGroup = async (groupId: string): Promise<void> => {
  try {
    const joinedSaved = await AsyncStorage.getItem('joined_cloud_groups');
    if (joinedSaved) {
      const joined: string[] = JSON.parse(joinedSaved);
      await AsyncStorage.setItem('joined_cloud_groups', JSON.stringify(joined.filter(id => id !== groupId)));
    }
    await AsyncStorage.removeItem(`players_${groupId}`);
    await AsyncStorage.removeItem(`matches_${groupId}`);
    const localSaved = await AsyncStorage.getItem('local_groups');
    if (localSaved) {
      const localGroups = JSON.parse(localSaved);
      await AsyncStorage.setItem('local_groups', JSON.stringify(localGroups.filter((g: any) => g.id !== groupId)));
    }
    await syncCloudData();
  } catch (e) {
    console.error("Leave group error:", e);
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
    if (!user) throw new Error("Autenticazione richiesta");
    if (group.admin_id === user.id) {
       const { error } = await supabase.from('groups').delete().eq('id', groupId);
       if (error) throw error;
       const joinedSaved = await AsyncStorage.getItem('joined_cloud_groups');
       if (joinedSaved) {
         const joined: string[] = JSON.parse(joinedSaved);
         await AsyncStorage.setItem('joined_cloud_groups', JSON.stringify(joined.filter(id => id !== groupId)));
       }
       await AsyncStorage.removeItem(`players_${groupId}`);
       await AsyncStorage.removeItem(`matches_${groupId}`);
       await syncCloudData();
    }
  }
};

export const joinGroup = async (token: string): Promise<void> => {
  const { data, error } = await supabase.from('groups').select('*').or(`id.eq.${token},admin_token.eq.${token},viewer_token.eq.${token}`).maybeSingle();
  if (error || !data) throw new Error('Token non valido');
  let role: 'owner' | 'admin' | 'viewer' = 'viewer';
  if (token === data.id) role = 'owner';
  else if (token === data.admin_token) role = 'admin';
  const joinedSaved = await AsyncStorage.getItem('joined_cloud_groups');
  const joined: string[] = joinedSaved ? JSON.parse(joinedSaved) : [];
  if (!joined.includes(data.id)) await AsyncStorage.setItem('joined_cloud_groups', JSON.stringify([...joined, data.id]));
  const rolesSaved = await AsyncStorage.getItem('cloud_group_roles');
  const roles = rolesSaved ? JSON.parse(rolesSaved) : {};
  roles[data.id] = role;
  await AsyncStorage.setItem('cloud_group_roles', JSON.stringify(roles));
  await syncCloudData(data.id);
};

// --- GIOCATORI ---

export const fetchPlayers = async (params: { group_id: string; search?: string; role?: string }): Promise<Player[]> => {
  let players: any[] = [];
  const saved = await AsyncStorage.getItem(`players_${params.group_id}`);
  if (saved) players = JSON.parse(saved);
  const mapped = players.map(p => ({ ...p, age: p.date_of_birth ? calculateAge(p.date_of_birth) : (p.age || 0) }));
  let filtered = mapped;
  if (params.search) filtered = filtered.filter(p => p.nickname.toLowerCase().includes(params.search!.toLowerCase()));
  if (params.role) filtered = filtered.filter(p => p.role === params.role);
  return filtered;
};

export const savePlayer = async (player: Partial<Player> & { group_id: string }): Promise<void> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === player.group_id);
  const players = await fetchPlayers({ group_id: player.group_id });
  const playerWithId = { ...player, id: player.id || Math.random().toString(36).substring(7) } as Player;
  const updatedLocal = player.id ? players.map(p => p.id === player.id ? playerWithId : p) : [...players, playerWithId];
  await AsyncStorage.setItem(`players_${player.group_id}`, JSON.stringify(updatedLocal));
  if (group?.storage_type === 'cloud') {
    await setNeedsSync(player.group_id);
    const dataToSave = { nickname: player.nickname, name: player.name, surname: player.surname, date_of_birth: player.date_of_birth, role: player.role, strength: player.strength, group_id: player.group_id };
    try {
      if (player.id && player.id.length > 20) await supabase.from('players').update(dataToSave).eq('id', player.id);
      else await supabase.from('players').insert([dataToSave]);
    } catch (e) {}
  }
};

export const deletePlayer = async (playerId: string): Promise<void> => {
  const groups = await fetchGroups();
  for (const g of groups) {
    const players = await fetchPlayers({ group_id: g.id });
    if (players.find(p => p.id === playerId)) {
      if (g.storage_type === 'local') await AsyncStorage.setItem(`players_${g.id}`, JSON.stringify(players.filter(p => p.id !== playerId)));
      else { await setNeedsSync(g.id); await supabase.from('players').delete().eq('id', playerId); }
      return;
    }
  }
};

// --- PARTITE ---

export const fetchMatches = async (groupId: string): Promise<Match[]> => {
  const saved = await AsyncStorage.getItem(`matches_${groupId}`);
  return saved ? JSON.parse(saved) : [];
};

export const saveMatchResult = async (match: Match): Promise<void> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === match.group_id);
  const matches = await fetchMatches(match.group_id);
  const matchWithId = { ...match, id: match.id || Math.random().toString(36).substring(7) };
  const updatedLocal = match.id ? matches.map(m => m.id === match.id ? matchWithId : m) : [matchWithId, ...matches];
  await AsyncStorage.setItem(`matches_${match.group_id}`, JSON.stringify(updatedLocal));
  if (group?.storage_type === 'cloud') {
    await setNeedsSync(match.group_id);
    const dataToSave = { group_id: match.group_id, team_a_players: match.team_a_players, team_b_players: match.team_b_players, team_a_score: match.team_a_score, team_b_score: match.team_b_score, team_a_name: match.team_a_name, team_b_name: match.team_b_name, date: match.date, goals: match.goals, assists: match.assists, team_a_own_goals: match.team_a_own_goals, team_b_own_goals: match.team_b_own_goals, description: match.description, team_a_color: match.team_a_color, team_b_color: match.team_b_color, location: match.location };
    try {
      if (match.id && match.id.length > 20) await supabase.from('matches').update(dataToSave).eq('id', match.id);
      else await supabase.from('matches').insert([dataToSave]);
    } catch (e) {}
  }
};

export const deleteMatch = async (matchId: string): Promise<void> => {
  const groups = await fetchGroups();
  for (const g of groups) {
    const matches = await fetchMatches(g.id);
    if (matches.find(m => m.id === matchId)) {
      if (g.storage_type === 'local') await AsyncStorage.setItem(`matches_${g.id}`, JSON.stringify(matches.filter(m => m.id !== matchId)));
      else { await setNeedsSync(g.id); await supabase.from('matches').delete().eq('id', matchId); }
      return;
    }
  }
};

export const calculateStandings = async (groupId: string): Promise<PlayerStats[]> => {
  const players = await fetchPlayers({ group_id: groupId });
  const matches = await fetchMatches(groupId);
  const groups = await fetchGroups();
  const group = groups.find(g => String(g.id).trim() === String(groupId).trim());
  const statsMap: Record<string, PlayerStats> = {};

  players.forEach(p => {
    const safeId = String(p.id).trim();
    statsMap[safeId] = { player_id: safeId, nickname: p.nickname, role: p.role, played: 0, won: 0, drawn: 0, lost: 0, points: 0, goals_done: 0, goals_suffered: 0, individual_goals: 0, individual_assists: 0, clean_sheets: 0, incisivity: 0, bonus_points: 0 };
  });

  [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(m => {
    const sA = Number(m.team_a_score || 0), sB = Number(m.team_b_score || 0), isD = sA === sB, aW = sA > sB;
    const proc = (pids: any[], s: number, os: number, win: boolean, cs: boolean) => {
      if (!pids || !Array.isArray(pids)) return;
      pids.forEach(rawPid => {
        let pid = String(typeof rawPid === 'object' ? (rawPid.id || rawPid.player_id || '') : rawPid).trim();
        if (!statsMap[pid]) {
          const found = players.find(p => String(p.id).trim() === pid || p.nickname.toLowerCase().trim() === String(rawPid?.nickname || rawPid).toLowerCase().trim());
          if (found) pid = String(found.id).trim();
        }
        if (!statsMap[pid]) return;
        const ps = statsMap[pid];
        ps.played++; ps.goals_done += s; ps.goals_suffered += os;
        if (isD) { ps.drawn++; ps.points += Number(group?.points_draw ?? 1); ps.last_trend = 'D'; }
        else if (win) { ps.won++; ps.points += Number(group?.points_win ?? 3); ps.last_trend = 'W'; }
        else { ps.lost++; ps.last_trend = 'L'; }
        const pG = Number(m.goals?.[pid] || Object.entries(m.goals || {}).find(([k]) => String(k).trim() === pid)?.[1] || 0);
        const pA = Number(m.assists?.[pid] || Object.entries(m.assists || {}).find(([k]) => String(k).trim() === pid)?.[1] || 0);
        ps.individual_goals += pG; ps.individual_assists += pA; ps.incisivity = ps.individual_goals + ps.individual_assists;
        if (cs) ps.clean_sheets++;
        let matchBonus = 0;
        if (group?.use_bonus && pG >= (group.bonus_goals_threshold || 2) && pA >= (group.bonus_assists_threshold || 2)) matchBonus++;
        if (group?.use_clean_sheet_bonus && cs) matchBonus++;
        if (group?.use_gk_bonus && ps.role === 'Portiere' && os < (group.gk_bonus_threshold || 5)) matchBonus++;
        ps.points += matchBonus; ps.bonus_points += matchBonus;
      });
    };
    proc(m.team_a_players, sA, sB, aW, sB === 0);
    proc(m.team_b_players, sB, sA, !aW && !isD, sA === 0);
  });
  return Object.values(statsMap).sort((a, b) => b.points - a.points || (b.goals_done - b.goals_suffered) - (a.goals_done - a.goals_suffered));
};

export const createFullBackup = async (groupId: string): Promise<string> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new Error('Gruppo non trovato');
  const players = await fetchPlayers({ group_id: groupId });
  const matches = await fetchMatches(groupId);
  return JSON.stringify({ group, players, matches, version: '1.0', timestamp: new Date().toISOString() }, null, 2);
};

export const restoreFullBackup = async (groupId: string, jsonString: string): Promise<void> => {
  const backup = JSON.parse(jsonString);
  if (!backup.group || !backup.players || !backup.matches) throw new Error('Backup non valido');
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new Error('Gruppo non trovato');
  if (group.storage_type === 'local') {
    await AsyncStorage.setItem(`players_${groupId}`, JSON.stringify(backup.players));
    await AsyncStorage.setItem(`matches_${groupId}`, JSON.stringify(backup.matches));
  } else {
    await supabase.from('players').delete().eq('group_id', groupId);
    await supabase.from('matches').delete().eq('group_id', groupId);
    if (backup.players.length > 0) await supabase.from('players').insert(backup.players.map((p: any) => ({ nickname: p.nickname, name: p.name, surname: p.surname, date_of_birth: p.date_of_birth, role: p.role, strength: p.strength, group_id: groupId })));
    if (backup.matches.length > 0) await supabase.from('matches').insert(backup.matches.map((m: any) => ({ ...m, group_id: groupId, id: undefined })));
    await syncCloudData(groupId);
  }
};

export const JERSEY_COLORS = [{ value: 'Bianca', hex: '#FFFFFF' }, { value: 'Rossa', hex: '#FF3B30' }, { value: 'Blu', hex: '#007AFF' }, { value: 'Verde', hex: '#34C759' }, { value: 'Gialla', hex: '#FFD60A' }, { value: 'Nera', hex: '#1C1C1E' }];
export const ROLE_COLORS: Record<string, string> = { 'Attaccante': '#FF3B30', 'Mediana': '#34C759', 'Difensore': '#007AFF', 'Portiere': '#FF9500' };
export const ROLES = ['Portiere', 'Difensore', 'Mediana', 'Attaccante'];
export const STRENGTH_VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
export interface TeamResult { team_a: Player[]; team_b: Player[]; team_a_total_strength: number; team_b_total_strength: number; team_a_avg_age: number; team_b_avg_age: number; team_a_name: string; team_b_name: string; team_a_color: string; team_b_color: string; match_location?: string; description?: string; }

export const generateTeams = async (playerIds: string[], matchType: number, groupId: string, nameA: string, nameB: string, colorA: string, colorB: string, previousTeamAIds?: string[]): Promise<TeamResult> => {
  const players = await fetchPlayers({ group_id: groupId });
  const selected = players.filter(p => playerIds.includes(p.id));

  // Separa portieri dagli altri
  const gks = selected.filter(p => p.role === 'Portiere').sort((a, b) => b.strength - a.strength);
  const others = selected.filter(p => p.role !== 'Portiere');

  let bestResult: { tA: Player[], tB: Player[], sA: number, sB: number, diff: number, score: number } | null = null;

  // Tentativi multipli per trovare il miglior bilanciamento possibile (minimo scarto)
  const iterations = 500;
  for (let i = 0; i < iterations; i++) {
    const currentOthers = [...others].sort(() => Math.random() - 0.5); // Shuffle casuale
    const teamA: Player[] = [], teamB: Player[] = [];
    let sA = 0, sB = 0;

    // Distribuisci portieri (1 per squadra)
    if (gks.length >= 2) {
      teamA.push(gks[0]); sA += gks[0].strength;
      teamB.push(gks[1]); sB += gks[1].strength;
    } else if (gks.length === 1) {
      teamA.push(gks[0]); sA += gks[0].strength;
    }

    // Distribuisci gli altri in modo greedy basato sullo scarto attuale
    currentOthers.forEach(p => {
      // Priorità a chi ha meno forza e meno giocatori (per non creare squadre 4 vs 6)
      const forceBalance = sA <= sB;
      const countBalance = teamA.length <= teamB.length;

      // Cerchiamo di bilanciare sia la forza che il numero di componenti
      if (teamA.length < matchType && (teamB.length >= matchType || forceBalance)) {
        teamA.push(p);
        sA += p.strength;
      } else if (teamB.length < matchType) {
        teamB.push(p);
        sB += p.strength;
      } else {
        // Se una squadra è già piena (matchType), aggiungiamo all'altra
        teamA.push(p);
        sA += p.strength;
      }
    });

    const diff = Math.abs(sA - sB);

    // Se abbiamo una configurazione precedente, penalizziamo se è identica
    let identityPenalty = 0;
    if (previousTeamAIds && previousTeamAIds.length > 0) {
      const currentAIds = teamA.map(p => p.id);
      const intersection = currentAIds.filter(id => previousTeamAIds.includes(id));
      // Se la squadra A è quasi identica alla precedente (tutti tranne 0 o 1 giocatore diversi)
      if (intersection.length >= teamA.length - 1) {
        identityPenalty = 5; // Aggiungiamo un forte malus alla differenza per scartarla
      }
    }

    const totalScore = diff + identityPenalty;

    if (!bestResult || totalScore < bestResult.score) {
      bestResult = { tA: teamA, tB: teamB, sA, sB, diff, score: totalScore };
      if (totalScore <= 0.5) break;
    }
  }

  const { tA, tB, sA, sB } = bestResult!;

  // Ordinamento finale dei giocatori per ruolo e forza
  const roleOrder: Record<string, number> = { 'Portiere': 1, 'Difensore': 2, 'Mediana': 3, 'Attaccante': 4 };
  const sortPlayers = (list: Player[]) => [...list].sort((a, b) => {
    if (roleOrder[a.role] !== roleOrder[b.role]) {
      return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
    }
    return b.strength - a.strength;
  });

  const finalTeamA = sortPlayers(tA);
  const finalTeamB = sortPlayers(tB);

  const avgAge = (t: Player[]) => t.length ? Number((t.reduce((acc, p) => acc + p.age, 0) / t.length).toFixed(1)) : 0;

  return {
    team_a: finalTeamA,
    team_b: finalTeamB,
    team_a_total_strength: Number(sA.toFixed(1)),
    team_b_total_strength: Number(sB.toFixed(1)),
    team_a_avg_age: avgAge(finalTeamA),
    team_b_avg_age: avgAge(finalTeamB),
    team_a_name: nameA,
    team_b_name: nameB,
    team_a_color: colorA,
    team_b_color: colorB
  };
};

export const importPlayersExcel = async (groupId: string, data: any[]) => {
  for (const p of data) {
    const n: any = {}; Object.keys(p).forEach(k => n[k.toLowerCase().trim()] = p[k]);
    const nick = n['nickname'] || n['nick'] || '';
    if (!nick) continue;
    await savePlayer({ nickname: nick, role: n['ruolo'] || n['role'] || 'Attaccante', strength: n['forza'] || n['strength'] || 5, group_id: groupId });
  }
};

export const exportPlayersExcel = async (groupId: string) => {
  const players = await fetchPlayers({ group_id: groupId });
  return players.map(p => ({ Nickname: p.nickname, Ruolo: p.role, Forza: p.strength, Età: p.age }));
};

export const scheduleBirthdayNotifications = async () => {
  try {
    const groups = await fetchGroups();
    for (const g of groups) {
      const players = await fetchPlayers({ group_id: g.id });
      for (const p of players) {
        if (p.date_of_birth) {
          const dob = new Date(p.date_of_birth);
          const today = new Date();
          if (dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth()) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "🎂 Buon Compleanno!",
                body: `Oggi è il compleanno di ${p.nickname}! Auguri! ⚽`,
                data: { playerId: p.id },
              },
              trigger: null, // Subito se è oggi
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Birthday notification error:", e);
  }
};
