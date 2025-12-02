import 'dotenv/config';
import { hashPassword } from '../src/lib/auth/password';
import { mysqlPool } from '../src/lib/mysql';

const EMAIL = 'stefan_ysh@foxmail.com';
const NEW_PASSWORD = 'Yuanshuai2021';

async function resetPassword() {
    try {
        console.log(`Resetting password for ${EMAIL}...`);

        const pool = mysqlPool();

        // 1. Check if user exists
        const [users] = await pool.query<any[]>(
            'SELECT id, email, password_hash FROM users WHERE email = ?',
            [EMAIL]
        );

        if (users.length === 0) {
            console.error(`User with email ${EMAIL} not found in users table!`);
            process.exit(1);
        }

        const user = users[0];
        console.log(`Found user: ${user.id}`);

        // 2. Hash new password
        const passwordHash = await hashPassword(NEW_PASSWORD);

        // 3. Update password
        await pool.query(
            'UPDATE users SET password_hash = ?, password_updated_at = NOW(), updated_at = NOW() WHERE id = ?',
            [passwordHash, user.id]
        );

        console.log('✅ Password reset successfully!');
        console.log(`Email: ${EMAIL}`);
        console.log(`New Password: ${NEW_PASSWORD}`);

    } catch (error) {
        console.error('Error resetting password:', error);
    } finally {
        process.exit(0);
    }
}

resetPassword();
