import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';

interface PrimaryPanelProps {
	children: React.ReactNode;
	title?: string;
	style?: ViewStyle;
}

/**
 * PrimaryPanel Component
 * The "Hero" container for the screen's primary answer.
 * Enforces strong contrast (Dark background) and high elevation.
 */
export const PrimaryPanel: React.FC<PrimaryPanelProps> = ({
	children,
	title,
	style,
}) => {
	const { colors, isDark } = useAppTheme();

	return (
		<View
			style={[
				styles.container,
				{
					backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
					borderColor: colors.border,
				},
				!isDark && styles.lightShadow,
				style,
			]}
		>
			{title && (
				<Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
			)}
			<View style={[styles.rule, { backgroundColor: colors.surfaceElevated }]} />
			<View style={styles.content}>
				{children}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		padding: Theme.spacing.xl,
		borderRadius: Theme.radius.xl,
		marginVertical: Theme.spacing.lg,
		borderWidth: 1,
	},
	lightShadow: {
		shadowColor: '#201812',
		shadowOpacity: 0.06,
		shadowRadius: 20,
		shadowOffset: { width: 0, height: 10 },
		elevation: 3,
	},
	title: {
		...Theme.typography.label,
		textTransform: 'uppercase',
		letterSpacing: 1.5,
	},
	rule: {
		height: 6,
		width: 56,
		borderRadius: Theme.radius.full,
		marginTop: Theme.spacing.sm,
		marginBottom: Theme.spacing.xl,
	},
	content: {
		gap: Theme.spacing.sm,
	},
});
