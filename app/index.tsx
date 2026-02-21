import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SETTINGS } from '../constants/Settings';
import { db } from '../firebase/config';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { mockDb } from '../utils/mockDb';
import { formatISO, getTodayName } from '../utils/weekLogic';

type RiceSlot = { enabled: boolean; type: string };
type MealSlot = { main: string; rice: RiceSlot; roti: boolean; extra: string };
type DayMenu = { lunch: MealSlot; dinner: MealSlot };

const EMPTY_MEAL: MealSlot = { main: "", rice: { enabled: false, type: "" }, roti: true, extra: "" };

const normalizeMeal = (raw: any): MealSlot => ({
	main: typeof raw?.main === 'string' ? raw.main : "",
	rice: (raw?.rice && typeof raw.rice === 'object' && 'enabled' in raw.rice)
		? raw.rice
		: { enabled: false, type: typeof raw?.rice === 'string' ? raw.rice : "" },
	roti: typeof raw?.roti === 'boolean' ? raw.roti : true,
	extra: typeof raw?.extra === 'string' ? raw.extra : (raw?.side || ""),
});

type Customer = {
	id: string;
	name: string;
	mealsPerDay?: { lunch: boolean; dinner: boolean };
	pricePerMonth: number;
	totalPaid: number;
	endDate: any;
};

type AttendanceState = Record<string, { lunch: boolean; dinner: boolean }>;

export default function Index() {
	const todayDate = formatISO(new Date());
	const todayName = getTodayName();

	const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance'>('dashboard');
	const [todayMenu, setTodayMenu] = useState<DayMenu>({ lunch: { ...EMPTY_MEAL }, dinner: { ...EMPTY_MEAL } });
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [attendance, setAttendance] = useState<AttendanceState>({});
	const [stats, setStats] = useState({ activeCount: 0, paymentsDue: 0, lunchCount: 0, dinnerCount: 0 });
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (SETTINGS.USE_MOCKS) {
			const cs = mockDb.getCustomers() as Customer[];
			setCustomers(cs.filter(c => getDaysLeft(toDate(c.endDate)) >= 0));
			setLoading(false);
			return;
		}

		// 1. Subscribe to Today's Menu
		const unsubMenu = onSnapshot(doc(db, "menu", todayDate), (snap) => {
			const data = snap.exists() ? snap.data() : {};
			setTodayMenu({
				lunch: normalizeMeal(data.lunch),
				dinner: normalizeMeal(data.dinner),
			});
		});

		// 2. Subscribe to Active Customers
		const unsubCustomers = onSnapshot(query(collection(db, "customers")), (snap) => {
			const active: Customer[] = [];
			let due = 0;
			snap.forEach(d => {
				const data = { id: d.id, ...d.data() } as Customer;
				if (getDaysLeft(toDate(data.endDate)) >= 0) {
					active.push(data);
					if (getDueAmount(data.pricePerMonth, data.totalPaid) > 0) due++;
				}
			});
			setCustomers(active);
			setStats(prev => ({ ...prev, activeCount: active.length, paymentsDue: due }));
			setLoading(false);
		});

		// 3. Subscribe to Today's Attendance
		const unsubAttendance = onSnapshot(
			query(collection(db, "attendance"), where("date", "==", todayDate)),
			(snap) => {
				const state: AttendanceState = {};
				let lCount = 0, dCount = 0;
				snap.forEach(d => {
					const data = d.data();
					state[data.customerId] = { lunch: data.lunch, dinner: data.dinner };
				});
				setAttendance(state);
			}
		);

		return () => { unsubMenu(); unsubCustomers(); unsubAttendance(); };
	}, [todayDate]);

	// Calculate Derived Production Counts
	useEffect(() => {
		let lCount = 0, dCount = 0;
		customers.forEach(c => {
			const selection = attendance[c.id];
			const subscribedLunch = c.mealsPerDay?.lunch !== false;
			const subscribedDinner = c.mealsPerDay?.dinner !== false;

			// If selection exists, use it. Else, assume YES (opt-out).
			if (subscribedLunch && (!selection || selection.lunch !== false)) lCount++;
			if (subscribedDinner && (!selection || selection.dinner !== false)) dCount++;
		});
		setStats(prev => ({ ...prev, lunchCount: lCount, dinnerCount: dCount }));
	}, [customers, attendance]);

	const toggleTodayAttendance = async (customerId: string, meal: 'lunch' | 'dinner') => {
		const current = attendance[customerId] || { lunch: true, dinner: true };
		const newValue = !current[meal];

		if (!SETTINGS.USE_MOCKS) {
			try {
				await setDoc(doc(db, "attendance", `${todayDate}_${customerId}`), {
					customerId,
					date: todayDate,
					...current,
					[meal]: newValue,
					updatedAt: new Date().toISOString()
				}, { merge: true });
			} catch (e) {
				console.error("Error toggling attendance:", e);
			}
		} else {
			setAttendance(prev => ({
				...prev,
				[customerId]: { ...current, [meal]: newValue }
			}));
		}
	};

	if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#000" /></View>;

	return (
		<View style={styles.container}>
			{/* Segmented Control */}
			<View style={styles.tabBar}>
				<TouchableOpacity
					style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
					onPress={() => setActiveTab('dashboard')}
				>
					<Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>📊 DASHBOARD</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.tab, activeTab === 'attendance' && styles.tabActive]}
					onPress={() => setActiveTab('attendance')}
				>
					<Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>📝 ATTENDANCE</Text>
				</TouchableOpacity>
			</View>

			<ScrollView contentContainerStyle={styles.scrollContent}>
				{activeTab === 'dashboard' ? (
					<>
						<Text style={styles.dateLabel}>
							{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
						</Text>

						<Text style={styles.sectionHeader}>🍽️ Today's Production — آج کتنا پکانا ہے</Text>

						<MealCard label="☀️ Lunch" count={stats.lunchCount} slot={todayMenu.lunch} />
						<MealCard label="🌙 Dinner" count={stats.dinnerCount} slot={todayMenu.dinner} />

						<View style={styles.totalRow}>
							<Text style={styles.totalLabel}>Total Meals Today</Text>
							<Text style={styles.totalCount}>{stats.lunchCount + stats.dinnerCount}</Text>
						</View>

						<View style={styles.statsRow}>
							<View style={[styles.statCard, { borderColor: '#2e7d32' }]}>
								<Text style={styles.statValue}>{stats.activeCount}</Text>
								<Text style={styles.statLabel}>Active{'\n'}Customers</Text>
							</View>
							<View style={[styles.statCard, { borderColor: '#d32f2f' }]}>
								<Text style={[styles.statValue, { color: '#d32f2f' }]}>{stats.paymentsDue}</Text>
								<Text style={styles.statLabel}>Payments{'\n'}Due</Text>
							</View>
						</View>
					</>
				) : (
					<>
						<Text style={styles.sectionHeader}>📋 Who is eating today? — آج کون کھائے گا؟</Text>
						{customers.map(c => (
							<CustomerAttendanceRow
								key={c.id}
								customer={c}
								menu={todayMenu}
								attendance={attendance[c.id]}
								onToggle={(meal: 'lunch' | 'dinner') => toggleTodayAttendance(c.id, meal)}
							/>
						))}
						{customers.length === 0 && <Text style={styles.emptyText}>No active customers found.</Text>}
					</>
				)}
			</ScrollView>
		</View>
	);
}

const MealCard = ({ label, count, slot }: { label: string; count: number; slot: MealSlot }) => {
	const riceType = slot.rice.enabled ? (slot.rice.type || "Plain Rice") : "No Rice";
	return (
		<View style={styles.mealCard}>
			<View style={styles.mealCardHeader}>
				<Text style={styles.mealCardTitle}>{label}</Text>
				<View style={styles.plateBadge}>
					<Text style={styles.plateCount}>{count}</Text>
					<Text style={styles.plateSub}>plates</Text>
				</View>
			</View>
			<Text style={styles.mainSalanLabel}>🍲 MAIN SALAN</Text>
			<Text style={styles.mainSalanValue}>{slot.main || 'Not set'}</Text>
			<View style={styles.servingRow}>
				<Text style={styles.servingText}>🫓 {slot.roti ? "Roti" : "No Roti"}</Text>
				<Text style={styles.servingText}>🍚 {riceType}</Text>
			</View>
		</View>
	);
};

const CustomerAttendanceRow = ({ customer, menu, attendance, onToggle }: any) => {
	const sel = attendance || { lunch: true, dinner: true };
	const subLunch = customer.mealsPerDay?.lunch !== false;
	const subDinner = customer.mealsPerDay?.dinner !== false;

	return (
		<View style={styles.customerRow}>
			<View style={styles.customerInfo}>
				<Text style={styles.customerName}>{customer.name}</Text>
			</View>
			<View style={styles.toggleGroup}>
				{subLunch && (
					<TouchableOpacity
						style={[styles.toggleBtn, sel.lunch && styles.toggleBtnOn]}
						onPress={() => onToggle('lunch')}
					>
						<Text style={styles.toggleBtnLabel}>LUNCH</Text>
						<Text style={styles.toggleBtnDish} numberOfLines={1}>{menu.lunch.main || 'Rice/Roti'}</Text>
					</TouchableOpacity>
				)}
				{subDinner && (
					<TouchableOpacity
						style={[styles.toggleBtn, sel.dinner && styles.toggleBtnOn]}
						onPress={() => onToggle('dinner')}
					>
						<Text style={styles.toggleBtnLabel}>DINNER</Text>
						<Text style={styles.toggleBtnDish} numberOfLines={1}>{menu.dinner.main || 'Rice/Roti'}</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#fff' },
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	tabBar: { flexDirection: 'row', backgroundColor: '#f8f9fa', padding: 4, borderRadius: 12, margin: 20, marginBottom: 0 },
	tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
	tabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
	tabText: { fontSize: 13, fontWeight: '800', color: '#999' },
	tabTextActive: { color: '#1a1a1a' },

	scrollContent: { padding: 20, paddingBottom: 40 },
	dateLabel: { fontSize: 18, color: '#666', fontWeight: 'bold', marginBottom: 16 },
	sectionHeader: { fontSize: 14, fontWeight: '800', color: '#666', marginBottom: 16, letterSpacing: 0.5 },

	mealCard: { backgroundColor: '#1a1a1a', borderRadius: 18, padding: 20, marginBottom: 12 },
	mealCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
	mealCardTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
	plateBadge: { alignItems: 'center', backgroundColor: '#2e7d32', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
	plateCount: { fontSize: 24, fontWeight: '900', color: '#fff' },
	plateSub: { fontSize: 8, color: '#a5d6a7', fontWeight: '800' },
	mainSalanLabel: { fontSize: 9, fontWeight: '800', color: '#666', letterSpacing: 1 },
	mainSalanValue: { fontSize: 24, fontWeight: '900', color: '#fff', marginVertical: 4 },
	servingRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
	servingText: { fontSize: 13, color: '#888', fontWeight: '600' },

	totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f9f0', borderRadius: 14, padding: 18, borderWidth: 2, borderColor: '#2e7d32', marginVertical: 10 },
	totalLabel: { fontSize: 16, fontWeight: '700', color: '#2e7d32' },
	totalCount: { fontSize: 36, fontWeight: '900', color: '#2e7d32' },

	statsRow: { flexDirection: 'row', gap: 15, marginTop: 10 },
	statCard: { flex: 1, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 16, borderWidth: 1, alignItems: 'center' },
	statValue: { fontSize: 32, fontWeight: '900', color: '#1a1a1a' },
	statLabel: { fontSize: 12, color: '#666', fontWeight: '600', marginTop: 2, textAlign: 'center' },

	customerRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 15 },
	customerInfo: { marginBottom: 10 },
	customerName: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
	toggleGroup: { flexDirection: 'row', gap: 10 },
	toggleBtn: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
	toggleBtnOn: { backgroundColor: '#e8f5e9', borderColor: '#2e7d32' },
	toggleBtnLabel: { fontSize: 10, fontWeight: '800', color: '#666' },
	toggleBtnDish: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginTop: 2 },
	emptyText: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 16 },
});
