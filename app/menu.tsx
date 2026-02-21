import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SETTINGS } from '../constants/Settings';
import { db } from '../firebase/config';
import { DAYS, DayName, getDateForDayName, getTodayName, getWeekId, shortDay } from '../utils/weekLogic';

type RiceSlot = { enabled: boolean; type: string };
type MealSlot = { main: string; rice: RiceSlot; roti: boolean; extra: string };
type DayMenu = { lunch: MealSlot; dinner: MealSlot };
type WeekMenu = Partial<Record<DayName, DayMenu>>;

const EMPTY_MEAL: MealSlot = { main: "", rice: { enabled: false, type: "" }, roti: true, extra: "" };
const EMPTY_DAY: DayMenu = { lunch: { ...EMPTY_MEAL }, dinner: { ...EMPTY_MEAL } };

const normalizeMeal = (raw: any): MealSlot => ({
	main: typeof raw?.main === 'string' ? raw.main : "",
	rice: (raw?.rice && typeof raw.rice === 'object' && 'enabled' in raw.rice)
		? raw.rice
		: { enabled: false, type: typeof raw?.rice === 'string' ? raw.rice : "" },
	roti: typeof raw?.roti === 'boolean' ? raw.roti : true,
	extra: typeof raw?.extra === 'string' ? raw.extra : (raw?.side || ""),
});

export default function MenuScreen() {
	const weekId = getWeekId();
	const todayName = getTodayName();

	const [selectedDay, setSelectedDay] = useState<DayName>(todayName);
	const [isEditing, setIsEditing] = useState(false);
	const [weekMenu, setWeekMenu] = useState<WeekMenu>({});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const selectedDate = getDateForDayName(selectedDay, weekId);

		if (SETTINGS.USE_MOCKS) {
			setWeekMenu({ [selectedDay]: { ...EMPTY_DAY } });
			setLoading(false);
			return;
		}

		console.log("Subscribing to menu:", selectedDate);
		const unsub = onSnapshot(doc(db, "menu", selectedDate), (docSnap) => {
			const raw = docSnap.exists() ? docSnap.data() : {};
			const normalized: DayMenu = {
				lunch: normalizeMeal(raw.lunch),
				dinner: normalizeMeal(raw.dinner),
			};
			setWeekMenu(prev => ({ ...prev, [selectedDay]: normalized }));
			setLoading(false);
		});
		return () => unsub();
	}, [selectedDay, weekId]);

	const currentDay = weekMenu[selectedDay] ?? EMPTY_DAY;

	const updateMeal = (meal: 'lunch' | 'dinner', field: keyof MealSlot, value: any) => {
		setWeekMenu(prev => ({
			...prev,
			[selectedDay]: {
				...prev[selectedDay] ?? EMPTY_DAY,
				[meal]: { ...((prev[selectedDay] ?? EMPTY_DAY)[meal]), [field]: value }
			}
		}));
	};

	const updateRice = (meal: 'lunch' | 'dinner', field: keyof RiceSlot, value: any) => {
		setWeekMenu(prev => ({
			...prev,
			[selectedDay]: {
				...prev[selectedDay] ?? EMPTY_DAY,
				[meal]: {
					...((prev[selectedDay] ?? EMPTY_DAY)[meal]),
					rice: { ...((prev[selectedDay] ?? EMPTY_DAY)[meal].rice), [field]: value }
				}
			}
		}));
	};

	const handleSave = async () => {
		const selectedDate = getDateForDayName(selectedDay, weekId);
		try {
			if (!SETTINGS.USE_MOCKS) {
				const dayData = weekMenu[selectedDay] ?? EMPTY_DAY;
				await setDoc(doc(db, "menu", selectedDate), {
					...dayData,
					updatedAt: new Date().toISOString()
				}, { merge: true });
			}
			setIsEditing(false);
		} catch (error) {
			console.error("Error saving daily menu:", error);
		}
	};

	if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#000" /></View>;

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<View style={styles.header}>
				<View>
					<Text style={styles.title}>Weekly Menu</Text>
					<Text style={styles.weekLabel}>Week {weekId}</Text>
				</View>
				<TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
					<MaterialCommunityIcons
						name={isEditing ? "close-circle" : "cog"}
						size={32}
						color={isEditing ? "#d32f2f" : "#666"}
					/>
				</TouchableOpacity>
			</View>

			{/* Day Picker */}
			<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
				{DAYS.map(day => (
					<TouchableOpacity
						key={day}
						style={[
							styles.dayChip,
							selectedDay === day && styles.dayChipActive,
							day === todayName && styles.dayChipToday,
						]}
						onPress={() => { setSelectedDay(day); setIsEditing(false); }}
					>
						<Text style={[styles.dayChipText, selectedDay === day && styles.dayChipTextActive]}>
							{shortDay(day)}
						</Text>
						{day === todayName && <Text style={styles.todayDot}>●</Text>}
					</TouchableOpacity>
				))}
			</ScrollView>

			<Text style={styles.selectedDayLabel}>
				{selectedDay}{selectedDay === todayName ? " — Today" : ""}
			</Text>

			{/* Meal Sections */}
			{(['lunch', 'dinner'] as const).map((meal, idx) => {
				const slot = currentDay[meal];
				return (
					<View key={meal} style={styles.mealSection}>
						<Text style={styles.mealHeader}>
							{meal === 'lunch' ? '☀️ LUNCH — دوپہر' : '🌙 DINNER — رات'}
						</Text>

						{/* Main Salan */}
						<View style={styles.fieldGroup}>
							<Text style={styles.fieldLabel}>🍲 MAIN SALAN</Text>
							{isEditing ? (
								<TextInput
									style={styles.input}
									value={slot.main}
									onChangeText={(v) => updateMeal(meal, 'main', v)}
									placeholder="e.g. Chicken Karahi, Daal..."
								/>
							) : (
								<Text style={styles.mainValue}>{slot.main || '—'}</Text>
							)}
						</View>

						{/* Roti */}
						<View style={styles.toggleRow}>
							<Text style={styles.toggleLabel}>🫓 Roti</Text>
							{isEditing ? (
								<Switch
									value={slot.roti}
									onValueChange={(v) => updateMeal(meal, 'roti', v)}
									trackColor={{ false: '#ccc', true: '#2e7d32' }}
									thumbColor="#fff"
								/>
							) : (
								<Text style={[styles.toggleValue, { color: slot.roti ? '#2e7d32' : '#999' }]}>
									{slot.roti ? 'Yes' : 'No'}
								</Text>
							)}
						</View>

						{/* Rice */}
						<View style={styles.toggleRow}>
							<Text style={styles.toggleLabel}>🍚 Rice</Text>
							{isEditing ? (
								<Switch
									value={slot.rice.enabled}
									onValueChange={(v) => updateRice(meal, 'enabled', v)}
									trackColor={{ false: '#ccc', true: '#2e7d32' }}
									thumbColor="#fff"
								/>
							) : (
								<Text style={[styles.toggleValue, { color: slot.rice.enabled ? '#2e7d32' : '#999' }]}>
									{slot.rice.enabled ? (slot.rice.type || 'Yes') : 'No Rice'}
								</Text>
							)}
						</View>

						{slot.rice.enabled && (
							<View style={{ paddingLeft: 44, marginTop: -8, marginBottom: 10 }}>
								{isEditing ? (
									<TextInput
										style={styles.inputSmall}
										value={slot.rice.type}
										onChangeText={(v) => updateRice(meal, 'type', v)}
										placeholder="e.g. Plain Rice, Biryani..."
									/>
								) : (
									<Text style={styles.subValue}>{slot.rice.type}</Text>
								)}
							</View>
						)}

						{/* Extra */}
						<View style={styles.fieldGroup}>
							<Text style={styles.fieldLabel}>🥗 EXTRA (optional)</Text>
							{isEditing ? (
								<TextInput
									style={styles.input}
									value={slot.extra}
									onChangeText={(v) => updateMeal(meal, 'extra', v)}
									placeholder="e.g. Raita, Salad..."
								/>
							) : (
								<Text style={styles.subValue}>{slot.extra || '—'}</Text>
							)}
						</View>

						{idx === 0 && <View style={styles.divider} />}
					</View>
				);
			})}

			{isEditing && (
				<TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
					<Text style={styles.saveBtnText}>SAVE {shortDay(selectedDay).toUpperCase()} — محفوظ کریں</Text>
				</TouchableOpacity>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#fff' },
	content: { padding: 25, paddingBottom: 60 },
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	header: {
		flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
		marginBottom: 20, marginTop: 10,
	},
	title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' },
	weekLabel: { fontSize: 13, color: '#999', marginTop: 2 },

	// Day picker
	dayScroll: { marginBottom: 16 },
	dayChip: {
		paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
		backgroundColor: '#f0f0f0', marginRight: 8, alignItems: 'center', minWidth: 50,
	},
	dayChipActive: { backgroundColor: '#1a1a1a' },
	dayChipToday: { borderWidth: 2, borderColor: '#2e7d32' },
	dayChipText: { fontSize: 14, fontWeight: '700', color: '#666' },
	dayChipTextActive: { color: '#fff' },
	todayDot: { fontSize: 8, color: '#2e7d32', marginTop: 2 },
	selectedDayLabel: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },

	mealSection: { marginBottom: 10 },
	mealHeader: { fontSize: 14, fontWeight: '800', color: '#d32f2f', letterSpacing: 0.5, marginBottom: 18 },
	fieldGroup: { marginBottom: 16 },
	fieldLabel: { fontSize: 11, fontWeight: '800', color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
	mainValue: { fontSize: 32, fontWeight: '900', color: '#1a1a1a', lineHeight: 38 },
	subValue: { fontSize: 18, fontWeight: '700', color: '#444' },
	toggleRow: {
		flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
		marginBottom: 14, paddingVertical: 4,
	},
	toggleLabel: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
	toggleValue: { fontSize: 18, fontWeight: '800' },
	input: { fontSize: 20, borderWidth: 2, borderColor: '#eee', borderRadius: 10, padding: 12, backgroundColor: '#f8f9fa' },
	inputSmall: { fontSize: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, backgroundColor: '#f8f9fa', marginBottom: 10 },
	divider: { height: 2, backgroundColor: '#f0f0f0', marginVertical: 28 },
	saveBtn: { backgroundColor: '#2e7d32', padding: 20, borderRadius: 15, alignItems: 'center', marginTop: 20, elevation: 5 },
	saveBtnText: { color: '#fff', fontSize: 20, fontWeight: '900' },
});
