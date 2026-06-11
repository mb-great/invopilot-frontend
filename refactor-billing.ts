import fs from 'fs';
import path from 'path';

function walk(dir: string, callback: (filepath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('/Users/mbgreat/Desktop/invopilot/invopilot-frontend/src/app', (filepath) => {
  if (filepath.endsWith('.tsx') && !filepath.includes('node_modules')) {
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Check if it imports DashboardShell
    if (content.includes('DashboardShell')) {
      let changed = false;
      
      // Update imports if needed
      if (!content.includes("import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess'")) {
        // Find where resolvePlanAccess is imported and replace it, or add it
        if (content.includes("import { resolvePlanAccess }")) {
          content = content.replace(
            /import { resolvePlanAccess } from '@\/lib\/billing\/tiers'[;]?/g, 
            "import { resolvePlanAccess } from '@/lib/billing/tiers';\nimport { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';"
          );
          content = content.replace(
            /import { resolvePlanAccess } from "@\/lib\/billing\/tiers"[;]?/g, 
            "import { resolvePlanAccess } from '@/lib/billing/tiers';\nimport { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';"
          );
        }
      }

      // Replace const access = resolvePlanAccess(...) with const access = await getWorkspaceAccess(supabase);
      if (content.match(/const access = resolvePlanAccess\([^)]+\);/)) {
        content = content.replace(/const access = resolvePlanAccess\([^)]+\);/g, "const access = await getWorkspaceAccess(supabase);");
        changed = true;
      } else if (content.match(/const access = resolvePlanAccess\([\s\S]*?\);/m)) {
        content = content.replace(/const access = resolvePlanAccess\([\s\S]*?\);/g, "const access = await getWorkspaceAccess(supabase);");
        changed = true;
      }

      // Replace DashboardShell props
      const oldShellPropsRegex = /<DashboardShell[\s\S]*?tier=\{[^}]*\}[\s\S]*?>/g;
      const oldShellPropsRegex2 = /<DashboardShell[\s\S]*?isAdmin=\{[^}]*\}[\s\S]*?>/g;

      if (content.match(oldShellPropsRegex) || content.match(oldShellPropsRegex2)) {
         content = content.replace(
            /<DashboardShell\s+userEmail=\{([^}]+)\}\s+userName=\{([^}]+)\}\s+avatarUrl=\{([^}]+)\}[\s\S]*?>/g,
            "<DashboardShell\n      userEmail={$1}\n      userName={$2}\n      avatarUrl={$3}\n      access={access}\n    >"
         );
         changed = true;
      }

      if (changed) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated ${filepath}`);
      }
    }
  }
});
