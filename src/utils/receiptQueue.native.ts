import * as FileSystem from 'expo-file-system/legacy';
import { addDoc, collection } from 'firebase/firestore';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { db } from '../firebase/config';
import type {
	QueuedReceiptExpense,
	ReceiptExpenseDraft,
	ReceiptQueueSyncSummary,
	SavedReceiptResult,
} from './receiptTypes';

type ReceiptQueueRow = {
	local_id: string;
	month_tag: string;
	image_uri: string;
	raw_text: string;
	merchant_name: string;
	expense_title: string;
	total: number;
	subtotal: number | null;
	tax: number | null;
	currency: string;
	receipt_date: string;
	payment_method: string;
	items_json: string;
	note: string;
	confidence: number;
	status: 'pending' | 'failed' | 'synced';
	sync_error: string;
	synced_expense_id: string | null;
	created_at: string;
	updated_at: string;
	source: 'ocr_scanner';
};

type SafeSQLiteDatabase = {
	execAsync: SQLiteDatabase['execAsync'];
	runAsync: (source: string, ...params: unknown[]) => ReturnType<SQLiteDatabase['runAsync']>;
	getAllAsync: <T>(source: string, ...params: unknown[]) => Promise<T[]>;
	getFirstAsync: <T>(source: string, ...params: unknown[]) => Promise<T | null>;
};

let queueDatabasePromise: Promise<SafeSQLiteDatabase> | null = null;
let localReceiptCounter = 0;

export async function loadQueuedReceiptExpenses(): Promise<QueuedReceiptExpense[]> {
	const database = await getQueueDatabase();
	const rows = await database.getAllAsync<ReceiptQueueRow>(
		'SELECT * FROM receipt_queue ORDER BY updated_at DESC'
	);

	return rows.map(mapQueueRow);
}

export async function saveReceiptDraftToQueue(
	draft: ReceiptExpenseDraft
): Promise<SavedReceiptResult> {
	const database = await getQueueDatabase();
	const now = new Date().toISOString();
	const entry = toQueuedReceipt(draft, now);

	await database.runAsync(
		`INSERT INTO receipt_queue (
			local_id,
			month_tag,
			image_uri,
			raw_text,
			merchant_name,
			expense_title,
			total,
			subtotal,
			tax,
			currency,
			receipt_date,
			payment_method,
			items_json,
			note,
			confidence,
			status,
			sync_error,
			synced_expense_id,
			created_at,
			updated_at,
			source
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		entry.localId,
		entry.monthTag,
		entry.imageUri,
		entry.rawText,
		entry.merchantName,
		entry.expenseTitle,
		entry.total,
		entry.subtotal,
		entry.tax,
		entry.currency,
		entry.receiptDate,
		entry.paymentMethod,
		JSON.stringify(entry.items),
		entry.note,
		entry.confidence,
		entry.status,
		entry.syncError,
		entry.syncedExpenseId,
		entry.createdAt,
		entry.updatedAt,
		entry.source
	);

	await syncQueuedReceiptExpenses([entry.localId]);
	const latestEntry = await getReceiptQueueEntry(entry.localId);

	return {
		entry: latestEntry ?? entry,
		syncState: latestEntry?.status === 'synced' ? 'synced' : 'queued',
	};
}

export async function syncQueuedReceiptExpenses(
	localIds?: string[]
): Promise<ReceiptQueueSyncSummary> {
	const database = await getQueueDatabase();
	const candidates = await database.getAllAsync<ReceiptQueueRow>(
		`SELECT * FROM receipt_queue
		 WHERE status IN ('pending', 'failed')
		 ORDER BY created_at ASC`
	);
	const rowsToSync = localIds?.length
		? candidates.filter((row) => localIds.includes(row.local_id))
		: candidates;

	let syncedCount = 0;
	let failedCount = 0;

	for (const row of rowsToSync) {
		try {
			const docRef = await addDoc(collection(db, 'expenses'), toFirestoreExpense(mapQueueRow(row)));
			await database.runAsync(
				`UPDATE receipt_queue
				 SET status = ?, sync_error = ?, synced_expense_id = ?, updated_at = ?
				 WHERE local_id = ?`,
				'synced',
				'',
				docRef.id,
				new Date().toISOString(),
				row.local_id
			);
			syncedCount += 1;
		} catch (error) {
			await database.runAsync(
				`UPDATE receipt_queue
				 SET status = ?, sync_error = ?, updated_at = ?
				 WHERE local_id = ?`,
				'failed',
				getErrorMessage(error),
				new Date().toISOString(),
				row.local_id
			);
			failedCount += 1;
		}
	}

	const pendingRow = await database.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) as count
		 FROM receipt_queue
		 WHERE status IN ('pending', 'failed')`
	);

	return {
		syncedCount,
		failedCount,
		pendingCount: pendingRow?.count ?? 0,
	};
}

export async function deleteQueuedReceiptExpense(localId: string): Promise<void> {
	const database = await getQueueDatabase();
	const row = await database.getFirstAsync<ReceiptQueueRow>(
		'SELECT * FROM receipt_queue WHERE local_id = ?',
		localId
	);

	if (row?.image_uri) {
		try {
			await FileSystem.deleteAsync(row.image_uri, { idempotent: true });
		} catch {
			// Ignore local image cleanup failures and keep deleting the queue record.
		}
	}

	await database.runAsync('DELETE FROM receipt_queue WHERE local_id = ?', localId);
}

async function getQueueDatabase() {
	if (!queueDatabasePromise) {
		queueDatabasePromise = initializeQueueDatabase();
	}

	return queueDatabasePromise;
}

async function initializeQueueDatabase() {
	const database = await openDatabaseAsync('mess-manager-receipts.db');
	await database.execAsync(`
		CREATE TABLE IF NOT EXISTS receipt_queue (
			local_id TEXT PRIMARY KEY NOT NULL,
			month_tag TEXT NOT NULL,
			image_uri TEXT NOT NULL,
			raw_text TEXT NOT NULL,
			merchant_name TEXT NOT NULL,
			expense_title TEXT NOT NULL,
			total REAL NOT NULL,
			subtotal REAL,
			tax REAL,
			currency TEXT NOT NULL,
			receipt_date TEXT NOT NULL,
			payment_method TEXT NOT NULL,
			items_json TEXT NOT NULL,
			note TEXT NOT NULL,
			confidence REAL NOT NULL,
			status TEXT NOT NULL,
			sync_error TEXT NOT NULL DEFAULT '',
			synced_expense_id TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			source TEXT NOT NULL DEFAULT 'ocr_scanner'
		);
		CREATE INDEX IF NOT EXISTS idx_receipt_queue_status
			ON receipt_queue(status, updated_at DESC);
	`);

	return createDatabaseFacade(database);
}

async function getReceiptQueueEntry(localId: string) {
	const database = await getQueueDatabase();
	const row = await database.getFirstAsync<ReceiptQueueRow>(
		'SELECT * FROM receipt_queue WHERE local_id = ?',
		localId
	);

	return row ? mapQueueRow(row) : null;
}

function toQueuedReceipt(draft: ReceiptExpenseDraft, createdAt: string): QueuedReceiptExpense {
	localReceiptCounter += 1;
	const localId = `receipt-${Date.now()}-${localReceiptCounter}`;
	const monthTag = createdAt.slice(0, 7);

	return {
		...draft,
		localId,
		monthTag,
		status: 'pending',
		syncError: '',
		syncedExpenseId: null,
		createdAt,
		updatedAt: createdAt,
		source: 'ocr_scanner',
	};
}

function mapQueueRow(row: ReceiptQueueRow): QueuedReceiptExpense {
	return {
		localId: row.local_id,
		monthTag: row.month_tag,
		imageUri: row.image_uri,
		rawText: row.raw_text,
		merchantName: row.merchant_name,
		expenseTitle: row.expense_title,
		total: row.total,
		subtotal: row.subtotal,
		tax: row.tax,
		currency: row.currency,
		receiptDate: row.receipt_date,
		paymentMethod: row.payment_method,
		items: parseItems(row.items_json),
		note: row.note,
		confidence: row.confidence,
		status: row.status,
		syncError: row.sync_error,
		syncedExpenseId: row.synced_expense_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		source: row.source,
	};
}

function toFirestoreExpense(entry: QueuedReceiptExpense) {
	return {
		title: entry.expenseTitle,
		merchantName: entry.merchantName,
		total: entry.total,
		subtotal: entry.subtotal,
		tax: entry.tax,
		date: toFirestoreDate(entry.receiptDate),
		monthTag: entry.monthTag,
		currency: entry.currency,
		source: entry.source,
		note: entry.note,
		items: entry.items,
		confidence: entry.confidence,
		rawText: entry.rawText,
		imageUri: entry.imageUri,
		paymentMethod: entry.paymentMethod,
		receiptDate: entry.receiptDate,
		localReceiptId: entry.localId,
	};
}

function toFirestoreDate(receiptDate: string) {
	const parsed = new Date(`${receiptDate}T12:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return new Date();
	}

	return parsed;
}

function parseItems(value: string) {
	try {
		const parsed = JSON.parse(value) as QueuedReceiptExpense['items'];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error && error.message.trim()) {
		return error.message.trim();
	}

	return 'Sync failed. The receipt stays in the local queue.';
}

function createDatabaseFacade(database: SQLiteDatabase): SafeSQLiteDatabase {
	return {
		execAsync: database.execAsync.bind(database),
		runAsync: (source, ...params) => {
			const boundParams = normalizeBindParams(params);
			return boundParams === undefined
				? database.runAsync(source)
				: database.runAsync(source, boundParams as never);
		},
		getAllAsync: <T,>(source: string, ...params: unknown[]) => {
			const boundParams = normalizeBindParams(params);
			return boundParams === undefined
				? database.getAllAsync<T>(source)
				: database.getAllAsync<T>(source, boundParams as never);
		},
		getFirstAsync: <T,>(source: string, ...params: unknown[]) => {
			const boundParams = normalizeBindParams(params);
			return boundParams === undefined
				? database.getFirstAsync<T>(source)
				: database.getFirstAsync<T>(source, boundParams as never);
		},
	};
}

function normalizeBindParams(params: unknown[]) {
	if (params.length === 0) {
		return undefined;
	}

	if (params.length === 1) {
		const [first] = params;
		if (Array.isArray(first)) {
			return first;
		}

		if (first && typeof first === 'object') {
			return first as Record<string, unknown>;
		}

		return [first];
	}

	return params;
}
