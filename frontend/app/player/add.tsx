import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createPlayer, ROLES, ROLE_COLORS, STRENGTH_VALUES } from '../../src/api';

export default function AddPlayerScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState('');
  const [role, setRole] = useState('');
  const [strength, setStrength] = useState(5);
  const [saving, setSaving] = useState(false);

  const formatDateInput = (text: string) => {
    // Remove all non-numeric characters
    const numbers = text.replace(/[^0-9]/g, '');
    let formatted = '';
    if (numbers.length <= 4) {
      formatted = numbers;
    } else if (numbers.length <= 6) {
      formatted = numbers.slice(0, 4) + '-' + numbers.slice(4);
    } else {
      formatted = numbers.slice(0, 4) + '-' + numbers.slice(4, 6) + '-' + numbers.slice(6, 8);
    }
    setDob(formatted);
  };

  const isValidDate = (dateStr: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d < new Date();
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Errore', 'Inserisci il nome');
    if (!surname.trim()) return Alert.alert('Errore', 'Inserisci il cognome');
    if (!nickname.trim()) return Alert.alert('Errore', 'Inserisci il nickname');
    if (!isValidDate(dob)) return Alert.alert('Errore', 'Data di nascita non valida (formato: AAAA-MM-GG)');
    if (!role) return Alert.alert('Errore', 'Seleziona un ruolo');

    setSaving(true);
    try {
      await createPlayer({
        name: name.trim(),
        surname: surname.trim(),
        nickname: nickname.trim(),
        date_of_birth: dob,
        role,
        strength,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile salvare il giocatore');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity testID="close-add-btn" onPress={() => router.back()} style={styles.closeBtn}>
                <Ionicons name="close" size={28} color="#1C1C1E" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Nuovo Giocatore</Text>
              <View style={{ width: 44 }} />
            </View>

            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                testID="input-name"
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Mario"
                placeholderTextColor="#C7C7CC"
                autoCapitalize="words"
              />
            </View>

            {/* Surname */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cognome</Text>
              <TextInput
                testID="input-surname"
                style={styles.input}
                value={surname}
                onChangeText={setSurname}
                placeholder="Rossi"
                placeholderTextColor="#C7C7CC"
                autoCapitalize="words"
              />
            </View>

            {/* Nickname */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nickname</Text>
              <TextInput
                testID="input-nickname"
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="SuperMario"
                placeholderTextColor="#C7C7CC"
              />
            </View>

            {/* Date of Birth */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Data di Nascita</Text>
              <TextInput
                testID="input-dob"
                style={styles.input}
                value={dob}
                onChangeText={formatDateInput}
                placeholder="AAAA-MM-GG"
                placeholderTextColor="#C7C7CC"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>

            {/* Role */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ruolo</Text>
              <View style={styles.roleGrid}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    testID={`role-${r.toLowerCase()}`}
                    style={[
                      styles.roleOption,
                      role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] },
                    ]}
                    onPress={() => setRole(r)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        role === r && { color: '#FFFFFF' },
                      ]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Strength */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Valore di Forza: {strength}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.strengthRow}>
                  {STRENGTH_VALUES.map((v) => (
                    <TouchableOpacity
                      key={v}
                      testID={`strength-${v}`}
                      style={[
                        styles.strengthBtn,
                        v === strength && styles.strengthBtnActive,
                      ]}
                      onPress={() => setStrength(v)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.strengthBtnText,
                          v === strength && styles.strengthBtnTextActive,
                        ]}
                      >
                        {Number.isInteger(v) ? v : v.toFixed(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              testID="save-player-btn"
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Salva Giocatore</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 17,
    color: '#1C1C1E',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  roleOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  strengthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  strengthBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  strengthBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  strengthBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3A3A3C',
  },
  strengthBtnTextActive: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
