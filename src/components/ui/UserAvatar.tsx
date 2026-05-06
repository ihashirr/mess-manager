import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface UserAvatarProps {
	name: string;
	size?: number;
	fontSize?: number;
}

const AVATAR_COLORS = [
	'#E28B5B',
	'#6EA8B5',
	'#6C9A7A',
	'#C97D7D',
	'#B7896C',
	'#738DA8',
	'#6E9A92',
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
					backgroundColor: bgColor + '1A',
					borderColor: bgColor + '36',
				}
			]}
		>
			<Text
				style={[
					styles.text,
					{
						fontSize,
						color: bgColor,
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
