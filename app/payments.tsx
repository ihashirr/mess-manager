import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase/config';

type Payment = {
	id: string;
	name: string;
	amount: string;
	paymentDue: boolean;
};

export default function PaymentsScreen() {
	const [payments, setPayments] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Rule: If paymentDue === true -> show in Payments list
		const q = query(collection(db, "customers"), where("paymentDue", "==", true));

		const unsubscribe = onSnapshot(q, (querySnapshot) => {
			const paymentsArray: Payment[] = [];
			querySnapshot.forEach((doc) => {
				paymentsArray.push({ id: doc.id, ...doc.data() } as Payment);
			});
			setPayments(paymentsArray);
			setLoading(false);
		});

		return () => unsubscribe();
	}, []);

	const markAsPaid = async (id: string) => {
		try {
			const customerRef = doc(db, "customers", id);
			await updateDoc(customerRef, {
				paymentDue: false
			});
			console.log("Payment marked as paid in DB");
		} catch (error) {
			console.error("Error updating payment status:", error);
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
							<Text style={styles.name}>{item.name}</Text>
							<Text style={styles.amount}>Rs. {item.amount}</Text>
						</View>

						<TouchableOpacity
							style={styles.button}
							onPress={() => markAsPaid(item.id)}
						>
							<Text style={styles.buttonText}>PAID - وصول ہو گیا</Text>
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
	amount: {
		fontSize: 22,
		fontWeight: 'bold',
		color: '#2e7d32',
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
