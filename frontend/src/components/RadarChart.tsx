import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle, G, Text as SvgText } from 'react-native-svg';

interface RadarChartProps {
  stats: {
    goals: number;
    assists: number;
    cleanSheets: number;
    wins: number;
    matches: number;
    points: number;
  };
  isDarkMode: boolean;
}

const RadarChart: React.FC<RadarChartProps> = ({ stats, isDarkMode }) => {
  const size = 180;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size / 2) - 20;

  // Normalizzazione (stime basate su medie di gioco amatoriale)
  const matches = stats.matches || 1;
  const data = [
    { label: 'Attacco', value: Math.min(100, (stats.goals / matches) * 50) },        // 2 goal/partita = 100
    { label: 'Regia', value: Math.min(100, (stats.assists / matches) * 60) },        // 1.5 assist/partita = 100
    { label: 'Difesa', value: Math.min(100, (stats.cleanSheets / matches) * 150) },   // 0.6 CS/partita = 100
    { label: 'Punti', value: Math.min(100, (stats.points / matches) * 33) },         // 3 PT/partita = 100
    { label: 'Vittorie', value: Math.min(100, (stats.wins / matches) * 100) },      // 100% win = 100
  ];

  const angleStep = (Math.PI * 2) / data.length;

  const getCoordinates = (value: number, index: number, maxRadius: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * maxRadius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const points = data
    .map((d, i) => {
      const { x, y } = getCoordinates(d.value, i, radius);
      return `${x},${y}`;
    })
    .join(' ');

  const gridPoints = [25, 50, 75, 100].map(level => (
    <Polygon
      key={`grid-${level}`}
      points={data.map((_, i) => {
        const { x, y } = getCoordinates(level, i, radius);
        return `${x},${y}`;
      }).join(' ')}
      fill="none"
      stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
      strokeWidth="1"
    />
  ));

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <G>
          {/* Griglia di sfondo */}
          {gridPoints}

          {/* Assi */}
          {data.map((_, i) => {
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

          {/* Area dati */}
          <Polygon
            points={points}
            fill="rgba(0, 122, 255, 0.3)"
            stroke="#007AFF"
            strokeWidth="2"
          />

          {/* Etichette */}
          {data.map((d, i) => {
            const { x, y } = getCoordinates(115, i, radius);
            return (
              <SvgText
                key={`label-${i}`}
                x={x}
                y={y}
                fill={isDarkMode ? '#AAAAAA' : '#666666'}
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {d.label}
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
    marginVertical: 10,
  },
});

export default RadarChart;
