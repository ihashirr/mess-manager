import { Info, Save } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

interface CustomerFormModalProps {
	sheetRef: React.RefObject<PremiumBottomSheetHandle | null>;
	onClose: () => void;
	onSubmit: (values: CustomerFormValues) => Promise<void>;
	submitting: boolean;
	customer?: Customer | null;
}

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
	}, [customer]);

	useEffect(() => {
		const nextPrice = formValues.isLunch && formValues.isDinner
			? '650'
			: formValues.isLunch || formValues.isDinner
				? '350'
				: '0';

		setFormValues((current) => (
			current.price === nextPrice
				? current
				: { ...current, price: nextPrice }
		));
	}, [formValues.isDinner, formValues.isLunch]);

	const updateField = <K extends keyof CustomerFormValues,>(
		field: K,
		value: CustomerFormValues[K]
	) => {
		setFormValues((current) => ({ ...current, [field]: value }));
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
		onClose();
	}, [onClose]);

	return (
		<PremiumBottomSheet
			ref={sheetRef}
			title={customer ? "Edit Customer" : "Add Customer"}
			subtitle={customer ? "Update customer details" : "Create a new active member"}
			policy="critical"
			beforeDismiss={handleBeforeDismiss}
			onDismiss={handleDismiss}
		>
			<View style={styles	.form}>
				{/* Section 1: Customer Info */}
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CUSTOMER INFO</Text>
					<View style={[styles.sectionBody, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
						<Text style={[styles.label, { color: colors.textSecondary }]}>Name - نام</Text>
						<Input
							value={formValues.name}
							onChangeText={(value) => updateField('name', value)}
							placeholder="Customer Name"
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
										onPress={() => updateField('isLunch', !formValues.isLunch)}
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
										onPress={() => updateField('isDinner', !formValues.isDinner)}
										disabled={submitting}
									>
										<Text style={[styles.planOptionText, { color: colors.textSecondary }, formValues.isDinner && { color: colors.primary }]}>
											DINNER
										</Text>
									</TouchableOpacity>
								</View>
							</View>
							<View style={styles.column}>
								<Text style={[styles.label, { color: colors.textSecondary }]}>Price - قیمت</Text>
								<Input
									value={formValues.price}
									onChangeText={(value) => updateField('price', value)}
									keyboardType="numeric"
									bottomSheet
								/>
							</View>
						</View>

						<View style={[styles.row, stacked && styles.rowStacked, { marginTop: Theme.spacing.sm }]}>
							<View style={[styles.column, stacked ? styles.columnStacked : styles.columnSpaced]}>
								<Text style={[styles.label, { color: colors.textSecondary }]}>Start Date - آغاز</Text>
								<Input
									value={formValues.startDate}
									onChangeText={(value) => updateField('startDate', value)}
									placeholder="YYYY-MM-DD"
									bottomSheet
								/>
							</View>
							<View style={styles.column}>
								<Text style={[styles.label, { color: colors.textSecondary }]}>End Date - ختم</Text>
								<Input
									value={formValues.endDate}
									onChangeText={(value) => updateField('endDate', value)}
									placeholder="YYYY-MM-DD"
									bottomSheet
								/>
							</View>
						</View>
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

				<View style={styles.formFooter}>
					<Info size={14} color={colors.textMuted} />
					<Text style={[styles.formInfo, { color: colors.textMuted }]}>Save the customer from this dialog</Text>
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
						onPress={() => onSubmit(formValues)}
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
	formFooter: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.xs,
		marginTop: Theme.spacing.xl,
		alignSelf: 'center',
	},
	formInfo: {
		...Theme.typography.detail,
		fontStyle: 'italic',
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
