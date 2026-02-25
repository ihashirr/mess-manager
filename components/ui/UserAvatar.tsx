import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface UserAvatarProps {
	name: string;
	size?: number;
	fontSize?: number;
}

const AVATAR_COLORS = [
	'#FF8E3C', // Electric Amber
	'#3BC9DB', // Vibrant Sky Blue
	'#1E8E6E', // Emerald
	'#B45353', // Muted Red
	'#A24A4A', // Rust
	'#2E5E82', // Steel Blue
	'#0F766E', // Dark Aqua
];

export const UserAvatar: React.FC<UserAvatarProps> = ({
	name,
	size = 40,
	fontSize = 16
}) => {
	const getInitials = (n: string) => {
		const parts = n.trim().split(' ');
		if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	};

	const getColor = (n: string) => {
		let hash = 0;
		for (let i = 0; i < n.length; i++) {
			hash = n.charCodeAt(i) + ((hash << 5) - hash);
		}
		const index = Math.abs(hash) % AVATAR_COLORS.length;
		return AVATAR_COLORS[index];
	};

	const bgColor = getColor(name);
	const initials = getInitials(name);

	return (
		<View
			style={[
				styles.container,
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: bgColor + '20', // 20% opacity bg
					borderColor: bgColor + '40', // 40% opacity border
				}
			]}
		>
			<Text
				style={[
					styles.text,
					{
						fontSize,
						color: bgColor,
						textShadowColor: bgColor,
						textShadowOffset: { width: 0, height: 0 },
						textShadowRadius: 4,
					}
				]}
			>
				{initials}
			</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 1,
	},
	text: {
		fontWeight: '800',
		letterSpacing: 0.5,
	},
});
