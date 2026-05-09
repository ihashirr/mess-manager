import React, { createContext, useContext, useMemo, useState } from 'react';
import { Theme } from '../constants/Theme';

type ThemeMode = 'light' | 'dark';
type ThemeColors = typeof Theme.colors;

const darkColors: ThemeColors = {
	...Theme.colors,
	bg: '#0B0C0F',
	surface: '#15161B',
	surfaceElevated: '#202127',
	border: '#30323A',
	textPrimary: '#F7F7FA',
	textSecondary: '#C5C7D0',
	textMuted: '#8D909B',
	textInverted: '#111216',
	overlay: 'rgba(3, 4, 7, 0.82)',
};

const colorByMode: Record<ThemeMode, ThemeColors> = {
	light: Theme.colors,
	dark: darkColors,
};

type ThemeModeContextValue = {
	colors: ThemeColors;
	isDark: boolean;
	mode: ThemeMode;
	toggleTheme: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [mode, setMode] = useState<ThemeMode>('light');

	const value = useMemo<ThemeModeContextValue>(() => ({
		colors: colorByMode[mode],
		isDark: mode === 'dark',
		mode,
		toggleTheme: () => setMode(current => current === 'dark' ? 'light' : 'dark'),
	}), [mode]);

	return (
		<ThemeModeContext.Provider value={value}>
			{children}
		</ThemeModeContext.Provider>
	);
};

export const useAppTheme = () => {
	const value = useContext(ThemeModeContext);
	if (!value) {
		return {
			colors: Theme.colors,
			isDark: false,
			mode: 'light' as ThemeMode,
			toggleTheme: () => undefined,
		};
	}
	return value;
};
