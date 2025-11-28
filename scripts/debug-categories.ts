import './load-env';
import { mysqlPool } from '@/lib/mysql';
import { RowDataPacket } from 'mysql2';

async function checkCategories() {
    const pool = mysqlPool();
    try {
        console.log('Checking category distribution...');
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT category, type, COUNT(*) as count FROM finance_records GROUP BY category, type ORDER BY type, count DESC'
        );

        console.log('Current Categories:');
        rows.forEach(row => {
            console.log(`[${row.type}] ${row.category}: ${row.count}`);
        });
    } catch (error) {
        console.error('Error checking categories:', error);
    } finally {
        await pool.end();
    }
}

checkCategories();
