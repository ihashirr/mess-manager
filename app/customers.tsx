import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SETTINGS } from '../constants/Settings';
import { db } from '../firebase/config';
import mockCustomers from '../mocks/customers.json';

type Customer = {
	id: string;
	name: string;
	plan: string;
	daysLeft: number;
	paymentDue: boolean;
	amount: string;
};

export default function CustomersScreen() {
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(true);
	const [isAdding, setIsAdding] = useState(false);

	// Form State
	const [newName, setNewName] = useState("");
	const [newPlan, setNewPlan] = useState("Lunch");
	const [newAmount, setNewAmount] = useState("2500");
	const [newDays, setNewDays] = useState("30");

	useEffect(() => {
		if (SETTINGS.USE_MOCKS) {
			setCustomers(mockCustomers as Customer[]);
			setLoading(false);
			return;
		}

		// Rule: If customer daysLeft > 0 -> show in Customers list
		const q = query(collection(db, "customers"), where("daysLeft", ">", 0));

		const unsubscribe = onSnapshot(q, (querySnapshot) => {
			const customersArray: Customer[] = [];
			querySnapshot.forEach((doc) => {
				customersArray.push({ id: doc.id, ...doc.data() } as Customer);
			});
			setCustomers(customersArray);
			setLoading(false);
		});

		return () => unsubscribe();
	}, []);

	const handleAddCustomer = async () => {
		if (!newName.trim()) return;

		try {
			await addDoc(collection(db, "customers"), {
				name: newName,
				plan: newPlan,
				amount: newAmount,
				daysLeft: parseInt(newDays) || 0,
				paymentDue: true // New customers usually start with a payment due
			});

			// Reset form
			setNewName("");
			setIsAdding(false);
		} catch (error) {
			console.error("Error adding customer:", error);
		}
	};

	if (loading) return <View style={styles.container}><Text>Loading...</Text></View>;

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>Active Customers</Text>
				<TouchableOpacity
					style={[styles.addBtn, isAdding && styles.cancelBtn]}
					onPress={() => setIsAdding(!isAdding)}
				>
					<Text style={styles.addBtnText}>{isAdding ? "✕" : "+"}</Text>
				</TouchableOpacity>
			</View>

			{isAdding && (
				<View style={styles.form}>
					<Text style={styles.label}>Name - نام</Text>
					<TextInput
						style={styles.input}
						value={newName}
						onChangeText={setNewName}
						placeholder="Customer Name"
					/>

					<View style={styles.row}>
						<View style={{ flex: 1, marginRight: 10 }}>
							<Text style={styles.label}>Plan - پروگرام</Text>
							<TextInput
								style={styles.input}
								value={newPlan}
								onChangeText={setNewPlan}
							/>
						</View>
						<View style={{ flex: 1 }}>
							<Text style={styles.label}>Amount - رقم</Text>
							<TextInput
								style={styles.input}
								value={newAmount}
								onChangeText={setNewAmount}
								keyboardType="numeric"
							/>
						</View>
					</View>

					<Text style={styles.label}>Days - دن</Text>
					<TextInput
						style={styles.input}
						value={newDays}
						onChangeText={setNewDays}
						keyboardType="numeric"
					/>

					<TouchableOpacity
						style={styles.saveBtn}
						onPress={handleAddCustomer}
					>
						<Text style={styles.saveBtnText}>SAVE CUSTOMER - محفوظ کریں</Text>
					</TouchableOpacity>
				</View>
			)}

			<FlatList
				data={customers}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<View style={styles.card}>
						<Text style={styles.name}>{item.name}</Text>
						<View style={styles.details}>
							<Text style={styles.plan}>{item.plan}</Text>
							<Text style={styles.days}>{item.daysLeft} days left</Text>
						</View>
					</View>
				)}
				ListEmptyComponent={!isAdding ? <Text style={styles.empty}>No active customers</Text> : null}
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
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20,
		marginTop: 10,
	},
	title: {
		fontSize: 28,
		fontWeight: 'bold',
		color: '#1a1a1a',
	},
	addBtn: {
		backgroundColor: '#000',
		width: 44,
		height: 44,
		borderRadius: 22,
		justifyContent: 'center',
		alignItems: 'center',
	},
	cancelBtn: {
		backgroundColor: '#d32f2f',
	},
	addBtnText: {
		color: '#fff',
		fontSize: 24,
		fontWeight: 'bold',
	},
	form: {
		backgroundColor: '#f8f9fa',
		padding: 20,
		borderRadius: 15,
		marginBottom: 20,
		borderWidth: 1,
		borderColor: '#e9ecef',
	},
	label: {
		fontSize: 16,
		fontWeight: '700',
		color: '#495057',
		marginBottom: 5,
	},
	input: {
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#dee2e6',
		borderRadius: 8,
		padding: 12,
		fontSize: 18,
		marginBottom: 15,
	},
	row: {
		flexDirection: 'row',
	},
	saveBtn: {
		backgroundColor: '#2e7d32',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 10,
	},
	saveBtnText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: '800',
	},
	card: {
		padding: 20,
		borderWidth: 1,
		borderColor: '#eee',
		borderRadius: 12,
		marginBottom: 15,
	},
	name: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 8,
	},
	details: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	plan: {
		fontSize: 18,
		color: '#666',
	},
	days: {
		fontSize: 18,
		fontWeight: '600',
		color: '#d32f2f',
	},
	empty: {
		textAlign: 'center',
		fontSize: 18,
		marginTop: 50,
		color: '#999',
	}
});
