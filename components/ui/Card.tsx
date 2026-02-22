import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';

type CardVariant = 'elevated' | 'flat' | 'outlined';

interface CardProps {
	children: React.ReactNode;
	variant?: CardVariant;
	style?: ViewStyle | ViewStyle[];
	onPress?: () => void;
}

export function Card({ children, variant = 'elevated', style, onPress }: CardProps) {
	const scale = useRef(new Animated.Value(1)).current;

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
		<View style={[styles.base, variantStyles[variant], style]}>
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
		backgroundColor: Theme.colors.surface,
	},
});

const variantStyles = StyleSheet.create({
	elevated: {
		...Theme.shadows.soft,
	},
	flat: {
		backgroundColor: Theme.colors.surfaceSecondary,
	},
	outlined: {
		borderWidth: 1,
		borderColor: Theme.colors.border,
	}
});
