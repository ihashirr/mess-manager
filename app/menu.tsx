import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SETTINGS } from '../constants/Settings';
import { db } from '../firebase/config';
import mockMenu from '../mocks/menu.json';

type MealSlot = { rice: string; roti: string; side: string };
type MenuState = { lunch: MealSlot; dinner: MealSlot };

const EMPTY_MEAL: MealSlot = { rice: "", roti: "", side: "" };

export default function MenuScreen() {
	const [isEditing, setIsEditing] = useState(false);
	const [menu, setMenu] = useState<MenuState>({
		lunch: { ...EMPTY_MEAL },
		dinner: { ...EMPTY_MEAL },
	});
	const [loading, setLoading] = useState(true);

	const today = new Date().toISOString().split('T')[0];

	useEffect(() => {
		if (SETTINGS.USE_MOCKS) {
			setMenu({
				lunch: mockMenu.lunch as MealSlot,
				dinner: mockMenu.dinner as MealSlot,
			});
			setLoading(false);
			return;
		}

		const unsub = onSnapshot(doc(db, "menu", today), (docSnap) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				setMenu({
					lunch: data.lunch || { ...EMPTY_MEAL },
					dinner: data.dinner || { ...EMPTY_MEAL },
				});
			} else {
				setMenu({ lunch: { ...EMPTY_MEAL }, dinner: { ...EMPTY_MEAL } });
			}
			setLoading(false);
		});

		return () => unsub();
	}, [today]);

	const updateField = (meal: 'lunch' | 'dinner', field: keyof MealSlot, value: string) => {
		setMenu(prev => ({ ...prev, [meal]: { ...prev[meal], [field]: value } }));
	};

	const handleSave = async () => {
		try {
			if (!SETTINGS.USE_MOCKS) {
				await setDoc(doc(db, "menu", today), {
					date: today,
					lunch: menu.lunch,
					dinner: menu.dinner,
					updatedAt: new Date().toISOString()
				});
			} else {
				console.log("Mock Mode: Menu not saved to real DB");
			}
			setIsEditing(false);
		} catch (error) {
			console.error("Error saving menu:", error);
		}
	};

	if (loading) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator size="large" color="#000" />
			</View>
		);
	}

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<View style={styles.header}>
				<Text style={styles.title}>Menu Setup</Text>
				<TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
					<MaterialCommunityIcons
						name={isEditing ? "close-circle" : "cog"}
						size={32}
						color={isEditing ? "#d32f2f" : "#666"}
					/>
				</TouchableOpacity>
			</View>

			{(['lunch', 'dinner'] as const).map((meal) => (
				<View key={meal} style={styles.mealSection}>
					<Text style={styles.mealHeader}>
						{meal === 'lunch' ? '☀️ LUNCH TODAY — دوپہر کا کھانا' : '🌙 DINNER TODAY — رات کا کھانا'}
					</Text>

					{(['rice', 'roti', 'side'] as const).map((field) => (
						<View key={field} style={styles.fieldRow}>
							<Text style={styles.fieldIcon}>
								{field === 'rice' ? '🍚' : field === 'roti' ? '🫓' : '🥗'}
							</Text>
							<View style={styles.fieldContent}>
								<Text style={styles.fieldLabel}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
								{isEditing ? (
									<TextInput
										style={styles.input}
										value={menu[meal][field]}
										onChangeText={(v) => updateField(meal, field, v)}
										placeholder={`Enter ${field} dish...`}
									/>
								) : (
									<Text style={styles.fieldValue}>
										{menu[meal][field] || <Text style={styles.empty}>—</Text>}
									</Text>
								)}
							</View>
						</View>
					))}

					{meal === 'lunch' && <View style={styles.divider} />}
				</View>
			))}

			{isEditing && (
				<TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
					<Text style={styles.saveBtnText}>SAVE — محفوظ کریں</Text>
				</TouchableOpacity>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#fff' },
	content: { padding: 25, paddingBottom: 50 },
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 30,
		marginTop: 10,
	},
	title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' },
	mealSection: { marginBottom: 10 },
	mealHeader: {
		fontSize: 15,
		fontWeight: '800',
		color: '#d32f2f',
		letterSpacing: 0.5,
		marginBottom: 18,
	},
	fieldRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 18,
	},
	fieldIcon: { fontSize: 26, marginRight: 14, marginTop: 2 },
	fieldContent: { flex: 1 },
	fieldLabel: {
		fontSize: 12,
		fontWeight: '800',
		color: '#999',
		letterSpacing: 1,
		marginBottom: 4,
		textTransform: 'uppercase',
	},
	fieldValue: {
		fontSize: 32,
		fontWeight: '900',
		color: '#1a1a1a',
		lineHeight: 38,
	},
	empty: { fontSize: 28, color: '#ccc' },
	input: {
		fontSize: 20,
		borderWidth: 2,
		borderColor: '#eee',
		borderRadius: 10,
		padding: 12,
		backgroundColor: '#f8f9fa',
	},
	divider: { height: 2, backgroundColor: '#f0f0f0', marginVertical: 25 },
	saveBtn: {
		backgroundColor: '#2e7d32',
		padding: 20,
		borderRadius: 15,
		alignItems: 'center',
		marginTop: 20,
		elevation: 5,
	},
	saveBtnText: { color: '#fff', fontSize: 22, fontWeight: '900' },
});
