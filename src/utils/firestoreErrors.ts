export const isFirestorePermissionDenied = (error: unknown) => {
	return typeof error === 'object'
		&& error !== null
		&& 'code' in error
		&& (error as { code?: string }).code === 'permission-denied';
};

export const getFirestoreErrorMessage = (error: unknown, fallback: string) => {
	if (isFirestorePermissionDenied(error)) {
		return 'Firestore denied access. Your current Firestore Rules require permission that this app is not providing.';
	}

	return error instanceof Error ? error.message : fallback;
};
