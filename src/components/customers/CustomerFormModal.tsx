import { Info, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type PremiumBottomSheetHandle } from '../ui/PremiumBottomSheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { PremiumBottomSheet } from '../ui/PremiumBottomSheet';
import { createInitialCustomerFormValues, type CustomerFormValues } from './types';

interface CustomerFormModalProps {
	sheetRef: React.RefObject<PremiumBottomSheetHandle | null>;
	onClose: () => void;
	onSubmit: (values: CustomerFormValues) => Promise<void>;
	submitting: boolean;
}

export function CustomerFormModal({
	sheetRef,
	onClose,
	onSubmit,
	submitting,
}: CustomerFormModalProps) {
	const { stacked } = useResponsiveLayout();
	const { colors } = useAppTheme();
	const [formValues, setFormValues] = useState<CustomerFormValues>(createInitialCustomerFormValues());

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

	return (
		<PremiumBottomSheet
			ref={sheetRef}
			title="Add Customer"
			subtitle="Create a new active member"
			onDismiss={onClose}
		>
			<View style={styles.form}>
				<Text style={[styles.label, { color: colors.textSecondary }]}>Name - نام</Text>
				<Input
					value={formValues.name}
					onChangeText={(value) => updateField('name', value)}
					placeholder="Customer Name"
					bottomSheet
				/>

				<Text style={[styles.label, { color: colors.textSecondary }]}>Phone - فون نمبر</Text>
				<Input
					value={formValues.phone}
					onChangeText={(value) => updateField('phone', value)}
					placeholder="0300-1234567"
					keyboardType="phone-pad"
					bottomSheet
				/>

				<View style={[styles.row, stacked && styles.rowStacked]}>
					<View style={[styles.column, stacked ? styles.columnStacked : styles.columnSpaced]}>
						<Text style={[styles.label, { color: colors.textSecondary }]}>Location - مقام</Text>
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

				<Text style={[styles.label, { color: colors.textSecondary }]}>Map Link - نقشہ لنک</Text>
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

				<View style={[styles.row, stacked && styles.rowStacked]}>
					<View style={[styles.column, stacked ? styles.columnStacked : styles.columnSpaced]}>
						<Text style={[styles.label, { color: colors.textSecondary }]}>Meals - کھانا</Text>
						<View style={[styles.planSelector, { backgroundColor: colors.surfaceElevated }]}>
							<TouchableOpacity
								style={[
									styles.planOption,
									formValues.isLunch && [styles.planOptionSelected, { backgroundColor: colors.surface, borderColor: colors.border }],
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
									formValues.isDinner && [styles.planOptionSelected, { backgroundColor: colors.surface, borderColor: colors.border }],
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

				<View style={[styles.row, stacked && styles.rowStacked]}>
					<View style={[styles.column, stacked ? styles.columnStacked : styles.columnSpaced]}>
						<Text style={[styles.label, { color: colors.textSecondary }]}>Start - تاریخ آغاز</Text>
						<Input
							value={formValues.startDate}
							onChangeText={(value) => updateField('startDate', value)}
							placeholder="YYYY-MM-DD"
							bottomSheet
						/>
					</View>
					<View style={styles.column}>
						<Text style={[styles.label, { color: colors.textSecondary }]}>End - تاریخ ختم</Text>
						<Input
							value={formValues.endDate}
							onChangeText={(value) => updateField('endDate', value)}
							placeholder="YYYY-MM-DD"
							bottomSheet
						/>
					</View>
				</View>

				<Text style={[styles.label, { color: colors.textSecondary }]}>Notes - نوٹ</Text>
				<Input
					value={formValues.notes}
					onChangeText={(value) => updateField('notes', value)}
					placeholder="Any specific instructions..."
					bottomSheet
				/>

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
	},
	label: {
		...Theme.typography.labelMedium,
		marginBottom: Theme.spacing.xs,
		marginTop: Theme.spacing.sm,
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
