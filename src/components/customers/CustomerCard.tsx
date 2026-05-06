import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
	onDelete,
	onToggleExpanded,
	onToggleAttendance,
	onSaveAttendance,
}: CustomerCardProps) {
	const { colors, isDark } = useAppTheme();
	const { isCompact } = useResponsiveLayout();
	const status = getCustomerStatus(toDate(customer.endDate));
	const dueAmount = getDueAmount(customer.pricePerMonth, customer.totalPaid);
	const daysLeft = getDaysLeft(toDate(customer.endDate));
	const dayBadgeLabel = daysLeft < 0 ? `-${Math.abs(daysLeft)}d` : `${daysLeft}d`;
	const dayBadgeVariant = status === 'expired' ? 'danger' : status === 'expiring-soon' ? 'warning' : 'success';

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
			<View style={[styles.topRow, isCompact && styles.topRowStacked]}>
				<TouchableOpacity
					style={styles.identityButton}
					activeOpacity={0.82}
					onPress={() => onAvatarPress(customer)}
				>
					<UserAvatar name={customer.name} size={48} fontSize={16} />
					<View style={styles.identityCopy}>
						<Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
							{customer.name}
						</Text>
						<Text style={[styles.identityHint, { color: colors.textMuted }]} numberOfLines={1}>
							Tap for details
						</Text>
					</View>
				</TouchableOpacity>

				<View style={[styles.statusRow, isCompact && styles.statusRowCompact]}>
					{status === 'expired' ? <Badge label="EXPIRED" variant="danger" style={styles.badgeTight} /> : null}
					{dueAmount > 0 ? <Badge label="DUE" variant="warning" style={styles.badgeTight} /> : null}
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
										backgroundColor: isDark ? 'rgba(255, 107, 53, 0.16)' : '#FFF1E8',
										borderColor: isDark ? 'rgba(255, 107, 53, 0.35)' : '#FFD7C5',
									},
								]}
							>
								<Text style={[styles.mealDotText, { color: colors.primary }]}>L</Text>
							</View>
						) : null}
						{customer.mealsPerDay.dinner ? (
							<View
								style={[
									styles.mealDot,
									{
										backgroundColor: isDark ? 'rgba(124, 58, 237, 0.18)' : '#F1EAFF',
										borderColor: isDark ? 'rgba(124, 58, 237, 0.35)' : '#D5C2FF',
									},
								]}
							>
								<Text style={[styles.mealDotText, { color: colors.mealDinner }]}>D</Text>
							</View>
						) : null}
					</View>

					<Badge label={dayBadgeLabel} variant={dayBadgeVariant} style={styles.badgeTight} />
				</View>

				<TouchableOpacity
					style={[
						styles.weekButton,
						{
							backgroundColor: expanded ? (isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFF6EF') : colors.primary,
							borderColor: expanded ? colors.border : colors.primary,
						},
						!isDark && styles.lightButtonShadow,
					]}
					onPress={() => onToggleExpanded(customer.id)}
					activeOpacity={0.88}
				>
					<MaterialCommunityIcons
						name={expanded ? 'chevron-up' : 'calendar-edit'}
						size={15}
						color={expanded ? colors.textPrimary : colors.textInverted}
					/>
					<Text style={[styles.weekButtonText, { color: expanded ? colors.textPrimary : colors.textInverted }]}>
						{expanded ? 'HIDE WEEK' : 'SET WEEK'}
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
		borderRadius: 22,
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.md,
	},
	lightCardShadow: {
		shadowColor: '#2A1E13',
		shadowOpacity: 0.08,
		shadowRadius: 22,
		shadowOffset: { width: 0, height: 10 },
		elevation: 3,
	},
	topRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	topRowStacked: {
		alignItems: 'flex-start',
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
	name: {
		...Theme.typography.labelMedium,
		fontSize: 19,
	},
	identityHint: {
		...Theme.typography.detail,
		marginTop: 2,
	},
	statusRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'flex-end',
		gap: Theme.spacing.xs,
		maxWidth: '42%',
	},
	statusRowCompact: {
		maxWidth: '100%',
		justifyContent: 'flex-start',
	},
	badgeTight: {
		paddingHorizontal: Theme.spacing.sm,
		paddingVertical: 5,
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
	},
	mealDots: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.xs,
	},
	mealDot: {
		width: 30,
		height: 30,
		borderRadius: 15,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
	},
	mealDotText: {
		...Theme.typography.detailBold,
		fontSize: 13,
	},
	weekButton: {
		minHeight: 38,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		borderRadius: Theme.radius.full,
		borderWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	weekButtonText: {
		...Theme.typography.detailBold,
		fontSize: 12,
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
});
