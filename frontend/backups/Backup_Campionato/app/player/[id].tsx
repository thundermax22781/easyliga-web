import React, { useState, useEffect, useRef } from 'react';
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
  const { id, groupId } = useLocalSearchParams<{ id: string; groupId: string }>();
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
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStrengthModal, setShowStrengthModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isSharingProfile, setIsSharingProfile] = useState(false);
  const [isSharingComparison, setIsSharingComparison] = useState(false);
  const profileViewShotRef = useRef<any>(null);
  const comparisonViewShotRef = useRef<any>(null);

  // Editable fields
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [role, setRole] = useState('');
  const [strength, setStrength] = useState(5);

  const getRoleColor = (r: string) => ROLE_COLORS[r] || '#8E8E93';
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
        setNickname(found.nickname);
        setDob(found.date_of_birth ? new Date(found.date_of_birth) : new Date());
        setRole(found.role);
        setStrength(found.strength);

        const allStats = await calculateStandings(groupId);
        const playerStats = allStats.find(s => String(s.player_id).trim() === String(id).trim());
        if (playerStats) {
          setStats(playerStats);
        } else {
          setStats({
            player_id: String(id),
            nickname: found.nickname,
            role: found.role,
            played: 0, won: 0, drawn: 0, lost: 0, points: 0,
            goals_done: 0, goals_suffered: 0, individual_goals: 0, individual_assists: 0, clean_sheets: 0
          });
        }

        const allMatches = await fetchMatches(groupId);
        const pId = String(id).trim();
        const playerHistory = allMatches.filter(m =>
          m.team_a_players.map(pid => String(pid).trim()).includes(pId) ||
          m.team_b_players.map(pid => String(pid).trim()).includes(pId)
        );
        setPlayerMatches(playerHistory);
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
    if (selectedDate) setDob(selectedDate);
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
        date_of_birth: dob.toISOString().split('T')[0],
        role,
        strength,
        group_id: groupId,
      });
      loadPlayer();
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Errore', 'Impossibile salvare le modifiche');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !groupId) return;

    // Recupero match per controllo integrità
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
  };

  const handleShareComparison = async () => {
    if (!player || !comparisonPlayer || !stats || !comparisonStats) return;
    setIsSharingComparison(true);
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
  };

  const dynamicStyles = {
    container: { backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7' },
    text: { color: isDarkMode ? '#FFFFFF' : '#1C1C1E' },
    subText: { color: isDarkMode ? '#AEAEB2' : '#8E8E93' },
    card: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF' },
    input: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF', color: isDarkMode ? '#FFF' : '#1C1C1E', borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' },
    modalContent: { backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF' },
    divider: { backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }
  };

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
        goals_done: 0, goals_suffered: 0, individual_goals: 0, individual_assists: 0, clean_sheets: 0
      });
    }

    const allMatches = await fetchMatches(groupId as string);
    const pMatches = allMatches.filter(m =>
      m.team_a_players.map(pid => String(pid).trim()).includes(String(otherPlayer.id).trim()) ||
      m.team_b_players.map(pid => String(pid).trim()).includes(String(otherPlayer.id).trim())
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
        if ((p1InA && p2InA) || (p1InB && p2InB)) {
          acc.together++;
          acc.togetherMatches.push(m);
        } else {
          acc.against++;
          acc.againstMatches.push(m);
        }
      }
      return acc;
    }, { together: 0, against: 0, togetherMatches: [] as Match[], againstMatches: [] as Match[] });
  };

  const ComparisonRow = ({ label, val1, val2, betterIsHigher = true }: { label: string, val1: number, val2: number, betterIsHigher?: boolean }) => {
    const isBetter1 = betterIsHigher ? val1 > val2 : val1 < val2;
    const isBetter2 = betterIsHigher ? val2 > val1 : val2 < val1;
    const isWorse1 = betterIsHigher ? val1 < val2 : val1 > val2;
    const isWorse2 = betterIsHigher ? val2 < val1 : val2 > val1;
    const color1 = isBetter1 ? '#34C759' : (isWorse1 ? '#FF3B30' : dynamicStyles.text.color);
    const color2 = isBetter2 ? '#34C759' : (isWorse2 ? '#FF3B30' : dynamicStyles.text.color);

    return (
      <View style={styles.compRow}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Text style={[styles.compValue, { color: color1 }]}>{val1.toFixed(val1 % 1 === 0 ? 0 : 2)}</Text>
        </View>
        <Text style={[styles.compLabel, dynamicStyles.subText]}>{label}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={[styles.compValue, { color: color2 }]}>{val2.toFixed(val2 % 1 === 0 ? 0 : 2)}</Text>
        </View>
      </View>
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

  const renderProfileSharePreview = () => {
    if (!isSharingProfile || !player || !stats) return null;
    return (
      <Modal visible={true} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <ViewShot ref={profileViewShotRef} options={{ format: "png", quality: 0.9 }} style={{ width: '95%', backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 25, borderRadius: 24 }}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[dynamicStyles.text, { fontSize: 28, fontWeight: '900' }]}>{player.nickname.toUpperCase()}</Text>
                  <View style={[styles.rolePill, { backgroundColor: getRoleColor(player.role), marginTop: 5, alignSelf: 'flex-start' }]}>
                    <Text style={styles.rolePillText}>{player.role}</Text>
                  </View>
                  {/* Rendimento Recente */}
                  <View style={[styles.trendRowCompact, { marginTop: 10, gap: 6 }]}>
                    {playerMatches.slice(0, 5).map((m) => {
                      const isTeamA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                      const result = m.team_a_score === m.team_b_score ? 'D' : ((isTeamA && m.team_a_score > m.team_b_score) || (!isTeamA && m.team_b_score > m.team_a_score)) ? 'W' : 'L';
                      return (
                        <View key={m.id} style={[styles.trendCircleMini, { backgroundColor: result === 'W' ? '#34C759' : result === 'D' ? '#FF9500' : '#FF3B30', width: 22, height: 22, borderRadius: 11 }]}>
                          <Ionicons name={result === 'W' ? "arrow-up" : result === 'L' ? "arrow-down" : "remove"} size={12} color="#FFF" />
                        </View>
                      );
                    })}
                  </View>
                </View>
                <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }}>
                  <Image source={require('../../assets/images/icon.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
                </View>
             </View>

             <View style={[styles.bibbiaCard, dynamicStyles.card, { marginHorizontal: 0, padding: 20, borderWidth: 2, borderColor: getRoleColor(player.role) }]}>
                <View style={styles.gridStats}>
                  <View style={styles.gridItem}><Text style={[styles.gridValue, dynamicStyles.text]}>{stats.played}</Text><Text style={styles.gridLabel}>Partite</Text></View>
                  <View style={styles.gridItem}><Text style={[styles.gridValue, { color: '#34C759' }]}>{stats.won}</Text><Text style={styles.gridLabel}>Vinte</Text></View>
                  <View style={styles.gridItem}><Text style={[styles.gridValue, { color: '#FF9500' }]}>{stats.drawn}</Text><Text style={styles.gridLabel}>Pareggi</Text></View>
                  <View style={styles.gridItem}><Text style={[styles.gridValue, { color: '#FF3B30' }]}>{stats.lost}</Text><Text style={styles.gridLabel}>Perse</Text></View>
                </View>
                <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 15 }]} />
                <View style={styles.gridStats}>
                  <View style={styles.gridItem}>
                    <Text style={[styles.gridValue, { color: '#FF3B30' }]}>{stats.individual_goals}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#FF3B30', marginTop: -2 }}>({(stats.individual_goals / (stats.played || 1)).toFixed(2)})</Text>
                    <Text style={[styles.gridLabel, { color: '#FF3B30', marginTop: 2 }]}>Goal</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={[styles.gridValue, { color: '#34C759' }]}>{stats.individual_assists}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#34C759', marginTop: -2 }}>({(stats.individual_assists / (stats.played || 1)).toFixed(2)})</Text>
                    <Text style={[styles.gridLabel, { color: '#34C759', marginTop: 2 }]}>Assist</Text>
                  </View>
                  <View style={styles.gridItem}><Text style={[styles.gridValue, dynamicStyles.text]}>{(stats.goals_suffered / (stats.played || 1)).toFixed(1)}</Text><Text style={styles.gridLabel}>Media S.</Text></View>
                  <View style={styles.gridItem}><Text style={[styles.gridValue, dynamicStyles.text]}>{stats.clean_sheets}</Text><Text style={styles.gridLabel}>C. Sheet</Text></View>
                </View>
             </View>

             <View style={[styles.chartCard, dynamicStyles.card, { marginHorizontal: 0, padding: 5, marginTop: 10, alignItems: 'center', justifyContent: 'center' }]}>
                <RadarChart isDarkMode={isDarkMode} matchType={group?.match_type || 5} stats={{ goals: stats.individual_goals, assists: stats.individual_assists, cleanSheets: stats.clean_sheets, goalsConceded: stats.goals_suffered, wins: stats.won, matches: stats.played, points: stats.points }} />
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

  const renderComparisonSharePreview = () => {
    if (!isSharingComparison || !player || !comparisonPlayer || !stats || !comparisonStats) return null;
    return (
      <Modal visible={true} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <ViewShot ref={comparisonViewShotRef} options={{ format: "png", quality: 0.9 }} style={{ width: '95%', backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 20, borderRadius: 24 }}>
             <View style={styles.compHeader}>
                <View style={styles.compPlayerBox}>
                  <View style={[styles.miniAvatar, { backgroundColor: getRoleColor(player.role), width: 50, height: 50, borderRadius: 25 }]}>
                    <Text style={[styles.miniAvatarText, { fontSize: 20 }]}>{getInitials(player.nickname)}</Text>
                  </View>
                  <Text style={[styles.compPlayerName, dynamicStyles.text]}>{player.nickname}</Text>
                  {/* Trend Player 1 */}
                  <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
                    {playerMatches.slice(0, 5).map((m) => {
                      const isA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                      const res = m.team_a_score === m.team_b_score ? 'D' : ((isA && m.team_a_score > m.team_b_score) || (!isA && m.team_b_score > m.team_a_score)) ? 'W' : 'L';
                      return (
                        <View key={m.id} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: res === 'W' ? '#34C759' : res === 'D' ? '#FF9500' : '#FF3B30', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={res === 'W' ? "arrow-up" : res === 'L' ? "arrow-down" : "remove"} size={8} color="#FFF" />
                        </View>
                      );
                    })}
                  </View>
                </View>

                <Text style={[styles.vsText, { fontSize: 24, marginTop: -20 }]}>VS</Text>

                <View style={styles.compPlayerBox}>
                  <View style={[styles.miniAvatar, { backgroundColor: getRoleColor(comparisonPlayer.role), width: 50, height: 50, borderRadius: 25 }]}>
                    <Text style={[styles.miniAvatarText, { fontSize: 20 }]}>{getInitials(comparisonPlayer.nickname)}</Text>
                  </View>
                  <Text style={[styles.compPlayerName, dynamicStyles.text]}>{comparisonPlayer.nickname}</Text>
                  {/* Trend Player 2 */}
                  <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
                    {comparisonMatches.slice(0, 5).map((m) => {
                      const isA = m.team_a_players.map(pid => String(pid).trim()).includes(String(comparisonPlayer.id).trim());
                      const res = m.team_a_score === m.team_b_score ? 'D' : ((isA && m.team_a_score > m.team_b_score) || (!isA && m.team_b_score > m.team_a_score)) ? 'W' : 'L';
                      return (
                        <View key={m.id} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: res === 'W' ? '#34C759' : res === 'D' ? '#FF9500' : '#FF3B30', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={res === 'W' ? "arrow-up" : res === 'L' ? "arrow-down" : "remove"} size={8} color="#FFF" />
                        </View>
                      );
                    })}
                  </View>
                </View>
             </View>

             <View style={[styles.bibbiaCard, dynamicStyles.card, { marginHorizontal: 0, paddingVertical: 10, marginTop: 10 }]}>
                <ComparisonRow label="Partite" val1={stats.played} val2={comparisonStats.played} />
                <ComparisonRow label="Vinte" val1={stats.won} val2={comparisonStats.won} />
                <ComparisonRow label="Punti" val1={stats.points} val2={comparisonStats.points} />
                <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 6 }]} />

                {/* Goal e Media Uniti */}
                <View style={styles.compRow}>
                  <View style={{ alignItems: 'flex-start', flex: 1 }}>
                    <Text style={[styles.compValue, { color: stats.individual_goals > comparisonStats.individual_goals ? '#34C759' : '#FF3B30' }]} numberOfLines={1}>{stats.individual_goals}</Text>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#FF3B30' }}>({(stats.individual_goals / (stats.played || 1)).toFixed(2)})</Text>
                  </View>
                  <Text style={[styles.compLabel, dynamicStyles.subText]}>Goal</Text>
                  <View style={{ alignItems: 'flex-end', flex: 1 }}>
                    <Text style={[styles.compValue, { color: comparisonStats.individual_goals > stats.individual_goals ? '#34C759' : '#FF3B30' }]} numberOfLines={1}>{comparisonStats.individual_goals}</Text>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#FF3B30' }}>({(comparisonStats.individual_goals / (comparisonStats.played || 1)).toFixed(2)})</Text>
                  </View>
                </View>

                {/* Assist e Media Uniti */}
                <View style={styles.compRow}>
                  <View style={{ alignItems: 'flex-start', flex: 1 }}>
                    <Text style={[styles.compValue, { color: stats.individual_assists > comparisonStats.individual_assists ? '#34C759' : '#FF3B30' }]} numberOfLines={1}>{stats.individual_assists}</Text>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#34C759' }}>({(stats.individual_assists / (stats.played || 1)).toFixed(2)})</Text>
                  </View>
                  <Text style={[styles.compLabel, dynamicStyles.subText]}>Assist</Text>
                  <View style={{ alignItems: 'flex-end', flex: 1 }}>
                    <Text style={[styles.compValue, { color: comparisonStats.individual_assists > stats.individual_assists ? '#34C759' : '#FF3B30' }]} numberOfLines={1}>{comparisonStats.individual_assists}</Text>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#34C759' }}>({(comparisonStats.individual_assists / (comparisonStats.played || 1)).toFixed(2)})</Text>
                  </View>
                </View>

                <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 6 }]} />
                <ComparisonRow label="Media Subiti" val1={stats.goals_suffered / (stats.played || 1)} val2={comparisonStats.goals_suffered / (comparisonStats.played || 1)} betterIsHigher={false} />
                <ComparisonRow label="Clean Sheets" val1={stats.clean_sheets} val2={comparisonStats.clean_sheets} />
             </View>

             <View style={[styles.chartCard, dynamicStyles.card, { marginHorizontal: 0, padding: 5, marginTop: 5, marginBottom: 0 }]}>
                <RadarChart isDarkMode={isDarkMode} matchType={group?.match_type || 5} stats={{ goals: stats.individual_goals, assists: stats.individual_assists, cleanSheets: stats.clean_sheets, goalsConceded: stats.goals_suffered, wins: stats.won, matches: stats.played, points: stats.points }} comparisonStats={{ goals: comparisonStats.individual_goals, assists: comparisonStats.individual_assists, cleanSheets: comparisonStats.clean_sheets, goalsConceded: comparisonStats.goals_suffered, wins: comparisonStats.won, matches: comparisonStats.played, points: comparisonStats.points }} />
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

  const renderComparison = () => {
    if (!comparisonPlayer || !stats || !comparisonStats) return null;
    const common = getCommonStats();
    return (
      <Modal visible={!!comparisonPlayer} animationType="slide" onRequestClose={() => setComparisonPlayer(null)}>
        <SafeAreaView style={[styles.container, dynamicStyles.container]}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setComparisonPlayer(null)} style={styles.iconBtn}><Ionicons name="close" size={28} color={dynamicStyles.text.color} /></TouchableOpacity>
              <Text style={[styles.headerTitle, dynamicStyles.text]}>Confronto Giocatori</Text>
              <TouchableOpacity onPress={handleShareComparison} style={styles.iconBtn}><Ionicons name="share-social-outline" size={24} color="#34C759" /></TouchableOpacity>
            </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.compHeader}>
              <View style={styles.compPlayerBox}>
                <View style={[styles.miniAvatar, { backgroundColor: getRoleColor(player!.role) }]}><Text style={styles.miniAvatarText}>{getInitials(player!.nickname)}</Text></View>
                <Text style={[styles.compPlayerName, dynamicStyles.text]} numberOfLines={1}>{player!.nickname}</Text>
              </View>
              <Text style={[styles.vsText, dynamicStyles.subText]}>VS</Text>
              <View style={styles.compPlayerBox}>
                <View style={[styles.miniAvatar, { backgroundColor: getRoleColor(comparisonPlayer.role) }]}><Text style={styles.miniAvatarText}>{getInitials(comparisonPlayer.nickname)}</Text></View>
                <Text style={[styles.compPlayerName, dynamicStyles.text]} numberOfLines={1}>{comparisonPlayer.nickname}</Text>
              </View>
            </View>
            <View style={[styles.bibbiaCard, dynamicStyles.card]}>
              <ComparisonRow label="Partite" val1={stats.played} val2={comparisonStats.played} />
              <ComparisonRow label="Vinte" val1={stats.won} val2={comparisonStats.won} />
              <ComparisonRow label="Punti" val1={stats.points} val2={comparisonStats.points} />
              <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 10 }]} />

              {/* Goal e Media Uniti */}
              <View style={styles.compRow}>
                <View style={{ alignItems: 'flex-start', flex: 1 }}>
                  <Text style={[styles.compValue, { color: stats.individual_goals > comparisonStats.individual_goals ? '#34C759' : '#FF3B30' }]}>{stats.individual_goals}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#FF3B30' }}>({(stats.individual_goals / (stats.played || 1)).toFixed(2)})</Text>
                </View>
                <Text style={[styles.compLabel, dynamicStyles.subText]}>Goal</Text>
                <View style={{ alignItems: 'flex-end', flex: 1 }}>
                  <Text style={[styles.compValue, { color: comparisonStats.individual_goals > stats.individual_goals ? '#34C759' : '#FF3B30' }]}>{comparisonStats.individual_goals}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#FF3B30' }}>({(comparisonStats.individual_goals / (comparisonStats.played || 1)).toFixed(2)})</Text>
                </View>
              </View>

              {/* Assist e Media Uniti */}
              <View style={styles.compRow}>
                <View style={{ alignItems: 'flex-start', flex: 1 }}>
                  <Text style={[styles.compValue, { color: stats.individual_assists > comparisonStats.individual_assists ? '#34C759' : '#FF3B30' }]}>{stats.individual_assists}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#34C759' }}>({(stats.individual_assists / (stats.played || 1)).toFixed(2)})</Text>
                </View>
                <Text style={[styles.compLabel, dynamicStyles.subText]}>Assist</Text>
                <View style={{ alignItems: 'flex-end', flex: 1 }}>
                  <Text style={[styles.compValue, { color: comparisonStats.individual_assists > stats.individual_assists ? '#34C759' : '#FF3B30' }]}>{comparisonStats.individual_assists}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#34C759' }}>({(comparisonStats.individual_assists / (stats.played || 1)).toFixed(2)})</Text>
                </View>
              </View>

              <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 10 }]} />
              <ComparisonRow label="Media Subiti" val1={stats.goals_suffered / (stats.played || 1)} val2={comparisonStats.goals_suffered / (comparisonStats.played || 1)} betterIsHigher={false} />
              <ComparisonRow label="Clean Sheets" val1={stats.clean_sheets} val2={comparisonStats.clean_sheets} />
            </View>
            <View style={[styles.bibbiaCard, dynamicStyles.card]}>
              <Text style={[styles.sectionSubtitle, dynamicStyles.subText, { textAlign: 'center' }]}>Confronto Prestazioni</Text>
              <RadarChart isDarkMode={isDarkMode} matchType={group?.match_type || 5} stats={{ goals: stats.individual_goals, assists: stats.individual_assists, cleanSheets: stats.clean_sheets, goalsConceded: stats.goals_suffered, wins: stats.won, matches: stats.played, points: stats.points }} comparisonStats={{ goals: comparisonStats.individual_goals, assists: comparisonStats.individual_assists, cleanSheets: comparisonStats.clean_sheets, goalsConceded: comparisonStats.goals_suffered, wins: comparisonStats.won, matches: comparisonStats.played, points: comparisonStats.points }} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#007AFF' }} /><Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '700' }]}>{player!.nickname.toUpperCase()}</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#34C759' }} /><Text style={[dynamicStyles.subText, { fontSize: 11, fontWeight: '700' }]}>{comparisonPlayer.nickname.toUpperCase()}</Text></View>
              </View>
            </View>

            <View style={[styles.bibbiaCard, dynamicStyles.card]}>
              <Text style={[styles.sectionSubtitle, dynamicStyles.subText]}>Scontro Diretto / Intesa</Text>
              <View style={styles.commonStatsRow}>
                <View style={styles.commonStat}><Text style={[styles.commonValue, dynamicStyles.text]}>{common?.together}</Text><Text style={[styles.commonLabel, dynamicStyles.subText]}>Insieme</Text></View>
                <View style={styles.commonStat}><Text style={[styles.commonValue, dynamicStyles.text]}>{common?.against}</Text><Text style={[styles.commonLabel, dynamicStyles.subText]}>Contro</Text></View>
              </View>
              {common && common.togetherMatches.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={[dynamicStyles.subText, { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10 }]}>Partite Insieme</Text>
                  {common.togetherMatches.map(m => {
                    const isTeamA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                    const isWin = isTeamA ? m.team_a_score > m.team_b_score : m.team_b_score > m.team_a_score;
                    const isDraw = m.team_a_score === m.team_b_score;
                    const resColor = isWin ? '#34C759' : isDraw ? '#FF9500' : '#FF3B30';
                    const resIcon = isWin ? "arrow-up" : isDraw ? "remove" : "arrow-down";

                    return (
                      <TouchableOpacity key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: dynamicStyles.divider.backgroundColor }} onPress={() => setSelectedMatch(m)}>
                        <View style={[styles.trendCircleMini, { backgroundColor: resColor, width: 20, height: 20, marginRight: 8 }]}>
                           <Ionicons name={resIcon} size={12} color="#FFF" />
                        </View>
                        <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '600' }]}>{new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</Text>
                        <Text style={[dynamicStyles.text, { fontSize: 13, flex: 1, marginHorizontal: 10 }]} numberOfLines={1}>{m.team_a_name} - {m.team_b_name}</Text>
                        <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '800' }]}>{m.team_a_score}-{m.team_b_score}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {common && common.againstMatches.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={[dynamicStyles.subText, { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10 }]}>Partite Contro</Text>
                  {common.againstMatches.map(m => {
                    const isTeamA = m.team_a_players.map(pid => String(pid).trim()).includes(String(id).trim());
                    const isWin = isTeamA ? m.team_a_score > m.team_b_score : m.team_b_score > m.team_a_score;
                    const isDraw = m.team_a_score === m.team_b_score;
                    const resColor = isWin ? '#34C759' : isDraw ? '#FF9500' : '#FF3B30';
                    const resIcon = isWin ? "arrow-up" : isDraw ? "remove" : "arrow-down";

                    return (
                      <TouchableOpacity key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: dynamicStyles.divider.backgroundColor }} onPress={() => setSelectedMatch(m)}>
                        <View style={[styles.trendCircleMini, { backgroundColor: resColor, width: 20, height: 20, marginRight: 8 }]}>
                           <Ionicons name={resIcon} size={12} color="#FFF" />
                        </View>
                        <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '600' }]}>{new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</Text>
                        <Text style={[dynamicStyles.text, { fontSize: 13, flex: 1, marginHorizontal: 10 }]} numberOfLines={1}>{m.team_a_name} - {m.team_b_name}</Text>
                        <Text style={[dynamicStyles.text, { fontSize: 13, fontWeight: '800' }]}>{m.team_a_score}-{m.team_b_score}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
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
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={[styles.rolePill, { backgroundColor: getRoleColor(player.role) }]}><Text style={styles.rolePillText}>{player.role}</Text></View>
                </View>
                <View style={[styles.trendRowCompact, { marginTop: 8, gap: 6 }]}>
                  {playerMatches.slice(0, 5).map((m) => {
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
              <View style={[styles.headerStatBox, dynamicStyles.card]}><Text style={[styles.headerStatValue, dynamicStyles.text]}>{player.strength}</Text><Text style={styles.headerStatLabel}>FORZA</Text></View>
              <View style={[styles.headerStatBox, dynamicStyles.card]}><Text style={[styles.headerStatValue, dynamicStyles.text]}>{player.age}</Text><Text style={styles.headerStatLabel}>ANNI</Text></View>
            </View>
          </View>

          {stats && (
            <View style={[styles.bibbiaCard, dynamicStyles.card]}>
              <View style={styles.gridStats}>
                <View style={styles.gridItem}><Text style={[styles.gridValue, dynamicStyles.text]}>{stats.played}</Text><Text style={[styles.gridLabel, dynamicStyles.subText]}>Partite</Text></View>
                <View style={styles.gridItem}><Text style={[styles.gridValue, { color: '#34C759' }]}>{stats.won}</Text><Text style={[styles.gridLabel, dynamicStyles.subText]}>Vinte</Text></View>
                <View style={styles.gridItem}><Text style={[styles.gridValue, { color: '#FF9500' }]}>{stats.drawn}</Text><Text style={[styles.gridLabel, dynamicStyles.subText]}>Pareggi</Text></View>
                <View style={styles.gridItem}><Text style={[styles.gridValue, { color: '#FF3B30' }]}>{stats.lost}</Text><Text style={[styles.gridLabel, dynamicStyles.subText]}>Perse</Text></View>
              </View>
              <View style={[styles.detailDivider, dynamicStyles.divider, { marginVertical: 15 }]} />
              <View style={styles.gridStats}>
                <View style={styles.gridItem}>
                  <Text style={[styles.gridValue, { color: '#FF3B30' }]}>{stats.individual_goals}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#FF3B30', marginTop: -2 }}>({(stats.individual_goals / (stats.played || 1)).toFixed(2)})</Text>
                  <Text style={[styles.gridLabel, { color: '#FF3B30', marginTop: 2 }]}>Goal</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={[styles.gridValue, { color: '#34C759' }]}>{stats.individual_assists}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#34C759', marginTop: -2 }}>({(stats.individual_assists / (stats.played || 1)).toFixed(2)})</Text>
                  <Text style={[styles.gridLabel, { color: '#34C759', marginTop: 2 }]}>Assist</Text>
                </View>
                <View style={styles.gridItem}><Text style={[styles.gridValue, dynamicStyles.text]}>{(stats.goals_suffered / (stats.played || 1)).toFixed(1)}</Text><Text style={[styles.gridLabel, dynamicStyles.subText]}>G. Subiti</Text></View>
                <View style={styles.gridItem}><Text style={[styles.gridValue, dynamicStyles.text]}>{stats.clean_sheets}</Text><Text style={[styles.gridLabel, dynamicStyles.subText]}>C. Sheet</Text></View>
              </View>
            </View>
          )}

          {stats && (
            <View style={[styles.chartCard, dynamicStyles.card]}>
               <Text style={[styles.chartTitle, dynamicStyles.text]}>Analisi Prestazioni</Text>
               <RadarChart isDarkMode={isDarkMode} matchType={group?.match_type || 5} stats={{ goals: stats.individual_goals, assists: stats.individual_assists, cleanSheets: stats.clean_sheets, goalsConceded: stats.goals_suffered, wins: stats.won, matches: stats.played, points: stats.points }} />
            </View>
          )}

          {playerMatches.length > 0 && (
            <View style={[styles.bibbiaCard, dynamicStyles.card, { paddingBottom: 10 }]}>
              <Text style={[styles.chartTitle, dynamicStyles.text, { marginBottom: 15 }]}>Ultime Partite</Text>
              {playerMatches.slice(0, 10).map((m, index) => {
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
                    {index < playerMatches.slice(0, 10).length - 1 && <View style={[styles.detailDivider, dynamicStyles.divider, { marginHorizontal: 0, opacity: 0.5 }]} />}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
        {renderComparison()}
        {renderMatchDetail()}
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
                  .filter(p => (comparisonRole ? p.role === comparisonRole : true) && (comparisonSearch ? p.nickname.toLowerCase().includes(comparisonSearch.toLowerCase()) : true))
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editContent}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.iconBtn}><Ionicons name="close" size={28} color={isDarkMode ? "#FFF" : "#1C1C1E"} /></TouchableOpacity>
              <Text style={[styles.headerTitle, dynamicStyles.text]}>Modifica Giocatore</Text>
              <View style={{ width: 44 }} />
            </View>
            <View style={styles.inputGroup}><Text style={[styles.label, dynamicStyles.text]}>Nickname</Text><TextInput style={[styles.input, dynamicStyles.input]} value={nickname} onChangeText={setNickname} placeholder="Nickname" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} /></View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}><View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}><Text style={[styles.label, dynamicStyles.text]}>Nome (opz.)</Text><TextInput style={[styles.input, dynamicStyles.input]} value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} /></View><View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}><Text style={[styles.label, dynamicStyles.text]}>Cognome (opz.)</Text><TextInput style={[styles.input, dynamicStyles.input]} value={surname} onChangeText={setSurname} placeholder="Cognome" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} /></View></View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>Data di Nascita</Text>
              <View style={styles.ageContainer}>
                <TouchableOpacity style={[styles.input, dynamicStyles.input, styles.datePickerButton]} onPress={() => setShowDatePicker(true)}><Ionicons name="calendar-outline" size={20} color="#007AFF" style={{marginRight: 10}} /><Text style={[styles.dateText, dynamicStyles.text]}>{dob.toLocaleDateString('it-IT')}</Text></TouchableOpacity>
                <View style={[styles.ageBox, dynamicStyles.card, {borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'}]}><Text style={styles.ageNumber}>{calculateAgeDisplay(dob)}</Text><Text style={[styles.ageLabel, dynamicStyles.subText]}>ANNI</Text></View>
              </View>
              {showDatePicker && <DateTimePicker value={dob} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} maximumDate={new Date()} themeVariant={isDarkMode ? 'dark' : 'light'} />}
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>Ruolo</Text>
              <View style={styles.roleGrid}>{ROLES.map((r) => (
                <TouchableOpacity key={r} style={[styles.roleOption, dynamicStyles.card, {borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'}, role === r && { backgroundColor: getRoleColor(r), borderColor: getRoleColor(r) }]} onPress={() => setRole(r)}><Text style={[styles.roleOptionText, dynamicStyles.text, role === r && { color: '#FFF' }]}>{r}</Text></TouchableOpacity>
              ))}</View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>Livello di Forza</Text>
              <TouchableOpacity style={[styles.strengthPreviewBox, dynamicStyles.card, {borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'}]} onPress={() => setShowStrengthModal(true)}><View style={[styles.strengthDisplay, {backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7'}]}><Text style={[styles.strengthNumber, dynamicStyles.text]}>{strength}</Text><Text style={[styles.strengthSubText, dynamicStyles.subText]}>VALORE</Text></View><Ionicons name="chevron-down" size={24} color="#8E8E93" /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Salva Modifiche</Text>}</TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <Modal visible={showStrengthModal} transparent={true} animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowStrengthModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, dynamicStyles.modalContent]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, dynamicStyles.text]}>Seleziona Forza</Text></View>
              <ScrollView><View style={styles.strengthGrid}>{STRENGTH_VALUES.map((v) => (
                <TouchableOpacity key={v} style={[styles.strengthOption, { backgroundColor: strength === v ? '#007AFF' : (isDarkMode ? '#3A3A3C' : '#F2F2F7') }]} onPress={() => { setStrength(v); setShowStrengthModal(false); }}><Text style={[styles.strengthOptionText, { color: strength === v ? '#FFF' : (isDarkMode ? '#FFF' : '#1C1C1E') }]}>{v}</Text></TouchableOpacity>
              ))}</View></ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
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
  headerTitle: { fontSize: 18, fontWeight: '700' },
  profileSection: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, alignItems: 'flex-start' },
  profileNickname: { fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 2 },
  profileName: { fontSize: 16, fontWeight: '500', marginBottom: 10, opacity: 0.7 },
  rolePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 0 },
  rolePillText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  headerStats: { gap: 8 },
  headerStatBox: { width: 60, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  headerStatValue: { fontSize: 18, fontWeight: '900' },
  headerStatLabel: { fontSize: 8, fontWeight: '700', color: '#8E8E93', marginTop: -2 },
  trendRowCompact: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  trendDot: { width: 8, height: 8, borderRadius: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statValue: { fontSize: 32, fontWeight: '900' },
  statLabel: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  detailsCard: { borderRadius: 16, marginHorizontal: 20, padding: 4, marginBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  detailLabel: { fontSize: 15, fontWeight: '500' },
  detailValue: { fontSize: 15, fontWeight: '600' },
  detailDivider: { height: 0.5, marginHorizontal: 16 },
  chartCard: { marginHorizontal: 20, marginBottom: 20, borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  bibbiaCard: { marginHorizontal: 20, marginBottom: 20, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  gridStats: { flexDirection: 'row', justifyContent: 'space-between' },
  gridItem: { alignItems: 'center', flex: 1 },
  gridValue: { fontSize: 20, fontWeight: '800' },
  gridLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  miniLabel: { fontSize: 9, color: '#8E8E93', marginTop: 2 },
  sectionSubtitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  trendRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  trendCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  trendText: { fontSize: 12, fontWeight: '800' },
  chartTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15, alignSelf: 'flex-start' },
  compHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, paddingVertical: 20 },
  compPlayerBox: { alignItems: 'center', width: '40%' },
  miniAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
  miniAvatarText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  compPlayerName: { fontSize: 16, fontWeight: '800' },
  vsText: { fontSize: 18, fontWeight: '900', fontStyle: 'italic' },
  compRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  compValue: { fontSize: 18, fontWeight: '900' },
  compLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center', width: 100 },
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
  saveButton: { backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  saveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '50%', paddingBottom: 40 },
  modalHeader: { padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  strengthGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'center' },
  strengthOption: { width: '22%', aspectRatio: 1, margin: '1%', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  strengthOptionText: { fontSize: 16, fontWeight: '700' },
  matchListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  matchResultBadge: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  matchResultText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  matchDate: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  matchTeams: { fontSize: 15, fontWeight: '600', marginTop: 1 },
  matchScoreBox: { alignItems: 'flex-end' },
  matchScore: { fontSize: 16, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  miniStatBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  miniStatText: { fontSize: 10, fontWeight: '700', color: '#8E8E93' },
});
