import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  fetchGroups,
  createGroup,
  deleteGroup,
  updateGroup,
  joinGroup,
  Group
} from '../src/api';
import { useTheme } from '../src/ThemeContext';

export default function GroupsScreen() {
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useTheme();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [storageType, setStorageType] = useState<'local' | 'cloud'>('local');

  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinToken, setJoinToken] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await fetchGroups();
      setGroups(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateOrUpdateGroup = async () => {
    if (!groupName.trim()) return;
    try {
      if (editGroup) {
        await updateGroup(editGroup.id, groupName.trim());
      } else {
        await createGroup(groupName.trim(), storageType);
      }
      resetForm();
      loadGroups();
    } catch (e: any) {
      Alert.alert('Errore', e.message);
    }
  };

  const resetForm = () => {
    setGroupName('');
    setModalVisible(false);
    setEditGroup(null);
  };

  const handleJoinGroup = async () => {
    if (!joinToken.trim()) return;
    try {
      await joinGroup(joinToken.trim());
      setJoinToken('');
      setJoinModalVisible(false);
      loadGroups();
    } catch (e: any) {
      Alert.alert('Errore', e.message);
    }
  };

  const handleDeleteGroup = (id: string) => {
    Alert.alert('Elimina Gruppo', 'Sei sicuro di voler eliminare questo gruppo? I giocatori locali verranno persi.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          await deleteGroup(id);
          loadGroups();
        },
      },
    ]);
  };

  const dynamicStyles = {
    container: { backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7' },
    text: { color: isDarkMode ? '#FFFFFF' : '#1C1C1E' },
    subText: { color: isDarkMode ? '#AEAEB2' : '#8E8E93' },
    card: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF' },
    modalContent: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF' },
    input: { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7', color: isDarkMode ? '#FFF' : '#1C1C1E' },
  };

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../assets/images/react-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <Text style={[styles.headerTitle, dynamicStyles.text]}>EQUILIGA</Text>
        <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
          <Ionicons
            name={isDarkMode ? "sunny-outline" : "moon-outline"}
            size={24}
            color={isDarkMode ? "#FFD60A" : "#1C1C1E"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.main}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, dynamicStyles.text]}>Gruppi</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setJoinModalVisible(true)}
              style={[styles.actionBtn, {backgroundColor: isDarkMode ? 'rgba(52, 199, 89, 0.2)' : 'rgba(52, 199, 89, 0.1)'}]}
            >
              <Ionicons name="link-outline" size={20} color="#34C759" />
              <Text style={[styles.actionBtnText, {color: '#34C759'}]}>Entra</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setModalVisible(true);
              }}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={24} color="#FFF" />
              <Text style={styles.addBtnText}>Nuovo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.groupCard, dynamicStyles.card]}
                onPress={() => router.push(`/group/${item.id}?name=${encodeURIComponent(item.name)}`)}
                onLongPress={() => {
                  setEditGroup(item);
                  setGroupName(item.name);
                  setModalVisible(true);
                }}
              >
                <View style={[styles.groupIcon, {backgroundColor: item.storage_type === 'cloud' ? 'rgba(52, 199, 89, 0.1)' : 'rgba(0, 122, 255, 0.1)'}]}>
                  <Ionicons
                    name={item.storage_type === 'cloud' ? "cloud-done-outline" : "person-outline"}
                    size={24}
                    color={item.storage_type === 'cloud' ? "#34C759" : "#007AFF"}
                  />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={[styles.groupName, dynamicStyles.text]}>{item.name}</Text>
                  <View style={styles.groupMeta}>
                    <Text style={[styles.groupCount, dynamicStyles.subText]}>{item.player_count} giocatori</Text>
                    <View style={styles.metaDot} />
                    <Text style={[styles.storageTag, {color: item.storage_type === 'cloud' ? '#34C759' : (isDarkMode ? '#AEAEB2' : '#8E8E93')}]}>
                      {item.storage_type === 'cloud' ? 'Condiviso' : 'Locale'}
                    </Text>
                  </View>
                </View>
                <View style={styles.groupActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditGroup(item);
                      setGroupName(item.name);
                      setModalVisible(true);
                    }}
                    style={styles.editBtn}
                  >
                    <Ionicons name="create-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteGroup(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadGroups(); }} tintColor={isDarkMode ? "#FFF" : "#007AFF"} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color={isDarkMode ? "#3A3A3C" : "#D1D1D6"} />
                <Text style={[styles.emptyText, dynamicStyles.subText]}>Non hai ancora creato nessun gruppo.</Text>
                <Text style={[styles.emptySubText, dynamicStyles.subText]}>Crea un gruppo per iniziare a gestire i tuoi giocatori.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Modal Creazione/Modifica Gruppo */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>{editGroup ? 'Modifica Gruppo' : 'Nuovo Gruppo'}</Text>
            <TextInput
              style={[styles.modalInput, dynamicStyles.input]}
              placeholder="Nome del gruppo (es. Calcetto del Martedì)"
              placeholderTextColor={isDarkMode ? "#8E8E93" : "#AEAEB2"}
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
            />

            {!editGroup && (
              <View style={styles.storageSelector}>
                <Text style={[styles.storageLabel, dynamicStyles.text]}>Dove vuoi salvare i dati?</Text>
                <View style={styles.storageOptions}>
                  <TouchableOpacity
                    style={[styles.storageOption, storageType === 'local' && styles.storageOptionActive]}
                    onPress={() => setStorageType('local')}
                  >
                    <Ionicons name="person-outline" size={20} color={storageType === 'local' ? '#FFF' : '#007AFF'} />
                    <Text style={[styles.storageOptionText, storageType === 'local' && styles.storageOptionTextActive]}>Locale</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.storageOption, storageType === 'cloud' && styles.storageOptionActive]}
                    onPress={() => setStorageType('cloud')}
                  >
                    <Ionicons name="cloud-outline" size={20} color={storageType === 'cloud' ? '#FFF' : '#007AFF'} />
                    <Text style={[styles.storageOptionText, storageType === 'cloud' && styles.storageOptionTextActive]}>Cloud</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.storageHint, dynamicStyles.subText]}>
                  {storageType === 'local'
                    ? 'I dati resteranno solo su questo telefono.'
                    : 'Potrai condividere il gruppo con altri utenti.'}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => { setModalVisible(false); setEditGroup(null); }} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateOrUpdateGroup} style={styles.modalSubmit}>
                <Text style={styles.modalSubmitText}>{editGroup ? 'Salva' : 'Crea'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Entra in un Gruppo */}
      <Modal visible={joinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>Entra in un Gruppo</Text>
            <Text style={[styles.modalSubTitle, dynamicStyles.subText]}>Incolla il token condiviso dal tuo amico per accedere al gruppo.</Text>
            <TextInput
              style={[styles.modalInput, dynamicStyles.input]}
              placeholder="Incolla Token..."
              placeholderTextColor={isDarkMode ? "#8E8E93" : "#AEAEB2"}
              value={joinToken}
              onChangeText={setJoinToken}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleJoinGroup} style={styles.modalSubmit}>
                <Text style={styles.modalSubmitText}>Entra</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 10 },
  headerLogo: { width: 40, height: 40, marginRight: 10 },
  headerTitle: { fontSize: 24, fontWeight: '900', flex: 1, letterSpacing: 1 },
  themeToggle: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)' },
  main: { flex: 1, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  listContent: { paddingBottom: 100 },
  groupCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  groupIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  groupInfo: { flex: 1, marginLeft: 15 },
  groupName: { fontSize: 18, fontWeight: '700' },
  groupMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  groupCount: { fontSize: 14 },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#C7C7CC', marginHorizontal: 8 },
  storageTag: { fontSize: 12, fontWeight: '600' },
  groupActions: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 20 },
  emptySubText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  modalSubTitle: { fontSize: 14, marginBottom: 15 },
  modalInput: { borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20 },
  storageSelector: { marginBottom: 20 },
  storageLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  storageOptions: { flexDirection: 'row', gap: 10 },
  storageOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#007AFF' },
  storageOptionActive: { backgroundColor: '#007AFF' },
  storageOptionText: { fontSize: 15, fontWeight: '700', color: '#007AFF' },
  storageOptionTextActive: { color: '#FFF' },
  storageHint: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { fontSize: 16, fontWeight: '600', color: '#FF3B30' },
  modalSubmit: { flex: 1, backgroundColor: '#007AFF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalSubmitText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
