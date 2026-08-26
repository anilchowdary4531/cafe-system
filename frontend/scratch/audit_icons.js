import fs from 'fs';
import path from 'path';

function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

const lucideIcons = [
    'UserCheck', 'Users', 'User', 'Search', 'Settings', 'Store', 'Building2', 'LayoutDashboard',
    'Menu', 'X', 'Coins', 'ShieldCheck', 'Calendar', 'Sparkles', 'Trash2', 'ImageIcon',
    'Utensils', 'Wallet', 'BarChart3', 'Power', 'Globe', 'Filter', 'ArrowUpRight', 'ArrowDownLeft',
    'TrendingUp', 'CreditCard', 'ShieldAlert', 'PlusCircle', 'MinusCircle', 'Check', 'AlertTriangle',
    'ChevronRight', 'ChevronLeft', 'Clock', 'Phone', 'Mail', 'MapPin', 'Edit', 'Eye', 'Lock', 'Unlock'
];

const files = getAllFiles('./src');
const issues = [];

files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find imported symbols from lucide-react
    const lucideImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/);
    const importedSymbols = new Set();
    if (lucideImportMatch) {
        lucideImportMatch[1].split(',').forEach(s => {
            const trimmed = s.trim();
            if (trimmed) {
                // handle "Image as ImageIcon"
                const parts = trimmed.split(/\s+as\s+/);
                importedSymbols.add(parts[parts.length - 1].trim());
            }
        });
    }

    lucideIcons.forEach(icon => {
        // Check if <Icon is used in JSX
        const jsxRegex = new RegExp(`<${icon}[\\s\\/>]`);
        if (jsxRegex.test(content)) {
            if (!importedSymbols.has(icon) && !content.includes(`const ${icon}`) && !content.includes(`function ${icon}`)) {
                issues.push({ file: filePath, missingIcon: icon });
            }
        }
    });
});

console.log('--- ICON AUDIT RESULTS ---');
console.log(JSON.stringify(issues, null, 2));
