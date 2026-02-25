import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring
} from 'react-native-reanimated';
import { Theme } from '../../constants/Theme';
import { UserAvatar } from './UserAvatar';

interface UserIdentityProps {
	name: string;
	onPress?: () => void;
	size?: number;
	fontSize?: number;
	nameSize?: number;
	subtext?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const UserIdentity: React.FC<UserIdentityProps> = ({
	name,
	onPress,
	size = 32,
	fontSize = 12,
	nameSize = 14,
	subtext,
}) => {
	const scale = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
		opacity: withSpring(scale.value === 1 ? 1 : 0.8),
	}));

	const handlePressIn = () => {
		scale.value = withSpring(0.96);
	};

	const handlePressOut = () => {
		scale.value = withSpring(1);
	};

	return (
		<AnimatedPressable
			onPress={onPress}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			style={[styles.container, animatedStyle]}
		>
			<UserAvatar
				name={name}
				size={size}
				fontSize={fontSize}
			/>
			<View style={styles.textContainer}>
				<Text style={[styles.name, { fontSize: nameSize }]} numberOfLines={1}>
					{name}
				</Text>
				{!!subtext && (
					<Text style={styles.subtext} numberOfLines={1}>
						{subtext}
					</Text>
				)}
			</View>
		</AnimatedPressable>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.md,
		alignSelf: 'flex-start', // Don't stretch across the whole row by default
		paddingRight: Theme.spacing.md,
		paddingVertical: 2,
	},
	textContainer: {
		justifyContent: 'center',
	},
	name: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
	},
	subtext: {
		...Theme.typography.detail,
		color: Theme.colors.textMuted,
		marginTop: 2,
	},
});
