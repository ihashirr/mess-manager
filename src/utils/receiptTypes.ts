export type ReceiptLineItem = {
	name: string;
	amount: number | null;
	quantity: number | null;
};

export type ReceiptExpenseDraft = {
	merchantName: string;
	expenseTitle: string;
	total: number;
	subtotal: number | null;
	tax: number | null;
	currency: string;
	receiptDate: string;
	paymentMethod: string;
	items: ReceiptLineItem[];
	note: string;
	confidence: number;
	rawText: string;
	imageUri: string;
};

export type ReceiptQueueStatus = 'pending' | 'failed' | 'synced';

export type QueuedReceiptExpense = ReceiptExpenseDraft & {
	localId: string;
	monthTag: string;
	status: ReceiptQueueStatus;
	syncError: string;
	syncedExpenseId: string | null;
	createdAt: string;
	updatedAt: string;
	source: 'ocr_scanner';
};

export type SavedReceiptResult = {
	entry: QueuedReceiptExpense;
	syncState: 'queued' | 'synced';
};

export type ReceiptQueueSyncSummary = {
	syncedCount: number;
	failedCount: number;
	pendingCount: number;
};
