export function generateSessionSequence(activeChordIds: string[], totalTrials: number): string[] {
  const seq: string[] = [];
  const N = activeChordIds.length;
  const base = Math.floor(totalTrials / N);
  const remainder = totalTrials % N;

  const counts = new Map(activeChordIds.map(id => [id, base]));
  
  // Randomly distribute remainder
  // Use Fisher-Yates for robust shuffling
  const shuffledIds = [...activeChordIds];
  for (let i = shuffledIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
  }

  for (let i = 0; i < remainder; i++) {
    counts.set(shuffledIds[i], counts.get(shuffledIds[i])! + 1);
  }

  // Populate seq
  for (const [id, count] of counts.entries()) {
    for (let i = 0; i < count; i++) {
      seq.push(id);
    }
  }

  // Shuffle the bag thoroughly (Fisher-Yates)
  let valid = false;
  let attempts = 0;
  while (!valid && attempts < 100) {
    for (let i = seq.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seq[i], seq[j]] = [seq[j], seq[i]];
    }
    
    valid = true;
    for (let i = 2; i < seq.length; i++) {
      if (seq[i] === seq[i-1] && seq[i] === seq[i-2]) {
        valid = false;
        break;
      }
    }
    attempts++;
  }

  return seq;
}
