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
    const subCategory = await prisma.subCategory.findFirst({
      where: {
        categoryId: dinasCat.id,
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

  // 2. Correct Category "Seva" -> "Sewa" for category code "SEWA"
  console.log('\nStep 2: Correcting Sewa Category...');
  const sewaCat = await prisma.category.findUnique({
    where: { code: 'SEWA' },
  });

  if (!sewaCat) {
    console.error('❌ Category with code "SEWA" not found.');
  } else {
    if (sewaCat.name === 'Sewa') {
      console.log('❓ Category name with code "SEWA" is already "Sewa". No change needed.');
    } else {
      const updatedCat = await prisma.category.update({
        where: { id: sewaCat.id },
        data: { name: 'Sewa' },
      });
      console.log(`✅ Category updated: "${sewaCat.name}" -> "${updatedCat.name}"`);
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
