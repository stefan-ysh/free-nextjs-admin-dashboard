import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CommitLog {
  hash: string;
  date: string;
  author: string;
  message: string;
}

export async function getGitLogs(limit: number = 50): Promise<CommitLog[]> {
  try {
    // Format: hash|date|author|message
    const { stdout } = await execAsync(`git log -n ${limit} --pretty=format:"%h|%ad|%an|%s" --date=short`);
    
    return stdout
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [hash, date, author, message] = line.split('|');
        return {
          hash,
          date,
          author,
          message,
        };
      });
  } catch (error) {
    console.error('Failed to fetch git logs:', error);
    return [];
  }
}
