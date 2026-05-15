import React, {useEffect} from 'react';
import {
	GestureResponderEvent,
	Platform,
	Pressable,
	StyleProp,
	ViewStyle,
} from 'react-native';
import Animated, {
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSpring,
	withTiming,
} from 'react-native-reanimated';

import {FOOD_THEME} from '../../theme';
import {TactileMaterial, TactileSurface} from './TactileSurface';

export type MotionCardProps = {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	contentStyle?: StyleProp<ViewStyle>;
	onPress?: (event: GestureResponderEvent) => void;
	radius?: number;
	tone?: string;
	active?: boolean;
	alert?: boolean;
	material?: TactileMaterial;
	grain?: boolean;
	disabled?: boolean;
	accessibilityLabel?: string;
};

export const MotionCard: React.FC<MotionCardProps> = ({
	children,
	style,
	contentStyle,
	onPress,
	radius,
	tone = FOOD_THEME.colors.saffronDeep,
	active = false,
	alert = false,
	material = 'paper',
	grain = true,
	disabled = false,
	accessibilityLabel,
}) => {
	const press = useSharedValue(0);
	const hover = useSharedValue(0);
	const breath = useSharedValue(0);

	useEffect(() => {
		breath.value = active
			? withRepeat(withTiming(1, {duration: 3600}), -1, true)
			: withTiming(0, {duration: 260});
	}, [active, breath]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: disabled ? 0.56 : 1,
		transform: [
			{scale: interpolate(press.value, [0, 1], [1 + breath.value * 0.003, 0.985])},
			{translateY: interpolate(press.value, [0, 1], [0, 1])},
		],
	}));

	const glowStyle = useAnimatedStyle(() => ({
		opacity: interpolate(Math.max(press.value, hover.value), [0, 1], [0, 0.12]),
	}));

	const handlePressIn = () => {
		if (disabled) return;
		press.value = withSpring(1, {damping: 18, stiffness: 320, mass: 0.7});
	};

	const handlePressOut = () => {
		press.value = withSpring(0, {damping: 18, stiffness: 260, mass: 0.8});
	};

	const handleHoverIn = () => {
		if (disabled || Platform.OS !== 'web') return;
		hover.value = withTiming(1, {duration: 160});
	};

	const handleHoverOut = () => {
		hover.value = withTiming(0, {duration: 180});
	};

	const surface = (
		<TactileSurface
			style={style}
			contentStyle={contentStyle}
			radius={radius}
			tone={tone}
			active={active}
			alert={alert}
			material={material}
			grain={grain}
		>
			<Animated.View
				pointerEvents="none"
				style={[
					{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: tone,
					},
					glowStyle,
				]}
			/>
			{children}
		</TactileSurface>
	);

	return (
		<Animated.View style={animatedStyle}>
			{onPress ? (
				<Pressable
					onPress={disabled ? undefined : onPress}
					onPressIn={handlePressIn}
					onPressOut={handlePressOut}
					onHoverIn={handleHoverIn}
					onHoverOut={handleHoverOut}
					accessibilityRole="button"
					accessibilityLabel={accessibilityLabel}
				>
					{surface}
				</Pressable>
			) : surface}
		</Animated.View>
	);
};
