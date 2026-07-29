import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface Group {
  id: string;
  name: string;
  admin_id?: string;
  player_count: number;
  role: 'owner' | 'admin' | 'viewer' | 'member';
  storage_type: 'local' | 'cloud';
  group_type?: 'championship' | 'tournament';
  num_teams?: number;
  num_groups?: number;
  show_scorers?: boolean;
  show_assists?: boolean;
  use_bonus?: boolean;
  bonus_goals_threshold?: number;
  bonus_assists_threshold?: number;
  use_clean_sheet_bonus?: boolean;
  use_gk_bonus?: boolean;
  gk_bonus_threshold?: number;
  gk_bonus_excluded_roles?: string[];
  use_balance_bonus?: boolean;
  match_type?: number;

  points_win?: number;
  points_draw?: number;
  tie_breaker_1?: string;
  tie_breaker_2?: string;
  admin_token?: string;
  viewer_token?: string;
  updated_at?: string;
  linked_group_ids?: string[]; // IDs dei tornei collegati a questo campionato
  import_linked_data?: boolean; // Se importare goal/assist dai tornei collegati
  tournament_match_weight?: number; // Quanto vale una partita di torneo rispetto al campionato (es. 2)
  tournament_win_bonus?: number; // Punti bonus in classifica campionato per chi vince il torneo
  tournament_2nd_bonus?: number;
  tournament_3rd_bonus?: number;
  tournament_4th_bonus?: number;
  tournament_group_winner_bonus?: number;
  tournament_top_scorer_bonus?: number;
  tournament_top_assistant_bonus?: number;
  tournament_3rd_team_name?: string;
  tournament_4th_team_name?: string;
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
  status?: 'scheduled' | 'played';
  match_phase?: 'group' | 'quarterfinal' | 'semifinal' | 'final' | 'third_place';
  tournament_group?: number;
  team_a_penalties?: number;
  team_b_penalties?: number;
  team_a_placeholder?: string;
  team_b_placeholder?: string;
  team_a_logo?: string;
  team_b_logo?: string;
  exclude_def_bonus?: boolean;
  knockout_index?: number; // Indice univoco per identificare gli incontri della fase finale
}


export const CAREER_FIELDS = [
  'linked_group_ids', 'import_linked_data', 'tournament_match_weight',
  'tournament_win_bonus', 'tournament_2nd_bonus', 'tournament_3rd_bonus',
  'tournament_4th_bonus', 'tournament_group_winner_bonus',
  'tournament_top_scorer_bonus', 'tournament_top_assistant_bonus',
  'tournament_3rd_team_name', 'tournament_4th_team_name'
];

export const syncGroupMetadata = async (groupId: string, payload: Partial<Group>): Promise<void> => {
  const metadata: any = {};
  let hasMetadata = false;
  CAREER_FIELDS.forEach(field => {
    if ((payload as any)[field] !== undefined) {
      metadata[field] = (payload as any)[field];
      hasMetadata = true;
    }
  });

  if (!hasMetadata) return;

  try {
    const { data: existing } = await supabase
      .from('matches')
      .select('id, description')
      .eq('group_id', groupId)
      .eq('team_a_name', 'METADATA')
      .eq('team_b_name', 'SYSTEM')
      .maybeSingle();

    let finalMetadata = { ...metadata };
    if (existing && existing.description?.startsWith('JSON_METADATA:')) {
      try {
        const oldMetadata = JSON.parse(existing.description.replace('JSON_METADATA:', ''));
        finalMetadata = { ...oldMetadata, ...metadata };
      } catch (e) {}
    }

    const metadataString = `JSON_METADATA:${JSON.stringify(finalMetadata)}`;

    if (existing) {
      await supabase.from('matches').update({ description: metadataString }).eq('id', existing.id);
    } else {
      await supabase.from('matches').insert([{
        group_id: groupId,
        description: metadataString,
        status: 'scheduled',
        date: new Date(0).toISOString(),
        team_a_name: 'METADATA',
        team_b_name: 'SYSTEM',
        team_a_players: [],
        team_b_players: [],
        team_a_score: 0,
        team_b_score: 0,
        team_a_color: '',
        team_b_color: '',
        match_phase: 'group'
      }]);
    }
  } catch (e) {
    console.error("Errore sincronizzazione metadati:", e);
  }
};

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
  personal_bonus_count: number;
  defense_bonus_count: number;
  tournament_count: number; // Numero di tornei disputati
  tournament_bonus_points: number; // Punti bonus da posizioni tornei
  tournament_details?: { name: string, points: number, achievements: string[] }[]; // Dettagli per il palmarès
  career_divisor: number; // Partite Campionato + (Tornei * Peso)
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

// --- LICENZE E PREMIUM ---

export const checkPremiumStatus = async (): Promise<boolean> => {
  try {
    const cachedPremium = await AsyncStorage.getItem('is_premium_user');
    if (cachedPremium === 'true') return true;

    let { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 200));
        const res = await supabase.auth.getUser();
        if (res.data?.user) {
          user = res.data.user;
          break;
        }
      }
    }

    if (!user) return false;

    const { data, error } = await supabase
      .from('premium_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return cachedPremium === 'true';

    const isPremium = !!data;
    await AsyncStorage.setItem('is_premium_user', isPremium ? 'true' : 'false');

    return isPremium;
  } catch (e) {
    const cached = await AsyncStorage.getItem('is_premium_user');
    return cached === 'true';
  }
};

export const redeemCode = async (code: string): Promise<void> => {
  const cleanCode = code.trim();
  const MASTER_CODE = "W@lcome-PRO-member2026";

  const isMaster = cleanCode.toLowerCase() === MASTER_CODE.toLowerCase();

  if (isMaster) {
    await AsyncStorage.setItem('is_premium_user', 'true');
  }

  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 200));
      const res = await supabase.auth.getUser();
      if (res.data?.user) { user = res.data.user; break; }
    }
  }

  if (!isMaster && !user) throw new Error("Connessione al server in corso... Riprova tra pochi istanti.");

  try {
    if (!isMaster) {
      const { data: codeData, error: codeError } = await supabase
        .from('activation_codes')
        .select('*')
        .ilike('code', cleanCode)
        .maybeSingle();

      if (codeError || !codeData) {
        throw new Error("Codice non valido.");
      }

      await supabase
        .from('activation_codes')
        .update({
          is_used: true,
          used_by: user?.id,
          used_at: new Date().toISOString()
        })
        .ilike('code', cleanCode);
    }

    if (user) {
      await supabase
        .from('premium_users')
        .upsert([{ user_id: user.id }], { onConflict: 'user_id' });
    }

    await AsyncStorage.setItem('is_premium_user', 'true');

  } catch (e) {
    if (!isMaster) throw e;
  }
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

  await Promise.all(allGroups.map(async (g) => {
    try {
      const gId = String(g.id || '').trim();
      if (!gId) return;

      const pSavedPromise = AsyncStorage.getItem(`players_${gId}`);
      const overridesPromises = CAREER_FIELDS.map(field =>
        AsyncStorage.getItem(`override_${field}_${gId}`).then(val => ({ field, val }))
      );

      const [pSaved, ...overrides] = await Promise.all([pSavedPromise, ...overridesPromises]);

      g.player_count = pSaved ? JSON.parse(pSaved).length : 0;

      overrides.forEach(({ field, val }) => {
        if (val !== null && val !== undefined) {
          try {
            (g as any)[field] = JSON.parse(val);
          } catch (e) {}
        }
      });
    } catch (e) {
      g.player_count = 0;
    }
  }));

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
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    const joinedCloudIdsSaved = await AsyncStorage.getItem('joined_cloud_groups');
    const joinedCloudIds: string[] = joinedCloudIdsSaved ? JSON.parse(joinedCloudIdsSaved) : [];

    let allCloudGroups: any[] = [];

    if (user) {
      const { data: owned } = await supabase.from('groups').select('*').eq('admin_id', user.id);
      if (owned) allCloudGroups = [...owned];
    }

    const validUuids = joinedCloudIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
    if (validUuids.length > 0) {
      const { data: invited } = await supabase.from('groups').select('*').in('id', validUuids);
      if (invited) {
        invited.forEach(ig => {
          if (!allCloudGroups.find(ag => ag.id === ig.id)) allCloudGroups.push(ig);
        });
      }
    }

    if (allCloudGroups.length > 0 || user) {
      const rolesSaved = await AsyncStorage.getItem('cloud_group_roles');
      const roles = rolesSaved ? JSON.parse(rolesSaved) : {};

      const mapped = allCloudGroups.map(g => ({
        ...g,
        storage_type: 'cloud',
        role: (user && g.admin_id === user.id) ? 'owner' : (roles[g.id] || 'viewer')
      }));

      await AsyncStorage.setItem('cloud_groups_cache', JSON.stringify(mapped));
      const finalJoinedIds = Array.from(new Set([...joinedCloudIds, ...allCloudGroups.map(g => g.id)]));
      await AsyncStorage.setItem('joined_cloud_groups', JSON.stringify(finalJoinedIds));
    }

    if (groupId) {
      const safeGid = String(groupId).trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeGid)) {
        const { data: pData } = await supabase.from('players').select('*').eq('group_id', safeGid);
        if (pData) await AsyncStorage.setItem(`players_${safeGid}`, JSON.stringify(pData));

        const { data: mData } = await supabase.from('matches').select('*').eq('group_id', safeGid).order('date', { ascending: false });
        if (mData) {
          await AsyncStorage.setItem(`matches_${safeGid}`, JSON.stringify(mData));
          await applyMetadata(safeGid, mData);
        }

        await AsyncStorage.removeItem(`needs_sync_${safeGid}`);
        await AsyncStorage.setItem(`last_sync_timestamp_${safeGid}`, new Date().toISOString());
      }
    }
  } catch (e) {
    console.warn("Sync error:", e);
  }
};

export const createGroup = async (name: string, storageType: 'local' | 'cloud' = 'local'): Promise<void> => {
  return createGroupExtended(name, storageType, {});
};

export const createGroupExtended = async (name: string, storageType: 'local' | 'cloud', options: Partial<Group>): Promise<void> => {
  const newGroupId = Math.random().toString(36).substring(7);
  const newGroup: Group = {
    id: newGroupId, name, player_count: 0, role: 'owner', storage_type: storageType,
    group_type: options.group_type || 'championship',
    num_teams: options.num_teams || 4,
    num_groups: options.num_groups || 1,
    show_scorers: true, show_assists: true, use_bonus: true, bonus_goals_threshold: 2, bonus_assists_threshold: 2,
    use_clean_sheet_bonus: true, use_gk_bonus: true, gk_bonus_threshold: 5, points_win: options.points_win ?? 3, points_draw: options.points_draw ?? 1,
    tie_breaker_1: 'ratio', tie_breaker_2: 'incisivity'
  };

  if (storageType === 'local') {
    const groups = await fetchGroups();
    const localOnly = groups.filter(g => g.storage_type === 'local');
    await AsyncStorage.setItem('local_groups', JSON.stringify([...localOnly, newGroup]));
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('groups').insert([{
      name, storage_type: 'cloud', admin_id: user?.id,
      group_type: newGroup.group_type, num_teams: newGroup.num_teams, num_groups: newGroup.num_groups,
      show_scorers: newGroup.show_scorers, show_assists: newGroup.show_assists, use_bonus: newGroup.use_bonus,
      bonus_goals_threshold: newGroup.bonus_goals_threshold, bonus_assists_threshold: newGroup.bonus_assists_threshold,
      use_clean_sheet_bonus: newGroup.use_clean_sheet_bonus, use_gk_bonus: newGroup.use_gk_bonus,
      gk_bonus_threshold: newGroup.gk_bonus_threshold,
      gk_bonus_excluded_roles: newGroup.gk_bonus_excluded_roles || [],
      use_balance_bonus: newGroup.use_balance_bonus,
      points_win: newGroup.points_win, points_draw: newGroup.points_draw
    }]).select().single();

    if (error) throw error;
    if (data) {
      await registerGroupJoin(data.id, 'owner');
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
    const cloudCacheSaved = await AsyncStorage.getItem('cloud_groups_cache');
    if (cloudCacheSaved) {
      const cloudCache = JSON.parse(cloudCacheSaved);
      const updatedCache = cloudCache.map((g: any) => g.id === groupId ? { ...g, ...payload } : g);
      await AsyncStorage.setItem('cloud_groups_cache', JSON.stringify(updatedCache));
    }

    try {
      const { data, error } = await supabase.from('groups').update(payload).eq('id', groupId).select().single();
      if (error) {
        await syncGroupMetadata(groupId, payload);
        return { ...group, ...payload, storage_type: 'cloud' } as Group;
      }
      await syncGroupMetadata(groupId, payload);
      return { ...group, ...data, storage_type: 'cloud' } as Group;
    } catch (e) {
      return { ...group, ...payload, storage_type: 'cloud' } as Group;
    }
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
    await AsyncStorage.removeItem(`needs_sync_${groupId}`);
    await AsyncStorage.removeItem(`last_sync_timestamp_${groupId}`);
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Autenticazione richiesta");

    if (group.role === 'owner' || group.admin_id === user.id) {
       await supabase.from('players').delete().eq('group_id', groupId);
       await supabase.from('matches').delete().eq('group_id', groupId);
       await supabase.from('groups').delete().eq('id', groupId);

       const joinedSaved = await AsyncStorage.getItem('joined_cloud_groups');
       if (joinedSaved) {
         const joined: string[] = JSON.parse(joinedSaved);
         await AsyncStorage.setItem('joined_cloud_groups', JSON.stringify(joined.filter(id => id !== groupId)));
       }
       await AsyncStorage.removeItem(`players_${groupId}`);
       await AsyncStorage.removeItem(`matches_${groupId}`);

       const cloudCacheSaved = await AsyncStorage.getItem('cloud_groups_cache');
       if (cloudCacheSaved) {
         const cloudCache = JSON.parse(cloudCacheSaved);
         await AsyncStorage.setItem('cloud_groups_cache', JSON.stringify(cloudCache.filter((g: any) => g.id !== groupId)));
       }
       await syncCloudData();
    } else {
       throw new Error("Solo il proprietario può eliminare il gruppo definitivamente dal cloud.");
    }
  }
};

export const registerGroupJoin = async (groupId: string, role: 'owner' | 'admin' | 'viewer') => {
  const joinedSaved = await AsyncStorage.getItem('joined_cloud_groups');
  const joined: string[] = joinedSaved ? JSON.parse(joinedSaved) : [];
  if (!joined.includes(groupId)) {
    await AsyncStorage.setItem('joined_cloud_groups', JSON.stringify([...joined, groupId]));
  }
  const rolesSaved = await AsyncStorage.getItem('cloud_group_roles');
  const roles = rolesSaved ? JSON.parse(rolesSaved) : {};
  roles[groupId] = role;
  await AsyncStorage.setItem('cloud_group_roles', JSON.stringify(roles));
  await syncCloudData(groupId);
};

export const joinGroup = async (token: string): Promise<void> => {
  const { data, error } = await supabase.from('groups').select('*').or(`id.eq.${token},admin_token.eq.${token},viewer_token.eq.${token}`).maybeSingle();
  if (error || !data) throw new Error('Token non valido');

  let role: 'owner' | 'admin' | 'viewer' = 'viewer';
  if (token === data.id) role = 'owner';
  else if (token === data.admin_token) role = 'admin';

  await registerGroupJoin(data.id, role);

  if (data.group_type === 'championship' && data.linked_group_ids && data.linked_group_ids.length > 0) {
    for (const linkedId of data.linked_group_ids) {
      try {
        await registerGroupJoin(linkedId, 'viewer');
      } catch (e) {}
    }
  }
};


// --- GIOCATORI ---

export const fetchPlayers = async (params: { group_id: string; search?: string; role?: string }): Promise<Player[]> => {
  let players: any[] = [];
  const safeGroupId = String(params.group_id || '').trim();
  const saved = await AsyncStorage.getItem(`players_${safeGroupId}`);

  if (saved && saved !== '[]') {
    players = JSON.parse(saved);
  } else {
    try {
      const { data, error } = await supabase.from('players').select('*').eq('group_id', safeGroupId);
      if (!error && data) {
        players = data;
        if (data.length > 0) await AsyncStorage.setItem(`players_${safeGroupId}`, JSON.stringify(data));
      }
    } catch (e) {}
  }

  const mapped = players.map(p => ({ ...p, age: p.date_of_birth ? calculateAge(p.date_of_birth) : (p.age || 0) }));
  let filtered = mapped;
  if (params.search) {
    const s = params.search.toLowerCase();
    filtered = filtered.filter(p => (p.nickname || '').toLowerCase().includes(s));
  }
  if (params.role) filtered = filtered.filter(p => p.role === params.role);
  return filtered;
};

export const savePlayer = async (player: Partial<Player> & { group_id: string }): Promise<void> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === player.group_id);
  const players = await fetchPlayers({ group_id: player.group_id });

  const isDuplicate = players.some(p =>
    p.nickname.toLowerCase().trim() === player.nickname?.toLowerCase().trim() &&
    p.id !== player.id
  );

  if (isDuplicate) {
    throw new Error(`Esiste già un giocatore con il nickname "${player.nickname}" in questo gruppo.`);
  }

  const playerWithId = { ...player, id: player.id || Math.random().toString(36).substring(7) } as Player;
  const exists = players.some(p => p.id === player.id);
  const updatedLocal = exists ? players.map(p => p.id === player.id ? playerWithId : p) : [...players, playerWithId];

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

export const applyMetadata = async (groupId: string, matches: Match[]) => {
  const metaMatch = matches.find(m => m.team_a_name === 'METADATA' && m.description?.startsWith('JSON_METADATA:'));
  if (metaMatch) {
    try {
      const jsonStr = metaMatch.description!.replace('JSON_METADATA:', '');
      const metadata = JSON.parse(jsonStr);
      for (const field of CAREER_FIELDS) {
        if (metadata[field] !== undefined) {
          await AsyncStorage.setItem(`override_${field}_${groupId}`, JSON.stringify(metadata[field]));
        }
      }
      const cloudCacheSaved = await AsyncStorage.getItem('cloud_groups_cache');
      if (cloudCacheSaved) {
        const cloudCache = JSON.parse(cloudCacheSaved);
        const updatedCache = cloudCache.map((gc: any) => gc.id === groupId ? { ...gc, ...metadata } : gc);
        await AsyncStorage.setItem('cloud_groups_cache', JSON.stringify(updatedCache));
      }
    } catch (e) {}
  }
};

export const fetchMatches = async (groupId: string): Promise<Match[]> => {
  const safeGroupId = String(groupId || '').trim();
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('group_id', safeGroupId)
      .order('date', { ascending: false });

    if (!error && data) {
      if (data.length > 0) {
        await AsyncStorage.setItem(`matches_${safeGroupId}`, JSON.stringify(data));
        await applyMetadata(safeGroupId, data);
      }
      return data;
    }
  } catch (e) {}

  const saved = await AsyncStorage.getItem(`matches_${safeGroupId}`);
  if (saved && saved !== '[]') return JSON.parse(saved);
  return [];
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
    const dataToSave: any = {
      group_id: match.group_id,
      team_a_players: match.team_a_players,
      team_b_players: match.team_b_players,
      team_a_score: match.team_a_score,
      team_b_score: match.team_b_score,
      team_a_name: match.team_a_name,
      team_b_name: match.team_b_name,
      date: match.date,
      goals: match.goals || {},
      assists: match.assists || {},
      team_a_own_goals: match.team_a_own_goals || 0,
      team_b_own_goals: match.team_b_own_goals || 0,
      description: match.description || '',
      team_a_color: match.team_a_color || 'Bianca',
      team_b_color: match.team_b_color || 'Rossa',
      location: match.location || '',
      status: match.status || 'played',
      match_phase: match.match_phase || 'group',
      tournament_group: match.tournament_group || 0,
      team_a_penalties: match.team_a_penalties || 0,
      team_b_penalties: match.team_b_penalties || 0,
      team_a_placeholder: match.team_a_placeholder || '',
      team_b_placeholder: match.team_b_placeholder || '',
      exclude_def_bonus: match.exclude_def_bonus || false
    };

    if (match.knockout_index !== undefined) dataToSave.knockout_index = match.knockout_index;

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

export const resetTournamentResults = async (groupId: string): Promise<void> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) return;

  const matches = await fetchMatches(groupId);
  const resetMatches = matches.map(m => ({
    ...m, team_a_score: 0, team_b_score: 0, team_a_own_goals: 0, team_b_own_goals: 0,
    team_a_penalties: 0, team_b_penalties: 0, goals: {}, assists: {}, status: 'scheduled' as const
  }));

  if (group.storage_type === 'local') {
    await AsyncStorage.setItem(`matches_${groupId}`, JSON.stringify(resetMatches));
  } else {
    await setNeedsSync(groupId);
    await supabase.from('matches').update({ team_a_score: 0, team_b_score: 0, goals: {}, assists: {}, status: 'scheduled' }).eq('group_id', groupId);
  }
};

export const resetTournament = async (groupId: string): Promise<void> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) return;

  if (group.storage_type === 'local') {
    await AsyncStorage.removeItem(`matches_${groupId}`);
  } else {
    await setNeedsSync(groupId);
    await supabase.from('matches').delete().eq('group_id', groupId);
  }
};

export const calculateStandings = async (groupId: string, playersData?: Player[], matchesData?: Match[]): Promise<PlayerStats[]> => {
  try {
    const safeGroupId = String(groupId || '').trim();
    if (!safeGroupId) return [];

    const players = (playersData || await fetchPlayers({ group_id: safeGroupId })).filter(p => p && p.id);
    const matches = (matchesData || await fetchMatches(safeGroupId)).filter(m => m && m.team_a_players && m.team_b_players);
    const allGroups = await fetchGroups();
    const group = allGroups.find(g => String(g.id).trim() === safeGroupId);

    const statsMap: Record<string, PlayerStats> = {};
    const personalBonuses: Record<string, number> = {};
    const defenseBonuses: Record<string, number> = {};

    players.forEach(p => {
      const pid = String(p.id).trim();
      statsMap[pid] = {
        player_id: pid, nickname: p.nickname || 'Sconosciuto', role: p.role || 'Attaccante',
        played: 0, won: 0, drawn: 0, lost: 0, points: 0, goals_done: 0, goals_suffered: 0,
        individual_goals: 0, individual_assists: 0, clean_sheets: 0, incisivity: 0,
        bonus_points: 0, personal_bonus_count: 0, defense_bonus_count: 0,
        tournament_count: 0, tournament_bonus_points: 0, tournament_details: [], career_divisor: 0
      };
      personalBonuses[pid] = 0;
      defenseBonuses[pid] = 0;
    });

    const allMatchesToProcess = [...matches];

    if (group?.import_linked_data && group.linked_group_ids && Array.isArray(group.linked_group_ids)) {
      const weight = group.tournament_match_weight || 1;
      for (const linkedId of group.linked_group_ids) {
        try {
          const [lm, lp] = await Promise.all([fetchMatches(linkedId), fetchPlayers({ group_id: linkedId })]);
          if (lm) allMatchesToProcess.push(...lm.map(x => ({ ...x, is_linked: true, weight, _tournamentPlayers: lp || [] })));

          const linkedGroupObj = allGroups.find(g => String(g.id).trim() === String(linkedId).trim());
          const tName = linkedGroupObj?.name || `Torneo ${String(linkedId).substring(0,5)}`;

          const assignBonus = (tids: string[], amount: number, label: string) => {
            if (!tids || amount <= 0) return;
            const nicks = tids.map(tid => (lp || []).find(p => String(p.id).trim() === String(tid).trim())?.nickname?.toLowerCase().trim()).filter(Boolean);
            players.forEach(p => {
              if (p.nickname && nicks.includes(p.nickname.toLowerCase().trim())) {
                const pid = String(p.id).trim();
                if (statsMap[pid]) {
                  statsMap[pid].points += amount; statsMap[pid].bonus_points += amount; statsMap[pid].tournament_bonus_points += amount;
                  if (!statsMap[pid].tournament_details) statsMap[pid].tournament_details = [];
                  let tD = statsMap[pid].tournament_details!.find(d => d.name === tName);
                  if (!tD) { tD = { name: tName, points: 0, achievements: [] }; statsMap[pid].tournament_details!.push(tD); }
                  tD.points += amount; tD.achievements.push(label);
                }
              }
            });
          };

          const finalMatch = (lm || []).find(m => m.match_phase === 'final' && m.status === 'played');
          if (finalMatch) {
            const sA = Number(finalMatch.team_a_score), sB = Number(finalMatch.team_b_score);
            const aW = sA > sB || (sA === sB && Number(finalMatch.team_a_penalties) > Number(finalMatch.team_b_penalties));
            assignBonus(aW ? finalMatch.team_a_players : finalMatch.team_b_players, group.tournament_win_bonus || 0, "1° Posto");
            assignBonus(aW ? finalMatch.team_b_players : finalMatch.team_a_players, group.tournament_2nd_bonus || 0, "2° Posto");
          }

          players.forEach(p => {
            const hasP = (lm || []).some(m => [...(m.team_a_players||[]), ...(m.team_b_players||[])].some(tid => (lp||[]).find(x=>x.id===tid)?.nickname?.toLowerCase().trim() === p.nickname?.toLowerCase().trim()));
            if (hasP) statsMap[String(p.id).trim()].tournament_count++;
          });
        } catch (e) {}
      }
    }

    allMatchesToProcess
      .filter(m => m && (m.status === 'played' || m.status === undefined) && m.team_a_name !== 'METADATA')
      .forEach(m => {
        const sA = Number(m.team_a_score || 0), sB = Number(m.team_b_score || 0), isD = sA === sB, aW = sA > sB;
        const isL = !!(m as any).is_linked;
        const tP: Player[] = (m as any)._tournamentPlayers || [];

        const proc = (pids: any[], score: number, opS: number, win: boolean, cs: boolean) => {
          if (!pids) return;
          pids.forEach(rawId => {
            let pid = String(typeof rawId === 'object' ? (rawId.id || rawId.player_id) : rawId).trim();
            if (!statsMap[pid]) {
              const lp = tP.find(x => String(x.id).trim() === pid);
              const nick = (lp?.nickname || (typeof rawId === 'object' ? rawId.nickname : pid)).toLowerCase().trim();
              const mp = players.find(p => p.nickname?.toLowerCase().trim() === nick);
              if (mp) pid = String(mp.id).trim(); else return;
            }
            const ps = statsMap[pid];
            if (!ps) return;
            ps.goals_done += score; ps.goals_suffered += opS;
            if (!isL) {
              ps.played += 1;
              if (isD) { ps.drawn++; ps.points += Number(group?.points_draw ?? 1); ps.last_trend = 'D'; }
              else if (win) { ps.won++; ps.points += Number(group?.points_win ?? 3); ps.last_trend = 'W'; }
              else { ps.lost++; ps.last_trend = 'L'; }
            }
            const origId = String(typeof rawId === 'object' ? (rawId.id || rawId.player_id) : rawId).trim();
            ps.individual_goals += Number(m.goals?.[origId] || 0);
            ps.individual_assists += Number(m.assists?.[origId] || 0);

            if (!isL && (group?.group_type === 'championship' || !group?.group_type)) {
              if (cs && !m.exclude_def_bonus) ps.clean_sheets++;
              let matchBonus = 0;
              if (group?.use_bonus && Number(m.goals?.[origId] || 0) >= (group.bonus_goals_threshold || 2) && Number(m.assists?.[origId] || 0) >= (group.bonus_assists_threshold || 2)) {
                personalBonuses[pid]++; ps.personal_bonus_count++; if (!group?.use_balance_bonus) matchBonus++;
              }
              const isEx = Array.isArray(group?.gk_bonus_excluded_roles) && group.gk_bonus_excluded_roles.includes(ps.role);
              if (group?.use_gk_bonus && !isEx && opS < (group.gk_bonus_threshold || 5) && !m.exclude_def_bonus) {
                defenseBonuses[pid]++; ps.defense_bonus_count++; if (!group?.use_balance_bonus) matchBonus++;
              }
              if (group?.use_clean_sheet_bonus && cs && !m.exclude_def_bonus) matchBonus++;
              ps.points += matchBonus; ps.bonus_points += matchBonus;
            }
          });
        };
        proc(m.team_a_players, sA, sB, aW, sB === 0);
        proc(m.team_b_players, sB, sA, !aW && !isD, sA === 0);
      });

    const tW = group?.tournament_match_weight || 1;
    Object.values(statsMap).forEach((ps: any) => {
      ps.career_divisor = Math.max(1, ps.played + (ps.tournament_count * tW));
      ps.incisivity = Number(((ps.individual_goals + ps.individual_assists) / ps.career_divisor).toFixed(2));
      if (group?.use_balance_bonus) {
        const finalB = Math.max(personalBonuses[ps.player_id] || 0, defenseBonuses[ps.player_id] || 0);
        ps.points += finalB; ps.bonus_points += finalB;
      }
    });

    const compare = (a: PlayerStats, b: PlayerStats, crit: string | undefined) => {
      switch (crit) {
        case 'ratio': return (b.points / (b.played || 1)) - (a.points / (a.played || 1));
        case 'played': return b.played - a.played;
        case 'goals': return b.individual_goals - a.individual_goals;
        case 'assists': return b.individual_assists - a.individual_assists;
        case 'bonus': return b.bonus_points - a.bonus_points;
        case 'incisivity': return b.incisivity - a.incisivity;
        default: return 0;
      }
    };

    return Object.values(statsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const r1 = compare(a, b, group?.tie_breaker_1 || 'ratio');
      if (r1 !== 0) return r1;
      const r2 = compare(a, b, group?.tie_breaker_2 || 'incisivity');
      if (r2 !== 0) return r2;
      return (b.goals_done - b.goals_suffered) - (a.goals_done - a.goals_suffered);
    });
  } catch (e) { console.error(e); return []; }
};

export const createFullBackup = async (groupId: string): Promise<string> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new Error('Gruppo non trovato');
  const players = await fetchPlayers({ group_id: groupId });
  const matches = await fetchMatches(groupId);
  const backup: any = { group, players, matches, version: '1.1', timestamp: new Date().toISOString(), linked_groups: [] };
  if (group.group_type === 'championship' && group.linked_group_ids?.length) {
    for (const lid of group.linked_group_ids) {
      const lg = groups.find(g => g.id === lid);
      if (lg) backup.linked_groups.push({ group: lg, players: await fetchPlayers({ group_id: lid }), matches: await fetchMatches(lid) });
    }
  }
  return JSON.stringify(backup, null, 2);
};

const restoreGroupData = async (groupId: string, data: { players: Player[], matches: Match[] }, storageType: 'local' | 'cloud'): Promise<Record<string, string>> => {
  const idMap: Record<string, string> = {};
  if (storageType === 'local') {
    await AsyncStorage.setItem(`players_${groupId}`, JSON.stringify(data.players));
    await AsyncStorage.setItem(`matches_${groupId}`, JSON.stringify(data.matches));
  } else {
    await supabase.from('players').delete().eq('group_id', groupId);
    await supabase.from('matches').delete().eq('group_id', groupId);
    if (data.players.length > 0) {
      const playersToInsert = data.players.map((p: any) => ({ nickname: p.nickname, name: p.name, surname: p.surname, date_of_birth: p.date_of_birth, role: p.role, strength: p.strength, group_id: groupId }));
      const { data: newPlayers, error: pError } = await supabase.from('players').insert(playersToInsert).select();
      if (pError) throw pError;
      if (newPlayers) newPlayers.forEach((np: any) => { const oldP = data.players.find((op: any) => op.nickname === np.nickname); if (oldP) idMap[oldP.id] = np.id; });
    }
    if (data.matches.length > 0) {
      const matchesToInsert = data.matches.map((m: any) => {
        const mapId = (oldId: string) => idMap[oldId] || oldId;
        return {
          group_id: groupId, date: m.date, team_a_players: (m.team_a_players || []).map(mapId), team_b_players: (m.team_b_players || []).map(mapId),
          team_a_score: m.team_a_score || 0, team_b_score: m.team_b_score || 0, team_a_name: m.team_a_name, team_b_name: m.team_b_name,
          team_a_color: m.team_a_color || 'Bianca', team_b_color: m.team_b_color || 'Rossa', team_a_own_goals: m.team_a_own_goals || 0, team_b_own_goals: m.team_b_own_goals || 0,
          goals: Object.fromEntries(Object.entries(m.goals || {}).map(([oid, val]) => [mapId(oid), val])),
          assists: Object.fromEntries(Object.entries(m.assists || {}).map(([oid, val]) => [mapId(oid), val])),
          description: m.description || '', location: m.location || '', status: m.status || 'played', match_phase: m.match_phase || 'group',
          tournament_group: m.tournament_group || 0, team_a_penalties: m.team_a_penalties || 0, team_b_penalties: m.team_b_penalties || 0,
          team_a_placeholder: m.team_a_placeholder || '', team_b_placeholder: m.team_b_placeholder || '', knockout_index: m.knockout_index, exclude_def_bonus: m.exclude_def_bonus
        };
      });
      const { error: mError } = await supabase.from('matches').insert(matchesToInsert);
      if (mError) throw mError;
    }
  }
  return idMap;
};

export const restoreFullBackup = async (groupId: string, jsonString: string): Promise<void> => {
  try {
    const backup = JSON.parse(jsonString);
    const players = backup.players || backup.playersData;
    const matches = backup.matches || backup.matchesData;
    if (!players || !matches) throw new Error('Backup non valido');

    const groups = await fetchGroups();
    const safeGid = String(groupId).trim();
    const targetGroup = groups.find(g => String(g.id).trim() === safeGid);
    if (!targetGroup) throw new Error('Gruppo non trovato');

    if (backup.group) {
      const groupPayload: Partial<Group> = { ...backup.group, id: safeGid, storage_type: targetGroup.storage_type };
      delete (groupPayload as any).admin_id;
      await updateGroup(safeGid, groupPayload);
    }
    await restoreGroupData(safeGid, { players, matches }, targetGroup.storage_type);

    if (backup.linked_groups && Array.isArray(backup.linked_groups)) {
      const newLinkedIds: string[] = [];
      for (const linkedData of backup.linked_groups) {
        try {
          const newTId = Math.random().toString(36).substring(7);
          const newName = `${linkedData.group?.name || 'Torneo'} (Ripristinato)`;
          if (targetGroup.storage_type === 'local') {
             const newT: Group = { ...linkedData.group, id: newTId, name: newName, storage_type: 'local' };
             const current = await fetchGroups();
             await AsyncStorage.setItem('local_groups', JSON.stringify([...current.filter(x => x.storage_type === 'local'), newT]));
             await restoreGroupData(newTId, { players: linkedData.players, matches: linkedData.matches }, 'local');
             newLinkedIds.push(newTId);
          } else {
             const { data: userRes } = await supabase.auth.getUser();
             const { data: newCloud } = await supabase.from('groups').insert([{ ...linkedData.group, name: newName, storage_type: 'cloud', admin_id: userRes.user?.id }]).select().single();
             if (newCloud) {
               await registerGroupJoin(newCloud.id, 'owner');
               await restoreGroupData(newCloud.id, { players: linkedData.players, matches: linkedData.matches }, 'cloud');
               newLinkedIds.push(newCloud.id);
             }
          }
        } catch (e) {}
      }
      if (newLinkedIds.length > 0) await updateGroup(safeGid, { linked_group_ids: newLinkedIds });
    }
    await syncCloudData(safeGid);
  } catch (err) { console.error(err); throw err; }
};


export const JERSEY_COLORS = [
  { value: 'Bianca', hex: '#FFFFFF' },
  { value: 'Rossa', hex: '#FF3B30' },
  { value: 'Blu', hex: '#007AFF' },
  { value: 'Verde', hex: '#34C759' },
  { value: 'Gialla', hex: '#FFD60A' },
  { value: 'Arancione', hex: '#FF9500' },
  { value: 'Azzurra', hex: '#5AC8FA' },
  { value: 'Viola', hex: '#5856D6' },
  { value: 'Marrone', hex: '#A2845E' },
  { value: 'Nera', hex: '#1C1C1E' }
];
export const ROLE_COLORS: Record<string, string> = { 'Attaccante': '#FF3B30', 'Mediana': '#34C759', 'Difensore': '#007AFF', 'Portiere': '#FF9500' };
export const ROLES = ['Portiere', 'Difensore', 'Mediana', 'Attaccante'];
export const STRENGTH_VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
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
  team_a_logo?: string;
  team_b_logo?: string;
  match_location?: string;
  description?: string;
  teams?: any[]; // Per supporto futuro torneo
}

export const generateTeams = async (playerIds: string[], matchType: number, groupId: string, numTeams: number = 2, previousTeamAIds?: string[], modifiedPlayers?: Player[]): Promise<TeamResult> => {
  const players = await fetchPlayers({ group_id: groupId });
  const selected = players.filter(p => playerIds.includes(p.id)).map(p => {
    const modified = modifiedPlayers?.find(mp => mp.id === p.id);
    return modified ? { ...p, role: modified.role, strength: modified.strength } : p;
  });
  if (numTeams > 2) {
    const groups = await fetchGroups();
    const group = groups.find(g => g.id === groupId);
    let bestTournamentResult: any = null;
    for (let i = 0; i < 1000; i++) {
      const teams: Player[][] = Array.from({ length: numTeams }, () => []);
      const teamStrengths: number[] = Array.from({ length: numTeams }, () => 0);
      const remaining: Player[] = [];
      ROLES.forEach(role => {
        const inRole = selected.filter(p => p.role === role).sort(() => Math.random() - 0.5);
        const teamIndices = Array.from({ length: numTeams }, (_, i) => i).sort(() => Math.random() - 0.5);
        inRole.forEach((p, i) => {
          if (i < numTeams) { teams[teamIndices[i]].push(p); teamStrengths[teamIndices[i]] += p.strength; }
          else remaining.push(p);
        });
      });
      remaining.sort((a, b) => b.strength - a.strength).forEach(p => {
        let targetIdx = -1, minS = Infinity;
        for (let j = 0; j < numTeams; j++) {
          if (teams[j].length < matchType) {
            if (p.role === 'Portiere' && teams[j].some(tp => tp.role === 'Portiere')) continue;
            if (teamStrengths[j] < minS) { minS = teamStrengths[j]; targetIdx = j; }
          }
        }
        if (targetIdx !== -1) { teams[targetIdx].push(p); teamStrengths[targetIdx] += p.strength; }
      });
      const diff = Math.max(...teamStrengths) - Math.min(...teamStrengths);
      if (!bestTournamentResult || diff < bestTournamentResult.diff) { bestTournamentResult = { teams, teamStrengths, diff }; if (diff <= 0.3) break; }
    }
    const roleOrd: Record<string, number> = { 'Portiere': 1, 'Difensore': 2, 'Mediana': 3, 'Attaccante': 4 };
    const sortP = (l: Player[]) => [...l].sort((a, b) => (roleOrd[a.role] || 99) - (roleOrd[b.role] || 99) || b.strength - a.strength);
    const finalTeams = bestTournamentResult.teams.map((t: Player[], idx: number) => ({
      players: sortP(t), name: `Squadra ${String.fromCharCode(65 + idx)}`, color: JERSEY_COLORS[idx % JERSEY_COLORS.length].value,
      total_strength: Number(bestTournamentResult.teamStrengths[idx].toFixed(1)), key: String.fromCharCode(97 + idx),
      avg_age: t.length ? Number((t.reduce((acc, p) => acc + p.age, 0) / t.length).toFixed(1)) : 0,
      assigned_group: Math.floor(idx / Math.ceil(bestTournamentResult.teams.length / (group?.num_groups || 1))) + 1
    }));
    return {
      team_a: finalTeams[0].players, team_b: finalTeams[1].players, team_a_total_strength: finalTeams[0].total_strength,
      team_b_total_strength: finalTeams[1].total_strength, team_a_avg_age: finalTeams[0].avg_age, team_b_avg_age: finalTeams[1].avg_age,
      team_a_name: finalTeams[0].name, team_b_name: finalTeams[1].name, team_a_color: finalTeams[0].color, team_b_color: finalTeams[1].color, teams: finalTeams
    };
  }
  let bestResult: any = null;
  for (let i = 0; i < 800; i++) {
    const teamA: Player[] = [], teamB: Player[] = [];
    let sA = 0, sB = 0; const remaining: Player[] = [];
    ROLES.forEach(role => {
      const inRole = selected.filter(p => p.role === role).sort(() => Math.random() - 0.5);
      while (inRole.length >= 2) {
        const p1 = inRole.pop()!, p2 = inRole.pop()!;
        if (Math.random() > 0.5) { teamA.push(p1); sA += p1.strength; teamB.push(p2); sB += p2.strength; }
        else { teamB.push(p1); sB += p1.strength; teamA.push(p2); sA += p2.strength; }
      }
      if (inRole.length === 1) remaining.push(inRole[0]);
    });
    remaining.sort((a, b) => b.strength - a.strength).forEach(p => {
      if (teamA.length < teamB.length || (teamA.length === teamB.length && sA <= sB)) { teamA.push(p); sA += p.strength; }
      else { teamB.push(p); sB += p.strength; }
    });
    const diff = Math.abs(sA - sB);
    let penalty = 0;
    if (previousTeamAIds?.length && teamA.filter(id => previousTeamAIds.includes(id.id)).length >= teamA.length - 1) penalty = 10;
    if (!bestResult || (diff + penalty) < bestResult.score) { bestResult = { teamA, teamB, sA, sB, score: diff + penalty }; if (diff + penalty <= 0.2) break; }
  }
  const roleOrd: Record<string, number> = { 'Portiere': 1, 'Difensore': 2, 'Mediana': 3, 'Attaccante': 4 };
  const sortP = (l: Player[]) => [...l].sort((a, b) => (roleOrd[a.role] || 99) - (roleOrd[b.role] || 99) || b.strength - a.strength);
  return {
    team_a: sortP(bestResult.teamA), team_b: sortP(bestResult.teamB), team_a_total_strength: Number(bestResult.sA.toFixed(1)),
    team_b_total_strength: Number(bestResult.sB.toFixed(1)), team_a_name: 'Squadra A', team_b_name: 'Squadra B', team_a_color: 'Bianca', team_b_color: 'Rossa',
    team_a_avg_age: bestResult.teamA.length ? Number((bestResult.teamA.reduce((acc:any, p:any) => acc + p.age, 0) / bestResult.teamA.length).toFixed(1)) : 0,
    team_b_avg_age: bestResult.teamB.length ? Number((bestResult.teamB.reduce((acc:any, p:any) => acc + p.age, 0) / bestResult.teamB.length).toFixed(1)) : 0,
  };
};

export const importPlayersExcel = async (groupId: string, data: any[]) => {
  for (const p of data) {
    const n: any = {}; Object.keys(p).forEach(k => n[k.toLowerCase().trim()] = p[k]);
    const nick = n['nickname'] || n['nick'] || '';
    if (!nick) continue;
    const current = await fetchPlayers({ group_id: groupId });
    const exists = current.find(ep => ep.nickname.toLowerCase().trim() === nick.toLowerCase().trim());
    try {
      await savePlayer({ id: exists?.id, nickname: nick, name: n['nome'] || n['name'] || '', surname: n['cognome'] || n['surname'] || '', date_of_birth: n['data di nascita'] || n['data_nascita'] || n['dob'] || '', role: n['ruolo'] || n['role'] || 'Attaccante', strength: parseFloat(n['forza'] || n['strength'] || '5') || 5, group_id: groupId });
    } catch (e) {}
  }
};

export const exportPlayersExcel = async (groupId: string) => {
  const players = await fetchPlayers({ group_id: groupId });
  return players.map(p => ({ Nickname: p.nickname, Nome: p.name || '', Cognome: p.surname || '', 'Data di Nascita': p.date_of_birth || '', Ruolo: p.role, Forza: p.strength }));
};

export const generateTournamentSchedule = async (teams: any[], groupId: string, numGroups: number = 1, location?: string, startDate?: Date) => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (group) {
    if (group.storage_type === 'local') {
      const existing = await fetchMatches(groupId);
      await AsyncStorage.setItem(`matches_${groupId}`, JSON.stringify(existing.filter(m => m.match_phase !== 'group' && m.match_phase !== undefined)));
    } else {
      await setNeedsSync(groupId);
      await supabase.from('matches').delete().eq('group_id', groupId).eq('match_phase', 'group');
    }
  }
  const generated: any[] = [];
  const baseDate = startDate instanceof Date ? startDate : new Date();
  const createRR = (gTeams: any[], gNum: number) => {
    const n = gTeams.length; if (n < 2) return;
    const tL = [...gTeams]; if (n % 2 !== 0) tL.push(null);
    const nT = tL.length, nR = nT - 1, mPR = nT / 2;
    for (let r = 0; r < nR; r++) {
      for (let m = 0; m < mPR; m++) {
        const h = (r + m) % (nT - 1), a = (nT - 1 - m + r) % (nT - 1);
        const t1 = m === 0 ? tL[nT - 1] : tL[h], t2 = tL[a];
        if (t1 && t2) {
          generated.push({
            group_id: groupId, date: new Date(baseDate.getTime() + (r * 20 + m) * 60000).toISOString(),
            team_a_players: t1.players.map((p: any) => p.id), team_b_players: t2.players.map((p: any) => p.id),
            team_a_score: 0, team_b_score: 0, team_a_name: t1.name, team_b_name: t2.name, team_a_color: t1.color, team_b_color: t2.color,
            team_a_logo: t1.logo, team_b_logo: t2.logo, team_a_own_goals: 0, team_b_own_goals: 0, goals: {}, assists: {},
            description: `G${r + 1} - ${t1.name} vs ${t2.name}`, location: location || '', status: 'scheduled', match_phase: 'group', tournament_group: gNum
          });
        }
      }
    }
  };
  if (teams.some(t => t.assigned_group !== undefined)) {
    for (let g = 1; g <= numGroups; g++) createRR(teams.filter(t => t.assigned_group === g), g);
  } else {
    const tPG = Math.ceil(teams.length / numGroups);
    for (let g = 0; g < numGroups; g++) createRR(teams.slice(g * tPG, (g + 1) * tPG), g + 1);
  }
  for (const m of generated) await saveMatchResult(m);
};

export const scheduleBirthdayNotifications = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.MAX });
    await Notifications.cancelAllScheduledNotificationsAsync();
    const groups = await fetchGroups();
    for (const g of groups) {
      const players = await fetchPlayers({ group_id: g.id });
      for (const p of players) {
        if (p.date_of_birth) {
          const dob = new Date(p.date_of_birth), today = new Date();
          if (dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth()) {
            await Notifications.scheduleNotificationAsync({ content: { title: "🎂 Buon Compleanno!", body: `Oggi è il compleanno di ${p.nickname}! Auguri! ⚽`, data: { playerId: p.id }, sound: true }, trigger: null });
          }
        }
      }
    }
  } catch (e) {}
};
