import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

interface BadgeProps {
	label: string;
	variant?: BadgeVariant;
	style?: ViewStyle | ViewStyle[];
	textStyle?: TextStyle | TextStyle[];
}

export function Badge({ label, variant = 'neutral', style, textStyle }: BadgeProps) {
	const { colors, isDark } = useAppTheme();
	const palette = {
		success: {
			container: { backgroundColor: isDark ? 'rgba(46, 204, 113, 0.16)' : '#e8f5e9' },
			text: { color: colors.success },
		},
		warning: {
			container: { backgroundColor: isDark ? 'rgba(243, 156, 18, 0.18)' : '#fff3e0' },
			text: { color: colors.warning },
		},
		danger: {
			container: { backgroundColor: isDark ? 'rgba(231, 76, 60, 0.18)' : '#ffebee' },
			text: { color: colors.danger },
		},
		neutral: {
			container: { backgroundColor: colors.surfaceElevated },
			text: { color: colors.textSecondary },
		},
	} satisfies Record<BadgeVariant, { container: ViewStyle; text: TextStyle }>;

	return (
		<View style={[styles.container, palette[variant].container, style]}>
			<Text style={[styles.text, palette[variant].text, textStyle]}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: 6,
		borderRadius: Theme.radius.full,
		alignSelf: 'flex-start',
	},
	text: {
		...Theme.typography.detailBold,
	}
});
