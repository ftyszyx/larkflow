/**
 * 多语言提取工具配置文件
 */
module.exports = {
  // 源代码目录（相对于项目根目录）
  srcDir: './src',
  // 语言包输出目录（相对于项目根目录）
  outputDir: './src/locales',
  // 输出格式: 'ts' 或 'json'
  outputFormat: 'json',

  // 支持的语言列表
  locales: ['zh-CN', 'en-US'],

  // 要扫描的文件类型
  filePatterns: ['**/*.vue', '**/*.ts', '**/*.js', '**/*.jsx', '**/*.tsx'],

  // 忽略的目录
  ignoreDirs: ["/vendors"],

  // 忽略的文件
  ignoreFiles: [],

  // 是否保留已有的翻译
  preserveExistingTranslations: true,

  // 是否按命名空间组织键
  organizeByNamespace: true,
  // 提取函数
  functionNames: ['GetLang', 't', '$t'],
  // 默认值（当找不到翻译时）
  defaultValue: '',
}; 