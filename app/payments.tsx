import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SETTINGS } from '../constants/Settings';
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

	return (
		<View style={styles.container}>
			<FlatList
				data={payments}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<View style={styles.card}>
						<View style={styles.info}>
							<View>
								<Text style={styles.name}>{item.name}</Text>
								<Text style={styles.subText}>Paid: {item.totalPaid} / {item.pricePerMonth}</Text>
							</View>
							<Text style={styles.amount}>DHS {getDueAmount(item.pricePerMonth, item.totalPaid)}</Text>
						</View>

						<TouchableOpacity
							style={styles.button}
							onPress={() => recordPayment(item)}
						>
							<Text style={styles.buttonText}>RECORD PAYMENT - ادائیگی درج کریں</Text>
						</TouchableOpacity>
					</View>
				)}
				ListEmptyComponent={<Text style={styles.empty}>All payments received! ✅</Text>}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#fff',
	},
	card: {
		padding: 20,
		borderWidth: 1,
		borderColor: '#eee',
		borderRadius: 12,
		marginBottom: 20,
		backgroundColor: '#f9f9f9',
	},
	info: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 15,
	},
	name: {
		fontSize: 22,
		fontWeight: 'bold',
	},
	subText: {
		fontSize: 16,
		color: '#666',
		marginTop: 2,
	},
	amount: {
		fontSize: 22,
		fontWeight: 'bold',
		color: '#d32f2f',
	},
	button: {
		backgroundColor: '#2e7d32',
		paddingVertical: 15,
		borderRadius: 8,
		alignItems: 'center',
	},
	buttonText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: '800',
		letterSpacing: 1,
	},
	empty: {
		textAlign: 'center',
		fontSize: 18,
		marginTop: 50,
		color: '#2e7d32',
		fontWeight: 'bold',
	}
});
