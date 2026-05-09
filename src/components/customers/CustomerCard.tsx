import React, { useCallback, useRef } from 'react';
import { CalendarCheck, ChevronUp, MapPin, Navigation2, Trash2, Utensils, Wallet } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
	Extrapolation,
	interpolate,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from 'react-native-reanimated';
import {
	Animated as RNAnimated,
	GestureResponderEvent,
	Linking,
	Platform,
	Pressable,
	StyleProp,
	StyleSheet,
	Text,
	View,
	ViewStyle,
} from 'react-native';
import { showToast } from '../system/feedback/AppToast';
import { Card } from '../ui/Card';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { getCustomerStatus, getDaysLeft, getDueAmount, toDate } from '../../utils/customerLogic';
import type { WeekMenu } from '../../utils/menuLogic';
import type { DayName } from '../../utils/weekLogic';
import { CustomerAttendancePanel } from './CustomerAttendancePanel';
import type { Customer } from './types';

interface CustomerCardProps {
	customer: Customer;
	expanded: boolean;
	weekId: string;
	weekAttendance: Record<DayName, { lunch: boolean; dinner: boolean }>;
	weekMenu: WeekMenu;
	onAvatarPress: (customer: Customer) => void;
	onDelete: (customer: Customer) => void | Promise<void>;
	onToggleExpanded: (id: string) => void;
	onToggleAttendance: (day: DayName, meal: 'lunch' | 'dinner') => void;
	onSaveAttendance: (id: string) => void;
}

interface TactilePressableProps {
	children: React.ReactNode;
	onPress?: (event: GestureResponderEvent) => void;
	style?: StyleProp<ViewStyle> | ((pressed: boolean) => StyleProp<ViewStyle>);
	containerStyle?: StyleProp<ViewStyle>;
	accessibilityLabel?: string;
	accessibilityRole?: 'button';
	haptic?: boolean;
}

function TactilePressable({
	children,
	onPress,
	style,
	containerStyle,
	accessibilityLabel,
	accessibilityRole = 'button',
	haptic = true,
}: TactilePressableProps) {
	const scaleValue = useRef(new RNAnimated.Value(1)).current;

	const handlePressIn = () => {
		RNAnimated.timing(scaleValue, {
			toValue: 0.97,
			duration: Theme.animation.duration.fast,
			useNativeDriver: true,
		}).start();

		if (haptic && Platform.OS !== 'web') {
			void Haptics.selectionAsync().catch(() => undefined);
		}
	};

	const handlePressOut = () => {
		RNAnimated.timing(scaleValue, {
			toValue: 1,
			duration: Theme.animation.duration.fast,
			useNativeDriver: true,
		}).start();
	};

	return (
		<RNAnimated.View style={[containerStyle, { transform: [{ scale: scaleValue }] }]}>
			<Pressable
				accessibilityLabel={accessibilityLabel}
				accessibilityRole={accessibilityRole}
				onPress={onPress}
				onPressIn={handlePressIn}
				onPressOut={handlePressOut}
				style={({ pressed }) => (typeof style === 'function' ? style(pressed) : style)}
			>
				{children}
			</Pressable>
		</RNAnimated.View>
	);
}

export function CustomerCard({
	customer,
	expanded,
	weekId,
	weekAttendance,
	weekMenu,
	onAvatarPress,
	onDelete,
	onToggleExpanded,
	onToggleAttendance,
	onSaveAttendance,
}: CustomerCardProps) {
	const { colors, isDark } = useAppTheme();
	const { isCompact, scale, font, icon } = useResponsiveLayout();
	const status = getCustomerStatus(toDate(customer.endDate));
	const dueAmount = getDueAmount(customer.pricePerMonth, customer.totalPaid);
	const daysLeft = getDaysLeft(toDate(customer.endDate));
	const avatarSize = scale(isCompact ? 40 : 44, 0.94, 1.02);
	const customerNameSize = font(isCompact ? 18 : 20, 0.94, 1);
	const planTextSize = font(11, 0.94, 1.02);
	const weekButtonHeight = scale(38, 0.94, 1.02);
	const weekButtonIconSize = icon(14);
	const weekButtonTextSize = font(12, 0.94, 1.04);
	const planLabel = customer.mealsPerDay.lunch && customer.mealsPerDay.dinner
		? 'Lunch + Dinner'
		: customer.mealsPerDay.lunch
			? 'Lunch only'
			: 'Dinner only';
	const locationLabel = [customer.address?.flat, customer.address?.location].filter(Boolean).join(', ') || 'No location';
	const statusLabel = status === 'expired'
		? 'Expired'
		: status === 'expiring-soon'
			? `${daysLeft}d left`
			: `${daysLeft}d active`;
	const hasContactActions = Boolean(customer.mapLink || customer.phone?.trim());
	const isDue = dueAmount > 0;
	const successTone = isDark ? '#54E58B' : colors.success;
	const warningTone = isDark ? '#FFB84D' : colors.warning;
	const dangerTone = isDark ? '#FF6B5F' : colors.danger;
	const statusTone = status === 'expired'
		? dangerTone
		: isDue
			? warningTone
			: successTone;
	const paymentTone = isDue ? (status === 'expired' ? dangerTone : warningTone) : successTone;
	const paymentValue = isDue ? `DHS ${dueAmount} due` : 'Settled';
	const initials = getInitials(customer.name);
	const cardSurface = isDark ? '#17181D' : '#FFFDF8';
	const cardBorder = isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(42, 30, 19, 0.055)';
	const dividerColor = isDark ? 'rgba(255, 255, 255, 0.075)' : 'rgba(42, 30, 19, 0.07)';
	const subtleDividerColor = isDark ? 'rgba(255, 255, 255, 0.065)' : 'rgba(0, 0, 0, 0.05)';
	const secondaryTextColor = isDark ? '#CED0D8' : colors.textSecondary;
	const mutedTextColor = isDark ? '#9296A3' : colors.textMuted;
	const translateX = useSharedValue(0);
	const pressDepth = useSharedValue(0);
	const holdProgress = useSharedValue(0);
	const deleteArmed = useSharedValue(0);
	const deleteBusyRef = useRef(false);

	const playArmHaptic = useCallback(() => {
		if (Platform.OS !== 'web') {
			void Haptics.selectionAsync().catch(() => undefined);
		}
	}, []);

	const triggerDeleteIntent = useCallback((source: 'hold' | 'swipe') => {
		if (deleteBusyRef.current) {
			return;
		}

		deleteBusyRef.current = true;

		if (Platform.OS !== 'web') {
			void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
		}

		translateX.value = withSpring(source === 'swipe' ? -92 : -18, {
			damping: 18,
			stiffness: 250,
			mass: 0.8,
		}, () => {
			translateX.value = withSpring(0, {
				damping: 20,
				stiffness: 230,
				mass: 0.75,
			});
		});
		holdProgress.value = withTiming(0, { duration: Theme.animation.duration.fast });
		pressDepth.value = withSpring(0, { damping: 20, stiffness: 260 });

		setTimeout(() => {
			deleteArmed.value = 0;
			deleteBusyRef.current = false;
			void Promise.resolve(onDelete(customer)).catch(() => undefined);
		}, 170);
	}, [customer, deleteArmed, holdProgress, onDelete, pressDepth, translateX]);

	const handleHoldStart = () => {
		pressDepth.value = withSpring(1, {
			damping: 18,
			stiffness: 260,
			mass: 0.55,
		});
		holdProgress.value = withTiming(1, { duration: 560 });
	};

	const handleHoldEnd = () => {
		if (!deleteBusyRef.current) {
			pressDepth.value = withSpring(0, {
				damping: 18,
				stiffness: 260,
				mass: 0.55,
			});
			holdProgress.value = withTiming(0, { duration: Theme.animation.duration.fast });
		}
	};

	const swipeGesture = Gesture.Pan()
		.activeOffsetX([-14, 14])
		.failOffsetY([-18, 18])
		.onBegin(() => {
			pressDepth.value = withSpring(0, { damping: 18, stiffness: 260 });
		})
		.onUpdate((event) => {
			const nextX = event.translationX < 0
				? Math.max(event.translationX * 0.9, -108)
				: Math.min(event.translationX * 0.14, 8);
			translateX.value = nextX;

			const nextArmed = nextX <= -74 ? 1 : 0;
			if (nextArmed !== deleteArmed.value) {
				deleteArmed.value = nextArmed;
				if (nextArmed) {
					runOnJS(playArmHaptic)();
				}
			}
		})
		.onEnd((event) => {
			const shouldDelete = translateX.value <= -94 || (translateX.value <= -42 && event.velocityX <= -720);

			if (shouldDelete) {
				runOnJS(triggerDeleteIntent)('swipe');
				return;
			}

			deleteArmed.value = 0;
			translateX.value = withSpring(0, {
				damping: 20,
				stiffness: 230,
				mass: 0.72,
				velocity: event.velocityX,
			});
		});

	const cardMotionStyle = useAnimatedStyle(() => {
		const scale = interpolate(translateX.value, [-108, 0, 8], [0.982, 1 - pressDepth.value * 0.012, 0.997], Extrapolation.CLAMP);
		const rotate = interpolate(translateX.value, [-108, 0, 8], [-0.55, 0, 0.08], Extrapolation.CLAMP);

		return {
			transform: [
				{ translateX: translateX.value },
				{ rotate: `${rotate}deg` },
				{ scale },
			],
		};
	});

	const deleteActionStyle = useAnimatedStyle(() => {
		const progress = interpolate(translateX.value, [-96, -22], [1, 0], Extrapolation.CLAMP);
		const scale = interpolate(translateX.value, [-108, -28], [1.04, 0.88], Extrapolation.CLAMP);

		return {
			opacity: progress,
			transform: [{ scale }],
		};
	});

	const deleteRailStyle = useAnimatedStyle(() => {
		const progress = interpolate(translateX.value, [-108, -16], [1, 0], Extrapolation.CLAMP);
		return {
			opacity: interpolate(progress, [0, 1], [0.55, 1], Extrapolation.CLAMP),
			transform: [
				{ scaleX: interpolate(progress, [0, 1], [0.92, 1], Extrapolation.CLAMP) },
			],
		};
	});

	const holdGlowStyle = useAnimatedStyle(() => ({
		opacity: holdProgress.value * 0.14,
		transform: [{ scale: 0.985 + holdProgress.value * 0.015 }],
	}));

	const openMapLink = () => {
		const link = customer.mapLink;
		if (!link) {
			return;
		}

		Linking.canOpenURL(link).then((supported) => {
			if (supported) {
				Linking.openURL(link);
			} else {
				showToast({ type: 'error', title: 'Cannot open link', message: 'The map link may be invalid.' });
			}
		});
	};

	const openWhatsApp = async () => {
		const rawPhone = customer.phone?.trim();
		if (!rawPhone) {
			showToast({ type: 'warning', title: 'No phone number', message: 'Add a phone number for this customer first.' });
			return;
		}

		const digits = rawPhone.replace(/\D/g, '');
		if (!digits) {
			showToast({ type: 'warning', title: 'Invalid phone', message: 'This customer phone number is not valid for WhatsApp.' });
			return;
		}

		const normalizedPhone = digits.startsWith('971')
			? digits
			: digits.length === 10 && digits.startsWith('0')
				? `971${digits.slice(1)}`
				: digits;

		const appUrl = `whatsapp://send?phone=${normalizedPhone}`;
		const webUrl = `https://wa.me/${normalizedPhone}`;

		try {
			const canOpenApp = await Linking.canOpenURL(appUrl);
			if (canOpenApp) {
				await Linking.openURL(appUrl);
				return;
			}

			await Linking.openURL(webUrl);
		} catch {
			showToast({ type: 'error', title: 'Cannot open WhatsApp', message: 'Please check the customer phone number.' });
		}
	};

	return (
		<View style={styles.gestureShell}>
			<Reanimated.View
				pointerEvents="none"
				style={[
					styles.deleteReveal,
					deleteRailStyle,
					{
						backgroundColor: isDark ? 'rgba(255, 107, 95, 0.18)' : 'rgba(255, 69, 58, 0.10)',
						borderColor: isDark ? 'rgba(255, 107, 95, 0.30)' : 'rgba(255, 69, 58, 0.14)',
					},
				]}
			>
				<Reanimated.View
					style={[
						styles.deleteAction,
						deleteActionStyle,
					]}
				>
					<Trash2 size={18} color={dangerTone} strokeWidth={2.6} />
					<Text style={[styles.deleteActionText, { color: dangerTone }]}>Delete</Text>
				</Reanimated.View>
			</Reanimated.View>

			<GestureDetector gesture={swipeGesture}>
				<Reanimated.View style={[styles.cardMotion, cardMotionStyle]}>
				<Pressable
					style={styles.cardPressable}
					delayLongPress={620}
					onLongPress={() => triggerDeleteIntent('hold')}
					onPressIn={handleHoldStart}
					onPressOut={handleHoldEnd}
					accessibilityLabel={`Hold or swipe left to delete ${customer.name}`}
				>
					<Reanimated.View
						pointerEvents="none"
						style={[
							styles.holdGlow,
							holdGlowStyle,
							{
								borderColor: dangerTone,
							},
						]}
					/>
					<Card
						style={[
							styles.card,
							{
								backgroundColor: cardSurface,
								borderColor: cardBorder,
							},
							...(!isDark ? [styles.lightCardShadow] : []),
							...(isDark ? [styles.darkCardShadow] : []),
						]}
					>
			<View style={styles.headerRow}>
				<TactilePressable
					containerStyle={styles.identityWrap}
					style={(pressed) => [
						styles.identityButton,
						pressed && {
							backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(42, 30, 19, 0.035)',
						},
					]}
					onPress={() => onAvatarPress(customer)}
					accessibilityLabel={`Open ${customer.name} details`}
				>
					<View
						style={[
							styles.avatar,
							{
								width: avatarSize,
								height: avatarSize,
								borderRadius: avatarSize / 2,
								backgroundColor: `${statusTone}${isDark ? '22' : '15'}`,
								borderColor: `${statusTone}${isDark ? '42' : '24'}`,
								shadowColor: statusTone,
							},
						]}
					>
						<Text style={[styles.avatarText, { color: statusTone }]}>{initials}</Text>
					</View>
					<View style={styles.identityCopy}>
						<View style={styles.nameRow}>
							<Text style={[styles.name, { color: colors.textPrimary, fontSize: customerNameSize }]} numberOfLines={1}>
								{customer.name}
							</Text>
							<View style={[styles.paymentBadge, { backgroundColor: `${paymentTone}${isDark ? '22' : '12'}`, borderColor: `${paymentTone}${isDark ? '44' : '28'}` }]}>
								<Text style={[styles.paymentBadgeText, { color: paymentTone }]} numberOfLines={1}>
									{paymentValue}
								</Text>
							</View>
						</View>
						<View style={styles.planLine}>
							<Text style={[styles.subline, { color: secondaryTextColor, fontSize: planTextSize }]} numberOfLines={1}>
								{statusLabel}
							</Text>
							<Text style={[styles.metaDot, { color: mutedTextColor }]}>·</Text>
							<Utensils size={10} color={mutedTextColor} />
							<Text style={[styles.subline, { color: secondaryTextColor, fontSize: planTextSize }]} numberOfLines={1}>
								{planLabel}
							</Text>
						</View>
					</View>
				</TactilePressable>
			</View>

			<View
				style={[
					styles.inlineMetaRow,
				]}
			>
				<View style={styles.locationMeta}>
					<MapPin size={12} color={mutedTextColor} />
					<Text style={[styles.inlineMetaText, { color: mutedTextColor }]} numberOfLines={1}>
						{locationLabel}
					</Text>
				</View>
				<Text style={[styles.metaDotLight, { color: mutedTextColor }]}>·</Text>
				<View style={styles.priceMeta}>
					<Wallet size={12} color={mutedTextColor} />
					<Text style={[styles.inlineMetaText, styles.priceText, { color: secondaryTextColor }]} numberOfLines={1}>
						DHS {customer.pricePerMonth || 0}/mo
					</Text>
				</View>
			</View>

			<View
				style={[
					styles.bottomRow,
					{
						borderTopColor: dividerColor,
					},
					isCompact && styles.bottomRowCompact,
				]}
			>
				<View style={styles.actionGroup}>
					{hasContactActions && customer.phone?.trim() ? (
						<TactilePressable
							style={(pressed) => [
								styles.quickAction,
								{
									backgroundColor: pressed
										? isDark ? 'rgba(84, 229, 139, 0.16)' : 'rgba(37, 211, 102, 0.10)'
										: 'transparent',
									borderColor: isDark ? 'rgba(84, 229, 139, 0.28)' : 'rgba(37, 211, 102, 0.14)',
								},
							]}
							onPress={openWhatsApp}
							accessibilityLabel={`Message ${customer.name} on WhatsApp`}
						>
							<FontAwesome name="whatsapp" size={scale(15, 0.94, 1.08)} color={isDark ? successTone : '#25D366'} />
							<Text style={[styles.quickActionText, { color: isDark ? successTone : '#1C8F4A' }]}>WhatsApp</Text>
						</TactilePressable>
					) : null}

					{hasContactActions && customer.mapLink ? (
						<TactilePressable
							style={(pressed) => [
								styles.quickAction,
								{
									backgroundColor: pressed
										? isDark ? 'rgba(99, 179, 237, 0.16)' : 'rgba(52, 152, 219, 0.09)'
										: 'transparent',
									borderColor: isDark ? 'rgba(99, 179, 237, 0.28)' : 'rgba(52, 152, 219, 0.12)',
								},
							]}
							onPress={openMapLink}
							accessibilityLabel={`Open map for ${customer.name}`}
						>
							<Navigation2 size={scale(14, 0.94, 1.08)} color={isDark ? '#63B3ED' : '#2E86C1'} />
							<Text style={[styles.quickActionText, { color: isDark ? '#63B3ED' : '#2E86C1' }]}>Map</Text>
						</TactilePressable>
					) : null}
				</View>

				<TactilePressable
					containerStyle={isCompact ? styles.weekButtonWrapCompact : undefined}
					style={(pressed) => [
						styles.weekButton,
						{
							minHeight: weekButtonHeight,
							backgroundColor: expanded
								? pressed
									? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFF1E8')
									: (isDark ? 'rgba(255, 255, 255, 0.065)' : '#FFF7F1')
								: pressed
									? '#E95F2E'
									: colors.primary,
							borderColor: expanded ? 'rgba(255, 107, 53, 0.22)' : colors.primary,
						},
						isCompact && styles.weekButtonCompact,
						!isDark && styles.lightButtonShadow,
					]}
					onPress={() => onToggleExpanded(customer.id)}
					accessibilityLabel={expanded ? `Hide weekly attendance for ${customer.name}` : `Manage weekly attendance for ${customer.name}`}
				>
					{expanded ? (
						<ChevronUp size={weekButtonIconSize} color={colors.textPrimary} />
					) : (
						<CalendarCheck size={weekButtonIconSize} color={colors.textInverted} />
					)}
					<Text style={[styles.weekButtonText, { color: expanded ? colors.textPrimary : colors.textInverted, fontSize: weekButtonTextSize }]}>
						{expanded ? 'Hide Week' : 'Manage Week'}
					</Text>
				</TactilePressable>
			</View>

			{expanded ? (
				<View style={[styles.attendanceWrap, { borderTopColor: colors.border }]}>
					<CustomerAttendancePanel
						customer={customer}
						weekId={weekId}
						weekAttendance={weekAttendance}
						weekMenu={weekMenu}
						onToggle={onToggleAttendance}
						onSave={() => onSaveAttendance(customer.id)}
					/>
				</View>
			) : null}
					</Card>
				</Pressable>
				</Reanimated.View>
			</GestureDetector>
		</View>
	);
}

function getInitials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) {
		return 'DZ';
	}
	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}
	return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const styles = StyleSheet.create({
	gestureShell: {
		marginBottom: 8,
		position: 'relative',
	},
	cardMotion: {
		borderRadius: 22,
	},
	cardPressable: {
		borderRadius: 22,
		position: 'relative',
	},
	deleteReveal: {
		...StyleSheet.absoluteFillObject,
		borderRadius: 22,
		borderWidth: 1,
		alignItems: 'flex-end',
		justifyContent: 'center',
		paddingRight: 22,
		overflow: 'hidden',
	},
	deleteAction: {
		alignItems: 'center',
		justifyContent: 'center',
		gap: 5,
		minWidth: 72,
	},
	deleteActionText: {
		...Theme.typography.detailBold,
		letterSpacing: 0,
	},
	holdGlow: {
		...StyleSheet.absoluteFillObject,
		borderRadius: 22,
		borderWidth: 2,
		zIndex: 2,
	},
	card: {
		marginBottom: 0,
		borderRadius: 22,
		paddingHorizontal: 10,
		paddingVertical: 10,
		borderWidth: 1,
	},
	lightCardShadow: {
		shadowColor: '#000000',
		shadowOpacity: 0.08,
		shadowRadius: 18,
		shadowOffset: { width: 0, height: 6 },
		elevation: 4,
	},
	darkCardShadow: {
		shadowColor: '#000000',
		shadowOpacity: 0.28,
		shadowRadius: 20,
		shadowOffset: { width: 0, height: 10 },
		elevation: 5,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
	},
	identityWrap: {
		flex: 1,
		minWidth: 0,
	},
	identityButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 9,
		flex: 1,
		minWidth: 0,
		borderRadius: 18,
		padding: 2,
		marginLeft: -2,
	},
	identityCopy: {
		flex: 1,
		minWidth: 0,
	},
	avatar: {
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		shadowOpacity: 0.06,
		shadowRadius: 9,
		shadowOffset: { width: 0, height: 4 },
		elevation: 1,
	},
	avatarText: {
		fontSize: 14,
		fontWeight: '900',
		letterSpacing: 0,
	},
	name: {
		fontWeight: '800',
		letterSpacing: -0.2,
		flexShrink: 1,
	},
	nameRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		minWidth: 0,
	},
	paymentBadge: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 9999,
		borderWidth: 1,
		flexShrink: 0,
	},
	paymentBadgeText: {
		fontSize: 10,
		fontWeight: '700',
		letterSpacing: 0.2,
	},
	planLine: {
		marginTop: 2,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		minWidth: 0,
	},
	subline: {
		fontWeight: '500',
		flexShrink: 1,
	},
	inlineMetaRow: {
		marginTop: 6,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		minWidth: 0,
	},
	locationMeta: {
		flex: 1,
		minWidth: 0,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
	},
	priceMeta: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		flexShrink: 0,
	},
	metaDot: {
		fontSize: 11,
		fontWeight: '600',
		lineHeight: 13,
	},
	metaDotLight: {
		fontSize: 11,
		fontWeight: '400',
		lineHeight: 13,
	},
	inlineMetaText: {
		...Theme.typography.detail,
		fontSize: 11,
		flexShrink: 1,
	},
	priceText: {
		fontWeight: '700',
	},
	bottomRow: {
		marginTop: 7,
		paddingTop: 8,
		borderTopWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
	},
	bottomRowCompact: {
		flexDirection: 'column',
		alignItems: 'stretch',
	},
	actionGroup: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		flexWrap: 'wrap',
		flex: 1,
	},
	weekButton: {
		paddingHorizontal: 15,
		paddingVertical: 7,
		borderRadius: 10,
		borderWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
	},
	weekButtonCompact: {
		width: '100%',
		justifyContent: 'center',
	},
	weekButtonWrapCompact: {
		width: '100%',
	},
	weekButtonText: {
		...Theme.typography.detailBold,
		letterSpacing: 0,
	},
	lightButtonShadow: {
		shadowColor: '#C85B2F',
		shadowOpacity: 0.22,
		shadowRadius: 14,
		shadowOffset: { width: 0, height: 8 },
		elevation: 3,
	},
	attendanceWrap: {
		marginTop: Theme.spacing.sm,
		paddingTop: Theme.spacing.sm,
		borderTopWidth: 1,
	},
	quickAction: {
		minHeight: 32,
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 8,
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		gap: 6,
	},
	quickActionText: {
		...Theme.typography.detailBold,
		letterSpacing: 0,
	},
});
