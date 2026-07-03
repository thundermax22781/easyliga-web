import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
  Share,
  Image,
  TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import ViewShot from 'react-native-view-shot';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  fetchGroups,
  fetchPlayers,
  fetchMatches,
  generateTeams,
  saveMatchResult,
  deleteMatch,
  updateGroup,
  deletePlayer,
  savePlayer,
  checkSyncNeeded,
  importPlayersExcel,
  exportPlayersExcel,
  calculateStandings,
  generateTournamentSchedule,
  resetTournament,
  resetTournamentResults,
  syncCloudData,
  createFullBackup,
  restoreFullBackup,
  ROLE_COLORS,
  JERSEY_COLORS,
  ROLES,
  STRENGTH_VALUES,
  Player,
  Match,
  PlayerStats,
  TeamResult,
  Group
} from '../../src/api';
import { useTheme } from '../../src/ThemeContext';
import { useFocusEffect } from 'expo-router';

export default function GroupDetailScreen() {
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useTheme();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<PlayerStats[]>([]);
  const [activeTab, setActiveTab] = useState<'players' | 'teams' | 'standings' | 'matches' | 'tournament_standings' | 'bracket'>('players');
  const [selectedGirone, setSelectedGirone] = useState(1);
  const [showGironeSelector, setShowGironeSelector] = useState(false);
  const [showTeamDetails, setShowTeamDetails] = useState<any | null>(null);
  const [editingQuickMatch, setEditingQuickMatch] = useState<{ id: string, date: Date, type: 'date' | 'time' } | null>(null);
  const [manualStep, setManualStep] = useState(-1); // -1: off, 0..N: current team being picked
  const [manualTeamsData, setManualTeamsData] = useState<Player[][]>([]);
  const [sortBy, setSortBy] = useState<string>('points');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalRole, setModalRole] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Teams Generation State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [matchType, setMatchType] = useState(5);
  const [numTeams, setNumTeams] = useState(2);
  const [numGroups, setNumGroups] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [teams, setTeams] = useState<TeamResult | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamSelectedRole, setTeamSelectedRole] = useState<string | null>(null);
  const [showIndividualStrength, setShowIndividualStrength] = useState(false);

  // Match Result State
  const [showResultModal, setShowResultModal] = useState(false);
  const [scoreA, setScoreA] = useState('0');
  const [scoreB, setScoreB] = useState('0');
  const [matchGoals, setMatchGoals] = useState<Record<string, number>>({});
  const [matchAssists, setMatchAssists] = useState<Record<string, number>>({});
  const [teamAOwnGoals, setTeamAOwnGoals] = useState(0);
  const [teamBOwnGoals, setTeamBOwnGoals] = useState(0);
  const [penaltiesA, setPenaltiesA] = useState('0');
  const [penaltiesB, setPenaltiesB] = useState('0');
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editMatchNameA, setEditMatchNameA] = useState('');
  const [editMatchNameB, setEditMatchNameB] = useState('');
  const [editMatchColorA, setEditMatchColorA] = useState('Bianca');
  const [editMatchColorB, setEditMatchColorB] = useState('Rossa');
  const [editMatchLogoA, setEditMatchLogoA] = useState<string | undefined>();
  const [editMatchLogoB, setEditMatchLogoB] = useState<string | undefined>();


  // Settings / Config
  const [showConfig, setShowConfig] = useState(false);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showTieBreakerSelector, setShowTieBreakerSelector] = useState<{ num: number } | null>(null);
  const [showImportPlayersModal, setShowImportPlayersModal] = useState(false);
  const [importingPlayers, setImportingPlayers] = useState(false);
  const [showKnockoutBuilder, setShowKnockoutBuilder] = useState(false);
  const [builderMatches, setBuilderMatches] = useState<{ teamA: string, teamB: string, desc: string, phase: string }[]>([]);
  const [builderSelection, setBuilderSelection] = useState<{ idx: number, side: 'a' | 'b' } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<'a' | 'b' | 'global' | null>(null);
  const [showNameEditor, setShowNameEditor] = useState<'a' | 'b' | 'global' | null>(null);
  const [showPlayerSelector, setShowPlayerSelector] = useState(false);
  const [showPlayerEditor, setShowPlayerEditor] = useState<{ id: string, team: 'a' | 'b' } | null>(null);
  const [tempRole, setTempRole] = useState('');
  const [tempStrength, setTempStrength] = useState(5);
  const [tempTeamName, setTempTeamName] = useState('');
  const [tempJerseyColor, setTempJerseyColor] = useState('');
  const [importing, setImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle');
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);

  // Match Info Editor
  const [matchDescription, setMatchDescription] = useState('');
  const [matchDate, setMatchDate] = useState(new Date());
  const [matchLocation, setMatchLocation] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [sharingMatch, setSharingMatch] = useState<Match | null>(null);
  const [sharingStandings, setSharingStandings] = useState(false);
  const [sharingTournamentStandings, setSharingTournamentStandings] = useState(false);
  const [sharingBracket, setSharingBracket] = useState(false);
  const [sharingMatchesList, setSharingMatchesList] = useState(false);
  const [sharingPlayersList, setSharingPlayersList] = useState(false);
  const [showCareerSettings, setShowCareerSettings] = useState(false);
  const matchViewShotRef = useRef<ViewShot>(null);
  const standingsViewShotRef = useRef<ViewShot>(null);
  const bracketViewShotRef = useRef<ViewShot>(null);
  const matchesListViewShotRef = useRef<ViewShot>(null);
  const playersListViewShotRef = useRef<ViewShot>(null);
  const teamDetailsViewShotRef = useRef<ViewShot>(null);
  const [sharingTeamDetails, setSharingTeamDetails] = useState<any>(null);




  const [showPodiumSelector, setShowPodiumSelector] = useState<'3rd' | '4th' | null>(null);

  const [resolvedGroupNames, setResolvedGroupNames] = useState<Record<string, string>>({});

  useEffect(() => {
    // Risoluzione nomi tornei collegati che non sono presenti in allGroups
    if (group?.linked_group_ids) {
      group.linked_group_ids.forEach(async (lid) => {
        if (!allGroups.find(g => g.id === lid) && !resolvedGroupNames[lid]) {
           const { fetchGroupInfo } = require('../../src/api');
           const info = await fetchGroupInfo(lid);
           if (info?.name) {
             setResolvedGroupNames(prev => ({ ...prev, [lid]: info.name }));
           }
        }
      });
    }
  }, [group?.linked_group_ids, allGroups]);

  const isAdminOrOwner = group?.role === 'owner' || group?.role === 'admin';
  const groupMatches = matches.filter(m => !m.match_phase || m.match_phase === 'group');
  const isGroupPhaseComplete = groupMatches.length > 0 && groupMatches.every(m => m.status === 'played');

  // Mappatura automatica dei placeholder (es. "1-G1") ai nomi delle squadre qualificate
  const qualifiedTeamsMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (!group?.num_groups) return map;

    for (let gNum = 1; gNum <= group.num_groups; gNum++) {
      const teamStats: Record<string, any> = {};
      const gironeMatches = matches.filter(m => {
        const isGP = !m.match_phase || m.match_phase === 'group';
        const mG = m.tournament_group || 1;
        return isGP && Number(mG) === gNum;
      });

      if (gironeMatches.length === 0) continue;

      // Calcolo classifica rapido per questo girone
      gironeMatches.forEach(m => {
        if (!teamStats[m.team_a_name]) teamStats[m.team_a_name] = { name: m.team_a_name, points: 0, dg: 0, gf: 0 };
        if (!teamStats[m.team_b_name]) teamStats[m.team_b_name] = { name: m.team_b_name, points: 0, dg: 0, gf: 0 };
      });

      gironeMatches.filter(m => m.status === 'played').forEach(m => {
        const sA = teamStats[m.team_a_name];
        const sB = teamStats[m.team_b_name];
        sA.gf += (m.team_a_score || 0); sA.dg += (m.team_a_score || 0) - (m.team_b_score || 0);
        sB.gf += (m.team_b_score || 0); sB.dg += (m.team_b_score || 0) - (m.team_a_score || 0);
        if (m.team_a_score > m.team_b_score) sA.points += (group.points_win ?? 3);
        else if (m.team_b_score > m.team_a_score) sB.points += (group.points_win ?? 3);
        else { sA.points += (group.points_draw ?? 1); sB.points += (group.points_draw ?? 1); }
      });

      const sorted = Object.values(teamStats).sort((a, b) => b.points - a.points || b.dg - a.dg || b.gf - a.gf);
      sorted.forEach((team, idx) => {
        map[`${idx + 1}-G${gNum}`] = team.name;
      });
    }
    return map;
  }, [matches, group]);

  const getResolvedTeamInfo = (m: Match, side: 'a' | 'b'): { name: string, logo?: string, color: string } => {
    const placeholder = side === 'a' ? m.team_a_placeholder : m.team_b_placeholder;
    const actualName = side === 'a' ? m.team_a_name : m.team_b_name;
    const actualLogo = side === 'a' ? m.team_a_logo : m.team_b_logo;
    const actualColor = side === 'a' ? m.team_a_color : m.team_b_color;

    const isGeneric = (name: string | undefined) =>
      !name ||
      name.toLowerCase().startsWith('vincitore') ||
      name.toLowerCase().startsWith('squadra') ||
      name.toLowerCase().startsWith('incontro') ||
      name.toLowerCase().includes('-g');

    // 1. Se abbiamo un placeholder (es. 1-G1 o W-I1), proviamo a risolverlo
    if (placeholder) {
      // Caso 1: Posizione nel girone (es. 1-G1)
      if (placeholder.includes('-G')) {
        // Se il girone non è ancora terminato, NON mostriamo i nomi delle squadre
        if (!isGroupPhaseComplete) {
          return { name: placeholder.replace('-', ' '), logo: undefined, color: '#8E8E93' };
        }

        if (qualifiedTeamsMap[placeholder]) {
           const teamName = qualifiedTeamsMap[placeholder];
           const gironeMatch = matches.find(mx => (mx.team_a_name === teamName || mx.team_b_name === teamName) && (!mx.match_phase || mx.match_phase === 'group'));
           if (gironeMatch) {
             const isA = gironeMatch.team_a_name === teamName;
             return {
                name: teamName,
                logo: (isA ? gironeMatch.team_a_logo : gironeMatch.team_b_logo) || actualLogo,
                color: (isA ? gironeMatch.team_a_color : gironeMatch.team_b_color) || actualColor
             };
           }
           return { name: teamName, logo: actualLogo, color: actualColor };
        }
        return { name: placeholder.replace('-', '° Girone '), logo: actualLogo, color: actualColor };
      }

      // Caso 2: Vincitore di un incontro precedente (es. W-I1)
      if (placeholder.toUpperCase().startsWith('W-I')) {
        const refIdx = parseInt(placeholder.substring(3));

        // Cerchiamo il match di riferimento:
        // 1. Tramite knockout_index (metodo affidabile)
        // 2. Tramite descrizione (vecchio metodo)
        // 3. Tramite posizione nella lista cronologica dei match eliminatori (fallback estremo)
        const knockoutMatches = matches
          .filter(x => x.match_phase && x.match_phase !== 'group')
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const refMatch = matches.find(x => x.knockout_index === refIdx) ||
                         matches.find(x =>
                            x.description?.toLowerCase().includes(`incontro ${refIdx}`) ||
                            x.description?.toLowerCase().includes(`inc. ${refIdx}`)
                         ) ||
                         knockoutMatches[refIdx - 1];

        if (refMatch) {
          if (refMatch.status === 'played') {
            const scoreA = Number(refMatch.team_a_score || 0);
            const scoreB = Number(refMatch.team_b_score || 0);
            const penA = Number(refMatch.team_a_penalties || 0);
            const penB = Number(refMatch.team_b_penalties || 0);
            const aWins = scoreA > scoreB || (scoreA === scoreB && penA > penB);
            return getResolvedTeamInfo(refMatch, aWins ? 'a' : 'b');
          }
          // Se il match non è ancora giocato, ma abbiamo già nomi reali salvati, usiamoli
          if (actualName && !isGeneric(actualName)) return { name: actualName, logo: actualLogo, color: actualColor };
          // Altrimenti proiettiamo il nome del vincitore potenziale usando la descrizione se disponibile
          const placeholderName = refMatch.description ? `Vincitore ${refMatch.description}` : `Vincitore Inc. ${refIdx}`;
          return { name: placeholderName, logo: actualLogo, color: actualColor };
        }
      }
    }

    return { name: actualName || `Squadra ${side.toUpperCase()}`, logo: actualLogo, color: actualColor };
  };


  const getDisplayName = (m: Match, side: 'a' | 'b'): string => {
    return getResolvedTeamInfo(m, side).name;
  };


  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [groupId])
  );

  const loadData = async (forceSync = false) => {
    if (!groupId) return;
    try {
      // 1. Caricamento parallelo ultra-veloce
      const [p, m, groups] = await Promise.all([
        fetchPlayers({ group_id: groupId }),
        fetchMatches(groupId),
        fetchGroups()
      ]);

      setAllGroups(groups);
      // Imposta subito i dati (AsyncStorage è quasi istantaneo)
      setPlayers(p);
      setMatches(m);

      const currentGroup = groups.find(g => g.id === groupId);
      if (currentGroup) {
        setGroup(currentGroup);
        setMatchType(currentGroup.match_type || 5);
        setNumTeams(currentGroup.group_type === 'tournament' ? (currentGroup.num_teams || 4) : 2);
        setNumGroups(currentGroup.num_groups || 1);
      }

      setLoading(false);
      setRefreshing(false);

      // 2. Calcolo classifica in background passando i dati già pronti
      calculateStandings(groupId, p, m).then(s => {
        setStandings(s);
      });

      // 3. Sync Cloud asincrono
      if (!forceSync) {
        checkSyncNeeded(groupId).then(needed => {
          setHasUnsyncedChanges(needed);
        });
      } else {
        setSyncStatus('syncing');
        await syncCloudData(groupId);
        const [pUpdated, mUpdated, groupsUpdated] = await Promise.all([fetchPlayers({ group_id: groupId }), fetchMatches(groupId), fetchGroups()]);
        const currentUpdated = groupsUpdated.find(g => g.id === groupId);
        if (currentUpdated) {
          setGroup(currentUpdated);
          setMatchType(currentUpdated.match_type || 5);
          setNumTeams(currentUpdated.group_type === 'tournament' ? (currentUpdated.num_teams || 4) : 2);
          setNumGroups(currentUpdated.num_groups || 1);
        }
        setPlayers(pUpdated);
        setMatches(mUpdated);
        calculateStandings(groupId, pUpdated, mUpdated).then(s => setStandings(s));
        setHasUnsyncedChanges(false);
        setSyncStatus('done');
      }
    } catch (e) {
      console.error("LoadData Error:", e);
      setLoading(false);
      setRefreshing(false);
      setSyncStatus('idle');
    }
  };

  const togglePlayer = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      // In modalità manuale il limite è matchType (una squadra alla volta)
      const limit = manualStep !== -1 ? matchType : (group?.group_type === 'tournament' ? matchType * numTeams : matchType * 2);
      if (next.size >= limit) return;

      const playerToAdd = players.find(p => p.id === id);
      if (playerToAdd?.role === 'Portiere') {
        const selectedGks = players.filter(p => next.has(p.id) && p.role === 'Portiere').length;
        // In manuale max 1 portiere per squadra, altrimenti limite totale
        const gkLimit = manualStep !== -1 ? 1 : (group?.group_type === 'tournament' ? numTeams : 2);
        if (selectedGks >= gkLimit) {
          Alert.alert('Limite Portieri', manualStep !== -1 ? 'Una squadra può avere un solo portiere.' : `Puoi selezionare al massimo ${gkLimit} portieri.`);
          return;
        }
      }
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (manualStep !== -1) return; // Disabilita "Tutti" in modalità manuale
    const limit = group?.group_type === 'tournament' ? matchType * numTeams : matchType * 2;
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      // Seleziona i primi N giocatori rispettando il limite dei portieri
      const next = new Set<string>();
      let gksCount = 0;
      const gkLimit = group?.group_type === 'tournament' ? numTeams : 2;

      for (const p of filteredPlayersForTeams) {
        if (next.size >= limit) break;
        if (p.role === 'Portiere') {
          if (gksCount < gkLimit) {
            next.add(p.id);
            gksCount++;
          }
        } else {
          next.add(p.id);
        }
      }
      setSelectedIds(next);
    }
  };

  const startManualSelection = () => {
    setManualStep(0);
    setManualTeamsData([]);
    setSelectedIds(new Set());
  };

  const handleNextManualStep = () => {
    if (selectedIds.size === 0) {
      return Alert.alert('Squadra Vuota', 'Seleziona almeno un giocatore per questa squadra.');
    }
    if (selectedIds.size > matchType) {
      return Alert.alert('Limite Superato', `Puoi selezionare al massimo ${matchType} giocatori.`);
    }

    const currentTeamPlayers = players.filter(p => selectedIds.has(p.id));
    const newManualTeams = [...manualTeamsData, currentTeamPlayers];
    setManualTeamsData(newManualTeams);
    setSelectedIds(new Set());

    const nextIdx = manualStep + 1;
    const totalTeams = group?.group_type === 'tournament' ? (group?.num_teams || 2) : 2;

    if (nextIdx < totalTeams) {
      setManualStep(nextIdx);
    } else {
      // Fine selezione: Genera oggetto Teams
      const roleOrder: Record<string, number> = { 'Portiere': 1, 'Difensore': 2, 'Mediana': 3, 'Attaccante': 4 };
      const sortPlayersByRole = (list: Player[]) => [...list].sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99) || b.strength - a.strength);

      const finalTeams = newManualTeams.map((tPlayers, i) => ({
        players: sortPlayersByRole(tPlayers),
        name: `Squadra ${String.fromCharCode(65 + i)}`,
        color: JERSEY_COLORS[i % JERSEY_COLORS.length].value,
        total_strength: Number(tPlayers.reduce((acc, p) => acc + p.strength, 0).toFixed(1)),
        avg_age: tPlayers.length ? Number((tPlayers.reduce((acc, p) => acc + p.age, 0) / tPlayers.length).toFixed(1)) : 0,
        key: String.fromCharCode(97 + i),
        assigned_group: group?.num_groups ? (Math.floor(i / Math.ceil(newManualTeams.length / group.num_groups)) + 1) : 1
      }));

      setTeams({
        team_a: finalTeams[0].players,
        team_b: finalTeams[1].players,
        team_a_total_strength: finalTeams[0].total_strength,
        team_b_total_strength: finalTeams[1].total_strength,
        team_a_avg_age: finalTeams[0].avg_age,
        team_b_avg_age: finalTeams[1].avg_age,
        team_a_name: finalTeams[0].name,
        team_b_name: finalTeams[1].name,
        team_a_color: finalTeams[0].color,
        team_b_color: finalTeams[1].color,
        teams: finalTeams
      });
      setManualStep(-1);
    }

  };

  const handleGenerate = async (manual = false) => {
    if (manual) {
      startManualSelection();
      return;
    }

    const requiredPlayers = group?.group_type === 'tournament' ? matchType * numTeams : matchType * 2;

    if (selectedIds.size !== requiredPlayers) {
      return Alert.alert('Errore', `Seleziona esattamente ${requiredPlayers} giocatori.`);
    }
    setGenerating(true);
    try {
      const currentPlayersInTeams = teams ? (teams.teams ? teams.teams.flatMap(t => t.players) : [...(teams.team_a || []), ...(teams.team_b || [])]) : [];
      const res = await generateTeams(
        Array.from(selectedIds),
        matchType,
        groupId as string,
        group?.group_type === 'tournament' ? numTeams : 2,
        teams?.team_a.map(p => p.id),
        currentPlayersInTeams
      );

      if (teams) {
        if (res.teams && teams.teams) {
          res.teams = res.teams.map((t, idx) => ({
            ...t,
            name: teams.teams[idx]?.name || t.name,
            color: teams.teams[idx]?.color || t.color,
            logo: teams.teams[idx]?.logo || t.logo
          }));
          // Sincronizziamo anche le proprietà top-level
          res.team_a_name = res.teams[0].name;
          res.team_b_name = res.teams[1].name;
          res.team_a_color = res.teams[0].color;
          res.team_b_color = res.teams[1].color;
          res.team_a_logo = res.teams[0].logo;
          res.team_b_logo = res.teams[1].logo;
        } else {
          res.team_a_name = teams.team_a_name;
          res.team_b_name = teams.team_b_name;
          res.team_a_color = teams.team_a_color;
          res.team_b_color = teams.team_b_color;
          res.team_a_logo = teams.team_a_logo;
          res.team_b_logo = teams.team_b_logo;
        }
      }

      setTeams(res);
    } catch (e) {

      Alert.alert('Errore', 'Generazione fallita');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateKnockout = async () => {
    setBuilderMatches([{ teamA: '', teamB: '', desc: 'Incontro 1', phase: 'semifinal' }]);
    setShowKnockoutBuilder(true);
  };

  const renderKnockoutBuilderModal = () => {
    if (!showKnockoutBuilder) return null;
    const rankings = getRankingsByGirone();
    const availableSlots: string[] = [];
    Object.keys(rankings).forEach(gNum => {
      rankings[Number(gNum)].forEach((_, idx) => {
        availableSlots.push(`${idx + 1}-G${gNum}`);
      });
    });
    // Aggiunge i vincitori degli incontri precedenti nel builder
    builderMatches.forEach((_, bIdx) => {
      availableSlots.push(`W-I${bIdx + 1}`);
    });

    const handleAddMatch = () => {
      setBuilderMatches([...builderMatches, { teamA: '', teamB: '', desc: `Incontro ${builderMatches.length + 1}`, phase: 'semifinal' }]);
    };

    const handleSaveKnockout = async () => {
      if (builderMatches.some(m => !m.teamA || !m.teamB)) {
        return Alert.alert('Attenzione', 'Completa tutti gli accoppiamenti prima di procedere.');
      }

      setGenerating(true);
      try {
        for (const bm of builderMatches) {
          const isRefA = bm.teamA.startsWith('W-I');
          const isRefB = bm.teamB.startsWith('W-I');

          let teamAObj: any = { name: `Vincitore ${bm.teamA.replace('W-I', 'Incontro ')}`, color: 'Grigia', players: [] };
          let teamBObj: any = { name: `Vincitore ${bm.teamB.replace('W-I', 'Incontro ')}`, color: 'Grigia', players: [] };

          if (!isRefA) {
            const [posA, gA] = bm.teamA.split('-G');
            teamAObj = rankings[Number(gA)][Number(posA) - 1];
          }
          if (!isRefB) {
            const [posB, gB] = bm.teamB.split('-G');
            teamBObj = rankings[Number(gB)][Number(posB) - 1];
          }

          if (!teamAObj || !teamBObj) continue;

          const newMatch: Match = {
            id: '',
            group_id: groupId as string,
            date: new Date().toISOString(),
            team_a_players: teamAObj.players || [],
            team_b_players: teamBObj.players || [],
            team_a_score: 0,
            team_b_score: 0,
            team_a_name: teamAObj.name,
            team_b_name: teamBObj.name,
            team_a_color: teamAObj.color,
            team_b_color: teamBObj.color,
            team_a_logo: teamAObj.logo,
            team_b_logo: teamBObj.logo,
            status: 'scheduled',

            match_phase: bm.phase as any,
            description: bm.desc,
            team_a_placeholder: bm.teamA,
            team_b_placeholder: bm.teamB,
            knockout_index: builderMatches.indexOf(bm) + 1
          };
          await saveMatchResult(newMatch);
        }
        setShowKnockoutBuilder(false);
        setActiveTab('tournament_standings');
        setSelectedGirone(0);
        loadData();
      } catch (e) {
        Alert.alert('Errore', 'Generazione fase finale fallita.');
      } finally {
        setGenerating(false);
      }
    };

    const knockoutPhases = [
      { id: 'quarterfinal', label: 'Quarti' },
      { id: 'semifinal', label: 'Semi' },
      { id: 'final', label: 'Finale' },
      { id: 'third_place', label: '3° Posto' }
    ];

    return (
      <Modal visible={true} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, dynamicStyles.text]}>Builder Fase Finale</Text>
                <Text style={[dynamicStyles.subText, { fontSize: 12 }]}>Configura gli scontri e definisci le fasi</Text>
              </View>
              <TouchableOpacity onPress={() => setShowKnockoutBuilder(false)}>
                <Ionicons name="close" size={28} color={dynamicStyles.text.color} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {builderMatches.map((m, idx) => (
                <View key={idx} style={[styles.pCard, dynamicStyles.card, { marginVertical: 8, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#5856D640', flexDirection: 'column', alignItems: 'stretch' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <TextInput
                      style={[dynamicStyles.text, { fontSize: 16, fontWeight: '900', flex: 1, backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 10 }]}
                      value={m.desc}
                      onChangeText={(val) => {
                        const newMatches = [...builderMatches];
                        newMatches[idx].desc = val;
                        setBuilderMatches(newMatches);
                      }}
                      placeholder="Descrizione (es. Quarto 1)"
                    />
                    <TouchableOpacity onPress={() => setBuilderMatches(builderMatches.filter((_, i) => i !== idx))}>
                      <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 15 }}>
                    {knockoutPhases.map(ph => (
                      <TouchableOpacity
                        key={ph.id}
                        onPress={() => {
                          const newMatches = [...builderMatches];
                          newMatches[idx].phase = ph.id as any;
                          setBuilderMatches(newMatches);
                        }}
                        style={{
                          flex: 1,
                          height: 32,
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: m.phase === ph.id ? '#5856D6' : (isDarkMode ? '#2C2C2E' : '#E5E5EA')
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: m.phase === ph.id ? '#FFF' : (isDarkMode ? '#8E8E93' : '#666') }}>{ph.label.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setBuilderSelection({ idx, side: 'a' })}
                      style={{ flex: 1, height: 65, backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: m.teamA ? 2 : 0, borderColor: '#5856D6' }}
                    >
                      <Text style={[dynamicStyles.text, { fontWeight: '900', fontSize: 20, color: m.teamA ? '#5856D6' : '#8E8E93' }]}>{m.teamA ? m.teamA.replace('-', ' ') : 'Scegli'}</Text>
                    </TouchableOpacity>

                    <Ionicons name="flash" size={24} color="#5856D6" style={{ opacity: 0.2 }} />

                    <TouchableOpacity
                      onPress={() => setBuilderSelection({ idx, side: 'b' })}
                      style={{ flex: 1, height: 65, backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: m.teamB ? 2 : 0, borderColor: '#5856D6' }}
                    >
                      <Text style={[dynamicStyles.text, { fontWeight: '900', fontSize: 20, color: m.teamB ? '#5856D6' : '#8E8E93' }]}>{m.teamB ? m.teamB.replace('-', ' ') : 'Scegli'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                onPress={handleAddMatch}
                style={{ height: 60, borderStyle: 'dashed', borderWidth: 2, borderColor: '#8E8E93', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 15, flexDirection: 'row', gap: 10 }}
              >
                <Ionicons name="add-circle-outline" size={24} color="#8E8E93" />
                <Text style={{ color: '#8E8E93', fontWeight: '800' }}>AGGIUNGI INCONTRO</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveKnockout}
              style={[styles.mainShareBtn, { backgroundColor: '#5856D6', marginHorizontal: 0, marginTop: 20 }]}
              disabled={generating || builderMatches.length === 0}
            >
              <Ionicons name="trophy" size={22} color="#FFF" style={{ marginRight: 10 }} />
              <Text style={styles.mainShareBtnText}>{generating ? 'Generazione...' : 'Conferma e Crea'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {builderSelection && (
          <Modal visible={true} transparent animationType="fade">
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center' }]}>
              <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '70%', marginHorizontal: 20, borderRadius: 24 }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, dynamicStyles.text]}>Scegli Posizione</Text>
                  <TouchableOpacity onPress={() => setBuilderSelection(null)}>
                    <Ionicons name="close" size={24} color={dynamicStyles.text.color} />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={true}>
                  {availableSlots.filter(slot => {
                    // Escludi slot già selezionati in altri incontri (o nell'altro lato dello stesso incontro)
                    const isAlreadyUsed = builderMatches.some((bm, bIdx) => {
                       // Se è lo slot che stiamo modificando proprio ora, non considerarlo "usato" per mostrare la selezione attuale
                       // Ma in realtà vogliamo vedere cosa NON è ancora stato scelto.
                       return (bm.teamA === slot || bm.teamB === slot);
                    });

                    if (isAlreadyUsed) return false;

                    if (slot.startsWith('W-I')) {
                      const refIdx = parseInt(slot.substring(3));
                      // Permette di selezionare qualsiasi vincitore di un incontro esistente,
                      // purché non sia l'incontro stesso (per evitare loop)
                      return refIdx !== (builderSelection.idx + 1);
                    }
                    return true;
                  }).map(slot => {
                    const isWinnerRef = slot.startsWith('W-I');
                    let label = "";
                    let color = "#8E8E93";

                    if (isWinnerRef) {
                      label = `VINCITORE INCONTRO ${slot.substring(3)}`;
                      color = "#FF9500";
                    } else {
                      const [pos, gNum] = slot.split('-G');
                      label = `${pos} G${gNum}`;
                      color = getGironeColor(Number(gNum));
                    }

                    return (
                      <TouchableOpacity
                        key={slot}
                        onPress={() => {
                          const newM = [...builderMatches];
                          if (builderSelection.side === 'a') newM[builderSelection.idx].teamA = slot;
                          else newM[builderSelection.idx].teamB = slot;
                          setBuilderMatches(newM);
                          setBuilderSelection(null);
                        }}
                        style={[styles.pCard, dynamicStyles.card, { marginVertical: 5, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }]}
                      >
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                          <View style={{ backgroundColor: color, width: isWinnerRef ? 180 : 65, height: 45, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: isWinnerRef ? 12 : 18 }}>{label}</Text>
                          </View>
                        </View>
                        <Ionicons name="add-circle" size={28} color="#34C759" />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </Modal>
    );
  };

  const handleGenerateGirone = async () => {
    if (!teams || !teams.teams) return;

    // Validazione bilanciamento gironi
    const numGroups = group?.num_groups || 1;
    if (numGroups > 1) {
      const groupCounts: Record<number, number> = {};
      // Inizializziamo i contatori per tutti i gironi previsti
      for (let i = 1; i <= numGroups; i++) groupCounts[i] = 0;

      teams.teams.forEach((t: any) => {
        const g = t.assigned_group || 1;
        groupCounts[g] = (groupCounts[g] || 0) + 1;
      });

      const counts = Object.values(groupCounts);
      const allEqual = counts.every(c => c === counts[0]);
      const anyEmpty = counts.some(c => c === 0);

      if (anyEmpty) {
        return Alert.alert('Errore Gironi', 'Uno o più gironi sono vuoti. Ogni girone deve avere almeno 2 squadre.');
      }

      if (!allEqual) {
        return Alert.alert(
          'Gironi Sbilanciati',
          'Il numero di squadre non è uguale in tutti i gironi. Per favore, sposta le squadre in modo che ogni girone abbia lo stesso numero di partecipanti.',
          [{ text: 'Sistemiamo', style: 'cancel' }]
        );
      }
    }

    setGenerating(true);
    try {
      await generateTournamentSchedule(teams.teams, groupId as string, group?.num_groups || 1, matchLocation, matchDate);
      Alert.alert('Successo', 'Girone generato correttamente! Trovi tutte le partite nella tab Risultati.');
      setTeams(null);
      setActiveTab('matches');
      loadData();
    } catch (e: any) {
      console.error("Generate Girone Error:", e);
      Alert.alert('Errore', `Impossibile generare il girone: ${e.message || 'Errore sconosciuto'}`);
    } finally {
      setGenerating(false);
    }
  };

  const movePlayer = (playerId: string, fromTeamKey: string, direction: 'up' | 'down') => {
    if (!teams) return;
    const newTeams = { ...teams };

    // Gestione dinamica per N squadre (Torneo) o 2 squadre (Campionato)
    let teamData: any[] = [];
    if (newTeams.teams) {
      teamData = [...newTeams.teams];
      const tIdx = teamData.findIndex(t => t.key === fromTeamKey);
      if (tIdx === -1) return;

      const list = [...teamData[tIdx].players];
      const pIdx = list.findIndex(p => p.id === playerId);
      if (pIdx === -1) return;

      if (direction === 'up' && pIdx > 0) [list[pIdx], list[pIdx - 1]] = [list[pIdx - 1], list[pIdx]];
      else if (direction === 'down' && pIdx < list.length - 1) [list[pIdx], list[pIdx + 1]] = [list[pIdx + 1], list[pIdx]];

      teamData[tIdx].players = list;
      newTeams.teams = teamData;
    } else {
      // Logica classica campionato
      const list = fromTeamKey === 'a' ? [...newTeams.team_a] : [...newTeams.team_b];
      const index = list.findIndex(p => p.id === playerId);
      if (index === -1) return;
      if (direction === 'up' && index > 0) [list[index], list[index - 1]] = [list[index - 1], list[index]];
      else if (direction === 'down' && index < list.length - 1) [list[index], list[index + 1]] = [list[index + 1], list[index]];
      if (fromTeamKey === 'a') newTeams.team_a = list; else newTeams.team_b = list;
    }
    setTeams(newTeams);
  };

  const roleOrder: Record<string, number> = { 'Portiere': 1, 'Difensore': 2, 'Mediana': 3, 'Attaccante': 4 };
  const sortPlayersByRole = (list: Player[]) => [...list].sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99) || b.strength - a.strength);

  const swapPlayer = (playerId: string, fromTeamKey: string) => {
    if (!teams) return;
    const newTeams = { ...teams };

    // Identifichiamo sorgente e destinazione
    let teamData: any[] = [];
    if (newTeams.teams) {
      teamData = [...newTeams.teams];
    } else {
      teamData = [
        { players: [...newTeams.team_a], key: 'a' },
        { players: [...newTeams.team_b], key: 'b' }
      ];
    }

    const sIdx = teamData.findIndex(t => t.key === fromTeamKey);
    const targetTeamIdx = (sIdx + 1) % teamData.length;

    const sourceList = [...teamData[sIdx].players];
    const targetList = [...teamData[targetTeamIdx].players];

    const pIdx = sourceList.findIndex(p => p.id === playerId);
    if (pIdx === -1) return;

    const playerToMove = sourceList[pIdx];

    // REGOLA FERREA PORTIERI: Se sposto un portiere, devo scambiarlo con il portiere avversario
    if (playerToMove.role === 'Portiere') {
      const targetGkIdx = targetList.findIndex(p => p.role === 'Portiere');
      if (targetGkIdx !== -1) {
        // Scambio i due portieri
        const targetGk = targetList[targetGkIdx];
        sourceList.splice(pIdx, 1, targetGk);
        targetList.splice(targetGkIdx, 1, playerToMove);
      } else {
        // Se per qualche motivo il target non ha portieri, sposto e basta (non dovrebbe succedere con generazione bilanciata)
        sourceList.splice(pIdx, 1);
        targetList.push(playerToMove);
      }
    } else {
      // Spostamento normale per altri ruoli
      sourceList.splice(pIdx, 1);
      targetList.push(playerToMove);
    }

    // Applichiamo ordinamento per ruolo a entrambe le liste
    teamData[sIdx].players = sortPlayersByRole(sourceList);
    teamData[targetTeamIdx].players = sortPlayersByRole(targetList);

    // Ricalcolo statistiche e aggiornamento stato
    if (newTeams.teams) {
      teamData.forEach(t => {
        t.total_strength = Number(t.players.reduce((acc: number, p: any) => acc + p.strength, 0).toFixed(1));
        t.avg_age = t.players.length ? Number((t.players.reduce((acc: number, p: any) => acc + p.age, 0) / t.players.length).toFixed(1)) : 0;
      });
      newTeams.teams = teamData;
    } else {
      newTeams.team_a = teamData[0].players;
      newTeams.team_b = teamData[1].players;
      newTeams.team_a_total_strength = Number(newTeams.team_a.reduce((acc, p) => acc + p.strength, 0).toFixed(1));
      newTeams.team_b_total_strength = Number(newTeams.team_b.reduce((acc, p) => acc + p.strength, 0).toFixed(1));
    }

    setTeams(newTeams);
  };

  const handleOpenPlayerEditor = (player: Player, teamKey: string) => {
    setTempRole(player.role);
    setTempStrength(player.strength);
    setShowPlayerEditor({ id: player.id, team: teamKey as any });
  };

  const handleUpdatePlayerTemp = () => {
    if (!showPlayerEditor || !teams) return;
    const newTeams = { ...teams };

    if (showPlayerEditor.team === 'a' || showPlayerEditor.team === 'b') {
      const teamKey = showPlayerEditor.team === 'a' ? 'team_a' : 'team_b';
      const strengthKey = showPlayerEditor.team === 'a' ? 'team_a_total_strength' : 'team_b_total_strength';
      newTeams[teamKey] = newTeams[teamKey].map(p => p.id === showPlayerEditor.id ? { ...p, role: tempRole, strength: tempStrength } : p);
      newTeams[strengthKey] = Number(newTeams[teamKey].reduce((acc, p) => acc + p.strength, 0).toFixed(1));
    }

    if (newTeams.teams) {
      const tIdx = newTeams.teams.findIndex((t: any) => t.key === showPlayerEditor.team);
      if (tIdx !== -1) {
        const teamToUpdate = { ...newTeams.teams[tIdx] };
        teamToUpdate.players = teamToUpdate.players.map((p: any) =>
          p.id === showPlayerEditor.id ? { ...p, role: tempRole, strength: tempStrength } : p
        );
        teamToUpdate.total_strength = Number(teamToUpdate.players.reduce((acc: number, p: any) => acc + p.strength, 0).toFixed(1));
        newTeams.teams = [...newTeams.teams];
        newTeams.teams[tIdx] = teamToUpdate;
      }
    }
    setTeams(newTeams);
    setShowPlayerEditor(null);
  };

  const handleResetPlayerTemp = () => {
    if (!showPlayerEditor || !teams) return;
    let player;
    if (teams.teams) {
      const team = teams.teams.find((t: any) => t.key === showPlayerEditor.team);
      player = team?.players.find((p: any) => p.id === showPlayerEditor.id);
    } else {
      const teamKey = showPlayerEditor.team === 'a' ? 'team_a' : 'team_b';
      player = teams[teamKey].find(p => p.id === showPlayerEditor.id);
    }

    if (player) {
      // Troviamo il giocatore originale nei dati base per il reset vero
      const original = players.find(p => p.id === player.id);
      if (original) {
        setTempRole(original.role);
        setTempStrength(original.strength);
      }
    }
  };

  const updateTeamColor = (teamKey: string, color: string) => {
    if (showTeamDetails && teamKey === 'global') {
      handleUpdateTeamGlobal(showTeamDetails.name, showTeamDetails.name, color);
    } else if (showResultModal) {
      if (teamKey === 'a') setEditMatchColorA(color); else setEditMatchColorB(color);
    } else if (teams) {
      const newTeams = { ...teams };
      let targetTeamName = '';
      let targetLogo = undefined;

      if (teamKey === 'a') {
        newTeams.team_a_color = color;
        targetTeamName = newTeams.team_a_name;
        targetLogo = newTeams.team_a_logo;
      } else if (teamKey === 'b') {
        newTeams.team_b_color = color;
        targetTeamName = newTeams.team_b_name;
        targetLogo = newTeams.team_b_logo;
      }

      if (newTeams.teams) {
        const tIdx = newTeams.teams.findIndex((t: any) => t.key === teamKey);
        if (tIdx !== -1) {
          newTeams.teams = [...newTeams.teams];
          newTeams.teams[tIdx] = { ...newTeams.teams[tIdx], color };
          targetTeamName = newTeams.teams[tIdx].name;
          targetLogo = newTeams.teams[tIdx].logo;
        }
      }

      setTeams(newTeams);

      if (group?.group_type === 'tournament' && targetTeamName) {
        handleUpdateTeamGlobal(targetTeamName, targetTeamName, color, targetLogo);
      }
    }
  };


  const updateTeamName = (teamKey: string, name: string) => {
    if (showTeamDetails && teamKey === 'global') {
      handleUpdateTeamGlobal(showTeamDetails.name, name, showTeamDetails.color);
    } else if (showResultModal) {
      if (teamKey === 'a') setEditMatchNameA(name); else setEditMatchNameB(name);
    } else if (teams) {
      const newTeams = { ...teams };
      if (teamKey === 'a') newTeams.team_a_name = name;
      if (teamKey === 'b') newTeams.team_b_name = name;

      if (newTeams.teams) {
        const tIdx = newTeams.teams.findIndex((t: any) => t.key === teamKey);
        if (tIdx !== -1) {
          newTeams.teams = [...newTeams.teams];
          newTeams.teams[tIdx] = { ...newTeams.teams[tIdx], name };
        }
      }
      setTeams(newTeams);
    }
  };

  const handleUpdateTeamPlayersGlobal = async (teamName: string, playerId: string, action: 'add' | 'remove') => {
    if (!isAdminOrOwner || !groupId) return;
    try {
      const affectedMatches = matches.filter(m => m.team_a_name === teamName || m.team_b_name === teamName);

      for (const m of affectedMatches) {
        const updated = { ...m };
        if (m.team_a_name === teamName) {
          const playersSet = new Set(m.team_a_players);
          if (action === 'add') playersSet.add(playerId); else playersSet.delete(playerId);
          updated.team_a_players = Array.from(playersSet);
        }
        if (m.team_b_name === teamName) {
          const playersSet = new Set(m.team_b_players);
          if (action === 'add') playersSet.add(playerId); else playersSet.delete(playerId);
          updated.team_b_players = Array.from(playersSet);
        }
        await saveMatchResult(updated);
      }
      setHasUnsyncedChanges(true);
      await loadData();

      // Aggiorna showTeamDetails localmente per riflettere il cambiamento nel modal
      if (showTeamDetails) {
        const newPlayers = { ...showTeamDetails.players };
        if (action === 'add') {
          newPlayers[playerId] = { goals: 0, assists: 0 };
        } else {
          delete newPlayers[playerId];
        }
        setShowTeamDetails({ ...showTeamDetails, players: newPlayers });
      }
    } catch (e) {
      console.error("Update Team Players Error:", e);
      Alert.alert('Errore', 'Impossibile aggiornare i giocatori della squadra.');
    }
  };

  const handleUpdateTeamGlobal = async (oldName: string, newName: string, newColor: string, newLogo?: string) => {
    if (!isAdminOrOwner || !groupId) return;

    // Normalizzazione nomi per confronto sicuro
    const normalizedNew = newName.trim().toLowerCase();
    const normalizedOld = oldName.trim().toLowerCase();

    // 1. Verifica collisione nomi (se il nome è cambiato)
    if (normalizedNew !== normalizedOld) {
      const nameExists = matches.some(m => {
        const normA = m.team_a_name?.trim().toLowerCase();
        const normB = m.team_b_name?.trim().toLowerCase();
        return (normA === normalizedNew && normA !== normalizedOld) ||
               (normB === normalizedNew && normB !== normalizedOld);
      });

      if (nameExists) {
        Alert.alert('Errore', `Esiste già una squadra chiamata "${newName}". Scegli un nome unico per evitare conflitti.`);
        return;
      }
    }

    try {
      const affectedMatches = matches.filter(m => m.team_a_name === oldName || m.team_b_name === oldName);

      for (const m of affectedMatches) {
        const updated = { ...m };
        if (m.team_a_name === oldName) {
          updated.team_a_name = newName;
          updated.team_a_color = newColor;
          if (newLogo !== undefined) updated.team_a_logo = newLogo;
        }
        if (m.team_b_name === oldName) {
          updated.team_b_name = newName;
          updated.team_b_color = newColor;
          if (newLogo !== undefined) updated.team_b_logo = newLogo;
        }
        await saveMatchResult(updated);
      }
      setHasUnsyncedChanges(true);
      await loadData();
      setShowTeamDetails(prev => prev ? { ...prev, name: newName, color: newColor, logo: newLogo ?? prev.logo } : null);
    } catch (e) {
      console.error("Update Team Error:", e);
      Alert.alert('Errore', 'Impossibile aggiornare le info della squadra.');
    }
  };

  const handlePickLogo = async (teamKey: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Logo = `data:image/jpeg;base64,${result.assets[0].base64}`;

      if (showTeamDetails && teamKey === 'global') {
        handleUpdateTeamGlobal(showTeamDetails.name, showTeamDetails.name, showTeamDetails.color, base64Logo);
      } else if (showResultModal) {
        if (teamKey === 'a') setEditMatchLogoA(base64Logo); else setEditMatchLogoB(base64Logo);
      } else if (teams) {
        const newTeams = { ...teams };
        let targetTeamName = '';
        let targetColor = '';

        if (teamKey === 'a') {
          newTeams.team_a_logo = base64Logo;
          targetTeamName = newTeams.team_a_name;
          targetColor = newTeams.team_a_color;
        } else if (teamKey === 'b') {
          newTeams.team_b_logo = base64Logo;
          targetTeamName = newTeams.team_b_name;
          targetColor = newTeams.team_b_color;
        }

        if (newTeams.teams) {
          const tIdx = newTeams.teams.findIndex((t: any) => t.key === teamKey);
          if (tIdx !== -1) {
            newTeams.teams = [...newTeams.teams];
            newTeams.teams[tIdx] = { ...newTeams.teams[tIdx], logo: base64Logo };
            targetTeamName = newTeams.teams[tIdx].name;
            targetColor = newTeams.teams[tIdx].color;
          }
        }
        setTeams(newTeams);

        if (group?.group_type === 'tournament' && targetTeamName) {
           handleUpdateTeamGlobal(targetTeamName, targetTeamName, targetColor, base64Logo);
        }
      }
    }
  };


  const handleOpenResultModal = (matchToEdit?: Match) => {
    const openModal = () => {
      if (matchToEdit) {
        setEditingMatchId(matchToEdit.id);
        setScoreA(matchToEdit.team_a_score.toString());
        setScoreB(matchToEdit.team_b_score.toString());
        setMatchGoals(matchToEdit.goals || {});
        setMatchAssists(matchToEdit.assists || {});
        setTeamAOwnGoals(matchToEdit.team_a_own_goals || 0);
        setTeamBOwnGoals(matchToEdit.team_b_own_goals || 0);
        setPenaltiesA((matchToEdit.team_a_penalties || 0).toString());
        setPenaltiesB((matchToEdit.team_b_penalties || 0).toString());
        setMatchDescription(matchToEdit.description || '');
        setMatchDate(new Date(matchToEdit.date));
        setMatchLocation(matchToEdit.location || '');

        const infoA = getResolvedTeamInfo(matchToEdit, 'a');
        const infoB = getResolvedTeamInfo(matchToEdit, 'b');

        setEditMatchNameA(infoA.name);
        setEditMatchNameB(infoB.name);
        setEditMatchColorA(infoA.color);
        setEditMatchColorB(infoB.color);
        setEditMatchLogoA(infoA.logo);
        setEditMatchLogoB(infoB.logo);
      } else {
        setEditingMatchId(null);
        setScoreA('0');
        setScoreB('0');
        setMatchGoals({});
        setMatchAssists({});
        setTeamAOwnGoals(0);
        setTeamBOwnGoals(0);
        setPenaltiesA('0');
        setPenaltiesB('0');
        // Rimosso il reset di matchDescription, matchDate e matchLocation
        // per mantenere i dati inseriti nella scheda "Squadre"
        setEditMatchNameA(teams?.team_a_name || 'Squadra A');
        setEditMatchNameB(teams?.team_b_name || 'Squadra B');
        setEditMatchColorA(teams?.team_a_color || 'Bianca');
        setEditMatchColorB(teams?.team_b_color || 'Rossa');
      }
      setShowResultModal(true);
    };

    if (!matchToEdit && teams) {
      const countA = teams.team_a.length;
      const countB = teams.team_b.length;
      if (countA !== countB) {
        Alert.alert(
          'Squadre Sbilanciate',
          `Le squadre hanno un numero differente di giocatori (${countA} vs ${countB}). Vuoi procedere con la registrazione?`,
          [
            { text: 'Annulla', style: 'cancel' },
            { text: 'Procedi', onPress: openModal }
          ]
        );
        return;
      }
    }

    openModal();
  };

  const updateMatchStat = (playerId: string, type: 'goals' | 'assists', delta: number, teamKey?: 'a' | 'b') => {
    if (type === 'goals') {
      const current = matchGoals[playerId] || 0;
      const newValue = Math.max(0, current + delta);
      const actualDelta = newValue - current;

      setMatchGoals({ ...matchGoals, [playerId]: newValue });

      if (actualDelta !== 0) {
        // Se teamKey è fornito, usiamolo direttamente
        if (teamKey === 'a') {
          setScoreA(prev => Math.max(0, parseInt(prev) + actualDelta).toString());
        } else if (teamKey === 'b') {
          setScoreB(prev => Math.max(0, parseInt(prev) + actualDelta).toString());
        } else {
          // Fallback logica precedente (solo per sicurezza)
          const isTeamA = teamAParticipants.some(p => p.id === playerId);
          if (isTeamA) {
            setScoreA(prev => Math.max(0, parseInt(prev) + actualDelta).toString());
          } else {
            setScoreB(prev => Math.max(0, parseInt(prev) + actualDelta).toString());
          }
        }
      }
    } else {
      const current = matchAssists[playerId] || 0;
      setMatchAssists({ ...matchAssists, [playerId]: Math.max(0, current + delta) });
    }
  };

  const updateOwnGoals = (team: 'a' | 'b', delta: number) => {
    if (team === 'a') {
      const newVal = Math.max(0, teamAOwnGoals + delta);
      const actualDelta = newVal - teamAOwnGoals;
      setTeamAOwnGoals(newVal);
      if (actualDelta !== 0) {
        // L'autorete della squadra A va a favore della squadra B
        setScoreB(prev => Math.max(0, parseInt(prev) + actualDelta).toString());
      }
    } else {
      const newVal = Math.max(0, teamBOwnGoals + delta);
      const actualDelta = newVal - teamBOwnGoals;
      setTeamBOwnGoals(newVal);
      if (actualDelta !== 0) {
        // L'autorete della squadra B va a favore della squadra A
        setScoreA(prev => Math.max(0, parseInt(prev) + actualDelta).toString());
      }
    }
  };

  const handleSaveResult = async (status: 'played' | 'scheduled' = 'played') => {
    if (!groupId) return;
    try {
      const existingMatch = editingMatchId ? matches.find(m => m.id === editingMatchId) : null;
      const matchData: Match = {
        id: editingMatchId || '',
        group_id: groupId,
        date: matchDate.toISOString(),
        team_a_players: teamAParticipants.map(p => p.id),
        team_b_players: teamBParticipants.map(p => p.id),
        team_a_score: isNaN(parseInt(scoreA)) ? 0 : parseInt(scoreA),
        team_b_score: isNaN(parseInt(scoreB)) ? 0 : parseInt(scoreB),
        team_a_name: editMatchNameA,
        team_b_name: editMatchNameB,
        team_a_color: editMatchColorA,
        team_b_color: editMatchColorB,
        team_a_logo: editMatchLogoA,
        team_b_logo: editMatchLogoB,
        goals: matchGoals,
        assists: matchAssists,
        team_a_own_goals: teamAOwnGoals,
        team_b_own_goals: teamBOwnGoals,
        team_a_penalties: isNaN(parseInt(penaltiesA)) ? 0 : parseInt(penaltiesA),
        team_b_penalties: isNaN(parseInt(penaltiesB)) ? 0 : parseInt(penaltiesB),
        match_phase: existingMatch ? (existingMatch.match_phase || 'group') : 'group',
        tournament_group: existingMatch?.tournament_group,
        team_a_placeholder: existingMatch?.team_a_placeholder,
        team_b_placeholder: existingMatch?.team_b_placeholder,
        knockout_index: existingMatch?.knockout_index,
        exclude_def_bonus: existingMatch?.exclude_def_bonus || false,
        description: matchDescription || undefined,
        location: matchLocation || undefined,
        status: status
      };


      await saveMatchResult(matchData);
      setHasUnsyncedChanges(true);
      setShowResultModal(false);
      setTeams(null);
      // Rimosso setActiveTab('matches') per evitare il salto di scheda automatico
      loadData();
    } catch (e: any) {
      console.error("Save Match Error:", e);
      Alert.alert('Errore', `Salvataggio fallito: ${e.message || 'Errore sconosciuto'}`);
    }
  };

  const handleDeleteMatch = (id: string) => {
    Alert.alert('Elimina Partita', 'Vuoi eliminare questa partita? I punti verranno ricalcolati.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
          await deleteMatch(id);
          setHasUnsyncedChanges(true);
          loadData();
      }}
    ]);
  };

  const handleResetMatchResult = (match: Match) => {
    Alert.alert(
      'Reset Risultato',
      'Vuoi azzerare il risultato di questa partita? I punteggi e i marcatori verranno rimossi, ma la partita rimarrà in calendario.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedMatch: Match = {
                ...match,
                team_a_score: 0,
                team_b_score: 0,
                team_a_own_goals: 0,
                team_b_own_goals: 0,
                team_a_penalties: 0,
                team_b_penalties: 0,
                goals: {},
                assists: {},
                status: 'scheduled'
              };
              await saveMatchResult(updatedMatch);
              setHasUnsyncedChanges(true);
              loadData();
            } catch (e) {
              Alert.alert('Errore', 'Impossibile resettare la partita');
            }
          }
        }
      ]
    );
  };

  const handleToggleMatchExclusion = async (match: Match) => {
    try {
      const updatedMatch = { ...match, exclude_def_bonus: !match.exclude_def_bonus };
      await saveMatchResult(updatedMatch);
      setHasUnsyncedChanges(true);
      loadData(false); // reload silently
    } catch (e) {
      Alert.alert('Errore', 'Impossibile aggiornare la partita');
    }
  };


  const handleResetKnockout = () => {
    Alert.alert(
      'Resetta Fase Finale',
      'Questa azione eliminerà TUTTI gli incontri della fase eliminatoria. I gironi non verranno toccati. Continuare?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Resetta',
          style: 'destructive',
          onPress: async () => {
            const knockoutMatches = matches.filter(m => m.match_phase && m.match_phase !== 'group');
            for (const m of knockoutMatches) {
              await deleteMatch(m.id);
            }
            setHasUnsyncedChanges(true);
            loadData();
            Alert.alert('Successo', 'Fase eliminatoria resettata correttamente.');
          }
        }
      ]
    );
  };

  const handleDeletePlayer = (id: string) => {
    const p = players.find(x => x.id === id);
    if (!p) return;

    // Controllo se il giocatore è presente in qualche partita
    const isUsed = matches.some(m =>
      m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim()) ||
      m.team_b_players.map(pid => String(pid).trim()).includes(String(id).trim())
    );

    if (isUsed) {
      Alert.alert(
        'Azione Non Consentita',
        `Non puoi eliminare ${p.nickname} perché è presente in una o più partite salvate. Elimina prima le partite che lo includono se vuoi rimuoverlo definitivamente.`
      );
      return;
    }

    Alert.alert('Elimina Giocatore', `Vuoi eliminare ${p.nickname}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
          await deletePlayer(id);
          setHasUnsyncedChanges(true);
          loadData();
      }}
    ]);
  };

  const handleUpdateGroupSettings = async (updates: Partial<Group>) => {
    if (!groupId || !group) return;
    try {
      const updated = await updateGroup(groupId, updates);
      setHasUnsyncedChanges(true);
      setGroup(updated);
    } catch (e) {
      Alert.alert('Errore', 'Impossibile aggiornare le impostazioni');
    }
  };

  const handleCreateGroupBackup = async () => {
    try {
      const json = await createFullBackup(groupId as string);
      const fileName = `Easyliga_Backup_${group?.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, 'application/json');
          await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
          Alert.alert('Successo', 'Backup salvato nella cartella selezionata');
          return;
        }
      }

      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, json);
      await Sharing.shareAsync(fileUri, { UTI: 'public.json', mimeType: 'application/json' });
    } catch (e) {
      console.error(e);
      Alert.alert('Errore', 'Creazione o salvataggio backup fallito');
    }
  };

  const handleRestoreGroupBackup = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (!res.canceled) {
        const json = await FileSystem.readAsStringAsync(res.assets[0].uri);
        await restoreFullBackup(groupId as string, json);
        Alert.alert('Successo', 'Dati ripristinati correttamente');
        loadData();
      }
    } catch (e) {
      Alert.alert('Errore', 'Ripristino fallito. Assicurati che il file sia valido.');
    }
  };

  const handleExportPlayers = async () => {
    try {
      const data = await exportPlayersExcel(groupId as string);

      // Creazione del contenuto CSV
      const headers = ["Nickname", "Nome", "Cognome", "Data di Nascita", "Ruolo", "Forza"];
      const csvContent = [
        headers.join(","),
        ...data.map(p => [
          `"${p.Nickname}"`,
          `"${p.Nome || ''}"`,
          `"${p.Cognome || ''}"`,
          `"${p['Data di Nascita'] || ''}"`,
          `"${p.Ruolo}"`,
          p.Forza
        ].join(","))
      ].join("\n");

      const fileName = `Giocatori_${group?.name.replace(/\s/g, '_')}.csv`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'text/csv'
          );
          await FileSystem.writeAsStringAsync(destUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
          Alert.alert('Successo', 'Elenco giocatori salvato correttamente in formato CSV');
          return;
        }
      }

      await Sharing.shareAsync(fileUri, {
        UTI: 'public.comma-separated-values-text',
        mimeType: 'text/csv'
      });
    } catch (e) {
      Alert.alert('Errore', 'Esportazione fallita');
    }
  };

  const handleImportPlayers = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/comma-separated-values', 'text/csv', 'application/csv']
      });

      if (!res.canceled) {
        setImporting(true);
        const file = res.assets[0];
        const content = await FileSystem.readAsStringAsync(file.uri);

        // Semplice parser CSV
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          const data: any[] = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const entry: any = {};
            headers.forEach((h, idx) => {
              if (idx < values.length) {
                entry[h] = values[idx];
              }
            });
            data.push(entry);
          }

          if (data.length > 0) {
            await importPlayersExcel(groupId as string, data);
            Alert.alert('Successo', `${data.length} giocatori importati correttamente da CSV.`);
            loadData();
          } else {
            Alert.alert('Errore', 'Il file CSV non contiene dati validi.');
          }
        } else {
          Alert.alert('Errore', 'Il file selezionato è vuoto o non ha l\'intestazione corretta.');
        }
        setImporting(false);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Errore', 'Importazione fallita. Assicurati che il file sia un CSV valido.');
      setImporting(false);
    }
  };

  const handleShareToken = (type: 'owner' | 'admin' | 'viewer') => {
    let token = '';
    if (type === 'owner') token = group?.id || '';
    else if (type === 'admin') token = group?.admin_token || '';
    else token = group?.viewer_token || '';

    Share.share({
      message: `Unisciti al mio gruppo "${group?.name}" su Easyliga!\nCodice ${type}: ${token}`,
    });
  };

  const handleShareImage = async () => {
    if (!viewShotRef.current) return;
    setSharing(true);
    setTimeout(async () => {
      try {
        const uri = await (viewShotRef.current as any).capture();
        await Sharing.shareAsync(uri);
      } catch (e) {
        Alert.alert('Errore', 'Impossibile condividere l\'immagine');
      } finally {
        setSharing(false);
      }
    }, 100);
  };

  const handleShareStandings = async () => {
    setSharingStandings(true);
    setTimeout(async () => {
      try {
        if (standingsViewShotRef.current) {
          const uri = await (standingsViewShotRef.current as any).capture();
          await Sharing.shareAsync(uri);
        }
      } catch (e) {
        Alert.alert('Errore', 'Impossibile condividere l\'immagine della classifica');
      } finally {
        setSharingStandings(false);
      }
    }, 500);
  };

  const handleShareTournamentStandings = async () => {
    setSharingTournamentStandings(true);
    setTimeout(async () => {
      try {
        if (standingsViewShotRef.current) {
          const uri = await (standingsViewShotRef.current as any).capture();
          await Sharing.shareAsync(uri);
        }
      } catch (e) {
        Alert.alert('Errore', 'Impossibile condividere l\'immagine della classifica');
      } finally {
        setSharingTournamentStandings(false);
      }
    }, 500);
  };

  const handleShareBracket = async () => {
    setSharingBracket(true);
    setTimeout(async () => {
      try {
        if (bracketViewShotRef.current) {
          const uri = await (bracketViewShotRef.current as any).capture();
          await Sharing.shareAsync(uri);
        }
      } catch (e) {
        Alert.alert('Errore', 'Impossibile condividere l\'immagine del tabellone');
      } finally {
        setSharingBracket(false);
      }
    }, 500);
  };

  const handleShareMatchesList = async () => {
    setSharingMatchesList(true);
    setTimeout(async () => {
      try {
        if (matchesListViewShotRef.current) {
          const uri = await (matchesListViewShotRef.current as any).capture();
          await Sharing.shareAsync(uri);
        }
      } catch (e) {
        Alert.alert('Errore', 'Impossibile condividere l\'immagine del calendario');
      } finally {
        setSharingMatchesList(false);
      }
    }, 500);
  };

  const handleSharePlayersList = async () => {
    setSharingPlayersList(true);
    setTimeout(async () => {
      try {
        if (playersListViewShotRef.current) {
          const uri = await (playersListViewShotRef.current as any).capture();
          await Sharing.shareAsync(uri);
        }
      } catch (e) {
        Alert.alert('Errore', 'Impossibile condividere l\'immagine della lista giocatori');
      } finally {
        setSharingPlayersList(false);
      }
    }, 500);
  };



  const handleShareTeamDetails = async (team: any) => {
    setSharingTeamDetails(team);
    setTimeout(async () => {
      try {
        if (teamDetailsViewShotRef.current) {
          const uri = await (teamDetailsViewShotRef.current as any).capture();
          await Sharing.shareAsync(uri);
        }
      } catch (e) {
        Alert.alert('Errore', 'Impossibile condividere l\'immagine della squadra');
      } finally {
        setSharingTeamDetails(null);
      }
    }, 500);
  };

  const handleShareMatchStats = async (m: Match) => {

    setSharingMatch(m);
    setTimeout(async () => {
      try {
        if (matchViewShotRef.current) {
          const uri = await (matchViewShotRef.current as any).capture();
          await Sharing.shareAsync(uri);
        }
      } catch (e) {
        Alert.alert('Errore', 'Impossibile condividere l\'immagine del risultato');
      } finally {
        setSharingMatch(null);
      }
    }, 500);
  };

  const renderRoleFilter = (current: string | null, setter: (r: string | null) => void) => (
    <View style={{ flexDirection: 'row', paddingHorizontal: 0, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }}>
        {['Portiere', 'Difensore', 'Mediana', 'Attaccante'].map((r, i) => {
          const active = current === r;
          return (
            <TouchableOpacity
              key={r}
              onPress={() => setter(active ? null : r)}
              style={{
                flex: 1,
                height: 42,
                backgroundColor: active ? ROLE_COLORS[r] : (isDarkMode ? '#2C2C2E' : '#FFFFFF'),
                alignItems: 'center',
                justifyContent: 'center',
                borderLeftWidth: i === 0 ? 0 : 1,
                borderLeftColor: isDarkMode ? '#3A3A3C' : '#E5E5EA',
              }}
            >
              <Text
                style={{
                  color: active ? '#FFF' : (isDarkMode ? '#AEAEB2' : '#8E8E93'),
                  fontSize: 8.2,
                  fontWeight: '900',
                  textAlign: 'center'
                }}
                numberOfLines={1}
              >
                {r.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const getJerseyHex = (color: string) => JERSEY_COLORS.find(c => c.value === color)?.hex || '#FFFFFF';
  const getJerseyTextColor = (color: string) => {
    const lightColors = ['Bianca', 'Gialla', 'Azzurra', 'Arancione'];
    return lightColors.includes(color) ? '#1C1C1E' : '#FFFFFF';
  };
  const getInitials = (n: string) => (n || 'G').substring(0, 2).toUpperCase();

  const getGironeColor = (num: number) => {
    if (num === 0) return '#5856D6'; // Fase Eliminatoria
    const colors = ['#34C759', '#FF3B30', '#007AFF', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA', '#A2845E'];
    return colors[(num - 1) % colors.length];
  };

  const getRankingsByGirone = () => {
    const rankings: Record<number, any[]> = {};
    const numGironi = group?.num_groups || 1;
    for (let i = 1; i <= numGironi; i++) {
      const teamStatsMap: Record<string, any> = {};
      const gironeMatches = matches.filter(m => {
        const isGroupPhase = !m.match_phase || m.match_phase === 'group';
        const mGroup = m.tournament_group || 1;
        return isGroupPhase && Number(mGroup) === i;
      });
      gironeMatches.forEach(m => {
        if (!teamStatsMap[m.team_a_name]) teamStatsMap[m.team_a_name] = { name: m.team_a_name, points: 0, g_for: 0, g_against: 0, color: m.team_a_color, logo: m.team_a_logo, players: m.team_a_players };
        else if (!teamStatsMap[m.team_a_name].logo && m.team_a_logo) teamStatsMap[m.team_a_name].logo = m.team_a_logo;

        if (!teamStatsMap[m.team_b_name]) teamStatsMap[m.team_b_name] = { name: m.team_b_name, points: 0, g_for: 0, g_against: 0, color: m.team_b_color, logo: m.team_b_logo, players: m.team_b_players };
        else if (!teamStatsMap[m.team_b_name].logo && m.team_b_logo) teamStatsMap[m.team_b_name].logo = m.team_b_logo;
      });
      gironeMatches.filter(m => m.status === 'played' || m.status === undefined).forEach(m => {
        const statsA = teamStatsMap[m.team_a_name];
        const statsB = teamStatsMap[m.team_b_name];
        statsA.g_for += (m.team_a_score || 0); statsA.g_against += (m.team_b_score || 0);
        statsB.g_for += (m.team_b_score || 0); statsB.g_against += (m.team_a_score || 0);
        if (m.team_a_score > m.team_b_score) statsA.points += (group?.points_win ?? 3);
        else if (m.team_b_score > m.team_a_score) statsB.points += (group?.points_win ?? 3);
        else { statsA.points += (group?.points_draw ?? 1); statsB.points += (group?.points_draw ?? 1); }
      });
      rankings[i] = Object.values(teamStatsMap).sort((a, b) => b.points - a.points || (b.g_for - b.g_against) - (a.g_for - a.g_against));
    }
    return rankings;
  };

  const getTeamPlayersByName = (teamName: string) => {
    if (!teamName) return [];
    // 1. Cerchiamo prima in tutti i match del girone
    const groupMatches = matches.filter(m => !m.match_phase || m.match_phase === 'group');

    // Cerchiamo l'ultima partita giocata (o programmata) di questa squadra nel girone
    const teamMatch = [...groupMatches]
      .filter(m => m.team_a_name === teamName || m.team_b_name === teamName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (!teamMatch) return [];
    const pids = teamMatch.team_a_name === teamName ? teamMatch.team_a_players : teamMatch.team_b_players;
    return (pids || []).map(pid => players.find(p => p.id === pid)).filter(p => !!p) as Player[];
  };

  const dynamicStyles = {
    container: { backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7' },
    text: { color: isDarkMode ? '#FFFFFF' : '#1C1C1E' },
    subText: { color: isDarkMode ? '#AEAEB2' : '#8E8E93' },
    card: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF', borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' },
    input: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF', color: isDarkMode ? '#FFFFFF' : '#1C1C1E', borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' },
    modalContent: { backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF' },
    divider: { backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }
  };

  const filteredPlayersForTeams = React.useMemo(() => {
    // Escludiamo i giocatori già assegnati a una squadra durante la selezione manuale
    const assignedIds = new Set(manualTeamsData.flat().map(p => p.id));

    return players
      .filter(p =>
        !assignedIds.has(p.id) &&
        (teamSelectedRole ? p.role === teamSelectedRole : true) &&
        (teamSearch ? p.nickname.toLowerCase().includes(teamSearch.toLowerCase()) : true)
      )
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'it', { sensitivity: 'base' }));
  }, [players, teamSelectedRole, teamSearch, manualTeamsData]);

  const filteredPlayersList = React.useMemo(() => {
    return players
      .filter(p =>
        (selectedRole ? p.role === selectedRole : true) &&
        (search ? p.nickname.toLowerCase().includes(search.toLowerCase()) : true)
      )
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'it', { sensitivity: 'base' }));
  }, [players, selectedRole, search]);

  const teamAParticipants = React.useMemo(() => {
    if (editingMatchId) {
      const m = matches.find(x => x.id === editingMatchId);
      if (!m) return [];

      const isTournament = group?.group_type === 'tournament';
      const isKnockout = m.match_phase && m.match_phase !== 'group';

      let pids = m.team_a_players || [];

      // Se è un torneo e siamo in fase eliminatoria, proviamo a recuperare i giocatori originali dal girone
      // basandoci sul nome risolto della squadra, per garantire coerenza
      if (isTournament && isKnockout) {
        const resolvedName = getDisplayName(m, 'a');
        const originalPlayers = getTeamPlayersByName(resolvedName);
        if (originalPlayers.length > 0) return originalPlayers;
      }

      if (m.team_a_placeholder?.startsWith('W-I') && pids.length === 0) {
        const refIdx = m.team_a_placeholder.substring(3);
        const refMatch = matches.find(x => x.knockout_index === parseInt(refIdx));
        if (refMatch && refMatch.status === 'played') {
          if (refMatch.team_a_score > refMatch.team_b_score) pids = refMatch.team_a_players;
          else if (refMatch.team_b_score > refMatch.team_a_score) pids = refMatch.team_b_players;
          else if ((refMatch.team_a_penalties || 0) > (refMatch.team_b_penalties || 0)) pids = refMatch.team_a_players;
          else pids = refMatch.team_b_players;
        }
      }
      return (pids || []).map(pid => players.find(p => p.id === pid)).filter(p => !!p) as Player[];
    }
    if (!teams) return [];
    return teams.team_a || [];
  }, [editingMatchId, matches, players, teams, group]);

  const teamBParticipants = React.useMemo(() => {
    if (editingMatchId) {
      const m = matches.find(x => x.id === editingMatchId);
      if (!m) return [];

      const isTournament = group?.group_type === 'tournament';
      const isKnockout = m.match_phase && m.match_phase !== 'group';

      let pids = m.team_b_players || [];

      if (isTournament && isKnockout) {
        const resolvedName = getDisplayName(m, 'b');
        const originalPlayers = getTeamPlayersByName(resolvedName);
        if (originalPlayers.length > 0) return originalPlayers;
      }

      if (m.team_b_placeholder?.startsWith('W-I') && pids.length === 0) {
        const refIdx = m.team_b_placeholder.substring(3);
        const refMatch = matches.find(x => x.knockout_index === parseInt(refIdx));
        if (refMatch && refMatch.status === 'played') {
          if (refMatch.team_a_score > refMatch.team_b_score) pids = refMatch.team_a_players;
          else if (refMatch.team_b_score > refMatch.team_a_score) pids = refMatch.team_b_players;
          else if ((refMatch.team_a_penalties || 0) > (refMatch.team_b_penalties || 0)) pids = refMatch.team_a_players;
          else pids = refMatch.team_b_players;
        }
      }
      return (pids || []).map(pid => players.find(p => p.id === pid)).filter(p => !!p) as Player[];
    }
    if (!teams) return [];
    return teams.team_b || [];
  }, [editingMatchId, matches, players, teams]);

  const headerDefs: Record<string, string> = {
    'PT': 'Punti Totali: calcolati in base a Vittorie (3pt), Pareggi (1pt) e Bonus.',
    'G': 'Goal: numero totale di reti segnate dal giocatore.',
    'A': 'Assist: numero totale di passaggi vincenti effettuati.',
    'INC': 'Incisività: (Goal + Assist) / Divisore Carriera.',
    'BON': 'Bonus: punti extra ottenuti (Clean Sheet, Personale, Difesa).',
    'BP': 'Bonus Personale: numero di volte che hai raggiunto le soglie goal+assist nel match.',
    'BD': 'Bonus Difesa: numero di volte che la squadra ha subito meno della soglia goal.',
    'CS': 'Clean Sheet: numero di partite terminate senza subire reti.',
    'MG': 'Media Goal: rapporto tra goal segnati e partite giocate.',
    'MA': 'Media Assist: rapporto tra assist effettuati e partite giocate.',
    'MS': 'Media Subiti: media dei goal subiti dalla squadra quando il giocatore era in campo (Minore è meglio).',
    'PG': 'Partite Giocate: numero totale di presenze.',
    'V': 'Vittorie: numero di partite vinte.',
    'P': 'Sconfitte: numero di partite perse (Minore è meglio).',
    'X': 'Pareggi: numero di partite terminate in parità.'
  };

  const StatHeader = ({ label, width = 45, color, fontSize = 9 }: { label: string, width?: number, color?: string, fontSize?: number }) => (
    <TouchableOpacity
      style={{ width, alignItems: 'center' }}
      onPress={() => Alert.alert(label, headerDefs[label] || '')}
    >
      <Text style={{ fontSize, fontWeight: '900', color: color || '#8E8E93' }}>{label}</Text>
    </TouchableOpacity>
  );

  const StatValue = ({ value, width = 45, color, bold = true, fontSize = 14 }: { value: any, width?: number, color?: string, bold?: boolean, fontSize?: number }) => (
    <View style={{ width, alignItems: 'center' }}>
      <Text style={[{ fontSize, fontWeight: bold ? '800' : '500', color: color || (isDarkMode ? '#FFF' : '#1C1C1E') }]}>
        {value}
      </Text>
    </View>
  );

  const renderPlayerSelectorModal = () => {
    if (!showPlayerSelector || !showTeamDetails) return null;

    // Identifichiamo TUTTI i giocatori già assegnati a una squadra in questo torneo (fase a gironi)
    const assignedPlayerIds = new Set<string>();
    groupMatches.forEach(m => {
      if (m.team_a_players) m.team_a_players.forEach(pid => assignedPlayerIds.add(pid));
      if (m.team_b_players) m.team_b_players.forEach(pid => assignedPlayerIds.add(pid));
    });

    // Filtriamo i giocatori del gruppo che NON sono assegnati a NESSUNA squadra
    const availablePlayers = players.filter(p => !assignedPlayerIds.has(p.id))
      .filter(p => p.nickname.toLowerCase().includes(search.toLowerCase()))
      .filter(p => !modalRole || p.role === modalRole)
      .sort((a, b) => a.nickname.localeCompare(b.nickname));

    return (
      <Modal visible={true} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center' }]}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '80%', marginHorizontal: 20, borderRadius: 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Aggiungi Giocatore</Text>
              <TouchableOpacity onPress={() => { setShowPlayerSelector(false); setModalRole(null); }}>
                <Ionicons name="close" size={24} color={dynamicStyles.text.color} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 8 }}>
              <View style={[styles.searchContainer, dynamicStyles.card, { marginHorizontal: 0, marginBottom: 10, height: 40 }]}>
                <Ionicons name="search" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, dynamicStyles.text, { fontSize: 14 }]}
                  placeholder="Cerca giocatore..."
                  placeholderTextColor="#8E8E93"
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color="#8E8E93" />
                  </TouchableOpacity>
                )}
              </View>
              {renderRoleFilter(modalRole, setModalRole)}
            </View>

            <FlatList
              data={availablePlayers}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pCard, dynamicStyles.card, { paddingHorizontal: 0, paddingVertical: 12, borderBottomWidth: 0.5 }]}
                  onPress={() => {
                    handleUpdateTeamPlayersGlobal(showTeamDetails.name, item.id, 'add');
                    setShowPlayerSelector(false);
                  }}
                >
                  <View style={[styles.pAvatar, { backgroundColor: ROLE_COLORS[item.role] + '20', width: 30, height: 30 }]}>
                    <Text style={[styles.pAvatarText, { color: ROLE_COLORS[item.role], fontSize: 12 }]}>{getInitials(item.nickname)}</Text>
                  </View>
                  <View style={styles.pInfo}>
                    <Text style={[styles.pNickname, dynamicStyles.text, { fontSize: 15 }]}>{item.nickname}</Text>
                    <Text style={[styles.pRoleText, { color: ROLE_COLORS[item.role], fontSize: 10 }]}>{item.role}</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color="#34C759" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    );
  };

  const renderGironeSelectorModal = () => {
    if (!showGironeSelector) return null;
    const options = [];

    // Opzione per tornare alla visualizzazione rose/generatore
    options.push({ id: -1, label: 'MODIFICA / VEDI ROSE', icon: 'people-circle-outline' });

    // Fase Eliminatoria sempre visibile
    options.push({ id: 0, label: 'FASE ELIMINATORIA', icon: 'trophy-outline' });


    if (group?.num_groups && group.num_groups > 1) {
      for (let i = 1; i <= group.num_groups; i++) {
        options.push({ id: i, label: `GIRONE ${i}`, icon: 'list-outline' });
      }
    } else {
      options.push({ id: 1, label: 'GIRONE UNICO', icon: 'list-outline' });
    }

    return (
      <Modal visible={true} transparent animationType="fade" onRequestClose={() => setShowGironeSelector(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowGironeSelector(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: 'auto', maxHeight: '70%', paddingBottom: 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Seleziona Visualizzazione</Text>
              <TouchableOpacity onPress={() => setShowGironeSelector(false)}>
                <Ionicons name="close" size={28} color={dynamicStyles.text.color} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.pCard,
                    dynamicStyles.card,
                    {
                      marginVertical: 4,
                      borderRadius: 12,
                      borderWidth: 1,
                      backgroundColor: selectedGirone === opt.id ? (getGironeColor(opt.id) + '20') : dynamicStyles.card.backgroundColor,
                      borderColor: selectedGirone === opt.id ? getGironeColor(opt.id) : dynamicStyles.divider.backgroundColor
                    }
                  ]}
                  onPress={() => {
                    if (opt.id === -1) {
                      // 1. Proviamo a usare la distribuzione salvata (se esiste)
                      if ((group as any)?.teams_distribution) {
                        setTeams({
                          description: group?.name,
                          teams: (group as any).teams_distribution
                        });
                      } else {
                        // 2. Altrimenti la ricostruiamo dai match esistenti
                        const teamsMap = new Map();
                        matches.forEach(m => {
                          [ {name: m.team_a_name, color: m.team_a_color, logo: m.team_a_logo, pids: m.team_a_players},
                            {name: m.team_b_name, color: m.team_b_color, logo: m.team_b_logo, pids: m.team_b_players}
                          ].forEach(tInfo => {
                            if (tInfo.name) {
                              // Creiamo una chiave basata su Nome + Hash dei giocatori per distinguere squadre con lo stesso nome
                              // ma che sono effettivamente diverse (es. dopo un rinominamento errato)
                              const pidsHash = [...(tInfo.pids || [])].sort().join(',');
                              const uniqueKey = `${tInfo.name}_${pidsHash}`;

                              if (!teamsMap.has(uniqueKey)) {
                                const tPlayers = tInfo.pids.map(pid => players.find(p => p.id === pid)).filter(p => !!p);
                                teamsMap.set(uniqueKey, {
                                  name: tInfo.name,
                                  color: tInfo.color,
                                  logo: tInfo.logo,
                                  players: tPlayers,
                                  assigned_group: m.tournament_group || 1,
                                  key: 'team_' + teamsMap.size,
                                  total_strength: Number(tPlayers.reduce((acc: number, p: any) => acc + p.strength, 0).toFixed(1)),
                                  avg_age: tPlayers.length ? Number((tPlayers.reduce((acc: number, p: any) => acc + p.age, 0) / tPlayers.length).toFixed(1)) : 0,
                                });
                              }
                            }
                          });
                        });

                        if (teamsMap.size > 0) {
                          setTeams({
                            description: group?.name || 'Rose Torneo',
                            teams: Array.from(teamsMap.values())
                          });
                        } else {
                          Alert.alert('Info', 'Nessuna distribuzione squadre trovata.');
                        }
                      }
                    } else {
                      setSelectedGirone(opt.id);
                    }
                    setShowGironeSelector(false);
                  }}

                >
                  <Ionicons name={opt.icon as any} size={22} color={selectedGirone === opt.id ? getGironeColor(opt.id) : '#8E8E93'} style={{ marginRight: 15 }} />
                  <Text style={[dynamicStyles.text, { fontSize: 16, fontWeight: selectedGirone === opt.id ? '800' : '600', flex: 1 }]}>
                    {opt.label}
                  </Text>
                  {selectedGirone === opt.id && <Ionicons name="checkmark-circle" size={22} color={getGironeColor(opt.id)} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderBracket = () => {
    const knockoutMatches = matches.filter(m => m.match_phase && m.match_phase !== 'group');

    // Raggruppamento per fase ordina per logica di torneo
    const phases = [
      { id: 'quarterfinal', title: 'Quarti', icon: 'apps-outline', color: '#8E8E93', matches: knockoutMatches.filter(m => m.match_phase === 'quarterfinal') },
      { id: 'semifinal', title: 'Semifinali', icon: 'trophy-outline', color: '#AF52DE', matches: knockoutMatches.filter(m => m.match_phase === 'semifinal') },
      { id: 'third_place', title: 'Finale 3° Posto', icon: 'medal-outline', color: '#FF9500', matches: knockoutMatches.filter(m => m.match_phase === 'third_place') },
      { id: 'final', title: 'Finalissima', icon: 'ribbon-outline', color: '#FFD60A', matches: knockoutMatches.filter(m => m.match_phase === 'final') },
    ].filter(p => p.matches.length > 0);

    const renderBracketCard = (m: Match, phaseColor: string, isLastInPhase: boolean) => {
      const isPlayed = m.status === 'played';
      const infoA = getResolvedTeamInfo(m, 'a');
      const infoB = getResolvedTeamInfo(m, 'b');

      const teamAHex = getJerseyHex(infoA.color);
      const teamBHex = getJerseyHex(infoB.color);

      return (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 }}>
          <TouchableOpacity
            style={[dynamicStyles.card, {
              padding: 0,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: phaseColor + '40',
              width: 280,
              overflow: 'hidden',
              elevation: 8,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 10,
              flexDirection: 'column',
              alignItems: 'stretch'
            }]}
            onPress={() => isAdminOrOwner && handleOpenResultModal(m)}
          >
            {/* Header: Incontro Title */}
            <View style={{
              backgroundColor: phaseColor + '15',
              paddingVertical: 10,
              paddingHorizontal: 15,
              borderBottomWidth: 1,
              borderBottomColor: phaseColor + '20',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Text style={{ fontSize: 11, fontWeight: '900', color: phaseColor, letterSpacing: 1.5 }}>
                {m.description?.toUpperCase() || 'INCONTRO'}
              </Text>
              {isPlayed && <Ionicons name="checkmark-circle" size={18} color="#34C759" />}
            </View>

            <View style={{ padding: 15, gap: 12 }}>
              {/* Team A */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderWidth: 2.5,
                    borderColor: teamAHex.toUpperCase() === '#FFFFFF' ? (isDarkMode ? '#3A3A3C' : '#E5E5EA') : teamAHex,
                    overflow: 'hidden',
                    backgroundColor: teamAHex.toUpperCase() === '#FFFFFF' ? (isDarkMode ? '#2C2C2E' : '#F2F2F7') : '#FFF',
                    justifyContent: 'center',
                    alignItems: 'center',
                    elevation: 2
                  }}>
                    {infoA.logo ? (
                      <Image source={{ uri: infoA.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    ) : (
                      <Ionicons name="shirt" size={20} color={teamAHex.toUpperCase() === '#FFFFFF' ? '#8E8E93' : teamAHex} />
                    )}
                  </View>

                  <Text style={[dynamicStyles.text, {
                    fontSize: 14,
                    fontWeight: isPlayed && m.team_a_score > m.team_b_score ? '900' : '700',
                    flex: 1
                  }]} numberOfLines={2}>
                    {infoA.name}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: isDarkMode ? '#2C2C2E' : '#F2F2F7',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 10,
                  minWidth: 40,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'
                }}>
                   <Text style={[dynamicStyles.text, {
                     fontSize: 18,
                     fontWeight: '900',
                     color: isPlayed ? (m.team_a_score >= m.team_b_score ? phaseColor : '#8E8E93') : dynamicStyles.text.color
                   }]}>
                     {isPlayed ? m.team_a_score : '-'}
                   </Text>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: isDarkMode ? '#333' : '#F0F0F0', opacity: 0.8 }} />

              {/* Team B */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderWidth: 2.5,
                    borderColor: teamBHex.toUpperCase() === '#FFFFFF' ? (isDarkMode ? '#3A3A3C' : '#E5E5EA') : teamBHex,
                    overflow: 'hidden',
                    backgroundColor: teamBHex.toUpperCase() === '#FFFFFF' ? (isDarkMode ? '#2C2C2E' : '#F2F2F7') : '#FFF',
                    justifyContent: 'center',
                    alignItems: 'center',
                    elevation: 2
                  }}>
                    {infoB.logo ? (
                      <Image source={{ uri: infoB.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    ) : (
                      <Ionicons name="shirt" size={20} color={teamBHex.toUpperCase() === '#FFFFFF' ? '#8E8E93' : teamBHex} />
                    )}
                  </View>

                  <Text style={[dynamicStyles.text, {
                    fontSize: 14,
                    fontWeight: isPlayed && m.team_b_score > m.team_a_score ? '900' : '700',
                    flex: 1
                  }]} numberOfLines={2}>
                    {infoB.name}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: isDarkMode ? '#2C2C2E' : '#F2F2F7',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 10,
                  minWidth: 40,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'
                }}>
                   <Text style={[dynamicStyles.text, {
                     fontSize: 18,
                     fontWeight: '900',
                     color: isPlayed ? (m.team_b_score >= m.team_a_score ? phaseColor : '#8E8E93') : dynamicStyles.text.color
                   }]}>
                     {isPlayed ? m.team_b_score : '-'}
                   </Text>
                </View>
              </View>

              {/* Match Details Footer */}
              <View style={{
                marginTop: 5,
                paddingTop: 10,
                borderTopWidth: 1.5,
                borderTopColor: isDarkMode ? '#333' : '#F0F0F0',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="calendar-outline" size={12} color="#8E8E93" />
                  <Text style={{ fontSize: 11, color: '#8E8E93', fontWeight: '700' }}>
                    {new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} • {new Date(m.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {m.location && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="location-outline" size={12} color="#8E8E93" />
                    <Text style={{ fontSize: 11, color: '#8E8E93', fontWeight: '700', maxWidth: 100 }} numberOfLines={1}>{m.location}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <View style={{ width: 40, height: 3, backgroundColor: phaseColor + '30', borderRadius: 1.5 }} />
        </View>
      );
    };

    return (
      <View style={{ flex: 1 }}>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 30, alignItems: 'flex-start' }}
        >
          {phases.map((p, pIdx) => (
            <View key={p.id} style={{ marginRight: 0, minHeight: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 30, backgroundColor: isDarkMode ? '#1C1C1E' : '#FFF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: p.color + '40', alignSelf: 'flex-start' }}>
                <Ionicons name={p.icon as any} size={18} color={p.color} />
                <Text style={{ fontSize: 13, fontWeight: '900', color: p.color, letterSpacing: 1 }}>{p.title.toUpperCase()}</Text>
              </View>

              <View style={{ flex: 1, justifyContent: 'center' }}>
                {p.matches.map((m, i) => renderBracketCard(m, p.color, i === p.matches.length - 1))}
              </View>
            </View>
          ))}

          {knockoutMatches.length === 0 && (
            <View style={{ alignItems: 'center', justifyContent: 'center', width: 300, opacity: 0.5, marginTop: 50 }}>
              <Ionicons name="git-network-outline" size={80} color="#8E8E93" />
              <Text style={[dynamicStyles.text, { marginTop: 15, textAlign: 'center', fontWeight: '600' }]}>Fase finale non ancora generata.\nUsa il tasto nella tab Girone per iniziare.</Text>
            </View>
          )}
        </ScrollView>

        {isAdminOrOwner && (
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 25, backgroundColor: 'transparent' }}>
            <TouchableOpacity
              style={[styles.mainShareBtn, { flex: 1, backgroundColor: '#5856D6', marginHorizontal: 0, height: 46, borderRadius: 12 }]}
              onPress={handleGenerateKnockout}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={[styles.saveBtnText, { fontSize: 14 }]}>Aggiungi</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mainShareBtn, { flex: 1, backgroundColor: isDarkMode ? '#2C2C2E' : '#F2F2F7', borderWidth: 1, borderColor: '#FF3B30', marginHorizontal: 0, height: 46, borderRadius: 12 }]}
              onPress={handleResetKnockout}
            >
              <Ionicons name="refresh-outline" size={20} color="#FF3B30" style={{ marginRight: 8 }} />
              <Text style={[styles.saveBtnText, { color: '#FF3B30', fontSize: 14 }]}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const getSortedStandings = () => {
    let sortOptions = [
      { id: 'points', key: 'points' },
      { id: 'goals', key: 'individual_goals' },
      { id: 'assists', key: 'individual_assists' },
      { id: 'incisivity', key: 'incisivity' },
      { id: 'bonus', key: 'bonus_points' },
      { id: 'bp', key: 'personal_bonus_count' },
      { id: 'bd', key: 'defense_bonus_count' },
      { id: 'cs', key: 'clean_sheets' },
      { id: 'mg' },
      { id: 'ma' },
      { id: 'ms' },
      { id: 'played', key: 'played' },
      { id: 'won', key: 'won' },
      { id: 'lost', key: 'lost' },
      { id: 'drawn', key: 'drawn' },
    ];

    const activeSortId = group?.group_type === 'tournament' && sortBy === 'points' ? 'goals' : sortBy;
    const finalSort = sortOptions.find(o => o.id === activeSortId) || sortOptions[0];

    const sorted = [...standings].sort((a, b) => {
      const key = finalSort.key as keyof PlayerStats;
      let valA = a[key] as number;
      let valB = b[key] as number;

      // Logica speciale per medie (MG, MA, MS)
      if (activeSortId === 'mg') { valA = a.individual_goals / (a.career_divisor || 1); valB = b.individual_goals / (b.career_divisor || 1); }
      if (activeSortId === 'ma') { valA = a.individual_assists / (a.career_divisor || 1); valB = b.individual_assists / (b.career_divisor || 1); }
      if (activeSortId === 'ms') { valA = a.goals_suffered / (a.career_divisor || 1); valB = b.goals_suffered / (b.career_divisor || 1); }

      // Ordinamento Crescente per Sconfitte (P) e Media Subiti (MS)
      if (activeSortId === 'lost' || activeSortId === 'ms') {
        if (valA !== valB) return valA - valB;
      } else {
        if (valB !== valA) return valB - valA;
      }

      // Seconda chiave di ordinamento: punti (se non stiamo già ordinando per punti)
      if (activeSortId !== 'points' && b.points !== a.points) {
        return b.points - a.points;
      }

      // Se i punti sono uguali (o stiamo ordinando per punti ed essi sono uguali),
      // usiamo il tie-breaker configurato
      if (valB === valA || (activeSortId !== 'points' && b.points === a.points)) {
        const compareTieBreaker = (pA: PlayerStats, pB: PlayerStats, criterion: string | undefined) => {
          if (!criterion) return 0;
          switch (criterion) {
            case 'ratio':
              return (pB.points / (pB.played || 1)) - (pA.points / (pA.played || 1));
            case 'played':
              return pB.played - pA.played;
            case 'goals':
              return pB.individual_goals - pA.individual_goals;
            case 'assists':
              return pB.individual_assists - pA.individual_assists;
            case 'bonus':
              return pB.bonus_points - pA.bonus_points;
            case 'incisivity':
              return pB.incisivity - pA.incisivity;
            default:
              return 0;
          }
        };

        const res1 = compareTieBreaker(a, b, group?.tie_breaker_1 || 'ratio');
        if (res1 !== 0) return res1;

        const res2 = compareTieBreaker(a, b, group?.tie_breaker_2 || 'incisivity');
        if (res2 !== 0) return res2;

        // Fallback finale: Differenza Reti
        return (b.goals_done - b.goals_suffered) - (a.goals_done - a.goals_suffered);
      }

      return 0;
    });

    // Filtriamo i giocatori che non hanno mai giocato nel campionato principale
    return sorted.filter(p => p.played > 0);
  };

  const handleResetTournament = async () => {
    Alert.alert(
      'Reset Torneo',
      'Sei sicuro di voler resettare il torneo? Tutte le partite (gironi ed eliminatorie), i risultati e la classifica verranno eliminati definitivamente.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Reset Tutto',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await resetTournament(groupId as string);
              setTeams(null);
              setSelectedIds(new Set());
              setActiveTab('players');
              await loadData(true);
              Alert.alert('Successo', 'Torneo resettato correttamente.');
            } catch (e: any) {
              Alert.alert('Errore', 'Reset fallito: ' + e.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleResetTournamentResults = async () => {
    Alert.alert(
      'Reset Risultati',
      'Sei sicuro di voler resettare tutti i risultati del torneo? Le partite, le squadre e le impostazioni rimarranno invariate, ma i punteggi e i marcatori verranno azzerati.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Reset Risultati',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await resetTournamentResults(groupId as string);
              await loadData(true);
              Alert.alert('Successo', 'Risultati azzerati correttamente.');
            } catch (e: any) {
              Alert.alert('Errore', 'Reset fallito: ' + e.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderStandings = () => {
    let sortOptions = [
      { id: 'points', label: 'Punti', key: 'points', short: 'PT', color: isDarkMode ? '#FFF' : '#1C1C1E' },
      { id: 'goals', label: 'Goal', key: 'individual_goals', short: 'G', color: '#FF3B30' },
      { id: 'assists', label: 'Assist', key: 'individual_assists', short: 'A', color: '#34C759' },
      { id: 'incisivity', label: 'Incisività', key: 'incisivity', short: 'INC', color: '#FF9500' },
      { id: 'bonus', label: 'Bonus', key: 'bonus_points', short: 'BON', color: '#5AC8FA' },
      { id: 'bp', label: 'Bonus Pers.', key: 'personal_bonus_count', short: 'BP', color: '#5AC8FA' },
      { id: 'bd', label: 'Bonus Dif.', key: 'defense_bonus_count', short: 'BD', color: '#5AC8FA' },
      { id: 'cs', label: 'Clean Sheet', key: 'clean_sheets', short: 'CS', color: '#5AC8FA' },
      { id: 'mg', label: 'M. Goal', key: 'individual_goals', short: 'MG', color: isDarkMode ? '#FFF' : '#1C1C1E' },
      { id: 'ma', label: 'M. Assist', key: 'individual_assists', short: 'MA', color: isDarkMode ? '#FFF' : '#1C1C1E' },
      { id: 'ms', label: 'M. Subiti', key: 'goals_suffered', short: 'MS', color: isDarkMode ? '#FFF' : '#1C1C1E' },
      { id: 'played', label: 'Partite', key: 'played', short: 'PG', color: '#8E8E93' },
      { id: 'won', label: 'Vinte', key: 'won', short: 'V', color: '#34C759' },
      { id: 'lost', label: 'Perse', key: 'lost', short: 'P', color: '#FF3B30' },
      { id: 'drawn', label: 'Pari', key: 'drawn', short: 'X', color: '#FF9500' },
    ];

    if (group?.group_type === 'tournament') {
      sortOptions = [
        { id: 'goals', label: 'Goal', key: 'individual_goals', short: 'G', color: '#FF3B30' },
        { id: 'assists', label: 'Assist', key: 'individual_assists', short: 'A', color: '#34C759' },
      ];
    }

    const activeSortId = group?.group_type === 'tournament' && sortBy === 'points' ? 'goals' : sortBy;
    const sortedData = getSortedStandings();

    // Definizione di tutte le colonne possibili
    let statsCols = [
      { id: 'points', short: 'PT', color: dynamicStyles.text.color, getValue: (i: any) => i.points },
      { id: 'goals', short: 'G', color: '#FF3B30', getValue: (i: any) => i.individual_goals },
      { id: 'assists', short: 'A', color: '#34C759', getValue: (i: any) => i.individual_assists },
      { id: 'incisivity', short: 'INC', color: '#FF9500', getValue: (i: any) => i.incisivity },
      { id: 'bonus', short: 'BON', color: '#5AC8FA', getValue: (i: any) => i.bonus_points },
      { id: 'bp', short: 'BP', color: '#5AC8FA', getValue: (i: any) => i.personal_bonus_count, bold: false },
      { id: 'bd', short: 'BD', color: '#5AC8FA', getValue: (i: any) => i.defense_bonus_count, bold: false },
      { id: 'cs', short: 'CS', color: '#5AC8FA', getValue: (i: any) => i.clean_sheets, bold: false },
      { id: 'mg', short: 'MG', color: dynamicStyles.text.color, getValue: (i: any) => (i.individual_goals / (i.career_divisor || 1)).toFixed(1), bold: false },
      { id: 'ma', short: 'MA', color: dynamicStyles.text.color, getValue: (i: any) => (i.individual_assists / (i.career_divisor || 1)).toFixed(1), bold: false },
      { id: 'ms', short: 'MS', color: dynamicStyles.text.color, getValue: (i: any) => (i.goals_suffered / (i.career_divisor || 1)).toFixed(1), bold: false },
      { id: 'played', short: 'PG', color: '#A2845E', getValue: (i: any) => i.played, bold: false },
      { id: 'tournament_count', short: 'TG', color: '#5856D6', getValue: (i: any) => i.tournament_count, bold: false },
      { id: 'won', short: 'V', color: '#34C759', getValue: (i: any) => i.won, bold: false },
      { id: 'lost', short: 'P', color: '#FF3B30', getValue: (i: any) => i.lost, bold: false },
      { id: 'drawn', short: 'X', color: '#FF9500', getValue: (i: any) => i.drawn, bold: false },
    ];

    if (group?.group_type === 'tournament') {
      statsCols = [
        { id: 'goals', short: 'G', color: '#FF3B30', getValue: (i: any) => i.individual_goals },
        { id: 'assists', short: 'A', color: '#34C759', getValue: (i: any) => i.individual_assists },
      ];
    }

    // Colonne da mostrare nello ScrollView (tutte tranne quella selezionata)
    const scrollableCols = statsCols.filter(c => c.id !== activeSortId);
    // Colonna selezionata (da mostrare fissa tra andamento e ScrollView)
    const selectedCol = statsCols.find(c => c.id === activeSortId);

    const renderHeaderFixedPart = () => (
      <View style={[styles.pCard, dynamicStyles.card, { height: 32, borderBottomWidth: 2, paddingVertical: 0, borderRightWidth: 1, borderRightColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', justifyContent: 'center' }]}>
         <View style={{ width: 135, flexDirection: 'row', alignItems: 'center' }}>
           <Text style={{ fontSize: 9, fontWeight: '900', color: '#8E8E93', marginLeft: 5 }}>POS. NOME</Text>
         </View>
      </View>
    );

    const renderHeaderScrollablePart = () => (
      <View style={[styles.pCard, dynamicStyles.card, { height: 32, borderBottomWidth: 2, paddingVertical: 0, justifyContent: 'center' }]}>
         <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {selectedCol && <StatHeader label={selectedCol.short} color={selectedCol.color} width={40} />}
            {scrollableCols.map(c => <StatHeader key={c.id} label={c.short} width={40} />)}
         </View>
      </View>
    );

    const renderRowFixedPart = (item: any, index: number) => (
      <TouchableOpacity key={item.player_id} style={[styles.pCard, dynamicStyles.card, { height: 38, paddingVertical: 0, borderRightWidth: 1, borderRightColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', justifyContent: 'center' }]} onPress={() => router.push(`/player/${item.player_id}?groupId=${groupId}`)}>
        <View style={{ width: 135, flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.standingRank, { width: 25 }]}>
            {index < 3 && sortBy === 'points' ? (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="ribbon" size={20} color={index === 0 ? '#FFD60A' : index === 1 ? '#C0C0C0' : '#CD7F32'} />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, fontWeight: '900', color: '#000' }}>{index + 1}</Text>
                </View>
              </View>
            ) : <Text style={[styles.rankText, dynamicStyles.text, { fontSize: 12 }]}>{index + 1}</Text>}
          </View>
          <Text style={[styles.pNickname, dynamicStyles.text, { fontSize: 12, flex: 1, marginLeft: 6 }]} numberOfLines={1}>{item.nickname}</Text>
          {item.last_trend && (
            <View style={[styles.trendCircleMini, { backgroundColor: item.last_trend === 'W' ? '#34C759' : item.last_trend === 'D' ? '#FF9500' : '#FF3B30', width: 16, height: 16, borderRadius: 8, marginLeft: 4 }]}>
              <Ionicons name={item.last_trend === 'W' ? "arrow-up" : item.last_trend === 'L' ? "arrow-down" : "remove"} size={10} color="#FFF" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );

    const renderRowScrollablePart = (item: any, index: number) => (
      <TouchableOpacity key={item.player_id} style={[styles.pCard, dynamicStyles.card, { height: 38, paddingVertical: 0, justifyContent: 'center' }]} onPress={() => router.push(`/player/${item.player_id}?groupId=${groupId}`)}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {selectedCol && <StatValue value={selectedCol.getValue(item)} color={selectedCol.color} bold={selectedCol.bold !== false} width={40} fontSize={13} />}
          {scrollableCols.map(c => <StatValue key={c.id} value={c.getValue(item)} color={c.color} bold={c.bold !== false} width={40} fontSize={13} />)}
        </View>
      </TouchableOpacity>
    );

    return (
      <View style={{ flex: 1 }}>
        {/* Filtro Ordinamento */}
        <View style={{ paddingHorizontal: 12, marginBottom: 6 }}>
          <Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4, marginLeft: 4 }]}>Ordina per:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }}>
              {sortOptions.map((opt, i) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setSortBy(opt.id)}
                  style={{
                    paddingHorizontal: 10,
                    height: 30,
                    backgroundColor: (activeSortId === opt.id) ? opt.color : (isDarkMode ? '#2C2C2E' : '#FFFFFF'),
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderLeftWidth: i === 0 ? 0 : 1,
                    borderLeftColor: isDarkMode ? '#3A3A3C' : '#E5E5EA',
                  }}
                >
                  <Text style={{
                    fontSize: 9,
                    fontWeight: '900',
                    color: (activeSortId === opt.id) ? (opt.id === 'points' && !isDarkMode ? '#FFF' : (opt.id === 'points' ? '#000' : '#FFF')) : (isDarkMode ? '#AEAEB2' : '#8E8E93')
                  }}>
                    {opt.label.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} />}>
          <View style={{ flexDirection: 'row' }}>
             <View>
                {renderHeaderFixedPart()}
                {sortedData.map((item, index) => renderRowFixedPart(item, index))}
             </View>
             <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                   {renderHeaderScrollablePart()}
                   {sortedData.map((item, index) => renderRowScrollablePart(item, index))}
                </View>
             </ScrollView>
          </View>
        </ScrollView>
      </View>
    );
  };


  const handleQuickDateChange = async (event: any, selectedDate?: Date) => {
    if (!editingQuickMatch || !selectedDate) {
      setEditingQuickMatch(null);
      return;
    }

    const matchId = editingQuickMatch.id;
    const match = matches.find(m => m.id === matchId);
    if (!match) {
      setEditingQuickMatch(null);
      return;
    }

    const updatedMatch = { ...match, date: selectedDate.toISOString() };
    await saveMatchResult(updatedMatch);
    setHasUnsyncedChanges(true);
    setEditingQuickMatch(null);
    loadData();
  };

  const renderMatches = () => {
    const isTournament = group?.group_type === 'tournament';
    let filteredMatches = [...matches];

    if (isTournament) {
      if (selectedGirone === 0) {
        // Fase Eliminatoria
        filteredMatches = filteredMatches.filter(m => m.match_phase && m.match_phase !== 'group');
      } else {
        // Girone specifico - Filtraggio robusto
        filteredMatches = filteredMatches.filter(m => {
          const isGroupPhase = !m.match_phase || m.match_phase === 'group';
          const mGroup = m.tournament_group || 1;
          return isGroupPhase && Number(mGroup) === Number(selectedGirone);
        });
      }
    }

    const sortedMatches = filteredMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <View style={{ flex: 1 }}>
        {isTournament && (
          <View style={{ paddingHorizontal: 16, marginBottom: 12, marginTop: 8, flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.gironeHeader, { backgroundColor: getGironeColor(selectedGirone), flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12 }]}
              onPress={() => setShowGironeSelector(true)}
            >
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>
                {selectedGirone === 0 ? 'FASE ELIMINATORIA' : (group?.num_groups === 1 ? 'GIRONE UNICO' : `GIRONE ${selectedGirone}`)}
              </Text>
              <Ionicons name="chevron-down" size={22} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShareMatchesList}
              style={{ width: 50, backgroundColor: '#34C759', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="share-social-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
        {editingQuickMatch && (
          <DateTimePicker
            value={editingQuickMatch.date}
            mode={editingQuickMatch.type}
            display="default"
            onChange={handleQuickDateChange}
          />
        )}
        <FlatList
          data={sortedMatches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.pCard, dynamicStyles.card, { flexDirection: 'column', alignItems: 'stretch', padding: 10, paddingVertical: 8 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  {item.description ? (
                    <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '900', marginBottom: 0 }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : (
                    <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '900', marginBottom: 0 }]}>Partita</Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => isAdminOrOwner && setEditingQuickMatch({ id: item.id, date: new Date(item.date), type: 'date' })}
                      disabled={!isAdminOrOwner}
                    >
                      <Text style={[styles.matchDate, dynamicStyles.subText, { fontSize: 11 }]}>
                        {item.date ? new Date(item.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '--'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[dynamicStyles.subText, { fontSize: 11, marginHorizontal: 4 }]}>•</Text>
                    <TouchableOpacity
                      onPress={() => isAdminOrOwner && setEditingQuickMatch({ id: item.id, date: new Date(item.date), type: 'time' })}
                      disabled={!isAdminOrOwner}
                    >
                      <Text style={[styles.matchDate, dynamicStyles.subText, { fontSize: 11 }]}>
                        {item.date ? new Date(item.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </Text>
                    </TouchableOpacity>
                    {item.location && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}>
                        <Text style={[dynamicStyles.subText, { fontSize: 11, marginRight: 4 }]}>•</Text>
                        <Ionicons name="location-outline" size={10} color="#8E8E93" />
                        <Text style={[dynamicStyles.subText, { fontSize: 10, marginLeft: 2, maxWidth: 100 }]} numberOfLines={1}>{item.location}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => handleShareMatchStats(item)} style={{ padding: 2 }}>
                      <Ionicons name="share-social-outline" size={18} color="#34C759" />
                    </TouchableOpacity>

                    {isAdminOrOwner && (
                      <TouchableOpacity onPress={() => handleResetMatchResult(item)} style={{ padding: 2 }}>
                        <Ionicons name="reload-outline" size={18} color="#FF9500" />
                      </TouchableOpacity>
                    )}

                    {isAdminOrOwner && group?.group_type !== 'tournament' && (
                      <TouchableOpacity onPress={() => handleToggleMatchExclusion(item)} style={{ padding: 2 }}>
                        <Ionicons
                          name={item.exclude_def_bonus ? "close-circle" : "close-circle-outline"}
                          size={20}
                          color={item.exclude_def_bonus ? "#FF3B30" : "#8E8E93"}
                        />
                      </TouchableOpacity>
                    )}

                    {isAdminOrOwner && (
                      <TouchableOpacity onPress={() => handleDeleteMatch(item.id)} style={{ padding: 2 }}>
                        <Ionicons name="trash" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    {item.status === 'scheduled' && (
                      <View style={{ backgroundColor: '#FF950015', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: '#FF9500', fontSize: 9, fontWeight: '800' }}>DA GIOCARE</Text>
                      </View>
                    )}
                    {item.status === 'played' && (
                      <View style={{ backgroundColor: '#34C75915', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: '#34C759', fontSize: 9, fontWeight: '800' }}>GIOCATA</Text>
                      </View>
                    )}
                    {item.exclude_def_bonus && (
                      <View style={{ backgroundColor: '#FF3B3015', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: '#FF3B30', fontSize: 9, fontWeight: '800' }}>ESCLUSA</Text>
                      </View>
                    )}
                  </View>
                </View>

              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => isAdminOrOwner && handleOpenResultModal(item)}
                disabled={!isAdminOrOwner}
              >
                {(() => {
                  const infoA = getResolvedTeamInfo(item, 'a');
                  const infoB = getResolvedTeamInfo(item, 'b');
                  const hexA = getJerseyHex(infoA.color);
                  const hexB = getJerseyHex(infoB.color);

                  return (
                    <>
                      <View style={[styles.teamScoreInfo, { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flex: 1.2 }]}>
                        <Text style={[styles.teamScoreName, dynamicStyles.text, { flex: 1, textAlign: 'right', fontSize: 13 }]} numberOfLines={2}>{infoA.name}</Text>
                        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: hexA, overflow: 'hidden', backgroundColor: '#FFF', marginLeft: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                          {infoA.logo ? (
                            <Image source={{ uri: infoA.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                          ) : (
                            <Ionicons
                              name="shirt"
                              size={18}
                              color={hexA}
                              style={hexA.toLowerCase() === '#ffffff' && {
                                textShadowColor: 'rgba(0,0,0,0.5)',
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 2
                              }}
                            />
                          )}
                        </View>
                      </View>

                      <View style={[styles.scoreBadge, { backgroundColor: item.status === 'scheduled' ? 'transparent' : (isDarkMode ? '#3A3A3C' : '#F2F2F7'), minWidth: 65, height: 38, justifyContent: 'center' }]}>
                        {item.status === 'scheduled' ? (
                          <Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900', opacity: 0.3 }]}>VS</Text>
                        ) : (
                          <Text style={[styles.scoreValue, dynamicStyles.text, { fontSize: 18 }]}>{item.team_a_score} - {item.team_b_score}</Text>
                        )}
                      </View>

                      <View style={[styles.teamScoreInfo, { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', flex: 1.2 }]}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: hexB, overflow: 'hidden', backgroundColor: '#FFF', marginRight: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                          {infoB.logo ? (
                            <Image source={{ uri: infoB.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                          ) : (
                            <Ionicons
                              name="shirt"
                              size={18}
                              color={hexB}
                              style={hexB.toLowerCase() === '#ffffff' && {
                                textShadowColor: 'rgba(0,0,0,0.5)',
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 2
                              }}
                            />
                          )}
                        </View>
                        <Text style={[styles.teamScoreName, dynamicStyles.text, { flex: 1, fontSize: 13 }]} numberOfLines={2}>{infoB.name}</Text>
                      </View>
                    </>
                  );
                })()}
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} />}
        />
      </View>
    );
  };


  const renderTeamsResult = () => {
    if (!teams) return null;

    const teamAHex = getJerseyHex(teams.team_a_color);
    const teamBHex = getJerseyHex(teams.team_b_color);

    // Normalizza i dati per supportare sia 2 squadre (Campionato) che N squadre (Torneo)
    const teamData = (teams.teams || [
      { players: teams.team_a, name: teams.team_a_name, color: teams.team_a_color, total_strength: teams.team_a_total_strength, avg_age: teams.team_a_avg_age, key: 'a', assigned_group: 1 },
      { players: teams.team_b, name: teams.team_b_name, color: teams.team_b_color, total_strength: teams.team_b_total_strength, avg_age: teams.team_b_avg_age, key: 'b', assigned_group: 1 }
    ]).filter(t => !!t && Array.isArray(t.players)).map((t, idx, arr) => {
      // Se il girone non è assegnato (es. generazione vecchia o bug), lo calcoliamo al volo per bilanciare
      if (t.assigned_group === undefined && group?.num_groups && group.num_groups > 1) {
        const teamsPerGroup = Math.ceil(arr.length / group.num_groups);
        return { ...t, assigned_group: Math.floor(idx / teamsPerGroup) + 1 };
      }
      return t;
    });

    const changeAssignedGroup = (teamKey: string) => {
      if (!group?.num_groups || group.num_groups <= 1) return;
      const newTeams = { ...teams };
      if (!newTeams.teams) return;

      const tIdx = newTeams.teams.findIndex(t => t.key === teamKey);
      if (tIdx === -1) return;

      // Cicla tra i gironi disponibili (1, 2, 3... N)
      const current = newTeams.teams[tIdx].assigned_group || 1;
      const next = (current % group.num_groups) + 1;

      newTeams.teams[tIdx] = { ...newTeams.teams[tIdx], assigned_group: next };
      setTeams(newTeams);
    };

    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {!sharing && (
            <View style={[styles.configContainer, dynamicStyles.card, { marginHorizontal: 20, marginBottom: 12, padding: 12, marginTop: 10 }]}>
              <Text style={[styles.configSectionTitle, dynamicStyles.text, { marginBottom: 10 }]}>Dettagli Partita</Text>
              <TextInput style={[styles.searchInput, dynamicStyles.text, { height: 40, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', marginBottom: 10 }]} placeholder="Descrizione (es. Giornata 1)" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} value={matchDescription} onChangeText={setMatchDescription} />
              <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.filterChip, {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 0}]}>
                  <Ionicons name="calendar-outline" size={16} color="#007AFF" style={{marginRight: 6}} />
                  <Text style={dynamicStyles.text}>{matchDate.toLocaleDateString('it-IT')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTimePicker(true)} style={[styles.filterChip, {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 0}]}>
                  <Ionicons name="time-outline" size={16} color="#007AFF" style={{marginRight: 6}} />
                  <Text style={dynamicStyles.text}>{matchDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              </View>
              <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', borderRadius: 10, paddingHorizontal: 10}}>
                <Ionicons name="location-outline" size={18} color="#8E8E93" />
                <TextInput style={[styles.searchInput, dynamicStyles.text, { height: 40, marginLeft: 6 }]} placeholder="Luogo partita..." placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} value={matchLocation} onChangeText={setMatchLocation} />
              </View>
            </View>
          )}

          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0 }} style={{ backgroundColor: isDarkMode ? '#111111' : '#F8F9FF', padding: sharing ? 12 : 10 }}>
            <View style={styles.teamsContainer}>
              {sharing && (
                <View style={{ marginBottom: 15, backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF', padding: 12, borderRadius: 18, borderWidth: 1, borderColor: isDarkMode ? '#333' : '#E5E5EA' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#007AFF', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 2 }}>{group?.group_type === 'tournament' ? 'TOURNAMENT PREVIEW' : 'MATCH PREVIEW'}</Text>
                      <Text style={[styles.teamsDescText, { color: isDarkMode ? '#FFFFFF' : '#1C1C1E', fontSize: 18, marginBottom: 2 }]}>
                        {matchDescription || (teams.description ? teams.description : 'Super Sfida')}
                      </Text>
                      <View style={styles.teamsDateTimeLoc}>
                        <Text style={[styles.teamsMetaText, { color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 12, fontWeight: '600' }]}>
                          📅 {matchDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}
                        </Text>
                        <Text style={[styles.teamsMetaText, { color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 12, fontWeight: '600' }]}>
                          🕒 ore {matchDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                    <View style={{ width: 54, height: 54, borderRadius: 27, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 2, borderColor: '#007AFF', marginLeft: 10, marginTop: -8 }}>
                      <Image source={require('../../assets/images/icon.png')} style={{ width: 54, height: 54 }} resizeMode="contain" />
                    </View>
                  </View>
                  {matchLocation ? (
                    <Text style={[styles.teamsMetaText, { color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 12, fontWeight: '600', marginTop: 4 }]}>
                      📍 {matchLocation}
                    </Text>
                  ) : null}
                </View>
              )}

              {teamData.map((t, i) => {
                const teamHex = getJerseyHex(t.color);
                return (
                  <React.Fragment key={i}>
                    <View style={[styles.teamCard, dynamicStyles.card, { borderLeftWidth: 0, borderWidth: sharing ? 2 : 0, borderColor: teamHex, padding: sharing ? 8 : 12, marginBottom: sharing ? 8 : 12, zIndex: 1 }]}>
                      <View style={[styles.teamHeader, { marginBottom: sharing ? 6 : 10 }]}>
                        <TouchableOpacity
                          onPress={() => {
                            if (!sharing) {
                              handlePickLogo(t.key as any);
                            }
                          }}
                          disabled={sharing}
                          style={[
                            styles.jerseyBadge,
                            {
                              backgroundColor: teamHex,
                              borderWidth: teamHex === '#FFFFFF' ? 1 : 0,
                              borderColor: '#D1D1D6',
                              width: sharing ? 30 : 36,
                              height: sharing ? 30 : 36,
                              borderRadius: sharing ? 15 : 18,
                              overflow: 'hidden'
                            }
                          ]}
                        >
                          {t.logo ? (
                            <Image source={{ uri: t.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                          ) : (
                            <Ionicons
                              name="shirt"
                              size={sharing ? 16 : 18}
                              color={getJerseyTextColor(t.color)}
                              style={teamHex === '#FFFFFF' ? {
                                textShadowColor: 'rgba(0,0,0,0.3)',
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 1
                              } : {}}
                            />
                          )}
                          {!sharing && (
                            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#007AFF', padding: 2, borderRadius: 10 }}>
                              <Ionicons name="camera" size={8} color="#FFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            if (!sharing) {
                              setTempTeamName(t.name);
                              setShowNameEditor(t.key as any);
                            }
                          }}
                          disabled={sharing}
                          style={{ flex: 1 }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.teamName, dynamicStyles.text, { fontSize: sharing ? 16 : 18 }]}>{t.name}</Text>
                            {!sharing && <Ionicons name="pencil" size={14} color="#8E8E93" />}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={[styles.teamStatsSub, { fontSize: 10 }]}>
                              {t.avg_age} Età Media • {(t.total_strength / (t.players.length || 1)).toFixed(1)} FRZ Media
                            </Text>
                          </View>
                          {isAdminOrOwner && !sharing && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                              {JERSEY_COLORS.map(c => (
                                <TouchableOpacity
                                  key={c.value}
                                  onPress={() => updateTeamColor(t.key as any, c.value)}
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    backgroundColor: c.hex,
                                    marginRight: 8,
                                    borderWidth: t.color === c.value ? 2 : 0.5,
                                    borderColor: t.color === c.value ? '#007AFF' : (isDarkMode ? '#444' : '#D1D1D6'),
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                  }}
                                >
                                  {t.color === c.value && <Ionicons name="checkmark" size={12} color={getJerseyTextColor(c.value)} />}
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          )}
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ alignItems: 'center', gap: 2 }}>
                             <Text style={{ fontSize: 8, fontWeight: '900', color: isDarkMode ? '#AEAEB2' : '#8E8E93' }}>{t.players.length} GIOCATORI</Text>
                             <View style={{
                               backgroundColor: teamHex.toUpperCase() === '#FFFFFF'
                                 ? (isDarkMode ? 'rgba(255,255,255,0.1)' : '#FFFFFF')
                                 : teamHex + '20',
                               paddingHorizontal: 8,
                               paddingVertical: 4,
                               borderRadius: 8,
                               borderWidth: 1,
                               borderColor: teamHex.toUpperCase() === '#FFFFFF'
                                 ? (isDarkMode ? 'rgba(255,255,255,0.2)' : '#D1D1D6')
                                 : teamHex + '40',
                               minWidth: 45,
                               alignItems: 'center'
                             }}>
                                <Text style={{
                                  fontSize: 13,
                                  fontWeight: '900',
                                  color: teamHex.toUpperCase() === '#FFFFFF'
                                    ? (isDarkMode ? '#FFFFFF' : '#8E8E93')
                                    : teamHex
                                }}>{t.total_strength}</Text>
                                <Text style={{
                                  fontSize: 6,
                                  fontWeight: '800',
                                  color: teamHex.toUpperCase() === '#FFFFFF'
                                    ? (isDarkMode ? '#AEAEB2' : '#8E8E93')
                                    : teamHex,
                                  marginTop: -2
                                }}>FRZ</Text>
                             </View>
                          </View>
                        </View>
                      </View>
                      {t.players.map((p) => (
                        <View key={p.id} style={[styles.teamPlayerRow, { paddingVertical: sharing ? 2 : 4 }]}>
                          <TouchableOpacity
                            style={[styles.tpInfo, { marginLeft: 0 }]}
                            onPress={() => !sharing && handleOpenPlayerEditor(p, t.key as any)}
                            disabled={sharing}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={[styles.tpName, dynamicStyles.text, { fontSize: sharing ? 14 : 15 }]}>{p.nickname}</Text>
                              {players.some(op => op.id === p.id && (op.role !== p.role || op.strength !== p.strength)) && (
                                <Ionicons name="flash" size={12} color="#FF9500" />
                              )}
                            </View>
                            <Text style={[styles.tpRole, { color: ROLE_COLORS[p.role], fontSize: sharing ? 9 : 10 }]}>{p.role}</Text>
                          </TouchableOpacity>

                          <View style={styles.tpRight}>
                            {showIndividualStrength && (
                              <View style={[styles.pStrBadge, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', flexDirection: 'row', gap: sharing ? 6 : 8, paddingHorizontal: sharing ? 6 : 8, paddingVertical: sharing ? 2 : 4, borderRadius: 10 }]}>
                                <View style={{alignItems: 'center'}}><Text style={[styles.tpAge, dynamicStyles.subText, {fontSize: sharing ? 11 : 12, fontWeight: '700'}]}>{p.age}</Text><Text style={[styles.pStrLabel, {fontSize: 6}]}>ANNI</Text></View>
                                <View style={[styles.pDivider, dynamicStyles.divider, { height: 12 }]} />
                                <View style={{alignItems: 'center'}}><Text style={[styles.tpStrength, dynamicStyles.text, { fontSize: sharing ? 14 : 16 }]}>{p.strength}</Text><Text style={[styles.pStrLabel, {fontSize: 6}]}>FRZ</Text></View>
                              </View>
                            )}
                            {!sharing && (
                              <TouchableOpacity
                                onPress={() => swapPlayer(p.id, t.key as any)}
                                style={[styles.swapBtn, { padding: 8, backgroundColor: '#007AFF15', borderRadius: 8 }]}
                              >
                                <Ionicons name="swap-horizontal" size={22} color="#007AFF" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                    {i < teamData.length - 1 && sharing && (
                      <View style={{ alignItems: 'center', marginTop: -22, marginBottom: -4, zIndex: 10, elevation: 10 }}>
                        <View style={{ backgroundColor: '#007AFF', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isDarkMode ? '#111111' : '#F8F9FF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 }}>
                          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 10 }}>VS</Text>
                        </View>
                      </View>
                    )}
                  </React.Fragment>
                );
              })}

              {sharing && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 8 }}>
                  <View style={{ height: 1, flex: 1, backgroundColor: isDarkMode ? '#333' : '#E5E5EA' }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={[dynamicStyles.subText, { fontSize: 8, fontWeight: '800', letterSpacing: 1 }]}>GENERATO CON EASYLIGA</Text>
                    <View style={{ width: 14, height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                      <Image source={require('../../assets/images/icon.png')} style={{ width: 14, height: 14 }} resizeMode="contain" />
                    </View>
                  </View>
                  <View style={{ height: 1, flex: 1, backgroundColor: isDarkMode ? '#333' : '#E5E5EA' }} />
                </View>
              )}
            </View>
          </ViewShot>
          {isAdminOrOwner && group?.group_type !== 'tournament' && (
            <TouchableOpacity style={styles.mainShareBtn} onPress={() => handleOpenResultModal()}>
              <Ionicons name="save-outline" size={20} color="#FFF" style={{marginRight: 8}} />
              <Text style={styles.mainShareBtnText}>Registra Risultato Partita</Text>
            </TouchableOpacity>
          )}
          {isAdminOrOwner && group?.group_type === 'tournament' && (
            <TouchableOpacity
              style={[styles.mainShareBtn, { backgroundColor: '#34C759' }]}
              onPress={() => {
                Alert.alert(
                  'Conferma Girone',
                  'Verranno generate automaticamente tutte le partite dello scontro diretto. Continuare?',
                  [
                    { text: 'Annulla', style: 'cancel' },
                    { text: 'Genera Girone', onPress: handleGenerateGirone }
                  ]
                );
              }}
              disabled={generating}
            >
              <Ionicons name="calendar-outline" size={20} color="#FFF" style={{marginRight: 8}} />
              <Text style={styles.mainShareBtnText}>{generating ? 'Generazione...' : 'Conferma e Genera Girone'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };


  const renderPlayerStatRow = (p: Player, teamKey: 'a' | 'b') => (
    <View key={p.id} style={styles.statRow}>
      <Text style={[styles.statName, { marginLeft: 0 }, dynamicStyles.text]} numberOfLines={1}>{p.nickname}</Text>
      <View style={styles.statControls}>
        {group?.show_scorers && (
          <View style={styles.statGroup}>
            <TouchableOpacity onPress={() => updateMatchStat(p.id, 'goals', -1, teamKey)}><Ionicons name="remove-circle-outline" size={22} color="#8E8E93" /></TouchableOpacity>
            <Text style={[styles.statValueText, { color: '#FF3B30' }]}>{matchGoals[p.id] || 0} G</Text>
            <TouchableOpacity onPress={() => updateMatchStat(p.id, 'goals', 1, teamKey)}><Ionicons name="add-circle-outline" size={22} color="#FF3B30" /></TouchableOpacity>
          </View>
        )}
        {group?.show_assists && (
          <View style={styles.statGroup}>
            <TouchableOpacity onPress={() => updateMatchStat(p.id, 'assists', -1)}><Ionicons name="remove-circle-outline" size={22} color="#8E8E93" /></TouchableOpacity>
            <Text style={[styles.statValueText, { color: '#34C759' }]}>{matchAssists[p.id] || 0} A</Text>
            <TouchableOpacity onPress={() => updateMatchStat(p.id, 'assists', 1)}><Ionicons name="add-circle-outline" size={22} color="#34C759" /></TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const renderStandingsSharePreview = () => {
    if (!sharingStandings) return null;
    const isTournament = group?.group_type === 'tournament';
    const activeSortId = isTournament && sortBy === 'points' ? 'goals' : sortBy;
    const sortedData = getSortedStandings();

    const statLabels: Record<string, string> = {
      'points': 'PT', 'goals': 'G', 'assists': 'A', 'incisivity': 'INC',
      'bonus': 'BON', 'bp': 'BP', 'bd': 'BD', 'cs': 'CS', 'mg': 'MG', 'ma': 'MA', 'ms': 'MS',
      'played': 'PG', 'tournament_count': 'TG', 'won': 'V', 'lost': 'P', 'drawn': 'X'
    };

    // Definizione di tutte le colonne possibili per la preview (versione estesa come in orizzontale)
    let statsCols = [
      { id: 'points', short: 'PT', color: isDarkMode ? '#FFF' : '#1C1C1E', getValue: (i: any) => i.points },
      { id: 'goals', short: 'G', color: '#FF3B30', getValue: (i: any) => i.individual_goals },
      { id: 'assists', short: 'A', color: '#34C759', getValue: (i: any) => i.individual_assists },
      { id: 'incisivity', short: 'INC', color: '#FF9500', getValue: (i: any) => i.incisivity },
      { id: 'bonus', short: 'BON', color: '#5AC8FA', getValue: (i: any) => i.bonus_points },
      { id: 'bp', short: 'BP', color: '#5AC8FA', getValue: (i: any) => i.personal_bonus_count, bold: false },
      { id: 'bd', short: 'BD', color: '#5AC8FA', getValue: (i: any) => i.defense_bonus_count, bold: false },
      { id: 'cs', short: 'CS', color: '#5AC8FA', getValue: (i: any) => i.clean_sheets, bold: false },
      { id: 'mg', short: 'MG', color: isDarkMode ? '#FFF' : '#1C1C1E', getValue: (i: any) => (i.individual_goals / (i.career_divisor || 1)).toFixed(1), bold: false },
      { id: 'ma', short: 'MA', color: isDarkMode ? '#FFF' : '#1C1C1E', getValue: (i: any) => (i.individual_assists / (i.career_divisor || 1)).toFixed(1), bold: false },
      { id: 'ms', short: 'MS', color: isDarkMode ? '#FFF' : '#1C1C1E', getValue: (i: any) => (i.goals_suffered / (i.career_divisor || 1)).toFixed(1), bold: false },
      { id: 'played', short: 'PG', color: '#8E8E93', getValue: (i: any) => i.played, bold: false },
      { id: 'tournament_count', short: 'TG', color: '#5856D6', getValue: (i: any) => i.tournament_count, bold: false },
    ];

    if (isTournament) {
      // Per il torneo mostriamo comunque un set esteso se possibile, o almeno G/A/PG
      statsCols = [
        { id: 'goals', short: 'G', color: '#FF3B30', getValue: (i: any) => i.individual_goals },
        { id: 'assists', short: 'A', color: '#34C759', getValue: (i: any) => i.individual_assists },
        { id: 'incisivity', short: 'INC', color: '#FF9500', getValue: (i: any) => i.incisivity },
        { id: 'played', short: 'PG', color: '#8E8E93', getValue: (i: any) => i.played, bold: false },
      ];
    }

    // Colonna selezionata (da mostrare per prima)
    const selectedCol = statsCols.find(c => c.id === activeSortId) || statsCols[0];
    // Altre colonne (da mostrare dopo)
    const otherCols = statsCols.filter(c => c.id !== selectedCol.id);

    return (
      <Modal visible={true} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          {/* Ridotta la larghezza totale da 720 a 480 per compattare l'immagine */}
          <ViewShot ref={standingsViewShotRef} options={{ format: "png", quality: 1.0 }} style={{ width: 480, backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 10, borderRadius: 20 }}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 5 }}>
                <View>
                  <Text style={[dynamicStyles.text, { fontSize: 20, fontWeight: '900' }]}>{isTournament ? 'MARCATORI' : 'CLASSIFICA'}</Text>
                  <Text style={[dynamicStyles.subText, { fontSize: 12, fontWeight: '700' }]}>{group?.name || 'Superlega'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {activeSortId !== 'points' && (
                    <View style={{ backgroundColor: '#FF3B30', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 10 }}>
                      <Text style={{ color: '#FFF', fontSize: 8, fontWeight: '900' }}>ORDINA: {statLabels[activeSortId] || activeSortId.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                    <Image source={require('../../assets/images/icon.png')} style={{ width: 36, height: 36 }} resizeMode="contain" />
                  </View>
                </View>
             </View>

             <View style={[dynamicStyles.card, { borderRadius: 12, overflow: 'hidden' }]}>
                {/* Header - Spazi ridotti al minimo */}
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', paddingVertical: 6, paddingHorizontal: 8 }}>
                   <View style={{ width: 115 }}><Text style={{ fontSize: 8, fontWeight: '900', color: '#8E8E93' }}>POS. NOME</Text></View>
                   <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
                     <StatHeader label={selectedCol.short} width={28} color={selectedCol.color} fontSize={8} />
                     {otherCols.map(c => <StatHeader key={c.id} label={c.short} width={28} fontSize={8} />)}
                   </View>
                </View>
                {/* Visualizzazione fino a 30 giocatori */}
                {sortedData.slice(0, 30).map((item, index) => (
                  <View key={item.player_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
                    <View style={{ width: 115, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 22, alignItems: 'center' }}>
                        {index < 3 && activeSortId === 'points' && !isTournament ? (
                          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="ribbon" size={16} color={index === 0 ? '#FFD60A' : index === 1 ? '#C0C0C0' : '#CD7F32'} />
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                              <Text style={{ fontSize: 6, fontWeight: '900', color: '#000' }}>{index + 1}</Text>
                            </View>
                          </View>
                        ) : (
                          <Text style={[dynamicStyles.text, { fontSize: 10, fontWeight: '700' }]}>{index + 1}</Text>
                        )}
                      </View>
                      <Text style={[dynamicStyles.text, { fontSize: 10, fontWeight: '700', marginLeft: 4, flex: 1 }]} numberOfLines={1}>{item.nickname}</Text>
                      {item.last_trend && (
                        <View style={{ backgroundColor: item.last_trend === 'W' ? '#34C759' : item.last_trend === 'D' ? '#FF9500' : '#FF3B30', width: 12, height: 12, borderRadius: 6, marginLeft: 2, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={item.last_trend === 'W' ? "arrow-up" : item.last_trend === 'L' ? "arrow-down" : "remove"} size={7} color="#FFF" />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
                      <StatValue value={selectedCol.getValue(item)} width={28} color={selectedCol.color} bold={selectedCol.bold !== false} fontSize={9} />
                      {otherCols.map(c => (
                        <StatValue key={c.id} value={c.getValue(item)} width={28} color={c.color || (isDarkMode ? '#FFF' : '#1C1C1E')} bold={c.bold !== false} fontSize={9} />
                      ))}
                    </View>
                  </View>
                ))}
             </View>

             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, gap: 10 }}>
                <Text style={[dynamicStyles.subText, { fontSize: 10, fontWeight: '700' }]}>GENERATO CON EASYLIGA</Text>
                <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />
                </View>
             </View>
          </ViewShot>
        </View>
      </Modal>
    );
  };


  const renderTournamentStandingsSharePreview = () => {
    if (!sharingTournamentStandings) return null;

    const teamStatsMap: Record<string, any> = {};
    const gironeMatches = matches.filter(m => {
      const isGroupPhase = !m.match_phase || m.match_phase === 'group';
      const mGroup = m.tournament_group || 1;
      return isGroupPhase && Number(mGroup) === Number(selectedGirone);
    });

    gironeMatches.forEach(m => {
      if (!teamStatsMap[m.team_a_name]) teamStatsMap[m.team_a_name] = { name: m.team_a_name, points: 0, played: 0, won: 0, drawn: 0, lost: 0, g_for: 0, g_against: 0, color: m.team_a_color };
      if (!teamStatsMap[m.team_b_name]) teamStatsMap[m.team_b_name] = { name: m.team_b_name, points: 0, played: 0, won: 0, drawn: 0, lost: 0, g_for: 0, g_against: 0, color: m.team_b_color };
    });

    gironeMatches.filter(m => m.status === 'played' || m.status === undefined).forEach(m => {
      const statsA = teamStatsMap[m.team_a_name];
      const statsB = teamStatsMap[m.team_b_name];
      statsA.played++; statsB.played++;
      statsA.g_for += (m.team_a_score || 0); statsA.g_against += (m.team_b_score || 0);
      statsB.g_for += (m.team_b_score || 0); statsB.g_against += (m.team_a_score || 0);
      if (m.team_a_score > m.team_b_score) { statsA.won++; statsA.points += (group?.points_win ?? 3); statsB.lost++; }
      else if (m.team_b_score > m.team_a_score) { statsB.won++; statsB.points += (group?.points_win ?? 3); statsA.lost++; }
      else { statsA.drawn++; statsB.drawn++; statsA.points += (group?.points_draw ?? 1); statsB.points += (group?.points_draw ?? 1); }
    });

    const sortedTeams = Object.values(teamStatsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const dgA = a.g_for - a.g_against;
      const dgB = b.g_for - b.g_against;
      return dgB !== dgA ? dgB - dgA : b.g_for - a.g_for;
    });

    const title = selectedGirone === 0 ? 'FASE ELIMINATORIA' : (group?.num_groups === 1 ? 'GIRONE UNICO' : `GIRONE ${selectedGirone}`);

    return (
      <Modal visible={true} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <ViewShot ref={standingsViewShotRef} options={{ format: "png", quality: 0.9 }} style={{ width: '98%', backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 15, borderRadius: 20 }}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <View>
                  <Text style={[dynamicStyles.text, { fontSize: 24, fontWeight: '900' }]}>CLASSIFICA</Text>
                  <Text style={[dynamicStyles.subText, { fontSize: 14, fontWeight: '700' }]}>{group?.name} • {title}</Text>
                </View>
                <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 50, height: 50 }} resizeMode="contain" />
                </View>
             </View>

             <View style={[dynamicStyles.card, { borderRadius: 15, overflow: 'hidden' }]}>
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', paddingVertical: 10, paddingHorizontal: 10 }}>
                   <View style={{ width: 120 }}><Text style={{ fontSize: 9, fontWeight: '900', color: '#8E8E93' }}>POS. SQUADRA</Text></View>
                   <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
                     <StatHeader label="PTI" width={28} color="#34C759" />
                     <StatHeader label="G" width={20} />
                     <StatHeader label="V" width={20} />
                     <StatHeader label="N" width={20} />
                     <StatHeader label="P" width={20} />
                     <StatHeader label="GF" width={22} />
                     <StatHeader label="GS" width={22} />
                     <StatHeader label="DG" width={25} color="#007AFF" />
                   </View>
                </View>
                {sortedTeams.map((item, index) => (
                  <View key={item.name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
                    <View style={{ width: 120, flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '900', width: 22, textAlign: 'center' }]}>{index + 1}</Text>
                      {item.logo ? (
                        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: getJerseyHex(item.color), overflow: 'hidden', backgroundColor: '#FFF', marginLeft: 4 }}>
                          <Image source={{ uri: item.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                        </View>
                      ) : (
                        <Ionicons
                          name="shirt"
                          size={18}
                          color={getJerseyHex(item.color)}
                          style={[
                            { marginLeft: 4 },
                            item.color === 'Bianca' && {
                              textShadowColor: 'rgba(0,0,0,0.2)',
                              textShadowOffset: { width: 0, height: 1 },
                              textShadowRadius: 1.5
                            }
                          ]}
                        />
                      )}
                      <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '700', marginLeft: 6, flex: 1 }]} numberOfLines={1}>{item.name}</Text>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
                      <StatValue value={item.points} width={28} color="#34C759" fontSize={12} />
                      <StatValue value={item.played} width={20} bold={false} fontSize={12} />
                      <StatValue value={item.won} width={20} bold={false} fontSize={12} />
                      <StatValue value={item.drawn} width={20} bold={false} fontSize={12} />
                      <StatValue value={item.lost} width={20} bold={false} fontSize={12} />
                      <StatValue value={item.g_for} width={22} bold={false} fontSize={11} color="#8E8E93" />
                      <StatValue value={item.g_against} width={22} bold={false} fontSize={11} color="#8E8E93" />
                      <StatValue value={item.g_for - item.g_against} width={25} color="#007AFF" fontSize={12} />
                    </View>
                  </View>
                ))}
             </View>

             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, gap: 10 }}>
                <Text style={[dynamicStyles.subText, { fontSize: 10, fontWeight: '700' }]}>GENERATO CON EASYLIGA</Text>
                <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />
                </View>
             </View>
          </ViewShot>
        </View>
      </Modal>
    );
  };


  const renderBracketSharePreview = () => {
    if (!sharingBracket) return null;
    const knockoutMatches = matches.filter(m => m.match_phase && m.match_phase !== 'group');
    const phases = [
      { id: 'quarterfinal', title: 'Quarti', icon: 'apps-outline', color: '#8E8E93', matches: knockoutMatches.filter(m => m.match_phase === 'quarterfinal') },
      { id: 'semifinal', title: 'Semifinali', icon: 'trophy-outline', color: '#AF52DE', matches: knockoutMatches.filter(m => m.match_phase === 'semifinal') },
      { id: 'third_place', title: 'Finale 3° Posto', icon: 'medal-outline', color: '#FF9500', matches: knockoutMatches.filter(m => m.match_phase === 'third_place') },
      { id: 'final', title: 'Finalissima', icon: 'ribbon-outline', color: '#FFD60A', matches: knockoutMatches.filter(m => m.match_phase === 'final') },
    ].filter(p => p.matches.length > 0);

    return (
      <Modal visible={true} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <ViewShot ref={bracketViewShotRef} options={{ format: "png", quality: 0.9 }} style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 15, borderRadius: 20 }}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <View>
                  <Text style={[dynamicStyles.text, { fontSize: 22, fontWeight: '900' }]}>FASE FINALE</Text>
                  <Text style={[dynamicStyles.subText, { fontSize: 13, fontWeight: '700' }]}>{group?.name || 'Easyliga'}</Text>
                </View>
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
                </View>
             </View>

             <View style={{ flexDirection: 'row', paddingVertical: 10 }}>
               {phases.map((p) => (
                 <View key={p.id} style={{ marginRight: 15 }}>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 }}>
                     <Ionicons name={p.icon as any} size={13} color={p.color} />
                     <Text style={{ fontSize: 10, fontWeight: '900', color: p.color }}>{p.title.toUpperCase()}</Text>
                   </View>
                   {p.matches.map(m => {
                      const isPlayed = m.status === 'played';
                      const infoA = getResolvedTeamInfo(m, 'a');
                      const infoB = getResolvedTeamInfo(m, 'b');
                      const hexA = getJerseyHex(infoA.color);
                      const hexB = getJerseyHex(infoB.color);

                      return (
                        <View key={m.id} style={[dynamicStyles.card, { width: 155, borderRadius: 10, marginBottom: 10, padding: 8, borderWidth: 1, borderColor: p.color + '30' }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                               {infoA.logo ? (
                                  <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: hexA, overflow: 'hidden', backgroundColor: '#FFF' }}>
                                     <Image source={{ uri: infoA.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                                  </View>
                               ) : (
                                  <Ionicons name="shirt" size={12} color={hexA} />
                               )}
                               <Text style={[dynamicStyles.text, { fontSize: 10, fontWeight: isPlayed && m.team_a_score > m.team_b_score ? '900' : '500', flex: 1 }]} numberOfLines={2}>{infoA.name}</Text>
                            </View>
                            <Text style={[dynamicStyles.text, { fontSize: 11, fontWeight: '900', color: isPlayed ? p.color : dynamicStyles.text.color, marginLeft: 4 }]}>{isPlayed ? m.team_a_score : '-'}</Text>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                               {infoB.logo ? (
                                  <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: hexB, overflow: 'hidden', backgroundColor: '#FFF' }}>
                                     <Image source={{ uri: infoB.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                                  </View>
                               ) : (
                                  <Ionicons name="shirt" size={12} color={hexB} />
                               )}
                               <Text style={[dynamicStyles.text, { fontSize: 10, fontWeight: isPlayed && m.team_b_score > m.team_a_score ? '900' : '500', flex: 1 }]} numberOfLines={2}>{infoB.name}</Text>
                            </View>
                            <Text style={[dynamicStyles.text, { fontSize: 11, fontWeight: '900', color: isPlayed ? p.color : dynamicStyles.text.color, marginLeft: 4 }]}>{isPlayed ? m.team_b_score : '-'}</Text>
                          </View>

                          {/* Dettagli in condivisione */}
                          <View style={{ marginTop: 5, paddingTop: 4, borderTopWidth: 0.3, borderTopColor: isDarkMode ? '#444' : '#DDD', flexDirection: 'row', justifyContent: 'space-between' }}>
                             <Text style={{ fontSize: 7, color: '#8E8E93', fontWeight: '700' }}>
                                {new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} • {new Date(m.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                             </Text>
                             {m.location && <Text style={{ fontSize: 7, color: '#8E8E93', fontWeight: '700', maxWidth: 60 }} numberOfLines={1}>{m.location.toUpperCase()}</Text>}
                          </View>
                        </View>
                      );
                   })}
                 </View>
               ))}
             </View>

             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, gap: 8 }}>
                <Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '700' }]}>GENERATO CON EASYLIGA</Text>
                <View style={{ width: 20, height: 20, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
                </View>
             </View>
          </ViewShot>
        </View>
      </Modal>
    );
  };


  const renderPlayersSharePreview = () => {
    if (!sharingPlayersList) return null;

    // Ordinamento per ruolo e poi per forza decrescente
    const shareRoleOrder: Record<string, number> = { 'Portiere': 1, 'Difensore': 2, 'Mediana': 3, 'Attaccante': 4 };
    const sortedForShare = [...filteredPlayersList].sort((a, b) => {
      const oA = shareRoleOrder[a.role] || 99;
      const oB = shareRoleOrder[b.role] || 99;
      if (oA !== oB) return oA - oB;
      return b.strength - a.strength;
    });

    const half = Math.ceil(sortedForShare.length / 2);
    const leftCol = sortedForShare.slice(0, half);
    const rightCol = sortedForShare.slice(half);

    const renderPlayerCard = (item: any) => (
      <View key={item.id} style={{ width: '100%', backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF', marginBottom: 10, padding: 10, borderRadius: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 }}>
        <View style={[styles.pAvatar, { backgroundColor: ROLE_COLORS[item.role] + '15', width: 34, height: 34, borderRadius: 17 }]}>
          <Text style={[styles.pAvatarText, { color: ROLE_COLORS[item.role], fontSize: 12 }]}>{getInitials(item.nickname)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '800' }]} numberOfLines={1}>{item.nickname}</Text>
          <Text style={{ fontSize: 9, fontWeight: '700', color: ROLE_COLORS[item.role], marginTop: -1 }}>{item.role.toUpperCase()}</Text>
        </View>

        {/* Badge Anni / Forza */}
        <View style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 6, alignItems: 'center', borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }}>
           <View style={{ alignItems: 'center' }}>
              <Text style={[dynamicStyles.text, { fontSize: 11, fontWeight: '800' }]}>{item.age}</Text>
              <Text style={{ fontSize: 6, color: '#8E8E93', fontWeight: '800', marginTop: -2 }}>ANNI</Text>
           </View>
           <View style={{ width: 1, height: 12, backgroundColor: isDarkMode ? '#444' : '#CCC' }} />
           <View style={{ alignItems: 'center' }}>
              <Text style={[dynamicStyles.text, { fontSize: 11, fontWeight: '900' }]}>{item.strength}</Text>
              <Text style={{ fontSize: 6, color: '#8E8E93', fontWeight: '800', marginTop: -2 }}>FRZ</Text>
           </View>
        </View>
      </View>
    );

    return (
      <Modal visible={true} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <ViewShot ref={playersListViewShotRef} options={{ format: "png", quality: 1.0 }} style={{ width: 480, backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 25, borderRadius: 30 }}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                <View>
                  <Text style={[dynamicStyles.text, { fontSize: 28, fontWeight: '900', letterSpacing: 1 }]}>LISTA GIOCATORI</Text>
                  <Text style={[dynamicStyles.subText, { fontSize: 16, fontWeight: '700' }]}>{group?.name || 'Easyliga'}</Text>
                </View>
                <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 2, borderColor: '#007AFF' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
                </View>
             </View>

             <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ width: '49%' }}>
                   {leftCol.map(renderPlayerCard)}
                </View>
                <View style={{ width: '49%' }}>
                   {rightCol.map(renderPlayerCard)}
                </View>
             </View>

             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 30, gap: 10 }}>
                <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '800', letterSpacing: 1 }]}>GENERATO CON EASYLIGA</Text>
                <View style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#007AFF' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
                </View>
             </View>
          </ViewShot>
        </View>
      </Modal>
    );
  };





  const renderMatchesSharePreview = () => {
    if (!sharingMatchesList) return null;
    const isTournament = group?.group_type === 'tournament';
    let filteredMatches = [...matches];
    if (isTournament) {
      if (selectedGirone === 0) {
        filteredMatches = filteredMatches.filter(m => m.match_phase && m.match_phase !== 'group');
      } else {
        filteredMatches = filteredMatches.filter(m => {
          const isGroupPhase = !m.match_phase || m.match_phase === 'group';
          const mGroup = m.tournament_group || 1;
          return isGroupPhase && Number(mGroup) === Number(selectedGirone);
        });
      }
    }
    const sortedMatches = filteredMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
      <Modal visible={true} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <ViewShot ref={matchesListViewShotRef} options={{ format: "png", quality: 1.0 }} style={{ width: 380, backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 20, borderRadius: 30 }}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <View>
                  <Text style={[dynamicStyles.text, { fontSize: 22, fontWeight: '900', letterSpacing: 1 }]}>CALENDARIO MATCH</Text>
                  <Text style={[dynamicStyles.subText, { fontSize: 13, fontWeight: '700' }]}>
                    {selectedGirone === 0 ? 'FASE FINALE' : (group?.num_groups === 1 ? 'GIRONE UNICO' : `GIRONE ${selectedGirone}`)}
                  </Text>
                </View>
                <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 2, borderColor: '#007AFF' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 48, height: 48 }} resizeMode="contain" />
                </View>
             </View>

             <View>
                {sortedMatches.map((m, idx) => {
                  const infoA = getResolvedTeamInfo(m, 'a');
                  const infoB = getResolvedTeamInfo(m, 'b');
                  const hexA = getJerseyHex(infoA.color);
                  const hexB = getJerseyHex(infoB.color);
                  const isPlayed = m.status === 'played';

                  return (
                    <View key={m.id} style={{ marginBottom: 8, padding: 8, borderRadius: 12, backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF', borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                         <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <Text style={[dynamicStyles.text, { fontSize: 11, fontWeight: '800', marginRight: 6, textAlign: 'right', flexShrink: 1 }]}>{infoA.name}</Text>
                            <View style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              borderWidth: 1.5,
                              borderColor: hexA.toUpperCase() === '#FFFFFF' ? '#E5E5EA' : hexA,
                              overflow: 'hidden',
                              backgroundColor: hexA.toUpperCase() === '#FFFFFF' ? '#F2F2F7' : '#FFF',
                              justifyContent: 'center',
                              alignItems: 'center',
                              flexShrink: 0
                            }}>
                               {infoA.logo ? <Image source={{ uri: infoA.logo }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="shirt" size={12} color={hexA.toUpperCase() === '#FFFFFF' ? '#8E8E93' : hexA} />}
                            </View>
                         </View>


                         <View style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginHorizontal: 10, minWidth: 40, alignItems: 'center', borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }}>
                            <Text style={[dynamicStyles.text, { fontSize: 12, fontWeight: '900' }]}>
                               {isPlayed ? `${m.team_a_score}-${m.team_b_score}` : 'vs'}
                            </Text>
                         </View>

                         <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              borderWidth: 1.5,
                              borderColor: hexB.toUpperCase() === '#FFFFFF' ? '#E5E5EA' : hexB,
                              overflow: 'hidden',
                              backgroundColor: hexB.toUpperCase() === '#FFFFFF' ? '#F2F2F7' : '#FFF',
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginRight: 6,
                              flexShrink: 0
                            }}>
                               {infoB.logo ? <Image source={{ uri: infoB.logo }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="shirt" size={12} color={hexB.toUpperCase() === '#FFFFFF' ? '#8E8E93' : hexB} />}
                            </View>
                            <Text style={[dynamicStyles.text, { fontSize: 11, fontWeight: '800', flexShrink: 1 }]}>{infoB.name}</Text>
                         </View>

                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                         <Text style={{ fontSize: 8, color: '#8E8E93', fontWeight: '800' }}>
                            {new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} {new Date(m.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                         </Text>
                         {m.location && <Text style={{ fontSize: 8, color: '#8E8E93', fontWeight: '800' }}>• {m.location.toUpperCase()}</Text>}
                      </View>
                    </View>
                  );
                })}
             </View>

             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25, gap: 10 }}>
                <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '800', letterSpacing: 1 }]}>GENERATO CON EASYLIGA</Text>
                <View style={{ width: 26, height: 26, borderRadius: 13, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#007AFF' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 26, height: 26 }} resizeMode="contain" />
                </View>
             </View>
          </ViewShot>
        </View>
      </Modal>
    );
  };




  const renderTeamDetailsSharePreview = () => {
    if (!sharingTeamDetails) return null;
    const team = sharingTeamDetails;
    const teamHex = getJerseyHex(team.color);
    const teamPlayers = Object.entries(team.players || {})
      .map(([pid, stats]: any) => ({
        ...players.find(p => p.id === pid),
        ...stats,
        id: pid
      }))
      .filter(p => !!p.nickname)
      .sort((a, b) => {
        const orderA = roleOrder[a.role] || 99;
        const orderB = roleOrder[b.role] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return (b.goals || 0) - (a.goals || 0);
      });

    return (
      <Modal visible={true} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <ViewShot ref={teamDetailsViewShotRef} options={{ format: "png", quality: 1.0 }} style={{ width: 400, backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 20, borderRadius: 25 }}>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 }}>
                <View style={{
                  width: 60, height: 60, borderRadius: 30, overflow: 'hidden',
                  backgroundColor: teamHex.toUpperCase() === '#FFFFFF' ? '#F2F2F7' : '#FFF',
                  borderWidth: 2, borderColor: teamHex.toUpperCase() === '#FFFFFF' ? '#E5E5EA' : teamHex,
                  justifyContent: 'center', alignItems: 'center'
                }}>
                   {team.logo ? <Image source={{ uri: team.logo }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="shirt" size={32} color={teamHex.toUpperCase() === '#FFFFFF' ? '#8E8E93' : teamHex} />}
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={[dynamicStyles.text, { fontSize: 24, fontWeight: '900' }]}>{team.name.toUpperCase()}</Text>
                   <Text style={[dynamicStyles.subText, { fontSize: 13, fontWeight: '700' }]}>{group?.name || 'Easyliga'}</Text>
                </View>
             </View>

             <View style={{ backgroundColor: teamHex + '15', padding: 12, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, borderWidth: 1, borderColor: teamHex + '30' }}>
                <View style={{ alignItems: 'center' }}><Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900' }]}>{team.points}</Text><Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '700' }]}>PUNTI</Text></View>
                <View style={{ alignItems: 'center' }}><Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900' }]}>{team.played}</Text><Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '700' }]}>GIOCATE</Text></View>
                <View style={{ alignItems: 'center' }}><Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900', color: '#34C759' }]}>{team.won}</Text><Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '700' }]}>VINTE</Text></View>
                <View style={{ alignItems: 'center' }}><Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900', color: '#FF3B30' }]}>{team.lost}</Text><Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '700' }]}>PERSE</Text></View>
             </View>

             <View style={{ marginBottom: 10 }}><Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '800' }]}>ROSA SQUADRA</Text></View>
             <View>
                {teamPlayers.map((item: any) => (
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: isDarkMode ? '#333' : '#EEE' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '700' }]}>{item.nickname}</Text>
                      <Text style={{ fontSize: 9, color: ROLE_COLORS[item.role] || '#8E8E93', fontWeight: '800' }}>{item.role?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 15 }}>
                       <View style={{ width: 25, alignItems: 'center' }}><Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '900', color: '#FF3B30' }]}>{item.goals || 0}</Text></View>
                       <View style={{ width: 25, alignItems: 'center' }}><Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '900', color: '#34C759' }]}>{item.assists || 0}</Text></View>
                    </View>
                  </View>
                ))}
             </View>

             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25, gap: 10 }}>
                <Text style={[dynamicStyles.subText, { fontSize: 10, fontWeight: '800', letterSpacing: 1 }]}>GENERATO CON EASYLIGA</Text>
                <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#007AFF' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />
                </View>
             </View>
          </ViewShot>
        </View>
      </Modal>
    );
  };


  const renderCareerSettingsModal = () => {
    return (
      <Modal visible={showCareerSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { maxHeight: '90%', paddingBottom: 15, borderTopLeftRadius: 30, borderTopRightRadius: 30 }]}>
            <View style={[styles.modalHeader, { marginBottom: 10 }]}>
              <View>
                <Text style={[styles.modalTitle, dynamicStyles.text]}>Gestione Carriera</Text>
                <Text style={[dynamicStyles.subText, { fontSize: 11 }]}>Configura l'impatto dei tornei collegati</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCareerSettings(false)} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={28} color={isDarkMode ? "#AAA" : "#8E8E93"} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} style={{ paddingHorizontal: 15 }}>
              <View style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', borderRadius: 16, padding: 12, gap: 12, marginBottom: 15 }}>

                {/* Toggle Importazione */}
                <View style={[styles.bonusRow, { marginBottom: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '700' }]}>Attiva Importazione</Text>
                    <Text style={[dynamicStyles.subText, { fontSize: 11 }]}>Include goal/assist dei tornei.</Text>
                  </View>
                  <Switch
                    scaleX={1.0} scaleY={1.0}
                    trackColor={{ false: '#767577', true: '#5856D6' }}
                    thumbColor="#FFF"
                    value={group?.import_linked_data}
                    onValueChange={(v) => handleUpdateGroupSettings({ import_linked_data: v })}
                  />
                </View>

                <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, opacity: 0.2 }]} />

                {/* Peso Partite */}
                <View>
                  <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '700' }]}>Valore Partite Torneo</Text>
                  <Text style={[dynamicStyles.subText, { fontSize: 10, marginBottom: 8 }]}>Quante partite master vale 1 di torneo.</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => handleUpdateGroupSettings({ tournament_match_weight: Math.max(1, (group?.tournament_match_weight || 1) - 0.5) })}
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="remove" size={20} color="#007AFF" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, alignItems: 'center', backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF', paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#444' : '#DDD' }}>
                      <Text style={[dynamicStyles.text, { fontSize: 22, fontWeight: '900' }]}>{group?.tournament_match_weight || 1}</Text>
                      <Text style={{ fontSize: 8, fontWeight: '700', color: '#8E8E93' }}>PESO</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleUpdateGroupSettings({ tournament_match_weight: (group?.tournament_match_weight || 1) + 0.5 })}
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="add" size={20} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, opacity: 0.2 }]} />

                {/* Bonus Vittoria */}
                <View>
                  <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '700' }]}>Punti Bonus Posizioni</Text>
                  <Text style={[dynamicStyles.subText, { fontSize: 10, marginBottom: 8 }]}>Punti extra in classifica master per i primi 4.</Text>

                  {/* 1° e 2° Posto */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFD60A20', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="trophy" size={16} color="#FFD60A" />
                      </View>
                      <TextInput
                        style={[styles.scoreInput, dynamicStyles.input, { flex: 1, height: 34, fontSize: 14, fontWeight: '800', textAlign: 'center', borderRadius: 8, borderWidth: 1 }]}
                        keyboardType="numeric"
                        placeholder="1°"
                        value={String(group?.tournament_win_bonus || 0)}
                        onChangeText={(v) => handleUpdateGroupSettings({ tournament_win_bonus: parseInt(v) || 0 })}
                      />
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#C0C0C020', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="trophy" size={16} color="#C0C0C0" />
                      </View>
                      <TextInput
                        style={[styles.scoreInput, dynamicStyles.input, { flex: 1, height: 34, fontSize: 14, fontWeight: '800', textAlign: 'center', borderRadius: 8, borderWidth: 1 }]}
                        keyboardType="numeric"
                        placeholder="2°"
                        value={String(group?.tournament_2nd_bonus || 0)}
                        onChangeText={(v) => handleUpdateGroupSettings({ tournament_2nd_bonus: parseInt(v) || 0 })}
                      />
                    </View>
                  </View>

                  {/* 3° e 4° Posto */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#CD7F3220', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="trophy" size={16} color="#CD7F32" />
                      </View>
                      <TextInput
                        style={[styles.scoreInput, dynamicStyles.input, { flex: 1, height: 34, fontSize: 14, fontWeight: '800', textAlign: 'center', borderRadius: 8, borderWidth: 1 }]}
                        keyboardType="numeric"
                        placeholder="3°"
                        value={String(group?.tournament_3rd_bonus || 0)}
                        onChangeText={(v) => handleUpdateGroupSettings({ tournament_3rd_bonus: parseInt(v) || 0 })}
                      />
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#8E8E9320', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="medal-outline" size={16} color="#8E8E93" />
                      </View>
                      <TextInput
                        style={[styles.scoreInput, dynamicStyles.input, { flex: 1, height: 34, fontSize: 14, fontWeight: '800', textAlign: 'center', borderRadius: 8, borderWidth: 1 }]}
                        keyboardType="numeric"
                        placeholder="4°"
                        value={String(group?.tournament_4th_bonus || 0)}
                        onChangeText={(v) => handleUpdateGroupSettings({ tournament_4th_bonus: parseInt(v) || 0 })}
                      />
                    </View>
                  </View>

                  {/* Vincitore Girone */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#34C75920', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="flag-outline" size={16} color="#34C759" />
                      </View>
                      <TextInput
                        style={[styles.scoreInput, dynamicStyles.input, { flex: 1, height: 34, fontSize: 14, fontWeight: '800', textAlign: 'center', borderRadius: 8, borderWidth: 1 }]}
                        keyboardType="numeric"
                        placeholder="0"
                        value={String(group?.tournament_group_winner_bonus || 0)}
                        onChangeText={(v) => handleUpdateGroupSettings({ tournament_group_winner_bonus: parseInt(v) || 0 })}
                      />
                    </View>
                    <View style={{ flex: 1.5 }}>
                       <Text style={[dynamicStyles.subText, { fontSize: 10 }]}>Bonus Vincitore Girone</Text>
                    </View>
                  </View>

                  {/* Top Scorer e Top Assist */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF3B3020', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="football" size={16} color="#FF3B30" />
                      </View>
                      <TextInput
                        style={[styles.scoreInput, dynamicStyles.input, { flex: 1, height: 34, fontSize: 14, fontWeight: '800', textAlign: 'center', borderRadius: 8, borderWidth: 1 }]}
                        keyboardType="numeric"
                        placeholder="0"
                        value={String(group?.tournament_top_scorer_bonus || 0)}
                        onChangeText={(v) => handleUpdateGroupSettings({ tournament_top_scorer_bonus: parseInt(v) || 0 })}
                      />
                      <Text style={[dynamicStyles.subText, { fontSize: 9 }]}>Marc.</Text>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#007AFF20', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="hand-right-outline" size={16} color="#007AFF" />
                      </View>
                      <TextInput
                        style={[styles.scoreInput, dynamicStyles.input, { flex: 1, height: 34, fontSize: 14, fontWeight: '800', textAlign: 'center', borderRadius: 8, borderWidth: 1 }]}
                        keyboardType="numeric"
                        placeholder="0"
                        value={String(group?.tournament_top_assistant_bonus || 0)}
                        onChangeText={(v) => handleUpdateGroupSettings({ tournament_top_assistant_bonus: parseInt(v) || 0 })}
                      />
                      <Text style={[dynamicStyles.subText, { fontSize: 9 }]}>Assist</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, opacity: 0.2 }]} />

                {/* Tornei Collegati */}
                <View>
                  <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '700', marginBottom: 8 }]}>Tornei Collegati</Text>
                  <View style={{ backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF', borderRadius: 12, padding: 8, gap: 5, borderWidth: 1, borderColor: isDarkMode ? '#444' : '#EEE' }}>
                    {group?.linked_group_ids && group.linked_group_ids.length > 0 ? (
                      group.linked_group_ids.map(lid => {
                        const lg = allGroups.find(g => g.id === lid);
                        const displayName = lg?.name || resolvedGroupNames[lid] || 'Caricamento...';
                        return (
                          <View key={lid} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' }}>
                            <Text style={[dynamicStyles.text, { fontSize: 12, fontWeight: '600', flex: 1 }]} numberOfLines={1}>{displayName}</Text>
                            <TouchableOpacity onPress={() => {
                              const newLinks = group.linked_group_ids?.filter(id => id !== lid) || [];
                              handleUpdateGroupSettings({ linked_group_ids: newLinks });
                            }}>
                              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={[dynamicStyles.subText, { fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginVertical: 5 }]}>Nessun torneo collegato</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => setShowLinkModal(true)}
                      style={{ backgroundColor: '#007AFF', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 5, flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    >
                      <Ionicons name="add-circle" size={18} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>COLLEGA NUOVO</Text>
                    </TouchableOpacity>
                  </View>
                </View>

              </View>

              <TouchableOpacity
                onPress={() => setShowCareerSettings(false)}
                style={[styles.saveBtn, { height: 46, borderRadius: 12, backgroundColor: '#5856D6', marginBottom: 20 }]}
              >
                <Text style={[styles.saveBtnText, { fontSize: 15 }]}>SALVA E CHIUDI</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };


  const renderTeamDetailsModal = () => {
    if (!showTeamDetails) return null;
    const team = showTeamDetails;
    const teamHex = getJerseyHex(team.color);

    const teamPlayers = Object.entries(team.players || {})
      .map(([pid, stats]: any) => ({
        ...players.find(p => p.id === pid),
        ...stats,
        id: pid
      }))
      .filter(p => !!p.nickname)
      .sort((a, b) => {
        const orderA = roleOrder[a.role] || 99;
        const orderB = roleOrder[b.role] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return (b.goals || 0) - (a.goals || 0);
      });

    return (
      <Modal visible={true} transparent animationType="slide" onRequestClose={() => setShowTeamDetails(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '95%', borderTopLeftRadius: 25, borderTopRightRadius: 25 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, flex: 1 }}>
                <TouchableOpacity
                  disabled={!isAdminOrOwner}
                  onPress={() => isAdminOrOwner && handlePickLogo('global')}
                  style={[styles.jerseyBadge, { backgroundColor: teamHex, borderWidth: teamHex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6', width: 60, height: 60, borderRadius: 30, overflow: 'hidden' }]}
                >
                  {team.logo ? (
                    <Image source={{ uri: team.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  ) : (
                    <Ionicons name="shirt" size={32} color={getJerseyTextColor(team.color)} />
                  )}
                  {isAdminOrOwner && (
                    <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#007AFF', padding: 4, borderRadius: 10 }}>
                      <Ionicons name="camera" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    disabled={!isAdminOrOwner}
                    onPress={() => {
                      setTempTeamName(team.name);
                      setShowNameEditor('global');
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}
                  >
                    <Text style={[styles.modalTitle, dynamicStyles.text, { fontSize: 18, flexShrink: 1 }]} numberOfLines={1}>{team.name.toUpperCase()}</Text>
                    {isAdminOrOwner && <Ionicons name="pencil-outline" size={14} color="#8E8E93" />}
                  </TouchableOpacity>

                  {isAdminOrOwner && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                      {JERSEY_COLORS.map(c => (
                        <TouchableOpacity
                          key={c.value}
                          onPress={() => updateTeamColor('global', c.value)}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: c.hex,
                            marginRight: 10,
                            borderWidth: team.color === c.value ? 2.5 : 1,
                            borderColor: team.color === c.value ? '#007AFF' : (isDarkMode ? '#444' : '#D1D1D6'),
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}
                        >
                          {team.color === c.value && <Ionicons name="checkmark" size={14} color={getJerseyTextColor(c.value)} />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => handleShareTeamDetails(team)} style={{ padding: 4 }}>
                   <Ionicons name="share-social-outline" size={26} color="#34C759" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTeamDetails(null)}>
                  <Ionicons name="close" size={28} color={dynamicStyles.text.color} />
                </TouchableOpacity>
              </View>

            </View>

            <View style={{ backgroundColor: teamHex + '15', padding: 12, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 }}>
               <View style={{ alignItems: 'center' }}><Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900' }]}>{team.points}</Text><Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '700' }]}>PUNTI</Text></View>
               <View style={{ alignItems: 'center' }}><Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900' }]}>{team.played}</Text><Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '700' }]}>GIOCATE</Text></View>
               <View style={{ alignItems: 'center' }}><Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900', color: '#34C759' }]}>{team.won}</Text><Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '700' }]}>VINTE</Text></View>
               <View style={{ alignItems: 'center' }}><Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900', color: '#FF3B30' }]}>{team.lost}</Text><Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '700' }]}>PERSE</Text></View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 5 }}>
              <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '800' }]}>ROSA E STATISTICHE</Text>
              {isAdminOrOwner && (
                <TouchableOpacity
                  onPress={() => setShowPlayerSelector(true)}
                  style={{ backgroundColor: '#007AFF20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name="person-add" size={14} color="#007AFF" />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#007AFF' }}>AGGIUNGI</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.pCard, dynamicStyles.card, { backgroundColor: 'transparent', borderBottomWidth: 1, paddingVertical: 8, borderRadius: 0 }]}>
               <Text style={[dynamicStyles.subText, { flex: 1, fontSize: 10, fontWeight: '900' }]}>GIOCATORE</Text>
               <View style={{ flexDirection: 'row', gap: 20 }}>
                  <Text style={[dynamicStyles.subText, { width: 30, textAlign: 'center', fontSize: 10, fontWeight: '900' }]}>G</Text>
                  <Text style={[dynamicStyles.subText, { width: 30, textAlign: 'center', fontSize: 10, fontWeight: '900' }]}>A</Text>
               </View>
            </View>

            <FlatList
              data={teamPlayers}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <View style={[styles.pCard, dynamicStyles.card, { paddingHorizontal: 5, paddingVertical: 8, borderRadius: 0, borderBottomWidth: 0.5 }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                       {isAdminOrOwner && (
                         <TouchableOpacity
                           onPress={() => {
                             Alert.alert(
                               "Rimuovi Giocatore",
                               `Vuoi rimuovere ${item.nickname} da questa squadra?`,
                               [
                                 { text: "Annulla", style: "cancel" },
                                 { text: "Rimuovi", style: "destructive", onPress: () => handleUpdateTeamPlayersGlobal(team.name, item.id, 'remove') }
                               ]
                             );
                           }}
                           style={{ padding: 2 }}
                         >
                           <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                         </TouchableOpacity>
                       )}
                       <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '700' }]}>{item.nickname}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: ROLE_COLORS[item.role] || '#8E8E93', fontWeight: '700', marginLeft: isAdminOrOwner ? 24 : 0 }}>{item.role?.toUpperCase() || '--'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <View style={{ width: 30, alignItems: 'center' }}>
                      <Text style={[dynamicStyles.text, { fontSize: 16, fontWeight: '900', color: '#FF3B30' }]}>{item.goals || 0}</Text>
                    </View>
                    <View style={{ width: 30, alignItems: 'center' }}>
                      <Text style={[dynamicStyles.text, { fontSize: 16, fontWeight: '900', color: '#34C759' }]}>{item.assists || 0}</Text>
                    </View>
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    );
  };


  const renderPodium = () => {
    const final = matches.find(m => m.match_phase === 'final');
    const thirdPlace = matches.find(m => m.match_phase === 'third_place');

    if (!final || final.status !== 'played') return null;

    const podium: any[] = [];
    // 1° e 2° posto
    const sA = Number(final.team_a_score || 0), sB = Number(final.team_b_score || 0);
    const pA = Number(final.team_a_penalties || 0), pB = Number(final.team_b_penalties || 0);
    const aWins = sA > sB || (sA === sB && pA > pB);

    podium.push({ pos: 1, name: aWins ? final.team_a_name : final.team_b_name, color: aWins ? final.team_a_color : final.team_b_color, logo: aWins ? final.team_a_logo : final.team_b_logo, icon: 'ribbon', iconColor: '#FFD60A' });
    podium.push({ pos: 2, name: aWins ? final.team_b_name : final.team_a_name, color: aWins ? final.team_b_color : final.team_a_color, logo: aWins ? final.team_b_logo : final.team_a_logo, icon: 'ribbon', iconColor: '#C0C0C0' });

    // 3° e 4° posto
    if (thirdPlace && thirdPlace.status === 'played') {
      const tsA = Number(thirdPlace.team_a_score || 0), tsB = Number(thirdPlace.team_b_score || 0);
      const tpA = Number(thirdPlace.team_a_penalties || 0), tpB = Number(thirdPlace.team_b_penalties || 0);
      const taWins = tsA > tsB || (tsA === tsB && tpA > tpB);

      podium.push({ pos: 3, name: taWins ? thirdPlace.team_a_name : thirdPlace.team_b_name, color: taWins ? thirdPlace.team_a_color : thirdPlace.team_b_color, logo: taWins ? thirdPlace.team_a_logo : thirdPlace.team_b_logo, icon: 'ribbon', iconColor: '#CD7F32' });
      podium.push({ pos: 4, name: taWins ? thirdPlace.team_b_name : thirdPlace.team_a_name, color: taWins ? thirdPlace.team_b_color : thirdPlace.team_a_color, logo: taWins ? thirdPlace.team_b_logo : thirdPlace.team_a_logo, icon: 'medal-outline', iconColor: '#8E8E93' });
    } else {
      // Fallback manuale
      if (group?.tournament_3rd_team_name) {
        const tName = group.tournament_3rd_team_name;
        const m = matches.find(x => x.team_a_name === tName || x.team_b_name === tName);
        const isA = m?.team_a_name === tName;
        podium.push({ pos: 3, name: tName, color: (isA ? m?.team_a_color : m?.team_b_color) || 'Grigia', logo: isA ? m?.team_a_logo : m?.team_b_logo, icon: 'ribbon', iconColor: '#CD7F32' });
      }
      if (group?.tournament_4th_team_name) {
        const tName = group.tournament_4th_team_name;
        const m = matches.find(x => x.team_a_name === tName || x.team_b_name === tName);
        const isA = m?.team_a_name === tName;
        podium.push({ pos: 4, name: tName, color: (isA ? m?.team_a_color : m?.team_b_color) || 'Grigia', logo: isA ? m?.team_a_logo : m?.team_b_logo, icon: 'medal-outline', iconColor: '#8E8E93' });
      }
    }

    return (
      <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
        <View style={[dynamicStyles.card, { borderRadius: 20, padding: 15, borderWidth: 2, borderColor: '#FFD60A40' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="trophy" size={24} color="#FFD60A" />
              <Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900' }]}>PODIO FINALE</Text>
            </View>
            {isAdminOrOwner && (
              <TouchableOpacity
                onPress={() => setShowPodiumSelector('3rd')}
                style={{ backgroundColor: '#007AFF20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
              >
                 <Text style={{ color: '#007AFF', fontSize: 11, fontWeight: '800' }}>EDIT 3°/4°</Text>
              </TouchableOpacity>
            )}
          </View>
          {podium.map((team, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: idx < podium.length - 1 ? 0.5 : 0, borderBottomColor: dynamicStyles.divider.backgroundColor }}>
              <View style={{ width: 30, alignItems: 'center' }}>
                <Ionicons name={team.icon as any} size={22} color={team.iconColor} />
              </View>
              <Text style={[dynamicStyles.text, { width: 25, fontSize: 16, fontWeight: '900', marginLeft: 5 }]}>{team.pos}°</Text>
              <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: getJerseyHex(team.color), overflow: 'hidden', backgroundColor: '#FFF', marginHorizontal: 10, justifyContent: 'center', alignItems: 'center' }}>
                {team.logo ? <Image source={{ uri: team.logo }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="shirt" size={18} color={getJerseyHex(team.color)} />}
              </View>
              <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '800', flex: 1 }]} numberOfLines={1}>{team.name.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderPodiumSelectorModal = () => {
    if (!showPodiumSelector) return null;
    const allTournamentTeams = Array.from(new Set(matches.flatMap(m => [m.team_a_name, m.team_b_name]))).filter(Boolean).sort();

    return (
      <Modal visible={true} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowPodiumSelector(null)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Scegli Squadra {showPodiumSelector === '3rd' ? '3° Posto' : '4° Posto'}</Text>
              <TouchableOpacity onPress={() => setShowPodiumSelector(null)}>
                <Ionicons name="close" size={24} color={dynamicStyles.text.color} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {allTournamentTeams.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.pCard, dynamicStyles.card, { marginVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: (showPodiumSelector === '3rd' ? group?.tournament_3rd_team_name === t : group?.tournament_4th_team_name === t) ? '#007AFF' : (isDarkMode ? '#3A3A3C' : '#E5E5EA') }]}
                  onPress={() => {
                    if (showPodiumSelector === '3rd') {
                      handleUpdateGroupSettings({ tournament_3rd_team_name: t });
                      setShowPodiumSelector('4th');
                    } else {
                      handleUpdateGroupSettings({ tournament_4th_team_name: t });
                      setShowPodiumSelector(null);
                    }
                  }}
                >
                  <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '700', flex: 1 }]}>{t}</Text>
                  {(showPodiumSelector === '3rd' ? group?.tournament_3rd_team_name === t : group?.tournament_4th_team_name === t) && <Ionicons name="checkmark-circle" size={24} color="#007AFF" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderTournamentStandings = () => {
    const teamStatsMap: Record<string, any> = {};

    // Identifichiamo quali posizioni si qualificano basandoci sul tabellone esistente
    const knockoutMatches = matches.filter(m => m.match_phase && m.match_phase !== 'group');
    const qualifiedSlots = new Set<string>();
    knockoutMatches.forEach(m => {
      if (m.team_a_placeholder) qualifiedSlots.add(m.team_a_placeholder);
      if (m.team_b_placeholder) qualifiedSlots.add(m.team_b_placeholder);
    });

    // Filtriamo le partite per il girone selezionato in modo robusto
    const gironeMatches = matches.filter(m => {
      const isGroupPhase = !m.match_phase || m.match_phase === 'group';
      const mGroup = m.tournament_group || 1;
      return isGroupPhase && Number(mGroup) === Number(selectedGirone);
    });

    // 0. Inizializzazione di tutte le squadre presenti nel calendario del girone selezionato
    gironeMatches.forEach(m => {
      const initTeam = (name: string, color: string, logo?: string) => {
        if (!teamStatsMap[name]) {
          teamStatsMap[name] = { name, points: 0, played: 0, won: 0, drawn: 0, lost: 0, g_for: 0, g_against: 0, color, logo, players: {} };
        } else {
          if (!teamStatsMap[name].logo && logo) teamStatsMap[name].logo = logo;
        }
      };

      initTeam(m.team_a_name, m.team_a_color, m.team_a_logo);
      initTeam(m.team_b_name, m.team_b_color, m.team_b_logo);

      // Inizializziamo la lista giocatori della squadra anche dalle partite programmate
      m.team_a_players.forEach(pid => {
        if (!teamStatsMap[m.team_a_name].players[pid]) teamStatsMap[m.team_a_name].players[pid] = { goals: 0, assists: 0 };
      });
      m.team_b_players.forEach(pid => {
        if (!teamStatsMap[m.team_b_name].players[pid]) teamStatsMap[m.team_b_name].players[pid] = { goals: 0, assists: 0 };
      });
    });

    // 1. Aggregazione Risultati e Statistiche Giocatori per Squadra (solo partite giocate del girone)
    gironeMatches.filter(m => m.status === 'played' || m.status === undefined).forEach(m => {
      const nameA = m.team_a_name;
      const nameB = m.team_b_name;

      const statsA = teamStatsMap[nameA];
      const statsB = teamStatsMap[nameB];

      // Aggregazione Squadra
      statsA.played++; statsB.played++;
      statsA.g_for += (m.team_a_score || 0); statsA.g_against += (m.team_b_score || 0);
      statsB.g_for += (m.team_b_score || 0); statsB.g_against += (m.team_a_score || 0);

      if (m.team_a_score > m.team_b_score) { statsA.won++; statsA.points += (group?.points_win ?? 3); statsB.lost++; }
      else if (m.team_b_score > m.team_a_score) { statsB.won++; statsB.points += (group?.points_win ?? 3); statsA.lost++; }
      else { statsA.drawn++; statsB.drawn++; statsA.points += (group?.points_draw ?? 1); statsB.points += (group?.points_draw ?? 1); }

      // Aggregazione Giocatori Squadra A
      m.team_a_players.forEach(pid => {
        if (!statsA.players[pid]) statsA.players[pid] = { goals: 0, assists: 0 };
        statsA.players[pid].goals += (m.goals?.[pid] || 0);
        statsA.players[pid].assists += (m.assists?.[pid] || 0);
      });
      // Aggregazione Giocatori Squadra B
      m.team_b_players.forEach(pid => {
        if (!statsB.players[pid]) statsB.players[pid] = { goals: 0, assists: 0 };
        statsB.players[pid].goals += (m.goals?.[pid] || 0);
        statsB.players[pid].assists += (m.assists?.[pid] || 0);
      });
    });

    const sortedTeams = Object.values(teamStatsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;

      // 1. Scontro diretto
      const h2hMatches = matches.filter(m =>
        (m.status === 'played' || m.status === undefined) &&
        ((m.team_a_name === a.name && m.team_b_name === b.name) ||
         (m.team_a_name === b.name && m.team_b_name === a.name))
      );

      let aH2hPoints = 0;
      let bH2hPoints = 0;
      h2hMatches.forEach(m => {
        if (m.team_a_name === a.name) {
          if (m.team_a_score > m.team_b_score) aH2hPoints += (group?.points_win ?? 3);
          else if (m.team_a_score < m.team_b_score) bH2hPoints += (group?.points_win ?? 3);
          else { aH2hPoints += (group?.points_draw ?? 1); bH2hPoints += (group?.points_draw ?? 1); }
        } else {
          if (m.team_a_score > m.team_b_score) bH2hPoints += (group?.points_win ?? 3);
          else if (m.team_a_score < m.team_b_score) aH2hPoints += (group?.points_win ?? 3);
          else { aH2hPoints += (group?.points_draw ?? 1); bH2hPoints += (group?.points_draw ?? 1); }
        }
      });
      if (aH2hPoints !== bH2hPoints) return bH2hPoints - aH2hPoints;

      // 2. Differenza Goal (DG)
      const dgA = a.g_for - a.g_against;
      const dgB = b.g_for - b.g_against;
      if (dgB !== dgA) return dgB - dgA;

      // 3. Goal Fatti (GF)
      return b.g_for - a.g_for;
    });

    const renderTournamentHeaderFixed = () => (
      <View style={[styles.pCard, dynamicStyles.card, { height: 45, borderBottomWidth: 2, paddingVertical: 0, borderRightWidth: 1, borderRightColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', justifyContent: 'center' }]}>
         <View style={{ width: 150 }}><Text style={{ fontSize: 10, fontWeight: '900', color: '#8E8E93', marginLeft: 5 }}>POS. SQUADRA</Text></View>
      </View>
    );

    const renderTournamentHeaderScrollable = () => (
      <View style={[styles.pCard, dynamicStyles.card, { height: 45, borderBottomWidth: 2, paddingVertical: 0, justifyContent: 'center' }]}>
         <View style={{ flexDirection: 'row', gap: 12, paddingRight: 20 }}>
            <StatHeader label="PTI" width={35} color="#34C759" />
            <StatHeader label="G" width={25} />
            <StatHeader label="V" width={25} />
            <StatHeader label="N" width={25} />
            <StatHeader label="P" width={25} />
            <StatHeader label="GF" width={25} color="#34C759" />
            <StatHeader label="GS" width={25} color="#FF3B30" />
            <StatHeader label="DG" width={25} color="#007AFF" />
         </View>
      </View>
    );

    const renderTournamentRowFixed = (item: any, index: number) => {
      const isQualified = qualifiedSlots.has(`${index + 1}-G${selectedGirone}`);
      const teamHex = getJerseyHex(item.color);

      return (
        <TouchableOpacity
          key={item.name + "_fixed"}
          style={[styles.pCard, dynamicStyles.card, { height: 55, paddingVertical: 0, borderBottomWidth: 1, borderRightWidth: 1, borderRightColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', justifyContent: 'center' }]}
          onPress={() => setShowTeamDetails(item)}
        >
          <View style={{ width: 150, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: isQualified ? '#007AFF20' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 6,
              borderWidth: isQualified ? 1 : 0,
              borderColor: '#007AFF'
            }}>
              <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '900', color: isQualified ? '#007AFF' : dynamicStyles.text.color }]}>{index + 1}</Text>
            </View>

            <View style={{ position: 'relative', marginRight: 8 }}>
              {item.logo ? (
                <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: teamHex, overflow: 'hidden', backgroundColor: '#FFF' }}>
                  <Image source={{ uri: item.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
              ) : (
                <Ionicons
                  name="shirt"
                  size={22}
                  color={teamHex}
                  style={[
                    teamHex.toLowerCase() === '#ffffff' && {
                      textShadowColor: 'rgba(0,0,0,0.5)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2
                    }
                  ]}
                />
              )}
            </View>

            <Text style={[dynamicStyles.text, { fontSize: 12, fontWeight: '900', flex: 1 }]} numberOfLines={1}>{item.name.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      );
    };

    const renderTournamentRowScrollable = (item: any) => (
      <TouchableOpacity
        key={item.name + "_stats"}
        style={[styles.pCard, dynamicStyles.card, { height: 55, paddingVertical: 0, borderBottomWidth: 1, justifyContent: 'center' }]}
        onPress={() => setShowTeamDetails(item)}
      >
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingRight: 20 }}>
           <View style={{ backgroundColor: isDarkMode ? 'rgba(52, 199, 89, 0.2)' : 'rgba(52, 199, 89, 0.1)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, minWidth: 35, alignItems: 'center' }}>
              <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '900', color: '#34C759' }]}>{item.points}</Text>
           </View>
           <StatValue value={item.played} width={25} bold={false} />
           <StatValue value={item.won} width={25} bold={false} />
           <StatValue value={item.drawn} width={25} bold={false} />
           <StatValue value={item.lost} width={25} bold={false} />
           <StatValue value={item.g_for} width={25} color="#34C759" bold={true} />
           <StatValue value={item.g_against} width={25} color="#FF3B30" bold={true} />
           <StatValue value={item.g_for - item.g_against} width={25} color="#007AFF" bold={true} />
        </View>
      </TouchableOpacity>
    );

    const hasKnockout = matches.some(m => m.match_phase && m.match_phase !== 'group');

    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, marginBottom: 12, marginTop: 8, flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.gironeHeader, { backgroundColor: getGironeColor(selectedGirone), flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12 }]}
            onPress={() => setShowGironeSelector(true)}
          >
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>
              {selectedGirone === 0 ? 'FASE ELIMINATORIA' : (group?.num_groups === 1 ? 'GIRONE UNICO' : `GIRONE ${selectedGirone}`)}
            </Text>
            <Ionicons name="chevron-down" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={selectedGirone === 0 ? handleShareBracket : handleShareTournamentStandings}
            style={{ width: 50, backgroundColor: '#34C759', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-social-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {selectedGirone === 0 ? (
          <ScrollView style={{ flex: 1 }}>
            {renderPodium()}
            {renderBracket()}
          </ScrollView>
        ) : (

          <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} />}>
              <View style={{ flexDirection: 'row' }}>
                <View>
                   {renderTournamentHeaderFixed()}
                   {sortedTeams.map((item, index) => renderTournamentRowFixed(item, index))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                   <View>
                      {renderTournamentHeaderScrollable()}
                      {sortedTeams.map(renderTournamentRowScrollable)}
                   </View>
                </ScrollView>
              </View>
            </ScrollView>

            {isAdminOrOwner && group?.group_type === 'tournament' && matches.length > 0 && !hasKnockout && (
              <TouchableOpacity
                style={[styles.mainShareBtn, { backgroundColor: '#5856D6', marginBottom: 20, marginTop: 10 }]}
                onPress={handleGenerateKnockout}
              >
                <Ionicons name="trophy-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Crea Fase Eliminatoria</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };


  const renderImportPlayersModal = () => {
    const otherGroups = allGroups.filter(g => g.id !== groupId);

    const handleImportFromGroup = async (sourceGroupId: string) => {
      try {
        setImportingPlayers(true);
        const sourcePlayers = await fetchPlayers({ group_id: sourceGroupId });
        const currentPlayers = players;
        const currentNicks = new Set(currentPlayers.map(p => p.nickname.toLowerCase().trim()));

        let importedCount = 0;
        for (const p of sourcePlayers) {
          if (!currentNicks.has(p.nickname.toLowerCase().trim())) {
            await savePlayer({
              id: p.id, // MANTENIAMO LO STESSO ID PER FAR PARLARE CAMPIONATO E TORNEO
              nickname: p.nickname,
              role: p.role,
              strength: p.strength,
              date_of_birth: p.date_of_birth,
              name: p.name,
              surname: p.surname,
              group_id: groupId as string
            });
            importedCount++;
          }
        }

        Alert.alert('Importazione Completata', `${importedCount} nuovi giocatori importati correttamente.`);
        loadData();
        setShowImportPlayersModal(false);
      } catch (e: any) {
        Alert.alert('Errore', 'Importazione fallita: ' + e.message);
      } finally {
        setImportingPlayers(false);
      }
    };

    return (
      <Modal visible={showImportPlayersModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => !importingPlayers && setShowImportPlayersModal(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Importa Giocatori</Text>
              <TouchableOpacity onPress={() => !importingPlayers && setShowImportPlayersModal(false)}>
                <Ionicons name="close" size={24} color={dynamicStyles.text.color} />
              </TouchableOpacity>
            </View>
            <Text style={[dynamicStyles.subText, { fontSize: 13, marginBottom: 15, paddingHorizontal: 10 }]}>
              Scegli un gruppo da cui copiare l'elenco dei giocatori in questo torneo. I duplicati (stesso nickname) verranno saltati.
            </Text>
            {importingPlayers ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={[dynamicStyles.text, { marginTop: 15, fontWeight: '700' }]}>Importazione in corso...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {otherGroups.length > 0 ? otherGroups.map(g => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.pCard, dynamicStyles.card, { marginVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }]}
                    onPress={() => handleImportFromGroup(g.id)}
                  >
                    <View style={[styles.groupIcon, { backgroundColor: g.group_type === 'tournament' ? '#5856D620' : '#007AFF20', width: 34, height: 34, borderRadius: 10, marginRight: 10 }]}>
                      <Ionicons name={g.group_type === 'tournament' ? "apps-outline" : "trophy-outline"} size={18} color={g.group_type === 'tournament' ? "#5856D6" : "#007AFF"} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '700' }]}>{g.name}</Text>
                      <Text style={[dynamicStyles.subText, { fontSize: 11 }]}>{g.player_count} giocatori • {g.group_type === 'tournament' ? 'Torneo' : 'Campionato'}</Text>
                    </View>
                    <Ionicons name="download-outline" size={22} color="#34C759" />
                  </TouchableOpacity>
                )) : (
                  <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Ionicons name="alert-circle-outline" size={48} color="#8E8E93" />
                    <Text style={[dynamicStyles.subText, { textAlign: 'center', marginTop: 10 }]}>Nessun altro gruppo trovato.</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    );
  };


  const renderTieBreakerSelectorModal = () => {
    if (!showTieBreakerSelector) return null;
    const { num } = showTieBreakerSelector;
    const options = [
      { id: 'ratio', label: 'Media Punti Partita', icon: 'stats-chart-outline' },
      { id: 'incisivity', label: 'Incisività', icon: 'flash-outline' },
      { id: 'goals', label: 'Goal', icon: 'football-outline' },
      { id: 'assists', label: 'Assist', icon: 'hand-left-outline' },
      { id: 'played', label: 'Partite Giocate', icon: 'calendar-outline' },
      { id: 'bonus', label: 'Bonus', icon: 'gift-outline' },
    ];

    return (
      <Modal visible={!!showTieBreakerSelector} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowTieBreakerSelector(null)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '55%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Scegli {num}° Criterio</Text>
              <TouchableOpacity onPress={() => setShowTieBreakerSelector(null)}>
                <Ionicons name="close" size={24} color={dynamicStyles.text.color} />
              </TouchableOpacity>
            </View>
            <Text style={[dynamicStyles.subText, { fontSize: 13, marginBottom: 15, paddingHorizontal: 10 }]}>
              Seleziona il parametro da usare in caso di parità di punti:
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.pCard, dynamicStyles.card, { marginVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: (num === 1 ? group?.tie_breaker_1 === opt.id : group?.tie_breaker_2 === opt.id) ? '#007AFF' : (isDarkMode ? '#3A3A3C' : '#E5E5EA') }]}
                  onPress={() => {
                    handleUpdateGroupSettings(num === 1 ? { tie_breaker_1: opt.id } : { tie_breaker_2: opt.id });
                    setShowTieBreakerSelector(null);
                  }}
                >
                  <View style={[styles.groupIcon, { backgroundColor: '#007AFF20', width: 34, height: 34, borderRadius: 10, marginRight: 10 }]}>
                    <Ionicons name={opt.icon as any} size={18} color="#007AFF" />
                  </View>
                  <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '700', flex: 1 }]}>{opt.label}</Text>
                  {(num === 1 ? group?.tie_breaker_1 === opt.id : group?.tie_breaker_2 === opt.id) && <Ionicons name="checkmark-circle" size={24} color="#007AFF" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderLinkModal = () => {
    const availableToLink = allGroups.filter(g =>
      g.id !== groupId &&
      g.group_type === 'tournament' &&
      !(group?.linked_group_ids || []).includes(g.id)
    );

    return (
      <Modal visible={showLinkModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowLinkModal(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Collega Torneo</Text>
              <TouchableOpacity onPress={() => setShowLinkModal(false)}>
                <Ionicons name="close" size={24} color={dynamicStyles.text.color} />
              </TouchableOpacity>
            </View>
            <Text style={[dynamicStyles.subText, { fontSize: 13, marginBottom: 15, paddingHorizontal: 10 }]}>
              Seleziona un torneo per includere i suoi goal e assist nelle statistiche di questo campionato.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {availableToLink.length > 0 ? availableToLink.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.pCard, dynamicStyles.card, { marginVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }]}
                  onPress={() => {
                    const newLinks = [...(group?.linked_group_ids || []), g.id];
                    handleUpdateGroupSettings({ linked_group_ids: newLinks });
                    setShowLinkModal(false);
                  }}
                >
                  <View style={[styles.groupIcon, { backgroundColor: '#5856D620', width: 34, height: 34, borderRadius: 10, marginRight: 10 }]}>
                    <Ionicons name="apps-outline" size={18} color="#5856D6" />
                  </View>
                  <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '700', flex: 1 }]}>{g.name}</Text>
                  <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
              )) : (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Ionicons name="alert-circle-outline" size={48} color="#8E8E93" />
                  <Text style={[dynamicStyles.subText, { textAlign: 'center', marginTop: 10 }]}>Nessun torneo disponibile da collegare.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };


  const renderMatchSharePreview = () => {
    if (!sharingMatch) return null;
    const m = sharingMatch;
    const teamAHex = getJerseyHex(m.team_a_color);
    const teamBHex = getJerseyHex(m.team_b_color);

    const teamAPlayers = players.filter(p => m.team_a_players.map(x => String(x).trim()).includes(String(p.id).trim()));
    const teamBPlayers = players.filter(p => m.team_b_players.map(x => String(x).trim()).includes(String(p.id).trim()));

    return (
      <Modal visible={true} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <ViewShot ref={matchViewShotRef} options={{ format: "png", quality: 1.0 }} style={{ width: '95%', backgroundColor: isDarkMode ? '#111111' : '#F8F9FF', padding: 20, borderRadius: 24 }}>
             <View style={{ marginBottom: 25, backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: isDarkMode ? '#333' : '#E5E5EA' }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                 <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FF3B30', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 }}>MATCH RESULT</Text>
                    <Text style={[styles.teamsDescText, { color: isDarkMode ? '#FFFFFF' : '#1C1C1E', fontSize: 22, marginBottom: 4 }]}>{m.description || 'Risultato Partita'}</Text>
                    <View style={styles.teamsDateTimeLoc}>
                      <Text style={[styles.teamsMetaText, { color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 13, fontWeight: '600' }]}>
                        📅 {new Date(m.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}
                      </Text>
                      <Text style={[styles.teamsMetaText, { color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 13, fontWeight: '600' }]}>
                        🕒 ore {new Date(m.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  <View style={{ width: 70, height: 70, borderRadius: 35, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 2, borderColor: '#FF3B30', marginLeft: 10, marginTop: -10 }}>
                    <Image source={require('../../assets/images/icon.png')} style={{ width: 70, height: 70 }} resizeMode="contain" />
                  </View>
                </View>
                {m.location ? (
                  <Text style={[styles.teamsMetaText, { color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 13, fontWeight: '600', marginTop: 6 }]}>
                    📍 {m.location}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.teamCard, dynamicStyles.card, { borderLeftWidth: 0, borderWidth: 2, borderColor: teamAHex, marginBottom: 12, padding: 12, zIndex: 1 }]}>
                 <View style={[styles.teamHeader, { marginBottom: 12 }]}>
                    <View style={[styles.jerseyBadge, { backgroundColor: teamAHex, borderWidth: teamAHex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6', width: 34, height: 34, borderRadius: 17, overflow: 'hidden' }]}>
                      {m.team_a_logo ? (
                        <Image source={{ uri: m.team_a_logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      ) : (
                        <Ionicons
                          name="shirt"
                          size={18}
                          color={getJerseyTextColor(m.team_a_color)}
                          style={teamAHex === '#FFFFFF' ? {
                            textShadowColor: 'rgba(0,0,0,0.5)',
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 2
                          } : {}}
                        />
                      )}
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={[styles.teamName, dynamicStyles.text, { fontSize: 17 }]}>{m.team_a_name}</Text>
                    </View>
                    <Text style={[dynamicStyles.text, { fontSize: 28, fontWeight: '900' }]}>{m.team_a_score}</Text>
                 </View>
                  <View style={{ flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#333' : '#E5E5EA', marginBottom: 4, alignItems: 'center' }}>
                    <View style={{ flex: 1 }} />
                    <View style={{ width: 35, alignItems: 'center' }}><Ionicons name="football" size={12} color="#8E8E93" /></View>
                    <View style={{ width: 35, alignItems: 'center' }}><Ionicons name="people-outline" size={12} color="#8E8E93" /></View>
                    <View style={{ width: 35, alignItems: 'center' }}><Ionicons name="medal-outline" size={12} color="#8E8E93" /></View>
                  </View>
                  {teamAPlayers.map(p => (
                    <View key={p.id} style={[styles.teamPlayerRow, { paddingVertical: 3 }]}>
                      <View style={[styles.tpInfo, { marginLeft: 0 }]}><Text style={[styles.tpName, dynamicStyles.text, { fontSize: 14 }]}>{p.nickname}</Text></View>
                      <View style={{ flexDirection: 'row', gap: 0 }}>
                        <View style={{ width: 35, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                         {(m.goals?.[p.id] || 0) > 0 && (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                             <Ionicons name="football" size={14} color="#FF3B30" />
                             <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '800' }}>{m.goals![p.id]}</Text>
                           </View>
                         )}
                        </View>
                        <View style={{ width: 35, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                         {(m.assists?.[p.id] || 0) > 0 && (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                             <Ionicons name="people-outline" size={14} color="#34C759" />
                             <Text style={{ color: '#34C759', fontSize: 13, fontWeight: '800' }}>{m.assists![p.id]}</Text>
                           </View>
                         )}
                        </View>
                        <View style={{ width: 35, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                         {(() => {
                           const pG = m.goals?.[p.id] || 0;
                           const pA = m.assists?.[p.id] || 0;
                           const isTeamA = m.team_a_players.map(x => String(x).trim()).includes(String(p.id).trim());
                           const goalsSuffered = isTeamA ? m.team_b_score : m.team_a_score;
                           const isCleanSheet = goalsSuffered === 0;

                           let matchBonus = 0;
                           if (group?.use_bonus && pG >= (group.bonus_goals_threshold || 2) && pA >= (group.bonus_assists_threshold || 2)) matchBonus++;
                           if (group?.use_gk_bonus && p.role === 'Portiere' && goalsSuffered < (group.gk_bonus_threshold || 5)) matchBonus++;
                           if (group?.use_clean_sheet_bonus && isCleanSheet) matchBonus++;

                           if (matchBonus > 0) {
                             return (
                               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                 <Ionicons name="medal-outline" size={14} color="#5AC8FA" />
                                 <Text style={{ color: '#5AC8FA', fontSize: 13, fontWeight: '800' }}>{matchBonus}</Text>
                               </View>
                             );
                           }
                           return null;
                         })()}
                        </View>
                      </View>
                    </View>
                  ))}
                  {m.team_a_own_goals > 0 && (
                    <View style={[styles.teamPlayerRow, { paddingVertical: 2, opacity: 0.7 }]}>
                      <View style={{ flex: 1 }} />
                      <Text style={[dynamicStyles.subText, { fontSize: 11, fontStyle: 'italic' }]}>{m.team_a_own_goals} Autorete/i</Text>
                    </View>
                  )}
              </View>

              <View style={{ alignItems: 'center', marginTop: -32, marginBottom: 8, zIndex: 10, elevation: 10 }}>
                <View style={{ backgroundColor: '#FF3B30', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: isDarkMode ? '#111111' : '#F8F9FF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 }}>
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 12 }}>VS</Text>
                </View>
              </View>

              <View style={[styles.teamCard, dynamicStyles.card, { borderLeftWidth: 0, borderWidth: 2, borderColor: teamBHex, padding: 12 }]}>
                 <View style={[styles.teamHeader, { marginBottom: 12 }]}>
                    <View style={[styles.jerseyBadge, { backgroundColor: teamBHex, borderWidth: teamBHex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6', width: 34, height: 34, borderRadius: 17, overflow: 'hidden' }]}>
                      {m.team_b_logo ? (
                        <Image source={{ uri: m.team_b_logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      ) : (
                        <Ionicons
                          name="shirt"
                          size={18}
                          color={getJerseyTextColor(m.team_b_color)}
                          style={teamBHex === '#FFFFFF' ? {
                            textShadowColor: 'rgba(0,0,0,0.5)',
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 2
                          } : {}}
                        />
                      )}
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={[styles.teamName, dynamicStyles.text, { fontSize: 17 }]}>{m.team_b_name}</Text>
                    </View>
                    <Text style={[dynamicStyles.text, { fontSize: 28, fontWeight: '900' }]}>{m.team_b_score}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#333' : '#E5E5EA', marginBottom: 4, alignItems: 'center' }}>
                    <View style={{ flex: 1 }} />
                    <View style={{ width: 35, alignItems: 'center' }}><Ionicons name="football" size={12} color="#8E8E93" /></View>
                    <View style={{ width: 35, alignItems: 'center' }}><Ionicons name="people-outline" size={12} color="#8E8E93" /></View>
                    <View style={{ width: 35, alignItems: 'center' }}><Ionicons name="medal-outline" size={12} color="#8E8E93" /></View>
                  </View>
                  {teamBPlayers.map(p => (
                    <View key={p.id} style={[styles.teamPlayerRow, { paddingVertical: 3 }]}>
                      <View style={[styles.tpInfo, { marginLeft: 0 }]}><Text style={[styles.tpName, dynamicStyles.text, { fontSize: 14 }]}>{p.nickname}</Text></View>
                      <View style={{ flexDirection: 'row', gap: 0 }}>
                        <View style={{ width: 35, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                         {(m.goals?.[p.id] || 0) > 0 && (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                             <Ionicons name="football" size={14} color="#FF3B30" />
                             <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '800' }}>{m.goals![p.id]}</Text>
                           </View>
                         )}
                        </View>
                        <View style={{ width: 35, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                         {(m.assists?.[p.id] || 0) > 0 && (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                             <Ionicons name="people-outline" size={14} color="#34C759" />
                             <Text style={{ color: '#34C759', fontSize: 13, fontWeight: '800' }}>{m.assists![p.id]}</Text>
                           </View>
                         )}
                        </View>
                        <View style={{ width: 35, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                         {(() => {
                           const pG = m.goals?.[p.id] || 0;
                           const pA = m.assists?.[p.id] || 0;
                           const isTeamA = m.team_a_players.map(x => String(x).trim()).includes(String(p.id).trim());
                           const goalsSuffered = isTeamA ? m.team_b_score : m.team_a_score;
                           const isCleanSheet = goalsSuffered === 0;

                           let matchBonus = 0;
                           if (group?.use_bonus && pG >= (group.bonus_goals_threshold || 2) && pA >= (group.bonus_assists_threshold || 2)) matchBonus++;
                           if (group?.use_gk_bonus && p.role === 'Portiere' && goalsSuffered < (group.gk_bonus_threshold || 5)) matchBonus++;
                           if (group?.use_clean_sheet_bonus && isCleanSheet) matchBonus++;

                           if (matchBonus > 0) {
                             return (
                               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                 <Ionicons name="medal-outline" size={14} color="#5AC8FA" />
                                 <Text style={{ color: '#5AC8FA', fontSize: 13, fontWeight: '800' }}>{matchBonus}</Text>
                               </View>
                             );
                           }
                           return null;
                         })()}
                        </View>
                      </View>
                    </View>
                  ))}
                  {m.team_b_own_goals > 0 && (
                    <View style={[styles.teamPlayerRow, { paddingVertical: 2, opacity: 0.7 }]}>
                      <View style={{ flex: 1 }} />
                      <Text style={[dynamicStyles.subText, { fontSize: 11, fontStyle: 'italic' }]}>{m.team_b_own_goals} Autorete/i</Text>
                    </View>
                  )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, gap: 10 }}>
                <View style={{ height: 1, flex: 1, backgroundColor: isDarkMode ? '#333' : '#E5E5EA' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '800', letterSpacing: 1 }]}>GENERATO CON EASYLIGA</Text>
                  <View style={{ width: 18, height: 18, borderRadius: 9, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                    <Image source={require('../../assets/images/icon.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
                  </View>
                </View>
                <View style={{ height: 1, flex: 1, backgroundColor: isDarkMode ? '#333' : '#E5E5EA' }} />
              </View>
          </ViewShot>
        </View>
      </Modal>
    );
  };


  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} enabled={!teams}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => teams ? setTeams(null) : router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={isDarkMode ? "#FFF" : "#007AFF"} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, dynamicStyles.text]} numberOfLines={1}>{teams ? 'Squadre' : (group?.name || 'Gruppo')}</Text>
          <View style={styles.headerBtns}>
            {teams ? (
              <>
                <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
                  <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color={isDarkMode ? "#FFD60A" : "#007AFF"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleGenerate(false)} style={styles.iconBtn}>
                  <Ionicons name="refresh" size={22} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowIndividualStrength(!showIndividualStrength)} style={styles.iconBtn}>
                  <Ionicons name={showIndividualStrength ? "eye-outline" : "eye-off-outline"} size={22} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShareImage} style={styles.iconBtn} disabled={sharing}>
                  <Ionicons name="share-social-outline" size={22} color="#007AFF" />
                </TouchableOpacity>
                {isAdminOrOwner && group?.group_type !== 'tournament' && (
                  <TouchableOpacity onPress={() => handleOpenResultModal()} style={styles.iconBtn}>
                    <Ionicons name="trophy-outline" size={22} color="#FFD60A" />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {group?.storage_type === 'cloud' && (
                  <TouchableOpacity
                    onPress={() => loadData(true)}
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons
                        name="cloud"
                        size={36}
                        color={hasUnsyncedChanges ? "#FFD60A" : "#34C759"}
                        style={{ opacity: 0.9 }}
                      />
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingTop: 4 }}>
                        {syncStatus === 'syncing' ? (
                          <ActivityIndicator size="small" color={hasUnsyncedChanges ? "#000" : "#FFF"} />
                        ) : (
                          <Text style={{ fontSize: 7, fontWeight: '900', color: hasUnsyncedChanges ? "#000" : "#FFF", letterSpacing: 0.5 }}>SYNC</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
                  <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color={isDarkMode ? "#FFD60A" : "#007AFF"} />
                </TouchableOpacity>

                {activeTab === 'standings' && (
                  <TouchableOpacity onPress={handleShareStandings} style={styles.iconBtn}>
                    <Ionicons name="share-social-outline" size={24} color="#34C759" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => setShowConfig(!showConfig)} style={[styles.iconBtn, showConfig && { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
                  <Ionicons name="settings-outline" size={22} color="#007AFF" />
                </TouchableOpacity>

                {isAdminOrOwner && activeTab === 'players' && (
                  <TouchableOpacity style={styles.addBtn} onPress={() => router.push(`/player/add?groupId=${groupId}`)}>
                    <Ionicons name="add" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {teams ? renderTeamsResult() : (
          <View style={{ flex: 1 }}>
            {showConfig && (
              <View style={[styles.configContainer, dynamicStyles.card, { marginHorizontal: 20, marginBottom: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 }]}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                  <View style={styles.configSection}>

                    {/* SEZIONE CAMPIONATO */}
                    {group?.group_type !== 'tournament' && (
                      <>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={[dynamicStyles.card, { flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 8, borderWidth: 1 }]}>
                              {isAdminOrOwner && (
                                <TouchableOpacity
                                  onPress={() => {
                                    const newVal = Math.max(1, matchType - 1);
                                    setMatchType(newVal);
                                    handleUpdateGroupSettings({ match_type: newVal });
                                  }}
                                  style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="remove" size={18} color={isDarkMode ? "#FFF" : "#000"} />
                                </TouchableOpacity>
                              )}
                              <Text style={[dynamicStyles.text, { fontSize: 16, fontWeight: '800', minWidth: 30, textAlign: 'center' }]}>{matchType}</Text>
                              {isAdminOrOwner && (
                                <TouchableOpacity
                                  onPress={() => {
                                    const newVal = matchType + 1;
                                    setMatchType(newVal);
                                    handleUpdateGroupSettings({ match_type: newVal });
                                  }}
                                  style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="add" size={18} color={isDarkMode ? "#FFF" : "#000"} />
                                </TouchableOpacity>
                              )}
                            </View>
                            <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '800' }]}>{matchType} vs {matchType}</Text>
                          </View>
                        </View>

                        {isAdminOrOwner && (
                          <View style={{ flexDirection: 'row', gap: 15, marginBottom: 15 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 12, fontWeight: '700', marginBottom: 4 }]}>Punti Vittoria</Text>
                              <TextInput
                                style={[styles.scoreInput, dynamicStyles.input, { height: 40, fontSize: 16, fontWeight: '800', textAlign: 'center', borderRadius: 8 }]}
                                keyboardType="numeric"
                                value={String(group?.points_win ?? 3)}
                                onChangeText={(v) => handleUpdateGroupSettings({ points_win: parseInt(v) || 0 })}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 12, fontWeight: '700', marginBottom: 4 }]}>Punti Pareggio</Text>
                              <TextInput
                                style={[styles.scoreInput, dynamicStyles.input, { height: 40, fontSize: 16, fontWeight: '800', textAlign: 'center', borderRadius: 8 }]}
                                keyboardType="numeric"
                                value={String(group?.points_draw ?? 1)}
                                onChangeText={(v) => handleUpdateGroupSettings({ points_draw: parseInt(v) || 0 })}
                              />
                            </View>
                          </View>
                        )}

                        {isAdminOrOwner && (
                          <View style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', borderRadius: 12, padding: 12, gap: 10, marginBottom: 20 }}>
                            <TouchableOpacity
                              onPress={() => setShowCareerSettings(true)}
                              style={{
                                backgroundColor: isDarkMode ? '#2C2C2E' : '#F8F9FF',
                                borderRadius: 16,
                                padding: 18,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderWidth: 1,
                                borderColor: '#5856D640',
                                marginTop: 10,
                                marginBottom: 15
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#5856D615', alignItems: 'center', justifyContent: 'center' }}>
                                  <Ionicons name="stats-chart" size={24} color="#5856D6" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[dynamicStyles.text, { fontSize: 16, fontWeight: '800' }]}>Gestione Carriera</Text>
                                  <Text style={[dynamicStyles.subText, { fontSize: 11, marginTop: 1 }]} numberOfLines={2}>
                                    Importazione e Bonus dai Tornei
                                  </Text>
                                </View>
                              </View>
                              <Ionicons name="chevron-forward" size={22} color="#5856D6" />
                            </TouchableOpacity>
                            <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, opacity: 0.3 }]} />
                            <View>
                              <View style={styles.bonusRow}>
                                <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '600' }]}>Bonus Giocatore (Combo)</Text>
                                <Switch scaleX={1.1} scaleY={1.1} trackColor={{ false: '#767577', true: '#34C759' }} thumbColor="#FFF" value={group?.use_bonus} onValueChange={(v) => handleUpdateGroupSettings({ use_bonus: v })} />
                              </View>
                              {group?.use_bonus && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 }}>
                                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '600' }]}>Goal ≥</Text>
                                    <TextInput
                                      style={[styles.scoreInput, dynamicStyles.input, { flex: 1, height: 30, fontSize: 13, fontWeight: '700', textAlign: 'center', padding: 0, borderRadius: 6 }]}
                                      keyboardType="numeric"
                                      value={String(group?.bonus_goals_threshold ?? 2)}
                                      onChangeText={(v) => handleUpdateGroupSettings({ bonus_goals_threshold: parseInt(v) || 0 })}
                                    />
                                  </View>
                                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '600' }]}>Assist ≥</Text>
                                    <TextInput
                                      style={[styles.scoreInput, dynamicStyles.input, { flex: 1, height: 30, fontSize: 13, fontWeight: '700', textAlign: 'center', padding: 0, borderRadius: 6 }]}
                                      keyboardType="numeric"
                                      value={String(group?.bonus_assists_threshold ?? 2)}
                                      onChangeText={(v) => handleUpdateGroupSettings({ bonus_assists_threshold: parseInt(v) || 0 })}
                                    />
                                  </View>
                                </View>
                              )}
                            </View>
                            <View>
                              <View style={styles.bonusRow}>
                                <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '600' }]}>Bonus Difesa</Text>
                                <Switch
                                  scaleX={1.1}
                                  scaleY={1.1}
                                  trackColor={{ false: '#767577', true: '#34C759' }}
                                  thumbColor="#FFF"
                                  value={group?.use_gk_bonus}
                                  onValueChange={(v) => handleUpdateGroupSettings({ use_gk_bonus: v })}
                                />
                              </View>
                              {group?.use_gk_bonus && (
                                <View style={{ marginTop: 5 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '600' }]}>Goal Subiti {'<'}</Text>
                                    <TextInput
                                      style={[styles.scoreInput, dynamicStyles.input, { width: 40, height: 30, fontSize: 13, fontWeight: '700', textAlign: 'center', padding: 0, borderRadius: 6 }]}
                                      keyboardType="numeric"
                                      value={String(group?.gk_bonus_threshold ?? 5)}
                                      onChangeText={(v) => handleUpdateGroupSettings({ gk_bonus_threshold: parseInt(v) || 0 })}
                                    />
                                  </View>

                                  {/* Selezione Ruoli */}
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                                    {['Portiere', 'Difensore', 'Mediana', 'Attaccante'].map(r => {
                                      const excludedList = Array.isArray(group?.gk_bonus_excluded_roles) ? group.gk_bonus_excluded_roles : [];
                                      const isExcluded = excludedList.includes(r);
                                      const roleCol = (ROLE_COLORS as any)[r] || '#8E8E93';

                                      return (
                                        <TouchableOpacity
                                          key={r}
                                          onPress={() => {
                                            // Toggle: se è escluso lo tolgo (torna attivo), se non è escluso lo aggiungo (diventa spento)
                                            const next = isExcluded ? excludedList.filter(x => x !== r) : [...excludedList, r];
                                            handleUpdateGroupSettings({ gk_bonus_excluded_roles: next });
                                          }}
                                          style={{
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderRadius: 6,
                                            borderWidth: 1,
                                            borderColor: isExcluded ? (isDarkMode ? '#3A3A3C' : '#E5E5EA') : roleCol,
                                            backgroundColor: isExcluded ? 'transparent' : roleCol + '15'
                                          }}
                                        >
                                          <Text style={{ fontSize: 9, fontWeight: '800', color: isExcluded ? '#8E8E93' : roleCol }}>{r.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>


                                  <Text style={[dynamicStyles.subText, { fontSize: 10, marginTop: 4, fontStyle: 'italic' }]}>
                                    Seleziona i ruoli che POSSONO ricevere il bonus.
                                  </Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.bonusRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '700' }]}>Bilanciamento</Text>
                                <Text style={[dynamicStyles.subText, { fontSize: 11 }]}>Attiva solo il bonus più alto tra Personale e Difesa.</Text>
                              </View>
                              <Switch
                                scaleX={1.1}
                                scaleY={1.1}
                                trackColor={{ false: '#767577', true: '#FF9500' }}
                                thumbColor="#FFF"
                                value={group?.use_balance_bonus}
                                onValueChange={(v) => handleUpdateGroupSettings({ use_balance_bonus: v })}
                              />
                            </View>

                            <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, opacity: 0.3, marginVertical: 8 }]} />

                            <View style={styles.bonusRow}>
                              <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '600' }]}>Bonus Clean Sheet</Text>
                              <Switch scaleX={1.1} scaleY={1.1} trackColor={{ false: '#767577', true: '#34C759' }} thumbColor="#FFF" value={group?.use_clean_sheet_bonus} onValueChange={(v) => handleUpdateGroupSettings({ use_clean_sheet_bonus: v })} />
                            </View>




                            <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, opacity: 0.3, marginVertical: 8 }]} />

                            <View>
                              <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '700', marginBottom: 12, color: '#8E8E93' }]}>CRITERI PARITÀ PUNTI (ORDINE)</Text>


                              <View style={{ gap: 10 }}>
                                {[1, 2].map((num) => {
                                  const currentId = num === 1 ? (group?.tie_breaker_1 || 'ratio') : (group?.tie_breaker_2 || 'incisivity');
                                  const options = [
                                    { id: 'ratio', label: 'Media Punti Partita' },
                                    { id: 'played', label: 'Partite Giocate' },
                                    { id: 'goals', label: 'Goal' },
                                    { id: 'assists', label: 'Assist' },
                                    { id: 'bonus', label: 'Bonus' },
                                    { id: 'incisivity', label: 'Incisività' },
                                  ];
                                  const currentLabel = options.find(o => o.id === currentId)?.label || 'Seleziona';

                                  return (
                                    <View key={num} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{num}</Text>
                                      </View>
                                      <TouchableOpacity
                                        onPress={() => setShowTieBreakerSelector({ num })}
                                        style={[dynamicStyles.input, { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, justifyContent: 'space-between' }]}
                                      >
                                        <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '600' }]}>{currentLabel}</Text>
                                        <Ionicons name="chevron-down" size={18} color="#8E8E93" />
                                      </TouchableOpacity>
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          </View>
                        )}
                      </>
                    )}

                    {/* SEZIONE TORNEO */}
                    {group?.group_type === 'tournament' && (
                      <>
                        <View style={{ marginBottom: 15 }}>
                          <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 13, marginBottom: 8 }]}>Giocatori per squadra</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={[dynamicStyles.card, { flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 10, borderWidth: 1 }]}>
                              {isAdminOrOwner && (
                                <TouchableOpacity
                                  onPress={() => {
                                    const newVal = Math.max(1, matchType - 1);
                                    setMatchType(newVal);
                                    handleUpdateGroupSettings({ match_type: newVal });
                                  }}
                                  style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="remove" size={20} color={isDarkMode ? "#FFF" : "#000"} />
                                </TouchableOpacity>
                              )}
                              <Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900', minWidth: 40, textAlign: 'center' }]}>{matchType}</Text>
                              {isAdminOrOwner && (
                                <TouchableOpacity
                                  onPress={() => {
                                    const newVal = matchType + 1;
                                    setMatchType(newVal);
                                    handleUpdateGroupSettings({ match_type: newVal });
                                  }}
                                  style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="add" size={20} color={isDarkMode ? "#FFF" : "#000"} />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>

                        <View style={{ marginBottom: 15 }}>
                          <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 13, marginBottom: 8 }]}>Numero Squadre</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={[dynamicStyles.card, { flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 10, borderWidth: 1 }]}>
                              {isAdminOrOwner && (
                                <TouchableOpacity
                                  onPress={() => {
                                    const newVal = Math.max(3, numTeams - 1);
                                    setNumTeams(newVal);
                                    // Se le squadre scendono sotto 6, forza 1 solo gruppo
                                    const finalGroups = newVal < 6 ? 1 : numGroups;
                                    setNumGroups(finalGroups);
                                    handleUpdateGroupSettings({ num_teams: newVal, num_groups: finalGroups });
                                  }}
                                  style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="remove" size={20} color={isDarkMode ? "#FFF" : "#000"} />
                                </TouchableOpacity>
                              )}
                              <Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900', minWidth: 40, textAlign: 'center' }]}>{numTeams}</Text>
                              {isAdminOrOwner && (
                                <TouchableOpacity
                                  onPress={() => {
                                    const newVal = numTeams + 1;
                                    setNumTeams(newVal);
                                    handleUpdateGroupSettings({ num_teams: newVal });
                                  }}
                                  style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="add" size={20} color={isDarkMode ? "#FFF" : "#000"} />
                                </TouchableOpacity>
                              )}
                            </View>
                            <Text style={[dynamicStyles.text, { fontSize: 16, fontWeight: '800', opacity: 0.7 }]}>Squadre Totali</Text>
                          </View>
                        </View>

                        <View style={{ marginBottom: 20 }}>
                          <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 13, marginBottom: 8 }]}>Giocatori</Text>
                          <TouchableOpacity
                            onPress={() => setShowImportPlayersModal(true)}
                            style={{ backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: isDarkMode ? '#444' : '#E5E5EA' }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Ionicons name="people-outline" size={20} color="#007AFF" />
                              <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '700' }]}>Importa da altro gruppo</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
                          </TouchableOpacity>
                        </View>

                        <View style={{ marginBottom: 20 }}>
                          <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 13, marginBottom: 8 }]}>Numero Gironi</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={[dynamicStyles.card, { flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 10, borderWidth: 1 }]}>
                              {isAdminOrOwner && (
                                <TouchableOpacity
                                  onPress={() => {
                                    const newVal = Math.max(1, numGroups - 1);
                                    setNumGroups(newVal);
                                    handleUpdateGroupSettings({ num_groups: newVal });
                                  }}
                                  style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="remove" size={20} color={isDarkMode ? "#FFF" : "#000"} />
                                </TouchableOpacity>
                              )}
                              <Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900', minWidth: 40, textAlign: 'center' }]}>{numGroups}</Text>
                              {isAdminOrOwner && (
                                <TouchableOpacity
                                  onPress={() => {
                                    if (numTeams < 6 && numGroups >= 1) {
                                      Alert.alert("Torneo Sbilanciato", "Hai bisogno di almeno 6 squadre per creare 2 gironi.");
                                      return;
                                    }
                                    const newVal = numGroups + 1;
                                    setNumGroups(newVal);
                                    handleUpdateGroupSettings({ num_groups: newVal });
                                  }}
                                  style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="add" size={20} color={isDarkMode ? "#FFF" : "#000"} />
                                </TouchableOpacity>
                              )}
                            </View>
                            <Text style={[dynamicStyles.text, { fontSize: 16, fontWeight: '800', opacity: 0.7 }]}>Gironi</Text>
                          </View>
                        </View>

                        {isAdminOrOwner && (
                          <View style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', borderRadius: 12, padding: 12, gap: 10, marginBottom: 20 }}>
                            <View style={styles.bonusRow}>
                              <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '600' }]}>Marcatori</Text>
                              <Switch scaleX={1.1} scaleY={1.1} trackColor={{ false: '#767577', true: '#34C759' }} thumbColor="#FFF" value={group?.show_scorers} onValueChange={(v) => handleUpdateGroupSettings({ show_scorers: v })} />
                            </View>
                            <View style={styles.bonusRow}>
                              <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '600' }]}>Assist</Text>
                              <Switch scaleX={1.1} scaleY={1.1} trackColor={{ false: '#767577', true: '#34C759' }} thumbColor="#FFF" value={group?.show_assists} onValueChange={(v) => handleUpdateGroupSettings({ show_assists: v })} />
                            </View>
                          </View>
                        )}
                      </>
                    )}

                    {/* AZIONI COMUNI (Backup, Token, Dati) */}



                    <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 14, fontWeight: '700', marginBottom: 10 }]}>Backup ed Excel</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#007AFF', height: 40, borderRadius: 8, flexDirection: 'row' }]} onPress={handleExportPlayers}><Ionicons name="download-outline" size={16} color="#FFF" style={{marginRight: 6}}/><Text style={[styles.saveBtnText, {fontSize: 13, fontWeight: '700'}]}>Esporta</Text></TouchableOpacity>
                      {isAdminOrOwner && (
                        <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#34C759', height: 40, borderRadius: 8, flexDirection: 'row' }]} onPress={handleImportPlayers}><Ionicons name="arrow-up-outline" size={16} color="#FFF" style={{marginRight: 6}}/><Text style={[styles.saveBtnText, {fontSize: 13, fontWeight: '700'}]}>Importa</Text></TouchableOpacity>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                      <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#8E8E93', height: 40, borderRadius: 8, flexDirection: 'row' }]} onPress={handleCreateGroupBackup}><Ionicons name="copy-outline" size={16} color="#FFF" style={{marginRight: 6}}/><Text style={[styles.saveBtnText, {fontSize: 13, fontWeight: '700'}]}>Backup</Text></TouchableOpacity>
                      {isAdminOrOwner && (
                        <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#FF9500', height: 40, borderRadius: 8, flexDirection: 'row' }]} onPress={handleRestoreGroupBackup}><Ionicons name="refresh-outline" size={16} color="#FFF" style={{marginRight: 6}}/><Text style={[styles.saveBtnText, {fontSize: 13, fontWeight: '700'}]}>Ripristina</Text></TouchableOpacity>
                      )}
                    </View>

                    {group?.group_type === 'tournament' && isAdminOrOwner && (
                      <View style={{ marginBottom: 20, gap: 10 }}>
                        <TouchableOpacity
                          style={[styles.saveBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#007AFF', height: 40, borderRadius: 8, flexDirection: 'row' }]}
                          onPress={handleResetTournamentResults}
                        >
                          <Ionicons name="refresh-circle-outline" size={16} color="#007AFF" style={{ marginRight: 6 }} />
                          <Text style={[styles.saveBtnText, { fontSize: 13, fontWeight: '700', color: '#007AFF' }]}>RESET RISULTATI TORNEO</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.saveBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF3B30', height: 40, borderRadius: 8, flexDirection: 'row' }]}
                          onPress={handleResetTournament}
                        >
                          <Ionicons name="reload-outline" size={16} color="#FF3B30" style={{ marginRight: 6 }} />
                          <Text style={[styles.saveBtnText, { fontSize: 13, fontWeight: '700', color: '#FF3B30' }]}>RESET TORNEO</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 14, fontWeight: '700', marginBottom: 10 }]}>Token Accesso</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {group?.role === 'owner' && <TouchableOpacity style={[styles.tokenBtn, { flex: 1, backgroundColor: '#5856D6', height: 35, borderRadius: 6 }]} onPress={() => handleShareToken('owner')}><Text style={[styles.tokenBtnText, {fontSize: 12}]}>Owner</Text></TouchableOpacity>}
                      {(group?.role === 'owner' || group?.role === 'admin') && <TouchableOpacity style={[styles.tokenBtn, { flex: 1, backgroundColor: '#007AFF', height: 35, borderRadius: 6 }]} onPress={() => handleShareToken('admin')}><Text style={[styles.tokenBtnText, {fontSize: 12}]}>Admin</Text></TouchableOpacity>}
                      <TouchableOpacity style={[styles.tokenBtn, { flex: 1, backgroundColor: '#8E8E93', height: 35, borderRadius: 6 }]} onPress={() => handleShareToken('viewer')}><Text style={[styles.tokenBtnText, {fontSize: 12}]}>Viewer</Text></TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={[styles.tabsWrapper, { marginBottom: 8 }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
                <View style={{ flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }}>
                  {(() => {
                    const tabs = [];
                    const isTournament = group?.group_type === 'tournament';
                    const hasMatches = matches.length > 0;

                    if (isTournament && hasMatches) {
                      tabs.push({ id: 'standings', icon: 'person', label: 'Individuali' });
                    } else {
                      tabs.push({ id: 'teams', icon: 'flash', label: 'Genera' });
                    }

                    if (isTournament) {
                      tabs.push({ id: 'tournament_standings', icon: 'trophy', label: 'Torneo' });
                    } else {
                      tabs.push({ id: 'standings', icon: 'trophy', label: 'Classifica' });
                    }

                    tabs.push({ id: 'matches', icon: 'list', label: 'Risultati' });

                    return tabs.map((t, i) => (
                      <TouchableOpacity
                        key={t.id}
                        style={{
                          paddingHorizontal: 12,
                          height: 46,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: activeTab === t.id ? '#007AFF' : (isDarkMode ? '#2C2C2E' : '#FFFFFF'),
                          borderLeftWidth: i === 0 ? 0 : 1,
                          borderLeftColor: isDarkMode ? '#3A3A3C' : '#E5E5EA',
                          minWidth: isTournament ? 90 : 105
                        }}
                        onPress={() => setActiveTab(activeTab === t.id ? 'players' : t.id as any)}
                      >
                        <Ionicons
                          name={(t as any).icon}
                          size={16}
                          color={activeTab === t.id ? '#FFFFFF' : (isDarkMode ? '#AEAEB2' : '#8E8E93')}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: '900',
                            color: activeTab === t.id ? '#FFFFFF' : (isDarkMode ? '#AEAEB2' : '#8E8E93'),
                            textTransform: 'uppercase'
                          }}
                          numberOfLines={1}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ));
                  })()}
                </View>
              </ScrollView>
            </View>

            {activeTab === 'players' && (
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8, paddingRight: 10 }}>
                  <View style={[styles.searchContainer, dynamicStyles.card, { flex: 1, marginHorizontal: 0, borderRadius: 0, borderLeftWidth: 0, borderRightWidth: 0 }]}>
                    <Ionicons name="search" size={20} color="#8E8E93" style={{ marginLeft: 16, marginRight: 8 }} />
                    <TextInput
                      style={[styles.searchInput, dynamicStyles.text]}
                      placeholder="Cerca giocatore..."
                      placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"}
                      value={search}
                      onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                      <TouchableOpacity onPress={() => setSearch('')} style={{ paddingHorizontal: 12 }}>
                        <Ionicons name="close-circle" size={20} color="#8E8E93" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={handleSharePlayersList}
                    style={{ width: 44, height: 40, backgroundColor: '#34C759', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 10 }}
                  >
                    <Ionicons name="share-social-outline" size={22} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <View style={{ paddingHorizontal: 12 }}>

                  {renderRoleFilter(selectedRole, setSelectedRole)}
                </View>
                <FlatList
                  data={filteredPlayersList}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={[styles.pCard, dynamicStyles.card]} onPress={() => router.push(`/player/${item.id}?groupId=${groupId}`)}>
                      <View style={[styles.pAvatar, { backgroundColor: ROLE_COLORS[item.role] + '20', width: 34, height: 34 }]}>
                        <Text style={[styles.pAvatarText, { color: ROLE_COLORS[item.role], fontSize: 14 }]}>{getInitials(item.nickname)}</Text>
                      </View>
                      <View style={styles.pInfo}>
                        <Text style={[styles.pNickname, dynamicStyles.text, { fontSize: 15 }]}>{item.nickname}</Text>
                        <Text style={[styles.pRoleText, { color: ROLE_COLORS[item.role], fontSize: 10 }]}>{item.role}</Text>
                      </View>
                      <View style={[styles.pStrBadge, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', flexDirection: 'row', width: 75, gap: 6, paddingVertical: 3, borderRadius: 8, justifyContent: 'center' }]}>
                        <View style={{alignItems: 'center'}}><Text style={[styles.pAge, dynamicStyles.subText, {fontSize: 11, fontWeight: '700'}]}>{item.age}</Text><Text style={styles.pStrLabel}>ANNI</Text></View>
                        <View style={[styles.pDivider, dynamicStyles.divider, { height: 12 }]} />
                        <View style={{alignItems: 'center'}}><Text style={[styles.pStrNum, dynamicStyles.text, { fontSize: 13 }]}>{item.strength}</Text><Text style={styles.pStrLabel}>FRZ</Text></View>
                      </View>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.id}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
                />
              </View>
            )}

            {activeTab === 'teams' && (
              <View style={{flex: 1}}>
                 <View style={[styles.searchContainer, dynamicStyles.card, { marginHorizontal: 20, marginTop: 4, marginBottom: 8 }]}>
                   <Ionicons name="search" size={20} color="#8E8E93" style={{ marginRight: 8 }} />
                   <TextInput style={[styles.searchInput, dynamicStyles.text]} placeholder="Cerca per selezione..." placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} value={teamSearch} onChangeText={setTeamSearch} />
                 </View>
                 <View style={{ paddingHorizontal: 12 }}>
                   {renderRoleFilter(teamSelectedRole, setTeamSelectedRole)}
                 </View>
                 <View style={[styles.selHeader, { marginTop: 0, marginBottom: 4 }]}>
                   {manualStep !== -1 ? (
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                       <View style={{ backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                         <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 12 }}>SQUADRA {String.fromCharCode(65 + manualStep)}</Text>
                       </View>
                       <Text style={[styles.selCount, dynamicStyles.subText]}>
                         {selectedIds.size} / {matchType}
                       </Text>
                     </View>
                   ) : (
                     <Text style={[styles.selCount, dynamicStyles.subText]}>
                       {selectedIds.size} / {group?.group_type === 'tournament' ? matchType * numTeams : matchType * 2}
                     </Text>
                   )}
                   <TouchableOpacity
                     onPress={manualStep !== -1 ? () => { setManualStep(-1); setSelectedIds(new Set()); setManualTeamsData([]); } : selectAll}
                   >
                     <Text style={[styles.selAllText, manualStep !== -1 && { color: '#FF3B30' }]}>
                       {manualStep !== -1 ? 'Annulla' : 'Tutti'}
                     </Text>
                   </TouchableOpacity>
                 </View>
                 <FlatList data={filteredPlayersForTeams} renderItem={({ item }) => {
                   const isSel = selectedIds.has(item.id);
                   return (
                     <TouchableOpacity style={[styles.selCard, dynamicStyles.card, isSel && styles.selCardActive]} onPress={() => togglePlayer(item.id)}>
                       <View style={[styles.chk, isSel && styles.chkActive]}>{isSel && <Ionicons name="checkmark" size={14} color="#FFF" />}</View>
                       <View style={styles.selPlayerInfo}><Text style={[styles.selNick, dynamicStyles.text, { fontSize: 15 }]}>{item.nickname}</Text><Text style={[styles.selRole, { color: ROLE_COLORS[item.role], fontSize: 10 }]}>{item.role}</Text></View>
                       <View style={[styles.pStrBadge, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', flexDirection: 'row', width: 75, gap: 6, paddingVertical: 3, borderRadius: 8, justifyContent: 'center', marginLeft: 10 }]}>
                         <View style={{alignItems: 'center'}}><Text style={[styles.pAge, dynamicStyles.subText, {fontSize: 11, fontWeight: '700'}]}>{item.age}</Text><Text style={styles.pStrLabel}>ANNI</Text></View>
                         <View style={[styles.pDivider, dynamicStyles.divider, { height: 12 }]} />
                         <View style={{alignItems: 'center'}}><Text style={[styles.pStrNum, dynamicStyles.text, { fontSize: 13 }]}>{item.strength}</Text><Text style={styles.pStrLabel}>FRZ</Text></View>
                       </View>
                     </TouchableOpacity>
                   );
                 }} contentContainerStyle={styles.listContent} />
                 <View style={styles.genBar}>
                   {manualStep !== -1 ? (
                     <TouchableOpacity
                       style={[styles.genBtn, { backgroundColor: '#34C759' }, (selectedIds.size === 0 || selectedIds.size > matchType) && styles.genBtnDisabled]}
                       onPress={handleNextManualStep}
                       disabled={selectedIds.size === 0 || selectedIds.size > matchType}
                     >
                       <Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginRight: 8 }} />
                       <Text style={styles.genText}>Conferma Squadra {String.fromCharCode(65 + manualStep)}</Text>
                     </TouchableOpacity>
                   ) : (
                     <View style={{ flexDirection: 'row', gap: 10 }}>
                       <TouchableOpacity
                         style={[styles.genBtn, { flex: 1, backgroundColor: '#8E8E93' }]}
                         onPress={() => handleGenerate(true)}
                       >
                         <Ionicons name="pencil" size={20} color="#FFF" style={{ marginRight: 8 }} />
                         <Text style={styles.genText}>Manuale</Text>
                       </TouchableOpacity>

                       <TouchableOpacity
                         style={[styles.genBtn, { flex: 1.5 }, selectedIds.size !== (group?.group_type === 'tournament' ? matchType * numTeams : matchType * 2) && styles.genBtnDisabled]}
                         onPress={() => handleGenerate(false)}
                         disabled={generating || selectedIds.size !== (group?.group_type === 'tournament' ? matchType * numTeams : matchType * 2)}
                       >
                         <Ionicons name="flash" size={20} color="#FFF" style={{ marginRight: 8 }} />
                         <Text style={styles.genText}>Bilanciata</Text>
                       </TouchableOpacity>
                     </View>
                   )}
                 </View>
              </View>
            )}

            {activeTab === 'standings' && renderStandings()}
            {activeTab === 'tournament_standings' && renderTournamentStandings()}
            {activeTab === 'bracket' && renderBracket()}
            {activeTab === 'matches' && renderMatches()}
          </View>
        )}

        <Modal visible={showResultModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, dynamicStyles.text]}>{editingMatchId ? 'Modifica Risultato' : 'Registra Risultato'}</Text>
                <TouchableOpacity onPress={() => setShowResultModal(false)}><Ionicons name="close" size={24} color={isDarkMode ? "#FFF" : "#1C1C1E"} /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {(() => {
                  const currentMatch = editingMatchId ? matches.find(m => m.id === editingMatchId) : null;
                  const isKnockout = currentMatch && currentMatch.match_phase !== 'group';
                  const showNames = !isKnockout || isGroupPhaseComplete;

                  return (
                    <>
                      <View style={{ marginBottom: 20, paddingHorizontal: 10 }}>
                        <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 13, marginBottom: 8 }]}>Dettagli Partita</Text>
                        <TextInput
                          style={[styles.searchInput, dynamicStyles.text, { height: 40, borderBottomWidth: 1, borderBottomColor: dynamicStyles.divider.backgroundColor, marginBottom: 12 }]}
                          placeholder="Descrizione (es. Giornata 1)"
                          value={matchDescription}
                          onChangeText={setMatchDescription}
                        />
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.filterChip, dynamicStyles.card, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 0, height: 40 }]}>
                            <Ionicons name="calendar-outline" size={16} color="#007AFF" style={{ marginRight: 6 }} />
                            <Text style={dynamicStyles.text}>{matchDate.toLocaleDateString('it-IT')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setShowTimePicker(true)} style={[styles.filterChip, dynamicStyles.card, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 0, height: 40 }]}>
                            <Ionicons name="time-outline" size={16} color="#007AFF" style={{ marginRight: 6 }} />
                            <Text style={dynamicStyles.text}>{matchDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', borderRadius: 10, paddingHorizontal: 10, height: 40, marginTop: 12 }}>
                          <Ionicons name="location-outline" size={18} color="#8E8E93" />
                          <TextInput style={[styles.searchInput, dynamicStyles.text, { flex: 1, marginLeft: 6 }]} placeholder="Luogo partita..." placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} value={matchLocation} onChangeText={setMatchLocation} />
                        </View>
                      </View>

                      <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, marginBottom: 20, opacity: 0.3 }]} />

                      {[
                        { participants: teamAParticipants, name: editMatchNameA, color: editMatchColorA, score: scoreA, setScore: setScoreA, ownGoals: teamAOwnGoals, updateOwn: updateOwnGoals, penalties: penaltiesA, setPenalties: setPenaltiesA, key: 'a' as const, placeholder: currentMatch?.team_a_placeholder },
                        { participants: teamBParticipants, name: editMatchNameB, color: editMatchColorB, score: scoreB, setScore: setScoreB, ownGoals: teamBOwnGoals, updateOwn: updateOwnGoals, penalties: penaltiesB, setPenalties: setPenaltiesB, key: 'b' as const, placeholder: currentMatch?.team_b_placeholder }
                      ].map((t, i) => {
                        const displayName = !showNames && t.placeholder ? t.placeholder.replace('-', '° Girone ') : t.name;
                        const iconColor = !showNames ? '#8E8E93' : getJerseyHex(t.color);

                        return (
                          <View key={i} style={[styles.teamCard, dynamicStyles.card, { borderLeftWidth: 0, borderWidth: 2, borderColor: iconColor, padding: 14, marginBottom: 20 }]}>
                            <View style={[styles.teamHeader, { marginBottom: 15, gap: 10 }]}>
                              <TouchableOpacity
                                onPress={() => isAdminOrOwner && handlePickLogo(t.key)}
                                disabled={!isAdminOrOwner}
                                style={[styles.jerseyBadge, { backgroundColor: iconColor, borderWidth: iconColor === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6', width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }]}
                              >
                                {t.key === 'a' ? (
                                  editMatchLogoA ? <Image source={{ uri: editMatchLogoA }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="shirt" size={24} color={getJerseyTextColor(t.color)} />
                                ) : (
                                  editMatchLogoB ? <Image source={{ uri: editMatchLogoB }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="shirt" size={24} color={getJerseyTextColor(t.color)} />
                                )}
                                {isAdminOrOwner && (
                                  <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#007AFF', padding: 2, borderRadius: 10 }}>
                                    <Ionicons name="camera" size={10} color="#FFF" />
                                  </View>
                                )}
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  if (isAdminOrOwner) {
                                    setTempTeamName(t.name);
                                    setShowNameEditor(t.key);
                                  }
                                }}
                                disabled={!isAdminOrOwner}
                                style={{ flex: 1 }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={[styles.teamName, dynamicStyles.text, { fontSize: 16 }]} numberOfLines={1}>{displayName}</Text>
                                  {isAdminOrOwner && <Ionicons name="pencil" size={14} color="#8E8E93" />}
                                </View>
                                {isAdminOrOwner && (
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                                    {JERSEY_COLORS.map(c => (
                                      <TouchableOpacity
                                        key={c.value}
                                        onPress={() => updateTeamColor(t.key, c.value)}
                                        style={{
                                          width: 22,
                                          height: 22,
                                          borderRadius: 11,
                                          backgroundColor: c.hex,
                                          marginRight: 8,
                                          borderWidth: t.color === c.value ? 2 : 0.5,
                                          borderColor: t.color === c.value ? '#007AFF' : (isDarkMode ? '#444' : '#D1D1D6'),
                                          justifyContent: 'center',
                                          alignItems: 'center'
                                        }}
                                      >
                                        {t.color === c.value && <Ionicons name="checkmark" size={12} color={getJerseyTextColor(c.value)} />}
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                )}
                              </TouchableOpacity>
                              <TextInput
                                style={[styles.scoreInput, dynamicStyles.input, { width: 50, height: 40, fontSize: 20, borderRadius: 8, borderWidth: 1 }]}
                                keyboardType="numeric"
                                value={t.score}
                                onChangeText={t.setScore}
                              />
                            </View>

                            {showNames && t.participants.map(p => renderPlayerStatRow(p, t.key))}

                            <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, marginVertical: 12, opacity: 0.2 }]} />

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <TouchableOpacity onPress={() => t.updateOwn(t.key, -1)}>
                                  <Ionicons name="remove-circle-outline" size={22} color="#8E8E93" />
                                </TouchableOpacity>
                                <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '700' }]}>{t.ownGoals} Autoreti</Text>
                                <TouchableOpacity onPress={() => t.updateOwn(t.key, 1)}>
                                  <Ionicons name="add-circle-outline" size={22} color="#FF9500" />
                                </TouchableOpacity>
                              </View>

                              {isKnockout && (
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#8E8E93', marginBottom: 2 }}>RIGORI</Text>
                                  <TextInput
                                    style={[styles.scoreInput, dynamicStyles.input, { width: 45, height: 32, fontSize: 16, borderRadius: 6, borderWidth: 1 }]}
                                    keyboardType="numeric"
                                    value={t.penalties}
                                    onChangeText={t.setPenalties}
                                  />
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </>
                  );
                })()}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }]}
                  onPress={() => handleSaveResult('scheduled')}
                >
                  <Text style={[styles.saveBtnText, { color: isDarkMode ? '#FFF' : '#1C1C1E' }]}>Salva Partita</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1.5 }]}
                  onPress={() => handleSaveResult('played')}
                >
                  <Text style={styles.saveBtnText}>Salva Risultato</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {showDatePicker && (
          <DateTimePicker value={matchDate} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(false); if (d) setMatchDate(d); }} />
        )}
        {showTimePicker && (
          <DateTimePicker value={matchDate} mode="time" display="default" onChange={(e, d) => { setShowTimePicker(false); if (d) setMatchDate(d); }} />
        )}

        {renderImportPlayersModal()}
        {renderLinkModal()}
        {renderTieBreakerSelectorModal()}
        {renderCareerSettingsModal()}
        {renderMatchSharePreview()}
        {renderStandingsSharePreview()}
        {renderTournamentStandingsSharePreview()}
        {renderBracketSharePreview()}
        {renderMatchesSharePreview()}
        {renderPlayersSharePreview()}
        {renderTeamDetailsSharePreview()}
        {renderTeamDetailsModal()}

        {renderPodiumSelectorModal()}
        {renderGironeSelectorModal()}
        {renderKnockoutBuilderModal()}
        {renderPlayerSelectorModal()}

        {/* Modal Modifica Nome Squadra */}
        <Modal visible={!!showNameEditor} transparent animationType="fade">
          <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
            <View style={[styles.modalContent, dynamicStyles.modalContent, { marginHorizontal: 30, borderRadius: 20, padding: 25 }]}>
              <Text style={[styles.modalTitle, dynamicStyles.text, { marginBottom: 20 }]}>Rinomina Squadra</Text>
              <TextInput
                style={[styles.scoreInput, dynamicStyles.input, { height: 50, fontSize: 18, marginBottom: 25 }]}
                value={tempTeamName}
                onChangeText={setTempTeamName}
                autoFocus
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity style={{ padding: 8 }} onPress={() => setShowNameEditor(null)}>
                  <Ionicons name="arrow-back" size={32} color="#8E8E93" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => {
                    if (showNameEditor) updateTeamName(showNameEditor, tempTeamName);
                    setShowNameEditor(null);
                  }}
                >
                  <Ionicons name="checkmark-circle" size={48} color="#34C759" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Selettore Colore Divisa */}
        <Modal visible={!!showColorPicker} transparent animationType="fade">
          <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
            <View style={[styles.modalContent, dynamicStyles.modalContent, { marginHorizontal: 30, borderRadius: 20, padding: 25 }]}>
              <Text style={[styles.modalTitle, dynamicStyles.text, { marginBottom: 20 }]}>Scegli Colore Divisa</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'center', marginBottom: 30 }}>
                {JERSEY_COLORS.map(c => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setTempJerseyColor(c.value)}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      backgroundColor: c.hex,
                      borderWidth: tempJerseyColor === c.value ? 4 : 2,
                      borderColor: tempJerseyColor === c.value ? '#007AFF' : (isDarkMode ? '#3A3A3C' : '#D1D1D6'),
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  >
                    <Ionicons name="shirt" size={24} color={getJerseyTextColor(c.value)} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity style={{ padding: 8 }} onPress={() => setShowColorPicker(null)}>
                  <Ionicons name="arrow-back" size={32} color="#8E8E93" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => {
                    if (showColorPicker) updateTeamColor(showColorPicker, tempJerseyColor);
                    setShowColorPicker(null);
                  }}
                >
                  <Ionicons name="checkmark-circle" size={48} color="#34C759" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Modifica Temporanea Giocatore */}
        <Modal visible={!!showPlayerEditor} transparent animationType="fade">
          <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
            <View style={[styles.modalContent, dynamicStyles.modalContent, { marginHorizontal: 20, borderRadius: 20, padding: 20 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={[styles.modalTitle, dynamicStyles.text, { marginBottom: 0 }]}>Modifica Temporanea</Text>
                <TouchableOpacity onPress={handleResetPlayerTemp} style={{ padding: 8 }}>
                  <Ionicons name="reload-circle-outline" size={26} color="#FF9500" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 13, marginBottom: 8 }]}>Ruolo</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {ROLES.map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setTempRole(r)}
                    style={[
                      styles.filterChip,
                      { paddingHorizontal: 10, paddingVertical: 6, borderColor: tempRole === r ? ROLE_COLORS[r] : '#D1D1D6', backgroundColor: tempRole === r ? ROLE_COLORS[r] + '20' : 'transparent' }
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: tempRole === r ? ROLE_COLORS[r] : '#8E8E93' }}>{r.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 13, marginBottom: 8 }]}>Forza (FRZ)</Text>
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                  <TouchableOpacity
                    onPress={() => setTempStrength(prev => Math.max(1, prev - 0.5))}
                    style={[styles.adjustBtn, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' }]}
                  >
                    <Ionicons name="remove" size={28} color="#007AFF" />
                  </TouchableOpacity>

                  <View style={{ alignItems: 'center', minWidth: 80 }}>
                    <TextInput
                      style={[styles.strengthLargeInput, dynamicStyles.text, { fontSize: 40 }]}
                      keyboardType="decimal-pad"
                      value={String(tempStrength)}
                      selectTextOnFocus
                      onChangeText={(v) => {
                        const sanitized = v.replace(',', '.');
                        if (sanitized === '') {
                          setTempStrength(0);
                        } else {
                          const val = parseFloat(sanitized);
                          if (!isNaN(val)) setTempStrength(val);
                        }
                      }}
                      onBlur={() => {
                        setTempStrength(Math.max(1, Math.min(10, tempStrength)));
                      }}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => setTempStrength(prev => Math.min(10, prev + 0.5))}
                    style={[styles.adjustBtn, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' }]}
                  >
                    <Ionicons name="add" size={28} color="#007AFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setShowPlayerEditor(null)} style={{ padding: 8 }}>
                  <Ionicons name="arrow-back" size={32} color="#8E8E93" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleUpdatePlayerTemp}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="checkmark-circle" size={48} color="#34C759" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 60 },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  headerBtns: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconBtn: { padding: 6 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' },
  tabsWrapper: { paddingVertical: 6 },
  filterContainer: { paddingHorizontal: 10 },
  filterChip: { paddingHorizontal: 4, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  listContent: { paddingHorizontal: 0, paddingBottom: 100 },
  pCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 0, paddingVertical: 6, paddingHorizontal: 16, marginBottom: 0, borderBottomWidth: 1, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 },
  pAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pAvatarText: { fontSize: 14, fontWeight: '800' },
  pInfo: { flex: 1, marginLeft: 10 },
  pNickname: { fontSize: 15, fontWeight: '700' },
  pRoleText: { fontSize: 10, fontWeight: '600', marginTop: 0 },
  pStrBadge: { alignItems: 'center', justifyContent: 'center' },
  pDivider: { width: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  pAge: { fontSize: 11 },
  pStrNum: { fontSize: 13, fontWeight: '800' },
  pStrLabel: { fontSize: 7, fontWeight: '700', color: '#8E8E93' },
  selHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  selCount: { fontSize: 13, fontWeight: '700' },
  selAllText: { fontSize: 13, fontWeight: '700', color: '#007AFF' },
  selCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 0, paddingVertical: 6, paddingHorizontal: 16, marginBottom: 0, borderBottomWidth: 1, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 },
  selCardActive: { backgroundColor: 'rgba(0,122,255,0.05)' },
  chk: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#8E8E93', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  chkActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  selPlayerInfo: { flex: 1 },
  selNick: { fontSize: 16, fontWeight: '700' },
  selRole: { fontSize: 11, fontWeight: '600' },
  genBar: { position: 'absolute', bottom: 2, left: 20, right: 20 },
  genBtn: { backgroundColor: '#007AFF', borderRadius: 16, height: 48, alignItems: 'center', justifyContent: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  genBtnDisabled: { backgroundColor: '#AEAEB2' },
  genText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  standingRank: { width: 30, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 14, fontWeight: '700' },
  standingStats: { flexDirection: 'row', gap: 12 },
  trendCircleMini: { alignItems: 'center', justifyContent: 'center' },
  gridValue: { fontWeight: '800' },
  matchDate: { fontSize: 11, fontWeight: '600' },
  teamScoreInfo: { flex: 1 },
  teamScoreName: { fontSize: 14, fontWeight: '600' },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginHorizontal: 10 },
  scoreValue: { fontSize: 16, fontWeight: '800' },
  teamsHeaderControls: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconShareBtn: { padding: 8 },
  configContainer: { borderRadius: 16, borderWidth: 1 },
  configSection: { marginBottom: 20 },
  configSectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  filterChipActive: { backgroundColor: '#007AFF' },
  teamsContainer: { padding: 10 },
  teamsMetaInfo: { marginBottom: 15 },
  teamsDescText: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  teamsDateTimeLoc: { gap: 2 },
  teamsMetaText: { fontSize: 12, fontWeight: '500' },
  teamCard: { borderRadius: 16, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
  jerseyBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  teamName: { fontSize: 18, fontWeight: '800' },
  teamStatsSub: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  teamPlayerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  tpAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tpAvatarText: { fontSize: 12, fontWeight: '800' },
  tpInfo: { flex: 1, marginLeft: 12 },
  tpName: { fontSize: 15, fontWeight: '700' },
  tpRole: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  tpRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pStrLabelShort: { fontSize: 8, fontWeight: '700', color: '#8E8E93' },
  swapBtn: { padding: 4 },
  mainShareBtn: { backgroundColor: '#007AFF', marginHorizontal: 20, height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  mainShareBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  statName: { flex: 1, fontSize: 15, fontWeight: '600', marginLeft: 10 },
  statControls: { flexDirection: 'row', gap: 16 },
  statGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValueText: { fontSize: 14, fontWeight: '800', minWidth: 25, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 19, fontWeight: '800' },
  scoreInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 25 },
  scoreField: { alignItems: 'center', flex: 1 },
  scoreLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, color: '#8E8E93', textTransform: 'uppercase' },
  scoreInput: { width: '100%', height: 60, borderRadius: 16, textAlign: 'center', fontSize: 28, fontWeight: '900', borderWidth: 2 },
  vsTextModal: { fontSize: 24, fontWeight: '900', marginTop: 20 },
  bonusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tokenBtn: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tokenBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  teamSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, marginVertical: 10 },
  teamSectionTitle: { fontSize: 14, fontWeight: '800' },
  tpStrength: { fontSize: 16, fontWeight: '800' },
  tpAge: { fontSize: 12 },
  adjustBtn: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  strengthLargeInput: { fontSize: 48, fontWeight: '900', textAlign: 'center', minWidth: 80, padding: 0, margin: 0 },
});
