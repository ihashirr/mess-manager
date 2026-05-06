import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PrimaryPanel } from '../components/ui/PrimaryPanel';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useResponsiveLayout } from '../components/ui/useResponsiveLayout';
import { Theme } from '../constants/Theme';
import { useAppTheme } from '../context/ThemeModeContext';
import { db } from '../firebase/config';
import { getDueAmount, toDate } from '../utils/customerLogic';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';

type Payment = {
	id: string;
	name: string;
	pricePerMonth: number;
	totalPaid: number;
	isActive: boolean;
	mealsPerDay: { lunch: boolean; dinner: boolean };
	endDate: unknown;
};

export default function PaymentsScreen() {
	const { colors } = useAppTheme();
	const { contentPadding, maxContentWidth, stacked, isCompact } = useResponsiveLayout();
	const [payments, setPayments] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);

	const handleSnapshotError = (error: unknown) => {
		console.error('Firestore payments listener failed:', error);
		setLoading(false);
		Alert.alert('Firestore access failed', getFirestoreErrorMessage(error, 'Could not load payments.'));
	};

	useEffect(() => {
		// Rule: If isActive and dueAmount > 0 -> show in Payments list
		const q = query(collection(db, "customers"), where("isActive", "==", true));

		const unsubscribe = onSnapshot(
			q,
			(querySnapshot) => {
				const paymentsArray: Payment[] = [];
				querySnapshot.forEach((doc) => {
					const data = doc.data();
					if (getDueAmount(data.pricePerMonth, data.totalPaid) > 0) {
						paymentsArray.push({ id: doc.id, ...data } as Payment);
					}
				});
				setPayments(paymentsArray);
				setLoading(false);
			},
			handleSnapshotError
		);

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

			const monthTag = today.toISOString().slice(0, 7); // "YYYY-MM"
			await addDoc(collection(db, "payments"), {
				customerId: customer.id,
				customerName: customer.name,
				amount: customer.pricePerMonth,
				date: today,
				method: "cash", // Default to cash for now
				monthTag: monthTag
			});

			const customerRef = doc(db, "customers", customer.id);
			await updateDoc(customerRef, {
				totalPaid: (customer.totalPaid || 0) + customer.pricePerMonth,
				endDate: newEndDate
			});
		} catch (error) {
			console.error("Error recording payment:", error);
		}
	};

	if (loading) return <View style={[styles.container, { backgroundColor: colors.bg }]}><Text style={{ color: colors.textPrimary }}>Loading...</Text></View>;

	const totalDue = payments.reduce((acc, current) => acc + getDueAmount(current.pricePerMonth, current.totalPaid), 0);

	return (
		<Screen scrollable={false}>
			<ScreenHeader
				edgeToEdge={false}
				title="Payments"
				subtitle="Collection Ledger"
				rightAction={null}
			/>

			<View style={{ paddingHorizontal: contentPadding, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' }}>
				<PrimaryPanel title="Pending Revenue" style={styles.summaryPanel}>
					<View style={styles.summaryRow}>
						<Text style={[styles.summaryValue, { color: colors.textPrimary }]} numberOfLines={1}>DHS {totalDue}</Text>
						<Text style={[styles.summaryLabel, { color: colors.textPrimary }]}>FROM {payments.length} ACCOUNTS</Text>
					</View>
				</PrimaryPanel>
			</View>

			<FlatList
				data={payments}
				keyExtractor={(item) => item.id}
				contentContainerStyle={{
					paddingHorizontal: contentPadding,
					paddingBottom: 150,
					width: '100%',
					maxWidth: maxContentWidth,
					alignSelf: 'center',
				}}
				showsVerticalScrollIndicator={false}
				renderItem={({ item }) => (
					<Card borderless style={{ marginBottom: Theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
						<View style={[styles.info, stacked && styles.infoStacked]}>
							<View style={styles.infoCopy}>
								<Text style={[styles.name, { color: colors.textPrimary }]}>{item.name}</Text>
								<Text style={[styles.subText, { color: colors.textSecondary }]}>Paid: {item.totalPaid} / {item.pricePerMonth}</Text>
							</View>
							<Text style={[styles.amount, { color: colors.danger }, isCompact && styles.amountCompact]}>
								DHS {getDueAmount(item.pricePerMonth, item.totalPaid)}
							</Text>
						</View>

						<Button
							title="RECORD PAYMENT - ادائیگی درج کریں"
							onPress={() => recordPayment(item)}
							fullWidth
						/>
					</Card>
				)}
				ListEmptyComponent={
					<View style={styles.emptyContainer}>
						<Text style={[styles.empty, { color: colors.primary }]}>All payments received!</Text>
					</View>
				}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	summaryPanel: { marginVertical: Theme.spacing.md },
	info: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.md },
	infoStacked: { alignItems: 'flex-start', gap: Theme.spacing.sm },
	infoCopy: { flexShrink: 1 },
	name: { ...Theme.typography.labelMedium },
	subText: { ...Theme.typography.detail, marginTop: Theme.spacing.xs },
	amount: { ...Theme.typography.labelMedium, textAlign: 'right' },
	amountCompact: { textAlign: 'left' },
	emptyContainer: { alignItems: 'center', marginTop: Theme.spacing.massive, gap: Theme.spacing.lg },
	empty: { textAlign: 'center', ...Theme.typography.labelMedium },
	summaryRow: { alignItems: 'center', justifyContent: 'center' },
	summaryValue: { ...Theme.typography.answerGiant },
	summaryLabel: { ...Theme.typography.label, opacity: 0.6, marginTop: Theme.spacing.xs },
});
