import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { AppModal } from '../components/ui/AppModal';
import { CenterModal } from '../components/ui/CenterModal';
import { CustomerIntelligenceDetail } from '../components/ui/CustomerIntelligenceDetail';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Section } from '../components/ui/Section';
import { UserIdentity } from '../components/ui/UserIdentity';
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
	address?: {
		location: string;
		flat: string;
	};
	mealsPerDay?: { lunch: boolean; dinner: boolean };
	pricePerMonth: number;
	totalPaid: number;
	endDate: any;
};

type AttendanceState = Record<string, { lunch: boolean; dinner: boolean }>;

export default function Index() {
	const router = useRouter();
	const todayDate = formatISO(new Date());
	const todayName = getTodayName();

	const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance'>('dashboard');
	const [todayMenu, setTodayMenu] = useState<DayMenu>({ lunch: { ...EMPTY_MEAL }, dinner: { ...EMPTY_MEAL } });
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [attendance, setAttendance] = useState<AttendanceState>({});
	const [stats, setStats] = useState({ activeCount: 0, paymentsDue: 0, lunchCount: 0, dinnerCount: 0, dailyCapacity: 0 });
	const [tomorrowExpected, setTomorrowExpected] = useState(0);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [loading, setLoading] = useState(true);
	// Modal State
	const [activeModal, setActiveModal] = useState<'lunch' | 'dinner' | 'total' | null>(null);
	const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

	// Interaction States
	const totalScale = useSharedValue(1);
	const totalAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: totalScale.value }]
	}));

	const iconPulse = useSharedValue(1);
	useEffect(() => {
		iconPulse.value = withRepeat(
			withTiming(1.15, { duration: 1500 }),
			-1,
			true
		);
	}, []);

	const iconAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: iconPulse.value }]
	}));

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
		let capacity = 0;
		customers.forEach(c => {
			const selection = attendance[c.id];
			const subscribedLunch = c.mealsPerDay?.lunch !== false;
			const subscribedDinner = c.mealsPerDay?.dinner !== false;

			if (subscribedLunch) {
				if (!selection || selection.lunch !== false) lCount++;
				capacity++;
			}
			if (subscribedDinner) {
				if (!selection || selection.dinner !== false) dCount++;
				capacity++;
			}
		});
		setStats(prev => ({ ...prev, lunchCount: lCount, dinnerCount: dCount, dailyCapacity: capacity }));
		setTomorrowExpected(capacity); // Based on current subscriptions
		setLastUpdated(new Date());
	}, [customers, attendance]);

	// Relative time logic for "Last Updated"
	const [timeAgo, setTimeAgo] = useState('just now');
	useEffect(() => {
		const updateTimer = () => {
			if (!lastUpdated) return;
			const diff = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 60000);
			setTimeAgo(diff === 0 ? 'just now' : `${diff} min ago`);
		};
		updateTimer();
		const interval = setInterval(updateTimer, 30000);
		return () => clearInterval(interval);
	}, [lastUpdated]);

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

	// derive intelligence signals
	const missingMeals = [!todayMenu.lunch.main, !todayMenu.dinner.main].filter(Boolean).length;
	const systemStatus = missingMeals === 0 ? "System Readiness: 100%" : `⚠ Attention Required`;
	const statusDetail = missingMeals === 0 ? "All meals configured" : `${missingMeals} meal${missingMeals > 1 ? 's' : ''} not set`;

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
	// Derived Modal Data (Servings based)
	const lunchServings = lunchCustomers.map(c => ({ customer: c, meal: 'LUNCH' as const }));
	const dinnerServings = dinnerCustomers.map(c => ({ customer: c, meal: 'DINNER' as const }));

	const modalServings = activeModal === 'lunch'
		? lunchServings
		: activeModal === 'dinner'
			? dinnerServings
			: activeModal === 'total'
				? [...lunchServings, ...dinnerServings].sort((a, b) => a.customer.name.localeCompare(b.customer.name))
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
						<Animated.View
							entering={FadeInDown.delay(100).duration(400).springify().damping(20)}
							style={styles.productionPanel}
						>
							{/* Hero Section */}
							<Animated.View style={totalAnimatedStyle}>
								<View style={styles.heroSection}>
									<View style={styles.heroCountContainer}>
										<Text style={styles.heroCount}>{stats.lunchCount + stats.dinnerCount}</Text>
										<Text style={styles.heroCapacity}>/ {stats.dailyCapacity} capacity</Text>
									</View>

									<View style={styles.heroIntelligence}>
										<Text style={styles.heroStatus}>{systemStatus}</Text>
										<View style={styles.heroStatusRow}>
											<Text style={styles.heroStatusDetail}>{statusDetail}</Text>
											{missingMeals > 0 && (
												<TouchableOpacity onPress={() => router.push('/menu')}>
													<Text style={styles.heroAction}>Set Now →</Text>
												</TouchableOpacity>
											)}
										</View>
									</View>

									<TouchableOpacity
										style={styles.heroLabelWrapper}
										onPress={() => setActiveModal('total')}
										onPressIn={() => { totalScale.value = withSpring(0.97); }}
										onPressOut={() => { totalScale.value = withSpring(1); }}
										activeOpacity={1}
									>
										<View style={styles.heroLabelContainer}>
											<Text style={styles.heroLabel}>TOTAL SERVINGS TODAY</Text>
											<MaterialCommunityIcons name="chevron-right" size={18} color={Theme.colors.textMuted} />
										</View>
									</TouchableOpacity>
								</View>
							</Animated.View>

							{/* Lunch Row */}
							<TouchableOpacity
								style={styles.tieredRow}
								onPress={() => setActiveModal('lunch')}
								activeOpacity={0.7}
							>
								<View style={[styles.tieredAccent, styles.tieredAccentLunch]} />
								<View style={styles.tieredMeta}>
									<Animated.View style={iconAnimatedStyle}>
										<MaterialCommunityIcons
											name="weather-sunny"
											size={20}
											color="#FF8E3C"
											style={[styles.microIcon, { textShadowColor: '#FF8E3C', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }]}
										/>
									</Animated.View>
									<Text style={styles.tieredLabel}>Lunch</Text>
								</View>
								<Text style={styles.tieredValue}>{stats.lunchCount}</Text>
								<Text style={styles.tieredDish} numberOfLines={1}>
									{todayMenu.lunch.main || 'NOT SET'}
								</Text>
							</TouchableOpacity>

							{/* Dinner Row */}
							<TouchableOpacity
								style={styles.tieredRow}
								onPress={() => setActiveModal('dinner')}
								activeOpacity={0.7}
							>
								<View style={[styles.tieredAccent, styles.tieredAccentDinner]} />
								<View style={styles.tieredMeta}>
									<Animated.View style={iconAnimatedStyle}>
										<MaterialCommunityIcons
											name="weather-night"
											size={20}
											color="#3BC9DB"
											style={[styles.microIcon, { textShadowColor: '#3BC9DB', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }]}
										/>
									</Animated.View>
									<Text style={styles.tieredLabel}>Dinner</Text>
								</View>
								<Text style={styles.tieredValue}>{stats.dinnerCount}</Text>
								<Text style={styles.tieredDish} numberOfLines={1}>
									{todayMenu.dinner.main || 'NOT SET'}
								</Text>
							</TouchableOpacity>

							{/* Tomorrow Preview */}
							<View style={styles.tomorrowRow}>
								<Text style={styles.tomorrowText}>
									Tomorrow: <Text style={{ color: Theme.colors.textPrimary }}>{tomorrowExpected}</Text> servings expected
								</Text>
							</View>

							{/* Footer Meta */}
							<View style={[styles.panelFooter, stats.paymentsDue > 0 && styles.panelFooterUrgent]}>
								<Text style={styles.panelFooterText}>
									Active: <Text style={{ color: Theme.colors.textPrimary }}>{stats.activeCount}</Text>
									{"  "}•{"  "}
									{stats.paymentsDue > 0 ? (
										<Text style={{ color: Theme.colors.mealLunch }}>
											⚠ {stats.paymentsDue} Payment{stats.paymentsDue > 1 ? 's' : ''} Due
										</Text>
									) : (
										<>Due: <Text style={{ color: Theme.colors.textPrimary }}>0</Text></>
									)}
								</Text>
								<Text style={styles.lastUpdatedText}>Updated {timeAgo}</Text>
							</View>
						</Animated.View>
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
										onAvatarPress={(cust: any) => setSelectedCustomer(cust)}
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
				title={`${modalMealLabel} — ${modalServings.length} servings`}
				subtitle={modalDish || 'MENU NOT SET'}
			>
				{modalServings.length === 0 ? (
					<View style={styles.modalEmpty}>
						<MaterialCommunityIcons name="food-off-outline" size={32} color={Theme.colors.textMuted} />
						<Text style={styles.modalEmptyText}>No customers for this meal</Text>
					</View>
				) : (
					modalServings.map((s, i) => (
						<View
							key={`${s.customer.id}_${s.meal}`}
							style={[
								styles.modalRow,
								i < modalServings.length - 1 && styles.modalRowBorder,
							]}
						>
							<UserIdentity
								name={s.customer.name}
								onPress={() => setSelectedCustomer(s.customer)}
								size={32}
								fontSize={12}
							/>
							<View style={styles.modalCustomerInfo}>
								{activeModal === 'total' && (
									<View style={styles.mealBadge}>
										<View style={[
											styles.badgeDot,
											s.meal === 'LUNCH' ? styles.badgeDotLunch : styles.badgeDotDinner
										]} />
										<Text style={styles.mealBadgeText}>{s.meal}</Text>
									</View>
								)}
							</View>
						</View>
					))
				)}
			</AppModal>

			{/* Customer Intelligence Modal */}
			<CenterModal
				visible={selectedCustomer !== null}
				onClose={() => setSelectedCustomer(null)}
				title="Intelligence Hub — انٹیلی جنس مرکز"
			>
				{selectedCustomer && (
					<CustomerIntelligenceDetail
						customer={selectedCustomer}
						daysLeft={getDaysLeft(toDate(selectedCustomer.endDate))}
						dueAmount={getDueAmount(selectedCustomer.pricePerMonth, selectedCustomer.totalPaid || 0)}
						onAction={(type) => {
							console.log("Intelligence Action:", type, selectedCustomer.id);
							// Future: Wire real actions here
							setSelectedCustomer(null);
						}}
					/>
				)}
			</CenterModal>
		</>
	);
}


const CustomerAttendanceRow = ({ customer, menu, attendance, onToggle, date, onAvatarPress }: any) => {
	const sel = attendance || { lunch: true, dinner: true };
	const subLunch = customer.mealsPerDay?.lunch !== false;
	const subDinner = customer.mealsPerDay?.dinner !== false;

	return (
		<View style={styles.customerRow}>
			<View style={styles.customerInfo}>
				<UserIdentity
					name={customer.name}
					onPress={() => onAvatarPress(customer)}
					size={32}
					fontSize={12}
				/>
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
		backgroundColor: Theme.colors.surface,
		borderRadius: Theme.radius.lg,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		overflow: 'hidden',
		marginTop: Theme.spacing.md,
	},
	heroSection: {
		alignItems: 'center',
		paddingVertical: Theme.spacing.massive,
	},
	heroCount: {
		...Theme.typography.answerGiant,
		fontSize: 64,
		color: Theme.colors.primary,
	},
	heroCountContainer: {
		flexDirection: 'row',
		alignItems: 'baseline',
		gap: 8,
	},
	heroCapacity: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		fontSize: 16,
		opacity: 0.5,
	},
	heroIntelligence: {
		alignItems: 'center',
		marginTop: 8,
		marginBottom: 16,
	},
	heroStatus: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textSecondary,
		fontSize: 13,
		fontWeight: '800',
	},
	heroStatusRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 2,
	},
	heroStatusDetail: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		fontSize: 12,
	},
	heroAction: {
		...Theme.typography.detailBold,
		color: Theme.colors.primary,
		fontSize: 12,
	},
	heroLabelWrapper: {
		marginTop: 4,
	},
	heroLabelContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.xs,
		marginTop: -4,
	},
	heroLabel: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		letterSpacing: 2,
		opacity: 0.65,
	},
	panelDivider: {
		height: 1,
		backgroundColor: Theme.colors.border,
		marginHorizontal: Theme.spacing.lg,
		opacity: 0.5,
	},
	tieredRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: Theme.spacing.lg,
		paddingRight: Theme.spacing.lg,
		paddingLeft: Theme.spacing.lg,
		gap: Theme.spacing.md,
		backgroundColor: 'rgba(255, 255, 255, 0.03)',
		overflow: 'hidden',
	},
	tieredAccent: {
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 0,
		width: 4,
	},
	tieredAccentLunch: {
		backgroundColor: Theme.colors.mealLunch,
		opacity: 0.6,
	},
	tieredAccentDinner: {
		backgroundColor: Theme.colors.mealDinner,
		opacity: 0.6,
	},
	microIcon: {
		opacity: 1,
		marginLeft: 4,
	},
	tieredMeta: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		width: 80,
	},
	tieredLabel: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
	},
	tieredValue: {
		...Theme.typography.answerGiant,
		color: Theme.colors.textPrimary,
		fontSize: 22,
		fontWeight: '800',
		marginRight: Theme.spacing.md,
		lineHeight: 28,
	},
	tieredDish: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		flex: 1,
		fontSize: 13,
		textAlign: 'right',
	},
	tomorrowRow: {
		padding: Theme.spacing.lg,
		alignItems: 'center',
	},
	tomorrowText: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		fontSize: 13,
	},
	panelFooter: {
		backgroundColor: Theme.colors.surfaceElevated,
		paddingVertical: Theme.spacing.md,
		alignItems: 'center',
		borderTopWidth: 1,
		borderTopColor: Theme.colors.border,
	},
	panelFooterUrgent: {
		backgroundColor: 'rgba(162, 74, 74, 0.05)',
		borderTopColor: 'rgba(162, 74, 74, 0.15)',
	},
	panelFooterText: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		letterSpacing: 1,
	},
	lastUpdatedText: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		fontSize: 10,
		opacity: 0.4,
		marginTop: 4,
	},

	servingIndicator: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	servingIndicatorLunch: {
		backgroundColor: Theme.colors.mealLunch,
	},
	servingIndicatorDinner: {
		backgroundColor: Theme.colors.mealDinner,
	},

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
	modalCustomerInfo: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	mealBadge: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: Theme.radius.xs,
		backgroundColor: Theme.colors.surfaceElevated,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		borderWidth: 1,
		borderColor: Theme.colors.border,
	},
	badgeDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
	badgeDotLunch: {
		backgroundColor: Theme.colors.mealLunch,
	},
	badgeDotDinner: {
		backgroundColor: Theme.colors.mealDinner,
	},
	mealBadgeText: {
		fontSize: 10,
		fontWeight: '900',
		color: Theme.colors.textSecondary,
		letterSpacing: 0.5,
	},
});
