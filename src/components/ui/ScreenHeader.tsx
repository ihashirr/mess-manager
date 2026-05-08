import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Sun, Moon, LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { useResponsiveLayout } from './useResponsiveLayout';

interface ScreenHeaderProps {
	title: string;
	subtitle?: string;
	rightAction?: React.ReactNode;
	persistentRightAction?: React.ReactNode;
	style?: ViewStyle;
	edgeToEdge?: boolean;
	gutter?: number;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
	title,
	subtitle,
	rightAction,
	persistentRightAction,
	style,
	edgeToEdge = true,
	gutter,
}) => {
	const insets = useSafeAreaInsets();
	const { colors, isDark, toggleTheme } = useAppTheme();
	const { contentPadding, isCompact, maxContentWidth, scale, font, icon } = useResponsiveLayout();
	const resolvedGutter = gutter ?? contentPadding;
	const logoSize = scale(48, 0.9, 1.08);
	const actionSize = scale(40, 0.92, 1.04);
	const headerBodyHeight = scale(isCompact ? 68 : 74, 0.96, 1.04);
	const actionCount = [persistentRightAction, rightAction].filter(Boolean).length + 1;
	const actionRailWidth = actionSize * actionCount + Theme.spacing.sm * Math.max(0, actionCount - 1);
	const brandTitleSize = font(isCompact ? 22 : 24, 0.94, 1.12);
	const subtitleSize = font(isCompact ? 11 : 12, 0.94, 1.08);
	const logoTextSize = font(18, 0.94, 1.08);

	return (
		<View
			style={[
				styles.container,
				{
					paddingTop: insets.top + Theme.spacing.md,
					paddingBottom: Theme.spacing.md,
					paddingHorizontal: resolvedGutter,
					minHeight: insets.top + headerBodyHeight,
					backgroundColor: colors.bg,
					borderBottomWidth: 0,
				},
				edgeToEdge && { marginHorizontal: -resolvedGutter },
				style,
			]}
		>
				<View style={[styles.contentWrap, { maxWidth: maxContentWidth }]}>
					<View style={[styles.content, { minHeight: actionSize }]}>
						<View style={styles.brandRow}>
							<View
								style={[
									styles.logoMark,
									{
										width: logoSize,
										height: logoSize,
										borderRadius: 18,
										backgroundColor: colors.surface,
										borderColor: colors.border,
									},
								]}
							>
								<Text style={[styles.logoText, { color: colors.primary, fontSize: logoTextSize }]}>DZ</Text>
							</View>
							<View style={[styles.textContainer, { paddingRight: scale(12, 0.9, 1.04) }]}>
								<Text
									style={[styles.brandTitle, { color: colors.textPrimary, fontSize: brandTitleSize }]}
									numberOfLines={1}
								>
									Desi Zaiqa
								</Text>
								<Text
									style={[styles.subtitle, { color: colors.textMuted, fontSize: subtitleSize }]}
									numberOfLines={1}
								>
									{subtitle ? `${title} - ${subtitle}` : title}
								</Text>
							</View>
						</View>

						<View style={[styles.actions, { width: actionRailWidth }]}>
							{persistentRightAction ? (
								<View style={[styles.actionSlot, { width: actionSize, height: actionSize }]}>
									{persistentRightAction}
								</View>
							) : null}
							{rightAction ? (
								<View style={[styles.actionSlot, { width: actionSize, height: actionSize }]}>
									{rightAction}
								</View>
							) : null}
							<Pressable
								onPress={toggleTheme}
								style={[
									styles.themeToggle,
									{
										height: actionSize,
										width: actionSize,
										borderRadius: actionSize / 2,
										backgroundColor: colors.surface,
										borderColor: colors.border,
									},
								]}
								accessibilityRole="button"
								accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
							>
								{isDark ? (
									<Sun size={icon(20)} color={colors.primary} />
								) : (
									<Moon size={icon(20)} color={colors.primary} />
								)}
							</Pressable>
						</View>
					</View>
			</View>
		</View>
	);
};

interface ScreenHeaderActionButtonProps {
	icon: LucideIcon;
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
	const { scale, icon: iconSize } = useResponsiveLayout();
	const buttonSize = scale(40, 0.92, 1.04);

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
	};

	const IconComponent = icon;

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.headerIconButton,
				{
					height: buttonSize,
					width: buttonSize,
					borderRadius: buttonSize / 2,
					backgroundColor: palette[variant].backgroundColor,
					borderColor: palette[variant].borderColor,
					opacity: pressed ? 0.7 : 1,
				},
			]}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
		>
			<IconComponent size={iconSize(20)} color={palette[variant].iconColor} />
		</Pressable>
	);
};

const styles = StyleSheet.create({
	container: {
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
	brandRow: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		minWidth: 0,
	},
	logoMark: {
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
		fontWeight: '900',
		letterSpacing: 0,
	},
	textContainer: {
		flex: 1,
		minWidth: 0,
	},
	brandTitle: {
		...Theme.typography.answer,
		fontSize: 26,
		letterSpacing: 0,
	},
	subtitle: {
		...Theme.typography.detailBold,
		marginTop: 2,
		textTransform: 'uppercase',
		letterSpacing: 0.7,
	},
	actions: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
		gap: Theme.spacing.sm,
		flexShrink: 0,
	},
	actionSlot: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	themeToggle: {
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
