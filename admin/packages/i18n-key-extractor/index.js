#!/usr/bin/env node

/**
 * This script is now a self-contained package.
 * It will be run from the root of the user's project.
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { parse: parseSfc } = require('@vue/compiler-sfc');
const { compile: compileTpl } = require('@vue/compiler-dom');

// When run via npm scripts, process.cwd() is the project root.
const rootDir = process.cwd();

// Load configuration from i18n.config.js in the project root
let config;
function parseConfig() {
    try {
        const configPath = path.resolve(rootDir, 'i18n.config.js');
        if (fs.existsSync(configPath)) {
            config = require(configPath);
            console.log('已加载配置文件:', configPath);
        } else {
            console.log('未找到配置文件，使用默认配置');
            config = {};
        }
        // 打印配置信息 (functionNames 在 CONFIG 构建后打印)
    } catch (error) {
        console.error('加载配置文件时出错:', error);
        console.log('使用默认配置');
        config = {};
    }
}

parseConfig();
const CONFIG = {
    // 源代码目录
    srcDir: path.resolve(rootDir, config?.srcDir || './src'),
    // 语言包目录
    localesDir: path.resolve(rootDir, config?.outputDir || './src/i18n/locales'),
    // 输出格式: 'ts' 或 'json'
    outputFormat: config?.outputFormat === 'json' ? 'json' : 'ts',
    // 支持的语言
    locales: (config?.locales) || ['zh-CN', 'en-US'],
    // 文件匹配模式
    filePatterns: (config?.filePatterns) || ['**/*.vue', '**/*.ts', '**/*.js', '**/*.jsx', '**/*.tsx'],
    // 忽略的目录
    ignoreDirs: (config?.ignoreDirs) || ['node_modules', 'dist', 'public'],
    // 忽略的文件
    ignoreFiles: (config?.ignoreFiles) || [],
    // 是否保留已有的翻译
    preserveExistingTranslations: (config?.preserveExistingTranslations) !== undefined ? config?.preserveExistingTranslations : true,
    // 是否按命名空间组织键
    organizeByNamespace: (config?.organizeByNamespace) !== undefined ? config?.organizeByNamespace : true,
    // 默认值（当找不到翻译时）
    defaultValue: (config?.defaultValue) !== undefined ? config?.defaultValue : '',
    // 提取函数配置
    functionNames: (config?.functionNames) || ['useTranslations', 'getTranslations', 't', '$t'],
};

console.log('配置信息:');
console.log('- 源代码目录:', CONFIG.srcDir);
console.log('- 语言包目录:', CONFIG.localesDir);
console.log('- 支持的语言:', CONFIG.locales.join(', '));
console.log('- 文件匹配模式:', CONFIG.filePatterns.join(', '));
console.log('- 忽略的目录:', CONFIG.ignoreDirs.join(', '));
console.log('- 保留已有翻译:', CONFIG.preserveExistingTranslations);
console.log('- 按命名空间组织:', CONFIG.organizeByNamespace);
console.log('- 输出格式:', CONFIG.outputFormat);
console.log('- 提取函数:', CONFIG.functionNames.join(', '));

// 统一从源码字符串中提取（供 .js/.ts/.jsx/.tsx 及 vue 转换后的模板/脚本复用）
function extractKeysFromCode(filePath, code) {
    const keys = new Set();
    let ast;
    try {
        ast = babelParser.parse(code, {
            sourceType: 'unambiguous',
            plugins: [
                'jsx',
                ['decorators', { decoratorsBeforeExport: true }],
                'classProperties',
                'classPrivateProperties',
                'classPrivateMethods',
                'objectRestSpread',
                'typescript',
            ],
        });
    } catch (err) {
        return { keys: [], matchCount: 0 };
    }

    // import 别名收集
    const importNames = {
        useTranslations: new Set(['useTranslations']),
        getTranslations: new Set(['getTranslations']),
    };
    // 可识别的翻译函数名（包含 t、$t、自定义）
    const functionNames = new Set(Array.from(CONFIG.functionNames));

    traverse(ast, {
        ImportDeclaration(path) {
            const src = path.node.source && path.node.source.value;
            if (src === 'next-intl' || src === 'use-intl' || src === 'next-intl/react') {
                path.node.specifiers.forEach((s) => {
                    if (s.imported && s.local && s.imported.name === 'useTranslations') {
                        importNames.useTranslations.add(s.local.name);
                    }
                });
            }
            if (src === 'next-intl/server') {
                path.node.specifiers.forEach((s) => {
                    if (s.imported && s.local && s.imported.name === 'getTranslations') {
                        importNames.getTranslations.add(s.local.name);
                    }
                });
            }
        },
    });

    // t 变量 -> 命名空间
    const translatorVarToNs = new Map();

    traverse(ast, {
        VariableDeclarator(path) {
            const id = path.node.id;
            const init = path.node.init;
            if (!id || !init) return;
            if (id.type === 'Identifier') {
                if (init.type === 'CallExpression' || init.type === 'AwaitExpression') {
                    const call = init.type === 'AwaitExpression' ? init.argument : init;
                    if (call && call.type === 'CallExpression') {
                        let calleeName = '';
                        if (call.callee.type === 'Identifier') calleeName = call.callee.name;
                        if (importNames.useTranslations.has(calleeName) || importNames.getTranslations.has(calleeName)) {
                            const arg0 = call.arguments && call.arguments[0];
                            const ns = arg0 && arg0.type === 'StringLiteral' ? arg0.value : '';
                            translatorVarToNs.set(id.name, ns);
                        }
                    }
                }
            }
        },
    });

    let matchCount = 0;
    traverse(ast, {
        CallExpression(path) {
            const callee = path.node.callee;
            const args = path.node.arguments || [];
            if (!args.length || args[0].type !== 'StringLiteral') return;

            // Identifier 形式：t('key') / $t('key') / 自定义名('key')
            if (callee.type === 'Identifier' && functionNames.has(callee.name)) {
                const tName = callee.name;
                const literal = args[0].value;
                const ns = translatorVarToNs.get(tName) || '';
                const key = ns ? `${ns}.${literal}` : literal;
                keys.add(key);
                console.log('file', filePath, '提取到键:', key, "ns", ns, "functionName:", tName);
                matchCount++;
                return;
            }

            // 成员调用：i18n.t('key') / i18n.$t('key')
            if (
                callee.type === 'MemberExpression' &&
                !callee.computed &&
                callee.property && callee.property.type === 'Identifier' &&
                functionNames.has(callee.property.name)
            ) {
                const literal = args[0].value;
                // 无法确定成员对象的命名空间，直接按字面量处理
                console.log('file', filePath, '提取到键:', literal, "functionName:", callee.property.name);
                keys.add(literal);
                matchCount++;
            }
        },
    });

    return { keys: Array.from(keys), matchCount };
}

// .vue 支持：解析 SFC，脚本块走 Babel，模板编译为 render 代码后继续走 Babel
function extractKeysFromVue(filePath, sfcCode) {
    const keys = new Set();
    let matchCount = 0;

    try {
        const { descriptor } = parseSfc(sfcCode);
        const scriptCode = (descriptor.script?.content || '') + '\n' + (descriptor.scriptSetup?.content || '');
        if (scriptCode.trim()) {
            const { keys: k1, matchCount: c1 } = extractKeysFromCode(filePath, scriptCode);
            k1.forEach((k) => keys.add(k));
            matchCount += c1;
        }
        const templateCode = descriptor.template?.content || '';
        if (templateCode.trim()) {
            const renderCode = compileTpl(templateCode, { mode: 'module' }).code;
            const { keys: k2, matchCount: c2 } = extractKeysFromCode(filePath, renderCode);
            k2.forEach((k) => keys.add(k));
            matchCount += c2;
        }
    } catch (e) {
        // 忽略单个文件错误，避免中断
    }

    return { keys: Array.from(keys), matchCount };
}

function extractKeysFromComments(code) {
    const re = new RegExp(CONFIG.commentRegex || '(?:\\/\\/|\\/\\*)\\s*i18n(?:-key)?:\\s*([a-zA-Z_][\\w]*(?:\\.[a-zA-Z_][\\w]*)+)', 'g');
    const out = [];
    for (const m of code.matchAll(re)) { out.push(m[1]); }
    return out;
}

// 统一入口：按扩展名分发
function extractKeysFromFile(filePath) {
    // console.log('start file',filePath);
    const ext = path.extname(filePath).toLowerCase();
    const code = fs.readFileSync(filePath, 'utf-8');
    const commentKeys = extractKeysFromComments(code);
    let res = { keys: [], matchCount: 0 };
    if (ext === '.vue') res = extractKeysFromVue(filePath, code);
    else if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) res = extractKeysFromCode(filePath, code);
    const merged = new Set([...res.keys, ...commentKeys]);
    return { keys: Array.from(merged), matchCount: res.matchCount + commentKeys.length };
}

function sanitizeKey(key) { return key.replace(/[\s-]/g, '_'); }
function isValidJSIdentifier(str) { return /^[a-zA-Z0-9_$]*$/.test(str); }

function organizeKeysByNamespace(keys) {
    const result = {};
    keys.forEach((key) => {
        const parts = key.split('.');
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const sanitizedPart = !isValidJSIdentifier(part) ? sanitizeKey(part) : part;
            if (!isValidJSIdentifier(sanitizedPart)) return;
            if (!current[sanitizedPart]) current[sanitizedPart] = {};
            current = current[sanitizedPart];
        }
        const lastPart = parts[parts.length - 1];
        const sanitizedLastPart = !isValidJSIdentifier(lastPart) ? sanitizeKey(lastPart) : lastPart;
        if (!current[sanitizedLastPart]) current[sanitizedLastPart] = CONFIG.defaultValue;
    });
    return result;
}

function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (typeof source[key] === 'object' && source[key] !== null && typeof target[key] === 'object' && target[key] !== null) {
                result[key] = deepMerge(target[key], source[key]);
            } else if (CONFIG.preserveExistingTranslations && target[key] !== undefined) {
                result[key] = target[key];
            } else {
                result[key] = source[key];
            }
        }
    }
    return result;
}

function formatObjectToJS(obj, indent = 0) {
    const spaces = ' '.repeat(indent * 2);
    const lines = ['{'];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (typeof value === 'object' && value !== null) {
                lines.push(`${spaces}  ${key}: ${formatObjectToJS(value, indent + 1)},`);
            } else if (typeof value === 'string') {
                lines.push(`${spaces}  ${key}: '${value.replace(/'/g, "\\'")}',`);
            } else {
                lines.push(`${spaces}  ${key}: ${value},`);
            }
        }
    }
    lines.push(`${spaces}}`);
    return lines.join('\n');
}

function updateLocaleFile(locale, keys) {
    const ext = CONFIG.outputFormat === 'json' ? 'json' : 'ts';
    const filePath = path.join(CONFIG.localesDir, `${locale}.${ext}`);
    let existingKeys = {};
    if (fs.existsSync(filePath)) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            existingKeys = CONFIG.outputFormat === 'json' ? JSON.parse(content) : (content.match(/export\s+default\s+(\{[\s\S]*\})/) ? eval(`(${content.match(/export\s+default\s+(\{[\s\S]*\})/)[1]})`) : {});
        } catch (error) {
            console.error(`Error reading locale file ${filePath}:`, error);
        }
    }
    const mergedKeys = deepMerge(existingKeys, keys);
    const content = CONFIG.outputFormat === 'json' ? JSON.stringify(mergedKeys, null, 2) : `export default ${formatObjectToJS(mergedKeys, 0)}`;
    if (!fs.existsSync(CONFIG.localesDir)) fs.mkdirSync(CONFIG.localesDir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`更新语言包文件: ${path.relative(rootDir, filePath)}`);
}

async function main() {
    console.log('开始提取多语言键...');
    const files = [];
    try {
        const relFromSrc = path.relative(CONFIG.srcDir, CONFIG.localesDir).replace(/\\/g, '/');
        if (relFromSrc && !relFromSrc.startsWith('..')) CONFIG.ignoreDirs.push(relFromSrc);
    } catch { }

    const ignorePatterns = [
        ...CONFIG.ignoreDirs.map((dir) => {
            if (!dir) return '';
            if (typeof dir === 'string' && (dir.startsWith('src/') || dir.startsWith('./src/'))) {
                return `**/${dir.replace(/^\.\//, '')}/**`;
            }
            return `**/${dir}/**`;
        }).filter(Boolean),
        ...CONFIG.ignoreFiles,
    ];

    console.log('- 忽略模式:', ignorePatterns.join(', '));

    for (const pattern of CONFIG.filePatterns) {
        const matches = await glob(pattern, { cwd: CONFIG.srcDir, ignore: ignorePatterns, absolute: true });
        files.push(...matches);
    }
    console.log(`找到 ${files.length} 个文件进行扫描.`);

    const allKeys = new Set();
    let totalMatchCount = 0;
    console.log('开始扫描文件:');
    files.forEach((file) => {
        const { keys, matchCount } = extractKeysFromFile(file);
        keys.forEach((k) => allKeys.add(k));
        totalMatchCount += matchCount;
    });
    console.log(`共提取到 ${allKeys.size} 个唯一的多语言键，总共 ${totalMatchCount} 处引用.`);

    const organizedKeys = organizeKeysByNamespace(Array.from(allKeys));
    CONFIG.locales.forEach((locale) => updateLocaleFile(locale, organizedKeys));
    console.log('多语言键提取完成!');
}

main().catch((error) => {
    console.error('提取多语言键时出错:', error);
    process.exit(1);
});
