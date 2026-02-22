import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

interface BadgeProps {
	label: string;
	variant?: BadgeVariant;
	style?: ViewStyle | ViewStyle[];
	textStyle?: TextStyle | TextStyle[];
}

export function Badge({ label, variant = 'neutral', style, textStyle }: BadgeProps) {
	return (
		<View style={[styles.container, variantStyles[variant].container, style]}>
			<Text style={[styles.text, variantStyles[variant].text, textStyle]}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: Theme.radius.sm,
		alignSelf: 'flex-start',
	},
	text: {
		...Theme.typography.label,
	}
});

const variantStyles = {
	success: StyleSheet.create({
		container: { backgroundColor: '#e8f5e9' }, // Light transparent green
		text: { color: Theme.colors.success },
	}),
	warning: StyleSheet.create({
		container: { backgroundColor: '#fff3e0' }, // Light transparent orange
		text: { color: Theme.colors.warning },
	}),
	danger: StyleSheet.create({
		container: { backgroundColor: '#ffebee' }, // Light transparent red
		text: { color: Theme.colors.danger },
	}),
	neutral: StyleSheet.create({
		container: { backgroundColor: Theme.colors.surfaceSecondary },
		text: { color: Theme.colors.textMuted },
	}),
};
