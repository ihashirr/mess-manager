import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AppModal } from '../components/ui/AppModal';
import { CenterModal } from '../components/ui/CenterModal';
import { CustomerIntelligenceDetail } from '../components/ui/CustomerIntelligenceDetail';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Section } from '../components/ui/Section';
import { UserIdentity } from '../components/ui/UserIdentity';
import { Theme } from '../constants/Theme';
import { useAppTheme } from '../context/ThemeModeContext';
import { db } from '../firebase/config';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';
import { createEmptyDayMenu, normalizeDayMenu, type DayMenu } from '../utils/menuLogic';
import { formatISO } from '../utils/weekLogic';

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
	endDate: unknown;
};

type AttendanceSelection = { lunch: boolean; dinner: boolean };
type AttendanceState = Record<string, AttendanceSelection>;

export default function Index() {
	const router = useRouter();
	const { colors, isDark } = useAppTheme();
	const todayDate = formatISO(new Date());

	const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance'>('dashboard');
	const [todayMenu, setTodayMenu] = useState<DayMenu>(createEmptyDayMenu());
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [attendance, setAttendance] = useState<AttendanceState>({});
	const [stats, setStats] = useState({ activeCount: 0, paymentsDue: 0, lunchCount: 0, dinnerCount: 0, dailyCapacity: 0 });
	const [tomorrowExpected, setTomorrowExpected] = useState(0);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [loading, setLoading] = useState(true);
	// Modal State
	const [activeModal, setActiveModal] = useState<'lunch' | 'dinner' | 'total' | null>(null);
	const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

	const handleSnapshotError = (context: string, error: unknown) => {
		console.error(`Firestore ${context} listener failed:`, error);
		setLoading(false);
		Alert.alert('Firestore access failed', getFirestoreErrorMessage(error, `Could not load ${context}.`));
	};

	// Interaction States
	const totalScale = useSharedValue(1);
	const totalAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: totalScale.value }]
	}));

	useEffect(() => {
		// 1. Subscribe to Today's Menu
		const unsubMenu = onSnapshot(
			doc(db, "menu", todayDate),
			(snap) => {
				setTodayMenu(normalizeDayMenu(snap.exists() ? snap.data() : {}));
			},
			(error) => handleSnapshotError('menu', error)
		);

		// 2. Subscribe to Active Customers
		const unsubCustomers = onSnapshot(
			query(collection(db, "customers")),
			(snap) => {
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
			},
			(error) => handleSnapshotError('customers', error)
		);

		// 3. Subscribe to Today's Attendance
		const unsubAttendance = onSnapshot(
			query(collection(db, "attendance"), where("date", "==", todayDate)),
			(snap) => {
				const state: AttendanceState = {};
				snap.forEach(d => {
					const data = d.data();
					state[data.customerId] = { lunch: data.lunch, dinner: data.dinner };
				});
				setAttendance(state);
			},
			(error) => handleSnapshotError('attendance', error)
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
	};

	if (loading) return <View style={[styles.centered, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

	// derive intelligence signals
	const missingMeals = [!todayMenu.lunch.main, !todayMenu.dinner.main].filter(Boolean).length;
	const totalServings = stats.lunchCount + stats.dinnerCount;
	const hasActiveCustomers = stats.dailyCapacity > 0;
	const menuReady = missingMeals === 0;
	const statusDetail = menuReady ? "Menu ready" : `${missingMeals} meal${missingMeals > 1 ? 's' : ''} missing`;

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
			<Screen backgroundColor={colors.bg}>
				<ScreenHeader
					gutter={Theme.spacing.screen}
					title="Home"
				/>

				<View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
					<TouchableOpacity
						style={[styles.tab, activeTab === 'dashboard' && { backgroundColor: colors.surfaceElevated }]}
						onPress={() => setActiveTab('dashboard')}
					>
						<View style={styles.tabItem}>
							<MaterialCommunityIcons
								name="view-dashboard"
								size={20}
								color={activeTab === 'dashboard' ? colors.primary : colors.textMuted}
							/>
							<Text style={[styles.tabText, { color: activeTab === 'dashboard' ? colors.textPrimary : colors.textMuted }]}>Plan</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.tab, activeTab === 'attendance' && { backgroundColor: colors.surfaceElevated }]}
						onPress={() => setActiveTab('attendance')}
					>
						<View style={styles.tabItem}>
							<MaterialCommunityIcons
								name="playlist-check"
								size={20}
								color={activeTab === 'attendance' ? colors.primary : colors.textMuted}
							/>
							<Text style={[styles.tabText, { color: activeTab === 'attendance' ? colors.textPrimary : colors.textMuted }]}>Attendance</Text>
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
							style={[styles.productionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}
						>
							{hasActiveCustomers ? (
								<>
									<Animated.View style={totalAnimatedStyle}>
										<View style={styles.heroSection}>
											<Text style={[styles.heroEyebrow, { color: colors.textMuted }]}>Servings today</Text>
											<View style={styles.heroCountContainer}>
												<Text style={[styles.heroCount, { color: colors.primary }]}>{totalServings}</Text>
												<Text style={[styles.heroCapacity, { color: colors.textMuted }]}>of {stats.dailyCapacity}</Text>
											</View>
											<TouchableOpacity
												style={styles.heroLabelWrapper}
												onPress={() => setActiveModal('total')}
												onPressIn={() => { totalScale.value = withSpring(0.97); }}
												onPressOut={() => { totalScale.value = withSpring(1); }}
												activeOpacity={1}
											>
												<View style={styles.heroLabelContainer}>
													<Text style={[styles.heroLabel, { color: colors.textMuted }]}>View serving list</Text>
													<MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
												</View>
											</TouchableOpacity>
										</View>
									</Animated.View>

									{!menuReady && (
										<TouchableOpacity
											style={[styles.setupBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
											onPress={() => router.push('/menu')}
											activeOpacity={0.8}
										>
											<View style={styles.setupBannerLeft}>
												<MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.primary} />
												<Text style={[styles.setupBannerText, { color: colors.textPrimary }]}>{statusDetail}</Text>
											</View>
											<Text style={[styles.setupBannerAction, { color: colors.primary }]}>Set menu</Text>
										</TouchableOpacity>
									)}

									<TouchableOpacity
										style={[styles.tieredRow, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.03)' }]}
										onPress={() => setActiveModal('lunch')}
										activeOpacity={0.7}
									>
										<View style={[styles.mealDot, styles.mealDotLunch]} />
										<View style={styles.tieredMeta}>
											<Text style={[styles.tieredLabel, { color: colors.textPrimary }]}>Lunch</Text>
											<Text style={[styles.tieredDish, { color: colors.textMuted }]} numberOfLines={1}>
												{todayMenu.lunch.main || 'Menu pending'}
											</Text>
										</View>
										<Text style={[styles.tieredValue, { color: colors.textPrimary }]}>{stats.lunchCount}</Text>
									</TouchableOpacity>

									<TouchableOpacity
										style={[styles.tieredRow, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.03)' }]}
										onPress={() => setActiveModal('dinner')}
										activeOpacity={0.7}
									>
										<View style={[styles.mealDot, styles.mealDotDinner]} />
										<View style={styles.tieredMeta}>
											<Text style={[styles.tieredLabel, { color: colors.textPrimary }]}>Dinner</Text>
											<Text style={[styles.tieredDish, { color: colors.textMuted }]} numberOfLines={1}>
												{todayMenu.dinner.main || 'Menu pending'}
											</Text>
										</View>
										<Text style={[styles.tieredValue, { color: colors.textPrimary }]}>{stats.dinnerCount}</Text>
									</TouchableOpacity>

									<View style={styles.tomorrowRow}>
										<Text style={[styles.tomorrowText, { color: colors.textMuted }]}>
											Tomorrow: <Text style={{ color: colors.textPrimary }}>{tomorrowExpected}</Text> servings expected
										</Text>
									</View>

									<View
										style={[
											styles.panelFooter,
											{ backgroundColor: colors.surfaceElevated, borderTopColor: colors.border },
											stats.paymentsDue > 0 && {
												backgroundColor: isDark ? 'rgba(231, 76, 60, 0.14)' : 'rgba(231, 76, 60, 0.06)',
												borderTopColor: isDark ? 'rgba(231, 76, 60, 0.32)' : 'rgba(231, 76, 60, 0.2)',
											},
										]}
									>
										<Text style={[styles.panelFooterText, { color: colors.textMuted }]}>
											Active <Text style={{ color: colors.textPrimary }}>{stats.activeCount}</Text>
											{"  "}{" "}
											{stats.paymentsDue > 0 ? (
												<Text style={{ color: colors.mealLunch }}>
													{stats.paymentsDue} payment{stats.paymentsDue > 1 ? 's' : ''} due
												</Text>
											) : (
												<Text>Paid up</Text>
											)}
										</Text>
										<Text style={[styles.lastUpdatedText, { color: colors.textMuted }]}>Updated {timeAgo}</Text>
									</View>
								</>
							) : (
								<View style={styles.emptyState}>
									<View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
										<MaterialCommunityIcons name="account-plus-outline" size={26} color={colors.primary} />
									</View>
									<Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No active customers</Text>
									<Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Add customers before tracking servings.</Text>
									<View style={styles.emptyActions}>
										<TouchableOpacity
											style={[styles.primaryAction, { backgroundColor: colors.primary }]}
											onPress={() => router.push('/customers')}
										>
											<Text style={[styles.primaryActionText, { color: colors.textInverted }]}>Add Customer</Text>
										</TouchableOpacity>
										{!menuReady && (
											<TouchableOpacity
												style={[styles.secondaryAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
												onPress={() => router.push('/menu')}
											>
												<Text style={[styles.secondaryActionText, { color: colors.primary }]}>Set Menu</Text>
											</TouchableOpacity>
										)}
									</View>
								</View>
							)}
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
								<Text style={[styles.emptyText, { color: colors.textMuted }]}>No active customers found</Text>
							) : (
								customers.map(c => (
									<CustomerAttendanceRow
										key={c.id}
										customer={c}
										menu={todayMenu}
										attendance={attendance[c.id]}
										onToggle={(meal: 'lunch' | 'dinner') => toggleTodayAttendance(c.id, meal)}
										onAvatarPress={setSelectedCustomer}
										colors={colors}
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
						<MaterialCommunityIcons name="food-off-outline" size={32} color={colors.textMuted} />
						<Text style={[styles.modalEmptyText, { color: colors.textMuted }]}>No customers for this meal</Text>
					</View>
				) : (
					modalServings.map((s, i) => (
						<View
							key={`${s.customer.id}_${s.meal}`}
							style={[
								styles.modalRow,
								i < modalServings.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
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
									<View style={[styles.mealBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
										<View style={[
											styles.badgeDot,
											s.meal === 'LUNCH' ? styles.badgeDotLunch : styles.badgeDotDinner
										]} />
										<Text style={[styles.mealBadgeText, { color: colors.textSecondary }]}>{s.meal}</Text>
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
						onAction={() => {
							setSelectedCustomer(null);
						}}
					/>
				)}
			</CenterModal>
		</>
	);
}


type CustomerAttendanceRowProps = {
	customer: Customer;
	menu: DayMenu;
	attendance?: AttendanceSelection;
	onToggle: (meal: 'lunch' | 'dinner') => void;
	onAvatarPress: (customer: Customer) => void;
	colors: ReturnType<typeof useAppTheme>['colors'];
};

const CustomerAttendanceRow = ({
	customer,
	menu,
	attendance,
	onToggle,
	onAvatarPress,
	colors,
}: CustomerAttendanceRowProps) => {
	const sel = attendance || { lunch: true, dinner: true };
	const subLunch = customer.mealsPerDay?.lunch !== false;
	const subDinner = customer.mealsPerDay?.dinner !== false;

	return (
		<View style={[styles.customerRow, { borderBottomColor: colors.border }]}>
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
						style={[
							styles.toggleBtn,
							{ backgroundColor: colors.bg, borderColor: colors.border },
							sel.lunch && { backgroundColor: colors.surfaceElevated, borderColor: colors.primary },
						]}
						onPress={() => onToggle('lunch')}
					>
						<View style={styles.rowBetween}>
							<Text style={[styles.toggleBtnLabel, { color: colors.textSecondary }]}>LUNCH</Text>
						</View>
						<Text style={[styles.toggleBtnDish, { color: colors.textPrimary }]} numberOfLines={1}>{menu.lunch.main || 'Rice/Roti'}</Text>
					</TouchableOpacity>
				)}
				{subDinner && (
					<TouchableOpacity
						style={[
							styles.toggleBtn,
							{ backgroundColor: colors.bg, borderColor: colors.border },
							sel.dinner && { backgroundColor: colors.surfaceElevated, borderColor: colors.primary },
						]}
						onPress={() => onToggle('dinner')}
					>
						<View style={styles.rowBetween}>
							<Text style={[styles.toggleBtnLabel, { color: colors.textSecondary }]}>DINNER</Text>
						</View>
						<Text style={[styles.toggleBtnDish, { color: colors.textPrimary }]} numberOfLines={1}>{menu.dinner.main || 'Rice/Roti'}</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	tabBar: {
		flexDirection: 'row',
		backgroundColor: Theme.colors.surface,
		padding: Theme.spacing.xs,
		borderRadius: Theme.radius.pill,
		marginHorizontal: Theme.spacing.screen,
		marginTop: Theme.spacing.md,
		marginBottom: 0,
		borderWidth: 1,
		borderColor: Theme.colors.border,
	},
	tab: { flex: 1, paddingVertical: Theme.spacing.sm, alignItems: 'center', borderRadius: Theme.radius.pill },
	tabItem: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	tabActive: {
		backgroundColor: Theme.colors.surfaceElevated,
	},
	tabText: { ...Theme.typography.detailBold, color: Theme.colors.textMuted, letterSpacing: 0 },
	tabTextActive: { color: Theme.colors.textPrimary },

	scrollContent: { padding: Theme.spacing.screen, paddingTop: Theme.spacing.md, paddingBottom: 150 },
	rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

	// Production Panel
	productionPanel: {
		backgroundColor: Theme.colors.surface,
		borderRadius: Theme.radius.lg,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		overflow: 'hidden',
		marginTop: Theme.spacing.sm,
	},
	heroSection: {
		alignItems: 'center',
		paddingVertical: Theme.spacing.huge,
		paddingHorizontal: Theme.spacing.lg,
	},
	heroEyebrow: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		letterSpacing: 0,
		marginBottom: Theme.spacing.xs,
	},
	heroCount: {
		...Theme.typography.answerGiant,
		fontSize: 56,
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
	setupBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.md,
		backgroundColor: Theme.colors.surfaceElevated,
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderColor: Theme.colors.border,
	},
	setupBannerLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
	},
	setupBannerText: {
		...Theme.typography.detailBold,
		color: Theme.colors.textPrimary,
		letterSpacing: 0,
	},
	setupBannerAction: {
		...Theme.typography.detailBold,
		color: Theme.colors.primary,
		letterSpacing: 0,
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
		letterSpacing: 0,
		opacity: 0.65,
	},
	tieredRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: Theme.spacing.lg,
		paddingRight: Theme.spacing.lg,
		paddingLeft: Theme.spacing.lg,
		gap: Theme.spacing.md,
		overflow: 'hidden',
	},
	mealDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
	},
	mealDotLunch: {
		backgroundColor: Theme.colors.mealLunch,
	},
	mealDotDinner: {
		backgroundColor: Theme.colors.mealDinner,
	},
	tieredMeta: {
		flex: 1,
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
		lineHeight: 28,
	},
	tieredDish: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		fontSize: 13,
		letterSpacing: 0,
		marginTop: 2,
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
	panelFooterText: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		letterSpacing: 0,
	},
	lastUpdatedText: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		fontSize: 10,
		opacity: 0.4,
		marginTop: 4,
		letterSpacing: 0,
	},
	emptyState: {
		alignItems: 'center',
		paddingHorizontal: Theme.spacing.xxl,
		paddingVertical: Theme.spacing.massive,
	},
	emptyIcon: {
		width: 48,
		height: 48,
		borderRadius: 24,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: Theme.colors.surfaceElevated,
		marginBottom: Theme.spacing.lg,
	},
	emptyTitle: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
		fontSize: 20,
	},
	emptySubtitle: {
		...Theme.typography.detail,
		color: Theme.colors.textMuted,
		textAlign: 'center',
		marginTop: Theme.spacing.sm,
		marginBottom: Theme.spacing.xl,
	},
	emptyActions: {
		flexDirection: 'row',
		gap: Theme.spacing.md,
	},
	primaryAction: {
		backgroundColor: Theme.colors.primary,
		borderRadius: Theme.radius.pill,
		paddingHorizontal: Theme.spacing.xl,
		paddingVertical: Theme.spacing.md,
	},
	primaryActionText: {
		...Theme.typography.detailBold,
		color: Theme.colors.textInverted,
		letterSpacing: 0,
	},
	secondaryAction: {
		backgroundColor: Theme.colors.surface,
		borderRadius: Theme.radius.pill,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		paddingHorizontal: Theme.spacing.xl,
		paddingVertical: Theme.spacing.md,
	},
	secondaryActionText: {
		...Theme.typography.detailBold,
		color: Theme.colors.primary,
		letterSpacing: 0,
	},

	customerRow: { backgroundColor: 'transparent', borderBottomWidth: 1, paddingVertical: Theme.spacing.md },
	customerInfo: { marginBottom: Theme.spacing.sm },
	toggleGroup: { flexDirection: 'row', gap: Theme.spacing.md },
	toggleBtn: {
		flex: 1,
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.md,
		borderRadius: Theme.radius.xl,
		borderWidth: 1,
	},
	toggleBtnLabel: { ...Theme.typography.detailBold },
	toggleBtnDish: { ...Theme.typography.labelMedium, marginTop: Theme.spacing.xs },
	emptyText: { textAlign: 'center', marginTop: Theme.spacing.massive, ...Theme.typography.labelMedium },

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
	modalEmpty: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: Theme.spacing.massive,
		gap: Theme.spacing.md,
	},
	modalEmptyText: {
		...Theme.typography.labelMedium,
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
		letterSpacing: 0.5,
	},
});
