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

import {FOOD_THEME} from '../../theme';

export type OperationalPulseProps = {
	active?: boolean;
	tone?: string;
	size?: number;
	calm?: boolean;
	style?: StyleProp<ViewStyle>;
	children?: React.ReactNode;
};

const withAlpha = (color: string, alphaHex: string) => {
	if (color.startsWith('#') && color.length === 7) {
		return `${color}${alphaHex}`;
	}
	return color;
};

export const OperationalPulse: React.FC<OperationalPulseProps> = ({
	active = true,
	tone = FOOD_THEME.colors.saffronDeep,
	size = 28,
	calm = false,
	style,
	children,
}) => {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = active
			? withRepeat(
				withTiming(1, {
					duration: calm ? 3200 : 2100,
					easing: Easing.inOut(Easing.sin),
				}),
				-1,
				true
			)
			: withTiming(0, {duration: 240});
	}, [active, calm, progress]);

	const haloStyle = useAnimatedStyle(() => ({
		opacity: interpolate(progress.value, [0, 0.55, 1], [active ? 0.16 : 0, calm ? 0.08 : 0.2, 0.05]),
		transform: [{scale: interpolate(progress.value, [0, 1], [0.92, calm ? 1.18 : 1.34])}],
	}));

	const coreStyle = useAnimatedStyle(() => ({
		opacity: interpolate(progress.value, [0, 1], [0.86, 1]),
		transform: [{scale: interpolate(progress.value, [0, 1], [1, active ? 1.035 : 1])}],
	}));

	return (
		<View style={[styles.root, {width: size, height: size}, style]}>
			<Animated.View
				pointerEvents="none"
				style={[
					styles.halo,
					{
						borderRadius: size / 2,
						backgroundColor: tone,
					},
					haloStyle,
				]}
			/>
			<Animated.View
				style={[
					styles.core,
					{
						width: size,
						height: size,
						borderRadius: size / 2,
						backgroundColor: withAlpha(tone, '18'),
						borderColor: withAlpha(tone, '34'),
					},
					coreStyle,
				]}
			>
				{children ?? <View style={[styles.dot, {backgroundColor: tone}]} />}
			</Animated.View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		alignItems: 'center',
		justifyContent: 'center',
	},
	halo: {
		...StyleSheet.absoluteFillObject,
	},
	core: {
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
	},
	dot: {
		width: 7,
		height: 7,
		borderRadius: 99,
	},
});
