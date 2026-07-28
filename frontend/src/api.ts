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
    // 1. Controlliamo prima la cache locale per velocità (fondamentale all'avvio)
    const cachedPremium = await AsyncStorage.getItem('is_premium_user');
    if (cachedPremium === 'true') return true;

    // 2. Verifichiamo se l'utente è autenticato. Se no, attendiamo un po' (race condition auth anonimo)
    let { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Aspettiamo fino a 2 secondi che initializeAuth faccia il suo lavoro
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

    if (error) return cachedPremium === 'true'; // Fallback su cache se c'è errore di rete

    const isPremium = !!data;
    // Aggiorniamo la cache
    await AsyncStorage.setItem('is_premium_user', isPremium ? 'true' : 'false');

    return isPremium;
  } catch (e) {
    const cached = await AsyncStorage.getItem('is_premium_user');
    return cached === 'true';
  }
};

export const redeemCode = async (code: string): Promise<void> => {
  // 1. Assicuriamoci che l'utente sia loggato (attendiamo se necessario)
  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 200));
      const res = await supabase.auth.getUser();
      if (res.data?.user) { user = res.data.user; break; }
    }
  }

  if (!user) throw new Error("Connessione al server in corso... Riprova tra pochi istanti.");

  const cleanCode = code.trim();

  // 1. Verifica se il codice esiste ed è valido (Ricerca CASE-INSENSITIVE)
  // Usiamo il filtro 'ilike' per ignorare maiuscole/minuscole
  const { data: codeData, error: codeError } = await supabase
    .from('activation_codes')
    .select('*')
    .ilike('code', cleanCode)
    .maybeSingle();

  if (codeError || !codeData) {
    throw new Error("Codice non valido.");
  }

  // 2. Segna il codice come usato (Aggiorniamo l'ultimo utilizzatore, ma non blocchiamo futuri usi)
  await supabase
    .from('activation_codes')
    .update({
      is_used: true,
      used_by: user.id,
      used_at: new Date().toISOString()
    })
    .ilike('code', cleanCode);

  // 3. Aggiungi l'utente ai premium (usiamo upsert per evitare errori se già presente)
  const { error: premiumError } = await supabase
    .from('premium_users')
    .upsert([{ user_id: user.id }], { onConflict: 'user_id' });

  if (premiumError) throw premiumError;

  // 4. Aggiorna cache locale immediatamente
  await AsyncStorage.setItem('is_premium_user', 'true');
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

  // Ottimizzazione: caricamento dati in parallelo
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
      if (mData) {
        await AsyncStorage.setItem(`matches_${groupId}`, JSON.stringify(mData));
        // ESTRAZIONE METADATI SISTEMA tramite helper
        await applyMetadata(groupId, mData);
      }

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
      const joinedSaved = await AsyncStorage.getItem('joined_cloud_groups');
      const joined: string[] = joinedSaved ? JSON.parse(joinedSaved) : [];
      if (!joined.includes(data.id)) {
        await AsyncStorage.setItem('joined_cloud_groups', JSON.stringify([...joined, data.id]));
      }

      // IMPORTANTE: Salviamo subito il ruolo di owner localmente per evitare il bug "Solo Lettura"
      const rolesSaved = await AsyncStorage.getItem('cloud_group_roles');
      const roles = rolesSaved ? JSON.parse(rolesSaved) : {};
      roles[data.id] = 'owner';
      await AsyncStorage.setItem('cloud_group_roles', JSON.stringify(roles));

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
    // Ottimizzazione: aggiorniamo la cache locale subito per rendere l'interfaccia reattiva
    // anche se il cloud ha un errore di schema temporaneo (colonne mancanti)
    const cloudCacheSaved = await AsyncStorage.getItem('cloud_groups_cache');
    if (cloudCacheSaved) {
      const cloudCache = JSON.parse(cloudCacheSaved);
      const updatedCache = cloudCache.map((g: any) => g.id === groupId ? { ...g, ...payload } : g);
      await AsyncStorage.setItem('cloud_groups_cache', JSON.stringify(updatedCache));
    }

    try {
      const { data, error } = await supabase.from('groups').update(payload).eq('id', groupId).select().single();

      if (error) {
        console.warn("Cloud update failure, saving locally as fallback:", error);

        // Gestione fallback per colonne mancanti nel DB (Career Mode / Tornei collegati)
        // Se il DB restituisce errore (es. colonna non esiste), salviamo i dati localmente come override
        await syncGroupMetadata(groupId, payload);
        return { ...group, ...payload, storage_type: 'cloud' } as Group;
      }

      // Se il salvataggio su cloud ha avuto successo, sincronizziamo comunque i metadati
      // per gli utenti che non hanno le colonne aggiornate o per i campi "difficili"
      await syncGroupMetadata(groupId, payload);

      // Pulizia override locali se il cloud ha funzionato (opzionale, ma lasciamo che syncGroupMetadata faccia il suo lavoro)

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

    // Pulizia accurata di tutti i dati locali associati al gruppo
    await AsyncStorage.removeItem(`players_${groupId}`);
    await AsyncStorage.removeItem(`matches_${groupId}`);
    await AsyncStorage.removeItem(`needs_sync_${groupId}`);
    await AsyncStorage.removeItem(`last_sync_timestamp_${groupId}`);
    await AsyncStorage.removeItem(`override_links_${groupId}`);
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Autenticazione richiesta");

    if (group.role === 'owner' || group.admin_id === user.id) {
       // Eliminiamo prima i dati correlati per evitare errori di vincoli (Foreign Keys)
       await supabase.from('players').delete().eq('group_id', groupId);
       await supabase.from('matches').delete().eq('group_id', groupId);

       const { error } = await supabase.from('groups').delete().eq('id', groupId);
       if (error) throw error;

       const joinedSaved = await AsyncStorage.getItem('joined_cloud_groups');
       if (joinedSaved) {
         const joined: string[] = JSON.parse(joinedSaved);
         await AsyncStorage.setItem('joined_cloud_groups', JSON.stringify(joined.filter(id => id !== groupId)));
       }
       await AsyncStorage.removeItem(`players_${groupId}`);
       await AsyncStorage.removeItem(`matches_${groupId}`);

       // Pulizia immediata della cache locale
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

  // 1. Join al gruppo principale
  await registerGroupJoin(data.id, role);

  // 2. Se è un campionato con tornei collegati, effettuiamo il join automatico dei tornei come visualizzatori
  if (data.group_type === 'championship' && data.linked_group_ids && data.linked_group_ids.length > 0) {
    for (const linkedId of data.linked_group_ids) {
      try {
        // Uniamo l'utente al torneo collegato come visualizzatore
        await registerGroupJoin(linkedId, 'viewer');
      } catch (e) {
        console.warn(`Impossibile unirsi automaticamente al torneo collegato ${linkedId}:`, e);
      }
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
    // FALLBACK CLOUD: Se non abbiamo dati locali o sono vuoti, forziamo il download da Supabase
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('group_id', safeGroupId);

      if (!error && data) {
        players = data;
        if (data.length > 0) {
          await AsyncStorage.setItem(`players_${safeGroupId}`, JSON.stringify(data));
        }
      }
    } catch (e) {
      console.warn("Cloud players fallback failed:", e);
    }
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

  // Controllo duplicati nickname (escludendo se stessi in caso di update)
  const isDuplicate = players.some(p =>
    p.nickname.toLowerCase().trim() === player.nickname?.toLowerCase().trim() &&
    p.id !== player.id
  );

  if (isDuplicate) {
    throw new Error(`Esiste già un giocatore con il nickname "${player.nickname}" in questo gruppo.`);
  }

  const playerWithId = { ...player, id: player.id || Math.random().toString(36).substring(7) } as Player;

  // Verifichiamo se il giocatore esiste già in QUESTO gruppo (per decidere se fare update o insert)
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
      // Aggiorniamo anche la cache dei gruppi immediatamente se presente
      const cloudCacheSaved = await AsyncStorage.getItem('cloud_groups_cache');
      if (cloudCacheSaved) {
        const cloudCache = JSON.parse(cloudCacheSaved);
        const updatedCache = cloudCache.map((gc: any) => gc.id === groupId ? { ...gc, ...metadata } : gc);
        await AsyncStorage.setItem('cloud_groups_cache', JSON.stringify(updatedCache));
      }
    } catch (e) {
      console.warn("Errore parsing metadati cloud:", e);
    }
  }
};

export const fetchMatches = async (groupId: string): Promise<Match[]> => {
  const safeGroupId = String(groupId || '').trim();
  // 1. Prova a caricare dal Cloud per avere dati freschi
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('group_id', safeGroupId)
      .order('date', { ascending: false });

    if (!error && data) {
      if (data.length > 0) {
        await AsyncStorage.setItem(`matches_${safeGroupId}`, JSON.stringify(data));
        // APPLICHIAMO METADATI SISTEMA (Chirurgico per garantire allineamento web)
        await applyMetadata(safeGroupId, data);
      }
      return data;
    }
  } catch (e) {
    console.warn(`Errore fetch cloud per ${safeGroupId}:`, e);
  }

  // 2. Fallback su cache locale se il cloud fallisce o è vuoto
  const saved = await AsyncStorage.getItem(`matches_${safeGroupId}`);
  if (saved && saved !== '[]') return JSON.parse(saved);

  return [];
};

export const fetchGroupInfo = async (groupId: string): Promise<Partial<Group> | null> => {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, group_type, num_groups')
      .eq('id', groupId)
      .maybeSingle();

    if (!error && data) return data as Group;
  } catch (e) {}
  return null;
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

    // Aggiungiamo i nuovi campi solo se definiti per evitare errori di schema su DB non aggiornati
    if (match.knockout_index !== undefined) dataToSave.knockout_index = match.knockout_index;

    try {
      let res;
      if (match.id && match.id.length > 20) {
        res = await supabase.from('matches').update(dataToSave).eq('id', match.id).select().single();
      } else {
        res = await supabase.from('matches').insert([dataToSave]).select().single();
      }

      if (!res.error && res.data) {
        // Aggiorniamo il match locale con l'ID reale generato da Supabase
        const realMatch = { ...matchWithId, ...res.data };
        const finalMatches = updatedLocal.map(m => m.id === matchWithId.id ? realMatch : m);
        await AsyncStorage.setItem(`matches_${match.group_id}`, JSON.stringify(finalMatches));
      } else if (res.error) {
        console.warn("Supabase Sync Warning:", res.error.message);

        // Fallback: se l'errore è dovuto a una colonna mancante (es. knockout_index), riproviamo senza quel campo
        if (res.error.message.includes("column") && res.error.message.includes("does not exist")) {
           const fallbackData = { ...dataToSave };
           delete fallbackData.knockout_index;
           delete fallbackData.team_a_penalties;
           delete fallbackData.team_b_penalties;
           delete fallbackData.exclude_def_bonus;

           if (match.id && match.id.length > 20) {
             await supabase.from('matches').update(fallbackData).eq('id', match.id);
           } else {
             await supabase.from('matches').insert([fallbackData]);
           }
        }
      }
    } catch (e) {
      console.error("Cloud match save error:", e);
    }
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
    ...m,
    team_a_score: 0,
    team_b_score: 0,
    team_a_own_goals: 0,
    team_b_own_goals: 0,
    team_a_penalties: 0,
    team_b_penalties: 0,
    goals: {},
    assists: {},
    status: 'scheduled' as const
  }));

  if (group.storage_type === 'local') {
    await AsyncStorage.setItem(`matches_${groupId}`, JSON.stringify(resetMatches));
  } else {
    await setNeedsSync(groupId);
    // In Supabase we update multiple rows matching the group_id
    // Resetting all matches of the group to initial state
    await supabase
      .from('matches')
      .update({
        team_a_score: 0,
        team_b_score: 0,
        team_a_own_goals: 0,
        team_b_own_goals: 0,
        team_a_penalties: 0,
        team_b_penalties: 0,
        goals: {},
        assists: {},
        status: 'scheduled'
      })
      .eq('group_id', groupId);
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

    // Caricamento dati con fallback garantito
    const players = (playersData || await fetchPlayers({ group_id: safeGroupId })).filter(p => p && p.id);
    const matches = (matchesData || await fetchMatches(safeGroupId)).filter(m => m && m.team_a_players && m.team_b_players);
    const allGroups = await fetchGroups();
    const group = allGroups.find(g => String(g.id).trim() === safeGroupId);

    const statsMap: Record<string, PlayerStats> = {};
    const personalBonuses: Record<string, number> = {};
    const defenseBonuses: Record<string, number> = {};

    // Inizializzazione pulita
    players.forEach(p => {
      const pid = String(p.id).trim();
      statsMap[pid] = {
        player_id: pid,
        nickname: p.nickname || 'Sconosciuto',
        role: p.role || 'Attaccante',
        played: 0, won: 0, drawn: 0, lost: 0, points: 0,
        goals_done: 0, goals_suffered: 0,
        individual_goals: 0, individual_assists: 0,
        clean_sheets: 0, incisivity: 0,
        bonus_points: 0,
        personal_bonus_count: 0,
        defense_bonus_count: 0,
        tournament_count: 0,
        tournament_bonus_points: 0,
        tournament_details: [],
        career_divisor: 0
      };
      personalBonuses[pid] = 0;
      defenseBonuses[pid] = 0;
    });

    const allMatchesToProcess = [...matches];

    // --- LOGICA TORNEI COLLEGATI ---
    if (group?.import_linked_data && group.linked_group_ids && Array.isArray(group.linked_group_ids)) {
      const weight = group.tournament_match_weight || 1;

      for (const linkedId of group.linked_group_ids) {
        try {
          const safeLinkedId = String(linkedId).trim();
          if (!safeLinkedId) continue;

          const [linkedMatches, linkedPlayers] = await Promise.all([
            fetchMatches(safeLinkedId),
            fetchPlayers({ group_id: safeLinkedId })
          ]);

          if (linkedMatches && linkedMatches.length > 0) {
            allMatchesToProcess.push(...linkedMatches.map(lm => ({
              ...lm,
              is_linked: true,
              weight,
              _tournamentPlayers: linkedPlayers || []
            })));
          }

          const linkedGroupObj = allGroups.find(g => String(g.id).trim() === safeLinkedId);
          const tName = linkedGroupObj?.name || `Torneo ${safeLinkedId.substring(0, 5)}`;

          const assignPositionalBonus = (tids: string[], amount: number, label: string) => {
            if (!tids || !Array.isArray(tids) || amount <= 0) return;

            // Mappatura sicura: nomi dei giocatori nel team del torneo
            const nicksInTeam = tids.map(tid => {
              const lp = (linkedPlayers || []).find(p => String(p.id).trim() === String(tid).trim());
              return lp?.nickname?.toLowerCase().trim();
            }).filter(Boolean);

            players.forEach(p => {
              if (p.nickname && nicksInTeam.includes(p.nickname.toLowerCase().trim())) {
                const pid = String(p.id).trim();
                if (statsMap[pid]) {
                  statsMap[pid].points += amount;
                  statsMap[pid].bonus_points += amount;
                  statsMap[pid].tournament_bonus_points += amount;

                  if (!statsMap[pid].tournament_details) statsMap[pid].tournament_details = [];
                  let tDet = statsMap[pid].tournament_details!.find(d => d.name === tName);
                  if (!tDet) {
                    tDet = { name: tName, points: 0, achievements: [] };
                    statsMap[pid].tournament_details!.push(tDet);
                  }
                  tDet.points += amount;
                  tDet.achievements.push(label);
                }
              }
            });
          };

          // Calcolo Podio Torneo
          const finalMatch = (linkedMatches || []).find(m => m.match_phase === 'final' && m.status === 'played');
          if (finalMatch) {
            const sA = Number(finalMatch.team_a_score || 0), sB = Number(finalMatch.team_b_score || 0);
            const pA = Number(finalMatch.team_a_penalties || 0), pB = Number(finalMatch.team_b_penalties || 0);
            const aWins = sA > sB || (sA === sB && pA > pB);
            assignPositionalBonus(aWins ? finalMatch.team_a_players : finalMatch.team_b_players, group.tournament_win_bonus || 0, "1° Posto");
            assignPositionalBonus(aWins ? finalMatch.team_b_players : finalMatch.team_a_players, group.tournament_2nd_bonus || 0, "2° Posto");
          }

          const thirdMatch = (linkedMatches || []).find(m => m.match_phase === 'third_place' && m.status === 'played');
          if (thirdMatch) {
            const sA = Number(thirdMatch.team_a_score || 0), sB = Number(thirdMatch.team_b_score || 0);
            const pA = Number(thirdMatch.team_a_penalties || 0), pB = Number(thirdMatch.team_b_penalties || 0);
            const aWins = sA > sB || (sA === sB && pA > pB);
            assignPositionalBonus(aWins ? thirdMatch.team_a_players : thirdMatch.team_b_players, group.tournament_3rd_bonus || 0, "3° Posto");
            assignPositionalBonus(aWins ? thirdMatch.team_b_players : thirdMatch.team_a_players, group.tournament_4th_bonus || 0, "4° Posto");
          } else if (linkedGroupObj?.tournament_3rd_team_name || linkedGroupObj?.tournament_4th_team_name) {
             // Fallback per assegnazioni manuali via metadati
             const getPlayersOfTeam = (teamName: string) => {
               const pids = new Set<string>();
               (linkedMatches || []).forEach(mx => {
                 if (mx.team_a_name === teamName) mx.team_a_players?.forEach(id => pids.add(String(id).trim()));
                 if (mx.team_b_name === teamName) mx.team_b_players?.forEach(id => pids.add(String(id).trim()));
               });
               return Array.from(pids);
             };
             if (linkedGroupObj.tournament_3rd_team_name) assignPositionalBonus(getPlayersOfTeam(linkedGroupObj.tournament_3rd_team_name), group.tournament_3rd_bonus || 0, "3° Posto");
             if (linkedGroupObj.tournament_4th_team_name) assignPositionalBonus(getPlayersOfTeam(linkedGroupObj.tournament_4th_team_name), group.tournament_4th_bonus || 0, "4° Posto");
          }

          // Contatore tornei disputati
          players.forEach(p => {
            if (!p.nickname) return;
            const pNick = p.nickname.toLowerCase().trim();
            const hasPlayed = (linkedMatches || []).some(m => {
              const allMatchPids = [...(m.team_a_players || []), ...(m.team_b_players || [])];
              return allMatchPids.some(tid => {
                const lp = (linkedPlayers || []).find(lx => String(lx.id).trim() === String(tid).trim());
                return lp?.nickname?.toLowerCase().trim() === pNick;
              });
            });
            if (hasPlayed) statsMap[String(p.id).trim()].tournament_count++;
          });

          // Bonus Vincitore Girone (Career Mode)
          const groupWinnerBonus = group.tournament_group_winner_bonus || 0;
          if (groupWinnerBonus > 0) {
            const maxG = Math.max(0, ...linkedMatches.map(m => m.tournament_group || 1), linkedGroupObj?.num_groups || 1);
            for (let i = 1; i <= maxG; i++) {
              const teamStatsMap: Record<string, any> = {};
              const gironeMatches = linkedMatches.filter(m => (m.match_phase === 'group' || !m.match_phase) && Number(m.tournament_group || 1) === i && m.status === 'played');
              if (gironeMatches.length > 0) {
                gironeMatches.forEach(m => {
                  if (!teamStatsMap[m.team_a_name]) teamStatsMap[m.team_a_name] = { name: m.team_a_name, pts: 0, players: m.team_a_players };
                  if (!teamStatsMap[m.team_b_name]) teamStatsMap[m.team_b_name] = { name: m.team_b_name, pts: 0, players: m.team_b_players };
                  const sA = Number(m.team_a_score || 0), sB = Number(m.team_b_score || 0);
                  if (sA > sB) teamStatsMap[m.team_a_name].pts += 3;
                  else if (sB > sA) teamStatsMap[m.team_b_name].pts += 3;
                  else { teamStatsMap[m.team_a_name].pts += 1; teamStatsMap[m.team_b_name].pts += 1; }
                });
                const sorted = Object.values(teamStatsMap).sort((a: any, b: any) => b.pts - a.pts);
                if (sorted.length > 0) assignPositionalBonus(sorted[0].players, groupWinnerBonus, `Vincitore Girone ${i}`);
              }
            }
          }

          // Bonus Individuali (Marcatori e Assistman del torneo)
          const topG = group.tournament_top_scorer_bonus || 0;
          const topA = group.tournament_top_assistant_bonus || 0;
          if (topG > 0 || topA > 0) {
            const tournamentStats: Record<string, { g: number, a: number }> = {};
            linkedMatches.filter(m => m.status === 'played').forEach(m => {
              const allPids = [...(m.team_a_players || []), ...(m.team_b_players || [])];
              allPids.forEach(id => {
                const safeId = String(id).trim();
                if (!tournamentStats[safeId]) tournamentStats[safeId] = { g: 0, a: 0 };
                // Cerchiamo i goal/assist con trim della chiave per resilienza cloud
                const pG = Number(m.goals?.[safeId] || Object.entries(m.goals || {}).find(([k]) => k.trim() === safeId)?.[1] || 0);
                const pA = Number(m.assists?.[safeId] || Object.entries(m.assists || {}).find(([k]) => k.trim() === safeId)?.[1] || 0);
                tournamentStats[safeId].g += pG;
                tournamentStats[safeId].a += pA;
              });
            });

            const statsArray = Object.entries(tournamentStats);
            if (statsArray.length > 0) {
              if (topG > 0) {
                const maxG = Math.max(...statsArray.map(([, s]) => s.g));
                if (maxG > 0) {
                  const winners = statsArray.filter(([, s]) => s.g === maxG).map(([id]) => id);
                  assignPositionalBonus(winners, topG, "Capocannoniere");
                }
              }
              if (topA > 0) {
                const maxA = Math.max(...statsArray.map(([, s]) => s.a));
                if (maxA > 0) {
                  const winners = statsArray.filter(([, s]) => s.a === maxA).map(([id]) => id);
                  assignPositionalBonus(winners, topA, "Miglior Assistman");
                }
              }
            }
          }

        } catch (err) { console.warn("Errore processamento torneo collegato:", err); }
      }
    }

    // --- ELABORAZIONE PARTITE (Campionato + Tornei) ---
    allMatchesToProcess
      .filter(m => m && (m.status === 'played' || m.status === undefined) && m.team_a_name !== 'METADATA')
      .sort((a, b) => {
        const da = new Date(a.date || 0).getTime();
        const db = new Date(b.date || 0).getTime();
        return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
      })
      .forEach(m => {
        try {
          const sA = Number(m.team_a_score || 0), sB = Number(m.team_b_score || 0), isD = sA === sB, aW = sA > sB;
          const isLinked = !!(m as any).is_linked;
          const tournamentPlayers: Player[] = (m as any)._tournamentPlayers || [];

          const processMatchTeam = (pids: any[], score: number, opScore: number, win: boolean, cs: boolean) => {
            if (!pids || !Array.isArray(pids)) return;
            pids.forEach(rawId => {
              let pid = String(typeof rawId === 'object' ? (rawId.id || rawId.player_id) : rawId).trim();

              // Se l'ID non corrisponde (es. torneo collegato), cerchiamo per nickname
              if (!statsMap[pid]) {
                const lp = tournamentPlayers.find(x => String(x.id).trim() === pid);
                const nickToMatch = (lp?.nickname || (typeof rawId === 'object' ? rawId.nickname : pid)).toLowerCase().trim();
                const mp = players.find(p => p.nickname?.toLowerCase().trim() === nickToMatch);
                if (mp) pid = String(mp.id).trim(); else return;
              }

              const ps = statsMap[pid];
              if (!ps) return;

              ps.goals_done += score;
              ps.goals_suffered += opScore;

              if (!isLinked) {
                ps.played += 1;
                if (isD) { ps.drawn++; ps.points += Number(group?.points_draw ?? 1); ps.last_trend = 'D'; }
                else if (win) { ps.won++; ps.points += Number(group?.points_win ?? 3); ps.last_trend = 'W'; }
                else { ps.lost++; ps.last_trend = 'L'; }
              }

              // Goal e Assist (usando l'ID originale presente nel match per la ricerca nel dizionario)
              const originalId = String(typeof rawId === 'object' ? (rawId.id || rawId.player_id) : rawId).trim();
              ps.individual_goals += Number(m.goals?.[originalId] || 0);
              ps.individual_assists += Number(m.assists?.[originalId] || 0);

              // Bonus (solo per campionato)
              if (!isLinked && (group?.group_type === 'championship' || !group?.group_type)) {
                if (cs && !m.exclude_def_bonus) ps.clean_sheets++;
                let matchBonus = 0;

                const pG = Number(m.goals?.[originalId] || 0);
                const pA = Number(m.assists?.[originalId] || 0);

                if (group?.use_bonus && pG >= (group.bonus_goals_threshold || 2) && pA >= (group.bonus_assists_threshold || 2)) {
                  personalBonuses[pid]++;
                  ps.personal_bonus_count++;
                  if (!group?.use_balance_bonus) matchBonus++;
                }

                const roleIsEx = Array.isArray(group?.gk_bonus_excluded_roles) && group.gk_bonus_excluded_roles.includes(ps.role);
                if (group?.use_gk_bonus && !roleIsEx && opScore < (group.gk_bonus_threshold || 5) && !m.exclude_def_bonus) {
                  defenseBonuses[pid]++;
                  ps.defense_bonus_count++;
                  if (!group?.use_balance_bonus) matchBonus++;
                }

                if (group?.use_clean_sheet_bonus && cs && !m.exclude_def_bonus) matchBonus++;
                ps.points += matchBonus;
                ps.bonus_points += matchBonus;
              }
            });
          };

          processMatchTeam(m.team_a_players, sA, sB, aW, sB === 0);
          processMatchTeam(m.team_b_players, sB, sA, !aW && !isD, sA === 0);
        } catch (err) { console.warn("Errore riga match:", err); }
      });

    // --- CONTEGGI FINALI ---
    const tWeight = group?.tournament_match_weight || 1;
    Object.values(statsMap).forEach((ps: any) => {
      ps.career_divisor = ps.played + (ps.tournament_count * tWeight);
      if (ps.career_divisor < 1) ps.career_divisor = 1;

      ps.incisivity = Number(((ps.individual_goals + ps.individual_assists) / ps.career_divisor).toFixed(2));

      if (group?.use_balance_bonus) {
        const finalB = Math.max(personalBonuses[ps.player_id] || 0, defenseBonuses[ps.player_id] || 0);
        ps.points += finalB;
        ps.bonus_points += finalB;
      }
    });

    const compareStats = (a: PlayerStats, b: PlayerStats, crit: string | undefined) => {
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
      const r1 = compareStats(a, b, group?.tie_breaker_1 || 'ratio');
      if (r1 !== 0) return r1;
      const r2 = compareStats(a, b, group?.tie_breaker_2 || 'incisivity');
      if (r2 !== 0) return r2;
      return (b.goals_done - b.goals_suffered) - (a.goals_done - a.goals_suffered);
    });

  } catch (e) {
    console.error("CRITICAL ERROR in calculateStandings:", e);
    return [];
  }
};


export const createFullBackup = async (groupId: string): Promise<string> => {
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new Error('Gruppo non trovato');

  const players = await fetchPlayers({ group_id: groupId });
  const matches = await fetchMatches(groupId);

  const backup: any = {
    group,
    players,
    matches,
    version: '1.1',
    timestamp: new Date().toISOString(),
    linked_groups: []
  };

  // Se è un campionato con tornei collegati, includiamo anche quelli
  if (group.group_type === 'championship' && group.linked_group_ids && group.linked_group_ids.length > 0) {
    for (const linkedId of group.linked_group_ids) {
      try {
        const lg = groups.find(g => g.id === linkedId);
        if (lg) {
          const lp = await fetchPlayers({ group_id: linkedId });
          const lm = await fetchMatches(linkedId);
          backup.linked_groups.push({ group: lg, players: lp, matches: lm });
        }
      } catch (e) {
        console.warn(`Errore durante il backup del torneo collegato ${linkedId}:`, e);
      }
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
    // 1. Pulizia Cloud
    await supabase.from('players').delete().eq('group_id', groupId);
    await supabase.from('matches').delete().eq('group_id', groupId);

    // 2. Ripristino Giocatori con mappatura ID
    if (data.players.length > 0) {
      const playersToInsert = data.players.map((p: any) => ({
        nickname: p.nickname,
        name: p.name,
        surname: p.surname,
        date_of_birth: p.date_of_birth,
        role: p.role,
        strength: p.strength,
        group_id: groupId
      }));

      const { data: newPlayers, error: pError } = await supabase.from('players').insert(playersToInsert).select();
      if (pError) throw pError;

      if (newPlayers) {
        newPlayers.forEach((np: any) => {
          const oldP = data.players.find((op: any) => op.nickname === np.nickname);
          if (oldP) idMap[oldP.id] = np.id;
        });
      }
    }

    // 3. Ripristino Partite con ID aggiornati
    if (data.matches.length > 0) {
      const matchesToInsert = data.matches.map((m: any) => {
        const mapPlayerId = (oldId: string) => idMap[oldId] || oldId;
        const team_a = (m.team_a_players || []).map(mapPlayerId);
        const team_b = (m.team_b_players || []).map(mapPlayerId);
        const goals: Record<string, number> = {};
        if (m.goals) Object.entries(m.goals).forEach(([oid, val]) => { goals[mapPlayerId(oid)] = val as number; });
        const assists: Record<string, number> = {};
        if (m.assists) Object.entries(m.assists).forEach(([oid, val]) => { assists[mapPlayerId(oid)] = val as number; });

        return {
          group_id: groupId,
          date: m.date,
          team_a_players: team_a,
          team_b_players: team_b,
          team_a_score: m.team_a_score || 0,
          team_b_score: m.team_b_score || 0,
          team_a_name: m.team_a_name,
          team_b_name: m.team_b_name,
          team_a_color: m.team_a_color || 'Bianca',
          team_b_color: m.team_b_color || 'Rossa',
          team_a_own_goals: m.team_a_own_goals || 0,
          team_b_own_goals: m.team_b_own_goals || 0,
          goals,
          assists,
          description: m.description || '',
          location: m.location || '',
          status: m.status || 'played',
          match_phase: m.match_phase || 'group',
          tournament_group: m.tournament_group || 0,
          team_a_penalties: m.team_a_penalties || 0,
          team_b_penalties: m.team_b_penalties || 0,
          team_a_placeholder: m.team_a_placeholder || '',
          team_b_placeholder: m.team_b_placeholder || '',
          knockout_index: m.knockout_index,
          exclude_def_bonus: m.exclude_def_bonus
        };
      });

      const { error: mError } = await supabase.from('matches').insert(matchesToInsert);
      if (mError) throw mError;
    }
  }
  return idMap;
};

export const restoreFullBackup = async (groupId: string, jsonString: string): Promise<void> => {
  const backup = JSON.parse(jsonString);
  if (!backup.group || !backup.players || !backup.matches) throw new Error('Backup non valido');

  const groups = await fetchGroups();
  const targetGroup = groups.find(g => g.id === groupId);
  if (!targetGroup) throw new Error('Gruppo non trovato');

  // Ripristiniamo le impostazioni del gruppo principale (chirurgico)
  const groupPayload: Partial<Group> = {
    ...backup.group,
    id: groupId, // Manteniamo l'ID del gruppo attuale
    storage_type: targetGroup.storage_type // Manteniamo il tipo di storage attuale
  };
  delete (groupPayload as any).admin_id; // Non sovrascriviamo l'owner

  await updateGroup(groupId, groupPayload);

  // Ripristino dati principali
  await restoreGroupData(groupId, { players: backup.players, matches: backup.matches }, targetGroup.storage_type);

  // Ripristino tornei collegati (se presenti nel backup)
  if (backup.linked_groups && backup.linked_groups.length > 0) {
    const newLinkedIds: string[] = [];

    for (const linkedData of backup.linked_groups) {
      try {
        const newTournamentName = `${linkedData.group.name} (Ripristinato)`;
        const newTId = Math.random().toString(36).substring(7);

        if (targetGroup.storage_type === 'local') {
          const newTGroup: Group = {
            ...linkedData.group,
            id: newTId,
            name: newTournamentName,
            storage_type: 'local'
          };
          const currentGroups = await fetchGroups();
          const localOnly = currentGroups.filter(g => g.storage_type === 'local');
          await AsyncStorage.setItem('local_groups', JSON.stringify([...localOnly, newTGroup]));
          await restoreGroupData(newTId, { players: linkedData.players, matches: linkedData.matches }, 'local');
          newLinkedIds.push(newTId);
        } else {
          // Ripristino Cloud: creiamo un nuovo gruppo torneo
          const { data: { user } } = await supabase.auth.getUser();
          const { data: newTCloud, error: createError } = await supabase.from('groups').insert([{
            ...linkedData.group,
            name: newTournamentName,
            storage_type: 'cloud',
            admin_id: user?.id
          }]).select().single();

          if (!createError && newTCloud) {
            // Aggiungiamo ai joined e ruoli
            const joinedSaved = await AsyncStorage.getItem('joined_cloud_groups');
            const joined = joinedSaved ? JSON.parse(joinedSaved) : [];
            await AsyncStorage.setItem('joined_cloud_groups', JSON.stringify([...joined, newTCloud.id]));

            const rolesSaved = await AsyncStorage.getItem('cloud_group_roles');
            const roles = rolesSaved ? JSON.parse(rolesSaved) : {};
            roles[newTCloud.id] = 'owner';
            await AsyncStorage.setItem('cloud_group_roles', JSON.stringify(roles));

            await restoreGroupData(newTCloud.id, { players: linkedData.players, matches: linkedData.matches }, 'cloud');
            newLinkedIds.push(newTCloud.id);
          }
        }
      } catch (e) {
        console.warn("Ripristino torneo collegato fallito:", e);
      }
    }

    // Aggiorniamo il collegamento nel campionato principale
    if (newLinkedIds.length > 0) {
      await updateGroup(groupId, { linked_group_ids: newLinkedIds });
    }
  }

  await syncCloudData(groupId);
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

  // Applichiamo le modifiche temporanee ai giocatori selezionati
  const selected = players.filter(p => playerIds.includes(p.id)).map(p => {
    const modified = modifiedPlayers?.find(mp => mp.id === p.id);
    return modified ? { ...p, role: modified.role, strength: modified.strength } : p;
  });

  // Per N squadre (Torneo)
  if (numTeams > 2) {
    const groups = await fetchGroups();
    const group = groups.find(g => g.id === groupId);
    let bestTournamentResult: any = null;
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const teams: Player[][] = Array.from({ length: numTeams }, () => []);
      const teamStrengths: number[] = Array.from({ length: numTeams }, () => 0);
      const remaining: Player[] = [];

      // 1. Distribuzione per Ruoli (Garantisce varietà e vincolo portieri)
      ROLES.forEach(role => {
        const inRole = selected.filter(p => p.role === role).sort(() => Math.random() - 0.5);

        // Mischiamo l'ordine delle squadre per ogni ruolo per una distribuzione equa
        const teamIndices = Array.from({ length: numTeams }, (_, i) => i).sort(() => Math.random() - 0.5);

        inRole.forEach((p, i) => {
          if (i < numTeams) {
            // Primo giro: 1 giocatore per ruolo a ogni squadra (se disponibili)
            const targetIdx = teamIndices[i];
            teams[targetIdx].push(p);
            teamStrengths[targetIdx] += p.strength;
          } else {
            // Gli eccedenti vanno nel pool per il bilanciamento forza
            remaining.push(p);
          }
        });
      });

      // 2. Distribuzione dei Rimanenti (Greedy Bilanciato)
      remaining.sort((a, b) => b.strength - a.strength).forEach(p => {
        let targetIdx = -1;
        let minS = Infinity;

        for (let j = 0; j < numTeams; j++) {
          if (teams[j].length < matchType) {
            // Vincolo Portiere: Assolutamente non 2 per squadra
            if (p.role === 'Portiere' && teams[j].some(tp => tp.role === 'Portiere')) continue;

            if (teamStrengths[j] < minS) {
              minS = teamStrengths[j];
              targetIdx = j;
            }
          }
        }

        if (targetIdx !== -1) {
          teams[targetIdx].push(p);
          teamStrengths[targetIdx] += p.strength;
        } else {
          // Fallback di emergenza se un giocatore (es. portiere in eccesso) non ha trovato posto
          let fallbackIdx = -1;
          let minFallbackS = Infinity;
          for (let j = 0; j < numTeams; j++) {
            if (teams[j].length < matchType) {
              if (teamStrengths[j] < minFallbackS) {
                minFallbackS = teamStrengths[j];
                fallbackIdx = j;
              }
            }
          }
          if (fallbackIdx !== -1) {
            teams[fallbackIdx].push(p);
            teamStrengths[fallbackIdx] += p.strength;
          }
        }
      });

      const maxS = Math.max(...teamStrengths);
      const minS = Math.min(...teamStrengths);
      const diff = maxS - minS;

      if (!bestTournamentResult || diff < bestTournamentResult.diff) {
        bestTournamentResult = { teams, teamStrengths, diff };
        if (diff <= 0.3) break;
      }
    }

    const roleOrder: Record<string, number> = { 'Portiere': 1, 'Difensore': 2, 'Mediana': 3, 'Attaccante': 4 };
    const sortPlayers = (list: Player[]) => [...list].sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99) || b.strength - a.strength);

    const avgAge = (t: Player[]) => t.length ? Number((t.reduce((acc, p) => acc + p.age, 0) / t.length).toFixed(1)) : 0;

    const finalTeams = bestTournamentResult.teams.map((t: Player[], idx: number) => ({
      players: sortPlayers(t),
      name: `Squadra ${String.fromCharCode(65 + idx)}`, // Squadra A, B, C...
      color: JERSEY_COLORS[idx % JERSEY_COLORS.length].value,
      total_strength: Number(bestTournamentResult.teamStrengths[idx].toFixed(1)),
      avg_age: avgAge(t),
      key: String.fromCharCode(97 + idx) // a, b, c...
    }));

    const numG = group?.num_groups || 1;
    const teamsPerGroup = Math.ceil(finalTeams.length / numG);

    const teamsWithGroups = finalTeams.map((t: any, idx: number) => ({
      ...t,
      assigned_group: Math.floor(idx / teamsPerGroup) + 1
    }));

    return {
      team_a: teamsWithGroups[0].players,
      team_b: teamsWithGroups[1].players,
      team_a_total_strength: teamsWithGroups[0].total_strength,
      team_b_total_strength: teamsWithGroups[1].total_strength,
      team_a_avg_age: teamsWithGroups[0].avg_age,
      team_b_avg_age: teamsWithGroups[1].avg_age,
      team_a_name: teamsWithGroups[0].name,
      team_b_name: teamsWithGroups[1].name,
      team_a_color: teamsWithGroups[0].color,
      team_b_color: teamsWithGroups[1].color,
      teams: teamsWithGroups
    };
  }

  // Logica classica per 2 squadre (Campionato)
  let bestResult: { tA: Player[], tB: Player[], sA: number, sB: number, diff: number, score: number } | null = null;

  // Tentativi multipli per trovare il miglior bilanciamento possibile (minimo scarto)
  const iterations = 800;
  for (let i = 0; i < iterations; i++) {
    const teamA: Player[] = [], teamB: Player[] = [];
    let sA = 0, sB = 0;
    const remaining: Player[] = [];

    // 1. Distribuzione per Ruoli (Garantisce almeno 1 per ruolo se disponibili >= 2)
    ROLES.forEach(role => {
      const inRole = selected.filter(p => p.role === role).sort(() => Math.random() - 0.5);

      // Distribuiamo a coppie nei team A e B
      while (inRole.length >= 2) {
        const p1 = inRole.pop()!;
        const p2 = inRole.pop()!;

        // Alterniamo la squadra a cui assegnare il primo della coppia per varietà
        if (Math.random() > 0.5) {
          teamA.push(p1); sA += p1.strength;
          teamB.push(p2); sB += p2.strength;
        } else {
          teamB.push(p1); sB += p1.strength;
          teamA.push(p2); sA += p2.strength;
        }
      }

      // Se avanza un giocatore spaiato in quel ruolo, va nel pool dei "rimanenti"
      if (inRole.length === 1) remaining.push(inRole[0]);
    });

    // 2. Distribuzione dei Rimanenti (Pool greedy per bilanciare forza e numero)
    remaining.sort((a, b) => b.strength - a.strength).forEach(p => {
      // Priorità a chi ha meno giocatori o, a parità di numero, a chi ha meno forza
      const targetA = teamA.length < teamB.length || (teamA.length === teamB.length && sA <= sB);

      if (targetA) {
        teamA.push(p); sA += p.strength;
      } else {
        teamB.push(p); sB += p.strength;
      }
    });

    const diff = Math.abs(sA - sB);

    // 3. Penalità Identità (Scoraggia la generazione di squadre uguali alle precedenti)
    let identityPenalty = 0;
    if (previousTeamAIds && previousTeamAIds.length > 0) {
      const currentAIds = teamA.map(p => p.id);
      const intersection = currentAIds.filter(id => previousTeamAIds.includes(id));
      if (intersection.length >= teamA.length - 1) {
        identityPenalty = 10; // Malus pesante per evitare ripetizioni
      }
    }

    const totalScore = diff + identityPenalty;

    if (!bestResult || totalScore < bestResult.score) {
      bestResult = { tA: teamA, tB: teamB, sA, sB, diff, score: totalScore };
      if (totalScore <= 0.2) break; // Ottimo risultato trovato
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
    team_a_name: 'Squadra A',
    team_b_name: 'Squadra B',
    team_a_color: 'Bianca',
    team_b_color: 'Rossa'
  };
};

export const importPlayersExcel = async (groupId: string, data: any[]) => {
  let currentPlayers = await fetchPlayers({ group_id: groupId });

  for (const p of data) {
    const n: any = {};
    Object.keys(p).forEach(k => n[k.toLowerCase().trim()] = p[k]);

    const nick = n['nickname'] || n['nick'] || '';
    if (!nick) continue;

    const existingPlayer = currentPlayers.find(ep => ep.nickname.toLowerCase().trim() === nick.toLowerCase().trim());

    try {
      await savePlayer({
        id: existingPlayer?.id,
        nickname: nick,
        name: n['nome'] || n['name'] || '',
        surname: n['cognome'] || n['surname'] || '',
        date_of_birth: n['data di nascita'] || n['data_nascita'] || n['dob'] || '',
        role: n['ruolo'] || n['role'] || 'Attaccante',
        strength: parseFloat(n['forza'] || n['strength'] || '5') || 5,
        group_id: groupId
      });
    } catch (e) {
      console.warn("Salto giocatore duplicato durante import:", nick);
    }

    // Aggiorniamo la lista locale per evitare duplicati se lo stesso nickname è presente più volte nel file
    currentPlayers = await fetchPlayers({ group_id: groupId });
  }
};

export const exportPlayersExcel = async (groupId: string) => {
  const players = await fetchPlayers({ group_id: groupId });
  return players.map(p => ({
    Nickname: p.nickname,
    Nome: p.name || '',
    Cognome: p.surname || '',
    'Data di Nascita': p.date_of_birth || '',
    Ruolo: p.role,
    Forza: p.strength
  }));
};

export const generateTournamentSchedule = async (teams: any[], groupId: string, numGroups: number = 1, location?: string, startDate?: Date) => {
  // 1. Pulizia preventiva: eliminiamo tutte le partite del girone esistenti
  // per evitare duplicati in caso di rigenerazione (es. cambio nomi squadre)
  const groups = await fetchGroups();
  const group = groups.find(g => g.id === groupId);
  if (group) {
    if (group.storage_type === 'local') {
      const existingMatches = await fetchMatches(groupId);
      // Teniamo solo le partite che NON sono della fase a gironi (es. knockout)
      const remainingMatches = existingMatches.filter(m => m.match_phase !== 'group' && m.match_phase !== undefined);
      await AsyncStorage.setItem(`matches_${groupId}`, JSON.stringify(remainingMatches));
    } else {
      await setNeedsSync(groupId);
      // Eliminiamo solo i match della fase group dal cloud
      await supabase.from('matches').delete().eq('group_id', groupId).eq('match_phase', 'group');
    }
  }

  const generatedMatches: any[] = [];
  const baseDate = startDate instanceof Date ? startDate : new Date();

  const createRoundRobin = (groupTeams: any[], gNum: number) => {
    const n = groupTeams.length;
    if (n < 2) return;

    const teamsList = [...groupTeams];
    const isOdd = n % 2 !== 0;
    if (isOdd) teamsList.push(null); // Bye team

    const numTeams = teamsList.length;
    const numRounds = numTeams - 1;
    const matchesPerRound = numTeams / 2;

    for (let round = 0; round < numRounds; round++) {
      for (let match = 0; round < numRounds && match < matchesPerRound; match++) {
        const home = (round + match) % (numTeams - 1);
        const away = (numTeams - 1 - match + round) % (numTeams - 1);

        // La prima squadra è fissa alla fine della lista per il circle method
        const t1 = match === 0 ? teamsList[numTeams - 1] : teamsList[home];
        const t2 = teamsList[away];

        if (t1 && t2) {
          generatedMatches.push({
            group_id: groupId,
            // Aggiungiamo 20 min tra le giornate e 1 min tra i match della stessa giornata
            date: new Date(baseDate.getTime() + (round * 20 + match) * 60000).toISOString(),
            team_a_players: t1.players.map((p: any) => p.id),
            team_b_players: t2.players.map((p: any) => p.id),
            team_a_score: 0,
            team_b_score: 0,
            team_a_name: t1.name,
            team_b_name: t2.name,
            team_a_color: t1.color,
            team_b_color: t2.color,
            team_a_logo: t1.logo,
            team_b_logo: t2.logo,
            team_a_own_goals: 0,
            team_b_own_goals: 0,
            goals: {},
            assists: {},
            description: `G${round + 1} - ${t1.name} vs ${t2.name}`,
            location: location || '',
            status: 'scheduled',
            match_phase: 'group',
            tournament_group: gNum
          });
        }
      }
    }
  };

  const hasManualGroups = teams.some(t => t.assigned_group !== undefined);

  if (hasManualGroups) {
    for (let g = 1; g <= numGroups; g++) {
      const groupTeams = teams.filter(t => t.assigned_group === g);
      createRoundRobin(groupTeams, g);
    }
  } else {
    const teamsPerGroup = Math.ceil(teams.length / numGroups);
    for (let g = 0; g < numGroups; g++) {
      const groupTeams = teams.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup);
      createRoundRobin(groupTeams, g + 1);
    }
  }

  for (const m of generatedMatches) {
    await saveMatchResult(m);
  }
};

export const scheduleBirthdayNotifications = async () => {
  try {
    // 1. Controlla e richiedi i permessi (Fondamentale su Android 13+ e iOS)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    // Configura il canale per Android (Fondamentale per la visibilità)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Cancella notifiche precedenti per evitare doppioni
    await Notifications.cancelAllScheduledNotificationsAsync();

    const groups = await fetchGroups();
    for (const g of groups) {
      const players = await fetchPlayers({ group_id: g.id });
      for (const p of players) {
        if (p.date_of_birth) {
          const dob = new Date(p.date_of_birth);
          const today = new Date();

          // Se è oggi il compleanno
          if (dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth()) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "🎂 Buon Compleanno!",
                body: `Oggi è il compleanno di ${p.nickname}! Auguri! ⚽`,
                data: { playerId: p.id },
                sound: true,
              },
              trigger: null, // Subito
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Birthday notification error:", e);
  }
};
