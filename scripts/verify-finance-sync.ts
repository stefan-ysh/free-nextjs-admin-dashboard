
import './load-env';
import { mysqlPool, mysqlQuery } from '../src/lib/mysql';
import { 
  createPurchase, 
  submitPurchase,
  approvePurchase, 
  submitReimbursement, 
  markAsPaid 
} from '../src/lib/db/purchases';
import { findRecordByPurchasePaymentId } from '../src/lib/db/finance';
import { CreatePurchaseInput } from '../src/types/purchase';

async function main() {
  const pool = mysqlPool();
  
  try {
    console.log('Starting Finance Sync Verification...');

    // 1. Get an existing user as operator
    const [users] = await pool.query<any[]>('SELECT id FROM hr_employees LIMIT 1');
    if (!users.length) throw new Error('No users found');
    const operatorId = users[0].id;
    console.log('Using operator:', operatorId);

    // 2. Create Purchase
    const input: CreatePurchaseInput = {
      purchaseDate: new Date().toISOString(),
      organizationType: 'company',
      itemName: 'Test Sync Item',
      quantity: 1,
      unitPrice: 100,
      purchaseChannel: 'online',
      purchaseLink: 'http://test.com',
      purpose: 'Test Finance Sync',
      paymentMethod: 'bank_transfer',
      paymentType: 'full',
      purchaserId: operatorId,
      invoiceType: 'none',
      hasInvoice: false,
    };

    console.log('Creating Purchase...');
    const purchase = await createPurchase(input, operatorId);
    console.log('Purchase Created:', purchase.id);

    // 2.5 Submit
    console.log('Submitting Purchase...');
    await submitPurchase(purchase.id, operatorId);

    // 3. Approve
    console.log('Approving Purchase...');
    await approvePurchase(purchase.id, operatorId);

    // 4. Submit Reimbursement
    console.log('Submitting Reimbursement...');
    try {
      await submitReimbursement(purchase.id, operatorId);
    } catch (e: any) {
      // If it fails because of invoice, we might need to update the purchase to have invoice images
      if (e.message.includes('INVOICE_FILES_REQUIRED')) {
        // Mock invoice update if needed, but for 'invoiceType: none' it should be fine?
        // Wait, logic says 'hasInvoiceEvidence(existing)'
        // Let's check hasInvoiceEvidence logic if it fails.
        // For now assume it works or we'll fix it.
        // Actually, 'invoiceType: none' might skip this requirement?
        // Let's modify invoiceType to 'normal' and add image just in case to be safe?
        // Or if 'none', maybe we don't need reimbursement?
        // Let's stick with 'none' first.
      }
      throw e;
    }

    // 5. Pay
    console.log('Paying...');
    const paidPurchase = await markAsPaid(purchase.id, operatorId, 100, 'Test Payment');
    // console.log('Paid. Payment ID:', paidPurchase.payments[0].id); // PurchaseRecord doesn't have payments
    // const paymentId = paidPurchase.payments[0].id;

    // 6. Verify Expense
    console.log('Verifying Expense Record...');
    // expense is created with purchaseId
    const [rows] = await pool.query<any[]>('SELECT * FROM finance_records WHERE purchase_id = ?', [purchase.id]);
    const expense = rows[0];
    
    if (expense) {
      console.log('SUCCESS! Expense Record Found:', expense.id);
      console.log({
        id: expense.id,
        name: expense.name,
        amount: expense.contract_amount, // DB column is snake_case
        category: expense.category,
        paymentType: expense.payment_type
      });
    } else {
      console.error('FAILURE! No Expense Record found for purchase:', purchase.id);
      process.exit(1);
    }

  } catch (error) {
    console.error('Test Failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
