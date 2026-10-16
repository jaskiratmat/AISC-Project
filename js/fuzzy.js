/**
 * Fuzzy Logic Traffic Controller
 * By: Jaskirat Singh and Rishi Bhardwaj
 * 
 * 1. Fuzzification: Converts crisp inputs to membership values [0, 1]
 * 2. Inference: Evaluates 9 IF-THEN Mamdani rules
 * 3. Defuzzification: Computes crisp green light duration (seconds) via Weighted Average
 */


class FuzzyTrafficController {
  trimf(x, a, b, c) {
    if (a === b && b === c) return x === b ? 1 : 0;

    if (a === b) {
      if (x <= b) return 1;
      if (x >= c) return 0;
      return (c - x) / (c - b);
    }

    if (b === c) {
      if (x <= a) return 0;
      if (x >= b) return 1;
      return (x - a) / (b - a);
    }

    if (x <= a || x >= c) return 0;
    if (x === b) return 1;
    if (x < b) return (x - a) / (b - a);
    return (c - x) / (c - b);
  }

  getQueueMembership(queue) {
    return {
      short: this.trimf(queue, 0, 0, 7),
      medium: this.trimf(queue, 3, 9, 15),
      long: this.trimf(queue, 10, 20, 20)
    };
  }

  getRateMembership(rate) {
    return {
      low: this.trimf(rate, 0, 0, 20),
      medium: this.trimf(rate, 12, 25, 38),
      high: this.trimf(rate, 30, 50, 50)
    };
  }

  compute(queue, arrivalRate) {
    if (!Number.isFinite(queue) || !Number.isInteger(queue)) {
      throw new TypeError("Queue must be a finite integer.");
    }

    if (queue < 0 || queue > 20) {
      throw new RangeError("Queue must be between 0 and 20 cars.");
    }

    if (!Number.isFinite(arrivalRate)) {
      throw new TypeError("Arrival rate must be a finite number.");
    }

    if (arrivalRate < 5 || arrivalRate > 50) {
      throw new RangeError("Arrival rate must be between 5 and 50 cars per minute.");
    }

    const qMF = this.getQueueMembership(queue);
    const rMF = this.getRateMembership(arrivalRate);

    const rules = [
      { rate: "low", queue: "short", outVal: 10, name: "Low rate and short queue" },
      { rate: "low", queue: "medium", outVal: 15, name: "Low rate and medium queue" },
      { rate: "low", queue: "long", outVal: 20, name: "Low rate and long queue" },

      { rate: "medium", queue: "short", outVal: 15, name: "Medium rate and short queue" },
      { rate: "medium", queue: "medium", outVal: 20, name: "Medium rate and medium queue" },
      { rate: "medium", queue: "long", outVal: 25, name: "Medium rate and long queue" },

      { rate: "high", queue: "short", outVal: 20, name: "High rate and short queue" },
      { rate: "high", queue: "medium", outVal: 25, name: "High rate and medium queue" },
      { rate: "high", queue: "long", outVal: 30, name: "High rate and long queue" }
    ];

    let totalWeight = 0;
    let weightedSum = 0;
    let dominantRule = null;
    let maxWeight = 0;

    for (const rule of rules) {
      const weight = Math.min(
        rMF[rule.rate],
        qMF[rule.queue]
      );

      rule.weight = weight;

      if (weight > 0) {
        weightedSum += weight * rule.outVal;
        totalWeight += weight;

        if (weight > maxWeight) {
          maxWeight = weight;
          dominantRule = rule;
        }
      }
    }

    let greenTime = totalWeight > 0
      ? Math.round(weightedSum / totalWeight)
      : 15;

    greenTime = Math.max(10, Math.min(30, greenTime));

    return {
      greenTime,
      queue,
      arrivalRate,
      queueMF: qMF,
      rateMF: rMF,
      dominantRule: dominantRule || rules[4],
      dominantWeight: maxWeight,
      rules
    };
  }
}

const controller = new FuzzyTrafficController();

console.log(controller.compute(6, 30));

