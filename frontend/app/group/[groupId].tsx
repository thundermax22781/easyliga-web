import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  fetchPlayers,
  deletePlayer,
  generateTeams,
  importPlayersExcel,
  exportPlayersExcel,
  fetchGroups,
  saveMatchResult,
  calculateStandings,
  updateGroup,
  fetchMatches,
  deleteMatch,
  createFullBackup,
  restoreFullBackup,
  Player,
  ROLES,
  ROLE_COLORS,
  TeamResult,
  JERSEY_COLORS,
  MATCH_TYPES,
  Group,
  PlayerStats,
  Match,
} from '../../src/api';
import { useTheme } from '../../src/ThemeContext';
import * as DocumentPicker from 'expo-document-picker';
import ViewShot from "react-native-view-shot";
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';

type TabType = 'players' | 'teams' | 'standings' | 'matches';

export default function GroupDetailScreen() {
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useTheme();
  const { groupId, name } = useLocalSearchParams<{ groupId: string; name: string }>();
  const groupName = name ? decodeURIComponent(name) : 'Gruppo';
  const viewShotRef = useRef<any>(null);

  const [activeTab, setActiveTab] = useState<TabType>('players');
  const [players, setPlayers] = useState<Player[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Standings & Matches state
  const [standings, setStandings] = useState<PlayerStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  // Players tab state
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Teams tab state
  const [teamSearch, setTeamSearch] = useState('');
  const [teamSelectedRole, setTeamSelectedRole] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [teams, setTeams] = useState<TeamResult | null>(null);
  const [showIndividualStrength, setShowIndividualStrength] = useState(true);
  const [matchType, setMatchType] = useState(5);
  const [teamAName, setTeamAName] = useState('Squadra A');
  const [teamBName, setTeamBName] = useState('Squadra B');
  const [teamAColor, setTeamAColor] = useState('Bianca');
  const [teamBColor, setTeamBColor] = useState('Rossa');

  // Result Recording Modal
  const [showResultModal, setShowResultModal] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('0');
  const [scoreB, setScoreB] = useState('0');
  const [matchGoals, setMatchGoals] = useState<Record<string, number>>({});
  const [matchAssists, setMatchAssists] = useState<Record<string, number>>({});
  const [teamAOwnGoals, setTeamAOwnGoals] = useState(0);
  const [teamBOwnGoals, setTeamBOwnGoals] = useState(0);
  const [teamAParticipants, setTeamAParticipants] = useState<Player[]>([]);
  const [teamBParticipants, setTeamBParticipants] = useState<Player[]>([]);

  // Date and Time State
  const [matchDescription, setMatchDescription] = useState('');
  const [matchDate, setMatchDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [matchLocation, setMatchLocation] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const dynamicStyles = {
    container: { backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7' },
    text: { color: isDarkMode ? '#FFFFFF' : '#1C1C1E' },
    subText: { color: isDarkMode ? '#AEAEB2' : '#8E8E93' },
    card: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF' },
    input: { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', color: isDarkMode ? '#FFF' : '#1C1C1E' },
    tabBar: { backgroundColor: isDarkMode ? '#2C2C2E' : '#E5E5EA' },
    tabActive: { backgroundColor: isDarkMode ? '#3A3A3C' : '#FFFFFF' },
    modalContent: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF' },
    optionCard: { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' },
    divider: { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
  };

  const filteredPlayersForTeams = useMemo(() => {
    let filtered = players;
    if (teamSearch) {
      const s = teamSearch.toLowerCase();
      filtered = filtered.filter(p =>
        p.nickname.toLowerCase().includes(s) ||
        (p.name && p.name.toLowerCase().includes(s))
      );
    }
    if (teamSelectedRole) {
      filtered = filtered.filter(p => p.role === teamSelectedRole);
    }
    return filtered;
  }, [players, teamSearch, teamSelectedRole]);

  const loadData = useCallback(async () => {
    if (!groupId) return;
    try {
      const groups = await fetchGroups();
      const currentGroup = groups.find(g => g.id === groupId);
      if (currentGroup) setGroup(currentGroup);

      if (activeTab === 'standings') {
        const stats = await calculateStandings(groupId);
        setStandings(stats);
      } else if (activeTab === 'matches') {
        const matchData = await fetchMatches(groupId);
        setMatches(matchData);
      } else {
        const playersData = await fetchPlayers({
          group_id: groupId,
          search: activeTab === 'players' ? (search || undefined) : undefined,
          role: activeTab === 'players' ? (selectedRole || undefined) : undefined,
        });
        setPlayers(playersData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, search, selectedRole, activeTab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const handleUpdateGroupSettings = async (updates: Partial<Group>) => {
    if (!groupId) return;
    try {
      const updatedGroup = await updateGroup(groupId, updates);
      setGroup(updatedGroup);
    } catch (e) {
      Alert.alert('Errore', 'Impossibile aggiornare le impostazioni');
    }
  };

  const handleDeletePlayer = (player: Player) => {
    Alert.alert('Elimina Giocatore', `Vuoi eliminare ${player.nickname}?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePlayer(player.id);
            loadData();
          } catch (e) {
            Alert.alert('Errore', 'Impossibile eliminare il giocatore');
          }
        },
      },
    ]);
  };

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        const player = players.find(p => p.id === id);
        if (player?.role === 'Portiere') {
          const selectedPlayers = players.filter(p => next.has(p.id));
          const portiereCount = selectedPlayers.filter(p => p.role === 'Portiere').length;
          if (portiereCount >= 2) {
            Alert.alert('Limite Portieri', 'Puoi selezionare al massimo 2 portieri.');
            return prev;
          }
        }
        const maxPlayers = matchType * 2;
        if (next.size >= maxPlayers) {
          Alert.alert('Limite Raggiunto', `Puoi selezionare al massimo ${maxPlayers} giocatori.`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const maxToSelect = matchType * 2;
    if (selectedIds.size === maxToSelect || selectedIds.size === players.length) {
      setSelectedIds(new Set());
      return;
    }
    const finalSelection = players.slice(0, maxToSelect);
    setSelectedIds(new Set(finalSelection.map(p => p.id)));
  };

  const handleGenerate = async () => {
    const requiredPlayers = matchType * 2;
    if (selectedIds.size < requiredPlayers) {
      Alert.alert('Attenzione', `Servono esattamente ${requiredPlayers} giocatori.`);
      return;
    }
    setGenerating(true);
    try {
      const result = await generateTeams(Array.from(selectedIds), matchType, groupId, teamAName, teamBName, teamAColor, teamBColor, matchDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }), matchDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), matchLocation, matchDescription);
      setTeams(result);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Errore nella generazione');
    } finally {
      setGenerating(false);
    }
  };

  const swapPlayer = (playerId: string, fromTeam: 'a' | 'b') => {
    if (!teams) return;
    const playerToMove = (fromTeam === 'a' ? teams.team_a : teams.team_b).find(p => p.id === playerId);
    if (!playerToMove) return;

    if (playerToMove.role === 'Portiere') {
      const otherTeamKey = fromTeam === 'a' ? 'b' : 'a';
      const otherPortiere = (fromTeam === 'a' ? teams.team_b : teams.team_a).find(p => p.role === 'Portiere');

      if (otherPortiere) {
        // Scambio dei due portieri
        const newTeamA = fromTeam === 'a'
          ? [...teams.team_a.filter(p => p.id !== playerId), otherPortiere]
          : [...teams.team_a.filter(p => p.id !== otherPortiere.id), playerToMove];

        const newTeamB = fromTeam === 'b'
          ? [...teams.team_b.filter(p => p.id !== playerId), otherPortiere]
          : [...teams.team_b.filter(p => p.id !== otherPortiere.id), playerToMove];

        setTeams({
          ...teams,
          team_a: newTeamA,
          team_b: newTeamB,
          team_a_total_strength: Number(newTeamA.reduce((acc, p) => acc + p.strength, 0).toFixed(1)),
          team_b_total_strength: Number(newTeamB.reduce((acc, p) => acc + p.strength, 0).toFixed(1)),
        });
        return;
      }
    }

    const newTeamA = fromTeam === 'a'
      ? teams.team_a.filter(p => p.id !== playerId)
      : [...teams.team_a, playerToMove];

    const newTeamB = fromTeam === 'b'
      ? teams.team_b.filter(p => p.id !== playerId)
      : [...teams.team_b, playerToMove];

    const getSum = (t: Player[]) => t.reduce((acc, p) => acc + p.strength, 0);
    const getAvgAge = (t: Player[]) => t.length ? t.reduce((acc, p) => acc + p.age, 0) / t.length : 0;

    setTeams({
      ...teams,
      team_a: newTeamA,
      team_b: newTeamB,
      team_a_total_strength: Number(getSum(newTeamA).toFixed(1)),
      team_b_total_strength: Number(getSum(newTeamB).toFixed(1)),
      team_a_avg_age: Number(getAvgAge(newTeamA).toFixed(1)),
      team_b_avg_age: Number(getAvgAge(newTeamB).toFixed(1)),
    });
  };

  const handleOpenResultModal = (match?: Match) => {
    if (match) {
      setEditingMatchId(match.id);
      setScoreA(match.team_a_score.toString());
      setScoreB(match.team_b_score.toString());
      setMatchGoals(match.goals || {});
      setMatchAssists(match.assists || {});
      setTeamAOwnGoals(match.team_a_own_goals || 0);
      setTeamBOwnGoals(match.team_b_own_goals || 0);

      const aPlayers = players.filter(p => match.team_a_players.includes(p.id));
      const bPlayers = players.filter(p => match.team_b_players.includes(p.id));
      setTeamAParticipants(aPlayers);
      setTeamBParticipants(bPlayers);
    } else if (teams) {
      setEditingMatchId(null);
      setScoreA('0');
      setScoreB('0');
      setMatchGoals({});
      setMatchAssists({});
      setTeamAOwnGoals(0);
      setTeamBOwnGoals(0);
      setTeamAParticipants(teams.team_a);
      setTeamBParticipants(teams.team_b);
    }
    setShowResultModal(true);
  };

  const handleSaveResult = async () => {
    if (!groupId || (!teams && !editingMatchId)) return;
    try {
      if (editingMatchId) {
        const match = matches.find(m => m.id === editingMatchId);
        if (!match) return;
        await saveMatchResult({
          ...match,
          team_a_score: parseInt(scoreA) || 0,
          team_b_score: parseInt(scoreB) || 0,
          goals: group?.show_scorers ? matchGoals : undefined,
          assists: group?.show_assists ? matchAssists : undefined,
          team_a_own_goals: teamAOwnGoals,
          team_b_own_goals: teamBOwnGoals,
        });
      } else if (teams) {
        await saveMatchResult({
          group_id: groupId,
          team_a_players: teams.team_a.map(p => p.id),
          team_b_players: teams.team_b.map(p => p.id),
          team_a_score: parseInt(scoreA) || 0,
          team_b_score: parseInt(scoreB) || 0,
          team_a_name: teams.team_a_name,
          team_b_name: teams.team_b_name,
          date: matchDate.toISOString(),
          description: matchDescription || teams.description,
          goals: group?.show_scorers ? matchGoals : undefined,
          assists: group?.show_assists ? matchAssists : undefined,
          team_a_own_goals: teamAOwnGoals,
          team_b_own_goals: teamBOwnGoals,
        });
      }
      Alert.alert('Successo', 'Risultato registrato!');
      setShowResultModal(false);
      setTeams(null);
      setActiveTab('matches');
      loadData();
    } catch (e: any) {
      Alert.alert('Errore', 'Impossibile salvare il risultato');
    }
  };

  const handleDeleteMatch = (matchId: string) => {
    Alert.alert('Elimina Partita', 'Vuoi eliminare questa partita dallo storico?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
          await deleteMatch(matchId);
          loadData();
      }}
    ]);
  };

  const handleShareImage = async () => {
    if (!viewShotRef.current) return;
    setSharing(true);
    setTimeout(async () => {
      try {
        const uri = await viewShotRef.current.capture();
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Condividi Squadre Equiliga' });
      } catch (e) {
        Alert.alert('Errore', 'Impossibile generare l\'immagine');
      } finally {
        setSharing(false);
      }
    }, 100);
  };

  const handleExportPlayers = async () => {
    try {
      const data = await exportPlayersExcel(groupId!);
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Giocatori");
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const filename = FileSystem.cacheDirectory + `giocatori_${groupName.replace(/\s/g, '_')}.xlsx`;
      await FileSystem.writeAsStringAsync(filename, base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(filename);
    } catch (e) {
      Alert.alert('Errore', 'Impossibile esportare i giocatori');
    }
  };

  const handleImportPlayers = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'] });
      if (res.canceled) return;
      setImporting(true);
      const file = res.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const wb = XLSX.read(base64, { type: 'base64' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      await importPlayersExcel(groupId!, data);
      Alert.alert('Successo', 'Giocatori importati correttamente');
      loadData();
    } catch (e) {
      Alert.alert('Errore', 'Impossibile importare i giocatori. Controlla il formato del file.');
    } finally {
      setImporting(false);
    }
  };

  const handleCreateGroupBackup = async () => {
    try {
      const json = await createFullBackup(groupId!);
      const filename = FileSystem.cacheDirectory + `backup_${groupName.replace(/\s/g, '_')}.json`;
      await FileSystem.writeAsStringAsync(filename, json);
      await Sharing.shareAsync(filename, { dialogTitle: 'Salva backup gruppo' });
    } catch (e) {
      Alert.alert('Errore', 'Impossibile creare il backup');
    }
  };

  const handleRestoreGroupBackup = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (res.canceled) return;
      const file = res.assets[0];
      const json = await FileSystem.readAsStringAsync(file.uri);

      Alert.alert('Ripristina Backup', 'Questo sovrascriverà tutti i dati attuali del gruppo. Continuare?', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Ripristina', style: 'destructive', onPress: async () => {
          try {
            await restoreFullBackup(groupId!, json);
            Alert.alert('Successo', 'Gruppo ripristinato correttamente');
            loadData();
          } catch (e: any) {
            Alert.alert('Errore', e.message);
          }
        }}
      ]);
    } catch (e) {
      Alert.alert('Errore', 'Impossibile caricare il file di backup');
    }
  };

  const handleShareToken = (type: 'admin' | 'viewer') => {
    if (!group) return;
    const token = type === 'admin' ? group.id : group.id; // Al momento usiamo l'ID come token unico
    const roleName = type === 'admin' ? 'Amministratore' : 'Visualizzatore';
    const message = `Entra nel gruppo "${group.name}" su Equiliga come ${roleName}!\n\nCodice di accesso:\n${token}`;
    Share.share({ message });
  };

  const getInitials = (nickname: string) => nickname.substring(0, 2).toUpperCase();
  const getJerseyHex = (colorName: string) => JERSEY_COLORS.find((c) => c.value === colorName)?.hex || '#FFFFFF';
  const getJerseyTextColor = (colorName: string) => (colorName === 'Bianca' || colorName === 'Gialla') ? '#1C1C1E' : '#FFFFFF';

  const calculateTotalScore = (goals: Record<string, number>, teamAOG: number, teamBOG: number) => {
    let scoreA = teamBOG; // Team A points from Team B own goals
    let scoreB = teamAOG; // Team B points from Team A own goals

    const teamAPlayerIds = teamAParticipants.map(p => p.id);
    const teamBPlayerIds = teamBParticipants.map(p => p.id);

    Object.entries(goals).forEach(([pid, val]) => {
      if (teamAPlayerIds.includes(pid)) scoreA += val;
      if (teamBPlayerIds.includes(pid)) scoreB += val;
    });

    setScoreA(scoreA.toString());
    setScoreB(scoreB.toString());
  };

  const updateMatchStat = (playerId: string, type: 'goals' | 'assists', delta: number) => {
    if (type === 'goals') {
      const newGoals = { ...matchGoals, [playerId]: Math.max(0, (matchGoals[playerId] || 0) + delta) };
      setMatchGoals(newGoals);
      calculateTotalScore(newGoals, teamAOwnGoals, teamBOwnGoals);
    } else {
      setMatchAssists(prev => ({ ...prev, [playerId]: Math.max(0, (prev[playerId] || 0) + delta) }));
    }
  };

  const updateOwnGoals = (team: 'a' | 'b', delta: number) => {
    if (team === 'a') {
      const newVal = Math.max(0, teamAOwnGoals + delta);
      setTeamAOwnGoals(newVal);
      calculateTotalScore(matchGoals, newVal, teamBOwnGoals);
    } else {
      const newVal = Math.max(0, teamBOwnGoals + delta);
      setTeamBOwnGoals(newVal);
      calculateTotalScore(matchGoals, teamAOwnGoals, newVal);
    }
  };

  const renderStandings = () => {
    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
    if (standings.length === 0) return <View style={styles.center}><Ionicons name="trophy-outline" size={64} color="#D1D1D6" /><Text style={[styles.emptyText, dynamicStyles.subText]}>Nessuna partita giocata</Text></View>;

    return (
      <FlatList
        data={standings}
        keyExtractor={(item) => item.player_id}
        renderItem={({ item, index }) => (
          <View style={[styles.pCard, dynamicStyles.card]}>
            <View style={styles.standingRank}><Text style={[styles.rankText, dynamicStyles.subText]}>{index + 1}</Text></View>
            <View style={styles.pInfo}>
              <Text style={[styles.pNickname, dynamicStyles.text]}>{item.nickname}</Text>
              <Text style={[styles.pRoleText, { color: ROLE_COLORS[item.role] }]}>{item.role}</Text>
            </View>
            <View style={styles.standingStats}>
              <View style={styles.statBox}><Text style={[styles.statValue, dynamicStyles.text]}>{item.points}</Text><Text style={styles.statLabel}>PT</Text></View>
              {group?.show_scorers && <View style={styles.statBox}><Text style={[styles.statValue, { color: '#FF3B30' }]}>{item.individual_goals}</Text><Text style={styles.statLabel}>GOL</Text></View>}
              {group?.show_assists && <View style={styles.statBox}><Text style={[styles.statValue, { color: '#34C759' }]}>{item.individual_assists}</Text><Text style={styles.statLabel}>AST</Text></View>}
              <View style={styles.statBox}><Text style={[styles.statValue, dynamicStyles.subText]}>{item.played}</Text><Text style={styles.statLabel}>PG</Text></View>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      />
    );
  };

  const renderMatches = () => {
    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
    return (
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.matchCard, dynamicStyles.card]}>
            <View style={styles.matchDateRow}>
              <View>
                {item.description && <Text style={[styles.matchDescText, dynamicStyles.text]}>{item.description}</Text>}
                <Text style={[styles.matchDateText, dynamicStyles.subText]}>{new Date(item.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <View style={{flexDirection: 'row', gap: 10}}>
                <TouchableOpacity onPress={() => handleOpenResultModal(item)}><Ionicons name="create-outline" size={20} color="#007AFF" /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteMatch(item.id)}><Ionicons name="trash-outline" size={20} color="#FF3B30" /></TouchableOpacity>
              </View>
            </View>
            <View style={styles.matchScoreRow}>
              <View style={styles.teamScoreInfo}><Text style={[styles.teamScoreName, dynamicStyles.text]} numberOfLines={1}>{item.team_a_name}</Text></View>
              <View style={[styles.scoreBadge, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' }]}>
                <Text style={[styles.scoreValue, dynamicStyles.text]}>{item.team_a_score} - {item.team_b_score}</Text>
              </View>
              <View style={styles.teamScoreInfo}><Text style={[styles.teamScoreName, dynamicStyles.text, {textAlign: 'right'}]} numberOfLines={1}>{item.team_b_name}</Text></View>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      />
    );
  };

  const renderTeamsResult = () => {
    if (!teams) return null;
    const teamAHex = getJerseyHex(teams.team_a_color);
    const teamBHex = getJerseyHex(teams.team_b_color);
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setTeams(null)} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#007AFF" /></TouchableOpacity>
          <View style={styles.teamsHeaderControls}>
            <Text style={[styles.headerTitle, dynamicStyles.text]} numberOfLines={1} ellipsizeMode="tail">Squadre</Text>
            <View style={styles.headerBtns}>
               <TouchableOpacity onPress={toggleTheme} style={styles.iconShareBtn}><Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={22} color={isDarkMode ? "#FFD60A" : "#007AFF"} /></TouchableOpacity>
               <TouchableOpacity onPress={handleGenerate} style={styles.iconShareBtn}><Ionicons name="refresh" size={22} color="#007AFF" /></TouchableOpacity>
               <TouchableOpacity onPress={() => setShowIndividualStrength(!showIndividualStrength)} style={styles.iconShareBtn}><Ionicons name={showIndividualStrength ? "eye-outline" : "eye-off-outline"} size={22} color="#007AFF" /></TouchableOpacity>
               <TouchableOpacity onPress={handleShareImage} style={styles.iconShareBtn} disabled={sharing}><Ionicons name="share-social-outline" size={22} color="#007AFF" /></TouchableOpacity>
               <TouchableOpacity onPress={() => handleOpenResultModal()} style={styles.iconShareBtn}><Ionicons name="trophy-outline" size={22} color="#FFD60A" /></TouchableOpacity>
            </View>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Match Details Editor - Visible only when not sharing */}
          {!sharing && (
            <View style={[styles.configContainer, dynamicStyles.card, { marginHorizontal: 20, marginBottom: 12, padding: 12 }]}>
              <Text style={[styles.configSectionTitle, dynamicStyles.text, { marginBottom: 10 }]}>Dettagli Partita</Text>
              <TextInput style={[styles.searchInput, dynamicStyles.text, { height: 40, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#3A3A3C' : '#E5E5EA', marginBottom: 10 }]} placeholder="Descrizione (es. Giornata 1)" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} value={matchDescription} onChangeText={setMatchDescription} />
              <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.filterChip, {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}]}>
                  <Ionicons name="calendar-outline" size={16} color="#007AFF" style={{marginRight: 6}} />
                  <Text style={dynamicStyles.text}>{matchDate.toLocaleDateString('it-IT')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTimePicker(true)} style={[styles.filterChip, {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}]}>
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

          {showDatePicker && (
            <DateTimePicker value={matchDate} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(false); if(d) setMatchDate(d); }} />
          )}
          {showTimePicker && (
            <DateTimePicker value={matchDate} mode="time" display="default" onChange={(e, d) => { setShowTimePicker(false); if(d) setMatchDate(d); }} />
          )}

          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }} style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: sharing ? 20 : 10 }}>
            <View style={styles.teamsContainer}>
              <View style={styles.teamsMetaInfo}>
                {matchDescription ? <Text style={[styles.teamsDescText, dynamicStyles.text]}>{matchDescription}</Text> : (teams.description ? <Text style={[styles.teamsDescText, dynamicStyles.text]}>{teams.description}</Text> : null)}
                <View style={styles.teamsDateTimeLoc}>
                  <Text style={[styles.teamsMetaText, dynamicStyles.subText]}>
                    {matchDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} ore {matchDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {matchLocation && <Text style={[styles.teamsMetaText, dynamicStyles.subText]}>{matchLocation}</Text>}
                </View>
              </View>

              {[ { team: teams.team_a, name: teams.team_a_name, hex: teamAHex, color: teams.team_a_color, key: 'a' as const, strength: teams.team_a_total_strength, age: teams.team_a_avg_age }, { team: teams.team_b, name: teams.team_b_name, hex: teamBHex, color: teams.team_b_color, key: 'b' as const, strength: teams.team_b_total_strength, age: teams.team_b_avg_age } ].map((t, i) => (
                <View key={i} style={[styles.teamCard, dynamicStyles.card, { borderLeftWidth: 4, borderLeftColor: t.hex }]}>
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
                          <TouchableOpacity onPress={() => swapPlayer(p.id, t.key)} style={styles.swapBtn}><Ionicons name="swap-horizontal" size={20} color="#007AFF" /></TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ViewShot>
          <TouchableOpacity style={styles.mainShareBtn} onPress={() => handleOpenResultModal()}><Ionicons name="save-outline" size={20} color="#FFF" style={{marginRight: 8}} /><Text style={styles.mainShareBtnText}>Registra Risultato Partita</Text></TouchableOpacity>
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

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} enabled={!teams}>
        {teams ? renderTeamsResult() : (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#007AFF" /></TouchableOpacity>
              <Text style={[styles.headerTitle, dynamicStyles.text]} numberOfLines={1} ellipsizeMode="tail">{groupName}</Text>
              <View style={styles.headerBtns}>
                <TouchableOpacity onPress={handleImportPlayers} style={styles.iconBtn} disabled={importing}>
                  <Ionicons name="cloud-download-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleExportPlayers} style={styles.iconBtn}>
                  <Ionicons name="share-outline" size={24} color="#34C759" />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
                  <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={22} color={isDarkMode ? "#FFD60A" : "#007AFF"} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, showConfig && { backgroundColor: 'rgba(0,122,255,0.1)' }]} onPress={() => setShowConfig(!showConfig)}>
                  <Ionicons name="settings-outline" size={22} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={() => router.push(`/player/add?groupId=${groupId}`)}>
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {showConfig && (
              <View style={[styles.configContainer, dynamicStyles.card]}>
                <View style={styles.configSection}>
                  <Text style={[styles.configSectionTitle, dynamicStyles.text]}>Tipo di Partita</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {MATCH_TYPES.map((type) => (
                      <TouchableOpacity key={type.value} style={[styles.matchTypeChip, matchType === type.value && styles.matchTypeChipActive]} onPress={() => setMatchType(type.value)}>
                        <Text style={[styles.matchTypeLabel, matchType === type.value && styles.matchTypeLabelActive]}>{type.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {group?.storage_type === 'cloud' && (
                  <View style={[styles.configSection, { marginTop: 15 }]}>
                    <Text style={[styles.configSectionTitle, dynamicStyles.text]}>Condividi Gruppo Cloud</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                      <TouchableOpacity
                        style={[styles.matchTypeChip, { flex: 1, justifyContent: 'center', borderColor: '#007AFF' }]}
                        onPress={() => handleShareToken('admin')}
                      >
                        <Ionicons name="shield-outline" size={16} color="#007AFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.matchTypeLabel, { color: '#007AFF' }]}>Token Admin</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.matchTypeChip, { flex: 1, justifyContent: 'center', borderColor: '#34C759' }]}
                        onPress={() => handleShareToken('viewer')}
                      >
                        <Ionicons name="eye-outline" size={16} color="#34C759" style={{ marginRight: 6 }} />
                        <Text style={[styles.matchTypeLabel, { color: '#34C759' }]}>Token Viewer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={[styles.configSection, { marginTop: 15 }]}>
                  <Text style={[styles.configSectionTitle, dynamicStyles.text]}>Backup Gruppo Completo</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity style={[styles.matchTypeChip, { flex: 1, justifyContent: 'center', borderColor: '#007AFF' }]} onPress={handleCreateGroupBackup}>
                      <Ionicons name="save-outline" size={16} color="#007AFF" style={{ marginRight: 6 }} />
                      <Text style={[styles.matchTypeLabel, { color: '#007AFF' }]}>Esporta Backup</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.matchTypeChip, { flex: 1, justifyContent: 'center', borderColor: '#FF9500' }]} onPress={handleRestoreGroupBackup}>
                      <Ionicons name="open-outline" size={16} color="#FF9500" style={{ marginRight: 6 }} />
                      <Text style={[styles.matchTypeLabel, { color: '#FF9500' }]}>Ripristina Backup</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.configSection, { marginTop: 15 }]}>
                  <Text style={[styles.configSectionTitle, dynamicStyles.text]}>Classifiche e Bonus</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity style={[styles.matchTypeChip, group?.show_scorers && styles.matchTypeChipActive]} onPress={() => handleUpdateGroupSettings({ show_scorers: !group?.show_scorers })}>
                      <Text style={[styles.matchTypeLabel, group?.show_scorers && styles.matchTypeLabelActive]}>Marcatori</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.matchTypeChip, group?.show_assists && styles.matchTypeChipActive]} onPress={() => handleUpdateGroupSettings({ show_assists: !group?.show_assists })}>
                      <Text style={[styles.matchTypeLabel, group?.show_assists && styles.matchTypeLabelActive]}>Assist</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.matchTypeChip, group?.use_bonus && styles.matchTypeChipActive, { borderColor: '#FFD60A' }]} onPress={() => handleUpdateGroupSettings({ use_bonus: !group?.use_bonus })}>
                      <Ionicons name="star" size={14} color={group?.use_bonus ? "#FFD60A" : "#8E8E93"} style={{marginRight: 4}} />
                      <Text style={[styles.matchTypeLabel, group?.use_bonus && { color: '#FFD60A' }]}>Bonus Giocatore (+1 PT)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.matchTypeChip, group?.use_clean_sheet_bonus && styles.matchTypeChipActive, { borderColor: '#34C759' }]} onPress={() => handleUpdateGroupSettings({ use_clean_sheet_bonus: !group?.use_clean_sheet_bonus })}>
                      <Ionicons name="shield-checkmark" size={14} color={group?.use_clean_sheet_bonus ? "#34C759" : "#8E8E93"} style={{marginRight: 4}} />
                      <Text style={[styles.matchTypeLabel, group?.use_clean_sheet_bonus && { color: '#34C759' }]}>Clean Sheet (+1 PT)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.matchTypeChip, group?.use_gk_bonus && styles.matchTypeChipActive, { borderColor: '#FF9500' }]} onPress={() => handleUpdateGroupSettings({ use_gk_bonus: !group?.use_gk_bonus })}>
                      <Ionicons name="hand-right" size={14} color={group?.use_gk_bonus ? "#FF9500" : "#8E8E93"} style={{marginRight: 4}} />
                      <Text style={[styles.matchTypeLabel, group?.use_gk_bonus && { color: '#FF9500' }]}>Bonus Portiere (+1 PT)</Text>
                    </TouchableOpacity>
                  </View>

                  {group?.use_bonus && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.configHint, dynamicStyles.subText]}>• Bonus Giocatore: +1 PT per {group?.bonus_goals_threshold || 2}+ goal e {group?.bonus_assists_threshold || 2}+ assist.</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 11, textTransform: 'none' }]}>Soglia Goal: </Text>
                        <TouchableOpacity onPress={() => handleUpdateGroupSettings({ bonus_goals_threshold: Math.max(1, (group?.bonus_goals_threshold || 2) - 1) })} style={styles.thresholdBtn}><Ionicons name="remove" size={16} color="#007AFF" /></TouchableOpacity>
                        <Text style={[styles.thresholdValue, dynamicStyles.text]}>{group?.bonus_goals_threshold || 2}</Text>
                        <TouchableOpacity onPress={() => handleUpdateGroupSettings({ bonus_goals_threshold: (group?.bonus_goals_threshold || 2) + 1 })} style={styles.thresholdBtn}><Ionicons name="add" size={16} color="#007AFF" /></TouchableOpacity>

                        <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 11, textTransform: 'none', marginLeft: 15 }]}>Soglia Assist: </Text>
                        <TouchableOpacity onPress={() => handleUpdateGroupSettings({ bonus_assists_threshold: Math.max(1, (group?.bonus_assists_threshold || 2) - 1) })} style={styles.thresholdBtn}><Ionicons name="remove" size={16} color="#007AFF" /></TouchableOpacity>
                        <Text style={[styles.thresholdValue, dynamicStyles.text]}>{group?.bonus_assists_threshold || 2}</Text>
                        <TouchableOpacity onPress={() => handleUpdateGroupSettings({ bonus_assists_threshold: (group?.bonus_assists_threshold || 2) + 1 })} style={styles.thresholdBtn}><Ionicons name="add" size={16} color="#007AFF" /></TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {group?.use_clean_sheet_bonus && (
                    <Text style={[styles.configHint, dynamicStyles.subText]}>• Clean Sheet: +1 PT a tutti se la squadra non subisce goal.</Text>
                  )}
                  {group?.use_gk_bonus && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.configHint, dynamicStyles.subText]}>• Bonus Portiere: +1 PT se subisce meno di {group?.gk_bonus_threshold} goal.</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <Text style={[styles.configSectionTitle, dynamicStyles.text, { fontSize: 11, textTransform: 'none' }]}>Soglia Goal: </Text>
                        <TouchableOpacity onPress={() => handleUpdateGroupSettings({ gk_bonus_threshold: Math.max(1, (group?.gk_bonus_threshold || 5) - 1) })} style={styles.thresholdBtn}><Ionicons name="remove" size={16} color="#007AFF" /></TouchableOpacity>
                        <Text style={[styles.thresholdValue, dynamicStyles.text]}>{group?.gk_bonus_threshold}</Text>
                        <TouchableOpacity onPress={() => handleUpdateGroupSettings({ gk_bonus_threshold: (group?.gk_bonus_threshold || 5) + 1 })} style={styles.thresholdBtn}><Ionicons name="add" size={16} color="#007AFF" /></TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            <View style={[styles.tabBar, dynamicStyles.tabBar]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[
                  { id: 'players', icon: 'people', label: 'Giocatori' },
                  { id: 'teams', icon: 'football', label: 'Genera' },
                  { id: 'standings', icon: 'trophy', label: 'Classifica' },
                  { id: 'matches', icon: 'list', label: 'Storico' }
                ].map((t) => (
                  <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && dynamicStyles.tabActive, { minWidth: 100 }]} onPress={() => setActiveTab(t.id as TabType)}>
                    <Ionicons name={t.icon as any} size={18} color={activeTab === t.id ? '#007AFF' : '#8E8E93'} />
                    <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {activeTab === 'players' && (
              <View style={{ flex: 1 }}>
                <View style={[styles.searchContainer, dynamicStyles.card]}>
                  <Ionicons name="search" size={20} color="#8E8E93" style={{ marginRight: 8 }} />
                  <TextInput style={[styles.searchInput, dynamicStyles.text]} placeholder="Cerca..." placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} value={search} onChangeText={setSearch} />
                </View>
                <View style={styles.filtersWrapper}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
                    <TouchableOpacity style={[styles.filterChip, dynamicStyles.card, !selectedRole && styles.filterChipActive]} onPress={() => setSelectedRole(null)}>
                      <Text style={[styles.filterText, !selectedRole && styles.filterChipActive ? { color: '#FFF' } : dynamicStyles.text]}>Tutti</Text>
                    </TouchableOpacity>
                    {ROLES.map((role) => (
                      <TouchableOpacity key={role} style={[styles.filterChip, dynamicStyles.card, selectedRole === role && { backgroundColor: ROLE_COLORS[role], borderColor: ROLE_COLORS[role] }]} onPress={() => setSelectedRole(selectedRole === role ? null : role)}>
                        <Text style={[styles.filterText, selectedRole === role ? { color: '#FFFFFF' } : dynamicStyles.text]}>{role}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <FlatList data={players} renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.pCard, dynamicStyles.card]} onPress={() => router.push(`/player/${item.id}?groupId=${groupId}`)} onLongPress={() => handleDeletePlayer(item)}>
                    <View style={[styles.pAvatar, { backgroundColor: ROLE_COLORS[item.role] + '20' }]}><Text style={[styles.pAvatarText, { color: ROLE_COLORS[item.role] }]}>{getInitials(item.nickname)}</Text></View>
                    <View style={styles.pInfo}><Text style={[styles.pNickname, dynamicStyles.text]}>{item.nickname}</Text><Text style={[styles.pRoleText, { color: ROLE_COLORS[item.role] }]}>{item.role}</Text></View>
                    <View style={[styles.pStrBadge, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', flexDirection: 'row', width: 100, gap: 10, paddingVertical: 4, borderRadius: 12, justifyContent: 'center' }]}>
                      <View style={{alignItems: 'center'}}><Text style={[styles.pAge, dynamicStyles.subText, {fontSize: 14, fontWeight: '700'}]}>{item.age}</Text><Text style={styles.pStrLabel}>ANNI</Text></View>
                      <View style={[styles.pDivider, dynamicStyles.divider]} />
                      <View style={{alignItems: 'center'}}><Text style={[styles.pStrNum, dynamicStyles.text]}>{item.strength}</Text><Text style={styles.pStrLabel}>FRZ</Text></View>
                    </View>
                  </TouchableOpacity>
                )} contentContainerStyle={styles.listContent} />
              </View>
            )}

            {activeTab === 'teams' && (
              <View style={{flex: 1}}>
                 <View style={[styles.searchContainer, dynamicStyles.card, { marginBottom: 8 }]}>
                   <Ionicons name="search" size={20} color="#8E8E93" style={{ marginRight: 8 }} />
                   <TextInput style={[styles.searchInput, dynamicStyles.text]} placeholder="Cerca giocatore..." placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} value={teamSearch} onChangeText={setTeamSearch} />
                 </View>
                 <View style={styles.filtersWrapper}>
                   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
                     <TouchableOpacity style={[styles.filterChip, dynamicStyles.card, !teamSelectedRole && styles.filterChipActive]} onPress={() => setTeamSelectedRole(null)}>
                       <Text style={[styles.filterText, !teamSelectedRole && styles.filterChipActive ? { color: '#FFF' } : dynamicStyles.text]}>Tutti</Text>
                     </TouchableOpacity>
                     {ROLES.map((role) => (
                       <TouchableOpacity key={role} style={[styles.filterChip, dynamicStyles.card, teamSelectedRole === role && { backgroundColor: ROLE_COLORS[role], borderColor: ROLE_COLORS[role] }]} onPress={() => setTeamSelectedRole(teamSelectedRole === role ? null : role)}>
                         <Text style={[styles.filterText, teamSelectedRole === role ? { color: '#FFFFFF' } : dynamicStyles.text]}>{role}</Text>
                       </TouchableOpacity>
                     ))}
                   </ScrollView>
                 </View>
                 <View style={styles.selHeader}><Text style={[styles.selCount, dynamicStyles.subText]}>{selectedIds.size} / {matchType * 2}</Text><TouchableOpacity onPress={selectAll}><Text style={styles.selAllText}>Tutti</Text></TouchableOpacity></View>

                 <FlatList data={filteredPlayersForTeams} renderItem={({ item }) => {
                   const isSel = selectedIds.has(item.id);
                   return (
                     <TouchableOpacity style={[styles.selCard, dynamicStyles.card, isSel && styles.selCardActive]} onPress={() => togglePlayer(item.id)}>
                       <View style={[styles.chk, isSel && styles.chkActive]}>{isSel && <Ionicons name="checkmark" size={16} color="#FFF" />}</View>
                       <Text style={[styles.selNick, dynamicStyles.text]}>{item.nickname}</Text>
                       <Text style={[styles.selRole, { color: ROLE_COLORS[item.role] }]}>{item.role}</Text>
                       <View style={[styles.pStrBadge, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', flexDirection: 'row', width: 85, gap: 8, paddingVertical: 4, borderRadius: 10, justifyContent: 'center', marginLeft: 10 }]}>
                         <View style={{alignItems: 'center'}}><Text style={[styles.pAge, dynamicStyles.subText, {fontSize: 12, fontWeight: '700'}]}>{item.age}</Text><Text style={styles.pStrLabel}>ANNI</Text></View>
                         <View style={[styles.pDivider, dynamicStyles.divider, { height: 14 }]} />
                         <View style={{alignItems: 'center'}}><Text style={[styles.pStrNum, dynamicStyles.text, { fontSize: 14 }]}>{item.strength}</Text><Text style={styles.pStrLabel}>FRZ</Text></View>
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

        {/* Modal Registrazione Risultato */}
        <Modal visible={showResultModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, dynamicStyles.text]}>{editingMatchId ? 'Modifica Risultato' : 'Registra Risultato'}</Text>
                <TouchableOpacity onPress={() => setShowResultModal(false)}><Ionicons name="close" size={24} color={isDarkMode ? "#FFF" : "#1C1C1E"} /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.scoreInputRow}>
                  <View style={styles.scoreField}>
                    <Text style={[styles.scoreLabel, dynamicStyles.text]} numberOfLines={1}>
                      {editingMatchId ? matches.find(m => m.id === editingMatchId)?.team_a_name : teams?.team_a_name}
                    </Text>
                    <TextInput style={[styles.scoreInput, dynamicStyles.input]} keyboardType="numeric" value={scoreA} onChangeText={setScoreA} />
                  </View>
                  <Text style={[styles.vsTextModal, dynamicStyles.text]}>-</Text>
                  <View style={styles.scoreField}>
                    <Text style={[styles.scoreLabel, dynamicStyles.text, { textAlign: 'right' }]} numberOfLines={1}>
                      {editingMatchId ? matches.find(m => m.id === editingMatchId)?.team_b_name : teams?.team_b_name}
                    </Text>
                    <TextInput style={[styles.scoreInput, dynamicStyles.input]} keyboardType="numeric" value={scoreB} onChangeText={setScoreB} />
                  </View>
                </View>

                {(group?.show_scorers || group?.show_assists || group?.use_bonus || group?.use_clean_sheet_bonus || group?.use_gk_bonus) && (
                  <>
                    <View style={[styles.teamSectionHeader, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                      <Ionicons name="shirt" size={16} color={getJerseyHex(editingMatchId ? matches.find(m => m.id === editingMatchId)?.team_a_color || 'Bianca' : teams?.team_a_color || 'Bianca')} />
                      <Text style={[styles.teamSectionTitle, dynamicStyles.text]}>
                        {editingMatchId ? matches.find(m => m.id === editingMatchId)?.team_a_name : teams?.team_a_name}
                      </Text>
                    </View>

                    <View style={styles.statRow}>
                      <Ionicons name="alert-circle-outline" size={22} color="#8E8E93" style={{ marginLeft: 5 }} />
                      <Text style={[styles.statName, dynamicStyles.text]}>Autogol (Squadra A)</Text>
                      <View style={styles.statControls}>
                        <View style={styles.statGroup}>
                          <TouchableOpacity onPress={() => updateOwnGoals('a', -1)}><Ionicons name="remove-circle-outline" size={22} color="#8E8E93" /></TouchableOpacity>
                          <Text style={[styles.statValueText, dynamicStyles.text]}>{teamAOwnGoals}</Text>
                          <TouchableOpacity onPress={() => updateOwnGoals('a', 1)}><Ionicons name="add-circle-outline" size={22} color="#8E8E93" /></TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {teamAParticipants.map(p => renderPlayerStatRow(p))}

                    <View style={[styles.teamSectionHeader, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginTop: 20 }]}>
                      <Ionicons name="shirt" size={16} color={getJerseyHex(editingMatchId ? matches.find(m => m.id === editingMatchId)?.team_b_color || 'Rossa' : teams?.team_b_color || 'Rossa')} />
                      <Text style={[styles.teamSectionTitle, dynamicStyles.text]}>
                        {editingMatchId ? matches.find(m => m.id === editingMatchId)?.team_b_name : teams?.team_b_name}
                      </Text>
                    </View>

                    <View style={styles.statRow}>
                      <Ionicons name="alert-circle-outline" size={22} color="#8E8E93" style={{ marginLeft: 5 }} />
                      <Text style={[styles.statName, dynamicStyles.text]}>Autogol (Squadra B)</Text>
                      <View style={styles.statControls}>
                        <View style={styles.statGroup}>
                          <TouchableOpacity onPress={() => updateOwnGoals('b', -1)}><Ionicons name="remove-circle-outline" size={22} color="#8E8E93" /></TouchableOpacity>
                          <Text style={[styles.statValueText, dynamicStyles.text]}>{teamBOwnGoals}</Text>
                          <TouchableOpacity onPress={() => updateOwnGoals('b', 1)}><Ionicons name="add-circle-outline" size={22} color="#8E8E93" /></TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {teamBParticipants.map(p => renderPlayerStatRow(p))}
                  </>
                )}
              </ScrollView>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveResult}><Text style={styles.saveBtnText}>Salva Risultato</Text></TouchableOpacity>
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
  tabBar: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 12, padding: 4, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  tabTextActive: { color: '#007AFF' },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  pCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 12, marginBottom: 10 },
  pAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pAvatarText: { fontSize: 16, fontWeight: '800' },
  pInfo: { flex: 1, marginLeft: 12 },
  pNickname: { fontSize: 16, fontWeight: '700' },
  pRoleText: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  pStrBadge: { alignItems: 'center', justifyContent: 'center' },
  pDivider: { width: 1, height: 20, backgroundColor: 'rgba(0,0,0,0.1)' },
  pStrNum: { fontSize: 18, fontWeight: '800' },
  pStrLabel: { fontSize: 8, fontWeight: '700', color: '#8E8E93' },
  standingRank: { width: 24, alignItems: 'center' },
  rankText: { fontSize: 14, fontWeight: '700' },
  standingStats: { flexDirection: 'row', gap: 12 },
  statBox: { alignItems: 'center', minWidth: 28 },
  statValue: { fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 8, fontWeight: '700', color: '#8E8E93', marginTop: 2 },
  teamsHeaderControls: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  iconShareBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  teamsContainer: { gap: 12 },
  teamCard: { borderRadius: 16, padding: 16 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  jerseyBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  teamName: { fontSize: 18, fontWeight: '700' },
  teamPlayerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  tpAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  tpAvatarText: { fontSize: 12, fontWeight: '800' },
  tpInfo: { flex: 1 },
  tpName: { fontSize: 14, fontWeight: '600' },
  tpRole: { fontSize: 10, fontWeight: '600' },
  mainShareBtn: { flexDirection: 'row', backgroundColor: '#34C759', marginHorizontal: 20, marginTop: 16, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mainShareBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  selHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  selCount: { fontSize: 14, fontWeight: '600' },
  selAllText: { color: '#007AFF', fontWeight: '600' },
  selCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8 },
  selNick: { flex: 1, fontSize: 16, fontWeight: '600', marginLeft: 10 },
  chk: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D1D6', alignItems: 'center', justifyContent: 'center' },
  chkActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  genBar: { padding: 20 },
  genBtn: { backgroundColor: '#007AFF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  genBtnDisabled: { backgroundColor: '#C7C7CC' },
  genText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  scoreInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 24 },
  scoreField: { alignItems: 'center', flex: 1 },
  scoreLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, width: '100%', textAlign: 'center' },
  scoreInput: { width: '100%', height: 50, borderRadius: 12, textAlign: 'center', fontSize: 24, fontWeight: '800' },
  vsTextModal: { fontSize: 24, fontWeight: '800', marginTop: 25 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16, textTransform: 'uppercase' },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  statName: { flex: 1, fontSize: 15, fontWeight: '600', marginLeft: 10 },
  statControls: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  statGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValueText: { fontSize: 14, fontWeight: '800', minWidth: 35, textAlign: 'center' },
  saveBtn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  configContainer: { marginHorizontal: 20, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  configSectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  matchTypeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E5E5EA', marginRight: 8, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  matchTypeChipActive: { backgroundColor: 'rgba(0,122,255,0.1)', borderColor: '#007AFF' },
  matchTypeLabel: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  matchTypeLabelActive: { color: '#007AFF' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 16, height: 44 },
  filtersWrapper: { marginBottom: 12 },
  filterContainer: { paddingHorizontal: 20, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  filterChipActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  filterText: { fontSize: 14, fontWeight: '600' },
  matchCard: { padding: 16, borderRadius: 16, marginBottom: 10 },
  matchDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  matchDateText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  matchScoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamScoreInfo: { flex: 1 },
  teamScoreName: { fontSize: 15, fontWeight: '700' },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginHorizontal: 10 },
  scoreValue: { fontSize: 18, fontWeight: '900' },
  teamSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 5 },
  teamSectionTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase' },
  matchDescText: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  teamsDescContainer: { padding: 12, borderRadius: 12, marginBottom: 8, alignItems: 'center' },
  teamsDescText: { fontSize: 16, fontWeight: '700' },
  configHint: { fontSize: 11, marginTop: 4, fontStyle: 'italic', lineHeight: 16 },
  thresholdBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,122,255,0.1)', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  thresholdValue: { fontSize: 16, fontWeight: '800', width: 20, textAlign: 'center' },
  teamsMetaInfo: { padding: 10, alignItems: 'center', gap: 4 },
  teamsDateTimeLoc: { alignItems: 'center' },
  teamsMetaText: { fontSize: 12, fontWeight: '600' },
  teamStatsSub: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  tpRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swapBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,122,255,0.1)', alignItems: 'center', justifyContent: 'center' },
});
