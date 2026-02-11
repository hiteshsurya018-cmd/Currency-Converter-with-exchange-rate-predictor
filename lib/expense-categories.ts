export const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Housing",
  "Travel",
  "Health",
  "Education",
  "Personal Care",
  "Other",
]

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Food & Dining": ["restaurant", "cafe", "coffee", "food", "dinner", "lunch", "breakfast", "pizza", "burger"],
  Transportation: ["taxi", "uber", "bus", "train", "metro", "fuel", "gas", "petrol", "parking", "toll"],
  Entertainment: ["movie", "cinema", "concert", "music", "game", "netflix", "spotify", "theatre"],
  Shopping: ["store", "mall", "amazon", "retail", "shopping", "clothes", "apparel", "electronics"],
  Housing: ["rent", "mortgage", "utilities", "electricity", "water", "internet", "maintenance"],
  Travel: ["hotel", "flight", "airbnb", "booking", "airline", "travel"],
  Health: ["pharmacy", "doctor", "clinic", "hospital", "medicine", "health"],
  Education: ["course", "tuition", "school", "college", "university", "books", "training"],
  "Personal Care": ["salon", "spa", "grooming", "gym", "fitness", "barber"],
}

export function suggestExpenseCategory(text: string | null | undefined): string | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category
    }
  }
  return null
}
