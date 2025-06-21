const fs = require('fs');
const axios = require('axios');

const SCRAPER_URL = 'http://localhost:3000/cf-clearance-scraper';
const FAUCET_URL = 'https://irys.xyz/api/faucet';
const TARGET_URL = 'https://irys.xyz/faucet';
const SITE_KEY = '0x4AAAAAAA6vnrvBCtS4FAl-';

const addresses = fs.readFileSync('./address.txt', 'utf-8').trim().split('\n');
const proxies = fs.existsSync('./proxies.txt')
  ? fs.readFileSync('./proxies.txt', 'utf-8').trim().split('\n')
  : [];

const successLog = fs.createWriteStream('success.log', { flags: 'a' });
const errorLog = fs.createWriteStream('error.log', { flags: 'a' });
const resultLog = fs.createWriteStream('result.log', { flags: 'a' });

// 添加统计计数器
let successCount = 0;
let failureCount = 0;
let tokenFailureCount = 0;
let faucetFailureCount = 0;

function logSuccess(msg, wallet = '') {
  const logMsg = wallet ? `[${wallet}] ${msg}` : msg;
  console.log(`✅ ${msg}`);
  successLog.write(logMsg + '\n');
  successCount++; // 增加成功计数
}

function logError(msg, wallet = '') {
  const logMsg = wallet ? `[${wallet}] ${msg}` : msg;
  console.error(`❌ ${msg}`);
  errorLog.write(logMsg + '\n');
  failureCount++; // 增加失败计数
}

async function getToken(wallet, proxy) {
  const body = {
    url: TARGET_URL,
    siteKey: SITE_KEY,
    mode: 'turnstile-min'
  };

  console.log(`🧠 正在为 ${wallet} 破解 Turnstile 验证码...`);

  if (proxy) {
    try {
      const proxyUrl = new URL(proxy);
      body.proxy = {
        host: proxyUrl.hostname,
        port: parseInt(proxyUrl.port),
        username: proxyUrl.username || undefined,
        password: proxyUrl.password || undefined
      };
    } catch (err) {
      logError(`${wallet} - 无效代理格式: ${proxy}`);
      return null;
    }
  }

  try {
    const res = await axios.post(SCRAPER_URL, body, {
      headers: { 'Content-Type': 'application/json' }
    });

    const json = res.data;
    const token = json.captchaToken || json.token;

    if (token) {
      console.log(`🎫 ${wallet} 成功获取 Token`);
      return {
        token,
        userAgent: json.headers?.['user-agent'] || 'Mozilla/5.0',
        cookie: json.cookies?.map(c => `${c.name}=${c.value}`).join('; ') || ''
      };
    } else {
      logError(`token 获取失败: ${JSON.stringify(json)}`, wallet);
      return null;
    }
  } catch (err) {
    logError(`请求错误: ${err.message}`, wallet);
    return null;
  }
}

async function submitFaucet(wallet, tokenData, proxy) {
  try {
    const res = await axios.post(FAUCET_URL, {
      captchaToken: tokenData.token,
      walletAddress: wallet
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': TARGET_URL,
        'Referer': TARGET_URL,
        'User-Agent': tokenData.userAgent,
        'Cookie': tokenData.cookie,
        'Proxy': proxy
      }
    });

    if (res.data?.success) {
      logSuccess(`Faucet 成功: ${res.data.message}`, wallet);
    } else {
      logError(`Faucet 异常返回: ${JSON.stringify(res.data)}`, wallet);
      faucetFailureCount++; // Faucet 特定失败计数
    }
  } catch (err) {
    logError(`Faucet 请求失败: ${JSON.stringify(err.response?.data || err.message)}`, wallet);
    faucetFailureCount++; // Faucet 特定失败计数
  }
}

(async () => {
  const totalAddresses = addresses.filter(addr => addr.trim().startsWith('0x')).length;
  console.log(`🎯 开始处理 ${totalAddresses} 个钱包地址`);
  console.log('===================================');

  // 创建成功和失败地址列表用于统计
  const successfulAddresses = [];
  const failedAddresses = [];

  for (let i = 0; i < addresses.length; i++) {
    const wallet = addresses[i].trim();
    const proxy = proxies[i]?.trim() || null;

    if (!wallet.startsWith('0x')) continue;

    console.log(`🚀 处理地址: ${wallet}`);
    if (proxy) console.log(`🌐 使用代理: ${proxy}`);

    const tokenData = await getToken(wallet, proxy);
    if (!tokenData) {
      logError(`跳过（未获取到 token）`, wallet);
      tokenFailureCount++; // Token 获取失败计数
      failedAddresses.push(wallet);
      continue;
    }

    const initialSuccessCount = successCount;
    await submitFaucet(wallet, tokenData, proxy);
    
    // 检查这个地址是否成功
    if (successCount > initialSuccessCount) {
      successfulAddresses.push(wallet);
    } else {
      failedAddresses.push(wallet);
    }
    
    console.log('-----------------------------------');
    await new Promise(r => setTimeout(r, 5000));
  }

  // 添加统计信息输出
  console.log('\n');
  console.log('📊 =============== 执行统计 ===============');
  console.log(`📈 总处理地址数: ${totalAddresses}`);
  console.log(`✅ 成功数量: ${successCount}`);
  console.log(`❌ 失败数量: ${failureCount}`);
  console.log(`🎫 Token获取失败: ${tokenFailureCount}`);
  console.log(`💧 Faucet请求失败: ${faucetFailureCount}`);
  console.log(`📊 成功率: ${totalAddresses > 0 ? ((successCount / totalAddresses) * 100).toFixed(2) : 0}%`);
  console.log('=========================================');

  // 将统计信息和地址列表写入日志文件
  const statsMsg = `\n=================== 执行统计 ===================
总处理地址数: ${totalAddresses}
成功数量: ${successCount}
失败数量: ${failureCount}
Token获取失败: ${tokenFailureCount}
Faucet请求失败: ${faucetFailureCount}
成功率: ${totalAddresses > 0 ? ((successCount / totalAddresses) * 100).toFixed(2) : 0}%

成功地址列表 (${successfulAddresses.length}个):
${successfulAddresses.map(addr => `✅ ${addr}`).join('\n')}

失败地址列表 (${failedAddresses.length}个):
${failedAddresses.map(addr => `❌ ${addr}`).join('\n')}
===============================================`;

  resultLog.write(statsMsg + '\n');

  successLog.close();
  errorLog.close();
  resultLog.close();
})();
