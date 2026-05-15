import React, {useEffect} from 'react';
import {StyleProp, StyleSheet, ViewStyle} from 'react-native';
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from 'react-native-reanimated';
import Svg, {Defs, Ellipse, G, LinearGradient, Line, Path, Rect, Stop} from 'react-native-svg';

import {useAppTheme} from '../../context/ThemeModeContext';
import {FOOD_THEME} from '../../theme';
import type {AtmosphereIntensity} from './AtmosphereBackground';

type CanvasEnergy = 'neutral' | 'calm' | 'ember' | 'lunch' | 'dinner';

interface AtmosphericCanvasProps {
	style?: StyleProp<ViewStyle>;
	intensity?: AtmosphereIntensity;
	energy?: CanvasEnergy;
}

const resolveIntensity = (intensity: AtmosphereIntensity = 'subtle') => {
	if (typeof intensity === 'number') {
		return Math.max(0, Math.min(1, intensity));
	}

	switch (intensity) {
		case 'none':
			return 0;
		case 'medium':
			return 0.78;
		case 'strong':
			return 1;
		case 'subtle':
		default:
			return 0.58;
	}
};

const paletteByEnergy: Record<CanvasEnergy, {
	primary: string;
	secondary: string;
	accent: string;
	paper: string;
}> = {
	neutral: {
		primary: FOOD_THEME.colors.saffron,
		secondary: FOOD_THEME.colors.turmeric,
		accent: FOOD_THEME.colors.saffronDeep,
		paper: '#FFF7EC',
	},
	calm: {
		primary: FOOD_THEME.colors.coriander,
		secondary: FOOD_THEME.colors.mint,
		accent: '#12A36D',
		paper: '#F2FBF4',
	},
	ember: {
		primary: FOOD_THEME.colors.saffronDeep,
		secondary: FOOD_THEME.colors.chili,
		accent: '#F39C12',
		paper: '#FFF2E6',
	},
	lunch: {
		primary: FOOD_THEME.mealColors.lunch,
		secondary: FOOD_THEME.colors.turmeric,
		accent: FOOD_THEME.colors.saffronDeep,
		paper: '#FFF7E8',
	},
	dinner: {
		primary: FOOD_THEME.mealColors.dinner,
		secondary: '#4338CA',
		accent: '#C4B5FD',
		paper: '#F7F1FF',
	},
};

export const AtmosphericCanvas: React.FC<AtmosphericCanvasProps> = ({
	style,
	intensity = 'subtle',
	energy = 'neutral',
}) => {
	const {isDark} = useAppTheme();
	const drift = useSharedValue(0);
	const breathe = useSharedValue(0);
	const resolved = resolveIntensity(intensity) * (isDark ? 0.62 : 1);
	const palette = paletteByEnergy[energy];

	useEffect(() => {
		if (resolved <= 0) {
			return;
		}

		drift.value = withRepeat(
			withTiming(1, {
				duration: 18000,
				easing: Easing.inOut(Easing.sin),
			}),
			-1,
			true
		);
		breathe.value = withRepeat(
			withTiming(1, {
				duration: 9200,
				easing: Easing.inOut(Easing.quad),
			}),
			-1,
			true
		);
	}, [breathe, drift, resolved]);

	const fieldMotion = useAnimatedStyle(() => ({
		opacity: interpolate(breathe.value, [0, 1], [0.74 * resolved, resolved]),
		transform: [
			{translateX: interpolate(drift.value, [0, 1], [-18, 18])},
			{translateY: interpolate(drift.value, [0, 1], [8, -10])},
			{scale: interpolate(breathe.value, [0, 1], [1, 1.035])},
		],
	}));

	const ringMotion = useAnimatedStyle(() => ({
		opacity: interpolate(breathe.value, [0, 1], [0.5 * resolved, 0.78 * resolved]),
		transform: [
			{translateX: interpolate(drift.value, [0, 1], [10, -12])},
			{translateY: interpolate(drift.value, [0, 1], [-6, 8])},
		],
	}));

	if (resolved <= 0) {
		return null;
	}

	return (
		<Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, style]}>
			<Animated.View style={[StyleSheet.absoluteFill, fieldMotion]}>
				<Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
					<Defs>
						<LinearGradient id="canvasTopWash" x1="0" y1="0" x2="1" y2="1">
							<Stop offset="0%" stopColor={palette.paper} stopOpacity={isDark ? 0.08 : 0.7} />
							<Stop offset="38%" stopColor={palette.primary} stopOpacity={isDark ? 0.06 : 0.16} />
							<Stop offset="100%" stopColor={palette.secondary} stopOpacity={0} />
						</LinearGradient>
						<LinearGradient id="canvasSideHeat" x1="1" y1="0" x2="0" y2="1">
							<Stop offset="0%" stopColor={palette.primary} stopOpacity={isDark ? 0.1 : 0.18} />
							<Stop offset="48%" stopColor={palette.accent} stopOpacity={isDark ? 0.045 : 0.07} />
							<Stop offset="100%" stopColor={palette.primary} stopOpacity={0} />
						</LinearGradient>
						<LinearGradient id="canvasFloor" x1="0" y1="1" x2="1" y2="0">
							<Stop offset="0%" stopColor={palette.secondary} stopOpacity={isDark ? 0.05 : 0.12} />
							<Stop offset="100%" stopColor={palette.secondary} stopOpacity={0} />
						</LinearGradient>
					</Defs>
					<Rect width="100%" height="100%" fill="url(#canvasTopWash)" />
					<Path d="M 1300 0 C 1040 230 1070 560 1920 720 L 1920 0 Z" fill="url(#canvasSideHeat)" />
					<Path d="M 0 890 C 430 760 750 940 1170 1080 L 0 1080 Z" fill="url(#canvasFloor)" />
				</Svg>
			</Animated.View>

			<Animated.View style={[StyleSheet.absoluteFill, ringMotion]}>
				<Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
					<G opacity={isDark ? 0.34 : 0.46}>
						<Ellipse cx="1660" cy="170" rx="285" ry="92" stroke={palette.primary} strokeWidth="2" fill="none" />
						<Ellipse cx="1660" cy="170" rx="214" ry="67" stroke={palette.secondary} strokeWidth="1.3" fill="none" />
						<Ellipse cx="1660" cy="170" rx="142" ry="43" stroke={palette.accent} strokeWidth="1" fill="none" />
						<Ellipse cx="230" cy="930" rx="320" ry="94" stroke={palette.secondary} strokeWidth="1.5" fill="none" />
						<Ellipse cx="230" cy="930" rx="220" ry="62" stroke={palette.primary} strokeWidth="1" fill="none" />
					</G>
					<G opacity={isDark ? 0.16 : 0.22}>
						{Array.from({length: 8}).map((_, index) => (
							<Line
								key={`ledger-v-${index}`}
								x1={180 + index * 230}
								x2={180 + index * 230}
								y1="0"
								y2="1080"
								stroke={palette.primary}
								strokeWidth="0.7"
							/>
						))}
						{Array.from({length: 6}).map((_, index) => (
							<Line
								key={`ledger-h-${index}`}
								x1="0"
								x2="1920"
								y1={180 + index * 150}
								y2={180 + index * 150}
								stroke={palette.secondary}
								strokeWidth="0.6"
							/>
						))}
					</G>
				</Svg>
			</Animated.View>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	root: {
		overflow: 'hidden',
	},
});

