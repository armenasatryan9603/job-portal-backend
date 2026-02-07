#!/usr/bin/env node

/**
 * Script to get an access token using OTP authentication
 * 
 * Usage:
 *   node scripts/get-access-token.js <phone> <countryCode> [options]
 * 
 * Options:
 *   --simulator    Use simulator mode (OTP will be returned in response)
 *   --backend-url  Backend URL (default: http://localhost:8080)
 *   --name         User name (optional, for new users)
 *   --referral     Referral code (optional)
 * 
 * Examples:
 *   node scripts/get-access-token.js 123456789 374 --simulator
 *   node scripts/get-access-token.js 123456789 374 --backend-url https://job-portal-backend-eight-sand.vercel.app
 */

const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const phone = args[0];
const countryCode = args[1];

if (!phone || !countryCode) {
  console.error('Usage: node scripts/get-access-token.js <phone> <countryCode> [options]');
  console.error('Example: node scripts/get-access-token.js 123456789 374 --simulator');
  process.exit(1);
}

// Parse options
const options = {
  simulator: args.includes('--simulator'),
  backendUrl: getArgValue('--backend-url') || 'https://job-portal-backend-eight-sand.vercel.app',
  name: getArgValue('--name'),
  referral: getArgValue('--referral'),
};

function getArgValue(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function sendOTP() {
  const url = `${options.backendUrl}/auth/send-otp`;
  const body = {
    phone,
    countryCode,
    isSimulator: options.simulator,
  };

  console.log(`\n📱 Sending OTP to ${countryCode}${phone}...`);
  console.log(`   Backend URL: ${options.backendUrl}`);
  console.log(`   Simulator mode: ${options.simulator ? 'Yes' : 'No'}\n`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (options.simulator && data.otp) {
      console.log(`✅ OTP sent successfully (simulator mode)`);
      console.log(`🔑 Your OTP: ${data.otp}\n`);
      return data.otp;
    } else if (data.otp) {
      // Development mode might return OTP
      console.log(`✅ OTP sent successfully`);
      console.log(`🔑 Your OTP: ${data.otp}\n`);
      return data.otp;
    } else {
      console.log(`✅ OTP sent successfully`);
      console.log(`📨 Please check your phone for the OTP code\n`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error sending OTP: ${error.message}`);
    if (error.message.includes('fetch')) {
      console.error(`   Make sure the backend is running at ${options.backendUrl}`);
    }
    throw error;
  }
}

async function verifyOTP(otp) {
  const url = `${options.backendUrl}/auth/verify-otp`;
  const body = {
    phone,
    countryCode,
    otp,
    isSimulator: options.simulator,
  };

  if (options.name) {
    body.name = options.name;
  }

  if (options.referral) {
    body.referralCode = options.referral;
  }

  console.log(`🔐 Verifying OTP...\n`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ Error verifying OTP: ${error.message}`);
    throw error;
  }
}

async function main() {
  try {
    // Step 1: Send OTP
    let otp = await sendOTP();

    // Step 2: Get OTP from user if not in simulator mode or not returned
    if (!otp) {
      otp = await question('Enter the OTP code: ');
    }

    // Step 3: Verify OTP and get access token
    const result = await verifyOTP(otp);

    // Step 4: Display results
    console.log('\n' + '='.repeat(60));
    console.log('✅ Authentication Successful!');
    console.log('='.repeat(60));
    console.log('\n📋 User Information:');
    console.log(`   ID: ${result.user.id}`);
    console.log(`   Name: ${result.user.name || 'N/A'}`);
    console.log(`   Phone: ${result.user.phone}`);
    console.log(`   Email: ${result.user.email || 'N/A'}`);
    console.log(`   Role: ${result.user.role}`);
    console.log(`   Credit Balance: ${result.user.creditBalance || 0}`);
    
    console.log('\n🔑 Access Token:');
    console.log(result.access_token);
    
    console.log('\n💡 Usage Example:');
    console.log(`   curl -H "Authorization: Bearer ${result.access_token}" \\`);
    console.log(`        ${options.backendUrl}/credit/transactions`);
    
    console.log('\n📝 Save this token for API requests!');
    console.log('='.repeat(60) + '\n');

    // Save token to file (optional)
    const fs = require('fs');
    const tokenFile = '.access-token.txt';
    fs.writeFileSync(tokenFile, result.access_token, 'utf8');
    console.log(`💾 Token saved to: ${tokenFile}\n`);

  } catch (error) {
    console.error(`\n❌ Failed to get access token: ${error.message}\n`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
main();
