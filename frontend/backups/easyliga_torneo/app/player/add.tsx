import React, { useState, useMemo } from 'react';
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
import { savePlayer, ROLES, ROLE_COLORS, STRENGTH_VALUES } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';

export default function AddPlayerScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [role, setRole] = useState('Attaccante');
  const [strength, setStrength] = useState(5);
  const [saving, setSaving] = useState(false);
  const [showStrengthModal, setShowStrengthModal] = useState(false);

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
    if (!nickname.trim()) return Alert.alert('Errore', 'Inserisci il nickname');
    if (!groupId) return Alert.alert('Errore', 'Gruppo non trovato');

    setSaving(true);
    try {
      await savePlayer({
        nickname: nickname.trim(),
        name: name.trim() || undefined,
        surname: surname.trim() || undefined,
        date_of_birth: dob.toISOString().split('T')[0],
        role,
        strength,
        group_id: groupId,
      });
      router.back();
    } catch (e: any) {
      console.error("Errore salvataggio giocatore:", e);
      Alert.alert('Errore', e.message || 'Impossibile salvare il giocatore. Controlla la connessione o i permessi.');
    } finally {
      setSaving(false);
    }
  };

  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7' },
    text: { color: isDarkMode ? '#FFFFFF' : '#1C1C1E' },
    subText: { color: isDarkMode ? '#AEAEB2' : '#8E8E93' },
    card: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF' },
    input: { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFF', color: isDarkMode ? '#FFF' : '#1C1C1E', borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' },
    modalContent: { backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF' },
    option: { backgroundColor: isDarkMode ? '#2C2C2E' : '#F2F2F7', borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }
  }), [isDarkMode]);

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                <Ionicons name="close" size={28} color={isDarkMode ? "#FFF" : "#1C1C1E"} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, dynamicStyles.text]}>Nuovo Giocatore</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.label, dynamicStyles.text]}>Nickname</Text>
                <Text style={[styles.charCount, dynamicStyles.subText]}>{nickname.length}/8</Text>
              </View>
              <TextInput style={[styles.input, dynamicStyles.input]} value={nickname} onChangeText={setNickname} placeholder="Nickname" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} maxLength={8} />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                <Text style={[styles.label, dynamicStyles.text]}>Nome (opz.)</Text>
                <TextInput style={[styles.input, dynamicStyles.input]} value={name} onChangeText={setName} placeholder="Es. Mario" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                <Text style={[styles.label, dynamicStyles.text]}>Cognome (opz.)</Text>
                <TextInput style={[styles.input, dynamicStyles.input]} value={surname} onChangeText={setSurname} placeholder="Es. Rossi" placeholderTextColor={isDarkMode ? "#8E8E93" : "#C7C7CC"} />
              </View>
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
                  <TouchableOpacity key={r} style={[styles.roleOption, dynamicStyles.card, {borderColor: isDarkMode ? '#3A3A3C' : '#E5E5EA'}, role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]} onPress={() => setRole(r)}>
                    <Text style={[styles.roleOptionText, dynamicStyles.text, role === r && { color: '#FFFFFF' }]}>{r}</Text>
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
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Salva Giocatore</Text>}
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
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
                  onPress={() => setStrength(prev => Math.max(1, prev - 0.5))}
                  style={[styles.adjustBtn, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' }]}
                >
                  <Ionicons name="remove" size={32} color="#007AFF" />
                </TouchableOpacity>

                <View style={{ alignItems: 'center', minWidth: 100 }}>
                  <TextInput
                    style={[styles.strengthLargeInput, dynamicStyles.text]}
                    keyboardType="decimal-pad"
                    value={String(strength)}
                    selectTextOnFocus
                    onChangeText={(v) => {
                      const sanitized = v.replace(',', '.');
                      if (sanitized === '') {
                        setStrength(0);
                      } else {
                        const val = parseFloat(sanitized);
                        if (!isNaN(val)) setStrength(val);
                      }
                    }}
                    onBlur={() => {
                      setStrength(Math.max(1, Math.min(10, strength)));
                    }}
                  />
                  <Text style={[dynamicStyles.subText, { fontSize: 10, fontWeight: '800', marginTop: -5, letterSpacing: 1 }]}>VALORE ATTUALE</Text>
                </View>

                <TouchableOpacity
                  onPress={() => setStrength(prev => Math.min(10, prev + 0.5))}
                  style={[styles.adjustBtn, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' }]}
                >
                  <Ionicons name="add" size={32} color="#007AFF" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { width: '100%', marginTop: 40, height: 54 }]}
                onPress={() => {
                  setStrength(Math.max(1, Math.min(10, strength)));
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  charCount: { fontSize: 11, fontWeight: '700' },
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
  strengthOptionSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  strengthOptionText: { fontSize: 16, fontWeight: '700' },
});
