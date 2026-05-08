import type { ReceiptExpenseDraft } from './receiptTypes';

export class ReceiptScannerConfigError extends Error {}

export type ScanReceiptInput = {
	imageUri: string;
	mimeType?: string | null;
};

export const getReceiptScannerConfigMessage = () =>
	'Receipt OCR is available on Android and iOS development builds only.';

export const isReceiptScannerConfigured = () => false;

export async function scanReceiptImage(_: ScanReceiptInput): Promise<ReceiptExpenseDraft> {
	throw new ReceiptScannerConfigError(getReceiptScannerConfigMessage());
}

export type { ReceiptExpenseDraft } from './receiptTypes';
export type { ReceiptLineItem } from './receiptTypes';
