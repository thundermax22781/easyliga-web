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
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
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
  checkSyncNeeded,
  importPlayersExcel,
  exportPlayersExcel,
  calculateStandings,
  syncCloudData,
  createFullBackup,
  restoreFullBackup,
  ROLE_COLORS,
  JERSEY_COLORS,
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
  const [activeTab, setActiveTab] = useState<'players' | 'teams' | 'standings' | 'matches'>('players');
  const [sortBy, setSortBy] = useState<string>('points');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Teams Generation State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [matchType, setMatchType] = useState(5);
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
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editMatchNameA, setEditMatchNameA] = useState('');
  const [editMatchNameB, setEditMatchNameB] = useState('');
  const [editMatchColorA, setEditMatchColorA] = useState('Bianca');
  const [editMatchColorB, setEditMatchColorB] = useState('Rossa');

  // Settings / Config
  const [showConfig, setShowConfig] = useState(false);
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
  const matchViewShotRef = useRef<ViewShot>(null);
  const standingsViewShotRef = useRef<ViewShot>(null);

  const [modalVisible, setModalVisible] = useState(false);

  const isAdminOrOwner = group?.role === 'owner' || group?.role === 'admin';

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [groupId])
  );

  const loadData = async (forceSync = false) => {
    if (!groupId) return;
    try {
      // 1. Carica immediatamente i dati locali per la massima velocità (Offline-first)
      const groups = await fetchGroups();
      const currentGroup = groups.find(g => g.id === groupId);
      if (currentGroup) {
        setGroup(currentGroup);
        setMatchType(currentGroup.match_type || 5);
      }

      const [p, m] = await Promise.all([
        fetchPlayers({ group_id: groupId }),
        fetchMatches(groupId)
      ]);

      const s = await calculateStandings(groupId);

      setPlayers(p);
      setMatches(m);
      setStandings(s);

      // 2. Rimuovi subito il loader così l'utente vede i dati istantaneamente
      setLoading(false);
      setRefreshing(false);

      // 3. Se non è un forceSync, controlla in background se ci sono aggiornamenti nel cloud
      if (!forceSync) {
        checkSyncNeeded(groupId).then(needed => {
          setHasUnsyncedChanges(needed);
        });
      } else {
        // Se è un forceSync (nuvoletta cliccata), esegui la sincronizzazione vera e propria
        setSyncStatus('syncing');
        await syncCloudData(groupId);

        // Ricarica i dati dopo la sincronizzazione
        const [pUpdated, mUpdated] = await Promise.all([
          fetchPlayers({ group_id: groupId }),
          fetchMatches(groupId)
        ]);
        const sUpdated = await calculateStandings(groupId);

        setPlayers(pUpdated);
        setMatches(mUpdated);
        setStandings(sUpdated);
        setHasUnsyncedChanges(false);
        setSyncStatus('done');
      }
    } catch (e) {
      console.error(e);
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
      if (next.size >= matchType * 2) return;

      // Controllo limite portieri (max 2)
      const playerToAdd = players.find(p => p.id === id);
      if (playerToAdd?.role === 'Portiere') {
        const selectedGks = players.filter(p => next.has(p.id) && p.role === 'Portiere').length;
        if (selectedGks >= 2) {
          Alert.alert('Limite Portieri', 'Puoi selezionare al massimo 2 portieri.');
          return;
        }
      }
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      // Seleziona i primi N giocatori rispettando il limite dei 2 portieri
      const next = new Set<string>();
      let gksCount = 0;

      for (const p of filteredPlayersForTeams) {
        if (next.size >= matchType * 2) break;
        if (p.role === 'Portiere') {
          if (gksCount < 2) {
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

  const handleGenerate = async () => {
    if (selectedIds.size !== matchType * 2) {
      return Alert.alert('Errore', `Seleziona esattamente ${matchType * 2} giocatori.`);
    }
    setGenerating(true);
    try {
      const res = await generateTeams(
        Array.from(selectedIds),
        matchType,
        groupId as string,
        'Squadra Bianca',
        'Squadra Rossa',
        'Bianca',
        'Rossa',
        teams?.team_a.map(p => p.id)
      );
      setTeams(res);
      setMatchDate(new Date());
      setMatchDescription('');
      setMatchLocation('');
    } catch (e) {
      Alert.alert('Errore', 'Generazione fallita');
    } finally {
      setGenerating(false);
    }
  };

  const movePlayer = (playerId: string, fromTeam: 'a' | 'b', direction: 'up' | 'down') => {
    if (!teams) return;
    const newTeams = { ...teams };
    const list = fromTeam === 'a' ? [...newTeams.team_a] : [...newTeams.team_b];
    const index = list.findIndex(p => p.id === playerId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [list[index], list[index - 1]] = [list[index - 1], list[index]];
    } else if (direction === 'down' && index < list.length - 1) {
      [list[index], list[index + 1]] = [list[index + 1], list[index]];
    }

    if (fromTeam === 'a') newTeams.team_a = list;
    else newTeams.team_b = list;
    setTeams(newTeams);
  };

  const swapPlayer = (playerId: string, fromTeam: 'a' | 'b') => {
    if (!teams) return;
    const newTeams = { ...teams };
    const sourceList = fromTeam === 'a' ? [...newTeams.team_a] : [...newTeams.team_b];
    const targetList = fromTeam === 'a' ? [...newTeams.team_b] : [...newTeams.team_a];

    const pIdx = sourceList.findIndex(p => p.id === playerId);
    if (pIdx === -1) return;

    const playerToMove = sourceList[pIdx];

    if (playerToMove.role === 'Portiere') {
      // Cerca il portiere nell'altra squadra
      const targetGkIdx = targetList.findIndex(p => p.role === 'Portiere');
      if (targetGkIdx !== -1) {
        // Scambia i portieri
        const targetGk = targetList[targetGkIdx];
        sourceList[pIdx] = targetGk;
        targetList[targetGkIdx] = playerToMove;
      } else {
        // Se non c'è un portiere nell'altra squadra (caso raro), sposta e basta
        sourceList.splice(pIdx, 1);
        targetList.push(playerToMove);
      }
    } else {
      // Comportamento standard per gli altri ruoli: scambia con l'ultimo giocatore non portiere
      sourceList.splice(pIdx, 1);
      const playerFromTarget = targetList.pop();
      if (playerFromTarget) sourceList.push(playerFromTarget);
      targetList.push(playerToMove);
    }

    if (fromTeam === 'a') {
      newTeams.team_a = sourceList;
      newTeams.team_b = targetList;
    } else {
      newTeams.team_b = sourceList;
      newTeams.team_a = targetList;
    }

    newTeams.team_a_total_strength = Number(newTeams.team_a.reduce((acc, p) => acc + p.strength, 0).toFixed(1));
    newTeams.team_b_total_strength = Number(newTeams.team_b.reduce((acc, p) => acc + p.strength, 0).toFixed(1));

    setTeams(newTeams);
  };

  const updateTeamColor = (team: 'a' | 'b', color: string) => {
    if (!teams) return;
    setTeams({
      ...teams,
      [team === 'a' ? 'team_a_color' : 'team_b_color']: color
    });
  };

  const updateTeamName = (team: 'a' | 'b', name: string) => {
    if (!teams) return;
    setTeams({
      ...teams,
      [team === 'a' ? 'team_a_name' : 'team_b_name']: name
    });
  };

  const handleOpenResultModal = (matchToEdit?: Match) => {
    if (matchToEdit) {
      setEditingMatchId(matchToEdit.id);
      setScoreA(matchToEdit.team_a_score.toString());
      setScoreB(matchToEdit.team_b_score.toString());
      setMatchGoals(matchToEdit.goals || {});
      setMatchAssists(matchToEdit.assists || {});
      setTeamAOwnGoals(matchToEdit.team_a_own_goals || 0);
      setTeamBOwnGoals(matchToEdit.team_b_own_goals || 0);
      setMatchDescription(matchToEdit.description || '');
      setMatchDate(new Date(matchToEdit.date));
      setMatchLocation(matchToEdit.location || '');
      setEditMatchNameA(matchToEdit.team_a_name);
      setEditMatchNameB(matchToEdit.team_b_name);
      setEditMatchColorA(matchToEdit.team_a_color);
      setEditMatchColorB(matchToEdit.team_b_color);
    } else {
      setEditingMatchId(null);
      setScoreA('0');
      setScoreB('0');
      setMatchGoals({});
      setMatchAssists({});
      setTeamAOwnGoals(0);
      setTeamBOwnGoals(0);
      setMatchDescription('');
      setMatchDate(new Date());
      setMatchLocation(teams?.match_location || '');
      setEditMatchNameA(teams?.team_a_name || 'Squadra A');
      setEditMatchNameB(teams?.team_b_name || 'Squadra B');
      setEditMatchColorA(teams?.team_a_color || 'Bianca');
      setEditMatchColorB(teams?.team_b_color || 'Rossa');
    }
    setShowResultModal(true);
  };

  const updateMatchStat = (playerId: string, type: 'goals' | 'assists', delta: number) => {
    if (type === 'goals') {
      const current = matchGoals[playerId] || 0;
      setMatchGoals({ ...matchGoals, [playerId]: Math.max(0, current + delta) });
    } else {
      const current = matchAssists[playerId] || 0;
      setMatchAssists({ ...matchAssists, [playerId]: Math.max(0, current + delta) });
    }
  };

  const updateOwnGoals = (team: 'a' | 'b', delta: number) => {
    if (team === 'a') setTeamAOwnGoals(Math.max(0, teamAOwnGoals + delta));
    else setTeamBOwnGoals(Math.max(0, teamBOwnGoals + delta));
  };

  const handleSaveResult = async () => {
    if (!groupId) return;
    try {
      const matchData: Match = {
        id: editingMatchId || '',
        group_id: groupId,
        date: editingMatchId ? matches.find(m => m.id === editingMatchId)!.date : matchDate.toISOString(),
        team_a_players: editingMatchId ? matches.find(m => m.id === editingMatchId)!.team_a_players : teams!.team_a.map(p => p.id),
        team_b_players: editingMatchId ? matches.find(m => m.id === editingMatchId)!.team_b_players : teams!.team_b.map(p => p.id),
        team_a_score: parseInt(scoreA) || 0,
        team_b_score: parseInt(scoreB) || 0,
        team_a_name: editMatchNameA,
        team_b_name: editMatchNameB,
        team_a_color: editMatchColorA,
        team_b_color: editMatchColorB,
        goals: matchGoals,
        assists: matchAssists,
        team_a_own_goals: teamAOwnGoals,
        team_b_own_goals: teamBOwnGoals,
        description: matchDescription || undefined,
        location: matchLocation || undefined
      };

      await saveMatchResult(matchData);
      setHasUnsyncedChanges(true);
      setShowResultModal(false);
      setTeams(null);
      setActiveTab('matches');
      loadData();
    } catch (e) {
      Alert.alert('Errore', 'Salvataggio fallito');
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
      const csv = "Nickname,Nome,Cognome,Data Nascita,Ruolo,Forza\n" +
        data.map(p => `${p.Nickname},${p.Nome},${p.Cognome},${p['Data di Nascita']},${p.Ruolo},${p.Forza}`).join("\n");
      const fileName = `Giocatori_${group?.name.replace(/\s/g, '_')}.csv`;

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, 'text/csv');
          await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
          Alert.alert('Successo', 'Elenco giocatori salvato correttamente');
          return;
        }
      }

      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      await Sharing.shareAsync(fileUri, { UTI: 'public.comma-separated-values-text', mimeType: 'text/csv' });
    } catch (e) {
      Alert.alert('Errore', 'Esportazione fallita');
    }
  };

  const handleImportPlayers = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (!res.canceled) {
        setImporting(true);
        Alert.alert('Info', 'L\'importazione Excel richiede una libreria specifica non inclusa in questo ambiente demo, ma la struttura è pronta.');
        setImporting(false);
      }
    } catch (e) {
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
    <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }}>
        {['Attaccante', 'Mediana', 'Difensore', 'Portiere'].map((r, i) => {
          const active = current === r;
          return (
            <TouchableOpacity
              key={r}
              onPress={() => setter(active ? null : r)}
              style={{
                flex: 1,
                height: 40,
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
                  fontSize: 9,
                  fontWeight: '900',
                  textAlign: 'center'
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
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
  const getJerseyTextColor = (color: string) => color === 'Bianca' || color === 'Gialla' ? '#1C1C1E' : '#FFFFFF';
  const getInitials = (n: string) => (n || 'G').substring(0, 2).toUpperCase();

  const dynamicStyles = {
    container: { backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7' },
    text: { color: isDarkMode ? '#FFFFFF' : '#1C1C1E' },
    subText: { color: isDarkMode ? '#AEAEB2' : '#8E8E93' },
    card: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF', borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' },
    input: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF', color: isDarkMode ? '#FFFFFF' : '#1C1C1E', borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' },
    modalContent: { backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF' },
    divider: { backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }
  };

  const filteredPlayersForTeams = players.filter(p =>
    (teamSelectedRole ? p.role === teamSelectedRole : true) &&
    (teamSearch ? p.nickname.toLowerCase().includes(teamSearch.toLowerCase()) : true)
  );

  const teamAParticipants = players.filter(p => (editingMatchId ? matches.find(m => m.id === editingMatchId)?.team_a_players : teams?.team_a.map(x => x.id))?.includes(p.id));
  const teamBParticipants = players.filter(p => (editingMatchId ? matches.find(m => m.id === editingMatchId)?.team_b_players : teams?.team_b.map(x => x.id))?.includes(p.id));

  const StatHeader = ({ label, width = 45 }: { label: string, width?: number }) => (
    <View style={{ width, alignItems: 'center' }}>
      <Text style={{ fontSize: 10, fontWeight: '900', color: '#8E8E93' }}>{label}</Text>
    </View>
  );

  const StatValue = ({ value, width = 45, color, bold = true }: { value: any, width?: number, color?: string, bold?: boolean }) => (
    <View style={{ width, alignItems: 'center' }}>
      <Text style={[{ fontSize: 15, fontWeight: bold ? '800' : '500', color: color || (isDarkMode ? '#FFF' : '#1C1C1E') }]}>
        {value}
      </Text>
    </View>
  );

  const renderStandings = () => {
    const sortOptions = [
      { id: 'points', label: 'Punti', key: 'points', short: 'PT', color: isDarkMode ? '#FFF' : '#1C1C1E' },
      { id: 'goals', label: 'Goal', key: 'individual_goals', short: 'G', color: '#FF3B30' },
      { id: 'assists', label: 'Assist', key: 'individual_assists', short: 'A', color: '#34C759' },
      { id: 'incisivity', label: 'Incisività', key: 'incisivity', short: 'INC', color: '#FF9500' },
      { id: 'bonus', label: 'Bonus', key: 'bonus_points', short: 'BON', color: '#5AC8FA' },
      { id: 'played', label: 'Partite', key: 'played', short: 'PG', color: '#8E8E93' },
    ];

    const currentSort = sortOptions.find(o => o.id === sortBy) || sortOptions[0];

    const sortedData = [...standings].sort((a, b) => {
      const valA = (a as any)[currentSort.key];
      const valB = (b as any)[currentSort.key];
      if (valB !== valA) return valB - valA;
      return b.points - a.points;
    });

    return (
      <View style={{ flex: 1 }}>
        {/* Filtro Ordinamento */}
        <View style={{ paddingHorizontal: 12, marginBottom: 10 }}>
          <Text style={[dynamicStyles.subText, { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }]}>Ordina per:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {sortOptions.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setSortBy(opt.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 15,
                  backgroundColor: sortBy === opt.id ? opt.color : (isDarkMode ? '#2C2C2E' : '#E5E5EA'),
                  borderWidth: 1,
                  borderColor: sortBy === opt.id ? opt.color : 'transparent'
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: sortBy === opt.id ? (opt.id === 'points' && !isDarkMode ? '#FFF' : (opt.id === 'points' ? '#000' : '#FFF')) : (isDarkMode ? '#AEAEB2' : '#8E8E93') }}>
                  {opt.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Intestazione Classifica */}
        <View style={[styles.pCard, dynamicStyles.card, { borderBottomWidth: 2, paddingVertical: 10 }]}>
           <View style={{ width: 155, flexDirection: 'row', alignItems: 'center' }}>
             <Text style={{ fontSize: 10, fontWeight: '900', color: '#8E8E93', marginLeft: 5 }}>POS. GIOCATORE</Text>
             {sortBy !== 'points' && (
               <View style={{ position: 'absolute', right: 5 }}>
                 <Text style={{ fontSize: 9, fontWeight: '900', color: currentSort.color }}>{currentSort.short}</Text>
               </View>
             )}
           </View>
           <ScrollView horizontal showsHorizontalScrollIndicator={false}>
             <StatHeader label="PT" />
             <StatHeader label="G" />
             <StatHeader label="A" />
             <StatHeader label="INC" />
             <StatHeader label="BON" />
             <StatHeader label="MG" />
             <StatHeader label="MA" />
             <StatHeader label="MS" />
             <StatHeader label="PG" />
             <StatHeader label="V" />
             <StatHeader label="P" />
             <StatHeader label="PA" />
           </ScrollView>
        </View>

        <FlatList
          data={sortedData}
          keyExtractor={(item) => item.player_id}
          renderItem={({ item, index }) => (
            <TouchableOpacity style={[styles.pCard, dynamicStyles.card, { paddingVertical: 12 }]} onPress={() => router.push(`/player/${item.player_id}?groupId=${groupId}`)}>
              <View style={{ width: 155, flexDirection: 'row', alignItems: 'center', paddingRight: 5 }}>
                <View style={styles.standingRank}>
                  {index < 3 && sortBy === 'points' ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons
                        name="ribbon"
                        size={26}
                        color={index === 0 ? '#FFD60A' : index === 1 ? '#C0C0C0' : '#CD7F32'}
                      />
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingTop: 0 }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#000' }}>{index + 1}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.rankText, dynamicStyles.text]}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[styles.pNickname, dynamicStyles.text, { fontSize: 13, flex: 1, marginLeft: 8 }]} numberOfLines={1}>{item.nickname}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {sortBy !== 'points' && (
                    <Text style={{ fontSize: 14, fontWeight: '900', color: currentSort.color, width: 30, textAlign: 'right' }}>
                      {(item as any)[currentSort.key]}
                    </Text>
                  )}
                  {item.last_trend && (
                    <View style={[styles.trendCircleMini, { backgroundColor: item.last_trend === 'W' ? '#34C759' : item.last_trend === 'D' ? '#FF9500' : '#FF3B30', width: 18, height: 18, borderRadius: 9 }]}>
                      <Ionicons name={item.last_trend === 'W' ? "arrow-up" : item.last_trend === 'L' ? "arrow-down" : "remove"} size={12} color="#FFF" />
                    </View>
                  )}
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                <StatValue value={item.points} color={dynamicStyles.text.color} />
                <StatValue value={item.individual_goals} color="#FF3B30" />
                <StatValue value={item.individual_assists} color="#34C759" />
                <StatValue value={item.incisivity} color="#FF9500" />
                <StatValue value={item.bonus_points} color="#5AC8FA" />
                <StatValue value={(item.individual_goals / (item.played || 1)).toFixed(1)} bold={false} />
                <StatValue value={(item.individual_assists / (item.played || 1)).toFixed(1)} bold={false} />
                <StatValue value={(item.goals_suffered / (item.played || 1)).toFixed(1)} bold={false} />
                <StatValue value={item.played} bold={false} />
                <StatValue value={item.won} bold={false} color="#34C759" />
                <StatValue value={item.lost} bold={false} color="#FF3B30" />
                <StatValue value={item.drawn} bold={false} color="#FF9500" />
              </ScrollView>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} />}
        />
      </View>
    );
  };

  const renderMatches = () => (
    <FlatList
      data={matches}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={[styles.pCard, dynamicStyles.card, { flexDirection: 'column', alignItems: 'stretch', padding: 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              {item.description ? (
                <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '900', marginBottom: 2 }]} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : (
                <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '900', marginBottom: 2 }]}>Partita</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={[styles.matchDate, dynamicStyles.subText, { fontSize: 12 }]}>
                  {new Date(item.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} • {new Date(item.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.location && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                    <Text style={[dynamicStyles.subText, { fontSize: 12, marginRight: 6 }]}>•</Text>
                    <Ionicons name="location-outline" size={12} color="#8E8E93" />
                    <Text style={[dynamicStyles.subText, { fontSize: 11, marginLeft: 2, maxWidth: 120 }]} numberOfLines={1}>{item.location}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <TouchableOpacity onPress={() => handleShareMatchStats(item)}><Ionicons name="share-social-outline" size={18} color="#34C759" /></TouchableOpacity>
              {isAdminOrOwner && (
                <>
                  <TouchableOpacity onPress={() => handleOpenResultModal(item)}><Ionicons name="pencil" size={18} color="#007AFF" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteMatch(item.id)}><Ionicons name="trash" size={18} color="#FF3B30" /></TouchableOpacity>
                </>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <View style={[styles.teamScoreInfo, { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }]}>
              <Ionicons
                name="shirt"
                size={18}
                color={getJerseyHex(item.team_a_color)}
                style={[
                  { marginRight: 6 },
                  getJerseyHex(item.team_a_color).toLowerCase() === '#ffffff' && {
                    textShadowColor: 'rgba(0,0,0,0.3)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 1
                  }
                ]}
              />
              <Text style={[styles.teamScoreName, dynamicStyles.text, { flex: 1 }]} numberOfLines={1}>{item.team_a_name}</Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', minWidth: 60 }]}>
              <Text style={[styles.scoreValue, dynamicStyles.text]}>{item.team_a_score} - {item.team_b_score}</Text>
            </View>
            <View style={[styles.teamScoreInfo, { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }]}>
              <Text style={[styles.teamScoreName, dynamicStyles.text, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>{item.team_b_name}</Text>
              <Ionicons
                name="shirt"
                size={18}
                color={getJerseyHex(item.team_b_color)}
                style={[
                  { marginLeft: 6 },
                  getJerseyHex(item.team_b_color).toLowerCase() === '#ffffff' && {
                    textShadowColor: 'rgba(0,0,0,0.3)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 1
                  }
                ]}
              />
            </View>
          </View>
        </View>
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} />}
    />
  );

  const renderTeamsResult = () => {
    if (!teams) return null;
    const teamAHex = getJerseyHex(teams.team_a_color);
    const teamBHex = getJerseyHex(teams.team_b_color);
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
              <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', borderRadius: 10, paddingHorizontal: 10, marginBottom: 12}}>
                <Ionicons name="location-outline" size={18} color="#8E8E93" />
                <TextInput style={[styles.searchInput, dynamicStyles.text, { height: 40, marginLeft: 6 }]} placeholder="Luogo partita..." placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} value={matchLocation} onChangeText={setMatchLocation} />
              </View>

              <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, marginBottom: 12, opacity: 0.3 }]} />

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 12, marginBottom: 4 }]}>Nome Squadra A</Text>
                  <TextInput
                    style={[styles.searchInput, dynamicStyles.text, { height: 36, backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', borderRadius: 8, paddingHorizontal: 10, fontSize: 13, fontWeight: '700' }]}
                    value={teams.team_a_name}
                    onChangeText={(v) => updateTeamName('a', v)}
                    placeholder="Squadra A"
                    placeholderTextColor="#8E8E93"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 12, marginBottom: 4, textAlign: 'right' }]}>Nome Squadra B</Text>
                  <TextInput
                    style={[styles.searchInput, dynamicStyles.text, { height: 36, backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', borderRadius: 8, paddingHorizontal: 10, fontSize: 13, fontWeight: '700', textAlign: 'right' }]}
                    value={teams.team_b_name}
                    onChangeText={(v) => updateTeamName('b', v)}
                    placeholder="Squadra B"
                    placeholderTextColor="#8E8E93"
                  />
                </View>
              </View>

              <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 12, marginBottom: 8 }]}>Colori Divise</Text>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[dynamicStyles.subText, { fontSize: 10, marginBottom: 6, fontWeight: '700' }]}>{teams.team_a_name.toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {JERSEY_COLORS.map(c => (
                      <TouchableOpacity
                        key={c.value}
                        onPress={() => updateTeamColor('a', c.value)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: c.hex,
                          borderWidth: teams.team_a_color === c.value ? 3 : 1,
                          borderColor: teams.team_a_color === c.value ? '#007AFF' : '#D1D1D6',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        {teams.team_a_color === c.value && <Ionicons name="checkmark" size={16} color={getJerseyTextColor(c.value)} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[dynamicStyles.subText, { fontSize: 10, marginBottom: 6, fontWeight: '700', textAlign: 'right' }]}>{teams.team_b_name.toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                    {JERSEY_COLORS.map(c => (
                      <TouchableOpacity
                        key={c.value}
                        onPress={() => updateTeamColor('b', c.value)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: c.hex,
                          borderWidth: teams.team_b_color === c.value ? 3 : 1,
                          borderColor: teams.team_b_color === c.value ? '#007AFF' : '#D1D1D6',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        {teams.team_b_color === c.value && <Ionicons name="checkmark" size={16} color={getJerseyTextColor(c.value)} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}

          {showDatePicker && (
            <DateTimePicker value={matchDate} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(false); if(d) setMatchDate(d); }} />
          )}
          {showTimePicker && (
            <DateTimePicker value={matchDate} mode="time" display="default" onChange={(e, d) => { setShowTimePicker(false); if(d) setMatchDate(d); }} />
          )}

          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }} style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: sharing ? 25 : 10 }}>
            <View style={styles.teamsContainer}>
              {sharing && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <View style={[styles.teamsMetaInfo, { flex: 1, marginBottom: 0 }]}>
                    {matchDescription ? <Text style={[styles.teamsDescText, { color: isDarkMode ? '#FFFFFF' : '#1C1C1E' }]}>{matchDescription}</Text> : (teams.description ? <Text style={[styles.teamsDescText, { color: isDarkMode ? '#FFFFFF' : '#1C1C1E' }]}>{teams.description}</Text> : null)}
                    <View style={styles.teamsDateTimeLoc}>
                      <Text style={[styles.teamsMetaText, { color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 14 }]}>
                        {matchDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} ore {matchDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      {matchLocation && <Text style={[styles.teamsMetaText, { color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 14 }]}>{matchLocation}</Text>}
                    </View>
                  </View>
                  <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                    <Image source={require('../../assets/images/icon.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
                  </View>
                </View>
              )}

              {[ { team: teams.team_a, name: teams.team_a_name, hex: teamAHex, color: teams.team_a_color, key: 'a' as const, strength: teams.team_a_total_strength, age: teams.team_a_avg_age }, { team: teams.team_b, name: teams.team_b_name, hex: teamBHex, color: teams.team_b_color, key: 'b' as const, strength: teams.team_b_total_strength, age: teams.team_b_avg_age } ].map((t, i) => (
                <View key={i} style={[styles.teamCard, dynamicStyles.card, { borderLeftWidth: 0, borderWidth: sharing ? 2 : 0, borderColor: t.hex, padding: sharing ? 14 : 16, marginBottom: 16 }]}>
                  <View style={styles.teamHeader}>
                    <View style={[styles.jerseyBadge, { backgroundColor: t.hex, borderWidth: t.hex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' }]}><Ionicons name="shirt" size={18} color={getJerseyTextColor(t.color)} /></View>
                    <View style={{flex: 1}}>
                      <Text style={[styles.teamName, dynamicStyles.text]}>{t.name}</Text>
                      <Text style={styles.teamStatsSub}>{t.strength} Forza • {t.age} Età media</Text>
                    </View>
                  </View>
                  {t.team.map((p) => (
                    <View key={p.id} style={styles.teamPlayerRow}>
                      <View style={[styles.tpAvatar, { backgroundColor: ROLE_COLORS[p.role] + '20' }]}><Text style={[styles.tpAvatarText, { color: ROLE_COLORS[p.role] }]}>{getInitials(p.nickname)}</Text></View>
                      <View style={styles.tpInfo}><Text style={[styles.tpName, dynamicStyles.text]}>{p.nickname}</Text><Text style={[styles.tpRole, { color: ROLE_COLORS[p.role] }]}>{p.role}</Text></View>

                      <View style={styles.tpRight}>
                        {showIndividualStrength && (
                          <View style={[styles.pStrBadge, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }]}>
                            <View style={{alignItems: 'center'}}><Text style={[styles.tpAge, dynamicStyles.subText, {fontSize: 13, fontWeight: '700'}]}>{p.age}</Text><Text style={styles.pStrLabel}>ANNI</Text></View>
                            <View style={[styles.pDivider, dynamicStyles.divider, { height: 16 }]} />
                            <View style={{alignItems: 'center'}}><Text style={[styles.tpStrength, dynamicStyles.text, { fontSize: 17, width: 'auto' }]}>{p.strength}</Text><Text style={styles.pStrLabel}>FRZ</Text></View>
                          </View>
                        )}
                        {!sharing && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ gap: -8 }}>
                              <TouchableOpacity onPress={() => movePlayer(p.id, t.key, 'up')}><Ionicons name="chevron-up" size={22} color="#007AFF" /></TouchableOpacity>
                              <TouchableOpacity onPress={() => movePlayer(p.id, t.key, 'down')}><Ionicons name="chevron-down" size={22} color="#007AFF" /></TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={() => swapPlayer(p.id, t.key)} style={styles.swapBtn}><Ionicons name="swap-horizontal" size={20} color="#007AFF" /></TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ViewShot>
          {isAdminOrOwner && (
            <TouchableOpacity style={styles.mainShareBtn} onPress={() => handleOpenResultModal()}>
              <Ionicons name="save-outline" size={20} color="#FFF" style={{marginRight: 8}} />
              <Text style={styles.mainShareBtnText}>Registra Risultato Partita</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderPlayerStatRow = (p: Player) => (
    <View key={p.id} style={styles.statRow}>
      <View style={[styles.tpAvatar, { backgroundColor: ROLE_COLORS[p.role] + '20', width: 28, height: 28, borderRadius: 14 }]}>
        <Text style={[styles.tpAvatarText, { color: ROLE_COLORS[p.role], fontSize: 10 }]}>{getInitials(p.nickname)}</Text>
      </View>
      <Text style={[styles.statName, dynamicStyles.text]} numberOfLines={1}>{p.nickname}</Text>
      <View style={styles.statControls}>
        {group?.show_scorers && (
          <View style={styles.statGroup}>
            <TouchableOpacity onPress={() => updateMatchStat(p.id, 'goals', -1)}><Ionicons name="remove-circle-outline" size={22} color="#8E8E93" /></TouchableOpacity>
            <Text style={[styles.statValueText, { color: '#FF3B30' }]}>{matchGoals[p.id] || 0} G</Text>
            <TouchableOpacity onPress={() => updateMatchStat(p.id, 'goals', 1)}><Ionicons name="add-circle-outline" size={22} color="#FF3B30" /></TouchableOpacity>
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
    return (
      <Modal visible={true} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <ViewShot ref={standingsViewShotRef} options={{ format: "png", quality: 0.9 }} style={{ width: '98%', backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 15, borderRadius: 20 }}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <View>
                  <Text style={[dynamicStyles.text, { fontSize: 24, fontWeight: '900' }]}>CLASSIFICA</Text>
                  <Text style={[dynamicStyles.subText, { fontSize: 14, fontWeight: '700' }]}>{group?.name || 'Superlega'}</Text>
                </View>
                <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 50, height: 50 }} resizeMode="contain" />
                </View>
             </View>

             <View style={[dynamicStyles.card, { borderRadius: 15, overflow: 'hidden' }]}>
                {/* Header */}
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', paddingVertical: 10, paddingHorizontal: 10 }}>
                   <View style={{ width: 100 }}><Text style={{ fontSize: 9, fontWeight: '900', color: '#8E8E93' }}>POS. GIOCATORE</Text></View>
                   <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
                     <StatHeader label="PT" width={30} />
                     <StatHeader label="G" width={30} />
                     <StatHeader label="A" width={30} />
                     <StatHeader label="INC" width={30} />
                     <StatHeader label="BON" width={30} />
                     <StatHeader label="PG" width={30} />
                   </View>
                </View>
                {standings.slice(0, 15).map((item, index) => (
                  <View key={item.player_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
                    <View style={{ width: 100, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 25, alignItems: 'center' }}>
                        {index < 3 ? (
                          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="ribbon" size={20} color={index === 0 ? '#FFD60A' : index === 1 ? '#C0C0C0' : '#CD7F32'} />
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                              <Text style={{ fontSize: 7, fontWeight: '900', color: '#000' }}>{index + 1}</Text>
                            </View>
                          </View>
                        ) : (
                          <Text style={[dynamicStyles.text, { fontSize: 12, fontWeight: '700' }]}>{index + 1}</Text>
                        )}
                      </View>
                      <Text style={[dynamicStyles.text, { fontSize: 12, fontWeight: '700', marginLeft: 5 }]} numberOfLines={1}>{item.nickname}</Text>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
                      <StatValue value={item.points} width={30} color={isDarkMode ? '#FFF' : '#1C1C1E'} />
                      <StatValue value={item.individual_goals} width={30} color="#FF3B30" />
                      <StatValue value={item.individual_assists} width={30} color="#34C759" />
                      <StatValue value={item.incisivity} width={30} color="#FF9500" />
                      <StatValue value={item.bonus_points} width={30} color="#5AC8FA" />
                      <StatValue value={item.played} width={30} bold={false} />
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
          <ViewShot ref={matchViewShotRef} options={{ format: "png", quality: 0.9 }} style={{ width: '95%', backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 25, borderRadius: 24 }}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <View style={[styles.teamsMetaInfo, { flex: 1, marginBottom: 0 }]}>
                  {m.description ? <Text style={[styles.teamsDescText, { color: isDarkMode ? '#FFFFFF' : '#1C1C1E', fontSize: 18 }]}>{m.description}</Text> : <Text style={[styles.teamsDescText, { color: isDarkMode ? '#FFFFFF' : '#1C1C1E', fontSize: 18 }]}>Risultato Partita</Text>}
                  <View style={styles.teamsDateTimeLoc}>
                    <Text style={[styles.teamsMetaText, { color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 13 }]}>
                      {new Date(m.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} ore {new Date(m.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {m.location && (
                      <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 2}}>
                        <Ionicons name="location-outline" size={12} color={isDarkMode ? '#AEAEB2' : '#8E8E93'} />
                        <Text style={[styles.teamsMetaText, { color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 13, marginLeft: 4 }]}>{m.location}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
                </View>
              </View>

              <View style={[styles.teamCard, dynamicStyles.card, { borderLeftWidth: 0, borderWidth: 2, borderColor: teamAHex, marginBottom: 12, padding: 14 }]}>
                 <View style={[styles.teamHeader, { marginBottom: 12 }]}>
                    <View style={[styles.jerseyBadge, { backgroundColor: teamAHex, borderWidth: teamAHex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' }]}><Ionicons name="shirt" size={18} color={getJerseyTextColor(m.team_a_color)} /></View>
                    <View style={{flex: 1}}>
                      <Text style={[styles.teamName, dynamicStyles.text, { fontSize: 16 }]}>{m.team_a_name}</Text>
                    </View>
                    <Text style={[dynamicStyles.text, { fontSize: 28, fontWeight: '900' }]}>{m.team_a_score}</Text>
                  </View>
                  {teamAPlayers.map(p => (
                    <View key={p.id} style={[styles.teamPlayerRow, { paddingVertical: 4 }]}>
                      <View style={[styles.tpAvatar, { backgroundColor: ROLE_COLORS[p.role] + '20', width: 28, height: 28 }]}><Text style={[styles.tpAvatarText, { color: ROLE_COLORS[p.role], fontSize: 10 }]}>{getInitials(p.nickname)}</Text></View>
                      <View style={styles.tpInfo}><Text style={[styles.tpName, dynamicStyles.text, { fontSize: 14 }]}>{p.nickname}</Text></View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                         {(m.goals?.[p.id] || 0) > 0 && (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                             <Ionicons name="football" size={14} color="#FF3B30" />
                             <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '800' }}>{m.goals![p.id]}</Text>
                           </View>
                         )}
                         {(m.assists?.[p.id] || 0) > 0 && (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                             <Ionicons name="people-outline" size={14} color="#34C759" />
                             <Text style={{ color: '#34C759', fontSize: 13, fontWeight: '800' }}>{m.assists![p.id]}</Text>
                           </View>
                         )}
                      </View>
                    </View>
                  ))}
                  {m.team_a_own_goals > 0 && (
                    <View style={[styles.teamPlayerRow, { paddingVertical: 4, opacity: 0.7 }]}>
                      <View style={{ flex: 1 }} />
                      <Text style={[dynamicStyles.subText, { fontSize: 12, fontStyle: 'italic' }]}>{m.team_a_own_goals} Autorete/i</Text>
                    </View>
                  )}
              </View>

              <View style={[styles.teamCard, dynamicStyles.card, { borderLeftWidth: 0, borderWidth: 2, borderColor: teamBHex, padding: 14 }]}>
                 <View style={[styles.teamHeader, { marginBottom: 12 }]}>
                    <View style={[styles.jerseyBadge, { backgroundColor: teamBHex, borderWidth: teamBHex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' }]}><Ionicons name="shirt" size={18} color={getJerseyTextColor(m.team_b_color)} /></View>
                    <View style={{flex: 1}}>
                      <Text style={[styles.teamName, dynamicStyles.text, { fontSize: 16 }]}>{m.team_b_name}</Text>
                    </View>
                    <Text style={[dynamicStyles.text, { fontSize: 28, fontWeight: '900' }]}>{m.team_b_score}</Text>
                  </View>
                  {teamBPlayers.map(p => (
                    <View key={p.id} style={[styles.teamPlayerRow, { paddingVertical: 4 }]}>
                      <View style={[styles.tpAvatar, { backgroundColor: ROLE_COLORS[p.role] + '20', width: 28, height: 28 }]}><Text style={[styles.tpAvatarText, { color: ROLE_COLORS[p.role], fontSize: 10 }]}>{getInitials(p.nickname)}</Text></View>
                      <View style={styles.tpInfo}><Text style={[styles.tpName, dynamicStyles.text, { fontSize: 14 }]}>{p.nickname}</Text></View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                         {(m.goals?.[p.id] || 0) > 0 && (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                             <Ionicons name="football" size={14} color="#FF3B30" />
                             <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '800' }}>{m.goals![p.id]}</Text>
                           </View>
                         )}
                         {(m.assists?.[p.id] || 0) > 0 && (
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                             <Ionicons name="people-outline" size={14} color="#34C759" />
                             <Text style={{ color: '#34C759', fontSize: 13, fontWeight: '800' }}>{m.assists![p.id]}</Text>
                           </View>
                         )}
                      </View>
                    </View>
                  ))}
                  {m.team_b_own_goals > 0 && (
                    <View style={[styles.teamPlayerRow, { paddingVertical: 4, opacity: 0.7 }]}>
                      <View style={{ flex: 1 }} />
                      <Text style={[dynamicStyles.subText, { fontSize: 12, fontStyle: 'italic' }]}>{m.team_b_own_goals} Autorete/i</Text>
                    </View>
                  )}
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
                <TouchableOpacity onPress={handleGenerate} style={styles.iconBtn}>
                  <Ionicons name="refresh" size={22} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowIndividualStrength(!showIndividualStrength)} style={styles.iconBtn}>
                  <Ionicons name={showIndividualStrength ? "eye-outline" : "eye-off-outline"} size={22} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShareImage} style={styles.iconBtn} disabled={sharing}>
                  <Ionicons name="share-social-outline" size={22} color="#007AFF" />
                </TouchableOpacity>
                {isAdminOrOwner && (
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

                {activeTab === 'standings' ? (
                  <TouchableOpacity onPress={handleShareStandings} style={styles.iconBtn}>
                    <Ionicons name="share-social-outline" size={24} color="#34C759" />
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => setShowConfig(!showConfig)} style={[styles.iconBtn, showConfig && { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
                      <Ionicons name="settings-outline" size={22} color="#007AFF" />
                    </TouchableOpacity>
                    {isAdminOrOwner && activeTab !== 'matches' && (
                      <TouchableOpacity style={styles.addBtn} onPress={() => router.push(`/player/add?groupId=${groupId}`)}>
                        <Ionicons name="add" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </>
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
                    {/* Numero Partita / Incremento - Decremento */}
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

                    {/* Opzioni e Bonus */}
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
                            <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '600' }]}>Bonus Portiere</Text>
                            <Switch scaleX={1.1} scaleY={1.1} trackColor={{ false: '#767577', true: '#34C759' }} thumbColor="#FFF" value={group?.use_gk_bonus} onValueChange={(v) => handleUpdateGroupSettings({ use_gk_bonus: v })} />
                          </View>
                          {group?.use_gk_bonus && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 }}>
                               <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '600' }]}>Goal Subiti {'<'}</Text>
                               <TextInput
                                 style={[styles.scoreInput, dynamicStyles.input, { width: 40, height: 30, fontSize: 13, fontWeight: '700', textAlign: 'center', padding: 0, borderRadius: 6 }]}
                                 keyboardType="numeric"
                                 value={String(group?.gk_bonus_threshold ?? 5)}
                                 onChangeText={(v) => handleUpdateGroupSettings({ gk_bonus_threshold: parseInt(v) || 0 })}
                               />
                            </View>
                          )}
                        </View>

                        <View style={styles.bonusRow}>
                          <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '600' }]}>Bonus Clean Sheet</Text>
                          <Switch scaleX={1.1} scaleY={1.1} trackColor={{ false: '#767577', true: '#34C759' }} thumbColor="#FFF" value={group?.use_clean_sheet_bonus} onValueChange={(v) => handleUpdateGroupSettings({ use_clean_sheet_bonus: v })} />
                        </View>
                      </View>
                    )}

                    {/* Gestione Dati */}
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

                    {/* Token */}
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

            <View style={styles.tabsWrapper}>
              <View style={[styles.filterContainer, { flexDirection: 'row', gap: 6 }]}>
                {[
                  { id: 'teams', icon: 'flash', label: 'Genera' },
                  { id: 'standings', icon: 'trophy', label: 'Classifica' },
                  { id: 'matches', icon: 'list', label: 'Risultati' }
                ].map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.filterChip,
                      dynamicStyles.card,
                      {
                        flex: 1,
                        marginRight: 0,
                        height: 48,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center'
                      },
                      activeTab === t.id && { backgroundColor: '#007AFF', borderColor: '#007AFF' }
                    ]}
                    onPress={() => setActiveTab(activeTab === t.id ? 'players' : t.id as any)}
                  >
                    <Ionicons name={t.icon as any} size={16} color={activeTab === t.id ? '#FFF' : '#8E8E93'} />
                    <Text
                      style={[styles.filterText, { marginLeft: 4 }, activeTab === t.id ? { color: '#FFFFFF', fontWeight: '900' } : dynamicStyles.text]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {activeTab === 'players' && (
              <View style={{ flex: 1 }}>
                <View style={[styles.searchContainer, dynamicStyles.card, { marginHorizontal: 0, marginTop: 4, marginBottom: 12, borderRadius: 0, borderLeftWidth: 0, borderRightWidth: 0 }]}>
                  <Ionicons name="search" size={20} color="#8E8E93" style={{ marginLeft: 16, marginRight: 8 }} />
                  <TextInput style={[styles.searchInput, dynamicStyles.text]} placeholder="Cerca giocatore..." placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} value={search} onChangeText={setSearch} />
                </View>
                {renderRoleFilter(selectedRole, setSelectedRole)}
                <FlatList
                  data={players.filter(p => (selectedRole ? p.role === selectedRole : true) && (search ? p.nickname.toLowerCase().includes(search.toLowerCase()) : true))}
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
                 {renderRoleFilter(teamSelectedRole, setTeamSelectedRole)}
                 <View style={[styles.selHeader, { marginTop: 8, marginBottom: 4 }]}><Text style={[styles.selCount, dynamicStyles.subText]}>{selectedIds.size} / {matchType * 2}</Text><TouchableOpacity onPress={selectAll}><Text style={styles.selAllText}>Tutti</Text></TouchableOpacity></View>
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
                 <View style={styles.genBar}><TouchableOpacity style={[styles.genBtn, selectedIds.size !== matchType * 2 && styles.genBtnDisabled]} onPress={handleGenerate} disabled={generating || selectedIds.size !== matchType * 2}><Text style={styles.genText}>Genera Squadre</Text></TouchableOpacity></View>
              </View>
            )}

            {activeTab === 'standings' && renderStandings()}
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
                <View style={{ marginBottom: 20, paddingHorizontal: 10 }}>
                   <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 13, marginBottom: 8 }]}>Dettagli Partita</Text>
                   <TextInput
                     style={[styles.searchInput, dynamicStyles.text, { height: 40, borderBottomWidth: 1, borderBottomColor: dynamicStyles.divider.backgroundColor, marginBottom: 12 }]}
                     placeholder="Descrizione (es. Giornata 1)"
                     value={matchDescription}
                     onChangeText={setMatchDescription}
                   />
                   <View style={{flexDirection: 'row', gap: 10}}>
                      <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.filterChip, dynamicStyles.card, {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 0, height: 40}]}>
                        <Ionicons name="calendar-outline" size={16} color="#007AFF" style={{marginRight: 6}} />
                        <Text style={dynamicStyles.text}>{matchDate.toLocaleDateString('it-IT')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowTimePicker(true)} style={[styles.filterChip, dynamicStyles.card, {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 0, height: 40}]}>
                        <Ionicons name="time-outline" size={16} color="#007AFF" style={{marginRight: 6}} />
                        <Text style={dynamicStyles.text}>{matchDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </TouchableOpacity>
                   </View>
                   <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', borderRadius: 10, paddingHorizontal: 10, height: 40, marginTop: 12}}>
                      <Ionicons name="location-outline" size={18} color="#8E8E93" />
                      <TextInput style={[styles.searchInput, dynamicStyles.text, { flex: 1, marginLeft: 6 }]} placeholder="Luogo partita..." placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} value={matchLocation} onChangeText={setMatchLocation} />
                   </View>
                </View>

                <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, marginBottom: 20, opacity: 0.3 }]} />

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, paddingHorizontal: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 12, marginBottom: 4 }]}>Nome A</Text>
                    <TextInput
                      style={[styles.scoreInput, dynamicStyles.input, { height: 40, fontSize: 14, fontWeight: '700' }]}
                      value={editMatchNameA}
                      onChangeText={setEditMatchNameA}
                    />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {JERSEY_COLORS.map(c => (
                        <TouchableOpacity key={c.value} onPress={() => setEditMatchColorA(c.value)} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.hex, borderWidth: editMatchColorA === c.value ? 2 : 1, borderColor: editMatchColorA === c.value ? '#007AFF' : '#D1D1D6' }} />
                      ))}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 12, marginBottom: 4, textAlign: 'right' }]}>Nome B</Text>
                    <TextInput
                      style={[styles.scoreInput, dynamicStyles.input, { height: 40, fontSize: 14, fontWeight: '700', textAlign: 'right' }]}
                      value={editMatchNameB}
                      onChangeText={setEditMatchNameB}
                    />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
                      {JERSEY_COLORS.map(c => (
                        <TouchableOpacity key={c.value} onPress={() => setEditMatchColorB(c.value)} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.hex, borderWidth: editMatchColorB === c.value ? 2 : 1, borderColor: editMatchColorB === c.value ? '#007AFF' : '#D1D1D6' }} />
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.scoreInputRow}>
                  <View style={styles.scoreField}>
                    <Text style={[styles.scoreLabel, dynamicStyles.text]} numberOfLines={1}>{editMatchNameA}</Text>
                    <TextInput style={[styles.scoreInput, dynamicStyles.input]} keyboardType="numeric" value={scoreA} onChangeText={setScoreA} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                       <TouchableOpacity onPress={() => updateOwnGoals('a', -1)}><Ionicons name="remove-circle-outline" size={20} color="#8E8E93" /></TouchableOpacity>
                       <Text style={[dynamicStyles.text, { fontSize: 12, fontWeight: '700' }]}>{teamAOwnGoals} Autoreti</Text>
                       <TouchableOpacity onPress={() => updateOwnGoals('a', 1)}><Ionicons name="add-circle-outline" size={20} color="#FF9500" /></TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[styles.vsTextModal, dynamicStyles.text]}>-</Text>
                  <View style={styles.scoreField}>
                    <Text style={[styles.scoreLabel, dynamicStyles.text, { textAlign: 'right' }]} numberOfLines={1}>{editMatchNameB}</Text>
                    <TextInput style={[styles.scoreInput, dynamicStyles.input]} keyboardType="numeric" value={scoreB} onChangeText={setScoreB} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                       <TouchableOpacity onPress={() => updateOwnGoals('b', -1)}><Ionicons name="remove-circle-outline" size={20} color="#8E8E93" /></TouchableOpacity>
                       <Text style={[dynamicStyles.text, { fontSize: 12, fontWeight: '700' }]}>{teamBOwnGoals} Autoreti</Text>
                       <TouchableOpacity onPress={() => updateOwnGoals('b', 1)}><Ionicons name="add-circle-outline" size={20} color="#FF9500" /></TouchableOpacity>
                    </View>
                  </View>
                </View>

                <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 13, marginLeft: 10, marginBottom: 10 }]}>Statistiche Giocatori</Text>

                <View style={{ backgroundColor: getJerseyHex(editMatchColorA) + '15', borderRadius: 16, padding: 10, marginBottom: 15, borderWidth: 1, borderColor: getJerseyHex(editMatchColorA) + '30' }}>
                  <Text style={[dynamicStyles.text, { fontSize: 11, fontWeight: '900', marginBottom: 10, color: getJerseyTextColor(editMatchColorA) === '#FFFFFF' ? getJerseyHex(editMatchColorA) : '#8E8E93' }]}>{editMatchNameA.toUpperCase()}</Text>
                  {teamAParticipants.map(p => renderPlayerStatRow(p))}
                </View>

                <View style={{ backgroundColor: getJerseyHex(editMatchColorB) + '15', borderRadius: 16, padding: 10, marginBottom: 15, borderWidth: 1, borderColor: getJerseyHex(editMatchColorB) + '30' }}>
                  <Text style={[dynamicStyles.text, { fontSize: 11, fontWeight: '900', marginBottom: 10, color: getJerseyTextColor(editMatchColorB) === '#FFFFFF' ? getJerseyHex(editMatchColorB) : '#8E8E93' }]}>{editMatchNameB.toUpperCase()}</Text>
                  {teamBParticipants.map(p => renderPlayerStatRow(p))}
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveResult}><Text style={styles.saveBtnText}>Salva Risultato</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {renderMatchSharePreview()}
        {renderStandingsSharePreview()}
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
  pCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 0, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 0, borderBottomWidth: 1, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 },
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
  selCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 0, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 0, borderBottomWidth: 1, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 },
  selCardActive: { backgroundColor: 'rgba(0,122,255,0.05)' },
  chk: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#8E8E93', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  chkActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  selPlayerInfo: { flex: 1 },
  selNick: { fontSize: 16, fontWeight: '700' },
  selRole: { fontSize: 11, fontWeight: '600' },
  genBar: { position: 'absolute', bottom: 5, left: 20, right: 20 },
  genBtn: { backgroundColor: '#007AFF', borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  genBtnDisabled: { backgroundColor: '#AEAEB2' },
  genText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
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
  teamCard: { borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  jerseyBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  teamName: { fontSize: 18, fontWeight: '800' },
  teamStatsSub: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  teamPlayerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
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
});
