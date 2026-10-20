import * as fs from "fs";
import * as path from "path";
import {
    generateDeterministicBoard,
    revealBoardCell,
    isGameWon,
    getClassicalMove,
    getJevMove,
    DecisionLog,
} from "./benchmarkEngine";
import { Difficulty } from "../src/game/boards";
import { solveConstraints } from "../src/game/constraintSolver";
import { extractConstraints } from "../src/game/constraints";

// Wilson score interval for proportions (95% confidence)
function wilsonScoreInterval(successes: number, total: number, z: number = 1.96): [number, number] {
    if (total === 0) return [0, 0];
    const p = successes / total;
    const denominator = 1 + (z * z) / total;
    const center = p + (z * z) / (2 * total);
    const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
    const lower = Math.max(0, (center - margin) / denominator);
    const upper = Math.min(1, (center + margin) / denominator);
    return [Number(lower.toFixed(4)), Number(upper.toFixed(4))];
}

async function runBenchmark() {
    const isSmoke = process.argv.includes("--smoke");
    const trialArgIdx = process.argv.indexOf("--trials");
    const trialsPerDifficulty = isSmoke
        ? 1
        : trialArgIdx !== -1 && process.argv[trialArgIdx + 1]
        ? parseInt(process.argv[trialArgIdx + 1], 10)
        : 3; // Default 3 reproducible games per difficulty to balance informative depth vs API costs

    console.log(`\n======================================================`);
    console.log(`  JEV vs. Classical Minesweeper Benchmark Runner`);
    console.log(`  Mode: ${isSmoke ? "SMOKE TEST (1 trial/difficulty)" : `EVALUATION (${trialsPerDifficulty} trials/difficulty)`}`);
    console.log(`======================================================\n`);

    // Read API key
    let apiKey = process.env.OPENROUTER_API_KEY || "";
    if (!apiKey && fs.existsSync(".env.local")) {
        const envContent = fs.readFileSync(".env.local", "utf8");
        const match = envContent.match(/OPENROUTER_API_KEY=(.+)/);
        if (match) apiKey = match[1].trim();
    }

    if (!apiKey) {
        console.error("FATAL: OPENROUTER_API_KEY not found in process.env or .env.local.");
        process.exit(1);
    }

    const experimentId = `exp_${Date.now()}`;
    const resultsDir = path.resolve(process.cwd(), "results");
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    const rawLogs: DecisionLog[] = [];
    const difficulties: Difficulty[] = ["easy", "medium", "hard"];
    const baseSeed = 42;

    // Diagnostic snapshot evaluations (Decision 1 on identical board states)
    console.log(`\n--- Phase 1: First-Move Diagnostic Snapshots ---`);
    for (const diff of difficulties) {
        for (let t = 0; t < trialsPerDifficulty; t++) {
            const seed = baseSeed + t * 100;
            const fullBoard = generateDeterministicBoard(diff, seed, 0, 0);
            const initialReveal = revealBoardCell(fullBoard, 0, 0);

            // Compute ground truth guaranteed moves
            const cConstraints = extractConstraints(initialReveal.board);
            const cResult = solveConstraints(cConstraints);
            const guaranteedMoves = cResult.safeCells;
            const guaranteedExisted = guaranteedMoves.length > 0;

            // Classical decision
            const classicMove = getClassicalMove(initialReveal.board);
            const classicSafe = classicMove.coordinate
                ? !fullBoard[Number(classicMove.coordinate.split("-")[0])][Number(classicMove.coordinate.split("-")[1])].isMine
                : false;

            rawLogs.push({
                experimentId,
                seed,
                difficulty: diff,
                method: "classical",
                decisionIndex: 1,
                visibleBoardSnapshotId: `${diff}_seed${seed}_snap1`,
                suggestedCoordinate: classicMove.coordinate,
                isValid: Boolean(classicMove.coordinate),
                isSafe: classicSafe,
                guaranteedSafeExisted: guaranteedExisted,
                matchedGuaranteedSafe: guaranteedMoves.includes(classicMove.coordinate),
                latencyMs: 1,
                confidence: classicMove.isGuaranteed ? 1.0 : null,
                apiCost: 0,
                terminalOutcome: classicSafe ? "continue" : "lost",
            });

            // JEV decision
            console.log(`[Diagnostic] Querying JEV on ${diff} (seed ${seed})...`);
            const jevRes = await getJevMove(initialReveal.board, apiKey, new Set());
            const jevCoord = jevRes.coordinate;
            let jevValid = false;
            let jevSafe = false;

            if (jevCoord) {
                const [jr, jc] = jevCoord.split("-").map(Number);
                if (
                    jr >= 0 &&
                    jr < fullBoard.length &&
                    jc >= 0 &&
                    jc < fullBoard[0].length &&
                    !initialReveal.board[jr][jc].isRevealed &&
                    !initialReveal.board[jr][jc].isFlagged
                ) {
                    jevValid = true;
                    jevSafe = !fullBoard[jr][jc].isMine;
                }
            }

            rawLogs.push({
                experimentId,
                seed,
                difficulty: diff,
                method: "jev",
                decisionIndex: 1,
                visibleBoardSnapshotId: `${diff}_seed${seed}_snap1`,
                suggestedCoordinate: jevCoord || "",
                isValid: jevValid,
                isSafe: jevSafe,
                guaranteedSafeExisted: guaranteedExisted,
                matchedGuaranteedSafe: jevCoord ? guaranteedMoves.includes(jevCoord) : false,
                latencyMs: jevRes.latencyMs,
                confidence: jevRes.confidence,
                apiCost: jevRes.cost,
                terminalOutcome: !jevValid ? "invalid" : jevSafe ? "continue" : "lost",
            });
        }
    }

    // Full Game Trials
    console.log(`\n--- Phase 2: Full-Game Evaluation ---`);
    for (const diff of difficulties) {
        for (let t = 0; t < trialsPerDifficulty; t++) {
            const seed = baseSeed + t * 100 + 7;
            console.log(`\nStarting Full Game: ${diff} (Seed: ${seed})`);

            // 1. Classical Game
            {
                const fullBoard = generateDeterministicBoard(diff, seed, 0, 0);
                let current = revealBoardCell(fullBoard, 0, 0);
                let decisionIdx = 1;
                let won = false;

                while (!won && !current.hitMine && decisionIdx <= 100) {
                    if (isGameWon(current.board)) {
                        won = true;
                        break;
                    }

                    const cConstraints = extractConstraints(current.board);
                    const cResult = solveConstraints(cConstraints);
                    const guaranteedMoves = cResult.safeCells;
                    const guaranteedExisted = guaranteedMoves.length > 0;

                    const move = getClassicalMove(current.board);
                    if (!move.coordinate) break;

                    const [r, c] = move.coordinate.split("-").map(Number);
                    const safe = !fullBoard[r][c].isMine;

                    current = revealBoardCell(current.board, r, c);
                    won = isGameWon(current.board);

                    rawLogs.push({
                        experimentId,
                        seed,
                        difficulty: diff,
                        method: "classical",
                        decisionIndex: decisionIdx++,
                        visibleBoardSnapshotId: `${diff}_seed${seed}_dec${decisionIdx}`,
                        suggestedCoordinate: move.coordinate,
                        isValid: true,
                        isSafe: safe,
                        guaranteedSafeExisted: guaranteedExisted,
                        matchedGuaranteedSafe: guaranteedMoves.includes(move.coordinate),
                        latencyMs: 1,
                        confidence: move.isGuaranteed ? 1.0 : null,
                        apiCost: 0,
                        terminalOutcome: won ? "won" : current.hitMine ? "lost" : "continue",
                    });

                    if (current.hitMine) break;
                }
                console.log(`  Classical finished: ${won ? "WON" : "LOST"} in ${decisionIdx - 1} decisions.`);
            }

            // 2. JEV Game
            {
                const fullBoard = generateDeterministicBoard(diff, seed, 0, 0);
                let current = revealBoardCell(fullBoard, 0, 0);
                let decisionIdx = 1;
                let won = false;
                const excluded = new Set<string>();

                while (!won && !current.hitMine && decisionIdx <= 15) { // Cap JEV moves per game to preserve API economy
                    if (isGameWon(current.board)) {
                        won = true;
                        break;
                    }

                    const cConstraints = extractConstraints(current.board);
                    const cResult = solveConstraints(cConstraints);
                    const guaranteedMoves = cResult.safeCells;
                    const guaranteedExisted = guaranteedMoves.length > 0;

                    console.log(`  [JEV] Requesting move #${decisionIdx} on ${diff}...`);
                    const jevRes = await getJevMove(current.board, apiKey, excluded);
                    const jevCoord = jevRes.coordinate;

                    let valid = false;
                    let safe = false;

                    if (jevCoord) {
                        const [jr, jc] = jevCoord.split("-").map(Number);
                        if (
                            jr >= 0 &&
                            jr < fullBoard.length &&
                            jc >= 0 &&
                            jc < fullBoard[0].length &&
                            !current.board[jr][jc].isRevealed &&
                            !current.board[jr][jc].isFlagged &&
                            !excluded.has(jevCoord)
                        ) {
                            valid = true;
                            safe = !fullBoard[jr][jc].isMine;
                        }
                    }

                    if (!valid || !jevCoord) {
                        rawLogs.push({
                            experimentId,
                            seed,
                            difficulty: diff,
                            method: "jev",
                            decisionIndex: decisionIdx,
                            visibleBoardSnapshotId: `${diff}_seed${seed}_dec${decisionIdx}`,
                            suggestedCoordinate: jevCoord || "",
                            isValid: false,
                            isSafe: false,
                            guaranteedSafeExisted: guaranteedExisted,
                            matchedGuaranteedSafe: false,
                            latencyMs: jevRes.latencyMs,
                            confidence: jevRes.confidence,
                            apiCost: jevRes.cost,
                            terminalOutcome: "invalid",
                        });
                        console.log(`  JEV returned invalid or unavailable move: ${jevCoord}. Terminating game.`);
                        break;
                    }

                    const [r, c] = jevCoord.split("-").map(Number);
                    current = revealBoardCell(current.board, r, c);
                    won = isGameWon(current.board);

                    rawLogs.push({
                        experimentId,
                        seed,
                        difficulty: diff,
                        method: "jev",
                        decisionIndex: decisionIdx++,
                        visibleBoardSnapshotId: `${diff}_seed${seed}_dec${decisionIdx}`,
                        suggestedCoordinate: jevCoord,
                        isValid: true,
                        isSafe: safe,
                        guaranteedSafeExisted: guaranteedExisted,
                        matchedGuaranteedSafe: guaranteedMoves.includes(jevCoord),
                        latencyMs: jevRes.latencyMs,
                        confidence: jevRes.confidence,
                        apiCost: jevRes.cost,
                        terminalOutcome: won ? "won" : current.hitMine ? "lost" : "continue",
                    });

                    if (current.hitMine) {
                        console.log(`  JEV hit a mine at (${r}, ${c}). Game lost.`);
                        break;
                    }
                }
                console.log(`  JEV finished: ${won ? "WON" : "LOST"} in ${decisionIdx - 1} decisions.`);
            }
        }
    }

    // Save CSV and JSONL raw records
    const jsonlPath = path.join(resultsDir, `decisions_${experimentId}.jsonl`);
    const csvPath = path.join(resultsDir, `decisions_${experimentId}.csv`);

    const jsonlContent = rawLogs.map((log) => JSON.stringify(log)).join("\n");
    fs.writeFileSync(jsonlPath, jsonlContent, "utf8");

    const csvHeaders = [
        "experimentId",
        "seed",
        "difficulty",
        "method",
        "decisionIndex",
        "visibleBoardSnapshotId",
        "suggestedCoordinate",
        "isValid",
        "isSafe",
        "guaranteedSafeExisted",
        "matchedGuaranteedSafe",
        "latencyMs",
        "confidence",
        "apiCost",
        "terminalOutcome",
    ].join(",");

    const csvRows = rawLogs.map((l) =>
        [
            l.experimentId,
            l.seed,
            l.difficulty,
            l.method,
            l.decisionIndex,
            l.visibleBoardSnapshotId,
            l.suggestedCoordinate,
            l.isValid,
            l.isSafe,
            l.guaranteedSafeExisted,
            l.matchedGuaranteedSafe,
            l.latencyMs,
            l.confidence !== null ? l.confidence.toFixed(4) : "",
            l.apiCost.toFixed(6),
            l.terminalOutcome,
        ].join(",")
    );

    fs.writeFileSync(csvPath, [csvHeaders, ...csvRows].join("\n"), "utf8");

    // Aggregate statistics
    function aggregateMethod(methodName: "classical" | "jev", diff?: Difficulty) {
        const filtered = rawLogs.filter((l) => l.method === methodName && (!diff || l.difficulty === diff));
        const total = filtered.length;
        const valid = filtered.filter((l) => l.isValid).length;
        const safe = filtered.filter((l) => l.isValid && l.isSafe).length;
        const mineHits = filtered.filter((l) => l.isValid && !l.isSafe).length;
        const situationsWithGuaranteed = filtered.filter((l) => l.guaranteedSafeExisted).length;
        const matchedGuaranteed = filtered.filter((l) => l.matchedGuaranteedSafe).length;

        const latencies = filtered.map((l) => l.latencyMs).sort((a, b) => a - b);
        const avgLatency = total > 0 ? latencies.reduce((a, b) => a + b, 0) / total : 0;
        const medianLatency = total > 0 ? latencies[Math.floor(total / 2)] : 0;
        const totalCost = filtered.reduce((s, l) => s + l.apiCost, 0);

        const safeRate = valid > 0 ? safe / valid : 0;
        const validRate = total > 0 ? valid / total : 0;
        const safeRateCi = wilsonScoreInterval(safe, valid);
        const matchGuaranteedRate = situationsWithGuaranteed > 0 ? matchedGuaranteed / situationsWithGuaranteed : 0;

        return {
            totalDecisions: total,
            validDecisions: valid,
            validRate: Number(validRate.toFixed(4)),
            safeRate: Number(safeRate.toFixed(4)),
            safeRateCi95: safeRateCi,
            mineHitRate: valid > 0 ? Number((mineHits / valid).toFixed(4)) : 0,
            guaranteedSafeSituations: situationsWithGuaranteed,
            matchGuaranteedRate: Number(matchGuaranteedRate.toFixed(4)),
            avgLatencyMs: Math.round(avgLatency),
            medianLatencyMs: medianLatency,
            totalCostUsd: Number(totalCost.toFixed(6)),
        };
    }

    const summary = {
        experimentId,
        timestamp: new Date().toISOString(),
        trialsPerDifficulty,
        classicalOverall: aggregateMethod("classical"),
        jevOverall: aggregateMethod("jev"),
        byDifficulty: {
            easy: {
                classical: aggregateMethod("classical", "easy"),
                jev: aggregateMethod("jev", "easy"),
            },
            medium: {
                classical: aggregateMethod("classical", "medium"),
                jev: aggregateMethod("jev", "medium"),
            },
            hard: {
                classical: aggregateMethod("classical", "hard"),
                jev: aggregateMethod("jev", "hard"),
            },
        },
    };

    const summaryPath = path.join(resultsDir, `benchmark_summary_${experimentId}.json`);
    const latestSummaryPath = path.join(resultsDir, "latest_summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
    fs.writeFileSync(latestSummaryPath, JSON.stringify(summary, null, 2), "utf8");

    console.log(`\n======================================================`);
    console.log(`  Benchmark Completed Successfully!`);
    console.log(`  Raw JSONL: ${jsonlPath}`);
    console.log(`  Raw CSV:   ${csvPath}`);
    console.log(`  Summary:   ${summaryPath}`);
    console.log(`======================================================\n`);
    console.log(JSON.stringify(summary, null, 2));
}

runBenchmark().catch((err) => {
    console.error("Benchmark failed:", err);
    process.exit(1);
});
