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
  Travel: ["hotel", "flight", "airbnb", "booking", "airline", "travel", "lodging", "accommodation", "room", "stay", "resort", "inn", "hostel", "motel"],
  Health: ["pharmacy", "doctor", "clinic", "hospital", "medicine", "health"],
  Education: ["course", "tuition", "school", "college", "university", "books", "training"],
  "Personal Care": ["salon", "spa", "grooming", "gym", "fitness", "barber"],
}

const TRAVEL_PRIORITY_KEYWORDS = ["hotel", "lodging", "accommodation", "resort", "inn", "hostel", "motel"]

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const matchesKeyword = (text: string, keyword: string) => {
  if (keyword.includes(" ")) {
    return text.includes(keyword)
  }
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(text)
}

export function suggestExpenseCategory(text: string | null | undefined): string | null {
  if (!text) return null
  const lower = text.toLowerCase()

  if (TRAVEL_PRIORITY_KEYWORDS.some((keyword) => matchesKeyword(lower, keyword))) {
    return "Travel"
  }

  let bestCategory: string | null = null
  let bestScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((count, keyword) => (matchesKeyword(lower, keyword) ? count + 1 : count), 0)
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  return bestScore > 0 ? bestCategory : null
}
