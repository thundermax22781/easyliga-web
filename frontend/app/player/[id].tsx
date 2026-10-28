import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { fetchPlayers, savePlayer, deletePlayer, ROLES, ROLE_COLORS, STRENGTH_VALUES, Player, Match, calculateStandings, PlayerStats, fetchGroups, fetchMatches } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';
import RadarChart from '../../src/components/RadarChart';

export default function PlayerDetailScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { id, groupId: groupIdParam, groupid: groupidParam } = useLocalSearchParams<{ id: string; groupId: string; groupid: string }>();
  const groupId = groupIdParam || groupidParam;
  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [playerMatches, setPlayerMatches] = useState<Match[]>([]);
  const [comparisonPlayer, setComparisonPlayer] = useState<Player | null>(null);
  const [comparisonStats, setComparisonStats] = useState<PlayerStats | null>(null);
  const [comparisonMatches, setComparisonMatches] = useState<Match[]>([]);
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [comparisonSearch, setComparisonSearch] = useState('');
  const [comparisonRole, setComparisonRole] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [groupPlayers, setGroupPlayers] = useState<Player[]>([]);
  const [groupStats, setGroupStats] = useState<PlayerStats[]>([]);
  const [group, setGroup] = useState<any>(null);
  const isAdminOrOwner = group?.role === 'owner' || group?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStrengthModal, setShowStrengthModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isSharingProfile, setIsSharingProfile] = useState(false);
  const [isSharingComparison, setIsSharingComparison] = useState(false);
  const profileViewShotRef = useRef<any>(null);
  const comparisonViewShotRef = useRef<any>(null);

  const [filteredMatchesInfo, setFilteredMatchesModal] = useState<{ title: string, matches: Match[] } | null>(null);
  const [visibleMatchesCount, setVisibleMatchesCount] = useState(5);
  const [showBonusBreakdown, setShowBonusBreakdown] = useState(false);
  const [showTournamentBreakdown, setShowTournamentBreakdown] = useState(false);
  const [showSpiderInfoModal, setShowSpiderInfoModal] = useState(false);

  const championshipMatches = useMemo(() => {
    return playerMatches.filter(m => !(m as any)._isLinked);
  }, [playerMatches]);

  // Editable fields
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState(new Date());
  const [manualDobText, setManualDobText] = useState('');
  const [isManualDob, setIsManualDob] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [role, setRole] = useState('');
  const [strength, setStrength] = useState(5);
  const [strengthText, setStrengthText] = useState('5');

  const maxStats = useMemo(() => {
    if (groupStats.length === 0) return { personalBonus: 1, defenseBonus: 1, incisivity: 1, goals: 1, assists: 1, winRate: 100, minGoalsConcededPM: 2.0 };

    // Troviamo il numero massimo di partite giocate nel gruppo
    const maxMatches = Math.max(1, ...groupStats.map(s => s.played || 0));
    // Soglia minima: 1/3 delle partite del giocatore più attivo (es. 35 -> 12)
    const minMatchesThreshold = Math.max(1, Math.ceil(maxMatches / 3));

    // Consideriamo i giocatori qualificati che hanno giocato almeno 1/3 delle partite massime
    const qualifiedStats = groupStats.filter(s => (s.played || 0) >= minMatchesThreshold);
    const benchmarkStats = qualifiedStats.length > 0 ? qualifiedStats : groupStats;

    // Normalizzazione relativa al ruolo del giocatore corrente
    const playerRole = player?.role || 'Attaccante';
    const sameRoleStats = benchmarkStats.filter(s => s.role === playerRole);
    const roleBenchmark = sameRoleStats.length > 0 ? sameRoleStats : benchmarkStats;

    const maxInc = Math.max(0.1, ...roleBenchmark.map(s => s.incisivity || 0));
    const maxGPM = Math.max(0.1, ...roleBenchmark.map(s => (s.individual_goals || 0) / (s.career_divisor || s.played || 1)));
    const maxAPM = Math.max(0.1, ...roleBenchmark.map(s => (s.individual_assists || 0) / (s.career_divisor || s.played || 1)));
    const maxPBonus = Math.max(1, ...roleBenchmark.map(s => s.personal_bonus_count || 0));
    const maxDBonus = Math.max(1, ...roleBenchmark.map(s => s.defense_bonus_count || 0));
    const maxWinRate = Math.max(1, ...roleBenchmark.map(s => ((s.won || 0) / (s.played || 1)) * 100));

    const maxCS = Math.max(1, ...roleBenchmark.map(s => s.clean_sheets || 0));
    const maxTotG = Math.max(1, ...roleBenchmark.map(s => s.individual_goals || 0));
    const maxTotA = Math.max(1, ...roleBenchmark.map(s => s.individual_assists || 0));
    const maxPts = Math.max(1, ...roleBenchmark.map(s => s.points || 0));

    // Miglior media gol subiti (più bassa è meglio è) tra i giocatori dello stesso ruolo
    const validGCPM = roleBenchmark
      .map(s => (s.goals_suffered || 0) / (s.played || 1))
      .filter(g => g > 0);
    const minGCPM = validGCPM.length > 0 ? Math.min(...validGCPM) : 2.0;
    const maxTGPM = Math.max(0.1, ...roleBenchmark.map(s => (s.goals_done || 0) / (s.career_divisor || s.played || 1)));

    return {
      personalBonus: maxPBonus,
      defenseBonus: maxDBonus,
      incisivity: maxInc,
      goals: maxGPM,
      assists: maxAPM,
      winRate: maxWinRate,
      minGoalsConcededPM: minGCPM,
      teamGoalsScoredPM: maxTGPM,
      cleanSheets: maxCS,
      totalGoals: maxTotG,
      totalAssists: maxTotA,
      points: maxPts,
      played: maxMatches,
    };
  }, [groupStats, player]);

  const getRoleColor = (r: string) => ROLE_COLORS[r] || '#8E8E93';
  const getScoreColor = (score: number) => {
    if (isNaN(score)) return '#8E8E93';
    if (score >= 7.5) return '#34C759';
    if (score >= 6.0) return '#FFCC00';
    return '#FF3B30';
  };

  const formatStatsForChart = (s: PlayerStats) => ({
    goals: s.individual_goals,
    assists: s.individual_assists,
    cleanSheets: s.clean_sheets,
    goalsConceded: s.goals_suffered,
    goalsDone: s.goals_done || 0,
    wins: s.won,
    matches: s.career_divisor || s.played || 1,
    points: s.points,
    personalBonus: s.personal_bonus_count,
    defenseBonus: s.defense_bonus_count,
    incisivity: s.incisivity,
    role: s.role,
  });

  const getInitials = (nick: string) => (nick || '??').substring(0, 2).toUpperCase();

  useEffect(() => {
    loadPlayer();
  }, [id, groupId]);

  const loadPlayer = async () => {
    if (!id || !groupId) return;
    try {
      setLoading(true);
      const playersData = await fetchPlayers({ group_id: groupId });
      setGroupPlayers(playersData);
      setAllPlayers(playersData.filter(p => String(p.id) !== String(id)));

      const groups = await fetchGroups();
      const currentGroup = groups.find(g => String(g.id) === String(groupId));
      if (currentGroup) setGroup(currentGroup);

      const found = playersData.find(p => String(p.id) === String(id));
      if (found) {
        setPlayer(found);
        setName(found.name || '');
        setSurname(found.surname || '');
        setPhone(found.phone || '');
        setNickname(found.nickname);
        const birthDate = found.date_of_birth ? new Date(found.date_of_birth) : new Date();
        setDob(birthDate);
        setManualDobText(birthDate.toLocaleDateString('it-IT'));
        setRole(found.role);
        setStrength(found.strength);
        setStrengthText(String(found.strength));

        const allStats = await calculateStandings(groupId);
        setGroupStats(allStats);
        const playerStats = allStats.find(s => String(s.player_id).trim() === String(id).trim());
        if (playerStats) {
          setStats(playerStats);
        } else {
          setStats({
            player_id: String(id),
            nickname: found.nickname,
            role: found.role,
            played: 0, won: 0, drawn: 0, lost: 0, points: 0,
            goals_done: 0, goals_suffered: 0, individual_goals: 0, individual_assists: 0, clean_sheets: 0,
            incisivity: 0, bonus_points: 0, personal_bonus_count: 0, defense_bonus_count: 0, tournament_count: 0,
            tournament_bonus_points: 0
          } as any);
        }

        const masterMatches = await fetchMatches(groupId);
        let fullHistory = [...masterMatches];

        if (currentGroup?.import_linked_data && currentGroup.linked_group_ids) {
          for (const lid of currentGroup.linked_group_ids) {
            try {
              const [lm, lp] = await Promise.all([fetchMatches(lid), fetchPlayers({ group_id: lid })]);
              fullHistory.push(...lm.map(x => ({ ...x, _isLinked: true, _tournamentPlayers: lp } as any)));
            } catch (err) {}
          }
        }

        const pId = String(id).trim();
        const pNick = found.nickname.toLowerCase().trim();

        const playerHistory = fullHistory.filter(m => {
          if (m.status !== 'played' && m.status !== undefined) return false;

          const teamAIds = m.team_a_players.map(pid => String(pid).trim());
          const teamBIds = m.team_b_players.map(pid => String(pid).trim());

          if (!(m as any)._isLinked) {
            return teamAIds.includes(pId) || teamBIds.includes(pId);
          } else {
            const tPlayers: Player[] = (m as any)._tournamentPlayers || [];
            return [...teamAIds, ...teamBIds].some(tid => {
              const lp = tPlayers.find(x => String(x.id).trim() === tid);
              return tid === pId || (lp && lp.nickname.toLowerCase().trim() === pNick);
            });
          }
        });

        setPlayerMatches(playerHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }
    } catch (e) {
      console.error("Load player error:", e);
    } finally {
      setLoading(false);
    }
  };

  const calculateAgeDisplay = (birthDate: Date) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 0 ? age : '--';
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDob(selectedDate);
      setManualDobText(selectedDate.toLocaleDateString('it-IT'));
    }
  };

  const handleManualDobChange = (text: string) => {
    // Rimuovi tutto ciò che non è numero
    let cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    if (cleaned.length > 4) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4, 8);
    }

    setManualDobText(formatted);

    // Se la data è completa (DD/MM/YYYY), proviamo a validarla e aggiornare dob
    if (cleaned.length === 8) {
      const day = parseInt(cleaned.slice(0, 2));
      const month = parseInt(cleaned.slice(2, 4)) - 1;
      const year = parseInt(cleaned.slice(4, 8));

      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const newDate = new Date(year, month, day);
        if (newDate.getFullYear() === year && newDate.getMonth() === month && newDate.getDate() === day) {
          setDob(newDate);
        }
      }
    }
  };

  const handleSave = async () => {
    if (!id || !groupId) return;
    if (!nickname.trim()) return Alert.alert('Errore', 'Inserisci il nickname');

    setSaving(true);
    try {
      await savePlayer({
        id,
        nickname: nickname.trim(),
        name: name.trim() || undefined,
        surname: surname.trim() || undefined,
        phone: phone.trim() || undefined,
        date_of_birth: dob.toISOString().split('T')[0],
        role,
        strength,
        group_id: groupId,
      });
      loadPlayer();
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile salvare le modifiche');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !groupId) return;

    const allMatches = await fetchMatches(groupId);
    const pId = String(id).trim();
    const isUsed = allMatches.some(m =>
      m.team_a_players.map(pid => String(pid).trim()).includes(pId) ||
      m.team_b_players.map(pid => String(pid).trim()).includes(pId)
    );

    if (isUsed) {
      Alert.alert(
        'Azione Non Consentita',
        `Non puoi eliminare questo giocatore perché è presente in una o più partite salvate. Elimina prima le partite che lo includono.`
      );
      return;
    }

    Alert.alert('Elimina Giocatore', `Vuoi eliminare ${player?.nickname}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
          await deletePlayer(id);
          router.back();
      }}
    ]);
  };

  const handleShareStats = async () => {
    if (!player || !stats) return;
    setIsSharingProfile(true);
    if (Platform.OS !== 'web') {
      setTimeout(async () => {
        try {
          if (profileViewShotRef.current) {
            const uri = await profileViewShotRef.current.capture();
            await Sharing.shareAsync(uri);
          }
        } catch (e) {
          Alert.alert('Errore', 'Impossibile condividere il profilo');
        } finally {
          setIsSharingProfile(false);
        }
      }, 500);
    }
  };

  const handleShareComparison = async () => {
    if (!player || !comparisonPlayer || !stats || !comparisonStats) return;
    setIsSharingComparison(true);
    if (Platform.OS !== 'web') {
      setTimeout(async () => {
        try {
          if (comparisonViewShotRef.current) {
            const uri = await comparisonViewShotRef.current.capture();
            await Sharing.shareAsync(uri);
          }
        } catch (e) {
          Alert.alert('Errore', 'Impossibile condividere il confronto');
        } finally {
          setIsSharingComparison(false);
        }
      }, 500);
    }
  };

  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7' },
    text: { color: isDarkMode ? '#FFFFFF' : '#1C1C1E' },
    subText: { color: isDarkMode ? '#AEAEB2' : '#8E8E93' },
    card: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF' },
    input: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF', color: isDarkMode ? '#FFF' : '#1C1C1E', borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' },
    modalContent: { backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF' },
    divider: { backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }
  }), [isDarkMode]);

  const handleStartComparison = async (otherPlayer: Player) => {
    setComparisonPlayer(otherPlayer);
    setShowComparisonSelector(false);

    const allStats = await calculateStandings(groupId as string);
    const pStats = allStats.find(s => String(s.player_id).trim() === String(otherPlayer.id).trim());
    if (pStats) {
      setComparisonStats(pStats);
    } else {
      setComparisonStats({
        player_id: otherPlayer.id, nickname: otherPlayer.nickname, role: otherPlayer.role,
        played: 0, won: 0, drawn: 0, lost: 0, points: 0,
        goals_done: 0, goals_suffered: 0, individual_goals: 0, individual_assists: 0, clean_sheets: 0,
        incisivity: 0, bonus_points: 0
      } as any);
    }

    const currentPlayerStats = allStats.find(s => String(s.player_id).trim() === String(id).trim());
    if (currentPlayerStats) {
      setStats(currentPlayerStats);
    }

    const allMatches = await fetchMatches(groupId as string);
    const pMatches = allMatches.filter(m =>
      (m.status === 'played' || m.status === undefined) &&
      (m.team_a_players.map(pid => String(pid).trim()).includes(String(otherPlayer.id).trim()) ||
       m.team_b_players.map(pid => String(pid).trim()).includes(String(otherPlayer.id).trim()))
    );
    setComparisonMatches(pMatches);
  };

  const getCommonStats = () => {
    if (!id || !comparisonPlayer) return null;
    const p1Id = String(id).trim();
    const p2Id = String(comparisonPlayer.id).trim();

    return playerMatches.reduce((acc, m) => {
      const teamA = m.team_a_players.map(pid => String(pid).trim());
      const teamB = m.team_b_players.map(pid => String(pid).trim());
      const p1InA = teamA.includes(p1Id);
      const p1InB = teamB.includes(p1Id);
      const p2InA = teamA.includes(p2Id);
      const p2InB = teamB.includes(p2Id);

      if ((p1InA || p1InB) && (p2InA || p2InB)) {
        const isDraw = m.team_a_score === m.team_b_score;
        if ((p1InA && p2InA) || (p1InB && p2InB)) {
          acc.together++;
          acc.togetherMatches.push(m);
          const p1TeamWon = p1InA ? m.team_a_score > m.team_b_score : m.team_b_score > m.team_a_score;
          if (isDraw) acc.togetherDrawn++;
          else if (p1TeamWon) acc.togetherWon++;
          else acc.togetherLost++;
        } else {
          acc.against++;
          acc.againstMatches.push(m);
          const p1Won = p1InA ? m.team_a_score > m.team_b_score : m.team_b_score > m.team_a_score;
          if (isDraw) acc.againstDrawn++;
          else if (p1Won) acc.againstP1Won++;
          else acc.againstP2Won++;
        }
      }
      return acc;
    }, {
      together: 0,
      togetherWon: 0,
      togetherLost: 0,
      togetherDrawn: 0,
      togetherMatches: [] as Match[],
      against: 0,
      againstP1Won: 0,
      againstP2Won: 0,
      againstDrawn: 0,
      againstMatches: [] as Match[]
    });
  };

  const ComparisonRow = ({ label, val1, val2, betterIsHigher = true }: { label: string, val1: number, val2: number, betterIsHigher?: boolean }) => {
    const isBetter1 = betterIsHigher ? val1 > val2 : val1 < val2;
    const isBetter2 = betterIsHigher ? val2 > val1 : val2 < val1;
    const isWorse1 = betterIsHigher ? val1 < val2 : val1 > val2;
    const isWorse2 = betterIsHigher ? val2 < val1 : val2 > val1;
    const color1 = isBetter1 ? '#34C759' : (isWorse1 ? '#FF3B30' : dynamicStyles.text.color);
    const color2 = isBetter2 ? '#34C759' : (isWorse2 ? '#FF3B30' : dynamicStyles.text.color);

    return (
      <View style={[styles.compRow, { marginVertical: 4 }]}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Text style={[styles.compValue, { color: color1, fontSize: 16 }]}>{val1.toFixed(val1 % 1 === 0 ? 0 : 2)}</Text>
        </View>
        <Text style={[styles.compLabel, dynamicStyles.subText, { fontSize: 11 }]}>{label}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={[styles.compValue, { color: color2, fontSize: 16 }]}>{val2.toFixed(val2 % 1 === 0 ? 0 : 2)}</Text>
        </View>
      </View>
    );
  };

  const ProfileStatRow = ({ label, value, color, onPress }: { label: string, value: any, color?: string, onPress?: () => void }) => {
    const Content = (
      <View style={[styles.compRow, { marginVertical: 3 }]}>
        <Text style={[styles.compLabel, dynamicStyles.subText, { textAlign: 'left', width: 'auto', fontSize: 12 }]}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.compValue, { color: color || dynamicStyles.text.color, fontSize: 16 }]}>
            {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 2) : value}
          </Text>
          {onPress && <Ionicons name="chevron-forward" size={14} color="#8E8E93" />}
        </View>
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {Content}
        </TouchableOpacity>
      );
    }
    return Content;
  };

  const showFilteredMatches = (type: 'win' | 'draw' | 'loss' | 'cs' | 'personal' | 'defense') => {
    if (!player || !playerMatches) return;
    const pId = String(player.id).trim();
    const pNick = player.nickname.toLowerCase().trim();
    let filtered: Match[] = [];
    let title = "";

    const checkPlayerTeam = (m: Match) => {
      const teamAIds = m.team_a_players.map(pid => String(pid).trim());
      if (!(m as any)._isLinked) {
        return teamAIds.includes(pId) ? 'a' : 'b';
      } else {
        const tPlayers: Player[] = (m as any)._tournamentPlayers || [];
        const inA = teamAIds.some(tid => {
          const lp = tPlayers.find(x => String(x.id).trim() === tid);
          return tid === pId || (lp && lp.nickname.toLowerCase().trim() === pNick);
        });
        return inA ? 'a' : 'b';
      }
    };

    switch (type) {
      case 'win':
        title = "Partite Vinte";
        filtered = playerMatches.filter(m => {
          if ((m as any)._isLinked) return false;
          if (m.team_a_score === m.team_b_score) return false;
          const side = checkPlayerTeam(m);
          return side === 'a' ? m.team_a_score > m.team_b_score : m.team_b_score > m.team_a_score;
        });
        break;
      case 'draw':
        title = "Partite Pareggiate";
        filtered = playerMatches.filter(m => {
          if ((m as any)._isLinked) return false;
          return m.team_a_score === m.team_b_score;
        });
        break;
      case 'loss':
        title = "Partite Perse";
        filtered = playerMatches.filter(m => {
          if ((m as any)._isLinked) return false;
          if (m.team_a_score === m.team_b_score) return false;
          const side = checkPlayerTeam(m);
          return side === 'a' ? m.team_a_score < m.team_b_score : m.team_b_score < m.team_a_score;
        });
        break;
      case 'cs':
        title = "Clean Sheets";
        filtered = playerMatches.filter(m => {
          if ((m as any)._isLinked) return false;
          const side = checkPlayerTeam(m);
          const conceded = side === 'a' ? m.team_b_score : m.team_a_score;
          return conceded === 0 && !m.exclude_def_bonus;
        });
        break;
      case 'personal':
        title = "Bonus Personali";
        filtered = playerMatches.filter(m => {
          if ((m as any)._isLinked) return false;
          const g = Number(m.goals?.[pId] || 0);
          const a = Number(m.assists?.[pId] || 0);
          return group?.use_bonus && g >= (group.bonus_goals_threshold || 2) && a >= (group.bonus_assists_threshold || 2);
        });
        break;
      case 'defense':
        title = "Bonus Difesa";
        filtered = playerMatches.filter(m => {
          if ((m as any)._isLinked) return false;
          const side = checkPlayerTeam(m);
          const os = side === 'a' ? m.team_b_score : m.team_a_score;
          const roleIsExcluded = Array.isArray(group?.gk_bonus_excluded_roles) && group.gk_bonus_excluded_roles.includes(player.role);
          return group?.use_gk_bonus && !roleIsExcluded && os < (group.gk_bonus_threshold || 5) && !m.exclude_def_bonus;
        });
        break;
    }

    if (filtered.length > 0) {
      setFilteredMatchesModal({ title, matches: filtered });
    } else {
      Alert.alert("Info", `Nessuna partita trovata per: ${title}`);
    }
  };

  const renderFilteredMatchesModal = () => {
    if (!filteredMatchesInfo) return null;
    return (
      <Modal visible={!!filteredMatchesInfo} animationType="slide" transparent={true} onRequestClose={() => setFilteredMatchesModal(null)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setFilteredMatchesModal(null)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>{filteredMatchesInfo.title}</Text>
              <TouchableOpacity onPress={() => setFilteredMatchesModal(null)}><Ionicons name="close" size={28} color={dynamicStyles.text.color} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 15 }}>
              {filteredMatchesInfo.matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((m, idx) => {
                const isTeamA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                const isWin = isTeamA ? m.team_a_score > m.team_b_score : m.team_b_score > m.team_a_score;
                const isDraw = m.team_a_score === m.team_b_score;
                const resultColor = isWin ? '#34C759' : isDraw ? '#FF9500' : '#FF3B30';
                const resultIcon = isWin ? "arrow-up" : isDraw ? "remove" : "arrow-down";
                const pId = String(id).trim();
                const pG = (m.goals?.[pId] || 0) as number;
                const pA = (m.assists?.[pId] || 0) as number;

                return (
                  <View key={m.id}>
                    <TouchableOpacity style={styles.matchListItem} onPress={() => { setFilteredMatchesModal(null); setSelectedMatch(m); }}>
                      <View style={[styles.trendCircleMini, { backgroundColor: resultColor, width: 28, height: 28, borderRadius: 14 }]}><Ionicons name={resultIcon} size={18} color="#FFF" /></View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.matchDate, dynamicStyles.subText]}>{new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</Text>
                        <Text style={[styles.matchTeams, dynamicStyles.text]} numberOfLines={1}>{m.team_a_name} vs {m.team_b_name}</Text>
                      </View>
                      <View style={styles.matchScoreBox}>
                        <Text style={[styles.matchScore, dynamicStyles.text]}>{m.team_a_score} - {m.team_b_score}</Text>
                        {(pG > 0 || pA > 0) && (
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                            {pG > 0 && <View style={styles.miniStatBadge}><Ionicons name="football" size={10} color="#FF3B30" /><Text style={[styles.miniStatText, { color: '#FF3B30' }]}>{pG}</Text></View>}
                            {pA > 0 && <View style={styles.miniStatBadge}><Ionicons name="people-outline" size={10} color="#34C759" /><Text style={[styles.miniStatText, { color: '#34C759' }]}>{pA}</Text></View>}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    {idx < filteredMatchesInfo.matches.length - 1 && <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, opacity: 0.5 }]} />}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderMatchDetail = () => {
    if (!selectedMatch) return null;
    const m = selectedMatch;
    const getNick = (pid: string) => groupPlayers.find(p => String(p.id).trim() === String(pid).trim())?.nickname || '???';

    return (
      <Modal visible={!!selectedMatch} animationType="slide" transparent={true} onRequestClose={() => setSelectedMatch(null)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setSelectedMatch(null)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Dettaglio Partita</Text>
              <TouchableOpacity onPress={() => setSelectedMatch(null)}><Ionicons name="close" size={28} color={dynamicStyles.text.color} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Text style={[dynamicStyles.subText, { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }]}>
                  {new Date(m.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                {m.description && <Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '800', marginTop: 4 }]}>{m.description}</Text>}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 30 }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                   <Text style={[dynamicStyles.text, { fontSize: 16, fontWeight: '800', textAlign: 'center' }]} numberOfLines={2}>{m.team_a_name}</Text>
                   <Text style={[styles.matchScore, dynamicStyles.text, { fontSize: 32, marginTop: 8 }]}>{m.team_a_score}</Text>
                </View>
                <Text style={[dynamicStyles.subText, { fontSize: 24, fontWeight: '900' }]}>-</Text>
                <View style={{ flex: 1, alignItems: 'center' }}>
                   <Text style={[dynamicStyles.text, { fontSize: 16, fontWeight: '800', textAlign: 'center' }]} numberOfLines={2}>{m.team_b_name}</Text>
                   <Text style={[styles.matchScore, dynamicStyles.text, { fontSize: 32, marginTop: 8 }]}>{m.team_b_score}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase' }]}>Formazione A</Text>
                  {m.team_a_players.map(pid => (
                    <View key={pid} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '600' }]}>{getNick(pid)}</Text>
                      {(m.goals?.[pid] || 0) > 0 && <Text style={{ color: '#FF3B30', fontSize: 12, fontWeight: '800', marginLeft: 4 }}>+{m.goals?.[pid]}G</Text>}
                    </View>
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', textAlign: 'right' }]}>Formazione B</Text>
                  {m.team_b_players.map(pid => (
                    <View key={pid} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
                      {(m.goals?.[pid] || 0) > 0 && <Text style={{ color: '#FF3B30', fontSize: 12, fontWeight: '800', marginRight: 4 }}>+{m.goals?.[pid]}G</Text>}
                      <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '600' }]}>{getNick(pid)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderBonusBreakdownModal = () => {
    if (!stats) return null;

    const csBonusEnabled = group?.use_clean_sheet_bonus;
    const balanceBonus = group?.use_balance_bonus;

    const csPoints = csBonusEnabled ? stats.clean_sheets : 0;
    const tournamentPoints = stats.tournament_bonus_points || 0;

    let pdPoints = 0;
    if (balanceBonus) {
      pdPoints = stats.bonus_points - csPoints - tournamentPoints;
    } else {
      pdPoints = stats.personal_bonus_count + stats.defense_bonus_count;
    }

    const rows: { label: string; value: string; points: string; onPress?: () => void }[] = [
      { label: 'Bonus Personali', value: `${stats.personal_bonus_count} volte`, points: balanceBonus ? '-' : `+${stats.personal_bonus_count}` },
      { label: 'Bonus Difesa', value: `${stats.defense_bonus_count} volte`, points: balanceBonus ? '-' : `+${stats.defense_bonus_count}` },
    ];

    if (balanceBonus) {
      rows.push({ label: 'Totale P/D (Bilanciato)', value: 'Max(P, D)', points: `+${pdPoints}` });
    }
    if (csBonusEnabled) {
      rows.push({ label: 'Clean Sheets', value: `${stats.clean_sheets} volte`, points: `+${csPoints}` });
    }
    if (tournamentPoints > 0) {
      rows.push({ label: 'Risultati Tornei', value: 'Podi e Premi individuali', points: `+${tournamentPoints}`, onPress: () => { setShowBonusBreakdown(false); setShowTournamentBreakdown(true); } });
    }

    return (
      <Modal visible={showBonusBreakdown} animationType="fade" transparent={true} onRequestClose={() => setShowBonusBreakdown(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowBonusBreakdown(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: 'auto', paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Dettaglio Bonus</Text>
              <TouchableOpacity onPress={() => setShowBonusBreakdown(false)}><Ionicons name="close" size={28} color={dynamicStyles.text.color} /></TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              {rows.map((r, i) => {
                const Content = (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.1)' }}>
                    <View>
                      <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '700' }]}>{r.label}</Text>
                      <Text style={[dynamicStyles.subText, { fontSize: 12 }]}>{r.value}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#5AC8FA' }}>{r.points}</Text>
                      {r.onPress && <Ionicons name="chevron-forward" size={16} color="#8E8E93" />}
                    </View>
                  </View>
                );

                if (r.onPress) {
                  return (
                    <TouchableOpacity key={i} onPress={r.onPress} activeOpacity={0.7}>
                      {Content}
                    </TouchableOpacity>
                  );
                }

                return <View key={i}>{Content}</View>;
              })}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 15, borderTopWidth: 2, borderTopColor: '#5AC8FA' }}>
                <Text style={[dynamicStyles.text, { fontSize: 18, fontWeight: '900' }]}>TOTALE BONUS</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#5AC8FA' }}>{stats.bonus_points} PT</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderTournamentBreakdownModal = () => {
    if (!stats || !stats.tournament_details) return null;

    return (
      <Modal visible={showTournamentBreakdown} animationType="fade" transparent={true} onRequestClose={() => setShowTournamentBreakdown(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowTournamentBreakdown(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: 'auto', paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Palmarès Tornei</Text>
              <TouchableOpacity onPress={() => setShowTournamentBreakdown(false)}><Ionicons name="close" size={28} color={dynamicStyles.text.color} /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20, maxHeight: 400 }}>
              {stats.tournament_details.length > 0 ? stats.tournament_details.map((t, i) => (
                <View key={i} style={{ marginBottom: 20, padding: 15, backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', borderRadius: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={[dynamicStyles.text, { fontSize: 16, fontWeight: '900' }]}>{t.name}</Text>
                    <View style={{ backgroundColor: '#5856D6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>+{t.points} PT</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {t.achievements.map((ach, j) => (
                      <View key={j} style={{ backgroundColor: '#5856D620', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#5856D640' }}>
                        <Text style={{ color: '#5856D6', fontSize: 11, fontWeight: '800' }}>{ach.toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )) : (
                <Text style={[dynamicStyles.subText, { textAlign: 'center', marginVertical: 20 }]}>Nessun podio o premio individuale registrato.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const SPIDER_METRIC_INFO: Record<string, { label: string; icon: string; desc: string; formula: string }> = {
    incisivity: {
      label: 'Incisività',
      icon: '⚡',
      desc: 'Valuta la capacità del giocatore di incidere direttamente sui gol della squadra. Si basa sulla somma dei gol e degli assist prodotti a partita.',
      formula: 'Formula: (Gol Fatti + Assist Fatti) / Partite Giocate',
    },
    mg: {
      label: 'Attacco (Media Gol)',
      icon: '⚽',
      desc: 'Indica la pericolosità offensiva e la frequenza di realizzazione del giocatore in partita.',
      formula: 'Formula: Gol Fatti / Partite Giocate',
    },
    ma: {
      label: 'Regia (Media Assist)',
      icon: '🎯',
      desc: 'Misura la visione di gioco e la capacità di servire passaggi vincenti ai compagni di squadra.',
      formula: 'Formula: Assist Fatti / Partite Giocate',
    },
    solidity: {
      label: 'Solidità Difensiva',
      icon: '🛡️',
      desc: 'Misura la tenuta difensiva della squadra quando il giocatore è in campo. Più la media dei gol subiti è bassa rispetto alla lega, più il punteggio è vicino a 100.',
      formula: 'Formula: Confronto relativo della Media Gol Subiti',
    },
    team_goals_scored: {
      label: 'Potenza (Gol Squadra)',
      icon: '🔥',
      desc: 'Misura la pericolosità e la forza offensiva complessiva della propria squadra quando il giocatore è in campo.',
      formula: 'Formula: Confronto relativo della Media Gol Segnati Squadra',
    },
    win_rate: {
      label: 'Percentuale Vittorie',
      icon: '🏆',
      desc: 'Indica la percentuale di partite vinte dal giocatore sul totale dei match disputati.',
      formula: 'Formula: (Partite Vinte / Partite Giocate) × 100',
    },
    personal_bonus: {
      label: 'Bonus Personale',
      icon: '🌟',
      desc: 'Premia le prestazioni individuali straordinarie, sbloccati quando si realizza una combo di Gol e Assist nella stessa partita.',
      formula: 'Formula: Conteggio totale dei Bonus Personali ottenuti',
    },
    defense_bonus: {
      label: 'Bonus Difesa',
      icon: '🧱',
      desc: 'Premia l’efficacia difensiva nelle partite in cui la propria squadra subisce pochissimi gol.',
      formula: 'Formula: Conteggio totale dei Bonus Difesa ottenuti',
    },
    clean_sheets: {
      label: 'Clean Sheet',
      icon: '🧼',
      desc: 'Indica il numero di partite concluse senza subire alcun gol da parte della propria squadra.',
      formula: 'Formula: Conteggio totale partite con 0 gol subiti',
    },
    goals: {
      label: 'Gol Totali',
      icon: '⚽',
      desc: 'Il numero complessivo di reti realizzate dal giocatore nel campionato.',
      formula: 'Formula: Somma totale dei Gol fatti',
    },
    assists: {
      label: 'Assist Totali',
      icon: '🎯',
      desc: 'Il numero complessivo di assist vincenti serviti dal giocatore.',
      formula: 'Formula: Somma totale degli Assist fatti',
    },
    points: {
      label: 'Punti Totali',
      icon: '📈',
      desc: 'I punti complessivi conquistati dal giocatore in classifica.',
      formula: 'Formula: Somma Punti Vittoria + Pareggi + Bonus',
    },
    played: {
      label: 'Presenze',
      icon: '📊',
      desc: 'Il numero totale di partite disputate dal giocatore.',
      formula: 'Formula: Totale partite giocate',
    },
  };

  const renderSpiderInfoModal = () => {
    if (!showSpiderInfoModal || !stats) return null;

    const playerRole = player?.role || 'Attaccante';
    const configuredMetrics = group?.radar_config?.[playerRole] || (
      playerRole === 'Difensore' ? ['solidity', 'ma', 'defense_bonus', 'mg', 'win_rate'] :
      playerRole === 'Portiere' ? ['solidity', 'clean_sheets', 'defense_bonus', 'win_rate', 'ma'] :
      ['incisivity', 'ma', 'personal_bonus', 'defense_bonus', 'mg']
    );

    const matches = stats.career_divisor || stats.played || 1;
    const goalsPerMatch = (stats.individual_goals || 0) / matches;
    const assistsPerMatch = (stats.individual_assists || 0) / matches;
    const goalsConcededPerMatch = (stats.goals_suffered || 0) / matches;
    const teamGoalsScoredPerMatch = (stats.goals_done || 0) / matches;
    const winRate = ((stats.won || 0) / matches) * 100;

    const getMetricScore = (mId: string) => {
      switch (mId) {
        case 'incisivity': return Math.min(10, Number((((stats.incisivity || 0) / (maxStats.incisivity || 1)) * 10).toFixed(1)));
        case 'mg': return Math.min(10, Number(((goalsPerMatch / (maxStats.goals || 1)) * 10).toFixed(1)));
        case 'ma': return Math.min(10, Number(((assistsPerMatch / (maxStats.assists || 1)) * 10).toFixed(1)));
        case 'solidity': return goalsConcededPerMatch > 0 ? Math.min(10, Number((((maxStats.minGoalsConcededPM || 2.0) / goalsConcededPerMatch) * 10).toFixed(1))) : 10;
        case 'team_goals_scored': return Math.min(10, Number(((teamGoalsScoredPerMatch / (maxStats.teamGoalsScoredPM || 1)) * 10).toFixed(1)));
        case 'win_rate': return Math.min(10, Number(((winRate / (maxStats.winRate || 100)) * 10).toFixed(1)));
        case 'personal_bonus': return Math.min(10, Number((((stats.personal_bonus_count || 0) / (maxStats.personalBonus || 1)) * 10).toFixed(1)));
        case 'defense_bonus': return Math.min(10, Number((((stats.defense_bonus_count || 0) / (maxStats.defenseBonus || 1)) * 10).toFixed(1)));
        case 'clean_sheets': return Math.min(10, Number((((stats.clean_sheets || 0) / (maxStats.cleanSheets || 1)) * 10).toFixed(1)));
        case 'goals': return Math.min(10, Number((((stats.individual_goals || 0) / (maxStats.totalGoals || 1)) * 10).toFixed(1)));
        case 'assists': return Math.min(10, Number((((stats.individual_assists || 0) / (maxStats.totalAssists || 1)) * 10).toFixed(1)));
        case 'points': return Math.min(10, Number((((stats.points || 0) / (maxStats.points || 1)) * 10).toFixed(1)));
        case 'played': return Math.min(10, Number((((stats.played || 0) / (maxStats.played || 1)) * 10).toFixed(1)));
        default: return 5.0;
      }
    };

    const metricItems = configuredMetrics.map(mId => {
      const info = SPIDER_METRIC_INFO[mId] || { label: 'Statistica', icon: '📊', desc: 'Valore calcolato in base alle prestazioni.', formula: '' };
      const score = getMetricScore(mId);
      return { ...info, score };
    });

    const avgScore = Number((metricItems.reduce((sum, item) => sum + item.score, 0) / metricItems.length).toFixed(1));

    return (
      <Modal visible={showSpiderInfoModal} transparent animationType="slide" onRequestClose={() => setShowSpiderInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowSpiderInfoModal(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '85%', maxHeight: '85%', maxWidth: 420, paddingBottom: 0 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, dynamicStyles.text]}>Guida Analisi Prestazioni</Text>
                <Text style={[dynamicStyles.subText, { fontSize: 11 }]}>Ruolo: {playerRole.toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSpiderInfoModal(false)}>
                <Ionicons name="close-circle" size={26} color={isDarkMode ? "#AAA" : "#8E8E93"} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15, paddingBottom: 60 }} showsVerticalScrollIndicator={true}>
              {/* Rating Complessivo AVG */}
              <View style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F8F9FF', padding: 15, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: getRoleColor(playerRole), marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[dynamicStyles.text, { fontSize: 15, fontWeight: '900' }]}>⭐ Rating Complessivo (AVG)</Text>
                  <Text style={[dynamicStyles.subText, { fontSize: 11, marginTop: 2 }]}>
                    Media aritmetica dei 5 parametri del grafico.
                  </Text>
                </View>
                <View style={{ backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 2, borderColor: getScoreColor(avgScore), alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: getScoreColor(avgScore) }}>{avgScore}</Text>
                  <Text style={{ fontSize: 7.5, fontWeight: '800', color: getScoreColor(avgScore) }}>OVERALL</Text>
                </View>
              </View>

              <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 }]}>
                Dettaglio delle 5 Metrike nel Grafico:
              </Text>

              {metricItems.map((item, i) => (
                <View key={i} style={{ backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                      <Text style={[dynamicStyles.text, { fontSize: 14, fontWeight: '800' }]}>{item.label}</Text>
                    </View>
                    <View style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: getScoreColor(item.score) }}>
                        {item.score} <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#AEAEB2' : '#8E8E93' }}>/ 10</Text>
                      </Text>
                    </View>
                  </View>

                  <Text style={[dynamicStyles.text, { fontSize: 12, lineHeight: 17, marginBottom: 8, opacity: 0.85 }]}>
                    {item.desc}
                  </Text>

                  <View style={{ backgroundColor: isDarkMode ? 'rgba(0,122,255,0.12)' : '#007AFF10', padding: 8, borderRadius: 8 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#007AFF', fontStyle: 'italic' }}>
                      {item.formula}
                    </Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.saveButton, { marginTop: 10, height: 48 }]}
                onPress={() => setShowSpiderInfoModal(false)}
              >
                <Text style={styles.saveButtonText}>Chiudi</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderProfileSharePreview = () => {
    if (!isSharingProfile || !player || !stats) return null;
    return (
      <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setIsSharingProfile(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableWithoutFeedback onPress={() => setIsSharingProfile(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={{ width: '95%', maxWidth: 400 }}>
            <ViewShot ref={profileViewShotRef} options={{ format: "png", quality: 0.9 }} style={{ width: 400, backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 12, borderRadius: 24 }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[dynamicStyles.text, { fontSize: 24, fontWeight: '900' }]}>{player.nickname.toUpperCase()}</Text>
                    {(player.name || player.surname || player.phone) && (
                      <View style={{ marginTop: 2, marginBottom: 4 }}>
                        <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '700' }]}>
                          {player.name || ''} {player.surname || ''}
                          {(player.name || player.surname) && player.phone ? ' • ' : ''}
                          {player.phone || ''}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.rolePill, { backgroundColor: getRoleColor(player.role), marginTop: 4, alignSelf: 'flex-start' }]}>
                      <Text style={styles.rolePillText}>{player.role}</Text>
                    </View>
                    <View style={[styles.trendRowCompact, { marginTop: 6, gap: 4 }]}>
                      {championshipMatches.slice(0, 5).reverse().map((m) => {
                        const isTeamA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                        const result = m.team_a_score === m.team_b_score ? 'D' : ((isTeamA && m.team_a_score > m.team_b_score) || (!isTeamA && m.team_b_score > m.team_a_score)) ? 'W' : 'L';
                        return (
                          <View key={m.id} style={[styles.trendCircleMini, { backgroundColor: result === 'W' ? '#34C759' : result === 'D' ? '#FF9500' : '#FF3B30', width: 18, height: 18, borderRadius: 9 }]}>
                            <Ionicons name={result === 'W' ? "arrow-up" : result === 'L' ? "arrow-down" : "remove"} size={10} color="#FFF" />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                    <Image source={require('../../assets/images/icon.png')} style={{ width: 50, height: 50 }} resizeMode="contain" />
                  </View>
               </View>

               <View style={[styles.bibbiaCard, dynamicStyles.card, { marginHorizontal: 0, paddingVertical: 4, paddingHorizontal: 12, borderWidth: 2, borderColor: getRoleColor(player.role), marginBottom: 5 }]}>
                  <ProfileStatRow label="Punti" value={stats.points} />
                  <ProfileStatRow label="Partite" value={stats.played} color="#A2845E" />
                  <ProfileStatRow label="Vinte" value={stats.won} color="#34C759" />
                  <ProfileStatRow label="Perse" value={stats.lost} color="#FF3B30" />
                  <ProfileStatRow label="Pareggiate" value={stats.drawn} color="#FF9500" />
                  {stats.tournament_count > 0 && <ProfileStatRow label="Tornei Disputati" value={stats.tournament_count} color="#5856D6" />}
                  <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 3, marginHorizontal: 0 }]} />
                  <ProfileStatRow label="Goal" value={stats.individual_goals} color="#FF3B30" />
                  <ProfileStatRow label="Assist" value={stats.individual_assists} color="#34C759" />
                  <ProfileStatRow label="Clean Sheets" value={stats.clean_sheets} color="#5AC8FA" />
                  <ProfileStatRow label="Bonus" value={stats.bonus_points} color="#5AC8FA" />
                  {(stats.personal_bonus_count > 0 || stats.defense_bonus_count > 0) && (
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 10, marginTop: -2, marginBottom: 4 }}>
                        <Text style={{ fontSize: 9, color: '#8E8E93', fontWeight: '700' }}>
                           {stats.personal_bonus_count > 0 ? `PERS: ${stats.personal_bonus_count}` : ''}
                           {stats.personal_bonus_count > 0 && stats.defense_bonus_count > 0 ? '  |  ' : ''}
                           {stats.defense_bonus_count > 0 ? `DIF: ${stats.defense_bonus_count}` : ''}
                        </Text>
                     </View>
                  )}
                  <ProfileStatRow label="Incisività" value={stats.incisivity} color="#FF9500" />
                  <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 3, marginHorizontal: 0 }]} />
                  <ProfileStatRow label="Media Goal Fatti" value={stats.individual_goals / (stats.career_divisor || 1)} color="#FF3B30" />
                  <ProfileStatRow label="Media Assist Fatti" value={stats.individual_assists / (stats.career_divisor || 1)} color="#34C759" />
                  <ProfileStatRow label="Media Goal Segnati Squadra" value={(stats.goals_done || 0) / (stats.career_divisor || 1)} color="#FF9500" />
                  <ProfileStatRow label="Media Goal Subiti" value={stats.goals_suffered / (stats.career_divisor || 1)} />
               </View>

               <View style={[styles.chartCard, dynamicStyles.card, { marginHorizontal: 0, padding: 0, marginTop: 0, alignItems: 'center', justifyContent: 'center' }]}>
                  <RadarChart
                    isDarkMode={isDarkMode}
                    matchType={group?.match_type || 5}
                    stats={formatStatsForChart(stats)}
                    maxStats={maxStats}
                    radarConfig={group?.radar_config}
                  />
               </View>

               <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 10 }}>
                  <Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '700' }]}>GENERATO CON EASYLIGA</Text>
                  <View style={{ width: 20, height: 20, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                    <Image source={require('../../assets/images/icon.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
                  </View>
               </View>
            </ViewShot>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 15, alignSelf: 'center' }}>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const uri = await (profileViewShotRef.current as any).capture();
                      await Sharing.shareAsync(uri);
                    } catch (e) { Alert.alert('Errore', 'Impossibile condividere'); }
                  }}
                  style={{ backgroundColor: '#34C759', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Ionicons name="share-social" size={18} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>CONDIVIDI</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setIsSharingProfile(false)}
                style={{ backgroundColor: '#FF3B30', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>{Platform.OS === 'web' ? 'CHIUDI' : 'CHIUDI ANTEPRIMA'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderComparisonSharePreview = () => {
    if (!isSharingComparison || !player || !comparisonPlayer || !stats || !comparisonStats) return null;
    return (
      <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setIsSharingComparison(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableWithoutFeedback onPress={() => setIsSharingComparison(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={{ width: '95%', maxWidth: 400 }}>
            <ViewShot ref={comparisonViewShotRef} options={{ format: "png", quality: 0.9 }} style={{ width: 400, backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 12, borderRadius: 24 }}>
               <View style={[styles.compHeader, { paddingVertical: 10 }]}>
                  <View style={styles.compPlayerBox}>
                    <View style={[styles.miniAvatar, { backgroundColor: getRoleColor(player.role), width: 44, height: 44, borderRadius: 22 }]}>
                      <Text style={[styles.miniAvatarText, { fontSize: 18 }]}>{getInitials(player.nickname)}</Text>
                    </View>
                    <Text style={[styles.compPlayerName, dynamicStyles.text, {fontSize: 14}]}>{player.nickname}</Text>
                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                      {playerMatches.slice(0, 5).reverse().map((m) => {
                        const isA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                        const res = m.team_a_score === m.team_b_score ? 'D' : ((isA && m.team_a_score > m.team_b_score) || (!isA && m.team_b_score > m.team_a_score)) ? 'W' : 'L';
                        return (
                          <View key={m.id} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: res === 'W' ? '#34C759' : res === 'D' ? '#FF9500' : '#FF3B30', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name={res === 'W' ? "arrow-up" : res === 'L' ? "arrow-down" : "remove"} size={6} color="#FFF" />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <Text style={[styles.vsText, { fontSize: 20, marginTop: -15 }]}>VS</Text>
                  <View style={styles.compPlayerBox}>
                    <View style={[styles.miniAvatar, { backgroundColor: getRoleColor(comparisonPlayer.role), width: 44, height: 44, borderRadius: 22 }]}>
                      <Text style={[styles.miniAvatarText, { fontSize: 18 }]}>{getInitials(comparisonPlayer.nickname)}</Text>
                    </View>
                    <Text style={[styles.compPlayerName, dynamicStyles.text, {fontSize: 14}]}>{comparisonPlayer.nickname}</Text>
                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                      {comparisonMatches.slice(0, 5).reverse().map((m) => {
                        const isA = m.team_a_players.map(pid => String(pid).trim()).includes(String(comparisonPlayer.id).trim());
                        const res = m.team_a_score === m.team_b_score ? 'D' : ((isA && m.team_a_score > m.team_b_score) || (!isA && m.team_b_score > m.team_a_score)) ? 'W' : 'L';
                        return (
                          <View key={m.id} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: res === 'W' ? '#34C759' : res === 'D' ? '#FF9500' : '#FF3B30', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name={res === 'W' ? "arrow-up" : res === 'L' ? "arrow-down" : "remove"} size={6} color="#FFF" />
                          </View>
                        );
                      })}
                    </View>
                  </View>
               </View>

               <View style={[styles.bibbiaCard, dynamicStyles.card, { marginHorizontal: 0, paddingVertical: 4, marginTop: 4, marginBottom: 4 }]}>
                  <ComparisonRow label="Punti" val1={stats.points} val2={comparisonStats.points} />
                  <ComparisonRow label="Partite" val1={stats.played} val2={comparisonStats.played} />
                  <ComparisonRow label="Vinte" val1={stats.won} val2={comparisonStats.won} />
                  <ComparisonRow label="Perse" val1={stats.lost} val2={comparisonStats.lost} betterIsHigher={false} />
                  <ComparisonRow label="Pareggiate" val1={stats.drawn} val2={comparisonStats.drawn} />
                  <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 3 }]} />
                  <ComparisonRow label="Goal" val1={stats.individual_goals} val2={comparisonStats.individual_goals} />
                  <ComparisonRow label="Assist" val1={stats.individual_assists} val2={comparisonStats.individual_assists} />
                  <ComparisonRow label="Clean Sheets" val1={stats.clean_sheets} val2={comparisonStats.clean_sheets} />
                  <ComparisonRow label="Bonus" val1={stats.bonus_points} val2={comparisonStats.bonus_points} />
                  <ComparisonRow label="Incisività" val1={stats.incisivity} val2={comparisonStats.incisivity} />
                  <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 3 }]} />
                  <ComparisonRow label="Media Goal Fatti" val1={stats.individual_goals / (stats.career_divisor || 1)} val2={comparisonStats.individual_goals / (comparisonStats.career_divisor || 1)} />
                  <ComparisonRow label="Media Assist Fatti" val1={stats.individual_assists / (stats.career_divisor || 1)} val2={comparisonStats.individual_assists / (comparisonStats.career_divisor || 1)} />
                  <ComparisonRow label="Media Goal Segnati Squadra" val1={(stats.goals_done || 0) / (stats.career_divisor || 1)} val2={(comparisonStats.goals_done || 0) / (comparisonStats.career_divisor || 1)} />
                  <ComparisonRow label="Media Goal Subiti" val1={stats.goals_suffered / (stats.career_divisor || 1)} val2={comparisonStats.goals_suffered / (comparisonStats.career_divisor || 1)} betterIsHigher={false} />
               </View>

               <View style={[styles.chartCard, dynamicStyles.card, { marginHorizontal: 0, padding: 0, marginTop: 0, marginBottom: 0 }]}>
                  <RadarChart
                    isDarkMode={isDarkMode}
                    matchType={group?.match_type || 5}
                    stats={formatStatsForChart(stats)}
                    comparisonStats={formatStatsForChart(comparisonStats)}
                    maxStats={maxStats}
                    radarConfig={group?.radar_config}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 15, marginTop: -10, paddingBottom: 10 }}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#007AFF' }} /><Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '800' }]}>{player.nickname.toUpperCase()}</Text></View>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' }} /><Text style={[dynamicStyles.subText, { fontSize: 9, fontWeight: '800' }]}>{comparisonPlayer.nickname.toUpperCase()}</Text></View>
                  </View>
               </View>

               <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, gap: 10 }}>
                  <Text style={[dynamicStyles.subText, { fontSize: 10, fontWeight: '700' }]}>GENERATO CON EASYLIGA</Text>
                  <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                    <Image source={require('../../assets/images/icon.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />
                  </View>
               </View>
            </ViewShot>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 15, alignSelf: 'center' }}>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const uri = await (comparisonViewShotRef.current as any).capture();
                      await Sharing.shareAsync(uri);
                    } catch (e) { Alert.alert('Errore', 'Impossibile condividere'); }
                  }}
                  style={{ backgroundColor: '#34C759', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Ionicons name="share-social" size={18} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>CONDIVIDI</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setIsSharingComparison(false)}
                style={{ backgroundColor: '#FF3B30', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>{Platform.OS === 'web' ? 'CHIUDI' : 'CHIUDI ANTEPRIMA'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderComparison = () => {
    if (!comparisonPlayer || !stats || !comparisonStats) return null;
    const common = getCommonStats();
    return (
      <Modal visible={!!comparisonPlayer} animationType="slide" onRequestClose={() => setComparisonPlayer(null)}>
        <SafeAreaView style={[styles.container, dynamicStyles.container]}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setComparisonPlayer(null)} style={styles.iconBtn}><Ionicons name="close" size={28} color={dynamicStyles.text.color} /></TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={handleShareComparison} style={styles.iconBtn}><Ionicons name="share-social-outline" size={24} color="#34C759" /></TouchableOpacity>
            </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.compHeader}>
              <View style={styles.compPlayerBox}>
                <View style={[styles.miniAvatar, { backgroundColor: getRoleColor(player!.role) }]}><Text style={styles.miniAvatarText}>{getInitials(player!.nickname)}</Text></View>
                <Text style={[styles.compPlayerName, dynamicStyles.text]} numberOfLines={1}>{player!.nickname}</Text>
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
                  {playerMatches.slice(0, 5).reverse().map((m) => {
                    const isTeamA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                    const res = m.team_a_score === m.team_b_score ? 'D' : ((isTeamA && m.team_a_score > m.team_b_score) || (!isTeamA && m.team_b_score > m.team_a_score)) ? 'W' : 'L';
                    return (
                      <View key={m.id} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: res === 'W' ? '#34C759' : res === 'D' ? '#FF9500' : '#FF3B30', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={res === 'W' ? "arrow-up" : res === 'L' ? "arrow-down" : "remove"} size={6} color="#FFF" />
                      </View>
                    );
                  })}
                </View>
              </View>
              <Text style={[styles.vsText, dynamicStyles.subText]}>VS</Text>
              <View style={styles.compPlayerBox}>
                <View style={[styles.miniAvatar, { backgroundColor: getRoleColor(comparisonPlayer.role) }]}><Text style={styles.miniAvatarText}>{getInitials(comparisonPlayer.nickname)}</Text></View>
                <Text style={[styles.compPlayerName, dynamicStyles.text]} numberOfLines={1}>{comparisonPlayer.nickname}</Text>
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
                  {comparisonMatches.slice(0, 5).reverse().map((m) => {
                    const isA = m.team_a_players.map(pid => String(pid).trim()).includes(String(comparisonPlayer.id).trim());
                    const res = m.team_a_score === m.team_b_score ? 'D' : ((isA && m.team_a_score > m.team_b_score) || (!isA && m.team_b_score > m.team_a_score)) ? 'W' : 'L';
                    return (
                      <View key={m.id} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: res === 'W' ? '#34C759' : res === 'D' ? '#FF9500' : '#FF3B30', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={res === 'W' ? "arrow-up" : res === 'L' ? "arrow-down" : "remove"} size={6} color="#FFF" />
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
            <View style={[styles.bibbiaCard, dynamicStyles.card, { marginBottom: 10, paddingVertical: 12 }]}>
              <ComparisonRow label="Punti" val1={stats.points} val2={comparisonStats.points} />
              <ComparisonRow label="Partite" val1={stats.played} val2={comparisonStats.played} />
              <ComparisonRow label="Vinte" val1={stats.won} val2={comparisonStats.won} />
              <ComparisonRow label="Perse" val1={stats.lost} val2={comparisonStats.lost} betterIsHigher={false} />
              <ComparisonRow label="Pareggiate" val1={stats.drawn} val2={comparisonStats.drawn} />
              <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 8 }]} />
              <ComparisonRow label="Goal" val1={stats.individual_goals} val2={comparisonStats.individual_goals} />
              <ComparisonRow label="Assist" val1={stats.individual_assists} val2={comparisonStats.individual_assists} />
              <ComparisonRow label="Clean Sheets" val1={stats.clean_sheets} val2={comparisonStats.clean_sheets} />
              <ComparisonRow label="Bonus" val1={stats.bonus_points} val2={comparisonStats.bonus_points} />
              <ComparisonRow label="Incisività" val1={stats.incisivity} val2={comparisonStats.incisivity} />
              <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 10 }]} />
              <ComparisonRow label="Media Goal Fatti" val1={stats.individual_goals / (stats.career_divisor || 1)} val2={comparisonStats.individual_goals / (comparisonStats.career_divisor || 1)} />
              <ComparisonRow label="Media Assist Fatti" val1={stats.individual_assists / (stats.career_divisor || 1)} val2={comparisonStats.individual_assists / (comparisonStats.career_divisor || 1)} />
              <ComparisonRow label="Media Goal Segnati Squadra" val1={(stats.goals_done || 0) / (stats.career_divisor || 1)} val2={(comparisonStats.goals_done || 0) / (comparisonStats.career_divisor || 1)} />
              <ComparisonRow label="Media Goal Subiti" val1={stats.goals_suffered / (stats.career_divisor || 1)} val2={comparisonStats.goals_suffered / (comparisonStats.career_divisor || 1)} betterIsHigher={false} />
            </View>

            <View style={[styles.bibbiaCard, dynamicStyles.card, { marginBottom: 10, paddingVertical: 12 }]}>
              <Text style={[styles.sectionSubtitle, dynamicStyles.subText, { textAlign: 'center', marginBottom: 5 }]}>Confronto Prestazioni</Text>
              <RadarChart
                isDarkMode={isDarkMode}
                matchType={group?.match_type || 5}
                stats={formatStatsForChart(stats)}
                comparisonStats={formatStatsForChart(comparisonStats)}
                maxStats={maxStats}
                radarConfig={group?.radar_config}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#007AFF' }} /><Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '700' }]}>{player!.nickname.toUpperCase()}</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#34C759' }} /><Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '700' }]}>{comparisonPlayer.nickname.toUpperCase()}</Text></View>
              </View>
            </View>

            <View style={[styles.bibbiaCard, dynamicStyles.card]}>
              <Text style={[styles.sectionSubtitle, dynamicStyles.subText]}>Scontro Diretto / Intesa</Text>
              <View style={styles.commonStatsRow}>
                <View style={[styles.commonStat, { flex: 1 }]}>
                  <Text style={[styles.commonValue, dynamicStyles.text]}>{common?.together}</Text>
                  <Text style={[styles.commonLabel, dynamicStyles.subText, { marginBottom: 6 }]}>Insieme</Text>
                  {common && common.together > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#34C759' }}>{common.togetherWon}V</Text>
                      <Text style={{ fontSize: 10, color: '#8E8E93' }}>•</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#FF3B30' }}>{common.togetherLost}P</Text>
                      <Text style={{ fontSize: 10, color: '#8E8E93' }}>•</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#FF9500' }}>{common.togetherDrawn}N</Text>
                    </View>
                  )}
                </View>

                <View style={{ width: 1, height: '70%', backgroundColor: isDarkMode ? '#333' : '#E5E5EA', alignSelf: 'center', marginHorizontal: 8 }} />

                <View style={[styles.commonStat, { flex: 1 }]}>
                  <Text style={[styles.commonValue, dynamicStyles.text]}>{common?.against}</Text>
                  <Text style={[styles.commonLabel, dynamicStyles.subText, { marginBottom: 6 }]}>Contro</Text>
                  {common && common.against > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#007AFF' }}>{player!.nickname}: {common.againstP1Won}V</Text>
                      <Text style={{ fontSize: 10, color: '#8E8E93' }}>•</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#34C759' }}>{comparisonPlayer.nickname}: {common.againstP2Won}V</Text>
                      {common.againstDrawn > 0 && (
                        <>
                          <Text style={{ fontSize: 10, color: '#8E8E93' }}>•</Text>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#FF9500' }}>{common.againstDrawn}N</Text>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {(() => {
                const renderMatchList = (matches: Match[], title: string) => {
                  if (matches.length === 0) return null;

                  const p1Id = String(id).trim();
                  const p2Id = String(comparisonPlayer.id).trim();

                  // Calcolo Totali per il riepilogo
                  let totalP1G = 0, totalP1A = 0, totalP2G = 0, totalP2A = 0;
                  matches.forEach(m => {
                    totalP1G += (m.goals?.[p1Id] || 0) as number;
                    totalP1A += (m.assists?.[p1Id] || 0) as number;
                    totalP2G += (m.goals?.[p2Id] || 0) as number;
                    totalP2A += (m.assists?.[p2Id] || 0) as number;
                  });

                  return (
                    <View style={{ marginTop: 20 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                        <Text style={[dynamicStyles.subText, { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }]}>{title}</Text>

                        {/* Riga Riepilogo Totali */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '900', color: '#007AFF' }}>{player!.nickname.toUpperCase()}:</Text>
                              <View style={styles.miniStatBadge}><Ionicons name="football" size={10} color="#007AFF" /><Text style={{ color: '#007AFF', fontSize: 11, fontWeight: '800' }}>{totalP1G}</Text></View>
                              <View style={styles.miniStatBadge}><Ionicons name="people-outline" size={10} color="#007AFF" /><Text style={{ color: '#007AFF', fontSize: 11, fontWeight: '800' }}>{totalP1A}</Text></View>
                           </View>
                           <View style={{ width: 1, height: 12, backgroundColor: isDarkMode ? '#333' : '#DDD', alignSelf: 'center' }} />
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '900', color: '#34C759' }}>{comparisonPlayer.nickname.toUpperCase()}:</Text>
                              <View style={styles.miniStatBadge}><Ionicons name="football" size={10} color="#34C759" /><Text style={{ color: '#34C759', fontSize: 11, fontWeight: '800' }}>{totalP2G}</Text></View>
                              <View style={styles.miniStatBadge}><Ionicons name="people-outline" size={10} color="#34C759" /><Text style={{ color: '#34C759', fontSize: 11, fontWeight: '800' }}>{totalP2A}</Text></View>
                           </View>
                        </View>
                      </View>

                      {matches.map(m => {
                        const isTeamA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                        const isWin = isTeamA ? m.team_a_score > m.team_b_score : m.team_b_score > m.team_a_score;
                        const isDraw = m.team_a_score === m.team_b_score;
                        const resColor = isWin ? '#34C759' : isDraw ? '#FF9500' : '#FF3B30';
                        const resIcon = isWin ? "arrow-up" : isDraw ? "remove" : "arrow-down";
                        const p1Id = String(id).trim();
                        const p2Id = String(comparisonPlayer.id).trim();
                        const p1G = m.goals?.[p1Id] || 0;
                        const p1A = m.assists?.[p1Id] || 0;
                        const p2G = m.goals?.[p2Id] || 0;
                        const p2A = m.assists?.[p2Id] || 0;

                        return (
                          <TouchableOpacity key={m.id} style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: dynamicStyles.divider.backgroundColor }} onPress={() => setSelectedMatch(m)}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <View style={[styles.trendCircleMini, { backgroundColor: resColor, width: 20, height: 20, marginRight: 8 }]}>
                                <Ionicons name={resIcon} size={12} color="#FFF" />
                              </View>
                              <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '600' }]}>{new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</Text>
                              <Text style={[dynamicStyles.text, { fontSize: 13, flex: 1, marginHorizontal: 10 }]} numberOfLines={1}>{m.team_a_name} - {m.team_b_name}</Text>
                              <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '800' }]}>{m.team_a_score}-{m.team_b_score}</Text>
                            </View>
                            {(p1G > 0 || p1A > 0 || p2G > 0 || p2A > 0) && (
                              <View style={{ flexDirection: 'row', marginLeft: 28, marginTop: 4, gap: 12 }}>
                                {(p1G > 0 || p1A > 0) && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#007AFF' }}>{player!.nickname}:</Text>
                                    {p1G > 0 && <View style={styles.miniStatBadge}><Ionicons name="football" size={8} color="#007AFF" /><Text style={[styles.miniStatText, { color: '#007AFF', fontSize: 9 }]}>{p1G}</Text></View>}
                                    {p1A > 0 && <View style={styles.miniStatBadge}><Ionicons name="people-outline" size={8} color="#007AFF" /><Text style={[styles.miniStatText, { color: '#007AFF', fontSize: 9 }]}>{p1A}</Text></View>}
                                  </View>
                                )}
                                {(p2G > 0 || p2A > 0) && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#34C759' }}>{comparisonPlayer.nickname}:</Text>
                                    {p2G > 0 && <View style={styles.miniStatBadge}><Ionicons name="football" size={8} color="#34C759" /><Text style={[styles.miniStatText, { color: '#34C759', fontSize: 9 }]}>{p2G}</Text></View>}
                                    {p2A > 0 && <View style={styles.miniStatBadge}><Ionicons name="people-outline" size={8} color="#34C759" /><Text style={[styles.miniStatText, { color: '#34C759', fontSize: 9 }]}>{p2A}</Text></View>}
                                  </View>
                                )}
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                };

                return (
                  <>
                    {renderMatchList(common?.togetherMatches || [], "Partite Insieme")}
                    {renderMatchList(common?.againstMatches || [], "Partite Contro")}
                  </>
                );
              })()}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  if (loading) return <View style={[styles.center, dynamicStyles.container]}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!player) return null;

  if (!editing) {
    return (
      <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={24} color="#007AFF" /></TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleShareStats} style={styles.iconBtn}><Ionicons name="share-social-outline" size={24} color="#34C759" /></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowComparisonSelector(true)} style={styles.iconBtn}><Ionicons name="people-outline" size={26} color="#5856D6" /></TouchableOpacity>
              {(group?.role === 'owner' || group?.role === 'admin') && (
                <>
                  <TouchableOpacity onPress={() => setEditing(true)} style={styles.iconBtn}><Ionicons name="pencil" size={22} color="#007AFF" /></TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}><Ionicons name="trash" size={22} color="#FF3B30" /></TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <View style={styles.profileSection}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileNickname, dynamicStyles.text]}>{player.nickname}</Text>
              {(player.name || player.surname || player.phone) && (
                <View style={{ marginTop: 2, marginBottom: 4 }}>
                  <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '700' }]}>
                    {player.name || ''} {player.surname || ''}
                    {(player.name || player.surname) && player.phone ? ' • ' : ''}
                    {player.phone || ''}
                  </Text>
                </View>
              )}
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={[styles.rolePill, { backgroundColor: getRoleColor(player.role) }]}><Text style={styles.rolePillText}>{player.role}</Text></View>
                </View>
                <View style={[styles.trendRowCompact, { marginTop: 8, gap: 6 }]}>
                  {championshipMatches.slice(0, 5).reverse().map((m) => {
                    const isTeamA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                    const result = m.team_a_score === m.team_b_score ? 'D' : ((isTeamA && m.team_a_score > m.team_b_score) || (!isTeamA && m.team_b_score > m.team_a_score)) ? 'W' : 'L';
                    return (
                      <View key={m.id} style={[styles.trendCircleMini, { backgroundColor: result === 'W' ? '#34C759' : result === 'D' ? '#FF9500' : '#FF3B30' }]}>
                        <Ionicons name={result === 'W' ? "arrow-up" : result === 'L' ? "arrow-down" : "remove"} size={12} color="#FFF" />
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
            <View style={styles.headerStats}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {player.date_of_birth && (
                  <Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '700', marginRight: 8 }]}>
                    {new Date(player.date_of_birth).toLocaleDateString('it-IT')}
                  </Text>
                )}
                <View style={[styles.headerStatBox, dynamicStyles.card]}><Text style={[styles.headerStatValue, dynamicStyles.text]}>{player.age}</Text><Text style={styles.headerStatLabel}>ANNI</Text></View>
              </View>
              {isAdminOrOwner && (
                <View style={[styles.headerStatBox, dynamicStyles.card, { alignSelf: 'flex-end' }]}><Text style={[styles.headerStatValue, dynamicStyles.text]}>{player.strength}</Text><Text style={styles.headerStatLabel}>FORZA</Text></View>
              )}
            </View>
          </View>

          {stats && (
            <View style={[styles.bibbiaCard, dynamicStyles.card, { paddingVertical: 12, paddingHorizontal: 18 }]}>
              <ProfileStatRow label="Punti" value={stats.points} />
              <ProfileStatRow label="Partite" value={stats.played} color="#A2845E" />
              <ProfileStatRow label="Vinte" value={stats.won} color="#34C759" onPress={() => showFilteredMatches('win')} />
              <ProfileStatRow label="Perse" value={stats.lost} color="#FF3B30" onPress={() => showFilteredMatches('loss')} />
              <ProfileStatRow label="Pareggiate" value={stats.drawn} color="#FF9500" onPress={() => showFilteredMatches('draw')} />
              {stats.tournament_count > 0 && <ProfileStatRow label="Tornei Disputati" value={stats.tournament_count} color="#5856D6" onPress={() => setShowTournamentBreakdown(true)} />}
              <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 8, marginHorizontal: 0 }]} />
              <ProfileStatRow label="Goal" value={stats.individual_goals} color="#FF3B30" />
              <ProfileStatRow label="Assist" value={stats.individual_assists} color="#34C759" />
              <ProfileStatRow label="Clean Sheets" value={stats.clean_sheets} color="#5AC8FA" onPress={() => showFilteredMatches('cs')} />
              <ProfileStatRow label="Bonus" value={stats.bonus_points} color="#5AC8FA" onPress={() => setShowBonusBreakdown(true)} />
              {(stats.personal_bonus_count > 0 || stats.defense_bonus_count > 0) && (
                 <View style={{ flexDirection: 'row', paddingLeft: 15, marginTop: -4, marginBottom: 6, gap: 10 }}>
                    {stats.personal_bonus_count > 0 && (
                      <TouchableOpacity onPress={() => showFilteredMatches('personal')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={{ fontSize: 10, color: '#8E8E93', fontWeight: '700' }}>PERSONALE: {stats.personal_bonus_count}</Text>
                        <Ionicons name="chevron-forward" size={10} color="#8E8E93" />
                      </TouchableOpacity>
                    )}
                    {stats.personal_bonus_count > 0 && stats.defense_bonus_count > 0 && <Text style={{ fontSize: 10, color: '#8E8E93', fontWeight: '700' }}>•</Text>}
                    {stats.defense_bonus_count > 0 && (
                      <TouchableOpacity onPress={() => showFilteredMatches('defense')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={{ fontSize: 10, color: '#8E8E93', fontWeight: '700' }}>DIFESA: {stats.defense_bonus_count}</Text>
                        <Ionicons name="chevron-forward" size={10} color="#8E8E93" />
                      </TouchableOpacity>
                    )}
                 </View>
              )}

              <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 8, marginHorizontal: 0 }]} />
              <ProfileStatRow label="Incisività" value={stats.incisivity} color="#FF9500" />
              <ProfileStatRow label="Media Goal Fatti" value={stats.individual_goals / (stats.career_divisor || 1)} color="#FF3B30" />
              <ProfileStatRow label="Media Assist Fatti" value={stats.individual_assists / (stats.career_divisor || 1)} color="#34C759" />
              <ProfileStatRow label="Media Goal Segnati Squadra" value={(stats.goals_done || 0) / (stats.career_divisor || 1)} color="#FF9500" />
              <ProfileStatRow label="Media Goal Subiti" value={stats.goals_suffered / (stats.career_divisor || 1)} />
            </View>

          )}

          {stats && group?.show_spider_rating !== false && stats.played > 0 && (
            <View style={[styles.chartCard, dynamicStyles.card]}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, width: '100%' }}>
                 <Text style={[styles.chartTitle, dynamicStyles.text, { marginBottom: 0 }]}>Analisi Prestazioni</Text>
                 <TouchableOpacity onPress={() => setShowSpiderInfoModal(true)} style={{ padding: 4 }}>
                   <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
                 </TouchableOpacity>
               </View>
               <RadarChart
                 isDarkMode={isDarkMode}
                 matchType={group?.match_type || 5}
                 stats={formatStatsForChart(stats)}
                 maxStats={maxStats}
                 radarConfig={group?.radar_config}
               />
            </View>
          )}

          {championshipMatches.length > 0 && (
            <View style={[styles.bibbiaCard, dynamicStyles.card, { paddingBottom: 10 }]}>
              <Text style={[styles.chartTitle, dynamicStyles.text, { marginBottom: 15 }]}>Ultime Partite</Text>
              {championshipMatches.slice(0, visibleMatchesCount).map((m, index) => {
                const isTeamA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                const isWin = isTeamA ? m.team_a_score > m.team_b_score : m.team_b_score > m.team_a_score;
                const isDraw = m.team_a_score === m.team_b_score;
                const resultColor = isWin ? '#34C759' : isDraw ? '#FF9500' : '#FF3B30';
                const resultText = isWin ? 'W' : isDraw ? 'D' : 'L';
                const pId = String(id).trim();
                const pG = (m.goals?.[pId] || 0) as number;
                const pA = (m.assists?.[pId] || 0) as number;

                return (
                  <View key={m.id}>
                    <TouchableOpacity style={styles.matchListItem} onPress={() => setSelectedMatch(m)}>
                      <View style={[styles.trendCircleMini, { backgroundColor: resultColor, width: 28, height: 28, borderRadius: 14 }]}><Ionicons name={resultText === 'W' ? "arrow-up" : resultText === 'L' ? "arrow-down" : "remove"} size={18} color="#FFF" /></View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.matchDate, dynamicStyles.subText]}>{new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</Text>
                        <Text style={[styles.matchTeams, dynamicStyles.text]} numberOfLines={1}>{m.team_a_name} vs {m.team_b_name}</Text>
                      </View>
                      <View style={styles.matchScoreBox}>
                        <Text style={[styles.matchScore, dynamicStyles.text]}>{m.team_a_score} - {m.team_b_score}</Text>
                        {(pG > 0 || pA > 0) && (
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                            {pG > 0 && <View style={styles.miniStatBadge}><Ionicons name="football" size={10} color="#FF3B30" /><Text style={[styles.miniStatText, { color: '#FF3B30' }]}>{pG}</Text></View>}
                            {pA > 0 && <View style={styles.miniStatBadge}><Ionicons name="people-outline" size={10} color="#34C759" /><Text style={[styles.miniStatText, { color: '#34C759' }]}>{pA}</Text></View>}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    {index < championshipMatches.slice(0, visibleMatchesCount).length - 1 && <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, opacity: 0.5 }]} />}
                  </View>
                );
              })}

              {championshipMatches.length > visibleMatchesCount && (
                <TouchableOpacity
                  onPress={() => setVisibleMatchesCount(prev => prev + 5)}
                  style={{ paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                >
                  <Text style={{ color: '#007AFF', fontWeight: '700', fontSize: 13 }}>Mostra più incontri</Text>
                  <Ionicons name="chevron-down" size={16} color="#007AFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
        {renderComparison()}
        {renderMatchDetail()}
        {renderFilteredMatchesModal()}
        {renderBonusBreakdownModal()}
        {renderTournamentBreakdownModal()}
        {renderProfileSharePreview()}
        {renderComparisonSharePreview()}
        <Modal visible={showComparisonSelector} animationType="slide" transparent={true} onRequestClose={() => setShowComparisonSelector(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => setShowComparisonSelector(false)}><View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /></TouchableWithoutFeedback>
            <View style={[styles.modalContent, dynamicStyles.modalContent, { height: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, dynamicStyles.text]}>Seleziona per Confronto</Text>
                <TouchableOpacity onPress={() => setShowComparisonSelector(false)}><Ionicons name="close" size={28} color={isDarkMode ? "#FFF" : "#1C1C1E"} /></TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                <View style={[styles.input, dynamicStyles.input, { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 12, marginBottom: 12, borderRadius: 12 }]}>
                  <Ionicons name="search" size={20} color="#8E8E93" style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, color: dynamicStyles.text.color, fontSize: 16 }}
                    placeholder="Cerca giocatore..."
                    placeholderTextColor="#8E8E93"
                    value={comparisonSearch}
                    onChangeText={setComparisonSearch}
                  />
                  {comparisonSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setComparisonSearch('')} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }}>
                  {ROLES.map((r, i) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setComparisonRole(comparisonRole === r ? null : r)}
                      style={{
                        flex: 1,
                        height: 38,
                        backgroundColor: comparisonRole === r ? getRoleColor(r) : (isDarkMode ? '#2C2C2E' : '#FFFFFF'),
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderLeftWidth: i === 0 ? 0 : 1,
                        borderLeftColor: isDarkMode ? '#3A3A3C' : '#E5E5EA',
                      }}
                    >
                      <Text style={{
                        color: comparisonRole === r ? '#FFF' : (isDarkMode ? '#AEAEB2' : '#8E8E93'),
                        fontSize: 8.5,
                        fontWeight: '900',
                        textAlign: 'center'
                      }}>
                        {r.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {allPlayers
                  .filter(p => {
                    const matchesRole = comparisonRole ? p.role === comparisonRole : true;
                    if (!matchesRole) return false;
                    if (!comparisonSearch) return true;
                    const s = comparisonSearch.toLowerCase();
                    return p.nickname.toLowerCase().includes(s) ||
                           (p.name || '').toLowerCase().includes(s) ||
                           (p.surname || '').toLowerCase().includes(s) ||
                           (p.phone || '').includes(s);
                  })
                  .sort((a, b) => a.nickname.localeCompare(b.nickname, 'it', { sensitivity: 'base' }))
                  .map(p => (
                    <TouchableOpacity key={p.id} style={[styles.playerSelectItem, { borderBottomColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }]} onPress={() => handleStartComparison(p)}>
                      <View style={{ flex: 1, marginLeft: 0 }}>
                        <Text style={[styles.playerSelectName, dynamicStyles.text, { fontSize: 15, fontWeight: '700' }]}>{p.nickname}</Text>
                        <Text style={{ fontSize: 10, color: getRoleColor(p.role), fontWeight: '600', textTransform: 'uppercase', marginTop: 1 }}>{p.role}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        {renderSpiderInfoModal()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.editContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setEditing(false)} style={styles.iconBtn}><Ionicons name="close" size={28} color={isDarkMode ? "#FFF" : "#1C1C1E"} /></TouchableOpacity>
            <Text style={[styles.headerTitle, dynamicStyles.text]}>Modifica Giocatore</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.label, dynamicStyles.text]}>Nickname</Text>
              <Text style={[styles.charCount, dynamicStyles.subText]}>{nickname.length}/8</Text>
            </View>
            <TextInput style={[styles.input, dynamicStyles.input]} value={nickname} onChangeText={setNickname} placeholder="Nickname" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} maxLength={8} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, dynamicStyles.text]}>Telefono (opz.)</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Es. 333 1234567"
              placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"}
              keyboardType="phone-pad"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}><View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}><Text style={[styles.label, dynamicStyles.text]}>Nome (opz.)</Text><TextInput style={[styles.input, dynamicStyles.input]} value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} /></View><View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}><Text style={[styles.label, dynamicStyles.text]}>Cognome (opz.)</Text><TextInput style={[styles.input, dynamicStyles.input]} value={surname} onChangeText={setSurname} placeholder="Cognome" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} /></View></View>
          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[styles.label, dynamicStyles.text, { marginBottom: 0 }]}>Data di Nascita</Text>
              <TouchableOpacity onPress={() => setIsManualDob(!isManualDob)} style={{ padding: 4 }}>
                <Ionicons name={isManualDob ? "calendar-outline" : "pencil-outline"} size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.ageContainer}>
              {isManualDob ? (
                <TextInput
                  style={[styles.input, dynamicStyles.input, { flex: 1, marginRight: 12 }]}
                  value={manualDobText}
                  onChangeText={handleManualDobChange}
                  placeholder="GG/MM/AAAA"
                  placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"}
                  keyboardType="numeric"
                  maxLength={10}
                />
              ) : (
                <TouchableOpacity style={[styles.input, dynamicStyles.input, styles.datePickerButton]} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color="#007AFF" style={{ marginRight: 10 }} />
                  <Text style={[styles.dateText, dynamicStyles.text]}>{dob.toLocaleDateString('it-IT')}</Text>
                </TouchableOpacity>
              )}
              <View style={[styles.ageBox, dynamicStyles.card, { borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }]}>
                <Text style={styles.ageNumber}>{calculateAgeDisplay(dob)}</Text>
                <Text style={[styles.ageLabel, dynamicStyles.subText]}>ANNI</Text>
              </View>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={dob}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
                themeVariant={isDarkMode ? 'dark' : 'light'}
              />
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, dynamicStyles.text]}>Ruolo</Text>
            <View style={styles.roleGrid}>{ROLES.map((r) => (
              <TouchableOpacity key={r} style={[styles.roleOption, dynamicStyles.card, {borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'}, role === r && { backgroundColor: getRoleColor(r), borderColor: getRoleColor(r) }]} onPress={() => setRole(r)}><Text style={[styles.roleOptionText, dynamicStyles.text, role === r && { color: '#FFF' }]}>{r}</Text></TouchableOpacity>
            ))}</View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, dynamicStyles.text]}>Livello di Forza</Text>
            <TouchableOpacity style={[styles.strengthPreviewBox, dynamicStyles.card, {borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'}]} onPress={() => { setStrengthText(String(strength)); setShowStrengthModal(true); }}><View style={[styles.strengthDisplay, {backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7'}]}><Text style={[styles.strengthNumber, dynamicStyles.text]}>{strength}</Text><Text style={[styles.strengthSubText, dynamicStyles.subText]}>VALORE</Text></View><Ionicons name="chevron-down" size={24} color="#8E8E93" /></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Salva Modifiche</Text>}</TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={showStrengthModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { height: 'auto', minHeight: 300 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Regola Forza</Text>
              <TouchableOpacity onPress={() => setShowStrengthModal(false)}>
                <Ionicons name="close" size={24} color={dynamicStyles.text.color} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 30, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 25 }}>
                <TouchableOpacity
                  onPress={() => {
                    const newVal = Math.max(1, Number((strength - 0.5).toFixed(1)));
                    setStrength(newVal);
                    setStrengthText(String(newVal));
                  }}
                  style={[styles.adjustBtn, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' }]}
                >
                  <Ionicons name="remove" size={32} color="#007AFF" />
                </TouchableOpacity>
                <View style={{ alignItems: 'center', minWidth: 100 }}>
                  <TextInput
                    style={[styles.strengthLargeInput, dynamicStyles.text]}
                    keyboardType="decimal-pad"
                    value={strengthText}
                    selectTextOnFocus
                    onChangeText={(v) => {
                      setStrengthText(v);
                      const sanitized = v.replace(',', '.');
                      const val = parseFloat(sanitized);
                      if (!isNaN(val)) setStrength(val);
                    }}
                    onBlur={() => {
                      const sanitized = strengthText.replace(',', '.');
                      let val = parseFloat(sanitized);
                      if (isNaN(val)) val = strength || 5;
                      val = Math.max(1, Math.min(10, val));
                      val = Number(val.toFixed(1));
                      setStrength(val);
                      setStrengthText(String(val));
                    }}
                  />
                  <Text style={[dynamicStyles.subText, { fontSize: 10, fontWeight: '800', marginTop: -5, letterSpacing: 1 }]}>VALORE ATTUALE</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const newVal = Math.min(10, Number((strength + 0.5).toFixed(1)));
                    setStrength(newVal);
                    setStrengthText(String(newVal));
                  }}
                  style={[styles.adjustBtn, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' }]}
                >
                  <Ionicons name="add" size={32} color="#007AFF" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.saveButton, { width: '100%', marginTop: 40, height: 54 }]}
                onPress={() => {
                  const sanitized = strengthText.replace(',', '.');
                  let val = parseFloat(sanitized);
                  if (isNaN(val)) val = strength || 5;
                  val = Math.max(1, Math.min(10, val));
                  val = Number(val.toFixed(1));
                  setStrength(val);
                  setStrengthText(String(val));
                  setShowStrengthModal(false);
                }}
              >
                <Text style={styles.saveButtonText}>Conferma Valore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  headerActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  charCount: { fontSize: 11, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  profileSection: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, alignItems: 'flex-start' },
  profileNickname: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 0 },
  profileName: { fontSize: 14, fontWeight: '500', marginBottom: 5, opacity: 0.7 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 0 },
  rolePillText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  headerStats: { gap: 6 },
  headerStatBox: { width: 55, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  headerStatValue: { fontSize: 16, fontWeight: '900' },
  headerStatLabel: { fontSize: 7, fontWeight: '700', color: '#8E8E93', marginTop: -2 },
  trendRowCompact: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  trendDot: { width: 6, height: 6, borderRadius: 3 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 15 },
  statCard: { flex: 1, borderRadius: 12, padding: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statValue: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  detailsCard: { borderRadius: 12, marginHorizontal: 20, padding: 2, marginBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  detailLabel: { fontSize: 14, fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '600' },
  detailDivider: { height: 0.5, marginHorizontal: 12 },
  chartCard: { marginHorizontal: 15, marginBottom: 8, borderRadius: 12, padding: 8, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  bibbiaCard: { marginHorizontal: 15, marginBottom: 10, borderRadius: 12, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  gridStats: { flexDirection: 'row', justifyContent: 'space-between' },
  gridItem: { alignItems: 'center', flex: 1 },
  gridValue: { fontSize: 18, fontWeight: '800' },
  gridLabel: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  miniLabel: { fontSize: 8, color: '#8E8E93', marginTop: 1 },
  sectionSubtitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  trendRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  trendCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  trendText: { fontSize: 10, fontWeight: '800' },
  chartTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, alignSelf: 'flex-start' },
  compHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  compPlayerBox: { alignItems: 'center', width: '40%' },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
  miniAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  compPlayerName: { fontSize: 14, fontWeight: '800' },
  vsText: { fontSize: 16, fontWeight: '900', fontStyle: 'italic' },
  compRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  compValue: { fontSize: 16, fontWeight: '900' },
  compLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center', width: 90 },
  commonStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  commonStat: { alignItems: 'center' },
  commonValue: { fontSize: 24, fontWeight: '800' },
  commonLabel: { fontSize: 12, fontWeight: '600' },
  compTrends: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  trendColumn: { gap: 6, alignItems: 'center' },
  trendCircleMini: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  trendTextMini: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  playerSelectItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 0.5 },
  playerSelectName: { fontSize: 16, fontWeight: '700' },
  editContent: { paddingHorizontal: 20, paddingBottom: 40 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 44, fontSize: 16 },
  datePickerButton: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  dateText: { fontSize: 16 },
  ageContainer: { flexDirection: 'row', alignItems: 'center' },
  ageBox: { width: 54, height: 54, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ageNumber: { fontSize: 20, fontWeight: '800', color: '#007AFF' },
  ageLabel: { fontSize: 9, fontWeight: '700', marginTop: -2 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  roleOptionText: { fontSize: 14, fontWeight: '600' },
  strengthPreviewBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  strengthDisplay: { alignItems: 'center', justifyContent: 'center', width: 54, height: 54, borderRadius: 12 },
  strengthNumber: { fontSize: 22, fontWeight: '800' },
  strengthSubText: { fontSize: 9, fontWeight: '700', marginTop: -2 },
  adjustBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  strengthLargeInput: { fontSize: 48, fontWeight: '900', textAlign: 'center', minWidth: 80, padding: 0, margin: 0 },
  saveButton: { backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  saveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '50%', paddingBottom: 40 },
  modalHeader: { padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  strengthGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'center' },
  strengthOption: { width: '22%', aspectRatio: 1, margin: '1%', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  strengthOptionText: { fontSize: 16, fontWeight: '700' },
  matchListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  matchResultBadge: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  matchResultText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  matchDate: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  matchTeams: { fontSize: 15, fontWeight: '600', marginTop: 1 },
  matchScoreBox: { alignItems: 'flex-end' },
  matchScore: { fontSize: 16, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  miniStatBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  miniStatText: { fontSize: 10, fontWeight: '700', color: '#8E8E93' },
});
