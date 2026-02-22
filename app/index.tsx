import { MaterialCommunityIcons } from '@expo/vector-icons';
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
		let unsubMenu = () => { };
		if (SETTINGS.USE_MOCKS) {
			// In mock mode, we could use a global mockDb menu but for now let's just use what's in SETTINGS or similar
			// To keep it simple and reactive, index.tsx should ideally use the same mock source as Menu screen
			// We'll add getMenu to mockDb
			const loadMockMenu = () => {
				const data = mockDb.getMenu(todayDate);
				setTodayMenu({
					lunch: normalizeMeal(data.lunch),
					dinner: normalizeMeal(data.dinner),
				});
			};
			loadMockMenu();
			unsubMenu = mockDb.subscribe(loadMockMenu);
		} else {
			unsubMenu = onSnapshot(doc(db, "menu", todayDate), (snap) => {
				const data = snap.exists() ? snap.data() : {};
				setTodayMenu({
					lunch: normalizeMeal(data.lunch),
					dinner: normalizeMeal(data.dinner),
				});
			});
		}

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

	// Calculate Derived Production Counts (Hardened Logic)
	useEffect(() => {
		let lCount = 0, dCount = 0;
		customers.forEach(c => {
			const selection = attendance[c.id];
			const subscribedLunch = c.mealsPerDay?.lunch !== false;
			const subscribedDinner = c.mealsPerDay?.dinner !== false;

			// Logic Integrity: Only count if SUBSCRIBED AND (Selected YES or NO Record)
			if (subscribedLunch) {
				if (!selection || selection.lunch !== false) lCount++;
			}

			if (subscribedDinner) {
				if (!selection || selection.dinner !== false) dCount++;
			}
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
			<View style={styles.bgDecoration} />
			{/* Segmented Control */}
			<View style={styles.tabBar}>
				<TouchableOpacity
					style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
					onPress={() => setActiveTab('dashboard')}
				>
					<View style={styles.tabItem}>
						<MaterialCommunityIcons
							name="view-dashboard"
							size={16}
							color={activeTab === 'dashboard' ? '#1a1a1a' : '#999'}
						/>
						<Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>DASHBOARD</Text>
					</View>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.tab, activeTab === 'attendance' && styles.tabActive]}
					onPress={() => setActiveTab('attendance')}
				>
					<View style={styles.tabItem}>
						<MaterialCommunityIcons
							name="clipboard-text"
							size={16}
							color={activeTab === 'attendance' ? '#1a1a1a' : '#999'}
						/>
						<Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>ATTENDANCE</Text>
					</View>
				</TouchableOpacity>
			</View>

			<ScrollView contentContainerStyle={styles.scrollContent}>
				{activeTab === 'dashboard' ? (
					<>
						<Text style={styles.dateLabel}>
							{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
						</Text>

						<View style={styles.row}>
							<MaterialCommunityIcons name="silverware-fork-knife" size={18} color="#666" />
							<Text style={styles.sectionHeader}>Today's Production — آج کتنا پکانا ہے</Text>
						</View>

						<MealCard label="Lunch" count={stats.lunchCount} slot={todayMenu.lunch} icon="weather-sunny" iconColor="#FFD700" />
						<MealCard label="Dinner" count={stats.dinnerCount} slot={todayMenu.dinner} icon="weather-night" iconColor="#5C6BC0" />

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
						<View style={styles.row}>
							<MaterialCommunityIcons name="clipboard-text" size={18} color="#666" />
							<Text style={styles.sectionHeader}>Who is eating today? — آج کون کھائے گا؟</Text>
						</View>
						{customers.map(c => (
							<CustomerAttendanceRow
								key={c.id}
								customer={c}
								menu={todayMenu}
								attendance={attendance[c.id]}
								onToggle={(meal: 'lunch' | 'dinner') => toggleTodayAttendance(c.id, meal)}
								date={todayDate}
							/>
						))}
						{customers.length === 0 && <Text style={styles.emptyText}>No active customers found.</Text>}
					</>
				)}
			</ScrollView>
		</View>
	);
}

const MealCard = ({ label, count, slot, icon, iconColor }: { label: string; count: number; slot: MealSlot; icon: any; iconColor: string }) => {
	const riceType = slot.rice.enabled ? (slot.rice.type || "Plain Rice") : "No Rice";
	return (
		<View style={styles.mealCard}>
			<View style={styles.mealCardHeader}>
				<View style={styles.row}>
					<MaterialCommunityIcons name={icon} size={20} color={iconColor} />
					<Text style={styles.mealCardTitle}>{label}</Text>
				</View>
				<View style={styles.plateBadge}>
					<Text style={styles.plateCount}>{count}</Text>
					<Text style={styles.plateSub}>plates</Text>
				</View>
			</View>
			<View style={styles.row}>
				<MaterialCommunityIcons name="pot-steam" size={14} color="#666" />
				<Text style={styles.mainSalanLabel}>MAIN SALAN</Text>
			</View>
			{slot.main ? (
				<Text style={styles.mainSalanValue}>{slot.main}</Text>
			) : (
				<View style={styles.row}>
					<MaterialCommunityIcons name="alert-circle-outline" size={20} color="#ff5252" />
					<Text style={styles.notSetWarning}>Not Set</Text>
				</View>
			)}
			<View style={styles.servingRow}>
				<View style={styles.servingItem}>
					<MaterialCommunityIcons name="bread-slice-outline" size={14} color="#888" />
					<Text style={styles.servingText}>{slot.roti ? "Roti" : "No Roti"}</Text>
				</View>
				<View style={styles.servingItem}>
					<MaterialCommunityIcons name="rice" size={14} color="#888" />
					<Text style={styles.servingText}>{riceType}</Text>
				</View>
			</View>
		</View>
	);
};

const CustomerAttendanceRow = ({ customer, menu, attendance, onToggle, date }: any) => {
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
						<View style={styles.rowBetween}>
							<Text style={styles.toggleBtnLabel}>LUNCH</Text>
						</View>
						<Text style={styles.toggleBtnDish} numberOfLines={1}>{menu.lunch.main || 'Rice/Roti'}</Text>
					</TouchableOpacity>
				)}
				{subDinner && (
					<TouchableOpacity
						style={[styles.toggleBtn, sel.dinner && styles.toggleBtnOn]}
						onPress={() => onToggle('dinner')}
					>
						<View style={styles.rowBetween}>
							<Text style={styles.toggleBtnLabel}>DINNER</Text>
						</View>
						<Text style={styles.toggleBtnDish} numberOfLines={1}>{menu.dinner.main || 'Rice/Roti'}</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#f4f7f6' },
	bgDecoration: {
		position: 'absolute', top: 0, left: 0, right: 0, height: 400,
		backgroundColor: 'rgba(0,0,0,0.03)', borderBottomLeftRadius: 80, borderBottomRightRadius: 80,
		zIndex: -1
	},
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	tabBar: { flexDirection: 'row', backgroundColor: '#fff', padding: 4, borderRadius: 12, margin: 20, marginBottom: 0, elevation: 2 },
	tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
	tabItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	tabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
	tabText: { fontSize: 13, fontWeight: '800', color: '#999' },
	tabTextActive: { color: '#1a1a1a' },

	scrollContent: { padding: 20, paddingBottom: 150 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
	dateLabel: { fontSize: 18, color: '#666', fontWeight: 'bold', marginBottom: 16 },
	sectionHeader: { fontSize: 14, fontWeight: '800', color: '#666', letterSpacing: 0.5 },

	mealCard: { backgroundColor: '#1a1a1a', borderRadius: 18, padding: 20, marginBottom: 12 },
	mealCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
	mealCardTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
	plateBadge: { alignItems: 'center', backgroundColor: '#2e7d32', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
	plateCount: { fontSize: 24, fontWeight: '900', color: '#fff' },
	plateSub: { fontSize: 8, color: '#a5d6a7', fontWeight: '800' },
	mainSalanLabel: { fontSize: 9, fontWeight: '800', color: '#666', letterSpacing: 1 },
	mainSalanValue: { fontSize: 24, fontWeight: '900', color: '#fff', marginVertical: 4 },
	notSetWarning: { fontSize: 20, fontWeight: '900', color: '#ff5252', marginVertical: 4, fontStyle: 'italic' },
	servingRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
	servingItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
	toggleBtn: { flex: 1, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 14, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eee' },
	toggleBtnOn: { backgroundColor: '#e8f5e9', borderColor: '#2e7d32', elevation: 2 },
	lockedBadge: { fontSize: 10, fontWeight: '800', color: '#666', marginTop: 2 },
	toggleBtnLabel: { fontSize: 10, fontWeight: '800', color: '#666' },
	toggleBtnDish: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginTop: 2 },
	emptyText: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 16 },
});
