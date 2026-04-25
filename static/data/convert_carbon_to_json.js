const fs = require('fs');
const path = require('path');

// 读取carbonData2.js文件
const carbonDataPath = path.join(__dirname, 'carbonData2.js');
const content = fs.readFileSync(carbonDataPath, 'utf8');

// 提取carbonData对象
// 文件格式: const carbonData = {...}; module.exports = carbonData;
// 使用eval执行文件，获取carbonData对象
const Module = require('module');
const originalRequire = Module.prototype.require;

// 临时修改require，避免依赖问题
Module.prototype.require = function(id) {
  if (id === './carbonData2.js') {
    // 返回空对象
    return {};
  }
  return originalRequire.apply(this, arguments);
};

// 在沙盒中执行
const vm = require('vm');
const sandbox = { console, require: Module.prototype.require, exports: {}, module: { exports: {} } };
const script = new vm.Script(content);
script.runInNewContext(sandbox);

// 获取carbonData对象
let carbonData = sandbox.module.exports || sandbox.exports;

// 如果上面失败，尝试正则表达式提取
if (!carbonData || Object.keys(carbonData).length === 0) {
  console.log('尝试正则表达式提取...');
  const match = content.match(/const carbonData = (\{[\s\S]*?\});\s*module\.exports = carbonData;/);
  if (match && match[1]) {
    try {
      carbonData = eval('(' + match[1] + ')');
    } catch (e) {
      console.error('正则提取失败:', e);
    }
  }
}

if (!carbonData || Object.keys(carbonData).length === 0) {
  console.error('无法提取carbonData对象');
  process.exit(1);
}

console.log(`成功提取carbonData对象，年份: ${Object.keys(carbonData).length}`);

// 写入JSON文件
const outputPath = path.join(__dirname, 'carbonData2.json');
fs.writeFileSync(outputPath, JSON.stringify(carbonData, null, 2), 'utf8');
console.log(`JSON文件已保存到: ${outputPath}`);