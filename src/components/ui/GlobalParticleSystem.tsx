import React, { useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useAppTheme } from '../../context/ThemeModeContext';
import { FOOD_THEME } from '../../theme';

interface ParticleProps {
  color: string;
  angle: number;
  distance: number;
  delay: number;
  startX: number;
  startY: number;
  onComplete: () => void;
}

const Particle = React.memo(({ color, angle, distance, delay, startX, startY, onComplete }: ParticleProps) => {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  React.useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
    opacity.value = withDelay(
      delay + 200,
      withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      })
    );
  }, [delay, progress, opacity, scale, onComplete]);

  const animatedStyle = useAnimatedStyle(() => {
    const travel = progress.value * distance;
    const tx = Math.cos(angle) * travel;
    const ty = Math.sin(angle) * travel;
    return {
      opacity: opacity.value,
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale: scale.value * (1 - progress.value * 0.5) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        { backgroundColor: color, left: startX, top: startY },
        animatedStyle,
      ]}
    />
  );
});

Particle.displayName = 'Particle';

interface BurstInstance {
  id: string;
  x: number;
  y: number;
  particles: { id: string; angle: number; color: string; delay: number }[];
}

export const GlobalParticleSystem: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useAppTheme();
  const [bursts, setBursts] = useState<BurstInstance[]>([]);

  // Memoize palette to look like turmeric/saffron powder
  const palette = React.useMemo(() => [
    FOOD_THEME.colors.turmeric,
    FOOD_THEME.colors.saffron,
    '#F5B041', // bright yellow/orange
    '#F8C471', // lighter yellow
    FOOD_THEME.colors.saffronDeep,
  ], []);

  const triggerBurst = useCallback((x: number, y: number) => {
    const count = 12; // More intense cloud
    const burstId = Date.now().toString() + Math.random().toString();
    const newParticles = Array.from({ length: count }).map((_, i) => ({
      id: burstId + '-' + i,
      angle: (i * (Math.PI * 2)) / count + (Math.random() * 1.5 - 0.75), // more chaotic spread
      color: palette[Math.floor(Math.random() * palette.length)],
      delay: Math.random() * 15,
    }));

    setBursts((prev) => [...prev, { id: burstId, x, y, particles: newParticles }]);
  }, [palette]);

  const handleParticleComplete = useCallback((burstId: string, particleId: string) => {
    setBursts((prev) => {
      let changed = false;
      const next = prev.map(burst => {
        if (burst.id === burstId) {
          const remaining = burst.particles.filter(p => p.id !== particleId);
          if (remaining.length !== burst.particles.length) changed = true;
          return { ...burst, particles: remaining };
        }
        return burst;
      }).filter(burst => burst.particles.length > 0);
      
      return changed ? next : prev;
    });
  }, []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View 
        style={styles.container} 
        onTouchStart={(e) => triggerBurst(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        pointerEvents="box-none"
      >
        {children}
      </View>
      
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {bursts.map((burst) =>
          burst.particles.map((p) => (
            <Particle
              key={p.id}
              color={p.color}
              angle={p.angle}
              distance={25 + Math.random() * 35} // wider, cloudier spread
              delay={p.delay}
              startX={burst.x}
              startY={burst.y}
              onComplete={() => handleParticleComplete(burst.id, p.id)}
            />
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginTop: -4,
    opacity: 0.85, // slightly translucent like powder
  },
});
