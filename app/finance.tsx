import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SETTINGS } from '../constants/Settings';
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
			<View style={styles.bgDecoration} />
			<ScrollView contentContainerStyle={styles.content}>
				<View style={styles.header}>
					<View>
						<Text style={styles.title}>Finance Panel</Text>
						<Text style={styles.subtitle}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} Summary</Text>
					</View>
					<MaterialCommunityIcons name="chart-line" size={32} color="#4caf50" />
				</View>

				<View style={styles.grid}>
					<View style={[styles.card, { borderLeftColor: '#4caf50' }]}>
						<Text style={styles.label}>EXPECTED</Text>
						<Text style={styles.value}>DHS {metrics.expected}</Text>
						<Text style={styles.cardSubText}>Monthly Goal</Text>
					</View>

					<View style={[styles.card, { borderLeftColor: '#2196f3' }]}>
						<Text style={styles.label}>COLLECTED</Text>
						<Text style={styles.value}>DHS {metrics.collected}</Text>
						<Text style={styles.cardSubText}>Received So Far</Text>
					</View>

					<View style={[styles.card, { borderLeftColor: '#f44336' }]}>
						<Text style={styles.label}>OUTSTANDING</Text>
						<Text style={styles.value}>DHS {metrics.outstanding}</Text>
						<Text style={styles.cardSubText}>To Be Collected</Text>
					</View>

					<View style={[styles.card, { borderLeftColor: '#9c27b0' }]}>
						<Text style={styles.label}>ACTIVE SUBS</Text>
						<Text style={styles.value}>{metrics.activeCount}</Text>
						<Text style={styles.cardSubText}>Paying Members</Text>
					</View>
				</View>

				<View style={styles.progressSection}>
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
							<MaterialCommunityIcons name="star" size={16} color="#2e7d32" />
							<Text style={styles.surplusText}>Surplus: DHS {metrics.collected - metrics.expected}</Text>
						</View>
					)}
				</View>

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
							<View key={tx.id} style={[styles.transactionCard, tx.isOrphan && styles.orphanCard]}>
								<View style={styles.txIconContainer}>
									<MaterialCommunityIcons
										name={tx.method === 'bank' ? 'bank' : 'cash-multiple'}
										size={20}
										color={tx.isOrphan ? "#999" : "#2196f3"}
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
										<MaterialCommunityIcons name="delete-outline" size={16} color="#d32f2f" />
									</TouchableOpacity>
								</View>
							</View>
						))
					)}
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#f4f7f6' },
	bgDecoration: {
		position: 'absolute', top: 0, left: 0, right: 0, height: 400,
		backgroundColor: 'rgba(0,0,0,0.03)', borderBottomLeftRadius: 80, borderBottomRightRadius: 80,
		zIndex: -1
	},
	content: { paddingBottom: 150 },
	header: {
		backgroundColor: '#1a1a1a', paddingHorizontal: 25, paddingTop: 60, paddingBottom: 40,
		flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
		borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 10,
	},
	title: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 1 },
	subtitle: { fontSize: 14, color: '#888', marginTop: 4, fontWeight: '600', textTransform: 'uppercase' },
	grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: -25 },
	card: {
		width: '48%', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 15,
		borderLeftWidth: 6, elevation: 6, shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8,
	},
	label: { fontSize: 10, fontWeight: '800', color: '#999', marginBottom: 6, letterSpacing: 1 },
	value: { fontSize: 18, fontWeight: '900', color: '#1a1a1a' },
	cardSubText: { fontSize: 10, color: '#bbb', marginTop: 4, fontWeight: '600' },
	progressSection: { marginHorizontal: 20, backgroundColor: '#fff', padding: 20, borderRadius: 25, marginTop: 5, elevation: 4 },
	rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
	sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
	percentageText: { fontSize: 18, fontWeight: '900', color: '#4caf50' },
	progressBarBg: { height: 12, backgroundColor: '#f0f0f0', borderRadius: 6, overflow: 'hidden' },
	progressBarFill: { height: '100%', backgroundColor: '#4caf50', borderRadius: 6 },
	surplusContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
	surplusText: { color: '#2e7d32', fontWeight: '800', fontSize: 13 },
	historySection: { marginTop: 25, paddingHorizontal: 20 },
	countBadge: { backgroundColor: '#1a1a1a', color: '#fff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 15, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
	transactionCard: {
		flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 20, marginBottom: 10,
		elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
	},
	txIconContainer: { width: 40, height: 40, backgroundColor: '#f4f7f6', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
	orphanCard: { opacity: 0.6, backgroundColor: '#fafafa' },
	txName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
	txDate: { fontSize: 12, color: '#999', marginTop: 2 },
	txRight: { alignItems: 'flex-end', justifyContent: 'center' },
	txAmount: { fontSize: 16, fontWeight: '900', color: '#2e7d32' },
	txDelete: { marginTop: 4 },
	emptyCard: { backgroundColor: '#fff', padding: 40, borderRadius: 25, alignItems: 'center', elevation: 2 },
	emptyText: { color: '#999', fontStyle: 'italic', fontSize: 14 }
});
