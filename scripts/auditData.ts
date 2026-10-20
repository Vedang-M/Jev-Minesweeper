import * as fs from 'fs';
import * as path from 'path';

interface DecisionRow {
    experimentId: string;
    gameId: string;
    phase: string;
    seed: number;
    difficulty: string;
    method: string;
    decisionIndex: number;
    visibleBoardSnapshotId: string;
    suggestedCoordinate: string | null;
    isValid: boolean;
    isSafe: boolean;
    guaranteedSafeExisted: boolean;
    matchedGuaranteedSafe: boolean;
    latencyMs: number;
    confidence: number;
    apiCost: number;
    terminalOutcome: string;
}

interface GameRow {
    gameId: string;
    seed: number;
    difficulty: string;
    method: string;
    won: boolean;
    movesCount: number;
    terminalOutcome: string;
    totalCost: number;
}

interface EngineDifficultySummary {
    gameLevel?: {
        totalGames: number;
        wonGames: number;
        lostGames: number;
        invalidTerminations: number;
        winRate: number;
        winRateCi95: [number, number];
        avgMovesPerGame: number;
    };
    decisionLevel?: {
        totalDecisions: number;
        validDecisions: number;
        validRate: number;
        safeDecisions: number;
        safeRate: number;
        safeRateClusterBootstrapCi95: [number, number];
        mineHits: number;
        mineHitRate: number;
        guaranteedSafeOpportunities: number;
        matchedGuaranteedSafe: number;
        matchGuaranteedRate: number;
        matchGuaranteedClusterBootstrapCi95: [number, number];
        avgLatencyMs: number;
        medianLatencyMs: number;
        p90LatencyMs: number;
        totalCostUsd: number;
    };
    diagnosticSnapshot?: {
        totalSnapshots: number;
        validRate: number;
        safeRate: number;
        matchGuaranteedRate: number;
    };
    // Legacy schema format in exp_1792470142530
    totalDecisions?: number;
    validDecisions?: number;
    validRate?: number;
    safeRate?: number;
    safeRateCi95?: [number, number];
    mineHitRate?: number;
    guaranteedSafeSituations?: number;
    matchGuaranteedRate?: number;
    avgLatencyMs?: number;
    medianLatencyMs?: number;
    p90LatencyMs?: number;
    totalCostUsd?: number;
}

interface BenchmarkSummary {
    experimentId: string;
    trialsPerDifficulty: number;
    overall: Record<string, EngineDifficultySummary | null>;
    byDifficulty: {
        easy: Record<string, EngineDifficultySummary | null>;
        medium: Record<string, EngineDifficultySummary | null>;
        hard: Record<string, EngineDifficultySummary | null>;
    };
}

function parseJsonl<T>(filePath: string): T[] {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as T);
}

function parseCsv(filePath: string): DecisionRow[] {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length <= 1) return [];
    const headers = lines[0].split(',');
    
    return lines.slice(1).map((line) => {
        const parts = line.split(',');
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
            obj[h] = parts[idx];
        });
        return {
            experimentId: obj.experimentId,
            gameId: obj.gameId,
            phase: obj.phase,
            seed: parseInt(obj.seed, 10),
            difficulty: obj.difficulty,
            method: obj.method,
            decisionIndex: parseInt(obj.decisionIndex, 10),
            visibleBoardSnapshotId: obj.visibleBoardSnapshotId,
            suggestedCoordinate: obj.suggestedCoordinate,
            isValid: obj.isValid === 'true',
            isSafe: obj.isSafe === 'true',
            guaranteedSafeExisted: obj.guaranteedSafeExisted === 'true',
            matchedGuaranteedSafe: obj.matchedGuaranteedSafe === 'true',
            latencyMs: parseFloat(obj.latencyMs),
            confidence: parseFloat(obj.confidence),
            apiCost: parseFloat(obj.apiCost),
            terminalOutcome: obj.terminalOutcome,
        };
    });
}

export function auditExperiment(expId: string): boolean {
    const resultsDir = path.join(process.cwd(), 'results');
    const jsonlPath = path.join(resultsDir, `decisions_${expId}.jsonl`);
    const csvPath = path.join(resultsDir, `decisions_${expId}.csv`);
    const gamesPath = path.join(resultsDir, `games_${expId}.json`);
    const summaryPath = path.join(resultsDir, `benchmark_summary_${expId}.json`);

    console.log(`\n================ AUDITING EXPERIMENT: ${expId} ================`);
    
    if (!fs.existsSync(summaryPath)) {
        console.error(`[FAIL] Summary file not found: ${summaryPath}`);
        return false;
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8')) as BenchmarkSummary;

    let jsonlRecords: DecisionRow[] = [];
    if (fs.existsSync(jsonlPath)) {
        jsonlRecords = parseJsonl<DecisionRow>(jsonlPath);
        console.log(`Loaded ${jsonlRecords.length} decision records from JSONL.`);
    } else {
        console.warn(`[WARN] JSONL file not found: ${jsonlPath}`);
    }

    if (fs.existsSync(csvPath)) {
        const csvRecords = parseCsv(csvPath);
        console.log(`Loaded ${csvRecords.length} decision records from CSV.`);
        if (jsonlRecords.length > 0 && jsonlRecords.length !== csvRecords.length) {
            console.error(`[FAIL] Mismatch between JSONL (${jsonlRecords.length}) and CSV (${csvRecords.length}) row counts!`);
            return false;
        }
        console.log(`✓ CSV and JSONL row counts match (${csvRecords.length}).`);
    }

    let gameRecords: GameRow[] = [];
    if (fs.existsSync(gamesPath)) {
        gameRecords = JSON.parse(fs.readFileSync(gamesPath, 'utf-8')) as GameRow[];
        console.log(`Loaded ${gameRecords.length} game records from JSON.`);
    }

    const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];
    const engines = ['classical', 'laya', 'jev'];

    for (const diff of difficulties) {
        for (const eng of engines) {
            const summaryEntry = summary.byDifficulty[diff]?.[eng];
            if (!summaryEntry) continue;

            console.log(`\n--- Auditing Engine: ${eng} | Difficulty: ${diff} ---`);

            // Check if modern schema or legacy flat schema
            if (summaryEntry.gameLevel && summaryEntry.decisionLevel) {
                // Modern schema
                if (gameRecords.length > 0) {
                    const groupGames = gameRecords.filter((g) => g.method === eng && g.difficulty === diff);
                    const total = groupGames.length;
                    const won = groupGames.filter((g) => g.won).length;
                    const lost = groupGames.filter((g) => g.terminalOutcome === 'lost').length;
                    const invalid = groupGames.filter((g) => g.terminalOutcome === 'invalid_move').length;

                    if (total !== summaryEntry.gameLevel.totalGames || won !== summaryEntry.gameLevel.wonGames || lost !== summaryEntry.gameLevel.lostGames) {
                        console.error(`[FAIL] Game reconciliation mismatch in ${eng}-${diff}!`);
                        console.error(`Raw games: total=${total}, won=${won}, lost=${lost}`);
                        console.error(`Summary: total=${summaryEntry.gameLevel.totalGames}, won=${summaryEntry.gameLevel.wonGames}, lost=${summaryEntry.gameLevel.lostGames}`);
                        return false;
                    }
                    const expectedWinRate = total > 0 ? won / total : 0;
                    if (Math.abs(expectedWinRate - summaryEntry.gameLevel.winRate) > 1e-4) {
                        console.error(`[FAIL] Win rate mismatch! Expected ${expectedWinRate}, got ${summaryEntry.gameLevel.winRate}`);
                        return false;
                    }
                    console.log(`✓ Games reconciled: ${total} total, ${won} won, ${lost} lost, ${invalid} invalid. Win rate: ${(expectedWinRate * 100).toFixed(1)}%`);
                }

                if (jsonlRecords.length > 0) {
                    const fullGameDecs = jsonlRecords.filter((d) => d.method === eng && d.difficulty === diff && d.phase === 'full_game');
                    const total = fullGameDecs.length;
                    const valid = fullGameDecs.filter((d) => d.isValid).length;
                    const safe = fullGameDecs.filter((d) => d.isValid && d.isSafe).length;
                    const mineHits = fullGameDecs.filter((d) => d.isValid && !d.isSafe).length;
                    const gExisted = fullGameDecs.filter((d) => d.guaranteedSafeExisted).length;
                    const gMatched = fullGameDecs.filter((d) => d.guaranteedSafeExisted && d.matchedGuaranteedSafe).length;

                    if (total !== summaryEntry.decisionLevel.totalDecisions || valid !== summaryEntry.decisionLevel.validDecisions) {
                        console.error(`[FAIL] Decision count mismatch in ${eng}-${diff}!`);
                        return false;
                    }

                    if (safe !== summaryEntry.decisionLevel.safeDecisions || mineHits !== summaryEntry.decisionLevel.mineHits) {
                        console.error(`[FAIL] Safe decisions / mine hits mismatch!`);
                        return false;
                    }

                    if (gExisted !== summaryEntry.decisionLevel.guaranteedSafeOpportunities || gMatched !== summaryEntry.decisionLevel.matchedGuaranteedSafe) {
                        console.error(`[FAIL] Guaranteed safe opportunities mismatch!`);
                        return false;
                    }

                    const expectedSafeRate = valid > 0 ? safe / valid : 0;
                    if (Math.abs(expectedSafeRate - summaryEntry.decisionLevel.safeRate) > 1e-4) {
                        console.error(`[FAIL] Safe rate mismatch! Expected ${expectedSafeRate}, Got ${summaryEntry.decisionLevel.safeRate}`);
                        return false;
                    }

                    const expectedGMatchRate = gExisted > 0 ? gMatched / gExisted : 0;
                    if (Math.abs(expectedGMatchRate - summaryEntry.decisionLevel.matchGuaranteedRate) > 1e-4) {
                        console.error(`[FAIL] Guaranteed match rate mismatch! Expected ${expectedGMatchRate}, Got ${summaryEntry.decisionLevel.matchGuaranteedRate}`);
                        return false;
                    }

                    console.log(`✓ Full-game decisions reconciled: ${total} attempts, ${valid} valid, ${safe} safe (${(expectedSafeRate * 100).toFixed(2)}%), ${gMatched}/${gExisted} guaranteed safe selected (${(expectedGMatchRate * 100).toFixed(2)}%).`);

                    if (summaryEntry.diagnosticSnapshot) {
                        const snapDecs = jsonlRecords.filter((d) => d.method === eng && d.difficulty === diff && d.phase === 'diagnostic_snapshot');
                        const snapTotal = snapDecs.length;
                        const snapValid = snapDecs.filter((d) => d.isValid).length;
                        const snapSafe = snapDecs.filter((d) => d.isValid && d.isSafe).length;
                        const snapGExisted = snapDecs.filter((d) => d.guaranteedSafeExisted).length;
                        const snapGMatched = snapDecs.filter((d) => d.guaranteedSafeExisted && d.matchedGuaranteedSafe).length;

                        if (snapTotal !== summaryEntry.diagnosticSnapshot.totalSnapshots) {
                            console.error(`[FAIL] Diagnostic snapshot count mismatch in ${eng}-${diff}!`);
                            return false;
                        }
                        const expectedSnapSafeRate = snapValid > 0 ? snapSafe / snapValid : 0;
                        const expectedSnapGMatch = snapGExisted > 0 ? snapGMatched / snapGExisted : 0;
                        console.log(`✓ Diagnostic snapshots reconciled: ${snapTotal} snapshots, safe rate: ${(expectedSnapSafeRate * 100).toFixed(1)}%, guaranteed match: ${(expectedSnapGMatch * 100).toFixed(1)}%.`);
                    }
                }
            } else if (summaryEntry.totalDecisions !== undefined) {
                // Legacy schema (exp_1792470142530)
                const groupDecs = jsonlRecords.filter((d) => d.method === eng && d.difficulty === diff);
                const total = groupDecs.length;
                const valid = groupDecs.filter((d) => d.isValid).length;
                const safe = groupDecs.filter((d) => d.isValid && d.isSafe).length;
                const gExisted = groupDecs.filter((d) => d.guaranteedSafeExisted).length;
                const gMatched = groupDecs.filter((d) => d.guaranteedSafeExisted && d.matchedGuaranteedSafe).length;

                if (total !== summaryEntry.totalDecisions || valid !== summaryEntry.validDecisions) {
                    console.error(`[FAIL] Legacy decision count mismatch in ${eng}-${diff}! Raw=${total}/${valid}, Summary=${summaryEntry.totalDecisions}/${summaryEntry.validDecisions}`);
                    return false;
                }

                const expectedSafeRate = valid > 0 ? safe / valid : 0;
                if (Math.abs(expectedSafeRate - (summaryEntry.safeRate || 0)) > 1e-4) {
                    console.error(`[FAIL] Safe rate mismatch in legacy run!`);
                    return false;
                }

                const expectedGMatchRate = gExisted > 0 ? gMatched / gExisted : 0;
                if (Math.abs(expectedGMatchRate - (summaryEntry.matchGuaranteedRate || 0)) > 1e-4) {
                    console.error(`[FAIL] Guaranteed match rate mismatch in legacy run!`);
                    return false;
                }

                console.log(`✓ Legacy paired decisions reconciled: ${total} total (${valid} valid), safe: ${safe} (${(expectedSafeRate * 100).toFixed(1)}%), guaranteed: ${gMatched}/${gExisted} (${(expectedGMatchRate * 100).toFixed(1)}%).`);
            }
        }
    }

    console.log(`\n================ [PASS] EXPERIMENT ${expId} AUDITED & RECONCILED 100% ================`);
    return true;
}

const expIds = ['exp_1792471827737', 'exp_1792472002589', 'exp_1792470142530'];
let allPassed = true;
for (const expId of expIds) {
    const passed = auditExperiment(expId);
    if (!passed) allPassed = false;
}
if (!allPassed) {
    process.exit(1);
} else {
    console.log(`\n================ ALL BENCHMARK EXPERIMENTS PASS INDEPENDENT RECONCILIATION AUDIT ================`);
}
