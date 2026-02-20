import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function MenuScreen() {
	const [lunch, setLunch] = useState("Chicken Biryani");
	const [dinner, setDinner] = useState("Daal + Roti");
	const [isEditing, setIsEditing] = useState(false);

	return (
		<View style={styles.container}>
			{/* Top Header Row */}
			<View style={styles.header}>
				<Text style={styles.title}>Daily Menu</Text>
				<TouchableOpacity
					style={styles.settingsBtn}
					onPress={() => setIsEditing(!isEditing)}
				>
					<Text style={styles.settingsText}>{isEditing ? "✕" : "⚙"}</Text>
				</TouchableOpacity>
			</View>

			{isEditing ? (
				<View style={styles.form}>
					<Text style={styles.label}>Lunch Menu</Text>
					<TextInput
						style={styles.input}
						value={lunch}
						onChangeText={setLunch}
						placeholder="What's for lunch?"
					/>

					<Text style={styles.label}>Dinner Menu</Text>
					<TextInput
						style={styles.input}
						value={dinner}
						onChangeText={setDinner}
						placeholder="What's for dinner?"
					/>

					<TouchableOpacity
						style={styles.saveBtn}
						onPress={() => setIsEditing(false)}
					>
						<Text style={styles.saveBtnText}>SAVE - محفوظ کریں</Text>
					</TouchableOpacity>
				</View>
			) : (
				<View style={styles.display}>
					<View style={styles.menuSection}>
						<Text style={styles.label}>LUNCH TODAY</Text>
						<Text style={styles.menuText}>{lunch}</Text>
					</View>

					<View style={styles.menuSection}>
						<Text style={styles.label}>DINNER TODAY</Text>
						<Text style={styles.menuText}>{dinner}</Text>
					</View>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#fff',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 40,
	},
	title: {
		fontSize: 28,
		fontWeight: 'bold',
	},
	settingsBtn: {
		padding: 10,
	},
	settingsText: {
		fontSize: 28,
	},
	display: {
		flex: 1,
	},
	menuSection: {
		marginBottom: 40,
	},
	label: {
		fontSize: 16,
		color: '#666',
		fontWeight: 'bold',
		marginBottom: 10,
		letterSpacing: 1,
	},
	menuText: {
		fontSize: 32,
		fontWeight: '800',
		color: '#1a1a1a',
	},
	form: {
		flex: 1,
	},
	input: {
		borderWidth: 2,
		borderColor: '#eee',
		borderRadius: 12,
		padding: 20,
		fontSize: 20,
		marginBottom: 30,
		backgroundColor: '#f9f9f9',
	},
	saveBtn: {
		backgroundColor: '#1a1a1a',
		padding: 20,
		borderRadius: 12,
		alignItems: 'center',
		marginTop: 10,
	},
	saveBtnText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
	}
});
