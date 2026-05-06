import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { useResponsiveLayout } from './useResponsiveLayout';

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
	gutter,
}) => {
	const insets = useSafeAreaInsets();
	const { colors, isDark, toggleTheme } = useAppTheme();
	const { contentPadding, isCompact, stacked, maxContentWidth } = useResponsiveLayout();
	const resolvedGutter = gutter ?? contentPadding;

	return (
		<View
			style={[
				styles.container,
				{
					paddingTop: insets.top + Theme.spacing.sm,
					paddingBottom: Theme.spacing.md,
					paddingHorizontal: resolvedGutter,
					backgroundColor: colors.bg,
					borderBottomColor: colors.border,
				},
				edgeToEdge && { marginHorizontal: -resolvedGutter },
				style,
			]}
		>
			<View style={[styles.contentWrap, { maxWidth: maxContentWidth }]}>
				<View style={[styles.content, stacked && styles.contentStacked]}>
				<View style={styles.brandRow}>
					<View style={[styles.logoMark, { backgroundColor: colors.surface, borderColor: colors.border }]}>
						<Text style={[styles.logoText, { color: colors.primary }]}>DZ</Text>
					</View>
					<View style={styles.textContainer}>
						<Text style={[styles.brandTitle, isCompact && styles.brandTitleCompact, { color: colors.textPrimary }]} numberOfLines={1}>
							Desi Zaiqa
						</Text>
						<Text style={[styles.subtitle, isCompact && styles.subtitleCompact, { color: colors.textMuted }]} numberOfLines={stacked ? 2 : 1}>
							{subtitle ? `${title} - ${subtitle}` : title}
						</Text>
					</View>
				</View>

				<View style={[styles.actions, stacked && styles.actionsStacked]}>
					{!!rightAction && <View style={styles.actionContainer}>{rightAction}</View>}
					<Pressable
						onPress={toggleTheme}
						style={[styles.themeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
						accessibilityRole="button"
						accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
					>
						<MaterialCommunityIcons
							name={isDark ? 'white-balance-sunny' : 'moon-waning-crescent'}
							size={20}
							color={colors.primary}
						/>
					</Pressable>
				</View>
			</View>
			</View>
		</View>
	);
};

interface ScreenHeaderActionButtonProps {
	icon: keyof typeof MaterialCommunityIcons.glyphMap;
	onPress: () => void;
	accessibilityLabel: string;
	variant?: 'default' | 'primary' | 'success' | 'danger';
}

export const ScreenHeaderActionButton: React.FC<ScreenHeaderActionButtonProps> = ({
	icon,
	onPress,
	accessibilityLabel,
	variant = 'default',
}) => {
	const { colors } = useAppTheme();

	const palette = {
		default: {
			backgroundColor: colors.surfaceElevated,
			borderColor: colors.border,
			iconColor: colors.primary,
		},
		primary: {
			backgroundColor: colors.primary,
			borderColor: colors.primary,
			iconColor: colors.textInverted,
		},
		success: {
			backgroundColor: colors.surface,
			borderColor: colors.success,
			iconColor: colors.success,
		},
		danger: {
			backgroundColor: colors.surface,
			borderColor: colors.danger,
			iconColor: colors.danger,
		},
	}[variant];

	return (
		<Pressable
			onPress={onPress}
			style={[
				styles.headerIconButton,
				{
					backgroundColor: palette.backgroundColor,
					borderColor: palette.borderColor,
				},
			]}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
		>
			<MaterialCommunityIcons name={icon} size={20} color={palette.iconColor} />
		</Pressable>
	);
};

const styles = StyleSheet.create({
	container: {
		borderBottomWidth: 1,
	},
	contentWrap: {
		width: '100%',
		alignSelf: 'center',
	},
	content: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	contentStacked: {
		alignItems: 'flex-start',
	},
	brandRow: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		minWidth: 0,
	},
	logoMark: {
		width: 48,
		height: 48,
		borderRadius: Theme.radius.md,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: Theme.spacing.md,
		borderWidth: 1,
		shadowColor: '#000',
		shadowOpacity: 0.06,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 6 },
		elevation: 2,
	},
	logoText: {
		fontSize: 18,
		fontWeight: '900',
		letterSpacing: 0,
	},
	textContainer: {
		flex: 1,
		paddingRight: Theme.spacing.md,
		minWidth: 0,
	},
	brandTitle: {
		...Theme.typography.answer,
		fontSize: 24,
		letterSpacing: 0,
	},
	brandTitleCompact: {
		fontSize: 22,
	},
	subtitle: {
		...Theme.typography.detailBold,
		marginTop: 4,
		textTransform: 'uppercase',
		letterSpacing: 0.7,
	},
	subtitleCompact: {
		fontSize: 11,
		letterSpacing: 0.4,
	},
	actions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		flexShrink: 0,
	},
	actionsStacked: {
		alignSelf: 'flex-end',
	},
	actionContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
		gap: Theme.spacing.sm,
		flexShrink: 1,
	},
	themeToggle: {
		height: 40,
		width: 40,
		borderRadius: 20,
		borderWidth: 1,
		justifyContent: 'center',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOpacity: 0.05,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 1,
	},
	headerIconButton: {
		height: 40,
		width: 40,
		borderRadius: 20,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOpacity: 0.05,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 1,
	},
});
