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
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  fetchPlayers,
  deletePlayer,
  generateTeams,
  importPlayersExcel,
  getTemplateUrl,
  Player,
  ROLES,
  ROLE_COLORS,
  TeamResult,
  JERSEY_COLORS,
  MATCH_TYPES,
} from '../../src/api';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';

type TabType = 'players' | 'teams';

export default function GroupDetailScreen() {
  const router = useRouter();
  const { groupId, name } = useLocalSearchParams<{ groupId: string; name: string }>();
  const groupName = name ? decodeURIComponent(name) : 'Gruppo';

  const [activeTab, setActiveTab] = useState<TabType>('players');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Players tab state
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Teams tab state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [teams, setTeams] = useState<TeamResult | null>(null);
  const [matchType, setMatchType] = useState(5);
  const [teamAName, setTeamAName] = useState('Squadra A');
  const [teamBName, setTeamBName] = useState('Squadra B');
  const [teamAColor, setTeamAColor] = useState('Bianca');
  const [teamBColor, setTeamBColor] = useState('Rossa');
  const [showConfig, setShowConfig] = useState(false);

  const loadPlayers = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await fetchPlayers({
        group_id: groupId,
        search: search || undefined,
        role: selectedRole || undefined,
      });
      setPlayers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, search, selectedRole]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPlayers();
    }, [loadPlayers])
  );

  const handleDeletePlayer = (player: Player) => {
    Alert.alert('Elimina Giocatore', `Vuoi eliminare ${player.nickname}?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePlayer(player.id);
            loadPlayers();
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === players.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(players.map((p) => p.id)));
  };

  const handleGenerate = async () => {
    const minPlayers = matchType * 2;
    if (selectedIds.size < minPlayers) {
      Alert.alert('Attenzione', `Per ${matchType === 5 ? 'Calcetto 5' : 'Calcio ' + matchType} servono almeno ${minPlayers} giocatori.`);
      return;
    }
    setGenerating(true);
    try {
      const result = await generateTeams(Array.from(selectedIds), matchType, teamAName, teamBName, teamAColor, teamBColor);
      setTeams(result);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Errore nella generazione');
    } finally {
      setGenerating(false);
    }
  };

  const getInitials = (nickname: string) => nickname.substring(0, 2).toUpperCase();
  const getJerseyHex = (colorName: string) => JERSEY_COLORS.find((c) => c.value === colorName)?.hex || '#FFFFFF';
  const getJerseyTextColor = (colorName: string) => (colorName === 'Bianca' || colorName === 'Gialla') ? '#1C1C1E' : '#FFFFFF';

  const handleImportExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      const file = result.assets[0];
      setImporting(true);
      
      const importResult = await importPlayersExcel(
        { uri: file.uri, name: file.name, mimeType: file.mimeType || undefined },
        groupId || ''
      );
      
      let message = `${importResult.imported} giocator${importResult.imported === 1 ? 'e importato' : 'i importati'} con successo!`;
      if (importResult.errors.length > 0) {
        message += `\n\n${importResult.errors.length} errori:\n${importResult.errors.slice(0, 5).join('\n')}`;
        if (importResult.errors.length > 5) message += `\n...e altri ${importResult.errors.length - 5}`;
      }
      
      Alert.alert('Importazione', message);
      loadPlayers();
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile importare il file');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const url = getTemplateUrl();
    Linking.openURL(url);
  };

  const ROLE_ORDER: Record<string, number> = { Portiere: 0, Difensore: 1, Centrocampista: 2, Attaccante: 3 };

  const sortByRole = (arr: Player[]) => [...arr].sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));

  const calcAvgStrength = (arr: Player[]) => arr.length ? Math.round((arr.reduce((s, p) => s + p.strength, 0) / arr.length) * 10) / 10 : 0;
  const calcAvgAge = (arr: Player[]) => arr.length ? Math.round((arr.reduce((s, p) => s + p.age, 0) / arr.length) * 10) / 10 : 0;

  const movePlayerToOtherTeam = (playerId: string, fromTeam: 'a' | 'b') => {
    if (!teams) return;
    let newA = [...teams.team_a];
    let newB = [...teams.team_b];

    if (fromTeam === 'a') {
      const idx = newA.findIndex((p) => p.id === playerId);
      if (idx === -1) return;
      const [player] = newA.splice(idx, 1);
      newB.push(player);
    } else {
      const idx = newB.findIndex((p) => p.id === playerId);
      if (idx === -1) return;
      const [player] = newB.splice(idx, 1);
      newA.push(player);
    }

    newA = sortByRole(newA);
    newB = sortByRole(newB);

    setTeams({
      ...teams,
      team_a: newA,
      team_b: newB,
      team_a_avg_strength: calcAvgStrength(newA),
      team_b_avg_strength: calcAvgStrength(newB),
      team_a_avg_age: calcAvgAge(newA),
      team_b_avg_age: calcAvgAge(newB),
    });
  };

  // --- TEAM RESULTS VIEW ---
  if (teams) {
    const teamAHex = getJerseyHex(teams.team_a_color);
    const teamBHex = getJerseyHex(teams.team_b_color);
    const sortedA = sortByRole(teams.team_a);
    const sortedB = sortByRole(teams.team_b);

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-from-result-btn" onPress={() => setTeams(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Squadre</Text>
          <TouchableOpacity testID="regenerate-btn" onPress={handleGenerate} style={styles.backBtn}>
            <Ionicons name="refresh" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.swapHint}>Tocca la freccia per spostare un giocatore</Text>

        <FlatList
          data={[1]}
          keyExtractor={() => 'teams'}
          renderItem={() => (
            <View style={styles.teamsContainer}>
              {/* Team A */}
              <View style={[styles.teamCard, { backgroundColor: teamAHex + '12' }]}>  
                <View style={styles.teamHeader}>
                  <View style={[styles.jerseyBadge, { backgroundColor: teamAHex, borderWidth: teamAHex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' }]}>
                    <Ionicons name="shirt" size={18} color={getJerseyTextColor(teams.team_a_color)} />
                  </View>
                  <Text style={styles.teamName} numberOfLines={1}>{teams.team_a_name}</Text>
                  <Text style={styles.teamPlayerCount}>{sortedA.length}</Text>
                </View>
                <View style={styles.teamStatsRow}>
                  <View style={styles.teamStatBadge}>
                    <Text style={styles.teamStatLabel}>Forza</Text>
                    <Text style={styles.teamStatValue}>{teams.team_a_avg_strength}</Text>
                  </View>
                  <View style={styles.teamStatBadge}>
                    <Text style={styles.teamStatLabel}>Età</Text>
                    <Text style={styles.teamStatValue}>{teams.team_a_avg_age}</Text>
                  </View>
                </View>
                {sortedA.map((p, i) => (
                  <View key={p.id} style={styles.teamPlayerRow}>
                    <View style={[styles.tpAvatar, { backgroundColor: ROLE_COLORS[p.role] + '20' }]}>
                      <Text style={[styles.tpAvatarText, { color: ROLE_COLORS[p.role] }]}>{getInitials(p.nickname)}</Text>
                    </View>
                    <View style={styles.tpInfo}>
                      <Text style={styles.tpName}>{p.nickname}</Text>
                      <Text style={[styles.tpRole, { color: ROLE_COLORS[p.role] }]}>{p.role}</Text>
                    </View>
                    <Text style={styles.tpStrength}>{Number.isInteger(p.strength) ? p.strength : p.strength.toFixed(1)}</Text>
                    <TouchableOpacity
                      testID={`swap-a-${p.id}`}
                      style={styles.swapBtn}
                      onPress={() => movePlayerToOtherTeam(p.id, 'a')}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="arrow-forward" size={16} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.vsContainer}>
                <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
              </View>
              {/* Team B */}
              <View style={[styles.teamCard, { backgroundColor: getJerseyHex(teams.team_b_color) + '12' }]}>
                <View style={styles.teamHeader}>
                  <View style={[styles.jerseyBadge, { backgroundColor: getJerseyHex(teams.team_b_color), borderWidth: getJerseyHex(teams.team_b_color) === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' }]}>
                    <Ionicons name="shirt" size={18} color={getJerseyTextColor(teams.team_b_color)} />
                  </View>
                  <Text style={styles.teamName} numberOfLines={1}>{teams.team_b_name}</Text>
                  <Text style={styles.teamPlayerCount}>{sortedB.length}</Text>
                </View>
                <View style={styles.teamStatsRow}>
                  <View style={styles.teamStatBadge}>
                    <Text style={styles.teamStatLabel}>Forza</Text>
                    <Text style={styles.teamStatValue}>{teams.team_b_avg_strength}</Text>
                  </View>
                  <View style={styles.teamStatBadge}>
                    <Text style={styles.teamStatLabel}>Età</Text>
                    <Text style={styles.teamStatValue}>{teams.team_b_avg_age}</Text>
                  </View>
                </View>
                {sortedB.map((p, i) => (
                  <View key={p.id} style={styles.teamPlayerRow}>
                    <TouchableOpacity
                      testID={`swap-b-${p.id}`}
                      style={styles.swapBtn}
                      onPress={() => movePlayerToOtherTeam(p.id, 'b')}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="arrow-back" size={16} color="#007AFF" />
                    </TouchableOpacity>
                    <View style={[styles.tpAvatar, { backgroundColor: ROLE_COLORS[p.role] + '20' }]}>
                      <Text style={[styles.tpAvatarText, { color: ROLE_COLORS[p.role] }]}>{getInitials(p.nickname)}</Text>
                    </View>
                    <View style={styles.tpInfo}>
                      <Text style={styles.tpName}>{p.nickname}</Text>
                      <Text style={[styles.tpRole, { color: ROLE_COLORS[p.role] }]}>{p.role}</Text>
                    </View>
                    <Text style={styles.tpStrength}>{Number.isInteger(p.strength) ? p.strength : p.strength.toFixed(1)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </SafeAreaView>
    );
  }

  // --- MAIN VIEW ---
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="back-to-groups-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
          {activeTab === 'players' && (
            <View style={styles.headerBtns}>
              <TouchableOpacity
                testID="import-excel-btn"
                style={styles.importBtn}
                onPress={handleImportExcel}
                disabled={importing}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Ionicons name="document-text" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                testID="add-player-btn"
                style={styles.addBtn}
                onPress={() => router.push(`/player/add?groupId=${groupId}`)}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
          {activeTab === 'teams' && <View style={{ width: 40 }} />}
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            testID="tab-players"
            style={[styles.tab, activeTab === 'players' && styles.tabActive]}
            onPress={() => setActiveTab('players')}
          >
            <Ionicons name="people" size={18} color={activeTab === 'players' ? '#007AFF' : '#8E8E93'} />
            <Text style={[styles.tabText, activeTab === 'players' && styles.tabTextActive]}>Giocatori</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-teams"
            style={[styles.tab, activeTab === 'teams' && styles.tabActive]}
            onPress={() => setActiveTab('teams')}
          >
            <Ionicons name="football" size={18} color={activeTab === 'teams' ? '#007AFF' : '#8E8E93'} />
            <Text style={[styles.tabText, activeTab === 'teams' && styles.tabTextActive]}>Genera Squadre</Text>
          </TouchableOpacity>
        </View>

        {/* PLAYERS TAB */}
        {activeTab === 'players' && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#8E8E93" style={{ marginRight: 8 }} />
              <TextInput
                testID="search-input"
                style={styles.searchInput}
                placeholder="Cerca per nome o nickname..."
                placeholderTextColor="#C7C7CC"
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} testID="clear-search-btn">
                  <Ionicons name="close-circle" size={20} color="#C7C7CC" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
              <TouchableOpacity
                testID="filter-all"
                style={[styles.filterChip, !selectedRole && styles.filterChipActive]}
                onPress={() => setSelectedRole(null)}
              >
                <Text style={[styles.filterText, !selectedRole && styles.filterTextActive]}>Tutti</Text>
              </TouchableOpacity>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  testID={`filter-${role.toLowerCase()}`}
                  style={[styles.filterChip, selectedRole === role && { backgroundColor: ROLE_COLORS[role] }]}
                  onPress={() => setSelectedRole(selectedRole === role ? null : role)}
                >
                  <Text style={[styles.filterText, selectedRole === role && { color: '#FFFFFF' }]}>{role}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.countRow}>
              <Text style={styles.countText}>{players.length} giocator{players.length === 1 ? 'e' : 'i'}</Text>
            </View>
            {loading ? (
              <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>
            ) : players.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="people-outline" size={64} color="#D1D1D6" />
                <Text style={styles.emptyText}>Nessun giocatore</Text>
                <Text style={styles.emptySubtext}>Tocca + per aggiungere o importa da Excel</Text>
                <TouchableOpacity
                  testID="import-excel-empty-btn"
                  style={styles.importExcelBtn}
                  onPress={handleImportExcel}
                  disabled={importing}
                >
                  {importing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="document-text" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.importExcelText}>Importa da Excel</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  testID="download-template-btn"
                  onPress={handleDownloadTemplate}
                  style={{ marginTop: 12 }}
                >
                  <Text style={styles.templateLink}>Scarica template Excel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                testID="player-list"
                data={players}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    testID={`player-card-${item.id}`}
                    style={styles.pCard}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/player/${item.id}`)}
                    onLongPress={() => handleDeletePlayer(item)}
                  >
                    <View style={[styles.pAvatar, { backgroundColor: ROLE_COLORS[item.role] + '20' }]}>
                      <Text style={[styles.pAvatarText, { color: ROLE_COLORS[item.role] }]}>{getInitials(item.nickname)}</Text>
                    </View>
                    <View style={styles.pInfo}>
                      <Text style={styles.pNickname} numberOfLines={1}>{item.nickname}</Text>
                      <View style={styles.pMetaRow}>
                        <View style={[styles.pRoleBadge, { backgroundColor: ROLE_COLORS[item.role] + '18' }]}>
                          <Text style={[styles.pRoleText, { color: ROLE_COLORS[item.role] }]}>{item.role}</Text>
                        </View>
                        <Text style={styles.pAge}>{item.age} anni</Text>
                      </View>
                    </View>
                    <View style={styles.pStrBadge}>
                      <Text style={styles.pStrNum}>{Number.isInteger(item.strength) ? item.strength : item.strength.toFixed(1)}</Text>
                      <Text style={styles.pStrLabel}>FRZ</Text>
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPlayers(); }} tintColor="#007AFF" />}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}

        {/* TEAMS TAB */}
        {activeTab === 'teams' && (
          <View style={{ flex: 1 }}>
            {/* Config Toggle */}
            <TouchableOpacity
              testID="toggle-config-btn"
              style={styles.configToggle}
              onPress={() => { Keyboard.dismiss(); setShowConfig(!showConfig); }}
            >
              <Ionicons name="settings-outline" size={20} color="#007AFF" />
              <Text style={styles.configToggleText}>Impostazioni Partita</Text>
              <Ionicons name={showConfig ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
            </TouchableOpacity>

            {showConfig && (
              <ScrollView style={styles.configPanel} contentContainerStyle={styles.configPanelContent} nestedScrollEnabled>
                <Text style={styles.cfgLabel}>Tipo di Partita</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={styles.mtRow}>
                    {MATCH_TYPES.map((mt) => (
                      <TouchableOpacity key={mt.value} testID={`match-type-${mt.value}`} style={[styles.mtChip, matchType === mt.value && styles.mtChipActive]} onPress={() => setMatchType(mt.value)}>
                        <Text style={[styles.mtText, matchType === mt.value && styles.mtTextActive]}>{mt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <View style={styles.teamNamesRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cfgLabel}>Squadra 1</Text>
                    <TextInput testID="team-a-name-input" style={styles.cfgInput} value={teamAName} onChangeText={setTeamAName} placeholder="Squadra A" placeholderTextColor="#C7C7CC" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cfgLabel}>Squadra 2</Text>
                    <TextInput testID="team-b-name-input" style={styles.cfgInput} value={teamBName} onChangeText={setTeamBName} placeholder="Squadra B" placeholderTextColor="#C7C7CC" />
                  </View>
                </View>
                <Text style={styles.cfgLabel}>Maglia Squadra 1</Text>
                <View style={styles.colorRow}>
                  {JERSEY_COLORS.map((c) => (
                    <TouchableOpacity key={`a-${c.value}`} testID={`team-a-color-${c.value.toLowerCase()}`} style={[styles.colorBtn, { backgroundColor: c.hex, borderWidth: c.hex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' }, teamAColor === c.value && styles.colorBtnSel]} onPress={() => setTeamAColor(c.value)}>
                      {teamAColor === c.value && <Ionicons name="checkmark" size={16} color={c.hex === '#FFFFFF' || c.hex === '#FFCC00' ? '#1C1C1E' : '#FFF'} />}
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.colorLabel}>{teamAColor}</Text>
                </View>
                <Text style={styles.cfgLabel}>Maglia Squadra 2</Text>
                <View style={styles.colorRow}>
                  {JERSEY_COLORS.map((c) => (
                    <TouchableOpacity key={`b-${c.value}`} testID={`team-b-color-${c.value.toLowerCase()}`} style={[styles.colorBtn, { backgroundColor: c.hex, borderWidth: c.hex === '#FFFFFF' ? 1 : 0, borderColor: '#D1D1D6' }, teamBColor === c.value && styles.colorBtnSel]} onPress={() => setTeamBColor(c.value)}>
                      {teamBColor === c.value && <Ionicons name="checkmark" size={16} color={c.hex === '#FFFFFF' || c.hex === '#FFCC00' ? '#1C1C1E' : '#FFF'} />}
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.colorLabel}>{teamBColor}</Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.selHeader}>
              <Text style={styles.selCount}>{selectedIds.size} selezionat{selectedIds.size === 1 ? 'o' : 'i'} · min {matchType * 2}</Text>
              <TouchableOpacity testID="select-all-btn" onPress={selectAll}>
                <Text style={styles.selAllText}>{selectedIds.size === players.length ? 'Deseleziona' : 'Seleziona Tutti'}</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>
            ) : players.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="people-outline" size={64} color="#D1D1D6" />
                <Text style={styles.emptyText}>Nessun giocatore</Text>
                <Text style={styles.emptySubtext}>Aggiungi giocatori dal tab Giocatori</Text>
              </View>
            ) : (
              <FlatList
                testID="team-player-list"
                data={players}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isSel = selectedIds.has(item.id);
                  return (
                    <TouchableOpacity testID={`select-player-${item.id}`} style={[styles.selCard, isSel && styles.selCardActive]} onPress={() => togglePlayer(item.id)}>
                      <View style={[styles.chk, isSel && styles.chkActive]}>
                        {isSel && <Ionicons name="checkmark" size={16} color="#FFF" />}
                      </View>
                      <View style={[styles.selAvatar, { backgroundColor: ROLE_COLORS[item.role] + '20' }]}>
                        <Text style={[styles.selAvatarText, { color: ROLE_COLORS[item.role] }]}>{getInitials(item.nickname)}</Text>
                      </View>
                      <View style={styles.selInfo}>
                        <Text style={styles.selNick} numberOfLines={1}>{item.nickname}</Text>
                        <Text style={[styles.selRole, { color: ROLE_COLORS[item.role] }]}>{item.role}</Text>
                      </View>
                      <View style={styles.selStr}>
                        <Text style={styles.selStrNum}>{Number.isInteger(item.strength) ? item.strength : item.strength.toFixed(1)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPlayers(); }} tintColor="#007AFF" />}
                showsVerticalScrollIndicator={false}
              />
            )}

            {players.length > 0 && (
              <View style={styles.genBar}>
                <TouchableOpacity
                  testID="generate-teams-btn"
                  style={[styles.genBtn, selectedIds.size < matchType * 2 && styles.genBtnDisabled]}
                  onPress={handleGenerate}
                  disabled={generating || selectedIds.size < matchType * 2}
                >
                  {generating ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Ionicons name="football" size={20} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.genText}>Genera {matchType === 5 ? 'Calcetto 5' : 'Calcio ' + matchType}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1C1C1E', textAlign: 'center' },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  importBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,122,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' },
  // Tabs
  tabBar: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#E5E5EA', borderRadius: 12, padding: 3, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  tabTextActive: { color: '#007AFF' },
  // Player list
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#1C1C1E', height: 44 },
  filterScroll: { marginBottom: 8, paddingVertical: 4 },
  filterContainer: { paddingHorizontal: 20, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF' },
  filterChipActive: { backgroundColor: '#007AFF' },
  filterText: { fontSize: 14, fontWeight: '600', color: '#3A3A3C' },
  filterTextActive: { color: '#FFF' },
  countRow: { paddingHorizontal: 20, paddingVertical: 6 },
  countText: { fontSize: 13, fontWeight: '500', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  pCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  pAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  pAvatarText: { fontSize: 18, fontWeight: '800' },
  pInfo: { flex: 1, marginLeft: 12 },
  pNickname: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  pMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pRoleBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  pRoleText: { fontSize: 12, fontWeight: '700' },
  pAge: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  pStrBadge: { alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, backgroundColor: '#F2F2F7' },
  pStrNum: { fontSize: 20, fontWeight: '900', color: '#1C1C1E' },
  pStrLabel: { fontSize: 9, fontWeight: '700', color: '#8E8E93', letterSpacing: 1 },
  // Teams tab
  configToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, gap: 8 },
  configToggleText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#007AFF' },
  configPanel: { maxHeight: 280, marginHorizontal: 20, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 8 },
  configPanelContent: { padding: 14 },
  cfgLabel: { fontSize: 12, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  cfgInput: { backgroundColor: '#F2F2F7', borderRadius: 10, paddingHorizontal: 12, height: 40, fontSize: 15, color: '#1C1C1E' },
  mtRow: { flexDirection: 'row', gap: 6 },
  mtChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F2F2F7' },
  mtChipActive: { backgroundColor: '#007AFF' },
  mtText: { fontSize: 13, fontWeight: '700', color: '#3A3A3C' },
  mtTextActive: { color: '#FFF' },
  teamNamesRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  colorBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorBtnSel: { borderWidth: 3, borderColor: '#007AFF' },
  colorLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  selHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  selCount: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  selAllText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  selCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  selCardActive: { borderColor: '#007AFF', backgroundColor: 'rgba(0,122,255,0.04)' },
  chk: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D1D6', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  chkActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  selAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  selAvatarText: { fontSize: 14, fontWeight: '800' },
  selInfo: { flex: 1 },
  selNick: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  selRole: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  selStr: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  selStrNum: { fontSize: 16, fontWeight: '900', color: '#1C1C1E' },
  genBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 32, backgroundColor: 'rgba(242,242,247,0.95)' },
  genBtn: { flexDirection: 'row', backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  genBtnDisabled: { backgroundColor: '#C7C7CC', shadowOpacity: 0 },
  genText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  // Team results
  teamsContainer: { paddingHorizontal: 20 },
  teamCard: { borderRadius: 16, padding: 16, marginBottom: 8 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  jerseyBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  teamName: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', flex: 1 },
  teamPlayerCount: { fontSize: 14, fontWeight: '700', color: '#8E8E93', backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  teamStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  teamStatBadge: { flex: 1, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamStatLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  teamStatValue: { fontSize: 16, fontWeight: '900', color: '#1C1C1E' },
  vsContainer: { alignItems: 'center', marginVertical: 8 },
  vsBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  teamPlayerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  teamPlayerIdx: { width: 24, fontSize: 14, fontWeight: '600', color: '#8E8E93', textAlign: 'center' },
  tpAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  tpAvatarText: { fontSize: 13, fontWeight: '800' },
  tpInfo: { flex: 1 },
  tpName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  tpRole: { fontSize: 12, fontWeight: '600' },
  tpStrength: { fontSize: 18, fontWeight: '900', color: '#1C1C1E', width: 36, textAlign: 'center' },
  swapBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,122,255,0.1)', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  swapHint: { fontSize: 13, fontWeight: '500', color: '#8E8E93', textAlign: 'center', marginBottom: 8, fontStyle: 'italic' },
  // Shared
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#8E8E93', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#C7C7CC', marginTop: 4 },
  importExcelBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, marginTop: 20 },
  importExcelText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  templateLink: { fontSize: 14, fontWeight: '600', color: '#007AFF', textDecorationLine: 'underline' },
});
