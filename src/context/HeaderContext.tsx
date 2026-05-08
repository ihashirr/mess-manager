import React, { createContext, useContext, useState, ReactNode } from 'react';

interface HeaderConfig {
	title: string;
	subtitle?: string;
	rightAction?: ReactNode;
}

interface HeaderContextType {
	config: HeaderConfig;
	setHeaderConfig: (config: HeaderConfig) => void;
}

const HeaderContext = createContext<HeaderContextType | null>(null);

export const HeaderProvider = ({ children }: { children: ReactNode }) => {
	const [config, setHeaderConfig] = useState<HeaderConfig>({ title: 'Desi Zaiqa' });

	return (
		<HeaderContext.Provider value={{ config, setHeaderConfig }}>
			{children}
		</HeaderContext.Provider>
	);
};

export const useAppHeader = () => {
	const ctx = useContext(HeaderContext);
	if (!ctx) throw new Error('useAppHeader must be used within HeaderProvider');
	return ctx;
};
