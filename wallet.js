const createEVMWalletCsv = require('create-evm-wallets-csv');
const fs = require('fs');
const path = require('path');

const dir = '/Users/zou-macmini-m4/Desktop/wallet/irys'
const date = new Date().toISOString().split('T')[0]
const filename = `${dir}/irys-${date}.csv`

// 生成CSV文件
createEVMWalletCsv({
    path: filename
});

// 等待CSV文件生成完成后读取并提取地址
setTimeout(() => {
    try {
        console.log(`正在读取CSV文件: ${filename}`);
        
        // 读取CSV文件
        const csvContent = fs.readFileSync(filename, 'utf8');
        console.log('CSV文件内容:');
        console.log(csvContent);
        console.log('-------------------');
        
        const lines = csvContent.trim().split('\n');
        console.log(`CSV文件总行数: ${lines.length}`);
        
        // 显示标题行
        if (lines.length > 0) {
            console.log(`标题行: ${lines[0]}`);
        }
        
        // 跳过标题行，提取地址列（第二列，索引为1）
        const addresses = [];
        for (let i = 1; i < lines.length; i++) {
            console.log(`处理第 ${i} 行: ${lines[i]}`);
            const columns = lines[i].split(',');
            console.log(`分割后的列数: ${columns.length}`);
            console.log(`各列内容:`, columns);
            
            if (columns.length >= 2) {
                // 移除可能的引号
                const address = columns[1].replace(/"/g, '');
                console.log(`提取的地址: ${address}`);
                addresses.push(address);
            } else {
                console.log(`第 ${i} 行列数不足，跳过`);
            }
        }
        
        console.log(`总共提取到 ${addresses.length} 个地址`);
        console.log('所有地址:');
        addresses.forEach((addr, index) => {
            console.log(`${index + 1}: ${addr}`);
        });
        
        // 生成address.txt文件
        const addressFile = './address.txt';
        fs.writeFileSync(addressFile, addresses.join('\n'), 'utf8');
        
        console.log(`成功生成 ${addresses.length} 个地址到 ${addressFile}`);
        console.log(`CSV文件路径: ${filename}`);
        
    } catch (error) {
        console.error('读取CSV文件或生成address.txt时出错:', error);
    }
}, 1000); // 等待1秒确保CSV文件完全写入
