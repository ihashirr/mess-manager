import React from 'react';
import {
	Image,
	StyleProp,
	StyleSheet,
	View,
	ViewStyle,
} from 'react-native';
import Svg, {Defs, RadialGradient, Rect, Stop} from 'react-native-svg';

import {useAppTheme} from '../../context/ThemeModeContext';
import {FOOD_THEME} from '../../theme';

export type AtmosphereIntensity = 'none' | 'subtle' | 'medium' | 'strong' | number;

export interface AtmosphereBackgroundProps {
	children?: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	contentStyle?: StyleProp<ViewStyle>;
	backgroundColor?: string;
	intensity?: AtmosphereIntensity;
	saffronGlow?: boolean;
	spiceGrain?: boolean;
	desiPattern?: boolean;
	warmLighting?: boolean;
}

export interface WarmGlowProps {
	style?: StyleProp<ViewStyle>;
	intensity?: AtmosphereIntensity;
	topColor?: string;
	midColor?: string;
	bottomColor?: string;
	includeBottomGlow?: boolean;
}

export interface SpiceTextureOverlayProps {
	style?: StyleProp<ViewStyle>;
	intensity?: AtmosphereIntensity;
	spiceGrain?: boolean;
	desiPattern?: boolean;
	warmLighting?: boolean;
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
			return 0.54;
	}
};

const useAtmosphereIntensity = (intensity: AtmosphereIntensity = 'subtle') => {
	const {isDark} = useAppTheme();
	const resolvedIntensity = resolveIntensity(intensity);
	const modeFactor = isDark ? 0.45 : 1;
	return resolvedIntensity * modeFactor;
};

export const WarmGlow: React.FC<WarmGlowProps> = ({
	style,
	intensity = 'subtle',
	topColor = FOOD_THEME.colors.saffron,
	midColor = FOOD_THEME.colors.turmeric,
	bottomColor = FOOD_THEME.colors.saffronDeep,
	includeBottomGlow = true,
}) => {
	const layerIntensity = useAtmosphereIntensity(intensity);

	if (layerIntensity <= 0) {
		return null;
	}

	return (
		<Svg
			pointerEvents="none"
			style={[StyleSheet.absoluteFill, style]}
			width="100%"
			height="100%"
			preserveAspectRatio="none"
		>
			<Defs>
				<RadialGradient id="topSaffronGlow" cx="50%" cy="0%" r="82%">
					<Stop offset="0%" stopColor={topColor} stopOpacity={0.16 * layerIntensity} />
					<Stop offset="42%" stopColor={midColor} stopOpacity={0.05 * layerIntensity} />
					<Stop offset="100%" stopColor={topColor} stopOpacity={0} />
				</RadialGradient>
				<RadialGradient id="bottomWarmGlow" cx="96%" cy="100%" r="72%">
					<Stop offset="0%" stopColor={bottomColor} stopOpacity={0.08 * layerIntensity} />
					<Stop offset="100%" stopColor={bottomColor} stopOpacity={0} />
				</RadialGradient>
			</Defs>
			<Rect width="100%" height="100%" fill="url(#topSaffronGlow)" />
			{includeBottomGlow ? <Rect width="100%" height="100%" fill="url(#bottomWarmGlow)" /> : null}
		</Svg>
	);
};

export const SpiceTextureOverlay: React.FC<SpiceTextureOverlayProps> = ({
	style,
	intensity = 'subtle',
	spiceGrain = false,
	desiPattern = false,
	warmLighting = true,
}) => {
	const layerIntensity = useAtmosphereIntensity(intensity);

	if (layerIntensity <= 0) {
		return null;
	}

	const textureOpacity = FOOD_THEME.ambient.textureOpacity * layerIntensity;
	const patternOpacity = textureOpacity * 0.62;
	const warmLightOpacity = Math.min(
		0.18,
		FOOD_THEME.ambient.passivePanelOpacity * layerIntensity * 2.25
	);

	return (
		<View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
			{warmLighting ? (
				<Image
					accessible={false}
					source={FOOD_THEME.ambient.warmLight}
					resizeMode="cover"
					style={[styles.absoluteLayer, styles.warmLight, {opacity: warmLightOpacity}]}
				/>
			) : null}

			{desiPattern ? (
				<Image
					accessible={false}
					source={FOOD_THEME.textures.pattern}
					resizeMode="cover"
					style={[styles.absoluteLayer, {opacity: patternOpacity}]}
				/>
			) : null}

			{spiceGrain ? (
				<Image
					accessible={false}
					source={FOOD_THEME.textures.spice}
					resizeMode="cover"
					style={[styles.absoluteLayer, {opacity: textureOpacity}]}
				/>
			) : null}
		</View>
	);
};

export const AtmosphereBackground: React.FC<AtmosphereBackgroundProps> = ({
	children,
	style,
	contentStyle,
	backgroundColor,
	intensity = 'subtle',
	saffronGlow = true,
	spiceGrain = false,
	desiPattern = false,
	warmLighting = true,
}) => {
	const {colors} = useAppTheme();
	const canvasColor = backgroundColor ?? colors.bg;

	return (
		<View style={[styles.root, {backgroundColor: canvasColor}, style]}>
			{saffronGlow ? <WarmGlow intensity={intensity} /> : null}

			{warmLighting || desiPattern || spiceGrain ? (
				<SpiceTextureOverlay
					intensity={intensity}
					warmLighting={warmLighting}
					desiPattern={desiPattern}
					spiceGrain={spiceGrain}
				/>
			) : null}

			<View style={[styles.content, contentStyle]}>
				{children}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1,
		overflow: 'hidden',
	},
	absoluteLayer: {
		...StyleSheet.absoluteFillObject,
	},
	warmLight: {
		transform: [{scale: 1.08}],
	},
	content: {
		flex: 1,
		zIndex: 1,
	},
});
