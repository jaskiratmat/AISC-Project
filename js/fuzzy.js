/**
 * Fuzzy Logic Traffic Controller
 * By: Jaskirat Singh and Rishi Bhardwaj
 * 
 * 1. Fuzzification: Converts crisp inputs to membership values [0, 1]
 * 2. Inference: Evaluates 9 IF-THEN Mamdani rules
 * 3. Defuzzification: Computes crisp green light duration (seconds) via Weighted Average
 */

class FuzzyTrafficController {
  // Triangular Membership Function: trimf(x, a, b, c)
  // Returns a value between 0.0 and 1.0
  trimf(x, a, b, c) {
    if (x <= a || x >= c) return 0.0;
    if (x === b) return 1.0;
    if (x > a && x < b) return (x - a) / (b - a || 1);
    if (x > b && x < c) return (c - x) / (c - b || 1);
    return 0.0;
  }

  // Fuzzify Queue Length (cars waiting, range 0 to 20)
  getQueueMembership(queue) {
    return {
      short:  this.trimf(queue, 0, 0, 7),
      medium: this.trimf(queue, 3, 9, 15),
      long:   this.trimf(queue, 10, 20, 20)
    };
  }

  // Fuzzify Traffic Arrival Rate (cars/minute, range 5 to 50)
  getRateMembership(rate) {
    return {
      low:    this.trimf(rate, 0, 0, 20),
      medium: this.trimf(rate, 12, 25, 38),
      high:   this.trimf(rate, 30, 50, 50)
    };
  }

  // Evaluate the 9 Fuzzy Rules and Defuzzify
  compute(queue, arrivalRate) {
    const qMF = this.getQueueMembership(queue);
    const rMF = this.getRateMembership(arrivalRate);

    // Rule Base: 9 IF-THEN Rules
    // Output singletons: Short (10s), Medium-Short (15s), Medium (20s), Medium-Long (25s), Long (30s)
    const rules = [
      { rate: 'low',  queue: 'short',  outVal: 10, name: 'IF Rate is LOW & Queue is SHORT THEN Green = 10s' },
      { rate: 'low',  queue: 'medium', outVal: 15, name: 'IF Rate is LOW & Queue is MEDIUM THEN Green = 15s' },
      { rate: 'low',  queue: 'long',   outVal: 20, name: 'IF Rate is LOW & Queue is LONG THEN Green = 20s' },

      { rate: 'medium', queue: 'short',  outVal: 15, name: 'IF Rate is MED & Queue is SHORT THEN Green = 15s' },
      { rate: 'medium', queue: 'medium', outVal: 20, name: 'IF Rate is MED & Queue is MEDIUM THEN Green = 20s' },
      { rate: 'medium', queue: 'long',   outVal: 25, name: 'IF Rate is MED & Queue is LONG THEN Green = 25s' },

      { rate: 'high', queue: 'short',  outVal: 20, name: 'IF Rate is HIGH & Queue is SHORT THEN Green = 20s' },
      { rate: 'high', queue: 'medium', outVal: 25, name: 'IF Rate is HIGH & Queue is MEDIUM THEN Green = 25s' },
      { rate: 'high', queue: 'long',   outVal: 30, name: 'IF Rate is HIGH & Queue is LONG THEN Green = 30s' }
    ];

    let totalWeight = 0;
    let weightedSum = 0;
    let dominantRule = null;
    let maxWeight = -1;

    // Inference (Mamdani MIN operator for AND)
    for (const rule of rules) {
      const weight = Math.min(rMF[rule.rate], qMF[rule.queue]);
      rule.weight = weight;

      if (weight > 0) {
        weightedSum += weight * rule.outVal;
        totalWeight += weight;
      }

      if (weight > maxWeight) {
        maxWeight = weight;
        dominantRule = rule;
      }
    }

    // Defuzzification: Weighted Average Method
    let greenTime = (totalWeight > 0) ? Math.round(weightedSum / totalWeight) : 15;
    greenTime = Math.max(10, Math.min(30, greenTime)); // Clamped between 10s and 30s

    return {
      greenTime,
      queue,
      arrivalRate,
      queueMF: qMF,
      rateMF: rMF,
      dominantRule: dominantRule && maxWeight > 0 ? dominantRule : rules[4], // default medium rule
      dominantWeight: Math.max(0, maxWeight)
    };
  }
}
