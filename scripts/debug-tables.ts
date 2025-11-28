import './load-env';
import { mysqlPool } from '@/lib/mysql';
import { RowDataPacket } from 'mysql2';

async function describeTable() {
    const pool = mysqlPool();
    try {
        console.log('Describing finance_records table...');
        const [rows] = await pool.query<RowDataPacket[]>('DESCRIBE finance_records');
        console.log('Columns:', rows.map(r => r.Field));
    } catch (error) {
        console.error('Error describing table:', error);
    } finally {
        await pool.end();
    }
}

describeTable();
