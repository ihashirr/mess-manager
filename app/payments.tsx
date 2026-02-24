import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PrimaryPanel } from '../components/ui/PrimaryPanel';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SETTINGS } from '../constants/Settings';
import { Theme } from '../constants/Theme';
import { db } from '../firebase/config';
import { getDueAmount, toDate } from '../utils/customerLogic';
import { mockDb } from '../utils/mockDb';

type Payment = {
	id: string;
	name: string;
	pricePerMonth: number;
	totalPaid: number;
	isActive: boolean;
	mealsPerDay: { lunch: boolean; dinner: boolean };
	endDate: any;
};

export default function PaymentsScreen() {
	const [payments, setPayments] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadPayments = () => {
			const customers = mockDb.getCustomers();
			const paymentsArray = (customers as any[]).filter(c => c.isActive && getDueAmount(c.pricePerMonth, c.totalPaid) > 0);
			setPayments(paymentsArray as Payment[]);
			setLoading(false);
		};

		if (SETTINGS.USE_MOCKS) {
			loadPayments();
			const unsub = mockDb.subscribe(loadPayments);
			return unsub;
		}

		// Rule: If isActive and dueAmount > 0 -> show in Payments list
		const q = query(collection(db, "customers"), where("isActive", "==", true));

		const unsubscribe = onSnapshot(q, (querySnapshot) => {
			const paymentsArray: Payment[] = [];
			querySnapshot.forEach((doc) => {
				const data = doc.data();
				if (getDueAmount(data.pricePerMonth, data.totalPaid) > 0) {
					paymentsArray.push({ id: doc.id, ...data } as Payment);
				}
			});
			setPayments(paymentsArray);
			setLoading(false);
		});

		return () => unsubscribe();
	}, []);

	const recordPayment = async (customer: Payment) => {
		try {
			const today = new Date();
			const currentEndDate = toDate(customer.endDate);
			let newEndDate = new Date(currentEndDate);

			if (today > currentEndDate) {
				newEndDate = new Date(today);
			}

			newEndDate.setDate(newEndDate.getDate() + 30);

			if (!SETTINGS.USE_MOCKS) {
				// 1. Record the individual transaction in the ledger
				const monthTag = today.toISOString().slice(0, 7); // "YYYY-MM"
				await addDoc(collection(db, "payments"), {
					customerId: customer.id,
					customerName: customer.name,
					amount: customer.pricePerMonth,
					date: today,
					method: "cash", // Default to cash for now
					monthTag: monthTag
				});

				// 2. Update the customer record (cached cumulative total)
				const customerRef = doc(db, "customers", customer.id);
				await updateDoc(customerRef, {
					totalPaid: (customer.totalPaid || 0) + customer.pricePerMonth,
					endDate: newEndDate
				});
				console.log("Transaction recorded in ledger and DB updated");
			} else {
				console.log("Mock Payment: Recording in local session storage");
				mockDb.updateCustomer(customer.id, {
					totalPaid: (customer.totalPaid || 0) + customer.pricePerMonth,
					endDate: newEndDate
				});
				mockDb.addPayment({
					customerId: customer.id,
					customerName: customer.name,
					amount: customer.pricePerMonth,
					date: today,
					method: "cash",
					monthTag: today.toISOString().slice(0, 7)
				});
			}
		} catch (error) {
			console.error("Error recording payment:", error);
		}
	};

	if (loading) return <View style={styles.container}><Text>Loading...</Text></View>;

	const totalDue = payments.reduce((acc, current) => acc + getDueAmount(current.pricePerMonth, current.totalPaid), 0);

	return (
		<Screen scrollable={false}>
			<ScreenHeader
				title="Payments"
				subtitle="Collection Ledger"
				rightAction={
					<MaterialCommunityIcons name="currency-usd" size={28} color={Theme.colors.primary} />
				}
			/>

			<View style={{ paddingHorizontal: Theme.spacing.screenPadding }}>
				<PrimaryPanel title="Pending Revenue">
					<View style={styles.summaryRow}>
						<Text style={styles.summaryValue}>DHS {totalDue}</Text>
						<Text style={styles.summaryLabel}>FROM {payments.length} ACCOUNTS</Text>
					</View>
				</PrimaryPanel>
			</View>

			<FlatList
				data={payments}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
				renderItem={({ item }) => (
					<Card variant="elevated" style={{ marginBottom: Theme.spacing.lg }}>
						<View style={styles.info}>
							<View>
								<Text style={styles.name}>{item.name}</Text>
								<Text style={styles.subText}>Paid: {item.totalPaid} / {item.pricePerMonth}</Text>
							</View>
							<Text style={styles.amount}>DHS {getDueAmount(item.pricePerMonth, item.totalPaid)}</Text>
						</View>

						<Button
							title="RECORD PAYMENT - ادائیگی درج کریں"
							onPress={() => recordPayment(item)}
						/>
					</Card>
				)}
				ListEmptyComponent={
					<View style={styles.emptyContainer}>
						<MaterialCommunityIcons name="check-circle" size={32} color={Theme.colors.success} />
						<Text style={styles.empty}>All payments received!</Text>
					</View>
				}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: Theme.colors.bg },
	bgDecoration: {
		position: 'absolute', top: 0, left: 0, right: 0, height: 400,
		backgroundColor: Theme.colors.decoration, borderBottomLeftRadius: 80, borderBottomRightRadius: 80,
		zIndex: -1
	},
	title: { ...Theme.typography.answer, color: Theme.colors.textPrimary },
	subtitle: { ...Theme.typography.label, color: Theme.colors.textMuted, textTransform: 'uppercase' },
	content: { padding: Theme.spacing.screen, paddingBottom: 150 },
	info: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.lg },
	name: { ...Theme.typography.labelMedium, color: Theme.colors.textPrimary },
	subText: { ...Theme.typography.detail, color: Theme.colors.textSecondary, marginTop: Theme.spacing.xs },
	amount: { ...Theme.typography.labelMedium, color: Theme.colors.danger },
	emptyContainer: { alignItems: 'center', marginTop: Theme.spacing.massive, gap: Theme.spacing.lg },
	empty: { textAlign: 'center', ...Theme.typography.labelMedium, color: Theme.colors.primary },
	summaryRow: { alignItems: 'center', justifyContent: 'center' },
	summaryValue: { ...Theme.typography.answerGiant, color: Theme.colors.textInverted },
	summaryLabel: { ...Theme.typography.label, color: Theme.colors.textInverted, opacity: 0.6, marginTop: Theme.spacing.xs },
});
