function euclideanDistance(arr1, arr2) {
  if (arr1.length !== arr2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    let diff = arr1[i] - arr2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Tolerance for face matching. Usually 0.6 is good for face-api.js 128D embeddings.
const FACE_MATCH_THRESHOLD = 0.5;

function findBestMatch(targetEmbedding, knownUsers) {
  let bestMatch = null;
  let lowestDistance = Infinity;

  for (const user of knownUsers) {
    if (!user.embeddings || user.embeddings.length === 0) continue;
    
    const distance = euclideanDistance(targetEmbedding, user.embeddings);
    if (distance < lowestDistance) {
      lowestDistance = distance;
      bestMatch = user;
    }
  }

  if (lowestDistance <= FACE_MATCH_THRESHOLD) {
    // Confidence is loosely inversely proportional to distance
    const confidence = Math.max(0, 1 - lowestDistance); 
    return { user: bestMatch, distance: lowestDistance, confidence };
  }
  return { user: null, distance: lowestDistance, confidence: 0 };
}

module.exports = { euclideanDistance, findBestMatch, FACE_MATCH_THRESHOLD };
