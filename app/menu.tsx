import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
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

	if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#000" /></View>;

	return (
		<View style={styles.container}>
			<View style={styles.bgDecoration} />
			<View style={styles.header}>
				<View>
					<Text style={styles.title}>Weekly Plan</Text>
					<Text style={styles.weekLabel}>Operational Master Plan • Week {weekId}</Text>
				</View>
				<View style={styles.headerBtns}>
					<Button
						variant="outline"
						size="sm"
						title="TODAY"
						iconLeft="calendar-today"
						onPress={scrollToToday}
					/>

					{saveBatch.size > 0 && (
						<Button
							variant="primary"
							size="sm"
							title={`SAVE (${saveBatch.size})`}
							iconLeft="content-save-check"
							onPress={handleSave}
						/>
					)}

					<TouchableOpacity style={styles.headerBtn} onPress={() => { }}>
						<MaterialCommunityIcons name="history" size={24} color="#666" />
					</TouchableOpacity>

					<TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
						<MaterialCommunityIcons
							name={isEditing ? "close-circle" : "cog"}
							size={32}
							color={isEditing ? "#d32f2f" : "#666"}
						/>
					</TouchableOpacity>
				</View>
			</View>

			<ScrollView
				ref={scrollRef}
				contentContainerStyle={styles.content}
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
								isExpanded && styles.dayCardExpanded
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
										DEMAND:{" "}
										<MaterialCommunityIcons name="weather-sunny" size={12} color={isToday ? "#777" : "#666"} />
										{" "}{forecast.lunch} |{" "}
										<MaterialCommunityIcons name="weather-night" size={12} color={isToday ? "#777" : "#666"} />
										{" "}{forecast.dinner}
									</Text>
								</View>
								<View style={styles.dayHeaderRight}>
									{isToday && <Text style={styles.todayBadge}>TODAY</Text>}
									<MaterialCommunityIcons
										name={isExpanded ? "chevron-up" : "chevron-down"}
										size={24}
										color={isToday ? "#fff" : "#999"}
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
														{meal === 'lunch' ? (
															<>
																<MaterialCommunityIcons name="weather-sunny" size={12} color={isToday ? "#ff5252" : "#d32f2f"} />
																{" LUNCH"}
															</>
														) : (
															<>
																<MaterialCommunityIcons name="weather-night" size={12} color={isToday ? "#ff5252" : "#d32f2f"} />
																{" DINNER"}
															</>
														)}
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
																	trackColor={{ false: '#767577', true: '#81b0ff' }}
																/>
															</View>
															<View style={styles.row}>
																<Text style={[styles.label, isToday && styles.textWhite]}>Rice</Text>
																<Switch
																	value={slot.rice.enabled}
																	onValueChange={(v) => updateRice(day, meal, 'enabled', v)}
																	trackColor={{ false: '#767577', true: '#81b0ff' }}
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
																	<MaterialCommunityIcons name="alert-circle-outline" size={18} color="#d32f2f" />
																	<Text style={styles.notSetWarning}>Not Set</Text>
																</View>
															)}
															<View style={styles.servingInfo}>
																<MaterialCommunityIcons name="bread-slice-outline" size={14} color={isToday ? "#777" : "#666"} />
																<Text style={[styles.servingText, isToday && styles.textMutedDark]}>
																	{slot.roti ? "Roti" : "No Roti"}
																</Text>
															</View>
															<View style={styles.servingInfo}>
																<MaterialCommunityIcons name="rice" size={14} color={isToday ? "#777" : "#666"} />
																<Text style={[styles.servingText, isToday && styles.textMutedDark]}>
																	{slot.rice.enabled ? (slot.rice.type || "Rice") : "No Rice"}
																</Text>
															</View>
															{slot.extra ? (
																<View style={styles.servingInfo}>
																	<MaterialCommunityIcons name="leaf" size={14} color={isToday ? "#fff" : "#444"} />
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
										<MaterialCommunityIcons name="weather-sunny" size={12} color={isToday ? "#ff5252" : "#888"} />
										<Text style={[styles.summaryText, isToday && styles.textWhite]} numberOfLines={1}>
											{dayData.lunch.main || '---'}
										</Text>
									</View>
									<View style={styles.summaryMeal}>
										<MaterialCommunityIcons name="weather-night" size={12} color={isToday ? "#ff5252" : "#888"} />
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
										{isSel && <MaterialCommunityIcons name="check-circle" size={14} color="#fff" />}
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

		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: Theme.colors.background },
	bgDecoration: {
		position: 'absolute', top: 0, left: 0, right: 0, height: 400,
		backgroundColor: Theme.colors.decoration, borderBottomLeftRadius: 80, borderBottomRightRadius: 80,
		zIndex: -1
	},
	content: { padding: Theme.spacing.screen, paddingBottom: 150 },
	header: {
		flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
		paddingHorizontal: 25, paddingTop: 60, paddingBottom: Theme.spacing.xl,
		backgroundColor: Theme.colors.surface, ...Theme.shadows.soft,
	},
	headerBtns: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md },
	title: { ...Theme.typography.heading, color: Theme.colors.text },
	weekLabel: { ...Theme.typography.label, fontSize: 13, color: Theme.colors.textDimmed, marginTop: 2, textTransform: 'uppercase' },
	jumpBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		backgroundColor: '#e8f5e9',
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		borderRadius: Theme.radius.lg,
		borderWidth: 1,
		borderColor: '#a5d6a7'
	},
	jumpBtnText: { ...Theme.typography.label, fontSize: 12, color: Theme.colors.primary },

	headerSaveBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		backgroundColor: Theme.colors.success,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		borderRadius: Theme.radius.lg,
		...Theme.shadows.soft
	},
	headerSaveText: { ...Theme.typography.label, fontSize: 11, color: Theme.colors.textInverted },
	headerBtn: { padding: Theme.spacing.xs },

	dayCard: {
		backgroundColor: Theme.colors.surface,
		borderRadius: Theme.radius.huge,
		padding: Theme.spacing.xxl,
		marginBottom: Theme.spacing.xl,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		...Theme.shadows.medium,
	},
	dayCardToday: {
		backgroundColor: Theme.colors.elevated,
		borderColor: Theme.colors.success,
		borderWidth: 2,
		...Theme.shadows.strong,
	},
	dayCardExpanded: {
		borderColor: Theme.colors.success,
	},
	dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
	dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	dayTitle: { ...Theme.typography.heading, fontSize: 24, color: Theme.colors.text },
	forecastLabel: { ...Theme.typography.label, fontSize: 13, color: Theme.colors.textDimmed, marginTop: 2 },
	demandHigh: { color: Theme.colors.warning, fontWeight: '900' },
	todayBadge: {
		backgroundColor: Theme.colors.success,
		color: Theme.colors.textInverted,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.xs,
		borderRadius: Theme.radius.sm,
		fontSize: 10,
		fontWeight: '900',
		overflow: 'hidden'
	},

	summaryRow: {
		marginTop: Theme.spacing.sm,
		paddingTop: Theme.spacing.md,
		borderTopWidth: 1,
		borderTopColor: 'rgba(0,0,0,0.05)',
		flexDirection: 'row',
		gap: Theme.spacing.lg
	},
	summaryMeal: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	summaryText: { ...Theme.typography.caption, fontSize: 14, color: Theme.colors.textMuted },

	cardExpandedContent: { marginTop: Theme.spacing.lg },
	copyTodayBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: Theme.spacing.sm,
		backgroundColor: Theme.colors.primary,
		paddingVertical: Theme.spacing.md,
		borderRadius: Theme.radius.lg,
		marginBottom: Theme.spacing.xl
	},
	copyTodayText: { ...Theme.typography.label, color: Theme.colors.textInverted, fontSize: 11 },

	mealsRow: { flexDirection: 'row', gap: Theme.spacing.xl },
	mealColumn: { flex: 1 },
	mealLabel: { ...Theme.typography.label, fontSize: 11, color: Theme.colors.danger, marginBottom: Theme.spacing.sm },
	mealLabelToday: { color: Theme.colors.danger },

	// View Mode
	viewCard: { minHeight: 40 },
	mainValue: { ...Theme.typography.subheading, fontSize: 20, color: Theme.colors.text, lineHeight: 26 },
	notSetContainer: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	notSetWarning: { ...Theme.typography.bodyBold, fontSize: 18, color: Theme.colors.danger, fontStyle: 'italic' },
	servingInfo: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm, marginTop: Theme.spacing.xs },
	servingText: { ...Theme.typography.bodyBold, fontSize: 14, color: Theme.colors.textMuted },
	extraText: { ...Theme.typography.caption, fontSize: 13, color: '#444', fontStyle: 'italic' },

	// Edit Mode
	editCard: { gap: Theme.spacing.md, marginTop: Theme.spacing.md },
	input: {
		...Theme.typography.body,
		borderWidth: 1,
		borderColor: Theme.colors.borderStrong,
		borderRadius: Theme.radius.lg,
		padding: Theme.spacing.md,
		backgroundColor: '#fcfcfc'
	},
	inputSmall: {
		fontSize: 14,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		borderRadius: Theme.radius.md,
		padding: Theme.spacing.md,
		backgroundColor: Theme.colors.surface
	},
	inputExtra: {
		fontSize: 14,
		color: Theme.colors.text,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		borderRadius: Theme.radius.md,
		padding: Theme.spacing.md,
		backgroundColor: Theme.colors.surface
	},
	row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
	label: { ...Theme.typography.bodyBold, fontSize: 15, color: '#444' },

	// Helpers
	textWhite: { color: Theme.colors.textInverted },
	textMutedDark: { color: Theme.colors.textDimmed },
	inputDark: { backgroundColor: '#2a2a2a', color: Theme.colors.textInverted, borderColor: '#444' },
	centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.surface },

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
		borderRadius: Theme.radius.huge,
		padding: Theme.spacing.huge,
		...Theme.shadows.strong
	},
	modalTitle: { ...Theme.typography.subheading, fontSize: 20, color: Theme.colors.text },
	modalSub: { ...Theme.typography.caption, color: Theme.colors.textMuted, marginTop: 4, marginBottom: Theme.spacing.xl },
	dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.md, marginBottom: Theme.spacing.xl },
	dayChip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.md,
		backgroundColor: Theme.colors.surfaceSecondary,
		borderRadius: Theme.radius.lg,
		borderWidth: 1,
		borderColor: Theme.colors.border
	},
	dayChipActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
	dayChipText: { ...Theme.typography.bodyBold, fontSize: 14, color: '#444' },
	modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: Theme.spacing.md },
	modalCancel: { paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.md },
	modalCancelText: { ...Theme.typography.caption, color: Theme.colors.textDimmed },
	modalApply: {
		backgroundColor: Theme.colors.elevated,
		paddingHorizontal: Theme.spacing.xl,
		paddingVertical: Theme.spacing.md,
		borderRadius: Theme.radius.md
	},
	modalApplyText: { ...Theme.typography.label, fontSize: 13, color: Theme.colors.textInverted },
});


