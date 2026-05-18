import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ============================================================
  // 1. Create default branch (HRGA - Head Office)
  // ============================================================
  const hoBranch = await prisma.branch.upsert({
    where: { code: 'HO' },
    update: {},
    create: {
      name: 'HRGA - Head Office',
      code: 'HO',
      address: null,
      isActive: true,
    },
  });
  console.log(`✅ Branch created: ${hoBranch.name} (${hoBranch.code})`);

  // ============================================================
  // 2. Create Superadmin user
  // ============================================================
  const passwordHash = await bcrypt.hash('admin123', 12);
  const superadmin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      passwordHash,
      fullName: 'Super Administrator',
      role: 'SUPERADMIN',
      branchId: null, // Superadmin has access to all branches
      isActive: true,
    },
  });
  console.log(`✅ Superadmin created: ${superadmin.username}`);

  // ============================================================
  // 3. Create categories with sub-categories
  // ============================================================
  const categoriesData = [
    {
      name: 'Makanan & Minuman',
      code: 'FOOD',
      icon: 'utensils',
      sortOrder: 1,
      fieldsConfig: {
        fields: [
          {
            key: 'expiry_date',
            label: 'Tanggal Kadaluarsa',
            type: 'date',
            required: false,
          },
          {
            key: 'storage',
            label: 'Penyimpanan',
            type: 'select',
            options: ['Kulkas', 'Gudang', 'Pantry'],
            required: false,
          },
        ],
      },
      subCategories: [
        'Susu',
        'Air Mineral',
        'Snack',
        'Makan Siang',
        'Kopi & Teh',
        'Gula & Krimer',
      ],
    },
    {
      name: 'Utilitas',
      code: 'UTIL',
      icon: 'zap',
      sortOrder: 2,
      fieldsConfig: {
        fields: [
          {
            key: 'billing_period',
            label: 'Periode Tagihan',
            type: 'text',
            required: false,
          },
          {
            key: 'account_number',
            label: 'Nomor Pelanggan',
            type: 'text',
            required: false,
          },
        ],
      },
      subCategories: ['Listrik', 'Air PDAM', 'Internet', 'Telepon', 'Gas'],
    },
    {
      name: 'ATK (Alat Tulis Kantor)',
      code: 'ATK',
      icon: 'paperclip',
      sortOrder: 3,
      fieldsConfig: Prisma.JsonNull,
      subCategories: [
        'Kertas',
        'Pulpen',
        'Tinta Printer',
        'Map & Amplop',
        'Stapler & Klip',
      ],
    },
    {
      name: 'Kebersihan',
      code: 'CLEAN',
      icon: 'sparkles',
      sortOrder: 4,
      fieldsConfig: Prisma.JsonNull,
      subCategories: [
        'Sabun',
        'Pel & Sapu',
        'Tisu',
        'Kantong Sampah',
        'Pewangi Ruangan',
      ],
    },
    {
      name: 'Pemeliharaan',
      code: 'MAINT',
      icon: 'wrench',
      sortOrder: 5,
      fieldsConfig: {
        fields: [
          {
            key: 'asset_name',
            label: 'Nama Aset',
            type: 'text',
            required: false,
          },
          {
            key: 'service_type',
            label: 'Jenis Service',
            type: 'select',
            options: ['Rutin', 'Perbaikan', 'Penggantian'],
            required: false,
          },
        ],
      },
      subCategories: [
        'Service AC',
        'Perbaikan Gedung',
        'Spare Part',
        'Fumigasi',
        'Service Kendaraan',
      ],
    },
    {
      name: 'Transportasi',
      code: 'TRANS',
      icon: 'car',
      sortOrder: 6,
      fieldsConfig: {
        fields: [
          {
            key: 'vehicle_plate',
            label: 'Nomor Kendaraan',
            type: 'text',
            required: false,
          },
          {
            key: 'destination',
            label: 'Tujuan',
            type: 'text',
            required: false,
          },
        ],
      },
      subCategories: ['BBM', 'Parkir', 'Tol', 'Ojek Online', 'Sewa Kendaraan'],
    },
    {
      name: 'Lain-lain',
      code: 'OTHER',
      icon: 'package',
      sortOrder: 7,
      fieldsConfig: Prisma.JsonNull,
      subCategories: ['Umum'],
    },
  ];

  for (const cat of categoriesData) {
    const category = await prisma.category.upsert({
      where: { code: cat.code },
      update: {},
      create: {
        name: cat.name,
        code: cat.code,
        icon: cat.icon,
        isSystem: true,
        fieldsConfig: cat.fieldsConfig as Prisma.InputJsonValue | typeof Prisma.JsonNull,
        sortOrder: cat.sortOrder,
      },
    });

    // Create sub-categories
    for (const subName of cat.subCategories) {
      await prisma.subCategory.upsert({
        where: {
          id: 0, // Force create — upsert requires unique field
        },
        update: {},
        create: {
          categoryId: category.id,
          name: subName,
        },
      });
    }

    console.log(
      `✅ Category: ${category.name} (${cat.subCategories.length} sub-categories)`
    );
  }

  console.log('\n🎉 Seeding complete!');
  console.log('   Default login: superadmin / admin123');
  console.log('   ⚠️  Change the password after first login!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
