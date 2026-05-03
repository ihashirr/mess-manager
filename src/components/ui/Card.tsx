import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';

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
			variantStyles[variant],
			borderless && styles.borderless,
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
		backgroundColor: Theme.colors.surface,
	},
	borderless: {
		borderWidth: 0,
		borderColor: 'transparent',
		backgroundColor: 'transparent',
		paddingHorizontal: 0, // Let container padding handle it if borderless
	},
});

const variantStyles = StyleSheet.create({
	elevated: {
		borderWidth: 1,
		borderColor: Theme.colors.border,
		backgroundColor: Theme.colors.surface,
	},
	flat: {
		backgroundColor: Theme.colors.bg,
		borderWidth: 1,
		borderColor: 'transparent',
	},
	outlined: {
		borderWidth: 1,
		borderColor: Theme.colors.border,
	}
});
