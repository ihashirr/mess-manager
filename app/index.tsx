import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SETTINGS } from '../constants/Settings';
import { db } from '../firebase/config';
import mockMenu from '../mocks/menu.json';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { mockDb } from '../utils/mockDb';
import { DayName, getTodayName, getWeekId } from '../utils/weekLogic';

type RiceSlot = { enabled: boolean; type: string };
type MealSlot = { main: string; rice: RiceSlot; roti: boolean; extra: string };
type DayMenu = { lunch: MealSlot; dinner: MealSlot };
type MenuState = Partial<Record<DayName, DayMenu>>;

const EMPTY_MEAL: MealSlot = { main: "", rice: { enabled: false, type: "" }, roti: true, extra: "" };

const normalizeMeal = (raw: any): MealSlot => ({
	main: typeof raw?.main === 'string' ? raw.main : "",
	rice: (raw?.rice && typeof raw.rice === 'object' && 'enabled' in raw.rice)
		? raw.rice
		: { enabled: false, type: typeof raw?.rice === 'string' ? raw.rice : "" },
	roti: typeof raw?.roti === 'boolean' ? raw.roti : true,
	extra: typeof raw?.extra === 'string' ? raw.extra : (raw?.side || ""),
});

export default function Index() {
	const weekId = getWeekId();
	const todayName = getTodayName();

	const [stats, setStats] = useState({ activeCount: 0, paymentsDue: 0, lunchCount: 0, dinnerCount: 0 });
	const [todayMenu, setTodayMenu] = useState<DayMenu>({ lunch: { ...EMPTY_MEAL }, dinner: { ...EMPTY_MEAL } });
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (SETTINGS.USE_MOCKS) {
			const customers = mockDb.getCustomers() as any[];
			let active = 0, due = 0, lunch = 0, dinner = 0;
			customers.forEach(c => {
				if (getDaysLeft(toDate(c.endDate)) >= 0) {
					active++;
					if (getDueAmount(c.pricePerMonth, c.totalPaid) > 0) due++;
					// Mock: use mealsPerDay flags as proxy for attendance
					if (c.mealsPerDay?.lunch || c.plan === 'lunch' || c.plan === 'both') lunch++;
					if (c.mealsPerDay?.dinner || c.plan === 'dinner' || c.plan === 'both') dinner++;
				}
			});
			setStats({ activeCount: active, paymentsDue: due, lunchCount: lunch, dinnerCount: dinner });
			setTodayMenu({
				lunch: normalizeMeal((mockMenu as any).lunch),
				dinner: normalizeMeal((mockMenu as any).dinner),
			});
			const unsub = mockDb.subscribe(() => {
				const cs = mockDb.getCustomers() as any[];
				let a = 0, d = 0, l = 0, din = 0;
				cs.forEach(c => {
					if (getDaysLeft(toDate(c.endDate)) >= 0) {
						a++;
						if (getDueAmount(c.pricePerMonth, c.totalPaid) > 0) d++;
						if (c.mealsPerDay?.lunch || c.plan === 'lunch' || c.plan === 'both') l++;
						if (c.mealsPerDay?.dinner || c.plan === 'dinner' || c.plan === 'both') din++;
					}
				});
				setStats({ activeCount: a, paymentsDue: d, lunchCount: l, dinnerCount: din });
			});
			setLoading(false);
			return unsub;
		}

		// ── Live mode ──────────────────────────────
		let customerIds: string[] = [];
		let unsubMenu = () => { };
		let unsubSelections = () => { };

		// 1. Customer list for admin stats
		const unsubCustomers = onSnapshot(query(collection(db, "customers")), (snap) => {
			let active = 0, due = 0;
			customerIds = [];
			snap.forEach(d => {
				const data = d.data();
				if (getDaysLeft(toDate(data.endDate)) >= 0) {
					active++;
					customerIds.push(d.id);
					if (getDueAmount(data.pricePerMonth, data.totalPaid) > 0) due++;
				}
			});
			setStats(prev => ({ ...prev, activeCount: active, paymentsDue: due }));
			setLoading(false);

			// 2. Attendance for today: count all customerSelections for this week
			if (unsubSelections) unsubSelections();
			unsubSelections = onSnapshot(
				query(collection(db, "customerSelections")),
				(selSnap) => {
					let lunch = 0, dinner = 0;
					selSnap.forEach(selDoc => {
						const sel = selDoc.data();
						if (sel.weekId !== weekId) return;
						// Customer must still be active
						if (!customerIds.includes(sel.customerId)) return;
						const today = sel.days?.[todayName];
						// Opt-out model: if no day record, count as attending
						if (!today || today.lunch !== false) lunch++;
						if (!today || today.dinner !== false) dinner++;
					});
					setStats(prev => ({ ...prev, lunchCount: lunch, dinnerCount: dinner }));
				}
			);
		});

		// 3. Weekly menu → today's slot
		unsubMenu = onSnapshot(doc(db, "weeklyMenu", weekId), (docSnap) => {
			if (docSnap.exists()) {
				const raw = docSnap.data()?.[todayName];
				if (raw) {
					setTodayMenu({
						lunch: normalizeMeal(raw.lunch),
						dinner: normalizeMeal(raw.dinner),
					});
					return;
				}
			}
			// Fallback: old daily menu doc
			onSnapshot(doc(db, "menu", new Date().toISOString().split('T')[0]), (daySnap) => {
				if (daySnap.exists()) {
					const data = daySnap.data();
					setTodayMenu({
						lunch: normalizeMeal(data.lunch),
						dinner: normalizeMeal(data.dinner),
					});
				}
			});
		});

		return () => { unsubCustomers(); unsubMenu(); unsubSelections(); };
	}, [weekId, todayName]);

	if (loading) return <View style={styles.container}><Text>Loading...</Text></View>;

	const riceLabel = (slot: MealSlot) => {
		const rice = slot?.rice;
		if (!rice || !rice.enabled) return { label: "No Rice", color: "#555" };
		return { label: rice.type || "Rice", color: "#fff" };
	};

	const MealCard = ({ label, count, slot }: { label: string; count: number; slot: MealSlot }) => {
		const rice = riceLabel(slot);
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
				<Text style={styles.mainSalanValue}>{slot.main || 'Not set — go to Menu tab'}</Text>

				<View style={styles.servingRow}>
					<View style={styles.servingChip}>
						<Text style={styles.servingIcon}>🫓</Text>
						<Text style={[styles.servingText, !slot.roti && { color: '#555' }]}>
							{slot.roti ? "Roti" : "No Roti"}
						</Text>
					</View>
					<View style={styles.servingChip}>
						<Text style={styles.servingIcon}>🍚</Text>
						<Text style={[styles.servingText, { color: rice.color }]}>
							{rice.label}
						</Text>
					</View>
				</View>

				{slot.extra ? <Text style={styles.extraText}>🥗 {slot.extra}</Text> : null}
			</View>
		);
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#fff' },
	content: { padding: 20, paddingBottom: 40 },
	dateLabel: { fontSize: 18, color: '#666', fontWeight: 'bold', marginBottom: 16, marginTop: 10 },
	sectionHeader: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },

	mealCard: { backgroundColor: '#1a1a1a', borderRadius: 18, padding: 22, marginBottom: 12 },
	mealCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
	mealCardTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
	plateBadge: { alignItems: 'center', backgroundColor: '#2e7d32', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
	plateCount: { fontSize: 28, fontWeight: '900', color: '#fff', lineHeight: 30 },
	plateSub: { fontSize: 10, color: '#81c784', fontWeight: '700', letterSpacing: 0.5 },

	mainSalanLabel: { fontSize: 10, fontWeight: '800', color: '#666', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
	mainSalanValue: { fontSize: 30, fontWeight: '900', color: '#fff', lineHeight: 36, marginBottom: 18 },

	servingRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
	servingChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2a2a2a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
	servingIcon: { fontSize: 16 },
	servingText: { fontSize: 15, fontWeight: '700', color: '#fff' },
	extraText: { fontSize: 14, color: '#888', marginTop: 2 },

	totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f9f0', borderRadius: 14, padding: 18, borderWidth: 2, borderColor: '#2e7d32', marginBottom: 16 },
	totalLabel: { fontSize: 16, fontWeight: '700', color: '#2e7d32' },
	totalCount: { fontSize: 42, fontWeight: '900', color: '#2e7d32' },

	statsRow: { flexDirection: 'row', gap: 15 },
	statCard: { flex: 1, padding: 20, backgroundColor: '#f8f9fa', borderRadius: 16, borderWidth: 2, alignItems: 'center' },
	statValue: { fontSize: 52, fontWeight: '900', color: '#1a1a1a' },
	statLabel: { fontSize: 15, color: '#495057', fontWeight: '600', marginTop: 5, textAlign: 'center' },
});
