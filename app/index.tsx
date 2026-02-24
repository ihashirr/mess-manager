import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Section } from '../components/ui/Section';
import { SETTINGS } from '../constants/Settings';
import { Theme } from '../constants/Theme';
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
		<Screen withLargeHeader backgroundColor={Theme.colors.bg}>
			<ScreenHeader
				title="Home"
				subtitle={todayName.toUpperCase() + ", " + todayDate}
				rightAction={
					<TouchableOpacity onPress={() => {/* Logic for settings */ }}>
						<MaterialCommunityIcons name="cog-outline" size={24} color={Theme.colors.textMuted} />
					</TouchableOpacity>
				}
			/>

			{/* Tab Navigation */}
			<View style={styles.tabBar}>
				<TouchableOpacity
					style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
					onPress={() => setActiveTab('dashboard')}
				>
					<View style={styles.tabItem}>
						<MaterialCommunityIcons
							name="view-dashboard"
							size={20}
							color={activeTab === 'dashboard' ? Theme.colors.primary : Theme.colors.textMuted}
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
							name="playlist-check"
							size={20}
							color={activeTab === 'attendance' ? Theme.colors.primary : Theme.colors.textMuted}
						/>
						<Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>ATTENDANCE</Text>
					</View>
				</TouchableOpacity>
			</View>

			{activeTab === 'dashboard' ? (
				<View style={styles.scrollContent}>
					<Section title="Today's Menu">
						<View style={{ flexDirection: 'row', gap: Theme.spacing.md }}>
							<View style={{ flex: 1 }}>
								<MealCard
									label="LUNCH"
									count={stats.lunchCount}
									slot={todayMenu.lunch}
									icon="weather-sunny"
									iconColor={Theme.colors.warning}
								/>
							</View>
							<View style={{ flex: 1 }}>
								<MealCard
									label="DINNER"
									count={stats.dinnerCount}
									slot={todayMenu.dinner}
									icon="weather-night"
									iconColor={Theme.colors.primary}
								/>
							</View>
						</View>
					</Section>

					<Section title="Overview">
						<View style={styles.statsRow}>
							<Card style={styles.statCard}>
								<Text style={styles.statValue}>{stats.activeCount}</Text>
								<Text style={styles.statLabel}>ACTIVE{"\n"}CUSTOMERS</Text>
							</Card>
							<Card style={styles.statCard}>
								<Text style={styles.statValue}>{stats.paymentsDue}</Text>
								<Text style={styles.statLabel}>PAYMENTS{"\n"}DUE</Text>
							</Card>
						</View>
					</Section>

					<Card style={styles.totalRow}>
						<Text style={styles.totalLabel}>TOTAL PLATES TODAY</Text>
						<Text style={styles.totalCount}>{stats.lunchCount + stats.dinnerCount}</Text>
					</Card>
				</View>
			) : (
				<View style={styles.scrollContent}>
					<Section title="Customer Attendance" subtitle="Tap to toggle today's meals">
						{customers.length === 0 ? (
							<Text style={styles.emptyText}>No active customers found</Text>
						) : (
							customers.map(c => (
								<CustomerAttendanceRow
									key={c.id}
									customer={c}
									menu={todayMenu}
									attendance={attendance[c.id]}
									date={todayDate}
									onToggle={(meal: 'lunch' | 'dinner') => toggleTodayAttendance(c.id, meal)}
								/>
							))
						)}
					</Section>
				</View>
			)}
		</Screen>
	);
}

const MealCard = ({ label, count, slot, icon, iconColor }: { label: string; count: number; slot: MealSlot; icon: any; iconColor: string }) => {
	const riceType = slot.rice.enabled ? (slot.rice.type || "Plain Rice") : "No Rice";
	return (
		<Card variant="elevated" style={styles.mealCard}>
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
				<MaterialCommunityIcons name="pot-steam" size={14} color={Theme.colors.textMuted} />
				<Text style={styles.mainSalanLabel}>MAIN SALAN</Text>
			</View>
			{slot.main ? (
				<Text style={styles.mainSalanValue}>{slot.main}</Text>
			) : (
				<View style={styles.row}>
					<MaterialCommunityIcons name="alert-circle-outline" size={20} color={Theme.colors.danger} />
					<Text style={styles.notSetWarning}>Not Set</Text>
				</View>
			)}
			<View style={styles.servingRow}>
				<View style={styles.servingItem}>
					<MaterialCommunityIcons name="bread-slice-outline" size={14} color={Theme.colors.textMuted} />
					<Text style={styles.servingText}>{slot.roti ? "Roti" : "No Roti"}</Text>
				</View>
				<View style={styles.servingItem}>
					<MaterialCommunityIcons name="rice" size={14} color={Theme.colors.textMuted} />
					<Text style={styles.servingText}>{riceType}</Text>
				</View>
			</View>
		</Card>
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
	container: { flex: 1, backgroundColor: Theme.colors.bg },
	bgDecoration: {
		position: 'absolute', top: 0, left: 0, right: 0, height: 400,
		backgroundColor: Theme.colors.decoration, borderBottomLeftRadius: 80, borderBottomRightRadius: 80,
		zIndex: -1
	},
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	tabBar: {
		flexDirection: 'row',
		backgroundColor: Theme.colors.surface,
		padding: Theme.spacing.xs,
		borderRadius: Theme.radius.lg,
		margin: Theme.spacing.screen,
		marginBottom: 0,
		borderWidth: 1,
		borderColor: Theme.colors.border,
	},
	tab: { flex: 1, paddingVertical: Theme.spacing.md, alignItems: 'center', borderRadius: Theme.radius.sm },
	tabItem: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	tabActive: {
		backgroundColor: Theme.colors.surface,
		borderColor: Theme.colors.primary,
	},
	tabText: { ...Theme.typography.detailBold, color: Theme.colors.textMuted },
	tabTextActive: { color: Theme.colors.textPrimary },

	scrollContent: { padding: Theme.spacing.screen, paddingBottom: 150 },
	row: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
	dateLabel: { ...Theme.typography.labelMedium, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.lg },
	sectionHeader: { ...Theme.typography.label, color: Theme.colors.textSecondary },

	mealCard: {
		backgroundColor: Theme.colors.surfaceElevated, // Nested container for high contrast inside surface
		marginBottom: Theme.spacing.md
	},
	mealCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.md },
	mealCardTitle: { ...Theme.typography.labelMedium, color: Theme.colors.textInverted },
	plateBadge: {
		alignItems: 'center',
		backgroundColor: Theme.colors.primary,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.xs,
		borderRadius: Theme.radius.md
	},
	plateCount: { ...Theme.typography.answerGiant, fontSize: 24, color: Theme.colors.textInverted },
	plateSub: { fontSize: 8, color: '#a5d6a7', fontWeight: '800' },
	mainSalanLabel: { ...Theme.typography.detailBold, color: Theme.colors.textSecondary },
	mainSalanValue: { ...Theme.typography.answerGiant, fontSize: 24, color: Theme.colors.textInverted, marginVertical: Theme.spacing.xs },
	notSetWarning: { ...Theme.typography.labelMedium, color: Theme.colors.danger, marginVertical: Theme.spacing.xs, fontStyle: 'italic' },
	servingRow: { flexDirection: 'row', gap: Theme.spacing.md, marginTop: Theme.spacing.xs },
	servingItem: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.xs },
	servingText: { ...Theme.typography.detailBold, color: Theme.colors.textMuted },

	totalRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: '#f0f9f0',
		borderRadius: Theme.radius.xl,
		padding: Theme.spacing.xl,
		borderWidth: 2,
		borderColor: Theme.colors.primary,
		marginVertical: Theme.spacing.sm
	},
	totalLabel: { ...Theme.typography.labelMedium, color: Theme.colors.primary },
	totalCount: { ...Theme.typography.answerGiant, color: Theme.colors.primary },

	statsRow: { flexDirection: 'row', gap: Theme.spacing.lg, marginTop: Theme.spacing.md },
	statCard: {
		flex: 1,
		padding: Theme.spacing.lg,
		alignItems: 'center'
	},
	statValue: { ...Theme.typography.answerGiant, fontSize: 32, color: Theme.colors.textPrimary },
	statLabel: { ...Theme.typography.detailBold, fontSize: 12, color: Theme.colors.textSecondary, marginTop: Theme.spacing.xs, textAlign: 'center' },

	customerRow: { backgroundColor: Theme.colors.surface, borderBottomWidth: 1, borderBottomColor: Theme.colors.border, paddingVertical: Theme.spacing.xl },
	customerInfo: { marginBottom: Theme.spacing.md },
	customerName: { ...Theme.typography.labelMedium, color: Theme.colors.textPrimary },
	toggleGroup: { flexDirection: 'row', gap: Theme.spacing.md },
	toggleBtn: {
		flex: 1,
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.md,
		borderRadius: Theme.radius.xl,
		backgroundColor: Theme.colors.bg,
		borderWidth: 1,
		borderColor: Theme.colors.border
	},
	toggleBtnOn: {
		backgroundColor: '#e8f5e9',
		borderColor: Theme.colors.primary,
	},
	lockedBadge: { ...Theme.typography.detailBold, color: Theme.colors.textSecondary, marginTop: Theme.spacing.xs },
	toggleBtnLabel: { ...Theme.typography.detailBold, color: Theme.colors.textSecondary },
	toggleBtnDish: { ...Theme.typography.labelMedium, fontSize: 14, color: Theme.colors.textPrimary, marginTop: Theme.spacing.xs },
	emptyText: { textAlign: 'center', color: Theme.colors.textMuted, marginTop: Theme.spacing.massive, fontSize: 16 },
});
