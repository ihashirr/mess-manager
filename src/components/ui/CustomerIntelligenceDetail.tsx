import { MapPin, Banknote, UserPen, Trash2, Navigation2, FileText, Phone, MessageCircle, ExternalLink } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { type Customer } from '../customers/types';
import { type CustomerSheetEvent } from './sheetTypes';
import { toDate } from '../../utils/customerLogic';

interface CustomerIntelligenceDetailProps {
	customer: Customer;
	daysLeft: number;
	dueAmount: number;
	onAction: (event: CustomerSheetEvent) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	const { colors } = useAppTheme();
	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
			<View style={[styles.sectionContent, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
				{children}
			</View>
		</View>
	);
}

export const CustomerIntelligenceDetail: React.FC<CustomerIntelligenceDetailProps> = ({
	customer,
	daysLeft,
	dueAmount,
	onAction,
}) => {
	const { colors, isDark } = useAppTheme();
	const planLabel = customer.mealsPerDay.lunch && customer.mealsPerDay.dinner
		? 'Lunch + Dinner'
		: customer.mealsPerDay.lunch
			? 'Lunch only'
			: 'Dinner only';

	const statusText = daysLeft < 0 ? 'Expired' : 'Active';
	const statusTone = daysLeft < 0 ? colors.danger : colors.success;

	const formatSafeDate = (d: unknown) => {
		const date = toDate(d);
		return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	};

	const initials = customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

	const openWhatsApp = () => {
		if (customer.phone) {
			Linking.openURL(`whatsapp://send?phone=${customer.phone}`);
		}
	};

	const openMaps = () => {
		if (customer.mapLink) {
			Linking.openURL(customer.mapLink);
		}
	};

	const makeCall = () => {
		if (customer.phone) {
			Linking.openURL(`tel:${customer.phone}`);
		}
	};

	// Progress bar calculation
	const totalDays = 30; // Assuming a standard month for progress
	const progress = Math.max(0, Math.min(1, daysLeft / totalDays));

	return (
		<View style={styles.container}>
			{/* Top Operational Hero */}
			<View style={[styles.hero, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.6)' }]}>
				<View style={styles.heroTop}>
					<View style={[styles.heroAvatar, { backgroundColor: colors.primary + '18' }]}>
						<Text style={[styles.heroAvatarText, { color: colors.primary }]}>{initials}</Text>
					</View>
					<View style={styles.heroIdentity}>
						<Text style={[styles.heroName, { color: colors.textPrimary }]} numberOfLines={1}>{customer.name}</Text>
						<Text style={[styles.heroPlan, { color: colors.textSecondary }]}>{planLabel} • {customer.address?.location || 'No Location'}</Text>
						<Text style={[styles.heroMetaValue, { color: statusTone, marginTop: 4 }]}>● {statusText} • {daysLeft}d left</Text>
					</View>
				</View>
			</View>

			{/* Quick Action Strip */}
			<View style={styles.actionStrip}>
				<TouchableOpacity style={[styles.stripBtn, { backgroundColor: '#E8F8F5' }]} onPress={openWhatsApp}>
					<MessageCircle size={16} color="#27AE60" />
					<Text style={[styles.stripBtnText, { color: '#27AE60' }]}>WhatsApp</Text>
				</TouchableOpacity>
				<TouchableOpacity style={[styles.stripBtn, { backgroundColor: '#EBF5FB' }]} onPress={openMaps}>
					<Navigation2 size={16} color="#2980B9" />
					<Text style={[styles.stripBtnText, { color: '#2980B9' }]}>Route</Text>
				</TouchableOpacity>
				<TouchableOpacity style={[styles.stripBtn, { backgroundColor: '#F2F3F4' }]} onPress={makeCall}>
					<Phone size={16} color="#5D6D7E" />
					<Text style={[styles.stripBtnText, { color: '#5D6D7E' }]}>Call</Text>
				</TouchableOpacity>
				<TouchableOpacity style={[styles.stripBtn, { backgroundColor: colors.primary + '15' }]} onPress={() => onAction({ type: 'customer.payment', customerId: customer.id })}>
					<Banknote size={16} color={colors.primary} />
					<Text style={[styles.stripBtnText, { color: colors.primary }]}>Pay</Text>
				</TouchableOpacity>
			</View>

			{/* Subscription Progress */}
			<View style={styles.progressSection}>
				<View style={styles.progressHeader}>
					<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUBSCRIPTION PROGRESS</Text>
					<Text style={[styles.detailValue, { color: colors.textPrimary }]}>{daysLeft} days left</Text>
				</View>
				<View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
					<View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: statusTone }]} />
				</View>
			</View>

			{/* Financial Summary Cards */}
			<Section title="FINANCIALS">
				<View style={styles.financialGrid}>
					<View style={[styles.financeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
						<Text style={[styles.financeCardValue, { color: colors.textPrimary }]}>DHS {customer.pricePerMonth || 0}</Text>
						<Text style={[styles.financeCardLabel, { color: colors.textMuted }]}>Monthly Plan</Text>
					</View>
					<View style={[styles.financeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
						<Text style={[styles.financeCardValue, { color: dueAmount > 0 ? colors.warning : colors.success }]}>DHS {dueAmount}</Text>
						<Text style={[styles.financeCardLabel, { color: colors.textMuted }]}>Pending</Text>
					</View>
				</View>
			</Section>

			{/* Delivery Section - Action Oriented */}
			<Section title="DELIVERY">
				<TouchableOpacity style={styles.deliveryItem} onPress={openMaps}>
					<MapPin size={18} color={colors.textMuted} />
					<View style={styles.deliveryContent}>
						<Text style={[styles.deliveryTitle, { color: colors.textPrimary }]}>{customer.address?.location || 'No Location'}, {customer.address?.flat || ''}</Text>
						<Text style={[styles.deliverySub, { color: colors.primary }]}>Open in Google Maps</Text>
					</View>
					<ExternalLink size={14} color={colors.primary} />
				</TouchableOpacity>

				<View style={[styles.divider, { backgroundColor: colors.border }]} />

				<TouchableOpacity style={styles.deliveryItem} onPress={makeCall}>
					<Phone size={18} color={colors.textMuted} />
					<View style={styles.deliveryContent}>
						<Text style={[styles.deliveryTitle, { color: colors.textPrimary }]}>{customer.phone || 'No Phone'}</Text>
						<Text style={[styles.deliverySub, { color: colors.primary }]}>Tap to call</Text>
					</View>
				</TouchableOpacity>
			</Section>

			{/* Notes */}
			{customer.notes ? (
				<Section title="OPERATIONAL NOTES">
					<View style={styles.notesBox}>
						<FileText size={14} color={colors.textMuted} />
						<Text style={[styles.notesText, { color: colors.textPrimary }]}>{customer.notes}</Text>
					</View>
				</Section>
			) : null}

			{/* Recent Activity - Timeline UI */}
			<Section title="RECENT ACTIVITY">
				<View style={styles.timeline}>
					<View style={[styles.timelineLine, { backgroundColor: colors.border }]} />

					<View style={styles.timelineItem}>
						<View style={[styles.timelineDot, { backgroundColor: colors.success }]} />
						<View style={styles.timelineContent}>
							<Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>Payment recorded</Text>
							<Text style={[styles.timelineDate, { color: colors.textMuted }]}>Today</Text>
						</View>
					</View>

					<View style={styles.timelineItem}>
						<View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
						<View style={styles.timelineContent}>
							<Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>Subscription started</Text>
							<Text style={[styles.timelineDate, { color: colors.textMuted }]}>{formatSafeDate(customer.startDate)}</Text>
						</View>
					</View>
				</View>
			</Section>

			{/* Action Grid Bottom */}
			<View style={styles.footerActions}>
				<TouchableOpacity style={[styles.dangerBtn, { backgroundColor: colors.danger + '10' }]} onPress={() => onAction({ type: 'customer.delete', customerId: customer.id })}>
					<Trash2 size={16} color={colors.danger} />
					<Text style={[styles.dangerBtnText, { color: colors.danger }]}>Delete Customer</Text>
				</TouchableOpacity>
				<TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={() => onAction({ type: 'customer.edit', customerId: customer.id })}>
					<UserPen size={16} color={colors.textSecondary} />
					<Text style={[styles.editBtnText, { color: colors.textSecondary }]}>Edit Record</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		paddingBottom: Theme.spacing.xl,
		gap: Theme.spacing.lg,
	},
	hero: {
		borderWidth: 1,
		borderRadius: 16,
		padding: Theme.spacing.md,
		overflow: 'hidden',
	},
	heroTop: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	heroAvatar: {
		width: 44,
		height: 44,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	heroAvatarText: {
		fontWeight: '900',
		fontSize: 16,
	},
	heroIdentity: {
		flex: 1,
	},
	heroName: {
		fontSize: 20,
		fontWeight: '800',
		letterSpacing: -0.3,
	},
	heroPlan: {
		...Theme.typography.detailBold,
		marginTop: 2,
	},
	heroMetaValue: {
		...Theme.typography.detailBold,
		fontSize: 13,
	},
	actionStrip: {
		flexDirection: 'row',
		gap: 8,
		justifyContent: 'space-between',
	},
	stripBtn: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 10,
		borderRadius: 10,
		gap: 4,
	},
	stripBtnText: {
		fontWeight: '700',
		fontSize: 12,
	},
	progressSection: {
		gap: 8,
	},
	progressHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	progressBarBg: {
		height: 6,
		borderRadius: 3,
		overflow: 'hidden',
	},
	progressBarFill: {
		height: '100%',
		borderRadius: 3,
	},
	section: {
		gap: 8,
	},
	sectionTitle: {
		...Theme.typography.detailBold,
		fontSize: 11,
		letterSpacing: 1,
		textTransform: 'uppercase',
		paddingHorizontal: 4,
	},
	sectionContent: {
		borderWidth: 1,
		borderRadius: 14,
		padding: 4,
		overflow: 'hidden',
	},
	financialGrid: {
		flexDirection: 'row',
		gap: 8,
		padding: 4,
	},
	financeCard: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 10,
		padding: 12,
		alignItems: 'center',
		gap: 4,
	},
	financeCardValue: {
		fontSize: 18,
		fontWeight: '800',
	},
	financeCardLabel: {
		fontSize: 11,
		fontWeight: '600',
	},
	deliveryItem: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		gap: 12,
	},
	deliveryContent: {
		flex: 1,
		gap: 2,
	},
	deliveryTitle: {
		fontSize: 14,
		fontWeight: '700',
	},
	deliverySub: {
		fontSize: 12,
		fontWeight: '600',
	},
	divider: {
		height: 1,
	},
	detailValue: {
		...Theme.typography.labelMedium,
		fontSize: 14,
	},
	notesBox: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 8,
		padding: 12,
	},
	notesText: {
		flex: 1,
		...Theme.typography.labelMedium,
		fontSize: 14,
		lineHeight: 20,
	},
	timeline: {
		paddingLeft: 8,
		paddingVertical: 8,
		position: 'relative',
	},
	timelineLine: {
		position: 'absolute',
		left: 11,
		top: 16,
		bottom: 16,
		width: 2,
	},
	timelineItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
		marginBottom: 16,
	},
	timelineDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		zIndex: 1,
	},
	timelineContent: {
		flex: 1,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	timelineTitle: {
		fontSize: 13,
		fontWeight: '700',
	},
	timelineDate: {
		fontSize: 12,
		fontWeight: '600',
	},
	footerActions: {
		flexDirection: 'row',
		gap: 8,
		marginTop: Theme.spacing.sm,
	},
	dangerBtn: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		borderRadius: 12,
		gap: 8,
	},
	dangerBtnText: {
		fontWeight: '700',
		fontSize: 14,
	},
	editBtn: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		borderRadius: 12,
		borderWidth: 1,
		gap: 8,
	},
	editBtnText: {
		fontWeight: '700',
		fontSize: 14,
	},
});
