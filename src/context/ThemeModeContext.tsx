import React, { createContext, useContext, useMemo, useState } from 'react';
import { Theme } from '../constants/Theme';

type ThemeMode = 'light' | 'dark';
type ThemeColors = typeof Theme.colors;

const darkColors: ThemeColors = {
	...Theme.colors,
	bg: '#0F0D15',
	surface: '#1A1625',
	surfaceElevated: '#231E30',
	border: '#322C40',
	textPrimary: '#FFFFFF',
	textSecondary: '#A9A2BA',
	textMuted: '#6D6580',
	textInverted: '#0F0D15',
	overlay: 'rgba(5, 4, 10, 0.8)',
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
