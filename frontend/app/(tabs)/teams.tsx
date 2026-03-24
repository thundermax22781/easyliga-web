import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
  fetchPlayers,
  generateTeams,
  Player,
  ROLE_COLORS,
  TeamResult,
  JERSEY_COLORS,
  MATCH_TYPES,
} from '../../src/api';

export default function TeamsScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [teams, setTeams] = useState<TeamResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // New config options
  const [matchType, setMatchType] = useState(5);
  const [teamAName, setTeamAName] = useState('Squadra A');
  const [teamBName, setTeamBName] = useState('Squadra B');
  const [teamAColor, setTeamAColor] = useState('Bianca');
  const [teamBColor, setTeamBColor] = useState('Rossa');
  const [showConfig, setShowConfig] = useState(false);

  const loadPlayers = useCallback(async () => {
    try {
      const data = await fetchPlayers({ sort_by: 'nickname', sort_order: 'asc' });
      setPlayers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPlayers();
    }, [loadPlayers])
  );

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === players.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(players.map((p) => p.id)));
    }
  };

  const handleGenerate = async () => {
    const minPlayers = matchType * 2;
    if (selectedIds.size < minPlayers) {
      Alert.alert(
        'Attenzione',
        `Per ${matchType === 5 ? 'Calcetto 5' : 'Calcio ' + matchType} servono almeno ${minPlayers} giocatori (${matchType} per squadra). Hai selezionato ${selectedIds.size}.`
      );
      return;
    }
    setGenerating(true);
    try {
      const result = await generateTeams(
        Array.from(selectedIds),
        matchType,
        teamAName,
        teamBName,
        teamAColor,
        teamBColor
      );
      setTeams(result);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Errore nella generazione');
    } finally {
      setGenerating(false);
    }
  };

  const resetTeams = () => {
    setTeams(null);
  };

  const getInitials = (nickname: string) => nickname.substring(0, 2).toUpperCase();

  const getJerseyHex = (colorName: string) => {
    return JERSEY_COLORS.find((c) => c.value === colorName)?.hex || '#FFFFFF';
  };

  const getJerseyTextColor = (colorName: string) => {
    return colorName === 'Bianca' || colorName === 'Gialla' ? '#1C1C1E' : '#FFFFFF';
  };

  const renderSelectionItem = ({ item }: { item: Player }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        testID={`select-player-${item.id}`}
        style={[styles.selectCard, isSelected && styles.selectCardActive]}
        onPress={() => togglePlayer(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
        <View style={[styles.miniAvatar, { backgroundColor: ROLE_COLORS[item.role] + '20' }]}>
          <Text style={[styles.miniAvatarText, { color: ROLE_COLORS[item.role] }]}>
            {getInitials(item.nickname)}
          </Text>
        </View>
        <View style={styles.selectInfo}>
          <Text style={styles.selectNickname} numberOfLines={1}>{item.nickname}</Text>
          <Text style={[styles.selectRole, { color: ROLE_COLORS[item.role] }]}>{item.role}</Text>
        </View>
        <View style={styles.selectStrength}>
          <Text style={styles.selectStrengthNum}>
            {Number.isInteger(item.strength) ? item.strength : item.strength.toFixed(1)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTeamPlayer = (player: Player, index: number) => (
    <View key={player.id} style={styles.teamPlayerRow}>
      <Text style={styles.teamPlayerIndex}>{index + 1}</Text>
      <View style={[styles.teamMiniAvatar, { backgroundColor: ROLE_COLORS[player.role] + '20' }]}>
        <Text style={[styles.teamMiniAvatarText, { color: ROLE_COLORS[player.role] }]}>
          {getInitials(player.nickname)}
        </Text>
      </View>
      <View style={styles.teamPlayerInfo}>
        <Text style={styles.teamPlayerName}>{player.nickname}</Text>
        <Text style={[styles.teamPlayerRole, { color: ROLE_COLORS[player.role] }]}>{player.role}</Text>
      </View>
      <Text style={styles.teamPlayerStrength}>
        {Number.isInteger(player.strength) ? player.strength : player.strength.toFixed(1)}
      </Text>
    </View>
  );

  // TEAMS RESULT VIEW
  if (teams) {
    const teamAHex = getJerseyHex(teams.team_a_color);
    const teamBHex = getJerseyHex(teams.team_b_color);
    const teamATextColor = getJerseyTextColor(teams.team_a_color);
    const teamBTextColor = getJerseyTextColor(teams.team_b_color);

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-from-teams-btn" onPress={resetTeams} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Squadre</Text>
          <TouchableOpacity testID="regenerate-btn" onPress={handleGenerate} style={styles.regenBtn}>
            <Ionicons name="refresh" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={[1]}
          keyExtractor={() => 'teams'}
          renderItem={() => (
            <View style={styles.teamsContainer}>
              {/* Team A */}
              <View style={[styles.teamCard, { backgroundColor: teamAHex + '12' }]}>
                <View style={styles.teamHeader}>
                  <View style={[styles.jerseyBadge, { backgroundColor: teamAHex, borderWidth: teamAHex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' }]}>
                    <Ionicons name="shirt" size={18} color={teamATextColor} />
                  </View>
                  <Text style={styles.teamName} numberOfLines={1}>{teams.team_a_name}</Text>
                </View>
                <View style={styles.teamStatsRow}>
                  <View style={styles.teamStatBadge}>
                    <Text style={styles.teamStatLabel}>Forza media</Text>
                    <Text style={styles.teamStatValue}>{teams.team_a_avg_strength}</Text>
                  </View>
                  <View style={styles.teamStatBadge}>
                    <Text style={styles.teamStatLabel}>Età media</Text>
                    <Text style={styles.teamStatValue}>{teams.team_a_avg_age}</Text>
                  </View>
                </View>
                {teams.team_a.map((p, i) => renderTeamPlayer(p, i))}
              </View>

              {/* VS */}
              <View style={styles.vsContainer}>
                <View style={styles.vsBadge}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
              </View>

              {/* Team B */}
              <View style={[styles.teamCard, { backgroundColor: teamBHex + '12' }]}>
                <View style={styles.teamHeader}>
                  <View style={[styles.jerseyBadge, { backgroundColor: teamBHex, borderWidth: teamBHex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' }]}>
                    <Ionicons name="shirt" size={18} color={teamBTextColor} />
                  </View>
                  <Text style={styles.teamName} numberOfLines={1}>{teams.team_b_name}</Text>
                </View>
                <View style={styles.teamStatsRow}>
                  <View style={styles.teamStatBadge}>
                    <Text style={styles.teamStatLabel}>Forza media</Text>
                    <Text style={styles.teamStatValue}>{teams.team_b_avg_strength}</Text>
                  </View>
                  <View style={styles.teamStatBadge}>
                    <Text style={styles.teamStatLabel}>Età media</Text>
                    <Text style={styles.teamStatValue}>{teams.team_b_avg_age}</Text>
                  </View>
                </View>
                {teams.team_b.map((p, i) => renderTeamPlayer(p, i))}
              </View>
            </View>
          )}
          contentContainerStyle={styles.teamsScrollContent}
        />
      </SafeAreaView>
    );
  }

  // MAIN SELECTION VIEW
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Genera Squadre</Text>
        </View>

        {/* Config Toggle */}
        <TouchableOpacity
          testID="toggle-config-btn"
          style={styles.configToggle}
          onPress={() => { Keyboard.dismiss(); setShowConfig(!showConfig); }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={20} color="#007AFF" />
          <Text style={styles.configToggleText}>Impostazioni Partita</Text>
          <Ionicons name={showConfig ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
        </TouchableOpacity>

        {/* Config Panel */}
        {showConfig && (
          <ScrollView style={styles.configPanel} contentContainerStyle={styles.configPanelContent} nestedScrollEnabled>
            {/* Match Type */}
            <Text style={styles.configLabel}>Tipo di Partita</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matchTypeScroll}>
              <View style={styles.matchTypeRow}>
                {MATCH_TYPES.map((mt) => (
                  <TouchableOpacity
                    key={mt.value}
                    testID={`match-type-${mt.value}`}
                    style={[styles.matchTypeChip, matchType === mt.value && styles.matchTypeChipActive]}
                    onPress={() => setMatchType(mt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.matchTypeText, matchType === mt.value && styles.matchTypeTextActive]}>
                      {mt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Team Names */}
            <View style={styles.teamNamesRow}>
              <View style={styles.teamNameCol}>
                <Text style={styles.configLabel}>Nome Squadra 1</Text>
                <TextInput
                  testID="team-a-name-input"
                  style={styles.configInput}
                  value={teamAName}
                  onChangeText={setTeamAName}
                  placeholder="Squadra A"
                  placeholderTextColor="#C7C7CC"
                />
              </View>
              <View style={styles.teamNameCol}>
                <Text style={styles.configLabel}>Nome Squadra 2</Text>
                <TextInput
                  testID="team-b-name-input"
                  style={styles.configInput}
                  value={teamBName}
                  onChangeText={setTeamBName}
                  placeholder="Squadra B"
                  placeholderTextColor="#C7C7CC"
                />
              </View>
            </View>

            {/* Jersey Colors Team A */}
            <Text style={styles.configLabel}>Maglia Squadra 1</Text>
            <View style={styles.colorRow}>
              {JERSEY_COLORS.map((c) => (
                <TouchableOpacity
                  key={`a-${c.value}`}
                  testID={`team-a-color-${c.value.toLowerCase()}`}
                  style={[
                    styles.colorBtn,
                    { backgroundColor: c.hex, borderWidth: c.hex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' },
                    teamAColor === c.value && styles.colorBtnSelected,
                  ]}
                  onPress={() => setTeamAColor(c.value)}
                  activeOpacity={0.7}
                >
                  {teamAColor === c.value && (
                    <Ionicons name="checkmark" size={18} color={c.hex === '#FFFFFF' || c.hex === '#FFCC00' ? '#1C1C1E' : '#FFFFFF'} />
                  )}
                </TouchableOpacity>
              ))}
              <Text style={styles.colorLabel}>{teamAColor}</Text>
            </View>

            {/* Jersey Colors Team B */}
            <Text style={styles.configLabel}>Maglia Squadra 2</Text>
            <View style={styles.colorRow}>
              {JERSEY_COLORS.map((c) => (
                <TouchableOpacity
                  key={`b-${c.value}`}
                  testID={`team-b-color-${c.value.toLowerCase()}`}
                  style={[
                    styles.colorBtn,
                    { backgroundColor: c.hex, borderWidth: c.hex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' },
                    teamBColor === c.value && styles.colorBtnSelected,
                  ]}
                  onPress={() => setTeamBColor(c.value)}
                  activeOpacity={0.7}
                >
                  {teamBColor === c.value && (
                    <Ionicons name="checkmark" size={18} color={c.hex === '#FFFFFF' || c.hex === '#FFCC00' ? '#1C1C1E' : '#FFFFFF'} />
                  )}
                </TouchableOpacity>
              ))}
              <Text style={styles.colorLabel}>{teamBColor}</Text>
            </View>
          </ScrollView>
        )}

        {/* Selection Header */}
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionCount}>
            {selectedIds.size} selezionat{selectedIds.size === 1 ? 'o' : 'i'} · min {matchType * 2}
          </Text>
          <TouchableOpacity testID="select-all-btn" onPress={selectAll} activeOpacity={0.7}>
            <Text style={styles.selectAllText}>
              {selectedIds.size === players.length ? 'Deseleziona' : 'Seleziona Tutti'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Player List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : players.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={64} color="#D1D1D6" />
            <Text style={styles.emptyText}>Nessun giocatore disponibile</Text>
            <Text style={styles.emptySubtext}>Aggiungi giocatori dalla schermata Giocatori</Text>
          </View>
        ) : (
          <FlatList
            testID="team-player-list"
            data={players}
            keyExtractor={(item) => item.id}
            renderItem={renderSelectionItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPlayers(); }} tintColor="#007AFF" />
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Generate Button */}
        {players.length > 0 && (
          <View style={styles.generateBar}>
            <TouchableOpacity
              testID="generate-teams-btn"
              style={[
                styles.generateButton,
                selectedIds.size < matchType * 2 && styles.generateButtonDisabled,
              ]}
              onPress={handleGenerate}
              disabled={generating || selectedIds.size < matchType * 2}
              activeOpacity={0.8}
            >
              {generating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="football" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.generateText}>
                    Genera {matchType === 5 ? 'Calcetto 5' : 'Calcio ' + matchType}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    flex: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  regenBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Config Toggle
  configToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 8,
  },
  configToggleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  // Config Panel
  configPanel: {
    maxHeight: 300,
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
  },
  configPanelContent: {
    padding: 14,
  },
  configLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  matchTypeScroll: {
    marginBottom: 12,
  },
  matchTypeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  matchTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  matchTypeChipActive: {
    backgroundColor: '#007AFF',
  },
  matchTypeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3A3A3C',
  },
  matchTypeTextActive: {
    color: '#FFFFFF',
  },
  teamNamesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  teamNameCol: {
    flex: 1,
  },
  configInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 15,
    color: '#1C1C1E',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  colorBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorBtnSelected: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  colorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  // Selection
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectCardActive: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.04)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D1D6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  miniAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  miniAvatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  selectInfo: {
    flex: 1,
  },
  selectNickname: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  selectRole: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  selectStrength: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectStrengthNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1C1C1E',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 4,
  },
  generateBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: 'rgba(242, 242, 247, 0.95)',
  },
  generateButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
  },
  generateText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  // Teams result styles
  teamsContainer: {
    paddingHorizontal: 20,
  },
  teamsScrollContent: {
    paddingBottom: 40,
  },
  teamCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  jerseyBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  teamName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    flex: 1,
  },
  teamStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  teamStatBadge: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  teamStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1C1C1E',
  },
  vsContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  vsBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  teamPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  teamPlayerIndex: {
    width: 24,
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
  },
  teamMiniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  teamMiniAvatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  teamPlayerInfo: {
    flex: 1,
  },
  teamPlayerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  teamPlayerRole: {
    fontSize: 12,
    fontWeight: '600',
  },
  teamPlayerStrength: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C1C1E',
    width: 36,
    textAlign: 'center',
  },
});
