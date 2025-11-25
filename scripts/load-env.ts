import path from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';

const cwd = process.cwd();
dotenv.config({ path: path.join(cwd, '.env.local') });
dotenv.config({ path: path.join(cwd, '.env') });
