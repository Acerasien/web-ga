import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Starting safe category/subcategory corrections...');

  // 1. Correct "Advan" -> "Advance" subcategory under category code "DINAS"
  console.log('\nStep 1: Correcting Dinas Subcategory...');
  const dinasCat = await prisma.category.findUnique({
    where: { code: 'DINAS' },
  });

  if (!dinasCat) {
    console.error('❌ Parent category with code "DINAS" not found.');
  } else {
    const targetCat = dinasCat || await prisma.category.findFirst({ where: { name: 'Dinas' } });
    if (!targetCat) {
      console.error('❌ Category "Dinas" not found by code or name.');
    } else {
      const subCategory = await prisma.subCategory.findFirst({
        where: {
          categoryId: targetCat.id,
          name: 'Advan',
        },
      });

      if (!subCategory) {
        console.log('❓ Subcategory "Advan" not found under "Dinas". Already renamed or missing.');
      } else {
        const updatedSub = await prisma.subCategory.update({
          where: { id: subCategory.id },
          data: { name: 'Advance' },
        });
        console.log(`✅ Subcategory updated: "${subCategory.name}" -> "${updatedSub.name}"`);
      }
    }
  }

  // 2. Correct Category "Seva" -> "Sewa" and code "SEVA" -> "SEWA"
  console.log('\nStep 2: Correcting Sewa Category...');
  const sevaCat = await prisma.category.findFirst({
    where: {
      OR: [
        { code: 'SEVA' },
        { code: 'SEWA' }
      ]
    }
  });

  if (!sevaCat) {
    console.error('❌ Category with code "SEVA" or "SEWA" not found.');
  } else {
    if (sevaCat.name === 'Sewa' && sevaCat.code === 'SEWA') {
      console.log('❓ Category is already named "Sewa" with code "SEWA". No change needed.');
    } else {
      const updatedCat = await prisma.category.update({
        where: { id: sevaCat.id },
        data: {
          name: 'Sewa',
          code: 'SEWA'
        },
      });
      console.log(`✅ Category updated: name "${sevaCat.name}" -> "${updatedCat.name}", code "${sevaCat.code}" -> "${updatedCat.code}"`);
    }
  }

  console.log('\n🎉 Corrections complete!');
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
