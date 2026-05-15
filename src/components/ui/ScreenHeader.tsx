import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Sun, Moon, LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedReanimated, {
	FadeIn,
	FadeOut,
	interpolate,
	SharedValue,
	useAnimatedStyle,
} from 'react-native-reanimated';
import { useAppTheme } from '../../context/ThemeModeContext';
import { useResponsiveLayout } from '../../hooks';

interface ScreenHeaderProps {
	title: string;
	subtitle?: string;
	rightAction?: React.ReactNode;
	persistentRightAction?: React.ReactNode;
	style?: ViewStyle;
	edgeToEdge?: boolean;
	gutter?: number;
	pagerProgress?: SharedValue<number>;
	activeIndex?: number;
	pageCount?: number;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
	title,
	subtitle,
	rightAction,
	persistentRightAction,
	style,
	edgeToEdge = true,
	gutter,
	pagerProgress,
	activeIndex = 0,
	pageCount = 0,
}) => {
	const insets = useSafeAreaInsets();
	const { colors, isDark, toggleTheme } = useAppTheme();
	const { contentPadding, isCompact, maxContentWidth, scale, font, icon } = useResponsiveLayout();
	const resolvedGutter = gutter ?? contentPadding;

	// ── Sizing tokens ──────────────────────────────────────────
	const logoSize = scale(isCompact ? 42 : 46, 0.96, 1.04);
	const actionSize = scale(isCompact ? 38 : 40, 0.96, 1.04);
	const brandTitleSize = font(isCompact ? 20 : 22, 0.94, 1.02);
	const subtitleSize = font(isCompact ? 11 : 12, 0.94, 1.02);
	const logoImageSize = Math.round(logoSize * 0.85);

	// ── Surface palette ────────────────────────────────────────
	const avatarBg = isDark ? 'rgba(255, 138, 76, 0.14)' : 'rgba(255, 244, 235, 1)';
	const avatarBorder = isDark ? 'rgba(255, 138, 76, 0.28)' : 'rgba(255, 152, 90, 0.22)';
	const avatarGlow = isDark ? 'rgba(255, 138, 76, 0.10)' : 'rgba(255, 255, 255, 0.52)';
	const secondaryBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.78)';
	const secondaryBorder = isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(42, 30, 19, 0.07)';
	const headerContentKey = `${title}-${subtitle ?? ''}`;
	const actionContentKey = `${title}-${rightAction ? 'actions' : 'no-actions'}`;

	return (
		<View
			style={[
				styles.container,
				{
					paddingTop: insets.top + 10,
					paddingBottom: 12,
					paddingHorizontal: resolvedGutter,
					backgroundColor: colors.bg,
				},
				edgeToEdge && { marginHorizontal: -resolvedGutter },
				style,
			]}
		>
			<View style={[styles.contentWrap, { maxWidth: maxContentWidth }]}>
				<View style={styles.content}>
					{/* ─── Brand Identity ─── */}
					<View style={styles.brandRow}>
						<View
							style={[
								styles.logoMark,
								{
									width: logoSize,
									height: logoSize,
									borderRadius: 22,
									backgroundColor: avatarBg,
									borderColor: avatarBorder,
								},
							]}
						>
							<View
								pointerEvents="none"
								style={[styles.logoGlow, { backgroundColor: avatarGlow }]}
							/>
							<Image
								source={require('../../../assets/images/dz-logo-mark.png')}
								style={{ width: logoImageSize, height: logoImageSize }}
								resizeMode="contain"
							/>
						</View>

						<AnimatedReanimated.View
							key={headerContentKey}
							entering={FadeIn.duration(150)}
							exiting={FadeOut.duration(100)}
							style={styles.textContainer}
						>
							<Text
								style={[
									styles.brandTitle,
									{ color: colors.textPrimary, fontSize: brandTitleSize },
								]}
								numberOfLines={1}
							>
								Desi Zaiqa
							</Text>
							<Text
								style={[
									styles.subtitle,
									{ color: colors.textSecondary, fontSize: subtitleSize },
								]}
								numberOfLines={1}
							>
								{subtitle || title}
							</Text>
							{pagerProgress && pageCount > 1 ? (
								<HeaderPageRail
									activeIndex={activeIndex}
									count={pageCount}
									progress={pagerProgress}
									activeColor={colors.primary}
									trackColor={isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(42, 30, 19, 0.10)'}
								/>
							) : null}
						</AnimatedReanimated.View>
					</View>

					{/* ─── Actions ─── */}
					<View style={styles.actions}>
						{persistentRightAction ? (
							<View style={[styles.actionSlot, { minWidth: actionSize, height: actionSize }]}>
								{persistentRightAction}
							</View>
						) : null}
						{rightAction ? (
							<AnimatedReanimated.View
								key={actionContentKey}
								entering={FadeIn.duration(150)}
								exiting={FadeOut.duration(90)}
								style={[styles.actionSlot, { minWidth: actionSize, height: actionSize }]}
							>
								{rightAction}
							</AnimatedReanimated.View>
						) : null}
						<Pressable
							onPress={toggleTheme}
							style={({ pressed }) => [
								styles.secondaryButton,
								{
									height: actionSize,
									width: actionSize,
									borderRadius: 14,
									backgroundColor: secondaryBg,
									borderColor: secondaryBorder,
									transform: [{ scale: pressed ? 0.93 : 1 }],
									opacity: pressed ? 0.78 : 1,
								},
							]}
							accessibilityRole="button"
							accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
						>
							{isDark ? (
								<Sun size={icon(18)} color={colors.textSecondary} strokeWidth={2.2} />
							) : (
								<Moon size={icon(18)} color={colors.textSecondary} strokeWidth={2.2} />
							)}
						</Pressable>
					</View>
				</View>
			</View>
		</View>
	);
};

function HeaderPageRail({
	activeIndex,
	count,
	progress,
	activeColor,
	trackColor,
}: {
	activeIndex: number;
	count: number;
	progress: SharedValue<number>;
	activeColor: string;
	trackColor: string;
}) {
	return (
		<View style={styles.pageRail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
			{Array.from({ length: count }).map((_, index) => (
				<HeaderPageRailSegment
					key={index}
					index={index}
					activeIndex={activeIndex}
					progress={progress}
					activeColor={activeColor}
					trackColor={trackColor}
				/>
			))}
		</View>
	);
}

function HeaderPageRailSegment({
	index,
	activeIndex,
	progress,
	activeColor,
	trackColor,
}: {
	index: number;
	activeIndex: number;
	progress: SharedValue<number>;
	activeColor: string;
	trackColor: string;
}) {
	const animatedStyle = useAnimatedStyle(() => {
		const distance = Math.abs(progress.value - index);
		return {
			opacity: interpolate(distance, [0, 1], [1, 0.36], 'clamp'),
			transform: [
				{
					scaleX: interpolate(distance, [0, 1], [1, 0.72], 'clamp'),
				},
			],
		};
	});

	return (
		<View
			style={[
				styles.pageRailSegmentTrack,
				{ backgroundColor: trackColor },
				activeIndex === index && styles.pageRailSegmentTrackActive,
			]}
		>
			<AnimatedReanimated.View
				style={[
					styles.pageRailSegmentFill,
					{ backgroundColor: activeColor },
					animatedStyle,
				]}
			/>
		</View>
	);
}

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
	const { colors, isDark } = useAppTheme();
	const { scale, icon: iconSize } = useResponsiveLayout();
	const isPrimary = variant === 'primary';
	const buttonSize = scale(isPrimary ? 44 : 40, 0.96, 1.04);

	const palette = {
		default: {
			backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.78)',
			borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(42, 30, 19, 0.07)',
			iconColor: colors.textSecondary,
			shadowColor: isDark ? '#000000' : '#1A1510',
			shadowOpacity: isDark ? 0.12 : 0.06,
		},
		primary: {
			backgroundColor: colors.primary,
			borderColor: 'rgba(255, 255, 255, 0.12)',
			iconColor: colors.textInverted,
			shadowColor: '#C85B2F',
			shadowOpacity: 0.32,
		},
		success: {
			backgroundColor: isDark ? 'rgba(46, 204, 113, 0.12)' : 'rgba(46, 204, 113, 0.10)',
			borderColor: isDark ? 'rgba(46, 204, 113, 0.24)' : 'rgba(46, 204, 113, 0.20)',
			iconColor: colors.success,
			shadowColor: '#2ECC71',
			shadowOpacity: 0.14,
		},
		danger: {
			backgroundColor: isDark ? 'rgba(231, 76, 60, 0.12)' : 'rgba(231, 76, 60, 0.10)',
			borderColor: isDark ? 'rgba(231, 76, 60, 0.24)' : 'rgba(231, 76, 60, 0.20)',
			iconColor: colors.danger,
			shadowColor: '#E74C3C',
			shadowOpacity: 0.14,
		},
	};

	const p = palette[variant];
	const IconComponent = icon;

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.actionButton,
				{
					height: buttonSize,
					width: buttonSize,
					borderRadius: isPrimary ? 16 : 14,
					backgroundColor: p.backgroundColor,
					borderColor: p.borderColor,
					shadowColor: p.shadowColor,
					shadowOpacity: pressed ? p.shadowOpacity * 0.5 : p.shadowOpacity,
					transform: [{ scale: pressed ? 0.91 : 1 }],
					opacity: pressed ? 0.82 : 1,
				},
			]}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
		>
			<IconComponent
				size={iconSize(isPrimary ? 19 : 17)}
				color={p.iconColor}
				strokeWidth={isPrimary ? 2.5 : 2.2}
			/>
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
	},

	// ── Brand Identity ──────────────────────────────────────────
	brandRow: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		minWidth: 0,
		gap: 12,
	},
	logoMark: {
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		overflow: 'hidden',
		// Warm premium shadow
		shadowColor: '#D45A20',
		shadowOpacity: 0.14,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
		elevation: 4,
	},
	logoGlow: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		height: '50%',
		borderBottomLeftRadius: 999,
		borderBottomRightRadius: 999,
	},
	logoText: {
		fontWeight: '900',
		letterSpacing: 0.5,
	},
	textContainer: {
		flex: 1,
		minWidth: 0,
		gap: 3,
	},
	brandTitle: {
		fontWeight: '800',
		letterSpacing: -0.3,
	},
	subtitle: {
		fontWeight: '600',
		letterSpacing: 0,
		opacity: 0.64,
	},
	pageRail: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: 5,
		width: 86,
	},
	pageRailSegmentTrack: {
		flex: 1,
		height: 3,
		borderRadius: 999,
		overflow: 'hidden',
	},
	pageRailSegmentTrackActive: {
		flex: 1.35,
	},
	pageRailSegmentFill: {
		width: '100%',
		height: '100%',
		borderRadius: 999,
	},

	// ── Actions ─────────────────────────────────────────────────
	actions: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
		gap: 8,
		flexShrink: 0,
	},
	actionSlot: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	secondaryButton: {
		borderWidth: 1,
		justifyContent: 'center',
		alignItems: 'center',
		// Layered shadow system
		shadowColor: '#1A1510',
		shadowOpacity: 0.06,
		shadowRadius: 14,
		shadowOffset: { width: 0, height: 6 },
		elevation: 2,
	},
	actionButton: {
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		// Premium layered shadow
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
		elevation: 3,
	},
});
