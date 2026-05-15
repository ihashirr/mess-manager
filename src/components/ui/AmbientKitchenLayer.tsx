import React, {useEffect} from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from 'react-native-reanimated';
import Svg, {Defs, RadialGradient, Rect, Stop} from 'react-native-svg';

import {useAppTheme} from '../../context/ThemeModeContext';
import {FOOD_THEME} from '../../theme';

type AmbientIntensity = 'none' | 'subtle' | 'medium' | 'strong' | number;
type MealEnergy = 'neutral' | 'lunch' | 'dinner' | 'ember' | 'calm';

export type KitchenGlowProps = {
	style?: StyleProp<ViewStyle>;
	intensity?: AmbientIntensity;
	energy?: MealEnergy;
	reactive?: boolean;
};

export type SteamTrailProps = {
	active?: boolean;
	tone?: string;
	width?: number;
	height?: number;
	wisps?: number;
	intensity?: AmbientIntensity;
	style?: StyleProp<ViewStyle>;
};

export type SpiceParticlesProps = {
	active?: boolean;
	tone?: string;
	intensity?: AmbientIntensity;
	count?: number;
	style?: StyleProp<ViewStyle>;
};

export type AmbientKitchenLayerProps = {
	active?: boolean;
	intensity?: AmbientIntensity;
	energy?: MealEnergy;
	includeSteam?: boolean;
	includeParticles?: boolean;
	includeGlow?: boolean;
	style?: StyleProp<ViewStyle>;
};

const SPICE_PARTICLES = [
	{left: '7%', top: '18%', size: 2, drift: 9, offset: 0.06, opacity: 0.46},
	{left: '18%', top: '72%', size: 1.5, drift: -7, offset: 0.22, opacity: 0.36},
	{left: '31%', top: '36%', size: 2.5, drift: 6, offset: 0.48, opacity: 0.32},
	{left: '47%', top: '15%', size: 1.5, drift: -8, offset: 0.72, opacity: 0.42},
	{left: '58%', top: '64%', size: 2, drift: 8, offset: 0.12, opacity: 0.34},
	{left: '71%', top: '31%', size: 1.5, drift: -5, offset: 0.62, opacity: 0.4},
	{left: '82%', top: '78%', size: 2.5, drift: 7, offset: 0.34, opacity: 0.3},
	{left: '91%', top: '22%', size: 1.5, drift: -6, offset: 0.86, opacity: 0.38},
] as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const resolveIntensity = (intensity: AmbientIntensity = 'subtle') => {
	if (typeof intensity === 'number') {
		return clamp01(intensity);
	}

	switch (intensity) {
		case 'none':
			return 0;
		case 'medium':
			return 0.68;
		case 'strong':
			return 0.88;
		case 'subtle':
		default:
			return 0.42;
	}
};

const withAlpha = (color: string, alphaHex: string) => {
	if (color.startsWith('#') && color.length === 7) {
		return `${color}${alphaHex}`;
	}
	return color;
};

const energyPalette: Record<MealEnergy, {primary: string; secondary: string; ambient: string}> = {
	neutral: {
		primary: FOOD_THEME.colors.saffron,
		secondary: FOOD_THEME.colors.turmeric,
		ambient: FOOD_THEME.colors.paper,
	},
	lunch: {
		primary: FOOD_THEME.mealColors.lunch,
		secondary: FOOD_THEME.colors.turmeric,
		ambient: FOOD_THEME.colors.cream,
	},
	dinner: {
		primary: FOOD_THEME.mealColors.dinner,
		secondary: '#4338CA',
		ambient: '#F4EEFF',
	},
	ember: {
		primary: FOOD_THEME.colors.saffronDeep,
		secondary: FOOD_THEME.colors.chili,
		ambient: '#FFF0DD',
	},
	calm: {
		primary: FOOD_THEME.colors.coriander,
		secondary: FOOD_THEME.colors.mint,
		ambient: FOOD_THEME.colors.paper,
	},
};

export const KitchenGlow: React.FC<KitchenGlowProps> = ({
	style,
	intensity = 'subtle',
	energy = 'neutral',
	reactive = true,
}) => {
	const {isDark} = useAppTheme();
	const drift = useSharedValue(0);
	const resolvedIntensity = resolveIntensity(intensity) * (isDark ? 0.72 : 1);
	const palette = energyPalette[energy];

	useEffect(() => {
		if (!reactive || resolvedIntensity <= 0) {
			drift.value = 0;
			return;
		}

		drift.value = withRepeat(
			withTiming(1, {
				duration: 17000,
				easing: Easing.inOut(Easing.sin),
			}),
			-1,
			true
		);
	}, [drift, reactive, resolvedIntensity]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: resolvedIntensity,
		transform: [
			{translateX: interpolate(drift.value, [0, 1], [-8, 8])},
			{translateY: interpolate(drift.value, [0, 1], [4, -6])},
			{scale: interpolate(drift.value, [0, 1], [1, 1.025])},
		],
	}));

	if (resolvedIntensity <= 0) {
		return null;
	}

	return (
		<Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle, style]}>
			<Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
				<Defs>
					<RadialGradient id="kitchenGlowTop" cx="42%" cy="0%" r="82%">
						<Stop offset="0%" stopColor={palette.primary} stopOpacity={isDark ? 0.18 : 0.14} />
						<Stop offset="44%" stopColor={palette.secondary} stopOpacity={isDark ? 0.07 : 0.045} />
						<Stop offset="100%" stopColor={palette.primary} stopOpacity={0} />
					</RadialGradient>
					<RadialGradient id="kitchenGlowSide" cx="104%" cy="56%" r="74%">
						<Stop offset="0%" stopColor={palette.primary} stopOpacity={isDark ? 0.12 : 0.08} />
						<Stop offset="100%" stopColor={palette.primary} stopOpacity={0} />
					</RadialGradient>
					<RadialGradient id="kitchenGlowFloor" cx="12%" cy="104%" r="64%">
						<Stop offset="0%" stopColor={palette.ambient} stopOpacity={isDark ? 0.05 : 0.16} />
						<Stop offset="100%" stopColor={palette.ambient} stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<Rect width="100%" height="100%" fill="url(#kitchenGlowTop)" />
				<Rect width="100%" height="100%" fill="url(#kitchenGlowSide)" />
				<Rect width="100%" height="100%" fill="url(#kitchenGlowFloor)" />
			</Svg>
		</Animated.View>
	);
};

export const SteamTrail: React.FC<SteamTrailProps> = ({
	active = true,
	tone = FOOD_THEME.colors.saffronDeep,
	width = 54,
	height = 34,
	wisps = 3,
	intensity = 'medium',
	style,
}) => {
	const resolvedIntensity = resolveIntensity(intensity);

	if (!active || resolvedIntensity <= 0) {
		return null;
	}

	return (
		<View pointerEvents="none" style={[styles.steamRoot, {width, height}, style]}>
			{Array.from({length: Math.max(1, Math.min(wisps, 5))}).map((_, index) => (
				<SteamWisp
					key={`steam-${index}`}
					index={index}
					count={wisps}
					tone={tone}
					intensity={resolvedIntensity}
					height={height}
				/>
			))}
		</View>
	);
};

const SteamWisp = ({
	index,
	count,
	tone,
	intensity,
	height,
}: {
	index: number;
	count: number;
	tone: string;
	intensity: number;
	height: number;
}) => {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withRepeat(
			withTiming(1, {
				duration: 2600 + index * 320,
				easing: Easing.out(Easing.quad),
			}),
			-1,
			false
		);
	}, [index, progress]);

	const animatedStyle = useAnimatedStyle(() => {
		const phase = (progress.value + index / Math.max(count, 1)) % 1;
		return {
			opacity: interpolate(phase, [0, 0.18, 0.68, 1], [0, 0.26 * intensity, 0.12 * intensity, 0]),
			transform: [
				{translateX: interpolate(phase, [0, 0.5, 1], [-2, 3, -1])},
				{translateY: interpolate(phase, [0, 1], [height * 0.24, -height * 0.46])},
				{scaleY: interpolate(phase, [0, 0.7, 1], [0.74, 1.16, 0.9])},
				{scaleX: interpolate(phase, [0, 1], [0.8, 1.1])},
			],
		};
	});

	const left = `${24 + index * (52 / Math.max(count - 1, 1))}%`;

	return (
		<Animated.View
			style={[
				styles.steamWisp,
				{
					left,
					height: Math.max(12, height * 0.48),
					backgroundColor: tone,
				},
				animatedStyle,
			]}
		/>
	);
};

export const SpiceParticles: React.FC<SpiceParticlesProps> = ({
	active = true,
	tone = FOOD_THEME.colors.turmeric,
	intensity = 'subtle',
	count = 8,
	style,
}) => {
	const resolvedIntensity = resolveIntensity(intensity);
	const visibleParticles = SPICE_PARTICLES.slice(0, Math.max(0, Math.min(count, SPICE_PARTICLES.length)));

	if (!active || resolvedIntensity <= 0 || visibleParticles.length === 0) {
		return null;
	}

	return (
		<View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
			{visibleParticles.map((particle, index) => (
				<SpiceParticle
					key={`spice-${particle.left}-${particle.top}`}
					index={index}
					particle={particle}
					tone={tone}
					intensity={resolvedIntensity}
				/>
			))}
		</View>
	);
};

const SpiceParticle = ({
	index,
	particle,
	tone,
	intensity,
}: {
	index: number;
	particle: (typeof SPICE_PARTICLES)[number];
	tone: string;
	intensity: number;
}) => {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withRepeat(
			withTiming(1, {
				duration: 9500 + index * 760,
				easing: Easing.inOut(Easing.sin),
			}),
			-1,
			false
		);
	}, [index, progress]);

	const animatedStyle = useAnimatedStyle(() => {
		const phase = (progress.value + particle.offset) % 1;
		return {
			opacity: interpolate(phase, [0, 0.18, 0.74, 1], [0, particle.opacity * intensity, particle.opacity * 0.42 * intensity, 0]),
			transform: [
				{translateX: interpolate(phase, [0, 0.5, 1], [0, particle.drift, particle.drift * 0.42])},
				{translateY: interpolate(phase, [0, 1], [6, -18])},
				{scale: interpolate(phase, [0, 0.58, 1], [0.78, 1.08, 0.86])},
			],
		};
	});

	return (
		<Animated.View
			style={[
				styles.spiceParticle,
				{
					left: particle.left,
					top: particle.top,
					width: particle.size,
					height: particle.size,
					borderRadius: particle.size / 2,
					backgroundColor: tone,
				},
				animatedStyle,
			]}
		/>
	);
};

export const AmbientKitchenLayer: React.FC<AmbientKitchenLayerProps> = ({
	active = true,
	intensity = 'subtle',
	energy = 'neutral',
	includeSteam = true,
	includeParticles = true,
	includeGlow = true,
	style,
}) => {
	const palette = energyPalette[energy];

	if (!active || resolveIntensity(intensity) <= 0) {
		return null;
	}

	return (
		<View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ambientRoot, style]}>
			{includeGlow ? <KitchenGlow intensity={intensity} energy={energy} /> : null}
			{includeSteam ? (
				<>
					<SteamTrail
						tone={withAlpha(palette.primary, '88')}
						intensity={intensity}
						style={styles.globalSteamTop}
						width={74}
						height={46}
						wisps={4}
					/>
					<SteamTrail
						tone={withAlpha(palette.secondary, '66')}
						intensity="subtle"
						style={styles.globalSteamBottom}
						width={58}
						height={40}
						wisps={3}
					/>
				</>
			) : null}
			{includeParticles ? (
				<SpiceParticles
					tone={energy === 'dinner' ? withAlpha('#C4B5FD', 'AA') : withAlpha(FOOD_THEME.colors.turmeric, 'AA')}
					intensity={intensity}
					count={energy === 'calm' ? 4 : 8}
				/>
			) : null}
		</View>
	);
};

const styles = StyleSheet.create({
	ambientRoot: {
		overflow: 'hidden',
	},
	steamRoot: {
		position: 'relative',
		overflow: 'visible',
	},
	steamWisp: {
		position: 'absolute',
		bottom: 0,
		width: 2,
		borderRadius: 999,
	},
	spiceParticle: {
		position: 'absolute',
	},
	globalSteamTop: {
		position: 'absolute',
		top: '9%',
		right: '7%',
		opacity: 0.72,
	},
	globalSteamBottom: {
		position: 'absolute',
		left: '10%',
		bottom: '12%',
		opacity: 0.46,
	},
});
