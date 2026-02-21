import { addDoc, collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SETTINGS } from '../constants/Settings';
import { db } from '../firebase/config';
import { getCustomerStatus, getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { mockDb } from '../utils/mockDb';

type Customer = {
	id: string;
	name: string;
	phone: string;
	mealsPerDay: { lunch: boolean; dinner: boolean };
	plan?: string; // Legacy fallback
	pricePerMonth: number;
	startDate: any;
	endDate: any;
	totalPaid: number;
	notes: string;
	isActive: boolean;
};

export default function CustomersScreen() {
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(true);
	const [isAdding, setIsAdding] = useState(false);

	// Form State
	const [newName, setNewName] = useState("");
	const [newPhone, setNewPhone] = useState("");
	const [isLunch, setIsLunch] = useState(true);
	const [isDinner, setIsDinner] = useState(false);
	const [newPrice, setNewPrice] = useState("2500");
	const [newNotes, setNewNotes] = useState("");
	const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
	const [newEndDate, setNewEndDate] = useState(() => {
		const d = new Date();
		d.setMonth(d.getMonth() + 1);
		return d.toISOString().split('T')[0];
	});

	useEffect(() => {
		if (isLunch && isDinner) {
			setNewPrice("650");
		} else if (isLunch || isDinner) {
			setNewPrice("350");
		} else {
			setNewPrice("0");
		}
	}, [isLunch, isDinner]);

	useEffect(() => {
		const loadCustomers = () => {
			setCustomers(mockDb.getCustomers() as Customer[]);
			setLoading(false);
		};

		if (SETTINGS.USE_MOCKS) {
			loadCustomers();
			const unsub = mockDb.subscribe(loadCustomers);
			return unsub;
		}

		// Rule: If customer isActive -> show in Customers list
		const q = query(collection(db, "customers"), where("isActive", "==", true));

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
		if (!newName.trim()) {
			alert("Please enter a name");
			return;
		}

		try {
			if (!SETTINGS.USE_MOCKS) {
				await addDoc(collection(db, "customers"), {
					name: newName,
					phone: newPhone,
					mealsPerDay: { lunch: isLunch, dinner: isDinner },
					pricePerMonth: parseInt(newPrice) || 0,
					startDate: new Date(newStartDate),
					endDate: new Date(newEndDate),
					totalPaid: 0,
					notes: newNotes,
					isActive: true
				});
			} else {
				console.log("Mock Mode: Adding customer to local session storage");
				mockDb.addCustomer({
					id: `mock-${Date.now()}`,
					name: newName,
					phone: newPhone,
					mealsPerDay: { lunch: isLunch, dinner: isDinner },
					pricePerMonth: parseInt(newPrice) || 0,
					startDate: new Date(newStartDate).toISOString(),
					endDate: new Date(newEndDate).toISOString(),
					totalPaid: 0,
					notes: newNotes,
					isActive: true
				});
			}

			// Reset form
			setNewName("");
			setNewPhone("");
			setNewNotes("");
			setIsAdding(false);
		} catch (error) {
			console.error("Error adding customer:", error);
		}
	};

	const handleDeleteCustomer = async (id: string) => {
		if (!SETTINGS.USE_MOCKS) {
			try {
				await deleteDoc(doc(db, "customers", id));
			} catch (error) {
				console.error("Error deleting customer:", error);
			}
		} else {
			// Mock delete not implemented in mockDb yet but not strictly needed for this UI task
			console.log("Mock Mode: Delete not persisted");
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

					<Text style={styles.label}>Phone - فون نمبر</Text>
					<TextInput
						style={styles.input}
						value={newPhone}
						onChangeText={setNewPhone}
						placeholder="0300-1234567"
						keyboardType="phone-pad"
					/>

					<View style={styles.row}>
						<View style={{ flex: 1, marginRight: 10 }}>
							<Text style={styles.label}>Meals - کھانا</Text>
							<View style={styles.planSelector}>
								<TouchableOpacity
									style={[styles.planOption, isLunch && styles.planOptionSelected]}
									onPress={() => setIsLunch(!isLunch)}
								>
									<Text style={[styles.planOptionText, isLunch && styles.planOptionTextSelected]}>
										LUNCH
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.planOption, isDinner && styles.planOptionSelected]}
									onPress={() => setIsDinner(!isDinner)}
								>
									<Text style={[styles.planOptionText, isDinner && styles.planOptionTextSelected]}>
										DINNER
									</Text>
								</TouchableOpacity>
							</View>
						</View>
						<View style={{ flex: 1 }}>
							<Text style={styles.label}>Price - قیمت</Text>
							<TextInput
								style={styles.input}
								value={newPrice}
								onChangeText={setNewPrice}
								keyboardType="numeric"
							/>
						</View>
					</View>

					<View style={styles.row}>
						<View style={{ flex: 1, marginRight: 10 }}>
							<Text style={styles.label}>Start - تاریخ آغاز</Text>
							<TextInput
								style={styles.input}
								value={newStartDate}
								onChangeText={setNewStartDate}
								placeholder="YYYY-MM-DD"
							/>
						</View>
						<View style={{ flex: 1 }}>
							<Text style={styles.label}>End - تاریخ ختم</Text>
							<TextInput
								style={styles.input}
								value={newEndDate}
								onChangeText={setNewEndDate}
								placeholder="YYYY-MM-DD"
							/>
						</View>
					</View>

					<Text style={styles.label}>Notes - نوٹ</Text>
					<TextInput
						style={styles.input}
						value={newNotes}
						onChangeText={setNewNotes}
						placeholder="Any specific instructions..."
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
						<Text style={styles.name}>
							{item.name}
							{getCustomerStatus(toDate(item.endDate)) === 'expired' && " (EXPIRED)"}
							{getCustomerStatus(toDate(item.endDate)) === 'expiring-soon' && " (EXPIRING)"}
							{getDueAmount(item.pricePerMonth, item.totalPaid) > 0 && " (DUE)"}
						</Text>
						<View style={styles.details}>
							<Text style={styles.plan}>
								{item.mealsPerDay
									? [item.mealsPerDay.lunch && "Lunch", item.mealsPerDay.dinner && "Dinner"].filter(Boolean).join(" + ")
									: (item.plan || "Old Plan")}
								{" | DHS "}{item.pricePerMonth}
							</Text>
							<Text style={styles.phone}>{item.phone}</Text>
						</View>
						<View style={[styles.details, { marginTop: 5 }]}>
							<Text style={styles.dates}>
								{toDate(item.startDate).toLocaleDateString()} to {toDate(item.endDate).toLocaleDateString()}
							</Text>
							<View style={styles.statusBadge}>
								{getCustomerStatus(toDate(item.endDate)) === 'expired' && <Text style={styles.expiredLabel}>EXPIRED</Text>}
								{getCustomerStatus(toDate(item.endDate)) === 'expiring-soon' && <Text style={styles.expiringLabel}>EXPIRING SOON</Text>}
								<Text style={styles.paid}>Paid: {item.totalPaid}</Text>
							</View>
						</View>
						<View style={[styles.details, { marginTop: 10 }]}>
							<Text style={[
								styles.daysRemaining,
								getCustomerStatus(toDate(item.endDate)) === 'expired' && styles.textRed,
								getCustomerStatus(toDate(item.endDate)) === 'expiring-soon' && styles.textOrange
							]}>
								{getDaysLeft(toDate(item.endDate))} days left
							</Text>
							<TouchableOpacity
								style={styles.deleteBtn}
								onPress={() => handleDeleteCustomer(item.id)}
							>
								<Text style={styles.deleteBtnText}>DELETE</Text>
							</TouchableOpacity>
						</View>
						{item.notes ? <Text style={styles.notes}>Note: {item.notes}</Text> : null}
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
		backgroundColor: '#fff',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
	},
	addBtn: {
		backgroundColor: '#2e7d32',
		width: 40,
		height: 40,
		borderRadius: 20,
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
		padding: 20,
		backgroundColor: '#f9f9f9',
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	label: {
		fontSize: 16,
		fontWeight: '600',
		color: '#666',
		marginBottom: 5,
		marginTop: 10,
	},
	input: {
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
	},
	row: {
		flexDirection: 'row',
		marginTop: 5,
	},
	planSelector: {
		flexDirection: 'row',
		backgroundColor: '#eee',
		borderRadius: 8,
		padding: 3,
	},
	planOption: {
		flex: 1,
		paddingVertical: 10,
		alignItems: 'center',
		borderRadius: 6,
	},
	planOptionSelected: {
		backgroundColor: '#fff',
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 1,
	},
	planOptionText: {
		fontSize: 12,
		fontWeight: 'bold',
		color: '#666',
	},
	planOptionTextSelected: {
		color: '#2e7d32',
	},
	saveBtn: {
		backgroundColor: '#2e7d32',
		paddingVertical: 15,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 20,
	},
	saveBtnText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
	},
	card: {
		margin: 20,
		marginTop: 0,
		marginBottom: 20,
		padding: 20,
		backgroundColor: '#fff',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#eee',
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	name: {
		fontSize: 22,
		fontWeight: 'bold',
		color: '#1a1a1a',
	},
	details: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 8,
	},
	plan: {
		fontSize: 16,
		fontWeight: '600',
		color: '#2e7d32',
	},
	phone: {
		fontSize: 16,
		color: '#666',
	},
	dates: {
		fontSize: 14,
		color: '#999',
	},
	statusBadge: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	expiredLabel: {
		backgroundColor: '#ffebee',
		color: '#d32f2f',
		fontSize: 10,
		fontWeight: 'bold',
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
		marginRight: 6,
	},
	expiringLabel: {
		backgroundColor: '#fff3e0',
		color: '#ef6c00',
		fontSize: 10,
		fontWeight: 'bold',
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
		marginRight: 6,
	},
	paid: {
		fontSize: 14,
		fontWeight: 'bold',
		color: '#2e7d32',
	},
	daysRemaining: {
		marginTop: 10,
		fontSize: 14,
		fontWeight: 'bold',
		color: '#666',
	},
	textRed: {
		color: '#d32f2f',
	},
	textOrange: {
		color: '#ef6c00',
	},
	empty: {
		textAlign: 'center',
		fontSize: 16,
		color: '#999',
		marginTop: 40,
	},
	notes: {
		fontSize: 13,
		color: '#888',
		fontStyle: 'italic',
		marginTop: 8,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: '#f0f0f0',
	},
	deleteBtn: {
		backgroundColor: '#ffebee',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 6,
	},
	deleteBtnText: {
		color: '#d32f2f',
		fontSize: 12,
		fontWeight: 'bold',
	}
});
