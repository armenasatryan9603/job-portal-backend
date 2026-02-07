#!/usr/bin/env node

/**
 * Script to cancel a payment
 * 
 * Usage:
 *   node scripts/cancel-payment.js <paymentID> <orderID> [options]
 * 
 * Options:
 *   --token         Access token (default: reads from .access-token.txt)
 *   --backend-url   Backend URL (default: http://localhost:8080)
 * 
 * Examples:
 *   node scripts/cancel-payment.js 12345678 30164001
 *   node scripts/cancel-payment.js 12345678 30164001 --backend-url https://job-portal-backend-eight-sand.vercel.app
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const paymentID = args[0];
const orderID = args[1];

if (!paymentID || !orderID) {
  console.error('Usage: node scripts/cancel-payment.js <paymentID> <orderID> [options]');
  console.error('Example: node scripts/cancel-payment.js 12345678 30164001');
  process.exit(1);
}

// Parse options
const options = {
  token: getArgValue('--token') || readTokenFromFile(),
  backendUrl: getArgValue('--backend-url') || 'https://job-portal-backend-eight-sand.vercel.app',
};

function getArgValue(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function readTokenFromFile() {
  const tokenFile = path.join(__dirname, '..', '.access-token.txt');
  try {
    if (fs.existsSync(tokenFile)) {
      return fs.readFileSync(tokenFile, 'utf8').trim();
    }
  } catch (error) {
    // Ignore errors, will prompt for token
  }
  return null;
}

async function cancelPayment() {
  if (!options.token) {
    console.error('❌ Error: Access token is required');
    console.error('   Either provide --token option or ensure .access-token.txt exists');
    console.error('   Run: node scripts/get-access-token.js <phone> <countryCode> --simulator');
    process.exit(1);
  }

  const url = `${options.backendUrl}/credit/payment/cancel`;
  const body = {
    paymentID,
    orderID,
  };

  console.log(`\n🔄 Canceling payment...`);
  console.log(`   PaymentID: ${paymentID}`);
  console.log(`   OrderID: ${orderID}`);
  console.log(`   Backend URL: ${options.backendUrl}\n`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      // Show full error details
      const errorMsg = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error(`\n❌ Backend Error Response:`);
      console.error(`   Status: ${response.status}`);
      console.error(`   Message: ${errorMsg}`);
      if (data.response) {
        console.error(`   Response Code: ${data.response.ResponseCode || 'N/A'}`);
        console.error(`   Response Message: ${data.response.ResponseMessage || 'N/A'}`);
        console.error(`   Description: ${data.response.Description || data.response.TrxnDescription || 'N/A'}`);
      }
      console.error(`\n📄 Full Error Response:`);
      console.error(JSON.stringify(data, null, 2));
      throw new Error(errorMsg);
    }

    // Display results
    console.log('='.repeat(60));
    console.log('✅ Payment Canceled Successfully!');
    console.log('='.repeat(60));
    console.log('\n📋 Response Details:');
    
    if (data.response) {
      console.log(`   Response Code: ${data.response.ResponseCode || 'N/A'}`);
      console.log(`   Response Message: ${data.response.ResponseMessage || 'N/A'}`);
      if (data.response.PaymentID) {
        console.log(`   Payment ID: ${data.response.PaymentID}`);
      }
      if (data.response.OrderID) {
        console.log(`   Order ID: ${data.response.OrderID}`);
      }
    }
    
    if (data.message) {
      console.log(`\n💬 Message: ${data.message}`);
    }
    
    console.log('\n📄 Full Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error(`\n❌ Error canceling payment: ${error.message}\n`);
    
    // Show additional error details if available
    if (error.response) {
      console.error(`   Response Status: ${error.response.status}`);
      console.error(`   Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      console.error(`   Make sure the backend is running at ${options.backendUrl}`);
    }
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('   Token may be expired. Get a new token:');
      console.error('   node scripts/get-access-token.js <phone> <countryCode> --simulator');
    }
    
    // Common cancellation errors
    if (error.message.includes('Reversal is impossible') || error.message.includes('impossible')) {
      console.error('\n💡 This payment cannot be canceled because:');
      console.error('   - It may already be completed/settled');
      console.error('   - It may have already been canceled');
      console.error('   - It may be too old to cancel');
      console.error('\n   Try canceling a payment immediately after initiation (before completing it).');
    }
    
    process.exit(1);
  }
}

// Run the script
cancelPayment();
