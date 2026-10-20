const fs = require("fs");
const path = require("path");
const ts = require("typescript");

function run(fileRelative) {
    const fullPath = path.resolve(process.cwd(), fileRelative);
    const source = fs.readFileSync(fullPath, "utf8");
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
        },
    });

    const createCustomRequire = (currentDir) => {
        const customRequire = (modulePath) => {
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
    const runner = new Function("require", "module", "exports", "__dirname", "__filename", transpiled.outputText);
    runner(createCustomRequire(path.dirname(fullPath)), m, m.exports, path.dirname(fullPath), fullPath);
}

const targetScript = process.argv[2] || "scripts/runBenchmark.ts";
run(targetScript);
