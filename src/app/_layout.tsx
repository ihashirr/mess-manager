import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Theme } from '../constants/Theme';
import { AppThemeProvider, useAppTheme } from '../context/ThemeModeContext';

type MainTabName = 'index' | 'customers' | 'finance' | 'payments';

const MAIN_TABS: {
	name: MainTabName;
	label: string;
	icon: keyof typeof MaterialCommunityIcons.glyphMap;
	activeIcon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
	{
		name: 'index',
		label: 'Home',
		icon: 'silverware-variant',
		activeIcon: 'silverware-fork-knife',
	},
	{
		name: 'customers',
		label: 'Clients',
		icon: 'account-group-outline',
		activeIcon: 'account-group',
	},
	{
		name: 'finance',
		label: 'Finance',
		icon: 'wallet-outline',
		activeIcon: 'wallet',
	},
	{
		name: 'payments',
		label: 'Payments',
		icon: 'cash',
		activeIcon: 'cash-check',
	},
];

export default function TabLayout() {
	return (
		<AppThemeProvider>
			<TabLayoutContent />
		</AppThemeProvider>
	);
}

function TabLayoutContent() {
	const { colors } = useAppTheme();

	return (
		<GestureHandlerRootView style={[styles.root, { backgroundColor: colors.bg }]}>
			<Tabs
				screenOptions={{
					headerShown: false,
					tabBarActiveTintColor: colors.primary,
					tabBarInactiveTintColor: colors.textMuted,
					tabBarLabelStyle: styles.tabLabel,
				}}
				tabBar={(props) => <BottomDock {...props} />}
			>
				<Tabs.Screen
					name="index"
					options={{
						title: 'Home',
						tabBarIcon: ({ color, focused }) => (
							<MaterialCommunityIcons
								name={focused ? "silverware-fork-knife" : "silverware-variant"}
								color={color}
								size={24}
							/>
						),
					}}
				/>
				<Tabs.Screen
					name="customers"
					options={{
						title: 'Clients',
						tabBarIcon: ({ color, focused }) => (
							<MaterialCommunityIcons
								name={focused ? "account-group" : "account-group-outline"}
								color={color}
								size={24}
							/>
						),
					}}
				/>
				<Tabs.Screen
					name="payments"
					options={{
						title: 'Payments',
					}}
				/>
				<Tabs.Screen
					name="finance"
					options={{
						title: 'Finance',
						tabBarIcon: ({ color, focused }) => (
							<MaterialCommunityIcons
								name={focused ? "wallet" : "wallet-outline"}
								color={color}
								size={24}
							/>
						),
					}}
				/>
				<Tabs.Screen
					name="menu"
					options={{
						title: 'Menu',
						href: null,
					}}
				/>
			</Tabs>
		</GestureHandlerRootView>
	);
}

function BottomDock({
	state,
	descriptors,
	navigation,
}: BottomTabBarProps) {
	const { colors, isDark } = useAppTheme();
	const activeRoute = state.routes[state.index]?.name;
	const blurAvailable = Platform.OS !== 'android';

	const navigateToTab = (name: MainTabName) => {
		const route = state.routes.find((item) => item.name === name);
		if (!route) return;

		const event = navigation.emit({
			type: 'tabPress',
			target: route.key,
			canPreventDefault: true,
		});

		if (!event.defaultPrevented) {
			navigation.navigate(route.name, route.params);
		}
	};

	return (
		<View
			style={[
				styles.tabBarShell,
				{
					borderColor: colors.border,
					shadowColor: colors.primary,
				},
			]}
		>
			{blurAvailable ? (
				<BlurView
					intensity={isDark ? 60 : 72}
					tint={isDark ? 'dark' : 'light'}
					style={StyleSheet.absoluteFillObject}
				/>
			) : null}
			<View
				style={[
					styles.tabBarGlow,
					{
						backgroundColor: blurAvailable
							? isDark ? 'rgba(33, 26, 22, 0.72)' : 'rgba(255, 255, 255, 0.72)'
							: isDark ? 'rgba(33, 26, 22, 0.94)' : 'rgba(255, 255, 255, 0.96)',
					},
				]}
			/>
			{MAIN_TABS.map((tab) => {
				const route = state.routes.find((item) => item.name === tab.name);
				const focused = activeRoute === tab.name;
				const descriptor = route ? descriptors[route.key] : undefined;

				return (
					<DockItem
						key={tab.name}
						label={tab.label}
						icon={focused ? tab.activeIcon : tab.icon}
						focused={focused}
						onPress={() => navigateToTab(tab.name)}
						accessibilityLabel={descriptor?.options.tabBarAccessibilityLabel ?? tab.label}
					/>
				);
			})}
		</View>
	);
}

function DockItem({
	label,
	icon,
	focused,
	onPress,
	accessibilityLabel,
}: {
	label: string;
	icon: keyof typeof MaterialCommunityIcons.glyphMap;
	focused: boolean;
	onPress: () => void;
	accessibilityLabel?: string;
}) {
	const { colors } = useAppTheme();
	const itemColor = focused ? colors.primary : colors.textMuted;

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.tabItem,
				focused && {
					backgroundColor: colors.surfaceElevated,
					borderColor: colors.border,
				},
				pressed && { opacity: Theme.opacity.active },
			]}
			accessibilityRole="button"
			accessibilityState={focused ? { selected: true } : {}}
			accessibilityLabel={accessibilityLabel}
		>
			<MaterialCommunityIcons name={icon} color={itemColor} size={23} />
			<Text style={[styles.tabLabel, { color: focused ? colors.textPrimary : colors.textMuted }]}>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	tabBarShell: {
		position: 'absolute',
		bottom: Theme.spacing.huge,
		left: Theme.spacing.screen,
		right: Theme.spacing.screen,
		height: 74,
		borderRadius: Theme.radius.lg,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: Theme.spacing.sm,
		gap: Theme.spacing.sm,
		borderWidth: 1.5,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 12,
		elevation: 8,
		overflow: 'hidden',
	},
	tabBarGlow: {
		...StyleSheet.absoluteFillObject,
	},
	tabLabel: {
		...Theme.typography.detailBold,
		fontSize: 12,
		letterSpacing: 0,
	},
	tabItem: {
		flex: 1,
		height: 58,
		borderRadius: Theme.radius.md,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 3,
		borderWidth: 1,
		borderColor: 'transparent',
	},
});
