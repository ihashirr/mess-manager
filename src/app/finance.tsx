import {
	Banknote,
	Camera,
	CloudOff,
	CreditCard,
	Edit2,
	FilePlus,
	ImagePlus,
	Minus,
	Plus,
	ReceiptText,
	RefreshCw,
	ShoppingBag,
	Store,
	Trash2,
	TrendingDown,
	TrendingUp,
	Wallet,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AnimatedReanimated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useConfirmDialog } from '../components/system/dialogs/ConfirmDialog';
import { showToast } from '../components/system/feedback/AppToast';
import {
	Badge,
	Button,
	Card,
	Input,
	FullScreenModal,
	Screen,
	ScreenHeaderActionButton,
	type BadgeVariant,
	type FullScreenModalHandle,
} from '../components/ui';
import { PaymentsCollectView } from './payments';
import { Theme } from '../constants/Theme';
import { useAppHeader } from '../context/HeaderContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { usePagerFocusEffect } from '../context/PagerFocusContext';
import { useAppTheme } from '../context/ThemeModeContext';
import { useResponsiveLayout } from '../hooks';
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
import type { ExpenseEntry } from '../types';

type MoneySection = 'collect' | 'expenses';

type Transaction = {
	id: string;
	customerId: string;
	customerName: string;
	amount: number;
	date: unknown;
	method?: string;
	isOrphan?: boolean;
};

export default function FinanceScreen() {
	const { colors } = useAppTheme();
	const { setHeaderConfig } = useAppHeader();
	const [activeSection, setActiveSection] = useState<MoneySection>('collect');
	const [expenseActions, setExpenseActions] = useState<ReactNode>(null);
	const isCollect = activeSection === 'collect';

	usePagerFocusEffect(
		'finance',
		useCallback(() => {
			setHeaderConfig({
				title: 'Money',
				subtitle: isCollect
					? 'Collect customer payments'
					: 'Expenses, receipts, and monthly records',
				rightAction: isCollect ? undefined : expenseActions,
			});
		}, [expenseActions, isCollect, setHeaderConfig])
	);

	return (
		<View style={[styles.moneyShell, { backgroundColor: colors.bg }]}>
			<MoneySegmentControl value={activeSection} onChange={setActiveSection} />
			<AnimatedReanimated.View
				key={activeSection}
				entering={FadeIn.duration(130)}
				exiting={FadeOut.duration(90)}
				style={styles.moneyPane}
			>
				{isCollect ? (
					<PaymentsCollectView />
				) : (
					<FinanceExpensesView active onActionsChange={setExpenseActions} />
				)}
			</AnimatedReanimated.View>
		</View>
	);
}

function MoneySegmentControl({
	value,
	onChange,
}: {
	value: MoneySection;
	onChange: (next: MoneySection) => void;
}) {
	const { colors, isDark } = useAppTheme();
	const options: { value: MoneySection; label: string; caption: string; icon: typeof Wallet }[] = [
		{ value: 'collect', label: 'Collect', caption: 'Who owes now', icon: Wallet },
		{ value: 'expenses', label: 'Expenses', caption: 'Money out + receipts', icon: TrendingDown },
	];

	return (
		<View style={[styles.moneySegmentWrap, { backgroundColor: colors.bg }]}>
			<View style={[styles.moneySegmentBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
				{options.map((option) => {
					const active = value === option.value;
					const SegmentIcon = option.icon;

					return (
						<TouchableOpacity
							key={option.value}
							activeOpacity={0.82}
							onPress={() => onChange(option.value)}
							style={[
								styles.moneySegment,
								active && {
									backgroundColor: option.value === 'collect'
										? isDark ? 'rgba(46, 204, 113, 0.18)' : 'rgba(46, 204, 113, 0.12)'
										: isDark ? 'rgba(231, 76, 60, 0.17)' : 'rgba(231, 76, 60, 0.10)',
									borderColor: colors.primary + '33',
								},
							]}
						>
							<View style={styles.moneySegmentTopRow}>
								<View
									style={[
										styles.moneySegmentIcon,
										{
											backgroundColor: active
												? option.value === 'collect' ? colors.success + '18' : colors.danger + '14'
												: colors.surface,
											borderColor: active
												? option.value === 'collect' ? colors.success + '35' : colors.danger + '28'
												: colors.border,
										},
									]}
								>
									<SegmentIcon
										size={15}
										color={active ? option.value === 'collect' ? colors.success : colors.danger : colors.textMuted}
										strokeWidth={2.4}
									/>
								</View>
								<Text style={[styles.moneySegmentLabel, { color: active ? colors.textPrimary : colors.textSecondary }]}>
									{option.label}
								</Text>
							</View>
							<Text style={[styles.moneySegmentCaption, { color: active ? colors.textSecondary : colors.textMuted }]}>
								{option.caption}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>
		</View>
	);
}

function FinanceExpensesView({
	active,
	onActionsChange,
}: {
	active: boolean;
	onActionsChange: (actions: ReactNode) => void;
}) {
	const { colors } = useAppTheme();
	const { confirm } = useConfirmDialog();
	const {
		ready,
		customers: allCustomers,
		payments: cachedPayments,
		expenses: cachedExpenses,
		orders: cachedOrders,
		queuedReceipts,
		syncBusy,
		runSync,
		refreshOfflineState,
		deletePayment: queueDeletePayment,
		deleteExpense: queueDeleteExpense,
		updateExpense,
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
	const [selectedExpense, setSelectedExpense] = useState<ExpenseEntry | null>(null);
	const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
	const scannerSheetRef = useRef<FullScreenModalHandle>(null);
	const expenseSheetRef = useRef<FullScreenModalHandle>(null);
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
	const monthOrders = useMemo(
		() => cachedOrders.filter((order) => order.monthTag === currentMonthTag && order.fulfillmentStatus !== 'cancelled'),
		[cachedOrders, currentMonthTag]
	);
	const paidMonthOrders = useMemo(
		() => monthOrders.filter((order) => (order.paidAmount || 0) > 0),
		[monthOrders]
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

	const handleOpenManualEntry = useCallback(() => {
		setEditingExpenseId(null);
		setScannerError('');
		setReceiptPreviewUri(null);
		setShowRawText(false);
		setReceiptDraft({
			merchantName: '',
			expenseTitle: 'Manual Expense',
			total: 0,
			subtotal: null,
			tax: null,
			currency: 'DHS',
			receiptDate: new Date().toISOString().slice(0, 10),
			paymentMethod: 'Cash',
			items: [],
			note: '',
			confidence: 1,
			rawText: '',
			imageUri: '',
		});
		setScannerOpen(true);
	}, []);

	const handleEditExpense = useCallback((expense: ExpenseEntry) => {
		setEditingExpenseId(expense.id);
		setScannerError('');
		setReceiptPreviewUri(expense.imageUri || null);
		setShowRawText(false);
		setReceiptDraft({
			merchantName: expense.merchantName || '',
			expenseTitle: expense.title || '',
			total: expense.total || 0,
			subtotal: null,
			tax: null,
			currency: expense.currency || 'DHS',
			receiptDate: expense.receiptDate || (expense.date ? new Date(expense.date as string).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
			paymentMethod: expense.paymentMethod || '',
			items: expense.items ? [...expense.items] : [],
			note: expense.note || '',
			confidence: expense.confidence ?? 1,
			rawText: expense.rawText || '',
			imageUri: expense.imageUri || '',
		});
		expenseSheetRef.current?.dismiss();
		setTimeout(() => setScannerOpen(true), 350);
	}, []);

	useEffect(() => {
		if (!active) {
			onActionsChange(null);
			return;
		}

		onActionsChange(
			<View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
				<ScreenHeaderActionButton
					icon={FilePlus}
					onPress={handleOpenManualEntry}
					accessibilityLabel="Manual entry"
					variant="default"
				/>
				<ScreenHeaderActionButton
					icon={ReceiptText}
					onPress={handleOpenScanner}
					accessibilityLabel="Scan receipt"
					variant={scannerEnabled ? 'primary' : 'default'}
				/>
			</View>
		);
	}, [active, handleOpenManualEntry, handleOpenScanner, onActionsChange, scannerEnabled]);

	usePagerFocusEffect(
		'finance',
		useCallback(() => {
			if (!active) {
				return;
			}

			void runSync(true);
		}, [active, runSync])
	);

	const transactions = rawTransactions.map((transaction) => ({
		...transaction,
		isOrphan: !financeCustomers.find((customer) => customer.id === transaction.customerId),
	}));

	const visibleQueuedReceipts = queuedReceipts.filter(
		(entry) => entry.monthTag === currentMonthTag && entry.status !== 'synced'
	);

	const subscriptionRevenue = transactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
	const orderRevenue = monthOrders.reduce((sum, order) => sum + (order.paidAmount || 0), 0);
	const revenue = subscriptionRevenue + orderRevenue;
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
		setEditingExpenseId(null);
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
			if (editingExpenseId) {
				await updateExpense({
					id: editingExpenseId,
					title: receiptDraft.expenseTitle,
					merchantName: receiptDraft.merchantName,
					total: receiptDraft.total,
					date: receiptDraft.receiptDate,
					monthTag: currentMonthTag,
					currency: receiptDraft.currency,
					source: receiptDraft.rawText ? 'ocr' : 'manual',
					note: receiptDraft.note,
					items: receiptDraft.items,
					confidence: receiptDraft.confidence,
					paymentMethod: receiptDraft.paymentMethod,
					receiptDate: receiptDraft.receiptDate,
					rawText: receiptDraft.rawText,
					imageUri: receiptDraft.imageUri,
				});
				closeScanner();
				showToast({
					type: 'success',
					title: 'Expense updated',
					message: 'The modifications have been queued for sync.',
				});
			} else {
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
			}
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

	const addDraftItem = () => {
		setReceiptDraft((current) => current ? {
			...current,
			items: [...current.items, { name: '', amount: 0, quantity: null }]
		} : current);
	};

	const updateDraftItem = (index: number, field: keyof ReceiptLineItem, value: any) => {
		setReceiptDraft((current) => {
			if (!current) return current;
			const newItems = [...current.items];
			newItems[index] = { ...newItems[index], [field]: value };
			return { ...current, items: newItems };
		});
	};

	const removeDraftItem = (index: number) => {
		setReceiptDraft((current) => {
			if (!current) return current;
			const newItems = [...current.items];
			newItems.splice(index, 1);
			return { ...current, items: newItems };
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
		<Screen
			scrollable={false}
			maxContentWidth={maxContentWidth}
			atmosphere={{
				ambientEnergy: 'ember',
				intensity: 'subtle',
				warmLighting: true,
			}}
		>
			<ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: contentPadding }]}>
				<AnimatedReanimated.View entering={FadeInUp.duration(170).delay(20)}>
				<Card style={[styles.expenseIntroCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.danger + '24' }]}>
					<View pointerEvents="none" style={[styles.expenseIntroAccent, { backgroundColor: colors.danger }]} />
					<View style={styles.expenseIntroCopy}>
						<Text style={[styles.expenseIntroEyebrow, { color: colors.textMuted }]}>Expenses</Text>
						<Text style={[styles.expenseIntroTitle, { color: colors.textPrimary }]}>
							Control money going out
						</Text>
						<Text style={[styles.expenseIntroSubtitle, { color: colors.textSecondary }]}>
							Log kitchen purchases, delivery costs, and receipt scans before they blur into memory.
						</Text>
					</View>
					<View style={styles.expenseIntroActions}>
						<Button
							title="Manual"
							iconLeft={FilePlus}
							size="sm"
							variant="secondary"
							onPress={handleOpenManualEntry}
							style={styles.expenseIntroButton}
						/>
						<Button
							title="Scan"
							iconLeft={ReceiptText}
							size="sm"
							onPress={handleOpenScanner}
							style={styles.expenseIntroButton}
						/>
					</View>
				</Card>
				</AnimatedReanimated.View>

				<View style={styles.metricsGrid}>
					<FinanceMetric
						icon={Wallet}
						label="Revenue"
						value={revenue}
						projected={projected}
						helper={orderRevenue > 0 ? `${formatAmount(orderRevenue)} from one-time orders` : undefined}
						color={colors.primary}
					/>
					<FinanceMetric
						icon={TrendingDown}
						label="Expenses"
						value={cost}
						helper={queuedExpenseTotal > 0 ? `${formatAmount(queuedExpenseTotal)} still queued` : undefined}
						color={colors.danger}
					/>
				</View>

				<Card style={[styles.netCard, { backgroundColor: net >= 0 ? colors.success + '0F' : colors.danger + '0E', borderColor: net >= 0 ? colors.success + '24' : colors.danger + '24' }]}>
					<View style={styles.netHeader}>
						<TrendingUp size={18} color={net >= 0 ? colors.success : colors.danger} />
						<View style={styles.netCopy}>
							<Text style={[styles.netLabel, { color: colors.textSecondary }]}>Net position</Text>
							<Text style={[styles.netHelper, { color: colors.textMuted }]}>Revenue minus recorded expenses</Text>
						</View>
						{visibleQueuedReceipts.length > 0 ? (
							<Badge label={`${visibleQueuedReceipts.length} pending sync`} variant="warning" />
						) : null}
					</View>
					<Text style={[styles.netValue, { color: net >= 0 ? colors.success : colors.danger }]}>
						{formatAmount(net)}
					</Text>
				</Card>

				<View style={styles.section}>
					<View style={styles.sectionCopy}>
						<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>One-time order income</Text>
						<Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
							Extra orders collected this month, separate from monthly subscriptions.
						</Text>
					</View>
					{paidMonthOrders.length === 0 ? (
						<View style={styles.emptyCard}>
							<Text style={{ color: colors.textMuted }}>No one-time order income this month</Text>
						</View>
					) : (
						paidMonthOrders.slice(0, 5).map((order) => (
							<Card key={order.id} style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
								<View style={styles.iconBox}>
									<ShoppingBag size={18} color={colors.success} />
								</View>
								<View style={styles.cardCopy}>
									<Text style={[styles.primaryText, { color: colors.textPrimary }]} numberOfLines={1}>
										{order.customerName}
									</Text>
									<Text style={[styles.secondaryText, { color: colors.textMuted }]}>
										{formatReceiptDate(order.orderDate)} • {order.fulfillmentStatus}
									</Text>
								</View>
								<View style={styles.amountBlock}>
									<Text style={[styles.amountText, { color: colors.success }]}>{formatAmount(order.paidAmount || 0)}</Text>
									<Badge
										label={order.paymentStatus}
										variant={order.paymentStatus === 'paid' ? 'success' : order.paymentStatus === 'partial' ? 'warning' : 'danger'}
									/>
								</View>
							</Card>
						))
					)}
				</View>

				{visibleQueuedReceipts.length > 0 ? (
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<View style={styles.sectionCopy}>
								<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pending receipt queue</Text>
								<Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Saved locally until Firestore confirms the upload.</Text>
							</View>
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
					<View style={styles.sectionCopy}>
						<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Expense records</Text>
						<Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Synced purchases and costs deducted from this month.</Text>
					</View>
					{expenses.length === 0 ? (
						<View style={styles.emptyCard}>
							<Text style={{ color: colors.textMuted }}>No synced expenses recorded this month</Text>
						</View>
					) : (
						expenses.map((expense) => (
							<TouchableOpacity 
								key={expense.id} 
								activeOpacity={0.7}
								onPress={() => {
									setSelectedExpense(expense);
									expenseSheetRef.current?.present();
								}}
							>
								<Card style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
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
											<TouchableOpacity onPress={() => handleDeleteExpense(expense.id)} style={{ padding: 4 }}>
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
							</TouchableOpacity>
						))
					)}
				</View>

				<View style={styles.section}>
					<View style={styles.sectionCopy}>
						<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Collection records</Text>
						<Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Payments already collected this month for comparison.</Text>
					</View>
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

			<FullScreenModal
				ref={scannerSheetRef}
				onDismiss={closeScanner}
				title="Receipt Scanner"
				subtitle="Review the draft, save locally, then sync when online"
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
								<Text style={[styles.detailTitle, { color: colors.textPrimary }]}>
									{receiptDraft.rawText ? 'Detected summary' : 'Manual summary'}
								</Text>
								<View style={styles.detailRow}>
									<Text style={[styles.detailLabel, { color: colors.textMuted }]}>Merchant</Text>
									<Text style={[styles.detailSecondary, { color: colors.textSecondary }]}>
										{receiptDraft.merchantName || 'Not specified'}
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

							<Card style={[styles.detailCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
								<Text style={[styles.detailTitle, { color: colors.textPrimary }]}>Line items</Text>
								{receiptDraft.items.map((item, index) => (
									<View key={index} style={[styles.itemEditorRow, { borderBottomColor: colors.border }]}>
										<View style={styles.itemEditorInputs}>
											<Input
												label="Item Name"
												value={item.name}
												onChangeText={(val) => updateDraftItem(index, 'name', val)}
											/>
											<View style={{ flexDirection: 'row', gap: Theme.spacing.sm }}>
												<View style={{ flex: 1 }}>
													<Input
														label="Qty"
														value={stringifyAmount(item.quantity)}
														keyboardType="decimal-pad"
														onChangeText={(val) => updateDraftItem(index, 'quantity', parseDraftAmount(val))}
													/>
												</View>
												<View style={{ flex: 2 }}>
													<Input
														label="Price"
														value={stringifyAmount(item.amount)}
														keyboardType="decimal-pad"
														onChangeText={(val) => updateDraftItem(index, 'amount', parseDraftAmount(val))}
													/>
												</View>
											</View>
										</View>
										<TouchableOpacity onPress={() => removeDraftItem(index)} style={styles.itemDeleteBtn}>
											<Minus size={16} color={colors.danger} />
										</TouchableOpacity>
									</View>
								))}
								<Button
									title="Add Line Item"
									iconLeft={Plus}
									variant="secondary"
									onPress={addDraftItem}
									style={{ marginTop: Theme.spacing.sm }}
								/>
							</Card>

							{receiptDraft.rawText ? (
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
							) : null}

							<Button title={editingExpenseId ? "Update Expense" : "Save Receipt"} onPress={saveExpense} loading={savingExpense} fullWidth />
						</View>
					) : null}
				</View>
			</FullScreenModal>

			<FullScreenModal
				ref={expenseSheetRef}
				onDismiss={() => setSelectedExpense(null)}
				title="Expense Details"
				subtitle="Receipt contents and metadata"
			>
				{selectedExpense ? (
					<View style={styles.sheetContent}>
						<View style={styles.draftPanel}>
							<View style={styles.draftHeader}>
								<View style={styles.cardCopy}>
									<Text style={[styles.draftTitle, { color: colors.textPrimary }]}>
										{selectedExpense.merchantName || selectedExpense.title || 'Unknown Merchant'}
									</Text>
									<Text style={[styles.secondaryText, { color: colors.textMuted }]}>
										{selectedExpense.receiptDate ? formatReceiptDate(selectedExpense.receiptDate) : toDate(selectedExpense.date).toLocaleDateString()}
									</Text>
								</View>
								<Text style={[styles.draftAmount, { color: colors.danger }]}>
									{formatAmount(selectedExpense.total)}
								</Text>
							</View>

							<View style={styles.badgeRow}>
								{typeof selectedExpense.confidence === 'number' ? (
									<Badge label={getConfidenceLabel(selectedExpense.confidence)} variant={getConfidenceVariant(selectedExpense.confidence)} />
								) : null}
								{selectedExpense.paymentMethod ? <Badge label={selectedExpense.paymentMethod} variant="neutral" /> : null}
							</View>

							{selectedExpense.items && selectedExpense.items.length > 0 ? (
								<Card style={[styles.detailCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
									<Text style={[styles.detailTitle, { color: colors.textPrimary }]}>Scanned Items</Text>
									{selectedExpense.items.map((item, index) => (
										<View key={`${item.name}-${index}`} style={styles.detailRow}>
											<Text style={[styles.detailPrimary, { color: colors.textPrimary }]}>{item.name}</Text>
											<Text style={[styles.detailSecondary, { color: colors.textSecondary }]}>
												{item.quantity ? `${item.quantity} x ` : ''}
												{item.amount !== null ? formatAmount(item.amount) : 'No amount'}
											</Text>
										</View>
									))}
								</Card>
							) : (
								<Card style={[styles.infoCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
									<Text style={[styles.infoText, { color: colors.textSecondary }]}>
										No detailed line items were extracted for this receipt.
									</Text>
								</Card>
							)}
							
							{selectedExpense.note ? (
								<Card style={[styles.detailCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
									<Text style={[styles.detailTitle, { color: colors.textPrimary }]}>Note</Text>
									<Text style={[styles.detailSecondary, { color: colors.textSecondary }]}>{selectedExpense.note}</Text>
								</Card>
							) : null}

							<View style={{ flexDirection: 'row', gap: Theme.spacing.md, marginTop: Theme.spacing.sm }}>
								<View style={{ flex: 1 }}>
									<Button 
										title="Edit Expense" 
										iconLeft={Edit2}
										variant="primary" 
										onPress={() => handleEditExpense(selectedExpense)} 
										fullWidth 
									/>
								</View>
								<View style={{ flex: 1 }}>
									<Button 
										title="Close" 
										variant="secondary" 
										onPress={() => expenseSheetRef.current?.dismiss()} 
										fullWidth 
									/>
								</View>
							</View>
						</View>
					</View>
				) : null}
			</FullScreenModal>
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
	moneyShell: {
		flex: 1,
	},
	moneyPane: {
		flex: 1,
	},
	moneySegmentWrap: {
		paddingHorizontal: Theme.spacing.screen,
		paddingTop: Theme.spacing.sm,
		paddingBottom: Theme.spacing.sm,
	},
	moneySegmentBar: {
		flexDirection: 'row',
		gap: Theme.spacing.xs,
		borderWidth: 1,
		borderRadius: 26,
		padding: 5,
		maxWidth: 720,
		width: '100%',
		alignSelf: 'center',
	},
	moneySegment: {
		flex: 1,
		borderWidth: 1,
		borderColor: 'transparent',
		borderRadius: 21,
		paddingVertical: 11,
		paddingHorizontal: Theme.spacing.md,
	},
	moneySegmentTopRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: Theme.spacing.sm,
	},
	moneySegmentIcon: {
		width: 27,
		height: 27,
		borderRadius: 10,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	moneySegmentLabel: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
		textAlign: 'center',
	},
	moneySegmentCaption: {
		...Theme.typography.detail,
		fontSize: 11,
		textAlign: 'center',
		marginTop: 2,
	},
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	scrollContent: {
		paddingVertical: Theme.spacing.xl,
		paddingBottom: 120,
	},
	expenseIntroCard: {
		borderWidth: 1,
		borderRadius: 24,
		padding: Theme.spacing.lg,
		marginBottom: Theme.spacing.md,
		gap: Theme.spacing.md,
		overflow: 'hidden',
	},
	expenseIntroAccent: {
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 0,
		width: 5,
	},
	expenseIntroCopy: {
		gap: 5,
	},
	expenseIntroEyebrow: {
		...Theme.typography.detailBold,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	expenseIntroTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
	},
	expenseIntroSubtitle: {
		...Theme.typography.detail,
		fontSize: 13,
		lineHeight: 19,
	},
	expenseIntroActions: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
	},
	expenseIntroButton: {
		flex: 1,
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
		alignItems: 'flex-start',
		gap: Theme.spacing.sm,
		flexWrap: 'wrap',
		marginBottom: Theme.spacing.sm,
	},
	netCopy: {
		flex: 1,
		minWidth: 0,
	},
	netLabel: {
		fontWeight: '700',
		fontSize: 13,
		textTransform: 'uppercase',
	},
	netHelper: {
		fontSize: 11,
		fontWeight: '600',
		marginTop: 3,
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
	sectionCopy: {
		gap: 4,
		marginBottom: Theme.spacing.md,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '800',
	},
	sectionSubtitle: {
		fontSize: 12,
		fontWeight: '600',
		lineHeight: 17,
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
	itemEditorRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: Theme.spacing.sm,
		paddingBottom: Theme.spacing.md,
		borderBottomWidth: 1,
	},
	itemEditorInputs: {
		flex: 1,
		gap: Theme.spacing.sm,
	},
	itemDeleteBtn: {
		width: 36,
		height: 36,
		borderRadius: Theme.radius.full,
		alignItems: 'center',
		justifyContent: 'center',
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
