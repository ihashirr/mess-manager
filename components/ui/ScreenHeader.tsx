import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';

interface ScreenHeaderProps {
	title: string;
	subtitle?: string;
	rightAction?: React.ReactNode;
	style?: ViewStyle;
}

/**
 * ScreenHeader Component
 * Enforces strict title/subtitle/action hierarchy.
 * Following the "One-Glance" rule: Title (strong), Subtitle (muted), Max 1 action.
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
	title,
	subtitle,
	rightAction,
	style,
}) => {
	return (
		<View style={[styles.container, style]}>
			<View style={styles.content}>
				<View style={styles.textContainer}>
					<Text style={styles.title} numberOfLines={1}>{title}</Text>
					{subtitle && (
						<Text style={styles.subtitle} numberOfLines={1}>
							{subtitle}
						</Text>
					)}
				</View>
				{rightAction && (
					<View style={styles.actionContainer}>
						{rightAction}
					</View>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: Theme.spacing.screenPadding,
		paddingTop: Theme.spacing.md,
		paddingBottom: Theme.spacing.lg,
		backgroundColor: Theme.colors.surface,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.border,
	},
	content: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	textContainer: {
		flex: 1,
		marginRight: Theme.spacing.md,
	},
	title: {
		...Theme.typography.answer,
		fontSize: 24,
		color: Theme.colors.textPrimary,
	},
	subtitle: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		marginTop: Theme.spacing.xs,
		textTransform: 'uppercase',
		letterSpacing: 1.2,
	},
	actionContainer: {
		justifyContent: 'center',
		alignItems: 'center',
	},
});
