import React, {useEffect} from 'react';
import {
	Image,
	ImageSourcePropType,
	StyleProp,
	StyleSheet,
	Text,
	View,
	ViewStyle,
} from 'react-native';
import Animated, {
	Easing,
	interpolate,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from 'react-native-reanimated';

import {FOOD_THEME, FoodIconKey} from '../../theme';

type SteamLoopProps = {
	color?: string;
	style?: StyleProp<ViewStyle>;
};

type FoodIconBadgeProps = {
	iconKey?: FoodIconKey;
	imageSource?: ImageSourcePropType;
	tone?: string;
	size?: number;
	showSteam?: boolean;
	style?: StyleProp<ViewStyle>;
};

type KitchenActivityPulseProps = {
	active?: boolean;
	label?: string;
	tone?: string;
	size?: number;
	style?: StyleProp<ViewStyle>;
};

type FoodEmptyStateArtProps = {
	tone?: string;
	size?: number;
	style?: StyleProp<ViewStyle>;
};

export const SteamLoop: React.FC<SteamLoopProps> = ({
	color = FOOD_THEME.colors.saffronDeep,
	style,
}) => {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withRepeat(
			withTiming(1, {
				duration: FOOD_THEME.animation.steamLoopMs,
				easing: Easing.out(Easing.quad),
			}),
			-1,
			false
		);
	}, [progress]);

	return (
		<View pointerEvents="none" style={[styles.steamWrap, style]}>
			<SteamLine progress={progress} color={color} offset={0} />
			<SteamLine progress={progress} color={color} offset={0.28} />
			<SteamLine progress={progress} color={color} offset={0.56} />
		</View>
	);
};

const SteamLine = ({
	progress,
	color,
	offset,
}: {
	progress: SharedValue<number>;
	color: string;
	offset: number;
}) => {
	const animatedStyle = useAnimatedStyle(() => {
		const phase = (progress.value + offset) % 1;
		return {
			opacity: interpolate(phase, [0, 0.36, 1], [0, 0.48, 0]),
			transform: [
				{translateY: interpolate(phase, [0, 1], [5, -7])},
				{scaleY: interpolate(phase, [0, 1], [0.72, 1.08])},
			],
		};
	});

	return (
		<Animated.View
			style={[
				styles.steamLine,
				{backgroundColor: color},
				animatedStyle,
			]}
		/>
	);
};

export const FoodIconBadge: React.FC<FoodIconBadgeProps> = ({
	iconKey = 'menu',
	imageSource,
	tone = FOOD_THEME.colors.saffronDeep,
	size = 38,
	showSteam = false,
	style,
}) => {
	const Icon = FOOD_THEME.iconMap[iconKey];
	const iconSize = Math.max(15, size * 0.48);

	return (
		<View style={[styles.foodBadgeOuter, {width: size, height: size}, style]}>
			{showSteam ? (
				<SteamLoop
					color={tone}
					style={[styles.foodBadgeSteam, {top: -10, width: size}]}
				/>
			) : null}
			<View
				style={[
					styles.foodBadge,
					{
						borderRadius: size / 2,
						backgroundColor: tone + '16',
						borderColor: tone + '24',
					},
				]}
			>
				{imageSource ? (
					<Image
						accessible={false}
						source={imageSource}
						resizeMode="contain"
						style={{width: iconSize, height: iconSize}}
					/>
				) : (
					<Icon size={iconSize} color={tone} strokeWidth={2.2} />
				)}
			</View>
		</View>
	);
};

export const KitchenActivityPulse: React.FC<KitchenActivityPulseProps> = ({
	active = true,
	label,
	tone = FOOD_THEME.colors.saffronDeep,
	size = 34,
	style,
}) => {
	const pulse = useSharedValue(0);
	const Icon = FOOD_THEME.iconMap.kitchen;

	useEffect(() => {
		pulse.value = active
			? withRepeat(
				withTiming(1, {
					duration: FOOD_THEME.animation.kitchenActivityMs,
					easing: Easing.out(Easing.quad),
				}),
				-1,
				false
			)
			: withTiming(0, {duration: FOOD_THEME.animation.pressOutMs});
	}, [active, pulse]);

	const pulseStyle = useAnimatedStyle(() => ({
		opacity: interpolate(pulse.value, [0, 0.7, 1], [0.24, 0.08, 0]),
		transform: [{scale: interpolate(pulse.value, [0, 1], [0.84, 1.46])}],
	}));

	return (
		<View style={[styles.activityRoot, label ? styles.activityWithLabel : null, style]}>
			<View style={{width: size, height: size}}>
				<Animated.View
					style={[
						styles.activityPulse,
						{borderRadius: size / 2, backgroundColor: tone},
						pulseStyle,
					]}
				/>
				<View
					style={[
						styles.activityCore,
						{
							width: size,
							height: size,
							borderRadius: size / 2,
							backgroundColor: tone + '18',
							borderColor: tone + '28',
						},
					]}
				>
					<Icon size={Math.max(13, size * 0.48)} color={tone} strokeWidth={2.2} />
				</View>
			</View>
			{label ? (
				<Text style={[styles.activityLabel, {color: tone}]}>{label}</Text>
			) : null}
		</View>
	);
};

export const FoodEmptyStateArt: React.FC<FoodEmptyStateArtProps> = ({
	tone = FOOD_THEME.colors.saffronDeep,
	size = 116,
	style,
}) => (
	<View style={[styles.emptyArt, {width: size, height: size}, style]}>
		<View style={[styles.emptyArtGlow, {backgroundColor: tone + '14'}]} />
		<Image
			accessible={false}
			source={FOOD_THEME.illustrations.emptyMenu}
			resizeMode="contain"
			style={styles.emptyArtImage}
		/>
		<FoodIconBadge
			imageSource={FOOD_THEME.iconImages.curryBowl}
			tone={tone}
			size={34}
			showSteam
			style={styles.emptyArtBadge}
		/>
	</View>
);

const styles = StyleSheet.create({
	steamWrap: {
		height: 20,
		width: 36,
		flexDirection: 'row',
		alignItems: 'flex-end',
		justifyContent: 'center',
		gap: 4,
	},
	steamLine: {
		width: 2,
		height: 12,
		borderRadius: 999,
	},
	foodBadgeOuter: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	foodBadgeSteam: {
		position: 'absolute',
		alignSelf: 'center',
	},
	foodBadge: {
		width: '100%',
		height: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		overflow: 'hidden',
	},
	activityRoot: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	activityWithLabel: {
		gap: 7,
	},
	activityPulse: {
		...StyleSheet.absoluteFillObject,
	},
	activityCore: {
		position: 'absolute',
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
	},
	activityLabel: {
		fontSize: 11,
		fontWeight: '900',
		letterSpacing: 0.4,
		textTransform: 'uppercase',
	},
	emptyArt: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyArtGlow: {
		position: 'absolute',
		width: '86%',
		height: '86%',
		borderRadius: 999,
	},
	emptyArtImage: {
		width: '100%',
		height: '100%',
		opacity: 0.9,
	},
	emptyArtBadge: {
		position: 'absolute',
		right: 4,
		bottom: 7,
	},
});
