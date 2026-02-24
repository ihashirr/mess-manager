import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';

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
	return (
		<View style={[styles.container, style]}>
			{title && (
				<Text style={styles.title}>{title}</Text>
			)}
			<View style={styles.content}>
				{children}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		backgroundColor: Theme.colors.surfaceElevated,
		padding: Theme.spacing.xl,
		borderRadius: Theme.radius.xl,
		marginVertical: Theme.spacing.lg,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.05)', // Subtle inner glow for dark panels
	},
	title: {
		...Theme.typography.label,
		color: Theme.colors.textMuted,
		marginBottom: Theme.spacing.lg,
		textTransform: 'uppercase',
		letterSpacing: 1.5,
	},
	content: {
		// Ensuring visibility of children on dark background
	},
});
