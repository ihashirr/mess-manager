import { ChevronRight, ChevronUp, CalendarCheck, Navigation2, MapPin, Wallet } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { showToast } from '../system/feedback/AppToast';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { UserAvatar } from '../ui/UserAvatar';
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
	onDelete: (id: string) => void;
	onToggleExpanded: (id: string) => void;
	onToggleAttendance: (day: DayName, meal: 'lunch' | 'dinner') => void;
	onSaveAttendance: (id: string) => void;
}

export function CustomerCard({
	customer,
	expanded,
	weekId,
	weekAttendance,
	weekMenu,
	onAvatarPress,
	onToggleExpanded,
	onToggleAttendance,
	onSaveAttendance,
}: CustomerCardProps) {
	const { colors, isDark } = useAppTheme();
	const { isCompact, scale, font, icon } = useResponsiveLayout();
	const status = getCustomerStatus(toDate(customer.endDate));
	const dueAmount = getDueAmount(customer.pricePerMonth, customer.totalPaid);
	const daysLeft = getDaysLeft(toDate(customer.endDate));
	const avatarSize = scale(isCompact ? 42 : 46, 0.94, 1.08);
	const avatarFontSize = font(isCompact ? 14 : 15, 0.94, 1.08);
	const customerNameSize = font(isCompact ? 17 : 18, 0.94, 1.08);
	const mealDotSize = scale(28, 0.94, 1.08);
	const mealDotRadius = mealDotSize / 2;
	const mealDotTextSize = font(12, 0.94, 1.08);
	const weekButtonHeight = scale(38, 0.94, 1.08);
	const weekButtonIconSize = icon(15);
	const weekButtonTextSize = font(12, 0.94, 1.08);
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
		<Card
			style={[
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
				},
				...(!isDark ? [styles.lightCardShadow] : []),
			]}
		>
			<View style={[styles.headerRow, isCompact && styles.headerRowCompact]}>
				<TouchableOpacity
					style={styles.identityButton}
					activeOpacity={0.82}
					onPress={() => onAvatarPress(customer)}
				>
					<UserAvatar name={customer.name} size={avatarSize} fontSize={avatarFontSize} />
					<View style={styles.identityCopy}>
						<Text style={[styles.name, { color: colors.textPrimary, fontSize: customerNameSize }]} numberOfLines={1}>
							{customer.name}
						</Text>
						<View style={styles.identityMetaRow}>
							<Text style={[styles.subline, { color: colors.textSecondary }]} numberOfLines={1}>
								{planLabel}
							</Text>
							<View style={[styles.tapHint, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
								<Text style={[styles.tapHintText, { color: colors.textSecondary }]}>Details</Text>
								<ChevronRight size={12} color={colors.textMuted} />
							</View>
						</View>
					</View>
				</TouchableOpacity>

				<View style={[styles.badgeRow, isCompact && styles.badgeRowCompact]}>
					<Badge
						label={statusLabel}
						variant={status === 'expired' ? 'danger' : status === 'expiring-soon' ? 'warning' : 'success'}
						style={styles.badgeTight}
					/>
					{dueAmount > 0 ? <Badge label={`DHS ${dueAmount} due`} variant="warning" style={styles.badgeTight} /> : null}
				</View>
			</View>

			<View style={[styles.metaRow, isCompact && styles.metaRowCompact]}>
				<View style={[styles.metaItemCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
					<Text style={[styles.metaLabel, { color: colors.textMuted }]}>Location</Text>
					<View style={styles.metaValueRow}>
						<MapPin size={13} color={colors.textMuted} />
						<Text style={[styles.metaText, { color: colors.textPrimary }]} numberOfLines={1}>
							{locationLabel}
						</Text>
					</View>
				</View>
				<View style={[styles.metaItemCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
					<Text style={[styles.metaLabel, { color: colors.textMuted }]}>Monthly plan</Text>
					<View style={styles.metaValueRow}>
						<Wallet size={13} color={colors.textMuted} />
						<Text style={[styles.metaText, { color: colors.textPrimary }]} numberOfLines={1}>
							DHS {customer.pricePerMonth || 0}
						</Text>
					</View>
				</View>
			</View>

			<View
				style={[
					styles.bottomRow,
					{
						borderTopColor: colors.border,
					},
					isCompact && styles.bottomRowCompact,
				]}
			>
				<View style={styles.compactInfo}>
					<View style={styles.mealDots}>
						{customer.mealsPerDay.lunch ? (
							<View
								style={[
									styles.mealDot,
									{
										width: mealDotSize,
										height: mealDotSize,
										borderRadius: mealDotRadius,
										backgroundColor: isDark ? 'rgba(255, 107, 53, 0.16)' : '#FFF1E8',
										borderColor: isDark ? 'rgba(255, 107, 53, 0.35)' : '#FFD7C5',
									},
								]}
							>
								<Text style={[styles.mealDotText, { color: colors.primary, fontSize: mealDotTextSize }]}>L</Text>
							</View>
						) : null}
						{customer.mealsPerDay.dinner ? (
							<View
								style={[
									styles.mealDot,
									{
										width: mealDotSize,
										height: mealDotSize,
										borderRadius: mealDotRadius,
										backgroundColor: isDark ? 'rgba(124, 58, 237, 0.18)' : '#F1EAFF',
										borderColor: isDark ? 'rgba(124, 58, 237, 0.35)' : '#D5C2FF',
									},
								]}
							>
								<Text style={[styles.mealDotText, { color: colors.mealDinner, fontSize: mealDotTextSize }]}>D</Text>
							</View>
						) : null}
					</View>

					{hasContactActions ? (
						<View style={styles.actionGroup}>
							{customer.mapLink ? (
								<TouchableOpacity
									style={[
										styles.quickAction,
										{
											backgroundColor: isDark ? 'rgba(52, 152, 219, 0.15)' : '#EBF5FB',
											borderColor: isDark ? 'rgba(52, 152, 219, 0.3)' : '#BEE0F5',
										},
									]}
									onPress={openMapLink}
									activeOpacity={0.76}
								>
									<Navigation2 size={scale(14, 0.94, 1.08)} color={isDark ? '#5DADE2' : '#2E86C1'} />
									<Text style={[styles.quickActionText, { color: isDark ? '#5DADE2' : '#2E86C1' }]}>Map</Text>
								</TouchableOpacity>
							) : null}

							{customer.phone?.trim() ? (
								<TouchableOpacity
									style={[
										styles.quickAction,
										{
											backgroundColor: isDark ? 'rgba(37, 211, 102, 0.16)' : '#EAFBF1',
											borderColor: isDark ? 'rgba(37, 211, 102, 0.34)' : '#BFEFD0',
										},
									]}
									onPress={openWhatsApp}
									activeOpacity={0.76}
									accessibilityRole="button"
									accessibilityLabel={`Message ${customer.name} on WhatsApp`}
								>
									<FontAwesome name="whatsapp" size={scale(15, 0.94, 1.08)} color="#25D366" />
									<Text style={[styles.quickActionText, { color: '#1C8F4A' }]}>WhatsApp</Text>
								</TouchableOpacity>
							) : null}
						</View>
					) : null}
				</View>

				<TouchableOpacity
					style={[
						styles.weekButton,
						{
							minHeight: weekButtonHeight,
							backgroundColor: expanded ? (isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFF6EF') : colors.primary,
							borderColor: expanded ? colors.border : colors.primary,
						},
						isCompact && styles.weekButtonCompact,
						!isDark && styles.lightButtonShadow,
					]}
					onPress={() => onToggleExpanded(customer.id)}
					activeOpacity={0.88}
				>
					{expanded ? (
						<ChevronUp size={weekButtonIconSize} color={colors.textPrimary} />
					) : (
						<CalendarCheck size={weekButtonIconSize} color={colors.textInverted} />
					)}
					<Text style={[styles.weekButtonText, { color: expanded ? colors.textPrimary : colors.textInverted, fontSize: weekButtonTextSize }]}>
						{expanded ? 'Hide week' : 'Manage week'}
					</Text>
				</TouchableOpacity>
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
	);
}

const styles = StyleSheet.create({
	card: {
		marginBottom: Theme.spacing.xl,
		borderRadius: 20,
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.md,
	},
	lightCardShadow: {
		shadowColor: '#2A1E13',
		shadowOpacity: 0.08,
		shadowRadius: 18,
		shadowOffset: { width: 0, height: 8 },
		elevation: 3,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	headerRowCompact: {
		flexDirection: 'column',
	},
	identityButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.md,
		flex: 1,
		minWidth: 0,
	},
	identityCopy: {
		flex: 1,
		minWidth: 0,
	},
	identityMetaRow: {
		marginTop: 4,
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: Theme.spacing.sm,
	},
	name: {
		...Theme.typography.labelMedium,
	},
	subline: {
		...Theme.typography.detail,
		flexShrink: 1,
	},
	tapHint: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingHorizontal: Theme.spacing.sm,
		paddingVertical: 4,
		borderRadius: Theme.radius.full,
		borderWidth: 1,
	},
	tapHintText: {
		...Theme.typography.detailBold,
		fontSize: 10,
	},
	badgeRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'flex-end',
		gap: Theme.spacing.xs,
		maxWidth: '45%',
	},
	badgeRowCompact: {
		maxWidth: '100%',
		justifyContent: 'flex-start',
	},
	badgeTight: {
		paddingHorizontal: Theme.spacing.sm,
		paddingVertical: 5,
	},
	metaRow: {
		marginTop: Theme.spacing.md,
		flexDirection: 'row',
		alignItems: 'stretch',
		gap: Theme.spacing.sm,
	},
	metaRowCompact: {
		flexDirection: 'column',
	},
	metaItemCard: {
		flex: 1,
		borderRadius: Theme.radius.lg,
		borderWidth: 1,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
	},
	metaLabel: {
		...Theme.typography.detailBold,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	metaValueRow: {
		marginTop: 6,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		minWidth: 0,
	},
	metaText: {
		...Theme.typography.detailBold,
		flex: 1,
	},
	bottomRow: {
		marginTop: Theme.spacing.md,
		paddingTop: Theme.spacing.md,
		borderTopWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	bottomRowCompact: {
		flexDirection: 'column',
		alignItems: 'flex-start',
	},
	compactInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		flexWrap: 'wrap',
		flex: 1,
	},
	actionGroup: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		flexWrap: 'wrap',
	},
	mealDots: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.xs,
	},
	mealDot: {
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
	},
	mealDotText: {
		...Theme.typography.detailBold,
	},
	weekButton: {
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		borderRadius: Theme.radius.full,
		borderWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	weekButtonCompact: {
		width: '100%',
		justifyContent: 'center',
	},
	weekButtonText: {
		...Theme.typography.detailBold,
		letterSpacing: 0.2,
	},
	lightButtonShadow: {
		shadowColor: '#C85B2F',
		shadowOpacity: 0.14,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 6 },
		elevation: 2,
	},
	attendanceWrap: {
		marginTop: Theme.spacing.md,
		paddingTop: Theme.spacing.md,
		borderTopWidth: 1,
	},
	quickAction: {
		minHeight: 34,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: 7,
		borderRadius: Theme.radius.full,
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		gap: 6,
	},
	quickActionText: {
		...Theme.typography.detailBold,
	},
});
