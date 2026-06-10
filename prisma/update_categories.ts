import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('web_ga_db')) {
  if (!process.argv.includes('--force')) {
    console.error('❌ ERROR: Running this script on the production database requires the "--force" flag!');
    process.exit(1);
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Dictionary to map category names to standard codes and icons
const CATEGORY_META: Record<string, { code: string; icon: string }> = {
  'LV': { code: 'LV', icon: 'car' },
  'Bus': { code: 'BUS', icon: 'bus' },
  'Catering': { code: 'CATERING', icon: 'utensils' },
  'Minum': { code: 'MINUM', icon: 'droplet' },
  'ATK': { code: 'ATK', icon: 'paperclip' },
  'Konsumsi Kantor': { code: 'KONSUMSI_KANTOR', icon: 'coffee' },
  'Rumah Tangga Konsumsi': { code: 'RUMAH_TANGGA', icon: 'sparkles' },
  'Sewa': { code: 'SEWA', icon: 'home' },
  'Maintenance': { code: 'MAINTENANCE', icon: 'wrench' },
  'Listrik': { code: 'LISTRIK', icon: 'zap' },
  'Internet': { code: 'INTERNET', icon: 'wifi' },
  'Keamanan dan Kebersihan': { code: 'KEAMANAN_KEBERSIHAN', icon: 'shield' },
  'PDAM': { code: 'PDAM', icon: 'droplet' },
  'MCU': { code: 'MCU', icon: 'heart-pulse' },
  'Cuti Periodik': { code: 'CUTI_PERIODIK', icon: 'calendar' },
  'Dinas': { code: 'DINAS', icon: 'briefcase' },
  'Seragam': { code: 'SERAGAM', icon: 'shirt' },
  'Olahraga': { code: 'OLAHRAGA', icon: 'activity' },
  'Entertainment': { code: 'ENTERTAINMENT', icon: 'tv' },
  'Special Event': { code: 'SPECIAL_EVENT', icon: 'gift' },
  'Suka Duka Karyawan': { code: 'SUKA_DUKA', icon: 'users' },
  'Biaya Project': { code: 'PROJECT', icon: 'folder' },
  'IT Equipment': { code: 'IT_EQUIPMENT', icon: 'monitor' },
  'Office Equipment': { code: 'OFFICE_EQUIPMENT', icon: 'printer' },
  'Biaya Lainnya': { code: 'LAINNYA', icon: 'package' },
  'Pengadaan': { code: 'PENGADAAN', icon: 'shopping-cart' },
  'Enterprise Software': { code: 'SOFTWARE', icon: 'cpu' },
  'CSR': { code: 'CSR', icon: 'heart' },
  'Biaya Operasional Direksi': { code: 'OP_DIREKSI', icon: 'award' },
};

function generateCode(name: string): string {
  return name.toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function main() {
  console.log('📖 Reading category file...');
  const filePath = path.resolve(__dirname, '../../category');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Category file not found at: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  interface ParsedCategory {
    name: string;
    subCategories: string[];
  }

  const parsedCategories: ParsedCategory[] = [];
  let currentCategory: ParsedCategory | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip header
    if (trimmed.startsWith('Kategori') && trimmed.includes('Sub-Kategori')) {
      continue;
    }

    const parts = line.split('\t');
    const catPart = parts[0]?.trim();
    const subPart = parts[1]?.trim();

    if (catPart) {
      // New category starts
      currentCategory = { name: catPart, subCategories: [] };
      parsedCategories.push(currentCategory);
    }

    if (subPart && subPart !== '-' && currentCategory) {
      currentCategory.subCategories.push(subPart);
    }
  }

  // 1. Sort Categories alphabetically by name
  parsedCategories.sort((a, b) => a.name.localeCompare(b.name, 'id'));

  // 2. Sort Subcategories alphabetically for each category
  for (const cat of parsedCategories) {
    cat.subCategories.sort((a, b) => a.localeCompare(b, 'id'));
  }

  console.log(`Parsed and sorted ${parsedCategories.length} categories.`);

  // 3. Write sorted list back to the category file
  let newContent = 'Kategori\tSub-Kategori\n\n';
  for (const cat of parsedCategories) {
    if (cat.subCategories.length === 0) {
      newContent += `${cat.name}\t-\n`;
    } else {
      newContent += `${cat.name}\t${cat.subCategories[0]}\n`;
      for (let i = 1; i < cat.subCategories.length; i++) {
        newContent += `\t${cat.subCategories[i]}\n`;
      }
    }
  }
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log('📝 Updated category file with alphabetical order.');

  console.log('🧹 Clearing old categories and subcategories...');
  const deletedSubs = await prisma.subCategory.deleteMany({});
  console.log(`✅ Deleted ${deletedSubs.count} SubCategories`);

  const deletedCats = await prisma.category.deleteMany({});
  console.log(`✅ Deleted ${deletedCats.count} Categories`);

  console.log('🌱 Seeding sorted categories and subcategories...');
  let sortOrder = 1;
  for (const cat of parsedCategories) {
    const meta = CATEGORY_META[cat.name] || {
      code: generateCode(cat.name),
      icon: 'package',
    };

    const createdCat = await prisma.category.create({
      data: {
        name: cat.name,
        code: meta.code,
        icon: meta.icon,
        isSystem: false,
        sortOrder: sortOrder++,
      },
    });

    console.log(`✅ Category created: ${createdCat.name} (${createdCat.code})`);

    for (const subName of cat.subCategories) {
      const createdSub = await prisma.subCategory.create({
        data: {
          categoryId: createdCat.id,
          name: subName,
        },
      });
      console.log(`   - SubCategory: ${createdSub.name}`);
    }
  }

  console.log('🎉 Database categories updated and sorted successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Update failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
