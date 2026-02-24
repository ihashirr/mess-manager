import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SETTINGS } from '../constants/Settings';
import { Theme } from '../constants/Theme';
import { db } from '../firebase/config';
import { mockDb } from '../utils/mockDb';
import { DAYS, DayName, getDateForDayName, getDatesForWeek, getPrevWeekId, getTodayName, getWeekId } from '../utils/weekLogic';

type RiceSlot = { enabled: boolean; type: string };
type MealSlot = { main: string; rice: RiceSlot; roti: boolean; extra: string };
type DayMenu = { lunch: MealSlot; dinner: MealSlot };
type WeekMenu = Partial<Record<DayName, DayMenu>>;

const EMPTY_MEAL: MealSlot = { main: "", rice: { enabled: false, type: "" }, roti: true, extra: "" };
const EMPTY_DAY: DayMenu = { lunch: { ...EMPTY_MEAL }, dinner: { ...EMPTY_MEAL } };

const normalizeMeal = (raw: any): MealSlot => ({
	main: typeof raw?.main === 'string' ? raw.main : "",
	rice: (raw?.rice && typeof raw.rice === 'object' && 'enabled' in raw.rice)
		? raw.rice
		: { enabled: false, type: typeof raw?.rice === 'string' ? raw.rice : "" },
	roti: typeof raw?.roti === 'boolean' ? raw.roti : true,
	extra: typeof raw?.extra === 'string' ? raw.extra : (raw?.side || ""),
});

export default function MenuScreen() {
	const weekId = getWeekId();
	const todayName = getTodayName();

	const [isEditing, setIsEditing] = useState(false);
	const [weekMenu, setWeekMenu] = useState<WeekMenu>({});
	const [loading, setLoading] = useState(true);
	const [saveBatch, setSaveBatch] = useState<Set<DayName>>(new Set());
	const [customers, setCustomers] = useState<any[]>([]);
	const [allAttendance, setAllAttendance] = useState<Record<string, Record<string, any>>>({});

	const [showCopyModal, setShowCopyModal] = useState(false);
	const [copySelection, setCopySelection] = useState<Set<DayName>>(new Set());

	const scrollRef = useRef<ScrollView>(null);
	const layoutMap = useRef<Record<string, number>>({});
	const [expandedDays, setExpandedDays] = useState<Set<DayName>>(new Set([todayName]));

	useEffect(() => {
		const dates = getDatesForWeek(weekId);

		const loadMenu = () => {
			if (SETTINGS.USE_MOCKS) {
				const mock: WeekMenu = {};
				dates.forEach((date: string, i: number) => {
					const dayName = DAYS[i];
					const data = mockDb.getMenu(date);
					mock[dayName] = {
						lunch: normalizeMeal(data.lunch),
						dinner: normalizeMeal(data.dinner),
					};
				});
				setWeekMenu(mock);
				setLoading(false);
				return;
			}
		};

		if (SETTINGS.USE_MOCKS) {
			loadMenu();
			const unsub = mockDb.subscribe(loadMenu);
			return unsub;
		}

		const unsubMenu = dates.map((date: string, idx: number) => {
			const dayName = DAYS[idx];
			return onSnapshot(doc(db, "menu", date), (docSnap) => {
				const raw = docSnap.exists() ? docSnap.data() : {};
				const normalized: DayMenu = {
					lunch: normalizeMeal(raw.lunch),
					dinner: normalizeMeal(raw.dinner),
				};
				setWeekMenu(prev => ({ ...prev, [dayName]: normalized }));
				if (idx === 6) {
					setLoading(false);
				}
			});
		});

		const unsubCustomers = onSnapshot(collection(db, "customers"), (snap) => {
			setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
		});

		const attendanceQuery = query(collection(db, "attendance"), where("date", "in", dates));
		const unsubAttendance = onSnapshot(attendanceQuery, (snap) => {
			const acc: Record<string, Record<string, any>> = {};
			snap.docs.forEach(doc => {
				const data = doc.data();
				if (!acc[data.date]) acc[data.date] = {};
				acc[data.date][data.customerId] = data;
			});
			setAllAttendance(acc);
		});

		return () => {
			unsubMenu.forEach((unsub: () => void) => unsub());
			unsubCustomers();
			unsubAttendance();
		};
	}, [weekId]);

	// Auto-scroll logic
	useEffect(() => {
		if (!loading && Object.keys(layoutMap.current).length === 7) {
			setTimeout(() => {
				scrollToToday();
			}, 300);
		}
	}, [loading]);

	const scrollToToday = () => {
		const y = layoutMap.current[todayName];
		if (y !== undefined && scrollRef.current) {
			scrollRef.current.scrollTo({ y: Math.max(0, y - 20), animated: true });
		}
	};

	const toggleDayExpansion = (day: DayName) => {
		setExpandedDays(prev => {
			const next = new Set(prev);
			if (next.has(day)) next.delete(day);
			else next.add(day);
			return next;
		});
	};

	const duplicatePreviousWeek = async () => {
		const prevWeekId = getPrevWeekId(weekId);
		const prevDates = getDatesForWeek(prevWeekId);

		setLoading(true);
		const newWeekMenu = { ...weekMenu };
		const newBatch = new Set(saveBatch);

		try {
			if (SETTINGS.USE_MOCKS) {
				// Mock duplication logic (just copy current as example or empty)
				console.log("Mock: Duplicating prev week", prevWeekId);
			} else {
				// Real fetch for each day of prev week
				const fetchPromises = prevDates.map(async (date: string, idx: number) => {
					const dayName = DAYS[idx];
					// This is a direct fetch for duplication, not a sub
					const { getDoc } = await import('firebase/firestore');
					const snap = await getDoc(doc(db, "menu", date));
					if (snap.exists()) {
						const raw = snap.data();
						newWeekMenu[dayName] = {
							lunch: normalizeMeal(raw.lunch),
							dinner: normalizeMeal(raw.dinner),
						};
						newBatch.add(dayName);
					}
				});
				await Promise.all(fetchPromises);
			}
			setWeekMenu(newWeekMenu);
			setSaveBatch(newBatch);
		} catch (e) {
			console.error("Duplication failed", e);
		} finally {
			setLoading(false);
		}
	};

	const handleSelectiveCopy = (targetDays: Set<DayName>) => {
		const todayMenuData = weekMenu[todayName];
		if (!todayMenuData) return;

		const newWeekMenu = { ...weekMenu };
		const newBatch = new Set(saveBatch);

		targetDays.forEach((day: DayName) => {
			newWeekMenu[day] = JSON.parse(JSON.stringify(todayMenuData));
			newBatch.add(day);
		});

		setWeekMenu(newWeekMenu);
		setSaveBatch(newBatch);
		setShowCopyModal(false);
	};

	const getForecast = (day: DayName) => {
		const date = getDateForDayName(day, weekId);
		const dayAttendance = allAttendance[date] || {};
		let lunch = 0, dinner = 0;

		customers.forEach(c => {
			const selection = dayAttendance[c.id];
			const subL = c.mealsPerDay?.lunch !== false;
			const subD = c.mealsPerDay?.dinner !== false;

			if (subL && (!selection || selection.lunch !== false)) lunch++;
			if (subD && (!selection || selection.dinner !== false)) dinner++;
		});
		return { lunch, dinner, total: lunch + dinner };
	};

	const updateMeal = (day: DayName, meal: 'lunch' | 'dinner', field: keyof MealSlot, value: any) => {
		setWeekMenu(prev => ({
			...prev,
			[day]: {
				...prev[day] ?? EMPTY_DAY,
				[meal]: { ...((prev[day] ?? EMPTY_DAY)[meal]), [field]: value }
			}
		}));
		setSaveBatch(prev => new Set(prev).add(day));
	};

	const updateRice = (day: DayName, meal: 'lunch' | 'dinner', field: keyof RiceSlot, value: any) => {
		setWeekMenu(prev => ({
			...prev,
			[day]: {
				...prev[day] ?? EMPTY_DAY,
				[meal]: {
					...((prev[day] ?? EMPTY_DAY)[meal]),
					rice: { ...((prev[day] ?? EMPTY_DAY)[meal].rice), [field]: value }
				}
			}
		}));
		setSaveBatch(prev => new Set(prev).add(day));
	};

	const handleSave = async () => {
		try {
			if (!SETTINGS.USE_MOCKS) {
				const promises = Array.from(saveBatch).map(day => {
					const date = getDateForDayName(day, weekId);
					const dayData = weekMenu[day];
					return setDoc(doc(db, "menu", date), {
						...dayData,
						updatedAt: new Date().toISOString()
					}, { merge: true });
				});
				await Promise.all(promises);
			} else {
				saveBatch.forEach(day => {
					const date = getDateForDayName(day, weekId);
					mockDb.saveMenu(date, weekMenu[day]);
				});
			}
			setSaveBatch(new Set());
		} catch (error) {
			console.error("Error saving week menu:", error);
		}
	};

	if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Theme.colors.primary} /></View>;

	return (
		<Screen scrollable={false}>
			<ScreenHeader
				title="Weekly Menu"
				subtitle={`OPERATIONAL PLAN • WEEK ${weekId}`}
				rightAction={
					<TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
						<MaterialCommunityIcons
							name={isEditing ? "close-circle" : "cog"}
							size={28}
							color={isEditing ? Theme.colors.danger : Theme.colors.textMuted}
						/>
					</TouchableOpacity>
				}
			/>

			{saveBatch.size > 0 && (
				<View style={styles.floatingAction}>
					<Button
						variant="primary"
						title={`SAVE CHANGES (${saveBatch.size})`}
						iconLeft="content-save-check"
						onPress={handleSave}
						fullWidth
					/>
				</View>
			)}

			<ScrollView
				ref={scrollRef}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{DAYS.map((day: DayName) => {
					const dayData = weekMenu[day] ?? EMPTY_DAY;
					const isToday = day === todayName;
					const forecast = getForecast(day);
					const isExpanded = expandedDays.has(day) || isEditing;

					return (
						<View
							key={day}
							style={[
								styles.dayCard,
								isToday && styles.dayCardToday,
								!isToday && styles.dayCardQuiet
							]}
							onLayout={(e) => {
								layoutMap.current[day] = e.nativeEvent.layout.y;
							}}
						>
							<TouchableOpacity
								style={styles.dayHeader}
								onPress={() => toggleDayExpansion(day)}
								activeOpacity={0.7}
							>
								<View>
									<Text style={[styles.dayTitle, isToday && styles.textWhite]}>{day}</Text>
									<Text style={[styles.forecastLabel, isToday ? styles.textMutedDark : (forecast.total > 10 ? styles.demandHigh : null)]}>
										DEMAND: LUN {forecast.lunch} | DIN {forecast.dinner}
									</Text>
								</View>
								<View style={styles.dayHeaderRight}>
									{isToday && <Text style={styles.todayBadge}>TODAY</Text>}
									<MaterialCommunityIcons
										name={isExpanded ? "chevron-up" : "chevron-down"}
										size={24}
										color={isToday ? Theme.colors.textInverted : Theme.colors.textMuted}
									/>
								</View>
							</TouchableOpacity>

							{isExpanded ? (
								<View style={styles.cardExpandedContent}>
									{isToday && (
										<Button
											title="DUPLICATE TODAY..."
											iconLeft="content-duplicate"
											onPress={() => {
												setCopySelection(new Set(DAYS.filter((d: DayName) => d !== todayName)));
												setShowCopyModal(true);
											}}
											style={{ marginBottom: Theme.spacing.xl }}
										/>
									)}

									<View style={styles.mealsRow}>
										{(['lunch', 'dinner'] as const).map(meal => {
											const slot = dayData[meal];
											return (
												<View key={meal} style={styles.mealColumn}>
													<Text style={[styles.mealLabel, isToday && styles.mealLabelToday]}>
														{meal === 'lunch' ? "LUNCH" : "DINNER"}
													</Text>

													{isEditing ? (
														<View style={styles.editCard}>
															<Input
																value={slot.main}
																onChangeText={(v) => updateMeal(day, meal, 'main', v)}
																placeholder="Set Main Dish..."
																containerStyle={{ marginBottom: 0 }}
															/>
															<View style={styles.row}>
																<Text style={[styles.label, isToday && styles.textWhite]}>Roti</Text>
																<Switch
																	value={slot.roti}
																	onValueChange={(v) => updateMeal(day, meal, 'roti', v)}
																	trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
																/>
															</View>
															<View style={styles.row}>
																<Text style={[styles.label, isToday && styles.textWhite]}>Rice</Text>
																<Switch
																	value={slot.rice.enabled}
																	onValueChange={(v) => updateRice(day, meal, 'enabled', v)}
																	trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
																/>
															</View>
															{slot.rice.enabled && (
																<Input
																	value={slot.rice.type}
																	onChangeText={(v) => updateRice(day, meal, 'type', v)}
																	placeholder="Rice Type (Plain/Biryani)"
																	containerStyle={{ marginBottom: 0 }}
																/>
															)}
															<Input
																value={slot.extra}
																onChangeText={(v) => updateMeal(day, meal, 'extra', v)}
																placeholder="Secondary Side/Salad"
																containerStyle={{ marginBottom: 0 }}
															/>
														</View>
													) : (
														<TouchableOpacity
															style={styles.viewCard}
															onPress={() => setIsEditing(true)}
														>
															{slot.main ? (
																<Text style={[styles.mainValue, isToday && styles.textWhite]} numberOfLines={2}>
																	{slot.main}
																</Text>
															) : (
																<View style={styles.notSetContainer}>
																	<MaterialCommunityIcons name="alert-circle-outline" size={18} color={Theme.colors.danger} />
																	<Text style={styles.notSetWarning}>Not Set</Text>
																</View>
															)}
															<View style={styles.servingInfo}>
																<Text style={[styles.servingText, isToday && styles.textMutedDark]}>
																	{slot.roti ? "Roti" : "No Roti"}
																</Text>
															</View>
															<View style={styles.servingInfo}>
																<Text style={[styles.servingText, isToday && styles.textMutedDark]}>
																	{slot.rice.enabled ? (slot.rice.type || "Rice") : "No Rice"}
																</Text>
															</View>
															{slot.extra ? (
																<View style={styles.servingInfo}>
																	<Text style={[styles.extraText, isToday && styles.textWhite]}>{slot.extra}</Text>
																</View>
															) : null}
														</TouchableOpacity>
													)}
												</View>
											);
										})}
									</View>
								</View>
							) : (
								<View style={styles.summaryRow}>
									<View style={styles.summaryMeal}>
										<MaterialCommunityIcons name="weather-sunny" size={12} color={isToday ? Theme.colors.textInverted : Theme.colors.textMuted} />
										<Text style={[styles.summaryText, isToday && styles.textWhite]} numberOfLines={1}>
											{dayData.lunch.main || '---'}
										</Text>
									</View>
									<View style={styles.summaryMeal}>
										<MaterialCommunityIcons name="weather-night" size={12} color={isToday ? Theme.colors.textInverted : Theme.colors.textMuted} />
										<Text style={[styles.summaryText, isToday && styles.textWhite]} numberOfLines={1}>
											{dayData.dinner.main || '---'}
										</Text>
									</View>
								</View>
							)}
						</View>
					);
				})}
			</ScrollView>

			{/* Selective Copy Modal */}
			{showCopyModal && (
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<Text style={styles.modalTitle}>Select Target Days</Text>
						<Text style={styles.modalSub}>Copy Today's Menu to these days:</Text>

						<View style={styles.dayGrid}>
							{DAYS.map((d: DayName) => {
								if (d === todayName) return null;
								const isSel = copySelection.has(d);
								return (
									<TouchableOpacity
										key={d}
										style={[styles.dayChip, isSel && styles.dayChipActive]}
										onPress={() => {
											setCopySelection(prev => {
												const next = new Set(prev);
												if (next.has(d)) next.delete(d);
												else next.add(d);
												return next;
											});
										}}
									>
										<Text style={[styles.dayChipText, isSel && styles.textWhite]}>{d}</Text>
										{isSel && <MaterialCommunityIcons name="check-circle" size={14} color={Theme.colors.textInverted} />}
									</TouchableOpacity>
								);
							})}
						</View>

						<View style={styles.modalFooter}>
							<Button
								variant="ghost"
								title="CANCEL"
								onPress={() => setShowCopyModal(false)}
							/>
							<Button
								variant="primary"
								title={`APPLY TO ${copySelection.size} DAYS`}
								onPress={() => handleSelectiveCopy(copySelection)}
							/>
						</View>
					</View>
				</View>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: Theme.colors.bg },
	scrollContent: { padding: Theme.spacing.screen, paddingBottom: 150 },
	headerBtns: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md },
	title: { ...Theme.typography.answer, color: Theme.colors.textPrimary },
	weekLabel: { ...Theme.typography.detailBold, color: Theme.colors.textMuted, marginTop: Theme.spacing.xs, textTransform: 'uppercase' },

	dayCard: {
		padding: Theme.spacing.lg,
		marginBottom: Theme.spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.border,
	},
	dayCardQuiet: {
		backgroundColor: 'transparent',
		borderWidth: 0,
	},
	dayCardToday: {
		backgroundColor: Theme.colors.surfaceElevated,
		borderColor: Theme.colors.success,
		borderWidth: 2,
		borderRadius: Theme.radius.xl,
		marginBottom: Theme.spacing.lg,
	},
	dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Theme.spacing.sm },
	dayRow: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md },
	dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	dayTitle: { ...Theme.typography.answer, color: Theme.colors.textPrimary },
	forecastLabel: { ...Theme.typography.detailBold, color: Theme.colors.textMuted, marginTop: Theme.spacing.xs },
	demandHigh: { color: Theme.colors.warning, fontWeight: '900' },
	todayBadge: {
		backgroundColor: Theme.colors.success,
		color: Theme.colors.textInverted, // Stay dark on light status badge
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.xs,
		borderRadius: Theme.radius.sm,
		...Theme.typography.detailBold,
		overflow: 'hidden'
	},

	summaryRow: {
		marginTop: Theme.spacing.sm,
		paddingTop: Theme.spacing.sm,
		borderTopWidth: 1,
		borderTopColor: Theme.colors.border,
		flexDirection: 'row',
		gap: Theme.spacing.lg
	},
	summaryMeal: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	summaryText: { ...Theme.typography.detail, color: Theme.colors.textSecondary },

	cardExpandedContent: { marginTop: Theme.spacing.md },

	mealsRow: { flexDirection: 'row', gap: Theme.spacing.xl },
	mealColumn: { flex: 1 },
	mealLabel: { ...Theme.typography.detailBold, color: Theme.colors.danger, marginBottom: Theme.spacing.xs },
	mealLabelToday: { color: Theme.colors.danger },

	// View Mode
	viewCard: { minHeight: 40 },
	mainValue: { ...Theme.typography.labelMedium, color: Theme.colors.textPrimary },
	notSetContainer: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	notSetWarning: { ...Theme.typography.labelMedium, color: Theme.colors.danger, fontStyle: 'italic' },
	servingInfo: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm, marginTop: Theme.spacing.xs },
	servingText: { ...Theme.typography.labelMedium, color: Theme.colors.textSecondary },
	extraText: { ...Theme.typography.detail, color: Theme.colors.textSecondary, fontStyle: 'italic' },

	// Edit Mode
	editCard: { gap: Theme.spacing.md, marginTop: Theme.spacing.sm },
	row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Theme.spacing.xs },
	label: { ...Theme.typography.labelMedium, color: Theme.colors.textSecondary },

	// Helpers
	textWhite: { color: Theme.colors.textPrimary },
	textMutedDark: { color: Theme.colors.textMuted },
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.bg },

	// Modal
	modalOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: Theme.colors.overlay,
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 1000
	},
	modalContent: {
		backgroundColor: Theme.colors.surface,
		width: '85%',
		borderRadius: Theme.radius.xl,
		padding: Theme.spacing.xl,
		borderWidth: 1,
		borderColor: Theme.colors.border,
	},
	modalTitle: { ...Theme.typography.labelMedium, color: Theme.colors.textPrimary },
	modalSub: { ...Theme.typography.detail, color: Theme.colors.textSecondary, marginTop: Theme.spacing.xs, marginBottom: Theme.spacing.xl },
	dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.md, marginBottom: Theme.spacing.xl },
	dayChip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.md,
		backgroundColor: Theme.colors.bg,
		borderRadius: Theme.radius.lg,
		borderWidth: 1,
		borderColor: Theme.colors.border
	},
	dayChipActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
	dayChipText: { ...Theme.typography.labelMedium, color: Theme.colors.textPrimary },
	modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: Theme.spacing.md },
	floatingAction: {
		position: 'absolute',
		bottom: 100,
		left: Theme.spacing.screen,
		right: Theme.spacing.screen,
		zIndex: 10,
	},
});


