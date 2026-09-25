import { ScrollView, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";

type Review = {
  id: string;
  rating: number;
  comment: string;
  author: string;
  date: string;
};

const allReviews: Review[] = [
  {
    id: "1",
    rating: 5,
    comment:
      "Excellent quality and great comfort. These are exactly what I needed for my daily routine.",
    author: "Sarah M.",
    date: "2025-09-18",
  },
  {
    id: "2",
    rating: 4.5,
    comment:
      "Great value for the price. The design is sleek and it works perfectly.",
    author: "James T.",
    date: "2025-09-10",
  },
  {
    id: "3",
    rating: 4,
    comment: "Good product overall. Quick delivery and the quality is solid.",
    author: "Priya K.",
    date: "2025-09-05",
  },
];

function renderStars(rating: number) {
  const stars: string[] = [];
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  for (let i = 0; i < full; i++) stars.push("★");
  if (half) stars.push("★");
  while (stars.length < 5) stars.push("☆");
  return stars.map((s, i) => (
    <ThemedText key={i} style={{ color: "#D5A021", fontSize: 13 }}>
      {s}
    </ThemedText>
  ));
}

export default function ReviewsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>All Reviews</ThemedText>
          <ThemedText style={styles.count}>
            {allReviews.length} reviews
          </ThemedText>
        </View>

        {allReviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.starsRow}>{renderStars(review.rating)}</View>
              <ThemedText style={styles.reviewRating}>
                {review.rating.toFixed(1)}
              </ThemedText>
            </View>
            <ThemedText style={styles.reviewComment}>
              {review.comment}
            </ThemedText>
            <View style={styles.reviewFooter}>
              <ThemedText style={styles.reviewAuthor}>
                {review.author}
              </ThemedText>
              <ThemedText style={styles.reviewDate}>
                {review.date}
              </ThemedText>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    color: "#17211D",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  count: { color: "#6E786F", fontSize: 14, fontWeight: "700" },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E0E4DC",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  starsRow: { flexDirection: "row", gap: 1 },
  reviewRating: {
    color: "#17211D",
    fontSize: 13,
    fontWeight: "700",
  },
  reviewComment: {
    color: "#17211D",
    fontSize: 14,
    lineHeight: 20,
  },
  reviewFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  reviewAuthor: {
    color: "#17211D",
    fontSize: 13,
    fontWeight: "700",
  },
  reviewDate: {
    color: "#6E786F",
    fontSize: 12,
  },
});
