import { CalendarDays, ChevronLeft, ChevronRight, Save } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useConfirmDialog } from '../system/dialogs/ConfirmDialog';
import { type PremiumBottomSheetHandle } from '../ui/PremiumBottomSheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { useResponsiveLayout } from '../../hooks';
import { PremiumBottomSheet } from '../ui/PremiumBottomSheet';
import { type Customer, type CustomerFormValues } from '../../types';
import { createInitialCustomerFormValues } from './formValues';
import { formatISO } from '../../utils/weekLogic';

interface CustomerFormModalProps {
	sheetRef: React.RefObject<PremiumBottomSheetHandle | null>;
	onClose: () => void;
	onSubmit: (values: CustomerFormValues) => Promise<void>;
	submitting: boolean;
	customer?: Customer | null;
}

type CustomerFormErrors = Partial<Record<keyof CustomerFormValues | 'plan', string>>;
type DateField = 'startDate' | 'endDate';

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getMealPrice = (isLunch: boolean, isDinner: boolean) => {
	if (isLunch && isDinner) {
		return '650';
	}

	if (isLunch || isDinner) {
		return '350';
	}

	return '0';
};

const parseDateInput = (value: string) => {
	if (!DATE_INPUT_PATTERN.test(value.trim())) {
		return null;
	}

	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	const isSameDate =
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day;

	return isSameDate ? date : null;
};

const validateCustomerForm = (values: CustomerFormValues): CustomerFormErrors => {
	const nextErrors: CustomerFormErrors = {};
	const startDate = parseDateInput(values.startDate);
	const endDate = parseDateInput(values.endDate);
	const parsedPrice = Number.parseInt(values.price, 10);

	if (!values.name.trim()) {
		nextErrors.name = 'Customer name is required.';
	}

	if (!values.isLunch && !values.isDinner) {
		nextErrors.plan = 'Select lunch, dinner, or both.';
	}

	if (!values.price.trim() || !/^\d+$/.test(values.price.trim()) || parsedPrice <= 0) {
		nextErrors.price = 'Enter a valid monthly price.';
	}

	if (!startDate) {
		nextErrors.startDate = 'Use YYYY-MM-DD.';
	}

	if (!endDate) {
		nextErrors.endDate = 'Use YYYY-MM-DD.';
	}

	if (startDate && endDate && endDate < startDate) {
		nextErrors.endDate = 'End date must be after start date.';
	}

	return nextErrors;
};

const getCalendarDays = (monthDate: Date) => {
	const year = monthDate.getFullYear();
	const month = monthDate.getMonth();
	const firstOfMonth = new Date(year, month, 1);
	const startDay = firstOfMonth.getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const cells: (Date | null)[] = [];

	for (let index = 0; index < startDay; index += 1) {
		cells.push(null);
	}

	for (let day = 1; day <= daysInMonth; day += 1) {
		cells.push(new Date(year, month, day));
	}

	while (cells.length % 7 !== 0) {
		cells.push(null);
	}

	return cells;
};

const formatDisplayDate = (value: string) => {
	const date = parseDateInput(value);
	if (!date) {
		return value || 'Select date';
	}

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
};

const formatCalendarTitle = (date: Date) => (
	date.toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric',
	})
);

const shiftMonth = (date: Date, amount: number) => (
	new Date(date.getFullYear(), date.getMonth() + amount, 1)
);

export function CustomerFormModal({
	sheetRef,
	onClose,
	onSubmit,
	submitting,
	customer,
}: CustomerFormModalProps) {
	const { stacked } = useResponsiveLayout();
	const { colors } = useAppTheme();
	const { confirm } = useConfirmDialog();
	const [formValues, setFormValues] = useState<CustomerFormValues>(createInitialCustomerFormValues());
	const [formErrors, setFormErrors] = useState<CustomerFormErrors>({});
	const [activeDateField, setActiveDateField] = useState<DateField | null>(null);
	const [calendarMonth, setCalendarMonth] = useState(() => {
		const startDate = parseDateInput(createInitialCustomerFormValues().startDate);
		return startDate ?? new Date();
	});
	const baselineValuesRef = useRef<CustomerFormValues>(formValues);

	useEffect(() => {
		let nextValues: CustomerFormValues;

		if (customer) {
			const startStr = customer.startDate instanceof Date
				? customer.startDate.toISOString().slice(0, 10)
				: typeof customer.startDate === 'string'
					? customer.startDate.slice(0, 10)
					: '';
			const endStr = customer.endDate instanceof Date
				? customer.endDate.toISOString().slice(0, 10)
				: typeof customer.endDate === 'string'
					? customer.endDate.slice(0, 10)
					: '';

			nextValues = {
				name: customer.name || '',
				phone: customer.phone || '',
				location: customer.address?.location || '',
				flat: customer.address?.flat || '',
				mapLink: customer.mapLink || '',
				isLunch: customer.mealsPerDay?.lunch !== false,
				isDinner: customer.mealsPerDay?.dinner !== false,
				price: (customer.pricePerMonth || 0).toString(),
				startDate: startStr,
				endDate: endStr,
				notes: customer.notes || '',
			};
		} else {
			nextValues = createInitialCustomerFormValues();
		}

		baselineValuesRef.current = nextValues;
		setFormValues(nextValues);
		setFormErrors({});
		setActiveDateField(null);
		setCalendarMonth(parseDateInput(nextValues.startDate) ?? new Date());
	}, [customer]);

	const updateField = <K extends keyof CustomerFormValues,>(
		field: K,
		value: CustomerFormValues[K]
	) => {
		setFormValues((current) => ({ ...current, [field]: value }));
		setFormErrors((current) => {
			if (!current[field]) {
				return current;
			}

			const { [field]: _removed, ...rest } = current;
			return rest;
		});
	};

	const updateMealSelection = (field: 'isLunch' | 'isDinner') => {
		setFormValues((current) => {
			const nextValues = {
				...current,
				[field]: !current[field],
			};

			return {
				...nextValues,
				price: getMealPrice(nextValues.isLunch, nextValues.isDinner),
			};
		});
		setFormErrors((current) => {
			const { plan: _plan, price: _price, ...rest } = current;
			return rest;
		});
	};

	const openDatePicker = (field: DateField) => {
		const selectedDate = parseDateInput(formValues[field]);
		setActiveDateField(field);
		setCalendarMonth(selectedDate ?? new Date());
	};

	const selectDate = (date: Date) => {
		if (!activeDateField) {
			return;
		}

		const nextValue = formatISO(date);
		updateField(activeDateField, nextValue);

		if (activeDateField === 'startDate') {
			setActiveDateField('endDate');
			const endDate = parseDateInput(formValues.endDate);
			setCalendarMonth(endDate ?? date);
			return;
		}

		setActiveDateField(null);
	};

	const formIsDirty = JSON.stringify(formValues) !== JSON.stringify(baselineValuesRef.current);

	const handleBeforeDismiss = useCallback(async () => {
		if (submitting || !formIsDirty) {
			return true;
		}

		return confirm({
			title: customer ? 'Discard customer edits?' : 'Discard new customer?',
			message: 'You have unsaved changes in this form. Close it and lose those changes?',
			confirmLabel: 'Discard',
			cancelLabel: 'Keep editing',
			tone: 'warning',
		});
	}, [confirm, customer, formIsDirty, submitting]);

	const handleDismiss = useCallback(() => {
		setFormValues(baselineValuesRef.current);
		setFormErrors({});
		onClose();
	}, [onClose]);

	const handleSubmit = () => {
		const nextErrors = validateCustomerForm(formValues);
		setFormErrors(nextErrors);

		if (Object.keys(nextErrors).length > 0) {
			return;
		}

		void onSubmit(formValues);
	};

	return (
		<PremiumBottomSheet
			ref={sheetRef}
			title={customer ? "Edit Customer" : "Add Customer"}
			subtitle={customer ? "Update customer details" : "Create a new active member"}
			snapPoints={['55%', '80%']}
			policy="critical"
			beforeDismiss={handleBeforeDismiss}
			onDismiss={handleDismiss}
		>
			<View style={styles	.form}>
				{/* Section 1: Customer Info */}
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CUSTOMER INFO</Text>
					<View style={[styles.sectionBody, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
						<Text style={[styles.label, { color: colors.textSecondary }]}>Name - نام *</Text>
						<Input
							value={formValues.name}
							onChangeText={(value) => updateField('name', value)}
							placeholder="Customer Name"
							error={formErrors.name}
							bottomSheet
						/>

						<Text style={[styles.label, { color: colors.textSecondary, marginTop: Theme.spacing.sm }]}>Phone - فون نمبر</Text>
						<Input
							value={formValues.phone}
							onChangeText={(value) => updateField('phone', value)}
							placeholder="0300-1234567"
							keyboardType="phone-pad"
							bottomSheet
						/>
					</View>
				</View>

				{/* Section 2: Delivery */}
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DELIVERY</Text>
					<View style={[styles.sectionBody, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
						<View style={[styles.row, stacked && styles.rowStacked]}>
							<View style={[styles.column, stacked ? styles.columnStacked : styles.columnSpaced]}>
								<Text style={[styles.label, { color: colors.textSecondary }]}>Area - علاقہ</Text>
								<Input
									value={formValues.location}
									onChangeText={(value) => updateField('location', value)}
									placeholder="Building or Area"
									bottomSheet
								/>
							</View>
							<View style={styles.column}>
								<Text style={[styles.label, { color: colors.textSecondary }]}>Flat/Villa - فلیٹ</Text>
								<Input
									value={formValues.flat}
									onChangeText={(value) => updateField('flat', value)}
									placeholder="Apt 2B"
									bottomSheet
								/>
							</View>
						</View>

						<Text style={[styles.label, { color: colors.textSecondary, marginTop: Theme.spacing.sm }]}>Maps Link - نقشہ لنک</Text>
						<Input
							value={formValues.mapLink}
							onChangeText={(value) => updateField('mapLink', value)}
							placeholder="Paste Google Maps link"
							autoCapitalize="none"
							autoCorrect={false}
							bottomSheet
						/>
						<Text style={[styles.mapHint, { color: colors.textMuted }]}>
							Open Google Maps → Share → Copy link
						</Text>
					</View>
				</View>

				{/* Section 3: Subscription */}
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUBSCRIPTION</Text>
					<View style={[styles.sectionBody, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
						<View style={[styles.row, stacked && styles.rowStacked]}>
							<View style={[styles.column, stacked ? styles.columnStacked : styles.columnSpaced]}>
								<Text style={[styles.label, { color: colors.textSecondary }]}>Meals - کھانا</Text>
								<View style={[styles.planSelector, { backgroundColor: colors.surface }]}>
									<TouchableOpacity
										style={[
											styles.planOption,
											formValues.isLunch && [styles.planOptionSelected, { backgroundColor: colors.surfaceElevated, borderColor: colors.primary }],
										]}
										onPress={() => updateMealSelection('isLunch')}
										disabled={submitting}
									>
										<Text style={[styles.planOptionText, { color: colors.textSecondary }, formValues.isLunch && { color: colors.primary }]}>
											LUNCH
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[
											styles.planOption,
											formValues.isDinner && [styles.planOptionSelected, { backgroundColor: colors.surfaceElevated, borderColor: colors.primary }],
										]}
										onPress={() => updateMealSelection('isDinner')}
										disabled={submitting}
									>
										<Text style={[styles.planOptionText, { color: colors.textSecondary }, formValues.isDinner && { color: colors.primary }]}>
											DINNER
										</Text>
									</TouchableOpacity>
								</View>
								{formErrors.plan ? (
									<Text style={[styles.inlineError, { color: colors.danger }]}>{formErrors.plan}</Text>
								) : null}
							</View>
							<View style={styles.column}>
								<Text style={[styles.label, { color: colors.textSecondary }]}>Price - قیمت</Text>
								<Input
									value={formValues.price}
									onChangeText={(value) => updateField('price', value)}
									keyboardType="numeric"
									error={formErrors.price}
									bottomSheet
								/>
							</View>
						</View>

						<View style={[styles.dateFieldRow, stacked && styles.rowStacked]}>
							<DateFieldButton
								label="Start Date - آغاز"
								value={formValues.startDate}
								error={formErrors.startDate}
								active={activeDateField === 'startDate'}
								onPress={() => openDatePicker('startDate')}
							/>
							<DateFieldButton
								label="End Date - ختم"
								value={formValues.endDate}
								error={formErrors.endDate}
								active={activeDateField === 'endDate'}
								onPress={() => openDatePicker('endDate')}
							/>
						</View>
						{activeDateField ? (
							<View style={[styles.calendarPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
								<View style={styles.calendarHeader}>
									<Pressable
										accessibilityLabel="Previous month"
										accessibilityRole="button"
										onPress={() => setCalendarMonth((current) => shiftMonth(current, -1))}
										style={[styles.calendarNavButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
									>
										<ChevronLeft size={18} color={colors.textSecondary} />
									</Pressable>
									<View style={styles.calendarTitleWrap}>
										<Text style={[styles.calendarTitle, { color: colors.textPrimary }]}>
											{formatCalendarTitle(calendarMonth)}
										</Text>
									</View>
									<Pressable
										accessibilityLabel="Next month"
										accessibilityRole="button"
										onPress={() => setCalendarMonth((current) => shiftMonth(current, 1))}
										style={[styles.calendarNavButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
									>
										<ChevronRight size={18} color={colors.textSecondary} />
									</Pressable>
								</View>
								<View style={styles.weekdayRow}>
									{CALENDAR_WEEKDAYS.map((weekday) => (
										<Text key={weekday} style={[styles.weekdayText, { color: colors.textMuted }]}>
											{weekday}
										</Text>
									))}
								</View>
								<View style={styles.calendarGrid}>
									{getCalendarDays(calendarMonth).map((date, index) => {
										const dateValue = date ? formatISO(date) : '';
										const isStart = dateValue === formValues.startDate;
										const isEnd = dateValue === formValues.endDate;
										const isSelected = isStart || isEnd;

										return (
											<View key={`${dateValue || 'empty'}-${index}`} style={styles.calendarCell}>
												{date ? (
													<Pressable
														accessibilityLabel={`Select ${date.toDateString()}`}
														accessibilityRole="button"
														onPress={() => selectDate(date)}
														style={[
															styles.calendarDay,
															{
																backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
																borderColor: isSelected ? colors.primary : colors.border,
															},
														]}
													>
														<Text style={[styles.calendarDayText, { color: isSelected ? colors.textInverted : colors.textPrimary }]}>
															{date.getDate()}
														</Text>
													</Pressable>
												) : null}
											</View>
										);
									})}
								</View>
							</View>
						) : null}
					</View>
				</View>

				{/* Section 4: Operational Notes */}
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>OPERATIONAL NOTES</Text>
					<View style={[styles.sectionBody, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
						<Text style={[styles.label, { color: colors.textSecondary }]}>Special Instructions - نوٹ</Text>
						<Input
							value={formValues.notes}
							onChangeText={(value) => updateField('notes', value)}
							placeholder="Dietary restrictions, delivery times, etc."
							bottomSheet
						/>
					</View>
				</View>

				<View style={[styles.footer, stacked && styles.footerStacked]}>
					<Button
						title="Cancel"
						variant="outline"
						onPress={() => sheetRef.current?.dismiss()}
						disabled={submitting}
						fullWidth={stacked}
						style={stacked ? styles.footerButtonStacked : styles.footerButton}
					/>
					<Button
						title="Save Customer"
						iconLeft={Save}
						onPress={handleSubmit}
						loading={submitting}
						disabled={submitting}
						fullWidth={stacked}
						style={stacked ? styles.footerButtonStacked : styles.footerButton}
					/>
				</View>
			</View>
		</PremiumBottomSheet>
	);
}

function DateFieldButton({
	label,
	value,
	error,
	active,
	onPress,
}: {
	label: string;
	value: string;
	error?: string;
	active: boolean;
	onPress: () => void;
}) {
	const { colors } = useAppTheme();

	return (
		<View style={styles.dateFieldColumn}>
			<Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${label}: ${formatDisplayDate(value)}`}
				onPress={onPress}
				style={[
					styles.dateButton,
					{
						backgroundColor: active ? colors.primary + '10' : colors.surfaceElevated,
						borderColor: active ? colors.primary : error ? colors.danger : colors.border,
					},
				]}
			>
				<CalendarDays size={17} color={active ? colors.primary : colors.textMuted} />
				<View style={styles.dateButtonCopy}>
					<Text style={[styles.dateButtonText, { color: colors.textPrimary }]}>{formatDisplayDate(value)}</Text>
					<Text style={[styles.dateButtonMeta, { color: active ? colors.primary : colors.textMuted }]}>Tap to choose</Text>
				</View>
			</Pressable>
			{error ? <Text style={[styles.inlineError, { color: colors.danger }]}>{error}</Text> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	form: {
		paddingBottom: Theme.spacing.sm,
		gap: Theme.spacing.lg,
	},
	section: {
		gap: 8,
	},
	sectionTitle: {
		...Theme.typography.detailBold,
		fontSize: 11,
		letterSpacing: 1,
		textTransform: 'uppercase',
		paddingHorizontal: 4,
	},
	sectionBody: {
		borderWidth: 1,
		borderRadius: 14,
		padding: 12,
	},
	label: {
		...Theme.typography.labelMedium,
		marginBottom: Theme.spacing.xs,
	},
	row: {
		flexDirection: 'row',
		marginTop: Theme.spacing.xs,
	},
	rowStacked: {
		flexDirection: 'column',
	},
	column: {
		flex: 1,
	},
	columnSpaced: {
		marginRight: 10,
	},
	columnStacked: {
		marginRight: 0,
	},
	planSelector: {
		flexDirection: 'row',
		borderRadius: Theme.radius.sm,
		padding: Theme.spacing.xs,
	},
	planOption: {
		flex: 1,
		paddingVertical: Theme.spacing.sm,
		alignItems: 'center',
		borderRadius: Theme.radius.sm,
	},
	planOptionSelected: {
		borderWidth: 1,
	},
	planOptionText: {
		...Theme.typography.label,
	},
	inlineError: {
		...Theme.typography.detail,
		marginTop: Theme.spacing.xs,
	},
	dateFieldRow: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.sm,
	},
	dateFieldColumn: {
		flex: 1,
	},
	dateButton: {
		minHeight: 56,
		borderWidth: 1,
		borderRadius: Theme.radius.md,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
	},
	dateButtonCopy: {
		flex: 1,
		minWidth: 0,
	},
	dateButtonText: {
		...Theme.typography.labelMedium,
	},
	dateButtonMeta: {
		...Theme.typography.detail,
		marginTop: 2,
	},
	calendarPanel: {
		borderWidth: 1,
		borderRadius: 14,
		padding: Theme.spacing.sm,
		marginTop: Theme.spacing.sm,
	},
	calendarHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		marginBottom: Theme.spacing.sm,
	},
	calendarNavButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	calendarTitleWrap: {
		flex: 1,
		alignItems: 'center',
	},
	calendarTitle: {
		...Theme.typography.labelMedium,
		fontSize: 13,
		fontWeight: '800',
	},
	weekdayRow: {
		flexDirection: 'row',
		marginBottom: 2,
	},
	weekdayText: {
		...Theme.typography.detail,
		flex: 1,
		textAlign: 'center',
		fontSize: 9,
	},
	calendarGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		rowGap: 2,
	},
	calendarCell: {
		width: `${100 / 7}%`,
		aspectRatio: 1.26,
		padding: 1.5,
	},
	calendarDay: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 9,
		alignItems: 'center',
		justifyContent: 'center',
	},
	calendarDayText: {
		...Theme.typography.labelMedium,
		fontSize: 12,
	},
	footer: {
		flexDirection: 'row',
		gap: Theme.spacing.md,
		marginTop: Theme.spacing.xl,
	},
	footerStacked: {
		flexDirection: 'column',
	},
	footerButton: {
		flex: 1,
	},
	footerButtonStacked: {
		width: '100%',
	},
	mapHint: {
		...Theme.typography.detail,
		fontStyle: 'italic',
		marginTop: -Theme.spacing.xs,
		marginBottom: Theme.spacing.sm,
	},
});
