import fs from 'fs';
import path from 'path';
import { getGitLogs } from '@/lib/git';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ChangelogEntry {
  version: string;
  date: string;
  sections: {
    [key: string]: string[];
  };
}

function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = content.split('\n');
  let currentEntry: ChangelogEntry | null = null;
  let currentSection: string | null = null;

  for (const line of lines) {
    const versionMatch = line.match(/^## \[(.*?)\]/);
    if (versionMatch) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = {
        version: versionMatch[1],
        date: '', // You might want to parse date if available in header like ## [1.0.0] - 2023-10-27
        sections: {},
      };
      currentSection = null;
      continue;
    }

    if (!currentEntry) continue;

    const sectionMatch = line.match(/^### (.*)/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      currentEntry.sections[currentSection] = [];
      continue;
    }

    if (currentSection && line.trim().startsWith('-')) {
      // Clean up markdown bold syntax if present
      const cleanLine = line.trim().replace(/^- /, '').replace(/\*\*(.*?)\*\*/g, '$1');
      if (currentEntry.sections[currentSection]) {
        currentEntry.sections[currentSection].push(cleanLine);
      }
    }
  }

  if (currentEntry) entries.push(currentEntry);
  return entries;
}


export default async function ChangelogPage() {
  const filePath = path.join(process.cwd(), 'src/app/(admin)/changelog/CHANGELOG.md');
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    content = '# Changelog\n\nNo changelog found.';
  }

  const entries = parseChangelog(content);
  const gitLogs = await getGitLogs(50);

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">系统更新日志</h1>
        <p className="text-muted-foreground">详细记录系统的变更历史、功能改进与问题修复。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Manual Changelog (Releases) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold">版本发布记录</h2>
            <Separator className="flex-1" />
          </div>
          
          <div className="space-y-10">
            {entries.map((entry, index) => (
              <div key={index} className="relative pl-8 border-l-2 border-primary/20 last:border-0 pb-8 last:pb-0">
                 <div className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                
                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-foreground">
                      {entry.version}
                    </h2>
                    {entry.version === '未发布' && (
                      <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium border border-primary/20">
                        开发中
                      </span>
                    )}
                  </div>
                  {entry.date && <p className="text-sm text-muted-foreground mt-1">{entry.date}</p>}
                </div>

                <div className="space-y-5">
                  {Object.entries(entry.sections).map(([section, items]) => (
                    <div key={section} className="bg-card/50 rounded-lg p-4 border border-border/50">
                      <h3 className="text-sm font-semibold mb-3 text-foreground uppercase tracking-wider flex items-center gap-2">
                        {section.includes('新增') && <span className="w-2 h-2 rounded-full bg-green-500" />}
                        {section.includes('优化') && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                        {section.includes('修复') && <span className="w-2 h-2 rounded-full bg-red-500" />}
                        {section}
                      </h3>
                      <ul className="space-y-2">
                        {items.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2.5">
                             <span className="mt-1.5 h-1 w-1 rounded-full bg-foreground/40 flex-shrink-0" />
                             <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Git Commit Log */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <div className="flex items-center gap-2 mb-4">
               <h2 className="text-xl font-semibold">最近代码提交</h2>
               <Separator className="flex-1" />
            </div>
            
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
               <ScrollArea className="h-[calc(100vh-200px)]">
                 <div className="p-4 space-y-4">
                    {gitLogs.map((log) => (
                      <div key={log.hash} className="group flex flex-col gap-1 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                         <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                              {log.hash.substring(0, 7)}
                            </span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {log.date}
                            </span>
                         </div>
                         <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                           {log.message}
                         </p>
                         <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                              {log.author.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {log.author}
                            </span>
                         </div>
                      </div>
                    ))}
                 </div>
               </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
