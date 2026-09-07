import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle, G, Text as SvgText } from 'react-native-svg';

export interface DataPoint {
  label: string;
  value: number; // 0-100 (già normalizzato)
}

interface RadarChartProps {
  data: DataPoint[];
  comparisonData?: DataPoint[] | null;
  isDarkMode: boolean;
  onLabelPress?: (index: number) => void;
}

const RadarChart: React.FC<RadarChartProps> = ({ data, comparisonData, isDarkMode, onLabelPress }) => {
  const size = 260;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 75;

  if (!data || data.length === 0) return null;

  const angleStep = (Math.PI * 2) / data.length;

  const getCoordinates = (value: number, index: number, maxRadius: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (Math.max(5, value) / 100) * maxRadius; // Minimo 5% per visibilità
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const getPoints = (dSet: DataPoint[]) =>
    dSet.map((d, i) => {
      const { x, y } = getCoordinates(d.value, i, radius);
      return `${x},${y}`;
    }).join(' ');

  const points1 = getPoints(data);
  const points2 = comparisonData ? getPoints(comparisonData) : null;

  const gridLevels = [25, 50, 75, 100];
  const gridPolygons = gridLevels.map(level => (
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
    <View style={[styles.container, { width: '100%', aspectRatio: 1 }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
        <G>
          {gridPolygons}

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
          {data.map((d, i) => {
            const { x, y } = getCoordinates(d.value, i, radius);
            return <Circle key={`dot1-${i}`} cx={x} cy={y} r="3.5" fill="#007AFF" />;
          })}

          {comparisonData && comparisonData.map((d, i) => {
            const { x, y } = getCoordinates(d.value, i, radius);
            return <Circle key={`dot2-${i}`} cx={x} cy={y} r="3.5" fill="#34C759" />;
          })}

          {data.map((d, i) => {
            const { x, y } = getCoordinates(120, i, radius);

            let anchor = "middle";
            if (i > 0 && i < data.length / 2) anchor = "start";
            else if (i > data.length / 2) anchor = "end";

            let dy = 0;
            if (i === 0) dy = -12;
            if (i === Math.floor(data.length / 2) || i === Math.ceil(data.length / 2)) dy = 12;

            return (
              <SvgText
                key={`label-${i}`}
                x={x}
                y={y + dy}
                fill={isDarkMode ? '#007AFF' : '#007AFF'}
                fontSize="10"
                fontWeight="900"
                textAnchor={anchor as any}
                alignmentBaseline="middle"
                onPress={() => onLabelPress?.(i)}
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
