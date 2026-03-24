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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { fetchPlayer, updatePlayer, deletePlayer, ROLES, ROLE_COLORS, STRENGTH_VALUES, Player } from '../../src/api';

export default function PlayerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState('');
  const [role, setRole] = useState('');
  const [strength, setStrength] = useState(5);

  useEffect(() => {
    loadPlayer();
  }, [id]);

  const loadPlayer = async () => {
    if (!id) return;
    try {
      const data = await fetchPlayer(id);
      setPlayer(data);
      setName(data.name);
      setSurname(data.surname);
      setNickname(data.nickname);
      setDob(data.date_of_birth);
      setRole(data.role);
      setStrength(data.strength);
    } catch (e) {
      Alert.alert('Errore', 'Giocatore non trovato');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDateInput = (text: string) => {
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
    if (!id) return;
    if (!name.trim()) return Alert.alert('Errore', 'Inserisci il nome');
    if (!surname.trim()) return Alert.alert('Errore', 'Inserisci il cognome');
    if (!nickname.trim()) return Alert.alert('Errore', 'Inserisci il nickname');
    if (!isValidDate(dob)) return Alert.alert('Errore', 'Data di nascita non valida (formato: AAAA-MM-GG)');
    if (!role) return Alert.alert('Errore', 'Seleziona un ruolo');

    setSaving(true);
    try {
      const updated = await updatePlayer(id, {
        name: name.trim(),
        surname: surname.trim(),
        nickname: nickname.trim(),
        date_of_birth: dob,
        role,
        strength,
      });
      setPlayer(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile salvare');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id || !player) return;
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
              await deletePlayer(id);
              router.back();
            } catch (e) {
              Alert.alert('Errore', 'Impossibile eliminare');
            }
          },
        },
      ]
    );
  };

  const cancelEdit = () => {
    if (player) {
      setName(player.name);
      setSurname(player.surname);
      setNickname(player.nickname);
      setDob(player.date_of_birth);
      setRole(player.role);
      setStrength(player.strength);
    }
    setEditing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!player) return null;

  const getInitials = (nick: string) => nick.substring(0, 2).toUpperCase();

  // View Mode
  if (!editing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity testID="close-detail-btn" onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity testID="edit-player-btn" onPress={() => setEditing(true)} style={styles.iconBtn}>
                <Ionicons name="pencil" size={22} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity testID="delete-player-btn" onPress={handleDelete} style={styles.iconBtn}>
                <Ionicons name="trash" size={22} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Player Card */}
          <View style={styles.profileSection}>
            <View style={[styles.bigAvatar, { backgroundColor: ROLE_COLORS[player.role] + '20' }]}>
              <Text style={[styles.bigAvatarText, { color: ROLE_COLORS[player.role] }]}>
                {getInitials(player.nickname)}
              </Text>
            </View>
            <Text style={styles.profileNickname}>{player.nickname}</Text>
            <Text style={styles.profileName}>{player.name} {player.surname}</Text>
            <View style={[styles.rolePill, { backgroundColor: ROLE_COLORS[player.role] }]}>
              <Text style={styles.rolePillText}>{player.role}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{player.strength}</Text>
              <Text style={styles.statLabel}>Forza</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{player.age}</Text>
              <Text style={styles.statLabel}>Anni</Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Nome</Text>
              <Text style={styles.detailValue}>{player.name}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cognome</Text>
              <Text style={styles.detailValue}>{player.surname}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Nickname</Text>
              <Text style={styles.detailValue}>{player.nickname}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Data di Nascita</Text>
              <Text style={styles.detailValue}>{player.date_of_birth}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ruolo</Text>
              <Text style={[styles.detailValue, { color: ROLE_COLORS[player.role] }]}>{player.role}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Forza</Text>
              <Text style={[styles.detailValue, { fontWeight: '900' }]}>
                {Number.isInteger(player.strength) ? player.strength : player.strength.toFixed(1)}/10
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Edit Mode
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity testID="cancel-edit-btn" onPress={cancelEdit} style={styles.iconBtn}>
                <Text style={styles.cancelText}>Annulla</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Modifica</Text>
              <TouchableOpacity testID="save-edit-btn" onPress={handleSave} disabled={saving} style={styles.iconBtn}>
                {saving ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text style={styles.saveText}>Salva</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                testID="edit-input-name"
                style={styles.input}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cognome</Text>
              <TextInput
                testID="edit-input-surname"
                style={styles.input}
                value={surname}
                onChangeText={setSurname}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nickname</Text>
              <TextInput
                testID="edit-input-nickname"
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Data di Nascita</Text>
              <TextInput
                testID="edit-input-dob"
                style={styles.input}
                value={dob}
                onChangeText={formatDateInput}
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
                    testID={`edit-role-${r.toLowerCase()}`}
                    style={[
                      styles.roleOption,
                      role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] },
                    ]}
                    onPress={() => setRole(r)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.roleOptionText, role === r && { color: '#FFF' }]}>
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
                      testID={`edit-strength-${v}`}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
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
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  // Profile section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  bigAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bigAvatarText: {
    fontSize: 36,
    fontWeight: '900',
  },
  profileNickname: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 12,
  },
  rolePill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rolePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1C1C1E',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 4,
  },
  // Details
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 4,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  detailDivider: {
    height: 0.5,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 16,
  },
  // Edit form styles
  editContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
});
