import React, { useState } from 'react';
import { View, StyleSheet, Text, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import Svg, { Polygon, Line, Circle, G, Text as SvgText, TSpan, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

interface PlayerStats {
  goals: number;
  assists: number;
  cleanSheets: number;
  goalsConceded: number;
  wins: number;
  matches: number;
  points: number;
  personalBonus?: number;
  defenseBonus?: number;
  incisivity?: number; // Valore già calcolato (G+A)/P
  role?: string;
}

interface RadarChartProps {
  stats: PlayerStats;
  comparisonStats?: PlayerStats;
  isDarkMode: boolean;
  matchType: number;
  radarConfig?: Record<string, string[]>; // Configurazione Admin per ruolo
  maxStats?: {
    personalBonus: number;
    defenseBonus: number;
    incisivity: number;
    goals: number;
    assists: number;
    winRate?: number;
    minGoalsConcededPM?: number;
    cleanSheets?: number;
    totalGoals?: number;
    totalAssists?: number;
    points?: number;
    played?: number;
  };
}

const METRIC_DESCRIPTIONS: Record<string, { label: string; icon: string; desc: string; formula: string }> = {
  incisivity: {
    label: 'Incisività',
    icon: '⚡',
    desc: 'Valuta la capacità del giocatore di incidere direttamente sui gol della squadra. Si basa sulla somma dei gol e degli assist prodotti a partita.',
    formula: 'Formula: (Gol Fatti + Assist Fatti) / Partite Giocate',
  },
  mg: {
    label: 'Attacco (Media Gol)',
    icon: '⚽',
    desc: 'Indica la pericolosità offensiva e la frequenza di realizzazione del giocatore in partita.',
    formula: 'Formula: Gol Fatti / Partite Giocate',
  },
  ma: {
    label: 'Regia (Media Assist)',
    icon: '🎯',
    desc: 'Misura la visione di gioco e la capacità di servire passaggi vincenti ai compagni di squadra.',
    formula: 'Formula: Assist Fatti / Partite Giocate',
  },
  solidity: {
    label: 'Solidità Difensiva',
    icon: '🛡️',
    desc: 'Misura la tenuta difensiva della squadra quando il giocatore è in campo. Più la media dei gol subiti è bassa rispetto alla lega, più il punteggio è vicino a 100.',
    formula: 'Formula: Confronto relativo della Media Gol Subiti',
  },
  win_rate: {
    label: 'Percentuale Vittorie',
    icon: '🏆',
    desc: 'Indica la percentuale di partite vinte dal giocatore sul totale dei match disputati.',
    formula: 'Formula: (Partite Vinte / Partite Giocate) × 100',
  },
  personal_bonus: {
    label: 'Bonus Personale',
    icon: '🌟',
    desc: 'Premia le prestazioni individuali straordinarie, sbloccati quando si realizza una combo di Gol e Assist nella stessa partita.',
    formula: 'Formula: Conteggio totale dei Bonus Personali ottenuti',
  },
  defense_bonus: {
    label: 'Bonus Difesa',
    icon: '🧱',
    desc: 'Premia l’efficacia difensiva nelle partite in cui la propria squadra subisce pochissimi gol.',
    formula: 'Formula: Conteggio totale dei Bonus Difesa ottenuti',
  },
  clean_sheets: {
    label: 'Clean Sheet',
    icon: '🧼',
    desc: 'Indica il numero di partite concluse senza subire alcun gol da parte della propria squadra.',
    formula: 'Formula: Conteggio totale partite con 0 gol subiti',
  },
  goals: {
    label: 'Gol Totali',
    icon: '⚽',
    desc: 'Il numero complessivo di reti realizzate dal giocatore nel campionato.',
    formula: 'Formula: Somma totale dei Gol fatti',
  },
  assists: {
    label: 'Assist Totali',
    icon: '🎯',
    desc: 'Il numero complessivo di assist vincenti serviti dal giocatore.',
    formula: 'Formula: Somma totale degli Assist fatti',
  },
  points: {
    label: 'Punti Totali',
    icon: '📈',
    desc: 'I punti complessivi conquistati dal giocatore in classifica.',
    formula: 'Formula: Somma Punti Vittoria + Pareggi + Bonus',
  },
  played: {
    label: 'Presenze',
    icon: '📊',
    desc: 'Il numero totale di partite disputate dal giocatore.',
    formula: 'Formula: Totale partite giocate',
  },
  avg: {
    label: 'Rating Complessivo (AVG)',
    icon: '⭐',
    desc: 'È il punteggio medio da 0 a 100 calcolato sulle 5 metriche selezionate per il ruolo del giocatore.',
    formula: 'Formula: Media aritmetica delle 5 metriche dello Spider Chart',
  },
};

const RadarChart: React.FC<RadarChartProps> = ({ stats, comparisonStats, isDarkMode, matchType, radarConfig, maxStats }) => {
  const size = 260;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 65;

  const [selectedMetricInfo, setSelectedMetricInfo] = useState<{ label: string; icon: string; value1: number; value2?: number | null; desc: string; formula: string } | null>(null);

  const handleShowMetricInfo = (mId: string, val1: number, val2?: number | null) => {
    const info = METRIC_DESCRIPTIONS[mId] || {
      label: 'Statistica',
      icon: '📊',
      desc: 'Valore calcolato in base alle prestazioni del giocatore.',
      formula: 'Formula di normalizzazione su scala 0-100',
    };

    setSelectedMetricInfo({
      label: info.label,
      icon: info.icon,
      value1: val1,
      value2: val2,
      desc: info.desc,
      formula: info.formula,
    });
  };

  const getSingleMetricScoreAndLabel = (mId: string, s: PlayerStats) => {
    const matches = s.matches || 1;
    const goalsPerMatch = s.goals / matches;
    const assistsPerMatch = s.assists / matches;
    const goalsConcededPerMatch = s.goalsConceded / matches;
    const winRate = (s.wins / matches) * 100;

    switch (mId) {
      case 'incisivity': {
        const score = maxStats?.incisivity ? (s.incisivity || 0) / maxStats.incisivity * 100 : Math.min(100, (s.incisivity || 0) * 40);
        return { mId, label: 'Incisività', value: Math.min(100, Math.round(score)) };
      }
      case 'mg': {
        const score = maxStats?.goals ? goalsPerMatch / maxStats.goals * 100 : Math.min(100, goalsPerMatch * 50);
        return { mId, label: 'Attacco', value: Math.min(100, Math.round(score)) };
      }
      case 'ma': {
        const score = maxStats?.assists ? assistsPerMatch / maxStats.assists * 100 : Math.min(100, assistsPerMatch * 60);
        return { mId, label: 'Regia', value: Math.min(100, Math.round(score)) };
      }
      case 'solidity': {
        const bestGCPM = maxStats?.minGoalsConcededPM || 2.0;
        const score = goalsConcededPerMatch > 0 ? Math.min(100, (bestGCPM / goalsConcededPerMatch) * 100) : 100;
        return { mId, label: 'Solidità', value: Math.min(100, Math.round(score)) };
      }
      case 'win_rate': {
        const score = maxStats?.winRate ? winRate / maxStats.winRate * 100 : Math.min(100, winRate);
        return { mId, label: 'Vittorie', value: Math.min(100, Math.round(score)) };
      }
      case 'personal_bonus': {
        const score = maxStats?.personalBonus ? (s.personalBonus || 0) / maxStats.personalBonus * 100 : Math.min(100, (s.personalBonus || 0) * 15);
        return { mId, label: 'Bonus Personale', value: Math.min(100, Math.round(score)) };
      }
      case 'defense_bonus': {
        const score = maxStats?.defenseBonus ? (s.defenseBonus || 0) / maxStats.defenseBonus * 100 : Math.min(100, (s.defenseBonus || 0) * 15);
        return { mId, label: 'Bonus Difesa', value: Math.min(100, Math.round(score)) };
      }
      case 'clean_sheets': {
        const score = maxStats?.cleanSheets ? (s.cleanSheets || 0) / maxStats.cleanSheets * 100 : Math.min(100, (s.cleanSheets || 0) * 20);
        return { mId, label: 'Clean Sheet', value: Math.min(100, Math.round(score)) };
      }
      case 'goals': {
        const score = maxStats?.totalGoals ? (s.goals || 0) / maxStats.totalGoals * 100 : Math.min(100, (s.goals || 0) * 5);
        return { mId, label: 'Gol Totali', value: Math.min(100, Math.round(score)) };
      }
      case 'assists': {
        const score = maxStats?.totalAssists ? (s.assists || 0) / maxStats.totalAssists * 100 : Math.min(100, (s.assists || 0) * 5);
        return { mId, label: 'Assist Totali', value: Math.min(100, Math.round(score)) };
      }
      case 'points': {
        const score = maxStats?.points ? (s.points || 0) / maxStats.points * 100 : Math.min(100, (s.points || 0) * 3);
        return { mId, label: 'Punti Totali', value: Math.min(100, Math.round(score)) };
      }
      case 'played': {
        const score = maxStats?.played ? (s.matches || 0) / maxStats.played * 100 : Math.min(100, (s.matches || 0) * 5);
        return { mId, label: 'Presenze', value: Math.min(100, Math.round(score)) };
      }
      default:
        return { mId, label: 'Incisività', value: 50 };
    }
  };

  const normalizeData = (s: PlayerStats) => {
    const role = s.role || 'Attaccante';
    const configuredMetrics = radarConfig?.[role];

    let metricsToUse = configuredMetrics;
    if (!metricsToUse || !Array.isArray(metricsToUse) || metricsToUse.length !== 5) {
      if (role === 'Difensore') {
        metricsToUse = ['solidity', 'ma', 'defense_bonus', 'mg', 'win_rate'];
      } else if (role === 'Portiere') {
        metricsToUse = ['solidity', 'clean_sheets', 'defense_bonus', 'win_rate', 'ma'];
      } else {
        metricsToUse = ['incisivity', 'ma', 'personal_bonus', 'defense_bonus', 'mg'];
      }
    }

    return metricsToUse.map(mId => getSingleMetricScoreAndLabel(mId, s));
  };

  const data1 = normalizeData(stats);
  const data2 = comparisonStats ? normalizeData(comparisonStats) : null;

  const avg1 = Math.round(data1.reduce((acc, d) => acc + d.value, 0) / data1.length);
  const avg2 = data2 ? Math.round(data2.reduce((acc, d) => acc + d.value, 0) / data2.length) : null;

  const getScoreColor = (score: number) => {
    if (score >= 75) return '#34C759'; // Verde per prestazioni alte
    if (score >= 60) return '#FFCC00'; // Giallo/Oro per medie
    return '#FF3B30';                  // Rosso per inferiori
  };

  const angleStep = (Math.PI * 2) / data1.length;

  const getCoordinates = (value: number, index: number, maxRadius: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * maxRadius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const getPoints = (data: { value: number }[]) =>
    data.map((d, i) => {
      const { x, y } = getCoordinates(d.value, i, radius);
      return `${x},${y}`;
    }).join(' ');

  const points1 = getPoints(data1);
  const points2 = data2 ? getPoints(data2) : null;

  const gridLevels = [25, 50, 75, 100];
  const gridPolygons = gridLevels.map(level => (
    <Polygon
      key={`grid-${level}`}
      points={data1.map((_, i) => {
        const { x, y } = getCoordinates(level, i, radius);
        return `${x},${y}`;
      }).join(' ')}
      fill="none"
      stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
      strokeWidth="1"
    />
  ));

  // Posizioni calcolate e personalizzate per le etichette + punteggi dei 5 vertici
  const labelPositions = [
    { x: centerX, yLabel: 20, yScore: 32, anchor: 'middle' },        // 0: Incisività (Top)
    { x: 212, yLabel: 98, yScore: 111, anchor: 'start' },            // 1: Regia (Top Right)
    { x: 182, yLabel: 204, yScore: 217, anchor: 'start' },           // 2: Bonus Personale (Bottom Right)
    { x: 78, yLabel: 204, yScore: 217, anchor: 'end' },              // 3: Bonus Difesa (Bottom Left)
    { x: 48, yLabel: 98, yScore: 111, anchor: 'end' },               // 4: Attacco (Top Left)
  ];

  // Hit-Box giganti per garantire un tocco facile e immediato su Android, iOS e Web
  const touchRects = [
    { x: centerX - 60, y: 2, width: 120, height: 48 },               // 0: Top (Incisività / Solidità)
    { x: 155, y: 75, width: 100, height: 55 },                       // 1: Top Right (Regia)
    { x: 135, y: 185, width: 120, height: 60 },                      // 2: Bottom Right (Bonus Personale)
    { x: 5, y: 185, width: 120, height: 60 },                        // 3: Bottom Left (Bonus Difesa)
    { x: 5, y: 75, width: 100, height: 55 },                         // 4: Top Left (Attacco / Vittorie)
  ];

  return (
    <View style={[styles.container, { width: '100%', aspectRatio: 1 }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
        <G>
          {gridPolygons}

          {data1.map((_, i) => {
            const { x, y } = getCoordinates(100, i, radius);
            return (
              <Line
                key={`axis-${i}`}
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                strokeWidth="1"
              />
            );
          })}

          <Polygon
            points={points1}
            fill="rgba(0, 122, 255, 0.25)"
            stroke="#007AFF"
            strokeWidth="2"
          />

          {points2 && (
            <Polygon
              points={points2}
              fill="rgba(52, 199, 89, 0.25)"
              stroke="#34C759"
              strokeWidth="2"
            />
          )}

          {/* Pallini sui vertici */}
          {data1.map((d, i) => {
            const { x, y } = getCoordinates(d.value, i, radius);
            return <Circle key={`dot1-${i}`} cx={x} cy={y} r="3.5" fill="#007AFF" />;
          })}

          {data2 && data2.map((d, i) => {
            const { x, y } = getCoordinates(d.value, i, radius);
            return <Circle key={`dot2-${i}`} cx={x} cy={y} r="3.5" fill="#34C759" />;
          })}

          {/* Badge Centrale con Media Complessiva (Cliccabile con area di tocco grande) */}
          {data2 !== null && avg2 !== null ? (
            <G x={centerX} y={centerY} onPress={() => handleShowMetricInfo('avg', avg1, avg2)}>
              <Circle r="30" fill="rgba(0,0,0,0.001)" />
              <Rect
                x="-38"
                y="-18"
                width="76"
                height="36"
                rx="18"
                fill={isDarkMode ? '#1C1C1E' : '#FFFFFF'}
                stroke={isDarkMode ? '#3A3A3C' : '#E5E5EA'}
                strokeWidth="2"
              />
              <SvgText
                y="0"
                fontSize="13"
                fontWeight="900"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                <TSpan fill="#007AFF" x="-17">{avg1}</TSpan>
                <TSpan fill={isDarkMode ? '#555' : '#CCC'} x="0">|</TSpan>
                <TSpan fill="#34C759" x="17">{avg2}</TSpan>
              </SvgText>
            </G>
          ) : (
            <G x={centerX} y={centerY} onPress={() => handleShowMetricInfo('avg', avg1)}>
              <Circle r="30" fill="rgba(0,0,0,0.001)" />
              <Circle
                r="21"
                fill={isDarkMode ? '#1C1C1E' : '#FFFFFF'}
                stroke={getScoreColor(avg1)}
                strokeWidth="3"
              />
              <SvgText
                y="-2"
                fill={getScoreColor(avg1)}
                fontSize="14"
                fontWeight="900"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {avg1}
              </SvgText>
              <SvgText
                y="10"
                fill={isDarkMode ? '#AEAEB2' : '#8E8E93'}
                fontSize="6.5"
                fontWeight="900"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                AVG
              </SvgText>
            </G>
          )}

          {/* Etichette e Valori dei Vertici (Cliccabili con Hit-Box giganti) */}
          {data1.map((d, i) => {
            const pos = labelPositions[i];
            const tRect = touchRects[i];
            const val1 = Math.round(d.value);
            const val2 = data2 ? Math.round(data2[i].value) : null;
            const singleColor = getScoreColor(val1);

            return (
              <G key={`label-group-${i}`} onPress={() => handleShowMetricInfo(d.mId, val1, val2)}>
                {/* Area di tocco trasparente estesa per catturare qualsiasi tocco nell'area */}
                <Rect
                  x={tRect.x}
                  y={tRect.y}
                  width={tRect.width}
                  height={tRect.height}
                  fill="rgba(0,0,0,0.001)"
                />

                <SvgText
                  x={pos.x}
                  y={pos.yLabel}
                  fill={isDarkMode ? '#AEAEB2' : '#8E8E93'}
                  fontSize="9"
                  fontWeight="900"
                  textAnchor={pos.anchor as any}
                  alignmentBaseline="middle"
                >
                  {d.label.toUpperCase()}
                </SvgText>

                <SvgText
                  x={pos.x}
                  y={pos.yScore}
                  fontSize="11"
                  fontWeight="900"
                  textAnchor={pos.anchor as any}
                  alignmentBaseline="middle"
                >
                  {data2 !== null && val2 !== null ? (
                    <>
                      <TSpan fill="#007AFF">{val1}</TSpan>
                      <TSpan fill={isDarkMode ? '#555' : '#CCC'}> | </TSpan>
                      <TSpan fill="#34C759">{val2}</TSpan>
                    </>
                  ) : (
                    <TSpan fill={singleColor}>{val1}</TSpan>
                  )}
                </SvgText>
              </G>
            );
          })}
        </G>
      </Svg>

      {/* Modal Popup Info Statistica */}
      <Modal visible={!!selectedMetricInfo} transparent animationType="fade" onRequestClose={() => setSelectedMetricInfo(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <TouchableWithoutFeedback onPress={() => setSelectedMetricInfo(null)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={{ width: '100%', maxWidth: 360, backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF', borderRadius: 20, padding: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 24 }}>{selectedMetricInfo?.icon}</Text>
                <Text style={{ fontSize: 18, fontWeight: '900', color: isDarkMode ? '#FFFFFF' : '#1C1C1E' }}>{selectedMetricInfo?.label}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedMetricInfo(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#AEAEB2' : '#8E8E93'} />
              </TouchableOpacity>
            </View>

            {/* Score Badge */}
            <View style={{ backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7', padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 15, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#AEAEB2' : '#8E8E93' }}>Punteggio:</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: getScoreColor(selectedMetricInfo?.value1 || 0) }}>
                {selectedMetricInfo?.value1} / 100
              </Text>
              {selectedMetricInfo?.value2 !== undefined && selectedMetricInfo?.value2 !== null && (
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#34C759' }}>
                  vs {selectedMetricInfo.value2} / 100
                </Text>
              )}
            </View>

            <Text style={{ fontSize: 13, color: isDarkMode ? '#E5E5EA' : '#3A3A3C', lineHeight: 18, marginBottom: 12, fontWeight: '500' }}>
              {selectedMetricInfo?.desc}
            </Text>

            <View style={{ backgroundColor: isDarkMode ? 'rgba(0,122,255,0.15)' : '#007AFF10', padding: 10, borderRadius: 10, marginBottom: 18 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#007AFF', fontStyle: 'italic' }}>
                {selectedMetricInfo?.formula}
              </Text>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: '#007AFF', borderRadius: 12, height: 44, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setSelectedMetricInfo(null)}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RadarChart;
