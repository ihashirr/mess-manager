import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
	title: string;
	onPress: () => void;
	variant?: ButtonVariant;
	size?: ButtonSize;
	iconLeft?: keyof typeof MaterialCommunityIcons.glyphMap;
	iconRight?: keyof typeof MaterialCommunityIcons.glyphMap;
	disabled?: boolean;
	loading?: boolean;
	fullWidth?: boolean;
	style?: ViewStyle;
	textStyle?: TextStyle;
}

export function Button({
	title,
	onPress,
	variant = 'primary',
	size = 'md',
	iconLeft,
	iconRight,
	disabled = false,
	loading = false,
	fullWidth = false,
	style,
	textStyle,
}: ButtonProps) {
	const scale = useRef(new Animated.Value(1)).current;

	const handlePressIn = () => {
		Animated.timing(scale, {
			toValue: Theme.animation.scale.active,
			duration: Theme.animation.duration.fast,
			useNativeDriver: true,
		}).start();
	};

	const handlePressOut = () => {
		Animated.timing(scale, {
			toValue: 1,
			duration: Theme.animation.duration.fast,
			useNativeDriver: true,
		}).start();
	};

	const isDisabled = disabled || loading;

	return (
		<Animated.View style={[{ transform: [{ scale }] }, fullWidth && styles.fullWidth, style]}>
			<Pressable
				onPress={isDisabled ? undefined : onPress}
				onPressIn={isDisabled ? undefined : handlePressIn}
				onPressOut={isDisabled ? undefined : handlePressOut}
				style={[
					styles.base,
					styles[size],
					variantStyles[variant].container,
					isDisabled && styles.disabled,
				]}
			>
				{loading ? (
					<ActivityIndicator color={variantStyles[variant].text.color} size="small" />
				) : (
					<>
						{iconLeft && (
							<MaterialCommunityIcons
								name={iconLeft}
								size={iconSizes[size]}
								color={variantStyles[variant].text.color as string}
								style={styles.iconLeft}
							/>
						)}
						<Text style={[styles.textBase, textSizes[size], variantStyles[variant].text, textStyle]}>
							{title}
						</Text>
						{iconRight && (
							<MaterialCommunityIcons
								name={iconRight}
								size={iconSizes[size]}
								color={variantStyles[variant].text.color as string}
								style={styles.iconRight}
							/>
						)}
					</>
				)}
			</Pressable>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	fullWidth: {
		width: '100%',
	},
	base: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: Theme.radius.md,
	},
	sm: {
		paddingVertical: Theme.spacing.xs,
		paddingHorizontal: Theme.spacing.md,
	},
	md: {
		paddingVertical: Theme.spacing.md,
		paddingHorizontal: Theme.spacing.lg,
	},
	lg: {
		paddingVertical: Theme.spacing.lg,
		paddingHorizontal: Theme.spacing.xl,
		borderRadius: Theme.radius.lg,
	},
	textBase: {
		...Theme.typography.labelMedium,
		textAlign: 'center',
	},
	iconLeft: {
		marginRight: Theme.spacing.sm,
	},
	iconRight: {
		marginLeft: Theme.spacing.sm,
	},
	disabled: {
		opacity: Theme.opacity.disabled,
	},
});

const textSizes = StyleSheet.create({
	sm: { fontSize: 13 },
	md: { fontSize: 16 },
	lg: { fontSize: 18 },
});

const iconSizes = {
	sm: 16,
	md: 20,
	lg: 24,
};

const variantStyles = {
	primary: StyleSheet.create({
		container: { backgroundColor: Theme.colors.primary },
		text: { color: Theme.colors.textInverted },
	}),
	secondary: StyleSheet.create({
		container: { backgroundColor: Theme.colors.primary },
		text: { color: Theme.colors.textInverted },
	}),
	danger: StyleSheet.create({
		container: { backgroundColor: Theme.colors.danger },
		text: { color: Theme.colors.textInverted },
	}),
	ghost: StyleSheet.create({
		container: { backgroundColor: 'transparent' },
		text: { color: Theme.colors.primary },
	}),
	outline: StyleSheet.create({
		container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Theme.colors.border },
		text: { color: Theme.colors.textPrimary },
	}),
};
