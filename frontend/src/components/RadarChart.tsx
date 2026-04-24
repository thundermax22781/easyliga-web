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
}

interface RadarChartProps {
  stats: PlayerStats;
  comparisonStats?: PlayerStats;
  isDarkMode: boolean;
  matchType: number;
}

const RadarChart: React.FC<RadarChartProps> = ({ stats, comparisonStats, isDarkMode, matchType }) => {
  const size = 320; // Aumentato per dare spazio totale alle scritte
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 80; // Dimensione del grafico interna

  const normalizeData = (s: PlayerStats) => {
    const matches = s.matches || 1;
    const defenseThreshold = matchType >= 11 ? 1 : 4;
    const defenseFactor = matchType >= 11 ? 50 : 25;

    return [
      { label: 'Attacco', value: Math.min(100, (s.goals / matches) * 50) },
      { label: 'Regia', value: Math.min(100, (s.assists / matches) * 60) },
      { label: 'Rendimento', value: Math.min(100, (s.points / matches) * 40) },
      { label: 'Incisività', value: Math.min(100, ((s.goals + s.assists) / matches) * 25) },
      { label: 'Difesa', value: Math.max(0, 100 - Math.max(0, (s.goalsConceded / matches) - defenseThreshold) * defenseFactor) },
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

          {data1.map((d, i) => {
            // Posizionamento scritte calibrato
            const { x, y } = getCoordinates(122, i, radius);

            let anchor = "middle";
            if (x < centerX - 30) anchor = "end";
            else if (x > centerX + 30) anchor = "start";

            // Spostamento verticale per Attacco e i due in basso
            let dy = 0;
            if (i === 0) dy = -5; // Attacco
            if (i === 2 || i === 3) dy = 10; // Rendimento e Incisività

            return (
              <SvgText
                key={`label-${i}`}
                x={x}
                y={y + dy}
                fill={isDarkMode ? '#CCCCCC' : '#333333'}
                fontSize="12"
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
