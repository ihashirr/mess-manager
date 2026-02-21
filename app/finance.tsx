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

		// 1. Listen for ALL active customers to calculate Expected Income
		const qCustomers = query(collection(db, "customers"), where("isActive", "==", true));
		// 2. Listen for current month's payments to calculate Collected Income
		const qPayments = query(collection(db, "payments"), where("monthTag", "==", currentMonthTag));

		let unsubscribePayments = () => { };

		const unsubscribeCustomers = onSnapshot(qCustomers, (customerSnapshot) => {
			let expected = 0;
			let active = 0;
			let outstandingCalculated = 0;

			customerSnapshot.forEach((doc) => {
				const data = doc.data();
				expected += data.pricePerMonth || 0;

				// Calculate true outstanding: what is still due from this active customer
				const due = getDueAmount(data.pricePerMonth, data.totalPaid);
				outstandingCalculated += due;

				if (getDaysLeft(toDate(data.endDate)) >= 0) {
					active++;
				}
			});

			unsubscribePayments = onSnapshot(qPayments, (paymentSnapshot) => {
				let collected = 0;
				const paymentList: any[] = [];

				// Create a set of existing customer IDs for O(1) lookup
				const existingCustomerIds = new Set(customerSnapshot.docs.map(doc => doc.id));

				paymentSnapshot.forEach((doc) => {
					const data = doc.data();
					const isOrphan = !existingCustomerIds.has(data.customerId);

					// Only count towards 'Collected' if the customer still exists
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
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<View style={styles.header}>
				<Text style={styles.title}>Finance Dashboard</Text>
				<Text style={styles.subtitle}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
			</View>

			<View style={styles.grid}>
				<View style={[styles.card, { borderLeftColor: '#4caf50' }]}>
					<Text style={styles.label}>EXPECTED</Text>
					<Text style={styles.value}>DHS {metrics.expected}</Text>
				</View>

				<View style={[styles.card, { borderLeftColor: '#2196f3' }]}>
					<Text style={styles.label}>COLLECTED</Text>
					<Text style={styles.value}>DHS {metrics.collected}</Text>
				</View>

				<View style={[styles.card, { borderLeftColor: '#f44336' }]}>
					<Text style={styles.label}>OUTSTANDING</Text>
					<Text style={styles.value}>DHS {metrics.outstanding}</Text>
				</View>

				<View style={[styles.card, { borderLeftColor: '#9c27b0' }]}>
					<Text style={styles.label}>ACTIVE SUBS</Text>
					<Text style={styles.value}>{metrics.activeCount}</Text>
				</View>
			</View>

			<View style={styles.progressSection}>
				<Text style={styles.progressLabel}>Collection Progress</Text>
				<View style={styles.progressBarBg}>
					<View style={[
						styles.progressBarFill,
						{ width: `${Math.min(100, (metrics.collected / metrics.expected) * 100 || 0)}%` }
					]} />
				</View>
				<Text style={styles.progressText}>
					{percentage}% of goal reached
					{metrics.collected > metrics.expected && ` (Surplus: DHS ${metrics.collected - metrics.expected})`}
				</Text>
			</View>

			<View style={styles.historySection}>
				<Text style={styles.historyTitle}>Recent Transactions</Text>
				{transactions.length === 0 ? (
					<Text style={styles.emptyText}>No transactions this month</Text>
				) : (
					transactions.map((tx) => (
						<View key={tx.id} style={[styles.transactionCard, tx.isOrphan && styles.orphanCard]}>
							<View>
								<Text style={styles.txName}>
									{tx.customerName}
									{tx.isOrphan && " (Deleted Customer)"}
								</Text>
								<Text style={styles.txDate}>{toDate(tx.date).toLocaleDateString()}</Text>
							</View>
							<View style={styles.txRight}>
								<Text style={styles.txAmount}>DHS {tx.amount}</Text>
								<TouchableOpacity
									onPress={() => handleDeleteTransaction(tx.id)}
									style={styles.txDelete}
								>
									<Text style={styles.txDeleteText}>DELETE RECORD</Text>
								</TouchableOpacity>
							</View>
						</View>
					))
				)}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	content: {
		padding: 20,
	},
	header: {
		marginBottom: 30,
	},
	title: {
		fontSize: 28,
		fontWeight: 'bold',
		color: '#1a1a1a',
	},
	subtitle: {
		fontSize: 16,
		color: '#666',
		marginTop: 5,
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
	},
	card: {
		width: '48%',
		backgroundColor: '#f8f9fa',
		padding: 15,
		borderRadius: 12,
		marginBottom: 15,
		borderLeftWidth: 5,
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	label: {
		fontSize: 12,
		fontWeight: 'bold',
		color: '#666',
		marginBottom: 5,
	},
	value: {
		fontSize: 18,
		fontWeight: '900',
		color: '#1a1a1a',
	},
	progressSection: {
		marginTop: 20,
		backgroundColor: '#f8f9fa',
		padding: 20,
		borderRadius: 15,
	},
	progressLabel: {
		fontSize: 16,
		fontWeight: 'bold',
		marginBottom: 10,
	},
	progressBarBg: {
		height: 12,
		backgroundColor: '#e0e0e0',
		borderRadius: 6,
		overflow: 'hidden',
	},
	progressBarFill: {
		height: '100%',
		backgroundColor: '#4caf50',
	},
	progressText: {
		marginTop: 10,
		textAlign: 'right',
		color: '#666',
		fontSize: 14,
	},
	historySection: {
		marginTop: 30,
		marginBottom: 40,
	},
	historyTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 15,
		color: '#1a1a1a',
	},
	transactionCard: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: '#f8f9fa',
		padding: 15,
		borderRadius: 12,
		marginBottom: 10,
		borderLeftWidth: 4,
		borderLeftColor: '#2196f3',
	},
	orphanCard: {
		opacity: 0.6,
		backgroundColor: '#f1f1f1',
		borderLeftColor: '#9e9e9e',
	},
	txName: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#1a1a1a',
	},
	txDate: {
		fontSize: 12,
		color: '#666',
		marginTop: 2,
	},
	txRight: {
		alignItems: 'flex-end',
	},
	txAmount: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#2e7d32',
	},
	txDelete: {
		marginTop: 5,
		paddingHorizontal: 8,
		paddingVertical: 4,
		backgroundColor: '#ffebee',
		borderRadius: 4,
	},
	txDeleteText: {
		color: '#d32f2f',
		fontSize: 10,
		fontWeight: 'bold',
	},
	emptyText: {
		textAlign: 'center',
		color: '#999',
		marginTop: 20,
		fontStyle: 'italic',
	}
});
