import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle, G, Text as SvgText } from 'react-native-svg';

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
  const size = 240;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 60;

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
            fill="rgba(0, 122, 255, 0.3)"
            stroke="#007AFF"
            strokeWidth="2"
          />

          {points2 && (
            <Polygon
              points={points2}
              fill="rgba(52, 199, 89, 0.3)"
              stroke="#34C759"
              strokeWidth="2"
            />
          )}

          {/* Pallini sui vertici */}
          {data1.map((d, i) => {
            const { x, y } = getCoordinates(d.value, i, radius);
            return <Circle key={`dot1-${i}`} cx={x} cy={y} r="3" fill="#007AFF" />;
          })}

          {data2 && data2.map((d, i) => {
            const { x, y } = getCoordinates(d.value, i, radius);
            return <Circle key={`dot2-${i}`} cx={x} cy={y} r="3" fill="#34C759" />;
          })}

          {data1.map((d, i) => {
            const { x, y } = getCoordinates(121, i, radius);

            let anchor = "middle";
            if (i === 1 || i === 2) anchor = "start";
            if (i === 3 || i === 4) anchor = "end";

            let finalX = x;
            let dy = 0;

            if (i === 0) dy = -10; // Vertice alto
            if (i === 2 || i === 3) dy = 15; // I due vertici bassi

            if (i === 2) finalX += 5;
            if (i === 3) finalX -= 5;

            return (
              <SvgText
                key={`label-${i}`}
                x={finalX}
                y={y + dy}
                fill={isDarkMode ? '#AEAEB2' : '#8E8E93'}
                fontSize="9"
                fontWeight="900"
                textAnchor={anchor}
                alignmentBaseline="middle"
              >
                {d.label.toUpperCase()}
              </SvgText>
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
