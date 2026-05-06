import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';

interface SectionProps {
	title?: string;
	subtitle?: string;
	children: React.ReactNode;
	style?: ViewStyle | ViewStyle[];
	contentStyle?: ViewStyle | ViewStyle[];
}

export function Section({ title, subtitle, children, style, contentStyle }: SectionProps) {
	const { colors } = useAppTheme();

	return (
		<View style={[styles.container, style]}>
			{(title || subtitle) && (
				<View style={styles.header}>
					<View style={styles.headerTopRow}>
						<View style={[styles.headerAccent, { backgroundColor: colors.primary }]} />
						{title && <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>}
					</View>
					{subtitle && <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
				</View>
			)}
			<View style={[styles.content, contentStyle]}>
				{children}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		marginBottom: Theme.spacing.xl,
	},
	header: {
		paddingHorizontal: Theme.spacing.xs,
		marginBottom: Theme.spacing.md,
	},
	headerTopRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
	},
	headerAccent: {
		width: 10,
		height: 10,
		borderRadius: Theme.radius.full,
	},
	title: {
		...Theme.typography.labelMedium,
	},
	subtitle: {
		...Theme.typography.detailBold,
		marginTop: Theme.spacing.xs,
		textTransform: 'uppercase',
	},
	content: {
		// Removed padding to avoid double-padding with Screen
	}
});
