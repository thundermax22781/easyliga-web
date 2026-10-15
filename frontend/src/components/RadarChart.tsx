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
}

interface RadarChartProps {
  stats: PlayerStats;
  comparisonStats?: PlayerStats;
  isDarkMode: boolean;
  matchType: number;
  maxStats?: {
    personalBonus: number;
    defenseBonus: number;
    incisivity: number;
    goals: number;
    assists: number;
  };
}

const RadarChart: React.FC<RadarChartProps> = ({ stats, comparisonStats, isDarkMode, matchType, maxStats }) => {
  const size = 260;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 65;

  const normalizeData = (s: PlayerStats) => {
    const matches = s.matches || 1;

    // Per i bonus usiamo la normalizzazione relativa se maxStats è fornito, altrimenti fallback
    const pBonusScore = maxStats?.personalBonus
      ? (s.personalBonus || 0) / maxStats.personalBonus * 100
      : Math.min(100, (s.personalBonus || 0) * 15);

    const dBonusScore = maxStats?.defenseBonus
      ? (s.defenseBonus || 0) / maxStats.defenseBonus * 100
      : Math.min(100, (s.defenseBonus || 0) * 15);

    // Per Incisività, Attacco e Regia usiamo pure la normalizzazione relativa se disponibile
    const incisivityScore = maxStats?.incisivity
      ? (s.incisivity || 0) / maxStats.incisivity * 100
      : Math.min(100, (s.incisivity || 0) * 40);

    const attackScore = maxStats?.goals
      ? (s.goals / matches) / (maxStats.goals / matches || 1) * 100
      : Math.min(100, (s.goals / matches) * 50);

    const playmakingScore = maxStats?.assists
      ? (s.assists / matches) / (maxStats.assists / matches || 1) * 100
      : Math.min(100, (s.assists / matches) * 60);

    return [
      { label: 'Incisività', value: Math.min(100, incisivityScore) },
      { label: 'Regia', value: Math.min(100, playmakingScore) },
      { label: 'Bonus Personale', value: Math.min(100, pBonusScore) },
      { label: 'Bonus Difesa', value: Math.min(100, dBonusScore) },
      { label: 'Attacco', value: Math.min(100, attackScore) },
    ];
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
                    <TSpan fill={singleColor}>({val1})</TSpan>
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
