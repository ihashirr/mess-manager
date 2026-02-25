import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/Theme';

interface ScreenHeaderProps {
	title: string;
	subtitle?: string;
	rightAction?: React.ReactNode;
	style?: ViewStyle;
	edgeToEdge?: boolean;
	gutter?: number;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
	title,
	subtitle,
	rightAction,
	style,
	edgeToEdge = true,
	gutter = Theme.spacing.screen,
}) => {
	const insets = useSafeAreaInsets();

	return (
		<View
			style={[
				styles.container,
				{
					paddingTop: insets.top + Theme.spacing.sm,
					paddingBottom: Theme.spacing.sm,
					paddingHorizontal: gutter,
				},
				edgeToEdge && { marginHorizontal: -gutter },
				style,
			]}
		>
			<View style={styles.content}>
				<View style={styles.textContainer}>
					<Text style={styles.title} numberOfLines={1}>
						{title}
					</Text>
					{!!subtitle && (
						<Text style={styles.subtitle} numberOfLines={1}>
							{subtitle}
						</Text>
					)}
				</View>

				{!!rightAction && <View style={styles.actionContainer}>{rightAction}</View>}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		backgroundColor: Theme.colors.surface,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.border,
	},
	content: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	textContainer: {
		flex: 1,
		paddingRight: Theme.spacing.md,
	},
	title: {
		...Theme.typography.answer,
		fontSize: 24, // Override to enforce uniform size across all screens
		letterSpacing: 0.2,
		color: Theme.colors.textPrimary,
	},
	subtitle: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		marginTop: 4,
		textTransform: 'uppercase',
		letterSpacing: 1.2,
	},
	actionContainer: {
		height: 40,
		width: 40,
		justifyContent: 'center',
		alignItems: 'center',
	},
});