import { MapPin, CalendarCheck, Banknote, UserPen, Trash2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { Badge } from './Badge';
import { UserAvatar } from './UserAvatar';

type IntelligenceCustomer = {
	name: string;
	mealsPerDay?: { lunch?: boolean; dinner?: boolean };
	address?: { location?: string; flat?: string };
	totalPaid?: number;
	pricePerMonth?: number;
};

interface CustomerIntelligenceDetailProps {
	customer: IntelligenceCustomer;
	daysLeft: number;
	dueAmount: number;
	onAction: (type: 'attendance' | 'payment' | 'edit' | 'delete') => void;
}

export const CustomerIntelligenceDetail: React.FC<CustomerIntelligenceDetailProps> = ({
	customer,
	daysLeft,
	dueAmount,
	onAction,
}) => {
	const { colors } = useAppTheme();
	const planLabel = [
		customer.mealsPerDay?.lunch && "LUNCH",
		customer.mealsPerDay?.dinner && "DINNER"
	].filter(Boolean).join(" / ") || "NO PLAN";

	return (
		<View style={styles.container}>
			{/* Top Section: Identity & Status */}
			<View style={styles.topSection}>
				<UserAvatar name={customer.name} size={64} fontSize={24} />
				<Text style={[styles.name, { color: colors.textPrimary }]}>{customer.name}</Text>
				<Text style={[styles.planText, { color: colors.primary }]}>{planLabel}</Text>

				{customer.address?.location && (
					<View style={styles.addressContainer}>
						<MapPin size={14} color={colors.textMuted} />
						<Text style={[styles.addressText, { color: colors.textMuted }]}>
							{customer.address.flat ? `${customer.address.flat}, ` : ''}{customer.address.location}
						</Text>
					</View>
				)}

				<View style={styles.badgeRow}>
					<Badge
						label={`${daysLeft} DAYS LEFT`}
						variant={daysLeft < 0 ? 'danger' : daysLeft < 5 ? 'warning' : 'success'}
					/>
					{dueAmount > 0 && (
						<Badge label={`DHS ${dueAmount} DUE`} variant="danger" />
					)}
				</View>
			</View>

			<View style={[styles.divider, { backgroundColor: colors.border }]} />

			{/* Middle Section: Financial Intelligence */}
			<View style={styles.middleSection}>
				<Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Financial Summary</Text>
				<View style={styles.financeRow}>
					<View style={styles.financeItem}>
						<Text style={[styles.financeLabel, { color: colors.textMuted }]}>Total Paid</Text>
						<Text style={[styles.financeValue, { color: colors.textPrimary }]}>DHS {customer.totalPaid || 0}</Text>
					</View>
					<View style={styles.financeItem}>
						<Text style={[styles.financeLabel, { color: colors.textMuted }]}>Plan Price</Text>
						<Text style={[styles.financeValue, { color: colors.textPrimary }]}>DHS {customer.pricePerMonth ?? 0}</Text>
					</View>
				</View>
				<View style={[styles.financeRow, { marginTop: Theme.spacing.md }]}>
					<View style={styles.financeItem}>
						<Text style={[styles.financeLabel, { color: colors.textMuted }]}>Last Payment</Text>
						<Text style={[styles.financeValue, { color: colors.textPrimary }]}>---</Text>
					</View>
				</View>
			</View>

			<View style={[styles.divider, { backgroundColor: colors.border }]} />

			{/* Bottom Section: Action Grid */}
			<View style={styles.bottomSection}>
				<View style={styles.actionGrid}>
					<TouchableOpacity style={styles.actionItem} onPress={() => onAction('attendance')}>
						<CalendarCheck size={18} color={colors.primary} />
						<Text style={[styles.actionText, { color: colors.primary }]}>Set Week</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.actionItem} onPress={() => onAction('payment')}>
						<Banknote size={18} color={colors.primary} />
						<Text style={[styles.actionText, { color: colors.primary }]}>Record Payment</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.actionItem} onPress={() => onAction('edit')}>
						<UserPen size={18} color={colors.textSecondary} />
						<Text style={[styles.actionText, { color: colors.textSecondary }]}>Edit</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.actionItem} onPress={() => onAction('delete')}>
						<Trash2 size={18} color={colors.danger} />
						<Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		gap: Theme.spacing.lg,
	},
	topSection: {
		alignItems: 'center',
		gap: Theme.spacing.sm,
	},
	name: {
		...Theme.typography.answer,
		fontSize: 24,
		textAlign: 'center',
	},
	planText: {
		...Theme.typography.detailBold,
		letterSpacing: 1,
	},
	addressContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: 2,
	},
	addressText: {
		...Theme.typography.detail,
	},
	badgeRow: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.xs,
	},
	divider: {
		height: 1,
		opacity: 0.5,
	},
	middleSection: {
		gap: Theme.spacing.md,
	},
	sectionTitle: {
		...Theme.typography.label,
		fontSize: 10,
		letterSpacing: 1.5,
		textTransform: 'uppercase',
	},
	financeRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	financeItem: {
		flex: 1,
	},
	financeLabel: {
		...Theme.typography.detail,
	},
	financeValue: {
		...Theme.typography.labelMedium,
		marginTop: 2,
	},
	bottomSection: {
		marginTop: Theme.spacing.sm,
	},
	actionGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Theme.spacing.md,
	},
	actionItem: {
		flex: 1,
		minWidth: '45%',
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		paddingVertical: Theme.spacing.sm,
	},
	actionText: {
		...Theme.typography.detailBold,
		fontSize: 13,
	},
});
