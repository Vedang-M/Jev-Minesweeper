import assert from "node:assert";

console.log("Testing benchmark metric calculations and statistical estimators...");

type DecisionRecord = {
    isValid: boolean;
    isSafe: boolean;
    guaranteedSafeExisted: boolean;
    matchedGuaranteedSafe: boolean;
    latencyMs: number;
    confidence: number | null;
    cost: number;
};

type GameSummary = {
    won: boolean;
    decisionsCount: number;
    decisions: DecisionRecord[];
};

function computeMetrics(games: GameSummary[]) {
    const totalGames = games.length;
    const wins = games.filter((g) => g.won).length;
    const losses = totalGames - wins;
    const winRate = totalGames > 0 ? wins / totalGames : 0;

    const allDecisions = games.flatMap((g) => g.decisions);
    const totalDecisions = allDecisions.length;

    const validDecisions = allDecisions.filter((d) => d.isValid).length;
    const validRate = totalDecisions > 0 ? validDecisions / totalDecisions : 0;

    const safeMoves = allDecisions.filter((d) => d.isValid && d.isSafe).length;
    const safeRate = validDecisions > 0 ? safeMoves / validDecisions : 0;

    const mineHits = allDecisions.filter((d) => d.isValid && !d.isSafe).length;
    const mineHitRate = validDecisions > 0 ? mineHits / validDecisions : 0;

    const situationsWithGuaranteed = allDecisions.filter((d) => d.guaranteedSafeExisted).length;
    const guaranteedSafeRate = totalDecisions > 0 ? situationsWithGuaranteed / totalDecisions : 0;

    const matchedGuaranteed = allDecisions.filter((d) => d.matchedGuaranteedSafe).length;
    const matchGuaranteedRate = situationsWithGuaranteed > 0 ? matchedGuaranteed / situationsWithGuaranteed : 0;

    const latencies = allDecisions.map((d) => d.latencyMs).sort((a, b) => a - b);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const medianLatency = latencies.length > 0 ? latencies[Math.floor(latencies.length / 2)] : 0;

    const totalCost = allDecisions.reduce((sum, d) => sum + (d.cost || 0), 0);

    return {
        totalGames,
        wins,
        losses,
        winRate,
        totalDecisions,
        validDecisions,
        validRate,
        safeRate,
        mineHitRate,
        guaranteedSafeRate,
        matchGuaranteedRate,
        avgLatency,
        medianLatency,
        totalCost,
    };
}

// Test metrics calculation
const sampleGames: GameSummary[] = [
    {
        won: true,
        decisionsCount: 2,
        decisions: [
            { isValid: true, isSafe: true, guaranteedSafeExisted: false, matchedGuaranteedSafe: false, latencyMs: 120, confidence: 0.8, cost: 0.00001 },
            { isValid: true, isSafe: true, guaranteedSafeExisted: true, matchedGuaranteedSafe: true, latencyMs: 140, confidence: 0.9, cost: 0.00001 },
        ],
    },
    {
        won: false,
        decisionsCount: 1,
        decisions: [
            { isValid: true, isSafe: false, guaranteedSafeExisted: true, matchedGuaranteedSafe: false, latencyMs: 100, confidence: 0.5, cost: 0.00001 },
        ],
    },
];

const metrics = computeMetrics(sampleGames);
assert.strictEqual(metrics.totalGames, 2);
assert.strictEqual(metrics.wins, 1);
assert.strictEqual(metrics.losses, 1);
assert.strictEqual(metrics.winRate, 0.5);
assert.strictEqual(metrics.totalDecisions, 3);
assert.strictEqual(metrics.validDecisions, 3);
assert.strictEqual(metrics.validRate, 1.0);
assert.strictEqual(metrics.safeRate, 2 / 3);
assert.strictEqual(metrics.mineHitRate, 1 / 3);
assert.strictEqual(metrics.guaranteedSafeRate, 2 / 3);
assert.strictEqual(metrics.matchGuaranteedRate, 1 / 2);
assert.strictEqual(metrics.medianLatency, 120);
assert.strictEqual(Math.round(metrics.avgLatency), 120);
assert.strictEqual(Math.abs(metrics.totalCost - 0.00003) < 1e-9, true, "Total cost within epsilon");

console.log("  ✓ Metric calculations: denominators, rates, percentiles, and costs accurately computed");

