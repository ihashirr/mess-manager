import {
	collection,
	deleteDoc,
	doc,
	onSnapshot,
	query,
	setDoc,
	where,
	writeBatch,
} from 'firebase/firestore';
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import type { Customer } from '../components/customers/types';
import { db } from '../config';
import {
	deleteQueuedReceiptExpense,
	loadQueuedReceiptExpenses,
	syncQueuedReceiptExpenses,
} from '../utils/receiptQueue';
import type { QueuedReceiptExpense } from '../utils/receiptTypes';
import { toDate } from '../utils/customerLogic';
import type { DayMenu } from '../utils/menuLogic';
import { getDatesForWeek, getWeekId } from '../utils/weekLogic';
import {
	applyLocalCustomerPatch,
	completeSyncOperation,
	enqueueSyncOperation,
	failSyncOperation,
	initializeOfflineDatabase,
	listSyncOperations,
	loadOfflineSnapshot,
	markCustomerDeleted,
	markExpenseDeleted,
	markPaymentDeleted,
	saveLocalAttendanceBatch,
	saveLocalCustomer,
	saveLocalMenu,
	saveLocalPayment,
	syncRemoteAttendanceDate,
	syncRemoteCustomers,
	syncRemoteExpenses,
	syncRemoteMenu,
	syncRemotePayments,
} from '../offline/localStore';
import type {
	AttendanceEntry,
	ExpenseEntry,
	PaymentEntry,
	QueuePreviewItem,
	SyncQueueOperation,
} from '../offline/types';

type PaymentRecordInput = {
	customerId: string;
	customerName: string;
	amount: number;
	totalPaid: number;
	currentEndDate: unknown;
};

type OfflineSyncContextValue = {
	ready: boolean;
	syncBusy: boolean;
	customers: Customer[];
	payments: PaymentEntry[];
	expenses: ExpenseEntry[];
	menuByDate: Record<string, DayMenu>;
	attendanceByDate: Record<string, AttendanceEntry[]>;
	queuedReceipts: QueuedReceiptExpense[];
	queueItems: QueuePreviewItem[];
	pendingQueueCount: number;
	refreshOfflineState: () => Promise<void>;
	runSync: (silent?: boolean) => Promise<void>;
	addCustomer: (customer: Customer) => Promise<void>;
	deleteCustomer: (customerId: string, customerName?: string) => Promise<void>;
	saveAttendanceBatch: (records: AttendanceEntry[], title?: string, subtitle?: string) => Promise<void>;
	saveMenuDay: (date: string, menu: DayMenu, title?: string, subtitle?: string) => Promise<void>;
	recordPayment: (input: PaymentRecordInput) => Promise<void>;
	deletePayment: (paymentId: string, customerName?: string) => Promise<void>;
	deleteExpense: (expenseId: string, expenseTitle?: string) => Promise<void>;
	updateExpense: (expense: ExpenseEntry) => Promise<void>;
	deleteQueuedReceipt: (localId: string) => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

type OfflineState = {
	customers: Customer[];
	payments: PaymentEntry[];
	expenses: ExpenseEntry[];
	menuByDate: Record<string, DayMenu>;
	attendanceByDate: Record<string, AttendanceEntry[]>;
	queueOperations: SyncQueueOperation[];
	queuedReceipts: QueuedReceiptExpense[];
	pendingQueueCount: number;
};

const EMPTY_STATE: OfflineState = {
	customers: [],
	payments: [],
	expenses: [],
	menuByDate: {},
	attendanceByDate: {},
	queueOperations: [],
	queuedReceipts: [],
	pendingQueueCount: 0,
};

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false);
	const [syncBusy, setSyncBusy] = useState(false);
	const [state, setState] = useState<OfflineState>(EMPTY_STATE);
	const weekId = useMemo(() => getWeekId(), []);
	const weekDates = useMemo(() => getDatesForWeek(weekId), [weekId]);
	const syncRef = useRef(false);
	const localCounterRef = useRef(0);

	const refreshOfflineState = useCallback(async () => {
		const snapshot = await loadOfflineSnapshot(weekDates);
		let queuedReceipts: QueuedReceiptExpense[] = [];
		try {
			queuedReceipts = await loadQueuedReceiptExpenses();
		} catch (error) {
			console.error('Could not load queued receipts from SQLite:', error);
		}

		const visibleReceipts = queuedReceipts.filter((entry) => entry.status !== 'synced');
		setState({
			customers: snapshot.customers,
			payments: snapshot.payments,
			expenses: snapshot.expenses,
			menuByDate: snapshot.menuByDate,
			attendanceByDate: snapshot.attendanceByDate,
			queueOperations: snapshot.queueOperations,
			queuedReceipts: visibleReceipts,
			pendingQueueCount: snapshot.pendingQueueCount + visibleReceipts.length,
		});
	}, [weekDates]);

	const executeQueueOperation = useCallback(async (operation: SyncQueueOperation) => {
		switch (operation.kind) {
			case 'customer_create': {
				const payload = operation.payload as { customer: Customer };
				await setDoc(doc(db, 'customers', payload.customer.id), mapCustomerForFirestore(payload.customer));
				return;
			}
			case 'customer_delete': {
				await deleteDoc(doc(db, 'customers', operation.entityId));
				return;
			}
			case 'attendance_batch_upsert': {
				const payload = operation.payload as { records: AttendanceEntry[] };
				const batch = writeBatch(db);
				for (const record of payload.records) {
					batch.set(
						doc(db, 'attendance', record.id),
						{
							customerId: record.customerId,
							date: record.date,
							name: record.name ?? '',
							lunch: record.lunch,
							dinner: record.dinner,
							updatedAt: record.updatedAt ?? new Date().toISOString(),
						},
						{ merge: true }
					);
				}
				await batch.commit();
				return;
			}
			case 'menu_upsert': {
				const payload = operation.payload as { date: string; menu: DayMenu };
				await setDoc(
					doc(db, 'menu', payload.date),
					{
						...payload.menu,
						updatedAt: new Date().toISOString(),
					},
					{ merge: true }
				);
				return;
			}
			case 'payment_record': {
				const payload = operation.payload as {
					payment: PaymentEntry;
					customerId: string;
					customerPatch: { totalPaid: number; endDate: string };
				};
				const batch = writeBatch(db);
				batch.set(doc(db, 'payments', payload.payment.id), mapPaymentForFirestore(payload.payment));
				batch.update(doc(db, 'customers', payload.customerId), {
					totalPaid: payload.customerPatch.totalPaid,
					endDate: new Date(payload.customerPatch.endDate),
				});
				await batch.commit();
				return;
			}
			case 'payment_delete': {
				await deleteDoc(doc(db, 'payments', operation.entityId));
				return;
			}
			case 'expense_delete': {
				await deleteDoc(doc(db, 'expenses', operation.entityId));
				return;
			}
			case 'expense_upsert': {
				const payload = operation.payload as { expense: ExpenseEntry };
				await setDoc(doc(db, 'expenses', operation.entityId), {
					title: payload.expense.title,
					merchantName: payload.expense.merchantName,
					total: payload.expense.total,
					date: payload.expense.receiptDate ? new Date(`${payload.expense.receiptDate}T12:00:00`) : new Date(),
					monthTag: payload.expense.monthTag,
					currency: payload.expense.currency || 'DHS',
					source: payload.expense.source || 'manual',
					note: payload.expense.note || '',
					items: payload.expense.items || [],
					confidence: payload.expense.confidence || 1,
					rawText: payload.expense.rawText || '',
					imageUri: payload.expense.imageUri || '',
					paymentMethod: payload.expense.paymentMethod || '',
					receiptDate: payload.expense.receiptDate || '',
				}, { merge: true });
				return;
			}
			default:
				return;
		}
	}, []);

	const runSync = useCallback(async (silent = false) => {
		if (syncRef.current) {
			return;
		}

		syncRef.current = true;
		if (!silent) {
			setSyncBusy(true);
		}

		try {
			const operations = await listSyncOperations();

			for (const operation of operations) {
				try {
					await executeQueueOperation(operation);
					await completeSyncOperation(operation);
				} catch (error) {
					await failSyncOperation(
						operation.id,
						operation.attempts + 1,
						getSyncErrorMessage(error)
					);
				}
			}

			try {
				await syncQueuedReceiptExpenses();
			} catch (error) {
				console.error('Queued receipt sync failed:', error);
			}

			await refreshOfflineState();
		} finally {
			syncRef.current = false;
			if (!silent) {
				setSyncBusy(false);
			}
		}
	}, [executeQueueOperation, refreshOfflineState]);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				await initializeOfflineDatabase();
				if (cancelled) {
					return;
				}
				await refreshOfflineState();
				if (!cancelled) {
					setReady(true);
				}
				void runSync(true);
			} catch (error) {
				console.error('Offline database initialization failed:', error);
				if (!cancelled) {
					setReady(true);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [refreshOfflineState, runSync]);

	useEffect(() => {
		const unsubscribeCustomers = onSnapshot(
			collection(db, 'customers'),
			async (snapshot) => {
				const nextCustomers = snapshot.docs.map((entry) => ({
					id: entry.id,
					...entry.data(),
				} as Customer));
				await syncRemoteCustomers(nextCustomers);
				await refreshOfflineState();
			},
			(error) => {
				console.error('Remote customer sync failed:', error);
			}
		);

		const unsubscribePayments = onSnapshot(
			collection(db, 'payments'),
			async (snapshot) => {
				const nextPayments = snapshot.docs.map((entry) => ({
					id: entry.id,
					...entry.data(),
				} as PaymentEntry));
				await syncRemotePayments(nextPayments);
				await refreshOfflineState();
			},
			(error) => {
				console.error('Remote payment sync failed:', error);
			}
		);

		const unsubscribeExpenses = onSnapshot(
			collection(db, 'expenses'),
			async (snapshot) => {
				const nextExpenses = snapshot.docs.map((entry) => ({
					id: entry.id,
					...entry.data(),
				} as ExpenseEntry));
				await syncRemoteExpenses(nextExpenses);
				await refreshOfflineState();
			},
			(error) => {
				console.error('Remote expense sync failed:', error);
			}
		);

		const unsubscribeMenus = weekDates.map((date) =>
			onSnapshot(
				doc(db, 'menu', date),
				async (snapshot) => {
					await syncRemoteMenu(
						date,
						snapshot.exists() ? ({ ...snapshot.data() } as DayMenu) : null
					);
					await refreshOfflineState();
				},
				(error) => {
					console.error(`Remote menu sync failed for ${date}:`, error);
				}
			)
		);

		const unsubscribeAttendance = weekDates.map((date) =>
			onSnapshot(
				query(collection(db, 'attendance'), where('date', '==', date)),
				async (snapshot) => {
					const records = snapshot.docs.map((entry) => ({
						id: entry.id,
						...entry.data(),
					} as AttendanceEntry));
					await syncRemoteAttendanceDate(date, records);
					await refreshOfflineState();
				},
				(error) => {
					console.error(`Remote attendance sync failed for ${date}:`, error);
				}
			)
		);

		return () => {
			unsubscribeCustomers();
			unsubscribePayments();
			unsubscribeExpenses();
			unsubscribeMenus.forEach((unsubscribe) => unsubscribe());
			unsubscribeAttendance.forEach((unsubscribe) => unsubscribe());
		};
	}, [refreshOfflineState, weekDates]);

	useEffect(() => {
		const appStateSubscription = AppState.addEventListener('change', (nextState) => {
			if (nextState === 'active') {
				void runSync(true);
			}
		});
		const interval = setInterval(() => {
			void runSync(true);
		}, 20000);

		return () => {
			appStateSubscription.remove();
			clearInterval(interval);
		};
	}, [runSync]);

	const addCustomer = useCallback(async (customer: Customer) => {
		await saveLocalCustomer(customer);
		await enqueueSyncOperation({
			id: createLocalId('queue-customer', localCounterRef),
			entityType: 'customer',
			entityId: customer.id,
			kind: 'customer_create',
			title: `Add ${customer.name}`,
			subtitle: 'Customer saved locally and waiting to sync',
			payload: { customer },
			status: 'pending',
			attempts: 0,
			error: '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		await refreshOfflineState();
		void runSync(true);
	}, [refreshOfflineState, runSync]);

	const deleteCustomer = useCallback(async (customerId: string, customerName?: string) => {
		await markCustomerDeleted(customerId);
		await enqueueSyncOperation({
			id: createLocalId('queue-customer-delete', localCounterRef),
			entityType: 'customer',
			entityId: customerId,
			kind: 'customer_delete',
			title: customerName ? `Delete ${customerName}` : 'Delete customer',
			subtitle: 'Customer hidden locally until Firestore confirms deletion',
			payload: { customerId },
			status: 'pending',
			attempts: 0,
			error: '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		await refreshOfflineState();
		void runSync(true);
	}, [refreshOfflineState, runSync]);

	const saveAttendanceBatch = useCallback(async (
		records: AttendanceEntry[],
		title?: string,
		subtitle?: string
	) => {
		await saveLocalAttendanceBatch(records);
		await enqueueSyncOperation({
			id: createLocalId('queue-attendance', localCounterRef),
			entityType: 'attendance',
			entityId: records[0]?.date ?? createLocalId('attendance-empty', localCounterRef),
			kind: 'attendance_batch_upsert',
			title: title ?? (records.length === 1 ? 'Update attendance' : `Queue ${records.length} attendance changes`),
			subtitle: subtitle ?? 'Attendance changes are saved locally first',
			payload: { records },
			status: 'pending',
			attempts: 0,
			error: '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		await refreshOfflineState();
		void runSync(true);
	}, [refreshOfflineState, runSync]);

	const saveMenuDay = useCallback(async (
		date: string,
		menu: DayMenu,
		title?: string,
		subtitle?: string
	) => {
		await saveLocalMenu(date, menu);
		await enqueueSyncOperation({
			id: createLocalId('queue-menu', localCounterRef),
			entityType: 'menu',
			entityId: date,
			kind: 'menu_upsert',
			title: title ?? 'Update menu',
			subtitle: subtitle ?? `${date} saved locally and queued for sync`,
			payload: { date, menu },
			status: 'pending',
			attempts: 0,
			error: '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		await refreshOfflineState();
		void runSync(true);
	}, [refreshOfflineState, runSync]);

	const recordPayment = useCallback(async (input: PaymentRecordInput) => {
		const now = new Date();
		const currentEndDate = toDate(input.currentEndDate);
		const nextEndDate = new Date(
			now > currentEndDate ? now.getTime() : currentEndDate.getTime()
		);
		nextEndDate.setDate(nextEndDate.getDate() + 30);

		const payment: PaymentEntry = {
			id: createLocalId('payment', localCounterRef),
			customerId: input.customerId,
			customerName: input.customerName,
			amount: input.amount,
			date: now.toISOString(),
			method: 'cash',
			monthTag: now.toISOString().slice(0, 7),
		};

		await saveLocalPayment(payment);
		await applyLocalCustomerPatch(input.customerId, {
			totalPaid: (input.totalPaid || 0) + input.amount,
			endDate: nextEndDate.toISOString(),
		});
		await enqueueSyncOperation({
			id: createLocalId('queue-payment', localCounterRef),
			entityType: 'payment',
			entityId: payment.id,
			kind: 'payment_record',
			title: `Record payment for ${input.customerName}`,
			subtitle: `DHS ${input.amount} saved locally and queued for sync`,
			payload: {
				payment,
				customerId: input.customerId,
				customerPatch: {
					totalPaid: (input.totalPaid || 0) + input.amount,
					endDate: nextEndDate.toISOString(),
				},
			},
			status: 'pending',
			attempts: 0,
			error: '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		await refreshOfflineState();
		void runSync(true);
	}, [refreshOfflineState, runSync]);

	const deletePayment = useCallback(async (paymentId: string, customerName?: string) => {
		await markPaymentDeleted(paymentId);
		await enqueueSyncOperation({
			id: createLocalId('queue-payment-delete', localCounterRef),
			entityType: 'payment',
			entityId: paymentId,
			kind: 'payment_delete',
			title: customerName ? `Delete ${customerName}'s payment` : 'Delete payment',
			subtitle: 'Payment removed locally and queued for Firestore deletion',
			payload: { paymentId },
			status: 'pending',
			attempts: 0,
			error: '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		await refreshOfflineState();
		void runSync(true);
	}, [refreshOfflineState, runSync]);

	const deleteExpense = useCallback(async (expenseId: string, expenseTitle?: string) => {
		await markExpenseDeleted(expenseId);
		await enqueueSyncOperation({
			id: createLocalId('queue-expense-delete', localCounterRef),
			entityType: 'expense',
			entityId: expenseId,
			kind: 'expense_delete',
			title: expenseTitle ? `Delete ${expenseTitle}` : 'Delete expense',
			subtitle: 'Expense removed locally and queued for Firestore deletion',
			payload: { expenseId },
			status: 'pending',
			attempts: 0,
			error: '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		await refreshOfflineState();
		void runSync(true);
	}, [refreshOfflineState, runSync]);

	const updateExpense = useCallback(async (expense: ExpenseEntry) => {
		await enqueueSyncOperation({
			id: createLocalId('queue-expense-update', localCounterRef),
			entityType: 'expense',
			entityId: expense.id,
			kind: 'expense_upsert',
			title: `Update ${expense.title || expense.merchantName}`,
			subtitle: 'Expense update queued for Firestore',
			payload: { expense },
			status: 'pending',
			attempts: 0,
			error: '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		await refreshOfflineState();
		void runSync(true);
	}, [refreshOfflineState, runSync]);

	const deleteQueuedReceipt = useCallback(async (localId: string) => {
		await deleteQueuedReceiptExpense(localId);
		await refreshOfflineState();
	}, [refreshOfflineState]);

	const queueItems = useMemo<QueuePreviewItem[]>(() => {
		const syncItems = state.queueOperations.map((entry) => ({
			id: entry.id,
			source: 'sync' as const,
			title: entry.title,
			subtitle: entry.subtitle,
			status: entry.status,
			error: entry.error,
			createdAt: entry.createdAt,
			updatedAt: entry.updatedAt,
		}));

		const receiptItems = state.queuedReceipts.map((entry) => {
			const status: QueuePreviewItem['status'] = entry.status === 'failed' ? 'failed' : 'pending';

			return {
				id: entry.localId,
				source: 'receipt' as const,
				title: entry.expenseTitle || entry.merchantName || 'Queued receipt',
				subtitle: `${entry.receiptDate} • ${entry.status === 'failed' ? 'Needs retry' : 'Stored locally'}`,
				status,
				error: entry.syncError,
				createdAt: entry.createdAt,
				updatedAt: entry.updatedAt,
			};
		});

		return [...syncItems, ...receiptItems].sort((left, right) =>
			right.updatedAt.localeCompare(left.updatedAt)
		);
	}, [state.queueOperations, state.queuedReceipts]);

	const value = useMemo<OfflineSyncContextValue>(() => ({
		ready,
		syncBusy,
		customers: state.customers,
		payments: state.payments,
		expenses: state.expenses,
		menuByDate: state.menuByDate,
		attendanceByDate: state.attendanceByDate,
		queuedReceipts: state.queuedReceipts,
		queueItems,
		pendingQueueCount: state.pendingQueueCount,
		refreshOfflineState,
		runSync,
		addCustomer,
		deleteCustomer,
		saveAttendanceBatch,
		saveMenuDay,
		recordPayment,
		deletePayment,
		deleteExpense,
		updateExpense,
		deleteQueuedReceipt,
	}), [
		addCustomer,
		deleteCustomer,
		deleteExpense,
		deletePayment,
		deleteQueuedReceipt,
		queueItems,
		ready,
		recordPayment,
		refreshOfflineState,
		runSync,
		saveAttendanceBatch,
		saveMenuDay,
		state.attendanceByDate,
		state.customers,
		state.expenses,
		state.menuByDate,
		state.payments,
		state.pendingQueueCount,
		state.queuedReceipts,
		syncBusy,
		updateExpense,
	]);

	return (
		<OfflineSyncContext.Provider value={value}>
			{children}
		</OfflineSyncContext.Provider>
	);
}

export function useOfflineSync() {
	const context = useContext(OfflineSyncContext);
	if (!context) {
		throw new Error('useOfflineSync must be used within OfflineSyncProvider');
	}

	return context;
}

function createLocalId(prefix: string, counterRef: React.MutableRefObject<number>) {
	counterRef.current += 1;
	return `${prefix}-${Date.now()}-${counterRef.current}`;
}

function mapCustomerForFirestore(customer: Customer) {
	return {
		...customer,
		startDate: toDate(customer.startDate),
		endDate: toDate(customer.endDate),
	};
}

function mapPaymentForFirestore(payment: PaymentEntry) {
	return {
		customerId: payment.customerId,
		customerName: payment.customerName,
		amount: payment.amount,
		date: toDate(payment.date),
		method: payment.method || 'cash',
		monthTag: payment.monthTag,
	};
}

function getSyncErrorMessage(error: unknown) {
	if (error instanceof Error && error.message.trim()) {
		return error.message.trim();
	}

	return 'Sync failed. The change is still stored locally.';
}
