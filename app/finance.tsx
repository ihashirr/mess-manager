import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SETTINGS } from '../constants/Settings';
import { Theme } from '../constants/Theme';
import { db } from '../firebase/config';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { mockDb } from '../utils/mockDb';

export default function FinanceScreen() {
	const [metrics, setMetrics] = useState({
		expected: 0,
		collected: 0,
		outstanding: 0,
		activeCount: 0,
		renewalRate: 0
	});
	const [transactions, setTransactions] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	const handleDeleteTransaction = async (id: string) => {
		if (!SETTINGS.USE_MOCKS) {
			try {
				await deleteDoc(doc(db, "payments", id));
			} catch (error) {
				console.error("Error deleting transaction:", error);
			}
		} else {
			console.log("Mock Mode: Transaction not deleted from real DB");
		}
	};

	useEffect(() => {
		const calculateMetrics = () => {
			const customers = mockDb.getCustomers();
			const payments = mockDb.getPayments();

			const totalExpected = (customers as any[]).reduce((sum, c) => sum + (c.isActive ? c.pricePerMonth : 0), 0);
			const totalCollected = (payments as any[]).reduce((sum, p) => sum + (p.amount || 0), 0);
			const active = (customers as any[]).filter(c => c.isActive && getDaysLeft(toDate(c.endDate)) >= 0).length;

			setMetrics({
				expected: totalExpected,
				collected: totalCollected,
				outstanding: totalExpected - totalCollected,
				activeCount: active,
				renewalRate: 92 // Mock rate
			});
			setLoading(false);
		};

		if (SETTINGS.USE_MOCKS) {
			calculateMetrics();
			const unsub = mockDb.subscribe(calculateMetrics);
			return unsub;
		}

		const currentMonthTag = new Date().toISOString().slice(0, 7);

		const qCustomers = query(collection(db, "customers"), where("isActive", "==", true));
		const qPayments = query(collection(db, "payments"), where("monthTag", "==", currentMonthTag));

		let unsubscribePayments = () => { };

		const unsubscribeCustomers = onSnapshot(qCustomers, (customerSnapshot) => {
			let expected = 0;
			let active = 0;
			let outstandingCalculated = 0;

			customerSnapshot.forEach((doc) => {
				const data = doc.data();
				expected += data.pricePerMonth || 0;
				const due = getDueAmount(data.pricePerMonth, data.totalPaid);
				outstandingCalculated += due;
				if (getDaysLeft(toDate(data.endDate)) >= 0) {
					active++;
				}
			});

			unsubscribePayments = onSnapshot(qPayments, (paymentSnapshot) => {
				let collected = 0;
				const paymentList: any[] = [];
				const existingCustomerIds = new Set(customerSnapshot.docs.map(doc => doc.id));

				paymentSnapshot.forEach((doc) => {
					const data = doc.data();
					const isOrphan = !existingCustomerIds.has(data.customerId);
					if (!isOrphan) {
						collected += data.amount || 0;
					}
					paymentList.push({
						id: doc.id,
						...data,
						isOrphan
					});
				});

				setTransactions(paymentList.sort((a, b) => b.date?.seconds - a.date?.seconds));
				setMetrics(prev => ({
					...prev,
					expected,
					activeCount: active,
					collected,
					outstanding: outstandingCalculated,
					renewalRate: 0
				}));
				setLoading(false);
			});
		});

		return () => {
			unsubscribeCustomers();
			unsubscribePayments();
		};
	}, []);

	if (loading) return <View style={styles.container}><Text>Loading Stats...</Text></View>;

	const percentage = Math.min(100, Math.round((metrics.collected / metrics.expected) * 100 || 0));

	return (
		<View style={styles.container}>
			<ScreenHeader
				edgeToEdge={false}
				title="Finance Panel"
				subtitle={`${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} Summary`}
			/>
			<ScrollView contentContainerStyle={styles.content}>

				<View style={styles.grid}>
					<Card style={[styles.card, { borderLeftColor: Theme.colors.success }]}>
						<Text style={styles.label}>EXPECTED</Text>
						<Text style={styles.value}>DHS {metrics.expected}</Text>
						<Text style={styles.cardSubText}>Monthly Goal</Text>
					</Card>

					<Card style={[styles.card, { borderLeftColor: Theme.colors.primary }]}>
						<Text style={styles.label}>COLLECTED</Text>
						<Text style={styles.value}>DHS {metrics.collected}</Text>
						<Text style={styles.cardSubText}>Received So Far</Text>
					</Card>

					<Card style={[styles.card, { borderLeftColor: Theme.colors.danger }]}>
						<Text style={styles.label}>OUTSTANDING</Text>
						<Text style={styles.value}>DHS {metrics.outstanding}</Text>
						<Text style={styles.cardSubText}>To Be Collected</Text>
					</Card>

					<Card style={[styles.card, { borderLeftColor: Theme.colors.warning }]}>
						<Text style={styles.label}>ACTIVE SUBS</Text>
						<Text style={styles.value}>{metrics.activeCount}</Text>
						<Text style={styles.cardSubText}>Paying Members</Text>
					</Card>
				</View>

				<Card style={styles.progressSection}>
					<View style={styles.rowBetween}>
						<Text style={styles.sectionTitle}>Collection Goal</Text>
						<Text style={styles.percentageText}>{percentage}%</Text>
					</View>
					<View style={styles.progressBarBg}>
						<View style={[
							styles.progressBarFill,
							{ width: `${percentage}%` }
						]} />
					</View>
					{metrics.collected > metrics.expected && (
						<View style={styles.surplusContainer}>
							<Text style={styles.surplusText}>Surplus: DHS {metrics.collected - metrics.expected}</Text>
						</View>
					)}
				</Card>

				<View style={styles.historySection}>
					<View style={styles.rowBetween}>
						<Text style={styles.sectionTitle}>Recent Transactions</Text>
						<Text style={styles.countBadge}>{transactions.length}</Text>
					</View>

					{transactions.length === 0 ? (
						<View style={styles.emptyCard}>
							<Text style={styles.emptyText}>No payments recorded this month</Text>
						</View>
					) : (
						transactions.map((tx) => (
							<Card borderless key={tx.id} style={[styles.transactionCard, tx.isOrphan && styles.orphanCard]}>
								<View style={styles.txIconContainer}>
									<MaterialCommunityIcons
										name={tx.method === 'bank' ? 'bank' : 'cash-multiple'}
										size={20}
										color={tx.isOrphan ? Theme.colors.textMuted : Theme.colors.primary}
									/>
								</View>
								<View style={{ flex: 1, marginLeft: 12 }}>
									<Text style={styles.txName}>
										{tx.customerName}
										{tx.isOrphan && " (Deleted)"}
									</Text>
									<Text style={styles.txDate}>{toDate(tx.date).toLocaleDateString()}</Text>
								</View>
								<View style={styles.txRight}>
									<Text style={styles.txAmount}>DHS {tx.amount}</Text>
									<TouchableOpacity
										onPress={() => handleDeleteTransaction(tx.id)}
										style={styles.txDelete}
									>
										<MaterialCommunityIcons name="delete-outline" size={16} color={Theme.colors.danger} />
									</TouchableOpacity>
								</View>
							</Card>
						))
					)}
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: Theme.colors.bg },
	content: { paddingBottom: 150 },
	grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: Theme.spacing.screen, marginTop: Theme.spacing.md },
	card: {
		width: '48%',
		marginBottom: Theme.spacing.lg,
		borderLeftWidth: 4,
	},
	label: { ...Theme.typography.detailBold, color: Theme.colors.textMuted, marginBottom: Theme.spacing.xs },
	value: { ...Theme.typography.labelMedium, color: Theme.colors.textPrimary },
	cardSubText: { ...Theme.typography.detail, color: Theme.colors.textMuted, marginTop: Theme.spacing.xs },
	progressSection: {
		marginHorizontal: Theme.spacing.screen,
		borderRadius: Theme.radius.xl,
		marginTop: Theme.spacing.xs,
	},
	rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm },
	sectionTitle: { ...Theme.typography.labelMedium, color: Theme.colors.textPrimary },
	percentageText: { ...Theme.typography.labelMedium, color: Theme.colors.success },
	progressBarBg: { height: 12, backgroundColor: Theme.colors.border, borderRadius: Theme.radius.sm, overflow: 'hidden' },
	progressBarFill: { height: '100%', backgroundColor: Theme.colors.success, borderRadius: Theme.radius.sm },
	surplusContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Theme.spacing.sm, marginTop: Theme.spacing.xs },
	surplusText: { ...Theme.typography.label, color: Theme.colors.primary },
	historySection: { marginTop: Theme.spacing.xl, paddingHorizontal: Theme.spacing.screen },
	countBadge: {
		backgroundColor: Theme.colors.surfaceElevated,
		color: Theme.colors.textPrimary,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.xs,
		borderRadius: Theme.radius.md,
		...Theme.typography.detailBold,
		overflow: 'hidden'
	},
	transactionCard: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: Theme.spacing.xs,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.border,
		paddingVertical: Theme.spacing.sm,
	},
	txIconContainer: {
		width: 40,
		height: 40,
		backgroundColor: Theme.colors.bg,
		borderRadius: Theme.radius.lg,
		justifyContent: 'center',
		alignItems: 'center'
	},
	orphanCard: { opacity: 0.6, backgroundColor: Theme.colors.bg },
	txName: { ...Theme.typography.labelMedium, color: Theme.colors.textPrimary },
	txDate: { ...Theme.typography.detail, color: Theme.colors.textMuted, marginTop: Theme.spacing.xs },
	txRight: { alignItems: 'flex-end', justifyContent: 'center' },
	txAmount: { ...Theme.typography.labelMedium, color: Theme.colors.primary },
	txDelete: { marginTop: 4 },
	emptyCard: { backgroundColor: Theme.colors.surface, padding: Theme.spacing.massive, borderRadius: Theme.radius.xl, alignItems: 'center', borderWidth: 1, borderColor: Theme.colors.border },
	emptyText: { ...Theme.typography.label, color: Theme.colors.textMuted, fontStyle: 'italic' },
	statsRowFinance: {
		flexDirection: 'row',
		marginHorizontal: Theme.spacing.screen,
		backgroundColor: Theme.colors.surface,
		borderRadius: Theme.radius.xl,
		padding: Theme.spacing.xl,
		marginTop: -Theme.spacing.xxl,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: Theme.colors.border,
	},
	statItemFinance: { flex: 1, alignItems: 'center' },
	statLabelFinance: { ...Theme.typography.detailBold, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.xs },
	statValueFinance: { ...Theme.typography.labelMedium, color: Theme.colors.textPrimary },
	separatorFinance: { width: 1, height: '60%', backgroundColor: Theme.colors.border },
});
