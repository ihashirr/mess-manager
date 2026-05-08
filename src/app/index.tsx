import { Users, CalendarCheck, PlusCircle, Sun, Moon, ChefHat, Bell, LucideIcon, ChevronRight, UtensilsCrossed, Sparkles, Clock3 } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { showToast } from '../components/system/feedback/AppToast';
import { PremiumBottomSheet, type PremiumBottomSheetHandle } from '../components/ui/PremiumBottomSheet';
import { CustomerIntelligenceDetail } from '../components/ui/CustomerIntelligenceDetail';
import { Screen } from '../components/ui/Screen';
import { Section } from '../components/ui/Section';
import { UserIdentity } from '../components/ui/UserIdentity';
import { useResponsiveLayout } from '../components/ui/useResponsiveLayout';
import { Theme } from '../constants/Theme';
import { useAppHeader } from '../context/HeaderContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { useAppTheme } from '../context/ThemeModeContext';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
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
	const { colors } = useAppTheme();
	const { setHeaderConfig } = useAppHeader();
	const { ready, customers: allCustomers, menuByDate, attendanceByDate, saveAttendanceBatch } = useOfflineSync();
	const { maxReadableWidth, scale, icon } = useResponsiveLayout();
	const todayDate = formatISO(new Date());

	const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance'>('dashboard');
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [activeModal, setActiveModal] = useState<'lunch' | 'dinner' | 'total' | null>(null);
	const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
	const breakdownSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const intelligenceSheetRef = useRef<PremiumBottomSheetHandle>(null);
	
	const customers = useMemo(
		() => allCustomers.filter((customer) => customer.isActive),
		[allCustomers]
	);
	const todayMenu: DayMenu = useMemo(
		() => normalizeDayMenu(menuByDate[todayDate] ?? createEmptyDayMenu()),
		[menuByDate, todayDate]
	);
	const attendance = useMemo<AttendanceState>(() => {
		const state: AttendanceState = {};
		for (const record of attendanceByDate[todayDate] ?? []) {
			state[record.customerId] = {
				lunch: record.lunch ?? true,
				dinner: record.dinner ?? true,
			};
		}
		return state;
	}, [attendanceByDate, todayDate]);
	
	const stats = useMemo(() => {
		let lunchCount = 0;
		let dinnerCount = 0;
		let dailyCapacity = 0;
		let paymentsDue = 0;

		for (const customer of customers) {
			if (getDueAmount(customer.pricePerMonth, customer.totalPaid) > 0) {
				paymentsDue += 1;
			}

			const selection = attendance[customer.id];
			const subscribedLunch = customer.mealsPerDay?.lunch !== false;
			const subscribedDinner = customer.mealsPerDay?.dinner !== false;

			if (subscribedLunch) {
				if (!selection || selection.lunch !== false) lunchCount += 1;
				dailyCapacity += 1;
			}
			if (subscribedDinner) {
				if (!selection || selection.dinner !== false) dinnerCount += 1;
				dailyCapacity += 1;
			}
		}

		return {
			activeCount: customers.length,
			paymentsDue,
			lunchCount,
			dinnerCount,
			dailyCapacity,
		};
	}, [attendance, customers]);

	useEffect(() => {
		if (activeModal !== null) {
			breakdownSheetRef.current?.present();
		} else {
			breakdownSheetRef.current?.dismiss();
		}
	}, [activeModal]);

	useEffect(() => {
		if (selectedCustomer !== null) {
			intelligenceSheetRef.current?.present();
		} else {
			intelligenceSheetRef.current?.dismiss();
		}
	}, [selectedCustomer]);

	useFocusEffect(
		useCallback(() => {
			setHeaderConfig({ title: 'Home' });
		}, [setHeaderConfig])
	);

	useEffect(() => {
		if (!ready) {
			return;
		}
		setLastUpdated(new Date());
	}, [attendance, customers, ready, todayMenu]);

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
			const customer = customers.find((entry) => entry.id === customerId);
			await saveAttendanceBatch(
				[
					{
						id: `${todayDate}_${customerId}`,
						customerId,
						name: customer?.name ?? '',
						date: todayDate,
						...current,
						[meal]: newValue,
						updatedAt: new Date().toISOString(),
					},
				],
				customer?.name ? `Update ${customer.name}` : 'Update attendance',
				`${meal === 'lunch' ? 'Lunch' : 'Dinner'} toggle saved locally`
			);
		} catch (e) {
			console.error("Error toggling attendance:", e);
			showToast({
				type: 'error',
				title: 'Could not update attendance',
				message: e instanceof Error && e.message.trim() ? e.message.trim() : 'Attendance could not be saved locally.',
			});
		}
	};

	if (!ready) return <View style={[styles.centered, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

	const totalServings = stats.lunchCount + stats.dinnerCount;
	const hasActiveCustomers = stats.dailyCapacity > 0;
	const missingMeals = [!todayMenu.lunch.main, !todayMenu.dinner.main].filter(Boolean).length;
	const menuReady = missingMeals === 0;
	const productionTone = menuReady ? 'Ready for service' : `${missingMeals} menu slot${missingMeals === 1 ? '' : 's'} missing`;
	const readinessTone = menuReady ? `${timeAgo} refresh` : 'Finish the menu to avoid confusion';

	const lunchCustomers = customers.filter(c => (c.mealsPerDay?.lunch !== false) && (!attendance[c.id] || attendance[c.id].lunch !== false));
	const dinnerCustomers = customers.filter(c => (c.mealsPerDay?.dinner !== false) && (!attendance[c.id] || attendance[c.id].dinner !== false));
	
	const modalServings = activeModal === 'lunch'
		? lunchCustomers.map(c => ({ customer: c, meal: 'LUNCH' as const }))
		: activeModal === 'dinner'
			? dinnerCustomers.map(c => ({ customer: c, meal: 'DINNER' as const }))
			: activeModal === 'total'
				? [...lunchCustomers.map(c => ({ customer: c, meal: 'LUNCH' as const })), ...dinnerCustomers.map(c => ({ customer: c, meal: 'DINNER' as const }))].sort((a, b) => a.customer.name.localeCompare(b.customer.name))
				: [];

	return (
		<>
			<Screen backgroundColor={colors.bg} maxContentWidth={maxReadableWidth}>
				<View style={[styles.tabBar, { marginTop: scale(12, 0.92, 1.08), padding: 4, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
					<TouchableOpacity
						style={[styles.tab, activeTab === 'dashboard' && { backgroundColor: colors.primary + '10' }]}
						onPress={() => setActiveTab('dashboard')}
						activeOpacity={0.84}
					>
						<View style={styles.tabItem}>
							<ChefHat size={icon(18)} color={activeTab === 'dashboard' ? colors.primary : colors.textMuted} />
							<Text style={[styles.tabText, { color: activeTab === 'dashboard' ? colors.primary : colors.textMuted }]}>Plan</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.tab, activeTab === 'attendance' && { backgroundColor: colors.primary + '10' }]}
						onPress={() => setActiveTab('attendance')}
						activeOpacity={0.84}
					>
						<View style={styles.tabItem}>
							<CalendarCheck size={icon(18)} color={activeTab === 'attendance' ? colors.primary : colors.textMuted} />
							<Text style={[styles.tabText, { color: activeTab === 'attendance' ? colors.primary : colors.textMuted }]}>Attendance</Text>
						</View>
					</TouchableOpacity>
				</View>

				{activeTab === 'dashboard' ? (
					<Animated.View entering={FadeInUp.duration(220)} style={styles.scrollContent}>
						<View style={styles.dashboardStack}>
							
							{/* Pulse Card */}
							<View style={[styles.pulseRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
								<View style={[styles.pulseIconWrap, { backgroundColor: colors.primary + '15' }]}>
									<Sparkles size={16} color={colors.primary} />
								</View>
								<View style={styles.pulseCopyWrap}>
									<Text style={[styles.pulseTitle, { color: colors.textPrimary }]}>Today&apos;s pulse</Text>
									<Text style={[styles.pulseSubtitle, { color: colors.textSecondary }]}>{readinessTone}</Text>
								</View>
								<View style={[styles.pulseTimePill, { borderColor: colors.border }]}>
									<Clock3 size={12} color={colors.textMuted} />
									<Text style={[styles.pulseTimeText, { color: colors.textSecondary }]}>{timeAgo}</Text>
								</View>
							</View>

							{hasActiveCustomers ? (
								<>
									{/* Main Hero Panel */}
									<Animated.View entering={FadeInDown.delay(100)} style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
										{/* Ambient Blobs */}
										<View style={styles.ambientWrap} pointerEvents="none">
											<View style={[styles.blobOrange, { backgroundColor: colors.primary + '15' }]} />
											<View style={[styles.blobPurple, { backgroundColor: Theme.colors.mealDinner + '10' }]} />
										</View>

										{/* Content */}
										<View style={styles.heroContent}>
											<View style={styles.heroHeader}>
												<View>
													<Text style={[styles.heroEyebrow, { color: colors.textSecondary }]}>TODAY&apos;S PRODUCTION</Text>
													<Text style={[styles.heroTone, { color: colors.textPrimary }]}>{productionTone}</Text>
												</View>
												<View style={[styles.heroStatusPill, { backgroundColor: menuReady ? colors.success + '1A' : colors.primary + '1A' }]}>
													<Text style={[styles.heroStatusText, { color: menuReady ? colors.success : colors.primary }]}>
														{menuReady ? 'MENU READY' : 'ACTION NEEDED'}
													</Text>
												</View>
											</View>

											<View style={styles.heroBody}>
												<TouchableOpacity 
													style={styles.heroMainMetric} 
													activeOpacity={0.8}
													onPress={() => setActiveModal('total')}
												>
													<Text style={[styles.heroGiantNumber, { color: colors.primary }]}>{totalServings}</Text>
													<Text style={[styles.heroOfText, { color: colors.textMuted }]}>of {stats.dailyCapacity}</Text>
												</TouchableOpacity>
												
												<View style={styles.heroStatsCol}>
													<View style={[styles.miniStatCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
														<Text style={[styles.miniStatValue, { color: colors.textPrimary }]}>{stats.activeCount}</Text>
														<Text style={[styles.miniStatLabel, { color: colors.textSecondary }]}>ACTIVE CUSTOMERS</Text>
													</View>
													<View style={[styles.miniStatCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
														<Text style={[styles.miniStatValue, { color: colors.textPrimary }]}>{stats.paymentsDue}</Text>
														<Text style={[styles.miniStatLabel, { color: colors.textSecondary }]}>PENDING DUES</Text>
													</View>
												</View>
											</View>
										</View>

										<TouchableOpacity 
											style={[styles.heroFooterRow, { borderTopColor: colors.border }]}
											activeOpacity={0.8}
											onPress={() => setActiveModal('total')}
										>
											<Text style={[styles.heroFooterText, { color: colors.textSecondary }]}>Open serving list</Text>
											<ChevronRight size={16} color={colors.textMuted} />
										</TouchableOpacity>
									</Animated.View>

									{/* Meal Split Row */}
									<View style={styles.mealsRow}>
										<MealCard 
											icon={Sun} 
											title="LUNCH" 
											subtitle="scheduled today"
											value={stats.lunchCount}
											color={colors.primary}
											bgColor={colors.surface}
											borderColor={colors.border}
											onPress={() => setActiveModal('lunch')}
										/>
										<MealCard 
											icon={Moon} 
											title="DINNER" 
											subtitle="scheduled today"
											value={stats.dinnerCount}
											color={Theme.colors.mealDinner}
											bgColor={colors.surface}
											borderColor={colors.border}
											onPress={() => setActiveModal('dinner')}
										/>
									</View>

									{/* Live Overview Footer */}
									<View style={[styles.overviewPanel, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
										<View>
											<Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>LIVE OVERVIEW</Text>
											<Text style={[styles.overviewValue, { color: colors.textPrimary }]}>{stats.activeCount} active customers</Text>
										</View>
										{stats.paymentsDue > 0 ? (
											<View style={[styles.duePill, { backgroundColor: colors.danger + '1A' }]}>
												<Bell size={12} color={colors.danger} />
												<Text style={[styles.duePillText, { color: colors.danger }]}>{stats.paymentsDue} due</Text>
											</View>
										) : null}
									</View>
								</>
							) : (
								<View style={styles.emptyState}>
									<Users size={48} color={colors.textMuted} />
									<Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No active customers</Text>
									<TouchableOpacity 
										style={[styles.primaryAction, { backgroundColor: colors.primary }]}
										onPress={() => router.push('/customers')}
									>
										<PlusCircle size={18} color="white" />
										<Text style={styles.primaryActionText}>Add Customer</Text>
									</TouchableOpacity>
								</View>
							)}
						</View>
					</Animated.View>
				) : (
					<Animated.View entering={FadeInUp.duration(220)} style={styles.scrollContent}>
						<Section title="Customer Attendance" subtitle="Review today's dishes and switch each meal on or off">
							{customers.map(c => (
								<CustomerAttendanceRow
									key={c.id}
									customer={c}
									menu={todayMenu}
									attendance={attendance[c.id]}
									onToggle={(meal: 'lunch' | 'dinner') => toggleTodayAttendance(c.id, meal)}
									onAvatarPress={setSelectedCustomer}
									colors={colors}
								/>
							))}
						</Section>
					</Animated.View>
				)}
			</Screen>

			<PremiumBottomSheet
				ref={breakdownSheetRef}
				title={activeModal === 'total' ? 'Total Servings Today' : activeModal === 'lunch' ? 'Lunch Servings' : 'Dinner Servings'}
				onDismiss={() => setActiveModal(null)}
			>
				{modalServings.length === 0 ? (
					<View style={styles.modalEmpty}>
						<UtensilsCrossed size={48} color={colors.border} />
						<Text style={{ color: colors.textMuted, marginTop: 8 }}>No servings found</Text>
					</View>
				) : (
					modalServings.map((s, i) => (
						<View key={`${s.customer.id}_${s.meal}`} style={[styles.modalRow, i < modalServings.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
							<UserIdentity name={s.customer.name} onPress={() => setSelectedCustomer(s.customer)} size={32} />
							<View style={[styles.mealModalPill, { backgroundColor: s.meal === 'LUNCH' ? colors.primary + '15' : Theme.colors.mealDinner + '15' }]}>
								<Text style={{ color: s.meal === 'LUNCH' ? colors.primary : Theme.colors.mealDinner, fontWeight: '700', fontSize: 10 }}>{s.meal}</Text>
							</View>
						</View>
					))
				)}
			</PremiumBottomSheet>

			<PremiumBottomSheet 
				ref={intelligenceSheetRef} 
				onDismiss={() => setSelectedCustomer(null)} 
				title="Customer Intelligence"
			>
				{selectedCustomer && (
					<CustomerIntelligenceDetail
						customer={selectedCustomer}
						daysLeft={getDaysLeft(toDate(selectedCustomer.endDate))}
						dueAmount={getDueAmount(selectedCustomer.pricePerMonth, selectedCustomer.totalPaid || 0)}
						onAction={() => {
							intelligenceSheetRef.current?.dismiss();
						}}
					/>
				)}
			</PremiumBottomSheet>
		</>
	);
}

function MealCard({
	icon: Icon,
	title,
	subtitle,
	value,
	color,
	bgColor,
	borderColor,
	onPress,
}: {
	icon: LucideIcon;
	title: string;
	subtitle: string;
	value: number;
	color: string;
	bgColor: string;
	borderColor: string;
	onPress: () => void;
}) {
	const { colors } = useAppTheme();
	return (
		<TouchableOpacity 
			activeOpacity={0.84} 
			onPress={onPress}
			style={[styles.mealCard, { backgroundColor: bgColor, borderColor }]}
		>
			<View style={styles.mealCardTop}>
				<Text style={[styles.mealCardValue, { color: colors.textPrimary }]}>{value}</Text>
			</View>
			<View style={styles.mealCardBottom}>
				<View style={[styles.mealIconCircle, { backgroundColor: color + '15' }]}>
					<Icon size={18} color={color} />
				</View>
				<View>
					<Text style={[styles.mealCardTitle, { color: colors.textPrimary }]}>{title}</Text>
					<View style={{flexDirection: 'row', alignItems: 'center', gap: 2}}>
						<Text style={[styles.mealCardSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
						<ChevronRight size={12} color={colors.textMuted} />
					</View>
				</View>
			</View>
		</TouchableOpacity>
	);
}

const CustomerAttendanceRow = ({ customer, menu, attendance, onToggle, onAvatarPress, colors }: any) => {
	const sel = attendance || { lunch: true, dinner: true };
	const subLunch = customer.mealsPerDay?.lunch !== false;
	const subDinner = customer.mealsPerDay?.dinner !== false;
	const subscribedMeals = [subLunch, subDinner].filter(Boolean).length;
	const selectedMeals = [subLunch && sel.lunch, subDinner && sel.dinner].filter(Boolean).length;
	const mealSummary = [
		subLunch ? `Lunch: ${menu?.lunch?.main || 'Menu pending'}` : null,
		subDinner ? `Dinner: ${menu?.dinner?.main || 'Menu pending'}` : null,
	].filter(Boolean).join(' • ');

	return (
		<View style={[styles.customerRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
			<View style={styles.customerRowTop}>
				<UserIdentity name={customer.name} subtext={mealSummary} onPress={() => onAvatarPress(customer)} size={34} />
				<View style={[styles.customerRowPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
					<Text style={[styles.customerRowPillText, { color: colors.textSecondary }]}>{selectedMeals}/{subscribedMeals} on</Text>
				</View>
			</View>
			<View style={styles.toggleGroup}>
				{subLunch && (
					<TouchableOpacity 
						style={[styles.toggleBtn, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }, sel.lunch && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
						onPress={() => onToggle('lunch')}
						activeOpacity={0.82}
					>
						<Sun size={14} color={sel.lunch ? colors.primary : colors.textMuted} />
						<Text style={[styles.toggleBtnText, { color: sel.lunch ? colors.primary : colors.textSecondary }]}>Lunch</Text>
					</TouchableOpacity>
				)}
				{subDinner && (
					<TouchableOpacity 
						style={[styles.toggleBtn, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }, sel.dinner && { borderColor: Theme.colors.mealDinner, backgroundColor: Theme.colors.mealDinner + '15' }]}
						onPress={() => onToggle('dinner')}
						activeOpacity={0.82}
					>
						<Moon size={14} color={sel.dinner ? Theme.colors.mealDinner : colors.textMuted} />
						<Text style={[styles.toggleBtnText, { color: sel.dinner ? Theme.colors.mealDinner : colors.textSecondary }]}>Dinner</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	scrollContent: { paddingVertical: 16, paddingBottom: 140 },
	dashboardStack: { gap: 16, paddingHorizontal: 16 },

	// Tab Bar
	tabBar: {
		flexDirection: 'row',
		borderRadius: 999,
		borderWidth: 1,
		marginHorizontal: 16,
		shadowColor: '#1A162B',
		shadowOpacity: 0.05,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 6 },
		elevation: 2,
	},
	tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 999 },
	tabItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	tabText: { fontWeight: '800', fontSize: 13 },

	// Pulse Card
	pulseRow: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 14,
		borderRadius: 20,
		borderWidth: 1,
		shadowColor: '#1A162B',
		shadowOpacity: 0.04,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 4 },
		elevation: 2,
	},
	pulseIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
	pulseCopyWrap: { flex: 1, paddingHorizontal: 12 },
	pulseTitle: { fontSize: 14, fontWeight: '800' },
	pulseSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
	pulseTimePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
	pulseTimeText: { fontSize: 11, fontWeight: '700' },

	// Hero Card
	heroCard: {
		borderRadius: 24,
		borderWidth: 1,
		overflow: 'hidden',
		shadowColor: '#1A162B',
		shadowOpacity: 0.06,
		shadowRadius: 20,
		shadowOffset: { width: 0, height: 10 },
		elevation: 3,
	},
	ambientWrap: { ...StyleSheet.absoluteFillObject },
	blobOrange: { position: 'absolute', width: 280, height: 280, right: -60, top: -80, borderRadius: 999 },
	blobPurple: { position: 'absolute', width: 240, height: 240, left: -80, bottom: -40, borderRadius: 999 },
	heroContent: { padding: 20 },
	heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
	heroEyebrow: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
	heroTone: { fontSize: 20, fontWeight: '900', marginTop: 4 },
	heroStatusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
	heroStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
	heroBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 32 },
	heroMainMetric: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
	heroGiantNumber: { fontSize: 72, fontWeight: '900', letterSpacing: -2, lineHeight: 72 },
	heroOfText: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
	heroStatsCol: { width: 130, gap: 10 },
	miniStatCard: { padding: 12, borderRadius: 16, borderWidth: 1 },
	miniStatValue: { fontSize: 18, fontWeight: '900' },
	miniStatLabel: { fontSize: 9, fontWeight: '800', marginTop: 2 },
	heroFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 16, borderTopWidth: 1, backgroundColor: 'rgba(255,255,255,0.4)' },
	heroFooterText: { fontSize: 13, fontWeight: '800' },

	// Meals Row
	mealsRow: { flexDirection: 'row', gap: 12 },
	mealCard: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 1, shadowColor: '#1A162B', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
	mealCardTop: { paddingBottom: 16 },
	mealCardValue: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
	mealCardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	mealIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
	mealCardTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
	mealCardSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2 },

	// Overview Panel
	overviewPanel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 1, marginTop: 4, shadowColor: '#1A162B', shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
	overviewLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
	overviewValue: { fontSize: 16, fontWeight: '900', marginTop: 4 },
	duePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
	duePillText: { fontSize: 11, fontWeight: '800' },

	emptyState: { alignItems: 'center', padding: 40, gap: 12 },
	emptyTitle: { fontSize: 18, fontWeight: '800' },
	primaryAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100 },
	primaryActionText: { color: 'white', fontWeight: '800' },
	modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
	mealModalPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
	modalEmpty: { alignItems: 'center', padding: 40 },
	
	customerRow: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12, gap: 12, shadowColor: '#1A162B', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
	customerRowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
	customerRowPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
	customerRowPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
	toggleGroup: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
	toggleBtn: { flex: 1, minWidth: 120, minHeight: 44, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
	toggleBtnText: { fontSize: 13, fontWeight: '800' },
});
