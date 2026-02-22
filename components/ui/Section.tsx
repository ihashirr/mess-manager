import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';

interface SectionProps {
	title?: string;
	subtitle?: string;
	children: React.ReactNode;
	style?: ViewStyle | ViewStyle[];
	contentStyle?: ViewStyle | ViewStyle[];
}

export function Section({ title, subtitle, children, style, contentStyle }: SectionProps) {
	return (
		<View style={[styles.container, style]}>
			{(title || subtitle) && (
				<View style={styles.header}>
					{title && <Text style={styles.title}>{title}</Text>}
					{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
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
		paddingHorizontal: Theme.spacing.screen,
		marginBottom: Theme.spacing.md,
	},
	title: {
		...Theme.typography.subheading,
		color: Theme.colors.text,
	},
	subtitle: {
		...Theme.typography.caption,
		color: Theme.colors.textDimmed,
		marginTop: 2,
		textTransform: 'uppercase',
	},
	content: {
		paddingHorizontal: Theme.spacing.screen,
	}
});
