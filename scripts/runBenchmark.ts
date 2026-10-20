import * as fs from "fs";
import * as path from "path";
import {
    generateDeterministicBoard,
    revealBoardCell,
    isGameWon,
    getClassicalMove,
    getJevMove,
    getLayaMove,
    DecisionLog,
} from "./benchmarkEngine";
import { Difficulty } from "../src/game/boards";
import { solveConstraints } from "../src/game/constraintSolver";
import { extractConstraints } from "../src/game/constraints";

// Wilson score interval for independent proportions (95% confidence)
export function wilsonScoreInterval(successes: number, total: number, z: number = 1.96): [number, number] {
    if (total === 0) return [0, 0];
    const p = successes / total;
    const denominator = 1 + (z * z) / total;
    const center = p + (z * z) / (2 * total);
    const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
    const lower = Math.max(0, (center - margin) / denominator);
    const upper = Math.min(1, (center + margin) / denominator);
    return [Number(lower.toFixed(4)), Number(upper.toFixed(4))];
}

// Game-clustered bootstrap confidence interval for decision-level metrics
// Samples complete games with replacement to account for intra-game correlation
export function clusterBootstrapInterval(
    clusterDecisions: DecisionLog[][],
    metricFn: (decs: DecisionLog[]) => number,
    numResamples: number = 1000,
    alpha: number = 0.05
): [number, number] {
    const n = clusterDecisions.length;
    if (n === 0) return [0, 0];
    if (n === 1) {
        const val = metricFn(clusterDecisions[0]);
        return [Number(val.toFixed(4)), Number(val.toFixed(4))];
    }

    const estimates: number[] = [];
    for (let b = 0; b < numResamples; b++) {
        const sample: DecisionLog[] = [];
        for (let i = 0; i < n; i++) {
            const randIdx = Math.floor(Math.random() * n);
            for (const dec of clusterDecisions[randIdx]) {
                sample.push(dec);
            }
        }
        estimates.push(metricFn(sample));
    }

    estimates.sort((a, b) => a - b);
    const lowerIdx = Math.floor((alpha / 2) * numResamples);
    const upperIdx = Math.ceil((1 - alpha / 2) * numResamples) - 1;
    const lower = Math.max(0, estimates[Math.min(lowerIdx, estimates.length - 1)] || 0);
    const upper = Math.min(1, estimates[Math.min(upperIdx, estimates.length - 1)] || 0);
    return [Number(lower.toFixed(4)), Number(upper.toFixed(4))];
}

export type GameRecord = {
    gameId: string;
    seed: number;
    difficulty: Difficulty;
    method: "classical" | "jev" | "laya";
    won: boolean;
    movesCount: number;
    terminalOutcome: "won" | "lost" | "invalid" | "timeout" | "max_moves";
    totalCost: number;
};

async function runBenchmark() {
    const isSmoke = process.argv.includes("--smoke");
    const trialArgIdx = process.argv.indexOf("--trials");
    const trialsPerDifficulty = isSmoke
        ? 1
        : trialArgIdx !== -1 && process.argv[trialArgIdx + 1]
        ? parseInt(process.argv[trialArgIdx + 1], 10)
        : 100;

    // Filter engines: --engine classical | jev | laya | all (default all)
    const engineArgIdx = process.argv.indexOf("--engine");
    const targetEngine = engineArgIdx !== -1 && process.argv[engineArgIdx + 1]
        ? process.argv[engineArgIdx + 1].toLowerCase()
        : "all";

    const runClassical = targetEngine === "all" || targetEngine === "classical";
    const runJev = targetEngine === "all" || targetEngine === "jev";
    const runLaya = targetEngine === "all" || targetEngine === "laya";

    // Resume functionality: --resume <experimentId>
    const resumeArgIdx = process.argv.indexOf("--resume");
    const resumeExpId = resumeArgIdx !== -1 && process.argv[resumeArgIdx + 1]
        ? process.argv[resumeArgIdx + 1].trim()
        : null;

    const experimentId = resumeExpId || `exp_${Date.now()}`;
    const resultsDir = path.resolve(process.cwd(), "results");
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    const jsonlPath = path.join(resultsDir, `decisions_${experimentId}.jsonl`);
    const csvPath = path.join(resultsDir, `decisions_${experimentId}.csv`);
    const gamesJsonPath = path.join(resultsDir, `games_${experimentId}.json`);

    console.log(`\n======================================================`);
    console.log(`  Three-Way Benchmark: Classical vs. JEV vs. Laya`);
    console.log(`  Experiment ID: ${experimentId} ${resumeExpId ? "(RESUMING)" : ""}`);
    console.log(`  Mode: ${isSmoke ? "SMOKE TEST (1 game/diff)" : `FULL EVALUATION (${trialsPerDifficulty} games/diff)`}`);
    console.log(`  Engines: Classical=${runClassical}, JEV=${runJev}, Laya=${runLaya}`);
    console.log(`======================================================\n`);

    // Load existing completed runs if resuming
    const completedGames = new Set<string>();
    const rawLogs: DecisionLog[] = [];
    const gameRecords: GameRecord[] = [];

    if (fs.existsSync(jsonlPath)) {
        const existingLines = fs.readFileSync(jsonlPath, "utf8").trim().split("\n");
        for (const line of existingLines) {
            if (!line.trim()) continue;
            try {
                const parsed = JSON.parse(line) as DecisionLog;
                rawLogs.push(parsed);
                if (parsed.gameId && parsed.terminalOutcome && parsed.terminalOutcome !== "continue") {
                    completedGames.add(parsed.gameId);
                }
            } catch {
                // ignore malformed line
            }
        }
        console.log(`  [Resume] Loaded ${rawLogs.length} existing decision records (${completedGames.size} completed games).`);
    }

    if (fs.existsSync(gamesJsonPath)) {
        try {
            const parsedGames = JSON.parse(fs.readFileSync(gamesJsonPath, "utf8")) as GameRecord[];
            gameRecords.push(...parsedGames);
            for (const g of parsedGames) completedGames.add(g.gameId);
        } catch {
            // ignore
        }
    }

    // Helper to append a decision record to file safely
    function recordDecision(dec: DecisionLog) {
        rawLogs.push(dec);
        fs.appendFileSync(jsonlPath, JSON.stringify(dec) + "\n", "utf8");
    }

    // Read API key for JEV if needed
    let apiKey = process.env.OPENROUTER_API_KEY || "";
    if (runJev && !apiKey && fs.existsSync(".env.local")) {
        const envContent = fs.readFileSync(".env.local", "utf8");
        const match = envContent.match(/OPENROUTER_API_KEY=(.+)/);
        if (match) apiKey = match[1].trim();
    }

    if (runJev && !apiKey) {
        console.warn("WARNING: OPENROUTER_API_KEY not found. JEV evaluations will be skipped or recorded as error.");
    }

    const layaServiceUrl = process.env.LAYA_SERVICE_URL || "http://127.0.0.1:8000";
    const layaApiKey = process.env.LAYA_API_KEY;

    const difficulties: Difficulty[] = ["easy", "medium", "hard"];
    const baseSeed = 42;

    // --- Phase 1: Diagnostic First-Move Snapshots ---
    // Evaluates all engines on the exact same pristine first-move board state across identical seeds.
    console.log(`\n--- Phase 1: Diagnostic First-Move Snapshots ---`);
    for (const diff of difficulties) {
        for (let t = 0; t < trialsPerDifficulty; t++) {
            const seed = baseSeed + t * 100;
            const fullBoard = generateDeterministicBoard(diff, seed, 0, 0);
            const initialReveal = revealBoardCell(fullBoard, 0, 0);

            // Compute ground truth guaranteed moves using classical constraints
            const cConstraints = extractConstraints(initialReveal.board);
            const cResult = solveConstraints(cConstraints);
            const guaranteedMoves = cResult.safeCells;
            const guaranteedExisted = guaranteedMoves.length > 0;

            // 1. Classical Snapshot
            if (runClassical) {
                const snapGameId = `${experimentId}_snap_${diff}_classical_s${seed}`;
                if (!completedGames.has(snapGameId)) {
                    const classicMove = getClassicalMove(initialReveal.board);
                    const [cr, cc] = classicMove.coordinate.split("-").map(Number);
                    const safe = !fullBoard[cr][cc].isMine;

                    recordDecision({
                        experimentId,
                        gameId: snapGameId,
                        phase: "diagnostic_snapshot",
                        seed,
                        difficulty: diff,
                        method: "classical",
                        decisionIndex: 1,
                        visibleBoardSnapshotId: `${diff}_seed${seed}_snap1`,
                        suggestedCoordinate: classicMove.coordinate,
                        isValid: Boolean(classicMove.coordinate),
                        isSafe: safe,
                        guaranteedSafeExisted: guaranteedExisted,
                        matchedGuaranteedSafe: guaranteedMoves.includes(classicMove.coordinate),
                        latencyMs: 1,
                        confidence: classicMove.isGuaranteed ? 1.0 : null,
                        apiCost: 0,
                        terminalOutcome: safe ? "continue" : "lost",
                    });
                    completedGames.add(snapGameId);
                }
            }

            // 2. JEV Snapshot
            if (runJev && apiKey) {
                const snapGameId = `${experimentId}_snap_${diff}_jev_s${seed}`;
                if (!completedGames.has(snapGameId)) {
                    console.log(`  [Snapshot] Querying JEV on ${diff} (seed ${seed})...`);
                    const jevRes = await getJevMove(initialReveal.board, apiKey, new Set());
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
                            !initialReveal.board[jr][jc].isRevealed &&
                            !initialReveal.board[jr][jc].isFlagged
                        ) {
                            valid = true;
                            safe = !fullBoard[jr][jc].isMine;
                        }
                    }

                    recordDecision({
                        experimentId,
                        gameId: snapGameId,
                        phase: "diagnostic_snapshot",
                        seed,
                        difficulty: diff,
                        method: "jev",
                        decisionIndex: 1,
                        visibleBoardSnapshotId: `${diff}_seed${seed}_snap1`,
                        suggestedCoordinate: jevCoord || "",
                        isValid: valid,
                        isSafe: safe,
                        guaranteedSafeExisted: guaranteedExisted,
                        matchedGuaranteedSafe: jevCoord ? guaranteedMoves.includes(jevCoord) : false,
                        latencyMs: jevRes.latencyMs,
                        confidence: jevRes.confidence,
                        apiCost: jevRes.cost,
                        terminalOutcome: !valid ? "invalid" : safe ? "continue" : "lost",
                    });
                    completedGames.add(snapGameId);
                }
            }

            // 3. Laya Snapshot
            if (runLaya) {
                const snapGameId = `${experimentId}_snap_${diff}_laya_s${seed}`;
                if (!completedGames.has(snapGameId)) {
                    console.log(`  [Snapshot] Querying Laya on ${diff} (seed ${seed})...`);
                    const layaRes = await getLayaMove(initialReveal.board, layaServiceUrl, layaApiKey, new Set());
                    const layaCoord = layaRes.coordinate;
                    let valid = false;
                    let safe = false;

                    if (layaCoord) {
                        const [lr, lc] = layaCoord.split("-").map(Number);
                        if (
                            lr >= 0 &&
                            lr < fullBoard.length &&
                            lc >= 0 &&
                            lc < fullBoard[0].length &&
                            !initialReveal.board[lr][lc].isRevealed &&
                            !initialReveal.board[lr][lc].isFlagged
                        ) {
                            valid = true;
                            safe = !fullBoard[lr][lc].isMine;
                        }
                    }

                    recordDecision({
                        experimentId,
                        gameId: snapGameId,
                        phase: "diagnostic_snapshot",
                        seed,
                        difficulty: diff,
                        method: "laya",
                        decisionIndex: 1,
                        visibleBoardSnapshotId: `${diff}_seed${seed}_snap1`,
                        suggestedCoordinate: layaCoord || "",
                        isValid: valid,
                        isSafe: safe,
                        guaranteedSafeExisted: guaranteedExisted,
                        matchedGuaranteedSafe: layaCoord ? guaranteedMoves.includes(layaCoord) : false,
                        latencyMs: layaRes.latencyMs,
                        confidence: layaRes.confidence,
                        apiCost: 0,
                        terminalOutcome: !valid ? "invalid" : safe ? "continue" : "lost",
                    });
                    completedGames.add(snapGameId);
                }
            }
        }
    }

    // --- Phase 2: Complete Games Evaluation ---
    // Evaluates full games starting from the identical deterministic seed and initial reveal (0,0).
    console.log(`\n--- Phase 2: Complete Games Evaluation ---`);
    for (const diff of difficulties) {
        for (let t = 0; t < trialsPerDifficulty; t++) {
            const seed = baseSeed + t * 100 + 7;

            // 1. Classical Full Game
            if (runClassical) {
                const gameId = `${experimentId}_game_${diff}_classical_s${seed}`;
                if (!completedGames.has(gameId)) {
                    console.log(`  [Game] Classical on ${diff} (Seed ${seed})...`);
                    const fullBoard = generateDeterministicBoard(diff, seed, 0, 0);
                    let current = revealBoardCell(fullBoard, 0, 0);
                    let decisionIdx = 1;
                    let won = false;
                    let terminal: "won" | "lost" | "max_moves" = "max_moves";

                    while (!won && !current.hitMine && decisionIdx <= 150) {
                        if (isGameWon(current.board)) {
                            won = true;
                            terminal = "won";
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
                        const decOutcome = won ? "won" : current.hitMine ? "lost" : "continue";
                        if (won) terminal = "won";
                        else if (current.hitMine) terminal = "lost";

                        recordDecision({
                            experimentId,
                            gameId,
                            phase: "full_game",
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
                            terminalOutcome: decOutcome,
                        });

                        if (current.hitMine) {
                            terminal = "lost";
                            break;
                        }
                    }

                    gameRecords.push({
                        gameId,
                        seed,
                        difficulty: diff,
                        method: "classical",
                        won,
                        movesCount: decisionIdx - 1,
                        terminalOutcome: terminal,
                        totalCost: 0,
                    });
                    completedGames.add(gameId);
                    fs.writeFileSync(gamesJsonPath, JSON.stringify(gameRecords, null, 2), "utf8");
                }
            }

            // 2. JEV Full Game
            if (runJev && apiKey) {
                const gameId = `${experimentId}_game_${diff}_jev_s${seed}`;
                if (!completedGames.has(gameId)) {
                    console.log(`  [Game] JEV on ${diff} (Seed ${seed})...`);
                    const fullBoard = generateDeterministicBoard(diff, seed, 0, 0);
                    let current = revealBoardCell(fullBoard, 0, 0);
                    let decisionIdx = 1;
                    let won = false;
                    const excluded = new Set<string>();
                    let terminal: "won" | "lost" | "invalid" | "max_moves" = "max_moves";
                    let totalCost = 0;

                    // Cap moves per game to 20 for API economy
                    while (!won && !current.hitMine && decisionIdx <= 20) {
                        if (isGameWon(current.board)) {
                            won = true;
                            terminal = "won";
                            break;
                        }

                        const cConstraints = extractConstraints(current.board);
                        const cResult = solveConstraints(cConstraints);
                        const guaranteedMoves = cResult.safeCells;
                        const guaranteedExisted = guaranteedMoves.length > 0;

                        const jevRes = await getJevMove(current.board, apiKey, excluded);
                        const jevCoord = jevRes.coordinate;
                        totalCost += jevRes.cost;

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
                            terminal = "invalid";
                            recordDecision({
                                experimentId,
                                gameId,
                                phase: "full_game",
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
                            break;
                        }

                        const [r, c] = jevCoord.split("-").map(Number);
                        current = revealBoardCell(current.board, r, c);
                        won = isGameWon(current.board);
                        const decOutcome = won ? "won" : current.hitMine ? "lost" : "continue";
                        if (won) terminal = "won";
                        else if (current.hitMine) terminal = "lost";

                        recordDecision({
                            experimentId,
                            gameId,
                            phase: "full_game",
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
                            terminalOutcome: decOutcome,
                        });

                        if (current.hitMine) {
                            terminal = "lost";
                            break;
                        }
                    }

                    gameRecords.push({
                        gameId,
                        seed,
                        difficulty: diff,
                        method: "jev",
                        won,
                        movesCount: decisionIdx - 1,
                        terminalOutcome: terminal,
                        totalCost,
                    });
                    completedGames.add(gameId);
                    fs.writeFileSync(gamesJsonPath, JSON.stringify(gameRecords, null, 2), "utf8");
                }
            }

            // 3. Laya Full Game
            if (runLaya) {
                const gameId = `${experimentId}_game_${diff}_laya_s${seed}`;
                if (!completedGames.has(gameId)) {
                    console.log(`  [Game] Laya on ${diff} (Seed ${seed})...`);
                    const fullBoard = generateDeterministicBoard(diff, seed, 0, 0);
                    let current = revealBoardCell(fullBoard, 0, 0);
                    let decisionIdx = 1;
                    let won = false;
                    const excluded = new Set<string>();
                    let terminal: "won" | "lost" | "invalid" | "max_moves" = "max_moves";

                    while (!won && !current.hitMine && decisionIdx <= 25) {
                        if (isGameWon(current.board)) {
                            won = true;
                            terminal = "won";
                            break;
                        }

                        const cConstraints = extractConstraints(current.board);
                        const cResult = solveConstraints(cConstraints);
                        const guaranteedMoves = cResult.safeCells;
                        const guaranteedExisted = guaranteedMoves.length > 0;

                        const layaRes = await getLayaMove(current.board, layaServiceUrl, layaApiKey, excluded);
                        const layaCoord = layaRes.coordinate;

                        let valid = false;
                        let safe = false;

                        if (layaCoord) {
                            const [lr, lc] = layaCoord.split("-").map(Number);
                            if (
                                lr >= 0 &&
                                lr < fullBoard.length &&
                                lc >= 0 &&
                                lc < fullBoard[0].length &&
                                !current.board[lr][lc].isRevealed &&
                                !current.board[lr][lc].isFlagged &&
                                !excluded.has(layaCoord)
                            ) {
                                valid = true;
                                safe = !fullBoard[lr][lc].isMine;
                            }
                        }

                        if (!valid || !layaCoord) {
                            terminal = "invalid";
                            recordDecision({
                                experimentId,
                                gameId,
                                phase: "full_game",
                                seed,
                                difficulty: diff,
                                method: "laya",
                                decisionIndex: decisionIdx,
                                visibleBoardSnapshotId: `${diff}_seed${seed}_dec${decisionIdx}`,
                                suggestedCoordinate: layaCoord || "",
                                isValid: false,
                                isSafe: false,
                                guaranteedSafeExisted: guaranteedExisted,
                                matchedGuaranteedSafe: false,
                                latencyMs: layaRes.latencyMs,
                                confidence: layaRes.confidence,
                                apiCost: 0,
                                terminalOutcome: "invalid",
                            });
                            break;
                        }

                        const [r, c] = layaCoord.split("-").map(Number);
                        current = revealBoardCell(current.board, r, c);
                        won = isGameWon(current.board);
                        const decOutcome = won ? "won" : current.hitMine ? "lost" : "continue";
                        if (won) terminal = "won";
                        else if (current.hitMine) terminal = "lost";

                        recordDecision({
                            experimentId,
                            gameId,
                            phase: "full_game",
                            seed,
                            difficulty: diff,
                            method: "laya",
                            decisionIndex: decisionIdx++,
                            visibleBoardSnapshotId: `${diff}_seed${seed}_dec${decisionIdx}`,
                            suggestedCoordinate: layaCoord,
                            isValid: true,
                            isSafe: safe,
                            guaranteedSafeExisted: guaranteedExisted,
                            matchedGuaranteedSafe: guaranteedMoves.includes(layaCoord),
                            latencyMs: layaRes.latencyMs,
                            confidence: layaRes.confidence,
                            apiCost: 0,
                            terminalOutcome: decOutcome,
                        });

                        if (current.hitMine) {
                            terminal = "lost";
                            break;
                        }
                    }

                    gameRecords.push({
                        gameId,
                        seed,
                        difficulty: diff,
                        method: "laya",
                        won,
                        movesCount: decisionIdx - 1,
                        terminalOutcome: terminal,
                        totalCost: 0,
                    });
                    completedGames.add(gameId);
                    fs.writeFileSync(gamesJsonPath, JSON.stringify(gameRecords, null, 2), "utf8");
                }
            }
        }
    }

    // Save CSV raw records
    const csvHeaders = [
        "experimentId",
        "gameId",
        "phase",
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
            l.gameId,
            l.phase,
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

    // --- Separate Game-Level and Decision-Level Metric Aggregation ---
    function aggregateMetrics(methodName: "classical" | "jev" | "laya", diff?: Difficulty) {
        // 1. Game-level analysis
        const games = gameRecords.filter((g) => g.method === methodName && (!diff || g.difficulty === diff));
        const totalGames = games.length;
        const wonGames = games.filter((g) => g.won).length;
        const lostGames = games.filter((g) => g.terminalOutcome === "lost").length;
        const invalidGames = games.filter((g) => g.terminalOutcome === "invalid").length;
        const winRate = totalGames > 0 ? wonGames / totalGames : 0;
        const winRateCi95 = wilsonScoreInterval(wonGames, totalGames);

        // 2. Decision-level analysis (evaluated across Phase 2 full games)
        const fullGameDecisions = rawLogs.filter(
            (l) => l.method === methodName && l.phase === "full_game" && (!diff || l.difficulty === diff)
        );

        const totalDecisions = fullGameDecisions.length;
        const validDecisions = fullGameDecisions.filter((l) => l.isValid).length;
        const safeDecisions = fullGameDecisions.filter((l) => l.isValid && l.isSafe).length;
        const mineHits = fullGameDecisions.filter((l) => l.isValid && !l.isSafe).length;

        // Guaranteed-safe analysis: evaluated strictly when a logically guaranteed move existed
        const guaranteedOpportunities = fullGameDecisions.filter((l) => l.guaranteedSafeExisted).length;
        const matchedGuaranteed = fullGameDecisions.filter((l) => l.guaranteedSafeExisted && l.matchedGuaranteedSafe).length;

        const validRate = totalDecisions > 0 ? validDecisions / totalDecisions : 0;
        const safeRate = validDecisions > 0 ? safeDecisions / validDecisions : 0;
        const mineHitRate = validDecisions > 0 ? mineHits / validDecisions : 0;
        const matchGuaranteedRate = guaranteedOpportunities > 0 ? matchedGuaranteed / guaranteedOpportunities : 0;

        // Group decisions by game for game-clustered bootstrap intervals
        const gameMap = new Map<string, DecisionLog[]>();
        for (const dec of fullGameDecisions) {
            if (!gameMap.has(dec.gameId)) gameMap.set(dec.gameId, []);
            gameMap.get(dec.gameId)!.push(dec);
        }
        const clusterDecisions = Array.from(gameMap.values());

        const safeRateClusterCi95 = clusterBootstrapInterval(
            clusterDecisions,
            (sample) => {
                const v = sample.filter((d) => d.isValid).length;
                const s = sample.filter((d) => d.isValid && d.isSafe).length;
                return v > 0 ? s / v : 0;
            }
        );

        const matchGuaranteedClusterCi95 = clusterBootstrapInterval(
            clusterDecisions,
            (sample) => {
                const g = sample.filter((d) => d.guaranteedSafeExisted).length;
                const m = sample.filter((d) => d.guaranteedSafeExisted && d.matchedGuaranteedSafe).length;
                return g > 0 ? m / g : 0;
            }
        );

        const latencies = fullGameDecisions.map((l) => l.latencyMs).sort((a, b) => a - b);
        const avgLatency = totalDecisions > 0 ? latencies.reduce((a, b) => a + b, 0) / totalDecisions : 0;
        const medianLatency = totalDecisions > 0 ? latencies[Math.floor(totalDecisions / 2)] : 0;
        const p90Latency = totalDecisions > 0 ? latencies[Math.floor(totalDecisions * 0.9)] : 0;
        const totalCostUsd = fullGameDecisions.reduce((s, l) => s + l.apiCost, 0);

        // 3. Diagnostic Phase 1 snapshot metrics (Pristine first move on identical seeds)
        const snapDecisions = rawLogs.filter(
            (l) => l.method === methodName && l.phase === "diagnostic_snapshot" && (!diff || l.difficulty === diff)
        );
        const snapTotal = snapDecisions.length;
        const snapValid = snapDecisions.filter((l) => l.isValid).length;
        const snapSafe = snapDecisions.filter((l) => l.isValid && l.isSafe).length;
        const snapGuarExisted = snapDecisions.filter((l) => l.guaranteedSafeExisted).length;
        const snapMatchedGuar = snapDecisions.filter((l) => l.guaranteedSafeExisted && l.matchedGuaranteedSafe).length;

        return {
            gameLevel: {
                totalGames,
                wonGames,
                lostGames,
                invalidTerminations: invalidGames,
                winRate: Number(winRate.toFixed(4)),
                winRateCi95,
                avgMovesPerGame: totalGames > 0 ? Number((totalDecisions / totalGames).toFixed(1)) : 0,
            },
            decisionLevel: {
                totalDecisions,
                validDecisions,
                validRate: Number(validRate.toFixed(4)),
                safeDecisions,
                safeRate: Number(safeRate.toFixed(4)),
                safeRateClusterBootstrapCi95: safeRateClusterCi95,
                mineHits,
                mineHitRate: Number(mineHitRate.toFixed(4)),
                guaranteedSafeOpportunities: guaranteedOpportunities,
                matchedGuaranteedSafe: matchedGuaranteed,
                matchGuaranteedRate: Number(matchGuaranteedRate.toFixed(4)),
                matchGuaranteedClusterBootstrapCi95: matchGuaranteedClusterCi95,
                avgLatencyMs: Math.round(avgLatency),
                medianLatencyMs: medianLatency,
                p90LatencyMs: p90Latency,
                totalCostUsd: Number(totalCostUsd.toFixed(6)),
            },
            diagnosticSnapshot: {
                totalSnapshots: snapTotal,
                validRate: snapTotal > 0 ? Number((snapValid / snapTotal).toFixed(4)) : 0,
                safeRate: snapValid > 0 ? Number((snapSafe / snapValid).toFixed(4)) : 0,
                matchGuaranteedRate: snapGuarExisted > 0 ? Number((snapMatchedGuar / snapGuarExisted).toFixed(4)) : 0,
            },
        };
    }

    const summary = {
        experimentId,
        timestamp: new Date().toISOString(),
        trialsPerDifficulty,
        enginesEvaluated: {
            classical: runClassical,
            jev: runJev,
            laya: runLaya,
        },
        methodologyNote:
            "Game-level win rates computed on independent complete games with Wilson score 95% CIs. Decision-level safe rates and guaranteed-safe match rates use game-clustered bootstrap resampling (1,000 resamples) to correct for intra-game correlation. Guaranteed-safe selection is computed strictly when a logically proven safe move existed.",
        overall: {
            classical: runClassical ? aggregateMetrics("classical") : null,
            jev: runJev ? aggregateMetrics("jev") : null,
            laya: runLaya ? aggregateMetrics("laya") : null,
        },
        byDifficulty: {
            easy: {
                classical: runClassical ? aggregateMetrics("classical", "easy") : null,
                jev: runJev ? aggregateMetrics("jev", "easy") : null,
                laya: runLaya ? aggregateMetrics("laya", "easy") : null,
            },
            medium: {
                classical: runClassical ? aggregateMetrics("classical", "medium") : null,
                jev: runJev ? aggregateMetrics("jev", "medium") : null,
                laya: runLaya ? aggregateMetrics("laya", "medium") : null,
            },
            hard: {
                classical: runClassical ? aggregateMetrics("classical", "hard") : null,
                jev: runJev ? aggregateMetrics("jev", "hard") : null,
                laya: runLaya ? aggregateMetrics("laya", "hard") : null,
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
    console.log(`  Games Log: ${gamesJsonPath}`);
    console.log(`  Summary:   ${summaryPath}`);
    console.log(`======================================================\n`);
    console.log(JSON.stringify(summary, null, 2));
}

runBenchmark().catch((err) => {
    console.error("Benchmark failed:", err);
    process.exit(1);
});
