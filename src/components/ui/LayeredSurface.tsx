import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Shadow } from 'react-native-shadow-2';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';

type LayeredSurfaceProps = {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	contentStyle?: StyleProp<ViewStyle>;
	radius?: number;
	borderColor?: string;
	surfaceColor?: string;
	tintColor?: string;
	shadowColor?: string;
	distance?: number;
	disabled?: boolean;
};

export function LayeredSurface({
	children,
	style,
	contentStyle,
	radius = Theme.radius.xl,
	borderColor,
	surfaceColor,
	tintColor,
	shadowColor,
	distance = 16,
	disabled = false,
}: LayeredSurfaceProps) {
	const { colors, isDark } = useAppTheme();
	const resolvedSurface = surfaceColor ?? (isDark ? colors.surface : 'rgba(255, 255, 255, 0.78)');
	const resolvedTint = tintColor ?? (isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(255, 107, 53, 0.045)');
	const resolvedBorder = borderColor ?? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(42, 30, 19, 0.07)');
	const resolvedShadow = shadowColor ?? (isDark ? 'rgba(0, 0, 0, 0.34)' : 'rgba(32, 24, 18, 0.14)');

	return (
		<Shadow
			stretch
			disabled={disabled}
			distance={distance}
			startColor={resolvedShadow}
			endColor="rgba(0, 0, 0, 0)"
			offset={[0, isDark ? 4 : 8]}
			style={{ borderRadius: radius }}
			containerStyle={style}
		>
			<View
				style={[
					styles.surface,
					{
						borderRadius: radius,
						borderColor: resolvedBorder,
						backgroundColor: resolvedSurface,
					},
					contentStyle,
				]}
			>
				<View pointerEvents="none" style={[styles.tint, { backgroundColor: resolvedTint, borderRadius: radius - 1 }]} />
				<View pointerEvents="none" style={[styles.edgeLight, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.76)' }]} />
				{children}
			</View>
		</Shadow>
	);
}

const styles = StyleSheet.create({
	surface: {
		position: 'relative',
		overflow: 'hidden',
		borderWidth: StyleSheet.hairlineWidth,
	},
	tint: {
		...StyleSheet.absoluteFillObject,
	},
	edgeLight: {
		position: 'absolute',
		top: 0,
		left: 1,
		right: 1,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
});
