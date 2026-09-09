const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how",
  "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "with",
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalizeText(value)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function shingles(value, size = 4) {
  const words = tokens(value);
  if (words.length < size) return new Set(words);
  const result = new Set();
  for (let index = 0; index <= words.length - size; index += 1) {
    result.add(words.slice(index, index + size).join(" "));
  }
  return result;
}

function jaccard(left, right) {
  if (!left.size && !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function keywordSimilarity(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  return jaccard(new Set(tokens(a)), new Set(tokens(b)));
}

function duplicateScore(candidate, existing) {
  const keyword = keywordSimilarity(
    candidate.normalizedKeyword || candidate.primaryKeyword,
    existing.normalizedKeyword || existing.primaryKeyword
  );
  const title = jaccard(shingles(candidate.title, 2), shingles(existing.title, 2));
  const content = jaccard(
    shingles(candidate.content || candidate.excerpt, 4),
    shingles(existing.content || existing.excerpt, 4)
  );
  const score = keyword * 0.45 + title * 0.35 + content * 0.2;
  return {
    score: Number(score.toFixed(4)),
    keyword: Number(keyword.toFixed(4)),
    title: Number(title.toFixed(4)),
    content: Number(content.toFixed(4)),
    duplicate:
      score >= 0.72 ||
      (title >= 0.85 && content >= 0.5) ||
      (keyword === 1 && title >= 0.8 && content >= 0.45),
  };
}

function findClosestDuplicate(candidate, posts) {
  return (posts || []).reduce(
    (closest, post) => {
      const similarity = duplicateScore(candidate, post);
      return similarity.score > closest.similarity.score
        ? { post, similarity }
        : closest;
    },
    { post: null, similarity: { score: 0, duplicate: false } }
  );
}

module.exports = {
  duplicateScore,
  findClosestDuplicate,
  jaccard,
  keywordSimilarity,
  normalizeText,
  shingles,
};
