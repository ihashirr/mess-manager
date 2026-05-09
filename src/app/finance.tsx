import {
	Banknote,
	Camera,
	CloudOff,
	CreditCard,
	ImagePlus,
	ReceiptText,
	RefreshCw,
	Store,
	Trash2,
	TrendingDown,
	TrendingUp,
	Wallet,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useConfirmDialog } from '../components/system/dialogs/ConfirmDialog';
import { showToast } from '../components/system/feedback/AppToast';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { PremiumBottomSheet, type PremiumBottomSheetHandle } from '../components/ui/PremiumBottomSheet';
import { Screen } from '../components/ui/Screen';
import { ScreenHeaderActionButton } from '../components/ui/ScreenHeader';
import { useResponsiveLayout } from '../components/ui/useResponsiveLayout';
import { Theme } from '../constants/Theme';
import { useAppHeader } from '../context/HeaderContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { useAppTheme } from '../context/ThemeModeContext';
import { toDate } from '../utils/customerLogic';
import {
	getReceiptScannerConfigMessage,
	isReceiptScannerConfigured,
	ReceiptScannerConfigError,
	scanReceiptImage,
	type ReceiptExpenseDraft,
	type ReceiptLineItem,
} from '../utils/receiptScanner';
import {
	saveReceiptDraftToQueue,
} from '../utils/receiptQueue';

type Transaction = {
	id: string;
	customerId: string;
	customerName: string;
	amount: number;
	date: unknown;
	method?: string;
	isOrphan?: boolean;
};

type ExpenseEntry = {
	id: string;
	title: string;
	merchantName?: string;
	total: number;
	date: unknown;
	monthTag: string;
	currency?: string;
	source?: string;
	note?: string;
	items?: ReceiptLineItem[];
	confidence?: number;
	paymentMethod?: string;
	receiptDate?: string;
};

export default function FinanceScreen() {
	const { colors } = useAppTheme();
	const { confirm } = useConfirmDialog();
	const { setHeaderConfig } = useAppHeader();
	const {
		ready,
		customers: allCustomers,
		payments: cachedPayments,
		expenses: cachedExpenses,
		queuedReceipts,
		syncBusy,
		runSync,
		refreshOfflineState,
		deletePayment: queueDeletePayment,
		deleteExpense: queueDeleteExpense,
		deleteQueuedReceipt,
	} = useOfflineSync();
	const { contentPadding, maxContentWidth } = useResponsiveLayout();
	const scannerEnabled = isReceiptScannerConfigured();
	const scannerConfigMessage = getReceiptScannerConfigMessage();
	const currentMonthTag = useMemo(() => new Date().toISOString().slice(0, 7), []);
	const [scannerOpen, setScannerOpen] = useState(false);
	const [scannerBusy, setScannerBusy] = useState(false);
	const [savingExpense, setSavingExpense] = useState(false);
	const [scannerError, setScannerError] = useState('');
	const [receiptPreviewUri, setReceiptPreviewUri] = useState<string | null>(null);
	const [receiptDraft, setReceiptDraft] = useState<ReceiptExpenseDraft | null>(null);
	const [showRawText, setShowRawText] = useState(false);
	const scannerSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const financeCustomers = useMemo(
		() => allCustomers.map((customer) => ({
			id: customer.id,
			pricePerMonth: customer.pricePerMonth,
			isActive: customer.isActive,
		})),
		[allCustomers]
	);
	const rawTransactions = useMemo(
		() => cachedPayments.filter((payment) => payment.monthTag === currentMonthTag) as Transaction[],
		[cachedPayments, currentMonthTag]
	);
	const expenses = useMemo(
		() => cachedExpenses.filter((expense) => expense.monthTag === currentMonthTag) as ExpenseEntry[],
		[cachedExpenses, currentMonthTag]
	);

	useEffect(() => {
		if (scannerOpen) {
			scannerSheetRef.current?.present();
		} else {
			scannerSheetRef.current?.dismiss();
		}
	}, [scannerOpen]);

	const handleOpenScanner = useCallback(() => {
		if (!scannerEnabled) {
			showToast({
				type: 'warning',
				title: 'Receipt OCR unavailable',
				message: `${scannerConfigMessage} Rebuild the Android app after adding the native module.`,
			});
			return;
		}

		setScannerOpen(true);
	}, [scannerConfigMessage, scannerEnabled]);

	useFocusEffect(
		useCallback(() => {
			setHeaderConfig({
				title: 'Finance Panel',
				subtitle: `${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} Summary`,
				rightAction: (
					<ScreenHeaderActionButton
						icon={ReceiptText}
						onPress={handleOpenScanner}
						accessibilityLabel="Scan receipt"
						variant={scannerEnabled ? 'primary' : 'default'}
					/>
				),
			});
			void runSync(true);
		}, [handleOpenScanner, runSync, scannerEnabled, setHeaderConfig])
	);

	const transactions = rawTransactions.map((transaction) => ({
		...transaction,
		isOrphan: !financeCustomers.find((customer) => customer.id === transaction.customerId),
	}));

	const visibleQueuedReceipts = queuedReceipts.filter(
		(entry) => entry.monthTag === currentMonthTag && entry.status !== 'synced'
	);

	const revenue = transactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
	const syncedExpenseTotal = expenses.reduce((sum, expense) => sum + (expense.total || 0), 0);
	const queuedExpenseTotal = visibleQueuedReceipts.reduce((sum, expense) => sum + (expense.total || 0), 0);
	const cost = syncedExpenseTotal + queuedExpenseTotal;
	const projected = financeCustomers
		.filter((customer) => customer.isActive)
		.reduce((sum, customer) => sum + (customer.pricePerMonth || 0), 0);
	const net = revenue - cost;
	const draftWarnings = receiptDraft ? getReceiptDraftWarnings(receiptDraft) : [];

	const handleDeleteExpense = async (id: string) => {
		const confirmed = await confirm({
			title: 'Delete expense',
			message: 'Remove this synced expense from Firestore?',
			confirmLabel: 'Delete',
			tone: 'danger',
		});

		if (!confirmed) {
			return;
		}

		try {
			const expense = expenses.find((entry) => entry.id === id);
			await queueDeleteExpense(id, expense?.title || expense?.merchantName);
			showToast({ type: 'success', title: 'Expense queued for deletion' });
		} catch {
			showToast({ type: 'error', title: 'Error', message: 'Could not delete expense.' });
		}
	};

	const handleDeleteTransaction = async (id: string) => {
		const confirmed = await confirm({
			title: 'Delete transaction',
			message: "This removes the payment record only. The customer's end date will stay unchanged.",
			confirmLabel: 'Delete',
			tone: 'danger',
		});

		if (!confirmed) {
			return;
		}

		try {
			const transaction = transactions.find((entry) => entry.id === id);
			await queueDeletePayment(id, transaction?.customerName);
			showToast({ type: 'success', title: 'Transaction queued for deletion' });
		} catch {
			showToast({ type: 'error', title: 'Error', message: 'Could not delete transaction.' });
		}
	};

	const handleDeleteQueuedReceipt = async (localId: string) => {
		const confirmed = await confirm({
			title: 'Remove queued receipt',
			message: 'Delete this local receipt from the offline queue?',
			confirmLabel: 'Remove',
			tone: 'danger',
		});

		if (!confirmed) {
			return;
		}

		try {
			await deleteQueuedReceipt(localId);
			showToast({ type: 'success', title: 'Queued receipt removed' });
		} catch {
			showToast({ type: 'error', title: 'Error', message: 'Could not remove the queued receipt.' });
		}
	};

	const launchReceiptFlow = async (source: 'camera' | 'library') => {
		setScannerError('');
		setReceiptDraft(null);
		setReceiptPreviewUri(null);
		setShowRawText(false);

		try {
			const result =
				source === 'camera'
					? await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false })
					: await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsEditing: false });
			const asset = result.canceled ? null : result.assets?.[0];

			if (!asset?.uri) {
				return;
			}

			setReceiptPreviewUri(asset.uri);
			setScannerBusy(true);

			const draft = await scanReceiptImage({
				imageUri: asset.uri,
				mimeType: asset.mimeType,
			});

			setReceiptDraft(draft);
			setReceiptPreviewUri(draft.imageUri);
			setShowRawText(false);
		} catch (error) {
			if (error instanceof ReceiptScannerConfigError) {
				setScannerError(error.message);
			} else if (error instanceof Error && error.message.trim()) {
				setScannerError(error.message.trim());
			} else {
				setScannerError('Failed to process the receipt image.');
			}
		} finally {
			setScannerBusy(false);
		}
	};

	const saveExpense = async () => {
		if (!receiptDraft) {
			return;
		}

		if (!Number.isFinite(receiptDraft.total) || receiptDraft.total <= 0) {
			setScannerError('The detected total still looks wrong. Fix it before saving.');
			return;
		}

		setSavingExpense(true);
		setScannerError('');

		try {
			const result = await saveReceiptDraftToQueue(receiptDraft);
			await refreshOfflineState();
			closeScanner();

			showToast({
				type: 'success',
				title: result.syncState === 'synced' ? 'Expense saved' : 'Saved to local queue',
				message: result.syncState === 'synced'
					? 'The receipt was stored locally and synced to Firestore.'
					: 'The receipt is stored in SQLite and will sync to Firestore when the connection succeeds.',
			});
		} catch (error) {
			if (error instanceof Error && error.message.trim()) {
				setScannerError(error.message.trim());
			} else {
				setScannerError('Could not save the receipt to the local queue.');
			}
		} finally {
			setSavingExpense(false);
		}
	};

	const closeScanner = () => {
		setScannerOpen(false);
		setScannerError('');
		setReceiptDraft(null);
		setReceiptPreviewUri(null);
		setShowRawText(false);
	};

	const handleBeforeScannerDismiss = useCallback(async () => {
		if (savingExpense) {
			return true;
		}

		if (scannerBusy) {
			showToast({
				type: 'warning',
				title: 'Receipt scan in progress',
				message: 'Wait for the scan to finish before closing this review.',
			});
			return false;
		}

		if (!receiptDraft && !receiptPreviewUri && !scannerError) {
			return true;
		}

		return confirm({
			title: 'Discard receipt review?',
			message: 'The current receipt draft has not been saved to the local queue.',
			confirmLabel: 'Discard',
			cancelLabel: 'Keep reviewing',
			tone: 'warning',
		});
	}, [confirm, receiptDraft, receiptPreviewUri, savingExpense, scannerBusy, scannerError]);

	const updateDraftText = (
		field: 'expenseTitle' | 'merchantName' | 'receiptDate' | 'paymentMethod' | 'note',
		value: string
	) => {
		setReceiptDraft((current) => (current ? { ...current, [field]: value } : current));
	};

	const updateDraftAmount = (field: 'total' | 'subtotal' | 'tax', value: string) => {
		const numeric = parseDraftAmount(value);
		setReceiptDraft((current) => {
			if (!current) {
				return current;
			}

			if (field === 'total') {
				return {
					...current,
					total: numeric ?? 0,
				};
			}

			return {
				...current,
				[field]: numeric,
			};
		});
	};

	if (!ready) {
		return (
			<View style={[styles.centered, { backgroundColor: colors.bg }]}>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		);
	}

	return (
		<Screen scrollable={false} maxContentWidth={maxContentWidth}>
			<ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: contentPadding }]}>
				<View style={styles.metricsGrid}>
					<FinanceMetric icon={Wallet} label="Revenue" value={revenue} projected={projected} color={colors.primary} />
					<FinanceMetric
						icon={TrendingDown}
						label="Expenses"
						value={cost}
						helper={queuedExpenseTotal > 0 ? `${formatAmount(queuedExpenseTotal)} still queued` : undefined}
						color={colors.danger}
					/>
				</View>

				<Card style={[styles.netCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
					<View style={styles.netHeader}>
						<TrendingUp size={18} color={net >= 0 ? colors.success : colors.danger} />
						<Text style={[styles.netLabel, { color: colors.textSecondary }]}>Net Profit</Text>
						{visibleQueuedReceipts.length > 0 ? (
							<Badge label={`${visibleQueuedReceipts.length} pending sync`} variant="warning" />
						) : null}
					</View>
					<Text style={[styles.netValue, { color: net >= 0 ? colors.success : colors.danger }]}>
						{formatAmount(net)}
					</Text>
				</Card>

				{visibleQueuedReceipts.length > 0 ? (
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pending Receipt Queue</Text>
							<Button
								title="Sync Now"
								iconLeft={RefreshCw}
								size="sm"
								variant="secondary"
								loading={syncBusy}
								onPress={() => void runSync(false)}
							/>
						</View>
						<Card style={[styles.infoCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
							<CloudOff size={18} color={colors.warning} />
							<Text style={[styles.infoText, { color: colors.textSecondary }]}>
								Queued receipts are already stored in SQLite. They will sync to Firestore when a write succeeds.
							</Text>
						</Card>
						{visibleQueuedReceipts.map((entry) => (
							<Card key={entry.localId} style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
								<View style={styles.listRow}>
									<View style={styles.iconBox}>
										<ReceiptText size={18} color={colors.warning} />
									</View>
									<View style={styles.cardCopy}>
										<Text style={[styles.primaryText, { color: colors.textPrimary }]} numberOfLines={1}>
											{entry.expenseTitle}
										</Text>
										<Text style={[styles.secondaryText, { color: colors.textMuted }]}>
											{formatReceiptDate(entry.receiptDate)}
										</Text>
									</View>
									<View style={styles.amountBlock}>
										<Text style={[styles.amountText, { color: colors.warning }]}>-{formatAmount(entry.total)}</Text>
										<TouchableOpacity onPress={() => handleDeleteQueuedReceipt(entry.localId)}>
											<Trash2 size={16} color={colors.textMuted} />
										</TouchableOpacity>
									</View>
								</View>
								<View style={styles.badgeRow}>
									<Badge label={entry.status === 'failed' ? 'Sync failed' : 'Queued locally'} variant={entry.status === 'failed' ? 'danger' : 'warning'} />
									<Badge label={getConfidenceLabel(entry.confidence)} variant={getConfidenceVariant(entry.confidence)} />
									{entry.paymentMethod ? <Badge label={entry.paymentMethod} variant="neutral" /> : null}
								</View>
								{entry.syncError ? (
									<Text style={[styles.inlineError, { color: colors.danger }]}>{entry.syncError}</Text>
								) : null}
							</Card>
						))}
					</View>
				) : null}

				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Expense Deductions</Text>
					{expenses.length === 0 ? (
						<View style={styles.emptyCard}>
							<Text style={{ color: colors.textMuted }}>No synced expenses recorded this month</Text>
						</View>
					) : (
						expenses.map((expense) => (
							<Card key={expense.id} style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
								<View style={styles.listRow}>
									<View style={styles.iconBox}>
										<Store size={18} color={colors.danger} />
									</View>
									<View style={styles.cardCopy}>
										<Text style={[styles.primaryText, { color: colors.textPrimary }]} numberOfLines={1}>
											{expense.title || expense.merchantName || 'Untitled Expense'}
										</Text>
										<Text style={[styles.secondaryText, { color: colors.textMuted }]}>
											{expense.receiptDate ? formatReceiptDate(expense.receiptDate) : toDate(expense.date).toLocaleDateString()}
										</Text>
									</View>
									<View style={styles.amountBlock}>
										<Text style={[styles.amountText, { color: colors.danger }]}>-{formatAmount(expense.total)}</Text>
										<TouchableOpacity onPress={() => handleDeleteExpense(expense.id)}>
											<Trash2 size={16} color={colors.textMuted} />
										</TouchableOpacity>
									</View>
								</View>
								<View style={styles.badgeRow}>
									<Badge label="Synced" variant="success" />
									{typeof expense.confidence === 'number' ? (
										<Badge label={getConfidenceLabel(expense.confidence)} variant={getConfidenceVariant(expense.confidence)} />
									) : null}
									{expense.items?.length ? <Badge label={`${expense.items.length} items`} variant="neutral" /> : null}
								</View>
							</Card>
						))
					)}
				</View>

				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Payments</Text>
					{transactions.map((transaction) => (
						<Card
							key={transaction.id}
							style={[
								styles.paymentCard,
								{
									backgroundColor: colors.surface,
									borderColor: colors.border,
									opacity: transaction.isOrphan ? 0.72 : 1,
								},
							]}
						>
							<View style={styles.iconBox}>
								{transaction.method === 'bank' ? (
									<CreditCard size={18} color={colors.primary} />
								) : (
									<Banknote size={18} color={colors.primary} />
								)}
							</View>
							<View style={styles.cardCopy}>
								<Text style={[styles.primaryText, { color: colors.textPrimary }]}>
									{transaction.customerName}
									{transaction.isOrphan ? ' (Deleted Customer)' : ''}
								</Text>
								<Text style={[styles.secondaryText, { color: colors.textMuted }]}>
									{toDate(transaction.date).toLocaleDateString()}
								</Text>
							</View>
							<View style={styles.amountBlock}>
								<Text style={[styles.amountText, { color: colors.primary }]}>{formatAmount(transaction.amount)}</Text>
								<TouchableOpacity onPress={() => handleDeleteTransaction(transaction.id)}>
									<Trash2 size={16} color={colors.textMuted} />
								</TouchableOpacity>
							</View>
						</Card>
					))}
				</View>
			</ScrollView>

			<PremiumBottomSheet
				ref={scannerSheetRef}
				onDismiss={closeScanner}
				title="Receipt Scanner"
				subtitle="Review the draft, save locally, then sync when online"
				policy="critical"
				beforeDismiss={handleBeforeScannerDismiss}
			>
				<View style={styles.sheetContent}>
					<View style={styles.sheetActions}>
						<Button
							title="Camera"
							iconLeft={Camera}
							onPress={() => launchReceiptFlow('camera')}
							style={styles.sheetButton}
							disabled={!scannerEnabled || scannerBusy || savingExpense}
						/>
						<Button
							title="Gallery"
							iconLeft={ImagePlus}
							variant="secondary"
							onPress={() => launchReceiptFlow('library')}
							style={styles.sheetButton}
							disabled={!scannerEnabled || scannerBusy || savingExpense}
						/>
					</View>

					{!receiptDraft ? (
						<Card style={[styles.infoCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
							<Text style={[styles.infoTitle, { color: colors.textPrimary }]}>Local receipt pipeline</Text>
							<Text style={[styles.infoText, { color: colors.textSecondary }]}>
								Scans stay on the device. Save writes the draft to SQLite first, then the queue syncs it to Firestore.
							</Text>
							{!scannerEnabled ? (
								<Text style={[styles.infoWarning, { color: colors.warning }]}>
									{scannerConfigMessage}
								</Text>
							) : null}
						</Card>
					) : null}

					{scannerError ? (
						<Card style={[styles.errorCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.danger }]}>
							<Text style={[styles.errorText, { color: colors.danger }]}>{scannerError}</Text>
						</Card>
					) : null}

					{scannerBusy ? (
						<View style={styles.loadingBlock}>
							<ActivityIndicator size="large" color={colors.primary} />
							<Text style={[styles.loadingCopy, { color: colors.textSecondary }]}>Reading the receipt locally...</Text>
						</View>
					) : null}

					{receiptPreviewUri ? (
						<Card style={[styles.previewShell, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
							<Image source={{ uri: receiptPreviewUri }} style={styles.receiptPreview} />
						</Card>
					) : null}

					{receiptDraft ? (
						<View style={styles.draftPanel}>
							<View style={styles.draftHeader}>
								<View style={styles.cardCopy}>
									<Text style={[styles.draftTitle, { color: colors.textPrimary }]}>
										{receiptDraft.merchantName || 'Detected receipt'}
									</Text>
									<Text style={[styles.secondaryText, { color: colors.textMuted }]}>
										Review before saving.
									</Text>
								</View>
								<Text style={[styles.draftAmount, { color: colors.primary }]}>
									{formatAmount(receiptDraft.total)}
								</Text>
							</View>

							<View style={styles.badgeRow}>
								<Badge label={getConfidenceLabel(receiptDraft.confidence)} variant={getConfidenceVariant(receiptDraft.confidence)} />
								{receiptDraft.paymentMethod ? <Badge label={receiptDraft.paymentMethod} variant="neutral" /> : null}
								<Badge label={`${receiptDraft.items.length} items`} variant="neutral" />
							</View>

							{draftWarnings.length > 0 ? (
								<Card style={[styles.errorCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.warning }]}>
									<Text style={[styles.detailTitle, { color: colors.textPrimary }]}>Needs review</Text>
									{draftWarnings.map((warning) => (
										<Text key={warning} style={[styles.warningText, { color: colors.textSecondary }]}>
											{warning}
										</Text>
									))}
								</Card>
							) : null}

							<Card style={[styles.detailCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
								<Text style={[styles.detailTitle, { color: colors.textPrimary }]}>Detected summary</Text>
								<View style={styles.detailRow}>
									<Text style={[styles.detailLabel, { color: colors.textMuted }]}>Merchant</Text>
									<Text style={[styles.detailSecondary, { color: colors.textSecondary }]}>
										{receiptDraft.merchantName || 'Not detected'}
									</Text>
								</View>
								<View style={styles.detailRow}>
									<Text style={[styles.detailLabel, { color: colors.textMuted }]}>Date</Text>
									<Text style={[styles.detailSecondary, { color: colors.textSecondary }]}>
										{receiptDraft.receiptDate || 'Not detected'}
									</Text>
								</View>
								<View style={styles.detailRow}>
									<Text style={[styles.detailLabel, { color: colors.textMuted }]}>Method</Text>
									<Text style={[styles.detailSecondary, { color: colors.textSecondary }]}>
										{receiptDraft.paymentMethod || 'Not detected'}
									</Text>
								</View>
								{receiptDraft.subtotal !== null ? (
									<View style={styles.detailRow}>
										<Text style={[styles.detailLabel, { color: colors.textMuted }]}>Subtotal</Text>
										<Text style={[styles.detailSecondary, { color: colors.textSecondary }]}>
											{formatAmount(receiptDraft.subtotal)}
										</Text>
									</View>
								) : null}
								{receiptDraft.tax !== null ? (
									<View style={styles.detailRow}>
										<Text style={[styles.detailLabel, { color: colors.textMuted }]}>Tax</Text>
										<Text style={[styles.detailSecondary, { color: colors.textSecondary }]}>
											{formatAmount(receiptDraft.tax)}
										</Text>
									</View>
								) : null}
							</Card>

							<Input
								label="Expense Title"
								value={receiptDraft.expenseTitle}
								onChangeText={(value) => updateDraftText('expenseTitle', value)}
							/>
							<Input
								label="Merchant"
								value={receiptDraft.merchantName}
								onChangeText={(value) => updateDraftText('merchantName', value)}
							/>
							<Input
								label="Total"
								value={stringifyAmount(receiptDraft.total)}
								keyboardType="decimal-pad"
								onChangeText={(value) => updateDraftAmount('total', value)}
							/>
							<Input
								label="Receipt Date"
								value={receiptDraft.receiptDate}
								onChangeText={(value) => updateDraftText('receiptDate', value)}
							/>
							<Input
								label="Payment Method"
								value={receiptDraft.paymentMethod}
								onChangeText={(value) => updateDraftText('paymentMethod', value)}
							/>
							<Input
								label="Note"
								value={receiptDraft.note}
								onChangeText={(value) => updateDraftText('note', value)}
								multiline
							/>

							{receiptDraft.items.length > 0 ? (
								<Card style={[styles.detailCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
									<Text style={[styles.detailTitle, { color: colors.textPrimary }]}>Line items</Text>
									{receiptDraft.items.map((item, index) => (
										<View key={`${item.name}-${index}`} style={styles.detailRow}>
											<Text style={[styles.detailPrimary, { color: colors.textPrimary }]}>{item.name}</Text>
											<Text style={[styles.detailSecondary, { color: colors.textSecondary }]}>
												{item.quantity ? `${item.quantity} x ` : ''}
												{item.amount !== null ? formatAmount(item.amount) : 'No amount'}
											</Text>
										</View>
									))}
								</Card>
							) : null}

							<Card style={[styles.detailCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
								<View style={styles.detailHeaderRow}>
									<Text style={[styles.detailTitle, { color: colors.textPrimary }]}>Raw OCR text</Text>
									<TouchableOpacity onPress={() => setShowRawText((current) => !current)}>
										<Text style={[styles.rawToggleText, { color: colors.primary }]}>
											{showRawText ? 'Hide' : 'Show'}
										</Text>
									</TouchableOpacity>
								</View>
								{showRawText ? (
									<Text style={[styles.rawText, { color: colors.textSecondary }]}>{receiptDraft.rawText}</Text>
								) : (
									<Text style={[styles.secondaryText, { color: colors.textMuted }]}>
										Open this only when the detected fields still look wrong.
									</Text>
								)}
							</Card>

							<Button title="Save Receipt" onPress={saveExpense} loading={savingExpense} fullWidth />
						</View>
					) : null}
				</View>
			</PremiumBottomSheet>
		</Screen>
	);
}

function FinanceMetric({
	icon: Icon,
	label,
	value,
	projected,
	helper,
	color,
}: {
	icon: any;
	label: string;
	value: number;
	projected?: number;
	helper?: string;
	color: string;
}) {
	const { colors } = useAppTheme();

	return (
		<Card style={styles.metricCard}>
			<View style={[styles.metricIcon, { backgroundColor: `${color}15` }]}>
				<Icon size={18} color={color} />
			</View>
			<View style={styles.cardCopy}>
				<Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
				<Text style={[styles.metricValue, { color: colors.textPrimary }]}>{formatAmount(value)}</Text>
				{projected ? <Text style={styles.metricHelper}>of {projected.toLocaleString()}</Text> : null}
				{helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
			</View>
		</Card>
	);
}

function formatAmount(value: number, currency = 'DHS') {
	const normalized = typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
	return `${currency} ${Number.isInteger(normalized) ? normalized : normalized.toFixed(2)}`;
}

function formatReceiptDate(value: string) {
	const parsed = new Date(`${value}T12:00:00`);
	return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function stringifyAmount(value: number | null) {
	return typeof value === 'number' && Number.isFinite(value) ? value.toString() : '';
}

function parseDraftAmount(value: string) {
	const trimmed = value.replace(/[^0-9.-]+/g, '');
	if (!trimmed) {
		return null;
	}

	const numeric = Number.parseFloat(trimmed);
	return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : null;
}

function getConfidenceVariant(confidence: number): BadgeVariant {
	if (confidence >= 0.85) return 'success';
	if (confidence >= 0.68) return 'warning';
	return 'danger';
}

function getConfidenceLabel(confidence: number) {
	if (confidence >= 0.85) return `Confidence High ${(confidence * 100).toFixed(0)}%`;
	if (confidence >= 0.68) return `Confidence Medium ${(confidence * 100).toFixed(0)}%`;
	return `Confidence Low ${(confidence * 100).toFixed(0)}%`;
}

function getReceiptDraftWarnings(draft: ReceiptExpenseDraft) {
	const warnings: string[] = [];

	if (!draft.merchantName || draft.merchantName.length < 3) {
		warnings.push('Merchant name was not extracted cleanly.');
	}

	if (!Number.isFinite(draft.total) || draft.total <= 0) {
		warnings.push('Total is missing or invalid.');
	}

	if (draft.total >= 1000 && draft.items.length > 0) {
		const itemsTotal = draft.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
		if (itemsTotal > 0 && itemsTotal < draft.total * 0.75) {
			warnings.push('The total is much larger than the detected item rows.');
		}
	}

	if (draft.items.length === 0) {
		warnings.push('No line items were detected from the receipt table.');
	}

	if (draft.confidence < 0.68) {
		warnings.push('OCR confidence is low. Check the amount and merchant before saving.');
	}

	return warnings;
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	scrollContent: {
		paddingVertical: Theme.spacing.xl,
		paddingBottom: 120,
	},
	metricsGrid: {
		flexDirection: 'row',
		gap: Theme.spacing.md,
		marginBottom: Theme.spacing.md,
	},
	metricCard: {
		flex: 1,
		padding: Theme.spacing.lg,
		flexDirection: 'row',
		gap: Theme.spacing.md,
		alignItems: 'center',
	},
	metricIcon: {
		width: 40,
		height: 40,
		borderRadius: Theme.radius.md,
		alignItems: 'center',
		justifyContent: 'center',
	},
	metricLabel: {
		fontSize: 10,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	metricValue: {
		fontSize: 18,
		fontWeight: '900',
	},
	metricHelper: {
		fontSize: 10,
		fontWeight: '600',
		opacity: 0.6,
		marginTop: 2,
	},
	netCard: {
		padding: Theme.spacing.xl,
		borderWidth: 1,
		marginBottom: Theme.spacing.xl,
	},
	netHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		flexWrap: 'wrap',
		marginBottom: Theme.spacing.sm,
	},
	netLabel: {
		fontWeight: '700',
		fontSize: 13,
		textTransform: 'uppercase',
	},
	netValue: {
		fontSize: 32,
		fontWeight: '900',
	},
	section: {
		marginBottom: Theme.spacing.xl,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
		marginBottom: Theme.spacing.md,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '800',
		marginBottom: Theme.spacing.md,
	},
	infoCard: {
		padding: Theme.spacing.lg,
		borderWidth: 1,
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: Theme.spacing.sm,
		marginBottom: Theme.spacing.md,
	},
	infoTitle: {
		fontSize: 14,
		fontWeight: '800',
	},
	infoText: {
		flex: 1,
		fontSize: 12,
		fontWeight: '600',
		lineHeight: 18,
	},
	infoWarning: {
		fontSize: 12,
		fontWeight: '700',
		lineHeight: 18,
		marginTop: Theme.spacing.sm,
	},
	listCard: {
		padding: Theme.spacing.md,
		borderWidth: 1,
		marginBottom: Theme.spacing.md,
	},
	paymentCard: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: Theme.spacing.md,
		gap: Theme.spacing.md,
		borderWidth: 1,
		marginBottom: Theme.spacing.sm,
	},
	listRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.md,
	},
	iconBox: {
		width: 38,
		height: 38,
		borderRadius: Theme.radius.md,
		backgroundColor: '#F3F1EE',
		alignItems: 'center',
		justifyContent: 'center',
	},
	cardCopy: {
		flex: 1,
	},
	primaryText: {
		fontWeight: '700',
		fontSize: 14,
	},
	secondaryText: {
		fontSize: 11,
	},
	amountBlock: {
		alignItems: 'flex-end',
		gap: 4,
	},
	amountText: {
		fontWeight: '800',
		fontSize: 14,
	},
	badgeRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.md,
	},
	inlineError: {
		fontSize: 12,
		fontWeight: '600',
		marginTop: Theme.spacing.sm,
	},
	emptyCard: {
		padding: Theme.spacing.xl,
		alignItems: 'center',
		opacity: 0.65,
	},
	sheetContent: {
		gap: Theme.spacing.md,
	},
	sheetActions: {
		flexDirection: 'row',
		gap: Theme.spacing.md,
	},
	sheetButton: {
		flex: 1,
	},
	errorCard: {
		padding: Theme.spacing.md,
		borderWidth: 1,
	},
	errorText: {
		fontSize: 12,
		fontWeight: '700',
		lineHeight: 18,
	},
	loadingBlock: {
		paddingVertical: Theme.spacing.xl,
		alignItems: 'center',
		gap: Theme.spacing.sm,
	},
	loadingCopy: {
		fontSize: 12,
		fontWeight: '600',
	},
	previewShell: {
		padding: Theme.spacing.md,
		borderWidth: 1,
	},
	receiptPreview: {
		width: '100%',
		height: 320,
		borderRadius: Theme.radius.lg,
		resizeMode: 'contain',
	},
	draftPanel: {
		gap: Theme.spacing.md,
	},
	draftHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	draftTitle: {
		fontSize: 18,
		fontWeight: '800',
	},
	draftAmount: {
		fontSize: 24,
		fontWeight: '900',
	},
	detailCard: {
		padding: Theme.spacing.lg,
		borderWidth: 1,
		gap: Theme.spacing.sm,
	},
	detailTitle: {
		fontSize: 13,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	detailHeaderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	detailRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	detailLabel: {
		fontSize: 11,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	detailPrimary: {
		flex: 1,
		fontSize: 13,
		fontWeight: '700',
	},
	detailSecondary: {
		fontSize: 12,
		fontWeight: '600',
	},
	rawText: {
		fontSize: 12,
		fontWeight: '600',
		lineHeight: 18,
	},
	rawToggleText: {
		fontSize: 12,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	warningText: {
		fontSize: 12,
		fontWeight: '600',
		lineHeight: 18,
	},
});
