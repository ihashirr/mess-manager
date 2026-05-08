import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring
} from 'react-native-reanimated';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
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
	const { colors } = useAppTheme();

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
			style={[styles.container, onPress && styles.containerInteractive, animatedStyle]}
		>
			<UserAvatar
				name={name}
				size={size}
				fontSize={fontSize}
			/>
			<View style={styles.textContainer}>
				<Text style={[styles.name, { color: colors.textPrimary, fontSize: nameSize }]} numberOfLines={1}>
					{name}
				</Text>
				{!!subtext && (
					<Text style={[styles.subtext, { color: colors.textMuted }]} numberOfLines={1}>
						{subtext}
					</Text>
				)}
			</View>
			{onPress ? (
				<View style={[styles.hintIcon, { backgroundColor: colors.surfaceElevated }]}>
					<ChevronRight size={16} color={colors.textMuted} />
				</View>
			) : null}
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
		paddingVertical: 4,
		borderRadius: Theme.radius.lg,
	},
	containerInteractive: {
		paddingLeft: Theme.spacing.xs,
		paddingRight: Theme.spacing.sm,
	},
	textContainer: {
		justifyContent: 'center',
		flexShrink: 1,
	},
	name: {
		...Theme.typography.labelMedium,
	},
	subtext: {
		...Theme.typography.detail,
		marginTop: 2,
	},
	hintIcon: {
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		marginLeft: Theme.spacing.xs,
	},
});
