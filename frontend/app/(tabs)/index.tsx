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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchPlayers, deletePlayer, Player, ROLES, ROLE_COLORS } from '../../src/api';

export default function PlayersScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const loadPlayers = useCallback(async () => {
    try {
      const data = await fetchPlayers({
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
  }, [search, selectedRole]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPlayers();
    }, [loadPlayers])
  );

  const handleDelete = (player: Player) => {
    Alert.alert(
      'Elimina Giocatore',
      `Vuoi eliminare ${player.nickname}?`,
      [
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
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPlayers();
  };

  const getInitials = (nickname: string) => {
    return nickname.substring(0, 2).toUpperCase();
  };

  const renderPlayerCard = ({ item }: { item: Player }) => (
    <TouchableOpacity
      testID={`player-card-${item.id}`}
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/player/${item.id}`)}
      onLongPress={() => handleDelete(item)}
    >
      <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[item.role] + '20' }]}>
        {item.photo ? (
          <View style={styles.avatarImageWrap}>
            <Text style={[styles.avatarText, { color: ROLE_COLORS[item.role] }]}>
              {getInitials(item.nickname)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.avatarText, { color: ROLE_COLORS[item.role] }]}>
            {getInitials(item.nickname)}
          </Text>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.nickname} numberOfLines={1}>{item.nickname}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] + '18' }]}>
            <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] }]}>{item.role}</Text>
          </View>
          <Text style={styles.ageText}>{item.age} anni</Text>
        </View>
      </View>
      <View style={styles.strengthBadge}>
        <Text style={styles.strengthNumber}>{item.strength}</Text>
        <Text style={styles.strengthLabel}>FRZ</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Giocatori</Text>
        <TouchableOpacity
          testID="add-player-btn"
          style={styles.addButton}
          onPress={() => router.push('/player/add')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
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

      {/* Role Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
        <TouchableOpacity
          testID="filter-all"
          style={[styles.filterChip, !selectedRole && styles.filterChipActive]}
          onPress={() => setSelectedRole(null)}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterText, !selectedRole && styles.filterTextActive]}>Tutti</Text>
        </TouchableOpacity>
        {ROLES.map((role) => (
          <TouchableOpacity
            key={role}
            testID={`filter-${role.toLowerCase()}`}
            style={[
              styles.filterChip,
              selectedRole === role && { backgroundColor: ROLE_COLORS[role] },
            ]}
            onPress={() => setSelectedRole(selectedRole === role ? null : role)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterText,
                selectedRole === role && { color: '#FFFFFF' },
              ]}
            >
              {role}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Player Count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{players.length} giocator{players.length === 1 ? 'e' : 'i'}</Text>
      </View>

      {/* Player List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : players.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={64} color="#D1D1D6" />
          <Text style={styles.emptyText}>Nessun giocatore trovato</Text>
          <Text style={styles.emptySubtext}>Tocca + per aggiungere il primo giocatore</Text>
        </View>
      ) : (
        <FlatList
          testID="player-list"
          data={players}
          keyExtractor={(item) => item.id}
          renderItem={renderPlayerCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    height: 44,
  },
  filterScroll: {
    maxHeight: 44,
    marginBottom: 8,
  },
  filterContainer: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  countRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  countText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImageWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nickname: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ageText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  strengthBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  strengthNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1C1C1E',
  },
  strengthLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
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
});
