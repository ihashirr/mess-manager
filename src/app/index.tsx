import { Users, CalendarCheck, PlusCircle, Sun, Moon, ChefHat, Bell, LucideIcon, ChevronRight, UtensilsCrossed, Sparkles, Clock3 } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState, useCallback, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { PremiumBottomSheet, type PremiumBottomSheetHandle } from '../components/ui/PremiumBottomSheet';
import { CustomerIntelligenceDetail } from '../components/ui/CustomerIntelligenceDetail';
import { Screen } from '../components/ui/Screen';
import { Section } from '../components/ui/Section';
import { UserIdentity } from '../components/ui/UserIdentity';
import { useResponsiveLayout } from '../components/ui/useResponsiveLayout';
import { Theme } from '../constants/Theme';
import { useAppHeader } from '../context/HeaderContext';
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
	const { colors } = useAppTheme();
	const { setHeaderConfig } = useAppHeader();
	const { maxReadableWidth, isCompact, scale, font, icon } = useResponsiveLayout();
	const todayDate = formatISO(new Date());
	const heroCountSize = font(isCompact ? 46 : 54, 0.88, 1.12);

	const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance'>('dashboard');
	const [todayMenu, setTodayMenu] = useState<DayMenu>(createEmptyDayMenu());
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [attendance, setAttendance] = useState<AttendanceState>({});
	const [stats, setStats] = useState({ activeCount: 0, paymentsDue: 0, lunchCount: 0, dinnerCount: 0, dailyCapacity: 0 });
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [loading, setLoading] = useState(true);
	const [activeModal, setActiveModal] = useState<'lunch' | 'dinner' | 'total' | null>(null);
	const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
	const breakdownSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const intelligenceSheetRef = useRef<PremiumBottomSheetHandle>(null);

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

	const handleSnapshotError = (context: string, error: unknown) => {
		console.error(`Firestore ${context} listener failed:`, error);
		setLoading(false);
		Alert.alert('Firestore access failed', getFirestoreErrorMessage(error, `Could not load ${context}.`));
	};

	const totalScale = useSharedValue(1);
	const totalAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: totalScale.value }]
	}));

	useFocusEffect(
		useCallback(() => {
			setHeaderConfig({ title: 'Home' });
		}, [setHeaderConfig])
	);

	useEffect(() => {
		const unsubMenu = onSnapshot(
			doc(db, "menu", todayDate),
			(snap) => {
				setTodayMenu(normalizeDayMenu(snap.exists() ? snap.data() : {}));
			},
			(error) => handleSnapshotError('menu', error)
		);

		const unsubCustomers = onSnapshot(
			query(collection(db, "customers"), where("isActive", "==", true)),
			(snap) => {
				const active: Customer[] = [];
				let due = 0;
				snap.forEach(d => {
					const data = { id: d.id, ...d.data() } as Customer;
					active.push(data);
					if (getDueAmount(data.pricePerMonth, data.totalPaid) > 0) due++;
				});
				setCustomers(active);
				setStats(prev => ({ ...prev, activeCount: active.length, paymentsDue: due }));
				setLoading(false);
			},
			(error) => handleSnapshotError('customers', error)
		);

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
		setLastUpdated(new Date());
	}, [customers, attendance]);

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
				<View style={[styles.tabBar, { marginTop: scale(12, 0.92, 1.08), padding: 4, backgroundColor: colors.surface, borderColor: colors.border }]}>
					<TouchableOpacity
						style={[styles.tab, activeTab === 'dashboard' && { backgroundColor: colors.primary + '10' }]}
						onPress={() => setActiveTab('dashboard')}
						activeOpacity={0.84}
					>
						<View style={styles.tabItem}>
							<ChefHat size={icon(18)} color={activeTab === 'dashboard' ? colors.primary : colors.textMuted} />
							<Text style={[styles.tabText, { color: activeTab === 'dashboard' ? colors.textPrimary : colors.textMuted }]}>Plan</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.tab, activeTab === 'attendance' && { backgroundColor: colors.primary + '10' }]}
						onPress={() => setActiveTab('attendance')}
						activeOpacity={0.84}
					>
						<View style={styles.tabItem}>
							<CalendarCheck size={icon(18)} color={activeTab === 'attendance' ? colors.primary : colors.textMuted} />
							<Text style={[styles.tabText, { color: activeTab === 'attendance' ? colors.textPrimary : colors.textMuted }]}>Attendance</Text>
						</View>
					</TouchableOpacity>
				</View>

				{activeTab === 'dashboard' ? (
					<Animated.View entering={FadeInUp.duration(220)} style={styles.scrollContent}>
						<View style={styles.dashboardStack}>
							<View style={[styles.signalRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
								<View style={styles.signalCopy}>
									<View style={[styles.signalIconWrap, { backgroundColor: colors.primary + '12' }]}>
										<Sparkles size={14} color={colors.primary} />
									</View>
									<View>
										<Text style={[styles.signalTitle, { color: colors.textPrimary }]}>Today&apos;s pulse</Text>
										<Text style={[styles.signalSubtitle, { color: colors.textSecondary }]}>{readinessTone}</Text>
									</View>
								</View>
								<View style={[styles.refreshPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
									<Clock3 size={12} color={colors.textMuted} />
									<Text style={[styles.refreshText, { color: colors.textSecondary }]}>{timeAgo}</Text>
								</View>
							</View>

						<Animated.View entering={FadeInDown.delay(100)} style={[styles.productionPanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
							<View style={styles.heroAmbientWrap} pointerEvents="none">
								<View style={[styles.heroGlow, styles.heroGlowPrimary]} />
								<View style={[styles.heroGlow, styles.heroGlowDinner]} />
							</View>
							{hasActiveCustomers ? (
								<>
									<Animated.View style={totalAnimatedStyle}>
										<TouchableOpacity 
											style={styles.heroSection}
											onPress={() => setActiveModal('total')}
											activeOpacity={0.9}
										>
											<View style={styles.heroTopRow}>
												<View style={styles.heroTitleWrap}>
													<Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Today&apos;s production</Text>
													<Text style={[styles.heroTone, { color: colors.textPrimary }]}>{productionTone}</Text>
												</View>
												<View style={[styles.heroStatusPill, { backgroundColor: menuReady ? colors.success + '14' : colors.warning + '16' }]}>
													<Text style={[styles.heroStatusText, { color: menuReady ? colors.success : colors.warning }]}>
														{menuReady ? 'Menu ready' : 'Action needed'}
													</Text>
												</View>
											</View>

											<View style={styles.heroBodyRow}>
												<View style={styles.heroMain}>
													<Text style={[styles.heroCount, { color: colors.primary, fontSize: heroCountSize }]}>{totalServings}</Text>
													<Text style={[styles.heroSuffix, { color: colors.textMuted }]}>of {stats.dailyCapacity}</Text>
												</View>
												<View style={styles.heroSummaryCol}>
													<View style={[styles.heroSummaryCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
														<Text style={[styles.heroSummaryValue, { color: colors.textPrimary }]}>{stats.activeCount}</Text>
														<Text style={[styles.heroSummaryLabel, { color: colors.textSecondary }]}>active customers</Text>
													</View>
													<View style={[styles.heroSummaryCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
														<Text style={[styles.heroSummaryValue, { color: colors.textPrimary }]}>{stats.paymentsDue}</Text>
														<Text style={[styles.heroSummaryLabel, { color: colors.textSecondary }]}>pending dues</Text>
													</View>
												</View>
											</View>

											<View style={styles.heroSubtextRow}>
												<Text style={[styles.heroSubtext, { color: colors.textSecondary }]}>Open serving list</Text>
												<ChevronRight size={14} color={colors.textMuted} />
											</View>
										</TouchableOpacity>
									</Animated.View>

									<View style={[styles.metricGrid, isCompact && styles.metricGridCompact]}>
										<DashboardMetric 
											icon={Sun} 
											label="Lunch" 
											supporting="scheduled today"
											value={stats.lunchCount} 
											color={colors.primary} 
											onPress={() => setActiveModal('lunch')}
										/>
										<DashboardMetric 
											icon={Moon} 
											label="Dinner" 
											supporting="scheduled today"
											value={stats.dinnerCount} 
											color={Theme.colors.mealDinner} 
											onPress={() => setActiveModal('dinner')}
										/>
									</View>

									<View style={[styles.panelFooter, { borderTopColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
										<View style={styles.footerLeft}>
											<Text style={[styles.footerEyebrow, { color: colors.textSecondary }]}>Live overview</Text>
											<Text style={[styles.footerInfoText, { color: colors.textPrimary }]}>
												{stats.activeCount} active customers
											</Text>
										</View>
										{stats.paymentsDue > 0 ? (
											<View style={[styles.alertPill, { backgroundColor: colors.danger + '12', borderColor: colors.danger + '18' }]}>
												<Bell size={12} color={colors.danger} />
												<Text style={{ color: colors.danger, fontWeight: '800', fontSize: 11 }}>{stats.paymentsDue} due</Text>
											</View>
										) : (
											<View style={[styles.alertPill, { backgroundColor: colors.success + '10', borderColor: colors.success + '16' }]}>
												<Text style={{ color: colors.success, fontWeight: '800', fontSize: 11 }}>all settled</Text>
											</View>
										)}
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
						</Animated.View>
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
							<View style={[styles.mealPill, { backgroundColor: s.meal === 'LUNCH' ? colors.primary + '15' : Theme.colors.mealDinner + '15' }]}>
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

function DashboardMetric({
	icon: Icon,
	label,
	supporting,
	value,
	color,
	onPress,
}: {
	icon: LucideIcon;
	label: string;
	supporting: string;
	value: number;
	color: string;
	onPress: () => void;
}) {
	const { colors } = useAppTheme();
	const { font } = useResponsiveLayout();
	return (
		<TouchableOpacity onPress={onPress} activeOpacity={0.84} style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
			<View style={[styles.metricIconBox, { backgroundColor: color + '12' }]}>
				<Icon size={20} color={color} />
			</View>
			<View style={styles.metricContent}>
				<Text style={[styles.metricValue, { color: colors.textPrimary, fontSize: font(24, 0.94, 1.1) }]}>{value}</Text>
				<Text style={[styles.metricLabel, { color: colors.textPrimary, fontSize: font(11, 0.94, 1.06) }]}>{label}</Text>
				<Text style={[styles.metricHint, { color: colors.textSecondary }]}>{supporting}</Text>
			</View>
			<ChevronRight size={16} color={colors.textMuted} />
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
						style={[styles.toggleBtn, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }, sel.lunch && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
						onPress={() => onToggle('lunch')}
						activeOpacity={0.82}
					>
						<Sun size={14} color={sel.lunch ? colors.primary : colors.textMuted} />
						<Text style={[styles.toggleBtnText, { color: sel.lunch ? colors.primary : colors.textSecondary }]}>Lunch</Text>
					</TouchableOpacity>
				)}
				{subDinner && (
					<TouchableOpacity 
						style={[styles.toggleBtn, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }, sel.dinner && { borderColor: Theme.colors.mealDinner, backgroundColor: Theme.colors.mealDinner + '10' }]}
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
	tabBar: {
		flexDirection: 'row',
		borderRadius: 100,
		borderWidth: 1,
		shadowColor: '#201812',
		shadowOpacity: 0.05,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 6 },
		elevation: 2,
	},
	tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 100 },
	tabItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	tabText: { fontWeight: '700', fontSize: 13 },
	scrollContent: { paddingVertical: 20, paddingBottom: 120 },
	dashboardStack: { gap: 14 },
	signalRow: {
		borderRadius: 18,
		borderWidth: 1,
		paddingHorizontal: 14,
		paddingVertical: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	signalCopy: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		flex: 1,
	},
	signalIconWrap: {
		width: 32,
		height: 32,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	signalTitle: {
		fontSize: 13,
		fontWeight: '800',
	},
	signalSubtitle: {
		fontSize: 12,
		fontWeight: '600',
		marginTop: 2,
	},
	refreshPill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 7,
		borderRadius: 999,
		borderWidth: 1,
	},
	refreshText: {
		fontSize: 11,
		fontWeight: '700',
	},
	productionPanel: {
		borderRadius: 20,
		borderWidth: 1,
		overflow: 'hidden',
		shadowColor: '#201812',
		shadowOpacity: 0.08,
		shadowRadius: 18,
		shadowOffset: { width: 0, height: 10 },
		elevation: 4,
		position: 'relative',
	},
	heroAmbientWrap: {
		...StyleSheet.absoluteFillObject,
	},
	heroGlow: {
		position: 'absolute',
		borderRadius: 999,
		opacity: 0.9,
	},
	heroGlowPrimary: {
		width: 220,
		height: 220,
		right: -70,
		top: -70,
		backgroundColor: 'rgba(255, 107, 53, 0.10)',
	},
	heroGlowDinner: {
		width: 180,
		height: 180,
		left: -60,
		bottom: 100,
		backgroundColor: 'rgba(124, 58, 237, 0.08)',
	},
	heroSection: {
		paddingHorizontal: 18,
		paddingTop: 18,
		paddingBottom: 16,
		borderBottomWidth: 1,
	},
	heroTopRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		gap: 12,
	},
	heroTitleWrap: {
		flex: 1,
		minWidth: 0,
	},
	heroLabel: {
		fontSize: 12,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.9,
	},
	heroTone: {
		fontSize: 18,
		fontWeight: '900',
		marginTop: 4,
	},
	heroStatusPill: {
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderRadius: 999,
	},
	heroStatusText: {
		fontSize: 11,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	heroBodyRow: {
		marginTop: 18,
		flexDirection: 'row',
		alignItems: 'stretch',
		justifyContent: 'space-between',
		gap: 12,
	},
	heroMain: {
		flex: 1,
		justifyContent: 'flex-end',
		flexDirection: 'row',
		alignItems: 'baseline',
		gap: 6,
	},
	heroCount: { fontWeight: '900' },
	heroSuffix: { fontWeight: '700', fontSize: 16 },
	heroSummaryCol: {
		width: 122,
		gap: 8,
	},
	heroSummaryCard: {
		borderRadius: 16,
		borderWidth: 1,
		paddingHorizontal: 12,
		paddingVertical: 11,
	},
	heroSummaryValue: {
		fontSize: 20,
		fontWeight: '900',
	},
	heroSummaryLabel: {
		fontSize: 11,
		fontWeight: '700',
		textTransform: 'uppercase',
		marginTop: 2,
	},
	heroSubtextRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 16 },
	heroSubtext: { fontSize: 12, fontWeight: '800' },
	metricGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
	metricGridCompact: { flexDirection: 'column' },
	metricCard: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		padding: 14,
		borderRadius: 18,
		borderWidth: 1,
		gap: 12,
		shadowColor: '#201812',
		shadowOpacity: 0.04,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 6 },
		elevation: 1,
	},
	metricIconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
	metricContent: { flex: 1 },
	metricValue: { fontWeight: '900' },
	metricLabel: { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
	metricHint: { fontSize: 12, fontWeight: '600', marginTop: 2 },
	panelFooter: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 16,
		borderTopWidth: 1,
		backgroundColor: 'rgba(255,255,255,0.55)',
	},
	footerLeft: { gap: 2 },
	footerEyebrow: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
	footerInfoText: { fontSize: 15, fontWeight: '800' },
	alertPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
	emptyState: { alignItems: 'center', padding: 40, gap: 12 },
	emptyTitle: { fontSize: 18, fontWeight: '800' },
	primaryAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100 },
	primaryActionText: { color: 'white', fontWeight: '800' },
	modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
	mealPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
	modalEmpty: { alignItems: 'center', padding: 40 },
	customerRow: {
		borderWidth: 1,
		borderRadius: 18,
		padding: 14,
		marginBottom: 12,
		gap: 12,
		shadowColor: '#201812',
		shadowOpacity: 0.04,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 6 },
		elevation: 1,
	},
	customerRowTop: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: 12,
	},
	customerRowPill: {
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	customerRowPillText: {
		fontSize: 10,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	toggleGroup: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
	toggleBtn: {
		flex: 1,
		minWidth: 120,
		minHeight: 44,
		borderRadius: 16,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		flexDirection: 'row',
		gap: 8,
		paddingHorizontal: 12,
	},
	toggleBtnText: {
		fontSize: 13,
		fontWeight: '800',
	},
});
