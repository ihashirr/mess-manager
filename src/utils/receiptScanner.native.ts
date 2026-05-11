import * as FileSystem from 'expo-file-system/legacy';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { parseReceiptText } from './receiptParser';
import type { ReceiptExpenseDraft, TextFragment } from './receiptTypes';

export class ReceiptScannerConfigError extends Error {}

export type ScanReceiptInput = {
	imageUri: string;
	mimeType?: string | null;
};

const RECEIPT_FOLDER = `${FileSystem.documentDirectory}receipt-scans`;
const MODULE_NAME = 'RNMLKitTextRecognition';

type Rect = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

type TextElement = {
	text: string;
	frame: Rect;
	recognizedLanguages: string[];
};

type TextLine = {
	text: string;
	frame: Rect;
	recognizedLanguages: string[];
	elements: TextElement[];
};

type Block = {
	text: string;
	frame: Rect;
	recognizedLanguages: string[];
	lines: TextLine[];
};

type TextRecognitionResult = {
	text: string;
	blocks: Block[];
};

type RNMLKitTextRecognitionModule = {
	recognizeText: (imagePath: string) => Promise<TextRecognitionResult>;
};

export const getReceiptScannerConfigMessage = () =>
	'Receipt OCR requires a fresh Android or iOS development build with the native ML Kit scanner installed. Expo Go will not include it.';

export const isReceiptScannerConfigured = () =>
	(Platform.OS === 'android' || Platform.OS === 'ios') && !!getRecognizerModule();

export async function scanReceiptImage({
	imageUri,
	mimeType,
}: ScanReceiptInput): Promise<ReceiptExpenseDraft> {
	if (!imageUri) {
		throw new Error('No receipt image was selected.');
	}

	const recognizeText = await loadRecognizer();
	const persistedImageUri = await persistReceiptImage(imageUri, mimeType);
	const result = await recognizeText(persistedImageUri);
	
	const lineFragments = getLineFragments(result);
	const elementFragments = getElementFragments(result);
	const preferredFragments =
		elementFragments.length >= Math.max(10, lineFragments.length * 2)
			? elementFragments
			: lineFragments;
			
	const rawText = buildStructuredReceiptText(result.text, preferredFragments);

	if (!rawText) {
		throw new Error('No readable text was detected. Retake the receipt in brighter light.');
	}

	return parseReceiptText({
		rawText,
		imageUri: persistedImageUri,
		geometry: { fragments: preferredFragments }
	});
}

async function loadRecognizer() {
	const module = getRecognizerModule();

	if (!module) {
		throw new ReceiptScannerConfigError(getReceiptScannerConfigMessage());
	}

	return module.recognizeText;
}

function getRecognizerModule() {
	return requireOptionalNativeModule<RNMLKitTextRecognitionModule>(MODULE_NAME);
}

async function persistReceiptImage(imageUri: string, mimeType?: string | null) {
	await FileSystem.makeDirectoryAsync(RECEIPT_FOLDER, { intermediates: true });

	const extension = detectFileExtension(imageUri, mimeType);
	const targetUri = `${RECEIPT_FOLDER}/${Date.now()}${extension}`;

	try {
		await FileSystem.copyAsync({
			from: imageUri,
			to: targetUri,
		});
		return targetUri;
	} catch {
		return imageUri;
	}
}

function detectFileExtension(imageUri: string, mimeType?: string | null) {
	if (mimeType) {
		if (mimeType.includes('png')) {
			return '.png';
		}

		if (mimeType.includes('heic')) {
			return '.heic';
		}
	}

	const uriMatch = imageUri.match(/\.(\w+)(?:\?|$)/);
	if (uriMatch?.[1]) {
		return `.${uriMatch[1].toLowerCase()}`;
	}

	return '.jpg';
}

function buildStructuredReceiptText(nativeText: string, preferredFragments: TextFragment[]) {
	const fallbackText = normalizeNativeText(nativeText);
	const structuredText = joinFragmentsIntoRows(preferredFragments);

	if (!structuredText) {
		return fallbackText;
	}

	if (!fallbackText) {
		return structuredText;
	}

	return structuredText.length >= Math.floor(fallbackText.length * 0.45)
		? structuredText
		: fallbackText;
}

function getLineFragments(result: TextRecognitionResult) {
	return result.blocks.flatMap((block) =>
		block.lines
			.map((line) => toTextFragment(line.text, line.frame))
			.filter((fragment): fragment is TextFragment => fragment !== null)
	);
}

function getElementFragments(result: TextRecognitionResult) {
	return result.blocks.flatMap((block) =>
		block.lines.flatMap((line) => {
			const fragments = line.elements
				.map((element) => toTextFragment(element.text, element.frame))
				.filter((fragment): fragment is TextFragment => fragment !== null);

			if (fragments.length > 0) {
				return fragments;
			}

			const fallback = toTextFragment(line.text, line.frame);
			return fallback ? [fallback] : [];
		})
	);
}

function toTextFragment(text: string, frame: Rect) {
	const normalizedText = text.replace(/\s+/g, ' ').trim();
	if (!normalizedText) {
		return null;
	}

	return {
		text: normalizedText,
		frame,
	};
}

function joinFragmentsIntoRows(fragments: TextFragment[]) {
	if (fragments.length === 0) {
		return '';
	}

	const sortedFragments = [...fragments].sort((left, right) => {
		const topDiff = left.frame.top - right.frame.top;
		if (Math.abs(topDiff) > 4) {
			return topDiff;
		}

		return left.frame.left - right.frame.left;
	});
	const medianHeight = getMedian(
		sortedFragments.map((fragment) =>
			Math.max(1, Math.abs(fragment.frame.bottom - fragment.frame.top))
		)
	);
	const rowThreshold = Math.max(8, Math.min(28, medianHeight * 0.7));
	const rows: { centerY: number; fragments: TextFragment[] }[] = [];

	for (const fragment of sortedFragments) {
		const centerY = (fragment.frame.top + fragment.frame.bottom) / 2;
		const lastRow = rows[rows.length - 1];

		if (!lastRow || Math.abs(lastRow.centerY - centerY) > rowThreshold) {
			rows.push({
				centerY,
				fragments: [fragment],
			});
			continue;
		}

		lastRow.fragments.push(fragment);
		lastRow.centerY =
			(lastRow.centerY * (lastRow.fragments.length - 1) + centerY) /
			lastRow.fragments.length;
	}

	return rows
		.map((row) =>
			row.fragments
				.sort((left, right) => left.frame.left - right.frame.left)
				.map((fragment) => fragment.text)
				.filter((text, index, values) => text !== values[index - 1])
				.join(' ')
				.trim()
		)
		.filter(Boolean)
		.join('\n');
}

function getMedian(values: number[]) {
	if (values.length === 0) {
		return 16;
	}

	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 0) {
		return (sorted[middle - 1] + sorted[middle]) / 2;
	}

	return sorted[middle] ?? 16;
}

function normalizeNativeText(value: string) {
	return value.replace(/\r/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

export type { ReceiptExpenseDraft } from './receiptTypes';
export type { ReceiptLineItem } from './receiptTypes';
