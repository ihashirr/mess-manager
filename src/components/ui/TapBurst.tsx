import React, { forwardRef, useImperativeHandle, useState, useCallback } from 'react';
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

export interface TapBurstHandle {
  burst: () => void;
}

interface ParticleProps {
  color: string;
  angle: number;
  distance: number;
  delay: number;
  onComplete: () => void;
}

const Particle = ({ color, angle, distance, delay, onComplete }: ParticleProps) => {
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
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
};

interface TapBurstProps {
  count?: number;
  distance?: number;
  colors?: string[];
}

export const TapBurst = forwardRef<TapBurstHandle, TapBurstProps>(
  ({ count = 8, distance = 40, colors: customColors }, ref) => {
    const { colors } = useAppTheme();
    const [particles, setParticles] = useState<{ id: number; angle: number; color: string; delay: number }[]>([]);
    
    const palette = customColors || [
      FOOD_THEME.colors.saffron,
      FOOD_THEME.colors.turmeric,
      FOOD_THEME.colors.mint,
      colors.primary,
    ];

    const burst = useCallback(() => {
      const newParticles = Array.from({ length: count }).map((_, i) => ({
        id: Date.now() + i,
        angle: (i * (Math.PI * 2)) / count + (Math.random() * 0.5 - 0.25),
        color: palette[Math.floor(Math.random() * palette.length)],
        delay: Math.random() * 50,
      }));
      setParticles(newParticles);
    }, [count, palette]);

    useImperativeHandle(ref, () => ({
      burst,
    }), [burst]);

    const handleComplete = useCallback((id: number) => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, []);

    if (particles.length === 0) return null;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          {particles.map((p) => (
            <Particle
              key={p.id}
              color={p.color}
              angle={p.angle}
              distance={distance + Math.random() * 20}
              delay={p.delay}
              onComplete={() => handleComplete(p.id)}
            />
          ))}
        </View>
      </View>
    );
  }
);

TapBurst.displayName = 'TapBurst';

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    marginTop: -3,
  },
});
