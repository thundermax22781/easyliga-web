import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fetchPlayers, savePlayer, deletePlayer, ROLES, ROLE_COLORS, STRENGTH_VALUES, Player } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';

export default function PlayerDetailScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { id, groupId } = useLocalSearchParams<{ id: string; groupId: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStrengthModal, setShowStrengthModal] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [role, setRole] = useState('');
  const [strength, setStrength] = useState(5);

  useEffect(() => {
    loadPlayer();
  }, [id, groupId]);

  const loadPlayer = async () => {
    if (!id || !groupId) return;
    try {
      const allPlayers = await fetchPlayers({ group_id: groupId });
      const found = allPlayers.find(p => p.id === id);
      if (found) {
        setPlayer(found);
        setName(found.name || '');
        setSurname(found.surname || '');
        setNickname(found.nickname);
        setDob(found.date_of_birth ? new Date(found.date_of_birth) : new Date());
        setRole(found.role);
        setStrength(found.strength);
      } else {
        throw new Error('Giocatore non trovato');
      }
    } catch (e) {
      Alert.alert('Errore', 'Giocatore non trovato');
      router.back();
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

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Elimina Giocatore', `Vuoi eliminare ${player?.nickname}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
          await deletePlayer(id);
          router.back();
      }}
    ]);
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

  if (loading) return <View style={[styles.center, dynamicStyles.container]}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!player) return null;

  const getInitials = (nick: string) => nick.substring(0, 2).toUpperCase();

  if (!editing) {
    return (
      <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={24} color="#007AFF" /></TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => setEditing(true)} style={styles.iconBtn}><Ionicons name="pencil" size={22} color="#007AFF" /></TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}><Ionicons name="trash" size={22} color="#FF3B30" /></TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileSection}>
            <View style={[styles.bigAvatar, { backgroundColor: ROLE_COLORS[player.role] + '20' }]}>
              <Text style={[styles.bigAvatarText, { color: ROLE_COLORS[player.role] }]}>{getInitials(player.nickname)}</Text>
            </View>
            <Text style={[styles.profileNickname, dynamicStyles.text]}>{player.nickname}</Text>
            {(player.name || player.surname) && (
              <Text style={[styles.profileName, dynamicStyles.subText]}>
                {`${player.name || ''} ${player.surname || ''}`.trim()}
              </Text>
            )}
            <View style={[styles.rolePill, { backgroundColor: ROLE_COLORS[player.role] }]}>
              <Text style={styles.rolePillText}>{player.role}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, dynamicStyles.card]}><Text style={[styles.statValue, dynamicStyles.text]}>{player.strength}</Text><Text style={[styles.statLabel, dynamicStyles.subText]}>Forza</Text></View>
            <View style={[styles.statCard, dynamicStyles.card]}><Text style={[styles.statValue, dynamicStyles.text]}>{player.age}</Text><Text style={[styles.statLabel, dynamicStyles.subText]}>Anni</Text></View>
          </View>

          <View style={[styles.detailsCard, dynamicStyles.card]}>
            <View style={styles.detailRow}><Text style={[styles.detailLabel, dynamicStyles.subText]}>Nickname</Text><Text style={[styles.detailValue, dynamicStyles.text]}>{player.nickname}</Text></View>
            <View style={[styles.detailDivider, dynamicStyles.divider]} />
            <View style={styles.detailRow}><Text style={[styles.detailLabel, dynamicStyles.subText]}>Nome</Text><Text style={[styles.detailValue, dynamicStyles.text]}>{player.name || '-'}</Text></View>
            <View style={[styles.detailDivider, dynamicStyles.divider]} />
            <View style={styles.detailRow}><Text style={[styles.detailLabel, dynamicStyles.subText]}>Cognome</Text><Text style={[styles.detailValue, dynamicStyles.text]}>{player.surname || '-'}</Text></View>
            <View style={[styles.detailDivider, dynamicStyles.divider]} />
            <View style={styles.detailRow}><Text style={[styles.detailLabel, dynamicStyles.subText]}>Data di Nascita</Text><Text style={[styles.detailValue, dynamicStyles.text]}>{player.date_of_birth ? new Date(player.date_of_birth).toLocaleDateString('it-IT') : '-'}</Text></View>
          </View>
        </ScrollView>
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

            <View style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>Nickname</Text>
              <TextInput style={[styles.input, dynamicStyles.input]} value={nickname} onChangeText={setNickname} placeholder="Nickname" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>Nome</Text>
              <TextInput style={[styles.input, dynamicStyles.input]} value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>Cognome</Text>
              <TextInput style={[styles.input, dynamicStyles.input]} value={surname} onChangeText={setSurname} placeholder="Cognome" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>Data di Nascita</Text>
              <View style={styles.ageContainer}>
                <TouchableOpacity style={[styles.input, dynamicStyles.input, styles.datePickerButton]} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color="#007AFF" style={{marginRight: 10}} />
                  <Text style={[styles.dateText, dynamicStyles.text]}>{dob.toLocaleDateString('it-IT')}</Text>
                </TouchableOpacity>
                <View style={[styles.ageBox, dynamicStyles.card, {borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'}]}>
                  <Text style={styles.ageNumber}>{calculateAgeDisplay(dob)}</Text>
                  <Text style={[styles.ageLabel, dynamicStyles.subText]}>ANNI</Text>
                </View>
              </View>
              {showDatePicker && (
                <DateTimePicker value={dob} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} maximumDate={new Date()} themeVariant={isDarkMode ? 'dark' : 'light'} />
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>Ruolo</Text>
              <View style={styles.roleGrid}>
                {ROLES.map((r) => (
                  <TouchableOpacity key={r} style={[styles.roleOption, dynamicStyles.card, {borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'}, role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[role] }]} onPress={() => setRole(r)}>
                    <Text style={[styles.roleOptionText, dynamicStyles.text, role === r && { color: '#FFF' }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>Livello di Forza</Text>
              <TouchableOpacity style={[styles.strengthPreviewBox, dynamicStyles.card, {borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'}]} onPress={() => setShowStrengthModal(true)}>
                <View style={[styles.strengthDisplay, {backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7'}]}>
                   <Text style={[styles.strengthNumber, dynamicStyles.text]}>{strength}</Text>
                   <Text style={[styles.strengthSubText, dynamicStyles.subText]}>VALORE</Text>
                </View>
                <Ionicons name="chevron-down" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Salva Modifiche</Text>}
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <Modal visible={showStrengthModal} transparent={true} animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowStrengthModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, dynamicStyles.modalContent]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, dynamicStyles.text]}>Seleziona Forza</Text></View>
              <ScrollView>
                <View style={styles.strengthGrid}>
                  {STRENGTH_VALUES.map((v) => (
                    <TouchableOpacity key={v} style={[styles.strengthOption, { backgroundColor: strength === v ? '#007AFF' : (isDarkMode ? '#3A3A3C' : '#F2F2F7') }]} onPress={() => { setStrength(v); setShowStrengthModal(false); }}>
                      <Text style={[styles.strengthOptionText, { color: strength === v ? '#FFF' : (isDarkMode ? '#FFF' : '#1C1C1E') }]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
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
  profileSection: { alignItems: 'center', paddingVertical: 16 },
  bigAvatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  bigAvatarText: { fontSize: 36, fontWeight: '900' },
  profileNickname: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  profileName: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
  rolePill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  rolePillText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statValue: { fontSize: 32, fontWeight: '900' },
  statLabel: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  detailsCard: { borderRadius: 16, marginHorizontal: 20, padding: 4, marginBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  detailLabel: { fontSize: 15, fontWeight: '500' },
  detailValue: { fontSize: 15, fontWeight: '600' },
  detailDivider: { height: 0.5, marginHorizontal: 16 },
  editContent: { paddingHorizontal: 20, paddingBottom: 40 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 17 },
  datePickerButton: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  dateText: { fontSize: 17 },
  ageContainer: { flexDirection: 'row', alignItems: 'center' },
  ageBox: { width: 65, height: 65, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ageNumber: { fontSize: 22, fontWeight: '800', color: '#007AFF' },
  ageLabel: { fontSize: 10, fontWeight: '700', marginTop: -2 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 2 },
  roleOptionText: { fontSize: 15, fontWeight: '600' },
  strengthPreviewBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  strengthDisplay: { alignItems: 'center', justifyContent: 'center', width: 65, height: 65, borderRadius: 12 },
  strengthNumber: { fontSize: 24, fontWeight: '800' },
  strengthSubText: { fontSize: 10, fontWeight: '700', marginTop: -2 },
  saveButton: { backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  saveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '50%', paddingBottom: 40 },
  modalHeader: { padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  strengthGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'center' },
  strengthOption: { width: '22%', aspectRatio: 1, margin: '1%', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  strengthOptionText: { fontSize: 16, fontWeight: '700' },
});
