import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";


function compileAndRun(testFiles: string[]) {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const relativePath of testFiles) {
        const fullPath = path.resolve(process.cwd(), relativePath);
        console.log(`\n--- Running test suite: ${relativePath} ---`);
        const source = fs.readFileSync(fullPath, "utf8");
        const transpiled = ts.transpileModule(source, {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
                esModuleInterop: true,
            },
        });

        const createCustomRequire = (currentDir: string) => {
            const customRequire = (modulePath: string): any => {
                if (modulePath.startsWith("@/")) {
                    const subPath = modulePath.replace("@/", "src/");
                    const resolvedTarget = path.resolve(process.cwd(), subPath);
                    const candidates = [
                        resolvedTarget,
                        resolvedTarget + ".ts",
                        resolvedTarget + ".tsx",
                        resolvedTarget + ".js",
                        path.join(resolvedTarget, "index.ts"),
                    ];
                    for (const cand of candidates) {
                        if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
                            const fileSource = fs.readFileSync(cand, "utf8");
                            const transpiledFile = ts.transpileModule(fileSource, {
                                compilerOptions: {
                                    module: ts.ModuleKind.CommonJS,
                                    target: ts.ScriptTarget.ES2022,
                                    esModuleInterop: true,
                                },
                            });
                            const m = { exports: {} };
                            const fn = new Function("require", "module", "exports", "__dirname", "__filename", transpiledFile.outputText);
                            fn(createCustomRequire(path.dirname(cand)), m, m.exports, path.dirname(cand), cand);
                            return m.exports;
                        }
                    }
                }
                if (modulePath.startsWith("./") || modulePath.startsWith("../")) {
                    const resolved = path.resolve(currentDir, modulePath);
                    const candidates = [
                        resolved,
                        resolved + ".ts",
                        resolved + ".tsx",
                        resolved + ".js",
                    ];
                    for (const cand of candidates) {
                        if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
                            const fileSource = fs.readFileSync(cand, "utf8");
                            const transpiledFile = ts.transpileModule(fileSource, {
                                compilerOptions: {
                                    module: ts.ModuleKind.CommonJS,
                                    target: ts.ScriptTarget.ES2022,
                                    esModuleInterop: true,
                                },
                            });
                            const m = { exports: {} };
                            const fn = new Function("require", "module", "exports", "__dirname", "__filename", transpiledFile.outputText);
                            fn(createCustomRequire(path.dirname(cand)), m, m.exports, path.dirname(cand), cand);
                            return m.exports;
                        }
                    }
                }
                return require(modulePath);
            };
            return customRequire;
        };

        const m = { exports: {} };
        try {
            const runner = new Function("require", "module", "exports", "__dirname", "__filename", transpiled.outputText);
            runner(createCustomRequire(path.dirname(fullPath)), m, m.exports, path.dirname(fullPath), fullPath);
            console.log(`✓ Suite ${relativePath} completed successfully.`);
            passedTests++;
        } catch (err) {
            console.error(`✗ Suite ${relativePath} failed:`, err);
            failedTests++;
        }
        totalTests++;

    }

    console.log(`\n========================================`);
    console.log(`Test Execution Summary: ${passedTests}/${totalTests} passed, ${failedTests} failed.`);
    console.log(`========================================\n`);

    if (failedTests > 0) {
        process.exit(1);
    }
}

const suites = [
    "tests/board.test.ts",
    "tests/solver.test.ts",
    "tests/jevRoute.test.ts",
    "tests/decisionRoute.test.ts",
    "tests/metrics.test.ts",
];

compileAndRun(suites);
