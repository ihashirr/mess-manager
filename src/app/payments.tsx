import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Clock3, type LucideIcon, Users, Wallet } from 'lucide-react-native';
import { showToast } from '../components/system/feedback/AppToast';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PrimaryPanel } from '../components/ui/PrimaryPanel';
import { Screen } from '../components/ui/Screen';
import { useResponsiveLayout } from '../components/ui/useResponsiveLayout';
import { Theme } from '../constants/Theme';
import { useAppHeader } from '../context/HeaderContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { useAppTheme } from '../context/ThemeModeContext';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';

type Payment = {
	id: string;
	name: string;
	pricePerMonth: number;
	totalPaid: number;
	isActive: boolean;
	mealsPerDay: { lunch: boolean; dinner: boolean };
	endDate: unknown;
};

type PaymentRow = Payment & {
	dueAmount: number;
	daysLeft: number;
	planLabel: string;
};

export default function PaymentsScreen() {
	const { colors } = useAppTheme();
	const { setHeaderConfig } = useAppHeader();
	const { ready, customers, recordPayment: queuePayment } = useOfflineSync();
	const { contentPadding, maxContentWidth, maxReadableWidth, stacked, font } = useResponsiveLayout();

	useFocusEffect(
		useCallback(() => {
			setHeaderConfig({
				title: 'Payments',
				subtitle: 'Who owes, who is expiring, and what to collect next',
			});
		}, [setHeaderConfig])
	);

	const paymentRows: PaymentRow[] = customers
		.filter((customer) => customer.isActive && getDueAmount(customer.pricePerMonth, customer.totalPaid) > 0)
		.map((payment) => {
			const dueAmount = getDueAmount(payment.pricePerMonth, payment.totalPaid);
			const daysLeft = getDaysLeft(toDate(payment.endDate));
			const planLabel = payment.mealsPerDay?.lunch && payment.mealsPerDay?.dinner
				? 'Lunch + Dinner'
				: payment.mealsPerDay?.lunch
					? 'Lunch only'
					: 'Dinner only';

			return {
				...payment,
				dueAmount,
				daysLeft,
				planLabel,
			};
		})
		.sort((a, b) => {
			if ((a.daysLeft < 0) !== (b.daysLeft < 0)) {
				return a.daysLeft < 0 ? -1 : 1;
			}

			if (b.dueAmount !== a.dueAmount) {
				return b.dueAmount - a.dueAmount;
			}

			return a.daysLeft - b.daysLeft;
		});

	const totalDue = paymentRows.reduce((acc, current) => acc + current.dueAmount, 0);
	const overdueCount = paymentRows.filter((payment) => payment.daysLeft < 0).length;
	const expiringSoonCount = paymentRows.filter((payment) => payment.daysLeft >= 0 && payment.daysLeft <= 3).length;
	const averageDue = paymentRows.length ? Math.round(totalDue / paymentRows.length) : 0;

	const recordPayment = async (customer: PaymentRow) => {
		try {
			await queuePayment({
				customerId: customer.id,
				customerName: customer.name,
				amount: customer.pricePerMonth,
				totalPaid: customer.totalPaid,
				currentEndDate: customer.endDate,
			});
		} catch (error) {
			console.error('Error recording payment:', error);
			showToast({
				type: 'error',
				title: 'Could not record payment',
				message: error instanceof Error && error.message.trim()
					? error.message.trim()
					: 'Payment could not be recorded locally.',
			});
		}
	};

	if (!ready) {
		return (
			<View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
				<ActivityIndicator size="large" color={colors.primary} />
				<Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading payments...</Text>
			</View>
		);
	}

	return (
		<Screen scrollable={false} maxContentWidth={maxReadableWidth}>
			<FlatList
				data={paymentRows}
				keyExtractor={(item) => item.id}
				contentContainerStyle={{
					paddingHorizontal: contentPadding,
					paddingBottom: 150,
					width: '100%',
					maxWidth: Math.min(maxContentWidth, maxReadableWidth),
					alignSelf: 'center',
				}}
				showsVerticalScrollIndicator={false}
				ListHeaderComponent={
					<View style={styles.listHeader}>
						<PrimaryPanel title="Pending Revenue" style={styles.summaryPanel}>
							<View style={styles.summaryRow}>
								<Text style={[styles.summaryValue, { color: colors.textPrimary, fontSize: font(40, 0.9, 1.08) }]} numberOfLines={1}>
									DHS {totalDue}
								</Text>
								<Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
									Awaiting from {paymentRows.length} customer{paymentRows.length === 1 ? '' : 's'}
								</Text>
							</View>
							<View style={styles.summaryStatsGrid}>
								<PaymentStatCard icon={AlertTriangle} label="Overdue" value={overdueCount} tone={colors.danger} />
								<PaymentStatCard icon={Clock3} label="Expiring soon" value={expiringSoonCount} tone={colors.warning} />
								<PaymentStatCard icon={Users} label="Accounts due" value={paymentRows.length} tone={colors.primary} />
								<PaymentStatCard icon={Wallet} label="Avg due" value={`DHS ${averageDue}`} tone={colors.textPrimary} />
							</View>
						</PrimaryPanel>

						<View style={[styles.listIntro, { backgroundColor: colors.surface, borderColor: colors.border }]}>
							<Text style={[styles.listIntroTitle, { color: colors.textPrimary }]}>Customers waiting on payment</Text>
							<Text style={[styles.listIntroSubtitle, { color: colors.textSecondary }]}>
								Record a payment to extend the plan by 30 days and clear the current due amount.
							</Text>
						</View>
					</View>
				}
				renderItem={({ item }) => (
					<Card style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
						<View style={[styles.paymentHeader, stacked && styles.paymentHeaderStacked]}>
							<View style={styles.paymentCopy}>
								<Text style={[styles.paymentName, { color: colors.textPrimary }]}>{item.name}</Text>
								<Text style={[styles.paymentPlan, { color: colors.textSecondary }]}>{item.planLabel}</Text>
							</View>
							<View style={[styles.paymentBadgeRow, stacked && styles.paymentBadgeRowStacked]}>
								<Badge
									label={item.daysLeft < 0 ? 'Expired' : `${item.daysLeft}d left`}
									variant={item.daysLeft < 0 ? 'danger' : item.daysLeft <= 3 ? 'warning' : 'success'}
									style={styles.badgeTight}
								/>
								<Badge
									label={`DHS ${item.dueAmount} due`}
									variant={item.daysLeft < 0 ? 'danger' : 'warning'}
									style={styles.badgeTight}
								/>
							</View>
						</View>

						<View style={[styles.metaGrid, stacked && styles.metaGridStacked]}>
							<View style={[styles.metaCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
								<Text style={[styles.metaLabel, { color: colors.textMuted }]}>Paid so far</Text>
								<Text style={[styles.metaValue, { color: colors.textPrimary }]}>DHS {item.totalPaid || 0}</Text>
							</View>
							<View style={[styles.metaCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
								<Text style={[styles.metaLabel, { color: colors.textMuted }]}>Monthly fee</Text>
								<Text style={[styles.metaValue, { color: colors.textPrimary }]}>DHS {item.pricePerMonth}</Text>
							</View>
						</View>

						<Text style={[styles.paymentFootnote, { color: colors.textSecondary }]}>
							Posting the payment renews this customer for the next 30 days.
						</Text>

						<Button
							title="Record payment - ادائیگی درج کریں"
							onPress={() => recordPayment(item)}
							fullWidth
							style={styles.paymentButton}
						/>
					</Card>
				)}
				ListEmptyComponent={
					<View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
						<Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>All payments are settled</Text>
						<Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Nothing needs to be collected right now.</Text>
					</View>
				}
			/>
		</Screen>
	);
}

function PaymentStatCard({
	icon: Icon,
	label,
	value,
	tone,
}: {
	icon: LucideIcon;
	label: string;
	value: number | string;
	tone: string;
}) {
	const { colors } = useAppTheme();
	return (
		<View style={[styles.statCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
			<View style={[styles.statIconBox, { backgroundColor: tone + '12' }]}>
				<Icon size={15} color={tone} />
			</View>
			<View style={styles.statCopy}>
				<Text style={[styles.statValue, { color: colors.textPrimary }]} numberOfLines={1}>{value}</Text>
				<Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	loadingText: {
		...Theme.typography.labelMedium,
		marginTop: Theme.spacing.md,
	},
	listHeader: {
		paddingTop: Theme.spacing.lg,
		paddingBottom: Theme.spacing.lg,
	},
	summaryPanel: {
		marginVertical: 0,
	},
	summaryRow: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	summaryValue: {
		...Theme.typography.answerGiant,
	},
	summaryLabel: {
		...Theme.typography.label,
		opacity: 0.84,
		marginTop: Theme.spacing.xs,
		textAlign: 'center',
	},
	summaryStatsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.lg,
	},
	statCard: {
		flex: 1,
		minWidth: '47%',
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		padding: Theme.spacing.md,
		borderRadius: 18,
		borderWidth: 1,
	},
	statIconBox: {
		width: 34,
		height: 34,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	statCopy: {
		flex: 1,
		minWidth: 0,
	},
	statValue: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
	},
	statLabel: {
		...Theme.typography.detailBold,
		marginTop: 3,
	},
	listIntro: {
		borderWidth: 1,
		borderRadius: 22,
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.lg,
		marginTop: Theme.spacing.md,
	},
	listIntroTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
	},
	listIntroSubtitle: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: Theme.spacing.xs,
	},
	paymentCard: {
		marginBottom: Theme.spacing.md,
		borderRadius: 20,
	},
	paymentHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	paymentHeaderStacked: {
		flexDirection: 'column',
	},
	paymentCopy: {
		flex: 1,
		minWidth: 0,
	},
	paymentName: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
	},
	paymentPlan: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: 4,
	},
	paymentBadgeRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'flex-end',
		gap: Theme.spacing.xs,
		maxWidth: '48%',
	},
	paymentBadgeRowStacked: {
		maxWidth: '100%',
		justifyContent: 'flex-start',
	},
	badgeTight: {
		paddingHorizontal: Theme.spacing.sm,
		paddingVertical: 5,
	},
	metaGrid: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.md,
	},
	metaGridStacked: {
		flexDirection: 'column',
	},
	metaCard: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 16,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
	},
	metaLabel: {
		...Theme.typography.detailBold,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	metaValue: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
		marginTop: 6,
	},
	paymentFootnote: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: Theme.spacing.md,
	},
	paymentButton: {
		marginTop: Theme.spacing.md,
	},
	emptyState: {
		marginTop: Theme.spacing.huge,
		borderWidth: 1,
		borderRadius: 22,
		paddingHorizontal: Theme.spacing.xl,
		paddingVertical: Theme.spacing.huge,
		alignItems: 'center',
	},
	emptyTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
		textAlign: 'center',
	},
	emptySubtitle: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: Theme.spacing.sm,
		textAlign: 'center',
	},
});
