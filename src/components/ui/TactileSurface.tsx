import React from 'react';
import {Image, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import Svg, {Defs, RadialGradient, Rect, Stop} from 'react-native-svg';

import {Theme} from '../../constants/Theme';
import {useAppTheme} from '../../context/ThemeModeContext';
import {FOOD_THEME} from '../../theme';

export type TactileMaterial = 'paper' | 'ceramic' | 'glass';

export type TactileSurfaceProps = {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	contentStyle?: StyleProp<ViewStyle>;
	radius?: number;
	tone?: string;
	active?: boolean;
	alert?: boolean;
	material?: TactileMaterial;
	grain?: boolean;
	disabledDepth?: boolean;
};

const withAlpha = (color: string, alphaHex: string) => {
	if (color.startsWith('#') && color.length === 7) {
		return `${color}${alphaHex}`;
	}
	return color;
};

export const TactileSurface: React.FC<TactileSurfaceProps> = ({
	children,
	style,
	contentStyle,
	radius = Theme.radius.lg,
	tone = FOOD_THEME.colors.saffronDeep,
	active = false,
	alert = false,
	material = 'paper',
	grain = true,
	disabledDepth = false,
}) => {
	const {colors, isDark} = useAppTheme();
	const surfaceColor = material === 'glass'
		? isDark ? 'rgba(25, 26, 31, 0.82)' : 'rgba(255, 255, 255, 0.76)'
		: material === 'ceramic'
			? isDark ? '#18191F' : '#FFFDF8'
			: isDark ? colors.surface : '#FFFDF8';
	const borderColor = alert
		? withAlpha(tone, isDark ? '5C' : '38')
		: active
			? withAlpha(tone, isDark ? '44' : '24')
			: isDark ? 'rgba(255, 255, 255, 0.085)' : 'rgba(42, 30, 19, 0.07)';
	const depthStyle = disabledDepth
		? null
		: isDark ? styles.darkDepth : styles.lightDepth;
	const grainOpacity = isDark ? 0.024 : 0.034;

	return (
		<View
			style={[
				styles.surface,
				{
					borderRadius: radius,
					borderColor,
					backgroundColor: surfaceColor,
					shadowColor: alert || active ? tone : '#201812',
				},
				depthStyle,
				style,
			]}
		>
			<SurfaceRadialHighlight tone={tone} active={active || alert} />
			<View
				pointerEvents="none"
				style={[
					styles.materialBase,
					{
						borderRadius: radius - 1,
						backgroundColor: material === 'glass'
							? isDark ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.38)'
							: material === 'ceramic'
								? isDark ? 'rgba(255,255,255,0.026)' : 'rgba(255,255,255,0.52)'
								: isDark ? 'rgba(255,255,255,0.018)' : 'rgba(255,250,242,0.48)',
					},
				]}
			/>
			<View
				pointerEvents="none"
				style={[
					styles.ceramicWash,
					{
						borderRadius: radius - 1,
						backgroundColor: isDark ? 'rgba(255,255,255,0.018)' : 'rgba(255, 245, 232, 0.38)',
					},
				]}
			/>
			{grain ? (
				<Image
					accessible={false}
					source={FOOD_THEME.textures.spice}
					resizeMode="cover"
					style={[styles.grain, {opacity: grainOpacity}]}
				/>
			) : null}
			<View
				pointerEvents="none"
				style={[
					styles.innerGlow,
					{
						borderRadius: radius - 2,
						borderColor: alert || active
							? withAlpha(tone, isDark ? '22' : '18')
							: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.46)',
					},
				]}
			/>
			<View pointerEvents="none" style={[styles.edgeLight, {borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.74)'}]} />
			<View pointerEvents="none" style={[styles.innerShade, {borderBottomColor: isDark ? 'rgba(0,0,0,0.26)' : 'rgba(92,64,51,0.06)'}]} />
			<View style={[styles.content, contentStyle]}>{children}</View>
		</View>
	);
};

const SurfaceRadialHighlight = ({
	tone,
	active,
}: {
	tone: string;
	active: boolean;
}) => (
	<Svg pointerEvents="none" width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
		<Defs>
			<RadialGradient id="surfaceHighlight" cx="90%" cy="0%" r="78%">
				<Stop offset="0%" stopColor={tone} stopOpacity={active ? 0.16 : 0.07} />
				<Stop offset="42%" stopColor={tone} stopOpacity={active ? 0.055 : 0.018} />
				<Stop offset="100%" stopColor={tone} stopOpacity={0} />
			</RadialGradient>
		</Defs>
		<Rect width="100%" height="100%" fill="url(#surfaceHighlight)" />
	</Svg>
);

const styles = StyleSheet.create({
	surface: {
		position: 'relative',
		overflow: 'hidden',
		borderWidth: 1,
	},
	content: {
		position: 'relative',
	},
	lightDepth: {
		shadowOpacity: 0.09,
		shadowRadius: 22,
		shadowOffset: {width: 0, height: 10},
		elevation: 4,
	},
	darkDepth: {
		shadowOpacity: 0.3,
		shadowRadius: 22,
		shadowOffset: {width: 0, height: 10},
		elevation: 5,
	},
	ceramicWash: {
		...StyleSheet.absoluteFillObject,
	},
	materialBase: {
		...StyleSheet.absoluteFillObject,
	},
	grain: {
		...StyleSheet.absoluteFillObject,
	},
	innerGlow: {
		...StyleSheet.absoluteFillObject,
		borderWidth: StyleSheet.hairlineWidth,
	},
	edgeLight: {
		position: 'absolute',
		top: 0,
		left: 1,
		right: 1,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	innerShade: {
		position: 'absolute',
		left: 1,
		right: 1,
		bottom: 0,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
});
