import { LucideIcon } from 'lucide-react-native';
import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';


interface ButtonProps {
	title: string;
	onPress: () => void;
	variant?: ButtonVariant;
	size?: ButtonSize;
	iconLeft?: LucideIcon;
	iconRight?: LucideIcon;
	disabled?: boolean;
	loading?: boolean;
	fullWidth?: boolean;
	style?: ViewStyle | ViewStyle[];
	textStyle?: TextStyle | TextStyle[];
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
	const { colors } = useAppTheme();

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
	const variantStyle = getVariantStyle(variant, colors);

	return (
		<Animated.View style={[{ transform: [{ scale }] }, fullWidth && styles.fullWidth, style]}>
			<Pressable
				onPress={isDisabled ? undefined : onPress}
				onPressIn={isDisabled ? undefined : handlePressIn}
				onPressOut={isDisabled ? undefined : handlePressOut}
				style={[
					styles.base,
					styles[size],
					variantStyle.container,
					isDisabled && styles.disabled,
				]}
			>
				{loading ? (
					<ActivityIndicator color={variantStyle.text.color} size="small" />
				) : (
					<>
						{iconLeft && (
							<View style={styles.iconLeft}>
								{React.createElement(iconLeft, {
									size: iconSizes[size],
									color: variantStyle.text.color as string,
								})}
							</View>
						)}
						<Text style={[styles.textBase, textSizes[size], variantStyle.text, textStyle]}>
							{title}
						</Text>
						{iconRight && (
							<View style={styles.iconRight}>
								{React.createElement(iconRight, {
									size: iconSizes[size],
									color: variantStyle.text.color as string,
								})}
							</View>
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

const getVariantStyle = (variant: ButtonVariant, colors: typeof Theme.colors) => {
	const stylesByVariant = {
		primary: {
			container: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary },
			text: { color: colors.textInverted },
		},
		secondary: {
			container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
			text: { color: colors.textPrimary },
		},
		danger: {
			container: { backgroundColor: colors.danger, borderWidth: 1, borderColor: colors.danger },
			text: { color: colors.textInverted },
		},
		ghost: {
			container: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: 'transparent' },
			text: { color: colors.primary },
		},
		outline: {
			container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
			text: { color: colors.textPrimary },
		},
	};

	return stylesByVariant[variant];
};
