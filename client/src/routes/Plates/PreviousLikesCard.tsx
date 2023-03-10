import { useLikes } from "@/hooks";
import {
	doc,
	DocumentData,
	getDoc,
	getFirestore,
	DocumentSnapshot,
} from "firebase/firestore";
import { memo, useCallback, useEffect, useState } from "react";
import { FlatList, Image, Text, View } from "react-native";
import { styles } from "./styles";
import { colors } from "@/constants";

export default memo(() => {
	const [plates, setPlates] = useState<DocumentSnapshot<DocumentData>[]>([]);

	const likes = useLikes();
	useEffect(() => {
		async function getPlates() {
			const plateIds =
				likes.data?.docs
					?.splice(0, 4)
					.map((doc) => doc.data().plateId) ?? [];
			const plateDocs = await Promise.all(
				plateIds.map((id: string) =>
					getDoc(doc(getFirestore(), "plates", id)),
				),
			);
			setPlates(plateDocs);
		}
		getPlates();
	}, [likes.data?.docs]);

	const renderItem = useCallback(
		({ item }: { item: DocumentSnapshot<DocumentData> }) => (
			<PreviousLike item={item} />
		),
		[],
	);

	return (
		<View
			style={[
				styles.card,
				{
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-evenly",
					padding: 20,
					backgroundColor: colors.creamLight,
				},
			]}
		>
			<View className="flex flex-col space-y-5 items-center mt-5">
				<Text className="text-2xl font-bold">Previous Likes</Text>
				<Text className="text-md">
					These are some of the plates you liked in the past! Choose
					from the following plates to order online!
				</Text>
			</View>
			<View className="flex flex-row flex-wrap justify-center items-center">
				<FlatList
					data={plates}
					renderItem={renderItem}
					keyExtractor={(item) => item.id}
					contentContainerStyle={{ alignItems: "center" }}
					numColumns={2}
				/>

				<Text className="text-md">
					Or swipe to the right or left to see more plates!
				</Text>
			</View>
		</View>
	);
});

const PreviousLike = memo(
	({ item }: { item: DocumentSnapshot<DocumentData> }) => (
		<View
			style={{
				display: "flex",
				flexDirection: "column",
				height: 150,
				width: 150,
				backgroundColor: colors.black,
				borderRadius: 15,
				margin: 10,
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			<Image
				source={{
					uri: item.data()?.image_url,
				}}
				style={[
					styles.cardImage,
					{
						opacity: 0.8,
						borderRadius: 15,
					},
				]}
			/>
			<Text
				style={[
					styles.price,
					{
						fontSize: 16,
						paddingRight: 5,
						right: 0,
						left: "auto",
						marginBottom: 0,
						paddingBottom: 0,
					},
				]}
			>
				{item.data()?.price}
			</Text>
			<Text
				style={[
					styles.heading,
					{
						fontSize: 16,
						paddingTop: 0,
						top: 0,
						bottom: "auto",
						marginTop: 0,
						left: 0,
						marginBottom: 0,
					},
				]}
			>
				{item.data()?.name}
			</Text>
		</View>
	),
);
