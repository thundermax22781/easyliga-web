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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchGroups, createGroup, updateGroup, deleteGroup, Group } from '../src/api';

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const data = await fetchGroups();
      setGroups(data);
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
      loadGroups();
    }, [loadGroups])
  );

  const openCreate = () => {
    setEditGroup(null);
    setGroupName('');
    setModalVisible(true);
  };

  const openEdit = (group: Group) => {
    setEditGroup(group);
    setGroupName(group.name);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      Alert.alert('Errore', 'Inserisci un nome per il gruppo');
      return;
    }
    setSaving(true);
    try {
      if (editGroup) {
        await updateGroup(editGroup.id, groupName.trim());
      } else {
        await createGroup(groupName.trim());
      }
      setModalVisible(false);
      loadGroups();
    } catch (e) {
      Alert.alert('Errore', 'Impossibile salvare il gruppo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (group: Group) => {
    Alert.alert(
      'Elimina Gruppo',
      `Vuoi eliminare "${group.name}" e tutti i suoi giocatori?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroup(group.id);
              loadGroups();
            } catch (e) {
              Alert.alert('Errore', 'Impossibile eliminare il gruppo');
            }
          },
        },
      ]
    );
  };

  const renderGroupCard = ({ item }: { item: Group }) => (
    <TouchableOpacity
      testID={`group-card-${item.id}`}
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/group/${item.id}?name=${encodeURIComponent(item.name)}`)}
    >
      <View style={styles.cardIcon}>
        <Ionicons name="football" size={28} color="#007AFF" />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardCount}>
          {item.player_count} giocator{item.player_count === 1 ? 'e' : 'i'}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          testID={`edit-group-${item.id}`}
          style={styles.actionBtn}
          onPress={() => openEdit(item)}
        >
          <Ionicons name="pencil" size={18} color="#8E8E93" />
        </TouchableOpacity>
        <TouchableOpacity
          testID={`delete-group-${item.id}`}
          style={styles.actionBtn}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Calcetto Manager</Text>
        <TouchableOpacity
          testID="add-group-btn"
          style={styles.addButton}
          onPress={openCreate}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>I tuoi gruppi di gioco</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={80} color="#D1D1D6" />
          <Text style={styles.emptyText}>Nessun gruppo</Text>
          <Text style={styles.emptySubtext}>
            Crea il tuo primo gruppo per iniziare{'\n'}a gestire i giocatori
          </Text>
          <TouchableOpacity
            testID="create-first-group-btn"
            style={styles.createFirstBtn}
            onPress={openCreate}
          >
            <Ionicons name="add-circle" size={22} color="#FFFFFF" />
            <Text style={styles.createFirstText}>Crea Gruppo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="groups-list"
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroupCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadGroups(); }} tintColor="#007AFF" />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editGroup ? 'Modifica Gruppo' : 'Nuovo Gruppo'}
              </Text>
              <TextInput
                testID="group-name-input"
                style={styles.modalInput}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Nome del gruppo (es. Martedì sera)"
                placeholderTextColor="#C7C7CC"
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  testID="cancel-group-btn"
                  style={styles.modalCancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="save-group-btn"
                  style={styles.modalSaveBtn}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalSaveText}>Salva</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
    paddingHorizontal: 20,
    marginBottom: 16,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 3,
  },
  cardCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#8E8E93',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#C7C7CC',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
    gap: 8,
  },
  createFirstText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 17,
    color: '#1C1C1E',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
