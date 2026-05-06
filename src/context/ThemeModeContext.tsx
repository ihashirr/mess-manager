import React, { createContext, useContext, useMemo, useState } from 'react';
import { Theme } from '../constants/Theme';

type ThemeMode = 'light' | 'dark';
type ThemeColors = typeof Theme.colors;

const darkColors: ThemeColors = {
	...Theme.colors,
	bg: '#16120F',
	surface: '#211A16',
	surfaceElevated: '#2B221D',
	border: '#4A3B31',
	textPrimary: '#FFF6EB',
	textSecondary: '#D7C4B3',
	textMuted: '#9E8E81',
	textInverted: '#16120F',
	overlay: 'rgba(10, 8, 6, 0.9)',
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
