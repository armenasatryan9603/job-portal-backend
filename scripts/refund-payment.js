#!/usr/bin/env node

/**
 * Script to refund a payment transaction (full or partial)
 * 
 * Usage:
 *   node scripts/refund-payment.js <paymentID> <orderID> [amount] [options]
 * 
 * Arguments:
 *   paymentID  - Payment ID from completed transaction
 *   orderID    - Order ID from completed transaction
 *   amount     - Optional amount in AMD for partial refund (omit for full refund)
 * 
 * Options:
 *   --token <TOKEN>      - Access token (default: reads from .access-token.txt)
 *   --backend-url <URL> - Backend URL (default: http://localhost:8080)
 * 
 * Examples:
 *   # Full refund
 *   node scripts/refund-payment.js 12345678 30164001
 * 
 *   # Partial refund (5 AMD)
 *   node scripts/refund-payment.js 12345678 30164001 5
 * 
 *   # With custom token and backend URL
 *   node scripts/refund-payment.js 12345678 30164001 --token YOUR_TOKEN --backend-url https://job-portal-backend-eight-sand.vercel.app
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const paymentID = args[0];
const orderID = args[1];

// Check if third argument is amount or option flag
let amount = null;
if (args[2] && !args[2].startsWith('--')) {
  amount = parseFloat(args[2]);
}

if (!paymentID || !orderID) {
  console.error('Usage: node scripts/refund-payment.js <paymentID> <orderID> [amount] [options]');
  console.error('Example: node scripts/refund-payment.js 12345678 30164001');
  console.error('Example (partial): node scripts/refund-payment.js 12345678 30164001 5');
  process.exit(1);
}

// Parse options
function getArgValue(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

const options = {
  token: getArgValue('--token'),
  backendUrl: getArgValue('--backend-url') || 'http://localhost:8080',
};

// Read token from file if not provided
if (!options.token) {
  const tokenFile = path.join(__dirname, '.access-token.txt');
  if (fs.existsSync(tokenFile)) {
    try {
      options.token = fs.readFileSync(tokenFile, 'utf8').trim();
    } catch (error) {
      console.error(`Warning: Could not read token from ${tokenFile}`);
    }
  }
}

if (!options.token) {
  console.error('❌ Access token is required!');
  console.error('   Provide it with --token option or save it to .access-token.txt');
  console.error('   Use get-access-token.js script to obtain a token first.');
  process.exit(1);
}

async function refundPayment() {
  const url = `${options.backendUrl}/credit/payment/refund`;
  
  const body = {
    paymentID,
    orderID,
  };

  // Add amount only if provided (for partial refund)
  if (amount !== null && amount !== undefined) {
    if (amount <= 0) {
      throw new Error('Refund amount must be greater than 0');
    }
    body.amount = amount;
  }

  const refundType = amount !== null ? `partial (${amount} AMD)` : 'full';
  
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Refunding payment...');
  console.log('='.repeat(60));
  console.log(`PaymentID: ${paymentID}`);
  console.log(`OrderID: ${orderID}`);
  console.log(`Refund Type: ${refundType}`);
  console.log(`Backend URL: ${options.backendUrl}`);
  console.log('='.repeat(60) + '\n');

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
      const errorMessage = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error(`❌ Error: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    console.log('✅ Payment refunded successfully!');
    console.log(`   ${data.message || 'Refund completed'}\n`);

    return data;
  } catch (error) {
    console.error(`\n❌ Error refunding payment: ${error.message}\n`);
    
    // Provide helpful advice for common errors
    if (error.message.includes('fetch')) {
      console.error('💡 Tip: Make sure the backend is running and accessible at:');
      console.error(`   ${options.backendUrl}\n`);
    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('💡 Tip: Your access token may have expired.');
      console.error('   Run get-access-token.js to obtain a new token.\n');
    } else if (error.message.includes('Amount is invalid')) {
      console.error('💡 Tip: Make sure the refund amount is valid:');
      console.error('   - For full refund: omit the amount parameter');
      console.error('   - For partial refund: amount must be > 0 and <= original payment amount\n');
    } else if (error.message.includes('already refunded') || error.message.includes('cannot be refunded')) {
      console.error('💡 Tip: This payment may have already been refunded.');
      console.error('   Each payment can only be refunded once.\n');
    }
    
    process.exit(1);
  }
}

// Run the script
refundPayment();
