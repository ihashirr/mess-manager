import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';

type CardVariant = 'elevated' | 'flat' | 'outlined';

interface CardProps {
	children: React.ReactNode;
	variant?: CardVariant;
	style?: ViewStyle | ViewStyle[];
	onPress?: () => void;
	borderless?: boolean;
}

export function Card({ children, variant = 'elevated', style, onPress, borderless = false }: CardProps) {
	const scale = useRef(new Animated.Value(1)).current;
	const { colors, isDark } = useAppTheme();

	const handlePressIn = () => {
		if (!onPress) return;
		Animated.timing(scale, {
			toValue: Theme.animation.scale.active,
			duration: Theme.animation.duration.fast,
			useNativeDriver: true,
		}).start();
	};

	const handlePressOut = () => {
		if (!onPress) return;
		Animated.timing(scale, {
			toValue: 1,
			duration: Theme.animation.duration.fast,
			useNativeDriver: true,
		}).start();
	};

	const cardContent = (
		<View style={[
			styles.base,
			variant === 'elevated' && [
				{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
				!isDark && styles.elevatedShadow,
			],
			variant === 'flat' && { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: 'transparent' },
			variant === 'outlined' && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
			borderless && { borderWidth: 0, borderColor: 'transparent', backgroundColor: 'transparent', paddingHorizontal: 0 },
			style
		]}>
			{children}
		</View>
	);

	if (onPress) {
		return (
			<Animated.View style={{ transform: [{ scale }] }}>
				<Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
					{cardContent}
				</Pressable>
			</Animated.View>
		);
	}

	return cardContent;
}

const styles = StyleSheet.create({
	base: {
		padding: Theme.spacing.screen,
		borderRadius: Theme.radius.lg,
	},
	elevatedShadow: {
		shadowColor: '#201812',
		shadowOpacity: 0.06,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
		elevation: 2,
	},
});
