import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/Theme';
import { Badge } from './Badge';
import { UserAvatar } from './UserAvatar';

interface CustomerIntelligenceDetailProps {
	customer: any;
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
	const planLabel = [
		customer.mealsPerDay?.lunch && "LUNCH",
		customer.mealsPerDay?.dinner && "DINNER"
	].filter(Boolean).join(" / ") || "NO PLAN";

	return (
		<View style={styles.container}>
			{/* Top Section: Identity & Status */}
			<View style={styles.topSection}>
				<UserAvatar name={customer.name} size={64} fontSize={24} />
				<Text style={styles.name}>{customer.name}</Text>
				<Text style={styles.planText}>{planLabel}</Text>

				{customer.address?.location && (
					<View style={styles.addressContainer}>
						<MaterialCommunityIcons name="map-marker-outline" size={14} color={Theme.colors.textMuted} />
						<Text style={styles.addressText}>
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

			<View style={styles.divider} />

			{/* Middle Section: Financial Intelligence */}
			<View style={styles.middleSection}>
				<Text style={styles.sectionTitle}>Financial Summary</Text>
				<View style={styles.financeRow}>
					<View style={styles.financeItem}>
						<Text style={styles.financeLabel}>Total Paid</Text>
						<Text style={styles.financeValue}>DHS {customer.totalPaid || 0}</Text>
					</View>
					<View style={styles.financeItem}>
						<Text style={styles.financeLabel}>Plan Price</Text>
						<Text style={styles.financeValue}>DHS {customer.pricePerMonth}</Text>
					</View>
				</View>
				<View style={[styles.financeRow, { marginTop: Theme.spacing.md }]}>
					<View style={styles.financeItem}>
						<Text style={styles.financeLabel}>Last Payment</Text>
						<Text style={styles.financeValue}>---</Text>
					</View>
				</View>
			</View>

			<View style={styles.divider} />

			{/* Bottom Section: Action Grid */}
			<View style={styles.bottomSection}>
				<View style={styles.actionGrid}>
					<TouchableOpacity style={styles.actionItem} onPress={() => onAction('attendance')}>
						<MaterialCommunityIcons name="calendar-check" size={18} color={Theme.colors.primary} />
						<Text style={styles.actionText}>Set Week</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.actionItem} onPress={() => onAction('payment')}>
						<MaterialCommunityIcons name="cash-register" size={18} color={Theme.colors.primary} />
						<Text style={styles.actionText}>Record Payment</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.actionItem} onPress={() => onAction('edit')}>
						<MaterialCommunityIcons name="account-edit-outline" size={18} color={Theme.colors.textSecondary} />
						<Text style={[styles.actionText, { color: Theme.colors.textSecondary }]}>Edit</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.actionItem} onPress={() => onAction('delete')}>
						<MaterialCommunityIcons name="delete-outline" size={18} color={Theme.colors.danger} />
						<Text style={[styles.actionText, { color: Theme.colors.danger }]}>Delete</Text>
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
		color: Theme.colors.textPrimary,
		fontSize: 24,
		textAlign: 'center',
	},
	planText: {
		...Theme.typography.detailBold,
		color: Theme.colors.primary,
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
		color: Theme.colors.textMuted,
	},
	badgeRow: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.xs,
	},
	divider: {
		height: 1,
		backgroundColor: Theme.colors.border,
		opacity: 0.5,
	},
	middleSection: {
		gap: Theme.spacing.md,
	},
	sectionTitle: {
		...Theme.typography.label,
		color: Theme.colors.textMuted,
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
		color: Theme.colors.textMuted,
	},
	financeValue: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
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
		color: Theme.colors.primary,
		fontSize: 13,
	},
});
