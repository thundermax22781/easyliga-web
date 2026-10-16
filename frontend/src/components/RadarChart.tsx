import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle, G, Text as SvgText, TSpan, Rect } from 'react-native-svg';

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

const RadarChart: React.FC<RadarChartProps> = ({ stats, comparisonStats, isDarkMode, matchType, radarConfig, maxStats }) => {
  const size = 260;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 65;

  const getSingleMetricScoreAndLabel = (mId: string, s: PlayerStats) => {
    const matches = s.matches || 1;
    const goalsPerMatch = s.goals / matches;
    const assistsPerMatch = s.assists / matches;
    const goalsConcededPerMatch = s.goalsConceded / matches;
    const winRate = (s.wins / matches) * 100;

    switch (mId) {
      case 'incisivity': {
        const score = maxStats?.incisivity ? (s.incisivity || 0) / maxStats.incisivity * 100 : Math.min(100, (s.incisivity || 0) * 40);
        return { label: 'Incisività', value: Math.min(100, Math.round(score)) };
      }
      case 'mg': {
        const score = maxStats?.goals ? goalsPerMatch / maxStats.goals * 100 : Math.min(100, goalsPerMatch * 50);
        return { label: 'Attacco', value: Math.min(100, Math.round(score)) };
      }
      case 'ma': {
        const score = maxStats?.assists ? assistsPerMatch / maxStats.assists * 100 : Math.min(100, assistsPerMatch * 60);
        return { label: 'Regia', value: Math.min(100, Math.round(score)) };
      }
      case 'solidity': {
        const bestGCPM = maxStats?.minGoalsConcededPM || 2.0;
        const score = goalsConcededPerMatch > 0 ? Math.min(100, (bestGCPM / goalsConcededPerMatch) * 100) : 100;
        return { label: 'Solidità', value: Math.min(100, Math.round(score)) };
      }
      case 'win_rate': {
        const score = maxStats?.winRate ? winRate / maxStats.winRate * 100 : Math.min(100, winRate);
        return { label: 'Vittorie', value: Math.min(100, Math.round(score)) };
      }
      case 'personal_bonus': {
        const score = maxStats?.personalBonus ? (s.personalBonus || 0) / maxStats.personalBonus * 100 : Math.min(100, (s.personalBonus || 0) * 15);
        return { label: 'Bonus Personale', value: Math.min(100, Math.round(score)) };
      }
      case 'defense_bonus': {
        const score = maxStats?.defenseBonus ? (s.defenseBonus || 0) / maxStats.defenseBonus * 100 : Math.min(100, (s.defenseBonus || 0) * 15);
        return { label: 'Bonus Difesa', value: Math.min(100, Math.round(score)) };
      }
      case 'clean_sheets': {
        const score = maxStats?.cleanSheets ? (s.cleanSheets || 0) / maxStats.cleanSheets * 100 : Math.min(100, (s.cleanSheets || 0) * 20);
        return { label: 'Clean Sheet', value: Math.min(100, Math.round(score)) };
      }
      case 'goals': {
        const score = maxStats?.totalGoals ? (s.goals || 0) / maxStats.totalGoals * 100 : Math.min(100, (s.goals || 0) * 5);
        return { label: 'Gol Totali', value: Math.min(100, Math.round(score)) };
      }
      case 'assists': {
        const score = maxStats?.totalAssists ? (s.assists || 0) / maxStats.totalAssists * 100 : Math.min(100, (s.assists || 0) * 5);
        return { label: 'Assist Totali', value: Math.min(100, Math.round(score)) };
      }
      case 'points': {
        const score = maxStats?.points ? (s.points || 0) / maxStats.points * 100 : Math.min(100, (s.points || 0) * 3);
        return { label: 'Punti Totali', value: Math.min(100, Math.round(score)) };
      }
      case 'played': {
        const score = maxStats?.played ? (s.matches || 0) / maxStats.played * 100 : Math.min(100, (s.matches || 0) * 5);
        return { label: 'Presenze', value: Math.min(100, Math.round(score)) };
      }
      default:
        return { label: 'Incisività', value: 50 };
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

          {/* Badge Centrale con Media Complessiva */}
          {data2 !== null && avg2 !== null ? (
            <G x={centerX} y={centerY}>
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
            <G x={centerX} y={centerY}>
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

          {/* Etichette e Valori dei Vertici */}
          {data1.map((d, i) => {
            const pos = labelPositions[i];
            const val1 = Math.round(d.value);
            const val2 = data2 ? Math.round(data2[i].value) : null;
            const singleColor = getScoreColor(val1);

            return (
              <G key={`label-group-${i}`}>
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
