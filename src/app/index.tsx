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
import { useOperationalSheetController } from '../components/ui/useOperationalSheetController';
import { type CustomerSheetEvent, type OperationalSheetRoute } from '../components/ui/sheetTypes';
import { Theme } from '../constants/Theme';
import { useAppHeader } from '../context/HeaderContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { useAppTheme } from '../context/ThemeModeContext';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { createEmptyDayMenu, normalizeDayMenu, type DayMenu } from '../utils/menuLogic';
import { formatISO } from '../utils/weekLogic';
import { type Customer } from '../components/customers/types';


type AttendanceSelection = { lunch: boolean; dinner: boolean };
type AttendanceState = Record<string, AttendanceSelection>;
type HomeSheetRoute = Extract<OperationalSheetRoute, { name: 'customer-detail' | 'serving-breakdown' }>;

export default function Index() {
	const router = useRouter();
	const { colors } = useAppTheme();
	const { setHeaderConfig } = useAppHeader();
	const { ready, customers: allCustomers, menuByDate, attendanceByDate, saveAttendanceBatch } = useOfflineSync();
	const { maxReadableWidth, scale, icon } = useResponsiveLayout();
	const todayDate = formatISO(new Date());

	const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance'>('dashboard');
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const breakdownSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const intelligenceSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const sheetController = useOperationalSheetController<HomeSheetRoute>();
	
	const customers = useMemo(
		() => allCustomers.filter((customer) => customer.isActive),
		[allCustomers]
	);
	const currentSheetRoute = sheetController.currentRoute;
	const activeBreakdownRoute = currentSheetRoute?.name === 'serving-breakdown'
		? currentSheetRoute
		: null;
	const selectedCustomer = currentSheetRoute?.name === 'customer-detail'
		? customers.find((customer) => customer.id === currentSheetRoute.customerId) ?? null
		: null;
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
		if (activeBreakdownRoute !== null) {
			breakdownSheetRef.current?.present();
		} else {
			breakdownSheetRef.current?.dismiss();
		}
	}, [activeBreakdownRoute]);

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
	const activeModal = activeBreakdownRoute?.meal ?? null;

	const modalServings = activeModal === 'lunch'
		? lunchCustomers.map(c => ({ customer: c, meal: 'LUNCH' as const }))
		: activeModal === 'dinner'
			? dinnerCustomers.map(c => ({ customer: c, meal: 'DINNER' as const }))
			: activeModal === 'total'
				? [...lunchCustomers.map(c => ({ customer: c, meal: 'LUNCH' as const })), ...dinnerCustomers.map(c => ({ customer: c, meal: 'DINNER' as const }))].sort((a, b) => a.customer.name.localeCompare(b.customer.name))
				: [];

	const openCustomerFromBreakdown = (customer: Customer) => {
		sheetController.replaceAfterDismiss(
			{ name: 'customer-detail', customerId: customer.id },
			() => breakdownSheetRef.current?.dismiss()
		);
	};

	const handleCustomerSheetEvent = (event: CustomerSheetEvent) => {
		if (
			event.type === 'customer.attendance' ||
			event.type === 'customer.delete' ||
			event.type === 'customer.edit' ||
			event.type === 'customer.payment' ||
			event.type === 'sheet.dismiss'
		) {
			intelligenceSheetRef.current?.dismiss();
		}
	};

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
							
							{hasActiveCustomers ? (
								<>
									<View style={[
										styles.todayStatusBar,
										{
											backgroundColor: menuReady ? colors.success + '10' : colors.primary + '10',
											borderColor: menuReady ? colors.success + '2A' : colors.primary + '2A',
										},
									]}>
										<View style={[styles.statusIconWrap, { backgroundColor: menuReady ? colors.success + '18' : colors.primary + '18' }]}>
											<Sparkles size={15} color={menuReady ? colors.success : colors.primary} />
										</View>
										<View style={styles.statusCopy}>
											<Text style={[styles.statusTitle, { color: colors.textPrimary }]}>{menuReady ? 'Menu ready' : 'Menu incomplete'}</Text>
											<Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>{productionTone}</Text>
										</View>
										<View style={[styles.pulseTimePill, { borderColor: colors.border, backgroundColor: colors.surface }]}>
											<Clock3 size={12} color={colors.textMuted} />
											<Text style={[styles.pulseTimeText, { color: colors.textSecondary }]}>{timeAgo}</Text>
										</View>
									</View>

									<Animated.View entering={FadeInDown.delay(100)} style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
										<View style={styles.actionCardTop}>
											<View style={[styles.actionIconWrap, { backgroundColor: menuReady ? colors.success + '14' : colors.primary + '14' }]}>
												<ChefHat size={22} color={menuReady ? colors.success : colors.primary} />
											</View>
											<View style={styles.actionCopy}>
												<Text style={[styles.actionEyebrow, { color: colors.textMuted }]}>NEXT ACTION</Text>
												<Text style={[styles.actionTitle, { color: colors.textPrimary }]}>
													{menuReady ? 'Service plan is ready' : "Finish today's menu"}
												</Text>
												<Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
													{menuReady ? `${totalServings} servings scheduled for today.` : readinessTone}
												</Text>
											</View>
										</View>
										<View style={styles.actionFooter}>
											<TouchableOpacity
												style={[styles.primaryCta, { backgroundColor: menuReady ? colors.surfaceElevated : colors.primary }]}
												activeOpacity={0.84}
												onPress={() => router.push('/menu')}
											>
												<Text style={[styles.primaryCtaText, { color: menuReady ? colors.textPrimary : colors.textInverted }]}>
													{menuReady ? 'Review Menu' : 'Open Menu'}
												</Text>
												<ChevronRight size={16} color={menuReady ? colors.textSecondary : colors.textInverted} />
											</TouchableOpacity>
											<TouchableOpacity
												style={[styles.secondaryCta, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
												activeOpacity={0.84}
												onPress={() => sheetController.open({ name: 'serving-breakdown', meal: 'total' })}
											>
												<Text style={[styles.secondaryCtaText, { color: colors.textSecondary }]}>Serving List</Text>
											</TouchableOpacity>
										</View>
									</Animated.View>

									<View style={styles.summaryGrid}>
										<TouchableOpacity
											activeOpacity={0.84}
											onPress={() => sheetController.open({ name: 'serving-breakdown', meal: 'total' })}
											style={[styles.summaryCard, styles.summaryPrimaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
										>
											<Text style={[styles.summaryLabel, { color: colors.textMuted }]}>TOTAL SERVINGS</Text>
											<View style={styles.summaryValueRow}>
												<Text style={[styles.summaryLargeValue, { color: colors.primary }]}>{totalServings}</Text>
												<Text style={[styles.summaryOfText, { color: colors.textMuted }]}>of {stats.dailyCapacity}</Text>
											</View>
										</TouchableOpacity>
										<View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
											<Text style={[styles.summaryLabel, { color: colors.textMuted }]}>CUSTOMERS</Text>
											<Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{stats.activeCount}</Text>
										</View>
										<View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
											<Text style={[styles.summaryLabel, { color: colors.textMuted }]}>DUES</Text>
											<Text style={[styles.summaryValue, { color: stats.paymentsDue > 0 ? colors.warning : colors.success }]}>{stats.paymentsDue}</Text>
										</View>
									</View>

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
											onPress={() => sheetController.open({ name: 'serving-breakdown', meal: 'lunch' })}
										/>
										<MealCard 
											icon={Moon} 
											title="DINNER" 
											subtitle="scheduled today"
											value={stats.dinnerCount}
											color={Theme.colors.mealDinner}
											bgColor={colors.surface}
											borderColor={colors.border}
											onPress={() => sheetController.open({ name: 'serving-breakdown', meal: 'dinner' })}
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
									onAvatarPress={(customer: Customer) => sheetController.open({ name: 'customer-detail', customerId: customer.id })}
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
				policy="passive"
				onDismiss={() => {
					if (!sheetController.consumeReplacement()) {
						sheetController.close();
					}
				}}
			>
				{modalServings.length === 0 ? (
					<View style={styles.modalEmpty}>
						<UtensilsCrossed size={48} color={colors.border} />
						<Text style={{ color: colors.textMuted, marginTop: 8 }}>No servings found</Text>
					</View>
				) : (
					modalServings.map((s, i) => (
						<View key={`${s.customer.id}_${s.meal}`} style={[styles.modalRow, i < modalServings.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
							<UserIdentity name={s.customer.name} onPress={() => openCustomerFromBreakdown(s.customer)} size={32} />
							<View style={[styles.mealModalPill, { backgroundColor: s.meal === 'LUNCH' ? colors.primary + '15' : Theme.colors.mealDinner + '15' }]}>
								<Text style={{ color: s.meal === 'LUNCH' ? colors.primary : Theme.colors.mealDinner, fontWeight: '700', fontSize: 10 }}>{s.meal}</Text>
							</View>
						</View>
					))
				)}
			</PremiumBottomSheet>

			<PremiumBottomSheet 
				ref={intelligenceSheetRef} 
				onDismiss={sheetController.close}
				title="Customer Intelligence"
				policy="operational"
			>
				{selectedCustomer && (
					<CustomerIntelligenceDetail
						customer={selectedCustomer}
						daysLeft={getDaysLeft(toDate(selectedCustomer.endDate))}
						dueAmount={getDueAmount(selectedCustomer.pricePerMonth, selectedCustomer.totalPaid || 0)}
						onAction={handleCustomerSheetEvent}
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
	scrollContent: { paddingTop: 12, paddingBottom: 188 },
	dashboardStack: { gap: 12, paddingHorizontal: 16 },

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

	todayStatusBar: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		borderRadius: 18,
		borderWidth: 1,
		padding: 12,
	},
	statusIconWrap: {
		width: 34,
		height: 34,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	statusCopy: {
		flex: 1,
		minWidth: 0,
	},
	statusTitle: {
		fontSize: 14,
		fontWeight: '900',
		letterSpacing: 0,
	},
	statusSubtitle: {
		fontSize: 12,
		fontWeight: '700',
		marginTop: 2,
	},

	actionCard: {
		borderRadius: 22,
		borderWidth: 1,
		padding: 16,
		shadowColor: '#1A162B',
		shadowOpacity: 0.07,
		shadowRadius: 18,
		shadowOffset: { width: 0, height: 8 },
		elevation: 3,
	},
	actionCardTop: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	actionIconWrap: {
		width: 46,
		height: 46,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	actionCopy: {
		flex: 1,
		minWidth: 0,
	},
	actionEyebrow: {
		fontSize: 10,
		fontWeight: '900',
		letterSpacing: 0.8,
	},
	actionTitle: {
		fontSize: 22,
		fontWeight: '900',
		letterSpacing: -0.4,
		marginTop: 3,
	},
	actionSubtitle: {
		fontSize: 13,
		fontWeight: '700',
		lineHeight: 18,
		marginTop: 4,
	},
	actionFooter: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 16,
	},
	primaryCta: {
		flex: 1,
		minHeight: 46,
		borderRadius: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 4,
		paddingHorizontal: 14,
	},
	primaryCtaText: {
		fontSize: 13,
		fontWeight: '900',
	},
	secondaryCta: {
		minHeight: 46,
		borderRadius: 16,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 14,
	},
	secondaryCtaText: {
		fontSize: 13,
		fontWeight: '900',
	},

	summaryGrid: {
		flexDirection: 'row',
		gap: 10,
	},
	summaryCard: {
		flex: 1,
		minHeight: 82,
		borderRadius: 18,
		borderWidth: 1,
		padding: 12,
		justifyContent: 'space-between',
		shadowColor: '#1A162B',
		shadowOpacity: 0.04,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 5 },
		elevation: 2,
	},
	summaryPrimaryCard: {
		flex: 1.3,
	},
	summaryLabel: {
		fontSize: 9,
		fontWeight: '900',
		letterSpacing: 0.65,
	},
	summaryValueRow: {
		flexDirection: 'row',
		alignItems: 'baseline',
		gap: 4,
	},
	summaryLargeValue: {
		fontSize: 34,
		fontWeight: '900',
		letterSpacing: -1,
		lineHeight: 38,
	},
	summaryOfText: {
		fontSize: 12,
		fontWeight: '800',
		marginBottom: 4,
	},
	summaryValue: {
		fontSize: 29,
		fontWeight: '900',
		letterSpacing: -0.7,
		lineHeight: 34,
	},

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
