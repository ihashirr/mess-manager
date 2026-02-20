import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SETTINGS } from '../constants/Settings';
import { db } from '../firebase/config';
import mockMenu from '../mocks/menu.json';

export default function MenuScreen() {
	const [isEditing, setIsEditing] = useState(false);
	const [lunch, setLunch] = useState("");
	const [dinner, setDinner] = useState("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (SETTINGS.USE_MOCKS) {
			setLunch(mockMenu.lunch);
			setDinner(mockMenu.dinner);
			setLoading(false);
			return;
		}

		// Listen to the 'today' document in the 'menu' collection
		const unsub = onSnapshot(doc(db, "menu", "today"), (docSnap) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				setLunch(data.lunch || "");
				setDinner(data.dinner || "");
			} else {
				// Fallback or initialization
				setLunch("Not decided yet");
				setDinner("Not decided yet");
			}
			setLoading(false);
		});

		return () => unsub();
	}, []);

	const handleSave = async () => {
		try {
			await setDoc(doc(db, "menu", "today"), {
				lunch: lunch,
				dinner: dinner,
				updatedAt: new Date().toISOString()
			});
			setIsEditing(false);
		} catch (error) {
			console.error("Error saving menu:", error);
		}
	};

	if (loading) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator size="large" color="#000" />
			</View>
		);
	}

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<View style={styles.header}>
				<Text style={styles.title}>Menu Setup</Text>
				<TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
					<MaterialCommunityIcons
						name={isEditing ? "close-circle" : "cog"}
						size={32}
						color={isEditing ? "#d32f2f" : "#666"}
					/>
				</TouchableOpacity>
			</View>

			<View style={styles.section}>
				<Text style={styles.label}>LUNCH TODAY - دوپہر کا کھانا</Text>
				{isEditing ? (
					<TextInput
						style={styles.input}
						value={lunch}
						onChangeText={setLunch}
						multiline
						placeholder="Type lunch menu..."
					/>
				) : (
					<Text style={styles.menuValue}>{lunch || "None"}</Text>
				)}
			</View>

			<View style={styles.divider} />

			<View style={styles.section}>
				<Text style={styles.label}>DINNER TODAY - رات کا کھانا</Text>
				{isEditing ? (
					<TextInput
						style={styles.input}
						value={dinner}
						onChangeText={setDinner}
						multiline
						placeholder="Type dinner menu..."
					/>
				) : (
					<Text style={styles.menuValue}>{dinner || "None"}</Text>
				)}
			</View>

			{isEditing && (
				<TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
					<Text style={styles.saveBtnText}>SAVE - محفوظ کریں</Text>
				</TouchableOpacity>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	content: {
		padding: 25,
	},
	centered: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 40,
		marginTop: 10,
	},
	title: {
		fontSize: 28,
		fontWeight: 'bold',
		color: '#1a1a1a',
	},
	section: {
		marginBottom: 30,
	},
	label: {
		fontSize: 16,
		fontWeight: '800',
		color: '#d32f2f',
		marginBottom: 15,
		letterSpacing: 1,
	},
	menuValue: {
		fontSize: 48,
		fontWeight: '900',
		color: '#000',
		lineHeight: 56,
	},
	input: {
		fontSize: 24,
		borderWidth: 2,
		borderColor: '#eee',
		borderRadius: 12,
		padding: 15,
		minHeight: 100,
		backgroundColor: '#f8f9fa',
		textAlignVertical: 'top',
	},
	divider: {
		height: 2,
		backgroundColor: '#f0f0f0',
		marginBottom: 30,
	},
	saveBtn: {
		backgroundColor: '#2e7d32',
		padding: 20,
		borderRadius: 15,
		alignItems: 'center',
		marginTop: 20,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 5,
	},
	saveBtnText: {
		color: '#fff',
		fontSize: 22,
		fontWeight: '900',
	}
});
