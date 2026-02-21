import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SETTINGS } from '../constants/Settings';
import { db } from '../firebase/config';
import mockMenu from '../mocks/menu.json';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { mockDb } from '../utils/mockDb';

type MealSlot = { rice: string; roti: string; side: string };
type MenuState = { lunch: MealSlot; dinner: MealSlot };

export default function Index() {
	const [stats, setStats] = useState({
		activeCount: 0,
		paymentsDue: 0,
		lunchCount: 0,
		dinnerCount: 0
	});
	const [menu, setMenu] = useState<MenuState>({
		lunch: { rice: "", roti: "", side: "" },
		dinner: { rice: "", roti: "", side: "" },
	});
	const [loading, setLoading] = useState(true);

	const today = new Date().toISOString().split('T')[0];

	useEffect(() => {
		const calculateStats = (customerData: any[]) => {
			let active = 0, dueCount = 0, lunch = 0, dinner = 0;
			customerData.forEach((data) => {
				const daysLeft = getDaysLeft(toDate(data.endDate));
				const due = getDueAmount(data.pricePerMonth, data.totalPaid);
				if (daysLeft >= 0) {
					active++;
					const isLunch = data.mealsPerDay?.lunch || data.plan === "lunch" || data.plan === "both";
					const isDinner = data.mealsPerDay?.dinner || data.plan === "dinner" || data.plan === "both";
					if (isLunch) lunch++;
					if (isDinner) dinner++;
					if (due > 0) dueCount++;
				}
			});
			setStats({ activeCount: active, paymentsDue: dueCount, lunchCount: lunch, dinnerCount: dinner });
			setLoading(false);
		};

		if (SETTINGS.USE_MOCKS) {
			calculateStats(mockDb.getCustomers());
			setMenu({
				lunch: mockMenu.lunch as MealSlot,
				dinner: mockMenu.dinner as MealSlot,
			});
			const unsub = mockDb.subscribe(() => calculateStats(mockDb.getCustomers()));
			return unsub;
		}

		const q = query(collection(db, "customers"));
		let unsubscribeMenu = () => { };

		const unsubscribeCustomers = onSnapshot(q, (querySnapshot) => {
			let active = 0, dueCount = 0, lunch = 0, dinner = 0;
			querySnapshot.forEach((doc) => {
				const data = doc.data();
				const daysLeft = getDaysLeft(toDate(data.endDate));
				const due = getDueAmount(data.pricePerMonth, data.totalPaid);
				if (daysLeft >= 0) {
					active++;
					const isLunch = data.mealsPerDay?.lunch || data.plan === "lunch" || data.plan === "both";
					const isDinner = data.mealsPerDay?.dinner || data.plan === "dinner" || data.plan === "both";
					if (isLunch) lunch++;
					if (isDinner) dinner++;
					if (due > 0) dueCount++;
				}
			});
			setStats({ activeCount: active, paymentsDue: dueCount, lunchCount: lunch, dinnerCount: dinner });
			setLoading(false);
		});

		unsubscribeMenu = onSnapshot(doc(db, "menu", today), (docSnap) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				setMenu({
					lunch: data.lunch || { rice: "", roti: "", side: "" },
					dinner: data.dinner || { rice: "", roti: "", side: "" },
				});
			}
		});

		return () => { unsubscribeCustomers(); unsubscribeMenu(); };
	}, [today]);

	if (loading) return <View style={styles.container}><Text>Loading...</Text></View>;

	const MealCard = ({ label, count, slot }: { label: string; count: number; slot: MealSlot }) => (
		<View style={styles.mealCard}>
			<View style={styles.mealCardHeader}>
				<Text style={styles.mealCardTitle}>{label}</Text>
				<View style={styles.mealCountBadge}>
					<Text style={styles.mealCountText}>{count}</Text>
					<Text style={styles.mealCountSub}>plates</Text>
				</View>
			</View>
			{[
				{ icon: '🍚', label: 'Rice', value: slot.rice },
				{ icon: '🫓', label: 'Roti', value: slot.roti },
				{ icon: '🥗', label: 'Side', value: slot.side },
			].map(({ icon, label: fieldLabel, value }) => (
				<View key={fieldLabel} style={styles.mealItem}>
					<Text style={styles.mealItemIcon}>{icon}</Text>
					<Text style={styles.mealItemLabel}>{fieldLabel}</Text>
					<Text style={styles.mealItemValue}>{value || '—'}</Text>
				</View>
			))}
		</View>
	);

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Text style={styles.dateLabel}>
				{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
			</Text>

			{/* ── PRODUCTION ENGINE ─────────────────── */}
			<View style={styles.productionSection}>
				<Text style={styles.productionHeader}>🍽️ Today's Production — آج کتنا پکانا ہے</Text>
				<MealCard label="☀️ Lunch" count={stats.lunchCount} slot={menu.lunch} />
				<MealCard label="🌙 Dinner" count={stats.dinnerCount} slot={menu.dinner} />

				<View style={styles.totalRow}>
					<Text style={styles.totalLabel}>Total Meals Today</Text>
					<Text style={styles.totalCount}>{stats.lunchCount + stats.dinnerCount}</Text>
				</View>
			</View>

			{/* ── ADMIN STATS ───────────────────────── */}
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
	dateLabel: {
		fontSize: 18,
		color: '#666',
		fontWeight: 'bold',
		marginBottom: 20,
		marginTop: 10,
	},

	// Production Section
	productionSection: { marginBottom: 20 },
	productionHeader: {
		fontSize: 16,
		fontWeight: '800',
		color: '#1a1a1a',
		marginBottom: 12,
	},
	mealCard: {
		backgroundColor: '#1a1a1a',
		borderRadius: 18,
		padding: 20,
		marginBottom: 12,
	},
	mealCardHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	mealCardTitle: {
		fontSize: 18,
		fontWeight: '900',
		color: '#fff',
	},
	mealCountBadge: {
		alignItems: 'center',
		backgroundColor: '#2e7d32',
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 12,
	},
	mealCountText: {
		fontSize: 28,
		fontWeight: '900',
		color: '#fff',
		lineHeight: 30,
	},
	mealCountSub: {
		fontSize: 10,
		color: '#81c784',
		fontWeight: '700',
		letterSpacing: 0.5,
	},
	mealItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
		borderTopWidth: 1,
		borderTopColor: '#2a2a2a',
	},
	mealItemIcon: { fontSize: 20, marginRight: 10, width: 30 },
	mealItemLabel: {
		fontSize: 12,
		fontWeight: '800',
		color: '#666',
		width: 44,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	mealItemValue: {
		flex: 1,
		fontSize: 18,
		fontWeight: '700',
		color: '#fff',
		textAlign: 'right',
	},
	totalRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: '#f0f9f0',
		borderRadius: 14,
		padding: 18,
		borderWidth: 2,
		borderColor: '#2e7d32',
	},
	totalLabel: {
		fontSize: 16,
		fontWeight: '700',
		color: '#2e7d32',
	},
	totalCount: {
		fontSize: 42,
		fontWeight: '900',
		color: '#2e7d32',
	},

	// Admin Stats
	statsRow: { flexDirection: 'row', gap: 15, marginTop: 8 },
	statCard: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f8f9fa',
		borderRadius: 16,
		borderWidth: 2,
		alignItems: 'center',
	},
	statValue: {
		fontSize: 52,
		fontWeight: '900',
		color: '#1a1a1a',
	},
	statLabel: {
		fontSize: 15,
		color: '#495057',
		fontWeight: '600',
		marginTop: 5,
		textAlign: 'center',
	}
});
