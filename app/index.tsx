import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInLeft, FadeInUp } from 'react-native-reanimated';
import { AppModal } from '../components/ui/AppModal';
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
	const [activeModal, setActiveModal] = useState<'lunch' | 'dinner' | 'total' | null>(null);

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

	if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Theme.colors.primary} /></View>;

	// Derived customer lists for modals
	const lunchCustomers = customers.filter(c => {
		if (c.mealsPerDay?.lunch === false) return false;
		const sel = attendance[c.id];
		return !sel || sel.lunch !== false;
	});
	const dinnerCustomers = customers.filter(c => {
		if (c.mealsPerDay?.dinner === false) return false;
		const sel = attendance[c.id];
		return !sel || sel.dinner !== false;
	});
	// Derived Modal Data
	const modalCustomers = activeModal === 'lunch'
		? lunchCustomers
		: activeModal === 'dinner'
			? dinnerCustomers
			: activeModal === 'total'
				? Array.from(new Set([...lunchCustomers, ...dinnerCustomers])).sort((a, b) => a.name.localeCompare(b.name))
				: [];

	const modalMealLabel = activeModal === 'lunch' ? 'LUNCH' : activeModal === 'dinner' ? 'DINNER' : 'DAILY TOTAL';
	const modalDish = activeModal === 'lunch'
		? todayMenu.lunch.main
		: activeModal === 'dinner'
			? todayMenu.dinner.main
			: `${todayMenu.lunch.main || '...'} + ${todayMenu.dinner.main || '...'}`;

	return (
		<>
			<Screen backgroundColor={Theme.colors.bg}>
				<ScreenHeader
					compact
					gutter={Theme.spacing.screen}
					title={`${todayName.charAt(0).toUpperCase() + todayName.slice(1)}, ${todayDate}`}
					subtitle="SERVINGS DASHBOARD • HOME"
					rightAction={
						<TouchableOpacity
							onPress={() => { /* Logic for settings */ }}
							style={{ height: 40, width: 40, justifyContent: 'center', alignItems: 'center' }}
						>
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
					<Animated.View
						key="dashboard"
						entering={FadeInUp.duration(220)}
						style={styles.scrollContent}
					>
						<View style={styles.productionPanel}>
							<Text style={styles.productionTitle}>TODAY'S PRODUCTION</Text>

							<View style={styles.servingsGrid}>
								{/* Lunch Panel */}
								<Animated.View
									entering={FadeInLeft.delay(80).springify().damping(20)}
									style={styles.servingCard}
								>
									<TouchableOpacity
										style={styles.servingAction}
										onPress={() => setActiveModal('lunch')}
										activeOpacity={0.7}
									>
										<View style={styles.servingInfo}>
											<Text style={styles.servingLabel}>LUNCH</Text>
											<Text style={styles.servingDish} numberOfLines={1}>
												{todayMenu.lunch.main || 'NOT SET'}
											</Text>
										</View>
										<View style={styles.servingCountPill}>
											<Text style={styles.servingCountValue}>{stats.lunchCount}</Text>
											<MaterialCommunityIcons name="chevron-right" size={16} color={Theme.colors.textMuted} />
										</View>
									</TouchableOpacity>
								</Animated.View>

								{/* Dinner Panel */}
								<Animated.View
									entering={FadeInLeft.delay(180).springify().damping(20)}
									style={styles.servingCard}
								>
									<TouchableOpacity
										style={styles.servingAction}
										onPress={() => setActiveModal('dinner')}
										activeOpacity={0.7}
									>
										<View style={styles.servingInfo}>
											<Text style={styles.servingLabel}>DINNER</Text>
											<Text style={styles.servingDish} numberOfLines={1}>
												{todayMenu.dinner.main || 'NOT SET'}
											</Text>
										</View>
										<View style={styles.servingCountPill}>
											<Text style={styles.servingCountValue}>{stats.dinnerCount}</Text>
											<MaterialCommunityIcons name="chevron-right" size={16} color={Theme.colors.textMuted} />
										</View>
									</TouchableOpacity>
								</Animated.View>
							</View>

							{/* Master Total Bar */}
							<Animated.View
								entering={FadeIn.delay(280).duration(300)}
								style={styles.totalBar}
							>
								<TouchableOpacity
									style={styles.totalBarAction}
									onPress={() => setActiveModal('total')}
									activeOpacity={0.7}
								>
									<Text style={styles.totalBarLabel}>TOTAL DAILY SERVINGS</Text>
									<View style={styles.totalBarValueContainer}>
										<Text style={styles.totalBarValue}>{stats.lunchCount + stats.dinnerCount}</Text>
									</View>
								</TouchableOpacity>
							</Animated.View>
						</View>

						{/* Overview Stats */}
						<Section title="Overview">
							<View style={styles.statsRow}>
								<View style={styles.statCard}>
									<Text style={styles.statValue}>{stats.activeCount}</Text>
									<Text style={styles.statLabel}>ACTIVE{"\n"}CUSTOMERS</Text>
								</View>
								<View style={styles.statCard}>
									<Text style={styles.statValue}>{stats.paymentsDue}</Text>
									<Text style={styles.statLabel}>PAYMENTS{"\n"}DUE</Text>
								</View>
							</View>
						</Section>
					</Animated.View>
				) : (
					<Animated.View
						key="attendance"
						entering={FadeInUp.duration(220)}
						style={styles.scrollContent}
					>
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
					</Animated.View>
				)}
			</Screen>

			{/* Production Drill-Down Modal */}
			<AppModal
				visible={activeModal !== null}
				onClose={() => setActiveModal(null)}
				title={`${modalMealLabel} — ${modalCustomers.length} servings`}
				subtitle={modalDish || 'MENU NOT SET'}
			>
				{modalCustomers.length === 0 ? (
					<View style={styles.modalEmpty}>
						<MaterialCommunityIcons name="food-off-outline" size={32} color={Theme.colors.textMuted} />
						<Text style={styles.modalEmptyText}>No customers for this meal</Text>
					</View>
				) : (
					modalCustomers.map((c, i) => (
						<View
							key={c.id}
							style={[
								styles.modalRow,
								i < modalCustomers.length - 1 && styles.modalRowBorder,
							]}
						>
							<View style={styles.modalRowIndex}>
								<Text style={styles.modalRowNumber}>{i + 1}</Text>
							</View>
							<Text style={styles.modalCustomerName}>{c.name}</Text>
						</View>
					))
				)}
			</AppModal>
		</>
	);
}


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
	dateLabel: { ...Theme.typography.labelMedium, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.sm },
	sectionHeader: { ...Theme.typography.label, color: Theme.colors.textSecondary },

	// Production Panel
	productionPanel: {
		backgroundColor: Theme.colors.surfaceElevated,
		borderRadius: Theme.radius.sm,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		padding: Theme.spacing.lg,
		marginBottom: Theme.spacing.md,
	},
	productionTitle: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		textTransform: 'uppercase',
		letterSpacing: 1.5,
		marginBottom: Theme.spacing.md,
	},
	servingsGrid: {
		gap: Theme.spacing.md,
	},
	servingCard: {
		backgroundColor: Theme.colors.surface,
		borderRadius: Theme.radius.md,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		overflow: 'hidden',
	},
	servingAction: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: Theme.spacing.md,
		paddingRight: Theme.spacing.sm,
	},
	servingInfo: {
		flex: 1,
	},
	servingLabel: {
		...Theme.typography.detailBold,
		color: Theme.colors.textSecondary,
		letterSpacing: 1,
	},
	servingDish: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
		marginTop: 2,
	},
	servingCountPill: {
		backgroundColor: Theme.colors.surfaceElevated,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		borderRadius: Theme.radius.sm,
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.xs,
		borderWidth: 1,
		borderColor: Theme.colors.border,
	},
	servingCountValue: {
		...Theme.typography.answerGiant,
		color: Theme.colors.primary,
		lineHeight: 48,
	},
	totalBar: {
		marginTop: Theme.spacing.lg,
		backgroundColor: Theme.colors.primary,
		borderRadius: Theme.radius.md,
		shadowColor: Theme.colors.primary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 4,
		overflow: 'hidden',
	},
	totalBarAction: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: Theme.spacing.lg,
	},
	totalBarLabel: {
		...Theme.typography.labelMedium,
		color: '#FFFFFF',
		letterSpacing: 1.2,
	},
	totalBarValueContainer: {
		backgroundColor: 'rgba(255,255,255,0.2)',
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.xs,
		borderRadius: Theme.radius.pill,
	},
	totalBarValue: {
		...Theme.typography.answerGiant,
		color: '#FFFFFF',
		lineHeight: 42,
	},

	statsRow: { flexDirection: 'row', gap: Theme.spacing.lg, marginTop: Theme.spacing.sm },
	statCard: {
		flex: 1,
		padding: Theme.spacing.lg,
		alignItems: 'center',
		backgroundColor: Theme.colors.surface,
		borderRadius: Theme.radius.lg,
		borderWidth: 1,
		borderColor: Theme.colors.border,
	},
	statValue: { ...Theme.typography.answerGiant, color: Theme.colors.textPrimary },
	statLabel: { ...Theme.typography.detailBold, color: Theme.colors.textSecondary, marginTop: Theme.spacing.xs, textAlign: 'center' },

	customerRow: { backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: Theme.colors.border, paddingVertical: Theme.spacing.md },
	customerInfo: { marginBottom: Theme.spacing.sm },
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
		backgroundColor: Theme.colors.surfaceElevated,
		borderColor: Theme.colors.primary,
	},
	lockedBadge: { ...Theme.typography.detailBold, color: Theme.colors.textSecondary, marginTop: Theme.spacing.xs },
	toggleBtnLabel: { ...Theme.typography.detailBold, color: Theme.colors.textSecondary },
	toggleBtnDish: { ...Theme.typography.labelMedium, color: Theme.colors.textPrimary, marginTop: Theme.spacing.xs },
	emptyText: { textAlign: 'center', color: Theme.colors.textMuted, marginTop: Theme.spacing.massive, ...Theme.typography.labelMedium },

	// Modal styles
	modalRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: Theme.spacing.md,
		gap: Theme.spacing.md,
	},
	modalRowBorder: {
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.border,
	},
	modalRowIndex: {
		width: 28,
		height: 28,
		borderRadius: 14,
		backgroundColor: Theme.colors.surfaceElevated,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		justifyContent: 'center',
		alignItems: 'center',
	},
	modalRowNumber: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
	},
	modalCustomerName: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
		flex: 1,
	},
	modalEmpty: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: Theme.spacing.massive,
		gap: Theme.spacing.md,
	},
	modalEmptyText: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textMuted,
	},
});
