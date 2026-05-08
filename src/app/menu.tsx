import { XCircle, Settings, Save, Copy, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { showToast } from '../components/system/feedback/AppToast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { PremiumBottomSheet, type PremiumBottomSheetHandle } from '../components/ui/PremiumBottomSheet';
import { Screen } from '../components/ui/Screen';
import { ScreenHeaderActionButton } from '../components/ui/ScreenHeader';
import { useResponsiveLayout } from '../components/ui/useResponsiveLayout';
import { useAppHeader } from '../context/HeaderContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { useAppTheme } from '../context/ThemeModeContext';
import { createEmptyDayMenu, normalizeDayMenu, type MealSlot, type WeekMenu } from '../utils/menuLogic';
import { DAYS, DayName, getDateForDayName, getDatesForWeek, getTodayName, getWeekId } from '../utils/weekLogic';

type MenuCustomer = {
	id: string;
	isActive?: boolean;
	mealsPerDay?: { lunch?: boolean; dinner?: boolean };
};

type AttendanceRecord = {
	customerId: string;
	date: string;
	lunch?: boolean;
	dinner?: boolean;
};

export default function MenuScreen() {
	const { colors } = useAppTheme();
	const { setHeaderConfig } = useAppHeader();
	const {
		ready,
		customers: allCustomers,
		menuByDate,
		attendanceByDate,
		saveMenuDay: queueMenuDay,
	} = useOfflineSync();
	const { contentPadding, maxContentWidth } = useResponsiveLayout();
	const weekId = getWeekId();
	const todayName = getTodayName();
	const weekDates = useMemo(() => getDatesForWeek(weekId), [weekId]);
	const customers = useMemo(
		() => allCustomers.filter((customer) => customer.isActive) as MenuCustomer[],
		[allCustomers]
	);
	const remoteWeekMenu = useMemo(() => {
		const next: WeekMenu = {};
		weekDates.forEach((date, index) => {
			const dayName = DAYS[index];
			next[dayName] = normalizeDayMenu(menuByDate[date] ?? createEmptyDayMenu());
		});
		return next;
	}, [menuByDate, weekDates]);

	const [isEditing, setIsEditing] = useState(false);
	const [weekMenu, setWeekMenu] = useState<WeekMenu>(remoteWeekMenu);
	const [saveBatch, setSaveBatch] = useState<Set<DayName>>(new Set());

	const [showCopyModal, setShowCopyModal] = useState(false);
	const [copySelection, setCopySelection] = useState<Set<DayName>>(new Set());

	const scrollRef = useRef<ScrollView>(null);
	const layoutMap = useRef<Record<string, number>>({});
	const [expandedDays, setExpandedDays] = useState<Set<DayName>>(new Set([todayName]));
	const copySheetRef = useRef<PremiumBottomSheetHandle>(null);

	useEffect(() => {
		if (showCopyModal) {
			copySheetRef.current?.present();
		} else {
			copySheetRef.current?.dismiss();
		}
	}, [showCopyModal]);

	useFocusEffect(
		useCallback(() => {
			setHeaderConfig({
				title: 'Weekly Menu',
				subtitle: `OPERATIONAL PLAN • WEEK ${weekId}`,
				rightAction: (
					<ScreenHeaderActionButton
						icon={isEditing ? XCircle : Settings}
						onPress={() => setIsEditing(!isEditing)}
						accessibilityLabel={isEditing ? 'Close editing' : 'Edit weekly menu'}
						variant={isEditing ? 'danger' : 'default'}
					/>
				),
			});
		}, [setHeaderConfig, isEditing, weekId])
	);

	useEffect(() => {
		setWeekMenu((current) => {
			if (isEditing && Object.keys(current).length > 0) {
				return current;
			}
			return remoteWeekMenu;
		});
	}, [isEditing, remoteWeekMenu]);

	const saveDay = async (dayName: DayName) => {
		const date = getDateForDayName(dayName, weekId);
		setSaveBatch(prev => {
			const next = new Set(prev);
			next.add(dayName);
			return next;
		});

		try {
			await queueMenuDay(
				date,
				weekMenu[dayName] ?? createEmptyDayMenu(),
				`Update ${dayName} menu`,
				`${date} saved locally`
			);
		} catch {
			showToast({
				type: 'error',
				title: 'Save failed',
				message: `Could not save menu for ${dayName}.`,
			});
		} finally {
			setSaveBatch(prev => {
				const next = new Set(prev);
				next.delete(dayName);
				return next;
			});
		}
	};

	const updateMeal = (day: DayName, slot: 'lunch' | 'dinner', field: keyof MealSlot, val: any) => {
		setWeekMenu(prev => ({
			...prev,
			[day]: {
				...(prev[day] ?? createEmptyDayMenu()),
				[slot]: { ...(prev[day]?.[slot] ?? createEmptyDayMenu()[slot]), [field]: val }
			}
		}));
	};

	const toggleDayExpansion = (day: DayName) => {
		setExpandedDays(prev => {
			const next = new Set(prev);
			if (next.has(day)) next.delete(day);
			else next.add(day);
			return next;
		});
	};

	const performCopy = async () => {
		if (copySelection.size === 0) return;
		const sourceMenu = weekMenu[todayName];

		if (!sourceMenu) {
			showToast({
				type: 'warning',
				title: 'Nothing to copy',
				message: 'Create today\'s menu before copying it to other days.',
			});
			return;
		}

		try {
			await Promise.all(
				[...copySelection].map((day) => {
					const date = getDateForDayName(day, weekId);
					return queueMenuDay(
						date,
						sourceMenu,
						`Copy menu to ${day}`,
						`${date} copied from ${todayName}`
					);
				})
			);
			setShowCopyModal(false);
			setCopySelection(new Set());
			showToast({
				type: 'success',
				title: 'Menu copied',
				message: `${copySelection.size} day${copySelection.size === 1 ? '' : 's'} updated locally.`,
			});
		} catch {
			showToast({
				type: 'error',
				title: 'Copy failed',
				message: 'Could not batch copy the menu.',
			});
		}
	};

	const getServingCounts = (day: DayName) => {
		let l = 0, d = 0;
		const date = getDateForDayName(day, weekId);
		const dayAttendance = Object.fromEntries(
			(attendanceByDate[date] ?? []).map((record) => [record.customerId, record as AttendanceRecord])
		);
		customers.forEach(c => {
			const subL = c.mealsPerDay?.lunch !== false;
			const subD = c.mealsPerDay?.dinner !== false;
			const att = dayAttendance[c.id];
			if (subL && (!att || att.lunch !== false)) l++;
			if (subD && (!att || att.dinner !== false)) d++;
		});
		return { l, d };
	};

	if (!ready) return <View style={[styles.centered, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

	return (
		<Screen scrollable={false} maxContentWidth={maxContentWidth}>
			<ScrollView 
				ref={scrollRef}
				contentContainerStyle={[styles.scrollContent, { paddingHorizontal: contentPadding }]}
			>
				{DAYS.map(dayName => {
					const isExpanded = expandedDays.has(dayName);
					const isToday = dayName === todayName;
					const counts = getServingCounts(dayName);
					const menu = weekMenu[dayName] || createEmptyDayMenu();

					return (
						<View 
							key={dayName} 
							style={[styles.dayCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
							onLayout={e => { layoutMap.current[dayName] = e.nativeEvent.layout.y; }}
						>
							<TouchableOpacity 
								style={styles.dayHeader} 
								onPress={() => toggleDayExpansion(dayName)}
								activeOpacity={0.7}
							>
								<View style={styles.dayInfo}>
									<Text style={[styles.dayLabel, { color: isToday ? colors.primary : colors.textPrimary }]}>{dayName.toUpperCase()}</Text>
									<Text style={[styles.dateLabel, { color: colors.textMuted }]}>{getDateForDayName(dayName, weekId)}</Text>
								</View>
								<View style={styles.headerRight}>
									{!isExpanded && (
										<View style={styles.servingSummary}>
											<Text style={[styles.servingText, { color: colors.textSecondary }]}>L: {counts.l} | D: {counts.d}</Text>
										</View>
									)}
									{isExpanded ? <ChevronUp size={20} color={colors.textMuted} /> : <ChevronDown size={20} color={colors.textMuted} />}
								</View>
							</TouchableOpacity>

							{isExpanded && (
								<View style={styles.dayContent}>
									<MealEditor 
										label="Lunch" 
										slot={menu.lunch!} 
										isEditing={isEditing} 
										count={counts.l} 
										onChange={(f: any, v: any) => updateMeal(dayName, 'lunch', f, v)}
										colors={colors}
									/>
									<MealEditor 
										label="Dinner" 
										slot={menu.dinner!} 
										isEditing={isEditing} 
										count={counts.d} 
										onChange={(f: any, v: any) => updateMeal(dayName, 'dinner', f, v)}
										colors={colors}
									/>

									{isEditing && (
										<View style={styles.dayActions}>
											{isToday && (
												<Button 
													title="Copy to Others" 
													variant="secondary" 
													iconLeft={Copy}
													onPress={() => setShowCopyModal(true)} 
													style={styles.actionBtn}
												/>
											)}
											<Button 
												title="Save Changes" 
												variant="primary" 
												iconLeft={Save}
												onPress={() => saveDay(dayName)} 
												loading={saveBatch.has(dayName)}
												style={styles.actionBtn}
											/>
										</View>
									)}
								</View>
							)}
						</View>
					);
				})}
			</ScrollView>

			<PremiumBottomSheet ref={copySheetRef} onDismiss={() => setShowCopyModal(false)} title="Copy Today's Menu" subtitle="Select target days">
				<View style={[styles.copyModal, { backgroundColor: colors.surface }]}>
					<View style={styles.copyGrid}>
						{DAYS.filter(d => d !== todayName).map(day => (
							<TouchableOpacity 
								key={day} 
								style={[styles.copyDay, copySelection.has(day) && { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
								onPress={() => setCopySelection(prev => {
									const next = new Set(prev);
									if (next.has(day)) next.delete(day);
									else next.add(day);
									return next;
								})}
							>
								<Text style={[styles.copyDayText, { color: copySelection.has(day) ? colors.primary : colors.textPrimary }]}>{day}</Text>
								{copySelection.has(day) && <CheckCircle2 size={14} color={colors.primary} />}
							</TouchableOpacity>
						))}
					</View>
					<Button title={`Copy to ${copySelection.size} Days`} onPress={performCopy} fullWidth style={{ marginTop: 20 }} />
				</View>
			</PremiumBottomSheet>
		</Screen>
	);
}

const MealEditor = ({ label, slot, isEditing, count, onChange, colors }: any) => (
	<View style={styles.mealBlock}>
		<View style={styles.mealHeader}>
			<Text style={[styles.mealLabel, { color: colors.primary }]}>{label}</Text>
			<Badge label={`${count} Servings`} variant="neutral" />
		</View>
		{isEditing ? (
			<View style={styles.editStack}>
				<Input label="Main Dish" value={slot?.main || ''} onChangeText={v => onChange('main', v)} placeholder="e.g. Chicken Karahi" />
				<Input label="Side Dish" value={slot?.extra || ''} onChangeText={v => onChange('extra', v)} placeholder="e.g. Daal Mash" />
			</View>
		) : (
			<View style={styles.viewStack}>
				<Text style={[styles.dishMain, { color: colors.textPrimary }]}>{slot?.main || 'No main dish set'}</Text>
				<Text style={[styles.dishSide, { color: colors.textSecondary }]}>{slot?.extra || 'No side dish set'}</Text>
			</View>
		)}
	</View>
);

const styles = StyleSheet.create({
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	scrollContent: { paddingVertical: 20, paddingBottom: 150 },
	dayCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
	dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
	dayInfo: { gap: 2 },
	dayLabel: { fontSize: 16, fontWeight: '900' },
	dateLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
	headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	servingSummary: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f0f0f0', borderRadius: 6 },
	servingText: { fontSize: 10, fontWeight: '700' },
	dayContent: { padding: 16, paddingTop: 0, gap: 20 },
	mealBlock: { gap: 8 },
	mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
	mealLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
	editStack: { gap: 8 },
	viewStack: { gap: 4, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 12 },
	dishMain: { fontSize: 16, fontWeight: '800' },
	dishSide: { fontSize: 14, fontWeight: '600' },
	riceSection: { gap: 12 },
	riceLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
	riceGrid: { flexDirection: 'row', gap: 12 },
	riceItem: { flex: 1, gap: 4 },
	riceItemLabel: { fontSize: 12, fontWeight: '600' },
	riceValue: { fontSize: 16, fontWeight: '800' },
	dayActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
	actionBtn: { flex: 1 },
	copyModal: { padding: 24, borderRadius: 24, width: '90%', alignSelf: 'center' },
	modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
	modalSub: { fontSize: 14, fontWeight: '600', marginBottom: 16 },
	copyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	copyDay: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: '#eee' },
	copyDayText: { fontSize: 13, fontWeight: '700' },
});
