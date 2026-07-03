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
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  fetchGroups,
  createGroup,
  deleteGroup,
  leaveGroup,
  updateGroup,
  joinGroup,
  syncCloudData,
  checkPremiumStatus,
  redeemCode,
  Group
} from '../src/api';
import { useTheme } from '../src/ThemeContext';

export default function GroupsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ join?: string }>();
  const { isDarkMode, toggleTheme } = useTheme();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [unlockModalVisible, setUnlockModalVisible] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [storageType, setStorageType] = useState<'local' | 'cloud'>('local');
  const [groupType, setGroupType] = useState<'championship' | 'tournament'>('championship');
  const [teamsCount, setTeamsCount] = useState(4);

  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinToken, setJoinToken] = useState('');

  useEffect(() => {
    const checkJoinToken = async () => {
      if (params.join) {
        setLoading(true);
        try {
          await joinGroup(params.join);
          // Pulisce l'URL dopo l'ingresso
          router.replace('/');
          loadGroups();
        } catch (e: any) {
          Alert.alert('Errore di Accesso', 'Il link di invito non è valido o è scaduto.');
          setLoading(false);
        }
      } else {
        loadGroups();
      }
    };

    checkJoinToken();
  }, [params.join]);

  const loadGroups = async () => {
    try {
      // Forza una sincronizzazione se siamo online
      try {
        await syncCloudData();
      } catch (e) {
        console.log("Offline or sync failed, using cache");
      }
      const data = await fetchGroups();
      setGroups(data);

      const premium = await checkPremiumStatus();
      setIsPremium(premium);
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
        await updateGroup(editGroup.id, { name: groupName.trim() });
      } else {
        // Usa createGroupExtended se è un torneo o se vogliamo passare opzioni extra
        const { createGroupExtended } = require('../src/api');
        await createGroupExtended(groupName.trim(), storageType, {
          group_type: groupType,
          num_teams: teamsCount,
          num_groups: 1 // Default 1 gruppo inizialmente
        });
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

  const handleRedeemCode = async () => {
    if (!activationCode.trim()) return;
    setActivating(true);
    try {
      await redeemCode(activationCode.trim());
      setIsPremium(true);
      setUnlockModalVisible(false);
      setActivationCode('');
      Alert.alert('Successo!', 'Hai sbloccato le funzionalità Cloud. Ora puoi creare gruppi online!');
    } catch (e: any) {
      Alert.alert('Errore', e.message);
    } finally {
      setActivating(false);
    }
  };

  const handleLeaveGroup = (id: string) => {
    Alert.alert('Abbandona Gruppo', 'Vuoi rimuovere questo gruppo dalla tua lista? Non verrà eliminato dal cloud.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Abbandona',
        style: 'destructive',
        onPress: async () => {
          await leaveGroup(id);
          loadGroups();
        },
      },
    ]);
  };

  const handleDeleteGroup = (id: string, storageType: string) => {
    const message = storageType === 'cloud'
      ? 'Sei sicuro di voler eliminare definitivamente questo gruppo dal cloud? Tutti i dati andranno persi per tutti gli utenti.'
      : 'Sei sicuro di voler eliminare questo gruppo? I dati locali verranno persi.';

    Alert.alert('Elimina Gruppo', message, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroup(id);
            await loadGroups();
          } catch (e: any) {
            Alert.alert('Errore', 'Impossibile eliminare il gruppo: ' + (e.message || 'Errore sconosciuto'));
          }
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
        <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }}>
          <Image source={require('../assets/images/icon.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
        </View>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>EASYLIGA</Text>
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
                style={[styles.groupCard, dynamicStyles.card, { minHeight: 95, paddingVertical: 10, paddingHorizontal: 16 }]}
                onPress={() => router.push(`/group/${item.id}?name=${encodeURIComponent(item.name || 'Gruppo')}`)}
                onLongPress={() => {
                  setEditGroup(item);
                  setGroupName(item.name || '');
                  setModalVisible(true);
                }}
              >
                <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center' }}>
                  {/* Icona compatta */}
                  <View style={[styles.groupIcon, { backgroundColor: item.storage_type === 'cloud' ? 'rgba(52, 199, 89, 0.1)' : 'rgba(0, 122, 255, 0.1)', width: 44, height: 44, borderRadius: 12 }]}>
                    <Ionicons
                      name={item.storage_type === 'cloud' ? "cloud-done-outline" : "person-outline"}
                      size={22}
                      color={item.storage_type === 'cloud' ? "#34C759" : "#007AFF"}
                    />
                  </View>

                  {/* Testi e Azioni ravvicinati */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.groupName, dynamicStyles.text, { fontSize: 18, fontWeight: '800', marginBottom: 0 }]} numberOfLines={1}>
                      {item.name || 'Senza Nome'}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -2 }}>
                      <Text style={[styles.groupCount, dynamicStyles.subText, { fontSize: 12, fontWeight: '600' }]}>
                        {item.player_count || 0} giocatori
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                        {item.role !== 'viewer' && (
                          <TouchableOpacity onPress={() => { setEditGroup(item); setGroupName(item.name); setModalVisible(true); }} style={{ padding: 5 }}>
                            <Ionicons name="create-outline" size={19} color="#007AFF" />
                          </TouchableOpacity>
                        )}
                        {item.storage_type === 'cloud' && item.role !== 'owner' && (
                          <TouchableOpacity onPress={() => handleLeaveGroup(item.id)} style={{ padding: 5 }}>
                            <Ionicons name="log-out-outline" size={19} color="#FF9500" />
                          </TouchableOpacity>
                        )}
                        {((item.storage_type === 'cloud' && item.role === 'owner') || item.storage_type === 'local') && (
                          <TouchableOpacity onPress={() => handleDeleteGroup(item.id, item.storage_type)} style={{ padding: 5 }}>
                            <Ionicons name="trash-outline" size={19} color="#FF3B30" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                </View>

                {/* Status Row: Ultra compatta in basso a destra */}
                <View style={{ position: 'absolute', bottom: 8, right: 15, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ backgroundColor: item.group_type === 'tournament' ? '#5856D6' : '#007AFF', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 }}>
                       <Text style={{ color: '#FFF', fontSize: 7, fontWeight: '900' }}>
                         {item.group_type === 'tournament' ? 'TORNEO' : 'CAMPIONATO'}
                       </Text>
                    </View>

                    {item.storage_type === 'cloud' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 8, fontWeight: '900', color: (item.role === 'owner') ? '#FFB800' : (item.role === 'admin' ? '#007AFF' : '#FF3B30') }}>
                          {item.role === 'owner' ? 'PROPRIETARIO' : item.role === 'admin' ? 'AMMINISTRATORE' : 'SOLO LETTURA'}
                        </Text>
                        <Text style={{ color: '#34C759', fontSize: 8, fontWeight: '900' }}>
                          • CONDIVISO
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: isDarkMode ? '#AEAEB2' : '#8E8E93', fontSize: 8, fontWeight: '900' }}>
                        LOCALE
                      </Text>
                    )}
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
              <>
                <View style={styles.storageSelector}>
                  <Text style={[styles.storageLabel, dynamicStyles.text]}>Tipo di Competizione</Text>
                  <View style={styles.storageOptions}>
                    <TouchableOpacity
                      style={[styles.storageOption, groupType === 'championship' && styles.storageOptionActive]}
                      onPress={() => setGroupType('championship')}
                    >
                      <Ionicons name="trophy-outline" size={20} color={groupType === 'championship' ? '#FFF' : '#007AFF'} />
                      <Text style={[styles.storageOptionText, groupType === 'championship' && styles.storageOptionTextActive]}>Campionato</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.storageOption, groupType === 'tournament' && styles.storageOptionActive]}
                      onPress={() => setGroupType('tournament')}
                    >
                      <Ionicons name="apps-outline" size={20} color={groupType === 'tournament' ? '#FFF' : '#007AFF'} />
                      <Text style={[styles.storageOptionText, groupType === 'tournament' && styles.storageOptionTextActive]}>Torneo</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.storageHint, dynamicStyles.subText]}>
                    {groupType === 'championship'
                      ? 'Tutti i giocatori accumulano punti individuali.'
                      : 'Squadre fisse e fase a eliminazione diretta.'}
                  </Text>
                </View>

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
                      style={[
                        styles.storageOption,
                        storageType === 'cloud' && styles.storageOptionActive,
                        !isPremium && storageType === 'cloud' && { borderColor: '#8E8E93' }
                      ]}
                      onPress={() => {
                        if (!isPremium) {
                          setUnlockModalVisible(true);
                        } else {
                          setStorageType('cloud');
                        }
                      }}
                    >
                      <Ionicons
                        name={isPremium ? "cloud-outline" : "lock-closed-outline"}
                        size={20}
                        color={storageType === 'cloud' ? '#FFF' : (isPremium ? '#007AFF' : '#8E8E93')}
                      />
                      <Text style={[
                        styles.storageOptionText,
                        storageType === 'cloud' && styles.storageOptionTextActive,
                        !isPremium && { color: '#8E8E93' }
                      ]}>Cloud</Text>
                    </TouchableOpacity>
                  </View>
                  {!isPremium && (
                    <TouchableOpacity
                      onPress={() => setUnlockModalVisible(true)}
                      style={{ marginTop: 10, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#007AFF', fontSize: 12, fontWeight: '700' }}>Sblocca creazione gruppi online</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.storageHint, dynamicStyles.subText]}>
                    {storageType === 'local'
                      ? 'I dati resteranno solo su questo telefono.'
                      : 'Potrai condividere il gruppo con altri utenti.'}
                  </Text>
                </View>
              </>
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

      {/* Modal Sblocca Cloud */}
      <Modal visible={unlockModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ backgroundColor: '#007AFF15', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 15 }}>
                <Ionicons name="cloud-upload-outline" size={32} color="#007AFF" />
              </View>
              <Text style={[styles.modalTitle, dynamicStyles.text, { textAlign: 'center', marginBottom: 5 }]}>Versione PRO</Text>
              <Text style={[dynamicStyles.subText, { textAlign: 'center', fontSize: 14 }]}>L'opzione Cloud ti permette di condividere il gruppo con gli amici e sincronizzare i dati su tutti i dispositivi.</Text>
            </View>

            <TextInput
              style={[styles.modalInput, dynamicStyles.input]}
              placeholder="Inserisci codice di attivazione"
              placeholderTextColor={isDarkMode ? "#8E8E93" : "#AEAEB2"}
              value={activationCode}
              onChangeText={setActivationCode}
              autoCapitalize="characters"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setUnlockModalVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRedeemCode}
                style={[styles.modalSubmit, { backgroundColor: '#34C759' }]}
                disabled={activating}
              >
                {activating ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Attiva Ora</Text>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={() => Alert.alert("Come ottenere il codice", "Contatta l'amministratore per acquistare una licenza Pro.")}>
               <Text style={{ color: '#8E8E93', fontSize: 11, textDecorationLine: 'underline' }}>Non hai un codice?</Text>
            </TouchableOpacity>
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
  groupCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16, borderRadius: 22, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, minHeight: 110 },
  groupIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  groupInfo: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  groupName: { fontSize: 18, fontWeight: '700' },
  groupMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  groupCount: { fontSize: 13 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#C7C7CC', marginHorizontal: 6 },
  storageTag: { fontSize: 10, fontWeight: '800' },
  groupActions: { justifyContent: 'center', marginLeft: 10 },
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
